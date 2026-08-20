import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { PhoneSimulator } from './components/PhoneSimulator';
import { DuressWalkthrough } from './components/DuressWalkthrough';
import { SlotInspector } from './components/SlotInspector';
import { HardwareHsmSimulator } from './components/HardwareHsmSimulator';
import { CliTerminal } from './components/CliTerminal';
import { BenchmarkRig } from './components/BenchmarkRig';
import { DocumentationViewer } from './components/DocumentationViewer';
import { MlsuKeyStore, KDF_FAST } from './crypto/mlsuEngine';
import { sealAuditChain, computeEntryHash, GENESIS_PREV_HASH } from './crypto/auditIntegrity';
import { ViewTab, AuditLogEntry } from './types';

export function App() {
  const [currentTab, setCurrentTab] = useState<ViewTab>('phone');
  const [tick, setTick] = useState<number>(0);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([
    {
      id: 'log-boot-1',
      timestamp: new Date(Date.now() - 60000).toISOString(),
      timeFormatted: new Date(Date.now() - 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) + '.104',
      type: 'profile_enroll',
      title: 'Profile 1 Enrolled (Private Space)',
      details: 'Enrolled confidential private workspace in Slot 1. CE key sealed with Argon2id + AEAD.',
      pinMasked: '•••••• (471903)',
      profileId: 1,
      profileName: 'Private Space',
      slotIndex: 0,
      weaverFailures: 0,
      memoryState: 'Cold storage unmounted. No keys in volatile RAM.',
      severity: 'info',
    },
    {
      id: 'log-boot-2',
      timestamp: new Date(Date.now() - 45000).toISOString(),
      timeFormatted: new Date(Date.now() - 45000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) + '.582',
      type: 'profile_enroll',
      title: 'Profile 2 Enrolled (Restricted Travel)',
      details: 'Enrolled decoy travel profile in Slot 2. Storage file size remains constant 4 slots (SR-8).',
      pinMasked: '•••••• (220561)',
      profileId: 2,
      profileName: 'Restricted Travel',
      slotIndex: 1,
      weaverFailures: 0,
      memoryState: 'Cold storage unmounted. Decoy slots filled with uniform random noise.',
      severity: 'info',
    },
    {
      id: 'log-boot-3',
      timestamp: new Date(Date.now() - 30000).toISOString(),
      timeFormatted: new Date(Date.now() - 30000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) + '.912',
      type: 'device_lock',
      title: 'System Boot Completed & Locked',
      details: 'MLSU KeyStore initialized with 4 fixed slots. Lock screen armed for multi-profile authentication.',
      pinMasked: 'N/A',
      profileId: null,
      weaverFailures: 0,
      memoryState: 'RAM clear. Device awaiting single-PIN challenge.',
      severity: 'info',
    },
  ]);

  // Ensure initial logs are sealed with SHA-256 hash chain on startup
  useEffect(() => {
    sealAuditChain(auditLogs).then((sealed) => {
      setAuditLogs(sealed);
    });
  }, []);

  const addAuditLog = (entry: Omit<AuditLogEntry, 'id' | 'timestamp' | 'timeFormatted' | 'entryHash' | 'prevHash'>) => {
    const now = new Date();
    const formatted =
      now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) +
      '.' +
      String(now.getMilliseconds()).padStart(3, '0');

    setAuditLogs((prev) => {
      // The newest log in list is at index 0
      const prevHash = prev.length > 0 && prev[0].entryHash ? prev[0].entryHash : GENESIS_PREV_HASH;
      const newEntryId = `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const newEntryWithoutHash: Omit<AuditLogEntry, 'entryHash'> = {
        ...entry,
        id: newEntryId,
        timestamp: now.toISOString(),
        timeFormatted: formatted,
        prevHash: prevHash,
      };

      // Asynchronously calculate hash and update state
      computeEntryHash(newEntryWithoutHash, prevHash).then((computedHash) => {
        setAuditLogs((currentLogs) =>
          currentLogs.map((l) => (l.id === newEntryId ? { ...l, entryHash: computedHash } : l))
        );
      });

      return [{ ...newEntryWithoutHash, entryHash: '' }, ...prev];
    });
  };

  const handleClearLogs = () => {
    setAuditLogs([]);
  };

  const engineRef = useRef<MlsuKeyStore | null>(null);

  if (!engineRef.current) {
    const store = new MlsuKeyStore(KDF_FAST, 4);
    // Initialize default profiles
    store.enroll('471903', 1); // Profile 1: Private Space
    store.enroll('220561', 2); // Profile 2: Travel / Decoy
    engineRef.current = store;
  }

  const engine = engineRef.current;

  const handleStoreUpdated = () => {
    setTick((t) => t + 1);
  };

  const throttledRemaining = engine.rateLimitRemaining();
  const anyLockedOut = engine.anyLockedOut;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans antialiased selection:bg-sky-500 selection:text-white">
      <Header
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        anyLockedOut={anyLockedOut}
        throttledRemaining={throttledRemaining}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {currentTab === 'phone' && (
          <PhoneSimulator
            engine={engine}
            onStoreUpdated={handleStoreUpdated}
            auditLogs={auditLogs}
            onAddAuditLog={addAuditLog}
            onClearAuditLogs={handleClearLogs}
            onUpdateAuditLogs={setAuditLogs}
          />
        )}
        {currentTab === 'scenario' && (
          <DuressWalkthrough engine={engine} />
        )}
        {currentTab === 'inspector' && (
          <SlotInspector
            engine={engine}
            onStoreUpdated={handleStoreUpdated}
            onAddAuditLog={addAuditLog}
          />
        )}
        {currentTab === 'hsm' && (
          <HardwareHsmSimulator
            engine={engine}
            onStoreUpdated={handleStoreUpdated}
            onNavigateToPhone={() => setCurrentTab('phone')}
            onAddAuditLog={addAuditLog}
          />
        )}
        {currentTab === 'cli' && (
          <CliTerminal engine={engine} onStoreUpdated={handleStoreUpdated} />
        )}
        {currentTab === 'benchmark' && (
          <BenchmarkRig engine={engine} />
        )}
        {currentTab === 'docs' && (
          <DocumentationViewer />
        )}
      </main>

      <footer className="border-t border-slate-900 bg-slate-950 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 space-y-1">
          <p>
            Multi-Layer Secure Unlock (MLSU) — Concept paper & reference verification model.
          </p>
          <p className="text-[11px] text-slate-600">
            Open and auditable privacy architecture. Dual licensed under CC BY-SA 4.0 / Apache-2.0.
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
