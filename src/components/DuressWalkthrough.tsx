import React, { useState } from 'react';
import {
  Shield,
  ShieldAlert,
  ArrowRight,
  RotateCcw,
  CheckCircle2,
  Lock,
  Unlock,
  Eye,
  AlertTriangle,
  UserCheck,
  Search,
  HardDrive,
  Cpu,
  Layers,
} from 'lucide-react';
import { MlsuKeyStore } from '../crypto/mlsuEngine';

interface DuressWalkthroughProps {
  engine: MlsuKeyStore;
}

export const DuressWalkthrough: React.FC<DuressWalkthroughProps> = ({ engine }) => {
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [enteredPin, setEnteredPin] = useState<string>('');
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simResult, setSimResult] = useState<string | null>(null);

  const steps = [
    {
      title: 'Phase 1: Checkpoint Demand Under Coercion',
      adversary: 'Border Guard / Coercive Examiner (Adversary Class A3)',
      description:
        'A traveler carrying confidential investigative reports arrives at a border checkpoint. An officer demands the smartphone PIN for physical inspection.',
      actionPrompt: 'The owner enters the Duress PIN instead of their Private PIN.',
      suggestedPin: '220561',
      pinType: 'Duress / Restricted Area PIN',
    },
    {
      title: 'Phase 2: On-Device Inspection (Observer View)',
      adversary: 'Inspection in Progress',
      description:
        'The device unlocks seamlessly into Profile 2. The officer reviews photo albums (Munich holiday photos), notes (vacation itinerary), and contacts (hotel reception).',
      actionPrompt:
        'Because the area looks completely plausible and populated (Concept §8.1), no suspicion of a secondary hidden container is raised.',
      suggestedPin: null,
      pinType: null,
    },
    {
      title: 'Phase 3: Cryptographic State Audit',
      adversary: 'What Forensic Probes See in RAM',
      description:
        'Because each profile derives its class keys independently with Argon2id and ChaCha20-Poly1305:',
      points: [
        'Profile 1 CE encryption key exists nowhere in volatile memory (SR-2).',
        'Storage file size is identical whether 1 or 4 profiles are enrolled (SR-8).',
        'Constant-time slot derivation ensures unlocking Profile 2 took the exact same time as Profile 1 would have (SR-3, SR-9).',
      ],
      actionPrompt: 'The examiner returns the device, satisfied that inspection is complete.',
      suggestedPin: null,
      pinType: null,
    },
    {
      title: 'Phase 4: Return to Privacy Without Trace',
      adversary: 'Owner is Safe',
      description:
        'Once in a secure location, the owner locks the device and enters the Private Space PIN.',
      actionPrompt: 'Entering 471903 unlocks the private workspace without menu toggles or visible transitions (Concept §8.2).',
      suggestedPin: '471903',
      pinType: 'Private Space PIN',
    },
  ];

  const handleSimulatePin = async (pin: string) => {
    setIsSimulating(true);
    setEnteredPin(pin);
    const outcome = await engine.unlock(pin);
    if (outcome.found && outcome.profileId === 2) {
      setSimResult('Unremarkable Restricted Travel Area opened. Private Space stays encrypted in cold storage.');
    } else if (outcome.found && outcome.profileId === 1) {
      setSimResult('Confidential Private Space opened. CE Key mounted in memory.');
    } else {
      setSimResult('No profile matched.');
    }
    setIsSimulating(false);
  };

  const handleReset = () => {
    setCurrentStep(0);
    setEnteredPin('');
    setSimResult(null);
  };

  const activeStep = steps[currentStep];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 shadow-xl space-y-2">
        <div className="flex items-center gap-2 text-sky-400 text-xs font-semibold uppercase tracking-wider">
          <ShieldAlert className="w-4 h-4 text-sky-400" />
          Interactive Scenario Simulation
        </div>
        <h2 className="text-xl font-bold text-white tracking-tight">
          Border Checkpoint & Coercive Duress Walkthrough
        </h2>
        <p className="text-xs text-slate-300 max-w-3xl leading-relaxed">
          Walk through the core situation from the MLSU concept paper and <code className="text-sky-300 font-mono">simulate_duress.py</code>: Entering the decoy PIN under duress opens an unremarkable profile, and returning to the private area occurs via the identical lock screen with zero visible traces.
        </p>
      </div>

      {/* Progress Steps */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        {steps.map((step, idx) => (
          <button
            key={idx}
            onClick={() => setCurrentStep(idx)}
            className={`p-3.5 rounded-xl text-left border transition-all ${
              currentStep === idx
                ? 'bg-sky-950/60 border-sky-600 text-white shadow-md'
                : idx < currentStep
                ? 'bg-slate-900/90 border-slate-700 text-slate-300'
                : 'bg-slate-900/40 border-slate-800 text-slate-500 hover:text-slate-400'
            }`}
          >
            <div className="flex items-center justify-between text-[11px] font-semibold mb-1">
              <span>Step {idx + 1}</span>
              {idx < currentStep ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <span className="w-2 h-2 rounded-full bg-slate-700" />
              )}
            </div>
            <p className="text-xs font-medium truncate">{step.title.split(':')[1] || step.title}</p>
          </button>
        ))}
      </div>

      {/* Main Step Detail Card */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-4">
          <div>
            <span className="text-xs font-semibold text-sky-400 uppercase tracking-wider">
              {activeStep.adversary}
            </span>
            <h3 className="text-lg font-bold text-white mt-0.5">{activeStep.title}</h3>
          </div>
          <span className="text-xs px-3 py-1 rounded-full bg-slate-800 text-slate-300 font-mono w-fit">
            Phase {currentStep + 1} of 4
          </span>
        </div>

        <p className="text-sm text-slate-200 leading-relaxed">{activeStep.description}</p>

        {activeStep.points && (
          <div className="space-y-2 p-4 rounded-xl bg-slate-950 border border-slate-800">
            <h4 className="text-xs font-semibold text-sky-400 flex items-center gap-1.5">
              <Cpu className="w-4 h-4" />
              Architectural Guarantees Verified:
            </h4>
            <ul className="space-y-1.5 text-xs text-slate-300">
              {activeStep.points.map((pt, i) => (
                <li key={i} className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                  <span>{pt}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-2">
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              {activeStep.actionPrompt}
            </span>
          </div>

          {activeStep.suggestedPin && (
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                onClick={() => handleSimulatePin(activeStep.suggestedPin!)}
                disabled={isSimulating}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-500 active:bg-sky-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-md transition-colors"
              >
                <Unlock className="w-3.5 h-3.5" />
                Submit PIN ({activeStep.suggestedPin})
              </button>
              <span className="text-xs text-slate-400 font-mono">
                {activeStep.pinType}
              </span>
            </div>
          )}

          {simResult && (
            <div className="p-3 rounded-lg bg-emerald-950/60 border border-emerald-800/80 text-emerald-300 text-xs flex items-center gap-2 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{simResult}</span>
            </div>
          )}
        </div>

        {/* Navigation buttons */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800">
          <button
            onClick={handleReset}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1.5 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Restart Walkthrough
          </button>

          <div className="flex items-center gap-2">
            {currentStep > 0 && (
              <button
                onClick={() => {
                  setCurrentStep((p) => p - 1);
                  setSimResult(null);
                }}
                className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
              >
                Previous
              </button>
            )}
            {currentStep < steps.length - 1 ? (
              <button
                onClick={() => {
                  setCurrentStep((p) => p + 1);
                  setSimResult(null);
                }}
                className="px-4 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md transition-colors"
              >
                Next Step
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={handleReset}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md transition-colors"
              >
                Completed — Restart
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
