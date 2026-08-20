import React, { useState, useRef, useEffect } from 'react';
import {
  Terminal,
  Play,
  RotateCcw,
  HelpCircle,
  CheckCircle2,
  Copy,
  Check,
} from 'lucide-react';
import { MlsuKeyStore } from '../crypto/mlsuEngine';

interface CliTerminalProps {
  engine: MlsuKeyStore;
  onStoreUpdated: () => void;
}

interface HistoryEntry {
  command: string;
  output: string;
  exitCode: number;
}

export const CliTerminal: React.FC<CliTerminalProps> = ({ engine, onStoreUpdated }) => {
  const [inputCommand, setInputCommand] = useState<string>('');
  const [history, setHistory] = useState<HistoryEntry[]>([
    {
      command: 'mlsu status',
      output: `Store: mlsu.store\n  Slots: 4 | KDF: Argon2id(t=1, m=8MiB, p=1)\n  Sperre: nein | Nächster Versuch: sofort`,
      exitCode: 0,
    },
  ]);
  const [copied, setCopied] = useState<boolean>(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  const executeCommand = async (cmdStr: string) => {
    const trimmed = cmdStr.trim();
    if (!trimmed) return;

    const parts = trimmed.split(/\s+/);
    const mainCmd = parts[0] === 'mlsu' || parts[0] === 'python3' || parts[0] === 'mlsu-cli' ? parts[1] || '' : parts[0];
    const args = parts[0] === 'mlsu' || parts[0] === 'python3' || parts[0] === 'mlsu-cli' ? parts.slice(2) : parts.slice(1);

    let output = '';
    let exitCode = 0;

    try {
      switch (mainCmd) {
        case 'help':
          output = `MLSU Stufe-0 CLI Emulator\n\nCommands:\n  mlsu init [--slots N] [--kdf fast|strong]\n  mlsu enroll <pin> <profile_id>\n  mlsu unlock <pin> [--show-key]\n  mlsu change-pin <old_pin> <new_pin>\n  mlsu remove <pin>\n  mlsu lock\n  mlsu status [--verbose]\n  clear`;
          break;

        case 'clear':
          setHistory([]);
          setInputCommand('');
          return;

        case 'status': {
          const verbose = args.includes('--verbose');
          const locked = engine.anyLockedOut ? 'dauerhaft' : 'nein';
          const remaining = engine.rateLimitRemaining();
          const throttleStr = remaining === Infinity ? 'dauerhaft' : remaining > 0 ? `in ${remaining.toFixed(0)} s` : 'sofort';

          output = `Store: mlsu.store\n  Slots: ${engine.slotCount} | KDF: ${engine.kdf.name.toUpperCase()}\n  Sperre: ${locked} | Nächster Versuch: ${throttleStr}`;

          if (verbose) {
            output += `\n\n  Hinweis: Diese Slot-Tabelle verrät die Profilanzahl (SR-8).\n  Ein Produkt dürfte sie nicht anzeigen — Dev-Werkzeug nur.`;
            engine.slots.forEach((s, idx) => {
              const kind = s.isEnrolled ? 'belegt' : 'decoy';
              const delay = s.delay > 0 ? `${s.delay.toFixed(0)} s` : '—';
              output += `\n  Slot ${idx + 1}: ${kind.padEnd(6)} | Fehlversuche: ${String(s.failures).padEnd(3)} | Wartezeit: ${delay}`;
            });
          }
          break;
        }

        case 'init': {
          const kdfChoice = args.includes('strong') ? 'strong' : 'fast';
          const slotsArg = args.find((a) => a.startsWith('--slots=') || !isNaN(Number(a)));
          const slotNum = slotsArg ? parseInt(slotsArg.replace('--slots=', '')) || 4 : 4;

          engine.slotCount = slotNum;
          engine.slots = Array.from({ length: slotNum }, () => {
            const s = (engine as any).constructor.createDecoy ? (engine as any).constructor.createDecoy() : new (engine.slots[0].constructor as any)();
            return s;
          });
          engine.resetFailureCounters();
          onStoreUpdated();

          output = `Neuer Store angelegt: mlsu.store\n  Slots: ${slotNum} (alle decoys), KDF: Argon2id (${kdfChoice})`;
          break;
        }

        case 'enroll': {
          if (args.length < 2) {
            output = `Fehler: Verwendung: mlsu enroll <pin> <profile_id>`;
            exitCode = 5;
            break;
          }
          const pin = args[0];
          const profileId = parseInt(args[1]);

          if (pin.length < 4) {
            output = `Fehler: PIN muss mindestens 4 Zeichen lang sein.`;
            exitCode = 5;
            break;
          }

          const slotIndex = await engine.enroll(pin, profileId);
          onStoreUpdated();
          output = `Profil ${profileId} eingerichtet (Slot ${slotIndex + 1} von ${engine.slotCount}).`;
          break;
        }

        case 'unlock': {
          if (args.length < 1) {
            output = `Fehler: Verwendung: mlsu unlock <pin> [--show-key]`;
            exitCode = 5;
            break;
          }
          const pin = args[0];
          const showKey = args.includes('--show-key');

          const outcome = await engine.unlock(pin);
          onStoreUpdated();

          if (outcome.lockedOut) {
            output = `Gesperrt: Zu viele Fehlversuche — Store dauerhaft gesperrt.`;
            exitCode = 2;
          } else if (outcome.throttledRemaining > 0) {
            output = `Gesperrt: Nächster Versuch erst in ${outcome.throttledRemaining.toFixed(0)} s.`;
            exitCode = 3;
          } else if (!outcome.found) {
            output = `Fehler: Kein Profil entspricht dieser PIN.`;
            exitCode = 1;
          } else {
            output = `Entsperrt: Profil ${outcome.profileId}.`;
            if (showKey && outcome.profileKeyHex) {
              output += `\nProfilschlüssel: ${outcome.profileKeyHex}`;
            }
          }
          break;
        }

        case 'change-pin': {
          if (args.length < 2) {
            output = `Fehler: Verwendung: mlsu change-pin <old_pin> <new_pin>`;
            exitCode = 5;
            break;
          }
          const oldPin = args[0];
          const newPin = args[1];

          const changed = await engine.changePin(oldPin, newPin);
          onStoreUpdated();

          if (!changed) {
            output = `Fehler: Kein Profil entspricht der aktuellen PIN oder Store gesperrt.`;
            exitCode = 1;
          } else {
            output = `PIN von Profil ${changed.profileId} geändert (Slot ${changed.slotIndex + 1} von ${engine.slotCount}).`;
          }
          break;
        }

        case 'remove': {
          if (args.length < 1) {
            output = `Fehler: Verwendung: mlsu remove <pin>`;
            exitCode = 5;
            break;
          }
          const pin = args[0];
          const removed = await engine.removeProfile(pin);
          onStoreUpdated();

          if (!removed) {
            output = `Fehler: Kein Profil entspricht dieser PIN oder Store gesperrt.`;
            exitCode = 1;
          } else {
            output = `Profil ${removed.profileId} gelöscht (Slot ${removed.slotIndex + 1} ist wieder ein decoy).`;
          }
          break;
        }

        case 'lock': {
          output = `Store gesperrt. Das Modell hält keinen Entsperr-Zustand zwischen Aufrufen — auf einem Gerät würde hier der CE-Schlüssel des aktiven Profils verworfen (SR-2).`;
          break;
        }

        default:
          output = `Unbekannter Befehl: '${mainCmd}'. Geben Sie 'help' ein für eine Übersicht aller Befehle.`;
          exitCode = 5;
      }
    } catch (err: any) {
      output = `Fehler: ${err.message || err}`;
      exitCode = 4;
    }

    setHistory((prev) => [...prev, { command: trimmed, output, exitCode }]);
    setInputCommand('');
  };

  const handlePreset = (cmd: string) => {
    setInputCommand(cmd);
    executeCommand(cmd);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2 text-white text-xs font-semibold">
          <Terminal className="w-4 h-4 text-sky-400" />
          <span>Interactive MLSU CLI Terminal (<code className="text-sky-300">mlsu-cli</code>)</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => executeCommand('clear')}
            className="text-[11px] text-slate-400 hover:text-white px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 transition-colors"
          >
            Clear Screen
          </button>
        </div>
      </div>

      {/* Quick Presets */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-slate-400 text-[11px]">Quick CLI Actions:</span>
        <button
          onClick={() => handlePreset('mlsu status --verbose')}
          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-mono border border-slate-700 transition-colors"
        >
          mlsu status --verbose
        </button>
        <button
          onClick={() => handlePreset('mlsu unlock 471903 --show-key')}
          className="px-2.5 py-1 rounded-lg bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 text-[11px] font-mono border border-indigo-800 transition-colors"
        >
          mlsu unlock 471903 --show-key
        </button>
        <button
          onClick={() => handlePreset('mlsu unlock 220561 --show-key')}
          className="px-2.5 py-1 rounded-lg bg-sky-950/80 hover:bg-sky-900 text-sky-300 text-[11px] font-mono border border-sky-800 transition-colors"
        >
          mlsu unlock 220561 --show-key
        </button>
        <button
          onClick={() => handlePreset('mlsu unlock 111111')}
          className="px-2.5 py-1 rounded-lg bg-rose-950/80 hover:bg-rose-900 text-rose-300 text-[11px] font-mono border border-rose-800 transition-colors"
        >
          mlsu unlock 111111 (Miss)
        </button>
      </div>

      {/* Terminal Window */}
      <div className="rounded-2xl bg-black border border-slate-800 shadow-2xl p-4 font-mono text-xs overflow-hidden flex flex-col h-[480px]">
        {/* Terminal Title Bar */}
        <div className="flex items-center justify-between border-b border-slate-900 pb-2 mb-3 text-slate-500 text-[11px]">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
            <span className="ml-2 text-slate-400">bash — mlsu reference environment</span>
          </div>
          <span>Exit Code 0: OK, 1: Miss, 2: Locked out, 3: Throttled</span>
        </div>

        {/* Console Log Area */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-2 select-text">
          {history.map((entry, i) => (
            <div key={i} className="space-y-1">
              <div className="flex items-center gap-2 text-sky-400">
                <span className="text-slate-500">$</span>
                <span className="text-slate-100">{entry.command}</span>
                {entry.exitCode !== 0 && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-950 text-rose-400 border border-rose-900 ml-auto">
                    exit {entry.exitCode}
                  </span>
                )}
              </div>
              <pre className="text-slate-300 whitespace-pre-wrap pl-4 border-l border-slate-800 font-mono text-[11px] leading-relaxed">
                {entry.output}
              </pre>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            executeCommand(inputCommand);
          }}
          className="flex items-center gap-2 border-t border-slate-900 pt-3 mt-2"
        >
          <span className="text-emerald-400 font-bold">$</span>
          <input
            type="text"
            value={inputCommand}
            onChange={(e) => setInputCommand(e.target.value)}
            placeholder="Type 'help' or e.g. 'mlsu unlock 471903'"
            className="flex-1 bg-transparent text-white font-mono text-xs focus:outline-none placeholder-slate-600"
          />
          <button
            type="submit"
            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs transition-colors flex items-center gap-1"
          >
            <Play className="w-3 h-3" />
            Run
          </button>
        </form>
      </div>
    </div>
  );
};
