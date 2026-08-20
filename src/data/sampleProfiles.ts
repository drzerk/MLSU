import { ProfileData } from '../types';

export const SAMPLE_PROFILES: Record<number, ProfileData> = {
  1: {
    id: 1,
    name: 'Private Space (Personal & Confidential)',
    pin: '471903',
    type: 'private',
    tagline: 'Cryptographically protected private user profile (CE Key Sealed)',
    notes: [
      {
        id: 'n1',
        title: 'Project Cobalt — Investigation Log',
        content: 'Whistleblower meeting set for Thursday 14:00 at Café Einstein. Raw financial ledger exported to encrypted offline USB drive. Verified SHA-256 fingerprint: 8e4b19...c4.',
        date: 'Aug 18, 2026',
        category: 'Investigative',
      },
      {
        id: 'n2',
        title: 'PGP & Wireguard Keyrings',
        content: 'Primary GPG Subkey ID: 0x9B1A77E2. Wireguard endpoint: 198.51.100.42:51820. Do not sync across public cloud providers.',
        date: 'Aug 14, 2026',
        category: 'Security',
      },
      {
        id: 'n3',
        title: 'Legal Counsel — Dr. Elena Vance',
        content: 'Retainer agreement active under Section 53 StPO (professional secrecy). Retain all unredacted interview notes in CE partition only.',
        date: 'Aug 02, 2026',
        category: 'Legal',
      },
    ],
    contacts: [
      { id: 'c1', name: 'Elena Vance (Attorney)', role: 'Legal Defense', phone: '+49 30 9283-001', avatarColor: 'bg-indigo-600' },
      { id: 'c2', name: 'Source "Kestrel"', role: 'Confidential Whistleblower', phone: 'Signal: @kestrel.09', avatarColor: 'bg-emerald-600' },
      { id: 'c3', name: 'Marcus Sterling', role: 'Editor-in-Chief', phone: '+44 20 7946 0991', avatarColor: 'bg-sky-600' },
    ],
    messages: [
      { id: 'm1', sender: 'Elena Vance', preview: 'The injunction draft has been lodged under seal. Stay safe at the border.', time: '12:44 PM', unread: true },
      { id: 'm2', sender: 'Source "Kestrel"', preview: 'Batch 3 archive uploaded to onion mirror. Delete this chat once acknowledged.', time: 'Yesterday', unread: false },
      { id: 'm3', sender: 'Marcus Sterling', preview: 'Editorial board approved the front-page piece for Monday embargo.', time: 'Aug 16', unread: false },
    ],
    gallery: [
      { id: 'g1', caption: 'Document Archive 2026-Scan-04', icon: 'file-text', tag: 'Confidential' },
      { id: 'g2', caption: 'Server Room Audit Photograph', icon: 'shield-alert', tag: 'Evidence' },
      { id: 'g3', caption: 'Encrypted Flash Drive Hardware ID', icon: 'hard-drive', tag: 'Hardware' },
      { id: 'g4', caption: 'Family Trip to Bavaria (Private)', icon: 'camera', tag: 'Personal' },
    ],
    vaultItems: [
      { id: 'v1', service: 'ProtonMail Encrypted Gateway', username: 'investigative-desk@pm.me', secret: '••••••••••••••••' },
      { id: 'v2', service: 'Signal Recovery Phrase', username: 'Secure Phone 1', secret: '••••••••••••••••' },
      { id: 'v3', service: 'Hardware YubiKey PIN', username: 'Key-04A-Primary', secret: '••••••••' },
    ],
  },
  2: {
    id: 2,
    name: 'Travel & Unremarkable Profile (Decoy Area)',
    pin: '220561',
    type: 'restricted',
    tagline: 'Plausible, benign operational state for border inspection & duress (Concept §8.1)',
    notes: [
      {
        id: 'n1',
        title: 'Summer Vacation Itinerary — Munich',
        content: 'Flight LH 204 departing 08:35. Hotel reservation at Marienplatz. Pick up rental car at counter 4B.',
        date: 'Aug 19, 2026',
        category: 'Travel',
      },
      {
        id: 'n2',
        title: 'Weekend Grocery Shopping',
        content: 'Oat milk, organic coffee beans, whole wheat sourdough, olive oil, sparkling mineral water, fresh basil.',
        date: 'Aug 17, 2026',
        category: 'Personal',
      },
      {
        id: 'n3',
        title: 'Bike Repair Checklist',
        content: 'Inspect brake pads, lubricate derailleur chain, check tire pressure (3.5 bar).',
        date: 'Aug 10, 2026',
        category: 'Hobbies',
      },
    ],
    contacts: [
      { id: 'c1', name: 'Munich City Hotel Reception', role: 'Hospitality', phone: '+49 89 2381-0', avatarColor: 'bg-amber-600' },
      { id: 'c2', name: 'Lufthansa Baggage Support', role: 'Airlines', phone: '+49 69 86799799', avatarColor: 'bg-blue-600' },
      { id: 'c3', name: 'Thomas Weber (Colleague)', role: 'Sales Team', phone: '+49 171 555 4921', avatarColor: 'bg-teal-600' },
    ],
    messages: [
      { id: 'm1', sender: 'Munich City Hotel', preview: 'Your digital room key is ready for mobile check-in.', time: '11:15 AM', unread: false },
      { id: 'm2', sender: 'Thomas Weber', preview: 'Have a great holiday! Don’t check your work emails.', time: 'Aug 17', unread: false },
    ],
    gallery: [
      { id: 'g1', caption: 'Englischer Garten Sunny Afternoon', icon: 'sun', tag: 'Holiday' },
      { id: 'g2', caption: 'Marienplatz Clocktower Sightseeing', icon: 'map-pin', tag: 'Sightseeing' },
      { id: 'g3', caption: 'Boarding Pass PDF Confirmation', icon: 'ticket', tag: 'Documents' },
    ],
  },
};
