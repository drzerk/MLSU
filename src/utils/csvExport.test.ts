import { describe, it, expect } from 'vitest';
import { formatAuditLogsAsCSV, escapeCsvField } from './csvExport';
import { AuditLogEntry } from '../types';

describe('CSV Export Utility', () => {
  it('correctly escapes special characters according to RFC 4180', () => {
    expect(escapeCsvField('simple')).toBe('simple');
    expect(escapeCsvField('contains, comma')).toBe('"contains, comma"');
    expect(escapeCsvField('quote "test" here')).toBe('"quote ""test"" here"');
    expect(escapeCsvField('multi\nline')).toBe('"multi\nline"');
    expect(escapeCsvField(null)).toBe('');
    expect(escapeCsvField(undefined)).toBe('');
  });

  it('formats audit logs into a compliant CSV string with all required headers', () => {
    const mockLogs: AuditLogEntry[] = [
      {
        id: 'log-1',
        timestamp: '2026-08-22T10:00:00.000Z',
        timeFormatted: '10:00:00.000',
        type: 'auth_success',
        title: 'Profile 1 Unlocked (Private Space)',
        details: 'Argon2id + AEAD authentication succeeded for Slot 1.',
        pinMasked: '•••••• (471903)',
        profileId: 1,
        profileName: 'Private Space',
        slotIndex: 0,
        weaverFailures: 0,
        durationMs: 42,
        memoryState: 'CE key mounted in RAM.',
        severity: 'success',
        entryHash: 'abc123hash',
        prevHash: 'genesis000',
        isTampered: false,
      },
      {
        id: 'log-2',
        timestamp: '2026-08-22T10:05:00.000Z',
        timeFormatted: '10:05:00.000',
        type: 'auth_failure',
        title: 'Authentication Failed (Wrong PIN)',
        details: 'Poly1305 MAC tag mismatch, no valid profile key derived.',
        pinMasked: '•••••• (999999)',
        weaverFailures: 1,
        severity: 'error',
        entryHash: 'def456hash',
        prevHash: 'abc123hash',
      },
    ];

    const csv = formatAuditLogsAsCSV(mockLogs);
    const lines = csv.split('\r\n');

    expect(lines.length).toBe(3); // 1 header line + 2 data rows
    expect(lines[0]).toContain('Log ID,Timestamp (ISO 8601),Time (Local),Event Type');
    expect(lines[0]).toContain('SHA-256 Entry Hash,Previous Hash,Tampered Flag');

    // Check first record row
    expect(lines[1]).toContain('log-1');
    expect(lines[1]).toContain('auth_success');
    expect(lines[1]).toContain('Private Space');
    expect(lines[1]).toContain('abc123hash');
    expect(lines[1]).toContain('FALSE');

    // Check second record row with commas in details
    expect(lines[2]).toContain('log-2');
    expect(lines[2]).toContain('auth_failure');
    expect(lines[2]).toContain('"Poly1305 MAC tag mismatch, no valid profile key derived."');
  });
});
