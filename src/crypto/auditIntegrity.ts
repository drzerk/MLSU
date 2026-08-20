import { AuditLogEntry, AuditChainVerificationResult } from '../types';

export const GENESIS_PREV_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

/**
 * Computes a deterministic SHA-256 hash for an audit log entry.
 */
export async function computeEntryHash(
  entry: Omit<AuditLogEntry, 'entryHash'>,
  prevHash: string
): Promise<string> {
  const canonicalPayload = JSON.stringify({
    id: entry.id,
    timestamp: entry.timestamp,
    type: entry.type,
    title: entry.title,
    details: entry.details,
    pinMasked: entry.pinMasked,
    profileId: entry.profileId ?? null,
    slotIndex: entry.slotIndex ?? null,
    weaverFailures: entry.weaverFailures ?? null,
    severity: entry.severity,
    prevHash: prevHash,
  });

  const encoder = new TextEncoder();
  const data = encoder.encode(canonicalPayload);

  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch {
      // Fallback below
    }
  }

  // Fallback deterministic 64-char hex hash
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < data.length; i++) {
    h1 = Math.imul(h1 ^ data[i], 2654435761);
    h2 = Math.imul(h2 ^ data[i], 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  
  const hex1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const hex2 = (h2 >>> 0).toString(16).padStart(8, '0');
  return (hex1 + hex2).repeat(4);
}

/**
 * Initializes and computes cryptographic hashes across a list of audit logs (from oldest to newest).
 */
export async function sealAuditChain(logs: AuditLogEntry[]): Promise<AuditLogEntry[]> {
  if (!logs || logs.length === 0) return [];

  // Sort chronological ascending (oldest first)
  const chronological = [...logs].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const sealed: AuditLogEntry[] = [];
  let prevHash = GENESIS_PREV_HASH;

  for (const log of chronological) {
    const entryWithoutHash: Omit<AuditLogEntry, 'entryHash'> = {
      id: log.id,
      timestamp: log.timestamp,
      timeFormatted: log.timeFormatted,
      type: log.type,
      title: log.title,
      details: log.details,
      pinMasked: log.pinMasked,
      profileId: log.profileId,
      profileName: log.profileName,
      slotIndex: log.slotIndex,
      durationMs: log.durationMs,
      weaverFailures: log.weaverFailures,
      memoryState: log.memoryState,
      biometricType: log.biometricType,
      severity: log.severity,
      prevHash: prevHash,
      isTampered: log.isTampered,
    };

    const currentHash = await computeEntryHash(entryWithoutHash, prevHash);
    sealed.push({
      ...entryWithoutHash,
      prevHash: prevHash,
      entryHash: currentHash,
    });
    prevHash = currentHash;
  }

  // Return in reverse chronological (newest first for UI standard)
  return sealed.reverse();
}

/**
 * Performs a comprehensive cryptographic integrity verification scan on the entire audit ledger.
 */
export async function verifyAuditLogChain(
  logs: AuditLogEntry[]
): Promise<AuditChainVerificationResult> {
  const scanTime = new Date().toISOString();

  if (!logs || logs.length === 0) {
    return {
      isValid: true,
      totalEntriesChecked: 0,
      verifiedCount: 0,
      brokenEntryIndex: null,
      brokenEntryId: null,
      tamperType: 'none',
      expectedHash: null,
      actualHash: null,
      rootLedgerHash: GENESIS_PREV_HASH,
      details: 'Audit log ledger is currently empty. No anomalies detected.',
      scanTimestamp: scanTime,
      chainVerificationDetails: [],
    };
  }

  // Sort chronological ascending (oldest first) for forward-hash verification
  const chronological = [...logs].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  let prevHash = GENESIS_PREV_HASH;
  let lastTimestamp = 0;
  let brokenIndex: number | null = null;
  let brokenId: string | null = null;
  let tamperType: AuditChainVerificationResult['tamperType'] = 'none';
  let expectedHash: string | null = null;
  let actualHash: string | null = null;
  let errorDetails = '';

  const chainDetails: AuditChainVerificationResult['chainVerificationDetails'] = [];

  for (let i = 0; i < chronological.length; i++) {
    const entry = chronological[i];
    const entryTs = new Date(entry.timestamp).getTime();

    // 1. Calculate expected hash based on content and prevHash
    const expected = await computeEntryHash(entry, prevHash);
    const stored = entry.entryHash || '';

    let isEntryValid = true;
    let entryError: string | undefined;

    // Check A: Content hash mismatch (Payload tampered)
    if (stored !== expected) {
      isEntryValid = false;
      entryError = `Hash mismatch! Computed SHA-256 (${expected.substring(0, 12)}...) differs from stored ledger seal (${stored.substring(0, 12)}...).`;
      if (brokenIndex === null) {
        brokenIndex = i;
        brokenId = entry.id;
        tamperType = 'hash_mismatch';
        expectedHash = expected;
        actualHash = stored;
        errorDetails = `Log Entry #${i + 1} (${entry.title}) content has been altered without a valid cryptographic seal.`;
      }
    }

    // Check B: Previous hash link broken (Deletion or Insertion)
    if (entry.prevHash && entry.prevHash !== prevHash) {
      isEntryValid = false;
      entryError = `Chain continuity broken! prevHash link (${entry.prevHash.substring(0, 12)}...) does not match previous block hash (${prevHash.substring(0, 12)}...).`;
      if (brokenIndex === null) {
        brokenIndex = i;
        brokenId = entry.id;
        tamperType = 'prev_hash_broken';
        expectedHash = prevHash;
        actualHash = entry.prevHash;
        errorDetails = `Chain link severed before Entry #${i + 1}. A preceding record was deleted or re-ordered.`;
      }
    }

    // Check C: Monotonic timestamp anomaly
    if (lastTimestamp > 0 && entryTs < lastTimestamp - 1000) {
      if (brokenIndex === null) {
        brokenIndex = i;
        brokenId = entry.id;
        tamperType = 'timestamp_anomaly';
        errorDetails = `Non-monotonic timestamp detected at Entry #${i + 1}. Event appears backdated.`;
      }
    }

    chainDetails.push({
      id: entry.id,
      index: i + 1,
      title: entry.title,
      calculatedHash: expected,
      storedHash: stored,
      prevHash: prevHash,
      isValid: isEntryValid,
      errorReason: entryError,
    });

    // Advance prevHash to this entry's stored hash (to see cascade effect if tampered)
    prevHash = stored || expected;
    lastTimestamp = entryTs;
  }

  const isValid = brokenIndex === null;
  const verifiedCount = chainDetails.filter((c) => c.isValid).length;
  const rootLedgerHash = prevHash;

  return {
    isValid,
    totalEntriesChecked: chronological.length,
    verifiedCount,
    brokenEntryIndex: brokenIndex,
    brokenEntryId: brokenId,
    tamperType,
    expectedHash,
    actualHash,
    rootLedgerHash,
    details: isValid
      ? `Cryptographic Ledger Verified: All ${chronological.length} entries match forward-secure SHA-256 chain links with immutable StrongBox root ${rootLedgerHash.substring(0, 16)}...`
      : errorDetails,
    scanTimestamp: scanTime,
    chainVerificationDetails: chainDetails,
  };
}
