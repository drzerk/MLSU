import React, { useState, useMemo } from 'react';
import {
  Activity,
  TrendingUp,
  Clock,
  ShieldAlert,
  ShieldCheck,
  Zap,
  Filter,
  Flame,
} from 'lucide-react';
import { AuditLogEntry } from '../types';

interface AuditSparklineProps {
  logs: AuditLogEntry[];
  onSelectHourRange?: (filteredLogs: AuditLogEntry[], label: string) => void;
}

interface HourBucket {
  hourIndex: number; // 0 to 23 (0 = 24h ago, 23 = current hour)
  timeLabel: string;
  hourStartTs: number;
  hourEndTs: number;
  totalEvents: number;
  successEvents: number;
  threatEvents: number; // failure, lockout, tamper, etc.
  neutralEvents: number; // profile switch, lock, rotation
  logs: AuditLogEntry[];
}

export const AuditSparkline: React.FC<AuditSparklineProps> = ({ logs, onSelectHourRange }) => {
  const [hoveredHour, setHoveredHour] = useState<HourBucket | null>(null);
  const [selectedHourIndex, setSelectedHourIndex] = useState<number | null>(null);

  // Compute 24 one-hour time windows over the last 24 hours of simulated/system time
  const { hourBuckets, maxHourEvents, total24hEvents, totalThreats24h, peakHour } = useMemo(() => {
    const now = Date.now();
    const oneHourMs = 60 * 60 * 1000;
    const windowStartTs = now - 24 * oneHourMs;

    // Initialize 24 empty hour buckets
    const buckets: HourBucket[] = Array.from({ length: 24 }, (_, i) => {
      const bucketStart = windowStartTs + i * oneHourMs;
      const bucketEnd = bucketStart + oneHourMs;
      const dateObj = new Date(bucketStart);
      const hoursAgo = 23 - i;
      const timeLabel =
        hoursAgo === 0
          ? 'Now'
          : hoursAgo === 1
          ? '1h ago'
          : `${hoursAgo}h ago (${dateObj.getHours().toString().padStart(2, '0')}:00)`;

      return {
        hourIndex: i,
        timeLabel,
        hourStartTs: bucketStart,
        hourEndTs: bucketEnd,
        totalEvents: 0,
        successEvents: 0,
        threatEvents: 0,
        neutralEvents: 0,
        logs: [],
      };
    });

    let total24h = 0;
    let totalThreats = 0;

    // Distribute logs into buckets
    logs.forEach((log) => {
      const logTs = new Date(log.timestamp).getTime();
      // If log falls within the 24h window
      if (logTs >= windowStartTs && logTs <= now) {
        const bucketIndex = Math.min(23, Math.max(0, Math.floor((logTs - windowStartTs) / oneHourMs)));
        const b = buckets[bucketIndex];
        b.totalEvents += 1;
        b.logs.push(log);
        total24h += 1;

        if (log.type === 'auth_success' || log.type === 'biometric_success') {
          b.successEvents += 1;
        } else if (
          log.type === 'auth_failure' ||
          log.type === 'biometric_failure' ||
          log.type === 'weaver_throttle' ||
          log.type === 'weaver_lockout' ||
          log.type === 'hsm_sector_corrupted' ||
          log.type === 'hsm_tamper_detected' ||
          log.type === 'hsm_panic_wipe' ||
          log.type === 'audit_tamper_detected'
        ) {
          b.threatEvents += 1;
          totalThreats += 1;
        } else {
          b.neutralEvents += 1;
        }
      } else if (logTs > now) {
        // Fallback for immediate current time stamps
        const b = buckets[23];
        b.totalEvents += 1;
        b.logs.push(log);
        total24h += 1;
      }
    });

    let maxEvents = 0;
    let peak: HourBucket | null = null;
    buckets.forEach((b) => {
      if (b.totalEvents > maxEvents) {
        maxEvents = b.totalEvents;
        peak = b;
      }
    });

    return {
      hourBuckets: buckets,
      maxHourEvents: maxEvents,
      total24hEvents: total24h,
      totalThreats24h: totalThreats,
      peakHour: peak,
    };
  }, [logs]);

  // Generate SVG Sparkline polyline coordinates
  const svgPoints = useMemo(() => {
    if (hourBuckets.length === 0) return { pathD: '', areaD: '', coordinates: [] };

    const width = 100; // normalized viewBox coordinates
    const height = 32;
    const paddingY = 4;
    const effectiveHeight = height - paddingY * 2;
    const maxVal = Math.max(maxHourEvents, 4);

    const coords = hourBuckets.map((bucket, idx) => {
      const x = (idx / (hourBuckets.length - 1)) * width;
      const normalizedY = bucket.totalEvents / maxVal;
      const y = height - paddingY - normalizedY * effectiveHeight;
      return { x, y, bucket };
    });

    // Create smooth curved path or standard line path
    const pathD = coords.reduce((acc, pt, i) => {
      if (i === 0) return `M ${pt.x.toFixed(2)} ${pt.y.toFixed(2)}`;
      return `${acc} L ${pt.x.toFixed(2)} ${pt.y.toFixed(2)}`;
    }, '');

    const areaD = `${pathD} L 100 32 L 0 32 Z`;

    return { pathD, areaD, coordinates: coords };
  }, [hourBuckets, maxHourEvents]);

  const handleSelectHour = (bucket: HourBucket) => {
    if (selectedHourIndex === bucket.hourIndex) {
      setSelectedHourIndex(null);
      if (onSelectHourRange) onSelectHourRange(logs, 'All');
    } else {
      setSelectedHourIndex(bucket.hourIndex);
      if (onSelectHourRange) onSelectHourRange(bucket.logs, bucket.timeLabel);
    }
  };

  return (
    <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/90 shadow-sm space-y-2.5">
      {/* Top row: Sparkline label, 24h event counter & stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-md bg-sky-950/80 border border-sky-800 text-sky-400">
            <Activity className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white tracking-tight flex items-center gap-1.5">
                24-Hour Security Event Velocity Sparkline
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-900 text-slate-300 border border-slate-800">
                1h granularity
              </span>
            </div>
            <p className="text-[10px] text-slate-400">
              Interactive timeline tracking event frequency, brute-force anomalies, and auth spikes over 24h.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-[11px] font-mono">
          <div className="flex items-center gap-1 text-slate-300">
            <span className="text-slate-500">24h Total:</span>
            <span className="font-bold text-cyan-300">{total24hEvents}</span>
          </div>

          <div className="flex items-center gap-1 text-slate-300">
            <span className="text-slate-500">Threats:</span>
            <span
              className={`font-bold ${
                totalThreats24h > 0 ? 'text-rose-400' : 'text-emerald-400'
              }`}
            >
              {totalThreats24h}
            </span>
          </div>

          {peakHour && peakHour.totalEvents > 0 && (
            <div className="hidden md:flex items-center gap-1 text-slate-400">
              <span className="text-slate-500">Peak:</span>
              <span className="text-amber-300 font-semibold">
                {peakHour.totalEvents}/hr ({peakHour.timeLabel})
              </span>
            </div>
          )}
        </div>
      </div>

      {/* SVG Sparkline & Interactive 24-Column Bar Histogram */}
      <div className="relative pt-1 pb-1">
        {/* SVG Area & Trend Line */}
        <div className="w-full h-12 relative overflow-hidden rounded-lg bg-slate-900/60 border border-slate-800/80">
          <svg
            viewBox="0 0 100 32"
            preserveAspectRatio="none"
            className="w-full h-full absolute inset-0 pointer-events-none"
          >
            <defs>
              <linearGradient id="sparklineAreaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#0284c7" stopOpacity="0.0" />
              </linearGradient>
              <linearGradient id="sparklineStrokeGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#38bdf8" />
                <stop offset="70%" stopColor="#6366f1" />
                <stop offset="100%" stopColor="#a855f7" />
              </linearGradient>
            </defs>

            {/* Background Grid Lines */}
            <line x1="0" y1="8" x2="100" y2="8" stroke="#334155" strokeWidth="0.3" strokeDasharray="1 1" />
            <line x1="0" y1="16" x2="100" y2="16" stroke="#334155" strokeWidth="0.3" strokeDasharray="1 1" />
            <line x1="0" y1="24" x2="100" y2="24" stroke="#334155" strokeWidth="0.3" strokeDasharray="1 1" />

            {/* Gradient Filled Area */}
            {svgPoints.areaD && (
              <path d={svgPoints.areaD} fill="url(#sparklineAreaGrad)" />
            )}

            {/* Sparkline Curve Stroke */}
            {svgPoints.pathD && (
              <path
                d={svgPoints.pathD}
                fill="none"
                stroke="url(#sparklineStrokeGrad)"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Coordinates markers */}
            {svgPoints.coordinates.map((pt) => {
              if (pt.bucket.totalEvents === 0) return null;
              const hasThreat = pt.bucket.threatEvents > 0;
              return (
                <circle
                  key={pt.bucket.hourIndex}
                  cx={pt.x}
                  cy={pt.y}
                  r={hoveredHour?.hourIndex === pt.bucket.hourIndex ? 2.2 : 1.2}
                  className={`${
                    hasThreat
                      ? 'fill-rose-400 stroke-rose-950'
                      : 'fill-cyan-300 stroke-sky-950'
                  } stroke-[0.5] transition-all`}
                />
              );
            })}
          </svg>

          {/* Interactive 24-Column Touch/Hover Overlay */}
          <div className="absolute inset-0 grid grid-cols-24 gap-[1px] px-1 py-1 z-10">
            {hourBuckets.map((bucket) => {
              const isHovered = hoveredHour?.hourIndex === bucket.hourIndex;
              const isSelected = selectedHourIndex === bucket.hourIndex;
              const maxVal = Math.max(maxHourEvents, 1);
              const heightPercent = Math.min(100, Math.max(12, (bucket.totalEvents / maxVal) * 100));
              const hasThreat = bucket.threatEvents > 0;

              return (
                <div
                  key={bucket.hourIndex}
                  onMouseEnter={() => setHoveredHour(bucket)}
                  onMouseLeave={() => setHoveredHour(null)}
                  onClick={() => handleSelectHour(bucket)}
                  className="h-full flex flex-col justify-end items-center cursor-pointer group relative"
                  title={`${bucket.timeLabel}: ${bucket.totalEvents} events`}
                >
                  {/* Vertical mini bar column */}
                  <div
                    style={{ height: `${bucket.totalEvents > 0 ? heightPercent : 6}%` }}
                    className={`w-full rounded-xs transition-all duration-150 ${
                      isSelected
                        ? 'bg-cyan-400 ring-1 ring-white shadow-md'
                        : isHovered
                        ? hasThreat
                          ? 'bg-rose-400'
                          : 'bg-sky-300'
                        : bucket.totalEvents > 0
                        ? hasThreat
                          ? 'bg-rose-500/70 hover:bg-rose-400'
                          : 'bg-sky-500/60 hover:bg-sky-400'
                        : 'bg-slate-800/30 hover:bg-slate-700/50'
                    }`}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* X-Axis Timeline Labels */}
        <div className="flex items-center justify-between text-[9px] font-mono text-slate-500 pt-1 px-0.5">
          <span>-24h</span>
          <span>-18h</span>
          <span>-12h</span>
          <span>-6h</span>
          <span>-1h</span>
          <span className="text-cyan-400 font-bold">Now</span>
        </div>
      </div>

      {/* Dynamic Hover/Selection Details Bar */}
      {hoveredHour ? (
        <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-[11px] flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Clock className="w-3 h-3 text-sky-400" />
            <span className="text-white font-semibold">{hoveredHour.timeLabel}</span>
            <span className="text-slate-400">({hoveredHour.totalEvents} total security events)</span>
          </div>

          <div className="flex items-center gap-3 font-mono text-[10px]">
            <span className="text-emerald-400 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" />
              {hoveredHour.successEvents} Success
            </span>
            <span
              className={`flex items-center gap-1 ${
                hoveredHour.threatEvents > 0 ? 'text-rose-400 font-bold' : 'text-slate-400'
              }`}
            >
              <ShieldAlert className="w-3 h-3" />
              {hoveredHour.threatEvents} Threats / Rejections
            </span>
            <span className="text-indigo-300">
              {hoveredHour.neutralEvents} State Transitions
            </span>
          </div>
        </div>
      ) : selectedHourIndex !== null ? (
        <div className="p-2 rounded-lg bg-cyan-950/40 border border-cyan-800 text-[11px] flex items-center justify-between text-cyan-200">
          <div className="flex items-center gap-1.5">
            <Filter className="w-3 h-3 text-cyan-400" />
            <span>
              Filtered to <strong>{hourBuckets[selectedHourIndex]?.timeLabel}</strong> (
              {hourBuckets[selectedHourIndex]?.totalEvents} events)
            </span>
          </div>
          <button
            onClick={() => {
              setSelectedHourIndex(null);
              if (onSelectHourRange) onSelectHourRange(logs, 'All');
            }}
            className="text-[10px] underline text-cyan-300 hover:text-white font-semibold cursor-pointer"
          >
            Clear Filter
          </button>
        </div>
      ) : null}
    </div>
  );
};
