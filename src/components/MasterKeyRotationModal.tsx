import React, { useState, useEffect } from 'react';
import {
  Key,
  Shield,
  RefreshCw,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Unlock,
  Layers,
  Sparkles,
  ArrowRight,
  Database,
  Eye,
  EyeOff,
  Cpu,
  Download,
  Check,
  X,
  Binary,
  FileCode,
  ShieldCheck,
} from 'lucide-react';
import {
  MlsuKeyStore,
  MasterKeyRotationResult,
  SlotRotationStep,
  generateRandomBytes,
  bytesToHex,
  KDF_FAST,
  KDF_STRONG,
} from '../crypto/mlsuEngine';
import { AuditLogEntry } from '../types';

interface MasterKeyRotationModalProps {
  isOpen: boolean;
  onClose: () => void;
  engine: MlsuKeyStore;
  onStoreUpdated: () => void;
  onAddAuditLog?: (entry: Omit<AuditLogEntry, 'id' | 'timestamp' | 'timeFormatted'>) => void;
}

export const MasterKeyRotationModal: React.FC<MasterKeyRotationModalProps> = ({
  isOpen,
  onClose,
  engine,
  onStoreUpdated,
  onAddAuditLog,
}) => {
  const [currentStep, setCurrentStep] = useState<'configure' | 'rotating' | 'complete'>('configure');
  const [seedMode, setSeedMode] = useState<'random' | 'custom'>('random');
  const [customSeedHex, setCustomSeedHex] = useState<string>('');
  const [generatedSeedHex, setGeneratedSeedHex] = useState<string>('');
  const [kdfMode, setKdfMode] = useState<'fast' | 'strong'>('fast');
  const [profile1Pin, setProfile1Pin] = useState<string>('471903');
  const [profile2Pin, setProfile2Pin] = useState<string>('220561');
  const [showSeedHex, setShowSeedHex] = useState<boolean>(false);

  // Live progress during rotation
  const [activeSubStepIndex, setActiveSubStepIndex] = useState<number>(0);
  const [rotationResult, setRotationResult] = useState<MasterKeyRotationResult | null>(null);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const state = engine.getState();
  const currentSeedFingerprint = engine.getMasterSeedFingerprint();
  const currentSeedHex = engine.getMasterSeedHex();

  // Generate an initial random seed candidate when opened
  useEffect(() => {
    if (isOpen) {
      const freshBytes = generateRandomBytes(32);
      setGeneratedSeedHex(bytesToHex(freshBytes));
      setCustomSeedHex(bytesToHex(freshBytes));
      setCurrentStep('configure');
      setRotationResult(null);
      setActiveSubStepIndex(0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const targetSeedHex = seedMode === 'random' ? generatedSeedHex : customSeedHex;
  const targetSeedFingerprint = targetSeedHex && targetSeedHex.length >= 8
    ? `MK-${targetSeedHex.substring(0, 4).toUpperCase()}-${targetSeedHex.substring(targetSeedHex.length - 4).toUpperCase()}`
    : 'MK-UNKNOWN';

  const handleGenerateNewSeed = () => {
    const freshBytes = generateRandomBytes(32);
    const hex = bytesToHex(freshBytes);
    setGeneratedSeedHex(hex);
    setCustomSeedHex(hex);
  };

  const handleStartRotation = async () => {
    setCurrentStep('rotating');
    setActiveSubStepIndex(0);

    const targetKdf = kdfMode === 'strong' ? KDF_STRONG : KDF_FAST;
    const profilePins: Record<number, string> = {
      1: profile1Pin,
      2: profile2Pin,
    };

    // Simulate realistic hardware Secure Enclave step timings
    await new Promise((resolve) => setTimeout(resolve, 350));
    setActiveSubStepIndex(1); // Enclave master seed staging

    await new Promise((resolve) => setTimeout(resolve, 400));
    setActiveSubStepIndex(2); // Slot decryption & fresh salt generation

    await new Promise((resolve) => setTimeout(resolve, 450));
    setActiveSubStepIndex(3); // AEAD re-wrapping

    // Execute actual cryptographic rotation on engine
    const result = await engine.rotateMasterKey(targetSeedHex, profilePins, targetKdf);

    await new Promise((resolve) => setTimeout(resolve, 350));
    setActiveSubStepIndex(4); // Zeroizing old volatile memory

    await new Promise((resolve) => setTimeout(resolve, 250));
    setActiveSubStepIndex(5); // Atomic commit & log emission

    setRotationResult(result);
    setCurrentStep('complete');
    onStoreUpdated();

    // Emit rich cryptographic Audit Log entry
    if (onAddAuditLog) {
      onAddAuditLog({
        type: 'master_key_rotation',
        title: `Master Key Rotated (${result.newSeedFingerprint})`,
        details: `Re-encrypted ${result.reEncryptedCount} active profile slots and refreshed ${result.decoyCount} decoy slots. Previous seed ${result.oldSeedFingerprint} zeroized from volatile memory in ${result.totalDurationMs.toFixed(1)}ms.`,
        pinMasked: 'ENCLAVE_ROOT_REKEY',
        profileId: null,
        profileName: 'Keystore Root',
        slotIndex: null,
        durationMs: parseFloat(result.totalDurationMs.toFixed(1)),
        weaverFailures: 0,
        memoryState: `Master seed rotated to ${result.newSeedFingerprint}. All 4 slot ciphertexts re-salted & re-authenticated (SR-8).`,
        severity: 'success',
      });
    }
  };

  const handleExportReceipt = () => {
    if (!rotationResult) return;
    setIsExporting(true);
    const receipt = {
      title: 'MLSU Master Key Rotation Certificate',
      standard: 'AOSP Multi-Layer Secure Unlock (MLSU)',
      specification: 'SR-8 Fixed Storage Layout & Constant-Time Re-Wrapping',
      ...rotationResult,
      exportedAt: new Date().toISOString(),
    };
    const dataStr = JSON.stringify(receipt, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `mlsu-key-rotation-${rotationResult.rotationId}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setTimeout(() => setIsExporting(false), 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-950/90 text-cyan-400 border border-cyan-800/80 flex items-center justify-center shadow-inner">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-tight">
                  Master Key Rotation & Slot Re-Encryption
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800">
                  SR-8 Cryptographic Re-Keying
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Re-wrap all profile keys with a fresh hardware master seed without destroying enrolled profile state
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={currentStep === 'rotating'}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {/* STEP 1: CONFIGURE ROTATION */}
          {currentStep === 'configure' && (
            <div className="space-y-5">
              {/* Current Root State vs New State Overview */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold uppercase">
                    <span>Current Active Seed</span>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  </div>
                  <p className="text-sm font-bold text-slate-200 font-mono">{currentSeedFingerprint}</p>
                  <p className="text-[10px] text-slate-500 truncate font-mono">
                    {currentSeedHex.substring(0, 16)}...{currentSeedHex.substring(currentSeedHex.length - 8)}
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-cyan-950/30 border border-cyan-800/60 space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-cyan-300 font-semibold uppercase">
                    <span>Target Master Seed</span>
                    <span className="text-[10px] text-cyan-400 font-mono font-normal">256-bit CSPRNG</span>
                  </div>
                  <p className="text-sm font-bold text-cyan-400 font-mono">{targetSeedFingerprint}</p>
                  <p className="text-[10px] text-cyan-300/70 truncate font-mono">
                    {targetSeedHex.substring(0, 16)}...{targetSeedHex.substring(targetSeedHex.length - 8)}
                  </p>
                </div>
              </div>

              {/* Seed Generation Options */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                    1. Master Seed Selection
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setSeedMode('random')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                        seedMode === 'random'
                          ? 'bg-cyan-600 border-cyan-500 text-white shadow-sm'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Generate CSPRNG
                    </button>
                    <button
                      type="button"
                      onClick={() => setSeedMode('custom')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                        seedMode === 'custom'
                          ? 'bg-cyan-600 border-cyan-500 text-white shadow-sm'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Custom Hex
                    </button>
                  </div>
                </div>

                {seedMode === 'random' ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-slate-900 border border-slate-800 rounded-lg p-2 font-mono text-[11px] text-cyan-300 truncate">
                        {showSeedHex ? generatedSeedHex : `${generatedSeedHex.substring(0, 20)}••••••••••••••••••••••••••••••••`}
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowSeedHex(!showSeedHex)}
                        className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
                        title={showSeedHex ? 'Mask Hex' : 'Reveal Hex'}
                      >
                        {showSeedHex ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                      <button
                        type="button"
                        onClick={handleGenerateNewSeed}
                        className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white flex items-center gap-1.5 font-medium transition-colors"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Regenerate</span>
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-500">
                      High-entropy 32-byte cryptographic random string generated via WebCrypto API.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={customSeedHex}
                      onChange={(e) => setCustomSeedHex(e.target.value.replace(/[^0-9a-fA-F]/g, ''))}
                      maxLength={64}
                      placeholder="Enter 64-character hex string (32 bytes)..."
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 font-mono text-[11px] text-cyan-300 focus:outline-none focus:border-cyan-500 placeholder-slate-600"
                    />
                    <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                      <span>Length: {customSeedHex.length} / 64 hex characters</span>
                      <span>{customSeedHex.length === 64 ? '✓ Valid 256-bit Key' : 'Requires 64 hex chars'}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Target KDF Profile Selection */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-indigo-400" />
                  2. KDF Hardening Parameter
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setKdfMode('fast')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      kdfMode === 'fast'
                        ? 'bg-indigo-950/60 border-indigo-500 text-white shadow-md'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-300'
                    }`}
                  >
                    <div className="font-semibold text-xs text-white">Argon2id Fast (8MB)</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">t=1 iteration, low-power mode (~12ms)</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setKdfMode('strong')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      kdfMode === 'strong'
                        ? 'bg-indigo-950/60 border-indigo-500 text-white shadow-md'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-300'
                    }`}
                  >
                    <div className="font-semibold text-xs text-white">Argon2id Strong (64MB)</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">t=3 iterations, maximum defense (~85ms)</div>
                  </button>
                </div>
              </div>

              {/* Enrolled Profile Passcode Authentication */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-emerald-400" />
                  3. Enrolled Profile Verification PINs
                </span>
                <p className="text-[11px] text-slate-400">
                  Required by the Secure Enclave to decrypt the Class Keys before re-wrapping under the new seed:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-300 flex items-center justify-between">
                      <span>Profile 1 PIN (Private Space):</span>
                      <span className="text-emerald-400 font-mono font-bold">Slot 1</span>
                    </label>
                    <input
                      type="password"
                      value={profile1Pin}
                      onChange={(e) => setProfile1Pin(e.target.value)}
                      maxLength={8}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 font-mono text-xs text-white tracking-widest focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-300 flex items-center justify-between">
                      <span>Profile 2 PIN (Travel Decoy):</span>
                      <span className="text-indigo-400 font-mono font-bold">Slot 2</span>
                    </label>
                    <input
                      type="password"
                      value={profile2Pin}
                      onChange={(e) => setProfile2Pin(e.target.value)}
                      maxLength={8}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 font-mono text-xs text-white tracking-widest focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Action Banner */}
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-400">
                  <Layers className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span className="text-[11px]">
                    All 4 slots will be re-salted with fresh uniform nonces (SR-8 Indistinguishability).
                  </span>
                </div>
                <button
                  id="execute-rotation-start-btn"
                  onClick={handleStartRotation}
                  disabled={seedMode === 'custom' && customSeedHex.length !== 64}
                  className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 disabled:opacity-40 disabled:pointer-events-none rounded-xl text-white font-semibold flex items-center gap-1.5 shadow-lg shadow-cyan-600/20 transition-all cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Execute Rotation</span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: ROTATING IN PROGRESS (LIVE ANIMATION) */}
          {currentStep === 'rotating' && (
            <div className="py-6 space-y-6 text-center">
              <div className="w-16 h-16 rounded-2xl bg-cyan-950/80 border border-cyan-800 text-cyan-400 flex items-center justify-center mx-auto shadow-xl shadow-cyan-500/20 animate-pulse">
                <RefreshCw className="w-8 h-8 animate-spin" />
              </div>

              <div className="space-y-1">
                <h4 className="text-base font-bold text-white">
                  Executing Master Key Rotation...
                </h4>
                <p className="text-xs text-slate-400">
                  Constant-time slot re-encryption and memory sanitization in progress
                </p>
              </div>

              {/* Progress Steps Visualizer */}
              <div className="max-w-md mx-auto space-y-2 text-left">
                {[
                  '1. Ingesting new 256-bit root master seed in Secure Enclave',
                  '2. Unsealing active slot Class Keys with constant-time evaluation',
                  '3. Generating fresh 16-byte Salts & 12-byte Nonces for all 4 slots',
                  '4. Re-deriving Argon2id keys & encrypting AEAD ChaCha20 blobs',
                  '5. Zeroizing previous master seed & ephemeral key buffers from RAM',
                  '6. Committing atomic keystore state & generating audit receipt',
                ].map((stepText, idx) => {
                  const isDone = activeSubStepIndex > idx;
                  const isCurrent = activeSubStepIndex === idx;
                  return (
                    <div
                      key={idx}
                      className={`p-2.5 rounded-xl border flex items-center gap-3 transition-all ${
                        isDone
                          ? 'bg-emerald-950/30 border-emerald-900 text-emerald-300'
                          : isCurrent
                          ? 'bg-cyan-950/50 border-cyan-700 text-white shadow-md'
                          : 'bg-slate-950 border-slate-800/80 text-slate-500'
                      }`}
                    >
                      {isDone ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : isCurrent ? (
                        <RefreshCw className="w-4 h-4 text-cyan-400 animate-spin shrink-0" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border border-slate-700 shrink-0" />
                      )}
                      <span className="text-xs font-mono">{stepText}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 3: ROTATION COMPLETE WITH CRYPTOGRAPHIC DIFFS */}
          {currentStep === 'complete' && rotationResult && (
            <div className="space-y-5">
              {/* Success Banner */}
              <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-800 text-emerald-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-900 text-emerald-300 flex items-center justify-center">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      Rotation Completed Successfully
                    </h4>
                    <p className="text-[11px] text-emerald-300">
                      ID: <span className="font-mono">{rotationResult.rotationId}</span> ({rotationResult.totalDurationMs.toFixed(1)}ms total)
                    </p>
                  </div>
                </div>

                <div className="text-right font-mono text-[11px]">
                  <span className="text-slate-400">Fingerprint: </span>
                  <span className="text-emerald-400 font-bold">{rotationResult.newSeedFingerprint}</span>
                </div>
              </div>

              {/* Slot Re-Encryption Diff Table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-cyan-400" />
                    Slot Re-Encryption Audit Diffs (All 4 Slots)
                  </h4>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {rotationResult.reEncryptedCount} Re-encrypted | {rotationResult.decoyCount} Decoys Refreshed
                  </span>
                </div>

                <div className="space-y-2">
                  {rotationResult.steps.map((step) => (
                    <div
                      key={step.slotIndex}
                      className={`p-3 rounded-xl border ${
                        step.isEnrolled
                          ? 'bg-slate-950 border-cyan-900/60'
                          : 'bg-slate-950/60 border-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between border-b border-slate-800/80 pb-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded bg-slate-800 text-slate-200 text-[10px] font-mono font-bold flex items-center justify-center">
                            {step.slotIndex + 1}
                          </span>
                          <span className="font-bold text-white text-xs">
                            {step.isEnrolled ? `Profile ${step.profileId} Active Slot` : 'Decoy Slot'}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-[10px] font-mono">
                          <span
                            className={`px-2 py-0.5 rounded-full ${
                              step.status === 're-encrypted'
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                : 'bg-slate-800 text-slate-300 border border-slate-700'
                            }`}
                          >
                            {step.status === 're-encrypted' ? 'RE-ENCRYPTED' : 'DECOY REFRESHED'}
                          </span>
                          <span className="text-slate-500">{step.durationMs.toFixed(1)}ms</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono">
                        <div className="bg-slate-900/90 p-2 rounded border border-slate-800 space-y-1">
                          <div className="text-slate-500 text-[10px] uppercase">Salt (16 bytes):</div>
                          <div className="text-rose-400 line-through truncate text-[10px]">
                            {step.oldSaltHex.substring(0, 16)}...
                          </div>
                          <div className="text-emerald-400 truncate text-[10px]">
                            ➔ {step.newSaltHex.substring(0, 16)}...
                          </div>
                        </div>

                        <div className="bg-slate-900/90 p-2 rounded border border-slate-800 space-y-1">
                          <div className="text-slate-500 text-[10px] uppercase">Nonce / IV (12 bytes):</div>
                          <div className="text-rose-400 line-through truncate text-[10px]">
                            {step.oldNonceHex.substring(0, 12)}...
                          </div>
                          <div className="text-emerald-400 truncate text-[10px]">
                            ➔ {step.newNonceHex.substring(0, 12)}...
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Zeroization & Forward Secrecy Note */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 space-y-1">
                <div className="flex items-center gap-1.5 text-slate-300 font-semibold">
                  <Shield className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Forward Secrecy & Memory Sanitization</span>
                </div>
                <p className="text-slate-400 leading-relaxed">
                  Old salt vectors and plaintext wrapping keys have been overwritten with zeroes in memory. Decoy slots have been regenerated with independent entropy so an external examiner cannot correlate storage file snapshots across key rotations.
                </p>
              </div>

              {/* Footer Actions */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                <button
                  id="export-rotation-receipt-btn"
                  onClick={handleExportReceipt}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium flex items-center gap-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{isExporting ? 'Exporting...' : 'Download Rotation Certificate (.json)'}</span>
                </button>

                <button
                  id="close-rotation-modal-btn"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold shadow-md transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
