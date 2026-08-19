# P1-Vorbereitung — Verifikation der Plattformannahmen

**Multi-Layer Secure Unlock (MLSU)** · Ergänzung zu [P0-Anforderungen](p0-anforderungen.md),
[P0-Befunden](p0-befunde.md) und [P1-PoC-Skizze](p1-poc-skizze.md)

*[🇩🇪 Deutsch](p1-verifikation.md) · [🇬🇧 English](p1-verification.en.md)*

| | |
|---|---|
| **Status** | Verifikation — Quellenprüfung, keine Messung am Gerät |
| **Version** | 0.1 |
| **Prüfdatum** | 2026-08-19 |
| **Geprüfte Stände** | AOSP `android-latest-release` (Code Search) und `refs/heads/main` (Gitiles); API-Doku API 35; öffentliche Projekt- und Literaturquellen |
| **Vorgänger** | [P0-Anforderungen](p0-anforderungen.md) §9 „Nächste Schritte", [P1-PoC-Skizze](p1-poc-skizze.md) (U/O-Markierungen, §8) |
| **Ziel** | Die schriftlich prüfbaren P0-Schritte 1–3 abarbeiten: Vergleichsmatrix von `U` auf `V` heben, D1 und D2 mit Fundstellen belegen, die U-Markierungen der P1-Skizze prüfen |
| **Nicht-Ziel** | Externe Review (P0-Schritt 4/5), Messungen auf echter Hardware (M4), Rechtsberatung |

---

## 1. Zweck und Einordnung

P0 legt fest: *„P0 ist abgeschlossen, wenn Schritt 5 erreicht ist — nicht früher."*
Die Schritte 1–3 der dortigen Tabelle sind die einzigen, die ohne Gerät und ohne
externe Reviewer erledigt werden können — und genau die, die ein PoC **nicht**
ersetzen darf. Dieses Dokument trägt zusammen, was sich bis 2026-08-19 im
AOSP-Quellcode und in öffentlichen Quellen belegen lässt. Es unterscheidet
strikt zwischen:

- **V** — im Quellcode oder in der offiziellen Doku nachgelesen, mit Fundstelle;
- **U** — weiterhin plausibel, aber ungeprüft;
- **O** — weiterhin offen (Designentscheidung nötig).

Zwei Ergebnisse dieser Prüfung verändern die P1-Skizze substanziell und sind
dort bereits eingearbeitet:

1. **Das Code-Gerüst in 4.1 hatte die Signatur von `unlockLskfBasedProtector`
   falsch** (siehe V2 unten). Genau dafür gibt es die Verifikation vor dem Bau:
   der Fehler wäre sonst im ersten Patch am Sperrbildschirm aufgefallen.
2. **AOSP enthält bereits einen „eine Eingabe, zwei Profile"-Pfad** — den
   *Unified Lock* (siehe V7 unten). Er ist anders gebaut als MLSU (abgeleitet
   statt geroutet, alles-oder-nichts statt genau-eines), bestätigt aber die
   Grundannahme der Skizze: Der Eingriff ist kleiner, als das Konzeptpapier
   (§7) ursprünglich annahm.

---

## 2. Methodik

- **Prüfweg:** Android Code Search (`cs.android.com`, Branch
  `android-latest-release`) für Snippets mit Zeilennummern; Gitiles
  (`android.googlesource.com`, `refs/heads/main`) für vollständige Dateien;
  offizielle API-Doku für Konstanten; Projekt-/Literaturquellen über ihre
  Originalseiten.
- **Grenze:** Alles hier ist *Lesen*, keine Messung. Aussagen über Laufzeit,
  Speicherverhalten und Hardware bleiben bei ihrem Status (U/O) und sind an M2/M4
  gebunden. Die Methodik-Lektion aus Befund F-4 gilt unverändert: Ein Prüfkriterium,
  das nur das Ergebnis vorschreibt und nicht die Methode, produziert Scheinsignale.
- **Fundstellen:** Zeilennummern beziehen sich auf den geprüften Branch und
  altern mit dem Quellcode. Jede V-Aussage nennt daher Branch und Prüfdatum.

---

## 3. Verifikation der AOSP-Annahmen (L3/L5)

### V1 — `doVerifyCredential` verifiziert genau einen User (bestätigt)

**Behauptung (P1-Skizze 4.1, Status V):** `LockSettingsService.doVerifyCredential(...)`
prüft den Protector genau eines `userId`; bei Erfolg folgt die CE-Entsperrung.

**Geprüft** (`android-latest-release`, 2026-08-19):

- Signatur: `private VerifyCredentialResponse doVerifyCredential(LockscreenCredential credential, int userId, ICheckCredentialProgressCallback progressCallback, int flags)` — `LockSettingsService.java`, Z. 2618–2620.
- Erfolgspfad: `"Successfully verified lockscreen credential for user %d"` (Z. 2691) → `onCredentialVerified(authResult.syntheticPassword, …)` (Z. 2692) → `onCredentialVerifiedInternal(...)` (Z. 3379).

**Konsequenz:** Bestätigt. Das MLSU-Routing (Schleife über alle verknüpften User,
keine frühe Rückkehr, SR-3) ersetzt genau diesen Einstieg — strukturell ein
überschaubarer Eingriff, wie in der Skizze dargestellt.

### V2 — Signatur von `unlockLskfBasedProtector` (Korrektur der Skizze)

**Behauptung (P1-Skizze 4.1, Code-Gerüst):** Der Aufruf lautet
`unlockLskfBasedProtector(mGatekeeper, userId, credential, /* challenge */ 0L, callingUserId)`.

**Geprüft:** Die Deklaration ist
`unlockLskfBasedProtector(IGateKeeperService gatekeeper, long protectorId, @NonNull LockscreenCredential credential, int userId, …)`
(`SyntheticPasswordManager.java`, Z. 1534). Aufrufstellen in `LockSettingsService.java`
bestätigen die Reihenfolge und zeigen zugleich, wie die Protector-ID beschafft
wird: `unlockLskfBasedProtector(getGateKeeperService(), getCurrentLskfBasedProtectorId(userId), …)`
(Z. 2460; weitere Aufrufstellen Z. 1230, 1247, 2668).

**Konsequenz:** Das Gerüst in der Skizze übergab `userId` an der Position der
Protector-ID und vermischte Challenge/Aufrufer. **Korrigiert** (siehe Skizze 4.1):
`(mGatekeeper, getCurrentLskfBasedProtectorId(userId), credential, userId, /* challenge */ null)`.
Inhaltlich ändert sich nichts an der Konstruktion — pro Profil gibt es weiterhin
genau einen Protector mit eigener Weaver-/Gatekeeper-Anbindung (SR-4).

### V3 — Weaver-HAL: Slot-Array, Konfiguration, Throttle (L4)

**Geprüft** (`platform/hardware/interfaces`, `refs/heads/main`, `IWeaver.aidl`):

- Weaver ist **„structured as an array of slots, each containing a key-value pair.
  Slots are uniquely identified by an ID in the range [0, getConfig().slots)"** —
  die Slot-Anzahl ist also eine **Gerätekonstante, die der HAL meldet**, kein
  AOSP-weiter Festwert.
- `WeaverConfig getConfig()` liefert sie zur Laufzeit.
- **Throttling ist per Slot** („applied on a per-slot basis so that a successful
  read from one slot does not reset the throttling state of any other slot") —
  die hardwaremäßige Grundlage von SR-4.
- `read(slotId, key)` meldet Drosselung mit Restzeit (`STATUS_THROTTLE`, `timeout`);
  `write(slotId, key, value)` überschreibt einen Slot und macht den alten Inhalt
  unwiederbringlich.

**Konsequenz:** Das Referenzmodell (`mlsu/counters.py`: getrennte Zähler je Slot,
Throttle-Zeitstempel) bildet die HAL-Semantik korrekt ab. Für M4 ergibt sich der
konkrete Messweg: `getConfig().slots` am Zielgerät lesen (siehe Abschnitt 4).

### V4 — `SyntheticPasswordManager` begrenzt Slots über die HAL-Konfiguration

**Geprüft:** `weaverVerify(IWeaver weaver, int slot, byte[] key)` prüft
`if (slot == INVALID_WEAVER_SLOT || slot >= mWeaverConfig.slots)`
(`SyntheticPasswordManager.java`, Z. 793–794). Die Slot-Grenze kommt aus der
HAL-Konfiguration, nicht aus einer festen Konstante des Managers.

**Konsequenz:** Für den PoC heißt das: Die Profilzahl-Grenze wird zur Laufzeit
bestimmt und kann am Gerät abgefragt werden; ein MLSU-Setup, das mehr Slots
braucht als die Hardware hat, schlägt nicht still fehl, sondern ist am
`mWeaverConfig` ablesbar. Das gehört in den M0-/M4-Prüfumfang.

### V5 — vold: CE-Schlüssel in den Kernel-Keyring, Entfernung beim Sperren (SR-2-Teilaussage)

**Behauptung (P1-Skizze 4.3, Status U):** `lock_user_key` entfernt den
CE-Schlüssel; wie vollständig, war offen.

**Geprüft** (`platform/system/vold`, `refs/heads/main`):

- `KeyUtil.cpp`: `installKey()` legt den CE-Schlüssel mit
  `FS_IOC_ADD_ENCRYPTION_KEY` in den Kernel-fscrypt-Keyring; das ioctl-Argument
  liegt in einem **selbstnullenden Puffer** („automatically-zeroing buffer").
- `evictKey()` entfernt ihn mit `FS_IOC_REMOVE_ENCRYPTION_KEY`; sind Dateien noch
  offen, wartet `waitForBusyFiles` mit exponentiellem Backoff (3,2 s → 51,2 s,
  Summe ≈ 1 min) und entfernt den Key nach.
- `VoldNativeService.cpp`: `unlockCeStorage(userId, secret)` →
  `fscrypt_unlock_ce_storage(...)`; `lockCeStorage(userId)` →
  `fscrypt_lock_ce_storage(...)` — die Binder-Primitive für CE-Ent-/Sperrung.
- Der `vdc cryptfs`-Kommandoname aus Skizzen-Quelle [3] sollte beim M0 auf dem
  Ziel-Build gegengeprüft werden; die Binder-Methoden oben sind die im Quellcode
  verifizierte, versionsstabile Schnittstelle.

**Konsequenz (SR-2, Teilaussage):** Der **Kernel-Kopien**-Anteil ist belegt: Nach
`lock`/`evictKey` existiert der CE-Schlüssel des gesperrten Profils nicht mehr im
Kernel-Keyring (modulo offener Dateien, die vold nachräumt). **Nicht belegt**
bleibt der Userspace-Anteil: transient angefasste Kopien (vold-`KeyBuffer`,
keystore2-Daemon, Keymaster-BLOBs) und deren Lebensdauer. Das ist weiterhin eine
M4-Messung — die einzige Stelle, an der SR-2 prüfbar wird (Befund F-2). Die
Skizze 4.3 ist entsprechend von U auf „teilweise V" angehoben.

### V6 — Private Space ist öffentliche API (bestätigt, L5)

**Geprüft** (API-Doku `UserManager`, API 35): Der Private-Space-Usertyp ist
erste Klasse — u. a. `USER_TYPE_PROFILE_PRIVATE` und
`DISALLOW_ADD_PRIVATE_PROFILE` in der öffentlichen Referenz. Zusammen mit der
Hidden-Profile-Mechanik (`ACCESS_HIDDEN_PROFILES`, Broadcasts) aus Skizzen-Quelle
[1][2] bleibt die strategische Aussage bestehen: **Private Space ist das
Fundament, auf dem MLSU aufsetzt.** Damit ist D1 mit Fundstellen entschieden
(siehe Abschnitt 6).

### V7 — AOSP hat bereits einen „eine Eingabe, zwei Profile"-Pfad: Unified Lock (neuer Befund)

**Geprüft** (`LockSettingsService.java`, `android-latest-release`):

- `LockscreenCredential getDecryptedPasswordForUnifiedProfile(int userId)` (Z. 1678)
  leitet das Profil-Passwort aus dem Synthetic Password des Eltern-Users ab;
  Aufrufstellen Z. 1721–1724, 1795–1797, 1913–1914, 2167–2169.
- In `doVerifyCredential` existiert ein Pfad *„Unlock parent by using parent's
  challenge"* (Z. 2769–2770) gefolgt von *„Unlock profile with unified lock"*
  (Z. 2781–2782) — die Profilprüfung läuft mit dem abgeleiteten Credential.

**Einordnung:** Android kann heute schon mit **einer** Lockscreen-Eingabe zwei
Profile entsperren (Managed Profile/Private Space mit „gleiche Sperre"). Der
Unterschied zu MLSU bleibt vollständig bestehen und wird jetzt präziser:

| | Unified Lock (AOSP) | MLSU (Zielbild) |
|---|---|---|
| Mechanismus | Profil-Credential wird aus dem Eltern-SP **abgeleitet** | Profile haben **unabhängige** Protectors (SR-1), Eingabe wird **geroutet** |
| Ergebnis | Eltern-Profil **und** Profil gehen auf (alles-oder-nichts) | **genau ein** Profil geht auf, das andere bleibt gesperrt |
| Auswahl | keine — das Credential wählt nichts | die PIN selbst wählt (FR-1) |
| Unsichtbarkeit | Profil bleibt UI-sichtbar (Private Space) | kein UI-Hinweis (G2) |
| Konstantzeit | nicht gefordert | gefordert (SR-3) |

**Konsequenz:** Die Skizze gewinnt eine weitere bestätigte Säule („der Rest
existiert bereits"), und eine neue Vorsichtsregel: Der Unified-Lock-Pfad ist ein
zweiter Verify-Pfad, der bei deaktiviertem MLSU unverändert funktionieren muss
und in den das Routing nicht versehentlich hineinlaufen darf (Konzept 9.5:
Angriffsfläche). Die Skizze 4.1 nimmt das auf.

### V8 — GrapheneOS Duress ist der destruktive Gegenentwurf (bestätigt, L6)

**Geprüft** (`grapheneos.org/features`, FAQ, Projektaussagen):

- Duress-PIN/-Passwort **löschen das Gerät irreversibel** (inkl. eSIMs), werden
  überall akzeptiert, wo Credentials verlangt werden, und sind nur gemeinsam
  aktivierbar (PIN **und** Passwort, wegen unterschiedlicher Entsperrmethoden je
  Profil). Der reguläre Code hat Vorrang, wenn er mit dem Duress-Code identisch ist.
- Das Wipe entfernt laut Projektaussage TEE-Keystore, Secure-Element-Keystore und
  Verschlüsselungsmetadaten; *„The most important data that's wiped is the Weaver
  table on the secure element"* — die Slot-Löschung ist also ein realer,
  hardwaregestützter Vorgang (deckt sich mit V3: `write` macht einen Slot
  unwiederbringlich).
- Die GrapheneOS-FAQ dokumentiert den Weaver-Mechanismus am Pixel: Zufallstoken
  als Weaver-Value, Weaver-Key aus dem Passwort-Token, hardwaregestützte
  Verzögerung je Versuch über einen internen Timer, begrenzte Gesamtzahl von
  Versuchen, Slot-Wipe beim Löschen eines Profils.

**Konsequenz:** Die Matrixaussage (Duress: K4 = nein, destruktiv) ist belegt, und
die offene Produktfrage aus Befund F-1 („Sperre oder Löschung am Schwellwert?")
hat in GrapheneOS eine konkrete Antwort: **Löschung**. MLSU wählt bewusst den
nicht-zerstörenden Weg — das ist eine Produktentscheidung, keine technische
Notwendigkeit, und sie muss im Setup-Flow so ehrlich kommuniziert werden wie die
Grenzen (Konzept §8).

---

## 4. D2 — Weaver-Slot-Anzahl realer Geräte (12.2)

**Was jetzt belegt ist:**

- Die Slot-Anzahl ist gerätespezifisch und wird vom HAL gemeldet:
  `IWeaver.getConfig().slots` (V3); der SP-Manager nutzt genau diese Grenze (V4).
- Es gibt **keine öffentliche AOSP-Konstante** für die Slot-Anzahl von Titan M/M2;
  eine feste Zahl würde dem HAL-Design auch widersprechen.
- Zur Hardware selbst (Quarkslab-Whitepaper „2021: A Titan M Odyssey", V): Titan M
  ist ein externer Coprozessor (ARM Cortex-M3, 64 KB RAM, kein MMU/ASLR),
  Firmware liegt als Binär unter `/vendor/firmware/citadel`; Weaver ist eines der
  darauf laufenden Applets (HAL-Daemon `weaver` über citadeld/SPI). Die Slots
  liegen im internen Flash des Chips — die Slot-Zahl ist eine Frage des
  Firmware-Layouts, nicht des RAM.
- Zusätzlicher Slot-Verbrauch, bisher in der Skizze nicht berücksichtigt: Der
  SP-Manager nutzt einen Weaver-Slot auch für den **secdiscardable-Key**
  (`weaverVerify(weaver, slotId, null)`, `SyntheticPasswordManager.java`
  Z. 1776–1778). Ob das je Profil ein weiterer Slot ist, ist vor M4 zu prüfen —
  zwei Profile könnten vier Slots brauchen, nicht zwei.

**Status von D2:** Empfehlung unverändert (genau zwei Profile,
`SLOT_COUNT` = maximale Profilanzahl, keine Reserve-Slots — gestützt durch
Befund F-5). Der Messweg ist jetzt definiert und verifiziert: **M4 liest
`IWeaver.getConfig().slots` auf dem Zielgerät** (Emulator-Weaver und Pixel/Titan
getrennt protokollieren) und prüft den secdiscardable-Verbrauch. Bis zur Messung
bleibt „zwei Profile" die harte Annahme — nicht mehr und nicht weniger.

---

## 5. Literatur L1/L2 — warum die mobilen PDE-Systeme nicht angekommen sind

Die P0-Leseliste fragt nach Mobiflage und den Angriffen auf Abstreitbarkeit über
Flash/FTL. Ergebnis der Durchsicht (Originalarbeiten bzw. Autorenseiten):

| Arbeit | Ansatz | Dokumentierte Grenze |
|---|---|---|
| **Mobiflage** (Skillen/Mannan, 2013/14) | Hidden Volumes auf der SD-Karte; erstes mobiles PDE | Braucht separate Partition; `discard`/TRIM muss abgeschaltet werden; block-layer-Schreiben hinterlassen FTL-Spuren; nur Single-Snapshot-Adversary |
| **MobiPluto** (Chang et al.) | Block-Layer mit Zufalls-Schreibverteilung | FTL schreibt log-strukturiert — Block-Layer-Zufall wird auf dem Flash entwertet |
| **MobiCeal** (Chang et al., 2018) | Dummy-Writes + Randomisierung im Block-Layer | Kann Multi-Snapshot-Adversary **nicht** widerstehen (Selbstauskunft der Autoren) |
| **DEFTL** (Jia et al., 2017) | PDE **in** der Flash Translation Layer | Erster flash-bewusster Ansatz, moderater Overhead — aber Eingriff in den Flash-Controller, praktisch nicht deploybar |
| **Übersicht 2020** („Towards Designing A Secure Plausibly Deniable System for Mobile") | — | Ein mobil-taugliches PDE-System, das Multi-Snapshot-Adversaries widersteht, **fehlt in der Literatur** |

**Drei Konsequenzen:**

1. **AB-1 ist nicht ausgelöst.** Das Abbruchkriterium fragt, ob nicht
   zuordenbarer Flash-Speicher *mit vertretbarem Aufwand* zuverlässig nachweisbar
   ist. Die Literatur sagt: für Standardforensik (A4, logische Extraktion) nicht
   sichtbar; für Chip-off/FTL-Rekonstruktion (A5) ja. Das entspricht exakt der
   Positionierung des Konzeptpapiers (G2 hält gegen A4 nicht, gegen A5 nicht) —
   kein neuer Befund, aber jetzt belegt statt vermutet.
2. **Die Antwort auf „warum kam Mobiflage nicht an"** ist strukturell: Alle
   Vorgänger greifen in Speicherschicht/FTL ein, die auf modernen Geräten weder
   offen noch änderbar ist (UFS/eMMC-Controller sind Herstellersache). MLSU
   umgeht genau das: **kein Eingriff in die Speicherschicht**, stattdessen
   Routing auf Credential-Ebene + geerbte FBE-/Private-Space-Infrastruktur.
3. **Der Preisfall bleibt der gleiche:** Sichtbare Vorabreservierung oder
   unplausible Belegung sind Indizien (Konzept §9.2). Die Literatur bestärkt die
   konservative Kommunikation (D5): begrenzte Abstreitbarkeit gegen A2/A3, nie
   „unsichtbar" gegen A4/A5.

---

## 6. Status der P0-Entscheidungen und offenen Fragen

| Punkt | Vorher | Jetzt | Beleg |
|---|---|---|---|
| **D1** — Private Space als Basis | Empfehlung „zuerst prüfen" | **Geklärt:** Private Space ist die Basis (V6/V7, Skizze §2) | API-Doku, LSS-Quellcode |
| **D2** — Weaver-Slots | offen | **Teilweise:** Messweg `getConfig().slots` verifiziert (V3/V4); Zahl bleibt Geräte-Messung (M4); secdiscardable-Verbrauch zusätzlich prüfen | `IWeaver.aidl`, SP-Manager |
| **P1 §8.1** — Konstantzeit über Binder/HAL | offen | **Offen** (M2; strukturelle Konstantzeit in LSS machbar, HAL-Roundtrips ungeklärt) | — |
| **P1 §8.2** — Weaver-Slot-Anzahl | offen | wie D2 | — |
| **P1 §8.3** — CE-Schlüssel im RAM | offen | **Teilweise:** Kernel-Anteil belegt (V5); Userspace-Kopien offen (M4) | `KeyUtil.cpp` |
| **P1 §8.4** — Single-active-user | U | **U** (hilft MLSU strukturell; Umschalt-Details ungeprüft) | — |
| **P1 §8.5** — Biometrie | O | **O** (Designentscheidung; D3-Empfehlung „deaktivieren" unverändert) | — |
| **P1 §8.6** — OTA/Reset/Gerätewechsel | O | **O** | — |
| **P1 §8.7** — Legal/UX, Duress-Rückweg | O | **O** (P4-Nutzerstudie) | — |
| **P0 Schritt 4** — externe Review | offen | **Offen** — dieses Dokument ersetzt die Review nicht, es *füttert* sie mit belegten Fundstellen | — |
| **P0 Schritt 5** — Anforderungen v1.0 | offen | **Offen** — erst nach Rückläufen aus Schritt 4 | — |

---

## 7. Was dieses Dokument nicht leistet

Kein Sicherheitsnachweis, keine Messung, keine Geräteaussage. Jede V-Zeile hier
heißt: *an dieser einen Fundstelle, an diesem einen Tag, in diesem einen Branch*.
Die harten Fragen bleiben, wo sie waren: M2 (Konstantzeit), M4 (Hardware),
externe Review (P0 Schritt 4/5). Was sich geändert hat: Die Skizze steht jetzt
auf geprüften Signaturen und belegten Mechanismen statt auf plausiblen Annahmen —
und sie dokumentiert mit V7 eine Konstruktion, die der Zielarchitektur näher
kommt als alles, was P0 kannte.

---

## 8. Quellen

1. [LockSettingsService.java — doVerifyCredential, onCredentialVerified, Unified Lock (android-latest-release)](https://cs.android.com/android/platform/superproject/+/android-latest-release:frameworks/base/services/core/java/com/android/server/locksettings/LockSettingsService.java) — Z. 1678, 1721–1724, 1795–1797, 1913–1914, 2167–2169, 2618–2620, 2691–2692, 2769–2782, 3379 (V, 2026-08-19)
2. [SyntheticPasswordManager.java — unlockLskfBasedProtector, weaverVerify, mWeaverConfig (android-latest-release)](https://cs.android.com/android/platform/superproject/+/android-latest-release:frameworks/base/services/core/java/com/android/server/locksettings/SyntheticPasswordManager.java) — Z. 793–794, 1534, 1583–1585, 1776–1778 (V, 2026-08-19)
3. [IWeaver.aidl — Slot-Array, getConfig, per-Slot-Throttle (refs/heads/main)](https://android.googlesource.com/platform/hardware/interfaces/+/refs/heads/main/weaver/aidl/android/hardware/weaver/IWeaver.aidl) (V, 2026-08-19)
4. [KeyUtil.cpp — installKey/evictKey/waitForBusyFiles, fscrypt-Keyring (refs/heads/main)](https://android.googlesource.com/platform/system/vold/+/refs/heads/main/KeyUtil.cpp) (V, 2026-08-19)
5. [VoldNativeService.cpp — unlockCeStorage/lockCeStorage (refs/heads/main)](https://android.googlesource.com/platform/system/vold/+/refs/heads/main/VoldNativeService.cpp) (V, 2026-08-19)
6. [UserManager — USER_TYPE_PROFILE_PRIVATE, DISALLOW_ADD_PRIVATE_PROFILE (API 35)](https://developer.android.com/reference/android/os/UserManager) (V, 2026-08-19)
7. [GrapheneOS — Features: Duress PIN/Password](https://grapheneos.org/features) (V, 2026-08-19)
8. [GrapheneOS — FAQ: Weaver, Hardware-Verzögerung, Slot-Wipe](https://grapheneos.org/faq) (V, 2026-08-19)
9. [Quarkslab — „2021: A Titan M Odyssey" (Whitepaper, BHEU 2021)](https://github.com/quarkslab/titanm/blob/master/BHEU_2021/EU-21-Rossi_Bellom-2021_A_Titan_M_Odyssey-wp.pdf) (V, 2026-08-19)
10. [Mobiflage — Autorenseite mit Grenzen und TRIM-Warnung (Skillen/Mannan)](https://www.ccsl.carleton.ca/~askillen/mobiflage/) (V, 2026-08-19)
11. [„Towards Designing A Secure Plausibly Deniable System for Mobile" — arXiv:2002.02379](https://arxiv.org/pdf/2002.02379) (V, 2026-08-19) — Multi-Snapshot-Adversary, DEFTL/MobiCeal-Einordnung
12. [MobiCeal — MobiPluto/DEFTL-Einordnung (ResearchGate)](https://www.researchgate.net/publication/324597075_MobiCeal_Towards_Secure_and_Practical_Plausibly_Deniable_Encryption_on_Mobile_Devices) (V, 2026-08-19)

---

## Lizenz

[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/deed.de),
siehe [LICENSE](../LICENSE).
