# P0 — Anforderungsdokument

**Multi-Layer Secure Unlock (MLSU)** · Phase P0 des [Machbarkeitspfads](../README.md#11-machbarkeitspfad)

| | |
|---|---|
| **Status** | In Arbeit — Entwurf zur externen Review |
| **Version** | 0.1 |
| **Vorgänger** | [Konzeptpapier v0.1](../README.md) |
| **Ziel dieser Phase** | Belastbares Anforderungsdokument als Grundlage für den PoC (P1) |
| **Abschlusskriterium** | Alle Anforderungen haben ein Prüfkriterium; alle `U`-Einträge sind geklärt; mindestens zwei externe Reviews liegen vor |

---

## 1. Zweck und Geltungsbereich

Das Konzeptpapier beschreibt *was* MLSU sein soll. Dieses Dokument legt fest,
*woran gemessen wird*, ob eine Implementierung das Konzept erfüllt — und was
vorher geklärt sein muss, damit der Bau eines Prototyps (P1) nicht auf falschen
Annahmen aufsetzt.

Nicht in diesem Dokument: Implementierungsdesign, API-Entwürfe, Code. Die
Architekturskizze im Konzeptpapier (Abschnitt 6) ist Eingabe, nicht Ergebnis.

---

## 2. Methodik und Verifikationsstatus

Der Stand der Technik in Abschnitt 3 ist aus vorhandenem Wissen
zusammengetragen, **nicht** durch Messung am Gerät oder Quellcode-Lesen
bestätigt. Damit daraus keine stille Fehlannahme wird, trägt jede Aussage einen
Status:

| Status | Bedeutung |
|---|---|
| **V** | Verifiziert — am Gerät gemessen oder im Quellcode/Spezifikation nachgelesen, mit Fundstelle |
| **U** | Unverifiziert — plausibel, aber Herkunft ist Modell- bzw. Erfahrungswissen; **vor P1 zu prüfen** |
| **O** | Offen — widersprüchliche oder fehlende Information |

**Zum jetzigen Zeitpunkt ist praktisch alles `U`.** Das ist der eigentliche
Arbeitsauftrag von P0: die `U`-Einträge in `V` überführen. Ein Anforderungs-
dokument, das auf ungeprüften Plattformannahmen steht, ist wertlos — genau daran
scheitern Sicherheitsprojekte typischerweise nicht am Ende, sondern am Anfang.

Zusätzlich gilt: Angaben zu Android-Versionen und Hardware-Eigenschaften altern
schnell. Jede `V`-Aussage bekommt ein Prüfdatum und die konkrete Version
(Android-Release, Gerät, ROM-Build), auf die sie sich bezieht.

---

## 3. Stand der Technik — systematische Erfassung

### 3.1 Bewertungskriterien

| Kürzel | Kriterium |
|---|---|
| **K1** | Kryptografische Trennung (eigene Schlüssel je Bereich, kein gemeinsamer Master-Key) |
| **K2** | Zweiter Login-Pfad (Auswahl des Bereichs durch das Entsperrgeheimnis selbst) |
| **K3** | Existenz verbergbar (kein UI-Hinweis auf weitere Bereiche) |
| **K4** | Zerstörungsfrei (kein Wipe als Preis für den Schutz) |
| **K5** | Metadaten-Trennung (Benachrichtigungen, Caches, Konten, Logs) |
| **K6** | Auditierbar (quelloffen, unabhängig prüfbar) |
| **K7** | Ohne Bootloader-Eingriff nutzbar (Mainline statt Custom-ROM) |

### 3.2 Vergleichsmatrix

| System | K1 | K2 | K3 | K4 | K5 | K6 | K7 | Status |
|---|---|---|---|---|---|---|---|---|
| AOSP Multi-User | ja | nein | nein | ja | teilw. | ja | teilw. | U |
| Android Work Profile | ja | nein | nein | ja | ja | ja | ja | U |
| Android Private Space (ab 15) | ja | nein | teilw. | ja | ja | ja | ja | U |
| Samsung Secure Folder (Knox) | ja | nein | nein | ja | ja | **nein** | ja | U |
| GrapheneOS Duress-PIN | — | ja | ja | **nein** | — | ja | nein | U |
| VeraCrypt Hidden Volume (Desktop) | ja | ja | ja | ja | n/a | ja | n/a | U |
| VeraCrypt Hidden OS (Desktop) | ja | ja | ja | ja | teilw. | ja | n/a | U |
| LUKS + detached header | ja | nein | ja | ja | n/a | ja | n/a | U |
| Mobiflage / MobiPluto / MobiCeal (Forschung) | ja | ja | ja | ja | O | ja | nein | U |
| Qubes OS (Desktop-Kompartimentierung) | ja | nein | nein | ja | ja | ja | n/a | U |
| **MLSU (Zielbild)** | **ja** | **ja** | **ja** | **ja** | **ja** | **ja** | **nein** | — |

### 3.3 Was daraus folgt

Drei Beobachtungen, die den Zuschnitt des Projekts bestimmen:

1. **K2 ist das Alleinstellungsmerkmal.** Alle Mainline-Android-Lösungen trennen
   Bereiche, aber keine wählt den Bereich über das Entsperrgeheimnis. Wer MLSU
   baut, baut im Kern genau diesen einen Mechanismus — der Rest existiert
   bereits.
2. **Die Forschung hat das mobil schon versucht.** Mobiflage und Nachfolger sind
   akademische Arbeiten zu abstreitbarer Verschlüsselung auf Android. Sie sind
   nicht in Produktionssystemen angekommen. **Die wichtigste P0-Frage lautet:
   warum nicht?** Wenn die Antwort technisch ist (Flash-Metadaten, FTL, Wear
   Leveling), gilt sie auch für MLSU. Diese Literatur zu lesen ist billiger als
   ihre Ergebnisse nachzubauen.
3. **K7 ist verloren.** Ohne Custom-ROM ist der Mechanismus nicht baubar. Das
   halbiert die realistische Nutzerbasis und macht Kooperation mit einem
   bestehenden ROM-Projekt praktisch alternativlos.

### 3.4 Zu prüfende Vorarbeiten (P0-Leseliste)

| # | Gegenstand | Warum relevant |
|---|---|---|
| L1 | Mobiflage (Skillen/Mannan) und Nachfolgearbeiten | Direkter Vorläufer; enthält vermutlich die Gründe des Scheiterns |
| L2 | Publikationen zu Angriffen auf abstreitbare Dateisysteme via Flash/FTL | Entscheidet, ob K3 gegen A5 überhaupt erreichbar ist |
| L3 | AOSP: `LockSettingsService`, `synthetic password`, `vold`, `keystore2` | Bestimmt den tatsächlichen Änderungsumfang |
| L4 | Weaver-/Gatekeeper-HAL-Spezifikation, Slot-Anzahl realer Secure Elements | Harte Obergrenze für die Profilanzahl |
| L5 | Android Private Space — Implementierung und Erkennbarkeit | Klärt, ob MLSU darauf aufsetzen kann statt daneben |
| L6 | GrapheneOS-Designdokumente zum Duress-Mechanismus | Nächstes reales Vorbild inkl. Begründung des Wipe-Ansatzes |

---

## 4. Verschärftes Bedrohungsmodell

### 4.1 Schutzgüter

| # | Schutzgut | Verlust bedeutet |
|---|---|---|
| G1 | Inhalte des privaten Bereichs | Vollständige Offenlegung |
| G2 | **Existenz** des privaten Bereichs | Verlust der Abstreitbarkeit; Druck zur Herausgabe |
| G3 | Zuordnung von Aktivität zu einem Bereich | Rückschluss auf Verhalten trotz verschlüsselter Inhalte |
| G4 | Integrität des Systems | Manipulierte Entsperrlogik gefährdet alle Bereiche |

G2 ist das eigentlich neue Schutzgut. G1 leisten bereits heutige Systeme.

### 4.2 Angreiferfähigkeiten im Detail

| | A2 Nahbereich | A3 Kontrolle | A4 Standardforensik | A5 Spezialforensik |
|---|---|---|---|---|
| Zugriffsdauer | Minuten, wiederholt | Minuten bis Stunden | Tage | Unbegrenzt |
| Gerät entsperrt | ja (erzwungen) | ja (erzwungen) | ja | ja/nein |
| Werkzeuge | keine | Sichtprüfung, ggf. Extraktionstool | Kommerzielle Extraktion | Chip-off, Exploits, Eigenentwicklung |
| Vorwissen über MLSU | nein | möglich | **ja** | **ja** |
| Wiederholter Zugriff | ja | selten | ja | ja |
| Bricht G2? | nein | vermutlich nein | **wahrscheinlich** | **ja** |

### 4.3 Angriffsbaum für G2 („Existenz des privaten Bereichs nachweisen")

```
Ziel: Nachweis, dass ein weiterer Bereich existiert
├── ROM-Erkennung
│   └── Build-Fingerprint / Systemapps verraten MLSU-fähiges ROM   ← kaum vermeidbar
├── Speicheranalyse
│   ├── Belegter, nicht zuordenbarer Speicherplatz
│   ├── FTL-/Wear-Leveling-Reste alter Blöcke
│   └── Partitions- bzw. Metadatengröße passt nicht zum Inhalt
├── Verhaltensanalyse
│   ├── Zeitunterschied bei PIN-Auswertung
│   ├── Sperrverhalten / Fehlversuchszähler
│   └── Bootzeit oder Ressourcenverbrauch abhängig von Profilzahl
├── Kontextanalyse
│   ├── Sichtbares Profil zu leer / zu jung / zu wenig genutzt
│   ├── Konten, SIM, Cloud-Spuren passen nicht zum sichtbaren Profil
│   └── Externe Quellen (Provider, Cloud, Gegenstellen) widersprechen dem Gerätebild
└── Mensch
    ├── Beobachtung der Eingabe
    └── Aussage unter Druck
```

Die beiden oberen Äste sind technisch adressierbar, aber nicht restlos
schließbar. **Der Ast „Kontextanalyse" ist der am meisten unterschätzte:** er
wird nicht durch Kryptografie gebrochen, sondern durch einen Nutzer, der sein
Zweitprofil nicht pflegt. Das ist eine Anforderung an Produkt und Bedienung,
nicht an die Schlüsselableitung (siehe UR-2, UR-3).

### 4.4 Sicherheitsannahmen

Fällt eine dieser Annahmen, fällt die Schutzwirkung — sie sind explizit zu
prüfen und in der Nutzerdokumentation zu benennen.

| # | Annahme |
|---|---|
| SA-1 | Der Bootloader ist verriegelt und Verified Boot ist aktiv |
| SA-2 | Das Secure Element erzwingt Rate-Limiting, das nicht per Software umgangen werden kann |
| SA-3 | Das Betriebssystem ist zum Zeitpunkt des Entsperrens nicht kompromittiert |
| SA-4 | Der Nutzer gibt die PIN unbeobachtet ein |
| SA-5 | Der Nutzer benutzt den eingeschränkten Bereich regelmäßig und echt |
| SA-6 | Es existiert kein zweiter Datensatz außerhalb des Geräts, der dem sichtbaren Profil widerspricht |

---

## 5. Anforderungen

Priorität: **MUSS** (ohne das ist MLSU nicht MLSU) · **SOLL** (deutlicher
Wertverlust bei Verzicht) · **KANN** (Ausbaustufe).

### 5.1 Sicherheitsanforderungen

| ID | Anforderung | Prio | Prüfkriterium |
|---|---|---|---|
| SR-1 | Jedes Profil besitzt einen unabhängig erzeugten Schlüssel; kein gemeinsamer Master-Key | MUSS | Code-Review + Nachweis, dass aus `profile_key_B` kein Bezug zu `profile_key_A` ableitbar ist |
| SR-2 | Nach dem Entsperren von Profil B existiert kein Schlüsselmaterial von Profil A im RAM | MUSS | Speicherabbild des laufenden Systems, gezielte Suche nach Schlüsselmustern |
| SR-3 | Die PIN-Auswertung läuft in konstanter Zeit, unabhängig von Treffer und Profilanzahl | MUSS | Messreihe ≥10.000 Eingaben, statistischer Nachweis, dass keine trennbaren Verteilungen entstehen |
| SR-4 | Jedes Profil hat einen eigenen Fehlversuchszähler in Hardware | MUSS | Test: Fehlversuche in Profil B verändern das Sperrverhalten von Profil A nicht |
| SR-5 | Die PIN-Ableitung ist hardwaregebunden; Offline-Angriff auf ein Speicherabbild ist wirkungslos | MUSS | Extraktionstest: Abbild ohne Secure Element ist nicht angreifbar |
| SR-6 | Kein personenbezogener Inhalt in `DE`-Speicher | MUSS | Vollständige Inventarisierung des `DE`-Bereichs vor und nach Nutzung |
| SR-7 | Kein profilübergreifendes IPC, keine geteilte Zwischenablage, kein geteilter Benachrichtigungsverlauf | MUSS | Systematischer Testkatalog je IPC-Kanal |
| SR-8 | Die angezeigte Speicherbelegung erlaubt keinen Rückschluss auf weitere Profile | SOLL | Vergleich Gerät mit/ohne Zweitprofil, identische Anzeige |
| SR-9 | Bootzeit, Ressourcenverbrauch und Logs sind unabhängig von der Profilanzahl | SOLL | Messreihe + Log-Diff |
| SR-10 | Bei deaktiviertem Feature sind die MLSU-Codepfade nicht erreichbar | MUSS | Code-Review + Test auf Standardkonfiguration |
| SR-11 | Sicheres Löschen eines Profils hinterlässt kein Indiz für dessen vorherige Existenz | SOLL | Forensische Nachanalyse nach Löschung |

### 5.2 Funktionale Anforderungen

| ID | Anforderung | Prio | Prüfkriterium |
|---|---|---|---|
| FR-1 | Mindestens zwei Profile, Auswahl allein über die eingegebene PIN | MUSS | Funktionstest |
| FR-2 | Identischer Sperrbildschirm für alle Profile, keine Längen- oder Layoutunterschiede | MUSS | UI-Diff, Screenshot-Vergleich |
| FR-3 | Der eingeschränkte Bereich ist ein voll funktionsfähiges System (Telefonie, Kamera, Apps) | MUSS | Abnahmetest mit Alltagsszenarien |
| FR-4 | Wechsel zwischen Profilen ohne Neustart und ohne sichtbare Spur | SOLL | Funktionstest + UI-Prüfung |
| FR-5 | Konfiguration ausschließlich aus dem privaten Profil erreichbar | MUSS | Test aus dem eingeschränkten Profil heraus |
| FR-6 | Notruf funktioniert aus jedem Zustand | MUSS | Funktionstest |
| FR-7 | Getrennte Sync-Identität je Profil | KANN (Stufe 2) | Netzwerkmitschnitt: keine gemeinsamen Kennungen |
| FR-8 | Verhalten bei OTA-Update, Werksreset und Gerätewechsel ist definiert und dokumentiert | MUSS | Testmatrix über alle drei Fälle |

### 5.3 Bedien- und Produktanforderungen

| ID | Anforderung | Prio | Prüfkriterium |
|---|---|---|---|
| UR-1 | Die Einrichtung benennt in einfacher Sprache, wogegen MLSU schützt und wogegen nicht | MUSS | Nutzertest: Teilnehmer geben die Grenzen korrekt wieder |
| UR-2 | Die Einrichtung hilft aktiv, den eingeschränkten Bereich glaubwürdig zu befüllen | MUSS | Nutzertest + Bewertung durch unabhängige Prüfer („wirkt das echt?") |
| UR-3 | Das System erinnert an die Nutzung des eingeschränkten Bereichs, wenn dieser zu lange ungenutzt bleibt | SOLL | Funktionstest |
| UR-4 | Eine versehentlich eingegebene falsche PIN führt nicht zu Datenverlust oder sichtbarer Spur | MUSS | Fehlbedienungstest |
| UR-5 | Kein sichtbarer Hinweis auf MLSU im eingeschränkten Profil (Einstellungen, App-Liste, About) | MUSS | Vollständige UI-Durchsicht durch unabhängige Person |
| UR-6 | Biometrie ist im MLSU-Betrieb entweder auf ein Profil beschränkt oder deaktiviert | MUSS | Funktionstest; Designentscheidung D3 |

### 5.4 Ausdrückliche Nicht-Anforderungen

| ID | Nicht-Anforderung |
|---|---|
| NR-1 | Kein Schutz gegen ein zur Laufzeit kompromittiertes System |
| NR-2 | Keine Garantie der Abstreitbarkeit gegenüber A4/A5 |
| NR-3 | Keine Unterstützung ohne entsperrbaren Bootloader |
| NR-4 | Keine iOS-Unterstützung |
| NR-5 | Kein Schutz gegen erzwungene Herausgabe *aller* PINs durch eine Person, die weiß, dass es mehrere gibt |

---

## 6. Vor P1 zu entscheiden

| # | Entscheidung | Empfehlung | Begründung |
|---|---|---|---|
| D1 | Eigenständiger Mechanismus oder Aufsatz auf Private Space | **Zuerst Private Space prüfen** | Wenn K1/K3/K5 dort bereits erfüllt sind, reduziert sich MLSU auf den PIN-Auswahlpfad — deutlich kleinerer, besser prüfbarer Eingriff |
| D2 | Anzahl unterstützter Profile | **Zunächst genau zwei** | Weaver-Slots sind knapp (L4); mehr Profile verschärfen SR-3 und SR-8 überproportional |
| D3 | Umgang mit Biometrie | **Im MLSU-Betrieb deaktivieren** | Biometrie erlaubt keine Auswahl durch Wissen; ein Fingerabdruck, der nur ein Profil öffnet, ist zudem selbst ein Indiz |
| D4 | Kooperation oder eigener Fork | **Kooperation suchen** | Ein Eingriff in `LockSettingsService`/`keystore2` ohne bestehende Sicherheitskultur und Update-Pipeline ist nicht verantwortbar |
| D5 | Kommunikation der Abstreitbarkeit | **Als „begrenzt, gegen A2/A3" bewerben, nie als unsichtbar** | Siehe Konzeptpapier 9.1 und 9.4 |

---

## 7. Fragenkatalog für externe Review

**An ROM-/Plattformentwickler (GrapheneOS, CalyxOS, AOSP-nah):**
1. Wie groß ist der Eingriff in `LockSettingsService` und `synthetic password`
   realistisch, und wie stabil ist dieser Bereich über Android-Releases?
2. Reichen die Weaver-Slots gängiger Secure Elements für zwei getrennte
   Fehlversuchszähler?
3. Gibt es einen Grund, warum der Duress-Ansatz (Wipe) dem Mehrprofilansatz
   vorgezogen wurde — technisch oder aus Verantwortungsgründen?
4. Wäre ein Aufsatz auf Private Space gangbar oder verbaut dessen Design das?

**An Forensiker:**
5. Woran erkennt man heute in der Praxis ein Gerät mit verborgenem Zweitbereich?
6. Wie zuverlässig lässt sich nicht zuordenbarer Flash-Speicher nachweisen?
7. Wie viel verrät die Kontextanalyse (Provider-, Cloud-, Gegenstellendaten) im
   Vergleich zur Geräteanalyse?

**An Jurist:innen (je Rechtsordnung):**
8. Welche Mitwirkungspflichten bestehen, und wie wirkt sich das Vorhandensein
   eines nachgewiesenen, aber nicht geöffneten Bereichs aus?
9. Verschlechtert die Nutzung eines solchen Features die Position des Nutzers,
   wenn seine Existenz nachgewiesen wird?

**An die Zielgruppe:**
10. Ist die tägliche Pflege eines glaubwürdigen Zweitprofils realistisch leistbar?
11. Was passiert im Ernstfall unter Stress — wird die richtige PIN erinnert?

Frage 9 und 11 können das Projekt kippen. Sie gehören deshalb an den Anfang,
nicht ans Ende.

---

## 8. Abbruchkriterien

Ein Sicherheitsprojekt braucht definierte Gründe, es *nicht* zu bauen. MLSU
sollte eingestellt oder grundlegend umgeschnitten werden, wenn:

- **AB-1** — L2 ergibt, dass nicht zuordenbarer Flash-Speicher mit vertretbarem
  Aufwand zuverlässig nachweisbar ist. Dann ist G2 gegen A4 nicht haltbar und
  das Kernversprechen entfällt.
- **AB-2** — SR-3 (konstante Zeit) lässt sich auf realer Hardware nicht
  belastbar erreichen.
- **AB-3** — Kein ROM-Projekt ist zur Aufnahme bereit und ein eigener Fork kann
  keine verlässliche Update-Pipeline zusagen. Ein unwartbarer Sicherheits-Fork
  ist schädlicher als kein Feature.
- **AB-4** — Der Nutzertest zeigt, dass die Zielgruppe die Pflege des
  Zweitprofils nicht durchhält. Dann schützt das Feature im Ernstfall nicht,
  suggeriert aber Schutz.
- **AB-5** — Die juristische Prüfung ergibt, dass die Nutzung die Lage der
  Nutzer in den relevanten Rechtsordnungen überwiegend verschlechtert.

---

## 9. Nächste Schritte

| # | Schritt | Ergebnis | Status |
|---|---|---|---|
| 1 | Leseliste L1–L6 abarbeiten, Vergleichsmatrix von `U` auf `V` heben | Belegte Matrix mit Fundstellen | offen |
| 2 | D1 klären: Private Space als Basis prüfen | Entscheidung mit Begründung | offen |
| 3 | D2 klären: Weaver-Slots realer Geräte zählen | Harte Obergrenze | offen |
| 4 | Fragenkatalog an drei externe Reviewer versenden | ≥2 Rückläufer | offen |
| 5 | Anforderungen nach Review überarbeiten, Version 1.0 festschreiben | Freigabe für P1 | offen |

**P0 ist abgeschlossen, wenn Schritt 5 erreicht ist — nicht früher.** Ein PoC vor
Klärung von D1 baut mit hoher Wahrscheinlichkeit etwas, das es schon gibt.

---

## Lizenz

Dieses Dokument steht unter
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/deed.de).
Siehe [LICENSE](../LICENSE).
