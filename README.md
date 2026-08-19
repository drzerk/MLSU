# Multi-Layer Secure Unlock (MLSU)

**Systemweiter Datenschutzmodus mit mehrstufigem Entsperrkonzept**

*[🇬🇧 English](README.en.md) · 🇩🇪 Deutsch*

| | |
|---|---|
| **Arbeitstitel** | Multi-Layer Secure Unlock (MLSU) |
| **Status** | Konzeptpapier — kein Code, keine Implementierung |
| **Version** | 0.1 (Entwurf) |
| **Zielplattform** | Android / AOSP (primär), iOS (nur theoretisch) |
| **Lizenzidee (späterer Code)** | Offen und auditierbar (Apache-2.0 oder GPL-kompatibel) |

---

## Dokumente

- **Konzeptpapier** — dieses Dokument (Abschnitte 1–14)
- **[P0 — Anforderungsdokument](docs/p0-anforderungen.md)** — Stand der Technik als
  Vergleichsmatrix, verschärftes Bedrohungsmodell mit Angriffsbaum, Anforderungen
  mit Prüfkriterien, Entscheidungen vor dem Prototyp, Abbruchkriterien
- **[P0 — Befunde](docs/p0-befunde.md)** — was die Referenzimplementierung ergeben
  hat: fünf Befunde, darunter ein Zielkonflikt zwischen zwei Anforderungen
- **[P1 — PoC-Skizze](docs/p1-poc-skizze.md)** — Änderungspunkte in AOSP als
  Code-Gerüste: PIN-Routing in `LockSettingsService`, Private Space als Fundament,
  Meilensteinplan M0–M4
- **[P2 — Metadaten-Audit](docs/p2-metadaten-audit.md)** — Leck-Checkliste für den
  PoC: jede Leckstelle (UI, Speicher, Verhalten, Dienste) mit Prüfmethode und
  Prüfkriterium; abzuarbeiten in P1/M3
- **[Referenzimplementierung](reference/README.md)** — lauffähiges Modell der
  Auswahllogik mit Anforderungstests und Zeitmessrig. Kein Android-Code, nichts
  zum Benutzen — ein Modell zum Kaputtmachen
- **[Proposal für ROM-Projekte](docs/rom-proposal.en.md)** *(englisch)* — der
  Vorschlag in der Form, in der er bei Maintainern ankommt: fünf Fragen zuerst,
  danach die Vorarbeit und die bereits gefundenen Probleme

---

## 1. Kurzfassung

MLSU beschreibt ein optionales Betriebssystem-Feature, bei dem **die eingegebene
PIN entscheidet, welcher verschlüsselte Datenbereich entsperrt wird**. Statt
eines einzigen Benutzerbereichs, der bei bekanntem Code vollständig offenliegt,
existieren mehrere kryptografisch voneinander getrennte Bereiche:

- **PIN 1** → vollständiger privater Bereich
- **PIN 2** → separater, bewusst unauffälliger Bereich mit eingeschränktem Inhalt

Der entscheidende Punkt ist nicht die Trennung an sich — die gibt es in Ansätzen
bereits (Work Profile, Private Space, Secure Folder) — sondern dass die
**Schlüssel der nicht entsperrten Bereiche nach dem Entsperren nicht im
Speicher existieren** und die Oberfläche keinen Hinweis auf ihre Existenz gibt.

Das Konzept unterscheidet ausdrücklich zwei Schutzziele, die oft vermischt
werden und sehr unterschiedlich gut erreichbar sind:

1. **Kompartimentierung** — ein kompromittierter Bereich gibt die anderen nicht
   preis. *Technisch solide erreichbar.*
2. **Abstreitbarkeit (plausible deniability)** — ein Prüfer kann nicht
   feststellen, *dass* weitere Bereiche existieren. *Nur eingeschränkt
   erreichbar; siehe Abschnitt 9.*

Ein ehrliches Projekt muss (1) versprechen und die Grenzen von (2) offenlegen.

---

## 2. Problemstellung

Aktuelle Smartphones kennen praktisch nur einen Schutzzustand: gesperrt oder
entsperrt. Wer den Code kennt oder dessen Herausgabe erzwingt, erhält Zugriff
auf nahezu alle persönlichen Daten — Nachrichten, Fotos, Standortverlauf,
Zahlungsdaten, Passwortmanager, Gesundheitsdaten, gespeicherte Sitzungen in
Apps und Browsern.

Das ist besonders in drei Situationen problematisch:

- **Zwangssituationen** — Grenzkontrolle, Diebstahl mit Nötigung, häusliche
  Gewalt, Kontrolle durch Dritte im persönlichen Umfeld.
- **Beschlagnahme mit Herausgabepflicht** — je nach Rechtsordnung kann die
  Herausgabe des Codes verlangt oder erzwungen werden.
- **Grenzüberschreitende Reisen** — Geräteinspektion ohne Anfangsverdacht ist
  in mehreren Ländern zulässig.

Bestehende Teillösungen adressieren das nur unvollständig:

| Lösung | Was sie leistet | Wo sie aufhört |
|---|---|---|
| Android Work Profile | Getrennter Container mit eigenem Schlüssel | Sichtbar, verwaltet, nicht abstreitbar |
| Android Private Space (ab Android 15) | Versteckbarer Container mit eigener Sperre | Existenz systemweit erkennbar; kein zweiter Login-Pfad |
| Samsung Secure Folder (Knox) | Container mit eigener Auth | Proprietär, sichtbares Icon, nicht auditierbar |
| GrapheneOS Duress-PIN | PIN, die Schlüssel löscht (Wipe) | Zerstörend, nicht wiederherstellbar, kein Weiterbetrieb |
| VeraCrypt Hidden Volume (Desktop) | Echte Abstreitbarkeit auf Dateisystemebene | Kein mobiles Betriebssystemäquivalent |

MLSU besetzt die Lücke: **ein nicht-zerstörender, zweiter vollwertiger
Betriebszustand, der über die PIN-Eingabe selbst gewählt wird.**

---

## 3. Ziele und Nicht-Ziele

### Ziele

- Mehrere kryptografisch getrennte Datenbereiche auf einem Gerät.
- Auswahl des Bereichs allein durch die eingegebene PIN — kein Menü, kein
  Schalter, kein zusätzlicher Bedienschritt.
- Kein Schlüsselmaterial nicht-entsperrter Bereiche im RAM.
- Der eingeschränkte Bereich ist ein voll benutzbares System, kein leerer
  Demomodus.
- Vollständig quelloffen und unabhängig auditierbar.
- Für technisch nicht versierte Nutzer bedienbar — Fehlbedienung darf nicht
  zum stillen Verlust des Schutzes führen.

### Nicht-Ziele

- **Kein Schutz gegen ein bereits kompromittiertes Betriebssystem.** Läuft eine
  Schadsoftware mit Systemrechten oder ist der Bootloader manipuliert, hilft
  MLSU nicht.
- **Kein Schutz gegen Beobachtung der PIN-Eingabe** (Kamera, Schultern,
  kompromittierte Tastatur).
- **Keine Umgehung rechtlicher Mitwirkungspflichten.** MLSU ist kein Werkzeug
  zur Vereitelung von Ermittlungen, sondern ein Datenschutzmechanismus.
- **Keine Garantie der Abstreitbarkeit** gegenüber einem forensisch
  ausgestatteten Angreifer (siehe Abschnitt 9).
- Kein Ersatz für Backups, Festplattenverschlüsselung auf anderen Geräten oder
  sichere Kommunikationswerkzeuge.

---

## 4. Bedrohungsmodell

Die Beurteilung von MLSU ergibt nur pro Angreiferklasse Sinn.

| # | Angreifer | Fähigkeiten | Schutzwirkung von MLSU |
|---|---|---|---|
| A1 | Gelegenheitsdieb | Gerät in der Hand, keine Kenntnis der PIN | Vollständig (bereits durch Standardverschlüsselung) |
| A2 | Bekannter im Nahbereich | Kennt oder erzwingt *eine* PIN, keine Forensik | **Hoch** — Kernszenario |
| A3 | Kontrolle an Grenze/Checkpoint | Verlangt Entsperrung, kurze Sichtprüfung am Gerät | **Hoch**, sofern der eingeschränkte Bereich glaubwürdig wirkt |
| A4 | Strafverfolgung mit Standardforensik | Extraktion nach Entsperrung, Analyse des Dateisystems | **Teilweise** — Daten bleiben verschlüsselt, Existenz aber meist erkennbar |
| A5 | Spezialisierte Forensik / staatlicher Akteur | Chip-off, Firmware-Analyse, Exploits, Zeit | **Gering für Abstreitbarkeit**, Vertraulichkeit hält solange die Schlüssel halten |
| A6 | Kompromittiertes System (Malware mit Root) | Zugriff zur Laufzeit | **Keine** |

**Konsequenz für die Kommunikation des Projekts:** MLSU darf gegenüber A4/A5
nicht als Tarnkappe beworben werden. Wird das Feature als "unsichtbar"
verkauft und ein Nutzer verlässt sich in einer Situation darauf, in der ein
Prüfer die Existenz doch nachweisen kann, verschlechtert das die Lage des
Nutzers gegenüber gar keinem Feature — dann steht der Vorwurf des Verbergens
im Raum. Diese Ehrlichkeit gehört in die Benutzeroberfläche, nicht nur ins
Handbuch.

---

## 5. Grundprinzip

```
             ┌──────────────────────────┐
             │      Sperrbildschirm     │
             │   (identisch, immer)     │
             └────────────┬─────────────┘
                          │ PIN-Eingabe
                          ▼
             ┌──────────────────────────┐
             │  KDF + Hardware-Binding  │
             │  (Argon2id + Secure      │
             │   Element / Weaver)      │
             └────────────┬─────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        ▼                 ▼                 ▼
   ┌─────────┐      ┌───────────┐    ┌────────────┐
   │ Profil A│      │ Profil B  │    │ kein Match │
   │ (privat)│      │ (reduziert│    │ → Fehlver- │
   │         │      │  unauffäl-│    │   such,    │
   │         │      │  lig)     │    │   Zähler++ │
   └─────────┘      └───────────┘    └────────────┘
```

Wesentliche Eigenschaften:

1. **Ein einziger, unveränderter Sperrbildschirm.** Kein Hinweis auf die Anzahl
   der Profile — keine abweichende PIN-Länge, keine sichtbare Auswahl.
2. **Kein gemeinsames Master-Secret.** Jede PIN leitet ihren eigenen
   Profilschlüssel ab. Die Kompromittierung von PIN 2 gibt mathematisch keinen
   Hinweis auf den Schlüssel von Profil A.
3. **Konstante Verarbeitungszeit.** Die Auswertung muss für alle Eingaben —
   auch für falsche — dieselbe Zeit brauchen, sonst verrät ein Zeitunterschied
   die Zahl der konfigurierten Profile.
4. **Kein Schlüsselmaterial fremder Profile im RAM.** Nach dem Entsperren von
   Profil B existiert der Schlüssel von Profil A nirgends im laufenden System.

---

## 6. Technische Architektur

### 6.1 Schlüsselhierarchie

```
PIN_i ──► Argon2id(PIN_i, salt_i, m=64MiB, t=3, p=1)
             │
             ▼
        pin_key_i
             │
             ├──► Secure Element / StrongBox: entsiegelt wrapped_key_i
             │    (hardwaregebunden, Rate-Limit via Weaver/Gatekeeper)
             ▼
        profile_key_i
             │
             ├──► FBE-Klassenschlüssel (CE-Storage von Profil i)
             ├──► Keystore-Namespace von Profil i
             └──► Schlüssel für Sync/Backup von Profil i
```

- **Kein Profil kann den Schlüssel eines anderen ableiten.** `wrapped_key_i`
  ist unabhängig erzeugt, nicht aus einem Master-Key abgeleitet.
- **Hardware-Bindung ist Pflicht.** Ohne Secure Element ist eine 6-stellige PIN
  offline trivial durchprobierbar. Das Rate-Limiting muss in Hardware
  erzwungen werden (Titan M / StrongBox / TEE mit Weaver-Slots).
- **Ein Weaver-Slot pro Profil.** Fehlversuchszähler dürfen nicht geteilt
  werden — sonst wird die Existenz weiterer Profile über das
  Sperrverhalten sichtbar.

### 6.2 Speichertrennung

Android bringt die Grundlagen bereits mit: File-Based Encryption trennt
zwischen `DE` (device-encrypted, ab Boot verfügbar) und `CE`
(credential-encrypted, erst nach Entsperrung). MLSU baut darauf auf:

- Jedes Profil erhält eigene `CE`-Klassenschlüssel.
- **Nichts Persönliches darf in `DE` liegen.** Benachrichtigungs-Caches,
  Vorschaubilder, App-Listen und Suchindizes sind hier die typischen
  Leckstellen.
- Getrennte Media-Stores, getrennte Kontenverwaltung, getrennte
  Zwischenablage, kein profilübergreifendes IPC, kein gemeinsamer
  Benachrichtigungsverlauf.

### 6.3 Das Metadaten-Problem

Die schwierigsten Lecks liegen nicht in den Nutzdaten, sondern in dem, was
das System *drumherum* speichert:

| Leck | Beschreibung | Gegenmaßnahme |
|---|---|---|
| Speicherbelegung | Belegter Platz ohne sichtbaren Inhalt verrät verborgene Daten | Vorabreservierung fester Blöcke; Anzeige der Belegung profilbezogen normalisieren |
| Modem / eSIM | Verbindungshistorie, IMSI-Wechsel, Roaming-Logs liegen außerhalb des Profilkontexts | Modem-Log-Trennung; keine profilbezogenen SIM-Wechsel |
| Uhrzeit / Betriebsdauer | Ein Profil mit "letzter Nutzung vor 6 Monaten" wirkt gestellt | Aktivitätszeitstempel pro Profil plausibel führen |
| Backups & Cloud-Sync | Ein Cloud-Konto, das Daten beider Profile kennt, hebt die Trennung auf | Strikt getrennte Sync-Identitäten, Zero-Knowledge-Verschlüsselung je Profil |
| Firmware-/Bootloader-Logs | Bootzähler, Panic-Logs, Crash-Reports | Profilneutrale Protokollierung |
| Wear-Leveling im Flash | Alte Blöcke bleiben physisch erhalten | Nicht vollständig lösbar auf Anwendungsebene — siehe Abschnitt 9 |

### 6.4 Ausbaustufen

| Stufe | Umfang | Aufwand |
|---|---|---|
| **0** | Zwei Profile, getrennte FBE-Schlüssel, PIN-basierte Auswahl | Kern-PoC |
| **1** | Beliebig viele Profile, profilspezifische App-Sets | Mittel |
| **2** | Getrennte Cloud-Synchronisierung mit eigener Identität je Profil | Hoch |
| **3** | Zero-Knowledge-Sync, unabhängig auditiertes Schlüsselprotokoll | Sehr hoch |

Empfehlung: Stufe 0 vollständig und sauber, bevor irgendetwas von Stufe 2/3
angefasst wird. Ein halbfertiger Sync ist gefährlicher als kein Sync.

---

## 7. Plattformanalyse

### Android / AOSP — machbar

Vorhandene Bausteine: Multi-User-Support seit Android 4.2, File-Based
Encryption seit Android 7, Gatekeeper/Weaver für hardwareseitiges
Rate-Limiting, `synthetic password` als Abstraktionsschicht zwischen
Nutzergeheimnis und Schlüsseln, Private Space ab Android 15.

Zu ändern wären im Wesentlichen:

- `LockSettingsService` — Auswertung der Eingabe gegen mehrere Profile statt
  gegen eines, in konstanter Zeit.
- `vold` / `keystore2` — Entsperrung des jeweils passenden CE-Schlüssels.
- SystemUI — ein Sperrbildschirm, der die Profilzahl nicht verrät.
- Einrichtungsassistent — der kritischste Teil aus Nutzersicht (Abschnitt 8).

Realistischer Weg: ein Custom-ROM-Projekt mit bestehender Sicherheitskultur
(GrapheneOS, CalyxOS) oder ein eigenständiger AOSP-Fork. Als Patch gegen
Stock-Android ohne Bootloader-Zugriff ist das Konzept **nicht** umsetzbar.

### iOS — derzeit nicht umsetzbar

Auf dem iPhone gibt es keine Mehrbenutzerfähigkeit auf Systemebene (anders als
Shared iPad). Data Protection und Secure Enclave sind fest an *einen*
Passcode gebunden; Drittsoftware hat keinen Zugang zur Entsperrlogik. Ohne
Änderungen durch Apple bleibt bestenfalls eine App-interne Container-Lösung —
die genau das nicht leistet, worum es hier geht: systemweite Trennung.

Sinnvolle Position: iOS explizit als "nicht unterstützt" ausweisen, statt eine
abgespeckte App-Variante zu bauen, die falsche Sicherheit suggeriert.

---

## 8. Bedienbarkeit als Sicherheitsanforderung

Bei diesem Feature ist die Benutzerführung kein Beiwerk, sondern
sicherheitskritisch:

- **Ein leeres zweites Profil ist verdächtiger als gar keines.** Der
  eingeschränkte Bereich braucht Kontakte, Fotos, App-Nutzung und plausible
  Zeitstempel. Das System sollte beim Einrichten aktiv dabei helfen und später
  daran erinnern, den Bereich zu benutzen.
- **PIN-Verwechslung darf nicht katastrophal sein.** Wer unter Stress die
  falsche PIN eingibt, hat sofort den falschen Bereich offen. Ein
  Rückweg — ohne Neustart, ohne sichtbaren Hinweis — muss existieren.
- **Kein Feature-Werbebanner.** Ein Gerät, das im Einstellungsmenü sichtbar
  "MLSU aktiviert" anzeigt, hebt seinen eigenen Zweck auf. Der
  Konfigurationszugang gehört ausschließlich in das private Profil.
- **Verständliche Grenzen.** Die Einrichtung muss in einfachen Worten sagen,
  wogegen das Feature schützt und wogegen nicht (Tabelle aus Abschnitt 4).

---

## 9. Grenzen, Risiken, offene Probleme

Dieser Abschnitt ist der wichtigste des Dokuments.

**9.1 Abstreitbarkeit ist bei Open Source strukturell schwächer.**
Ist MLSU Teil eines öffentlich bekannten ROMs, weiß ein Prüfer beim Erkennen
dieses ROMs, dass ein zweites Profil *existieren kann*. Die Frage verschiebt
sich von "gibt es mehr?" zu "zeig mir die zweite PIN". Damit ist das
Kernversprechen gegenüber A4/A5 weitgehend entwertet. Es gibt keinen sauberen
Ausweg — nur die Wahl zwischen Auditierbarkeit und Verborgenheit, und
Auditierbarkeit ist bei Sicherheitssoftware die richtige Wahl.

**9.2 Physische Speicheranalyse.**
Flash-Speicher mit Wear-Leveling behält alte Blöcke. Belegter, aber nicht
zuordenbarer Speicherplatz ist mit forensischer Ausstattung sichtbar. Eine
Vorabreservierung fester Bereiche mildert das, macht aber die Reservierung
selbst zum Indiz.

**9.3 Rechtslage.**
Sehr unterschiedlich je Land: in einigen Rechtsordnungen kann die Herausgabe
von Schlüsseln angeordnet und deren Verweigerung sanktioniert werden; in
anderen gilt ein Selbstbelastungsverbot, das aber häufig nicht für
biometrische Merkmale gilt. Das Projekt sollte länderspezifische Hinweise
zusammen mit Jurist:innen erarbeiten und niemals selbst Rechtsberatung
erteilen. *Dieses Dokument ist keine Rechtsberatung.*

**9.4 Falsche Sicherheit als Hauptrisiko.**
Die realistischste Schadensursache ist nicht ein gebrochener Algorithmus,
sondern ein Nutzer, der dem Feature mehr zutraut als es leistet, und deshalb
Daten auf dem Gerät behält, die dort nicht sein sollten. Gegenmaßnahme:
konservative Kommunikation, keine Marketingsprache, klare
Bedrohungsmodell-Tabelle in der Oberfläche selbst.

**9.5 Angriffsfläche wächst.**
Eingriffe in `LockSettingsService`, `vold` und `keystore2` berühren den
sensibelsten Teil des Systems. Ein Fehler hier gefährdet *alle* Daten, auch
die von Nutzern, die das Feature nie aktiviert haben. Deshalb: Feature
standardmäßig aus, Code-Pfade bei Deaktivierung nicht erreichbar, externes
Audit vor jeder Veröffentlichung.

**9.6 Biometrie.**
Fingerabdruck und Gesichtserkennung sind mit dem Konzept schwer vereinbar —
sie erlauben keine "Auswahl durch Wissen". Vermutlich muss Biometrie im
MLSU-Betrieb entweder auf ein Profil beschränkt oder ganz deaktiviert sein.

---

## 10. Zielgruppe

Journalist:innen und ihre Quellen, Menschenrechtsaktivist:innen,
Geschäftsreisende mit Vertraulichkeitspflichten, Personen in Trennungs- oder
Gewaltsituationen, Ärzt:innen und Anwält:innen mit Berufsgeheimnis, sowie
allgemein datenschutzbewusste Nutzer.

Wichtig für die Projektkommunikation: Der Nutzen liegt im Schutz legitimer
Vertraulichkeit. Eine Positionierung als Werkzeug zur Umgehung von
Strafverfolgung wäre sowohl sachlich falsch als auch für das Projekt
existenzgefährdend.

---

## 11. Machbarkeitspfad

| Phase | Inhalt | Ergebnis |
|---|---|---|
| **P0** | Bedrohungsmodell mit externen Reviewern schärfen; Stand der Technik systematisch erfassen | Belastbares Anforderungsdokument |
| **P1** | Proof of Concept auf AOSP-Emulator: zwei Profile, zwei PINs, getrennte CE-Schlüssel | Funktionsnachweis |
| **P2** | Metadaten-Audit: gezielte Suche nach Lecks (DE-Storage, Logs, Modem, Backup) | Leckliste + Fixes |
| **P3** | Portierung auf reale Hardware mit Secure Element, Weaver-Slots je Profil | Nutzbarer Prototyp |
| **P4** | Externes Sicherheitsaudit, Nutzerstudie mit der Zielgruppe | Freigabeentscheidung |
| **P5** | Veröffentlichung, Dokumentation der Grenzen, Wartungszusage | Release |

Vor P4 sollte das Feature niemandem empfohlen werden, der es tatsächlich in
einer Risikosituation braucht.

---

## 12. Offene Fragen

1. Lässt sich konstante Auswertungszeit über beliebig viele Profile hinweg auf
   realer Hardware sicher garantieren?
2. Wie viele Weaver-Slots stellen gängige Secure Elements bereit — reicht das
   für mehr als zwei Profile?
3. Kann die Speicherbelegung so normalisiert werden, dass sie unter
   Standardforensik unauffällig bleibt, ohne den nutzbaren Platz zu halbieren?
4. Wie wird ein Profil sicher gelöscht, ohne dass die Löschung selbst zum
   Indiz wird?
5. Wie lässt sich der Bereitschaftszustand (Notruf, Alarme, eingehende Anrufe)
   profilübergreifend abbilden, ohne Metadaten zu lecken?
6. Was passiert bei OTA-Updates, Werksreset und Gerätewechsel?

---

## 13. Verwandte Arbeiten

- **VeraCrypt / TrueCrypt Hidden Volumes** — der klassische Ansatz zur
  Abstreitbarkeit auf Desktop-Systemen; zeigt sowohl Vorbild als auch die
  bekannten Grenzen.
- **GrapheneOS Duress-PIN** — zerstörender Gegenentwurf: eine PIN löscht
  Schlüssel statt ein anderes Profil zu öffnen.
- **Android Private Space (ab Android 15)** — sichtbarer, versteckbarer
  Container mit eigener Sperre; nächster Verwandter im Mainline-Android.
- **Android Work Profile / Samsung Secure Folder** — Container-Trennung ohne
  jeden Abstreitbarkeitsanspruch.
- **LUKS mit detached header / plain dm-crypt** — Linux-Ansatz, bei dem die
  Existenz der Verschlüsselung nicht aus dem Datenträger hervorgeht.
- **Forschung zu Deniable Encryption / Deniable File Systems** — insbesondere
  die Literatur zu Angriffen auf Abstreitbarkeit über Flash-Metadaten.

---

## 14. Vision

Ein offenes, unabhängig auditierbares Datenschutzkonzept, das Menschen in
Zwangssituationen einen realistischen — nicht einen versprochenen — Schutz
gibt. Der Wert steht und fällt mit der Ehrlichkeit über die eigenen Grenzen:
ein Feature, das seine Schwächen dokumentiert, ist für die Zielgruppe brauchbar.
Eines, das sie verschweigt, ist gefährlich.

---

## Lizenz

Dieses Dokument steht unter
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/deed.de).
Siehe [LICENSE](LICENSE).
