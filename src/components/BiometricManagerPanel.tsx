import React from 'react';
import {
  Fingerprint,
  ScanFace,
  ShieldCheck,
  ShieldAlert,
  Key,
  Smartphone,
  Cpu,
  Layers,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  CheckCircle2,
  XCircle,
  ArrowRight,
  AlertTriangle,
  Lock,
} from 'lucide-react';
import { BiometricMode, BiometricSensorType, BiometricFingerprint } from '../types';

interface BiometricManagerPanelProps {
  biometricMode: BiometricMode;
  onSetBiometricMode: (mode: BiometricMode) => void;
  sensorType: BiometricSensorType;
  onSetSensorType: (sensor: BiometricSensorType) => void;
  enrolledFingers: BiometricFingerprint[];
  onTriggerBiometricUnlock: (finger: BiometricFingerprint) => void;
  onTriggerBiometricFailure: (fingerName: string) => void;
  isUnlocked: boolean;
  isLockedOut: boolean;
  throttledRemaining: number;
}

export const BiometricManagerPanel: React.FC<BiometricManagerPanelProps> = ({
  biometricMode,
  onSetBiometricMode,
  sensorType,
  onSetSensorType,
  enrolledFingers,
  onTriggerBiometricUnlock,
  onTriggerBiometricFailure,
  isUnlocked,
  isLockedOut,
  throttledRemaining,
}) => {
  return (
    <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-teal-950 text-teal-400 border border-teal-800 flex items-center justify-center">
            {sensorType === 'fingerprint' ? (
              <Fingerprint className="w-4 h-4" />
            ) : (
              <ScanFace className="w-4 h-4" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white tracking-tight">
                Biometric Security Layer
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-teal-950 text-teal-300 border border-teal-800">
                Hardware Biometric Binding
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Simulates Secure Enclave / Titan M2 biometric token unwrap & profile routing
            </p>
          </div>
        </div>

        {/* Biometric Type Selector */}
        <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 self-start sm:self-auto">
          <button
            id="sensor-type-fingerprint-btn"
            onClick={() => onSetSensorType('fingerprint')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
              sensorType === 'fingerprint'
                ? 'bg-teal-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Fingerprint className="w-3.5 h-3.5" />
            <span>Fingerprint</span>
          </button>
          <button
            id="sensor-type-face-btn"
            onClick={() => onSetSensorType('face')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
              sensorType === 'face'
                ? 'bg-teal-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ScanFace className="w-3.5 h-3.5" />
            <span>3D Face ID</span>
          </button>
        </div>
      </div>

      {/* Mode Selector Radio Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
        <div
          onClick={() => onSetBiometricMode('direct_unlock')}
          className={`p-3 rounded-xl border cursor-pointer transition-all ${
            biometricMode === 'direct_unlock'
              ? 'bg-teal-950/40 border-teal-500 text-teal-200 shadow-md'
              : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="font-semibold text-white">Multi-Fingerprint</span>
            {biometricMode === 'direct_unlock' && (
              <CheckCircle2 className="w-4 h-4 text-teal-400" />
            )}
          </div>
          <p className="text-[11px] text-slate-400 leading-snug">
            Each finger directly unseals its linked profile via hardware keystore mapping.
          </p>
        </div>

        <div
          onClick={() => onSetBiometricMode('two_factor_verification')}
          className={`p-3 rounded-xl border cursor-pointer transition-all ${
            biometricMode === 'two_factor_verification'
              ? 'bg-sky-950/40 border-sky-500 text-sky-200 shadow-md'
              : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="font-semibold text-white">2FA Verification Step</span>
            {biometricMode === 'two_factor_verification' && (
              <CheckCircle2 className="w-4 h-4 text-sky-400" />
            )}
          </div>
          <p className="text-[11px] text-slate-400 leading-snug">
            PIN entry prompts for a secondary biometric verification scan before granting access.
          </p>
        </div>

        <div
          onClick={() => onSetBiometricMode('disabled')}
          className={`p-3 rounded-xl border cursor-pointer transition-all ${
            biometricMode === 'disabled'
              ? 'bg-slate-800 border-slate-600 text-slate-200 shadow-md'
              : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="font-semibold text-white">PIN-Only Mode</span>
            {biometricMode === 'disabled' && (
              <CheckCircle2 className="w-4 h-4 text-slate-400" />
            )}
          </div>
          <p className="text-[11px] text-slate-400 leading-snug">
            Biometrics disabled. Standard uniform single-screen PIN challenge.
          </p>
        </div>
      </div>

      {/* Interactive Biometric Sensor Quick Triggers */}
      {biometricMode !== 'disabled' && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-white flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-teal-400" />
              Simulate Biometric Scan Inputs:
            </span>
            <span className="text-[10px] text-slate-400">
              {isUnlocked ? 'Device unlocked (Lock to test)' : 'Click to test hardware scan'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {enrolledFingers.map((fp) => (
              <button
                key={fp.id}
                id={`biometric-trigger-${fp.id}`}
                disabled={isUnlocked || isLockedOut || throttledRemaining > 0}
                onClick={() => onTriggerBiometricUnlock(fp)}
                className="p-2.5 rounded-xl bg-slate-950 hover:bg-slate-800/80 active:bg-slate-700 disabled:opacity-40 disabled:pointer-events-none border border-slate-800 hover:border-teal-700/60 text-left transition-all group flex flex-col justify-between"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <div
                      className={`w-5 h-5 rounded-md ${fp.sensorColor} flex items-center justify-center text-white text-[10px]`}
                    >
                      {sensorType === 'fingerprint' ? (
                        <Fingerprint className="w-3.5 h-3.5" />
                      ) : (
                        <ScanFace className="w-3.5 h-3.5" />
                      )}
                    </div>
                    <span className="font-semibold text-xs text-white group-hover:text-teal-300 transition-colors">
                      {fp.name}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-900 text-slate-400 border border-slate-800">
                    PIN {fp.pin}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
                  <span className="text-sky-400 font-medium">{fp.profileName}</span>
                  <ArrowRight className="w-3 h-3 text-slate-500 group-hover:text-teal-400 group-hover:translate-x-0.5 transition-all" />
                </div>
              </button>
            ))}

            {/* Unenrolled / Stranger Mismatch Button */}
            <button
              id="biometric-trigger-mismatch"
              disabled={isUnlocked || isLockedOut || throttledRemaining > 0}
              onClick={() => onTriggerBiometricFailure('Unenrolled Finger (Stranger/Duress)')}
              className="p-2.5 rounded-xl bg-slate-950 hover:bg-rose-950/40 active:bg-rose-900/50 disabled:opacity-40 disabled:pointer-events-none border border-slate-800 hover:border-rose-800 text-left transition-all group flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded-md bg-rose-950 border border-rose-800 text-rose-400 flex items-center justify-center text-[10px]">
                    <XCircle className="w-3.5 h-3.5" />
                  </div>
                  <span className="font-semibold text-xs text-rose-300 group-hover:text-rose-200 transition-colors">
                    Unenrolled Finger
                  </span>
                </div>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-rose-950 text-rose-300 border border-rose-900">
                  Mismatch
                </span>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
                <span className="text-rose-400">Trigger Reject</span>
                <XCircle className="w-3 h-3 text-rose-500 group-hover:scale-110 transition-transform" />
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Cryptographic Architecture Callout */}
      <div className="p-3 bg-slate-950/70 border border-slate-800/80 rounded-xl text-[11px] text-slate-400 space-y-1">
        <span className="font-semibold text-slate-300 flex items-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
          Hardware Enclave Biometric Binding Principle:
        </span>
        <p className="leading-relaxed">
          Biometric templates never store PINs in plaintext. Instead, the Secure Enclave releases an
          ephemeral hardware-bound wrapping key upon authenticating the verified template, which unseals
          the target slot without revealing the existence of remaining profiles.
        </p>
      </div>
    </div>
  );
};
