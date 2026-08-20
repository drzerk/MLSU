import React, { useState, useMemo } from 'react';
import {
  ShieldCheck,
  Zap,
  Sliders,
  Cpu,
  Key,
  Flame,
  Binary,
  Layers,
  Sparkles,
  Info,
  Clock,
  HardDrive,
  BarChart3,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

export interface KeyGenParameters {
  pinLength: number;
  charset: 'numeric' | 'alphanumeric' | 'complex';
  argonIterations: number;
  argonMemoryMb: number;
  argonParallelism: number;
  saltBits: number;
  hardwareEnclaveBound: boolean;
}

export const EntropyVisualizer: React.FC = () => {
  const [params, setParams] = useState<KeyGenParameters>({
    pinLength: 6,
    charset: 'numeric',
    argonIterations: 3,
    argonMemoryMb: 64,
    argonParallelism: 4,
    saltBits: 128,
    hardwareEnclaveBound: true,
  });

  // Calculate Key Space, Shannon Entropy, and Time to Crack
  const metrics = useMemo(() => {
    let charsetSize = 10;
    if (params.charset === 'alphanumeric') charsetSize = 62;
    if (params.charset === 'complex') charsetSize = 94;

    // PIN Raw Entropy in bits: log2(charsetSize ^ length) = length * log2(charsetSize)
    const rawEntropyBits = params.pinLength * Math.log2(charsetSize);

    // KDF Hardening factor (log2 cost of Argon2id parameters)
    // Memory hardness: 64MB = 2^16 KB iterations per pass
    const memoryCostBits = Math.log2(params.argonMemoryMb * 1024);
    const timeCostBits = Math.log2(params.argonIterations);
    const kdfWorkFactorBits = memoryCostBits + timeCostBits + Math.log2(params.argonParallelism);

    // Total effective offline resistance entropy (capped logically by salt and master key size 256 bits)
    const effectiveEntropyBits = Math.min(
      256,
      rawEntropyBits + (params.hardwareEnclaveBound ? 64 : kdfWorkFactorBits * 1.5)
    );

    // Crack time calculation (Assumes offline GPU cluster calculating 10^10 hashes/s vs Argon2id ~ 20 hashes/s on high-end GPU)
    // Argon2id with 64MB RAM slows GPU brute force down to ~50 hashes/sec per RTX 4090
    const totalCombinations = Math.pow(charsetSize, params.pinLength);
    const hashesPerSecondSoftware = Math.max(1, 2000 / (params.argonMemoryMb * params.argonIterations));
    const secondsOfflineBruteForce = totalCombinations / (hashesPerSecondSoftware * 100); // 100 GPUs

    // Weaver rate-limiting crack time (30 max attempts before hardware brick)
    const weaverOnlineCrackable = params.hardwareEnclaveBound ? 'Immune (Locked after 30 tries)' : 'N/A';

    return {
      charsetSize,
      rawEntropyBits: parseFloat(rawEntropyBits.toFixed(1)),
      effectiveEntropyBits: parseFloat(effectiveEntropyBits.toFixed(1)),
      totalCombinations,
      secondsOfflineBruteForce,
      weaverOnlineCrackable,
    };
  }, [params]);

  // Format crack time into human readable string
  const formatCrackTime = (seconds: number) => {
    if (params.hardwareEnclaveBound) {
      return 'Mathematically infeasible (Hardware Lockout)';
    }
    if (seconds < 1) return '< 1 second';
    if (seconds < 60) return `${Math.round(seconds)} seconds`;
    if (seconds < 3600) return `${Math.round(seconds / 60)} minutes`;
    if (seconds < 86400) return `${Math.round(seconds / 3600)} hours`;
    if (seconds < 31536000) return `${Math.round(seconds / 86400)} days`;
    if (seconds < 3153600000) return `${Math.round(seconds / 31536000)} years`;
    return `${(seconds / 31536000).toExponential(2)} years`;
  };

  // Comparative data for visual bar chart
  const comparisonData = [
    {
      name: '4-Digit PIN (Raw)',
      bits: 13.3,
      category: 'Legacy Single-Lock',
      color: '#f43f5e',
    },
    {
      name: '6-Digit PIN (Raw)',
      bits: 19.9,
      category: 'Standard PIN',
      color: '#fb923c',
    },
    {
      name: 'Current Config (Input)',
      bits: metrics.rawEntropyBits,
      category: 'Your Input Entropy',
      color: '#38bdf8',
    },
    {
      name: 'Argon2id Memory Hardened',
      bits: Math.min(128, metrics.rawEntropyBits + (params.argonMemoryMb >= 64 ? 42 : 28)),
      category: 'KDF Resistance',
      color: '#818cf8',
    },
    {
      name: 'MLSU Enclave Bound (SR-1)',
      bits: params.hardwareEnclaveBound ? 128 : metrics.effectiveEntropyBits,
      category: 'Hardware Protected',
      color: '#34d399',
    },
  ];

  // Visual strength grade
  const getStrengthGrade = () => {
    if (params.hardwareEnclaveBound) {
      return { grade: 'MAXIMAL (AOSP ENCLAVE LEVEL)', color: 'text-emerald-400', barBg: 'bg-emerald-500', width: '100%' };
    }
    if (metrics.rawEntropyBits >= 50) {
      return { grade: 'EXCELLENT (HIGH ENTROPY)', color: 'text-sky-400', barBg: 'bg-sky-500', width: '85%' };
    }
    if (metrics.rawEntropyBits >= 25) {
      return { grade: 'MODERATE (RECOGNIZES WEAVER BACKOFF)', color: 'text-amber-400', barBg: 'bg-amber-500', width: '55%' };
    }
    return { grade: 'WEAK OFFLINE (VULNERABLE WITHOUT HARDWARE WEAVER)', color: 'text-rose-400', barBg: 'bg-rose-500', width: '25%' };
  };

  const strength = getStrengthGrade();

  return (
    <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-sky-950 border border-sky-800 text-sky-400 flex items-center justify-center">
              <Binary className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                Cryptographic Key Strength & Entropy Model
              </h3>
              <p className="text-xs text-slate-400">
                Mathematical analysis of Argon2id KDF work-factor, Shannon bit-entropy, and Weaver hardware isolation
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono">
          <span className="text-slate-400">Raw Input:</span>
          <span className="text-sky-400 font-bold">{metrics.rawEntropyBits} bits</span>
          <span className="text-slate-600">|</span>
          <span className="text-slate-400">Effective:</span>
          <span className="text-emerald-400 font-bold">{metrics.effectiveEntropyBits} bits</span>
        </div>
      </div>

      {/* Interactive Controls & Parameters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Column 1: Input Credential Params */}
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-sky-400 uppercase tracking-wider">
            <Key className="w-3.5 h-3.5" />
            <span>1. Credential Parameters</span>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <label className="text-slate-300">PIN / Passcode Length:</label>
              <span className="text-sky-400 font-mono font-bold">{params.pinLength} digits/chars</span>
            </div>
            <input
              type="range"
              min={4}
              max={16}
              value={params.pinLength}
              onChange={(e) => setParams({ ...params, pinLength: parseInt(e.target.value) })}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>4</span>
              <span>6 (Default)</span>
              <span>8</span>
              <span>12</span>
              <span>16</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-slate-300 block">Character Complexity:</label>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                onClick={() => setParams({ ...params, charset: 'numeric' })}
                className={`py-1.5 px-2 rounded-lg text-xs font-mono font-medium border transition-colors ${
                  params.charset === 'numeric'
                    ? 'bg-sky-600 border-sky-500 text-white shadow-sm'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                0-9 ({10})
              </button>
              <button
                onClick={() => setParams({ ...params, charset: 'alphanumeric' })}
                className={`py-1.5 px-2 rounded-lg text-xs font-mono font-medium border transition-colors ${
                  params.charset === 'alphanumeric'
                    ? 'bg-sky-600 border-sky-500 text-white shadow-sm'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                a-Z ({62})
              </button>
              <button
                onClick={() => setParams({ ...params, charset: 'complex' })}
                className={`py-1.5 px-2 rounded-lg text-xs font-mono font-medium border transition-colors ${
                  params.charset === 'complex'
                    ? 'bg-sky-600 border-sky-500 text-white shadow-sm'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                ASCII ({94})
              </button>
            </div>
          </div>
        </div>

        {/* Column 2: Argon2id Hardening Params */}
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-indigo-400 uppercase tracking-wider">
            <Cpu className="w-3.5 h-3.5" />
            <span>2. Argon2id Memory KDF</span>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <label className="text-slate-300">Memory Allocation (m_cost):</label>
              <span className="text-indigo-400 font-mono font-bold">{params.argonMemoryMb} MB</span>
            </div>
            <input
              type="range"
              min={16}
              max={256}
              step={16}
              value={params.argonMemoryMb}
              onChange={(e) => setParams({ ...params, argonMemoryMb: parseInt(e.target.value) })}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>16MB (Lite)</span>
              <span>64MB (AOSP)</span>
              <span>256MB</span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <label className="text-slate-300">Time Passes (t_cost):</label>
              <span className="text-indigo-400 font-mono font-bold">{params.argonIterations} passes</span>
            </div>
            <input
              type="range"
              min={1}
              max={10}
              value={params.argonIterations}
              onChange={(e) => setParams({ ...params, argonIterations: parseInt(e.target.value) })}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>1 pass</span>
              <span>3 passes</span>
              <span>10 passes</span>
            </div>
          </div>
        </div>

        {/* Column 3: Hardware Enclave & Weaver */}
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3.5 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>3. Hardware Root of Trust</span>
            </div>

            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-white font-medium">Titan M2 / Weaver Bound</span>
                <input
                  type="checkbox"
                  checked={params.hardwareEnclaveBound}
                  onChange={(e) => setParams({ ...params, hardwareEnclaveBound: e.target.checked })}
                  className="w-4 h-4 rounded text-emerald-600 bg-slate-950 border-slate-700 cursor-pointer accent-emerald-500"
                />
              </div>
              <p className="text-[11px] text-slate-400 leading-snug">
                Enforces physical hardware rate limiting (Max 30 total attempts before permanent slot erasure).
              </p>
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-900/50 text-[11px] text-emerald-300 flex items-center gap-2">
            <Sparkles className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>AEAD ChaCha20-Poly1305 + 256-bit Random Salts</span>
          </div>
        </div>
      </div>

      {/* Key Strength Indicator Bar */}
      <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-1">
          <span className="text-slate-400">Total System Defense Level:</span>
          <span className={`font-mono font-bold ${strength.color}`}>{strength.grade}</span>
        </div>
        <div className="w-full bg-slate-900 rounded-full h-2.5 overflow-hidden border border-slate-800">
          <div
            className={`h-full transition-all duration-300 ${strength.barBg}`}
            style={{ width: strength.width }}
          />
        </div>
      </div>

      {/* Comparative Entropy Bar Chart */}
      <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-sky-400" />
            <h4 className="text-xs font-semibold text-white uppercase tracking-wider">
              Entropy & Brute-Force Resistance Comparison (Bits)
            </h4>
          </div>
          <span className="text-[11px] text-slate-500 font-mono">Higher is exponentially stronger</span>
        </div>

        <div className="h-60 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={comparisonData} margin={{ top: 10, right: 20, left: -10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                dataKey="name"
                stroke="#64748b"
                fontSize={11}
                interval={0}
                angle={-10}
                textAnchor="end"
              />
              <YAxis stroke="#64748b" domain={[0, 140]} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderColor: '#334155',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
                formatter={(value: any) => [`${value} bits`, 'Resistance Depth']}
              />
              <Bar dataKey="bits" radius={[6, 6, 0, 0]}>
                {comparisonData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Forensic Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
          <span className="text-slate-500 text-[10px] uppercase font-mono">Keyspace Possibilities:</span>
          <p className="text-base font-bold text-sky-400 font-mono">
            {metrics.totalCombinations.toLocaleString()}
          </p>
          <p className="text-[10px] text-slate-500">
            Based on {metrics.charsetSize}^{params.pinLength} permutation space
          </p>
        </div>

        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
          <span className="text-slate-500 text-[10px] uppercase font-mono">Theoretical GPU Crack Time:</span>
          <p className="text-base font-bold text-amber-400 font-mono">
            {formatCrackTime(metrics.secondsOfflineBruteForce)}
          </p>
          <p className="text-[10px] text-slate-500">
            Assuming 100 high-end GPUs calculating {params.argonMemoryMb}MB Argon2id
          </p>
        </div>

        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
          <span className="text-slate-500 text-[10px] uppercase font-mono">Hardware Enclave Defense:</span>
          <p className="text-base font-bold text-emerald-400 font-mono">
            {metrics.weaverOnlineCrackable}
          </p>
          <p className="text-[10px] text-slate-500">
            Protected against offline extraction via Titan M2 / StrongBox
          </p>
        </div>
      </div>
    </div>
  );
};
