import React, { useState, useEffect, useMemo } from 'react';
import {
  Cpu,
  Package,
  Layers,
  Terminal,
  Download,
  Copy,
  Check,
  CheckCircle2,
  AlertTriangle,
  FileCode,
  Sparkles,
  Play,
  RefreshCw,
  Eye,
  Info,
  Lock,
  Unlock,
  HardDrive,
  Shield,
  Binary,
  Code,
  FileText,
} from 'lucide-react';
import { MlsuKeyStore } from '../crypto/mlsuEngine';
import {
  packMlsuStoreImage,
  downloadStoreImage,
  downloadTextFile,
  RomTargetConfig,
  PackedStoreLayout,
  BinarySection,
} from '../utils/storeLayout';

interface StoreLayoutInspectorProps {
  engine: MlsuKeyStore;
}

export const StoreLayoutInspector: React.FC<StoreLayoutInspectorProps> = ({ engine }) => {
  const [targetConfig, setTargetConfig] = useState<RomTargetConfig>({
    osName: 'grapheneos',
    targetArch: 'arm64-v8a',
    hardwareEngine: 'titan_m2',
    encryptionStandard: 'fscrypt_v2_chacha20',
    buildFlavor: 'userdebug',
    deviceName: 'Pixel 8 Pro (husky)',
    romVersion: '14.0-QPR2',
  });

  const [packedResult, setPackedResult] = useState<PackedStoreLayout | null>(null);
  const [activeSectionFilter, setActiveSectionFilter] = useState<BinarySection['category'] | 'all'>('all');
  const [hoveredByteIndex, setHoveredByteIndex] = useState<number | null>(null);
  const [activeCodeTab, setActiveCodeTab] = useState<'cheader' | 'blueprint' | 'sepolicy' | 'json'>('cheader');
  const [isWalking, setIsWalking] = useState<boolean>(false);
  const [walkLogs, setWalkLogs] = useState<string[]>([]);
  const [walkStep, setWalkStep] = useState<number>(0);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [downloadSuccessNotice, setDownloadSuccessNotice] = useState<string | null>(null);

  // Re-serialize the slot table whenever engine slots or targetConfig changes
  useEffect(() => {
    let isMounted = true;
    packMlsuStoreImage(engine.slots, engine.kdf, targetConfig).then((res) => {
      if (isMounted) {
        setPackedResult(res);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [engine.slots, engine.kdf, targetConfig]);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleWalkIntegrationPoints = () => {
    if (isWalking || !packedResult) return;
    setIsWalking(true);
    setWalkStep(1);
    setWalkLogs([
      `[step 1/4] [SCOPE] Walking the integration points an MLSU port would touch for ${targetConfig.osName.toUpperCase()} (${targetConfig.targetArch}). Nothing is compiled here.`,
      `[step 1/4] [LAYOUT] Slot table serialized in this browser: 4 records, 400 bytes, size independent of how many profiles are enrolled (SR-8).`,
    ]);

    setTimeout(() => {
      setWalkStep(2);
      setWalkLogs((prev) => [
        ...prev,
        `[step 2/4] [KDF] KDF parameters recorded in the header (${engine.kdf.name.toUpperCase()} / TimeCost: ${engine.kdf.timeCost}, Mem: ${engine.kdf.memoryCostKiB} KiB). The browser uses PBKDF2 as a stand-in for Argon2id.`,
        `[step 2/4] [WEAVER] A port would bind one Weaver slot per profile via IWeaver (${targetConfig.hardwareEngine.toUpperCase()}). Slot count is a device constant — read getConfig().slots on real hardware (M4), it is not known here.`,
      ]);
    }, 800);

    setTimeout(() => {
      setWalkStep(3);
      setWalkLogs((prev) => [
        ...prev,
        `[step 3/4] [CT-CORE] The branch-free selection lives in reference/ct_core (C). A port would compile it into the unlock path — see docs/p1-poc-skizze.md §4.1.`,
        `[step 3/4] [SEPOLICY] An SELinux domain would have to be written for the daemon holding the slot table. Not written, not reviewed.`,
      ]);
    }, 1700);

    setTimeout(() => {
      setWalkStep(4);
      setWalkLogs((prev) => [
        ...prev,
        `[step 4/4] [DIGEST] SHA-256 over the serialized layout: ${packedResult.sha256Digest.slice(0, 16)}… — computed in this browser over the bytes shown below.`,
        `[step 4/4] [DONE] Walkthrough finished. No image was built, nothing was signed, and there is nothing to flash — MLSU has no AOSP implementation (see P1, milestones M0–M4).`,
      ]);
      setWalkStep(5);
      setIsWalking(false);
    }, 2700);
  };

  const handleDownloadBinary = () => {
    if (!packedResult) return;
    const filename = `mlsu-store-layout-${targetConfig.osName}-${targetConfig.targetArch}.bin`;
    downloadStoreImage(packedResult.binary, filename);
    setDownloadSuccessNotice(`Downloaded binary payload (${packedResult.totalBytes} bytes) as ${filename}`);
    setTimeout(() => setDownloadSuccessNotice(null), 4000);
  };

  const handleDownloadCHeader = () => {
    if (!packedResult) return;
    downloadTextFile(packedResult.cHeaderCode, 'mlsu_slot_table.h', 'text/x-c');
    setDownloadSuccessNotice(`Downloaded C Header: mlsu_slot_table.h`);
    setTimeout(() => setDownloadSuccessNotice(null), 4000);
  };

  const handleDownloadManifest = () => {
    if (!packedResult) return;
    const manifest = {
      format: 'mlsu_store_layout_model',
      version: '1.0',
      generated: new Date().toISOString(),
      target: targetConfig,
      kdf: engine.kdf,
      slotsSummary: engine.slots.map((s, idx) => ({
        index: idx,
        enrolled: s.isEnrolled,
        profileId: s.profileId,
        failures: s.failures,
      })),
      payload: {
        sizeBytes: packedResult.totalBytes,
        sha256: packedResult.sha256Digest,
        hex: packedResult.hexTotal,
      },
    };
    downloadTextFile(JSON.stringify(manifest, null, 2), 'mlsu-store-layout-manifest.json', 'application/json');
    setDownloadSuccessNotice(`Downloaded layout manifest: mlsu-store-layout-manifest.json`);
    setTimeout(() => setDownloadSuccessNotice(null), 4000);
  };

  const hoveredSection = useMemo(() => {
    if (hoveredByteIndex === null || !packedResult) return null;
    return packedResult.sections.find(
      (sec) => hoveredByteIndex >= sec.offsetStart && hoveredByteIndex <= sec.offsetEnd
    );
  }, [hoveredByteIndex, packedResult]);

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Top Banner / Hero */}
      <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/70 border border-slate-800 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Binary className="w-64 h-64 text-sky-400" />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800 flex items-center gap-1.5 font-semibold">
                <Package className="w-3.5 h-3.5" />
                Store Layout Inspector — model, not a build
              </span>
              <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                Constant 400 Bytes (SR-8)
              </span>
              <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-800">
                Nothing here is flashable
              </span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              Store Layout & Slot Table Inspector
            </h1>
            <p className="text-sm text-slate-300 max-w-3xl leading-relaxed">
              Serializes the active slot table into the fixed binary layout the reference model uses, and shows where
              such a table <em>would</em> be bound if someone integrated MLSU into an AOSP tree: <strong>KDF parameters</strong>,{' '}
              <strong>4 fixed 80-byte slot records</strong> and a <strong>SHA-256 digest</strong> over the result.
              The walkthrough below names the integration points (<code className="text-sky-300 font-mono text-xs">system/vold</code>, sepolicy,
              build blueprint) — it does not compile, sign or produce anything a device could boot.
            </p>
          </div>

          {/* Quick Action Button */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              id="walk-integration-points-btn"
              onClick={handleWalkIntegrationPoints}
              disabled={isWalking}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 disabled:opacity-50 text-white font-semibold text-xs flex items-center gap-2 shadow-lg shadow-sky-950 transition-all cursor-pointer"
            >
              {isWalking ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  <span>Walking integration points…</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 text-white" />
                  <span>Walk Integration Points</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Download Alert Notice */}
      {downloadSuccessNotice && (
        <div className="p-3 rounded-xl bg-emerald-950/90 border border-emerald-700 text-emerald-200 text-xs flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{downloadSuccessNotice}</span>
          </div>
          <button
            onClick={() => setDownloadSuccessNotice(null)}
            className="text-emerald-400 hover:text-white text-xs px-1 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Grid: target platform + integration walkthrough */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left column: target platform specs (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-sky-400" />
                <h2 className="text-sm font-semibold text-white">Target Platform (hypothetical port)</h2>
              </div>
              <span className="text-[10px] font-mono text-slate-400">fscrypt v2 / Weaver</span>
            </div>

            {/* Target OS */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Target Operating System</label>
              <select
                id="select-target-os"
                value={targetConfig.osName}
                onChange={(e) => setTargetConfig({ ...targetConfig, osName: e.target.value as RomTargetConfig['osName'] })}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-sky-500 font-mono"
              >
                <option value="grapheneos">GrapheneOS 14 (Hardened AOSP)</option>
                <option value="aosp">AOSP 14 (Vanilla Android Open Source)</option>
                <option value="lineageos">LineageOS 21 (Community Firmware)</option>
                <option value="calyxos">CalyxOS 5 (Privacy Focused)</option>
              </select>
            </div>

            {/* Target Architecture & Device */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Architecture</label>
                <select
                  id="select-target-arch"
                  value={targetConfig.targetArch}
                  onChange={(e) => setTargetConfig({ ...targetConfig, targetArch: e.target.value as RomTargetConfig['targetArch'] })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-sky-500 font-mono"
                >
                  <option value="arm64-v8a">ARM64-v8a (Tensor G2/G3, Snapdragon)</option>
                  <option value="arm64-v9a">ARM64-v9a (Next-Gen SoCs)</option>
                  <option value="x86_64">x86_64 (Cuttlefish / Emulator)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Security Engine</label>
                <select
                  id="select-hardware-engine"
                  value={targetConfig.hardwareEngine}
                  onChange={(e) => setTargetConfig({ ...targetConfig, hardwareEngine: e.target.value as RomTargetConfig['hardwareEngine'] })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-sky-500 font-mono"
                >
                  <option value="titan_m2">Google Titan M2 (StrongBox)</option>
                  <option value="qualcomm_spu">Qualcomm SPU (Secure Processor)</option>
                  <option value="nxp_se">NXP SN100/220 Secure Element</option>
                  <option value="software_tpm">Software StrongBox Emulation</option>
                </select>
              </div>
            </div>

            {/* Target Device & Flavor */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Device Reference</label>
                <input
                  type="text"
                  value={targetConfig.deviceName}
                  onChange={(e) => setTargetConfig({ ...targetConfig, deviceName: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-sky-500 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Build Flavor</label>
                <select
                  value={targetConfig.buildFlavor}
                  onChange={(e) => setTargetConfig({ ...targetConfig, buildFlavor: e.target.value as RomTargetConfig['buildFlavor'] })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-sky-500 font-mono"
                >
                  <option value="user">user (Production Hardened)</option>
                  <option value="userdebug">userdebug (Security Audit & Logcat)</option>
                  <option value="eng">eng (Engineering Root)</option>
                </select>
              </div>
            </div>

            {/* Live State Summary */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 space-y-2 text-xs">
              <div className="text-slate-400 font-medium flex items-center justify-between">
                <span>Active KeyStore State:</span>
                <span className="font-mono text-sky-400">{engine.slots.filter((s) => s.isEnrolled).length} / 4 Slots Enrolled</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">
                  <span className="text-slate-500 block">KDF Mode:</span>
                  <span className="text-amber-400 font-semibold">{engine.kdf.name.toUpperCase()} (PBKDF2 stand-in)</span>
                </div>
                <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">
                  <span className="text-slate-500 block">Payload Footprint:</span>
                  <span className="text-emerald-400 font-semibold">400 Bytes Fixed</span>
                </div>
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-800">
              <button
                id="download-binary-blob-btn"
                onClick={handleDownloadBinary}
                className="flex-1 min-w-[130px] px-3 py-2 rounded-xl bg-sky-950/80 hover:bg-sky-900 border border-sky-700 text-sky-200 hover:text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-sm"
              >
                <Download className="w-3.5 h-3.5 text-sky-400" />
                <span>Download .bin</span>
              </button>
              <button
                id="download-cheader-btn"
                onClick={handleDownloadCHeader}
                className="flex-1 min-w-[130px] px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-sm"
              >
                <FileCode className="w-3.5 h-3.5 text-indigo-400" />
                <span>Export C Header</span>
              </button>
              <button
                id="download-manifest-btn"
                onClick={handleDownloadManifest}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                title="Download JSON build manifest"
              >
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                <span>Manifest</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right column: integration walkthrough (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-emerald-400" />
                <h2 className="text-sm font-semibold text-white">AOSP Integration Points (walkthrough)</h2>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono">
                {isWalking ? (
                  <span className="text-amber-400 flex items-center gap-1">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    Walking…
                  </span>
                ) : walkStep === 5 ? (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Walkthrough done
                  </span>
                ) : (
                  <span className="text-slate-500">Idle / Ready</span>
                )}
              </div>
            </div>

            {/* Build Stepper Progress Bar */}
            <div className="grid grid-cols-4 gap-2 text-xs">
              {[
                { step: 1, label: 'Layout & Alignment' },
                { step: 2, label: 'KDF & Weaver Binding' },
                { step: 3, label: 'ct_core & sepolicy' },
                { step: 4, label: 'Digest & Limits' },
              ].map((s) => (
                <div
                  key={s.step}
                  className={`p-2.5 rounded-xl border transition-all text-center ${
                    walkStep >= s.step
                      ? 'bg-sky-950/80 border-sky-700 text-sky-200'
                      : 'bg-slate-950 border-slate-800/80 text-slate-500'
                  }`}
                >
                  <div className="text-[10px] font-mono mb-0.5">Stage 0{s.step}</div>
                  <div className="text-[11px] font-semibold truncate">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Live Terminal Output Console */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-slate-300 space-y-1.5 max-h-56 overflow-y-auto scrollbar-thin">
              {walkLogs.length === 0 ? (
                <div className="text-slate-500 py-6 text-center italic">
                  Press <strong>"Walk Integration Points"</strong> above to step through the places an AOSP port would have to touch.
                </div>
              ) : (
                walkLogs.map((log, idx) => (
                  <div
                    key={idx}
                    className={`leading-relaxed ${
                      log.includes('[DONE]')
                        ? 'text-emerald-400 font-semibold'
                        : log.includes('[LAYOUT]')
                        ? 'text-sky-300'
                        : log.includes('[WEAVER]') || log.includes('[KDF]')
                        ? 'text-amber-300'
                        : 'text-slate-300'
                    }`}
                  >
                    {log}
                  </div>
                ))
              )}
            </div>

            {/* Layout digest card */}
            {packedResult && (
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs font-mono">
                <div className="space-y-0.5">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block">SHA-256 over the serialized layout</span>
                  <span className="text-sky-400 font-semibold select-all break-all text-[11px]">
                    {packedResult.sha256Digest}
                  </span>
                </div>
                <button
                  onClick={() => handleCopy(packedResult.sha256Digest, 'digest')}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1 transition-colors shrink-0 cursor-pointer ml-3"
                  title="Copy SHA-256 digest"
                >
                  {copiedKey === 'digest' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === 'digest' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Binary Blob Hex Inspector & Memory Disassembler */}
      <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Binary className="w-5 h-5 text-indigo-400" />
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Serialized Slot Table & Hex View
              </h2>
              <p className="text-xs text-slate-400">
                Live interactive memory view of the 400-byte payload structured in 16-byte rows. Hover over bytes or click sections to inspect.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleCopy(packedResult?.hexTotal || '', 'hex-all')}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 border border-slate-700 transition-colors cursor-pointer"
            >
              {copiedKey === 'hex-all' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-sky-400" />}
              <span>{copiedKey === 'hex-all' ? 'Copied Raw Hex' : 'Copy Full Hex'}</span>
            </button>
          </div>
        </div>

        {/* Section Filters / Categorized Legend */}
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setActiveSectionFilter('all')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeSectionFilter === 'all'
                ? 'bg-slate-700 text-white'
                : 'bg-slate-950 text-slate-400 hover:bg-slate-800'
            }`}
          >
            All Sections (400B)
          </button>
          {packedResult?.sections.map((sec) => (
            <button
              key={sec.category}
              onClick={() => setActiveSectionFilter(sec.category)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                activeSectionFilter === sec.category
                  ? `${sec.colorClass} shadow-md`
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-800'
              }`}
            >
              {sec.name} ({sec.offsetEnd - sec.offsetStart + 1}B)
            </button>
          ))}
        </div>

        {/* Hovered Byte Inspector Tooltip */}
        {hoveredSection ? (
          <div className="p-3 rounded-xl bg-slate-950 border border-sky-800 text-xs text-sky-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-sky-400 shrink-0" />
              <span>
                <strong>Offset 0x{hoveredByteIndex?.toString(16).padStart(4, '0').toUpperCase()}</strong> (Dec {hoveredByteIndex}):{' '}
                <span className="text-white font-semibold">{hoveredSection.name}</span> — {hoveredSection.description}
              </span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-900/60 border border-sky-700 text-sky-300">
              Bytes [{hoveredSection.offsetStart}..{hoveredSection.offsetEnd}]
            </span>
          </div>
        ) : (
          <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-500 flex items-center gap-2">
            <Eye className="w-4 h-4 text-slate-500" />
            <span>Hover your cursor over any byte in the hex matrix below to view its functional role and security mandate.</span>
          </div>
        )}

        {/* Hex Matrix Table */}
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs overflow-x-auto">
          <div className="min-w-[680px] space-y-1">
            {/* Table Header */}
            <div className="grid grid-cols-12 text-[10px] text-slate-500 font-bold border-b border-slate-800 pb-1.5 mb-2">
              <div className="col-span-2">OFFSET</div>
              <div className="col-span-7 tracking-wider">00 01 02 03 04 05 06 07  08 09 0A 0B 0C 0D 0E 0F</div>
              <div className="col-span-3 text-right pr-2">ASCII REPR</div>
            </div>

            {/* Rows */}
            {packedResult?.hexLines
              .filter((line) => activeSectionFilter === 'all' || line.category === activeSectionFilter)
              .map((line) => (
                <div
                  key={line.offset}
                  className="grid grid-cols-12 py-0.5 hover:bg-slate-900/80 rounded transition-colors group items-center"
                >
                  {/* Offset */}
                  <div className="col-span-2 text-slate-500 font-bold text-[11px]">{line.offsetHex}</div>

                  {/* 16 Hex Bytes */}
                  <div className="col-span-7 flex items-center gap-1.5 text-[11px]">
                    {line.hexString.map((byteHex, bIdx) => {
                      const absoluteIndex = line.offset + bIdx;
                      const isHovered = hoveredByteIndex === absoluteIndex;
                      const category = line.category;

                      let color = 'text-slate-400 group-hover:text-slate-200';
                      if (category === 'header') color = 'text-sky-400';
                      else if (category === 'kdf') color = 'text-amber-400';
                      else if (category === 'slot0') color = 'text-emerald-400';
                      else if (category === 'slot1') color = 'text-indigo-400';
                      else if (category === 'slot2') color = 'text-purple-400';
                      else if (category === 'slot3') color = 'text-pink-400';
                      else if (category === 'footer') color = 'text-rose-400';

                      return (
                        <span
                          key={bIdx}
                          onMouseEnter={() => setHoveredByteIndex(absoluteIndex)}
                          onMouseLeave={() => setHoveredByteIndex(null)}
                          className={`cursor-pointer px-0.5 rounded transition-all ${
                            isHovered
                              ? 'bg-sky-500 text-white font-bold ring-2 ring-sky-300'
                              : `${color} hover:bg-slate-800`
                          } ${bIdx === 7 ? 'mr-2' : ''}`}
                        >
                          {byteHex}
                        </span>
                      );
                    })}
                  </div>

                  {/* ASCII Representation */}
                  <div className="col-span-3 text-right pr-2 text-slate-400 text-[11px] tracking-widest font-mono">
                    {line.asciiString}
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Embedded Native Code Integration Deck (C Header, Blueprint & SELinux) */}
      <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Code className="w-5 h-5 text-sky-400" />
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Native AOSP Integration & Source Code
              </h2>
              <p className="text-xs text-slate-400">
                Ready-to-use C structs, Android.bp blueprints, and SELinux policies for building into <code className="text-sky-300 font-mono">system/vold</code>.
              </p>
            </div>
          </div>

          {/* Code Tab Navigation */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-950 border border-slate-800">
            <button
              onClick={() => setActiveCodeTab('cheader')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeCodeTab === 'cheader' ? 'bg-sky-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              mlsu_slot_table.h (C Header)
            </button>
            <button
              onClick={() => setActiveCodeTab('blueprint')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeCodeTab === 'blueprint' ? 'bg-sky-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Android.bp
            </button>
            <button
              onClick={() => setActiveCodeTab('sepolicy')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeCodeTab === 'sepolicy' ? 'bg-sky-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              vold.te (SELinux)
            </button>
          </div>
        </div>

        {/* Code Display Area */}
        <div className="relative">
          <button
            onClick={() => {
              const code =
                activeCodeTab === 'cheader'
                  ? packedResult?.cHeaderCode
                  : activeCodeTab === 'blueprint'
                  ? packedResult?.aospBlueprintCode
                  : packedResult?.sepolicyTeCode;
              handleCopy(code || '', 'code-active');
            }}
            className="absolute top-3 right-3 px-2.5 py-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1.5 border border-slate-700 transition-colors shadow-md z-10 cursor-pointer"
          >
            {copiedKey === 'code-active' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedKey === 'code-active' ? 'Copied' : 'Copy Code'}</span>
          </button>

          <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-300 overflow-x-auto max-h-96 scrollbar-thin leading-relaxed">
            {activeCodeTab === 'cheader' && packedResult?.cHeaderCode}
            {activeCodeTab === 'blueprint' && packedResult?.aospBlueprintCode}
            {activeCodeTab === 'sepolicy' && packedResult?.sepolicyTeCode}
          </pre>
        </div>
      </div>

      {/* Educational Architecture Callout */}
      <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 text-xs text-slate-300 space-y-3">
        <div className="flex items-center gap-2 text-sky-400 font-semibold">
          <Shield className="w-4 h-4" />
          <span>Why the table has a fixed size — and what that does not buy (SR-8)</span>
        </div>
        <p className="leading-relaxed">
          In standard Android, adding a user changes directory counts and metadata records. MLSU keeps a{' '}
          <strong>fixed table of 4 records / 400 bytes</strong>: enrolling a profile does not change the size, and empty
          records hold random bytes that no PIN opens. What that achieves is narrow but real — the <em>length</em> of the
          table says nothing about how many profiles exist.
        </p>
        <p className="leading-relaxed text-amber-200/90">
          What it does <strong>not</strong> achieve: the reference implementation keeps a status byte per record so a fresh
          process knows which slot is free — a documented deviation from SR-8, readable by anyone who can read the store
          (see <code className="font-mono text-[11px]">reference/README.md</code>). And a fixed-size table says nothing
          about the storage layer underneath it: flash wear-levelling keeps old blocks, and reconstruction via chip-off or
          the FTL is exactly the attacker class (A5) that MLSU does <strong>not</strong> claim to defeat (concept §9.2).
          Deniability is claimed against A2/A3 only.
        </p>
      </div>
    </div>
  );
};
