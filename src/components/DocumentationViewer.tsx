import React, { useState } from 'react';
import {
  BookOpen,
  Shield,
  Layers,
  AlertTriangle,
  FileCheck,
  Cpu,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  Globe,
} from 'lucide-react';
import { THREAT_LEVELS, COMPARISON_MATRIX, REQUIREMENTS, FINDINGS } from '../data/documents';

export const DocumentationViewer: React.FC = () => {
  const [activeSection, setActiveSection] = useState<'matrix' | 'threats' | 'requirements' | 'findings' | 'concept'>('matrix');
  const [lang, setLang] = useState<'en' | 'de'>('en');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sky-400 text-xs font-semibold uppercase tracking-wider">
            <BookOpen className="w-4 h-4 text-sky-400" />
            MLSU Specifications & Research Papers
          </div>
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
            <button
              onClick={() => setLang('en')}
              className={`px-2.5 py-0.5 rounded ${lang === 'en' ? 'bg-sky-600 text-white font-medium' : 'text-slate-400 hover:text-white'}`}
            >
              English
            </button>
            <button
              onClick={() => setLang('de')}
              className={`px-2.5 py-0.5 rounded ${lang === 'de' ? 'bg-sky-600 text-white font-medium' : 'text-slate-400 hover:text-white'}`}
            >
              Deutsch
            </button>
          </div>
        </div>
        <h2 className="text-xl font-bold text-white tracking-tight">
          Concept Paper, Threat Model & P0 Requirements
        </h2>
        <p className="text-xs text-slate-300 max-w-3xl leading-relaxed">
          Explore the cryptographic architecture, threat model comparison, open research findings, and acceptance criteria defined in the MLSU specification documents.
        </p>
      </div>

      {/* Navigation tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setActiveSection('matrix')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            activeSection === 'matrix'
              ? 'bg-sky-600 text-white shadow-md'
              : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-slate-800'
          }`}
        >
          Comparison Matrix
        </button>
        <button
          onClick={() => setActiveSection('threats')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            activeSection === 'threats'
              ? 'bg-sky-600 text-white shadow-md'
              : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-slate-800'
          }`}
        >
          Threat Model (A1–A6)
        </button>
        <button
          onClick={() => setActiveSection('requirements')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            activeSection === 'requirements'
              ? 'bg-sky-600 text-white shadow-md'
              : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-slate-800'
          }`}
        >
          Security Requirements (SR-1..9)
        </button>
        <button
          onClick={() => setActiveSection('findings')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            activeSection === 'findings'
              ? 'bg-sky-600 text-white shadow-md'
              : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-slate-800'
          }`}
        >
          Research Findings (F-1..5)
        </button>
        <button
          onClick={() => setActiveSection('concept')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            activeSection === 'concept'
              ? 'bg-sky-600 text-white shadow-md'
              : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-slate-800'
          }`}
        >
          Executive Summary
        </button>
      </div>

      {/* Matrix Tab */}
      {activeSection === 'matrix' && (
        <div className="space-y-4">
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl overflow-x-auto">
            <h3 className="text-sm font-bold text-white mb-3">
              State of the Art Privacy Solutions vs. MLSU
            </h3>
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2.5 px-3">System / Solution</th>
                  <th className="py-2.5 px-3">What it Provides</th>
                  <th className="py-2.5 px-3">Where it Stops / Limits</th>
                  <th className="py-2.5 px-3 text-center">Deniable?</th>
                  <th className="py-2.5 px-3 text-center">Non-Destructive?</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {COMPARISON_MATRIX.map((item, i) => (
                  <tr key={i} className={item.solution.startsWith('MLSU') ? 'bg-sky-950/40 text-sky-200 font-medium' : 'text-slate-300'}>
                    <td className="py-3 px-3 font-semibold text-white whitespace-nowrap">{item.solution}</td>
                    <td className="py-3 px-3">{item.provides}</td>
                    <td className="py-3 px-3 text-slate-400">{item.stops}</td>
                    <td className="py-3 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${item.isDeniable ? 'bg-emerald-950 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
                        {item.isDeniable ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${item.isDestructive ? 'bg-rose-950 text-rose-400' : 'bg-emerald-950 text-emerald-400'}`}>
                        {item.isDestructive ? 'Destructive (Wipe)' : 'Preserves Data'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Threats Tab */}
      {activeSection === 'threats' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {THREAT_LEVELS.map((threat) => (
            <div key={threat.id} className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2.5 shadow-lg">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-sky-400 px-2 py-0.5 rounded bg-slate-950 border border-slate-800">
                    {threat.id}
                  </span>
                  <h4 className="text-xs font-bold text-white">{threat.adversary}</h4>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${threat.badgeColor}`}>
                  {threat.badge}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Adversary Capabilities:</span>
                <p className="text-xs text-slate-300 mt-0.5">{threat.capabilities}</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Protection Provided:</span>
                <p className="text-xs text-slate-200 mt-0.5 font-medium">{threat.protection}</p>
              </div>
              <p className="text-[11px] text-slate-400 italic bg-slate-950/80 p-2 rounded-lg border border-slate-800/80">
                {threat.notes}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Requirements Tab */}
      {activeSection === 'requirements' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {REQUIREMENTS.map((req) => (
            <div key={req.id} className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2 shadow-lg">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="font-mono text-xs font-bold text-sky-400">{req.id}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 font-semibold">
                  {req.status}
                </span>
              </div>
              <h4 className="text-xs font-bold text-white">{req.title}</h4>
              <p className="text-xs text-slate-300 leading-relaxed">{req.description}</p>
              <span className="inline-block text-[10px] text-slate-500 font-mono">
                Category: {req.category}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Findings Tab */}
      {activeSection === 'findings' && (
        <div className="space-y-4">
          {FINDINGS.map((finding) => (
            <div key={finding.id} className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2 shadow-lg">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-amber-400 px-2 py-0.5 rounded bg-slate-950 border border-slate-800">
                  {finding.id}
                </span>
                <h4 className="text-xs font-bold text-white">{finding.title}</h4>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">{finding.summary}</p>
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-sky-300">
                <strong>Architectural Implication:</strong> {finding.implication}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Concept Summary Tab */}
      {activeSection === 'concept' && (
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 text-xs text-slate-300 leading-relaxed">
          <h3 className="text-sm font-bold text-white">Concept Paper Executive Summary</h3>
          <p>
            Current smartphones effectively know only one protection state: locked or unlocked. Whoever knows the PIN gains access to messages, photos, private keys, health data, and session tokens.
          </p>
          <p>
            MLSU solves this by separating areas cryptographically so that <strong>the PIN you enter decides which encrypted data area is unlocked</strong>. Crucially, the keys of areas that were not unlocked do not exist in memory after unlocking, and the user interface gives no indication that they exist at all.
          </p>
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 font-mono text-[11px] text-slate-200">
            PIN_i ──► Argon2id(PIN_i, salt_i) ──► pin_key_i ──► AEAD unwrap ──► profile_key_i (CE Class Key)
          </div>
          <p>
            The project distinguishes between <strong>Compartmentalization</strong> (technically sound and achieved) and <strong>Plausible Deniability</strong> (achievable against manual inspection A2/A3, but limited against flash memory wear-leveling forensics A4/A5).
          </p>
        </div>
      )}
    </div>
  );
};
