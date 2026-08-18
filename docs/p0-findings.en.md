# P0 — Findings from the reference implementation

**Multi-Layer Secure Unlock (MLSU)** · Results from
[`reference/`](../reference/README.en.md)

*🇬🇧 English · [🇩🇪 Deutsch](p0-befunde.md)*

| | |
|---|---|
| **Date** | 2026-08-18 |
| **Basis** | Python model of the selection logic, 19 requirement tests, timing rig |
| **Environment** | Python 3.11, argon2-cffi 25.1.0, cryptography 41.0.7, x86-64 server |
| **Reach** | Model level. No statement about Android, hardware or file systems |

Five findings, two of which change the requirements directly and one of which
concerns the test method itself.

---

## F-1 — Conflict: constant time versus independent failure counters

**Observation.** SR-3 requires every unlock to derive against every slot. As a
consequence every failed attempt charges *every* slot. The test
`test_lockout_is_reachable_by_guessing_alone` shows the effect: 31 guessed PINs
lock out the profile the guesser has never seen.

```
  after   1 failed attempt:  counters [1, 1, 1, 1]
  after  15 failed attempts: counters [15, 15, 15, 15]
  after  31 failed attempts: counters [30, 30, 30, 30]  → locked out
```

**Why this cannot be engineered away.** Incrementing only the counter of the
"intended" profile is impossible: a failed attempt carries no information about
which profile was meant. That is precisely the point of the construction.

**Significance.** SR-4 ("failed attempts in profile B do not change the lockout
behaviour of profile A") is not satisfiable as phrased. What is satisfiable is
the weaker form: *successful* unlocks of one profile leave the other counters
untouched, *failed* ones necessarily do not.

In practice: anyone who gets hold of the device and guesses PINs can drive the
private area into lockout — or, depending on the threshold, into deletion —
without ever having known it was there. For the target audience that is a
serious side effect, not a detail.

**Consequence.**
- Rephrase SR-4 (see "Changes to P0" below).
- New question for reviewers: how does a Weaver-based design handle this?
- To be settled on the product side: what happens at the threshold — lockout or
  deletion? Deletion in response to a stranger's guessing would be a data-loss
  risk the target audience must know about.

---

## F-2 — SR-2 cannot be tested in this language

**Observation.** "After unlocking profile B, no key material of profile A exists
in RAM" can in CPython be neither established nor refuted: immutable `bytes` are
copied freely, freed memory is not zeroed, and a key that has once existed as a
`bytes` object can no longer be erased.

**Consequence.** SR-2 is not a requirement a model can tick off — it decides the
language for P1. An implementation that takes SR-2 seriously needs controllable
memory (Rust with `zeroize`, or C). This belongs in the decision list before P1.

---

## F-3 — The tag check is a secret-dependent branch

**Observation.** In the model, AEAD decryption reports its result through an
exception (`InvalidTag`). An exception is control flow that depends on the
secret — exactly what SR-3 forbids.

**Consequence.** Binding for the real implementation: the authenticity check
must yield a flag in constant time, not an exception path. That is a requirement
on the crypto library used and belongs in the selection criteria for P1.

---

## F-4 — The timing rig produced a false signal first

**Observation.** The first version of the timing rig compared measurement series
from *separate* runs and reported `t = +9.39` for "2 profiles versus 1 profile"
— well above the threshold of 4.5, apparently a leak. After rebuilding it around
a single, per-round randomly interleaved measurement, the effect disappeared
entirely (`t = +1.08` over 300 rounds).

The measured difference was clock drift and cache state between two runs, not a
property of the system.

**Consequence.** SR-3's acceptance criterion must prescribe the method, not just
the result: interleaved measurement of all classes in one session, order
randomized per round. Otherwise the test either produces false signals or —
worse — misses real ones, because someone changes the method until the result
looks acceptable.

Incidentally: the rig itself ran into the lockout from F-1 (after 30 failed
attempts every measurement returned immediately and measured the lockout path
instead of the derivation), which was the second methodological error in the
same file. Both are documented in the code.

---

## F-5 — Unlock latency scales linearly with the slot count

**Measurement**, 4 slots, Argon2id(t=3, m=64 MiB, p=1) — the parameters from the
concept paper:

| Class | Mean | Median | Minimum |
|---|---|---|---|
| Hit profile 1 | 705 ms | 699 ms | 665 ms |
| Hit profile 2 | 711 ms | 699 ms | 678 ms |
| Miss | 707 ms | 701 ms | 674 ms |

About **700 ms on a server CPU**; on a phone, expect worse. The reason is
structural: hiding the number of profiles means computing every slot, so the
cost is `SLOT_COUNT × KDF`.

**Consequence.** Spare slots "just in case" are expensive. `SLOT_COUNT` should
equal exactly the maximum supported number of profiles, no more; for two
profiles that halves the wait. This supports decision D2 (start with exactly two
profiles) with a number instead of a hunch.

It remains open whether the KDF parameters are tenable on mobile hardware at
all. That is a measurement on a real device, not a model result.

---

## What the model confirmed

Not everything was a problem:

- **SR-1** — independent profile keys, no master secret: cleanly achievable in
  the model.
- **SR-3, core case** — which profile matched, and whether any matched at all,
  is not visible in the runtime (`t = +1.09` and `t = −0.44` respectively over
  300 rounds, threshold 4.5).
- **SR-8/SR-9, model level** — occupied and empty slots are identical in size
  and shape; the number of enrolled profiles was not measurable in the runtime.
- **FR-1** — the PIN alone selects the area. That is the property distinguishing
  MLSU from Private Space and work profiles, and it works.

This is not a security proof. It means: at this point nothing fundamental stands
in the way of building a real prototype — the open risks lie elsewhere, namely
in storage forensics and metadata.

---

## Changes to P0

The findings produce concrete changes to the
[requirements document](p0-requirements.en.md):

| # | Change | Reason |
|---|---|---|
| 1 | Rephrase SR-4: only successful unlocks may leave other counters untouched | F-1 |
| 2 | Extend SR-3's acceptance criterion with the measurement method (interleaved, randomized order) | F-4 |
| 3 | New decision D6: an implementation language with controllable memory for P1 | F-2 |
| 4 | New requirement SR-12: the authenticity check yields a flag in constant time, not an exception path | F-3 |
| 5 | Refine D2: `SLOT_COUNT` = maximum profile count, no spare slots | F-5 |
| 6 | New product question: behaviour at the failed-attempt threshold (lockout or deletion) | F-1 |

These changes are incorporated in the requirements document.

---

## License

This document is licensed under
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
See [LICENSE](../LICENSE).
