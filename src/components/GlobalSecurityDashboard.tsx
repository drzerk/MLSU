import React, { useState, useEffect, useMemo } from 'react';
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  Activity,
  Cpu,
  Lock,
  Unlock,
  AlertTriangle,
  Clock,
  Battery,
  BatteryCharging,
  BatteryWarning,
  Flame,
  Zap,
  TrendingUp,
  X,
  Maximize2,
  Minimize2,
  Terminal,
  Layers,
  Smartphone,
  Eye,
  RotateCcw,
  CheckCircle2,
  Sparkles,
  Server,
  AlertOctagon,
} from 'lucide-react';
import { MlsuKeyStore } from '../crypto/mlsuEngine';
import { AuditLogEntry, ViewTab } from '../types';
import { AuditSparkline } from './AuditSparkline';

interface GlobalSecurityDashboardProps {
  engine: MlsuKeyStore;
  auditLogs: AuditLogEntry[];
  currentTab: ViewTab;
  onNavigateTab: (tab: ViewTab) => void;
  isOpen: boolean;
  onClose: () => void;
  onToggle: () => void;
}

export const GlobalSecurityDashboard: React.FC<GlobalSecurityDashboardProps> = ({
  engine,
  auditLogs,
  currentTab,
  onNavigateTab,
  isOpen,
  onClose,
  onToggle,
}) => {
  const [isMinimizedHud, setIsMinimizedHud] = useState<boolean>(false);
  const [entropyHealth, setEntropyHealth] = useState<number>(99.8);
  const [activeFuzzFeedback, setActiveFuzzFeedback] = useState<string | null>(null);

  const state = engine.getState();
  const enrolledSlots = state.slots.filter((s) => s.isEnrolled).length;
  const decoySlots = state.slots.length - enrolledSlots;
  const isUnlocked = engine.activeProfileId !== null;
  const activeProfileId = engine.activeProfileId;

  // Weaver & Hardware metrics
  const slotFailures = state.slots.map((s) => s.failures);
  const maxFailures = Math.max(...slotFailures, 0);
  const throttledRemaining = engine.rateLimitRemaining();
  const isPermanentLockout = engine.anyLockedOut || maxFailures >= 30;
  const isThrottled = throttledRemaining > 0 && !isPermanentLockout;

  // Real-time memory footprint calculations
  const kdfMemoryPerSlotKiB = state.kdf.memoryCostKiB;
  const totalKdfMemoryMiB = ((kdfMemoryPerSlotKiB * state.slots.length) / 1024).toFixed(1);
  const volatileKeyBytesInRam = isUnlocked ? 32 : 0;

  // 24-hour threat metrics from audit logs
  const { total24hEvents, totalThreats24h, recentThreats } = useMemo(() => {
    const now = Date.now();
    const windowStartTs = now - 24 * 60 * 60 * 1000;
    let total = 0;
    let threats = 0;
    const threatsList: AuditLogEntry[] = [];

    auditLogs.forEach((log) => {
      const logTs = new Date(log.timestamp).getTime();
      if (logTs >= windowStartTs) {
        total++;
        if (
          log.type === 'auth_failure' ||
          log.type === 'biometric_failure' ||
          log.type === 'weaver_throttle' ||
          log.type === 'weaver_lockout' ||
          log.type === 'hsm_sector_corrupted' ||
          log.type === 'hsm_tamper_detected' ||
          log.type === 'hsm_panic_wipe' ||
          log.type === 'audit_tamper_detected'
        ) {
          threats++;
          if (threatsList.length < 4) {
            threatsList.push(log);
          }
        }
      }
    });

    return {
      total24hEvents: total,
      totalThreats24h: threats,
      recentThreats: threatsList,
    };
  }, [auditLogs]);

  // Determine global threat level & HSM health status
  let healthStatusLevel: 'nominal_cold' | 'nominal_unlocked' | 'caution' | 'throttled' | 'severe' | 'lockout' =
    'nominal_cold';
  let healthScore = 100;

  if (isPermanentLockout) {
    healthStatusLevel = 'lockout';
    healthScore = 0;
  } else if (maxFailures >= 10 || (isThrottled && throttledRemaining >= 100)) {
    healthStatusLevel = 'severe';
    healthScore = Math.max(5, Math.round(100 - maxFailures * 3.2));
  } else if (isThrottled || maxFailures >= 5) {
    healthStatusLevel = 'throttled';
    healthScore = Math.max(25, Math.round(100 - maxFailures * 3.0));
  } else if (maxFailures > 0 || totalThreats24h > 2) {
    healthStatusLevel = 'caution';
    healthScore = Math.max(50, Math.round(100 - maxFailures * 4.0 - totalThreats24h * 2));
  } else if (isUnlocked) {
    healthStatusLevel = 'nominal_unlocked';
    healthScore = 100;
  } else {
    healthStatusLevel = 'nominal_cold';
    healthScore = 100;
  }

  const themeConfig = {
    nominal_cold: {
      accent: 'emerald',
      border: 'border-emerald-500/60',
      bg: 'bg-emerald-950/40',
      badge: 'bg-emerald-950 text-emerald-300 border-emerald-700',
      text: 'text-emerald-300',
      dot: 'bg-emerald-400 ring-emerald-400/50',
      statusText: 'NOMINAL (COLD STANDBY)',
      summary: 'Volatile memory zeroized (0B). StrongBox token barrier armed with constant-time slot evaluation.',
      icon: <ShieldCheck className="w-5 h-5 text-emerald-400" />,
    },
    nominal_unlocked: {
      accent: 'cyan',
      border: 'border-cyan-500/70',
      bg: 'bg-cyan-950/40',
      badge: 'bg-cyan-950 text-cyan-200 border-cyan-600',
      text: 'text-cyan-300',
      dot: 'bg-cyan-400 ring-cyan-400/50 animate-pulse',
      statusText: `ACTIVE ENCLAVE (P${activeProfileId})`,
      summary: `Profile ${activeProfileId} CE key mounted in enclave memory (32B). Foreign profile slots remain zeroized.`,
      icon: <Unlock className="w-5 h-5 text-cyan-300" />,
    },
    caution: {
      accent: 'yellow',
      border: 'border-yellow-500/70',
      bg: 'bg-yellow-950/40',
      badge: 'bg-yellow-950 text-yellow-300 border-yellow-600',
      text: 'text-yellow-300',
      dot: 'bg-yellow-400 ring-yellow-400/50',
      statusText: `CAUTION (${maxFailures} WEAVER FAILS)`,
      summary: `${maxFailures} failed attempts recorded across slots. Approaching exponential throttle backoff.`,
      icon: <AlertTriangle className="w-5 h-5 text-yellow-400" />,
    },
    throttled: {
      accent: 'amber',
      border: 'border-amber-500',
      bg: 'bg-amber-950/50',
      badge: 'bg-amber-950 text-amber-200 border-amber-500 font-bold',
      text: 'text-amber-300',
      dot: 'bg-amber-400 ring-amber-400/60 animate-pulse',
      statusText: `THROTTLED (${Math.ceil(throttledRemaining)}s)`,
      summary: `Hardware bus locked in cooling cycle. Consecutive invalid PINs triggered exponential throttle.`,
      icon: <Clock className="w-5 h-5 text-amber-400 animate-spin" />,
    },
    severe: {
      accent: 'orange',
      border: 'border-orange-500',
      bg: 'bg-orange-950/60',
      badge: 'bg-orange-950 text-orange-200 border-orange-500 font-bold',
      text: 'text-orange-300',
      dot: 'bg-orange-500 ring-orange-500/70 animate-ping',
      statusText: `SEVERE ATTACK DETECTED`,
      summary: `Brute-force attack in progress (${maxFailures}/30 failures). Imminent hardware self-destruct.`,
      icon: <AlertOctagon className="w-5 h-5 text-orange-400" />,
    },
    lockout: {
      accent: 'rose',
      border: 'border-rose-500 shadow-rose-950/80',
      bg: 'bg-rose-950/70',
      badge: 'bg-rose-950 text-rose-100 border-rose-500 font-bold animate-pulse',
      text: 'text-rose-200',
      dot: 'bg-rose-500 ring-rose-500 animate-pulse',
      statusText: `PERMANENT WEAVER LOCKOUT`,
      summary: `Weaver maximum threshold tripped (30+ failures). Cryptographic bus permanently bricked.`,
      icon: <ShieldAlert className="w-5 h-5 text-rose-400 animate-bounce" />,
    },
  }[healthStatusLevel];

  // Quick Zeroize / Lock Action
  const handleInstantZeroize = () => {
    engine.lock();
    setActiveFuzzFeedback('Instant zeroization executed: Volatile keys wiped from memory (0B residual).');
    setTimeout(() => setActiveFuzzFeedback(null), 3000);
  };

  // Keyboard shortcut listener (Escape to close)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <>
      {/* Persistent Global Floating Status Indicator Pill (Visible Across ALL Tabs) */}
      <div
        id="global-security-floating-pill"
        className="fixed bottom-4 right-4 z-40 flex items-center gap-2 select-none"
      >
        <button
          onClick={onToggle}
          className={`flex items-center gap-2.5 px-3.5 py-2 rounded-xl backdrop-blur-md border shadow-xl transition-all duration-200 cursor-pointer ${
            isOpen
              ? 'bg-sky-600 text-white border-sky-400 ring-2 ring-sky-400/40'
              : `${themeConfig.bg} ${themeConfig.border} text-slate-100 hover:scale-105`
          }`}
          title="Open Global Security Dashboard Overlay"
        >
          <div className="relative flex items-center justify-center">
            <span className="relative flex h-2.5 w-2.5">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${themeConfig.dot}`} />
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${themeConfig.dot}`} />
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-sky-400" />
            <div className="text-left font-mono">
              <div className="text-[11px] font-bold tracking-tight leading-tight flex items-center gap-1.5">
                <span>Global Threat HUD</span>
                <span className={`text-[9px] px-1.5 py-0.2 rounded border ${themeConfig.badge}`}>
                  {healthScore}%
                </span>
              </div>
              <div className="text-[9px] text-slate-400 leading-tight">
                {isPermanentLockout
                  ? 'BRICKED'
                  : isThrottled
                  ? `COOLING (${Math.ceil(throttledRemaining)}s)`
                  : isUnlocked
                  ? `P${activeProfileId} Active (32B RAM)`
                  : 'Zeroized Cold'}
              </div>
            </div>
          </div>

          <div className="hidden sm:flex items-center pl-2 border-l border-slate-700/60 text-[10px] font-mono text-slate-400 gap-1.5">
            <TrendingUp className="w-3 h-3 text-cyan-400" />
            <span>{total24hEvents} ev</span>
            {totalThreats24h > 0 && (
              <span className="text-rose-400 font-bold">({totalThreats24h} threats)</span>
            )}
          </div>
        </button>
      </div>

      {/* Full-Screen Global Security Dashboard Overlay */}
      {isOpen && (
        <div
          id="global-security-overlay-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200"
        >
          <div className="relative w-full max-w-5xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh]">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950/90 flex items-center justify-between gap-3 sticky top-0 z-20">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-600 text-white shadow-lg">
                  <Shield className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                      Global Security & Threat Dashboard
                    </h2>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-sky-950 text-sky-300 border border-sky-700">
                      Cross-Tab Orchestrator
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Unified high-level overview of hardware HSM integrity, RAM zeroization, Weaver telemetry, and 24h event velocity.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  id="close-global-security-dashboard-btn"
                  onClick={onClose}
                  className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Close Overlay (Esc)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
              {/* Feedback toast if action triggered */}
              {activeFuzzFeedback && (
                <div className="p-2.5 rounded-xl bg-emerald-950/90 border border-emerald-600 text-emerald-200 text-xs font-mono flex items-center gap-2 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{activeFuzzFeedback}</span>
                </div>
              )}

              {/* Top Hero Banner: Overall Health Score & Threat Summary */}
              <div
                className={`p-4 sm:p-5 rounded-2xl border ${themeConfig.border} ${themeConfig.bg} space-y-3.5 transition-all shadow-lg`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800 shrink-0">
                      {themeConfig.icon}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold font-mono tracking-wider text-slate-400 uppercase">
                          System Threat Assessment:
                        </span>
                        <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-md border ${themeConfig.badge}`}>
                          {themeConfig.statusText}
                        </span>
                      </div>
                      <p className="text-xs text-slate-200 mt-1 leading-relaxed max-w-2xl">
                        {themeConfig.summary}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-start sm:self-center shrink-0">
                    <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800 text-center min-w-[110px]">
                      <div className="text-[10px] font-mono text-slate-400 uppercase">Health Score</div>
                      <div className={`text-xl font-mono font-black ${themeConfig.text}`}>
                        {healthScore}%
                      </div>
                    </div>
                  </div>
                </div>

                {/* Threat / Failure Gauge Bar */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5 text-slate-400" />
                      Weaver Failure Barrier Capacity
                    </span>
                    <span className={themeConfig.text}>
                      {maxFailures}/30 Failures ({Math.max(0, 30 - maxFailures)} remaining before brick)
                    </span>
                  </div>
                  <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800 p-0.5">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${
                        healthScore > 50
                          ? 'from-emerald-500 to-cyan-400'
                          : healthScore > 20
                          ? 'from-amber-500 to-orange-500'
                          : 'from-rose-600 to-red-700'
                      } transition-all duration-500`}
                      style={{ width: `${Math.max(4, healthScore)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* 24-Hour Velocity Sparkline Chart Aggregator */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-sky-400" />
                    24-Hour Attack & Velocity Sparkline
                  </h3>
                  <span className="text-[10px] font-mono text-slate-400">
                    Aggregated across all simulated profiles
                  </span>
                </div>
                <AuditSparkline logs={auditLogs} />
              </div>

              {/* Aggregated 4 Core System Integrity Panels */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* 1. Volatile Memory & Cold Key State */}
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 font-medium flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-sky-400" />
                        RAM Zeroization
                      </span>
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.2 rounded border ${
                          isUnlocked
                            ? 'bg-cyan-950 text-cyan-300 border-cyan-800'
                            : 'bg-emerald-950 text-emerald-300 border-emerald-800'
                        }`}
                      >
                        {isUnlocked ? 'ENCLAVE ACTIVE' : 'COLD (0B)'}
                      </span>
                    </div>

                    <div className="mt-2 space-y-1 font-mono text-xs">
                      <div className="flex justify-between">
                        <span className="text-[11px] text-slate-400">Volatile Keys:</span>
                        <span className={`font-bold ${isUnlocked ? 'text-cyan-300' : 'text-emerald-400'}`}>
                          {volatileKeyBytesInRam} Bytes
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[11px] text-slate-400">Foreign Slots:</span>
                        <span className="text-emerald-400 font-semibold">Zeroized (3/4)</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-900 flex items-center justify-between text-[10px] font-mono text-slate-500">
                    <span>Forensic Trace</span>
                    <span className="text-emerald-400 font-bold">0.00%</span>
                  </div>
                </div>

                {/* 2. Weaver Anti-Hammering */}
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 font-medium flex items-center gap-1.5">
                        <Cpu className="w-3.5 h-3.5 text-indigo-400" />
                        Weaver Barrier
                      </span>
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.2 rounded border ${
                          isPermanentLockout
                            ? 'bg-rose-950 text-rose-300 border-rose-800'
                            : isThrottled
                            ? 'bg-amber-950 text-amber-300 border-amber-800'
                            : 'bg-emerald-950 text-emerald-300 border-emerald-800'
                        }`}
                      >
                        {isPermanentLockout ? 'BRICKED' : isThrottled ? 'THROTTLED' : 'NOMINAL'}
                      </span>
                    </div>

                    <div className="mt-2 space-y-1 font-mono text-xs">
                      <div className="flex justify-between">
                        <span className="text-[11px] text-slate-400">Max Failures:</span>
                        <span
                          className={`font-bold ${
                            maxFailures >= 5 ? 'text-amber-400' : 'text-slate-200'
                          }`}
                        >
                          {maxFailures} / 30
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[11px] text-slate-400">Backoff Cooldown:</span>
                        <span
                          className={`font-semibold ${
                            isThrottled ? 'text-amber-400 animate-pulse' : 'text-slate-400'
                          }`}
                        >
                          {isThrottled ? `${Math.ceil(throttledRemaining)}s remaining` : '0s (Ready)'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-900 flex items-center justify-between text-[10px] font-mono text-slate-500">
                    <span>Constant-Time Sync</span>
                    <span className="text-sky-400">Armed</span>
                  </div>
                </div>

                {/* 3. Argon2id KDF Memory Footprint */}
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 font-medium flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-purple-400" />
                        Argon2id KDF
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-900 text-purple-300 border border-purple-800">
                        {state.kdf.memoryCostKiB >= 32768 ? 'STRONG (64MB)' : 'FAST (8MB)'}
                      </span>
                    </div>

                    <div className="mt-2 space-y-1 font-mono text-xs">
                      <div className="flex justify-between">
                        <span className="text-[11px] text-slate-400">RAM Per Slot:</span>
                        <span className="text-slate-200 font-semibold">{kdfMemoryPerSlotKiB} KiB</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[11px] text-slate-400">Total KDF (4 slots):</span>
                        <span className="text-purple-300 font-bold">{totalKdfMemoryMiB} MiB</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-900 flex items-center justify-between text-[10px] font-mono text-slate-500">
                    <span>Cipher</span>
                    <span className="text-slate-400">ChaCha20-Poly1305</span>
                  </div>
                </div>

                {/* 4. Enrolled Profiles & Key Slot Topology */}
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 font-medium flex items-center gap-1.5">
                        <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                        Profile Slots
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-900 text-emerald-300 border border-slate-800">
                        4 SLOTS FIXED
                      </span>
                    </div>

                    <div className="mt-2 space-y-1 font-mono text-xs">
                      <div className="flex justify-between">
                        <span className="text-[11px] text-slate-400">Enrolled Profiles:</span>
                        <span className="text-emerald-400 font-bold">{enrolledSlots} / 4</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[11px] text-slate-400">Decoy Noise Slots:</span>
                        <span className="text-slate-300 font-semibold">{decoySlots} uniform</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-900 flex items-center justify-between text-[10px] font-mono text-slate-500">
                    <span>File Plausibility (SR-8)</span>
                    <span className="text-emerald-400">100%</span>
                  </div>
                </div>
              </div>

              {/* Quick Jump Tab Switcher & Hardware Safety Actions */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5 text-sky-400" />
                    Quick Navigation & Threat Mitigations
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Jump directly to specialized inspection rigs or execute emergency cryptographic safeguards.
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => {
                      onNavigateTab('phone');
                      onClose();
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-colors cursor-pointer ${
                      currentTab === 'phone'
                        ? 'bg-sky-600 text-white border-sky-500'
                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white'
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    Phone Simulator
                  </button>

                  <button
                    onClick={() => {
                      onNavigateTab('inspector');
                      onClose();
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-colors cursor-pointer ${
                      currentTab === 'inspector'
                        ? 'bg-sky-600 text-white border-sky-500'
                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    Slot Inspector
                  </button>

                  <button
                    onClick={() => {
                      onNavigateTab('hsm');
                      onClose();
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-colors cursor-pointer ${
                      currentTab === 'hsm'
                        ? 'bg-sky-600 text-white border-sky-500'
                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white'
                    }`}
                  >
                    <Cpu className="w-3.5 h-3.5" />
                    HSM & Tamper
                  </button>

                  <button
                    onClick={handleInstantZeroize}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-950/80 border border-rose-700 text-rose-300 hover:bg-rose-900 hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
                    title="Immediately wipe all keys from volatile RAM and lock store"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    Instant Zeroize & Lock
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3 sm:p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs text-slate-400 font-mono">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Constant-Time Pipeline Active</span>
              </div>
              <button
                onClick={onClose}
                className="px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 transition-colors font-sans font-medium cursor-pointer"
              >
                Close Dashboard
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
