# Referenzimplementierung — Modell der Auswahllogik

Ein lauffähiges Modell des Kernmechanismus aus dem
[Konzeptpapier](../README.md): **eine PIN, mehrere verschlüsselte Bereiche,
höchstens einer geht auf.**

Das ist kein Android-Code und nichts zum Benutzen. Es ist ein Modell zum
Kaputtmachen — gebaut, damit falsche Annahmen in 400 Zeilen Python auffallen
und nicht erst in einem Patch am Sperrbildschirm.

*🇩🇪 Deutsch · [🇬🇧 English](README.en.md)*

---

## Ausführen

```bash
pip install -r requirements.txt

python3 demo.py                              # Mechanismus einmal durchspielen
python3 -m unittest discover -s tests -v     # 19 Anforderungstests
python3 bench/timing.py --samples 300        # Zeitmessung (SR-3, SR-9)
python3 bench/timing.py --samples 12 --kdf strong   # mit den Konzeptparametern
```

## Was modelliert wird

| Datei | Inhalt |
|---|---|
| `mlsu/params.py` | Kostenparameter, Slot-Anzahl — jedes Experiment nennt, womit es lief |
| `mlsu/keystore.py` | Schlüsselableitung, Slots, Entsperrung; der eigentliche Mechanismus |
| `mlsu/counters.py` | Modell der Hardware-Ratenbegrenzung (Weaver) |
| `mlsu/ct.py` | Zweigfreie Auswahl zwischen den Kandidaten |
| `tests/` | Ein Test je Anforderung aus [P0](../docs/p0-anforderungen.md) |
| `bench/timing.py` | Messrig für SR-3 und SR-9 |

Der Aufbau folgt Abschnitt 6.1 des Konzeptpapiers:

```
PIN_i --Argon2id--> pin_key_i --AEAD-unwrap--> profile_key_i
```

Zwei Eigenschaften, die den Unterschied zu „zwei Profile nebeneinander" machen:

1. **Feste Slot-Anzahl.** Der Speicher hält immer `SLOT_COUNT` Slots. Nicht
   belegte Slots enthalten Zufallsdaten, die keine PIN öffnet, und sind von
   belegten nicht zu unterscheiden. Entsperren rechnet immer alle Slots durch.
2. **Kein Master-Schlüssel.** Jeder Profilschlüssel wird unabhängig erzeugt.
   Wer eine PIN kennt, lernt nichts über die anderen Bereiche.

## Was dieses Modell nicht kann

- **Keine Aussage zu SR-2** (kein Schlüsselmaterial anderer Profile im RAM).
  CPython kopiert unveränderliche `bytes` frei und nullt nichts. Diese
  Anforderung ist hier nicht prüfbar — auch nicht negativ. Siehe Befund F-2.
- **Keine echte Konstantzeit.** Der Interpreter allokiert, die GC läuft,
  Zahlen sind Objekte. `mlsu/ct.py` stellt die *Form* der Auswahl richtig, mehr
  nicht.
- **Keine Aussage über echte Hardware.** Gemessen wird ein Python-Modell auf
  einer geteilten Maschine. Ein negatives Messergebnis ist eine
  Plausibilitätsprüfung, kein Nachweis.
- **Keine Speicher-, Metadaten- oder Dateisystemebene.** Das ist der
  schwierigere Teil des Konzepts und hier gar nicht abgebildet.

Kurz: Das Modell kann zeigen, dass etwas **nicht** funktioniert. Es kann nicht
zeigen, dass etwas sicher ist.

## Ergebnisse

Fünf Befunde sind bei der Arbeit an diesem Modell entstanden, darunter ein
Zielkonflikt zwischen zwei Anforderungen und ein Messfehler im eigenen Rig:
[docs/p0-befunde.md](../docs/p0-befunde.md).

## Lizenz

[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/deed.de),
siehe [LICENSE](../LICENSE).
