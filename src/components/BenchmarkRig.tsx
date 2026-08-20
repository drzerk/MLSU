import React, { useState } from 'react';
import {
  Timer,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Info,
  TrendingUp,
  Activity,
  Binary,
  Cpu,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { MlsuKeyStore } from '../crypto/mlsuEngine';
import { EntropyVisualizer } from './EntropyVisualizer';

interface BenchmarkRigProps {
  engine: MlsuKeyStore;
}

interface TimingSample {
  iteration: number;
  privateTime: number;
  duressTime: number;
  wrongPinTime: number;
}

export const BenchmarkRig: React.FC<BenchmarkRigProps> = ({ engine }) => {
  const [sampleCount, setSampleCount] = useState<number>(10);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [timingData, setTimingData] = useState<TimingSample[]>([]);
  const [stats, setStats] = useState<{
    avgPrivate: number;
    avgDuress: number;
    avgWrong: number;
    variancePercent: number;
  } | null>(null);

  const runBenchmark = async () => {
    setIsRunning(true);
    setProgress(0);
    const results: TimingSample[] = [];

    // Temporarily isolate rate limiter for timing measurement (as noted in counters.py / timing.py)
    const originalCounters = engine.slots.map((s) => ({ f: s.failures, l: s.lastFailureAt }));

    for (let i = 1; i <= sampleCount; i++) {
      engine.resetFailureCounters();
      const t1Start = performance.now();
      await engine.unlock('471903');
      const t1 = performance.now() - t1Start;

      engine.resetFailureCounters();
      const t2Start = performance.now();
      await engine.unlock('220561');
      const t2 = performance.now() - t2Start;

      engine.resetFailureCounters();
      const t3Start = performance.now();
      await engine.unlock('883190');
      const t3 = performance.now() - t3Start;

      results.push({
        iteration: i,
        privateTime: parseFloat(t1.toFixed(2)),
        duressTime: parseFloat(t2.toFixed(2)),
        wrongPinTime: parseFloat(t3.toFixed(2)),
      });

      setProgress(Math.round((i / sampleCount) * 100));
      setTimingData([...results]);
    }

    // Restore counters
    engine.slots.forEach((s, idx) => {
      s.failures = originalCounters[idx]?.f || 0;
      s.lastFailureAt = originalCounters[idx]?.l || null;
    });

    // Compute statistics
    const avgPriv = results.reduce((a, b) => a + b.privateTime, 0) / results.length;
    const avgDur = results.reduce((a, b) => a + b.duressTime, 0) / results.length;
    const avgWr = results.reduce((a, b) => a + b.wrongPinTime, 0) / results.length;
    const maxVal = Math.max(avgPriv, avgDur, avgWr);
    const minVal = Math.min(avgPriv, avgDur, avgWr);
    const variance = ((maxVal - minVal) / avgPriv) * 100;

    setStats({
      avgPrivate: avgPriv,
      avgDuress: avgDur,
      avgWrong: avgWr,
      variancePercent: variance,
    });

    setIsRunning(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-2">
        <div className="flex items-center gap-2 text-sky-400 text-xs font-semibold uppercase tracking-wider">
          <Timer className="w-4 h-4 text-sky-400" />
          Constant-Time Verification Rig (SR-3, SR-9)
        </div>
        <h2 className="text-xl font-bold text-white tracking-tight">
          Timing Side-Channel Measurement
        </h2>
        <p className="text-xs text-slate-300 max-w-3xl leading-relaxed">
          The MLSU unlock algorithm must execute in <strong>constant time</strong> regardless of whether the entered PIN opens Profile 1, Profile 2, or no profile at all. Early returns or branch leaks would reveal the presence and index of valid profiles (SR-3).
        </p>
      </div>

      {/* Benchmark Controls */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <label className="text-xs text-slate-300 font-medium">Sample Iterations:</label>
            <select
              value={sampleCount}
              disabled={isRunning}
              onChange={(e) => setSampleCount(parseInt(e.target.value))}
              className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs font-mono"
            >
              <option value={5}>5 Samples (Quick)</option>
              <option value={10}>10 Samples (Standard)</option>
              <option value={20}>20 Samples (Rigorous)</option>
            </select>
          </div>

          <button
            onClick={runBenchmark}
            disabled={isRunning}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-2 shadow-md transition-all"
          >
            {isRunning ? (
              <>
                <Activity className="w-3.5 h-3.5 animate-spin" />
                Measuring... ({progress}%)
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                Execute Timing Benchmark
              </>
            )}
          </button>
        </div>

        {/* Progress Bar */}
        {isRunning && (
          <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
            <div
              className="bg-sky-500 h-full transition-all duration-150"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>

      {/* Results & Statistics */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
            <span className="text-[11px] text-slate-400">Avg Private PIN Time:</span>
            <p className="text-lg font-bold text-indigo-400 font-mono">{stats.avgPrivate.toFixed(2)} ms</p>
          </div>
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
            <span className="text-[11px] text-slate-400">Avg Duress PIN Time:</span>
            <p className="text-lg font-bold text-sky-400 font-mono">{stats.avgDuress.toFixed(2)} ms</p>
          </div>
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
            <span className="text-[11px] text-slate-400">Avg Wrong PIN Time:</span>
            <p className="text-lg font-bold text-amber-400 font-mono">{stats.avgWrong.toFixed(2)} ms</p>
          </div>
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
            <span className="text-[11px] text-slate-400">Max Timing Variance:</span>
            <p className="text-lg font-bold text-emerald-400 font-mono">{stats.variancePercent.toFixed(2)}%</p>
          </div>
        </div>
      )}

      {/* Chart */}
      {timingData.length > 0 && (
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
              Execution Time by Input Candidate (ms)
            </h3>
            <span className="text-[11px] text-slate-400">Lower variance = higher side-channel resilience</span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timingData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="iteration" stroke="#64748b" textAnchor="middle" />
                <YAxis stroke="#64748b" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                />
                <Legend />
                <Line type="monotone" dataKey="privateTime" name="Private PIN (471903)" stroke="#818cf8" strokeWidth={2} />
                <Line type="monotone" dataKey="duressTime" name="Duress PIN (220561)" stroke="#38bdf8" strokeWidth={2} />
                <Line type="monotone" dataKey="wrongPinTime" name="Invalid Guess (883190)" stroke="#f59e0b" strokeWidth={2} strokeDasharray="4 4" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Finding note */}
      <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 leading-relaxed">
        <strong className="text-white">Analysis & Finding F-3:</strong> In high-level runtimes, jitter originates from the garbage collector and process scheduling. On production AOSP, constant-time guarantees are anchored by the dedicated C/Rust core (<code className="text-sky-300">ct_core</code>) using branch-free bitwise masking.
      </div>

      {/* Visual Entropy and Key Generation Strength Model */}
      <EntropyVisualizer />
    </div>
  );
};
