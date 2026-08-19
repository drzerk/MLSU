# P2 — Metadaten-Audit: Leck-Checkliste für den PoC

**Multi-Layer Secure Unlock (MLSU)** · Phase P2 des [Machbarkeitspfads](../README.md#11-machbarkeitspfad)

*[🇩🇪 Deutsch](p2-metadaten-audit.md) · [🇬🇧 English](p2-metadata-audit.en.md)*

| | |
|---|---|
| **Status** | Checkliste — abzuarbeiten am gebauten PoC (P1, Meilenstein M3) |
| **Version** | 0.1 |
| **Vorgänger** | [Konzeptpapier §6.2/§6.3](../README.md#62-speichertrennung), [P1-PoC-Skizze](p1-poc-skizze.md) C5/M3, [P0-Befunde](p0-befunde.md) |
| **Ziel** | Jedes Metadaten-Leck ist eine Zeile mit **Prüfmethode** und **Prüfkriterium** — „abgehakt" heißt: am Gerät nachgewiesen, nicht vermutet |
| **Nicht-Ziel** | Die Forensik-Grenzen aus Konzept §9 (Wear-Leveling, ROM-Erkennung) sind hier als *bekannte, nicht behebbare Grenzen* gelistet — sie werden geprüft, um ihren Fehlschlag zu dokumentieren, nicht um sie zu „fixen" |

---

## 1. Was ist ein Metadaten-Leck?

Das Konzeptpapier unterscheidet zwei Schutzgüter (P0-Anforderungen G2/G3):

- **G2 — Existenz** des privaten Bereichs: Darf nicht nachweisbar sein.
- **G3 — Zuordnung** von Aktivität zu einem Bereich: Darf nicht rückschlüsseln
  lassen, *was* der Nutzer tut (auch ohne Inhalte offenzulegen).

Ein Metadaten-Leck ist jede Information außerhalb der verschlüsselten Inhalte,
aus der ein Prüfer G2 oder G3 verletzen kann. Die gefährlichsten Lecks liegen
nicht in den Nutzdaten, sondern in dem, was das System *drumherum* speichert
(Konzept §6.3).

Diese Checkliste ist der Fahrplan für das Audit: **Jede Zeile wird am
gebauten PoC ausgeführt**, nicht am Papier entschieden. Die P1-Skizze
(M3 „Unsicherheit") hakt genau diese Liste ab.

---

## 2. Prüfumgebung und Methodik

| Element | Festlegung |
|---|---|
| Gerät | AOSP-Emulator (M0-Basis) oder Pixel mit unlockbarem Bootloader |
| Zugriff | `adb shell` mit root (`adb root` auf Emulator/Test-Build) — ein Prüfer hat das **nicht**; das Audit prüft die *Oberfläche, die ein Prüfer sieht* |
| Drei Prüfklassen | **(a) UI-Sichtprüfung** — Screenshots aller Einstiege; **(b) Datei-/Speicher-Inspektion** — Verzeichnislisten, Größen, Inhalte; **(c) Verhaltensbeobachtung** — logcat, dumpsys, Zeitmessung |
| Protokoll | Ein Eintrag pro Zeile: Datum, Build, Gerät, Befehl, Befund, Status |
| Status | ✅ abgehakt (Kriterium erfüllt) · ⚠️ Abweichung (dokumentieren) · ❌ nicht erfüllt (Blockade für M3) · ⛔ bekannte Grenze (Fehlschlag erwartet, dokumentieren) |

---

## 3. Die Checkliste

### A — UI-Sichtbarkeit (Schutzgut G2)

| # | Leck | Warum gefährlich | Prüfmethode | PoC-Prüfkriterium (abgehakt = ok) | Status |
|---|---|---|---|---|---|
| A1 | **UserSwitcher / Launcher** zeigt zweiten User (Name, Icon, Avatar) | Existenz direkt sichtbar | Screenshots: Settings → System → Nutzer; Launcher-App-Drawer; „Nutzern wechseln"-UI | Zweiter User erscheint in **keiner** Liste, auch nicht als „Privater Bereich" | offen |
| A2 | **Einstellungen-Suche** findet zweiten Bereich | Suche verrät Existenz | `adb shell settings list global` + Suche nach Profilnamen/Bereichsbegriffen in der Settings-App | Keine Treffer für Bereichsnamen; keine Einstellungsseite erreichbar | offen |
| A3 | **„Über das Telefon" / Kontenliste / Speicherübersicht** | Existenz über Umwege | Screenshots + `adb shell dumpsys account` | Nur das aktive Profil sichtbar; keine Querverweise | offen |
| A4 | **Einstellungs-Eintrag „MLSU aktiviert"** | Feature-Werbebanner hebt Zweck auf (Konzept §8.3) | Sichtprüfung beider Profile | Eintrag **nur im privaten Profil** sichtbar; im Duress-Profil nichts | offen |
| A5 | **Sperrbildschirm-Unterschiede** (PIN-Länge, Aufforderungstext, „Zweiten Bereich entsperren"-Schaltfläche) | Abweichende UI verrät Mehrprofil-Betrieb (Konzept §5.1) | Screenshots beider Sperrzustände, Byte-Vergleich der Layouts | Beide Sperrbildschirme **identisch**, keine Profilzahl, kein zweiter Login-Pfad in der UI | offen |
| A6 | **Benachrichtigungen / Verlauf** des inaktiven Profils | Verlauf zeigt Aktivität des anderen Bereichs (G3) | Benachrichtigung im Profil B erzeugen, im Profil A in die Leiste schauen; `dumpsys notification` | Keine Benachrichtigung aus Profil B sichtbar; Verlauf getrennt (von Private Space geerbt, zu bestätigen) | offen |

### B — Datei- und Speicherebene (G2)

| # | Leck | Warum gefährlich | Prüfmethode | PoC-Prüfkriterium | Status |
|---|---|---|---|---|---|
| B1 | **DE-Speicher des zweiten Users** enthält Persönliches (App-Listen, Suchindizes, Vorschaubilder, Notification-Caches) | DE ist ab Boot lesbar → Existenz + Inhalte (Konzept §6.2) | `adb shell ls -laR /data/user_de/` (root), gezielt nach Caches/Indizes des Duress-Profils suchen | Nichts Persönliches in DE; nur systemnotwendige, profilneutrale Daten | offen |
| B2 | **Speicherbelegung** passt nicht zum sichtbaren Inhalt | Belegter, nicht zuordenbarer Platz verrät verborgene Daten (Konzept §6.3) | `adb shell df /data` vor/nach Profilwechsel; `du` je User-Verzeichnis | Belegungsänderungen durch MLSU bleiben unterhalb der Sichtbarkeitsschwelle oder sind plausibel normalisiert (Designentscheidung: Vorabreservierung) | offen |
| B3 | **MLSU-Konfiguration** (User-Verknüpfung, Status-Byte, Slot-Buchhaltung) im lesbaren Speicher | Verknüpfung selbst ist Beweis (P1 C7, Stufe-0-Befund Status-Byte) | `find /data -name '*mlsu*'` (root); Prüfung, ob die Verknüpfung nur im **entsperrten** privaten Profil liegt | Konfiguration ausschließlich im CE-Bereich des privaten Profils; im gesperrten Zustand nicht lesbar | offen |
| B4 | **vold-Key-Metadaten** (`/data/misc/vold/user_keys/ce/<userId>`) | Existenz eines zweiten CE-Keys verrät zweiten Bereich | `adb shell ls /data/misc/vold/user_keys/ce/` (root) | Befund dokumentieren: Anzahl der Key-Verzeichnisse. **Vermutlich nicht verhinderbar** — Key-Dateien müssen existieren. Gegenmaßnahme (falls nötig): gleiche Verzeichnisanzahl bei Nicht-MLSU-Geräten durch Dummy-Keys, oder Grenze akzeptieren | offen |
| B5 | **Backup-/Cloud-Metadaten** (ein Konto kennt beide Profile) | Hebt die Trennung auf (Konzept §6.3) | Nach Einrichtung beider Profile: Kontenliste je Profil prüfen, Backup-Inhalte durchspielen | Getrennte Sync-Identitäten je Profil; kein gemeinsamer Konteneintrag | offen |
| B6 | **FTL/Wear-Leveling-Reste** alter Blöcke | Physische Reste sind mit Forensik nachweisbar (Konzept §9.2) | — (erfordert Chip-off) | **⛔ bekannte Grenze:** nicht auf Anwendungsebene lösbar; im PoC dokumentieren, dass G2 gegenüber A5 nicht garantiert ist | ⛔ |

### C — Verhalten (G3)

| # | Leck | Warum gefährlich | Prüfmethode | PoC-Prüfkriterium | Status |
|---|---|---|---|---|---|
| C1 | **Zeitunterschied bei PIN-Auswertung** (Match Profil A / Profil B / Miss) | Zeitprofil verrät Zahl der Profile (SR-3) | bench-Rig aus der [Referenz](../reference/bench/timing.py) auf dem Gerät, interleaved (Befund F-4) | Keine Signatur oberhalb der Messschwelle; Messprotokoll liegt bei | offen |
| C2 | **Fehlversuchszähler / Wartezeiten** verhalten sich anders als erwartet | Zählerverhalten kann Existenz verraten (SR-4/F-1) | 1, 5, 10, 20 Fehlversuche → beobachtetes Verhalten mit [Modell](../reference/README.md) vergleichen | Verhalten deckt sich mit Modellvorhersage; dokumentierte Abweichungen sind **keine** stillen | offen |
| C3 | **Modem-/eSIM-Logs** (Verbindungshistorie, Roaming, IMSI-Wechsel) profilbezogen | Metadaten außerhalb des Profilkontexts (Konzept §6.3) | `adb logcat -b radio -d`, `dumpsys telephony.registry` nach Profilwechsel | Logs profilneutral oder getrennt; kein Rückschluss auf Profilwechsel | offen |
| C4 | **Bootzähler / Panic-Logs / Crash-Reports** | Wiederholter Wechsel hinterlässt Spuren | `adb shell getprop` (bootcount), `/sys/fs/pstore`, logcat nach Kaltstart | Boot- und Panic-Logs profilneutral; kein Wechsel-Indikator | offen |
| C5 | **Aktivitäts-Zeitstempel** („letzte Nutzung vor 6 Monaten" wirkt gestellt) | Unglaubwürdige Zeitstempel wecken Verdacht (Konzept §6.3) | Zeitstempel in beiden Profilen nach Benutzung prüfen | Aktivität im Duress-Profil plausibel (Setup-Flow legt Basisaktivität an, P1 C6) | offen |
| C6 | **Biometrie-Status** | Biometrie kann den Bereich nicht über „Wissen" wählen (Konzept §9.6) | Fingerabdruck/Gesicht in beiden Profilen einrichten und sperren | Biometrie im MLSU-Betrieb deaktiviert oder auf ein Profil beschränkt (Designentscheidung aus P1) | offen |

### D — Trennung der Systemdienste (G3)

| # | Leck | Warum gefährlich | Prüfmethode | PoC-Prüfkriterium | Status |
|---|---|---|---|---|---|
| D1 | **Zwischenablage / Media-Store / Kontenverwaltung** teilen sich über Profile | Aktionen im einen Bereich sind im anderen sichtbar | Text kopieren in Profil B → in Profil A einfügen; Media-Store-Listen vergleichen | Getrennte Zwischenablage, getrennte Media-Stores, getrennte Konten | offen |
| D2 | **Profilübergreifendes IPC / Dienste** | Ein Dienst beider Profile hebt Trennung auf (Konzept §6.2) | `dumpsys activity services`, `dumpsys package` auf gemeinsame Dienste prüfen | Kein gemeinsamer benutzerspezifischer Dienst zwischen den Profilen | offen |
| D3 | **ROM-Erkennung** (Build-Fingerprint, Systemapps verraten MLSU-fähiges ROM) | Grundsätzliche Grenze bei Open Source (Konzept §9.1) | `getprop ro.build.fingerprint`, Paketliste | **⛔ bekannte Grenze:** kein sauberer Ausweg zwischen Auditierbarkeit und Verborgenheit — dokumentieren, nicht verstecken | ⛔ |

---

## 4. Reihenfolge und Gewichtung

| Priorität | Zeilen | Begründung |
|---|---|---|
| **P0 — Blockade für M3** | A1–A6, B1, C1 | UI- und Zeit-Lecks sind das Kernversprechen; ohne sie ist der PoC wertlos |
| **P1 — wichtig** | B2–B5, C2, C5, D1, D2 | Erkennbar für A4 (Standardforensik); meist teilweise von Private Space geerbt |
| **P2 — nachrangig** | C3, C4 | Modem-/Boot-Logs brauchen Gerätezugriff und sind teils Herstellersache |
| **⛔ — Grenze** | B6, D3 | Nicht behebbar; werden geprüft, um den dokumentierten Fehlschlag zu belegen (Konzept §9) |

P0-Zeilen müssen vor M3-Freigabe ✅ sein. P1-Zeilen müssen dokumentiert sein
(auch als ⚠️ mit Gegenmaßnahme). ⛔-Zeilen brauchen nur den
Dokumentationsnachweis — **das Verschweigen wäre der eigentliche Fehler**
(Konzept §14).

---

## 5. Prüfprotokoll-Vorlage (je Zeile auszufüllen)

```
Leck:            A1 — UserSwitcher/Launcher zeigt zweiten User
Datum/Build:     2026-08-19 / mlsu-poc-m3-xxx / Pixel 8, AOSP 16
Befehl:          adb shell pm list users; Screenshots 01–04
Befund:          Nur „Hauptnutzer" und „Privater Bereich" (AOSP-Standard) —
                 Privater Bereich erscheint in der User-Liste (AOSP-Stockverhalten)
Prüfkriterium:   Zweiter User erscheint in keiner Liste
Status:          ⚠️ Abweichung — AOSP-Userliste zeigt PRIVATE-User;
                 Gegenmaßnahme: Filter im UserManager-Report (P1 C5) erforderlich
```

---

## 6. Was dieses Dokument nicht ist

Kein Sicherheitsnachweis, keine vollständige Forensik-Analyse und keine
Rechtsberatung. Ein „✅" in dieser Liste bedeutet: *dieser eine Prüfpunkt ist
am gebauten PoC bestätigt* — nicht, dass das System sicher ist. Die
übergreifenden Grenzen (A5-Spezialforensik, ROM-Erkennung) bleiben, wie in
Konzept §9 und P0 beschrieben, bestehen.

---

## Lizenz

[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/deed.de),
siehe [LICENSE](../LICENSE).
