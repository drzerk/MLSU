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
  packMlsuFirmwareBlob,
  downloadFirmwareBlob,
  downloadTextFile,
  RomTargetConfig,
  PackedFirmwareResult,
  BinarySection,
} from '../utils/firmwarePacker';

interface FirmwarePackerProps {
  engine: MlsuKeyStore;
}

export const FirmwarePacker: React.FC<FirmwarePackerProps> = ({ engine }) => {
  const [targetConfig, setTargetConfig] = useState<RomTargetConfig>({
    osName: 'grapheneos',
    targetArch: 'arm64-v8a',
    hardwareEngine: 'titan_m2',
    encryptionStandard: 'fscrypt_v2_chacha20',
    buildFlavor: 'userdebug',
    deviceName: 'Pixel 8 Pro (husky)',
    romVersion: '14.0-QPR2',
  });

  const [packedResult, setPackedResult] = useState<PackedFirmwareResult | null>(null);
  const [activeSectionFilter, setActiveSectionFilter] = useState<BinarySection['category'] | 'all'>('all');
  const [hoveredByteIndex, setHoveredByteIndex] = useState<number | null>(null);
  const [activeCodeTab, setActiveCodeTab] = useState<'cheader' | 'blueprint' | 'sepolicy' | 'json'>('cheader');
  const [isBuildingRom, setIsBuildingRom] = useState<boolean>(false);
  const [buildLogs, setBuildLogs] = useState<string[]>([]);
  const [buildStep, setBuildStep] = useState<number>(0);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [downloadSuccessNotice, setDownloadSuccessNotice] = useState<string | null>(null);

  // Pack the firmware whenever engine slots or targetConfig changes
  useEffect(() => {
    let isMounted = true;
    packMlsuFirmwareBlob(engine.slots, engine.kdf, targetConfig).then((res) => {
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

  const handleSimulateRomBuild = () => {
    if (isBuildingRom || !packedResult) return;
    setIsBuildingRom(true);
    setBuildStep(1);
    setBuildLogs([
      `[00:00.012] [INIT] Initializing MLSU ROM build pipeline for target: ${targetConfig.osName.toUpperCase()} (${targetConfig.targetArch})...`,
      `[00:00.045] [CHECK] Validating 4-sector fixed alignment (SR-8): 400 bytes constant payload verified.`,
    ]);

    setTimeout(() => {
      setBuildStep(2);
      setBuildLogs((prev) => [
        ...prev,
        `[00:00.180] [KDF] Sealing KDF Profile (${engine.kdf.name.toUpperCase()} / TimeCost: ${engine.kdf.timeCost}, Mem: ${engine.kdf.memoryCostKiB} KiB).`,
        `[00:00.320] [WEAVER] Binding hardware Weaver HAL client with StrongBox key master (${targetConfig.hardwareEngine.toUpperCase()}).`,
      ]);
    }, 800);

    setTimeout(() => {
      setBuildStep(3);
      setBuildLogs((prev) => [
        ...prev,
        `[00:00.640] [CC] Compiling system/vold/mlsu_ct.c with flags: -O3 -fstack-protector-strong -fPIC.`,
        `[00:00.910] [SEPOLICY] Injected SELinux capability domain 'mlsu_keystore_daemon' into plat_sepolicy.cil.`,
      ]);
    }, 1700);

    setTimeout(() => {
      setBuildStep(4);
      setBuildLogs((prev) => [
        ...prev,
        `[00:01.250] [IMAGE] Injecting static binary blob (SHA-256: ${packedResult.sha256Digest.slice(0, 16)}...) into boot.img ramdisk.`,
        `[00:01.520] [AVB] Signing boot and system partitions with OEM verified boot certificate.`,
        `[00:01.780] [SUCCESS] Simulated ROM Image built successfully! Ready for fastboot flashing.`,
      ]);
      setBuildStep(5);
      setIsBuildingRom(false);
    }, 2700);
  };

  const handleDownloadBinary = () => {
    if (!packedResult) return;
    const filename = `mlsu-firmware-${targetConfig.osName}-${targetConfig.targetArch}.bin`;
    downloadFirmwareBlob(packedResult.binary, filename);
    setDownloadSuccessNotice(`Downloaded binary payload (${packedResult.totalBytes} bytes) as ${filename}`);
    setTimeout(() => setDownloadSuccessNotice(null), 4000);
  };

  const handleDownloadCHeader = () => {
    if (!packedResult) return;
    downloadTextFile(packedResult.cHeaderCode, 'mlsu_firmware_table.h', 'text/x-c');
    setDownloadSuccessNotice(`Downloaded C Header: mlsu_firmware_table.h`);
    setTimeout(() => setDownloadSuccessNotice(null), 4000);
  };

  const handleDownloadManifest = () => {
    if (!packedResult) return;
    const manifest = {
      format: 'mlsu_firmware_package',
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
    downloadTextFile(JSON.stringify(manifest, null, 2), 'mlsu-build-manifest.json', 'application/json');
    setDownloadSuccessNotice(`Downloaded build package manifest: mlsu-build-manifest.json`);
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
                AOSP / GrapheneOS ROM Packaging Tool
              </span>
              <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                Constant 400 Bytes (SR-8)
              </span>
              <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800">
                Zero-Leakage Verified
              </span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              ROM Firmware Packer & Binary Blob Synthesizer
            </h1>
            <p className="text-sm text-slate-300 max-w-3xl leading-relaxed">
              Synthesize a flashable ROM firmware payload directly from the active cryptographic state. Packages
              the <strong>Argon2id KDF parameters</strong>, <strong>4 fixed 80-byte sector tables</strong>, and a <strong>SHA-256 Secure Boot seal</strong> for seamless embedding into native Android daemons (<code className="text-sky-300 font-mono text-xs">system/vold</code>).
            </p>
          </div>

          {/* Quick Action Button */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              id="simulate-build-rom-btn"
              onClick={handleSimulateRomBuild}
              disabled={isBuildingRom}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 disabled:opacity-50 text-white font-semibold text-xs flex items-center gap-2 shadow-lg shadow-sky-950 transition-all cursor-pointer"
            >
              {isBuildingRom ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  <span>Building ROM Image...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 text-white" />
                  <span>Simulate ROM Build</span>
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

      {/* Grid: ROM Target Configuration & Build Simulator Stepper */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: ROM Configuration Specs (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-sky-400" />
                <h2 className="text-sm font-semibold text-white">Target ROM & Platform Specs</h2>
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
                  <span className="text-amber-400 font-semibold">{engine.kdf.name.toUpperCase()} (Argon2id)</span>
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

        {/* Right Column: Build Terminal & Simulation Stepper (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-emerald-400" />
                <h2 className="text-sm font-semibold text-white">ROM Image Compilation Engine</h2>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono">
                {isBuildingRom ? (
                  <span className="text-amber-400 flex items-center gap-1">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    Synthesizing...
                  </span>
                ) : buildStep === 5 ? (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Build Ready
                  </span>
                ) : (
                  <span className="text-slate-500">Idle / Ready</span>
                )}
              </div>
            </div>

            {/* Build Stepper Progress Bar */}
            <div className="grid grid-cols-4 gap-2 text-xs">
              {[
                { step: 1, label: 'Pre-flight & Align' },
                { step: 2, label: 'KDF & Weaver Seal' },
                { step: 3, label: 'vold Native CC' },
                { step: 4, label: 'AVB Sign & Image' },
              ].map((s) => (
                <div
                  key={s.step}
                  className={`p-2.5 rounded-xl border transition-all text-center ${
                    buildStep >= s.step
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
              {buildLogs.length === 0 ? (
                <div className="text-slate-500 py-6 text-center italic">
                  Press <strong>"Simulate ROM Build"</strong> above to run the full AOSP/GrapheneOS firmware packaging pipeline.
                </div>
              ) : (
                buildLogs.map((log, idx) => (
                  <div
                    key={idx}
                    className={`leading-relaxed ${
                      log.includes('[SUCCESS]')
                        ? 'text-emerald-400 font-semibold'
                        : log.includes('[CHECK]')
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

            {/* Firmware Integrity Digest Card */}
            {packedResult && (
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs font-mono">
                <div className="space-y-0.5">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block">SHA-256 Secure Boot Seal</span>
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
                Binary Firmware Blob & Hex Disassembler
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
              mlsu_firmware_table.h (C Header)
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
          <span>Why Fixed-Size Binary Packing is Crucial for Privacy (SR-8)</span>
        </div>
        <p className="leading-relaxed">
          In standard Android systems, user accounts dynamically increase filesystem directory counts and metadata records. MLSU eliminates this side-channel by allocating a <strong>strict 4-sector fixed table</strong> of exactly 400 bytes. Unallocated or decoy profiles are padded with cryptographically indistinguishable random noise so a physical NAND examiner or forensic dump cannot distinguish between 1 active profile, 2 active profiles, or all 4 slots.
        </p>
      </div>
    </div>
  );
};
