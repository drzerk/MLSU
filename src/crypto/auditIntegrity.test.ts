import { describe, expect, it } from 'vitest';
import { AuditLogEntry } from '../types';
import { GENESIS_PREV_HASH, sealAuditChain, verifyAuditLogChain } from './auditIntegrity';

function sample(partial: Partial<AuditLogEntry>, index: number): AuditLogEntry {
  return {
    id: `e${index}`,
    timestamp: new Date(1_700_000_000_000 + index * 1000).toISOString(),
    timeFormatted: `00:00:0${index}.000`,
    type: 'auth_success',
    title: `Event ${index}`,
    details: 'ok',
    pinMasked: '••••',
    severity: 'info',
    ...partial,
  };
}

describe('audit hash chain', () => {
  it('seals an empty ledger as valid', async () => {
    const result = await verifyAuditLogChain([]);
    expect(result.isValid).toBe(true);
    expect(result.rootLedgerHash).toBe(GENESIS_PREV_HASH);
  });

  it('accepts a freshly sealed chain', async () => {
    const sealed = await sealAuditChain([sample({}, 1), sample({ type: 'auth_failure', title: 'miss' }, 2)]);
    const result = await verifyAuditLogChain(sealed);
    expect(result.isValid).toBe(true);
    expect(result.verifiedCount).toBe(2);
  });

  it('detects a mutated title', async () => {
    const sealed = await sealAuditChain([sample({}, 1), sample({}, 2), sample({}, 3)]);
    const tampered = sealed.map((entry, i) => (i === 1 ? { ...entry, title: 'forged' } : entry));
    const result = await verifyAuditLogChain(tampered);
    expect(result.isValid).toBe(false);
    expect(result.tamperType).toBe('hash_mismatch');
  });

  it('detects a broken prevHash link', async () => {
    const sealed = await sealAuditChain([sample({}, 1), sample({}, 2)]);
    const chronological = [...sealed].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    chronological[1] = { ...chronological[1], prevHash: 'aa'.repeat(32) };
    const result = await verifyAuditLogChain(chronological);
    expect(result.isValid).toBe(false);
    expect(['prev_hash_broken', 'hash_mismatch']).toContain(result.tamperType);
  });
});
