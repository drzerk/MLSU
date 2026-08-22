import { AuditLogEntry } from '../types';

/**
 * Escapes a single CSV value following RFC 4180:
 * - If the value contains commas, double quotes, or newlines, enclose in double quotes
 * - Any double quote inside the value is escaped as two double quotes ("")
 */
export function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Transforms an array of AuditLogEntry objects into a standard CSV string.
 * Features full forensic headers and UTF-8 compliance for security analyst tools (SIEM, Pandas, Excel, Splunk).
 */
export function formatAuditLogsAsCSV(logs: AuditLogEntry[]): string {
  const headers = [
    'Log ID',
    'Timestamp (ISO 8601)',
    'Time (Local)',
    'Event Type',
    'Severity',
    'Event Title',
    'Event Details',
    'Target Profile ID',
    'Profile Name',
    'Slot Index',
    'Masked PIN',
    'Weaver Failures',
    'Duration (ms)',
    'Biometric Type',
    'Memory State',
    'SHA-256 Entry Hash',
    'Previous Hash',
    'Tampered Flag',
  ];

  const rows = logs.map((log) => [
    escapeCsvField(log.id),
    escapeCsvField(log.timestamp),
    escapeCsvField(log.timeFormatted),
    escapeCsvField(log.type),
    escapeCsvField(log.severity),
    escapeCsvField(log.title),
    escapeCsvField(log.details),
    escapeCsvField(log.profileId !== null && log.profileId !== undefined ? log.profileId : ''),
    escapeCsvField(log.profileName || ''),
    escapeCsvField(log.slotIndex !== null && log.slotIndex !== undefined ? log.slotIndex : ''),
    escapeCsvField(log.pinMasked || ''),
    escapeCsvField(log.weaverFailures !== undefined ? log.weaverFailures : 0),
    escapeCsvField(log.durationMs !== undefined ? log.durationMs : ''),
    escapeCsvField(log.biometricType || ''),
    escapeCsvField(log.memoryState || ''),
    escapeCsvField(log.entryHash || ''),
    escapeCsvField(log.prevHash || ''),
    escapeCsvField(log.isTampered ? 'TRUE' : 'FALSE'),
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.join(',')),
  ].join('\r\n');

  return csvContent;
}

/**
 * Triggers a browser download of the audit logs as a CSV file.
 * Prepends UTF-8 BOM (\uFEFF) for compatibility with Excel, LibreOffice, and SIEM parsers.
 */
export function downloadAuditLogsCSV(
  logs: AuditLogEntry[],
  filenamePrefix: string = 'mlsu-audit-forensic'
): void {
  const csvContent = formatAuditLogsAsCSV(logs);
  // Add UTF-8 Byte Order Mark (BOM) to guarantee clean import in Microsoft Excel & Pandas
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
  const filename = `${filenamePrefix}-${timestamp}.csv`;

  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
