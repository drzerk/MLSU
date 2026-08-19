# P0 — Reviewpaket: versandfertige Anfragen an externe Reviewer

**Multi-Layer Secure Unlock (MLSU)** · Schritt 4 des [Machbarkeitspfads](../README.md#11-machbarkeitspfad)

*[🇩🇪 Deutsch](p0-reviewpaket.md) · [🇬🇧 English](p0-review-package.en.md)*

| | |
|---|---|
| **Status** | Entwürfe versandfertig — Versand offen (frühestens nach Projektentscheid) |
| **Version** | 0.1 |
| **Stand** | 2026-08-19 |
| **Vorgänger** | [P0-Anforderungen §7](p0-anforderungen.md#7-fragenkatalog-für-externe-review) (Fragenkatalog), [P1-Verifikation](p1-verifikation.md) (Fundstellen), [ROM-Proposal](rom-proposal.en.md) (Übernahme-Pitch) |
| **Ziel** | Schritt 4 des P0-Pfads: Fragenkatalog an drei externe Reviewer, **≥ 2 substanzielle Rückläufer** |
| **Nicht-Ziel** | Zielgruppenstudie (Fragen 10–12, P4), Rechtsberatung einholen oder erteilen, Versand selbst |

---

## 1. Zweck und Einordnung

Der [Fragenkatalog in P0 §7](p0-anforderungen.md#7-fragenkatalog-für-externe-review)
ist die inhaltliche Vorgabe; dieses Dokument macht daraus **versandfertige
Anfragen**. Jeder Entwurf nennt Kanal, Titel und den vollständigen Text zum
Einkopieren. Die Fragen sind absichtlich **über Reviewer hinweg vergleichbar
gehalten** (gleicher Fragebogen an alle ROM-Projekte), damit die Rückläufe
gegeneinander bewertbar sind.

Drei Regeln, die der Projekt-Ehrlichkeit entsprechen (Konzept §14):

1. **Keine Verkaufsrhetorik.** Jede Anfrage führt die bekannten Grenzen mit
   (keine Unsichtbarkeit, F-1, Forensik-Grenzen). Ein *„Nein, und zwar
   deshalb"* ist ein wertvolles Ergebnis und wird als solches veröffentlicht.
2. **Die Reviewer müssen nicht selbst verifizieren.** Die Anfragen verlinken die
   [P1-Verifikation](p1-verifikation.md) — Reviewer bewerten die *Annahmen und
   Designfragen*, nicht unsere Quellenprüfung.
3. **Antworten können das Projekt kippen.** AB-2 (Konstantzeit unerreichbar),
   AB-3 (kein ROM-Projekt bereit) und AB-5 (rechtliche Verschlechterung) sind
   als Abbruchkriterien gewollt — ein Kipp-Signal wird dokumentiert, nicht
   verschwiegen (Abschnitt 8).

**Abgrenzung zum [ROM-Proposal](rom-proposal.en.md):** Das Proposal ist der
*Übernahme-Pitch* („würdet ihr das aufnehmen?"). Dieses Paket ist der
*Review-Fragebogen* („ist das technisch haltbar, und warum habt ihr anders
entschieden?"). Die Entwürfe hier verlinken das Proposal als Material, ersetzen
es aber nicht.

---

## 2. Reviewer-Matrix und Versandplan

| ID | Reviewer | Warum | Kanal (geprüft 2026-08-19) | Entwurf | Versand | Rücklauf |
|---|---|---|---|---|---|---|
| **R1** | GrapheneOS | Hat den Duress-Mechanismus real gebaut — die Gegenantwort auf MLSU | Diskussionsforum `discuss.grapheneos.org` (offizieller Diskussionskanal; Reddit verweist dorthin); Rückfallebene `contact@grapheneos.org` | [A](#4-entwurf-a--grapheneos-forumsbeitrag-en) | offen | – |
| **R2** | CalyxOS | Zweites ROM-Projekt mit eigener Sicherheitskultur; Feature-Anfragen laufen offiziell über GitLab | GitLab-Issue `CalyxOS/calyxos` (seit 2025-09 offizieller Kanal für Feature-/Funktionsanfragen); optional Matrix-Ping `@calyx_institute:matrix.org` | [B](#5-entwurf-b--calyxos-gitlab-issue-en) | offen | – |
| **R3** | Forensik-Praxis | Beantwortet AB-1 und die Metadaten-Fragen aus Praktikersicht | Forum `forensicfocus.com/forums` (aktive DFIR-Community) | [C](#6-entwurf-c--forensik-forumsbeitrag-en) | offen | – |
| **R4** | Rechtswissenschaft | Beantwortet P0-Fragen 8/9 — die das Projekt kippen können | Persönliche Anfrage (Lehrstuhl IT-/Strafrecht, Fachanwalt) | [D](#7-entwurf-d--rechtswissenschaft-vorlage-en) | offen | – |

**Ziel:** ≥ 2 substanzielle Rückläufer aus R1–R4. R4 ist optional für die
Zählung; ohne R4-Rücklauf bleibt AB-5 in Schritt 5 ausdrücklich offen.

**Wiederverwendung:** Die Entwürfe A/B sind bewusst so gehalten, dass sie mit
geändertem Einleitungssatz auch an andere AOSP-nahe Projekte gehen können
(D4: Kooperation suchen). Ein drittes ROM-Projekt ist der natürliche
Ausweichkanal, falls R1 oder R2 ohne Rücklauf bleiben.

---

## 3. Vor dem Versand (Checkliste je Kanal)

**Gemeinsam:**

- [ ] Englische Dokumente verlinken (das Repo hat für alles EN-Mirrors):
      `README.en.md`, `docs/p0-requirements.en.md`, `docs/p0-findings.en.md`,
      `docs/p1-verification.en.md`, `reference/`.
- [ ] Nicht alles in den Beitrag kopieren — verlinken; die Beiträge bleiben
      kurz und beantwortbar.
- [ ] Antwortadresse klären: Das Repo ist öffentlich; Rückläufe mit Erlaubnis
      zitieren, sonst anonymisiert (siehe Abschnitt 8).
- [ ] Zeitbudget festlegen: Nach 3–4 Wochen ohne Antwort genau **eine**
      freundliche Erinnerung, dann Kanal wechseln oder den Reviewer als
      „ohne Rücklauf" dokumentieren. Kein Cross-Posting derselben Anfrage in
      mehrere Kanäle desselben Projekts (Forenetikette).

**R1 — GrapheneOS-Forum:** Kategorienliste beim Versand prüfen und die
passendste wählen (Entwicklungs-/Design-Diskussion). Vorher die Forensuche nach
`duress` bemühen und einen bestehenden Thread ggf. zitieren statt neu zu öffnen.
Tonalität: nüchtern, Grenzen zuerst — die Community reagiert auf
Abstreitbarkeits-Versprechen zu Recht ablehnend, und genau das beansprucht
dieses Projekt nicht (Konzept §9.1).

**R2 — CalyxOS-GitLab:** Issue-Vorlage des Repos verwenden (falls eine gefordert
ist); keine Labels selbst setzen. Der Entwurf ist als Diskussionstext formuliert,
nicht als Feature-Request — der Unterschied gehört in den Titel.

**R3 — Forensic Focus:** Forenregeln lesen; ausdrücklich *kein*
„Wie umgehe ich Forensik"-Framing. Der Entwurf fragt nach dem, was Prüfer
*sehen*, damit das Projekt seine Grenzen dokumentieren kann. Berufliche
Diskretion der Antwortenden respektieren.

**R4 — Recht:** Persönlich anfragen, Honorar- und Umfangsfrage zuerst klären;
**keine** unentgeltliche Rechtsberatung erwarten oder einfordern. Auf Wunsch
kann der Entwurf als Ausgangspunkt dienen, aber Rechtsfragen sind je
Rechtsordnung zu stellen — die Vorlage lässt die Rechtsordnung absichtlich
offen.

---

## 4. Entwurf A — GrapheneOS (Forumsbeitrag, EN)

**Titel:** Feasibility review: PIN-selected profiles at the lock screen
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

## 5. Entwurf B — CalyxOS (GitLab-Issue, EN)

**Titel:** Design discussion (not a feature request): PIN-selected profiles at
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

## 6. Entwurf C — Forensik (Forumsbeitrag, EN)

**Titel:** Practitioner question: what does an examiner actually see on a
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

## 7. Entwurf D — Rechtswissenschaft (Vorlage, EN)

**Betreff:** Request for legal assessment — PIN-selected second profile on a
mobile device, [Rechtsordnung]

**Text (Vorlage; Platzhalter in eckigen Klammern ersetzen):**

> Dear [Anrede/Name],
>
> we are a small open-source project — https://github.com/drzerk/MLSU —
> designing an optional Android feature: a second, unannounced device profile
> opened by an alternative lock-screen PIN, intended for legitimate
> confidentiality (journalists' sources, professional secrecy, persons at
> risk). The feature does not exist yet; we are deciding whether building it
> is responsible, and a legal assessment for [Rechtsordnung] would decide
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
> literature or case law in [Rechtsordnung] already help. One of our explicit
> stop criteria is that a legal review showing a net worsening of users'
> position ends the project; we intend to publish the outcome either way.
>
> Thank you for considering this.

---

## 8. Rücklauf-Verarbeitung

### 8.1 Was als Rückläufer zählt

Ein Rückläufer ist eine **substanzielle Antwort**: Sie adressiert mindestens
eine Frage inhaltlich **oder** verweigert die Antwort explizit mit Begründung.
Nicht zählen: pauschales Abwinken ohne Begründung, „duplicate/off-topic",
reine Verweise auf generische Doku. Schritt 4 gilt als erledigt, wenn **≥ 2
substanzielle Rückläufer** aus R1–R4 protokolliert sind.

### 8.2 Protokollvorlage (je Antwort)

```
Reviewer:            R1 — GrapheneOS
Datum der Antwort:
Kanal/Link:
Kernaussagen je Frage (stichwortartig):
  A-Q1: …
  A-Q2: …
  …
Betroffene Anforderungen/Entscheidungen:
Daraus folgende Änderungen an P0/P1:
Status:  [ ] dokumentiert   [ ] eingearbeitet   [ ] Kipp-Signal → AB-Prüfung
Zitiererlaubnis: [ ] ja (namentlich)  [ ] anonymisiert  [ ] keine
```

### 8.3 Wirkung der Antworten

| Frage | Speist | Kipp-Signal, wenn … |
|---|---|---|
| A/B-Q1 (Eingriff, Stabilität) | P1 §8.1/§8.4, D4 (Kooperation) | „nicht pflegbar" → **AB-3** |
| A/B-Q2 (Weaver-Slots) | D2, P1 §8.2, M4 | „< 2 freie Slots auf allen Zielgeräten" → Konzept umschneiden (nicht automatisch AB) |
| A/B-Q3 (Duress vs. MLSU) | Produktfrage aus F-1 (Sperre vs. Löschung), Konzept §13 | keine — Produktentscheidung, kein Abbruch |
| A/B-Q4 (Private Space) | D1, P1 C1/C5 | „Design verbaut zweiten Login-Pfad" → P1-Skizze grundlegend umschneiden |
| A/B-Q5 (Zählerproblem F-1) | SR-4-Neufassung, Setup-UX, Produktfrage Schwellwert | „deshalb unverantwortbar" → Abbruch prüfen |
| C-Q1 (Routine-Signale) | P2-Audit A1–A3, B1/B4 | — (erwartet: Lecks bestätigen sich) |
| C-Q2 (Flash-Attribution) | **AB-1**, Konzept §9.2, B2/B6 | „mit vertretbarem Aufwand zuverlässig nachweisbar" → **AB-1 greift** |
| C-Q3 (Kontextanalyse) | Konzept §6.3, G3, Kommunikation | — |
| C-Q4 (ROM-Erkennung) | Konzept §9.1, D3 (⛔ dokumentierte Grenze) | — |
| D-Q1/Q2 (Rechtslage) | **AB-5**, Konzept §9.3, Setup-Wording | „Lage verschlechtert sich überwiegend" → **AB-5 greift** |

### 8.4 Umgang mit Kipp-Signalen

Ein Kipp-Signal wird **im Repo dokumentiert, nicht verschwiegen** (Konzept
§14): eigenes Dokument `docs/p0-review-ruecklaeufe.md` (bzw. `.en.md`) mit
einem Abschnitt je Rücklauf und dem Ergebnis der AB-Prüfung. Wird ein
Abbruchkriterium ausgelöst, endet die Arbeit am PoC an dieser Stelle — das ist
der Sinn der Kriterien. Schritt 5 (Anforderungen v1.0) beginnt **erst nach ≥ 2
substanzielle Rückläufen** und arbeitet deren Inhalt in die Anforderungen ein.

---

## 9. Was dieses Dokument nicht ist

Kein Versandauftrag (der Versand ist eine Projektentscheidung), keine
Rechtsberatung, kein Ersatz für Schritt 5, keine Zielgruppenstudie — die
P0-Fragen 10–12 gehören in die P4-Nutzerstudie und sind hier bewusst nicht
enthalten, auch wenn P0 festhält, dass Frage 11 das Projekt kippen kann.

---

## 10. Quellen (Kanäle, geprüft 2026-08-19)

1. [GrapheneOS — Contact (Forum, Chat, E-Mail)](https://grapheneos.org/contact)
2. [CalyxOS — „An update on how to reach the CalyxOS team" (2025-09-30): Feature-/Funktionsanfragen über GitLab, Matrix-Ping](https://calyxos.org/news/2025/09/30/how-to-reach-the-calyxos-team/)
3. [Forensic Focus — Foren (DFIR-Community)](https://www.forensicfocus.com/forums/)

---

## Lizenz

[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/deed.de),
siehe [LICENSE](../LICENSE).
