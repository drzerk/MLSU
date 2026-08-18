# Request for feedback: PIN-selected profiles at the lock screen

**To:** maintainers of security-focused Android distributions
**From:** the MLSU project — [github.com/drzerk/mlsu](https://github.com/drzerk/mlsu)
**Status:** feedback request, not a patch submission. Nothing here is implemented for Android.
**License:** CC BY-SA 4.0

---

## What this asks

Android already has everything needed to keep two areas of a device
cryptographically apart — multi-user, FBE, work profiles, and since Android 15
Private Space. What it does not have is a **second unlock path**: a PIN that
opens a *different* area instead of the main one.

Every existing mechanism is a vault *inside* an unlocked device. Under coercion
that distinction is the whole point: an inspector holding an unlocked phone with
a visibly locked compartment asks the obvious next question.

Before writing any code we would like to know from people who maintain this part
of Android whether the idea is worth pursuing at all. **The questions come
first, because your answers decide whether there is a project.**

---

## Questions we cannot answer ourselves

1. **Is the lock-screen path realistically modifiable?** Evaluating the entry
   against several enrolled secrets touches `LockSettingsService` and the
   synthetic-password layer. How stable is that code across releases, and what
   would carrying such a patch cost over time?

2. **Are there enough Weaver slots?** The design needs one hardware failure
   counter per profile. How many slots do current secure elements expose in
   practice?

3. **Why the duress approach and not this one?** GrapheneOS chose a PIN that
   destroys keys. Was the multi-profile route considered and rejected — for
   technical reasons, or on responsibility grounds? That answer would save us
   months.

4. **Could this build on Private Space instead of beside it?** If the container
   work is already done, the remaining delta is the unlock path plus hiding the
   profile at the system level. Does Private Space's design allow attaching a
   second unlock path, or does it foreclose that?

5. **Is the deniability claim salvageable at all?** Storage-level attribution
   of unallocated flash is the risk we cannot assess. If a forensic examiner
   can reliably show that space is occupied by something, the core promise is
   gone and the honest move is to stop. Do you consider that already settled?

---

## What we did before asking

Not a wish list — the homework exists and is public.

- **Threat model per adversary class**, from opportunistic thief to specialist
  forensics, with an explicit statement of where protection ends.
- **26 requirements, each with an acceptance criterion** — not "must be
  constant time" but the measurement that decides it.
- **A runnable model** of the unlock selection: fixed slot count, decoy slots
  indistinguishable from real ones, independent per-profile keys with no master
  secret, branch-free selection, a Weaver model, 19 tests, and a timing rig.
- **Five findings from that model**, including two that changed the
  requirements. They are listed below because they are the parts a reviewer
  should attack first.

---

## Problems we already found

**A conflict between constant-time evaluation and independent failure
counters.** If every unlock derives against every slot — which the timing
requirement demands — then every failed attempt charges every slot. Charging
only the "intended" profile is impossible: a failed attempt carries no
information about which profile was meant. Consequence: guessing PINs locks out
a profile the guesser never knew existed. We do not have a good answer to this.
It may be the strongest argument against the whole approach.

**Unlock latency scales with slot count.** Hiding how many profiles exist means
deriving for all slots. Measured on a server CPU with Argon2id(t=3, m=64 MiB):
about 700 ms for four slots. On phone hardware, worse. This caps the number of
supportable profiles at a small number.

**Memory hygiene is unprovable in a high-level language.** "No key material of
other profiles in RAM" cannot be established in Python at all; a real
implementation needs controllable memory. This is a language decision, not a
detail.

**Exception-based AEAD tag failure is a secret-dependent branch.** The
authenticity check must yield a flag in constant time. This constrains the
crypto binding.

---

## What we are not claiming

- **Not invisibility.** If this ships in a publicly known ROM, an examiner who
  recognizes the ROM knows a second profile *can* exist. The question shifts
  from "is there more?" to "show me the second PIN". We think that is an
  acceptable trade for auditability, but it must never be advertised away.
- **Not protection against a compromised system**, observed PIN entry, or
  specialist forensics.
- **Not a way around lawful disclosure obligations.** The purpose is protecting
  legitimate confidentiality — for journalists, activists, people in abusive
  situations, travellers under professional secrecy.
- **Not usable without user discipline.** An empty second profile is more
  suspicious than none. That makes it a product problem as much as a technical
  one, and it may be the reason the idea fails in practice.

---

## What we are asking for

Not adoption. An answer to questions 1–5 — even a short one, even a discouraging
one. A "we looked at this and here is why not" is a useful outcome and we will
publish it as such.

If the answers are encouraging, the next step on our side is decision D1
(Private Space as a base or not) and a prototype on the emulator, not a patch
submission.

---

## Material

| | |
|---|---|
| Concept paper | [`README.en.md`](../README.en.md) |
| Requirements, threat model, abort criteria | [`docs/p0-anforderungen.md`](p0-anforderungen.md) *(German)* |
| Findings from the model | [`docs/p0-befunde.md`](p0-befunde.md) *(German)* |
| Reference model, tests, timing rig | [`reference/`](../reference/) |

The two German documents will be translated on request — say the word and they
follow.
