import React, { useState, useEffect } from 'react';
import {
  Fingerprint,
  ScanFace,
  ShieldCheck,
  ShieldAlert,
  X,
  CheckCircle2,
  XCircle,
  Sparkles,
  Lock,
  Cpu,
  RefreshCw,
  Eye,
} from 'lucide-react';
import { BiometricSensorType, BiometricFingerprint } from '../types';

interface BiometricScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  sensorType: BiometricSensorType;
  targetProfileName: string;
  targetProfileId: number;
  onSuccess: () => void;
  onFail: (reason: string) => void;
}

export const BiometricScannerModal: React.FC<BiometricScannerModalProps> = ({
  isOpen,
  onClose,
  sensorType,
  targetProfileName,
  targetProfileId,
  onSuccess,
  onFail,
}) => {
  const [scanState, setScanState] = useState<'idle' | 'scanning' | 'success' | 'failed'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setScanState('idle');
      setErrorMessage(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSimulateScan = (shouldSucceed: boolean) => {
    if (scanState === 'scanning') return;
    setScanState('scanning');
    setErrorMessage(null);

    setTimeout(() => {
      if (shouldSucceed) {
        setScanState('success');
        setTimeout(() => {
          onSuccess();
        }, 700);
      } else {
        setScanState('failed');
        setErrorMessage('Biometric template mismatch. Fingerprint not recognized.');
        onFail('Biometric template mismatch');
      }
    }, 1100);
  };

  return (
    <div className="absolute inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex flex-col justify-end p-4 text-slate-100 rounded-[36px] animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl p-5 shadow-2xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-teal-950 border border-teal-800 text-teal-400 flex items-center justify-center">
              {sensorType === 'fingerprint' ? (
                <Fingerprint className="w-5 h-5" />
              ) : (
                <ScanFace className="w-5 h-5" />
              )}
            </div>
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                {sensorType === 'fingerprint' ? 'Biometric 2FA Sensor' : 'Face Unlock Verification'}
              </h3>
              <p className="text-[11px] text-slate-400">Class 3 Hardware Biometric Prompt</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Verification Target Info */}
        <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
          <div>
            <span className="text-[10px] text-slate-500 font-mono uppercase">Target Profile</span>
            <p className="font-semibold text-sky-400">{targetProfileName}</p>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-950 text-sky-300 border border-sky-800">
            Profile #{targetProfileId}
          </span>
        </div>

        {/* Interactive Sensor Target */}
        <div className="flex flex-col items-center py-2 space-y-3">
          <div
            onClick={() => handleSimulateScan(true)}
            className={`w-20 h-20 rounded-full border-2 flex items-center justify-center cursor-pointer transition-all duration-300 relative select-none ${
              scanState === 'scanning'
                ? 'border-teal-400 bg-teal-950/40 shadow-lg shadow-teal-500/20 scale-105 animate-pulse'
                : scanState === 'success'
                ? 'border-emerald-400 bg-emerald-950/60 shadow-lg shadow-emerald-500/30 scale-105'
                : scanState === 'failed'
                ? 'border-rose-500 bg-rose-950/60 shadow-lg shadow-rose-500/30 animate-shake'
                : 'border-slate-700 hover:border-teal-500/60 bg-slate-950 hover:bg-slate-950/80 active:scale-95'
            }`}
          >
            {/* Pulsing scanning rings */}
            {scanState === 'scanning' && (
              <div className="absolute inset-0 rounded-full border-2 border-teal-400/50 animate-ping" />
            )}

            {scanState === 'success' ? (
              <CheckCircle2 className="w-10 h-10 text-emerald-400 animate-in zoom-in-50" />
            ) : scanState === 'failed' ? (
              <XCircle className="w-10 h-10 text-rose-400 animate-in zoom-in-50" />
            ) : sensorType === 'fingerprint' ? (
              <Fingerprint
                className={`w-10 h-10 ${
                  scanState === 'scanning' ? 'text-teal-300' : 'text-slate-400 hover:text-teal-400'
                } transition-colors`}
              />
            ) : (
              <ScanFace
                className={`w-10 h-10 ${
                  scanState === 'scanning' ? 'text-teal-300' : 'text-slate-400 hover:text-teal-400'
                } transition-colors`}
              />
            )}
          </div>

          <div className="text-center space-y-0.5">
            <p className="text-xs font-medium text-slate-200">
              {scanState === 'idle' && 'Tap sensor to verify identity'}
              {scanState === 'scanning' && 'Verifying biometric signature in Secure Enclave...'}
              {scanState === 'success' && 'Biometrics verified! Unsealing CE Key...'}
              {scanState === 'failed' && (errorMessage || 'Verification failed')}
            </p>
            <p className="text-[10px] text-slate-500">
              {sensorType === 'fingerprint'
                ? 'Qualcomm 3D Sonic Gen-2 Ultrasonic Matrix'
                : '3D Structured Light Infrared Projector'}
            </p>
          </div>
        </div>

        {/* Quick Simulation Action Buttons */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            id="biometric-simulate-pass"
            disabled={scanState === 'scanning'}
            onClick={() => handleSimulateScan(true)}
            className="py-2 px-3 rounded-xl bg-teal-600 hover:bg-teal-500 active:bg-teal-700 disabled:opacity-40 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-md transition-colors"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Simulate Match</span>
          </button>
          <button
            id="biometric-simulate-fail"
            disabled={scanState === 'scanning'}
            onClick={() => handleSimulateScan(false)}
            className="py-2 px-3 rounded-xl bg-rose-950 hover:bg-rose-900 active:bg-rose-800 disabled:opacity-40 text-rose-300 border border-rose-800 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
          >
            <XCircle className="w-3.5 h-3.5" />
            <span>Simulate Reject</span>
          </button>
        </div>

        {/* Fallback Cancel Option */}
        <button
          onClick={onClose}
          className="w-full py-1.5 text-center text-xs text-slate-400 hover:text-slate-200 transition-colors"
        >
          Cancel and Return to PIN Entry
        </button>
      </div>
    </div>
  );
};
