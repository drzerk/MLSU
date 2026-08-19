# Referenzimplementierung — Modell der Auswahllogik

Ein lauffähiges Modell des Kernmechanismus aus dem
[Konzeptpapier](../README.md): **eine PIN, mehrere verschlüsselte Bereiche,
höchstens einer geht auf.**

Das ist kein Android-Code und nichts für ein echtes Gerät. Es ist ein Modell
zum Kaputtmachen — gebaut, damit falsche Annahmen in Python auffallen und
nicht erst in einem Patch am Sperrbildschirm. Seit dem Ausbau zur Stufe-0-Variante
gibt es zusätzlich eine persistente Store-Datei und eine Kommandozeile
(`mlsu-cli`) zum Experimentieren mit dem Mechanismus.

*🇩🇪 Deutsch · [🇬🇧 English](README.en.md)*

---

## Ausführen

```bash
pip install -r requirements.txt

python3 demo.py                              # Mechanismus einmal durchspielen
python3 -m unittest discover -s tests -v     # 83 Tests (19 Anforderungen + 64 Persistenz/CLI/Lifecycle)
python3 bench/timing.py --samples 300        # Zeitmessung (SR-3, SR-9)
python3 bench/timing.py --samples 12 --kdf strong   # mit den Konzeptparametern
python3 simulate_duress.py                   # Duress-Szenario einmal durchspielen

python3 -m mlsu --store demo.store init             # CLI: Store anlegen
python3 -m mlsu --store demo.store enroll 471903 1  # Profil 1 einrichten
python3 -m mlsu --store demo.store enroll 220561 2  # Profil 2 einrichten
python3 -m mlsu --store demo.store unlock 471903    # PIN prüfen
python3 -m mlsu --store demo.store change-pin 471903 123456  # PIN ändern
python3 -m mlsu --store demo.store remove 471903    # Profil löschen (Slot wird decoy)
python3 -m mlsu --store demo.store lock             # sperren (Modell: kein gehaltener Zustand)
python3 -m mlsu --store demo.store status           # Status (ohne Profilzahl)

make -C ct_core check                # C-Kern: bauen, Unit-Tests, Crosscheck gegen Python
```

## Was modelliert wird

| Datei | Inhalt |
|---|---|
| `mlsu/params.py` | Kostenparameter, Slot-Anzahl — jedes Experiment nennt, womit es lief |
| `mlsu/keystore.py` | Schlüsselableitung, Slots, Entsperrung; der eigentliche Mechanismus |
| `mlsu/counters.py` | Modell der Hardware-Ratenbegrenzung (Weaver, mit Throttle-Zeitstempeln) |
| `mlsu/ct.py` | Zweigfreie Auswahl zwischen den Kandidaten |
| `mlsu/storage.py` | Persistente Store-Datei: festes Binärformat, atomare Writes, Validierung |
| `mlsu/cli.py` | `mlsu-cli` — Einrichten, Entsperren, Status; Exit-Codes für Skripte |
| `ct_core/` | Konstantzeit-Kern in C: zweigfreie Auswahl als Spezifikation für den AOSP-Pfad |
| `tests/` | Ein Test je Anforderung aus [P0](../docs/p0-anforderungen.md) plus Persistenz- und CLI-Tests |
| `bench/timing.py` | Messrig für SR-3 und SR-9 |

## Persistenz und CLI (Stufe-0-Ausbau)

Seit dem Stufe-0-Ausbau überlebt der Store Neustarts: Slots, Fehlversuchszähler
und Throttle-Zeitstempel liegen in **einer Datei fester Größe**. Die Größe
ändert sich beim Einrichten eines Profils nicht — auch auf der Platte bleibt
die Profilanzahl aus der Dateigröße nicht ablesbar (SR-8).

Der Ablauf je CLI-Aufruf: Store laden → Ratenbegrenzung prüfen → Operation
ausführen → atomar zurückschreiben (`tempfile` + `fsync` + `rename`, kein
halbgeschriebener Store nach einem Absturz).

**Exit-Codes** (für Skripte):

| Code | Bedeutung |
|---|---|
| 0 | Erfolg (Store angelegt, Profil eingerichtet, PIN entsperrt) |
| 1 | Falsche PIN — kein Profil entspricht der Eingabe |
| 2 | Dauerhafte Sperre nach zu vielen Fehlversuchen |
| 3 | Gedrosselt — die Ratenbegrenzung verweigert den Versuch vorerst |
| 4 | Store-Fehler (fehlt, korrupt, unbekanntes Format) |
| 5 | Bedienungsfehler (Argumente, voller Store, PIN zu kurz) |

Die Ratenbegrenzung wird in der CLI **vor** jeder Ableitung durchgesetzt — ein
gedrosselter Versuch lädt die Zähler nicht weiter (wie Weaver-Hardware, die
den Versuch gar nicht erst annimmt). Deshalb erreicht eine Burst von
Fehlversuchen die Dauersperre nur über die Wartezeiten (30 s → 300 s → 1 h),
nicht in einer Testschleife; die Tests erzeugen die Sperre deshalb über die
API. Was dabei sichtbar wird, ist F-1 in Aktion: Auch die **Decoy-Slots und
das versteckte Profil** sammeln Fehlversuche und werden gedrosselt.

### Lebenszyklus: PIN ändern, Profil löschen, sperren

- **`change-pin <alte> <neue>`** — verlangt die aktuelle PIN, erzeugt für
  denselben Slot neue Salt/Nonce/Blob. Der **Profilschlüssel bleibt
  derselbe** (wie beim Android-Synthetic-Password: die SP bleibt, nur der
  Protector wechselt) — sonst müssten alle Daten neu verschlüsselt werden.
- **`remove <pin>`** — verlangt die PIN des Profils und macht den Slot wieder
  zu einem Decoy. Der Profilschlüssel ist damit weg; ohne Neu-Einrichtung
  gibt es kein Zurück. Die Dateigröße ändert sich nicht (fester Dateiumfang).
- **`lock`** — das Modell hält keinen Entsperr-Zustand zwischen Aufrufen;
  der Befehl dokumentiert, dass auf einem Gerät hier der CE-Schlüssel des
  aktiven Profils verworfen würde (SR-2).

Beide PIN-abhängigen Befehle unterliegen derselben Ratenbegrenzung wie
`unlock` (gedrosselt → Exit 3, keine Ableitung).

### Duress-Szenario

`simulate_duress.py` spielt die Kernsituation aus dem Konzept einmal durch:
falsche PIN unter Druck → der eingeschränkte Bereich öffnet sich, der private
existiert aus Sicht des Prüfers nicht; später zurück ins private Profil über
den identischen Sperrbildschirm — **ohne sichtbaren Hinweis** (Konzept §8.2).
Das Skript zeigt auch, was ein Beobachter messen kann (feste Dateigröße,
Zähler-F-1, Konstantzeit-Anspruch) und nennt die Grenzen (Konzept §9).

### Bekannte Abweichung: der Status-Byte (SR-8)

Die Store-Datei enthält pro Slot ein Status-Byte (0 = decoy, 1 = belegt).
Ohne dieses Byte wüsste ein frischer Prozess nicht, welcher Slot frei ist —
und die CLI müsste das Einrichten eines neuen Profils nach einem Neustart
verweigern. Ein Prüfer kann damit aus der Datei ablesen, *wie viele* Profile
eingerichtet sind. Das ist eine **dokumentierte Abweichung** vom Idealbild
von SR-8, kein versteckter Defekt: Ein echtes MLSU muss diese Buchhaltung
aus dem lesbaren Speicher heraushalten (z. B. nur im bereits entsperrten
privaten Profil führen) oder die Lesbarkeit der Profilanzahl akzeptieren.
Die Slots selbst bleiben ununterscheidbar — gleiche Größe, gleiche Form,
Decoys öffnen keine PIN (das prüfen die SR-8-Tests). `status --verbose`
warnt beim Anzeigen der Slot-Tabelle ausdrücklich davor, dass diese
Metadaten in einem Produkt nicht sichtbar sein dürfen.

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
- **Keine echte Dateisystem- oder Metadatenebene.** Die Persistenzschicht
  speichert Slots und Zähler als eine Datei. Das ist ein Modell des
  Entsperrmechanismus, nicht des Android-Dateisystems (FBE, Partitionen,
  Flash-Wear-Leveling) und macht keine Aussage zu den Metadaten-Lecks aus
  Abschnitt 6.3 des Konzeptpapiers.

Kurz: Das Modell kann zeigen, dass etwas **nicht** funktioniert. Es kann nicht
zeigen, dass etwas sicher ist.

## Ergebnisse

Fünf Befunde sind bei der Arbeit an diesem Modell entstanden, darunter ein
Zielkonflikt zwischen zwei Anforderungen und ein Messfehler im eigenen Rig:
[docs/p0-befunde.md](../docs/p0-befunde.md).

## Lizenz

[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/deed.de),
siehe [LICENSE](../LICENSE).
