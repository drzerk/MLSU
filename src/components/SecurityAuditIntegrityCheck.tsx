import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  RefreshCw,
  Flame,
  CheckCircle2,
  XCircle,
  Link,
  Lock,
  Unlock,
  Layers,
  Database,
  ArrowRight,
  Sparkles,
  Info,
  Clock,
  Key,
  Terminal,
  Activity,
  FileCode,
  FileCheck,
  Trash2,
  PlusCircle,
  Edit3,
} from 'lucide-react';
import { AuditLogEntry, AuditChainVerificationResult } from '../types';
import {
  sealAuditChain,
  verifyAuditLogChain,
  GENESIS_PREV_HASH,
} from '../crypto/auditIntegrity';

interface SecurityAuditIntegrityCheckProps {
  logs: AuditLogEntry[];
  onUpdateLogs: (newLogs: AuditLogEntry[]) => void;
  onAddAuditLog?: (entry: Omit<AuditLogEntry, 'id' | 'timestamp' | 'timeFormatted'>) => void;
}

export const SecurityAuditIntegrityCheck: React.FC<SecurityAuditIntegrityCheckProps> = ({
  logs,
  onUpdateLogs,
  onAddAuditLog,
}) => {
  const [verificationResult, setVerificationResult] = useState<AuditChainVerificationResult | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [shadowLedgerBackup, setShadowLedgerBackup] = useState<AuditLogEntry[]>([]);
  const [lastTamperAction, setLastTamperAction] = useState<string | null>(null);
  const [selectedChainNodeId, setSelectedChainNodeId] = useState<string | null>(null);

  // Initialize and seal chain on first load if entries lack hashes
  useEffect(() => {
    const initChain = async () => {
      if (logs.length > 0 && !logs.some((l) => l.entryHash)) {
        const sealed = await sealAuditChain(logs);
        onUpdateLogs(sealed);
        setShadowLedgerBackup(JSON.parse(JSON.stringify(sealed)));
        const res = await verifyAuditLogChain(sealed);
        setVerificationResult(res);
      } else if (logs.length > 0) {
        // Run verification
        const res = await verifyAuditLogChain(logs);
        setVerificationResult(res);
        if (res.isValid && shadowLedgerBackup.length === 0) {
          setShadowLedgerBackup(JSON.parse(JSON.stringify(logs)));
        }
      }
    };
    initChain();
  }, [logs.length]);

  // Run on-demand cryptographic verification scan
  const handleRunVerification = async () => {
    setIsScanning(true);
    setTimeout(async () => {
      const res = await verifyAuditLogChain(logs);
      setVerificationResult(res);
      setIsScanning(false);

      if (onAddAuditLog) {
        if (res.isValid) {
          onAddAuditLog({
            type: 'audit_integrity_verified',
            title: 'Audit Log Ledger Verified (SHA-256 Chain Intact)',
            details: `Cryptographic verification scan passed. All ${res.totalEntriesChecked} log records match forward-secure hash chain with StrongBox root ${res.rootLedgerHash.substring(0, 16)}...`,
            pinMasked: 'SYSTEM_VERIFIER',
            slotIndex: null,
            weaverFailures: 0,
            memoryState: 'Ledger integrity 100%. No unauthorized record modifications detected.',
            severity: 'success',
          });
        } else {
          onAddAuditLog({
            type: 'audit_tamper_detected',
            title: 'CRITICAL: Audit Log Tampering Detected!',
            details: `Cryptographic integrity verification FAILED! ${res.details}. Tamper anomaly type: ${res.tamperType}.`,
            pinMasked: 'ANOMALY_ALARM',
            slotIndex: null,
            weaverFailures: 0,
            memoryState: 'Security integrity alarm raised. Chain link broken at Entry #' + ((res.brokenEntryIndex ?? 0) + 1),
            severity: 'error',
          });
        }
      }
    }, 450);
  };

  // Tamper Attack 1: Modify a log's payload (e.g. change a failed attack into a benign success)
  const handleTamperPayload = async () => {
    if (logs.length === 0) return;
    const cloned: AuditLogEntry[] = JSON.parse(JSON.stringify(logs));
    
    // Find an auth_failure or pick the second entry
    const targetIdx = cloned.findIndex((l) => l.type === 'auth_failure' || l.type === 'weaver_throttle') !== -1
      ? cloned.findIndex((l) => l.type === 'auth_failure' || l.type === 'weaver_throttle')
      : Math.min(1, cloned.length - 1);

    const target = cloned[targetIdx];
    target.title = 'Authentic Admin Authorization (FORGED)';
    target.details = 'Attacker altered this failure record to appear as a legitimate authorized administrator login.';
    target.severity = 'success';
    target.isTampered = true;

    setLastTamperAction(`Tampered Entry #${targetIdx + 1} ("${target.title}") by altering its payload without re-signing.`);
    onUpdateLogs(cloned);

    // Run verification immediately
    const res = await verifyAuditLogChain(cloned);
    setVerificationResult(res);
  };

  // Tamper Attack 2: Silently delete a security record from history
  const handleTamperDelete = async () => {
    if (logs.length <= 1) return;
    const cloned: AuditLogEntry[] = JSON.parse(JSON.stringify(logs));
    const removed = cloned.splice(Math.floor(cloned.length / 2), 1)[0];

    setLastTamperAction(`Silently erased historical record "${removed.title}" to cover intrusion footprints.`);
    onUpdateLogs(cloned);

    const res = await verifyAuditLogChain(cloned);
    setVerificationResult(res);
  };

  // Tamper Attack 3: Backdate timestamp to create a false alibi
  const handleTamperTimestamp = async () => {
    if (logs.length === 0) return;
    const cloned: AuditLogEntry[] = JSON.parse(JSON.stringify(logs));
    const target = cloned[0]; // newest
    target.timestamp = new Date(Date.now() - 86400000 * 30).toISOString(); // 30 days ago
    target.timeFormatted = '00:00:00.000 (FORGED_PAST)';
    target.isTampered = true;

    setLastTamperAction(`Backdated timestamp of Entry #1 by 30 days to forge a historical sequence alibi.`);
    onUpdateLogs(cloned);

    const res = await verifyAuditLogChain(cloned);
    setVerificationResult(res);
  };

  // Tamper Attack 4: Inject a fabricated fake log entry
  const handleTamperInject = async () => {
    const forgedEntry: AuditLogEntry = {
      id: `forged-${Date.now()}`,
      timestamp: new Date().toISOString(),
      timeFormatted: new Date().toLocaleTimeString() + '.000',
      type: 'auth_success',
      title: 'Fabricated Superuser Bypass (INJECTED)',
      details: 'Unauthorized actor injected this synthetic record without the hardware StrongBox signature key.',
      pinMasked: '•••••• (999999)',
      profileId: 1,
      profileName: 'Private Space',
      severity: 'success',
      entryHash: 'deadbeefcafebabe0000111122223333444455556666777788889999aaaabbbb',
      prevHash: 'ffffffffffffffff0000000000000000ffffffffffffffff0000000000000000',
      isTampered: true,
    };

    const cloned = [forgedEntry, ...logs];
    setLastTamperAction(`Injected fabricated entry "${forgedEntry.title}" into the audit ledger.`);
    onUpdateLogs(cloned);

    const res = await verifyAuditLogChain(cloned);
    setVerificationResult(res);
  };

  // Auto-Heal: Restore from immutable StrongBox Enclave backup
  const handleRestoreBackup = async () => {
    if (shadowLedgerBackup.length > 0) {
      onUpdateLogs(shadowLedgerBackup);
      const res = await verifyAuditLogChain(shadowLedgerBackup);
      setVerificationResult(res);
      setLastTamperAction('Hardware StrongBox shadow ledger restored. All hash chain signatures re-verified 100%.');

      if (onAddAuditLog) {
        onAddAuditLog({
          type: 'audit_ledger_healed',
          title: 'Audit Ledger Restored from StrongBox Enclave',
          details: 'Corrupted audit chain discarded. Successfully synchronized authentic immutable log ledger from StrongBox tamper-proof enclave.',
          pinMasked: 'ENCLAVE_RECOVERY',
          profileId: null,
          weaverFailures: 0,
          memoryState: 'Cryptographic ledger restored to 100% genuine state.',
          severity: 'info',
        });
      }
    } else {
      // Re-seal existing logs cleanly
      const resealed = await sealAuditChain(logs.map((l) => ({ ...l, isTampered: false })));
      onUpdateLogs(resealed);
      setShadowLedgerBackup(JSON.parse(JSON.stringify(resealed)));
      const res = await verifyAuditLogChain(resealed);
      setVerificationResult(res);
      setLastTamperAction('Re-computed genuine SHA-256 hash chain and anchored new root seal.');
    }
  };

  const isChainValid = verificationResult?.isValid ?? true;

  return (
    <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
      {/* Header & Verification Trigger */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div
            className={`p-2 rounded-xl border ${
              isChainValid
                ? 'bg-emerald-950/80 border-emerald-800 text-emerald-400'
                : 'bg-rose-950/90 border-rose-700 text-rose-400 animate-pulse'
            }`}
          >
            {isChainValid ? <ShieldCheck className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white tracking-tight">
                Security Audit Integrity & Cryptographic Chain Verifier
              </h3>
              <span
                className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                  isChainValid
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                    : 'bg-rose-950 text-rose-300 border-rose-800 animate-pulse'
                }`}
              >
                {isChainValid ? 'LEDGER VERIFIED (SHA-256)' : 'TAMPER DETECTED!'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Each audit entry is linked via a forward-secure SHA-256 hash chain anchored in StrongBox hardware.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="run-integrity-scan-btn"
            onClick={handleRunVerification}
            disabled={isScanning}
            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-sky-600/20 transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
            <span>{isScanning ? 'Verifying Hash Chain...' : 'Verify Cryptographic Chain'}</span>
          </button>
        </div>
      </div>

      {/* Real-time Status Card & Root Hash */}
      <div
        className={`p-4 rounded-xl border transition-all ${
          isChainValid
            ? 'bg-slate-950 border-slate-800 text-slate-300'
            : 'bg-rose-950/40 border-rose-800/90 text-rose-200 shadow-lg shadow-rose-950/50'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="space-y-1">
            <div className="flex items-center gap-2 font-mono font-bold">
              {isChainValid ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <XCircle className="w-4 h-4 text-rose-400 animate-bounce" />
              )}
              <span className={isChainValid ? 'text-emerald-300' : 'text-rose-300 text-sm'}>
                {isChainValid
                  ? `All ${verificationResult?.totalEntriesChecked ?? logs.length} Records Authenticated & Intact`
                  : `Integrity Anomaly: ${verificationResult?.details}`}
              </span>
            </div>
            <div className="text-[11px] text-slate-400 flex items-center gap-2">
              <span>Root Ledger Anchor:</span>
              <span className="font-mono text-cyan-300 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                {verificationResult?.rootLedgerHash
                  ? `${verificationResult.rootLedgerHash.substring(0, 24)}...`
                  : 'SHA256_STRONG_BOX_ROOT'}
              </span>
            </div>
          </div>

          {!isChainValid && (
            <button
              id="heal-audit-ledger-btn"
              onClick={handleRestoreBackup}
              className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-1.5 self-start sm:self-auto cursor-pointer transition-colors shadow-md"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Restore from Enclave Backup</span>
            </button>
          )}
        </div>
      </div>

      {/* Interactive Tamper Attack Simulation Controls */}
      <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-amber-400" />
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              Simulate Unauthorized Audit Tampering
            </h4>
          </div>
          <span className="text-[10px] font-mono text-slate-400">
            Test if the system catches malicious log manipulation
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
          {/* Attack 1 */}
          <button
            id="tamper-payload-btn"
            type="button"
            onClick={handleTamperPayload}
            className="p-2.5 rounded-xl bg-slate-900 hover:bg-rose-950/50 border border-slate-800 hover:border-rose-700 text-left transition-all group cursor-pointer"
          >
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200 group-hover:text-rose-300">
              <Edit3 className="w-3.5 h-3.5 text-rose-400" />
              <span>1. Alter Payload</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-1 leading-snug">
              Forge a failed intrusion into a legitimate admin login.
            </div>
          </button>

          {/* Attack 2 */}
          <button
            id="tamper-delete-btn"
            type="button"
            onClick={handleTamperDelete}
            className="p-2.5 rounded-xl bg-slate-900 hover:bg-rose-950/50 border border-slate-800 hover:border-rose-700 text-left transition-all group cursor-pointer"
          >
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200 group-hover:text-rose-300">
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>2. Erase Record</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-1 leading-snug">
              Silently delete a security event to destroy evidence.
            </div>
          </button>

          {/* Attack 3 */}
          <button
            id="tamper-timestamp-btn"
            type="button"
            onClick={handleTamperTimestamp}
            className="p-2.5 rounded-xl bg-slate-900 hover:bg-amber-950/50 border border-slate-800 hover:border-amber-700 text-left transition-all group cursor-pointer"
          >
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200 group-hover:text-amber-300">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>3. Backdate Time</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-1 leading-snug">
              Alter event timestamp to forge a false timeline alibi.
            </div>
          </button>

          {/* Attack 4 */}
          <button
            id="tamper-inject-btn"
            type="button"
            onClick={handleTamperInject}
            className="p-2.5 rounded-xl bg-slate-900 hover:bg-purple-950/50 border border-slate-800 hover:border-purple-700 text-left transition-all group cursor-pointer"
          >
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200 group-hover:text-purple-300">
              <PlusCircle className="w-3.5 h-3.5 text-purple-400" />
              <span>4. Inject Record</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-1 leading-snug">
              Insert an un-signed fake permission elevation event.
            </div>
          </button>
        </div>

        {lastTamperAction && (
          <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-amber-300 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>{lastTamperAction}</span>
            </div>
            <button
              onClick={handleRestoreBackup}
              className="text-[10px] underline text-cyan-300 hover:text-white cursor-pointer ml-2"
            >
              Reset to Clean
            </button>
          </div>
        )}
      </div>

      {/* Cryptographic Hash-Chain Visualizer (Block-by-Block Links) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="font-semibold text-white flex items-center gap-1.5">
            <Link className="w-3.5 h-3.5 text-sky-400" />
            Sequential Hash Chain Ledger ({verificationResult?.chainVerificationDetails.length ?? logs.length} Blocks)
          </span>
          <span className="text-[10px] font-mono text-slate-500">
            Genesis: 0x00..00 ➔ Head Block
          </span>
        </div>

        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
          {verificationResult?.chainVerificationDetails && verificationResult.chainVerificationDetails.length > 0 ? (
            verificationResult.chainVerificationDetails.map((node) => (
              <div
                key={node.id}
                onClick={() => setSelectedChainNodeId(selectedChainNodeId === node.id ? null : node.id)}
                className={`p-3 rounded-xl border text-xs transition-all cursor-pointer ${
                  node.isValid
                    ? 'bg-slate-950 border-slate-800 hover:border-slate-700'
                    : 'bg-rose-950/70 border-rose-600 shadow-md shadow-rose-950/40 ring-1 ring-rose-500 animate-pulse'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">
                      Block #{node.index}
                    </span>
                    <span className={`font-semibold ${node.isValid ? 'text-slate-200' : 'text-rose-200 font-bold'}`}>
                      {node.title}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                        node.isValid
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : 'bg-rose-900 text-rose-100 border border-rose-600'
                      }`}
                    >
                      {node.isValid ? 'CHAIN LINK VALID' : 'BROKEN SEAL'}
                    </span>
                  </div>
                </div>

                {/* Hash Preview */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 font-mono text-[10px] text-slate-400">
                  <div className="bg-slate-900 p-1.5 rounded border border-slate-800 truncate">
                    <span className="text-slate-500 mr-1">prevHash:</span>
                    <span className="text-indigo-300">{node.prevHash.substring(0, 20)}...</span>
                  </div>
                  <div className="bg-slate-900 p-1.5 rounded border border-slate-800 truncate">
                    <span className="text-slate-500 mr-1">entryHash:</span>
                    <span className={node.isValid ? 'text-cyan-300' : 'text-rose-400 font-bold'}>
                      {node.storedHash ? `${node.storedHash.substring(0, 20)}...` : 'UNCOMPUTED'}
                    </span>
                  </div>
                </div>

                {/* Tamper diagnostic details */}
                {!node.isValid && node.errorReason && (
                  <div className="mt-2 p-2 rounded-lg bg-rose-950 border border-rose-700 text-rose-200 text-[11px] flex items-start gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <span>{node.errorReason}</span>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-center text-slate-500 text-xs">
              No sealed audit log entries to display. Perform authentication actions or click "Verify Cryptographic Chain".
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
