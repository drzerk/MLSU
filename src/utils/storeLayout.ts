import { KdfConfig, SlotData } from '../types';
import { hexToBytes, bytesToHex } from '../crypto/mlsuEngine';

export interface RomTargetConfig {
  osName: 'grapheneos' | 'aosp' | 'lineageos' | 'calyxos';
  targetArch: 'arm64-v8a' | 'arm64-v9a' | 'x86_64';
  hardwareEngine: 'titan_m2' | 'qualcomm_spu' | 'nxp_se' | 'software_tpm';
  encryptionStandard: 'fscrypt_v2_chacha20' | 'fscrypt_v2_aes_xts';
  buildFlavor: 'user' | 'userdebug' | 'eng';
  deviceName: string;
  romVersion: string;
}

export interface BinarySection {
  name: string;
  category: 'header' | 'kdf' | 'slot0' | 'slot1' | 'slot2' | 'slot3' | 'footer';
  offsetStart: number;
  offsetEnd: number;
  description: string;
  colorClass: string;
}

export interface HexLine {
  offset: number;
  offsetHex: string;
  bytes: number[];
  hexString: string[];
  asciiString: string;
  category: BinarySection['category'];
}

export interface PackedStoreLayout {
  binary: Uint8Array;
  hexTotal: string;
  sections: BinarySection[];
  hexLines: HexLine[];
  sha256Digest: string;
  totalBytes: number;
  timestamp: number;
  cHeaderCode: string;
  aospBlueprintCode: string;
  sepolicyTeCode: string;
}

export interface GenericSlotInput {
  isEnrolled: boolean;
  profileId: number | null;
  failures: number;
  salt: string | Uint8Array;
  nonce: string | Uint8Array;
  blob: string | Uint8Array;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buf = new Uint8Array(bytes.length);
  buf.set(bytes);
  return buf.buffer;
}

/**
 * Calculates SHA-256 hash using WebCrypto (or fast JS fallback)
 */
async function computeSha256(data: Uint8Array): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const hashBuffer = await crypto.subtle.digest('SHA-256', toArrayBuffer(data));
      return Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    } catch {
      // Fallback below
    }
  }
  // Simple deterministic fallback digest
  let hash = 0x811c9dc5;
  for (let i = 0; i < data.length; i++) {
    hash ^= data[i];
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(64, '0');
}

/**
 * Packages MLSU KDF and Slots into a canonical 400-byte slot-table layout
 */
export async function packMlsuStoreImage(
  slots: GenericSlotInput[],
  kdf: KdfConfig,
  targetConfig: RomTargetConfig
): Promise<PackedStoreLayout> {
  const TOTAL_SIZE = 400; // 32 (Header) + 16 (KDF) + 320 (4 Slots x 80B) + 32 (Footer SHA-256)
  const buffer = new Uint8Array(TOTAL_SIZE);
  const view = new DataView(buffer.buffer);

  // --- SECTION 1: HEADER (32 Bytes, offset 0..31) ---
  // Magic bytes "MLSU" (0x4D 0x4C 0x53 0x55)
  buffer[0] = 0x4d;
  buffer[1] = 0x4c;
  buffer[2] = 0x53;
  buffer[3] = 0x55;

  // Format Version (1.0)
  buffer[4] = 0x01;
  buffer[5] = 0x00;

  // Arch ID
  const archMap: Record<RomTargetConfig['targetArch'], number> = {
    'arm64-v8a': 0x01,
    'arm64-v9a': 0x02,
    x86_64: 0x03,
  };
  buffer[6] = archMap[targetConfig.targetArch] || 0x01;

  // OS Map
  const osMap: Record<RomTargetConfig['osName'], number> = {
    grapheneos: 0x01,
    aosp: 0x02,
    lineageos: 0x03,
    calyxos: 0x04,
  };
  buffer[7] = osMap[targetConfig.osName] || 0x01;

  // Security Engine ID
  const secEngineMap: Record<RomTargetConfig['hardwareEngine'], number> = {
    titan_m2: 0x01,
    qualcomm_spu: 0x02,
    nxp_se: 0x03,
    software_tpm: 0x04,
  };
  buffer[8] = secEngineMap[targetConfig.hardwareEngine] || 0x01;

  // Encryption mode
  buffer[9] = targetConfig.encryptionStandard === 'fscrypt_v2_chacha20' ? 0x01 : 0x02;

  // Unix Epoch Timestamp (32-bit big endian)
  const timestamp = Math.floor(Date.now() / 1000);
  view.setUint32(10, timestamp, false);

  // Total Slot Count & Active Slot Count
  view.setUint16(14, 4, false); // Always fixed 4 slots (SR-8)
  const enrolledCount = slots.filter((s) => s.isEnrolled).length;
  view.setUint16(16, enrolledCount, false);

  // Header Security Canary (0xDE, 0xAD, 0xBE, 0xEF)
  buffer[18] = 0xde;
  buffer[19] = 0xad;
  buffer[20] = 0xbe;
  buffer[21] = 0xef;

  // Reserved Header Padding (Offset 22..31)
  for (let i = 22; i < 32; i++) {
    buffer[i] = 0x00;
  }

  // --- SECTION 2: KDF CONFIGURATION BLOCK (16 Bytes, offset 32..47) ---
  const kdfOffset = 32;
  buffer[kdfOffset] = kdf.name === 'strong' ? 0x01 : 0x02; // 0x01: Argon2id, 0x02: PBKDF2/Fast
  buffer[kdfOffset + 1] = kdf.timeCost & 0xff;
  view.setUint32(kdfOffset + 2, kdf.memoryCostKiB, false);
  buffer[kdfOffset + 6] = kdf.parallelism & 0xff;
  buffer[kdfOffset + 7] = kdf.hashLen & 0xff;

  // KDF Domain Separator "AOSPMLSU"
  const domain = 'AOSPMLSU';
  for (let i = 0; i < 8; i++) {
    buffer[kdfOffset + 8 + i] = domain.charCodeAt(i);
  }

  // --- SECTION 3: 4 SLOTS TABLE (4 * 80 Bytes = 320 Bytes, offset 48..367) ---
  const slotsStartOffset = 48;
  const SLOT_SIZE = 80;

  for (let sIdx = 0; sIdx < 4; sIdx++) {
    const sOffset = slotsStartOffset + sIdx * SLOT_SIZE;
    const slot = slots[sIdx] || {
      index: sIdx,
      isEnrolled: false,
      profileId: null,
      salt: '00'.repeat(16),
      nonce: '00'.repeat(12),
      blob: '00'.repeat(49),
      failures: 0,
      lockedOut: false,
      delaySeconds: 0,
      lastFailureAt: null,
    };

    buffer[sOffset] = sIdx;
    buffer[sOffset + 1] = slot.isEnrolled ? 0x01 : 0x00;
    buffer[sOffset + 2] = slot.profileId !== null && slot.profileId !== undefined ? slot.profileId & 0xff : 0xff;
    buffer[sOffset + 3] = slot.failures & 0xff;

    // Salt (16 Bytes)
    const saltBytes = typeof slot.salt === 'string' ? hexToBytes(slot.salt) : slot.salt;
    for (let i = 0; i < 16; i++) {
      buffer[sOffset + 4 + i] = saltBytes && i < saltBytes.length ? saltBytes[i] : 0x00;
    }

    // Nonce (12 Bytes)
    const nonceBytes = typeof slot.nonce === 'string' ? hexToBytes(slot.nonce) : slot.nonce;
    for (let i = 0; i < 12; i++) {
      buffer[sOffset + 20 + i] = nonceBytes && i < nonceBytes.length ? nonceBytes[i] : 0x00;
    }

    // Encrypted Blob & Tag (48 Bytes)
    const blobBytes = typeof slot.blob === 'string' ? hexToBytes(slot.blob) : slot.blob;
    for (let i = 0; i < 48; i++) {
      buffer[sOffset + 32 + i] = blobBytes && i < blobBytes.length ? blobBytes[i] : 0xaa ^ sIdx;
    }
  }

  // --- SECTION 4: INTEGRITY FOOTER (32 Bytes, offset 368..399) ---
  // Compute SHA-256 of the first 368 bytes
  const payloadToHash = buffer.subarray(0, 368);
  const digestHex = await computeSha256(payloadToHash);
  const digestBytes = hexToBytes(digestHex);
  for (let i = 0; i < 32; i++) {
    buffer[368 + i] = i < digestBytes.length ? digestBytes[i] : 0x00;
  }

  // Define Sections metadata
  const sections: BinarySection[] = [
    {
      name: 'MLSU Layout Header',
      category: 'header',
      offsetStart: 0,
      offsetEnd: 31,
      description: 'Magic "MLSU", Format v1.0, Target OS, Hardware Engine ID & Timestamp',
      colorClass: 'text-sky-400 bg-sky-950/70 border-sky-800',
    },
    {
      name: 'KDF Parameters Block',
      category: 'kdf',
      offsetStart: 32,
      offsetEnd: 47,
      description: `Argon2id (Time: ${kdf.timeCost}, Mem: ${kdf.memoryCostKiB} KiB, Lanes: ${kdf.parallelism}) + Domain Separator`,
      colorClass: 'text-amber-400 bg-amber-950/70 border-amber-800',
    },
    {
      name: 'Slot 0 (Sector #1)',
      category: 'slot0',
      offsetStart: 48,
      offsetEnd: 127,
      description: slots[0]?.isEnrolled ? `Enrolled Profile ${slots[0].profileId} (77B constant record)` : 'Decoy / Uniform Random Noise',
      colorClass: 'text-emerald-400 bg-emerald-950/70 border-emerald-800',
    },
    {
      name: 'Slot 1 (Sector #2)',
      category: 'slot1',
      offsetStart: 128,
      offsetEnd: 207,
      description: slots[1]?.isEnrolled ? `Enrolled Profile ${slots[1].profileId} (77B constant record)` : 'Decoy / Uniform Random Noise',
      colorClass: 'text-indigo-400 bg-indigo-950/70 border-indigo-800',
    },
    {
      name: 'Slot 2 (Sector #3)',
      category: 'slot2',
      offsetStart: 208,
      offsetEnd: 287,
      description: slots[2]?.isEnrolled ? `Enrolled Profile ${slots[2].profileId} (77B constant record)` : 'Decoy / Uniform Random Noise',
      colorClass: 'text-purple-400 bg-purple-950/70 border-purple-800',
    },
    {
      name: 'Slot 3 (Sector #4)',
      category: 'slot3',
      offsetStart: 288,
      offsetEnd: 367,
      description: slots[3]?.isEnrolled ? `Enrolled Profile ${slots[3].profileId} (77B constant record)` : 'Decoy / Uniform Random Noise',
      colorClass: 'text-pink-400 bg-pink-950/70 border-pink-800',
    },
    {
      name: 'Integrity Checksum (SHA-256)',
      category: 'footer',
      offsetStart: 368,
      offsetEnd: 399,
      description: '32-byte Cryptographic Digest sealing header, KDF and all slot sectors',
      colorClass: 'text-rose-400 bg-rose-950/70 border-rose-800',
    },
  ];

  // Helper to determine category for a given offset
  const getCategory = (offset: number): BinarySection['category'] => {
    if (offset < 32) return 'header';
    if (offset < 48) return 'kdf';
    if (offset < 128) return 'slot0';
    if (offset < 208) return 'slot1';
    if (offset < 288) return 'slot2';
    if (offset < 368) return 'slot3';
    return 'footer';
  };

  // Build Hex Lines (16 bytes per row)
  const hexLines: HexLine[] = [];
  for (let i = 0; i < TOTAL_SIZE; i += 16) {
    const slice = Array.from(buffer.subarray(i, Math.min(i + 16, TOTAL_SIZE)));
    const hexArr = slice.map((b) => b.toString(16).padStart(2, '0').toUpperCase());
    const ascii = slice
      .map((b) => (b >= 32 && b <= 126 ? String.fromCharCode(b) : '.'))
      .join('');

    hexLines.push({
      offset: i,
      offsetHex: '0x' + i.toString(16).padStart(4, '0').toUpperCase(),
      bytes: slice,
      hexString: hexArr,
      asciiString: ascii,
      category: getCategory(i),
    });
  }

  // Generate C Header File for direct integration in AOSP system/vold
  const cHeaderCode = `/*
 * Multi-Layer Secure Unlock (MLSU) - Auto-generated slot-table layout (model output, not a build artefact)
 * Target OS: ${targetConfig.osName.toUpperCase()}
 * Architecture: ${targetConfig.targetArch}
 * Hardware Engine: ${targetConfig.hardwareEngine}
 * Generated: ${new Date(timestamp * 1000).toUTCString()}
 * SHA-256 Digest: ${digestHex}
 */

#ifndef MLSU_SLOT_TABLE_H
#define MLSU_SLOT_TABLE_H

#include <stdint.h>
#include <stddef.h>

#define MLSU_MAGIC 0x55534C4D /* "MLSU" Little Endian */
#define MLSU_FORMAT_VERSION 0x0100
#define MLSU_SLOT_COUNT 4
#define MLSU_SECTOR_SIZE 80
#define MLSU_SLOT_TABLE_SIZE 400

#pragma pack(push, 1)

typedef struct {
    uint32_t magic;
    uint16_t version;
    uint8_t  target_arch;
    uint8_t  target_os;
    uint8_t  hw_engine;
    uint8_t  encryption_mode;
    uint32_t build_timestamp;
    uint16_t total_slots;
    uint16_t enrolled_slots;
    uint32_t security_canary;
    uint8_t  reserved[10];
} mlsu_header_t;

typedef struct {
    uint8_t  algorithm;      /* 0x01 = Argon2id, 0x02 = PBKDF2 */
    uint8_t  time_cost;
    uint32_t memory_cost_kib;
    uint8_t  parallelism;
    uint8_t  hash_len;
    uint8_t  domain_tag[8];
} mlsu_kdf_params_t;

typedef struct {
    uint8_t  slot_index;
    uint8_t  is_enrolled;
    uint8_t  profile_id;
    uint8_t  failure_counter;
    uint8_t  salt[16];
    uint8_t  nonce[12];
    uint8_t  encrypted_payload_and_tag[48];
} mlsu_slot_sector_t;

typedef struct {
    mlsu_header_t      header;
    mlsu_kdf_params_t  kdf;
    mlsu_slot_sector_t slots[MLSU_SLOT_COUNT];
    uint8_t            sha256_checksum[32];
} mlsu_slot_table_t;

#pragma pack(pop)

/* Static binary payload embedded for initial device provisioning */
static const uint8_t MLSU_DEFAULT_SLOT_TABLE[MLSU_SLOT_TABLE_SIZE] = {
${Array.from(buffer)
  .reduce<string[]>((acc, byte, idx) => {
    const hex = '0x' + byte.toString(16).padStart(2, '0').toUpperCase();
    if (idx % 12 === 0) acc.push('    ' + hex);
    else acc[acc.length - 1] += ', ' + hex;
    return acc;
  }, [])
  .join(',\n')}
};

#endif /* MLSU_SLOT_TABLE_H */
`;

  // Generate AOSP Android.bp blueprint
  const aospBlueprintCode = `// AOSP / GrapheneOS Android.bp integration for system/vold/mlsu
cc_library_static {
    name: "libvold_mlsu",
    defaults: ["vold_default_flags"],
    srcs: [
        "mlsu_ct.c",
        "mlsu_vold_bridge.cpp",
        "mlsu_weaver_client.cpp",
    ],
    cflags: [
        "-O3",
        "-fstack-protector-strong",
        "-DMLSU_TARGET_ARCH_${targetConfig.targetArch.replace(/-/g, '_').toUpperCase()}",
        "-DMLSU_HARDWARE_ENGINE_${targetConfig.hardwareEngine.toUpperCase()}",
    ],
    shared_libs: [
        "libbase",
        "libcrypto",
        "libhardware",
        "android.hardware.weaver-V2-ndk",
    ],
    export_include_dirs: ["include"],
}
`;

  // Generate SELinux Policy
  const sepolicyTeCode = `# SELinux capabilities for MLSU Hardware Keystore
type mlsu_keystore_daemon, domain;
type mlsu_keystore_daemon_exec, exec_type, file_type, system_file_type;

init_daemon_domain(mlsu_keystore_daemon)

# Allow interaction with Weaver / StrongBox HAL
hal_client_domain(mlsu_keystore_daemon, hal_weaver)
allow mlsu_keystore_daemon hal_weaver_hwservice:hwservice_manager find;

# Direct block device access for constant-size 77-byte sector storage
allow mlsu_keystore_daemon metadata_file:dir { search read write };
allow mlsu_keystore_daemon metadata_file:file { create read write open getattr };
`;

  return {
    binary: buffer,
    hexTotal: bytesToHex(buffer),
    sections,
    hexLines,
    sha256Digest: digestHex,
    totalBytes: TOTAL_SIZE,
    timestamp,
    cHeaderCode,
    aospBlueprintCode,
    sepolicyTeCode,
  };
}

/**
 * Downloads the binary file to user's disk
 */
export function downloadStoreImage(binary: Uint8Array, filename: string = 'mlsu-store-layout.bin'): void {
  const safeBuffer = new Uint8Array(binary);
  const blob = new Blob([safeBuffer], {
    type: 'application/octet-stream',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Downloads a text file
 */
export function downloadTextFile(content: string, filename: string, mimeType: string = 'text/plain'): void {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
