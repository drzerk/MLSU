# R1 — GrapheneOS: ready-to-send forum post

**Multi-Layer Secure Unlock (MLSU)** · Step 4 of the [feasibility path](../../README.en.md#11-feasibility-path)

| | |
|---|---|
| **Status** | Ready to send — sending is a human decision |
| **Prepared** | 2026-08-26 |
| **Channel** | `discuss.grapheneos.org`, category **Development** (fallback: General); e-mail fallback `contact@grapheneos.org` |
| **Source** | [Review package §4, draft A](../p0-reviewpaket.md#4-entwurf-a--grapheneos-forumsbeitrag-en) — this file is that draft turned into the exact text to post |
| **Goal** | One of the ≥ 2 substantial replies P0 step 4 requires |

---

## 1. Before you post

Resolved while preparing this file:

- [x] All repository links in the post are absolute and point at English documents.
- [x] The post links rather than pastes — it stays short enough to answer.
- [x] Limits are stated before the ask (no invisibility claim), per concept §9.1 and decision D5.
- [x] Prior forum threads on this topic located and cited (see below).
- [x] Licensing named: the code is Apache-2.0 since 2026-08-25, so a ROM project could actually use it.

Still needs you, at the moment of posting:

- [ ] **Read the prior threads first.** These are on the same subject and were not opened by us. If one of them already answers a question below, drop that question — or reply in that thread instead of opening a new one:
      [Setting up a secondary passcode that opens a dummy profile](https://discuss.grapheneos.org/d/21122-setting-up-a-secondary-passcode-that-opens-a-dummy-profile) ·
      [Decoy Profile?](https://discuss.grapheneos.org/d/22792-decoy-profile) ·
      [Duress PIN limited usefulness](https://discuss.grapheneos.org/d/17241-duress-pin-limited-usefulness) ·
      [Duress PIN idea](https://discuss.grapheneos.org/d/17901-duress-pin-idea)
- [ ] **Confirm the category.** *Development* fits a design/feasibility question; check its description at post time and use *General* if Development is reserved for work on GrapheneOS itself.
- [ ] **Decide the reply address.** The repo is public; replies get quoted with permission, otherwise anonymised (review package §8).
- [ ] **Do not cross-post.** One channel per project. CalyxOS gets draft B separately, not the same text in a second GrapheneOS venue.

---

## 2. The post

**Title:**

```
Feasibility review: PIN-selected profiles at the lock screen (design question, not a feature request)
```

**Body:**

```
We're a small research-stage project — https://github.com/drzerk/MLSU — evaluating a
lock-screen design, and we'd rather hear "no, and here's why" from people who have
built this layer than find out ourselves in six months.

The design: one lock screen, two cryptographically separated profiles, and the entered
PIN alone decides which one unlocks (PIN 1 → private profile, PIN 2 → a deliberately
ordinary second profile). The unchosen profile stays locked, its key is not in memory,
and the UI gives no hint that it exists.

Two things up front, so nobody has to argue us out of them:

We are not claiming invisibility. If something like this ships in a recognizable ROM,
an examiner who recognizes the ROM knows a second profile *can* exist, and the question
becomes "show me the second PIN". We accept that trade — auditability over concealment —
and we document the forensic limits rather than advertise around them. Deniability is
claimed against personal coercion and brief inspections, never against lab forensics.

And this has come up here before (dummy-profile and decoy-profile threads, and the
duress-usefulness ones). We're not trying to re-litigate those. What we're asking for is
narrower: a judgment on whether the *implementation* is sound enough to be worth building.

Before asking, we did the homework:

- a runnable model of the selection logic with tests and a timing rig,
- a requirements document with acceptance criteria and explicit abort criteria,
- a source-level check of our platform assumptions against AOSP
  (android-latest-release, read 2026-08-19).

That check already corrected our own sketch once — we had the signature of
unlockLskfBasedProtector wrong — and it turned up that AOSP's unified-lock path already
unlocks a profile with a credential derived from the parent. Which is exactly why we're
asking maintainers now instead of assuming.

Questions — the same set goes to CalyxOS, so the answers stay comparable. Any one of
them, however short, is useful:

1. Maintenance cost and stability. How much of LockSettingsService and the
   synthetic-password layer would this realistically touch, and how stable is that code
   across releases? We located the routing point in doVerifyCredential — the unified-lock
   path sits in the same function. Is coexisting with it realistic, or does that just
   double the risk surface?

2. Weaver slots in practice. The HAL reports getConfig().slots, but we have no device to
   measure on. On Pixel/Titan-class hardware, how many slots are actually available, and
   does the platform already consume one per profile? We found secdiscardable taking a
   slot. Do two MLSU profiles fit, or does that collide immediately?

3. Duress vs. multi-profile. You chose a duress PIN that destroys keys. Was a
   non-destructive multi-profile variant like this considered and rejected — on technical
   grounds, or on responsibility grounds? We are genuinely undecided about which answer is
   the right one, and your reasoning would save us months.

4. Private Space as the base. We tentatively decided MLSU should build on the private-space
   user type (own CE storage, own lock, hidden-profile mechanics) and add only the unlock
   routing plus system-wide invisibility. Does that design permit attaching a second unlock
   path, or does it foreclose it?

5. The counter problem, which we have no good answer to. Constant-time evaluation means
   every unlock attempt must evaluate every protector, so every failed attempt charges
   every profile's failure counter. Someone idly guessing PINs can lock out — or, at a
   wipe threshold, destroy — a profile they never knew existed. In your view, is that
   disqualifying for the whole approach?

We're asking for opinions, not adoption and not a code review. If the answers are
encouraging, our next step is an emulator prototype, not a patch submission. If they're
discouraging, we publish that and stop.

Material (all English, code is Apache-2.0, documents CC BY-SA 4.0):

- Concept and threat model: https://github.com/drzerk/MLSU/blob/main/README.en.md
- Requirements, acceptance and abort criteria:
  https://github.com/drzerk/MLSU/blob/main/docs/p0-requirements.en.md
- What the model found, including the counter conflict in question 5:
  https://github.com/drzerk/MLSU/blob/main/docs/p0-findings.en.md
- Source-level verification against AOSP:
  https://github.com/drzerk/MLSU/blob/main/docs/p1-verification.en.md
- Runnable reference model: https://github.com/drzerk/MLSU/tree/main/reference

Thanks for reading this far.
```

---

## 3. After posting

- **Log it.** Fill in the R1 row in the [review package](../p0-reviewpaket.md#2-reviewer-matrix-und-versandplan): date sent, link to the thread.
- **Time budget.** After 3–4 weeks without a substantive answer: exactly one friendly
  reminder, then either switch channel (`contact@grapheneos.org`) or record R1 as
  "no reply" and approach a third ROM project with the same text.
- **What counts as a reply** and how to record one: review package §8.1 / §8.2.
- **Watch for kill signals.** An answer that says constant-time evaluation is not
  achievable on real hardware triggers AB-2; "no ROM project would take this" triggers
  AB-3. Both get documented, not buried (§8.4).
- **Question 5 is the one that can end the project.** If the answer is "yes, that's
  disqualifying", say so in the repository and stop rather than build around it.

---

## License

[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/), see [LICENSE](../../LICENSE).
