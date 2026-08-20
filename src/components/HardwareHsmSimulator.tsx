import React, { useState } from 'react';
import {
  Cpu,
  Shield,
  ShieldAlert,
  Zap,
  AlertTriangle,
  Flame,
  Radio,
  Lock,
  Unlock,
  RefreshCw,
  Binary,
  Layers,
  Database,
  ArrowRight,
  Sparkles,
  Smartphone,
  Info,
  CheckCircle2,
  Trash2,
  Sliders,
  Activity,
  Terminal,
  FileCode,
} from 'lucide-react';
import { MlsuKeyStore } from '../crypto/mlsuEngine';
import { AuditLogEntry } from '../types';

interface HardwareHsmSimulatorProps {
  engine: MlsuKeyStore;
  onStoreUpdated: () => void;
  onNavigateToPhone?: () => void;
  onAddAuditLog?: (entry: Omit<AuditLogEntry, 'id' | 'timestamp' | 'timeFormatted'>) => void;
}

export const HardwareHsmSimulator: React.FC<HardwareHsmSimulatorProps> = ({
  engine,
  onStoreUpdated,
  onNavigateToPhone,
  onAddAuditLog,
}) => {
  const [selectedSlot, setSelectedSlot] = useState<number>(0);
  const [targetSector, setTargetSector] = useState<'salt' | 'nonce' | 'blob' | 'tag'>('tag');
  const [tamperMode, setTamperMode] = useState<'flip_bits' | 'zero_fill' | 'random_noise' | 'truncate'>('flip_bits');
  const [lastActionStatus, setLastActionStatus] = useState<string | null>(null);
  const [tamperHistory, setTamperHistory] = useState<
    Array<{ id: string; timestamp: string; text: string; type: 'tamper' | 'glitch' | 'wipe' | 'reset' }>
  >([]);

  const state = engine.getState();
  const activeSlot = state.slots[selectedSlot];

  const logTamper = (text: string, type: 'tamper' | 'glitch' | 'wipe' | 'reset') => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    setTamperHistory((prev) => [{ id: Math.random().toString(), timestamp: time, text, type }, ...prev.slice(0, 15)]);
  };

  const handleTamperSector = () => {
    const res = engine.tamperSlotSector(selectedSlot, targetSector, tamperMode);
    if (res.ok) {
      setLastActionStatus(res.message);
      logTamper(res.message, 'tamper');
      onStoreUpdated();

      if (onAddAuditLog) {
        onAddAuditLog({
          type: 'hsm_sector_corrupted',
          title: `Hardware Sector Tampered (Slot ${selectedSlot + 1})`,
          details: `Targeted sector ${targetSector.toUpperCase()} corrupted via ${tamperMode}. ${res.diffSummary}. Next authentication will fail AEAD/Poly1305 MAC integrity verification.`,
          pinMasked: 'PHYSICAL_TAMPER',
          slotIndex: selectedSlot,
          profileId: activeSlot?.profileId || null,
          profileName: activeSlot?.isEnrolled ? `Profile ${activeSlot.profileId}` : 'Decoy Slot',
          memoryState: 'Flash memory sector modified. Poly1305 MAC tag mismatch expected on unseal.',
          severity: 'error',
        });
      }
    }
  };

  const handleSimulateVoltageGlitch = () => {
    const res = engine.simulateVoltageGlitchLockout();
    setLastActionStatus(`Voltage fault glitch injected! Weaver hardware sensor tripped — all ${res.lockedSlots.length} slots locked out (30/30 failures).`);
    logTamper('Voltage glitch tripped Weaver tamper mesh. Emergency hardware lockout activated.', 'glitch');
    onStoreUpdated();

    if (onAddAuditLog) {
      onAddAuditLog({
        type: 'hsm_tamper_detected',
        title: 'Hardware Fault Glitch Detected (Tamper Mesh Tripped)',
        details: 'Under-voltage / fault injection pulse detected by StrongBox power monitor. Weaver rate-limiter immediately escalated all 4 slots to permanent 30/30 hardware lockout.',
        pinMasked: 'FAULT_INJECTION_VCC',
        slotIndex: null,
        weaverFailures: 30,
        memoryState: 'StrongBox hardware lockout engaged. Lock screen reactive barrier activated.',
        severity: 'error',
      });
    }
  };

  const handlePanicWipe = () => {
    const res = engine.simulateHardwarePanicWipe();
    setLastActionStatus(`Zeroize Panic Wipe executed! Root master seed regenerated and all ${res.wipedSlots} slots overwritten with fresh CSPRNG noise.`);
    logTamper('Tamper sensor triggered Panic Wipe. All profile keys zeroized from storage.', 'wipe');
    onStoreUpdated();

    if (onAddAuditLog) {
      onAddAuditLog({
        type: 'hsm_panic_wipe',
        title: 'Hardware Panic Wipe Executed (Anti-Forensic Zeroization)',
        details: `Hardware enclosure breach detected. Zeroized ${res.zeroizedBytes} bytes of active slot keys. Re-randomized storage to 4 uniform decoy slots (SR-8).`,
        pinMasked: 'CHIP_DECAPPING_SENSOR',
        profileId: null,
        slotIndex: null,
        weaverFailures: 0,
        memoryState: 'Zeroized storage. Device reset to initial un-enrolled state.',
        severity: 'warning',
      });
    }
  };

  const handleResetCounters = () => {
    engine.resetFailureCounters();
    setLastActionStatus('Hardware Weaver failure counters reset to 0/30. Lockout cleared.');
    logTamper('Hardware security engineer reset Weaver failure registers.', 'reset');
    onStoreUpdated();

    if (onAddAuditLog) {
      onAddAuditLog({
        type: 'counter_reset',
        title: 'Weaver Hardware Rate-Limiter Reset',
        details: 'Engineering override reset all slot failure counters from lockout to 0/30. Lock screen ready for authentication.',
        pinMasked: 'DEBUG_CLEAR_JTAG',
        profileId: null,
        weaverFailures: 0,
        memoryState: 'Rate limit cleared. Ready for standard user PIN authentication.',
        severity: 'info',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/40 border border-slate-800 shadow-xl space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-rose-400 text-xs font-semibold uppercase tracking-wider">
            <Cpu className="w-4 h-4 text-rose-400 animate-pulse" />
            Hardware Security Module (HSM) & Fault Injection Lab
          </div>

          <div className="flex items-center gap-2">
            {onNavigateToPhone && (
              <button
                id="view-reactive-phone-btn"
                onClick={onNavigateToPhone}
                className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-sky-600/20 transition-all cursor-pointer"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Test in Phone Simulator</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <h2 className="text-xl font-bold text-white tracking-tight">
          Physical Tamper, Bit-Flip & Reactive Lock Simulation
        </h2>
        <p className="text-xs text-slate-300 max-w-3xl leading-relaxed">
          Simulate real-world hardware attacks: corrupt specific flash storage sectors (AEAD tag, Nonce IV, Salt, or Ciphertext) or inject voltage glitches to observe how the <strong className="text-sky-300 font-mono">Weaver Hardware Rate-Limiter</strong> and Phone Lock Screen react defensively.
        </p>
      </div>

      {/* Main Grid: Hardware Controls & Live Storage Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Attack / Tamper Control Panel (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Sector Corruptor Card */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-rose-400" />
                <h3 className="text-sm font-bold text-white">1. Direct Sector Tampering & Bit-Flip</h3>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-950/80 text-rose-300 border border-rose-800">
                Flash Storage Layer
              </span>
            </div>

            {/* Target Slot Selection */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span>Select Target Keystore Slot:</span>
                <span className="text-[11px] text-slate-400 font-mono">
                  {activeSlot?.isEnrolled ? `Profile ${activeSlot.profileId} Active` : 'Decoy Slot'}
                </span>
              </label>
              <div className="grid grid-cols-4 gap-2">
                {state.slots.map((s, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedSlot(idx)}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      selectedSlot === idx
                        ? 'bg-rose-950/60 border-rose-500 text-white shadow-md'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold">Slot {idx + 1}</span>
                      {s.lockedOut && <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5 truncate">
                      {s.isEnrolled ? `Prof ${s.profileId}` : 'Decoy'}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Target Field / Sector */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300">
                Select Storage Field to Corrupt:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'tag', label: 'Poly1305 Tag', desc: 'Auth MAC (16B)' },
                  { id: 'nonce', label: 'Nonce IV', desc: 'ChaCha20 (12B)' },
                  { id: 'salt', label: 'Argon2 Salt', desc: 'KDF Salt (16B)' },
                  { id: 'blob', label: 'Ciphertext', desc: 'Class Key (33B)' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTargetSector(item.id as any)}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      targetSector === item.id
                        ? 'bg-indigo-950/70 border-indigo-500 text-white shadow-sm'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-300'
                    }`}
                  >
                    <div className="text-xs font-bold text-slate-200">{item.label}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">{item.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Tamper Method */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300">
                Corruption Method / Fault Injection:
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'flip_bits', label: 'Bit Flip (XOR 0x55)', desc: 'Simulate cosmic ray or laser injection' },
                  { id: 'zero_fill', label: 'Zero-Fill Sector', desc: 'Simulate flash NAND erase fault' },
                  { id: 'random_noise', label: 'Random Noise', desc: 'Simulate overwriting with garbage bytes' },
                  { id: 'truncate', label: 'Sector Truncation', desc: 'Simulate unaligned torn write' },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setTamperMode(m.id as any)}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      tamperMode === m.id
                        ? 'bg-sky-950/60 border-sky-500 text-white shadow-sm'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-300'
                    }`}
                  >
                    <div className="text-xs font-bold text-slate-200">{m.label}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">{m.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Execute Tamper Button */}
            <div className="pt-2 flex items-center justify-between border-t border-slate-800">
              <p className="text-[11px] text-slate-400">
                Corrupting an enrolled slot will cause AEAD authentication failure during PIN unlock.
              </p>
              <button
                id="execute-tamper-btn"
                onClick={handleTamperSector}
                className="px-4 py-2 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 rounded-xl text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-rose-600/20 transition-all cursor-pointer"
              >
                <Flame className="w-3.5 h-3.5" />
                <span>Corrupt Sector</span>
              </button>
            </div>
          </div>

          {/* Extreme Hardware Attack Simulations */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white">2. Hardware-Level Faults & Anti-Tamper Responses</h3>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-800">
                Weaver / StrongBox Tier
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Voltage Glitch Fault */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 flex flex-col justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                    <Zap className="w-4 h-4 text-amber-400" />
                    <span>Voltage Glitch / EM Pulse</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Inject a fault pulse into the power rail. The hardware tamper sensor trips and triggers permanent <strong>30/30 Weaver Lockout</strong> across all slots.
                  </p>
                </div>
                <button
                  id="simulate-voltage-glitch-btn"
                  onClick={handleSimulateVoltageGlitch}
                  className="w-full mt-2 py-2 px-3 bg-amber-600/20 hover:bg-amber-600/30 border border-amber-600 text-amber-300 hover:text-white rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Inject Voltage Glitch</span>
                </button>
              </div>

              {/* Hardware Panic Wipe */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 flex flex-col justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-rose-400">
                    <Trash2 className="w-4 h-4 text-rose-400" />
                    <span>Enclosure Breach Panic Wipe</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Simulate chip decapping sensor trip. The HSM instantly zeroizes all master keys and overwrites slots with decoy noise (SR-8 Anti-Forensic).
                  </p>
                </div>
                <button
                  id="simulate-panic-wipe-btn"
                  onClick={handlePanicWipe}
                  className="w-full mt-2 py-2 px-3 bg-rose-600/20 hover:bg-rose-600/30 border border-rose-600 text-rose-300 hover:text-white rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Trigger Panic Wipe</span>
                </button>
              </div>
            </div>

            {/* Engineer Override Reset */}
            <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">
                Unlock or recover simulator after intentional fault tests:
              </span>
              <button
                id="reset-weaver-counters-btn"
                onClick={handleResetCounters}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 border border-slate-700 transition-colors"
              >
                <RefreshCw className="w-3 h-3 text-emerald-400" />
                <span>Reset Weaver Lockout (0/30)</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Live Telemetry, Sector Diffs & Reactive Behavior (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          {/* Reactive Phone Lockout Status */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Smartphone className="w-4 h-4 text-sky-400" />
                Reactive Lock Screen Status
              </h3>
              <span
                className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                  state.anyLockedOut
                    ? 'bg-rose-950 text-rose-400 border border-rose-800 animate-pulse'
                    : state.throttledRemaining > 0
                    ? 'bg-amber-950 text-amber-300 border border-amber-800'
                    : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                }`}
              >
                {state.anyLockedOut
                  ? 'DEVICE LOCKED OUT'
                  : state.throttledRemaining > 0
                  ? `THROTTLED (${Math.ceil(state.throttledRemaining)}s)`
                  : 'READY FOR PIN'}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-2">
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-slate-400">Target Slot {selectedSlot + 1} Failures:</span>
                <span className="font-mono font-bold text-white">
                  {activeSlot?.failures || 0} / 30
                </span>
              </div>
              <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    (activeSlot?.failures || 0) >= 30
                      ? 'bg-rose-500'
                      : (activeSlot?.failures || 0) >= 10
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(100, (((activeSlot?.failures || 0) / 30) * 100))}%` }}
                />
              </div>

              <div className="flex justify-between text-[10px] text-slate-500 font-mono pt-1">
                <span>0-4: 0s delay</span>
                <span>5-9: 30s delay</span>
                <span>10-19: 300s</span>
                <span>30: Lockout</span>
              </div>
            </div>

            {lastActionStatus && (
              <div className="p-3 rounded-xl bg-indigo-950/40 border border-indigo-800/80 text-indigo-200 text-xs flex items-start gap-2">
                <Activity className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <span className="text-[11px] leading-relaxed">{lastActionStatus}</span>
              </div>
            )}
          </div>

          {/* Raw Slot Sector Hex Preview */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-cyan-400" />
                Slot {selectedSlot + 1} Live Flash Memory Sectors
              </h3>
              <span className="text-[10px] font-mono text-slate-500">
                {activeSlot?.isEnrolled ? 'Enrolled' : 'Decoy'}
              </span>
            </div>

            <div className="space-y-2 text-xs font-mono">
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 space-y-1">
                <div className="flex justify-between text-[10px] text-slate-400 uppercase">
                  <span>1. Salt Sector (16B):</span>
                  <span className="text-slate-500">0x00..0x0F</span>
                </div>
                <div className="text-cyan-300 text-[11px] truncate">{activeSlot?.salt || '0000'}</div>
              </div>

              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 space-y-1">
                <div className="flex justify-between text-[10px] text-slate-400 uppercase">
                  <span>2. Nonce IV Sector (12B):</span>
                  <span className="text-slate-500">0x10..0x1B</span>
                </div>
                <div className="text-indigo-300 text-[11px] truncate">{activeSlot?.nonce || '0000'}</div>
              </div>

              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 space-y-1">
                <div className="flex justify-between text-[10px] text-slate-400 uppercase">
                  <span>3. AEAD Ciphertext Payload (49B):</span>
                  <span className="text-slate-500">0x1C..0x4C</span>
                </div>
                <div className="text-emerald-300 text-[11px] truncate">{activeSlot?.blob || '0000'}</div>
              </div>
            </div>
          </div>

          {/* Live Fault Event Telemetry Log */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-amber-400" />
                HSM Event Log
              </h3>
              <span className="text-[10px] text-slate-500 font-mono">
                {tamperHistory.length} events logged
              </span>
            </div>

            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {tamperHistory.length === 0 ? (
                <div className="text-center py-6 text-slate-600 text-xs italic">
                  No tamper events injected yet. Select a sector above and corrupt it.
                </div>
              ) : (
                tamperHistory.map((item) => (
                  <div
                    key={item.id}
                    className="p-2 rounded-lg bg-slate-950 border border-slate-800/80 text-[11px] flex items-start gap-2"
                  >
                    <span className="font-mono text-slate-500 text-[10px] shrink-0 mt-0.5">
                      {item.timestamp}
                    </span>
                    <span
                      className={`text-[11px] leading-tight ${
                        item.type === 'tamper'
                          ? 'text-rose-300'
                          : item.type === 'glitch'
                          ? 'text-amber-300'
                          : item.type === 'wipe'
                          ? 'text-purple-300'
                          : 'text-emerald-300'
                      }`}
                    >
                      {item.text}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
