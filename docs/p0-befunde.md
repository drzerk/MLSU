# P0 — Befunde aus der Referenzimplementierung

**Multi-Layer Secure Unlock (MLSU)** · Ergebnisse aus
[`reference/`](../reference/README.md)

| | |
|---|---|
| **Stand** | 2026-08-18 |
| **Grundlage** | Python-Modell der Auswahllogik, 19 Anforderungstests, Zeitmessrig |
| **Umgebung** | Python 3.11, argon2-cffi 25.1.0, cryptography 41.0.7, x86-64-Server |
| **Reichweite** | Modellebene. Keine Aussage über Android, Hardware oder Dateisystem |

Fünf Befunde, davon zwei mit direkter Rückwirkung auf die Anforderungen und
einer, der die Prüfmethode selbst betrifft.

---

## F-1 — Zielkonflikt: konstante Zeit gegen getrennte Fehlversuchszähler

**Beobachtung.** SR-3 verlangt, dass jede Entsperrung alle Slots durchrechnet.
Damit schlägt jeder Fehlversuch auf *alle* Slots durch. Der Test
`test_lockout_is_reachable_by_guessing_alone` zeigt die Folge: 31 geratene PINs
sperren auch das Profil, das der Ratende nie gesehen hat.

```
  nach   1 Fehlversuch:  Zähler [1, 1, 1, 1]
  nach  15 Fehlversuchen: Zähler [15, 15, 15, 15]
  nach  31 Fehlversuchen: Zähler [30, 30, 30, 30]  → gesperrt
```

**Warum das nicht wegzuprogrammieren ist.** Nur den Zähler des „gemeinten"
Profils zu erhöhen, ist unmöglich: ein Fehlversuch trägt keine Information
darüber, welches Profil gemeint war. Genau das ist ja der Sinn der Konstruktion.

**Bedeutung.** SR-4 („Fehlversuche in Profil B verändern das Sperrverhalten von
Profil A nicht") ist in dieser Formulierung nicht erfüllbar. Erfüllbar ist die
schwächere Fassung: *erfolgreiche* Entsperrungen eines Profils beeinflussen die
anderen Zähler nicht, *fehlgeschlagene* zwangsläufig schon.

Praktisch heißt das: Wer das Gerät in die Hand bekommt und PINs rät, kann den
privaten Bereich in Sperre oder — je nach Schwellwert — in die Löschung
treiben, ohne je von ihm gewusst zu haben. Für die Zielgruppe ist das ein
ernster Nebeneffekt, kein Detail.

**Konsequenz.**
- SR-4 umformulieren (siehe Abschnitt „Änderungen an P0" unten).
- Neue Frage an die Reviewer: Wie geht ein Weaver-basierter Entwurf damit um?
- Produktseitig zu klären: Was passiert am Schwellwert — Sperre oder Löschung?
  Eine Löschung als Reaktion auf fremdes Raten wäre ein Datenverlustrisiko, das
  die Zielgruppe kennen muss.

---

## F-2 — SR-2 ist in dieser Sprache nicht prüfbar

**Beobachtung.** „Nach dem Entsperren von Profil B existiert kein
Schlüsselmaterial von Profil A im RAM" lässt sich in CPython weder herstellen
noch widerlegen: unveränderliche `bytes` werden frei kopiert, freigegebener
Speicher wird nicht genullt, und ein Schlüssel, der einmal als `bytes` existiert
hat, ist nicht mehr löschbar.

**Konsequenz.** SR-2 ist keine Anforderung, die ein Modell abhaken kann — sie
entscheidet die Sprachwahl für P1. Eine Implementierung, die SR-2 ernst nimmt,
braucht kontrollierbaren Speicher (Rust mit `zeroize`, oder C). Das gehört in
die Entscheidungsliste vor P1.

---

## F-3 — Die Tag-Prüfung ist ein datenabhängiger Zweig

**Beobachtung.** Im Modell liefert die AEAD-Entschlüsselung ihr Ergebnis über
eine Ausnahme (`InvalidTag`). Eine Ausnahme ist ein Kontrollfluss, der vom
Geheimnis abhängt — genau das, was SR-3 verbietet.

**Konsequenz.** Für die reale Implementierung ist verbindlich: die
Authentizitätsprüfung muss ein Flag in konstanter Zeit liefern, keinen
Ausnahmepfad. Das ist eine Anforderung an die verwendete Krypto-Bibliothek und
gehört als Auswahlkriterium in P1.

---

## F-4 — Das Messrig hat zuerst ein Scheinsignal produziert

**Beobachtung.** Die erste Fassung des Zeitmessrigs verglich Messreihen aus
*getrennten* Läufen und meldete für „2 Profile gegen 1 Profil" ein `t = +9,39`
— deutlich über der Schwelle von 4,5, also scheinbar ein Leck. Nach Umbau auf
eine gemeinsame, pro Runde zufällig verschränkte Messung verschwand der Effekt
vollständig (`t = +1,08` bei 300 Runden).

Der gemessene Unterschied war Taktdrift und Cache-Zustand zwischen zwei
Messläufen, nicht Eigenschaft des Systems.

**Konsequenz.** Das Prüfkriterium von SR-3 muss die Methode vorschreiben, nicht
nur das Ergebnis: verschränkte Messung aller Klassen in einer Sitzung,
zufällige Reihenfolge je Runde. Sonst produziert der Test entweder
Scheinsignale oder — schlimmer — übersieht echte, weil jemand die Methode
ändert, bis das Ergebnis passt.

Nebenbei: dass das Rig selbst in die Sperre aus F-1 lief (nach 30 Fehlversuchen
kehrte jede Messung sofort zurück und maß den Sperrpfad statt der Ableitung),
war der zweite Methodenfehler in derselben Datei. Beide sind im Code
dokumentiert.

---

## F-5 — Die Entsperrdauer skaliert linear mit der Slot-Anzahl

**Messung**, 4 Slots, Argon2id(t=3, m=64 MiB, p=1), also die Parameter aus dem
Konzeptpapier:

| Klasse | Mittel | Median | Minimum |
|---|---|---|---|
| Treffer Profil 1 | 705 ms | 699 ms | 665 ms |
| Treffer Profil 2 | 711 ms | 699 ms | 678 ms |
| Fehlschlag | 707 ms | 701 ms | 674 ms |

Rund **700 ms auf einer Server-CPU**; auf einem Telefon ist mit deutlich mehr zu
rechnen. Der Grund ist strukturell: Um die Profilanzahl zu verbergen, müssen
alle Slots gerechnet werden — die Kosten sind `SLOT_COUNT × KDF`.

**Konsequenz.** Reserve-Slots „auf Vorrat" sind teuer erkauft. `SLOT_COUNT`
sollte exakt der maximal unterstützten Profilanzahl entsprechen, nicht größer
sein; für zwei Profile halbiert das die Wartezeit. Das stützt Entscheidung D2
(zunächst genau zwei Profile) mit einer Zahl statt mit einem Bauchgefühl.

Offen bleibt, ob die KDF-Parameter auf Mobilhardware überhaupt haltbar sind. Das
ist eine Messung auf einem echten Gerät, kein Modellergebnis.

---

## Was das Modell bestätigt hat

Nicht alles war ein Problem:

- **SR-1** — unabhängige Profilschlüssel, kein Master-Secret: im Modell sauber
  umsetzbar.
- **SR-3, Kernfall** — welches Profil getroffen wurde und ob überhaupt eines
  getroffen wurde, ist in der Laufzeit nicht sichtbar (`t = +1,09` bzw.
  `t = −0,44` bei 300 Runden, Schwelle 4,5).
- **SR-8/SR-9, Modellebene** — belegte und leere Slots sind in Größe und Form
  identisch; die Anzahl eingerichteter Profile war in der Laufzeit nicht
  messbar.
- **FR-1** — die PIN allein wählt den Bereich; das ist die Eigenschaft, die
  MLSU von Private Space und Work Profile unterscheidet, und sie funktioniert.

Das ist kein Sicherheitsnachweis. Es heißt: an dieser Stelle steht dem Bau
eines echten Prototyps nichts Grundsätzliches im Weg — die offenen Risiken
liegen woanders, nämlich in Speicherforensik und Metadaten.

---

## Änderungen an P0

Aus den Befunden folgen konkrete Änderungen am
[Anforderungsdokument](p0-anforderungen.md):

| # | Änderung | Grund |
|---|---|---|
| 1 | SR-4 neu fassen: nur erfolgreiche Entsperrungen dürfen fremde Zähler unberührt lassen | F-1 |
| 2 | Prüfkriterium von SR-3 um die Messmethode ergänzen (verschränkt, zufällige Reihenfolge) | F-4 |
| 3 | Neue Entscheidung D6: Implementierungssprache mit kontrollierbarem Speicher für P1 | F-2 |
| 4 | Neue Anforderung SR-12: Authentizitätsprüfung liefert ein Flag in konstanter Zeit, keinen Ausnahmepfad | F-3 |
| 5 | D2 präzisieren: `SLOT_COUNT` = maximale Profilanzahl, keine Reserve-Slots | F-5 |
| 6 | Neue Produktfrage: Verhalten am Fehlversuchs-Schwellwert (Sperre oder Löschung) | F-1 |

Diese Änderungen sind im Anforderungsdokument eingearbeitet.

---

## Lizenz

Dieses Dokument steht unter
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/deed.de).
Siehe [LICENSE](../LICENSE).
