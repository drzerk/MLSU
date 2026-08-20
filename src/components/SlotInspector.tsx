import React, { useState } from 'react';
import {
  Layers,
  Shield,
  Key,
  Database,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  AlertTriangle,
  Info,
  Clock,
  RotateCcw,
  CheckCircle2,
  FileCode,
  RefreshCw,
  Cpu,
  Sparkles,
  ShieldCheck,
  History,
  Zap,
} from 'lucide-react';
import { MlsuKeyStore } from '../crypto/mlsuEngine';
import { MasterKeyRotationModal } from './MasterKeyRotationModal';
import { AuditLogEntry } from '../types';

interface SlotInspectorProps {
  engine: MlsuKeyStore;
  onStoreUpdated: () => void;
  onAddAuditLog?: (entry: Omit<AuditLogEntry, 'id' | 'timestamp' | 'timeFormatted'>) => void;
}

export const SlotInspector: React.FC<SlotInspectorProps> = ({
  engine,
  onStoreUpdated,
  onAddAuditLog,
}) => {
  const [showRawHex, setShowRawHex] = useState<boolean>(false);
  const [isRotationModalOpen, setIsRotationModalOpen] = useState<boolean>(false);
  const state = engine.getState();

  const masterSeedFingerprint = engine.getMasterSeedFingerprint();
  const masterSeedHex = engine.getMasterSeedHex();

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sky-400 text-xs font-semibold uppercase tracking-wider">
            <Layers className="w-4 h-4 text-sky-400" />
            Storage & Cryptographic Audit
          </div>
          <div className="flex items-center gap-2">
            <button
              id="open-master-key-rotation-btn"
              onClick={() => setIsRotationModalOpen(true)}
              className="text-xs text-white bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 flex items-center gap-1.5 px-3 py-1.5 rounded-lg shadow-md shadow-cyan-600/20 font-medium transition-all cursor-pointer"
            >
              <Key className="w-3.5 h-3.5 text-cyan-200" />
              <span>Rotate Master Key</span>
            </button>
            <button
              onClick={() => setShowRawHex(!showRawHex)}
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 transition-colors"
            >
              {showRawHex ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              {showRawHex ? 'Mask Raw Hex' : 'Reveal Raw Hex'}
            </button>
          </div>
        </div>
        <h2 className="text-xl font-bold text-white tracking-tight">
          Fixed KeyStore Slots & Weaver Rate Limiting
        </h2>
        <p className="text-xs text-slate-300 max-w-3xl leading-relaxed">
          In MLSU, storage always holds a fixed number of slots (<code className="text-sky-300 font-mono">SLOT_COUNT = 4</code>). Unoccupied slots contain indistinguishable random bytes (decoys). Unlocking always computes derivations for every slot in sequence (SR-8, SR-9) to prevent observable leakage.
        </p>
      </div>

      {/* Master Key Lifecycle & Hardware Enclave Card */}
      <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-cyan-900/60 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-cyan-950 text-cyan-400 border border-cyan-800 flex items-center justify-center shadow-inner">
              <Key className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white tracking-tight">
                  Master Key & Cryptographic Lifecycle
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800 font-semibold">
                  SR-8 Re-Keying Capable
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Hardware-bound 256-bit Root Seed unseals and re-wraps Class Keys during maintenance rotations
              </p>
            </div>
          </div>

          <button
            id="trigger-rekeying-flow-btn"
            onClick={() => setIsRotationModalOpen(true)}
            className="px-3.5 py-1.5 rounded-xl bg-cyan-950/80 hover:bg-cyan-900/90 text-cyan-300 text-xs font-semibold flex items-center gap-1.5 border border-cyan-700/80 transition-colors shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
            <span>Launch Re-Keying Wizard</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800/80 space-y-1">
            <div className="flex items-center justify-between text-[10px] text-slate-400 uppercase font-semibold">
              <span>Root Master Fingerprint</span>
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <p className="text-sm font-bold text-cyan-300 font-mono">{masterSeedFingerprint}</p>
            <p className="text-[10px] text-slate-500 font-mono truncate">
              {showRawHex ? masterSeedHex : `${masterSeedHex.substring(0, 16)}••••••••`}
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800/80 space-y-1">
            <div className="flex items-center justify-between text-[10px] text-slate-400 uppercase font-semibold">
              <span>Wrapping Architecture</span>
              <Cpu className="w-3.5 h-3.5 text-indigo-400" />
            </div>
            <p className="text-sm font-bold text-slate-200 font-mono">Argon2id + AEAD</p>
            <p className="text-[10px] text-slate-500">ChaCha20-Poly1305 payload encryption</p>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800/80 space-y-1">
            <div className="flex items-center justify-between text-[10px] text-slate-400 uppercase font-semibold">
              <span>Enclave Security</span>
              <Lock className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <p className="text-sm font-bold text-emerald-400 font-mono">StrongBox Isolated</p>
            <p className="text-[10px] text-slate-500">Constant-time all 4 slots (SR-8)</p>
          </div>
        </div>
      </div>

      {/* Global Store Info */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
          <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Total Capacity</span>
          <p className="text-lg font-bold text-white font-mono">{state.slotCount} Slots</p>
          <span className="text-[10px] text-slate-500">Fixed binary layout (SR-8)</span>
        </div>
        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
          <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Enrolled Profiles</span>
          <p className="text-lg font-bold text-sky-400 font-mono">
            {state.slots.filter((s) => s.isEnrolled).length} active
          </p>
          <span className="text-[10px] text-slate-500">
            {state.slots.filter((s) => !s.isEnrolled).length} decoy slots
          </span>
        </div>
        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
          <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">KDF Configuration</span>
          <p className="text-lg font-bold text-emerald-400 font-mono capitalize">{state.kdf.name}</p>
          <span className="text-[10px] text-slate-500">Argon2id (m={state.kdf.memoryCostKiB / 1024}MB, t={state.kdf.timeCost})</span>
        </div>
        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
          <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Weaver Lockout</span>
          <p className={`text-lg font-bold font-mono ${state.anyLockedOut ? 'text-rose-400' : 'text-slate-300'}`}>
            {state.anyLockedOut ? 'LOCKED OUT' : state.throttledRemaining > 0 ? `Throttled (${Math.ceil(state.throttledRemaining)}s)` : 'Clear (0s delay)'}
          </p>
          <span className="text-[10px] text-slate-500">Hardware rate limiter model</span>
        </div>
      </div>

      {/* 4 Slots Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Database className="w-4 h-4 text-sky-400" />
            Slot Table & Cryptographic Parameters
          </h3>
          <span className="text-xs text-slate-400">
            Click <strong className="text-cyan-300">Rotate Master Key</strong> above to re-encrypt all slots with fresh salts
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {state.slots.map((slot) => (
            <div
              key={slot.index}
              className={`p-5 rounded-2xl border transition-all ${
                slot.isEnrolled
                  ? 'bg-slate-900/90 border-slate-700 shadow-lg'
                  : 'bg-slate-950/60 border-slate-800/80 shadow'
              }`}
            >
              {/* Slot Header */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-slate-800 text-slate-200 text-xs font-mono font-bold flex items-center justify-center">
                    {slot.index + 1}
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                      Slot {slot.index + 1}
                      {slot.isEnrolled ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800 font-normal">
                          Profile {slot.profileId}
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-normal">
                          Decoy Slot
                        </span>
                      )}
                    </h4>
                  </div>
                </div>

                {/* Status Badge */}
                <div className="flex items-center gap-1 text-[11px]">
                  {slot.lockedOut ? (
                    <span className="text-rose-400 font-semibold">Locked Out</span>
                  ) : slot.delaySeconds > 0 ? (
                    <span className="text-amber-400 font-semibold">{slot.delaySeconds}s delay</span>
                  ) : (
                    <span className="text-emerald-400 font-medium">Ready</span>
                  )}
                </div>
              </div>

              {/* Cryptographic components */}
              <div className="space-y-2 text-xs">
                <div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mb-0.5">
                    <span>Salt (16 bytes):</span>
                    <span className="font-mono text-slate-500">Argon2 Salt</span>
                  </div>
                  <p className="font-mono text-[11px] text-slate-300 bg-slate-950 p-1.5 rounded border border-slate-800 truncate">
                    {showRawHex ? slot.salt : slot.salt.substring(0, 16) + '••••••••'}
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mb-0.5">
                    <span>Nonce / IV (12 bytes):</span>
                    <span className="font-mono text-slate-500">ChaCha20 IV</span>
                  </div>
                  <p className="font-mono text-[11px] text-slate-300 bg-slate-950 p-1.5 rounded border border-slate-800 truncate">
                    {showRawHex ? slot.nonce : slot.nonce.substring(0, 12) + '••••••••'}
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mb-0.5">
                    <span>AEAD Ciphertext Blob (49 bytes):</span>
                    <span className="font-mono text-slate-500">Payload + Poly1305 Tag</span>
                  </div>
                  <p className="font-mono text-[11px] text-slate-300 bg-slate-950 p-1.5 rounded border border-slate-800 truncate">
                    {showRawHex ? slot.blob : slot.blob.substring(0, 24) + '••••••••'}
                  </p>
                </div>

                {/* Weaver Failure Counters */}
                <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Weaver Failed Attempts:</span>
                  <span className="font-mono font-semibold text-slate-200">
                    {slot.failures} / 30 failures
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Deviation & Tradeoff Explanation (SR-8) */}
      <div className="p-5 rounded-2xl bg-amber-950/20 border border-amber-900/60 text-xs space-y-2">
        <div className="flex items-center gap-2 font-semibold text-amber-300">
          <Info className="w-4 h-4 text-amber-400" />
          <span>Documented Tradeoff: The State Byte & Indistinguishability (SR-8)</span>
        </div>
        <p className="text-slate-300 leading-relaxed">
          The reference store file utilizes a 1-byte status header per slot to track free vs occupied slots across restarts. An examiner with raw file access can count enrolled profiles from this bookkeeping byte. A production AOSP release keeps this state metadata exclusively inside the already-unlocked Private Space storage (P0 Findings §F-4).
        </p>
      </div>

      {/* Master Key Rotation Interactive Modal */}
      <MasterKeyRotationModal
        isOpen={isRotationModalOpen}
        onClose={() => setIsRotationModalOpen(false)}
        engine={engine}
        onStoreUpdated={onStoreUpdated}
        onAddAuditLog={onAddAuditLog}
      />
    </div>
  );
};
