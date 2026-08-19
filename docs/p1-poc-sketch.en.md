# P1 — PoC sketch: AOSP change points

**Multi-Layer Secure Unlock (MLSU)** · Phase P1 of the [feasibility path](../README.en.md#11-feasibility-path)

*[🇬🇧 English](p1-poc-sketch.en.md) · [🇩🇪 Deutsch](p1-poc-skizze.md)*

| | |
|---|---|
| **Status** | Sketch — code skeleton, not a patch, nothing to flash |
| **Version** | 0.1 |
| **Predecessors** | [P0 requirements](p0-requirements.en.md), [P0 findings](p0-findings.en.md), [concept paper](../README.en.md) |
| **Goal** | A ROM project (GrapheneOS, CalyxOS, own AOSP fork) can adopt this roadmap directly |
| **Basis** | AOSP `master` / Android 15+ (Private Space), as of 2026-08 |

---

## 1. Purpose and method

This document translates the concept into concrete change points in the Android
source tree. It is a **roadmap with code skeletons**, not an implementation: the
sketches show *where* and *how* the intervention looks, and honestly mark what
still needs verification before building.

Status convention as in [P0](p0-requirements.en.md#2-method-and-verification-status):

| Status | Meaning |
|---|---|
| **V** | Verified in AOSP source or official API docs (source cited in text) |
| **U** | Plausible from model/experience knowledge — **verify before P1** |
| **O** | Open — conflicting or missing information, design decision needed |

---

## 2. Strategic insight: Private Space is the foundation

Android 15's **Private Space** has already brought a large part of the MLSU
infrastructure into AOSP. Facts (V):

- New user type `android.os.usertype.profile.PRIVATE` (API 35) — a
  **standalone user in the multi-user model** with its own credential-encrypted
  storage (CE) and its own lock secret [1][2].
- Hiding is by design: launchers need `ACCESS_HIDDEN_PROFILES` and receive
  `ACTION_PROFILE_AVAILABLE` / `ACTION_PROFILE_UNAVAILABLE` broadcasts [1].
- Locking the private space goes through `UserManager.requestQuietModeEnabled`;
  the profile is then paused, apps inactive [1][2].
- CE/DE separation per user has been standard since Android 7 (V): vold manages
  per-user keys under `/data/misc/vold/user_keys/{de,ce}/<userId>`, unlocked via
  `vdc cryptfs unlock_user_key <id> <serial> <token> <secret>` [3][4].

**What this means for MLSU:** the concept paper (section 7) described the
intervention as reworking `LockSettingsService`, `vold`, `keystore2` and
SystemUI. With Private Space this shrinks to a **much smaller, well-bounded
core:**

> MLSU = PIN routing in `LockSettingsService` + "the second user stays invisible".

Everything else — two CE areas, separate locks, separate keystore namespaces,
app separation, hidden-profile mechanics — already exists and is **inherited**.

The difference from Private Space remains the core of the concept:

| | Private Space | MLSU |
|---|---|---|
| Choosing the area | separate UI ("show private space", own PIN entry) | **one single PIN entry on the identical lock screen** |
| Existence of the second area | detectable (user type, launcher API, settings) | no UI hint anywhere |
| Failure counters | per profile, but only the requested profile is checked | all profiles are **always** checked (SR-3), counters per profile (SR-4) |

---

## 3. Target architecture of the PoC

```
        ┌────────────────────────────────────────────────┐
        │ SystemUI Keyguard (UNCHANGED, identical)       │
        │   one PIN entry, no profile count, no          │
        │   biometrics (concept 9.6)                     │
        └───────────────────────┬────────────────────────┘
                                │ PIN
                                ▼
        ┌────────────────────────────────────────────────┐
        │ LockSettingsService  ← MLSU routing (NEW)      │
        │   doVerifyCredential checks against ALL        │
        │   linked profiles, always, no early return     │
        │   (SR-3)                                       │
        └───────────┬──────────────────┬─────────────────┘
                    │                  │
         unlockLskfBasedProtector      │ (no match → failure is
         per profile (existing)        │  charged to ALL profiles,
         └─ Gatekeeper/Weaver          │  SR-4/F-1)
            one slot per profile (SR-4)│
                    ▼                  ▼
        ┌────────────────────────────────────────────────┐
        │ exactly one match:  StorageManager.unlockUser(id)│
        │   vold: unlock_user_key → CE key of the         │
        │   matched profile in RAM, other profile stays   │
        │   locked (SR-2)                                 │
        └────────────────────────────────────────────────┘
                    │
                    ▼
        UserManager/AMS: matched user becomes active;
        other user invisible in all UIs (NEW, filter)
```

Principle from the concept paper (5.): **One single, unchanged lock screen.**
The MLSU routing happens below the UI — Keyguard does not know that two
profiles exist.

---

## 4. Components in detail

### 4.1 C1 — LockSettingsService: the MLSU routing (the core)

**Current state (V):** `LockSettingsService.doVerifyCredential(...)` calls
`SyntheticPasswordManager.unlockLskfBasedProtector()` for the given `userId`;
on success `onCredentialVerified` → CE unlock of the user. So exactly **one**
profile — the active one — is verified [5][6].

**Target:** the input is checked against the protectors of **all linked MLSU
profiles**. Structural constraints:

1. **No early return** (SR-3): the loop always runs over all profiles, even if
   an earlier one matched. This is the constant-time requirement of the concept
   — at binder/HAL level this remains an open question (concept 12.1, section 8).
2. **Failures hit all profiles** (SR-4, F-1): if nothing matches, the failure
   counters of all checked Weaver/Gatekeeper slots are incremented — exactly as
   in the [reference model](../reference/README.en.md). The owner thus also
   locks their hidden profile when someone guesses — intended, honestly
   documented (F-1).
3. **One match ⇒ exactly one:** profiles have independent keys (SR-1), so at
   most one can match. The result decides which user is unlocked — without the
   UI seeing the choice.

**Skeleton (Java, sketch):**

```java
// LockSettingsService — sketch of the MLSU routing (only the new path)
public @NonNull VerifyCredentialResponse doVerifyCredentialForMlsu(
        @NonNull LockscreenCredential credential, int callingUserId) {

    // MLSU config: which users are linked? (stored only in the private
    // profile, see 4.7 — no entry in visible DE storage)
    final int[] mlsuUsers = mlsuConfig.getLinkedUsers();          // e.g. [10, 11]

    int matchedUser = UserHandle.USER_NULL;
    SyntheticPassword matchedSp = null;

    // SR-3: ALWAYS evaluate all profiles — no early return.
    for (int userId : mlsuUsers) {
        AuthenticationResult result = mSpManager.unlockLskfBasedProtector(
                mGatekeeper, userId, credential, /* challenge */ 0L, callingUserId);
        // NO break, NO early return: the loop always completes.
        if (result.syntheticPassword != null) {
            matchedUser = userId;
            matchedSp = result.syntheticPassword;
        }
    }

    if (matchedUser == UserHandle.USER_NULL) {
        // The failure was already charged to every protector (SR-4/F-1).
        return VerifyCredentialResponse.ERROR;
    }

    // Unlock the CE of the matched profile — the other profile stays locked
    // and its CE key does not exist in RAM (SR-2, as far as vold allows —
    // to be verified, see 4.3).
    mStorageManager.unlockUser(matchedUser, /* token */ null, matchedSp.deriveKeyStorePassword());
    // Internal profile switch: AMS makes matchedUser active; Keyguard does NOT change.
    return VerifyCredentialResponse.OK;
}
```

> **Assessment:** the skeleton shows the *shape* of the intervention. The real
> implementation must reuse the existing `doVerifyCredential` path (challenge,
> `onCredentialVerified`, StrongAuth, biometric deferred queue) cleanly instead
> of duplicating it — otherwise two diverging paths emerge (concept 9.5: attack
> surface grows).

### 4.2 C2 — SyntheticPasswordManager: barely any change

**Current state (V):** each user has their own LSKF-based protector with its own
Gatekeeper handle or its own **Weaver slot**; `weaverVerify()` charges exactly
that slot on failure [5][7]. That is already "one slot per profile" (SR-4).

**Target:** no structural change. Two checkpoints:

- **Weaver slot count** (concept 12.2, P0 reading list L4): common secure
  elements provide only a few slots. For two profiles it probably suffices; the
  concrete number must be measured on the target device before P1 (U).
- **Behaviour on lockout:** if one profile is permanently locked, checking the
  remaining profiles must continue unchanged — a permanent lockout must not
  change the *time* of the overall evaluation (SR-3). How `weaverVerify`
  reacts in this case needs verification (U).

### 4.3 C3 — vold / StorageManager: CE of the chosen profile

**Current state (V):** `StorageManager.unlockUser(userId, token, secret)` → vold
`cryptfs unlock_user_key` loads the user's CE key; keys live under
`/data/misc/vold/user_keys/ce/<userId>` [3][4]. `lock_user_key` removes it.

**Target:** MLSU calls `unlockUser` only for the matched user. On profile switch
and on lock: `lock_user_key` for the *other* profile so its CE key does not
remain in RAM (SR-2). **Open (U):** whether vold/kernel really keeps the CE key
kernel-bound after `unlock_user_key`, and how fast `lock_user_key` removes it
from memory — one of the most important P1 measurements, not representable in
the Python model (F-2).

### 4.4 C4 — SystemUI Keyguard: deliberately unchanged

**Target: unchanged.** That is the point of the concept: the lock screen shows
exactly what it shows today. Concretely:

- No statement about the profile count, no user-picker icon, no "another
  profile available" hint (concept 5.1, 8.3).
- Failure counters and wait times identical to a device without MLSU — the UI
  only shows what the active user would see anyway (U: how Weaver throttle
  times map to the Keyguard display needs verification).
- **Biometrics off** (concept 9.6): fingerprint/face cannot select the area via
  "knowledge". In MLSU mode either restricted to one profile or disabled —
  design decision (O), to be made before P1.

### 4.5 C5 — UserManager/AMS: the second user disappears

**Current state (V):** Private Space already has the hidden-profile mechanics:
`USER_TYPE_PROFILE_PRIVATE`, launcher access only with `ACCESS_HIDDEN_PROFILES`,
broadcasts on lock/unlock [1][2].

**Target:** the duress/second user gets the same invisibility treatment, **plus**
system-wide filtering of the usual leak points (concept 6.2/6.3):

| Leak | Measure (sketch) |
|---|---|
| UserSwitcher / launcher / settings user list | inherit PRIVATE-type filter (V, exists) |
| Settings search, "About phone", account list | search/list per active profile; no cross-profile entry (U) |
| Notification history, media store, clipboard | separate per profile — partly inherited from Private Space, rest to verify (U) |
| Settings entry "MLSU active" | **only visible in the private profile** (concept 8.3) (O: where exactly) |
| Modem/eSIM logs, boot counter, crash reports | profile-neutral logging (concept 6.3) — system-wide logging change, P2 topic |

### 4.6 C6 — Setup wizard: the most critical part (UX)

The concept paper calls the setup flow "the most critical part from a user's
perspective" (7., 8.). Sketch of the flow in the private profile:

1. Set first PIN (private profile, "normal" setup).
2. **"Set up a second area?"** — explicit, with the threat-model table from
   section 4 of the concept paper in plain words: "Protects against person X
   holding the device. Does **not** protect against device forensics."
3. Set second PIN + **mandatory content**: the system suggests placing contacts,
   photos, apps and plausible activity into the duress area — an empty second
   profile is more suspicious than none at all (concept 8.1).
4. **Way back after PIN mix-up** (concept 8.2): whoever enters the wrong PIN
   under stress lands in the wrong area. There must be a way back **without a
   visible hint** (e.g. a long-press emergency gesture with silent switch back
   to the private profile — design idea, O).
5. Plain-language limits before anything is stored (concept 8.4).

### 4.7 C7 — MLSU configuration (provisioning)

**O:** where does the link "user A + user B = MLSU set" live? Requirements: not
in visible DE storage (concept 6.2), changeable only from the private profile,
off by default (concept 9.5). Obvious candidate: a file-based configuration in
the private profile's CE storage, read by `LockSettingsService` after that
profile's unlock. Design decision before P1.

---

## 5. Minimal PoC path (milestones)

The order follows the principle from the concept paper (6.4): first the core,
then everything else. Each milestone has a **test criterion**, not a "should".

| Milestone | Content | Test criterion |
|---|---|---|
| **M0** | Basis: AOSP 15+ on emulator or Pixel with unlockable bootloader; two users (one PRIVATE), both with own PIN; understand stock behaviour | `vdc cryptfs unlock_user_key` works for user 2; Private Space set-up works |
| **M1** | **PIN routing in LSS** (4.1): input checked against both protectors, matches the right user, CE unlocked. No constant-time claim yet | PIN 1 → profile 1, PIN 2 → profile 2, wrong PIN → nothing; switch without reboot |
| **M2** | **Constant time + counters** (SR-3/SR-4): loop always runs over all profiles; failures charge both counters; wait times as in the model. Timing measurement with the [bench rig](../reference/bench/timing.py) as reference | time difference between "match profile 1 / profile 2 / miss" below measurement threshold (method: P0 finding F-4: measure interleaved!) |
| **M3** | **Invisibility** (4.5, 4.6): second user gone from all UIs; setup flow; duress way-back; biometrics decision | checklist from section 6.3 of the concept paper done; no UI hint in screenshot walkthrough |
| **M4** | Hardware: measure Weaver slot count, CE-key-RAM behaviour (4.3), `lock_user_key` timing | measurement protocol; partial SR-2 statement possible |

Before M4 the feature is recommended to **nobody** (concept 11, P4 gate).

---

## 6. Stock/Pixel vs. MLSU PoC

| Area | Stock Android 15 | MLSU PoC (sketch) |
|---|---|---|
| Second area | Private Space (visible, own unlock UI) | like Private Space, but PIN routing |
| PIN selection | UI leads to the second lock | one PIN, no UI hint |
| Constant evaluation time | n/a (one profile checked) | all profiles always (SR-3) |
| Failure counters | per profile | per profile, but all charge on miss (F-1) |
| CE key in RAM | only the active user's | only the active user's, switch forces lock (U) |
| Biometrics | optional per profile | disabled/restricted (O) |

---

## 7. Link to the P0 findings

| Finding | Relevance for the PoC |
|---|---|
| **F-1** (failures lock hidden profiles) | In the AOSP context *intended* to be reproduced: all protectors charge on miss. Document the UX consequence (concept 8.2). |
| **F-2** (no RAM proof in Python) | Measure `lock_user_key` behaviour on real hardware (M4) — the only place where SR-2 becomes testable. |
| **F-3** (constant-time tag comparison) | Concerns the AEAD unwrap in the SP manager (C/C++ in `frameworks/base`/keystore — not visible in the Java skeleton). Adopt as an implementation requirement. |
| **F-4** (measurement methodology) | The bench rig is the reference for M2 — including the lesson learned (interleaved, randomised, not separate runs). |
| **F-5** (goal conflict) | Address concretely in the setup flow (4.6): separation vs. usability. |

---

## 8. Risks and open questions (to resolve before M1)

1. **Constant time over binder/HAL** (concept 12.1): the loop in LSS is
   structurally constant, but binder round-trips to Gatekeeper/Weaver and the
   AEAD unwrap are not guaranteed to be. Honest assessment: SR-3 on real
   hardware remains an **open measurement question** (M2, methodology F-4).
2. **Weaver slot count** (concept 12.2): do common secure elements have enough
   slots for 2+ profiles? (L4, M4)
3. **CE key in RAM** (SR-2): does `lock_user_key` actually remove the key from
   memory? (M4)
4. **Single active user**: Android allows exactly one active user — this
   *helps* MLSU (the second area is never active at the same time), but
   requires a clean switch including media/notification restart (U).
5. **Biometrics** (concept 9.6): decide disable vs. one profile.
6. **OTA/reset/device change** (concept 12.6): what happens to the MLSU set?
7. **Legal/UX**: the duress way-back and "plausible activity" (8.1) are design
   and legal questions, not code problems — test early with the target group
   (P4 user study, concept 10).

---

## 9. Sources

1. [UserManager.USER_TYPE_PROFILE_PRIVATE — API 35](https://developer.android.com/reference/android/os/UserManager) (V)
2. [Android 15 — Private Space (AOSP overview)](https://developer.android.com/work/versions/android-15) (V)
3. [vdc cryptfs unlock_user_key — command example from forensics practice](https://xdaforums.com/t/mate-9-how-to-retrieve-encrypted-files-from-a-broken-system-userdata-partition.3894561/) (V: command; U: key management details)
4. [CE/DE key paths under /data/misc/vold/user_keys](https://xdaforums.com/t/mate-9-how-to-retrieve-encrypted-files-from-a-broken-system-userdata-partition.3894561/) (V)
5. [SyntheticPasswordManager.java — unlockLskfBasedProtector, weaverVerify, unwrapSyntheticPasswordBlob](https://android.googlesource.com/platform/frameworks/base/+/master/services/core/java/com/android/server/locksettings/SyntheticPasswordManager.java) (V)
6. [LockSettingsService.java — doVerifyCredential / SP management](https://android.googlesource.com/platform/frameworks/base/+/master/services/core/java/com/android/server/locksettings/LockSettingsService.java) (V: structure; U: verify path details)
7. [Analysis of the LSS verify flow (secondary)](https://medium.com/@salamsajid7/hunting-android-lockscreen-bypasses-on-pixel-a-campaign-walkthrough-8601f12f9963) (U: secondary source, cross-check in source)

---

## License

[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/),
see [LICENSE](../LICENSE).
