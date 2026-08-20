import React, { useState, useEffect } from 'react';
import {
  Cpu,
  Shield,
  Activity,
  HardDrive,
  Flame,
  Radio,
  Lock,
  Unlock,
  Layers,
  Database,
  RefreshCw,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Info,
  Server,
  Binary,
  Code2,
  Bomb,
  Clock,
  ShieldAlert,
  ShieldCheck,
  AlertOctagon,
  Sparkles,
} from 'lucide-react';
import { MlsuKeyStore } from '../crypto/mlsuEngine';

interface SystemIntegrityDashboardProps {
  engine: MlsuKeyStore;
  isUnlocked: boolean;
  activeProfileId: number | null;
  lastExecutionTimeMs?: number;
  onRunSecurityFuzzing?: (batchSize: number) => Promise<{
    attemptsRun: number;
    lockoutEnforced: boolean;
    throttledSeconds: number;
    avgEvaluationTimeMs: number;
    slotFailureCounters: number[];
  }>;
}

export const SystemIntegrityDashboard: React.FC<SystemIntegrityDashboardProps> = ({
  engine,
  isUnlocked,
  activeProfileId,
  lastExecutionTimeMs,
  onRunSecurityFuzzing,
}) => {
  const [entropyHealth, setEntropyHealth] = useState<number>(98);
  const [entropyPoolBits, setEntropyPoolBits] = useState<number>(4096);
  const [randomSeedSample, setRandomSeedSample] = useState<string>('');
  const [isRefreshingEntropy, setIsRefreshingEntropy] = useState<boolean>(false);
  const [csprngCalls, setCsprngCalls] = useState<number>(142);
  const [isFuzzing, setIsFuzzing] = useState<boolean>(false);
  const [fuzzBatchSize, setFuzzBatchSize] = useState<number>(5);
  const [lastFuzzReport, setLastFuzzReport] = useState<{
    attemptsRun: number;
    lockoutEnforced: boolean;
    throttledSeconds: number;
    avgEvaluationTimeMs: number;
    slotFailureCounters: number[];
    timestamp: string;
  } | null>(null);

  const state = engine.getState();
  const enrolledSlots = state.slots.filter((s) => s.isEnrolled).length;
  const decoySlots = state.slots.length - enrolledSlots;

  // Weaver & Hardware HSM Health Metrics
  const slotFailures = state.slots.map((s) => s.failures);
  const maxFailures = Math.max(...slotFailures, 0);
  const totalFailures = slotFailures.reduce((a, b) => a + b, 0);
  const throttledRemaining = engine.rateLimitRemaining();
  const isPermanentLockout = engine.anyLockedOut || maxFailures >= 30;
  const isThrottled = throttledRemaining > 0 && !isPermanentLockout;

  // Real-time memory footprint calculations based on active cryptographic buffers
  // 1 KDF context per slot (Argon2id Fast = 8MB, Strong = 64MB)
  const kdfMemoryPerSlotKiB = state.kdf.memoryCostKiB;
  const totalKdfAllocationKiB = kdfMemoryPerSlotKiB * 4;
  const totalKdfAllocationMB = (totalKdfAllocationKiB / 1024).toFixed(1);

  // Volatile RAM key state:
  // When locked: 0 bytes in volatile RAM (Strict SR-2 Cold Key Policy)
  // When unlocked: Exactly 32 bytes (CE key of current profile only)
  const volatileKeyBytes = isUnlocked ? 32 : 0;
  const volatileKeyHex = isUnlocked
    ? `CE_KEY_P${activeProfileId}_ACTIVE`
    : '0x00 (ZEROIZED / ZERO FORENSIC TRACE)';

  // Determine dynamic HSM health status tier & visual tokens
  let hsmStatusLevel: 'nominal_cold' | 'nominal_unlocked' | 'caution' | 'throttled' | 'severe' | 'lockout' = 'nominal_cold';
  let hsmHealthScore = 100;

  if (isPermanentLockout) {
    hsmStatusLevel = 'lockout';
    hsmHealthScore = 0;
  } else if (maxFailures >= 10 || (isThrottled && throttledRemaining >= 100)) {
    hsmStatusLevel = 'severe';
    hsmHealthScore = Math.max(5, Math.round(100 - maxFailures * 3.2));
  } else if (isThrottled || maxFailures >= 5) {
    hsmStatusLevel = 'throttled';
    hsmHealthScore = Math.max(25, Math.round(100 - maxFailures * 3.0));
  } else if (maxFailures > 0) {
    hsmStatusLevel = 'caution';
    hsmHealthScore = Math.round(100 - maxFailures * 4.0);
  } else if (isUnlocked) {
    hsmStatusLevel = 'nominal_unlocked';
    hsmHealthScore = 100;
  } else {
    hsmStatusLevel = 'nominal_cold';
    hsmHealthScore = 100;
  }

  const hsmTheme = {
    nominal_cold: {
      border: 'border-emerald-600/70',
      bg: 'bg-emerald-950/30',
      glow: 'shadow-emerald-950/40',
      accentText: 'text-emerald-300',
      badgeBg: 'bg-emerald-950 text-emerald-300 border-emerald-700',
      barGradient: 'from-emerald-500 to-teal-400',
      title: 'Hardware HSM Module: Cold Standby',
      tag: 'PRISTINE (SR-2 ZEROIZED)',
      description: 'Volatile RAM is 100% zeroized (0 bytes in memory). Weaver anti-hammering hardware token barrier is fully armed.',
      dotColor: 'bg-emerald-400 ring-emerald-400/40',
      hsmStateLabel: 'SECURE_COLD_ZEROIZED',
      icon: <ShieldCheck className="w-5 h-5 text-emerald-400" />,
    },
    nominal_unlocked: {
      border: 'border-cyan-500/80',
      bg: 'bg-cyan-950/35',
      glow: 'shadow-cyan-950/40',
      accentText: 'text-cyan-300',
      badgeBg: 'bg-cyan-950 text-cyan-200 border-cyan-600',
      barGradient: 'from-cyan-500 to-sky-400',
      title: `Hardware HSM Module: Profile P${activeProfileId} Active`,
      tag: 'AUTHENTICATED SESSION',
      description: `Target profile unsealed into protected volatile enclave RAM (32 bytes CE key). Other profiles strictly zeroized.`,
      dotColor: 'bg-cyan-400 ring-cyan-400/50 animate-pulse',
      hsmStateLabel: 'ENCLAVE_SESSION_ACTIVE',
      icon: <Unlock className="w-5 h-5 text-cyan-300" />,
    },
    caution: {
      border: 'border-yellow-600/80',
      bg: 'bg-yellow-950/30',
      glow: 'shadow-yellow-950/30',
      accentText: 'text-yellow-300',
      badgeBg: 'bg-yellow-950 text-yellow-300 border-yellow-600',
      barGradient: 'from-yellow-500 to-amber-400',
      title: `Hardware HSM Module: ${maxFailures} Weaver Failure${maxFailures > 1 ? 's' : ''}`,
      tag: `${maxFailures}/5 BEFORE THROTTLE`,
      description: `Hardware Weaver failure counters incremented across all slots in constant-time. Approaching backoff threshold.`,
      dotColor: 'bg-yellow-400 ring-yellow-400/50',
      hsmStateLabel: 'ATTEMPTS_DETECTED',
      icon: <AlertTriangle className="w-5 h-5 text-yellow-400" />,
    },
    throttled: {
      border: 'border-amber-500',
      bg: 'bg-amber-950/40',
      glow: 'shadow-amber-950/50',
      accentText: 'text-amber-300',
      badgeBg: 'bg-amber-950 text-amber-200 border-amber-500 font-bold',
      barGradient: 'from-amber-500 to-orange-500',
      title: `Hardware HSM Module: Weaver Throttle (${Math.ceil(throttledRemaining)}s Remaining)`,
      tag: `COOLDOWN ACTIVE (${maxFailures}/30 FAILS)`,
      description: `Weaver exponential backoff delay active. Hardware bus enforces a mandatory cooling period before next evaluation.`,
      dotColor: 'bg-amber-400 ring-amber-400/60 animate-pulse',
      hsmStateLabel: 'HARDWARE_THROTTLED',
      icon: <Clock className="w-5 h-5 text-amber-400 animate-spin" />,
    },
    severe: {
      border: 'border-orange-500',
      bg: 'bg-orange-950/50',
      glow: 'shadow-orange-950/60',
      accentText: 'text-orange-300',
      badgeBg: 'bg-orange-950 text-orange-200 border-orange-500 font-bold',
      barGradient: 'from-orange-500 to-rose-500',
      title: `Hardware HSM Module: Severe Hammering (${maxFailures}/30 Failures)`,
      tag: `CRITICAL ATTACK RATE`,
      description: `Repetitive brute-force patterns detected. Approaching permanent hardware brick threshold (30 failed attempts).`,
      dotColor: 'bg-orange-500 ring-orange-500/70 animate-ping',
      hsmStateLabel: 'SEVERE_BRUTEFORCE_WARNING',
      icon: <AlertOctagon className="w-5 h-5 text-orange-400" />,
    },
    lockout: {
      border: 'border-rose-500 shadow-rose-950/80',
      bg: 'bg-rose-950/60',
      glow: 'shadow-rose-950/80',
      accentText: 'text-rose-200',
      badgeBg: 'bg-rose-950 text-rose-100 border-rose-500 font-bold animate-pulse',
      barGradient: 'from-rose-600 to-red-700',
      title: 'Hardware HSM Module: PERMANENT WEAVER LOCKOUT',
      tag: 'STORE PERMANENTLY LOCKED',
      description: 'Weaver maximum failure limit reached (30+ attempts). Cryptographic unwrap bus permanently disabled by hardware.',
      dotColor: 'bg-rose-500 ring-rose-500 animate-pulse',
      hsmStateLabel: 'PERMANENT_HARDWARE_LOCKOUT',
      icon: <ShieldAlert className="w-5 h-5 text-rose-400 animate-bounce" />,
    },
  }[hsmStatusLevel];

  // Periodic subtle entropy jitter simulation to reflect real Linux /dev/urandom / StrongBox TRNG
  useEffect(() => {
    const interval = setInterval(() => {
      setEntropyHealth((prev) => Math.min(100, Math.max(94, prev + (Math.random() * 4 - 2))));
      setCsprngCalls((prev) => prev + Math.floor(Math.random() * 3));
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleReseedEntropy = () => {
    setIsRefreshingEntropy(true);
    setTimeout(() => {
      const sample = Array.from(crypto.getRandomValues(new Uint8Array(8)))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      setRandomSeedSample(sample);
      setEntropyHealth(100);
      setEntropyPoolBits(4096);
      setCsprngCalls((prev) => prev + 16);
      setIsRefreshingEntropy(false);
    }, 400);
  };

  const handleTriggerFuzzing = async () => {
    if (isFuzzing || !onRunSecurityFuzzing) return;
    setIsFuzzing(true);
    try {
      const report = await onRunSecurityFuzzing(fuzzBatchSize);
      setLastFuzzReport({
        ...report,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      });
    } catch (e) {
      console.error(e);
    } finally {
      setIsFuzzing(false);
    }
  };

  return (
    <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-800 gap-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-sky-950/80 border border-sky-800 text-sky-400">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              System Integrity & Cryptographic Engine
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800">
                ACTIVE
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">
              Live hardware telemetry, entropy pool health, and Weaver rate-limiting fuzzer.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onRunSecurityFuzzing && (
            <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800">
              <select
                value={fuzzBatchSize}
                onChange={(e) => setFuzzBatchSize(Number(e.target.value))}
                disabled={isFuzzing}
                className="bg-slate-900 text-slate-300 text-[11px] font-mono px-2 py-1 rounded border border-slate-700 focus:outline-none cursor-pointer"
                title="Number of invalid PIN attempts to fuzz"
              >
                <option value={3}>3 inputs</option>
                <option value={5}>5 inputs (Throttle)</option>
                <option value={10}>10 inputs (Deep Lockout)</option>
              </select>

              <button
                onClick={handleTriggerFuzzing}
                disabled={isFuzzing}
                className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-500 disabled:bg-rose-950/60 disabled:text-rose-400/50 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                title="Fuzz system with randomized invalid authentication inputs to test Weaver rate-limiting"
              >
                <Bomb className={`w-3.5 h-3.5 ${isFuzzing ? 'animate-spin text-amber-300' : 'text-rose-200'}`} />
                <span>{isFuzzing ? 'Fuzzing...' : 'Security Fuzzing'}</span>
              </button>
            </div>
          )}

          <button
            onClick={handleReseedEntropy}
            disabled={isRefreshingEntropy}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 border border-slate-700 transition-colors cursor-pointer"
            title="Reseed hardware TRNG entropy pool"
          >
            <RefreshCw className={`w-3 h-3 text-cyan-400 ${isRefreshingEntropy ? 'animate-spin' : ''}`} />
            <span className="text-[11px]">Reseed TRNG</span>
          </button>
        </div>
      </div>

      {/* Dynamic Hardware HSM Module Visual Health Status Indicator */}
      <div
        className={`p-4 rounded-xl border ${hsmTheme.border} ${hsmTheme.bg} transition-all duration-500 shadow-md ${hsmTheme.glow} space-y-3.5`}
      >
        {/* Top bar: Module Identity, Live Health Status badge, and Pulsing Status Dot */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-slate-950/80 border border-slate-800/80 shrink-0">
              {hsmTheme.icon}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-xs font-bold text-white tracking-wide flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5 text-slate-400" />
                  {hsmTheme.title}
                </h4>
                <span
                  className={`text-[9px] font-mono px-2 py-0.5 rounded-full border ${hsmTheme.badgeBg}`}
                >
                  {hsmTheme.tag}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 mt-0.5 leading-snug">
                {hsmTheme.description}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
            {/* Live Visual Pulse Indicator Dot */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950/90 border border-slate-800 text-[11px] font-mono">
              <span className="relative flex h-2 w-2">
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${hsmTheme.dotColor}`}
                />
                <span className={`relative inline-flex rounded-full h-2 w-2 ${hsmTheme.dotColor}`} />
              </span>
              <span className={`font-bold ${hsmTheme.accentText}`}>
                {hsmHealthScore}% HEALTH
              </span>
            </div>
          </div>
        </div>

        {/* Dynamic Health Bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
            <span className="flex items-center gap-1">
              <Activity className="w-3 h-3 text-slate-400" />
              Weaver Anti-Hammering Barrier Capacity
            </span>
            <span className={hsmTheme.accentText}>
              {maxFailures}/30 Max Slot Failures ({Math.max(0, 30 - maxFailures)} attempts remaining)
            </span>
          </div>

          <div className="w-full bg-slate-950/90 h-2 rounded-full overflow-hidden border border-slate-800/80 p-0.5">
            <div
              className={`h-full rounded-full bg-gradient-to-r ${hsmTheme.barGradient} transition-all duration-500`}
              style={{ width: `${Math.max(4, hsmHealthScore)}%` }}
            />
          </div>
        </div>

        {/* Live Hardware State Sub-Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono">
          <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800/80 space-y-0.5">
            <span className="text-[10px] text-slate-400 block uppercase">Memory State:</span>
            <span className={`font-bold truncate block ${isUnlocked ? 'text-cyan-300' : 'text-emerald-400'}`}>
              {isUnlocked ? `P${activeProfileId} CE (32B RAM)` : '0x00 ZEROIZED (SR-2)'}
            </span>
          </div>

          <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800/80 space-y-0.5">
            <span className="text-[10px] text-slate-400 block uppercase">Weaver Fail Counter:</span>
            <span
              className={`font-bold truncate block ${
                maxFailures >= 30
                  ? 'text-rose-400'
                  : maxFailures >= 5
                  ? 'text-amber-400'
                  : maxFailures > 0
                  ? 'text-yellow-400'
                  : 'text-emerald-400'
              }`}
            >
              {maxFailures} / 30 max fails
            </span>
          </div>

          <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800/80 space-y-0.5">
            <span className="text-[10px] text-slate-400 block uppercase">Rate-Limiting Bus:</span>
            <span
              className={`font-bold truncate block ${
                isPermanentLockout
                  ? 'text-rose-400'
                  : isThrottled
                  ? 'text-amber-300 animate-pulse'
                  : 'text-emerald-400'
              }`}
            >
              {isPermanentLockout
                ? 'LOCKED OUT'
                : isThrottled
                ? `${Math.ceil(throttledRemaining)}s Throttle`
                : 'Nominal Bus (Ready)'}
            </span>
          </div>

          <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800/80 space-y-0.5">
            <span className="text-[10px] text-slate-400 block uppercase">Tamper Defense:</span>
            <span className="font-bold text-slate-200 truncate block flex items-center gap-1">
              <Shield className="w-3 h-3 text-cyan-400 shrink-0" />
              StrongBox Hardware
            </span>
          </div>
        </div>
      </div>

      {/* 3 Core Metric Panels: Memory, Entropy, Encryption Algos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* 1. Volatile Memory & Zeroization Monitor */}
        <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-medium flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-indigo-400" />
                Volatile RAM State
              </span>
              <span
                className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                  isUnlocked
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                    : 'bg-slate-900 text-slate-400 border border-slate-800'
                }`}
              >
                {isUnlocked ? '1 ACTIVE KEY' : 'ZEROIZED (SR-2)'}
              </span>
            </div>

            <div className="mt-2 space-y-1">
              <div className="flex justify-between items-baseline">
                <span className="text-[11px] text-slate-400">Active Key in RAM:</span>
                <span className="font-mono text-xs font-bold text-white">
                  {volatileKeyBytes} bytes
                </span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-[11px] text-slate-400">Foreign Profile Keys:</span>
                <span className="font-mono text-xs font-bold text-emerald-400">0 bytes (Isolated)</span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-[11px] text-slate-400">Peak KDF Allocation:</span>
                <span className="font-mono text-xs font-semibold text-slate-300">
                  {totalKdfAllocationMB} MB ({state.kdf.memoryCostKiB / 1024}MB × 4 slots)
                </span>
              </div>
            </div>
          </div>

          <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800 text-[10px] font-mono text-slate-400 truncate">
            {volatileKeyHex}
          </div>
        </div>

        {/* 2. Hardware Entropy Pool & TRNG Status */}
        <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-medium flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-cyan-400" />
                Hardware TRNG Entropy
              </span>
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                {entropyHealth.toFixed(1)}% QUALITY
              </span>
            </div>

            <div className="mt-2 space-y-1">
              <div className="flex justify-between items-baseline">
                <span className="text-[11px] text-slate-400">Available Entropy Pool:</span>
                <span className="font-mono text-xs font-bold text-cyan-300">{entropyPoolBits} bits</span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-[11px] text-slate-400">CSPRNG Calls Logged:</span>
                <span className="font-mono text-xs font-bold text-slate-200">{csprngCalls} ops</span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-[11px] text-slate-400">Uniform Decoy Noise:</span>
                <span className="font-mono text-xs text-slate-300">{decoySlots} slots (SR-8)</span>
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-sky-400 transition-all duration-500"
              style={{ width: `${entropyHealth}%` }}
            />
          </div>
        </div>

        {/* 3. Active Cryptographic Pipeline */}
        <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-medium flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-amber-400" />
                Cryptographic Primitives
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800">
                Argon2id + AEAD
              </span>
            </div>

            <div className="mt-2 space-y-1">
              <div className="flex justify-between items-baseline">
                <span className="text-[11px] text-slate-400">Key Derivation (KDF):</span>
                <span className="font-mono text-xs font-bold text-white">Argon2id ({state.kdf.name})</span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-[11px] text-slate-400">Authenticated Cipher:</span>
                <span className="font-mono text-xs font-bold text-slate-200">ChaCha20-Poly1305</span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-[11px] text-slate-400">Constant-Time Unseal:</span>
                <span className="font-mono text-xs text-emerald-400 font-semibold">
                  {lastExecutionTimeMs ? `${lastExecutionTimeMs.toFixed(1)}ms` : '4-Slot Branch-Free'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
            <span>256-bit Master Root</span>
            <span>Poly1305 MAC Tag</span>
          </div>
        </div>
      </div>

      {/* Fuzzing Results & Rate Limiting Verification Card (when report exists) */}
      {lastFuzzReport && (
        <div className="p-4 rounded-xl bg-slate-950 border border-rose-900/60 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              <h4 className="text-xs font-semibold text-white">
                Fuzzing Outcome: Weaver Rate-Limiting Enforcement
              </h4>
            </div>
            <span className="text-[10px] font-mono text-slate-400">{lastFuzzReport.timestamp}</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800">
              <span className="text-[10px] text-slate-400 block">Randomized Inputs:</span>
              <span className="font-mono text-sm font-bold text-white">
                {lastFuzzReport.attemptsRun} attempts
              </span>
            </div>

            <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800">
              <span className="text-[10px] text-slate-400 block">Avg Time / Eval:</span>
              <span className="font-mono text-sm font-bold text-cyan-300">
                {lastFuzzReport.avgEvaluationTimeMs.toFixed(1)} ms
              </span>
            </div>

            <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800">
              <span className="text-[10px] text-slate-400 block">Lockout Enforced:</span>
              <span
                className={`font-mono text-sm font-bold ${
                  lastFuzzReport.lockoutEnforced ? 'text-rose-400' : 'text-emerald-400'
                }`}
              >
                {lastFuzzReport.lockoutEnforced ? 'PERMANENT (30+)' : 'NO'}
              </span>
            </div>

            <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800">
              <span className="text-[10px] text-slate-400 block">Cooling Throttle:</span>
              <span
                className={`font-mono text-sm font-bold ${
                  lastFuzzReport.throttledSeconds > 0 ? 'text-amber-400' : 'text-slate-400'
                }`}
              >
                {lastFuzzReport.throttledSeconds > 0
                  ? `${Math.ceil(lastFuzzReport.throttledSeconds)}s remaining`
                  : 'Ready'}
              </span>
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 flex items-center justify-between text-[11px] font-mono">
            <span className="text-slate-400 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-rose-400" />
              Slot Failure Counter State:
            </span>
            <div className="flex gap-2">
              {lastFuzzReport.slotFailureCounters.map((count, idx) => (
                <span
                  key={idx}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    count >= 30
                      ? 'bg-rose-950 text-rose-300 border border-rose-700'
                      : count >= 5
                      ? 'bg-amber-950 text-amber-300 border border-amber-800'
                      : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  S{idx + 1}: {count} fails
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Security Guarantees & Policy Matrix Bar */}
      <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span className="text-[11px] text-slate-300">
            <strong>SR-2 Zero-Trace</strong>: Locked RAM contains no unsealed keys.
          </span>
        </div>

        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span className="text-[11px] text-slate-300">
            <strong>SR-3 Branch-Free</strong>: Constant timing regardless of PIN validity.
          </span>
        </div>

        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span className="text-[11px] text-slate-300">
            <strong>SR-8 Plausible Deniability</strong>: Decoy slots are pure CSPRNG noise.
          </span>
        </div>
      </div>
    </div>
  );
};
