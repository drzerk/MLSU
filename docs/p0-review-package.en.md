# P0 — Review package: ready-to-send requests to external reviewers

**Multi-Layer Secure Unlock (MLSU)** · Step 4 of the [feasibility path](../README.en.md#11-feasibility-path)

*[🇬🇧 English](p0-review-package.en.md) · [🇩🇪 Deutsch](p0-reviewpaket.md)*

| | |
|---|---|
| **Status** | Drafts ready to send — dispatch open (no earlier than a project decision) |
| **Version** | 0.1 |
| **As of** | 2026-08-19 |
| **Predecessors** | [P0 requirements §7](p0-requirements.en.md#7-question-catalogue-for-external-review) (question catalogue), [P1 verification](p1-verification.en.md) (references), [ROM proposal](rom-proposal.en.md) (adoption pitch) |
| **Goal** | Step 4 of the P0 path: send the question catalogue to three external reviewers, **≥ 2 substantive responses** |
| **Non-goal** | Target-group study (questions 10–12, P4), obtaining or giving legal advice, the dispatch itself |

---

## 1. Purpose and classification

The [question catalogue in P0 §7](p0-requirements.en.md#7-question-catalogue-for-external-review)
is the content specification; this document turns it into **ready-to-send
requests**. Each draft names the channel, the title and the complete text to
paste. The questions are deliberately kept **comparable across reviewers**
(same questionnaire to all ROM projects) so the responses can be weighed
against each other.

Three rules that follow from the project's honesty (concept §14):

1. **No sales rhetoric.** Every request leads with the known limits (no
   invisibility, F-1, forensic limits). A *"no, and here is why"* is a valuable
   outcome and will be published as such.
2. **Reviewers do not have to verify for themselves.** The requests link the
   [P1 verification](p1-verification.en.md) — reviewers assess the *assumptions
   and design questions*, not our source checking.
3. **Answers may kill the project.** AB-2 (constant time unreachable), AB-3 (no
   ROM project willing) and AB-5 (legal worsening) are intended stop criteria —
   a kill signal is documented, not concealed (section 8).

**Delimitation from the [ROM proposal](rom-proposal.en.md):** the proposal is
the *adoption pitch* ("would you take this in?"). This package is the *review
questionnaire* ("is this technically sound, and why did you decide
differently?"). The drafts here link the proposal as material but do not
replace it.

---

## 2. Reviewer matrix and dispatch plan

| ID | Reviewer | Why | Channel (checked 2026-08-19) | Draft | Sent | Response |
|---|---|---|---|---|---|---|
| **R1** | GrapheneOS | Has actually built the duress mechanism — the counter-answer to MLSU | Discussion forum `discuss.grapheneos.org` (official discussion channel; Reddit redirects there); fallback `contact@grapheneos.org` | [A](#4-draft-a--grapheneos-forum-post-en) | open | – |
| **R2** | CalyxOS | Second ROM project with its own security culture; feature requests officially run via GitLab | GitLab issue `CalyxOS/calyxos` (official channel for feature/functionality requests since 2025-09); optional Matrix ping `@calyx_institute:matrix.org` | [B](#5-draft-b--calyxos-gitlab-issue-en) | open | – |
| **R3** | Forensic practice | Answers AB-1 and the metadata questions from a practitioner's view | Forum `forensicfocus.com/forums` (active DFIR community) | [C](#6-draft-c--forensics-forum-post-en) | open | – |
| **R4** | Legal scholarship | Answers P0 questions 8/9 — which can kill the project | Personal request (university chair for IT/criminal law, specialized lawyer) | [D](#7-draft-d--legal-template-en) | open | – |

**Target:** ≥ 2 substantive responses from R1–R4. R4 is optional for the count;
without an R4 response, AB-5 remains explicitly open in step 5.

**Reuse:** drafts A/B are deliberately written so that they can go to other
AOSP-near projects with a changed opening paragraph (D4: seek cooperation). A
third ROM project is the natural fallback channel if R1 or R2 stays
unanswered.

---

## 3. Before sending (checklist per channel)

**Common:**

- [ ] Link the English documents (the repo has EN mirrors for everything):
      `README.en.md`, `docs/p0-requirements.en.md`, `docs/p0-findings.en.md`,
      `docs/p1-verification.en.md`, `reference/`.
- [ ] Do not paste everything into the post — link; keep the posts short and
      answerable.
- [ ] Clarify the reply address: the repo is public; quote responses with
      permission, otherwise anonymize (see section 8).
- [ ] Set a time budget: after 3–4 weeks without an answer, exactly **one**
      friendly reminder, then switch channel or record the reviewer as "no
      response". No cross-posting the same request into several channels of the
      same project (forum etiquette).

**R1 — GrapheneOS forum:** check the category list when sending and pick the
most fitting one (development/design discussion). Search the forum for `duress`
first and cite an existing thread instead of opening a new one if useful. Tone:
matter-of-fact, limits first — the community rightly rejects deniability
promises, and this project makes none (concept §9.1).

**R2 — CalyxOS GitLab:** use the repo's issue template if one is required; do
not set labels yourself. The draft is worded as a design discussion, not a
feature request — the difference belongs in the title.

**R3 — Forensic Focus:** read the forum rules; explicitly **no** "how do I
defeat forensics" framing. The draft asks what examiners *see*, so the project
can document its limits. Respect the professional discretion of respondents.

**R4 — Legal:** ask personally, clarify fees and scope first; do **not** expect
or demand unpaid legal advice. The draft can serve as a starting point, but
legal questions must be asked per legal system — the template deliberately
leaves the jurisdiction open.

---

## 4. Draft A — GrapheneOS (forum post, EN)

**Title:** Feasibility review: PIN-selected profiles at the lock screen
(design question, not a feature request)

**Text:**

> We're a small research-stage project — https://github.com/drzerk/MLSU —
> evaluating a lock-screen design: one lock screen, two cryptographically
> separated profiles, and the entered PIN alone decides which profile unlocks
> (PIN 1 → private profile, PIN 2 → a deliberately ordinary second profile).
> The unchosen profile stays locked, and nothing in the UI hints at the other
> one's existence.
>
> We are explicitly **not** claiming invisibility: if a feature like this ships
> in a recognizable ROM, an examiner who recognizes the ROM knows a second
> profile *can* exist — the question shifts to "show me the second PIN". We
> accept that trade (auditability over concealment) and document the forensic
> limits. What we want from this community is a technical judgment on whether
> the idea is sound enough to build at all. A clear "no, and here is why" is a
> valuable outcome for us and will be published as such.
>
> Before asking, we did the homework: a runnable model of the selection logic
> with tests and a timing rig, a requirements document with acceptance
> criteria and abort criteria, and a source-level verification of our platform
> assumptions against AOSP (`android-latest-release`, 2026-08-19):
> `docs/p1-verification.en.md`. That check already corrected our own sketch
> once (signature of `unlockLskfBasedProtector`) and found that AOSP's
> unified-lock path already unlocks a profile with a credential derived from
> the parent — which is why we are asking maintainers now instead of assuming.
>
> Questions (same set we are sending to CalyxOS, for comparability):
>
> 1. **Maintenance cost and stability.** How much of `LockSettingsService` and
>    the synthetic-password layer would this realistically touch, and how
>    stable is that code across releases? Our verification located the routing
>    point in `doVerifyCredential`; the unified-lock path sits in the same
>    function. Is coexisting with it realistic, or does that double the risk?
> 2. **Weaver slots in practice.** The HAL reports `getConfig().slots`, but we
>    have no device to measure on. On Pixel/Titan-class hardware, how many
>    slots are actually available, and does the platform consume any per
>    profile (we found `secdiscardable` uses a slot)? Would two MLSU profiles
>    fit, or does that already collide?
> 3. **Duress vs. multi-profile.** GrapheneOS chose a duress PIN that destroys
>    keys. Was a non-destructive multi-profile variant like this ever
>    considered and rejected — for technical reasons, or on responsibility
>    grounds? We are genuinely uncertain whether the destructive answer is the
>    better one; your reasoning would save us months.
> 4. **Private Space as base.** We tentatively decided MLSU should build on the
>    private-space user type (own CE storage, own lock, hidden-profile
>    mechanics) and add only the unlock routing plus system-wide invisibility.
>    Does Private Space's design permit attaching a second unlock path, or does
>    it foreclose that?
> 5. **The counter problem.** Because every unlock must evaluate all protectors
>    (constant time), every failed attempt charges every profile's failure
>    counter — someone guessing PINs can lock out a profile they never knew
>    existed. We have no good answer. In your view, is that disqualifying for
>    the whole approach?
>
> We are asking for answers to any of these — even short, even discouraging.
> Not adoption, not code review. If the answers are encouraging, our next step
> is an emulator prototype, not a patch submission.
>
> Material: concept (`README.en.md`), requirements + threat model + abort
> criteria (`docs/p0-requirements.en.md`), findings (`docs/p0-findings.en.md`),
> source verification (`docs/p1-verification.en.md`), runnable model
> (`reference/`).

---

## 5. Draft B — CalyxOS (GitLab issue, EN)

**Title:** Design discussion (not a feature request): PIN-selected profiles at
the lock screen — feasibility review

**Text:**

> We're a small research-stage project — https://github.com/drzerk/MLSU —
> evaluating a lock-screen design: one lock screen, two cryptographically
> separated profiles, the entered PIN alone decides which profile unlocks
> (PIN 1 → private profile, PIN 2 → a deliberately ordinary second profile).
> The unchosen profile stays locked, and nothing in the UI hints at the other
> one's existence.
>
> We are explicitly **not** claiming invisibility: with an open-source,
> recognizable ROM, an examiner who recognizes it knows a second profile *can*
> exist. We accept that trade and document the forensic limits. We are sending
> the same five questions to GrapheneOS and a separate questionnaire to the
> forensics community; all substantive answers will be published (with
> permission, otherwise anonymized). A technical "no, and here is why" is a
> useful outcome for us.
>
> Before asking, we did the homework: a runnable model of the selection logic
> with tests and a timing rig, requirements with acceptance and abort criteria,
> and a source-level verification of our platform assumptions against AOSP
> (`android-latest-release`, 2026-08-19): `docs/p1-verification.en.md`. It
> corrected our own sketch once (signature of `unlockLskfBasedProtector`) and
> found that AOSP's unified-lock path already unlocks a profile with a
> credential derived from the parent.
>
> Questions:
>
> 1. **Maintenance cost and stability.** How much of `LockSettingsService` and
>    the synthetic-password layer would this realistically touch, and how
>    stable is that code across releases? The routing point is
>    `doVerifyCredential`; the unified-lock path sits in the same function. Is
>    coexisting with it realistic, or does that double the risk?
> 2. **Weaver slots in practice.** The HAL reports `getConfig().slots`, but we
>    have no device to measure on. How many slots do current secure elements
>    expose in practice, and does the platform consume any per profile (we
>    found `secdiscardable` uses a slot)? Would two MLSU profiles fit?
> 3. **Duress vs. multi-profile.** GrapheneOS chose a duress PIN that destroys
>    keys. Is the destructive answer the better one — technically or on
>    responsibility grounds — and would that reasoning apply to CalyxOS's
>    threat model as well?
> 4. **Private Space as base.** We tentatively decided MLSU should build on the
>    private-space user type and add only the unlock routing plus system-wide
>    invisibility. Does Private Space's design permit attaching a second unlock
>    path, or does it foreclose that?
> 5. **The counter problem.** Because every unlock must evaluate all protectors
>    (constant time), every failed attempt charges every profile's failure
>    counter — someone guessing PINs can lock out a profile they never knew
>    existed. We have no good answer. In your view, is that disqualifying for
>    the whole approach?
>
> We are asking for answers to any of these — even short, even discouraging.
> Not adoption, not code review. If the answers are encouraging, our next step
> is an emulator prototype, not a patch submission.
>
> Material: concept (`README.en.md`), requirements + threat model + abort
> criteria (`docs/p0-requirements.en.md`), findings (`docs/p0-findings.en.md`),
> source verification (`docs/p1-verification.en.md`), runnable model
> (`reference/`).

---

## 6. Draft C — Forensics (forum post, EN)

**Title:** Practitioner question: what does an examiner actually see on a
device with a hidden second profile?

**Text:**

> We're designing an optional OS feature — https://github.com/drzerk/MLSU —
> that would let a second Android profile be selected by an alternative
> lock-screen PIN, with no UI indication of its existence. We are deliberately
> **not** asking how to defeat forensics. We want to know what an examiner
> actually observes today, so we can document our feature's limits honestly —
> or decide not to build it. The feature does not exist yet; your answers
> shape that decision, and we will publish them (with permission, otherwise
> anonymized).
>
> Questions:
>
> 1. **Routine signals.** On a modern Android device (multi-user, FBE,
>    Private Space), which artifacts routinely reveal the existence of a
>    second or hidden profile? E.g. `/data/misc/vold/user_keys/ce/<userId>`
>    directories, user-list entries, backup metadata, package databases.
>    Which of these are part of a standard extraction/analysis workflow, and
>    which require specialist work?
> 2. **Flash attribution.** How reliably can occupied-but-unattributable
>    storage be demonstrated in practice — chip-off, FTL reconstruction,
>    multi-snapshot comparison? Is that routine lab work or specialist-level,
>    and how does it differ between a logical extraction and physical access?
> 3. **Context analysis.** In your experience, how much does context (carrier
>    data, cloud accounts, counterpart data) contribute compared to on-device
>    analysis when the question is "is there more on this device?" Our current
>    documentation assumes context is often the stronger signal; we would
>    value practitioner judgment on that.
> 4. **ROM recognition.** Our design cannot hide that the ROM itself supports
>    the feature (open source). In practice, does recognizing the ROM change
>    the examination approach at all, or is it usually irrelevant once the
>    device is unlocked?
>
> A "this is trivially detectable" answer is a stop criterion for us, not a
> setback — our documentation must state the real limits or the feature is
> dangerous to its users.

---

## 7. Draft D — Legal (template, EN)

**Subject:** Request for legal assessment — PIN-selected second profile on a
mobile device, [jurisdiction]

**Text (template; replace the placeholders in square brackets):**

> Dear [salutation/name],
>
> we are a small open-source project — https://github.com/drzerk/MLSU —
> designing an optional Android feature: a second, unannounced device profile
> opened by an alternative lock-screen PIN, intended for legitimate
> confidentiality (journalists' sources, professional secrecy, persons at
> risk). The feature does not exist yet; we are deciding whether building it
> is responsible, and a legal assessment for [jurisdiction] would decide
> that.
>
> Two questions:
>
> 1. Which disclosure and cooperation obligations exist in practice (e.g. at
>    borders, in criminal or administrative proceedings), and how does the
>    presence of a proven-but-unopened second area affect the user's position?
> 2. If the existence of such a feature can be demonstrated (open source, ROM
>    recognition), does using it tend to worsen the user's position compared
>    to not using it — for example through adverse inferences?
>
> We can provide: a threat model per adversary class, honest limits
> documentation (we do not claim invisibility), and the requirements document
> in which these two questions are marked project-critical. We are not asking
> for free representation — if a full assessment is beyond scope, pointers to
> literature or case law in [jurisdiction] already help. One of our explicit
> stop criteria is that a legal review showing a net worsening of users'
> position ends the project; we intend to publish the outcome either way.
>
> Thank you for considering this.

---

## 8. Processing responses

### 8.1 What counts as a response

A response is **substantive**: it addresses at least one question in substance
**or** explicitly refuses to answer with a reason. Does not count: blanket
dismissal without reasoning, "duplicate/off-topic", mere pointers to generic
documentation. Step 4 counts as done when **≥ 2 substantive responses** from
R1–R4 are recorded.

### 8.2 Recording template (per answer)

```
Reviewer:            R1 — GrapheneOS
Date of response:
Channel/link:
Core statements per question (keywords):
  A-Q1: …
  A-Q2: …
  …
Affected requirements/decisions:
Resulting changes to P0/P1:
Status:  [ ] recorded   [ ] incorporated   [ ] kill signal → AB check
Quote permission: [ ] yes (named)  [ ] anonymized  [ ] none
```

### 8.3 Effect of the answers

| Question | Feeds | Kill signal if … |
|---|---|---|
| A/B-Q1 (intervention, stability) | P1 §8.1/§8.4, D4 (cooperation) | "not maintainable" → **AB-3** |
| A/B-Q2 (Weaver slots) | D2, P1 §8.2, M4 | "< 2 free slots on all target devices" → re-cut the concept (not automatically AB) |
| A/B-Q3 (duress vs. MLSU) | product question from F-1 (lock vs. wipe), concept §13 | none — product decision, not an abort |
| A/B-Q4 (Private Space) | D1, P1 C1/C5 | "design forecloses a second unlock path" → fundamentally re-cut the P1 sketch |
| A/B-Q5 (counter problem F-1) | SR-4 re-wording, setup UX, threshold product question | "therefore irresponsible" → consider abort |
| C-Q1 (routine signals) | P2 audit A1–A3, B1/B4 | — (expected: leaks confirm themselves) |
| C-Q2 (flash attribution) | **AB-1**, concept §9.2, B2/B6 | "reliably provable with reasonable effort" → **AB-1 triggers** |
| C-Q3 (context analysis) | concept §6.3, G3, communication | — |
| C-Q4 (ROM recognition) | concept §9.1, D3 (⛔ documented limit) | — |
| D-Q1/Q2 (legal situation) | **AB-5**, concept §9.3, setup wording | "position worsens predominantly" → **AB-5 triggers** |

### 8.4 Handling kill signals

A kill signal is **documented in the repo, not concealed** (concept §14): a
dedicated document `docs/p0-review-responses.md` (plus `.en.md`) with one
section per response and the outcome of the AB check. If a stop criterion
triggers, work on the PoC ends at that point — that is the purpose of the
criteria. Step 5 (requirements v1.0) starts **only after ≥ 2 substantive
responses** and incorporates their content into the requirements.

---

## 9. What this document is not

Not a dispatch order (dispatching is a project decision), not legal advice, not
a replacement for step 5, not a target-group study — P0 questions 10–12 belong
to the P4 user study and are deliberately absent here, even though P0 notes
that question 11 can kill the project.

---

## 10. Sources (channels, checked 2026-08-19)

1. [GrapheneOS — Contact (forum, chat, email)](https://grapheneos.org/contact)
2. [CalyxOS — "An update on how to reach the CalyxOS team" (2025-09-30): feature/functionality requests via GitLab, Matrix ping](https://calyxos.org/news/2025/09/30/how-to-reach-the-calyxos-team/)
3. [Forensic Focus — forums (DFIR community)](https://www.forensicfocus.com/forums/)

---

## License

[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/deed.en),
see [LICENSE](../LICENSE).
