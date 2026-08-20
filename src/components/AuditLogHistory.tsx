import React, { useState } from 'react';
import {
  History,
  Shield,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Lock,
  Unlock,
  Key,
  RotateCcw,
  Download,
  Trash2,
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  Cpu,
  Database,
  ArrowRightLeft,
  Smartphone,
  FolderLock,
  PlusCircle,
  Fingerprint,
  ScanFace,
  Eye,
  Flame,
  Zap,
  Activity,
  BarChart3,
} from 'lucide-react';
import { AuditLogEntry, AuditLogFilter, AuditLogType } from '../types';
import { SecurityHeatmap } from './SecurityHeatmap';
import { AuditSparkline } from './AuditSparkline';

interface AuditLogHistoryProps {
  logs: AuditLogEntry[];
  onClearLogs: () => void;
  onSimulateBruteForce?: () => void;
  weaverFailureCount: number;
  isLockedOut: boolean;
  throttledRemaining: number;
}

export const AuditLogHistory: React.FC<AuditLogHistoryProps> = ({
  logs,
  onClearLogs,
  weaverFailureCount,
  isLockedOut,
  throttledRemaining,
}) => {
  const [filter, setFilter] = useState<AuditLogFilter>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [showHeatmap, setShowHeatmap] = useState<boolean>(true);
  const [showSparkline, setShowSparkline] = useState<boolean>(true);
  const [selectedBucketLogs, setSelectedBucketLogs] = useState<AuditLogEntry[] | null>(null);
  const [timeFilterLabel, setTimeFilterLabel] = useState<string | null>(null);

  // Filter logs according to active filter and search query
  const logsToFilter = selectedBucketLogs || logs;
  const filteredLogs = logsToFilter.filter((log) => {
    // Filter by category
    if (filter === 'success' && log.type !== 'auth_success' && log.type !== 'biometric_success') return false;
    if (filter === 'failure' && log.type !== 'auth_failure' && log.type !== 'biometric_failure') return false;
    if (filter === 'biometrics' && log.type !== 'biometric_success' && log.type !== 'biometric_failure') return false;
    if (
      filter === 'transitions' &&
      log.type !== 'profile_switch' &&
      log.type !== 'device_lock' &&
      log.type !== 'profile_enroll'
    )
      return false;
    if (
      filter === 'lockout' &&
      log.type !== 'weaver_throttle' &&
      log.type !== 'weaver_lockout' &&
      log.type !== 'counter_reset'
    )
      return false;
    if (filter === 'rotation' && log.type !== 'master_key_rotation') return false;
    if (
      filter === 'tamper' &&
      log.type !== 'hsm_sector_corrupted' &&
      log.type !== 'hsm_tamper_detected' &&
      log.type !== 'hsm_panic_wipe' &&
      log.type !== 'hsm_tamper_recovered'
    )
      return false;

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = log.title.toLowerCase().includes(q);
      const matchDetails = log.details.toLowerCase().includes(q);
      const matchProfile = log.profileName ? log.profileName.toLowerCase().includes(q) : false;
      const matchType = log.type.toLowerCase().includes(q);
      const matchPin = log.pinMasked.toLowerCase().includes(q);
      return matchTitle || matchDetails || matchProfile || matchType || matchPin;
    }

    return true;
  });

  const successCount = logs.filter((l) => l.type === 'auth_success' || l.type === 'biometric_success').length;
  const failureCount = logs.filter((l) => l.type === 'auth_failure' || l.type === 'biometric_failure').length;
  const biometricCount = logs.filter((l) => l.type === 'biometric_success' || l.type === 'biometric_failure').length;
  const transitionCount = logs.filter(
    (l) => l.type === 'profile_switch' || l.type === 'device_lock' || l.type === 'profile_enroll'
  ).length;
  const lockoutCount = logs.filter(
    (l) => l.type === 'weaver_throttle' || l.type === 'weaver_lockout' || l.type === 'counter_reset'
  ).length;
  const rotationCount = logs.filter((l) => l.type === 'master_key_rotation').length;
  const tamperCount = logs.filter(
    (l) =>
      l.type === 'hsm_sector_corrupted' ||
      l.type === 'hsm_tamper_detected' ||
      l.type === 'hsm_panic_wipe' ||
      l.type === 'hsm_tamper_recovered'
  ).length;

  const handleExportJSON = () => {
    setIsExporting(true);
    const dataStr = JSON.stringify(logs, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `mlsu-audit-log-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setTimeout(() => setIsExporting(false), 800);
  };

  const getLogIcon = (type: AuditLogType) => {
    switch (type) {
      case 'auth_success':
        return <ShieldCheck className="w-4 h-4 text-emerald-400" />;
      case 'biometric_success':
        return <Fingerprint className="w-4 h-4 text-emerald-400 animate-pulse" />;
      case 'auth_failure':
        return <XCircle className="w-4 h-4 text-rose-400" />;
      case 'biometric_failure':
        return <ScanFace className="w-4 h-4 text-rose-400" />;
      case 'profile_switch':
        return <ArrowRightLeft className="w-4 h-4 text-sky-400" />;
      case 'device_lock':
        return <Lock className="w-4 h-4 text-slate-400" />;
      case 'weaver_throttle':
        return <Clock className="w-4 h-4 text-amber-400 animate-pulse" />;
      case 'weaver_lockout':
        return <ShieldAlert className="w-4 h-4 text-rose-500 animate-bounce" />;
      case 'counter_reset':
        return <RotateCcw className="w-4 h-4 text-indigo-400" />;
      case 'profile_enroll':
        return <PlusCircle className="w-4 h-4 text-purple-400" />;
      case 'master_key_rotation':
        return <Key className="w-4 h-4 text-cyan-400 animate-spin" />;
      case 'hsm_tamper_detected':
        return <Flame className="w-4 h-4 text-rose-500 animate-pulse" />;
      case 'hsm_sector_corrupted':
        return <Cpu className="w-4 h-4 text-amber-400" />;
      case 'hsm_panic_wipe':
        return <Trash2 className="w-4 h-4 text-rose-400 animate-bounce" />;
      case 'hsm_tamper_recovered':
        return <ShieldCheck className="w-4 h-4 text-teal-400" />;
      case 'audit_integrity_verified':
        return <ShieldCheck className="w-4 h-4 text-cyan-400" />;
      case 'audit_tamper_detected':
        return <ShieldAlert className="w-4 h-4 text-rose-500 animate-pulse" />;
      case 'audit_ledger_healed':
        return <Sparkles className="w-4 h-4 text-emerald-400" />;
      default:
        return <History className="w-4 h-4 text-slate-400" />;
    }
  };

  const getBadgeStyle = (type: AuditLogType) => {
    switch (type) {
      case 'auth_success':
        return 'bg-emerald-950/80 text-emerald-300 border-emerald-800';
      case 'biometric_success':
        return 'bg-teal-950/80 text-teal-300 border-teal-800';
      case 'auth_failure':
        return 'bg-rose-950/80 text-rose-300 border-rose-800';
      case 'biometric_failure':
        return 'bg-orange-950/80 text-orange-300 border-orange-800';
      case 'profile_switch':
        return 'bg-sky-950/80 text-sky-300 border-sky-800';
      case 'device_lock':
        return 'bg-slate-800 text-slate-300 border-slate-700';
      case 'weaver_throttle':
        return 'bg-amber-950/80 text-amber-300 border-amber-800';
      case 'weaver_lockout':
        return 'bg-rose-950 text-rose-200 border-rose-700 font-bold';
      case 'counter_reset':
        return 'bg-indigo-950/80 text-indigo-300 border-indigo-800';
      case 'profile_enroll':
        return 'bg-purple-950/80 text-purple-300 border-purple-800';
      case 'master_key_rotation':
        return 'bg-cyan-950/80 text-cyan-300 border-cyan-700 font-semibold';
      case 'hsm_tamper_detected':
        return 'bg-rose-950 text-rose-300 border-rose-600 font-bold animate-pulse';
      case 'hsm_sector_corrupted':
        return 'bg-amber-950/90 text-amber-300 border-amber-700 font-semibold';
      case 'hsm_panic_wipe':
        return 'bg-purple-950 text-purple-200 border-purple-600 font-bold';
      case 'hsm_tamper_recovered':
        return 'bg-teal-950/80 text-teal-300 border-teal-700';
      case 'audit_integrity_verified':
        return 'bg-cyan-950 text-cyan-300 border-cyan-700 font-semibold';
      case 'audit_tamper_detected':
        return 'bg-rose-950 text-rose-200 border-rose-600 font-bold animate-pulse';
      case 'audit_ledger_healed':
        return 'bg-emerald-950 text-emerald-300 border-emerald-700 font-semibold';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  const getBadgeLabel = (type: AuditLogType) => {
    switch (type) {
      case 'auth_success':
        return 'AUTH SUCCESS';
      case 'biometric_success':
        return 'BIOMETRIC MATCH';
      case 'auth_failure':
        return 'AUTH MISS';
      case 'biometric_failure':
        return 'BIOMETRIC REJECT';
      case 'profile_switch':
        return 'PROFILE MOUNT';
      case 'device_lock':
        return 'KEY PURGE';
      case 'weaver_throttle':
        return 'RATE LIMIT';
      case 'weaver_lockout':
        return 'LOCKOUT EVENT';
      case 'counter_reset':
        return 'COUNTER RESET';
      case 'profile_enroll':
        return 'ENROLLMENT';
      case 'master_key_rotation':
        return 'KEY ROTATION';
      case 'hsm_tamper_detected':
        return 'HSM TAMPER';
      case 'hsm_sector_corrupted':
        return 'SECTOR CORRUPT';
      case 'hsm_panic_wipe':
        return 'PANIC WIPE';
      case 'hsm_tamper_recovered':
        return 'TAMPER RECOVER';
      case 'audit_integrity_verified':
        return 'LEDGER VERIFIED';
      case 'audit_tamper_detected':
        return 'AUDIT TAMPERED';
      case 'audit_ledger_healed':
        return 'LEDGER HEALED';
      default:
        return 'SYSTEM EVENT';
    }
  };

  return (
    <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
      {/* Header with Title and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-sky-950 text-sky-400 border border-sky-800 flex items-center justify-center">
            <History className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white tracking-tight">
                Authentication & State Audit Log
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                {logs.length} Total Events
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Forensic audit of unlock derivations, profile transitions, and Weaver rate limiters
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="toggle-audit-sparkline-btn"
            onClick={() => setShowSparkline((prev) => !prev)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 border transition-colors ${
              showSparkline
                ? 'bg-sky-950/80 border-sky-700 text-sky-300'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
            title="Toggle 24-hour activity sparkline chart"
          >
            <TrendingUp className="w-3.5 h-3.5 text-sky-400" />
            <span>{showSparkline ? 'Hide Sparkline' : 'Show Sparkline'}</span>
          </button>
          <button
            id="toggle-security-heatmap-btn"
            onClick={() => setShowHeatmap((prev) => !prev)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 border transition-colors ${
              showHeatmap
                ? 'bg-indigo-950/80 border-indigo-700 text-indigo-300'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
            title="Toggle Security Heatmap visualization"
          >
            <Activity className="w-3.5 h-3.5 text-rose-400" />
            <span>{showHeatmap ? 'Hide Heatmap' : 'Show Heatmap'}</span>
          </button>
          <button
            id="export-audit-logs-btn"
            onClick={handleExportJSON}
            disabled={logs.length === 0}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 text-xs font-medium flex items-center gap-1.5 border border-slate-700 transition-colors"
            title="Download full forensic log in JSON format"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isExporting ? 'Exporting...' : 'Export JSON'}</span>
          </button>
          <button
            id="clear-audit-logs-btn"
            onClick={onClearLogs}
            disabled={logs.length === 0}
            className="px-2.5 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900/80 disabled:opacity-40 text-rose-300 text-xs font-medium flex items-center gap-1.5 border border-rose-900 transition-colors"
            title="Clear all recorded events"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Log</span>
          </button>
        </div>
      </div>

      {/* 24-Hour Security Event Velocity Sparkline */}
      {showSparkline && (
        <AuditSparkline
          logs={logs}
          onSelectHourRange={(filteredBucketLogs, label) => {
            if (label === 'All' || filteredBucketLogs.length === logs.length) {
              setSelectedBucketLogs(null);
              setTimeFilterLabel(null);
            } else {
              setSelectedBucketLogs(filteredBucketLogs);
              setTimeFilterLabel(label);
            }
          }}
        />
      )}

      {/* Security Heatmap Visualization */}
      {showHeatmap && (
        <SecurityHeatmap
          logs={logs}
          onSelectTimeBucket={(bucketLogs) => {
            if (bucketLogs.length > 0) {
              setSelectedBucketLogs(bucketLogs);
              setTimeFilterLabel('Heatmap Window');
            }
          }}
        />
      )}

      {selectedBucketLogs && (
        <div className="p-2.5 rounded-xl bg-sky-950/40 border border-sky-800/80 flex items-center justify-between text-xs text-sky-200">
          <div className="flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-sky-400" />
            <span>
              Filtered to <strong>{timeFilterLabel || 'selected time window'}</strong> (<strong>{selectedBucketLogs.length} events</strong>)
            </span>
          </div>
          <button
            onClick={() => {
              setSelectedBucketLogs(null);
              setTimeFilterLabel(null);
            }}
            className="text-[11px] underline text-sky-300 hover:text-white font-medium cursor-pointer"
          >
            Clear Time Filter (Show All)
          </button>
        </div>
      )}

      {/* Mini Telemetry Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
        <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-[10px] uppercase font-semibold">
            <span>Successful Unlocks</span>
            <ShieldCheck className="w-3 h-3 text-emerald-400" />
          </div>
          <p className="text-base font-bold text-emerald-400 font-mono mt-0.5">{successCount}</p>
          <span className="text-[10px] text-slate-500">
            {logs.length > 0 ? `${Math.round((successCount / (successCount + failureCount || 1)) * 100)}% hit rate` : '0 attempts'}
          </span>
        </div>

        <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-[10px] uppercase font-semibold">
            <span>Failed Attempts</span>
            <XCircle className="w-3 h-3 text-rose-400" />
          </div>
          <p className="text-base font-bold text-rose-400 font-mono mt-0.5">{failureCount}</p>
          <span className="text-[10px] text-slate-500">Constant-time evaluated (SR-3)</span>
        </div>

        <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-[10px] uppercase font-semibold">
            <span>Biometric Hits</span>
            <Fingerprint className="w-3 h-3 text-teal-400" />
          </div>
          <p className="text-base font-bold text-teal-400 font-mono mt-0.5">{biometricCount}</p>
          <span className="text-[10px] text-slate-500">Hardware token binding</span>
        </div>

        <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-[10px] uppercase font-semibold">
            <span>Weaver Failures</span>
            <Clock className="w-3 h-3 text-amber-400" />
          </div>
          <p className="text-base font-bold text-amber-400 font-mono mt-0.5">
            {weaverFailureCount} / 30
          </p>
          <span className="text-[10px] text-slate-500">
            {isLockedOut ? 'PERMANENT LOCKOUT' : throttledRemaining > 0 ? `${Math.ceil(throttledRemaining)}s active delay` : 'Rate limit normal'}
          </span>
        </div>

        <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-slate-400 text-[10px] uppercase font-semibold">
            <span>Transitions</span>
            <ArrowRightLeft className="w-3 h-3 text-sky-400" />
          </div>
          <p className="text-base font-bold text-sky-400 font-mono mt-0.5">{transitionCount}</p>
          <span className="text-[10px] text-slate-500">Mount / Purge events</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-1">
        {/* Filter Badges */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <button
            id="audit-filter-all"
            onClick={() => setFilter('all')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors ${
              filter === 'all'
                ? 'bg-sky-600 border-sky-500 text-white shadow-sm'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            All ({logs.length})
          </button>
          <button
            id="audit-filter-success"
            onClick={() => setFilter('success')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors flex items-center gap-1 ${
              filter === 'success'
                ? 'bg-emerald-600 border-emerald-500 text-white shadow-sm'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-emerald-300'
            }`}
          >
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            Success ({successCount})
          </button>
          <button
            id="audit-filter-failure"
            onClick={() => setFilter('failure')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors flex items-center gap-1 ${
              filter === 'failure'
                ? 'bg-rose-600 border-rose-500 text-white shadow-sm'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-rose-300'
            }`}
          >
            <XCircle className="w-3 h-3 text-rose-400" />
            Failed ({failureCount})
          </button>
          <button
            id="audit-filter-biometrics"
            onClick={() => setFilter('biometrics')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors flex items-center gap-1 ${
              filter === 'biometrics'
                ? 'bg-teal-600 border-teal-500 text-white shadow-sm'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-teal-300'
            }`}
          >
            <Fingerprint className="w-3 h-3 text-teal-400" />
            Biometrics ({biometricCount})
          </button>
          <button
            id="audit-filter-transitions"
            onClick={() => setFilter('transitions')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors flex items-center gap-1 ${
              filter === 'transitions'
                ? 'bg-indigo-600 border-indigo-500 text-white shadow-sm'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-indigo-300'
            }`}
          >
            <ArrowRightLeft className="w-3 h-3 text-indigo-400" />
            Transitions ({transitionCount})
          </button>
          <button
            id="audit-filter-lockout"
            onClick={() => setFilter('lockout')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors flex items-center gap-1 ${
              filter === 'lockout'
                ? 'bg-amber-600 border-amber-500 text-white shadow-sm'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-amber-300'
            }`}
          >
            <ShieldAlert className="w-3 h-3 text-amber-400" />
            Lockout & Throttles ({lockoutCount})
          </button>
          <button
            id="audit-filter-rotation"
            onClick={() => setFilter('rotation')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors flex items-center gap-1 ${
              filter === 'rotation'
                ? 'bg-cyan-600 border-cyan-500 text-white shadow-sm'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-cyan-300'
            }`}
          >
            <Key className="w-3 h-3 text-cyan-400" />
            Key Rotations ({rotationCount})
          </button>
          <button
            id="audit-filter-tamper"
            onClick={() => setFilter('tamper')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors flex items-center gap-1 ${
              filter === 'tamper'
                ? 'bg-rose-600 border-rose-500 text-white shadow-sm'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-rose-300'
            }`}
          >
            <Flame className="w-3 h-3 text-rose-400" />
            HSM Tamper ({tamperCount})
          </button>
        </div>

        {/* Search Input */}
        <div className="relative min-w-[180px] sm:max-w-[220px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search audit log..."
            className="w-full pl-8 pr-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-sky-500 placeholder-slate-500"
          />
        </div>
      </div>

      {/* Log Feed List */}
      <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
        {filteredLogs.length === 0 ? (
          <div className="p-8 text-center bg-slate-950/60 rounded-xl border border-dashed border-slate-800 text-slate-400 text-xs space-y-1">
            <History className="w-6 h-6 text-slate-600 mx-auto mb-1.5" />
            <p className="font-medium text-slate-300">No matching audit events found</p>
            <p className="text-[11px] text-slate-500">
              {searchQuery ? 'Try clearing your search query' : 'Perform an unlock attempt or lock the device on the lock screen to record events'}
            </p>
          </div>
        ) : (
          filteredLogs.map((entry) => {
            const isExpanded = expandedLogId === entry.id;
            return (
              <div
                key={entry.id}
                className={`rounded-xl border transition-all ${
                  entry.severity === 'error'
                    ? 'bg-rose-950/20 border-rose-900/60 hover:border-rose-800'
                    : entry.severity === 'warning'
                    ? 'bg-amber-950/20 border-amber-900/60 hover:border-amber-800'
                    : entry.severity === 'success'
                    ? 'bg-emerald-950/20 border-emerald-900/60 hover:border-emerald-800'
                    : 'bg-slate-950/80 border-slate-800/90 hover:border-slate-700'
                }`}
              >
                {/* Main Log Item Header */}
                <div
                  onClick={() => setExpandedLogId(isExpanded ? null : entry.id)}
                  className="p-3 cursor-pointer flex items-start justify-between gap-3 select-none"
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className="mt-0.5 shrink-0">{getLogIcon(entry.type)}</div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                        <span
                          className={`text-[9px] font-mono px-1.5 py-0.2 rounded border font-semibold ${getBadgeStyle(
                            entry.type
                          )}`}
                        >
                          {getBadgeLabel(entry.type)}
                        </span>
                        {entry.isTampered && (
                          <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-rose-950 text-rose-300 border border-rose-600 font-bold animate-pulse">
                            TAMPERED MUTATION
                          </span>
                        )}
                        <h4 className="text-xs font-semibold text-white truncate">{entry.title}</h4>
                      </div>
                      <p className="text-[11px] text-slate-300 leading-snug line-clamp-2">
                        {entry.details}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end shrink-0 gap-1">
                    <span className="font-mono text-[10px] text-slate-400">
                      {entry.timeFormatted}
                    </span>
                    {entry.durationMs !== undefined && (
                      <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-1 rounded border border-emerald-900">
                        {entry.durationMs.toFixed(1)} ms
                      </span>
                    )}
                    <div className="text-slate-500 hover:text-slate-300 transition-colors">
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </div>
                  </div>
                </div>

                {/* Expanded Forensic Detail Drawer */}
                {isExpanded && (
                  <div className="px-3.5 pb-3.5 pt-2 border-t border-slate-800/80 bg-slate-950/90 rounded-b-xl space-y-2 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                      <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 space-y-0.5">
                        <span className="text-slate-500 font-mono text-[10px] uppercase">Input Candidate:</span>
                        <p className="text-slate-200 font-mono font-semibold">{entry.pinMasked}</p>
                      </div>

                      <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 space-y-0.5">
                        <span className="text-slate-500 font-mono text-[10px] uppercase">ISO Timestamp:</span>
                        <p className="text-slate-300 font-mono text-[10px] truncate">{entry.timestamp}</p>
                      </div>

                      {entry.slotIndex !== undefined && entry.slotIndex !== null && (
                        <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 space-y-0.5">
                          <span className="text-slate-500 font-mono text-[10px] uppercase">Unsealed Slot Index:</span>
                          <p className="text-sky-300 font-mono">
                            Slot #{entry.slotIndex + 1} (Evaluated 4/4 slots constant-time)
                          </p>
                        </div>
                      )}

                      {entry.weaverFailures !== undefined && (
                        <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 space-y-0.5">
                          <span className="text-slate-500 font-mono text-[10px] uppercase">Weaver Counter State:</span>
                          <p className="text-amber-300 font-mono">
                            {entry.weaverFailures} failed attempts recorded
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Hash Chain Cryptographic Linkage */}
                    {(entry.entryHash || entry.prevHash) && (
                      <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1 font-mono text-[10px]">
                        <span className="text-slate-400 font-semibold uppercase flex items-center gap-1">
                          <Link className="w-3 h-3 text-cyan-400" />
                          Cryptographic Hash Chain Block
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-slate-400">
                          <div className="truncate">
                            <span className="text-slate-500">prevHash: </span>
                            <span className="text-indigo-300">{entry.prevHash || 'GENESIS'}</span>
                          </div>
                          <div className="truncate">
                            <span className="text-slate-500">entryHash: </span>
                            <span className={entry.isTampered ? 'text-rose-400 font-bold' : 'text-cyan-300'}>
                              {entry.entryHash || 'SEAL_PENDING'}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {entry.memoryState && (
                      <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                        <span className="text-slate-400 font-semibold text-[10px] uppercase flex items-center gap-1">
                          <Cpu className="w-3 h-3 text-sky-400" />
                          Volatile Memory / RAM Disposition (SR-2)
                        </span>
                        <p className="text-[11px] text-slate-300 leading-relaxed font-mono">
                          {entry.memoryState}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
