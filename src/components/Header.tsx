import React from 'react';
import {
  Shield,
  Smartphone,
  Layers,
  Terminal,
  Timer,
  BookOpen,
  ShieldAlert,
  Lock,
  Cpu,
} from 'lucide-react';
import { ViewTab } from '../types';

interface HeaderProps {
  currentTab: ViewTab;
  onTabChange: (tab: ViewTab) => void;
  anyLockedOut: boolean;
  throttledRemaining: number;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onTabChange,
  anyLockedOut,
  throttledRemaining,
}) => {
  const tabs: Array<{ id: ViewTab; label: string; icon: React.ReactNode }> = [
    { id: 'phone', label: 'Lock Screen Simulator', icon: <Smartphone className="w-4 h-4" /> },
    { id: 'scenario', label: 'Duress Walkthrough', icon: <ShieldAlert className="w-4 h-4" /> },
    { id: 'inspector', label: 'Slot & Weaver Inspector', icon: <Layers className="w-4 h-4" /> },
    { id: 'hsm', label: 'Hardware HSM & Tamper', icon: <Cpu className="w-4 h-4" /> },
    { id: 'cli', label: 'CLI Terminal', icon: <Terminal className="w-4 h-4" /> },
    { id: 'benchmark', label: 'Timing Rig (SR-3)', icon: <Timer className="w-4 h-4" /> },
    { id: 'docs', label: 'Spec & Research', icon: <BookOpen className="w-4 h-4" /> },
  ];

  return (
    <header className="sticky top-0 z-50 bg-slate-950/90 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center shadow-md text-white">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-white tracking-tight">MLSU</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-sky-950 text-sky-300 border border-sky-800">
                  Stufe-0 PoC
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Multi-Layer Secure Unlock for AOSP / Privacy Operating Systems
              </p>
            </div>
          </div>

          {/* Right Status */}
          <div className="flex items-center gap-3">
            {anyLockedOut ? (
              <span className="text-[11px] font-mono px-2.5 py-1 rounded-lg bg-rose-950 text-rose-300 border border-rose-800 flex items-center gap-1.5 animate-pulse">
                <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                Weaver Locked Out
              </span>
            ) : throttledRemaining > 0 ? (
              <span className="text-[11px] font-mono px-2.5 py-1 rounded-lg bg-amber-950 text-amber-300 border border-amber-800 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                Throttled ({Math.ceil(throttledRemaining)}s)
              </span>
            ) : (
              <span className="text-[11px] font-mono px-2.5 py-1 rounded-lg bg-emerald-950/60 text-emerald-300 border border-emerald-800/80 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                Hardware Ready
              </span>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex space-x-1 overflow-x-auto py-2 scrollbar-none">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              id={`nav-tab-${tab.id}`}
              onClick={() => onTabChange(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                currentTab === tab.id
                  ? 'bg-sky-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>
    </header>
  );
};
