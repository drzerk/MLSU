import React, { useState, useEffect } from 'react';
import {
  Lock,
  Unlock,
  Shield,
  ShieldAlert,
  Key,
  FolderLock,
  Smartphone,
  Eye,
  EyeOff,
  AlertTriangle,
  RotateCcw,
  Clock,
  Battery,
  Wifi,
  Signal,
  CheckCircle2,
  FileText,
  Users,
  MessageSquare,
  Image as ImageIcon,
  KeyRound,
  Plus,
  RefreshCw,
  LogOut,
  ChevronRight,
  Info,
  History,
  Fingerprint,
  ScanFace,
  Sparkles,
} from 'lucide-react';
import { MlsuKeyStore } from '../crypto/mlsuEngine';
import { SAMPLE_PROFILES } from '../data/sampleProfiles';
import {
  ProfileData,
  UnlockOutcome,
  AuditLogEntry,
  BiometricMode,
  BiometricSensorType,
  BiometricFingerprint,
} from '../types';
import { AuditLogHistory } from './AuditLogHistory';
import { BiometricScannerModal } from './BiometricScannerModal';
import { BiometricManagerPanel } from './BiometricManagerPanel';
import { SystemIntegrityDashboard } from './SystemIntegrityDashboard';
import { SecurityAuditIntegrityCheck } from './SecurityAuditIntegrityCheck';

interface PhoneSimulatorProps {
  engine: MlsuKeyStore;
  onStoreUpdated: () => void;
  auditLogs?: AuditLogEntry[];
  onAddAuditLog?: (entry: Omit<AuditLogEntry, 'id' | 'timestamp' | 'timeFormatted'>) => void;
  onClearAuditLogs?: () => void;
  onUpdateAuditLogs?: (logs: AuditLogEntry[]) => void;
}

export const PhoneSimulator: React.FC<PhoneSimulatorProps> = ({
  engine,
  onStoreUpdated,
  auditLogs: externalAuditLogs,
  onAddAuditLog: externalAddAuditLog,
  onClearAuditLogs: externalClearAuditLogs,
  onUpdateAuditLogs: externalUpdateAuditLogs,
}) => {
  const [pinInput, setPinInput] = useState<string>('');
  const [isUnlocked, setIsUnlocked] = useState<boolean>(false);
  const [activeProfileId, setActiveProfileId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'home' | 'notes' | 'contacts' | 'messages' | 'vault' | 'settings'>('home');
  const [lastOutcome, setLastOutcome] = useState<UnlockOutcome | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDate, setCurrentDate] = useState<string>('');
  const [showKeyDetails, setShowKeyDetails] = useState<boolean>(false);

  // Biometric Security Layer State
  const [biometricMode, setBiometricMode] = useState<BiometricMode>('two_factor_verification');
  const [sensorType, setSensorType] = useState<BiometricSensorType>('fingerprint');
  const [isBiometricModalOpen, setIsBiometricModalOpen] = useState<boolean>(false);
  const [pendingCandidate, setPendingCandidate] = useState<{
    pin: string;
    profileId: number;
    profileName: string;
  } | null>(null);
  const [isOnScreenScanning, setIsOnScreenScanning] = useState<boolean>(false);

  // Enrolled Biometric Profiles mapping to MLSU slots
  const [enrolledFingers, setEnrolledFingers] = useState<BiometricFingerprint[]>([
    {
      id: 'fp-1',
      name: 'Right Index (Master)',
      finger: 'Index',
      profileId: 1,
      profileName: 'Private Space',
      pin: '471903',
      enrolledDate: '2026-08-19',
      sensorColor: 'bg-indigo-600',
    },
    {
      id: 'fp-2',
      name: 'Right Thumb (Duress)',
      finger: 'Thumb',
      profileId: 2,
      profileName: 'Restricted Travel',
      pin: '220561',
      enrolledDate: '2026-08-19',
      sensorColor: 'bg-emerald-600',
    },
  ]);

  // Settings in-app state for enrolling / modifying PINs
  const [newPin, setNewPin] = useState<string>('');
  const [newProfileId, setNewProfileId] = useState<number>(3);
  const [actionStatus, setActionStatus] = useState<string | null>(null);

  // Visual Audit Log State
  const [internalAuditLogs, setInternalAuditLogs] = useState<AuditLogEntry[]>([
    {
      id: 'log-boot-1',
      timestamp: new Date(Date.now() - 60000).toISOString(),
      timeFormatted: new Date(Date.now() - 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) + '.104',
      type: 'profile_enroll',
      title: 'Profile 1 Enrolled (Private Space)',
      details: 'Enrolled confidential private workspace in Slot 1. CE key sealed with Argon2id + AEAD.',
      pinMasked: '•••••• (471903)',
      profileId: 1,
      profileName: 'Private Space',
      slotIndex: 0,
      weaverFailures: 0,
      memoryState: 'Cold storage unmounted. No keys in volatile RAM.',
      severity: 'info',
    },
    {
      id: 'log-boot-2',
      timestamp: new Date(Date.now() - 45000).toISOString(),
      timeFormatted: new Date(Date.now() - 45000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) + '.582',
      type: 'profile_enroll',
      title: 'Profile 2 Enrolled (Restricted Travel)',
      details: 'Enrolled decoy travel profile in Slot 2. Storage file size remains constant 4 slots (SR-8).',
      pinMasked: '•••••• (220561)',
      profileId: 2,
      profileName: 'Restricted Travel',
      slotIndex: 1,
      weaverFailures: 0,
      memoryState: 'Cold storage unmounted. Decoy slots filled with uniform random noise.',
      severity: 'info',
    },
    {
      id: 'log-boot-3',
      timestamp: new Date(Date.now() - 30000).toISOString(),
      timeFormatted: new Date(Date.now() - 30000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) + '.912',
      type: 'device_lock',
      title: 'System Boot Completed & Locked',
      details: 'MLSU KeyStore initialized with 4 fixed slots. Lock screen armed for multi-profile authentication.',
      pinMasked: 'N/A',
      profileId: null,
      weaverFailures: 0,
      memoryState: 'RAM clear. Device awaiting single-PIN challenge.',
      severity: 'info',
    },
  ]);

  const auditLogs = externalAuditLogs || internalAuditLogs;

  const addAuditLog = (entry: Omit<AuditLogEntry, 'id' | 'timestamp' | 'timeFormatted'>) => {
    if (externalAddAuditLog) {
      externalAddAuditLog(entry);
      return;
    }
    const now = new Date();
    const formatted =
      now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) +
      '.' +
      String(now.getMilliseconds()).padStart(3, '0');
    
    const newEntry: AuditLogEntry = {
      ...entry,
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: now.toISOString(),
      timeFormatted: formatted,
    };

    setInternalAuditLogs((prev) => [newEntry, ...prev]);
  };

  const handleClearLogs = () => {
    if (externalClearAuditLogs) {
      externalClearAuditLogs();
    } else {
      setInternalAuditLogs([]);
    }
  };

  const handleUpdateLogs = (newLogs: AuditLogEntry[]) => {
    if (externalUpdateAuditLogs) {
      externalUpdateAuditLogs(newLogs);
    } else {
      setInternalAuditLogs(newLogs);
    }
  };

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }));
      setCurrentDate(now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleKeypadPress = (digit: string) => {
    if (pinInput.length < 12) {
      setPinInput((prev) => prev + digit);
    }
  };

  const handleBackspace = () => {
    setPinInput((prev) => prev.slice(0, -1));
  };

  const executeDirectUnlock = async (pin: string, isBiometricTriggered: boolean = false, fingerLabel?: string) => {
    setIsProcessing(true);
    setLastOutcome(null);

    const maskedPin = pin.length <= 4 ? '••••' : `•••• (${pin.length} digits)`;
    const maxFailuresSoFar = Math.max(...engine.slots.map((s) => s.failures));

    try {
      const outcome = await engine.unlock(pin);
      setLastOutcome(outcome);
      onStoreUpdated();

      if (outcome.lockedOut) {
        addAuditLog({
          type: 'weaver_lockout',
          title: 'Permanent Weaver Lockout Triggered',
          details: 'Authentication rejected. Hardware rate limiter reached maximum failure threshold (30 attempts). Store locked permanently.',
          pinMasked: maskedPin,
          weaverFailures: 30,
          durationMs: outcome.executionTimeMs,
          memoryState: 'Lockout active. All key unwrapping operations suspended.',
          severity: 'error',
        });
      } else if (outcome.throttledRemaining > 0 && !outcome.found) {
        addAuditLog({
          type: 'weaver_throttle',
          title: `Rate Limiter Active (${Math.ceil(outcome.throttledRemaining)}s remaining)`,
          details: `Authentication attempt throttled by Weaver hardware rate limiter. Next try permitted after cooling interval.`,
          pinMasked: maskedPin,
          weaverFailures: maxFailuresSoFar + 1,
          durationMs: outcome.executionTimeMs,
          memoryState: 'Rate limit delay enforced.',
          severity: 'warning',
        });
      } else if (outcome.found && outcome.profileId !== null) {
        const targetProfile = SAMPLE_PROFILES[outcome.profileId] || { name: `Profile ${outcome.profileId}` };
        const isSwitch = activeProfileId !== null && activeProfileId !== outcome.profileId;

        if (isBiometricTriggered) {
          addAuditLog({
            type: 'biometric_success',
            title: `Biometric Direct Match ➔ ${targetProfile.name}`,
            details: `Secure Enclave verified ${fingerLabel || 'biometric sensor'} and released hardware-bound wrapping key in ${outcome.executionTimeMs.toFixed(1)} ms.`,
            pinMasked: `${pin.replace(/./g, '•')} (${pin})`,
            profileId: outcome.profileId,
            profileName: targetProfile.name,
            slotIndex: outcome.slotIndex,
            durationMs: outcome.executionTimeMs,
            weaverFailures: 0,
            memoryState: `CE Class Key for Profile ${outcome.profileId} loaded into RAM. Other profile keys do not exist in volatile memory (SR-2).`,
            severity: 'success',
          });
        } else {
          addAuditLog({
            type: isSwitch ? 'profile_switch' : 'auth_success',
            title: isSwitch
              ? `Profile Switched ➔ ${targetProfile.name} (Profile ${outcome.profileId})`
              : `Authentication Succeeded ➔ ${targetProfile.name}`,
            details: `Unsealed Slot #${(outcome.slotIndex || 0) + 1} via constant-time AEAD unwrap in ${outcome.executionTimeMs.toFixed(1)} ms. CE encryption key unsealed.`,
            pinMasked: `${pin.replace(/./g, '•')} (${pin})`,
            profileId: outcome.profileId,
            profileName: targetProfile.name,
            slotIndex: outcome.slotIndex,
            durationMs: outcome.executionTimeMs,
            weaverFailures: 0,
            memoryState: `CE Class Key for Profile ${outcome.profileId} loaded into RAM. Other profile keys do not exist in volatile memory (SR-2).`,
            severity: 'success',
          });
        }

        setActiveProfileId(outcome.profileId);
        setIsUnlocked(true);
        setActiveTab('home');
        setPinInput('');
      } else {
        const updatedFailures = Math.max(...engine.slots.map((s) => s.failures));
        addAuditLog({
          type: 'auth_failure',
          title: 'Authentication Failed (No Profile Matched)',
          details: `Evaluated all 4 slots unconditionally in ${outcome.executionTimeMs.toFixed(1)} ms. Weaver failure counters incremented across all slots (Finding F-1).`,
          pinMasked: `${pin.replace(/./g, '•')} (${pin})`,
          durationMs: outcome.executionTimeMs,
          weaverFailures: updatedFailures,
          memoryState: 'No keys loaded. Decoy folding returned zero mask.',
          severity: 'error',
        });
        setPinInput('');
      }
    } catch (err: any) {
      console.error(err);
      addAuditLog({
        type: 'auth_failure',
        title: 'Cryptographic Evaluation Error',
        details: err?.message || 'Unexpected exception during KDF derivation.',
        pinMasked: maskedPin,
        memoryState: 'Error state. Volatile memory unchanged.',
        severity: 'error',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSecurityFuzzing = async (batchSize: number) => {
    let totalEvalTime = 0;
    let attemptsRun = 0;

    for (let i = 0; i < batchSize; i++) {
      // Generate randomized 4 to 8 digit invalid PIN
      const pinLength = 4 + Math.floor(Math.random() * 4);
      let randomPin = '';
      for (let j = 0; j < pinLength; j++) {
        randomPin += Math.floor(Math.random() * 10).toString();
      }

      // Ensure it doesn't accidentally collide with any active enrolled PIN
      const enrolled = Array.from(engine.enrolledPins.values());
      if (enrolled.includes(randomPin)) {
        randomPin = '00000000';
      }

      const outcome = await engine.unlock(randomPin);
      totalEvalTime += outcome.executionTimeMs;
      attemptsRun++;
      setLastOutcome(outcome);

      const maxFailures = Math.max(...engine.slots.map((s) => s.failures));

      if (outcome.lockedOut) {
        addAuditLog({
          type: 'weaver_lockout',
          title: `[Fuzz #${i + 1}] Weaver Hardware Lockout Enforced`,
          details: `Security fuzzing hit maximum failure limit (30 attempts). Multi-level key unwrapping permanently disabled.`,
          pinMasked: `${randomPin.replace(/./g, '•')} (${randomPin})`,
          weaverFailures: 30,
          durationMs: outcome.executionTimeMs,
          memoryState: 'Store locked permanently. All slots disabled.',
          severity: 'error',
        });
        break; // Permanent lockout reached
      } else if (outcome.throttledRemaining > 0 && !outcome.found) {
        addAuditLog({
          type: 'weaver_throttle',
          title: `[Fuzz #${i + 1}] Weaver Cooling Throttle (${Math.ceil(outcome.throttledRemaining)}s)`,
          details: `Weaver exponential backoff delay triggered after ${maxFailures} consecutive invalid attempts.`,
          pinMasked: `${randomPin.replace(/./g, '•')} (${randomPin})`,
          weaverFailures: maxFailures,
          durationMs: outcome.executionTimeMs,
          memoryState: 'Rate-limiting throttle enforced.',
          severity: 'warning',
        });
      } else {
        addAuditLog({
          type: 'auth_failure',
          title: `[Fuzz #${i + 1}] Invalid Input Evaluated (Constant-Time)`,
          details: `All 4 slots evaluated in ${outcome.executionTimeMs.toFixed(1)} ms. All slot counters incremented (Finding F-1).`,
          pinMasked: `${randomPin.replace(/./g, '•')} (${randomPin})`,
          durationMs: outcome.executionTimeMs,
          weaverFailures: maxFailures,
          memoryState: 'Zeroized fold mask (0x00). Zero keys leaked.',
          severity: 'error',
        });
      }

      // Small tick between fuzz events for smooth UI rendering
      await new Promise((r) => setTimeout(r, 40));
    }

    onStoreUpdated();

    const currentFailures = engine.slots.map((s) => s.failures);
    const throttledSec = engine.rateLimitRemaining();
    const isLocked = engine.anyLockedOut;

    return {
      attemptsRun,
      lockoutEnforced: isLocked,
      throttledSeconds: throttledSec,
      avgEvaluationTimeMs: attemptsRun > 0 ? totalEvalTime / attemptsRun : 0,
      slotFailureCounters: currentFailures,
    };
  };

  const handleUnlockAttempt = async (overridePin?: string) => {
    const pin = overridePin !== undefined ? overridePin : pinInput;
    if (!pin) return;

    // Check if 2FA Biometric verification is enabled
    if (biometricMode === 'two_factor_verification') {
      // First dry-run or identify candidate
      setIsProcessing(true);
      try {
        const outcome = await engine.unlock(pin);
        setIsProcessing(false);

        if (outcome.found && outcome.profileId !== null) {
          const targetProfile = SAMPLE_PROFILES[outcome.profileId] || { name: `Profile ${outcome.profileId}` };
          setPendingCandidate({
            pin,
            profileId: outcome.profileId,
            profileName: targetProfile.name,
          });
          setIsBiometricModalOpen(true);
          return;
        } else {
          // If wrong PIN, let normal failure evaluation handle it immediately
          setLastOutcome(outcome);
          onStoreUpdated();
          const updatedFailures = Math.max(...engine.slots.map((s) => s.failures));
          addAuditLog({
            type: 'auth_failure',
            title: 'Authentication Failed (No Profile Matched)',
            details: `Evaluated all 4 slots unconditionally in ${outcome.executionTimeMs.toFixed(1)} ms. Weaver failure counters incremented across all slots.`,
            pinMasked: `${pin.replace(/./g, '•')} (${pin})`,
            durationMs: outcome.executionTimeMs,
            weaverFailures: updatedFailures,
            memoryState: 'No keys loaded. Decoy folding returned zero mask.',
            severity: 'error',
          });
          setPinInput('');
          return;
        }
      } catch (err) {
        setIsProcessing(false);
      }
    }

    // Direct PIN unlock without 2FA prompt
    await executeDirectUnlock(pin, false);
  };

  const handleBiometricModalSuccess = async () => {
    if (!pendingCandidate) return;
    const { pin, profileId, profileName } = pendingCandidate;
    setIsBiometricModalOpen(false);

    addAuditLog({
      type: 'biometric_success',
      title: `2FA Biometric Verified ➔ ${profileName}`,
      details: `Hardware biometric template matched in Secure Enclave. Authorizing CE Class key unseal for Profile ${profileId}.`,
      pinMasked: `${pin.replace(/./g, '•')} (${pin})`,
      profileId,
      profileName,
      weaverFailures: 0,
      memoryState: `CE Class Key for Profile ${profileId} loaded into RAM. Zero trace of foreign profiles (SR-2).`,
      severity: 'success',
    });

    await executeDirectUnlock(pin, false);
    setPendingCandidate(null);
  };

  const handleBiometricModalFail = (reason: string) => {
    setIsBiometricModalOpen(false);
    const candidate = pendingCandidate;
    setPendingCandidate(null);

    addAuditLog({
      type: 'biometric_failure',
      title: '2FA Biometric Verification Rejected',
      details: `${reason}. Unlock aborted before key was released from Secure Enclave. CE key remains encrypted in cold storage.`,
      pinMasked: candidate ? `${candidate.pin.replace(/./g, '•')} (${candidate.pin})` : '••••',
      profileId: candidate?.profileId || null,
      profileName: candidate?.profileName || undefined,
      weaverFailures: Math.max(...engine.slots.map((s) => s.failures)),
      memoryState: 'RAM completely sanitized. Key derivation aborted.',
      severity: 'error',
    });

    setPinInput('');
  };

  const handleTriggerBiometricUnlock = async (finger: BiometricFingerprint) => {
    if (isUnlocked || isProcessing) return;
    setIsOnScreenScanning(true);
    setTimeout(async () => {
      setIsOnScreenScanning(false);
      await executeDirectUnlock(finger.pin, true, finger.name);
    }, 700);
  };

  const handleTriggerBiometricFailure = (fingerName: string) => {
    if (isUnlocked || isProcessing) return;
    setIsOnScreenScanning(true);
    setTimeout(() => {
      setIsOnScreenScanning(false);
      addAuditLog({
        type: 'biometric_failure',
        title: `Biometric Rejected: ${fingerName}`,
        details: `Hardware biometric sensor scanned unmapped print. Template signature rejected by Secure Enclave. Zero slots unsealed.`,
        pinMasked: 'N/A',
        weaverFailures: Math.max(...engine.slots.map((s) => s.failures)),
        memoryState: 'RAM untouched. No keys released.',
        severity: 'error',
      });
    }, 700);
  };

  const handleOnScreenSensorClick = () => {
    if (isUnlocked || isProcessing || isLockedOut || throttledRemaining > 0) return;
    // If PIN is entered, attempt unlock with PIN
    if (pinInput.length >= 4) {
      handleUnlockAttempt();
    } else {
      // Default to the Master fingerprint (Profile 1) if direct unlock is enabled
      const defaultFinger = enrolledFingers[0];
      if (defaultFinger) {
        handleTriggerBiometricUnlock(defaultFinger);
      }
    }
  };

  const handleLock = () => {
    const prevProfile = activeProfileId ? SAMPLE_PROFILES[activeProfileId]?.name || `Profile ${activeProfileId}` : 'Active Profile';

    addAuditLog({
      type: 'device_lock',
      title: 'Device Locked ➔ CE Key Purged from RAM',
      details: `User locked device from ${prevProfile}. The Credential Encrypted (CE) class key was wiped from volatile memory with zero foreign traces left (SR-2).`,
      pinMasked: 'N/A',
      profileId: activeProfileId,
      profileName: prevProfile,
      memoryState: 'RAM completely sanitized. Device returned to uniform single-screen lock.',
      severity: 'info',
    });

    setIsUnlocked(false);
    setActiveProfileId(null);
    setPinInput('');
    setLastOutcome(null);
    setActiveTab('home');
    onStoreUpdated();
  };

  const handleQuickFill = (pin: string) => {
    setPinInput(pin);
    handleUnlockAttempt(pin);
  };

  const handleEnrollNewProfile = async () => {
    if (!newPin || newPin.length < 4) {
      setActionStatus('PIN must be at least 4 digits');
      return;
    }
    try {
      const slot = await engine.enroll(newPin, newProfileId);
      setActionStatus(`Enrolled Profile ${newProfileId} in Slot ${slot + 1}!`);

      addAuditLog({
        type: 'profile_enroll',
        title: `Enrolled New Profile ${newProfileId}`,
        details: `Occupied random free Slot #${slot + 1} with freshly generated 32-byte CE profile key (SR-8).`,
        pinMasked: `${newPin.replace(/./g, '•')} (${newPin})`,
        profileId: newProfileId,
        profileName: `Custom Profile ${newProfileId}`,
        slotIndex: slot,
        weaverFailures: 0,
        memoryState: 'Profile key sealed into AEAD ciphertext blob.',
        severity: 'info',
      });

      setNewPin('');
      onStoreUpdated();
    } catch (e: any) {
      setActionStatus(`Error: ${e.message}`);
    }
  };

  const handleResetCounters = () => {
    engine.resetFailureCounters();
    onStoreUpdated();

    addAuditLog({
      type: 'counter_reset',
      title: 'Weaver Rate Limiter Counters Cleared',
      details: 'Manual audit override: reset failure counters across all 4 storage slots for benchmarking.',
      pinMasked: 'N/A',
      weaverFailures: 0,
      memoryState: 'Rate limit delays cleared. Ready for immediate unlock.',
      severity: 'info',
    });
  };

  const activeProfile: ProfileData | null = activeProfileId ? SAMPLE_PROFILES[activeProfileId] || {
    id: activeProfileId,
    name: `Custom Profile ${activeProfileId}`,
    pin: '••••',
    type: 'restricted',
    tagline: 'Custom enrolled profile workspace',
    notes: [{ id: 'n1', title: 'Custom Profile Note', content: 'This profile was dynamically enrolled into an MLSU slot.', date: 'Today', category: 'General' }],
    contacts: [{ id: 'c1', name: 'Local User', role: 'Owner', phone: '+1 555-0199', avatarColor: 'bg-purple-600' }],
    messages: [{ id: 'm1', sender: 'System', preview: 'Storage partition mounted successfully.', time: 'Just now', unread: false }],
    gallery: [{ id: 'g1', caption: 'Secure Partition', icon: 'shield', tag: 'System' }],
  } : null;

  const throttledRemaining = engine.rateLimitRemaining();
  const isLockedOut = engine.anyLockedOut;
  const maxWeaverFailures = Math.max(...engine.slots.map((s) => s.failures), 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      {/* Left / Center: Interactive Smartphone Frame */}
      <div className="lg:col-span-6 flex flex-col items-center">
        <div className="w-full max-w-[380px] bg-slate-900 rounded-[48px] p-4 shadow-2xl border-4 border-slate-700/80 ring-1 ring-white/10 relative overflow-hidden">
          {/* Hardware buttons / highlights */}
          <div className="absolute -left-[5px] top-28 w-[4px] h-12 bg-slate-600 rounded-l-md" />
          <div className="absolute -left-[5px] top-44 w-[4px] h-12 bg-slate-600 rounded-l-md" />
          <div className="absolute -right-[5px] top-32 w-[4px] h-16 bg-slate-600 rounded-r-md" />

          {/* Screen Container */}
          <div className="w-full h-[680px] bg-slate-950 rounded-[36px] overflow-hidden flex flex-col relative text-slate-100 select-none shadow-inner border border-slate-800">
            {/* Status Bar */}
            <div className="h-10 px-6 pt-2 flex items-center justify-between text-xs text-slate-400 z-30 font-medium">
              <span>{currentTime || '13:42'}</span>
              {/* Dynamic Island / Camera Notch */}
              <div className="w-24 h-4 bg-black rounded-full border border-slate-800 flex items-center justify-center gap-1.5 px-2">
                <div className="w-2 h-2 rounded-full bg-slate-900 border border-slate-700" />
                <div className="w-1.5 h-1.5 rounded-full bg-blue-900/60" />
              </div>
              <div className="flex items-center gap-1.5">
                <Signal className="w-3 h-3 text-slate-300" />
                <Wifi className="w-3 h-3 text-slate-300" />
                <Battery className="w-3.5 h-3.5 text-slate-300" />
              </div>
            </div>

            {/* SCREEN CONTENT */}
            {!isUnlocked ? (
              /* --- LOCKED SCREEN --- */
              <div className="flex-1 flex flex-col justify-between p-6 z-10">
                {/* Header Info */}
                <div className="flex flex-col items-center mt-2">
                  <div className="w-10 h-10 rounded-full bg-slate-900 border border-slate-700/80 flex items-center justify-center mb-2 shadow-sm text-slate-300">
                    <Lock className="w-5 h-5" />
                  </div>
                  <h1 className="text-3xl font-light tracking-tight text-white">{currentTime || '13:42'}</h1>
                  <p className="text-xs text-slate-400 mt-0.5">{currentDate || 'Wednesday, Aug 19'}</p>
                </div>

                {/* PIN Input Feedback */}
                <div className="flex flex-col items-center my-auto">
                  {isLockedOut ? (
                    <div className="p-3 bg-rose-950/80 border border-rose-800 rounded-xl text-center text-rose-300 text-xs flex flex-col items-center gap-1 animate-pulse">
                      <ShieldAlert className="w-5 h-5 text-rose-400" />
                      <span className="font-semibold">Device Permanently Locked</span>
                      <span>Rate limit threshold exceeded (30 failed attempts).</span>
                    </div>
                  ) : throttledRemaining > 0 ? (
                    <div className="p-3 bg-amber-950/80 border border-amber-800 rounded-xl text-center text-amber-300 text-xs flex flex-col items-center gap-1">
                      <Clock className="w-5 h-5 text-amber-400 animate-spin" />
                      <span className="font-semibold">Rate Limit Throttle Active</span>
                      <span>Retry available in {Math.ceil(throttledRemaining)}s</span>
                    </div>
                  ) : (
                    <>
                      <p className="text-xs text-slate-400 mb-3 tracking-wide">Enter PIN to unlock</p>
                      {/* PIN Dots */}
                      <div className="flex items-center gap-3 h-8 mb-2">
                        {pinInput.length === 0 ? (
                          <span className="text-xs text-slate-600 italic">No digits entered</span>
                        ) : (
                          Array.from({ length: Math.max(pinInput.length, 6) }).map((_, i) => (
                            <div
                              key={i}
                              className={`w-3.5 h-3.5 rounded-full transition-all duration-150 ${
                                i < pinInput.length
                                  ? 'bg-sky-400 shadow-sm shadow-sky-500/50 scale-110'
                                  : 'border border-slate-700 bg-slate-900/60'
                              }`}
                            />
                          ))
                        )}
                      </div>
                    </>
                  )}

                  {/* Execution Message / Outcome */}
                  {lastOutcome && !lastOutcome.found && (
                    <div className="mt-2 text-center text-[11px] text-rose-400 bg-rose-950/50 px-3 py-1 rounded-full border border-rose-900/60">
                      {lastOutcome.message}
                    </div>
                  )}
                </div>

                {/* Keypad */}
                <div className="grid grid-cols-3 gap-3 max-w-[260px] mx-auto w-full mb-3">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                    <button
                      key={digit}
                      id={`keypad-btn-${digit}`}
                      disabled={isProcessing || throttledRemaining > 0 || isLockedOut}
                      onClick={() => handleKeypadPress(digit)}
                      className="w-16 h-16 rounded-full bg-slate-900/80 hover:bg-slate-800 active:bg-slate-700 border border-slate-800 text-xl font-light text-slate-100 flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed mx-auto shadow-sm"
                    >
                      {digit}
                    </button>
                  ))}
                  <button
                    id="keypad-btn-emergency"
                    className="w-16 h-16 rounded-full flex items-center justify-center text-[11px] font-medium text-slate-400 hover:text-slate-200 transition-colors mx-auto"
                    onClick={() => alert('Emergency dialer is profile-neutral (Concept §12.5).')}
                  >
                    Emergency
                  </button>
                  <button
                    id="keypad-btn-0"
                    disabled={isProcessing || throttledRemaining > 0 || isLockedOut}
                    onClick={() => handleKeypadPress('0')}
                    className="w-16 h-16 rounded-full bg-slate-900/80 hover:bg-slate-800 active:bg-slate-700 border border-slate-800 text-xl font-light text-slate-100 flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed mx-auto shadow-sm"
                  >
                    0
                  </button>
                  <button
                    id="keypad-btn-backspace"
                    onClick={handleBackspace}
                    className="w-16 h-16 rounded-full flex items-center justify-center text-xs text-slate-400 hover:text-slate-200 transition-colors mx-auto"
                  >
                    Delete
                  </button>
                </div>

                {/* Unlock and Biometric Action Bar */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <button
                      id="phone-unlock-action-btn"
                      disabled={pinInput.length < 4 || isProcessing || throttledRemaining > 0 || isLockedOut}
                      onClick={() => handleUnlockAttempt()}
                      className="flex-1 py-2.5 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 disabled:opacity-40 disabled:pointer-events-none rounded-xl text-xs font-semibold tracking-wide text-white shadow-md flex items-center justify-center gap-2 transition-all"
                    >
                      {isProcessing ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          Evaluating Slots...
                        </>
                      ) : (
                        <>
                          <Unlock className="w-3.5 h-3.5" />
                          Unlock with PIN
                        </>
                      )}
                    </button>

                    {/* Interactive In-Display Sensor */}
                    {biometricMode !== 'disabled' && (
                      <button
                        id="phone-screen-biometric-sensor-btn"
                        disabled={isProcessing || throttledRemaining > 0 || isLockedOut}
                        onClick={handleOnScreenSensorClick}
                        title={
                          biometricMode === 'two_factor_verification'
                            ? 'Trigger Biometric 2FA Verification'
                            : 'Scan Fingerprint (Quick Unlock Profile 1)'
                        }
                        className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-all ${
                          isOnScreenScanning
                            ? 'bg-teal-500 text-slate-950 border-teal-300 scale-105 shadow-lg shadow-teal-500/40 animate-pulse'
                            : 'bg-slate-900/90 hover:bg-slate-800 border-slate-700/90 text-teal-400 hover:border-teal-500/80 active:scale-95'
                        }`}
                      >
                        {sensorType === 'fingerprint' ? (
                          <Fingerprint className="w-5 h-5" />
                        ) : (
                          <ScanFace className="w-5 h-5" />
                        )}
                      </button>
                    )}
                  </div>

                  {biometricMode !== 'disabled' && (
                    <div className="flex items-center justify-center gap-1 text-[10px] text-slate-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
                      <span>
                        {biometricMode === 'two_factor_verification'
                          ? 'Biometric 2FA Verification Active'
                          : 'In-Display Biometric Fast Unlock Ready'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* --- UNLOCKED PROFILE SCREEN --- */
              <div className="flex-1 flex flex-col overflow-hidden bg-slate-950">
                {/* Profile Header Banner */}
                <div
                  className={`p-3.5 border-b ${
                    activeProfile?.type === 'private'
                      ? 'bg-indigo-950/60 border-indigo-800/80 text-indigo-200'
                      : 'bg-slate-900/80 border-slate-800 text-slate-200'
                  } flex items-center justify-between`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center text-white ${
                        activeProfile?.type === 'private' ? 'bg-indigo-600 shadow-sm' : 'bg-emerald-600'
                      }`}
                    >
                      {activeProfile?.type === 'private' ? <FolderLock className="w-4 h-4" /> : <Smartphone className="w-4 h-4" />}
                    </div>
                    <div className="truncate">
                      <h2 className="text-xs font-semibold truncate leading-tight text-white">{activeProfile?.name}</h2>
                      <p className="text-[10px] text-slate-400 truncate">
                        {activeProfile?.type === 'private' ? 'Private Space (CE Encrypted)' : 'Standard User Profile'}
                      </p>
                    </div>
                  </div>
                  <button
                    id="phone-lock-btn"
                    onClick={handleLock}
                    className="p-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-300 text-[10px] font-medium flex items-center gap-1 shrink-0 border border-slate-700 transition-colors"
                  >
                    <Lock className="w-3 h-3 text-amber-400" />
                    Lock
                  </button>
                </div>

                {/* Sub-view Content Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {activeTab === 'home' && (
                    <div className="space-y-3">
                      {/* Notice box */}
                      <div
                        className={`p-3 rounded-xl border text-xs leading-relaxed ${
                          activeProfile?.type === 'private'
                            ? 'bg-indigo-950/40 border-indigo-800/60 text-indigo-300'
                            : 'bg-slate-900 border-slate-800 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 font-semibold text-white mb-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Active Operating Context</span>
                        </div>
                        <p className="text-[11px] text-slate-300">
                          {activeProfile?.type === 'private'
                            ? 'You are inside the Private Profile. The CE class encryption key is actively mounted in RAM. In duress situations, locking and typing the Duress PIN leaves this partition strictly encrypted with zero foreign key traces in memory (SR-2).'
                            : 'You are inside the Restricted Travel Profile. The system looks 100% natural with realistic notes, travel reservations, and contacts. There is NO visible toggle, menu, or hint that a private profile exists on this phone.'}
                        </p>
                      </div>

                      {/* App Grid */}
                      <div className="grid grid-cols-4 gap-2 pt-2">
                        <button
                          onClick={() => setActiveTab('notes')}
                          className="flex flex-col items-center gap-1 p-2 rounded-xl bg-slate-900/90 border border-slate-800 hover:bg-slate-800 transition-colors"
                        >
                          <div className="w-9 h-9 rounded-xl bg-amber-600/30 text-amber-400 flex items-center justify-center">
                            <FileText className="w-4 h-4" />
                          </div>
                          <span className="text-[10px] text-slate-300 font-medium">Notes</span>
                        </button>
                        <button
                          onClick={() => setActiveTab('contacts')}
                          className="flex flex-col items-center gap-1 p-2 rounded-xl bg-slate-900/90 border border-slate-800 hover:bg-slate-800 transition-colors"
                        >
                          <div className="w-9 h-9 rounded-xl bg-sky-600/30 text-sky-400 flex items-center justify-center">
                            <Users className="w-4 h-4" />
                          </div>
                          <span className="text-[10px] text-slate-300 font-medium">Contacts</span>
                        </button>
                        <button
                          onClick={() => setActiveTab('messages')}
                          className="flex flex-col items-center gap-1 p-2 rounded-xl bg-slate-900/90 border border-slate-800 hover:bg-slate-800 transition-colors"
                        >
                          <div className="w-9 h-9 rounded-xl bg-emerald-600/30 text-emerald-400 flex items-center justify-center">
                            <MessageSquare className="w-4 h-4" />
                          </div>
                          <span className="text-[10px] text-slate-300 font-medium">Chats</span>
                        </button>
                        {activeProfile?.type === 'private' ? (
                          <button
                            onClick={() => setActiveTab('vault')}
                            className="flex flex-col items-center gap-1 p-2 rounded-xl bg-slate-900/90 border border-slate-800 hover:bg-slate-800 transition-colors"
                          >
                            <div className="w-9 h-9 rounded-xl bg-purple-600/30 text-purple-400 flex items-center justify-center">
                              <KeyRound className="w-4 h-4" />
                            </div>
                            <span className="text-[10px] text-slate-300 font-medium">Keyrings</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => setActiveTab('notes')}
                            className="flex flex-col items-center gap-1 p-2 rounded-xl bg-slate-900/90 border border-slate-800 hover:bg-slate-800 transition-colors"
                          >
                            <div className="w-9 h-9 rounded-xl bg-blue-600/30 text-blue-400 flex items-center justify-center">
                              <ImageIcon className="w-4 h-4" />
                            </div>
                            <span className="text-[10px] text-slate-300 font-medium">Photos</span>
                          </button>
                        )}
                      </div>

                      {/* Recent Snippets */}
                      <div className="pt-2">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                            Recent Items ({activeProfile?.notes.length || 0})
                          </span>
                          <button onClick={() => setActiveTab('notes')} className="text-[10px] text-sky-400 hover:underline">
                            View all
                          </button>
                        </div>
                        <div className="space-y-2">
                          {activeProfile?.notes.slice(0, 2).map((note) => (
                            <div key={note.id} className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                              <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                                <span className="font-semibold text-slate-200">{note.title}</span>
                                <span>{note.date}</span>
                              </div>
                              <p className="text-[11px] text-slate-400 line-clamp-2">{note.content}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'notes' && (
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between pb-1 border-b border-slate-800">
                        <h3 className="text-xs font-semibold text-white">Encrypted Notes</h3>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                          {activeProfile?.notes.length} entries
                        </span>
                      </div>
                      {activeProfile?.notes.map((note) => (
                        <div key={note.id} className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-100">{note.title}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                              {note.category}
                            </span>
                          </div>
                          <p className="text-xs text-slate-300 leading-relaxed">{note.content}</p>
                          <span className="text-[10px] text-slate-500 block pt-1">{note.date}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {activeTab === 'contacts' && (
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between pb-1 border-b border-slate-800">
                        <h3 className="text-xs font-semibold text-white">Address Book</h3>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                          {activeProfile?.contacts.length} contacts
                        </span>
                      </div>
                      {activeProfile?.contacts.map((contact) => (
                        <div key={contact.id} className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full ${contact.avatarColor} text-white text-xs font-semibold flex items-center justify-center`}>
                            {contact.name.charAt(0)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="text-xs font-semibold text-slate-200 truncate">{contact.name}</h4>
                            <p className="text-[10px] text-slate-400">{contact.role}</p>
                            <p className="text-[10px] font-mono text-slate-500">{contact.phone}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {activeTab === 'messages' && (
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between pb-1 border-b border-slate-800">
                        <h3 className="text-xs font-semibold text-white">Secure Messages</h3>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                          {activeProfile?.messages.length} threads
                        </span>
                      </div>
                      {activeProfile?.messages.map((msg) => (
                        <div key={msg.id} className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-slate-200">{msg.sender}</span>
                            <span className="text-[10px] text-slate-500">{msg.time}</span>
                          </div>
                          <p className="text-[11px] text-slate-300">{msg.preview}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {activeTab === 'vault' && activeProfile?.type === 'private' && (
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between pb-1 border-b border-slate-800">
                        <h3 className="text-xs font-semibold text-white">Cryptographic Credentials</h3>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-800">
                          CE Partition
                        </span>
                      </div>
                      {activeProfile?.vaultItems?.map((v) => (
                        <div key={v.id} className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                          <div className="flex items-center justify-between text-xs font-semibold text-purple-300">
                            <span>{v.service}</span>
                          </div>
                          <p className="text-[10px] text-slate-400 font-mono">User: {v.username}</p>
                          <div className="flex items-center justify-between bg-slate-950 p-1.5 rounded text-[11px] font-mono text-emerald-400">
                            <span>{v.secret}</span>
                            <Key className="w-3 h-3 text-slate-500" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {activeTab === 'settings' && activeProfile?.type === 'private' && (
                    <div className="space-y-3 text-xs">
                      <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800 space-y-2">
                        <h4 className="font-semibold text-white flex items-center gap-1.5">
                          <Plus className="w-3.5 h-3.5 text-sky-400" />
                          Enroll Additional Profile
                        </h4>
                        <p className="text-[11px] text-slate-400">
                          Enrolment places a profile into a random unoccupied slot (SR-8).
                        </p>
                        <div className="space-y-2 pt-1">
                          <div>
                            <label className="text-[10px] text-slate-400">Profile ID (0-255)</label>
                            <input
                              type="number"
                              value={newProfileId}
                              onChange={(e) => setNewProfileId(parseInt(e.target.value) || 0)}
                              className="w-full mt-1 px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono text-xs"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-400">Profile PIN</label>
                            <input
                              type="password"
                              value={newPin}
                              placeholder="e.g. 581902"
                              onChange={(e) => setNewPin(e.target.value)}
                              className="w-full mt-1 px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono text-xs"
                            />
                          </div>
                          <button
                            onClick={handleEnrollNewProfile}
                            className="w-full py-1.5 bg-sky-600 hover:bg-sky-500 text-white font-medium rounded-lg text-xs transition-colors"
                          >
                            Enroll Profile
                          </button>
                        </div>
                        {actionStatus && (
                          <p className="text-[11px] text-emerald-400 font-mono pt-1">{actionStatus}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Bottom App Navigation Bar */}
                <div className="h-12 bg-slate-900 border-t border-slate-800 flex items-center justify-around px-2 text-slate-400">
                  <button
                    onClick={() => setActiveTab('home')}
                    className={`flex flex-col items-center gap-0.5 ${activeTab === 'home' ? 'text-sky-400 font-semibold' : 'hover:text-slate-200'}`}
                  >
                    <Smartphone className="w-4 h-4" />
                    <span className="text-[9px]">Home</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('notes')}
                    className={`flex flex-col items-center gap-0.5 ${activeTab === 'notes' ? 'text-sky-400 font-semibold' : 'hover:text-slate-200'}`}
                  >
                    <FileText className="w-4 h-4" />
                    <span className="text-[9px]">Notes</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('contacts')}
                    className={`flex flex-col items-center gap-0.5 ${activeTab === 'contacts' ? 'text-sky-400 font-semibold' : 'hover:text-slate-200'}`}
                  >
                    <Users className="w-4 h-4" />
                    <span className="text-[9px]">People</span>
                  </button>
                  {activeProfile?.type === 'private' && (
                    <button
                      onClick={() => setActiveTab('settings')}
                      className={`flex flex-col items-center gap-0.5 ${activeTab === 'settings' ? 'text-sky-400 font-semibold' : 'hover:text-slate-200'}`}
                    >
                      <Plus className="w-4 h-4" />
                      <span className="text-[9px]">Enroll</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Biometric 2FA Verification Modal Inside Screen */}
            <BiometricScannerModal
              isOpen={isBiometricModalOpen}
              onClose={() => handleBiometricModalFail('User cancelled biometric prompt')}
              sensorType={sensorType}
              targetProfileName={pendingCandidate?.profileName || 'MLSU Profile'}
              targetProfileId={pendingCandidate?.profileId || 1}
              onSuccess={handleBiometricModalSuccess}
              onFail={handleBiometricModalFail}
            />
          </div>
        </div>
      </div>

      {/* Right Column: Scenario Controls & Quick PIN Tester */}
      <div className="lg:col-span-6 space-y-6">
        {/* Biometric Security Control Deck */}
        <BiometricManagerPanel
          biometricMode={biometricMode}
          onSetBiometricMode={setBiometricMode}
          sensorType={sensorType}
          onSetSensorType={setSensorType}
          enrolledFingers={enrolledFingers}
          onTriggerBiometricUnlock={handleTriggerBiometricUnlock}
          onTriggerBiometricFailure={handleTriggerBiometricFailure}
          isUnlocked={isUnlocked}
          isLockedOut={isLockedOut}
          throttledRemaining={throttledRemaining}
        />

        {/* System Integrity Dashboard: Real-time Memory, Entropy & Crypto Primitives */}
        <SystemIntegrityDashboard
          engine={engine}
          isUnlocked={isUnlocked}
          activeProfileId={activeProfileId}
          lastExecutionTimeMs={lastOutcome?.executionTimeMs}
          onRunSecurityFuzzing={handleSecurityFuzzing}
        />

        {/* Quick Demo PIN Switcher */}
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Key className="w-4 h-4 text-sky-400" />
              Quick Test PIN Triggers
            </h3>
            <span className="text-[11px] text-slate-400 font-mono">Single Lock Screen Selection</span>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            Test the core MLSU principle: <strong>the PIN alone determines which encrypted environment is unlocked</strong>. The lock screen never changes or indicates how many profiles exist.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              id="quick-pin-private-btn"
              onClick={() => handleQuickFill('471903')}
              className="p-3 rounded-xl bg-indigo-950/60 border border-indigo-700/80 hover:bg-indigo-900/80 text-left transition-all group"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-indigo-200">Private Space</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-900 text-indigo-300">471903</span>
              </div>
              <p className="text-[11px] text-slate-300">Opens confidential files & whistleblowing data (Profile 1).</p>
            </button>

            <button
              id="quick-pin-duress-btn"
              onClick={() => handleQuickFill('220561')}
              className="p-3 rounded-xl bg-slate-800/80 border border-slate-700 hover:bg-slate-700/80 text-left transition-all group"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-slate-200">Duress / Travel</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">220561</span>
              </div>
              <p className="text-[11px] text-slate-300">Opens unremarkable travel & vacation profile (Profile 2).</p>
            </button>

            <button
              id="quick-pin-wrong-btn"
              onClick={() => handleQuickFill('999999')}
              className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/80 hover:bg-rose-900/50 text-left transition-all group"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-rose-200">Invalid PIN</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-900 text-rose-300">999999</span>
              </div>
              <p className="text-[11px] text-slate-300">Increments Weaver counters across all slots (Finding F-1).</p>
            </button>
          </div>
        </div>

        {/* Live Cryptographic Evaluation Telemetry */}
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-400" />
              Cryptographic Execution Telemetry
            </h3>
            <button
              onClick={() => setShowKeyDetails(!showKeyDetails)}
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
            >
              {showKeyDetails ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              {showKeyDetails ? 'Hide Keys' : 'Inspect Raw Keys'}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-slate-400 text-[11px]">KDF Derivations / Unlock:</span>
              <p className="font-mono text-slate-200 font-semibold">4 Slots (Unconditional)</p>
              <span className="text-[10px] text-slate-500">SR-3 / SR-9 Constant-Time Policy</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-slate-400 text-[11px]">Execution Time (Last Attempt):</span>
              <p className="font-mono text-emerald-400 font-semibold">
                {lastOutcome ? `${lastOutcome.executionTimeMs.toFixed(2)} ms` : '—'}
              </p>
              <span className="text-[10px] text-slate-500">Constant branch-free fold</span>
            </div>
          </div>

          {lastOutcome && lastOutcome.found && showKeyDetails && (
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
              <div className="flex items-center justify-between font-mono text-[11px] text-slate-400">
                <span>Derived CE Profile Key (32 bytes):</span>
                <span className="text-emerald-400">Slot {lastOutcome.slotIndex! + 1}</span>
              </div>
              <p className="font-mono text-[11px] text-amber-300 break-all bg-slate-900 p-2 rounded border border-slate-800">
                {lastOutcome.profileKeyHex}
              </p>
              <p className="text-[10px] text-slate-400">
                *Independently generated profile key unsealed from AEAD ciphertext. Keys of other profiles are not in RAM (SR-2).
              </p>
            </div>
          )}

          {/* Reset button */}
          <div className="pt-2 flex items-center justify-between border-t border-slate-800">
            <span className="text-xs text-slate-400">Reset failed attempt counters for testing:</span>
            <button
              onClick={handleResetCounters}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 flex items-center gap-1.5 transition-colors border border-slate-700"
            >
              <RotateCcw className="w-3 h-3" />
              Reset Weaver Counters
            </button>
          </div>
        </div>

        {/* Security Audit Integrity Check Simulation */}
        <SecurityAuditIntegrityCheck
          logs={auditLogs}
          onUpdateLogs={handleUpdateLogs}
          onAddAuditLog={addAuditLog}
        />

        {/* Visual Audit Log History Section */}
        <AuditLogHistory
          logs={auditLogs}
          onClearLogs={handleClearLogs}
          weaverFailureCount={maxWeaverFailures}
          isLockedOut={isLockedOut}
          throttledRemaining={throttledRemaining}
        />

        {/* Threat Level Context Card */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-900/60 border border-slate-800 text-xs space-y-2.5">
          <div className="flex items-center gap-2 font-semibold text-white">
            <Info className="w-4 h-4 text-sky-400" />
            <span>Operational Security Note</span>
          </div>
          <p className="text-slate-300 leading-relaxed">
            MLSU provides <strong>compartmentalization</strong> (compromise of one profile reveals nothing about the other) and <strong>deniability against personal coercion (A2) and brief border inspections (A3)</strong>. It is not advertised as invisible to laboratory forensic chip-off analysis (A4/A5).
          </p>
        </div>
      </div>
    </div>
  );
};
