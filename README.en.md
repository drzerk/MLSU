# Multi-Layer Secure Unlock (MLSU)

**A system-wide privacy mode with multi-tier unlocking**

*🇬🇧 English · [🇩🇪 Deutsch](README.md)*

| | |
|---|---|
| **Working title** | Multi-Layer Secure Unlock (MLSU) |
| **Status** | Concept paper — no code, no implementation |
| **Version** | 0.1 (draft) |
| **Target platform** | Android / AOSP (primary), iOS (theoretical only) |
| **Licensing intent (future code)** | Open and auditable (Apache-2.0 or GPL-compatible) |

---

## Documents

- **Concept paper** — this document (sections 1–14)
- **[P0 — requirements document](docs/p0-requirements.en.md)** — state of the art
  as a comparison matrix, sharpened threat model with attack tree, requirements
  with acceptance criteria, decisions due before the prototype, and abort
  criteria
- **[P0 — findings](docs/p0-findings.en.md)** — what the reference model
  produced: five findings, including a conflict between two requirements
- **[P1 — PoC sketch](docs/p1-poc-sketch.en.md)** — AOSP change points as code
  skeletons: PIN routing in `LockSettingsService`, Private Space as foundation,
  milestone plan M0–M4
- **[P1 — Verification](docs/p1-verification.en.md)** — the U/O markers from
  P0/P1 checked against AOSP source and public sources (as of 2026-08):
  confirmations, a signature correction in the sketch skeleton, a new finding
  (unified lock) and the state of the Weaver question
- **[P2 — Metadata audit](docs/p2-metadata-audit.en.md)** — leak checklist for
  the PoC: every leak point (UI, storage, behaviour, services) with test method
  and test criterion; to be worked through in P1/M3
- **[Reference implementation](reference/README.en.md)** — a runnable model of
  the selection logic with requirement tests and a timing rig. Not Android code
  and not for use — a model built to be broken
- **[Proposal for ROM projects](docs/rom-proposal.en.md)** — the request for
  feedback as maintainers would want to receive it: five questions first, then
  the groundwork and the problems already found

---

## 1. Summary

MLSU describes an optional operating system feature in which **the PIN you enter
decides which encrypted data area is unlocked**. Instead of a single user area
that lies fully open once the code is known, several cryptographically separated
areas exist:

- **PIN 1** → the full private area
- **PIN 2** → a separate, deliberately unremarkable area with limited content

The decisive property is not the separation itself — that exists in some form
already (work profiles, Private Space, Secure Folder) — but that **the keys of
the areas that were not unlocked do not exist in memory after unlocking**, and
that the user interface gives no indication that they exist at all.

The concept explicitly distinguishes two protection goals that are often
conflated and that differ greatly in how well they can be achieved:

1. **Compartmentalization** — one compromised area does not expose the others.
   *Technically sound and achievable.*
2. **Plausible deniability** — an examiner cannot determine *that* further areas
   exist. *Only achievable to a limited degree; see section 9.*

An honest project promises (1) and discloses the limits of (2).

---

## 2. Problem statement

Current smartphones effectively know only one protection state: locked or
unlocked. Whoever knows the code — or compels its disclosure — gains access to
nearly all personal data: messages, photos, location history, payment details,
password managers, health data, and stored sessions in apps and browsers.

This is particularly problematic in three situations:

- **Coercive situations** — border control, theft under duress, domestic abuse,
  control by others in one's personal environment.
- **Seizure with a duty to disclose** — depending on jurisdiction, disclosure of
  the code may be demanded or enforced.
- **Cross-border travel** — device inspection without any specific suspicion is
  permitted in several countries.

Existing partial solutions address this only incompletely:

| Solution | What it provides | Where it stops |
|---|---|---|
| Android work profile | Separate container with its own key | Visible, managed, not deniable |
| Android Private Space (Android 15+) | Hideable container with its own lock | Existence detectable system-wide; no second login path |
| Samsung Secure Folder (Knox) | Container with its own authentication | Proprietary, visible icon, not auditable |
| GrapheneOS duress PIN | A PIN that destroys keys (wipe) | Destructive, irreversible, no continued operation |
| VeraCrypt hidden volumes (desktop) | Genuine deniability at the file system level | No mobile OS equivalent |

MLSU fills the gap: **a non-destructive, second fully functional operating state,
selected by the PIN entry itself.**

---

## 3. Goals and non-goals

### Goals

- Several cryptographically separated data areas on one device.
- Selection of the area purely through the PIN entered — no menu, no toggle, no
  additional step.
- No key material of non-unlocked areas in RAM.
- The restricted area is a fully usable system, not an empty demo mode.
- Fully open source and independently auditable.
- Usable by people without technical expertise — a mistake in operation must not
  silently void the protection.

### Non-goals

- **No protection against an already compromised operating system.** If malware
  runs with system privileges or the bootloader has been tampered with, MLSU does
  not help.
- **No protection against observation of the PIN entry** (cameras, shoulder
  surfing, a compromised keyboard).
- **No circumvention of legal disclosure obligations.** MLSU is a privacy
  mechanism, not a tool for obstructing investigations.
- **No guarantee of deniability** against an adversary with forensic capability
  (see section 9).
- Not a substitute for backups, disk encryption on other devices, or secure
  communication tools.

---

## 4. Threat model

MLSU can only be judged per class of adversary.

| # | Adversary | Capabilities | Protection offered by MLSU |
|---|---|---|---|
| A1 | Opportunistic thief | Device in hand, no knowledge of the PIN | Complete (already covered by standard encryption) |
| A2 | Acquaintance in the personal environment | Knows or compels *one* PIN, no forensics | **High** — the core scenario |
| A3 | Border / checkpoint inspection | Demands unlocking, brief on-device inspection | **High**, provided the restricted area looks credible |
| A4 | Law enforcement with standard forensics | Post-unlock extraction, file system analysis | **Partial** — data stays encrypted, but existence is usually detectable |
| A5 | Specialist forensics / state actor | Chip-off, firmware analysis, exploits, time | **Low for deniability**; confidentiality holds as long as the keys hold |
| A6 | Compromised system (malware with root) | Runtime access | **None** |

**Consequence for how the project communicates:** MLSU must not be marketed as a
cloak of invisibility against A4/A5. If the feature is sold as "undetectable" and
a user relies on it in a situation where an examiner *can* prove the existence of
a second area, that leaves the user worse off than having no feature at all —
because then the accusation of concealment is on the table. This honesty belongs
in the user interface, not only in the manual.

---

## 5. Core principle

```
             ┌──────────────────────────┐
             │       Lock screen        │
             │   (identical, always)    │
             └────────────┬─────────────┘
                          │ PIN entry
                          ▼
             ┌──────────────────────────┐
             │  KDF + hardware binding  │
             │  (Argon2id + secure      │
             │   element / Weaver)      │
             └────────────┬─────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        ▼                 ▼                 ▼
   ┌─────────┐      ┌───────────┐    ┌────────────┐
   │ Profile │      │ Profile B │    │  no match  │
   │    A    │      │ (reduced, │    │ → failed   │
   │(private)│      │  unremark-│    │   attempt, │
   │         │      │  able)    │    │   counter++│
   └─────────┘      └───────────┘    └────────────┘
```

Essential properties:

1. **A single, unmodified lock screen.** No hint as to the number of profiles —
   no differing PIN length, no visible selector.
2. **No shared master secret.** Each PIN derives its own profile key. Compromise
   of PIN 2 gives mathematically no information about the key of profile A.
3. **Constant processing time.** Evaluation must take the same time for every
   input — including wrong ones — otherwise a timing difference reveals the
   number of configured profiles.
4. **No foreign profile key material in RAM.** After profile B is unlocked, the
   key of profile A exists nowhere in the running system.

---

## 6. Technical architecture

### 6.1 Key hierarchy

```
PIN_i ──► Argon2id(PIN_i, salt_i, m=64MiB, t=3, p=1)
             │
             ▼
        pin_key_i
             │
             ├──► secure element / StrongBox: unseals wrapped_key_i
             │    (hardware-bound, rate limiting via Weaver/Gatekeeper)
             ▼
        profile_key_i
             │
             ├──► FBE class key (CE storage of profile i)
             ├──► keystore namespace of profile i
             └──► key for sync/backup of profile i
```

- **No profile can derive another profile's key.** `wrapped_key_i` is generated
  independently, not derived from a master key.
- **Hardware binding is mandatory.** Without a secure element, a 6-digit PIN is
  trivially brute-forceable offline. Rate limiting must be enforced in hardware
  (Titan M / StrongBox / TEE with Weaver slots).
- **One Weaver slot per profile.** Failed-attempt counters must not be shared —
  otherwise the existence of further profiles becomes visible through the lockout
  behaviour.

### 6.2 Storage separation

Android already provides the foundations: file-based encryption distinguishes
between `DE` (device-encrypted, available from boot) and `CE`
(credential-encrypted, available only after unlocking). MLSU builds on this:

- Each profile receives its own `CE` class keys.
- **Nothing personal may live in `DE`.** Notification caches, thumbnails, app
  lists and search indexes are the typical leak points here.
- Separate media stores, separate account management, separate clipboard, no
  cross-profile IPC, no shared notification history.

### 6.3 The metadata problem

The hardest leaks are not in the payload data but in what the system stores
*around* it:

| Leak | Description | Countermeasure |
|---|---|---|
| Storage usage | Occupied space with no visible content reveals hidden data | Pre-allocate fixed blocks; normalize usage reporting per profile |
| Modem / eSIM | Connection history, IMSI changes, roaming logs live outside the profile context | Separate modem logs; no profile-specific SIM switching |
| Time / uptime | A profile "last used 6 months ago" looks staged | Maintain plausible per-profile activity timestamps |
| Backups & cloud sync | One cloud account that knows both profiles' data destroys the separation | Strictly separate sync identities, zero-knowledge encryption per profile |
| Firmware / bootloader logs | Boot counters, panic logs, crash reports | Profile-neutral logging |
| Flash wear leveling | Old blocks physically persist | Not fully solvable at the application layer — see section 9 |

### 6.4 Expansion stages

| Stage | Scope | Effort |
|---|---|---|
| **0** | Two profiles, separate FBE keys, PIN-based selection | Core PoC |
| **1** | Arbitrarily many profiles, profile-specific app sets | Medium |
| **2** | Separate cloud sync with its own identity per profile | High |
| **3** | Zero-knowledge sync, independently audited key protocol | Very high |

Recommendation: complete stage 0 properly before touching anything in stages
2/3. A half-finished sync is more dangerous than no sync at all.

---

## 7. Platform analysis

### Android / AOSP — feasible

Existing building blocks: multi-user support since Android 4.2, file-based
encryption since Android 7, Gatekeeper/Weaver for hardware-side rate limiting,
the `synthetic password` abstraction between the user secret and the keys, and
Private Space since Android 15.

What would essentially have to change:

- `LockSettingsService` — evaluate the entry against multiple profiles instead of
  one, in constant time.
- `vold` / `keystore2` — unlock the matching CE key.
- SystemUI — a lock screen that does not reveal the number of profiles.
- Setup wizard — the most critical part from the user's perspective (section 8).

Realistic path: a custom ROM project with an existing security culture
(GrapheneOS, CalyxOS) or a dedicated AOSP fork. As a patch against stock Android
without bootloader access, the concept is **not** implementable.

### iOS — currently not implementable

The iPhone has no system-level multi-user capability (unlike Shared iPad). Data
Protection and the Secure Enclave are tied to *one* passcode; third-party
software has no access to the unlock logic. Without changes by Apple, at best an
in-app container solution remains — which delivers precisely what this concept is
*not* about: system-wide separation.

Sensible position: declare iOS explicitly "unsupported" rather than shipping a
watered-down app variant that suggests false security.

---

## 8. Usability as a security requirement

For this feature, user guidance is not decoration but security-critical:

- **An empty second profile is more suspicious than none at all.** The restricted
  area needs contacts, photos, app usage and plausible timestamps. The system
  should actively help with this during setup and later remind the user to
  actually use the area.
- **Confusing the PINs must not be catastrophic.** Someone who enters the wrong
  PIN under stress immediately has the wrong area open. A way back — without a
  reboot, without a visible trace — must exist.
- **No feature banner.** A device that visibly displays "MLSU enabled" in its
  settings menu defeats its own purpose. Configuration access belongs exclusively
  in the private profile.
- **Comprehensible limits.** Setup must state in plain words what the feature
  protects against and what it does not (the table in section 4).

---

## 9. Limits, risks, open problems

This is the most important section of the document.

**9.1 Deniability is structurally weaker in open source.**
If MLSU is part of a publicly known ROM, then an examiner who recognizes that ROM
knows a second profile *can* exist. The question shifts from "is there more?" to
"show me the second PIN". That largely negates the core promise against A4/A5.
There is no clean way out — only a choice between auditability and concealment,
and for security software auditability is the right choice.

**9.2 Physical storage analysis.**
Flash memory with wear leveling retains old blocks. Occupied but unattributable
storage space is visible with forensic equipment. Pre-allocating fixed regions
mitigates this but makes the allocation itself an indicator.

**9.3 Legal situation.**
Highly jurisdiction-dependent: in some legal systems the disclosure of keys can
be ordered and refusal sanctioned; in others a right against self-incrimination
applies, though it frequently does not extend to biometrics. The project should
develop country-specific guidance together with lawyers and must never provide
legal advice itself. *This document is not legal advice.*

**9.4 False sense of security is the main risk.**
The most realistic cause of harm is not a broken algorithm but a user who trusts
the feature more than it warrants and therefore keeps data on the device that
should not be there. Countermeasure: conservative communication, no marketing
language, the threat model table in the interface itself.

**9.5 Attack surface grows.**
Changes to `LockSettingsService`, `vold` and `keystore2` touch the most sensitive
part of the system. A bug here endangers *all* data, including that of users who
never enabled the feature. Therefore: feature off by default, code paths
unreachable when disabled, external audit before every release.

**9.6 Biometrics.**
Fingerprint and face recognition are hard to reconcile with the concept — they
allow no "selection through knowledge". Biometrics in MLSU operation will likely
have to be limited to one profile or disabled entirely.

---

## 10. Target audience

Journalists and their sources, human rights activists, business travellers under
confidentiality obligations, people in separation or abuse situations, doctors
and lawyers bound by professional secrecy, and privacy-conscious users generally.

Important for how the project communicates: the benefit lies in protecting
legitimate confidentiality. Positioning it as a tool for evading law enforcement
would be both factually wrong and existentially dangerous for the project.

---

## 11. Feasibility path

| Phase | Content | Result |
|---|---|---|
| **P0** | Sharpen the threat model with external reviewers; survey the state of the art systematically | A defensible requirements document |
| **P1** | Proof of concept on the AOSP emulator: two profiles, two PINs, separate CE keys | Functional proof |
| **P2** | Metadata audit: targeted search for leaks (DE storage, logs, modem, backup) | Leak list + fixes |
| **P3** | Port to real hardware with a secure element, Weaver slots per profile | Usable prototype |
| **P4** | External security audit, user study with the target audience | Release decision |
| **P5** | Publication, documentation of limits, maintenance commitment | Release |

Before P4, the feature should not be recommended to anyone who actually needs it
in a risk situation.

---

## 12. Open questions

1. Can constant evaluation time across an arbitrary number of profiles be
   reliably guaranteed on real hardware?
2. How many Weaver slots do common secure elements provide — is that enough for
   more than two profiles?
3. Can storage usage be normalized so that it stays unremarkable under standard
   forensics, without halving the usable space?
4. How is a profile securely deleted without the deletion itself becoming an
   indicator?
5. How can the standby state (emergency calls, alarms, incoming calls) be
   represented across profiles without leaking metadata?
6. What happens on OTA updates, factory reset and device migration?

---

## 13. Related work

- **VeraCrypt / TrueCrypt hidden volumes** — the classic approach to deniability
  on desktop systems; both a model and a demonstration of the known limits.
- **GrapheneOS duress PIN** — the destructive counter-design: one PIN destroys
  keys instead of opening another profile.
- **Android Private Space (Android 15+)** — visible, hideable container with its
  own lock; the closest relative in mainline Android.
- **Android work profile / Samsung Secure Folder** — container separation with no
  claim to deniability whatsoever.
- **LUKS with detached header / plain dm-crypt** — the Linux approach in which
  the existence of encryption is not evident from the medium.
- **Research on deniable encryption / deniable file systems** — in particular the
  literature on attacks against deniability via flash metadata.

---

## 14. Vision

An open, independently auditable privacy concept that gives people in coercive
situations realistic protection — not promised protection. Its value stands or
falls with honesty about its own limits: a feature that documents its weaknesses
is usable for its target audience. One that conceals them is dangerous.

---

## License

This document is licensed under
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
See [LICENSE](LICENSE).
