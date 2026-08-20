export interface KdfConfig {
  name: 'fast' | 'strong';
  timeCost: number;
  memoryCostKiB: number;
  parallelism: number;
  hashLen: number;
}

export interface SlotData {
  index: number;
  isEnrolled: boolean;
  profileId: number | null;
  salt: string; // hex
  nonce: string; // hex
  blob: string; // hex
  failures: number;
  lastFailureAt: number | null;
  delaySeconds: number;
  lockedOut: boolean;
}

export interface UnlockOutcome {
  found: boolean;
  profileId: number | null;
  profileKeyHex: string | null;
  slotIndex: number | null;
  lockedOut: boolean;
  throttledRemaining: number;
  executionTimeMs: number;
  message: string;
}

export interface StoreState {
  version: number;
  slotCount: number;
  kdf: KdfConfig;
  slots: SlotData[];
  anyLockedOut: boolean;
  throttledRemaining: number;
}

export interface ProfileData {
  id: number;
  name: string;
  pin: string;
  type: 'private' | 'restricted';
  tagline: string;
  notes: Array<{ id: string; title: string; content: string; date: string; category: string }>;
  contacts: Array<{ id: string; name: string; role: string; phone: string; avatarColor: string }>;
  messages: Array<{ id: string; sender: string; preview: string; time: string; unread: boolean }>;
  gallery: Array<{ id: string; caption: string; icon: string; tag: string }>;
  vaultItems?: Array<{ id: string; service: string; username: string; secret: string }>;
}

export interface BenchmarkResult {
  sampleIndex: number;
  pinType: 'private_hit' | 'duress_hit' | 'wrong_pin_miss' | 'random_hex';
  durationMs: number;
}

export type ViewTab = 'phone' | 'scenario' | 'inspector' | 'hsm' | 'cli' | 'benchmark' | 'docs';
export type Language = 'en' | 'de';

export type AuditLogType = 
  | 'auth_success'
  | 'auth_failure'
  | 'biometric_success'
  | 'biometric_failure'
  | 'profile_switch'
  | 'device_lock'
  | 'weaver_throttle'
  | 'weaver_lockout'
  | 'counter_reset'
  | 'profile_enroll'
  | 'master_key_rotation'
  | 'hsm_tamper_detected'
  | 'hsm_sector_corrupted'
  | 'hsm_tamper_recovered'
  | 'hsm_panic_wipe'
  | 'audit_integrity_verified'
  | 'audit_tamper_detected'
  | 'audit_ledger_healed';

export interface AuditLogEntry {
  id: string;
  timestamp: string; // ISO string
  timeFormatted: string; // HH:MM:SS.mmm
  type: AuditLogType;
  title: string;
  details: string;
  pinMasked: string;
  profileId?: number | null;
  profileName?: string | null;
  slotIndex?: number | null;
  durationMs?: number;
  weaverFailures?: number;
  memoryState?: string;
  biometricType?: 'fingerprint' | 'face';
  severity: 'success' | 'warning' | 'error' | 'info';
  entryHash?: string;
  prevHash?: string;
  isTampered?: boolean;
}

export interface AuditChainVerificationResult {
  isValid: boolean;
  totalEntriesChecked: number;
  verifiedCount: number;
  brokenEntryIndex: number | null;
  brokenEntryId: string | null;
  tamperType: 'none' | 'hash_mismatch' | 'prev_hash_broken' | 'timestamp_anomaly' | 'unauthorized_deletion' | 'record_forgery';
  expectedHash: string | null;
  actualHash: string | null;
  rootLedgerHash: string;
  details: string;
  scanTimestamp: string;
  chainVerificationDetails: Array<{
    id: string;
    index: number;
    title: string;
    calculatedHash: string;
    storedHash: string;
    prevHash: string;
    isValid: boolean;
    errorReason?: string;
  }>;
}

export type AuditLogFilter = 'all' | 'success' | 'failure' | 'biometrics' | 'transitions' | 'lockout' | 'rotation' | 'tamper';

export interface BiometricFingerprint {
  id: string;
  name: string;
  finger: string;
  profileId: number;
  profileName: string;
  pin: string;
  enrolledDate: string;
  sensorColor: string;
}

export type BiometricMode = 'direct_unlock' | 'two_factor_verification' | 'disabled';
export type BiometricSensorType = 'fingerprint' | 'face';
