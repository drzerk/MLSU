import { describe, it, expect } from 'vitest';
import { packMlsuFirmwareBlob, RomTargetConfig } from './firmwarePacker';
import { KDF_FAST } from '../crypto/mlsuEngine';
import { SlotData } from '../types';

describe('Firmware Packer Utility', () => {
  const mockSlots: SlotData[] = [
    {
      index: 0,
      isEnrolled: true,
      profileId: 1,
      salt: '11'.repeat(16),
      nonce: '22'.repeat(12),
      blob: '33'.repeat(48),
      failures: 0,
      lockedOut: false,
      delaySeconds: 0,
      lastFailureAt: null,
    },
    {
      index: 1,
      isEnrolled: true,
      profileId: 2,
      salt: '44'.repeat(16),
      nonce: '55'.repeat(12),
      blob: '66'.repeat(48),
      failures: 1,
      lockedOut: false,
      delaySeconds: 0,
      lastFailureAt: null,
    },
    {
      index: 2,
      isEnrolled: false,
      profileId: null,
      salt: '77'.repeat(16),
      nonce: '88'.repeat(12),
      blob: '99'.repeat(48),
      failures: 0,
      lockedOut: false,
      delaySeconds: 0,
      lastFailureAt: null,
    },
    {
      index: 3,
      isEnrolled: false,
      profileId: null,
      salt: 'AA'.repeat(16),
      nonce: 'BB'.repeat(12),
      blob: 'CC'.repeat(48),
      failures: 0,
      lockedOut: false,
      delaySeconds: 0,
      lastFailureAt: null,
    },
  ];

  const mockTarget: RomTargetConfig = {
    osName: 'grapheneos',
    targetArch: 'arm64-v8a',
    hardwareEngine: 'titan_m2',
    encryptionStandard: 'fscrypt_v2_chacha20',
    buildFlavor: 'userdebug',
    deviceName: 'Pixel 8 Pro (husky)',
    romVersion: '14.0-QPR2',
  };

  it('packs binary blob with exact 400 bytes size and valid magic header', async () => {
    const result = await packMlsuFirmwareBlob(mockSlots, KDF_FAST, mockTarget);

    expect(result.totalBytes).toBe(400);
    expect(result.binary.length).toBe(400);

    // Magic Bytes: ASCII 'MLSU' => 0x4D, 0x4C, 0x53, 0x55
    expect(result.binary[0]).toBe(0x4d);
    expect(result.binary[1]).toBe(0x4c);
    expect(result.binary[2]).toBe(0x53);
    expect(result.binary[3]).toBe(0x55);

    // Format Version: 1.0 (0x01, 0x00)
    expect(result.binary[4]).toBe(0x01);
    expect(result.binary[5]).toBe(0x00);

    // Total slots count must be 4
    const totalSlots = (result.binary[14] << 8) | result.binary[15];
    expect(totalSlots).toBe(4);

    // Enrolled slots count must be 2
    const enrolledSlots = (result.binary[16] << 8) | result.binary[17];
    expect(enrolledSlots).toBe(2);

    // SHA-256 Digest is calculated
    expect(result.sha256Digest).toHaveLength(64);

    // C Header code generated
    expect(result.cHeaderCode).toContain('MLSU_FIRMWARE_TABLE_H');
    expect(result.cHeaderCode).toContain('MLSU_DEFAULT_FIRMWARE_BLOB');

    // Android.bp generated
    expect(result.aospBlueprintCode).toContain('libvold_mlsu');
  });

  it('correctly constructs hex lines and disassembler categories', async () => {
    const result = await packMlsuFirmwareBlob(mockSlots, KDF_FAST, mockTarget);

    expect(result.hexLines.length).toBe(25); // 400 bytes / 16 bytes per line = 25 lines
    expect(result.sections.length).toBe(7); // Header, KDF, 4 Slots, Footer
  });
});
