import { describe, expect, it } from 'vitest';
import {
  KDF_FAST,
  MAX_FAILURES,
  MlsuKeyStore,
  PAYLOAD_LEN,
  SLOT_COUNT,
  aeadDecrypt,
  aeadEncrypt,
  foldSelect,
  generateRandomBytes,
  throttleSeconds,
} from './mlsuEngine';

const PRIVATE_PIN = '471903';
const DURESS_PIN = '220561';
const WRONG_PIN = '000000';

async function enrolledStore(): Promise<MlsuKeyStore> {
  const store = new MlsuKeyStore(KDF_FAST, SLOT_COUNT);
  await store.enroll(PRIVATE_PIN, 1);
  await store.enroll(DURESS_PIN, 2);
  return store;
}

describe('foldSelect', () => {
  it('returns zeros when nothing matches', () => {
    const { found, payload } = foldSelect(
      [
        { flag: 0, payload: new Uint8Array([1, 2, 3]) },
        { flag: 0, payload: new Uint8Array([4, 5, 6]) },
      ],
      3
    );
    expect(found).toBe(false);
    expect(Array.from(payload)).toEqual([0, 0, 0]);
  });

  it('selects the matching payload without dropping other visits', () => {
    const target = new Uint8Array([9, 8, 7]);
    const { found, payload } = foldSelect(
      [
        { flag: 0, payload: new Uint8Array([1, 1, 1]) },
        { flag: 1, payload: target },
      ],
      3
    );
    expect(found).toBe(true);
    expect(Array.from(payload)).toEqual([9, 8, 7]);
  });
});

describe('MlsuKeyStore', () => {
  it('lets the PIN alone select the profile (FR-1)', async () => {
    const store = await enrolledStore();
    expect((await store.unlock(PRIVATE_PIN)).profileId).toBe(1);
    expect((await store.unlock(DURESS_PIN)).profileId).toBe(2);
    expect((await store.unlock(WRONG_PIN)).found).toBe(false);
  });

  it('generates independent profile keys (SR-1)', async () => {
    const store = await enrolledStore();
    const a = await store.unlock(PRIVATE_PIN);
    const b = await store.unlock(DURESS_PIN);
    expect(a.profileKeyHex).toBeTruthy();
    expect(b.profileKeyHex).toBeTruthy();
    expect(a.profileKeyHex).not.toBe(b.profileKeyHex);
  });

  it('charges every slot on a miss and only resets the hit (SR-4 / F-1)', async () => {
    const store = await enrolledStore();
    await store.unlock(WRONG_PIN);
    expect(store.slots.map((s) => s.failures)).toEqual([1, 1, 1, 1]);
    await store.unlock(PRIVATE_PIN);
    const matched = store.slots.find((s) => s.profileId === 1);
    expect(matched?.failures).toBe(0);
    const others = store.slots.filter((s) => s.profileId !== 1);
    expect(others.every((s) => s.failures === 1)).toBe(true);
  });

  it('evaluate does not mutate counters until commit', async () => {
    const store = await enrolledStore();
    const before = store.slots.map((s) => s.failures);
    await store.evaluate(WRONG_PIN);
    expect(store.slots.map((s) => s.failures)).toEqual(before);
  });

  it('reaches lockout by guessing alone', async () => {
    const store = await enrolledStore();
    let now = 1_700_000_000;
    for (let i = 0; i < MAX_FAILURES; i++) {
      await store.unlock(WRONG_PIN, now);
      now += 10_000;
    }
    expect(store.anyLockedOut).toBe(true);
    const last = await store.unlock(PRIVATE_PIN, now + 10_000);
    expect(last.found).toBe(false);
    expect(last.lockedOut).toBe(true);
  });

  it('keeps a session key only for the active profile and lock() drops it', async () => {
    const store = await enrolledStore();
    await store.unlock(PRIVATE_PIN);
    expect(store.activeProfileId).toBe(1);
    store.lock();
    expect(store.activeProfileId).toBeNull();
  });

  it('changePin keeps the same profile key', async () => {
    const store = await enrolledStore();
    const before = await store.unlock(PRIVATE_PIN);
    const changed = await store.changePin(PRIVATE_PIN, '135790');
    expect(changed?.profileId).toBe(1);
    const after = await store.unlock('135790');
    expect(after.profileKeyHex).toBe(before.profileKeyHex);
    expect((await store.unlock(PRIVATE_PIN)).found).toBe(false);
  });

  it('removeProfile turns the slot back into a decoy', async () => {
    const store = await enrolledStore();
    const removed = await store.removeProfile(PRIVATE_PIN);
    expect(removed?.profileId).toBe(1);
    expect((await store.unlock(PRIVATE_PIN)).found).toBe(false);
    expect((await store.unlock(DURESS_PIN)).profileId).toBe(2);
  });

  it('rejects a duplicate PIN and a full store', async () => {
    const store = new MlsuKeyStore(KDF_FAST, 3);
    await store.enroll('111111', 1);
    await store.enroll('222222', 2);
    await expect(store.enroll('111111', 3)).rejects.toThrow(/already/);
    await store.enroll('333333', 3);
    await expect(store.enroll('444444', 4)).rejects.toThrow(/No free slots/);
  });

  it('reinitialize rebuilds decoy slots', async () => {
    const store = await enrolledStore();
    store.reinitialize(4, KDF_FAST);
    expect(store.slots.every((s) => !s.isEnrolled)).toBe(true);
    expect(store.enrolledPins.size).toBe(0);
  });
});

describe('AEAD helper', () => {
  it('returns a flag instead of throwing on a bad tag (SR-12)', async () => {
    const key = generateRandomBytes(32);
    const nonce = generateRandomBytes(12);
    const { ok, payload } = await aeadDecrypt(key, nonce, generateRandomBytes(PAYLOAD_LEN + 16));
    expect(ok).toBe(false);
    expect(payload.length).toBe(PAYLOAD_LEN);
  });

  it('round-trips a valid payload', async () => {
    const key = generateRandomBytes(32);
    const nonce = generateRandomBytes(12);
    const payload = generateRandomBytes(PAYLOAD_LEN);
    const blob = await aeadEncrypt(key, nonce, payload);
    const { ok, payload: out } = await aeadDecrypt(key, nonce, blob);
    expect(ok).toBe(true);
    expect(Array.from(out)).toEqual(Array.from(payload));
  });
});

describe('throttle schedule', () => {
  it('matches the Weaver model steps', () => {
    expect(throttleSeconds(0)).toBe(0);
    expect(throttleSeconds(5)).toBe(30);
    expect(throttleSeconds(10)).toBe(300);
    expect(throttleSeconds(20)).toBe(3600);
  });
});
