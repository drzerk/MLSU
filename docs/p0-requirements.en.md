# P0 — Requirements document

**Multi-Layer Secure Unlock (MLSU)** · Phase P0 of the [feasibility path](../README.en.md#11-feasibility-path)

*🇬🇧 English · [🇩🇪 Deutsch](p0-anforderungen.md)*

| | |
|---|---|
| **Status** | In progress — draft for external review |
| **Version** | 0.1 |
| **Predecessor** | [Concept paper v0.1](../README.en.md) |
| **Goal of this phase** | A defensible requirements document as the basis for the PoC (P1) |
| **Completion criterion** | Every requirement has an acceptance criterion; every `U` entry is resolved; at least two external reviews are in |
| **Results so far** | [Findings from the reference implementation](p0-findings.en.md) — F-1 to F-5, incorporated into this document |

---

## 1. Purpose and scope

The concept paper describes *what* MLSU is meant to be. This document fixes
*what it is measured against* — and what has to be settled first so that
building a prototype (P1) does not rest on wrong assumptions.

Not in this document: implementation design, API drafts, code. The architecture
sketch in the concept paper (section 6) is input, not output.

---

## 2. Method and verification status

The state of the art in section 3 is assembled from existing knowledge; it is
**not** confirmed by measurement on a device or by reading source. So that this
does not quietly become a false assumption, every claim carries a status:

| Status | Meaning |
|---|---|
| **V** | Verified — measured on a device or read in source/specification, with a reference |
| **U** | Unverified — plausible, but its origin is model or experience knowledge; **to be checked before P1** |
| **O** | Open — contradictory or missing information |

**At this point practically everything is `U`.** That is the actual work of P0:
converting `U` entries into `V`. A requirements document standing on unchecked
platform assumptions is worthless — and this is typically where security
projects fail: not at the end, but at the beginning.

In addition: statements about Android versions and hardware properties age
quickly. Every `V` claim carries a check date and the specific version (Android
release, device, ROM build) it refers to.

---

## 3. State of the art — systematic survey

### 3.1 Evaluation criteria

| Code | Criterion |
|---|---|
| **K1** | Cryptographic separation (own keys per area, no shared master key) |
| **K2** | Second login path (the area is selected by the unlock secret itself) |
| **K3** | Existence concealable (no UI hint that further areas exist) |
| **K4** | Non-destructive (no wipe as the price of protection) |
| **K5** | Metadata separation (notifications, caches, accounts, logs) |
| **K6** | Auditable (open source, independently verifiable) |
| **K7** | Usable without touching the bootloader (mainline rather than custom ROM) |

### 3.2 Comparison matrix

| System | K1 | K2 | K3 | K4 | K5 | K6 | K7 | Status |
|---|---|---|---|---|---|---|---|---|
| AOSP multi-user | yes | no | no | yes | partly | yes | partly | U |
| Android work profile | yes | no | no | yes | yes | yes | yes | U |
| Android Private Space (15+) | yes | no | partly | yes | yes | yes | yes | U |
| Samsung Secure Folder (Knox) | yes | no | no | yes | yes | **no** | yes | U |
| GrapheneOS duress PIN | — | yes | yes | **no** | — | yes | no | U |
| VeraCrypt hidden volume (desktop) | yes | yes | yes | yes | n/a | yes | n/a | U |
| VeraCrypt hidden OS (desktop) | yes | yes | yes | yes | partly | yes | n/a | U |
| LUKS + detached header | yes | no | yes | yes | n/a | yes | n/a | U |
| Mobiflage / MobiPluto / MobiCeal (research) | yes | yes | yes | yes | O | yes | no | U |
| Qubes OS (desktop compartmentalization) | yes | no | no | yes | yes | yes | n/a | U |
| **MLSU (target)** | **yes** | **yes** | **yes** | **yes** | **yes** | **yes** | **no** | — |

### 3.3 What follows from this

Three observations that determine the shape of the project:

1. **K2 is the distinguishing feature.** Every mainline Android solution
   separates areas, but none selects the area through the unlock secret.
   Building MLSU means building exactly that one mechanism — the rest already
   exists.
2. **Research has already tried this on mobile.** Mobiflage and its successors
   are academic work on deniable encryption for Android. They never reached
   production systems. **The most important P0 question is: why not?** If the
   answer is technical (flash metadata, FTL, wear leveling), it applies to MLSU
   too. Reading that literature is cheaper than reproducing its results.
3. **K7 is lost.** Without a custom ROM the mechanism cannot be built. That
   halves the realistic user base and makes cooperation with an existing ROM
   project effectively the only option.

### 3.4 Prior work to review (P0 reading list)

| # | Subject | Why it matters |
|---|---|---|
| L1 | Mobiflage (Skillen/Mannan) and successor work | Direct predecessor; probably contains the reasons it failed |
| L2 | Publications on attacks against deniable file systems via flash/FTL | Decides whether K3 against A5 is achievable at all |
| L3 | AOSP: `LockSettingsService`, `synthetic password`, `vold`, `keystore2` | Determines the actual size of the change |
| L4 | Weaver/Gatekeeper HAL specification, slot counts of real secure elements | Hard upper bound on the number of profiles |
| L5 | Android Private Space — implementation and detectability | Clarifies whether MLSU can build on it rather than beside it |
| L6 | GrapheneOS design documents on the duress mechanism | Closest real precedent, including the rationale for the wipe approach |

---

## 4. Sharpened threat model

### 4.1 Protection goals

| # | Asset | Loss means |
|---|---|---|
| G1 | Contents of the private area | Full disclosure |
| G2 | **Existence** of the private area | Loss of deniability; pressure to disclose |
| G3 | Attribution of activity to an area | Inference about behaviour despite encrypted content |
| G4 | Integrity of the system | Tampered unlock logic endangers every area |

G2 is the genuinely new asset. G1 is already covered by today's systems.

### 4.2 Adversary capabilities in detail

| | A2 personal environment | A3 checkpoint | A4 standard forensics | A5 specialist forensics |
|---|---|---|---|---|
| Access duration | Minutes, repeated | Minutes to hours | Days | Unlimited |
| Device unlocked | yes (compelled) | yes (compelled) | yes | yes/no |
| Tools | none | Visual inspection, possibly extraction tooling | Commercial extraction | Chip-off, exploits, custom tooling |
| Prior knowledge of MLSU | no | possible | **yes** | **yes** |
| Repeated access | yes | rarely | yes | yes |
| Breaks G2? | no | probably not | **likely** | **yes** |

### 4.3 Attack tree for G2 ("prove the private area exists")

```
Goal: show that a further area exists
├── ROM identification
│   └── Build fingerprint / system apps reveal an MLSU-capable ROM  ← hard to avoid
├── Storage analysis
│   ├── Occupied but unattributable space
│   ├── FTL / wear-leveling remnants of old blocks
│   └── Partition or metadata size does not match the content
├── Behavioural analysis
│   ├── Timing difference in PIN evaluation
│   ├── Lockout behaviour / failure counters
│   └── Boot time or resource use depending on the number of profiles
├── Context analysis
│   ├── Visible profile too empty / too young / too little used
│   ├── Accounts, SIM, cloud traces do not match the visible profile
│   └── External sources (carrier, cloud, correspondents) contradict the device picture
└── Human
    ├── Observation of the entry
    └── Statement under pressure
```

The upper two branches are technically addressable but never fully closed.
**The "context analysis" branch is the most underestimated:** it is not broken
by cryptography but by a user who does not maintain their second profile. That
is a requirement on product and interaction, not on key derivation (see UR-2,
UR-3).

### 4.4 Security assumptions

If any of these fails, the protection fails. They are to be checked explicitly
and named in the user documentation.

| # | Assumption |
|---|---|
| SA-1 | The bootloader is locked and Verified Boot is active |
| SA-2 | The secure element enforces rate limiting that software cannot bypass |
| SA-3 | The operating system is not compromised at the moment of unlocking |
| SA-4 | The user enters the PIN unobserved |
| SA-5 | The user uses the restricted area regularly and genuinely |
| SA-6 | No second body of data exists off the device that contradicts the visible profile |

---

## 5. Requirements

Priority: **MUST** (without it MLSU is not MLSU) · **SHOULD** (clear loss of
value if omitted) · **MAY** (expansion stage).

### 5.1 Security requirements

| ID | Requirement | Prio | Acceptance criterion |
|---|---|---|---|
| SR-1 | Every profile holds an independently generated key; no shared master key | MUST | Code review + demonstration that `profile_key_B` yields no relation to `profile_key_A` |
| SR-2 | After unlocking profile B, no key material of profile A exists in RAM | MUST | Memory image of the running system, targeted search for key patterns |
| SR-3 | PIN evaluation runs in constant time, independent of the match and of the number of profiles | MUST | Series of ≥10,000 entries; **all input classes interleaved in one session, order randomized per round** (F-4); Welch's t below 4.5 for every class pair |
| SR-4 | Every profile has its own failure counter in hardware. **A successful** unlock resets only its own counter and leaves the others untouched | MUST | Test: a successful unlock of B does not change A's counter. **This does not and cannot hold for failed attempts** — see F-1 |
| SR-5 | PIN derivation is hardware-bound; an offline attack on a storage image is ineffective | MUST | Extraction test: an image without the secure element is not attackable |
| SR-6 | No personal content in `DE` storage | MUST | Full inventory of the `DE` area before and after use |
| SR-7 | No cross-profile IPC, no shared clipboard, no shared notification history | MUST | Systematic test catalogue per IPC channel |
| SR-8 | The displayed storage usage permits no inference about further profiles | SHOULD | Comparison of a device with and without a second profile, identical display |
| SR-9 | Boot time, resource usage and logs are independent of the number of profiles | SHOULD | Measurement series + log diff |
| SR-10 | With the feature disabled, the MLSU code paths are unreachable | MUST | Code review + test on the default configuration |
| SR-11 | Securely deleting a profile leaves no indication that it previously existed | SHOULD | Forensic post-analysis after deletion |
| SR-12 | The authenticity check when unwrapping a slot yields a flag in constant time, not an exception or error path | MUST | Code review of the crypto binding; selection criterion for the library (F-3) |

### 5.2 Functional requirements

| ID | Requirement | Prio | Acceptance criterion |
|---|---|---|---|
| FR-1 | At least two profiles, selected solely by the PIN entered | MUST | Functional test |
| FR-2 | Identical lock screen for all profiles, no difference in length or layout | MUST | UI diff, screenshot comparison |
| FR-3 | The restricted area is a fully functional system (telephony, camera, apps) | MUST | Acceptance test with everyday scenarios |
| FR-4 | Switching between profiles without a reboot and without a visible trace | SHOULD | Functional test + UI review |
| FR-5 | Configuration reachable only from the private profile | MUST | Test from within the restricted profile |
| FR-6 | Emergency calls work from every state | MUST | Functional test |
| FR-7 | Separate sync identity per profile | MAY (stage 2) | Network capture: no shared identifiers |
| FR-8 | Behaviour on OTA update, factory reset and device migration is defined and documented | MUST | Test matrix across all three cases |

### 5.3 Usability and product requirements

| ID | Requirement | Prio | Acceptance criterion |
|---|---|---|---|
| UR-1 | Setup states in plain language what MLSU protects against and what it does not | MUST | User test: participants restate the limits correctly |
| UR-2 | Setup actively helps to populate the restricted area credibly | MUST | User test + assessment by independent reviewers ("does this look real?") |
| UR-3 | The system prompts for use of the restricted area when it has been idle too long | SHOULD | Functional test |
| UR-4 | An accidentally entered wrong PIN causes no data loss and leaves no visible trace | MUST | Misoperation test |
| UR-5 | No visible indication of MLSU inside the restricted profile (settings, app list, about) | MUST | Full UI review by an independent person |
| UR-6 | In MLSU operation, biometrics are either limited to one profile or disabled | MUST | Functional test; design decision D3 |

### 5.4 Explicit non-requirements

| ID | Non-requirement |
|---|---|
| NR-1 | No protection against a system compromised at runtime |
| NR-2 | No guarantee of deniability against A4/A5 |
| NR-3 | No support without an unlockable bootloader |
| NR-4 | No iOS support |
| NR-5 | No protection against compelled disclosure of *all* PINs by someone who knows there are several |

---

## 6. To be decided before P1

| # | Decision | Recommendation | Rationale |
|---|---|---|---|
| D1 | Standalone mechanism or built on Private Space | **Examine Private Space first** | If K1/K3/K5 are already satisfied there, MLSU reduces to the PIN selection path — a much smaller and more reviewable change |
| D2 | Number of supported profiles and slot count | **Exactly two; `SLOT_COUNT` = maximum profile count, no spare slots** | Weaver slots are scarce (L4); unlock latency scales linearly with slot count — measured at about 700 ms for four slots with the concept parameters (F-5) |
| D3 | Handling of biometrics | **Disable in MLSU operation** | Biometrics permit no selection through knowledge; a fingerprint that opens only one profile is itself an indicator |
| D4 | Cooperation or own fork | **Seek cooperation** | Changing `LockSettingsService`/`keystore2` without an existing security culture and update pipeline is not defensible |
| D5 | How deniability is communicated | **Advertise as "limited, against A2/A3", never as invisible** | See concept paper 9.1 and 9.4 |
| D6 | Implementation language for P1 | **A language with controllable memory (Rust with `zeroize`, or C)** | SR-2 can neither be established nor tested in a language without memory control (F-2) |

---

## 7. Question catalogue for external review

**For ROM and platform developers (GrapheneOS, CalyxOS, AOSP-adjacent):**
1. How large is the change to `LockSettingsService` and the synthetic password
   realistically, and how stable is that area across Android releases?
2. Are the Weaver slots of common secure elements sufficient for two separate
   failure counters?
3. Is there a reason the duress approach (wipe) was preferred over the
   multi-profile one — technical, or on responsibility grounds?
4. Would building on Private Space be viable, or does its design foreclose that?

**For forensic examiners:**
5. In practice, how is a device with a hidden second area recognized today?
6. How reliably can unattributable flash storage be demonstrated?
7. How much does context analysis (carrier, cloud, correspondent data) reveal
   compared to device analysis?

**For lawyers (per jurisdiction):**
8. What disclosure obligations exist, and what is the effect of an area that has
   been demonstrated but not opened?
9. Does using such a feature worsen the user's position once its existence is
   demonstrated?

**For the target audience:**
10. Is maintaining a credible second profile daily realistically sustainable?
11. What happens under stress in a real situation — is the right PIN recalled?
12. Guessing by a stranger drives the hidden area into lockout too (F-1). What
    should happen at the threshold — lockout or deletion? How is that risk
    explained to someone who hands their device over or must give it up?

Questions 9 and 11 can sink the project. They therefore belong at the start,
not at the end.

---

## 8. Abort criteria

A security project needs defined reasons *not* to build it. MLSU should be
discontinued or fundamentally rescoped if:

- **AB-1** — L2 shows that unattributable flash storage can be demonstrated
  reliably at reasonable effort. Then G2 does not hold against A4 and the core
  promise is gone.
- **AB-2** — SR-3 (constant time) cannot be achieved defensibly on real
  hardware.
- **AB-3** — No ROM project is willing to adopt it and an own fork cannot commit
  to a reliable update pipeline. An unmaintainable security fork is more harmful
  than no feature.
- **AB-4** — User testing shows the target audience does not sustain the upkeep
  of the second profile. Then the feature does not protect when it matters while
  suggesting that it does.
- **AB-5** — Legal review shows that using it predominantly worsens users'
  position in the relevant jurisdictions.

---

## 9. Next steps

| # | Step | Result | Status |
|---|---|---|---|
| 1 | Work through reading list L1–L6, lift the comparison matrix from `U` to `V` | Evidenced matrix with references | open |
| 2 | Settle D1: examine Private Space as a base | Decision with rationale | open |
| 3 | Settle D2: count Weaver slots on real devices | Hard upper bound | open |
| 4 | Send the question catalogue to three external reviewers | ≥2 responses | open |
| 5 | Revise the requirements after review, freeze version 1.0 | Release for P1 | open |

Done since version 0.1: the selection logic was modelled and measured, five
findings documented ([p0-findings.en.md](p0-findings.en.md)), and the
requirements adjusted accordingly. That replaces none of the five steps above —
it only added what was checkable without a device and without access to the
literature.

**P0 is complete when step 5 is reached, not earlier.** A PoC built before D1 is
settled will most likely build something that already exists.

---

## License

This document is licensed under
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
See [LICENSE](../LICENSE).
