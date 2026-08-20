import React, { useState, useMemo } from 'react';
import {
  Activity,
  Flame,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Info,
  Calendar,
  Layers,
  ChevronRight,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react';
import { AuditLogEntry } from '../types';

interface SecurityHeatmapProps {
  logs: AuditLogEntry[];
  onSelectTimeBucket?: (logsInBucket: AuditLogEntry[]) => void;
}

interface TimeBucket {
  id: string;
  timeLabel: string;
  fullTimeStr: string;
  startTs: number;
  endTs: number;
  successCount: number;
  failureCount: number;
  tamperCount: number;
  otherCount: number;
  total: number;
  threatRatio: number; // 0 (safe/pure green) to 1.0 (pure threat/red)
  severityLevel: 'nominal' | 'elevated' | 'high_threat' | 'critical_attack' | 'idle';
  logs: AuditLogEntry[];
}

export const SecurityHeatmap: React.FC<SecurityHeatmapProps> = ({ logs, onSelectTimeBucket }) => {
  const [hoveredBucket, setHoveredBucket] = useState<TimeBucket | null>(null);
  const [selectedBucketId, setSelectedBucketId] = useState<string | null>(null);
  const [timeGranularity, setTimeGranularity] = useState<'auto' | '10s' | '1m' | '5m'>('auto');

  // Group logs into time buckets
  const { buckets, maxTotalEvents, overallThreatScore, highestThreatBucket } = useMemo(() => {
    if (!logs || logs.length === 0) {
      return { buckets: [], maxTotalEvents: 0, overallThreatScore: 0, highestThreatBucket: null };
    }

    // Sort chronologically ascending
    const sorted = [...logs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const earliest = new Date(sorted[0].timestamp).getTime();
    const latest = new Date(sorted[sorted.length - 1].timestamp).getTime();
    const timeSpanMs = Math.max(latest - earliest, 1000);

    // Determine interval size
    let intervalMs = 10000; // 10s
    if (timeGranularity === '10s') intervalMs = 10000;
    else if (timeGranularity === '1m') intervalMs = 60000;
    else if (timeGranularity === '5m') intervalMs = 300000;
    else {
      // Auto granularity based on span
      if (timeSpanMs <= 60000) intervalMs = 5000; // 5s buckets
      else if (timeSpanMs <= 300000) intervalMs = 15000; // 15s buckets
      else if (timeSpanMs <= 1800000) intervalMs = 60000; // 1m buckets
      else intervalMs = 300000; // 5m buckets
    }

    // Number of columns/buckets to render (between 12 and 24)
    const numBuckets = Math.max(12, Math.min(24, Math.ceil(timeSpanMs / intervalMs) + 1));
    const normalizedInterval = Math.max(intervalMs, Math.ceil(timeSpanMs / numBuckets));

    const bucketList: TimeBucket[] = [];
    const baseStart = earliest - (earliest % normalizedInterval);

    for (let i = 0; i < numBuckets; i++) {
      const bStart = baseStart + i * normalizedInterval;
      const bEnd = bStart + normalizedInterval;
      const d = new Date(bStart);
      const timeLabel = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
      const fullTimeStr = `${timeLabel} - ${new Date(bEnd).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      })}`;

      bucketList.push({
        id: `bucket-${i}-${bStart}`,
        timeLabel,
        fullTimeStr,
        startTs: bStart,
        endTs: bEnd,
        successCount: 0,
        failureCount: 0,
        tamperCount: 0,
        otherCount: 0,
        total: 0,
        threatRatio: 0,
        severityLevel: 'idle',
        logs: [],
      });
    }

    // Populate events into buckets
    logs.forEach((log) => {
      const t = new Date(log.timestamp).getTime();
      const targetBucket = bucketList.find((b) => t >= b.startTs && t < b.endTs) || bucketList[bucketList.length - 1];

      if (targetBucket) {
        targetBucket.logs.push(log);
        targetBucket.total++;
        if (log.type === 'auth_success' || log.type === 'biometric_success') {
          targetBucket.successCount++;
        } else if (log.type === 'auth_failure' || log.type === 'biometric_failure' || log.type === 'weaver_throttle' || log.type === 'weaver_lockout') {
          targetBucket.failureCount++;
        } else if (log.type === 'hsm_sector_corrupted' || log.type === 'hsm_tamper_detected' || log.type === 'hsm_panic_wipe') {
          targetBucket.tamperCount++;
        } else {
          targetBucket.otherCount++;
        }
      }
    });

    let maxTotal = 0;
    let highestThreat: TimeBucket | null = null;
    let totalThreatScoreAcc = 0;
    let activeBucketsCount = 0;

    bucketList.forEach((b) => {
      if (b.total > maxTotal) maxTotal = b.total;

      if (b.total === 0) {
        b.severityLevel = 'idle';
        b.threatRatio = 0;
      } else {
        activeBucketsCount++;
        // Threat formula: heavy weight on tamper (2.0x) and failure (1.0x), negative weight on success
        const threatPoints = b.failureCount * 1.0 + b.tamperCount * 2.5;
        const ratio = Math.min(1.0, threatPoints / Math.max(1, b.total + b.tamperCount));
        b.threatRatio = ratio;
        totalThreatScoreAcc += ratio;

        if (b.tamperCount > 0 || (b.failureCount >= 4 && ratio >= 0.7)) {
          b.severityLevel = 'critical_attack';
        } else if (b.failureCount >= 2 || ratio >= 0.5) {
          b.severityLevel = 'high_threat';
        } else if (b.failureCount >= 1 || ratio > 0.2) {
          b.severityLevel = 'elevated';
        } else {
          b.severityLevel = 'nominal';
        }

        if (!highestThreat || b.threatRatio > highestThreat.threatRatio || (b.threatRatio === highestThreat.threatRatio && b.total > highestThreat.total)) {
          highestThreat = b;
        }
      }
    });

    const overallThreat = activeBucketsCount > 0 ? Math.round((totalThreatScoreAcc / activeBucketsCount) * 100) : 0;

    return {
      buckets: bucketList,
      maxTotalEvents: Math.max(maxTotal, 1),
      overallThreatScore: overallThreat,
      highestThreatBucket: highestThreat,
    };
  }, [logs, timeGranularity]);

  const getBucketColorClass = (b: TimeBucket) => {
    if (b.total === 0) return 'bg-slate-900/60 border-slate-800/60 hover:border-slate-700';
    switch (b.severityLevel) {
      case 'critical_attack':
        return 'bg-gradient-to-t from-rose-950 via-rose-900 to-rose-600 border-rose-500 shadow-md shadow-rose-900/40 animate-pulse';
      case 'high_threat':
        return 'bg-gradient-to-t from-amber-950 via-amber-900 to-amber-600 border-amber-500 shadow-sm shadow-amber-900/30';
      case 'elevated':
        return 'bg-gradient-to-t from-yellow-950 via-yellow-900 to-yellow-600/80 border-yellow-500/80';
      case 'nominal':
      default:
        return 'bg-gradient-to-t from-emerald-950 via-emerald-900/90 to-emerald-600 border-emerald-500/80';
    }
  };

  const handleBucketClick = (bucket: TimeBucket) => {
    setSelectedBucketId(bucket.id);
    if (onSelectTimeBucket) {
      onSelectTimeBucket(bucket.logs);
    }
  };

  return (
    <div className="p-4 rounded-2xl bg-slate-950/90 border border-slate-800 shadow-xl space-y-3.5">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-rose-950/80 border border-rose-800 text-rose-400">
            <Activity className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                Authentication Security Heatmap
              </h4>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">
                Frequency & Threat Matrix
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Visualizes temporal spikes in failed brute-force probes vs. legitimate profile unlocks.
            </p>
          </div>
        </div>

        {/* Threat Gauge & Granularity */}
        <div className="flex items-center gap-3 self-end sm:self-auto">
          {/* Threat Metric Badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs">
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Threat Level:</span>
            <span
              className={`font-mono font-bold ${
                overallThreatScore >= 60
                  ? 'text-rose-400'
                  : overallThreatScore >= 30
                  ? 'text-amber-400'
                  : 'text-emerald-400'
              }`}
            >
              {overallThreatScore}%
            </span>
          </div>

          {/* Granularity Selector */}
          <div className="flex items-center rounded-lg bg-slate-900 border border-slate-800 p-0.5 text-[10px] font-mono">
            {(['auto', '10s', '1m', '5m'] as const).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setTimeGranularity(g)}
                className={`px-2 py-0.5 rounded transition-colors ${
                  timeGranularity === g
                    ? 'bg-sky-600 text-white font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {g.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Heatmap Grid Bars */}
      <div className="space-y-1.5">
        <div className="grid grid-cols-12 sm:grid-cols-24 gap-1 items-end h-24 pt-2">
          {buckets.map((b) => {
            const heightPercent = b.total === 0 ? 12 : Math.max(22, (b.total / maxTotalEvents) * 100);
            const isSelected = selectedBucketId === b.id;

            return (
              <div
                key={b.id}
                onMouseEnter={() => setHoveredBucket(b)}
                onMouseLeave={() => setHoveredBucket(null)}
                onClick={() => handleBucketClick(b)}
                className="group relative flex flex-col justify-end h-full cursor-pointer"
              >
                {/* Bar */}
                <div
                  style={{ height: `${heightPercent}%` }}
                  className={`w-full rounded-md border transition-all duration-200 ${getBucketColorClass(
                    b
                  )} ${
                    isSelected ? 'ring-2 ring-sky-400 ring-offset-1 ring-offset-slate-950 scale-105' : ''
                  } group-hover:scale-105`}
                />

                {/* Micro Intensity Indicator */}
                {b.tamperCount > 0 && (
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping" />
                )}
              </div>
            );
          })}
        </div>

        {/* Time Timeline Labels */}
        <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono pt-1 px-1">
          <span>{buckets[0]?.timeLabel || 'T-Start'}</span>
          <span className="text-slate-600">Chronological Event Timeline ➔</span>
          <span>{buckets[buckets.length - 1]?.timeLabel || 'T-Now'}</span>
        </div>
      </div>

      {/* Dynamic Inspector / Tooltip Bar */}
      <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
        {hoveredBucket || highestThreatBucket ? (
          (() => {
            const b = hoveredBucket || highestThreatBucket!;
            return (
              <>
                <div className="flex items-center gap-2">
                  <div
                    className={`w-2.5 h-2.5 rounded-full ${
                      b.severityLevel === 'critical_attack'
                        ? 'bg-rose-500 animate-ping'
                        : b.severityLevel === 'high_threat'
                        ? 'bg-amber-500'
                        : b.severityLevel === 'elevated'
                        ? 'bg-yellow-500'
                        : b.total > 0
                        ? 'bg-emerald-500'
                        : 'bg-slate-600'
                    }`}
                  />
                  <span className="font-mono text-slate-300 text-[11px]">
                    <strong>{b.fullTimeStr}</strong>
                  </span>
                  <span className="text-slate-500">|</span>
                  <span className="text-slate-400 text-[11px]">
                    Total Events: <strong className="text-white font-mono">{b.total}</strong>
                  </span>
                </div>

                <div className="flex items-center gap-3 text-[11px] font-mono">
                  <span className="flex items-center gap-1 text-emerald-400">
                    <ShieldCheck className="w-3 h-3" /> {b.successCount} Unlocks
                  </span>
                  <span className="flex items-center gap-1 text-rose-400">
                    <ShieldAlert className="w-3 h-3" /> {b.failureCount} Fails
                  </span>
                  {b.tamperCount > 0 && (
                    <span className="flex items-center gap-1 text-purple-400 font-bold">
                      <Flame className="w-3 h-3 text-purple-400" /> {b.tamperCount} Tampers
                    </span>
                  )}
                  {onSelectTimeBucket && b.total > 0 && (
                    <span className="text-[10px] text-sky-400 underline cursor-pointer ml-1">
                      Filter to this bucket
                    </span>
                  )}
                </div>
              </>
            );
          })()
        ) : (
          <div className="text-slate-500 text-[11px] italic">
            Hover over any timeline column to inspect specific authentication windows.
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[10px] text-slate-400 border-t border-slate-900">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded bg-emerald-500" />
            Nominal (Unlocks Dominant)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded bg-yellow-500" />
            Elevated (Probing)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded bg-amber-500" />
            High Threat (Frequent Fails)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded bg-rose-500" />
            Critical Attack (Lockout / Tamper)
          </span>
        </div>

        <div className="text-slate-500 font-mono">
          Constant-Time SR-3 Audit Protection
        </div>
      </div>
    </div>
  );
};
