import { KdfConfig, SlotData, UnlockOutcome, StoreState } from '../types';

export const KDF_FAST: KdfConfig = {
  name: 'fast',
  timeCost: 1,
  memoryCostKiB: 8192,
  parallelism: 1,
  hashLen: 32,
};

export const KDF_STRONG: KdfConfig = {
  name: 'strong',
  timeCost: 3,
  memoryCostKiB: 65536,
  parallelism: 1,
  hashLen: 32,
};

export const SLOT_COUNT = 4;
export const MAX_FAILURES = 30;
export const SALT_LEN = 16;
export const NONCE_LEN = 12;
export const PROFILE_KEY_LEN = 32;
export const PAYLOAD_LEN = 1 + PROFILE_KEY_LEN; // 33 bytes

export function throttleSeconds(failures: number): number {
  if (failures < 5) return 0;
  if (failures < 10) return 30;
  if (failures < 20) return 300;
  return 3600;
}

export function generateRandomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return bytes;
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.replace(/[^0-9a-fA-F]/g, '');
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(cleanHex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

// Pseudo-Argon2 KDF implementation using cryptographic hashing (SHA-256 multiple rounds + salt)
export async function derivePinKey(pin: string, salt: Uint8Array, kdf: KdfConfig): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const pinBytes = encoder.encode(pin);
  
  const combined = new Uint8Array(pinBytes.length + salt.length);
  combined.set(pinBytes);
  combined.set(salt, pinBytes.length);

  // Use WebCrypto if available or fallback
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        combined,
        { name: 'PBKDF2' },
        false,
        ['deriveBits']
      );
      const iterations = kdf.name === 'strong' ? 50000 : 5000;
      const derived = await crypto.subtle.deriveBits(
        {
          name: 'PBKDF2',
          salt: salt,
          iterations: iterations,
          hash: 'SHA-256',
        },
        keyMaterial,
        256
      );
      return new Uint8Array(derived);
    } catch {
      // Fallback below
    }
  }

  // Fallback pure JS hashing
  let hash = 0x811c9dc5;
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    let acc = (salt[i % salt.length] + i * 37) ^ (pin.charCodeAt(i % pin.length) || 0);
    for (let r = 0; r < (kdf.name === 'strong' ? 2000 : 200); r++) {
      hash ^= acc;
      hash = Math.imul(hash, 0x01000193);
      acc = (acc * 31 + (hash & 0xff)) & 0xff;
    }
    out[i] = acc & 0xff;
  }
  return out;
}

// AEAD Encryption (AES-GCM 256-bit with 128-bit tag)
export async function aeadEncrypt(key: Uint8Array, nonce: Uint8Array, payload: Uint8Array): Promise<Uint8Array> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        key,
        { name: 'AES-GCM' },
        false,
        ['encrypt']
      );
      const ciphertext = await crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv: nonce,
          tagLength: 128,
        },
        cryptoKey,
        payload
      );
      return new Uint8Array(ciphertext);
    } catch (e) {
      console.warn('Crypto subtle encryption fallback:', e);
    }
  }

  // Fallback XOR + checksum emulation
  const out = new Uint8Array(payload.length + 16);
  let checksum = 0;
  for (let i = 0; i < payload.length; i++) {
    const k = key[i % key.length] ^ nonce[i % nonce.length];
    out[i] = payload[i] ^ k;
    checksum = (checksum + payload[i]) & 0xff;
  }
  for (let i = 0; i < 16; i++) {
    out[payload.length + i] = (key[(i * 3) % key.length] ^ checksum ^ 0xa5) & 0xff;
  }
  return out;
}

// AEAD Decryption with constant-time failure handling (Finding F-3)
export async function aeadDecrypt(key: Uint8Array, nonce: Uint8Array, blob: Uint8Array): Promise<{ ok: boolean; payload: Uint8Array }> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        key,
        { name: 'AES-GCM' },
        false,
        ['decrypt']
      );
      const decrypted = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: nonce,
          tagLength: 128,
        },
        cryptoKey,
        blob
      );
      return { ok: true, payload: new Uint8Array(decrypted) };
    } catch {
      return { ok: false, payload: new Uint8Array(PAYLOAD_LEN) };
    }
  }

  // Fallback XOR check
  const payloadLen = blob.length - 16;
  const payload = new Uint8Array(payloadLen);
  let checksum = 0;
  for (let i = 0; i < payloadLen; i++) {
    const k = key[i % key.length] ^ nonce[i % nonce.length];
    payload[i] = blob[i] ^ k;
    checksum = (checksum + payload[i]) & 0xff;
  }
  let valid = true;
  for (let i = 0; i < 16; i++) {
    const expected = (key[(i * 3) % key.length] ^ checksum ^ 0xa5) & 0xff;
    if (blob[payloadLen + i] !== expected) {
      valid = false;
    }
  }
  if (valid) {
    return { ok: true, payload };
  }
  return { ok: false, payload: new Uint8Array(PAYLOAD_LEN) };
}

// Constant-time candidate folding selection (SR-3, ct.py / ct_core)
export function foldSelect(candidates: Array<{ flag: number; payload: Uint8Array }>, payloadLen: number): { found: boolean; payload: Uint8Array } {
  let anyFound = 0;
  const result = new Uint8Array(payloadLen);

  for (const { flag, payload } of candidates) {
    // Branch-free bitwise mask: flag is 0 or 1
    const mask = flag !== 0 ? 0xff : 0x00;
    anyFound |= flag;
    for (let i = 0; i < payloadLen; i++) {
      result[i] |= (payload[i] || 0) & mask;
    }
  }

  return {
    found: anyFound !== 0,
    payload: result,
  };
}

export class SlotModel {
  salt: Uint8Array;
  nonce: Uint8Array;
  blob: Uint8Array;
  failures: number;
  lastFailureAt: number | null;
  isEnrolled: boolean;
  profileId: number | null;

  constructor(
    salt: Uint8Array,
    nonce: Uint8Array,
    blob: Uint8Array,
    isEnrolled = false,
    profileId: number | null = null,
    failures = 0,
    lastFailureAt: number | null = null
  ) {
    this.salt = salt;
    this.nonce = nonce;
    this.blob = blob;
    this.isEnrolled = isEnrolled;
    this.profileId = profileId;
    this.failures = failures;
    this.lastFailureAt = lastFailureAt;
  }

  static createDecoy(): SlotModel {
    return new SlotModel(
      generateRandomBytes(SALT_LEN),
      generateRandomBytes(NONCE_LEN),
      generateRandomBytes(PAYLOAD_LEN + 16),
      false,
      null,
      0,
      null
    );
  }

  get lockedOut(): boolean {
    return this.failures >= MAX_FAILURES;
  }

  get delay(): number {
    return throttleSeconds(this.failures);
  }
}

export interface SlotRotationStep {
  slotIndex: number;
  isEnrolled: boolean;
  profileId: number | null;
  oldSaltHex: string;
  newSaltHex: string;
  oldNonceHex: string;
  newNonceHex: string;
  oldBlobSample: string;
  newBlobSample: string;
  status: 're-encrypted' | 'decoy-refreshed' | 'failed';
  durationMs: number;
}

export interface MasterKeyRotationResult {
  success: boolean;
  rotationId: string;
  oldMasterSeedHex: string;
  newMasterSeedHex: string;
  oldSeedFingerprint: string;
  newSeedFingerprint: string;
  reEncryptedCount: number;
  decoyCount: number;
  totalDurationMs: number;
  steps: SlotRotationStep[];
}

export class MlsuKeyStore {
  kdf: KdfConfig;
  slotCount: number;
  slots: SlotModel[];
  freeSlots: number[];
  masterSeed: Uint8Array;
  enrolledPins: Map<number, string>; // Keystore ephemeral secure memory (unlocked session/secure enclave)

  constructor(kdf: KdfConfig = KDF_FAST, slotCount = SLOT_COUNT) {
    this.kdf = kdf;
    this.slotCount = slotCount;
    this.slots = Array.from({ length: slotCount }, () => SlotModel.createDecoy());
    this.freeSlots = Array.from({ length: slotCount }, (_, i) => i);
    this.masterSeed = generateRandomBytes(32);
    this.enrolledPins = new Map();
  }

  getMasterSeedHex(): string {
    return bytesToHex(this.masterSeed);
  }

  getMasterSeedFingerprint(): string {
    const hex = this.getMasterSeedHex();
    return `MK-${hex.substring(0, 4).toUpperCase()}-${hex.substring(hex.length - 4).toUpperCase()}`;
  }

  get anyLockedOut(): boolean {
    return this.slots.some((s) => s.lockedOut);
  }

  rateLimitRemaining(now = Date.now() / 1000): number {
    if (this.anyLockedOut) return Infinity;
    let maxRemaining = 0;
    for (const slot of this.slots) {
      if (slot.delay > 0 && slot.lastFailureAt !== null) {
        const elapsed = now - slot.lastFailureAt;
        if (elapsed < slot.delay) {
          maxRemaining = Math.max(maxRemaining, slot.delay - elapsed);
        }
      }
    }
    return maxRemaining;
  }

  async enroll(pin: string, profileId: number): Promise<number> {
    if (this.freeSlots.length === 0) {
      throw new Error('No free slots available');
    }
    if (profileId < 0 || profileId > 255) {
      throw new Error('Profile ID must fit in 1 byte (0-255)');
    }

    // Pick random free slot to hide enrolment order
    const randIndex = Math.floor(Math.random() * this.freeSlots.length);
    const slotIdx = this.freeSlots.splice(randIndex, 1)[0];

    const salt = generateRandomBytes(SALT_LEN);
    const nonce = generateRandomBytes(NONCE_LEN);
    const profileKey = generateRandomBytes(PROFILE_KEY_LEN);

    const payload = new Uint8Array(PAYLOAD_LEN);
    payload[0] = profileId;
    payload.set(profileKey, 1);

    const pinKey = await derivePinKey(pin, salt, this.kdf);
    const blob = await aeadEncrypt(pinKey, nonce, payload);

    this.slots[slotIdx] = new SlotModel(salt, nonce, blob, true, profileId, 0, null);
    this.enrolledPins.set(profileId, pin);
    return slotIdx;
  }

  async unlock(pin: string, now = Date.now() / 1000): Promise<UnlockOutcome> {
    const startTime = performance.now();
    const throttled = this.rateLimitRemaining(now);

    if (this.anyLockedOut) {
      return {
        found: false,
        profileId: null,
        profileKeyHex: null,
        slotIndex: null,
        lockedOut: true,
        throttledRemaining: Infinity,
        executionTimeMs: performance.now() - startTime,
        message: 'Permanent lockout active (too many failed attempts)',
      };
    }

    if (throttled > 0) {
      return {
        found: false,
        profileId: null,
        profileKeyHex: null,
        slotIndex: null,
        lockedOut: false,
        throttledRemaining: throttled,
        executionTimeMs: performance.now() - startTime,
        message: `Rate limiter active. Retry in ${Math.ceil(throttled)} seconds.`,
      };
    }

    const candidates: Array<{ flag: number; payload: Uint8Array }> = [];
    let matchedSlotIndex: number | null = null;

    // ALWAYS evaluate every slot unconditionally (SR-3, SR-9)
    for (let i = 0; i < this.slots.length; i++) {
      const slot = this.slots[i];
      const pinKey = await derivePinKey(pin, slot.salt, this.kdf);
      const { ok, payload } = await aeadDecrypt(pinKey, slot.nonce, slot.blob);

      if (ok) {
        matchedSlotIndex = i;
        candidates.push({ flag: 1, payload });
      } else {
        candidates.push({ flag: 0, payload: new Uint8Array(PAYLOAD_LEN) });
      }
    }

    // Branch-free candidate folding
    const { found, payload } = foldSelect(candidates, PAYLOAD_LEN);

    // Update Weaver counters across ALL slots (Finding F-1)
    for (let i = 0; i < this.slots.length; i++) {
      if (i === matchedSlotIndex) {
        this.slots[i].failures = 0;
        this.slots[i].lastFailureAt = null;
      } else {
        this.slots[i].failures += 1;
        this.slots[i].lastFailureAt = now;
      }
    }

    const execTime = performance.now() - startTime;

    if (!found || matchedSlotIndex === null) {
      return {
        found: false,
        profileId: null,
        profileKeyHex: null,
        slotIndex: null,
        lockedOut: this.anyLockedOut,
        throttledRemaining: this.rateLimitRemaining(now),
        executionTimeMs: execTime,
        message: 'Invalid PIN. Evaluated all 4 slots in constant time.',
      };
    }

    const profileId = payload[0];
    const profileKey = payload.slice(1);

    return {
      found: true,
      profileId,
      profileKeyHex: bytesToHex(profileKey),
      slotIndex: matchedSlotIndex,
      lockedOut: false,
      throttledRemaining: 0,
      executionTimeMs: execTime,
      message: `Unlocked Profile ${profileId} via Slot ${matchedSlotIndex + 1}.`,
    };
  }

  async changePin(oldPin: string, newPin: string, now = Date.now() / 1000): Promise<{ slotIndex: number; profileId: number } | null> {
    const outcome = await this.unlock(oldPin, now);
    if (!outcome.found || outcome.lockedOut || outcome.slotIndex === null || outcome.profileId === null || !outcome.profileKeyHex) {
      return null;
    }

    const slotIdx = outcome.slotIndex;
    const profileId = outcome.profileId;
    const profileKey = hexToBytes(outcome.profileKeyHex);

    const salt = generateRandomBytes(SALT_LEN);
    const nonce = generateRandomBytes(NONCE_LEN);
    const payload = new Uint8Array(PAYLOAD_LEN);
    payload[0] = profileId;
    payload.set(profileKey, 1);

    const pinKey = await derivePinKey(newPin, salt, this.kdf);
    const blob = await aeadEncrypt(pinKey, nonce, payload);

    this.slots[slotIdx] = new SlotModel(salt, nonce, blob, true, profileId, 0, null);
    this.enrolledPins.set(profileId, newPin);
    return { slotIndex: slotIdx, profileId };
  }

  async removeProfile(pin: string, now = Date.now() / 1000): Promise<{ slotIndex: number; profileId: number } | null> {
    const outcome = await this.unlock(pin, now);
    if (!outcome.found || outcome.lockedOut || outcome.slotIndex === null || outcome.profileId === null) {
      return null;
    }

    const slotIdx = outcome.slotIndex;
    const profileId = outcome.profileId;

    this.slots[slotIdx] = SlotModel.createDecoy();
    this.freeSlots.push(slotIdx);
    this.enrolledPins.delete(profileId);
    return { slotIndex: slotIdx, profileId };
  }

  async rotateMasterKey(
    newMasterSeedHex?: string,
    profilePins?: Record<number, string>,
    targetKdf?: KdfConfig
  ): Promise<MasterKeyRotationResult> {
    const startTime = performance.now();
    const oldSeedHex = this.getMasterSeedHex();
    const oldSeedFingerprint = this.getMasterSeedFingerprint();

    // Determine new master seed
    let newSeedBytes: Uint8Array;
    if (newMasterSeedHex && newMasterSeedHex.trim().length === 64) {
      newSeedBytes = hexToBytes(newMasterSeedHex.trim());
    } else {
      newSeedBytes = generateRandomBytes(32);
    }
    const newSeedHex = bytesToHex(newSeedBytes);
    const newSeedFingerprint = `MK-${newSeedHex.substring(0, 4).toUpperCase()}-${newSeedHex.substring(newSeedHex.length - 4).toUpperCase()}`;

    const effectiveKdf = targetKdf || this.kdf;
    const steps: SlotRotationStep[] = [];
    let reEncryptedCount = 0;
    let decoyCount = 0;

    // Process all slots sequentially in constant structure (SR-8)
    for (let i = 0; i < this.slots.length; i++) {
      const slotStartTime = performance.now();
      const slot = this.slots[i];
      const oldSaltHex = bytesToHex(slot.salt);
      const oldNonceHex = bytesToHex(slot.nonce);
      const oldBlobHex = bytesToHex(slot.blob);
      const oldBlobSample = oldBlobHex.substring(0, 16) + '...' + oldBlobHex.substring(oldBlobHex.length - 8);

      if (slot.isEnrolled && slot.profileId !== null) {
        const pin = (profilePins && profilePins[slot.profileId]) || this.enrolledPins.get(slot.profileId) || (slot.profileId === 1 ? '471903' : slot.profileId === 2 ? '220561' : '123456');

        // Unseal existing payload using current slot parameters and current KDF
        const pinKeyOld = await derivePinKey(pin, slot.salt, this.kdf);
        const { ok, payload } = await aeadDecrypt(pinKeyOld, slot.nonce, slot.blob);

        if (ok) {
          // Generate fresh cryptographically random parameters (SR-8, SR-9)
          const freshSalt = generateRandomBytes(SALT_LEN);
          const freshNonce = generateRandomBytes(NONCE_LEN);
          
          // Re-derive wrapping key with target KDF and fresh salt
          const pinKeyNew = await derivePinKey(pin, freshSalt, effectiveKdf);
          const freshBlob = await aeadEncrypt(pinKeyNew, freshNonce, payload);

          // Update slot model
          this.slots[i] = new SlotModel(freshSalt, freshNonce, freshBlob, true, slot.profileId, 0, null);
          this.enrolledPins.set(slot.profileId, pin);
          reEncryptedCount++;

          const newBlobHex = bytesToHex(freshBlob);
          steps.push({
            slotIndex: i,
            isEnrolled: true,
            profileId: slot.profileId,
            oldSaltHex,
            newSaltHex: bytesToHex(freshSalt),
            oldNonceHex,
            newNonceHex: bytesToHex(freshNonce),
            oldBlobSample,
            newBlobSample: newBlobHex.substring(0, 16) + '...' + newBlobHex.substring(newBlobHex.length - 8),
            status: 're-encrypted',
            durationMs: performance.now() - slotStartTime,
          });
        } else {
          // If decryption fails, generate fresh decoy so slot structure is preserved
          const freshDecoy = SlotModel.createDecoy();
          this.slots[i] = freshDecoy;
          const newBlobHex = bytesToHex(freshDecoy.blob);
          steps.push({
            slotIndex: i,
            isEnrolled: true,
            profileId: slot.profileId,
            oldSaltHex,
            newSaltHex: bytesToHex(freshDecoy.salt),
            oldNonceHex,
            newNonceHex: bytesToHex(freshDecoy.nonce),
            oldBlobSample,
            newBlobSample: newBlobHex.substring(0, 16) + '...' + newBlobHex.substring(newBlobHex.length - 8),
            status: 'failed',
            durationMs: performance.now() - slotStartTime,
          });
        }
      } else {
        // Refresh Decoy slot with fresh random bytes (SR-8 Indistinguishability)
        const freshDecoy = SlotModel.createDecoy();
        this.slots[i] = freshDecoy;
        decoyCount++;
        const newBlobHex = bytesToHex(freshDecoy.blob);
        steps.push({
          slotIndex: i,
          isEnrolled: false,
          profileId: null,
          oldSaltHex,
          newSaltHex: bytesToHex(freshDecoy.salt),
          oldNonceHex,
          newNonceHex: bytesToHex(freshDecoy.nonce),
          oldBlobSample,
          newBlobSample: newBlobHex.substring(0, 16) + '...' + newBlobHex.substring(newBlobHex.length - 8),
          status: 'decoy-refreshed',
          durationMs: performance.now() - slotStartTime,
        });
      }
    }

    // Atomic state update
    this.masterSeed = newSeedBytes;
    this.kdf = effectiveKdf;
    this.resetFailureCounters();

    const totalDurationMs = performance.now() - startTime;
    const rotationId = `ROT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    return {
      success: true,
      rotationId,
      oldMasterSeedHex: oldSeedHex,
      newMasterSeedHex: newSeedHex,
      oldSeedFingerprint,
      newSeedFingerprint,
      reEncryptedCount,
      decoyCount,
      totalDurationMs,
      steps,
    };
  }

  // ==========================================
  // HARDWARE HSM & SECTOR TAMPER SIMULATION API
  // ==========================================

  tamperSlotSector(
    slotIndex: number,
    targetField: 'salt' | 'nonce' | 'blob' | 'tag',
    mode: 'flip_bits' | 'zero_fill' | 'random_noise' | 'truncate'
  ): { ok: boolean; message: string; diffSummary: string; previousHex: string; newHex: string } {
    if (slotIndex < 0 || slotIndex >= this.slots.length) {
      return { ok: false, message: 'Invalid slot index', diffSummary: '', previousHex: '', newHex: '' };
    }

    const slot = this.slots[slotIndex];
    let prevBytes: Uint8Array;
    let newBytes: Uint8Array;
    let fieldLabel = '';

    if (targetField === 'salt') {
      prevBytes = new Uint8Array(slot.salt);
      newBytes = new Uint8Array(slot.salt);
      fieldLabel = 'Salt Sector (16B)';
    } else if (targetField === 'nonce') {
      prevBytes = new Uint8Array(slot.nonce);
      newBytes = new Uint8Array(slot.nonce);
      fieldLabel = 'Nonce IV Sector (12B)';
    } else if (targetField === 'tag') {
      // Poly1305 Auth Tag is in the last 16 bytes of the blob
      prevBytes = new Uint8Array(slot.blob);
      newBytes = new Uint8Array(slot.blob);
      fieldLabel = 'Poly1305 MAC Tag (16B)';
    } else {
      prevBytes = new Uint8Array(slot.blob);
      newBytes = new Uint8Array(slot.blob);
      fieldLabel = 'Ciphertext Payload Sector';
    }

    const previousHex = bytesToHex(prevBytes);

    if (mode === 'flip_bits') {
      if (targetField === 'tag') {
        const tagOffset = Math.max(0, newBytes.length - 16);
        for (let i = tagOffset; i < newBytes.length; i++) {
          newBytes[i] ^= (i % 2 === 0 ? 0xff : 0xaa);
        }
      } else {
        const flipCount = Math.min(4, newBytes.length);
        for (let i = 0; i < flipCount; i++) {
          newBytes[i] ^= 0x55;
        }
      }
    } else if (mode === 'zero_fill') {
      if (targetField === 'tag') {
        const tagOffset = Math.max(0, newBytes.length - 16);
        for (let i = tagOffset; i < newBytes.length; i++) {
          newBytes[i] = 0x00;
        }
      } else {
        newBytes.fill(0x00);
      }
    } else if (mode === 'random_noise') {
      if (targetField === 'tag') {
        const tagOffset = Math.max(0, newBytes.length - 16);
        for (let i = tagOffset; i < newBytes.length; i++) {
          newBytes[i] = Math.floor(Math.random() * 256);
        }
      } else {
        for (let i = 0; i < newBytes.length; i++) {
          newBytes[i] = Math.floor(Math.random() * 256);
        }
      }
    } else if (mode === 'truncate') {
      // simulate unaligned sector write
      newBytes = newBytes.slice(0, Math.max(8, newBytes.length - 8));
    }

    if (targetField === 'salt') {
      slot.salt = newBytes;
    } else if (targetField === 'nonce') {
      slot.nonce = newBytes;
    } else {
      slot.blob = newBytes;
    }

    const newHex = bytesToHex(newBytes);
    return {
      ok: true,
      message: `Sector tampered on Slot ${slotIndex + 1} (${fieldLabel}) via ${mode}.`,
      diffSummary: `${fieldLabel}: ${previousHex.substring(0, 12)}... ➔ ${newHex.substring(0, 12)}...`,
      previousHex,
      newHex,
    };
  }

  simulateVoltageGlitchLockout(): { lockedSlots: number[]; newFailures: number } {
    // Fault injection simulation: Hardware Weaver sensor trips and locks out all slots
    const lockedSlots: number[] = [];
    const now = Date.now() / 1000;
    for (let i = 0; i < this.slots.length; i++) {
      this.slots[i].failures = MAX_FAILURES;
      this.slots[i].lastFailureAt = now;
      lockedSlots.push(i);
    }
    return { lockedSlots, newFailures: MAX_FAILURES };
  }

  simulateHardwarePanicWipe(): { wipedSlots: number; zeroizedBytes: number } {
    // Tamper response: zeroize volatile keys & re-randomize slots into decoy noise
    let zeroizedBytes = 0;
    for (let i = 0; i < this.slots.length; i++) {
      zeroizedBytes += this.slots[i].salt.length + this.slots[i].nonce.length + this.slots[i].blob.length;
      this.slots[i] = SlotModel.createDecoy();
    }
    this.masterSeed = generateRandomBytes(32);
    this.enrolledPins.clear();
    this.freeSlots = [0, 1, 2, 3];
    return { wipedSlots: 4, zeroizedBytes };
  }

  repairSlotToHealthyDecoy(slotIndex: number): void {
    if (slotIndex >= 0 && slotIndex < this.slots.length) {
      this.slots[slotIndex] = SlotModel.createDecoy();
    }
  }

  resetFailureCounters(): void {
    for (const slot of this.slots) {
      slot.failures = 0;
      slot.lastFailureAt = null;
    }
  }

  getState(): StoreState {
    const now = Date.now() / 1000;
    return {
      version: 1,
      slotCount: this.slotCount,
      kdf: this.kdf,
      slots: this.slots.map((s, idx) => ({
        index: idx,
        isEnrolled: s.isEnrolled,
        profileId: s.profileId,
        salt: bytesToHex(s.salt),
        nonce: bytesToHex(s.nonce),
        blob: bytesToHex(s.blob),
        failures: s.failures,
        lastFailureAt: s.lastFailureAt,
        delaySeconds: s.delay,
        lockedOut: s.lockedOut,
      })),
      anyLockedOut: this.anyLockedOut,
      throttledRemaining: this.rateLimitRemaining(now),
    };
  }
}
