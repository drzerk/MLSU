# P2 — Metadata audit: leak checklist for the PoC

**Multi-Layer Secure Unlock (MLSU)** · Phase P2 of the [feasibility path](../README.en.md#11-feasibility-path)

*[🇬🇧 English](p2-metadata-audit.en.md) · [🇩🇪 Deutsch](p2-metadaten-audit.md)*

| | |
|---|---|
| **Status** | Checklist — to be worked through on the built PoC (P1, milestone M3) |
| **Version** | 0.1 |
| **Predecessors** | [Concept paper §6.2/§6.3](../README.en.md#62-storage-separation), [P1 PoC sketch](p1-poc-sketch.en.md) C5/M3, [P0 findings](p0-findings.en.md) |
| **Goal** | Every metadata leak is one row with a **test method** and a **test criterion** — "checked" means: demonstrated on the device, not assumed |
| **Non-goal** | The forensics limits from concept §9 (wear-leveling, ROM detection) are listed here as *known, unfixable limits* — they are tested to document their failure, not to "fix" them |

---

## 1. What is a metadata leak?

The concept paper distinguishes two assets to protect (P0 requirements G2/G3):

- **G2 — existence** of the private area: must not be provable.
- **G3 — attribution** of activity to an area: must not allow conclusions
  about *what* the user does (even without revealing content).

A metadata leak is any information outside the encrypted content from which an
examiner can violate G2 or G3. The most dangerous leaks are not in the payload
but in what the system stores *around* it (concept §6.3).

This checklist is the plan for the audit: **every row is executed on the
built PoC**, not decided on paper. The P1 sketch (M3 "invisibility") ticks
exactly this list.

---

## 2. Test environment and method

| Element | Decision |
|---|---|
| Device | AOSP emulator (M0 basis) or Pixel with unlockable bootloader |
| Access | `adb shell` with root (`adb root` on emulator/test build) — an examiner does **not** have that; the audit checks the *surface an examiner sees* |
| Three test classes | **(a) UI visual check** — screenshots of all entry points; **(b) file/storage inspection** — directory listings, sizes, contents; **(c) behaviour observation** — logcat, dumpsys, timing |
| Protocol | One entry per row: date, build, device, command, finding, status |
| Status | ✅ checked (criterion met) · ⚠️ deviation (document) · ❌ not met (M3 blocker) · ⛔ known limit (failure expected, document) |

---

## 3. The checklist

### A — UI visibility (asset G2)

| # | Leak | Why dangerous | Test method | PoC criterion (checked = ok) | Status |
|---|---|---|---|---|---|
| A1 | **UserSwitcher / launcher** shows the second user (name, icon, avatar) | Existence directly visible | Screenshots: Settings → System → Users; launcher app drawer; "switch user" UI | Second user appears in **no** list, not even as "private space" | open |
| A2 | **Settings search** finds the second area | Search reveals existence | `adb shell settings list global` + search for profile names/area terms in the Settings app | No hits for area names; no settings page reachable | open |
| A3 | **"About phone" / account list / storage overview** | Existence via side doors | Screenshots + `adb shell dumpsys account` | Only the active profile visible; no cross-references | open |
| A4 | **Settings entry "MLSU active"** | Feature banner defeats the purpose (concept §8.3) | Visual check of both profiles | Entry **only visible in the private profile**; nothing in the duress profile | open |
| A5 | **Lock screen differences** (PIN length, prompt text, "unlock second area" button) | Divergent UI reveals multi-profile operation (concept §5.1) | Screenshots of both lock states, byte comparison of layouts | Both lock screens **identical**, no profile count, no second login path in the UI | open |
| A6 | **Notifications / history** of the inactive profile | History shows activity of the other area (G3) | Create a notification in profile B, look in profile A's shade; `dumpsys notification` | No notification from profile B visible; history separate (inherited from Private Space, to confirm) | open |

### B — File and storage level (G2)

| # | Leak | Why dangerous | Test method | PoC criterion | Status |
|---|---|---|---|---|---|
| B1 | **DE storage of the second user** contains personal data (app lists, search indexes, thumbnails, notification caches) | DE is readable from boot → existence + content (concept §6.2) | `adb shell ls -laR /data/user_de/` (root), search specifically for caches/indexes of the duress profile | Nothing personal in DE; only system-required, profile-neutral data | open |
| B2 | **Storage occupancy** does not match the visible content | Allocated, unattributable space reveals hidden data (concept §6.3) | `adb shell df /data` before/after profile switch; `du` per user directory | Occupancy changes caused by MLSU stay below the visibility threshold or are plausibly normalised (design decision: pre-allocation) | open |
| B3 | **MLSU configuration** (user link, state byte, slot bookkeeping) in readable storage | The link itself is evidence (P1 C7, Stufe-0 state-byte finding) | `find /data -name '*mlsu*'` (root); verify the link lives only in the **unlocked** private profile | Configuration exclusively in the private profile's CE area; not readable when locked | open |
| B4 | **vold key metadata** (`/data/misc/vold/user_keys/ce/<userId>`) | Existence of a second CE key reveals the second area | `adb shell ls /data/misc/vold/user_keys/ce/` (root) | Document the finding: number of key directories. **Probably not preventable** — key files must exist. Mitigation if needed: same directory count on non-MLSU devices via dummy keys, or accept the limit | open |
| B5 | **Backup/cloud metadata** (one account knows both profiles) | Lifts the separation (concept §6.3) | After enrolling both profiles: check account list per profile, replay backup contents | Separate sync identities per profile; no shared account entry | open |
| B6 | **FTL/wear-leveling remnants** of old blocks | Physical remnants provable with forensics (concept §9.2) | — (requires chip-off) | **⛔ known limit:** not solvable at application level; document in the PoC that G2 against A5 is not guaranteed | ⛔ |

### C — Behaviour (G3)

| # | Leak | Why dangerous | Test method | PoC criterion | Status |
|---|---|---|---|---|---|
| C1 | **Timing difference in PIN evaluation** (match profile A / profile B / miss) | Timing profile reveals the number of profiles (SR-3) | bench rig from the [reference](../reference/bench/timing.py) on the device, interleaved (finding F-4) | No signature above the measurement threshold; measurement protocol attached | open |
| C2 | **Failure counters / wait times** behave differently than expected | Counter behaviour can reveal existence (SR-4/F-1) | 1, 5, 10, 20 failed attempts → compare observed behaviour with the [model](../reference/README.en.md) | Behaviour matches the model prediction; documented deviations are **not** silent | open |
| C3 | **Modem/eSIM logs** (connection history, roaming, IMSI switches) profile-specific | Metadata outside the profile context (concept §6.3) | `adb logcat -b radio -d`, `dumpsys telephony.registry` after a profile switch | Logs profile-neutral or separate; no conclusion about profile switches | open |
| C4 | **Boot counter / panic logs / crash reports** | Repeated switching leaves traces | `adb shell getprop` (bootcount), `/sys/fs/pstore`, logcat after cold start | Boot and panic logs profile-neutral; no switch indicator | open |
| C5 | **Activity timestamps** ("last used 6 months ago" looks staged) | Implausible timestamps raise suspicion (concept §6.3) | Check timestamps in both profiles after use | Activity in the duress profile plausible (setup flow seeds base activity, P1 C6) | open |
| C6 | **Biometrics status** | Biometrics cannot select the area via "knowledge" (concept §9.6) | Enrol fingerprint/face in both profiles and lock | Biometrics in MLSU mode disabled or restricted to one profile (design decision from P1) | open |

### D — System service separation (G3)

| # | Leak | Why dangerous | Test method | PoC criterion | Status |
|---|---|---|---|---|---|
| D1 | **Clipboard / media store / account management** shared across profiles | Actions in one area visible in the other | Copy text in profile B → paste in profile A; compare media store listings | Separate clipboard, separate media stores, separate accounts | open |
| D2 | **Cross-profile IPC / services** | A service of both profiles lifts the separation (concept §6.2) | `dumpsys activity services`, `dumpsys package` for shared services | No shared user-specific service between the profiles | open |
| D3 | **ROM detection** (build fingerprint, system apps reveal MLSU-capable ROM) | Fundamental limit for open source (concept §9.1) | `getprop ro.build.fingerprint`, package list | **⛔ known limit:** no clean choice between auditability and concealment — document, don't hide | ⛔ |

---

## 4. Order and weighting

| Priority | Rows | Rationale |
|---|---|---|
| **P0 — M3 blocker** | A1–A6, B1, C1 | UI and timing leaks are the core promise; without them the PoC is worthless |
| **P1 — important** | B2–B5, C2, C5, D1, D2 | Detectable for A4 (standard forensics); mostly partly inherited from Private Space |
| **P2 — later** | C3, C4 | Modem/boot logs need device access and are partly vendor territory |
| **⛔ — limit** | B6, D3 | Not fixable; tested to prove the documented failure (concept §9) |

P0 rows must be ✅ before the M3 release. P1 rows must be documented (even as
⚠️ with a mitigation). ⛔ rows only need the documentation proof — **hiding
them would be the actual failure** (concept §14).

---

## 5. Test protocol template (fill in per row)

```
Leak:            A1 — UserSwitcher/launcher shows the second user
Date/Build:      2026-08-19 / mlsu-poc-m3-xxx / Pixel 8, AOSP 16
Command:         adb shell pm list users; screenshots 01–04
Finding:         Only "main user" and "private space" (AOSP default) —
                 private space appears in the user list (AOSP stock behaviour)
Criterion:       Second user appears in no list
Status:          ⚠️ deviation — AOSP user list shows the PRIVATE user;
                 mitigation: filter in the UserManager report (P1 C5) required
```

---

## 6. What this document is not

Not a security proof, not a complete forensics analysis, and not legal advice.
A "✅" in this list means: *this single checkpoint is confirmed on the built
PoC* — not that the system is secure. The overarching limits (A5 special
forensics, ROM detection) remain as described in concept §9 and P0.

---

## License

[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/),
see [LICENSE](../LICENSE).
