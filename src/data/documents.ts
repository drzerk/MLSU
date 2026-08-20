export interface ThreatLevel {
  id: string;
  adversary: string;
  capabilities: string;
  protection: string;
  badge: 'Complete' | 'High' | 'Partial' | 'Low' | 'None';
  badgeColor: string;
  notes: string;
}

export interface SecurityRequirement {
  id: string;
  title: string;
  description: string;
  category: 'Cryptographic' | 'Architectural' | 'Metadata' | 'Usability';
  status: 'Verified' | 'Documented Tradeoff' | 'Requires Hardware';
}

export interface ResearchFinding {
  id: string;
  title: string;
  summary: string;
  implication: string;
}

export const THREAT_LEVELS: ThreatLevel[] = [
  {
    id: 'A1',
    adversary: 'Opportunistic thief',
    capabilities: 'Device in physical possession, no knowledge of PIN',
    protection: 'Complete',
    badge: 'Complete',
    badgeColor: 'text-emerald-400 bg-emerald-950/60 border-emerald-800',
    notes: 'Already covered by standard modern Android file-based encryption (FBE).',
  },
  {
    id: 'A2',
    adversary: 'Acquaintance / domestic coercion',
    capabilities: 'Compels or observes ONE PIN, no forensic equipment',
    protection: 'High (Core Scenario)',
    badge: 'High',
    badgeColor: 'text-sky-400 bg-sky-950/60 border-sky-800',
    notes: 'Entering the decoy PIN opens a functional unremarkable area. No UI toggle indicates Profile 1 exists.',
  },
  {
    id: 'A3',
    adversary: 'Border / checkpoint inspection',
    capabilities: 'Demands unlock on the spot, brief on-device inspection',
    protection: 'High (with plausible decoy)',
    badge: 'High',
    badgeColor: 'text-cyan-400 bg-cyan-950/60 border-cyan-800',
    notes: 'Requires plausible decoy profile seeded with photos, history, and real apps (Concept §8.1).',
  },
  {
    id: 'A4',
    adversary: 'Law enforcement with standard forensics',
    capabilities: 'Post-unlock physical extraction, file-system block analysis (Cellebrite/GrayKey)',
    protection: 'Partial (Data encrypted, existence detectable)',
    badge: 'Partial',
    badgeColor: 'text-amber-400 bg-amber-950/60 border-amber-800',
    notes: 'Payload data remains encrypted with independent CE keys, but flash storage allocation can be detected.',
  },
  {
    id: 'A5',
    adversary: 'Specialist forensics / state intelligence',
    capabilities: 'Chip-off, microscopic firmware analysis, zero-days, infinite time',
    protection: 'Low for deniability; Confidentiality holds with key',
    badge: 'Low',
    badgeColor: 'text-orange-400 bg-orange-950/60 border-orange-800',
    notes: 'Deniability fails against hardware level memory audits. Cryptographic payload integrity remains sound.',
  },
  {
    id: 'A6',
    adversary: 'Compromised system (Malware with root/kernel access)',
    capabilities: 'Live memory introspection, modified bootloader',
    protection: 'None',
    badge: 'None',
    badgeColor: 'text-rose-400 bg-rose-950/60 border-rose-800',
    notes: 'No protection if the OS runtime is compromised prior to unlocking.',
  },
];

export const COMPARISON_MATRIX = [
  {
    solution: 'Android Work Profile',
    provides: 'Separate app container with isolated encryption key',
    stops: 'Explicitly marked with briefcase icon, fully visible in Settings, no deniability',
    isDeniable: false,
    isDestructive: false,
    isOpenSource: true,
  },
  {
    solution: 'Android 15 Private Space',
    provides: 'Hideable container with separate unlock credentials',
    stops: 'Detectable system-wide via package manager queries; no direct lock-screen selection',
    isDeniable: false,
    isDestructive: false,
    isOpenSource: true,
  },
  {
    solution: 'Samsung Knox Secure Folder',
    provides: 'Hardware-backed container with dedicated authentication',
    stops: 'Proprietary Knox binary, visible launcher icons, closed-source firmware',
    isDeniable: false,
    isDestructive: false,
    isOpenSource: false,
  },
  {
    solution: 'GrapheneOS Duress PIN',
    provides: 'Dedicated PIN entered at lock screen',
    stops: 'Destructive wipe: instantly destroys all keys. Device resets, raising immediate suspicion.',
    isDeniable: false,
    isDestructive: true,
    isOpenSource: true,
  },
  {
    solution: 'MLSU (Multi-Layer Secure Unlock)',
    provides: 'Non-destructive, multi-tier unlocking. The PIN alone selects the cryptographically isolated area.',
    stops: 'Flash storage metadata analysis (wear leveling) by A4/A5 forensic labs.',
    isDeniable: true,
    isDestructive: false,
    isOpenSource: true,
  },
];

export const REQUIREMENTS: SecurityRequirement[] = [
  {
    id: 'SR-1',
    title: 'Independent Key Generation',
    description: 'No shared master secret. Compromise of PIN 2 reveals mathematically zero bits about Profile 1.',
    category: 'Cryptographic',
    status: 'Verified',
  },
  {
    id: 'SR-2',
    title: 'No Foreign Keys in RAM',
    description: 'When Profile 2 is active, the encryption keys for Profile 1 do not exist anywhere in RAM or page cache.',
    category: 'Architectural',
    status: 'Verified',
  },
  {
    id: 'SR-3',
    title: 'Constant-Time Evaluation',
    description: 'PIN evaluation takes identical execution time regardless of whether PIN 1, PIN 2, or an invalid PIN is entered.',
    category: 'Cryptographic',
    status: 'Verified',
  },
  {
    id: 'SR-4',
    title: 'Independent Rate Limiting',
    description: 'Failed attempt counters must not leak profile counts through selective lockout states.',
    category: 'Architectural',
    status: 'Verified',
  },
  {
    id: 'SR-8',
    title: 'Fixed Storage Footprint',
    description: 'Key storage maintains fixed slot count (4 slots) with indistinguishable decoy blobs to conceal enrolled profile count.',
    category: 'Metadata',
    status: 'Documented Tradeoff',
  },
  {
    id: 'SR-9',
    title: 'Unconditional Slot Evaluation',
    description: 'Unlock algorithm must derive KDF for every slot without early-exit branches.',
    category: 'Cryptographic',
    status: 'Verified',
  },
];

export const FINDINGS: ResearchFinding[] = [
  {
    id: 'F-1',
    title: 'The Multi-Slot Counter Dilemma',
    summary: 'Because unlock attempts cannot know which profile was intended without first deriving keys, every invalid guess increments the failure counter on ALL slots.',
    implication: 'An adversary brute-forcing PINs will inevitably throttle or lock out the hidden profile as well.',
  },
  {
    id: 'F-2',
    title: 'Memory Zeroization Limitations in High-Level Runtimes',
    summary: 'Managed language runtimes (Python, Java/ART) copy immutable byte arrays and do not offer deterministic zero-on-free guarantees without JNI/native bindings.',
    implication: 'Production AOSP implementations require C/Rust core in vold/keystore2 with explicit memset_s/mlock.',
  },
  {
    id: 'F-3',
    title: 'AEAD Tag Comparison Timing Side-Channels',
    summary: 'Standard exception-based AEAD unwrap creates micro-second timing differences between invalid tags and valid plaintexts.',
    implication: 'Constant-time candidate folding (ct_core fold_select) is mandatory to eliminate unwrap timing leaks.',
  },
  {
    id: 'F-4',
    title: 'State Byte vs. True Storage Indistinguishability',
    summary: 'A persistent storage file needs a state indicator (0=decoy, 1=enrolled) unless profile count is stored inside the encrypted payload.',
    implication: 'Documented tradeoff: store files expose slot occupancy unless managed strictly within unlocked private spaces.',
  },
  {
    id: 'F-5',
    title: 'Hardware Weaver Slot Capacity',
    summary: 'Titan M / StrongBox chips allocate limited Weaver slots (typically 16-64 slots system-wide).',
    implication: 'MLSU must be constrained to a small fixed slot budget (2-4 slots) on current Android hardware.',
  },
];
