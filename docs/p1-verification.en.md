# P1 preparation — verification of platform assumptions

**Multi-Layer Secure Unlock (MLSU)** · Supplement to [P0 requirements](p0-requirements.en.md),
[P0 findings](p0-findings.en.md) and the [P1 PoC sketch](p1-poc-sketch.en.md)

*[🇬🇧 English](p1-verification.en.md) · [🇩🇪 Deutsch](p1-verifikation.md)*

| | |
|---|---|
| **Status** | Verification — source check, no on-device measurement |
| **Version** | 0.1 |
| **Check date** | 2026-08-19 |
| **States checked** | AOSP `android-latest-release` (Code Search) and `refs/heads/main` (Gitiles); API 35 docs; public project and literature sources |
| **Predecessors** | [P0 requirements](p0-requirements.en.md) §9 "Next steps", [P1 PoC sketch](p1-poc-sketch.en.md) (U/O markers, §8) |
| **Goal** | Work through the P0 steps 1–3 that can be done in writing: lift the comparison matrix from `U` to `V`, back D1 and D2 with sources, check the sketch's U markers |
| **Non-goal** | External review (P0 steps 4/5), measurements on real hardware (M4), legal advice |

---

## 1. Purpose and classification

P0 states: *"P0 is complete when step 5 is reached — not earlier."* Steps 1–3 of
that table are the only ones that can be done without a device and without
external reviewers — and precisely the ones a PoC must not replace. This document
collects what could be verified against the AOSP source tree and public sources
as of 2026-08-19. It strictly distinguishes:

- **V** — read in source code or official docs, with reference;
- **U** — still plausible, but unverified;
- **O** — still open (design decision required).

Two results of this check substantively change the P1 sketch and are already
incorporated there:

1. **The code skeleton in 4.1 had the `unlockLskfBasedProtector` signature
   wrong** (see V2 below). This is exactly what verification before building is
   for: the error would otherwise have surfaced in the first patch to the lock
   screen.
2. **AOSP already contains a "one input, two profiles" path** — the *unified
   lock* (see V7 below). It is built differently from MLSU (derived instead of
   routed, all-or-nothing instead of exactly-one), but it confirms the sketch's
   core assumption: the intervention is smaller than the concept paper (§7)
   originally assumed.

---

## 2. Method

- **Check path:** Android Code Search (`cs.android.com`, branch
  `android-latest-release`) for snippets with line numbers; Gitiles
  (`android.googlesource.com`, `refs/heads/main`) for full files; official API
  docs for constants; project/literature sources via their original pages.
- **Limit:** everything here is *reading*, not measurement. Claims about runtime,
  memory behaviour and hardware keep their status (U/O) and remain tied to M2/M4.
  The methodology lesson from finding F-4 applies unchanged: an acceptance
  criterion that prescribes only the result and not the method produces phantom
  signals.
- **References:** line numbers refer to the branch checked and age with the
  source. Every V statement therefore names branch and check date.

---

## 3. Verification of the AOSP assumptions (L3/L5)

### V1 — `doVerifyCredential` verifies exactly one user (confirmed)

**Claim (P1 sketch 4.1, status V):** `LockSettingsService.doVerifyCredential(...)`
checks the protector of exactly one `userId`; on success the CE unlock follows.

**Checked** (`android-latest-release`, 2026-08-19):

- Signature: `private VerifyCredentialResponse doVerifyCredential(LockscreenCredential credential, int userId, ICheckCredentialProgressCallback progressCallback, int flags)` — `LockSettingsService.java`, lines 2618–2620.
- Success path: `"Successfully verified lockscreen credential for user %d"` (line 2691) → `onCredentialVerified(authResult.syntheticPassword, …)` (line 2692) → `onCredentialVerifiedInternal(...)` (line 3379).

**Consequence:** confirmed. The MLSU routing (loop over all linked users, no
early return, SR-3) replaces exactly this entry point — structurally a bounded
intervention, as depicted in the sketch.

### V2 — signature of `unlockLskfBasedProtector` (correction of the sketch)

**Claim (P1 sketch 4.1, code skeleton):** the call is
`unlockLskfBasedProtector(mGatekeeper, userId, credential, /* challenge */ 0L, callingUserId)`.

**Checked:** the declaration is
`unlockLskfBasedProtector(IGateKeeperService gatekeeper, long protectorId, @NonNull LockscreenCredential credential, int userId, …)`
(`SyntheticPasswordManager.java`, line 1534). Call sites in
`LockSettingsService.java` confirm the order and show how the protector ID is
obtained: `unlockLskfBasedProtector(getGateKeeperService(), getCurrentLskfBasedProtectorId(userId), …)`
(line 2460; further call sites at lines 1230, 1247, 2668).

**Consequence:** the skeleton passed `userId` in the protector-ID position and
mixed up challenge/caller. **Corrected** (see sketch 4.1):
`(mGatekeeper, getCurrentLskfBasedProtectorId(userId), credential, userId, /* challenge */ null)`.
The construction itself is unchanged — each profile still has exactly one
protector with its own Weaver/Gatekeeper binding (SR-4).

### V3 — Weaver HAL: slot array, configuration, throttle (L4)

**Checked** (`platform/hardware/interfaces`, `refs/heads/main`, `IWeaver.aidl`):

- Weaver is **"structured as an array of slots, each containing a key-value pair.
  Slots are uniquely identified by an ID in the range [0, getConfig().slots)"** —
  the slot count is a **device constant reported by the HAL**, not an AOSP-wide
  fixed value.
- `WeaverConfig getConfig()` provides it at runtime.
- **Throttling is per slot** ("applied on a per-slot basis so that a successful
  read from one slot does not reset the throttling state of any other slot") —
  the hardware basis of SR-4.
- `read(slotId, key)` reports throttling with remaining time (`STATUS_THROTTLE`,
  `timeout`); `write(slotId, key, value)` overwrites a slot and makes the
  previous content unrecoverable.

**Consequence:** the reference model (`mlsu/counters.py`: separate counters per
slot, throttle timestamps) mirrors the HAL semantics correctly. For M4 this
yields the concrete measurement procedure: read `getConfig().slots` on the
target device (see section 4).

### V4 — `SyntheticPasswordManager` bounds slots via the HAL configuration

**Checked:** `weaverVerify(IWeaver weaver, int slot, byte[] key)` checks
`if (slot == INVALID_WEAVER_SLOT || slot >= mWeaverConfig.slots)`
(`SyntheticPasswordManager.java`, lines 793–794). The slot bound comes from the
HAL configuration, not from a fixed manager constant.

**Consequence:** for the PoC, the profile-count limit is determined at runtime
and can be queried on the device; an MLSU setup that needs more slots than the
hardware provides does not fail silently — it is visible in `mWeaverConfig`.
This belongs in the M0/M4 check scope.

### V5 — vold: CE keys into the kernel keyring, removal on lock (partial SR-2 statement)

**Claim (P1 sketch 4.3, status U):** `lock_user_key` removes the CE key; how
completely was open.

**Checked** (`platform/system/vold`, `refs/heads/main`):

- `KeyUtil.cpp`: `installKey()` places the CE key into the kernel fscrypt
  keyring via `FS_IOC_ADD_ENCRYPTION_KEY`; the ioctl argument lives in a
  **self-zeroing buffer** ("automatically-zeroing buffer").
- `evictKey()` removes it via `FS_IOC_REMOVE_ENCRYPTION_KEY`; if files are still
  open, `waitForBusyFiles` retries with exponential backoff (3.2 s → 51.2 s,
  ≈ 1 min total) and removes the key afterwards.
- `VoldNativeService.cpp`: `unlockCeStorage(userId, secret)` →
  `fscrypt_unlock_ce_storage(...)`; `lockCeStorage(userId)` →
  `fscrypt_lock_ce_storage(...)` — the binder primitives for CE lock/unlock.
- The `vdc cryptfs` command name from sketch source [3] should be re-checked on
  the target build at M0; the binder methods above are the version-stable
  interface verified in source.

**Consequence (SR-2, partial statement):** the **kernel copy** part is
established: after `lock`/`evictKey`, the CE key of the locked profile no longer
exists in the kernel keyring (modulo open files, which vold cleans up). **Not
established** remains the userspace part: transient copies (vold `KeyBuffer`,
keystore2 daemon, keymaster blobs) and their lifetime. That remains an M4
measurement — the only place where SR-2 becomes checkable (finding F-2). Sketch
4.3 is raised from U to "partially V" accordingly.

### V6 — Private Space is public API (confirmed, L5)

**Checked** (API docs `UserManager`, API 35): the private-space user type is
first class — e.g. `USER_TYPE_PROFILE_PRIVATE` and
`DISALLOW_ADD_PRIVATE_PROFILE` in the public reference. Together with the
hidden-profile mechanics (`ACCESS_HIDDEN_PROFILES`, broadcasts) from sketch
sources [1][2], the strategic statement stands: **Private Space is the
foundation MLSU builds on.** D1 is thereby decided with references (see
section 6).

### V7 — AOSP already has a "one input, two profiles" path: unified lock (new finding)

**Checked** (`LockSettingsService.java`, `android-latest-release`):

- `LockscreenCredential getDecryptedPasswordForUnifiedProfile(int userId)` (line 1678)
  derives the profile password from the parent user's synthetic password; call
  sites at lines 1721–1724, 1795–1797, 1913–1914, 2167–2169.
- Inside `doVerifyCredential` there is a path *"Unlock parent by using parent's
  challenge"* (lines 2769–2770) followed by *"Unlock profile with unified lock"*
  (lines 2781–2782) — the profile check runs with the derived credential.

**Classification:** Android can already unlock two profiles with **one** lock
screen input today (managed profile / private space with "same lock"). The
difference to MLSU remains fully intact and is now more precise:

| | Unified lock (AOSP) | MLSU (target) |
|---|---|---|
| Mechanism | profile credential is **derived** from the parent SP | profiles have **independent** protectors (SR-1), the input is **routed** |
| Result | parent profile **and** profile unlock (all-or-nothing) | **exactly one** profile unlocks, the other stays locked |
| Selection | none — the credential selects nothing | the PIN itself selects (FR-1) |
| Invisibility | profile stays UI-visible (Private Space) | no UI hint (G2) |
| Constant time | not required | required (SR-3) |

**Consequence:** the sketch gains another confirmed pillar ("the rest already
exists"), and a new rule of caution: the unified-lock path is a second verify
path that must keep working unchanged when MLSU is off and into which the
routing must not accidentally fall (concept 9.5: attack surface). Sketch 4.1
picks this up.

### V8 — GrapheneOS duress is the destructive counterpart (confirmed, L6)

**Checked** (`grapheneos.org/features`, FAQ, project statements):

- Duress PIN/password **irreversibly wipe the device** (including eSIMs), are
  accepted wherever credentials are requested, and can only be enabled together
  (PIN **and** password, because profiles may use different unlock methods). The
  regular credential takes precedence if identical to the duress code.
- Per project statement the wipe removes the TEE keystore, the secure-element
  keystore and encryption metadata; *"The most important data that's wiped is
  the Weaver table on the secure element"* — slot deletion is thus a real,
  hardware-backed operation (consistent with V3: `write` makes a slot
  unrecoverable).
- The GrapheneOS FAQ documents the Weaver mechanism on Pixel: random token as
  Weaver value, Weaver key derived from the password token, hardware-enforced
  delay per attempt via an internal timer, limited total number of attempts,
  slot wipe on profile deletion.

**Consequence:** the matrix claim (duress: K4 = no, destructive) is backed, and
the open product question from finding F-1 ("lockout or wipe at the threshold?")
has a concrete answer in GrapheneOS: **wipe**. MLSU deliberately chooses the
non-destructive path — a product decision, not a technical necessity, and it
must be communicated in the setup flow as honestly as the limits (concept §8).

---

## 4. D2 — Weaver slot count of real devices (12.2)

**What is now established:**

- The slot count is device-specific and reported by the HAL:
  `IWeaver.getConfig().slots` (V3); the SP manager uses exactly this bound (V4).
- There is **no public AOSP constant** for the slot count of Titan M/M2; a fixed
  number would contradict the HAL design.
- On the hardware itself (Quarkslab whitepaper "2021: A Titan M Odyssey", V):
  Titan M is an external coprocessor (ARM Cortex-M3, 64 KB RAM, no MMU/ASLR),
  firmware ships as a binary under `/vendor/firmware/citadel`; Weaver is one of
  the applets running on it (HAL daemon `weaver` via citadeld/SPI). Slots live
  in the chip's internal flash — the slot count is a question of firmware
  layout, not RAM.
- Additional slot consumption not previously considered in the sketch: the SP
  manager also uses a Weaver slot for the **secdiscardable key**
  (`weaverVerify(weaver, slotId, null)`, `SyntheticPasswordManager.java`
  lines 1776–1778). Whether that is one more slot per profile must be checked
  before M4 — two profiles could need four slots, not two.

**Status of D2:** recommendation unchanged (exactly two profiles,
`SLOT_COUNT` = maximum profile count, no reserve slots — supported by finding
F-5). The measurement path is now defined and verified: **M4 reads
`IWeaver.getConfig().slots` on the target device** (log emulator Weaver and
Pixel/Titan separately) and checks the secdiscardable consumption. Until the
measurement, "two profiles" remains the hard assumption — no more and no less.

---

## 5. Literature L1/L2 — why the mobile PDE systems never arrived

The P0 reading list asks about Mobiflage and attacks on deniability via
flash/FTL. Result of the review (original papers or author pages):

| Work | Approach | Documented limit |
|---|---|---|
| **Mobiflage** (Skillen/Mannan, 2013/14) | hidden volumes on the SD card; first mobile PDE | needs a separate partition; `discard`/TRIM must be disabled; block-layer writes leave FTL traces; single-snapshot adversary only |
| **MobiPluto** (Chang et al.) | block layer with randomized write distribution | FTL writes log-structured — block-layer randomness is defeated on the flash |
| **MobiCeal** (Chang et al., 2018) | dummy writes + randomization in the block layer | **cannot** resist a multi-snapshot adversary (authors' own account) |
| **DEFTL** (Jia et al., 2017) | PDE **inside** the flash translation layer | first flash-aware approach, moderate overhead — but intervention in the flash controller, practically undeployable |
| **2020 survey** ("Towards Designing A Secure Plausibly Deniable System for Mobile") | — | a mobile PDE system resisting multi-snapshot adversaries **is missing from the literature** |

**Three consequences:**

1. **AB-1 is not triggered.** The stop criterion asks whether unaccountable
   flash space is reliably detectable *with reasonable effort*. The literature
   says: not visible to standard forensics (A4, logical extraction); yes for
   chip-off/FTL reconstruction (A5). This matches the concept paper's
   positioning exactly (G2 does not hold against A5) — not a new finding, but
   now backed rather than assumed.
2. **The answer to "why did Mobiflage never arrive"** is structural: all
   predecessors intervene in the storage layer/FTL, which on modern devices is
   neither open nor modifiable (UFS/eMMC controllers are vendor territory).
   MLSU bypasses exactly that: **no storage-layer intervention**, instead
   credential-level routing + inherited FBE/Private Space infrastructure.
3. **The price remains the same:** visible pre-reservation or implausible
   occupancy are indicators (concept §9.2). The literature reinforces the
   conservative communication (D5): limited deniability against A2/A3, never
   "invisible" against A4/A5.

---

## 6. Status of the P0 decisions and open questions

| Item | Before | Now | Evidence |
|---|---|---|---|
| **D1** — Private Space as the base | recommendation "check first" | **Resolved:** Private Space is the base (V6/V7, sketch §2) | API docs, LSS source |
| **D2** — Weaver slots | open | **Partial:** measurement path `getConfig().slots` verified (V3/V4); the number itself remains a device measurement (M4); check secdiscardable consumption additionally | `IWeaver.aidl`, SP manager |
| **P1 §8.1** — constant time across binder/HAL | open | **Open** (M2; structural constant time in LSS feasible, HAL round-trips unresolved) | — |
| **P1 §8.2** — Weaver slot count | open | as D2 | — |
| **P1 §8.3** — CE key in RAM | open | **Partial:** kernel part established (V5); userspace copies open (M4) | `KeyUtil.cpp` |
| **P1 §8.4** — single-active-user | U | **U** (structurally helps MLSU; switching details unchecked) | — |
| **P1 §8.5** — biometrics | O | **O** (design decision; D3 recommendation "disable" unchanged) | — |
| **P1 §8.6** — OTA/reset/device change | O | **O** | — |
| **P1 §8.7** — legal/UX, duress return path | O | **O** (P4 user study) | — |
| **P0 step 4** — external review | open | **Open** — this document does not replace the review, it *feeds* it with sourced references | — |
| **P0 step 5** — requirements v1.0 | open | **Open** — only after feedback from step 4 | — |

---

## 7. What this document does not do

No security proof, no measurement, no device statement. Every V line here means:
*at this one reference, on this one day, in this one branch*. The hard questions
remain where they were: M2 (constant time), M4 (hardware), external review (P0
steps 4/5). What has changed: the sketch now stands on checked signatures and
proven mechanisms instead of plausible assumptions — and with V7 it documents a
construction that comes closer to the target architecture than anything P0 knew.

---

## 8. Sources

1. [LockSettingsService.java — doVerifyCredential, onCredentialVerified, unified lock (android-latest-release)](https://cs.android.com/android/platform/superproject/+/android-latest-release:frameworks/base/services/core/java/com/android/server/locksettings/LockSettingsService.java) — lines 1678, 1721–1724, 1795–1797, 1913–1914, 2167–2169, 2618–2620, 2691–2692, 2769–2782, 3379 (V, 2026-08-19)
2. [SyntheticPasswordManager.java — unlockLskfBasedProtector, weaverVerify, mWeaverConfig (android-latest-release)](https://cs.android.com/android/platform/superproject/+/android-latest-release:frameworks/base/services/core/java/com/android/server/locksettings/SyntheticPasswordManager.java) — lines 793–794, 1534, 1583–1585, 1776–1778 (V, 2026-08-19)
3. [IWeaver.aidl — slot array, getConfig, per-slot throttle (refs/heads/main)](https://android.googlesource.com/platform/hardware/interfaces/+/refs/heads/main/weaver/aidl/android/hardware/weaver/IWeaver.aidl) (V, 2026-08-19)
4. [KeyUtil.cpp — installKey/evictKey/waitForBusyFiles, fscrypt keyring (refs/heads/main)](https://android.googlesource.com/platform/system/vold/+/refs/heads/main/KeyUtil.cpp) (V, 2026-08-19)
5. [VoldNativeService.cpp — unlockCeStorage/lockCeStorage (refs/heads/main)](https://android.googlesource.com/platform/system/vold/+/refs/heads/main/VoldNativeService.cpp) (V, 2026-08-19)
6. [UserManager — USER_TYPE_PROFILE_PRIVATE, DISALLOW_ADD_PRIVATE_PROFILE (API 35)](https://developer.android.com/reference/android/os/UserManager) (V, 2026-08-19)
7. [GrapheneOS — Features: duress PIN/password](https://grapheneos.org/features) (V, 2026-08-19)
8. [GrapheneOS — FAQ: Weaver, hardware delay, slot wipe](https://grapheneos.org/faq) (V, 2026-08-19)
9. [Quarkslab — "2021: A Titan M Odyssey" (whitepaper, BHEU 2021)](https://github.com/quarkslab/titanm/blob/master/BHEU_2021/EU-21-Rossi_Bellom-2021_A_Titan_M_Odyssey-wp.pdf) (V, 2026-08-19)
10. [Mobiflage — author page with limits and TRIM warning (Skillen/Mannan)](https://www.ccsl.carleton.ca/~askillen/mobiflage/) (V, 2026-08-19)
11. ["Towards Designing A Secure Plausibly Deniable System for Mobile" — arXiv:2002.02379](https://arxiv.org/pdf/2002.02379) (V, 2026-08-19) — multi-snapshot adversary, DEFTL/MobiCeal classification
12. [MobiCeal — MobiPluto/DEFTL classification (ResearchGate)](https://www.researchgate.net/publication/324597075_MobiCeal_Towards_Secure_and_Practical_Plausibly_Deniable_Encryption_on_Mobile_Devices) (V, 2026-08-19)

---

## License

[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/deed.en),
see [LICENSE](../LICENSE).
