# ct_core — Konstantzeit-Kern in C

Die zweigfreie Auswahllogik aus [`mlsu/ct.py`](../mlsu/ct.py) als echte
C-Implementierung. `ct.py` stellt nur die *Form* der Auswahl richtig (Python
kann keine echte Konstantzeit garantieren); dieses Verzeichnis ist die
**Spezifikation in C**, die später in den AOSP-Pfad wandern kann
(vold/keystore-Stack, siehe [P1-Skizze](../../docs/p1-poc-skizze.md), C1/C2
und Befund F-3).

*[🇩🇪 Deutsch](README.md)*

## Was drin ist

| Datei | Inhalt |
|---|---|
| `mlsu_ct.h` | Öffentliche API — dokumentiert die Konstantzeit-Anforderungen pro Funktion |
| `mlsu_ct.c` | Implementierung: nur Arithmetik, keine bedingten Sprünge auf geheime Daten |
| `test_mlsu_ct.c` | Unit-Tests (Spiegel der Python-Tests in `tests/test_keystore.py`) |
| `mlsu_ct_cli.c` | Kleines CLI für den Crosscheck gegen die Python-Referenz |
| `crosscheck.py` | 400 Zufallsvektor-Runden × 5 Operationen gegen `mlsu.ct` |
| `Makefile` | `make check` baut, testet und cross-checkt |

## API

```c
uint8_t mlsu_mask_from_flag(uint8_t flag);          /* odd -> 0xFF, even -> 0x00 */
void    mlsu_select(uint8_t mask, const uint8_t *a, const uint8_t *b,
                    uint8_t *out, size_t len);      /* out = (a&m) | (b&~m) */
uint8_t mlsu_compare(const uint8_t *a, const uint8_t *b, size_t len);
                                                    /* equal -> 0xFF, else 0x00 */
uint8_t mlsu_fold_select(const uint8_t *flags, const uint8_t *values,
                         size_t width, size_t count, uint8_t *out);
                                                    /* letzter geflagter Kandidat gewinnt */
void    mlsu_wipe(uint8_t *buf, size_t len);        /* Nullen schreiben */
```

`mlsu_compare` ist die Ergänzung zu Befund F-3: Die Python-Referenz gewinnt
ihr Match-Flag aus einer Ausnahme (`InvalidTag`) statt aus einem
konstantzeit-Tag-Vergleich. `mlsu_compare` liefert das Flag (0xFF/0x00)
zweigfrei — genau das, was der AEAD-Unwrap im SP-Manager braucht.

## Bauen und testen

```bash
make check        # baut CLI + Tests, führt C-Tests aus, cross-checkt gegen Python
make test         # nur die C-Unit-Tests
make clean
```

Erwartete Ausgabe: `All ct_core C tests passed.` und
`crosscheck: 400 Runden x 5 Operationen gegen Python-Referenz — alle identisch.`

## Was dieses Verzeichnis kann — und was nicht

**Kann:** Die Auswahl-Logik zweigfrei in C ausdrücken, mit Tests gegen die
Python-Spezifikation abgesichert. Der Assembler-Check (`objdump`) bestätigt
für `mask_from_flag` null bedingte Sprünge; die übrigen Funktionen enthalten
nur Schleifen-Sprünge über die **öffentliche** Länge, keine
datenabhängigen Verzweigungen.

**Kann nicht:**

- **Keine Garantie.** Ein C-Compiler darf transformieren (Vectorisierung,
  Verzweigungen aus `?:`). Die Konstantzeit-Eigenschaft muss im konkreten
  Build per Assembler-Review bestätigt werden — dieser Code ist die
  *Absicht*, nicht der Beweis.
- **Kein kryptografischer Kern.** Hier liegt keine Schlüsselableitung, kein
  AEAD — nur die Auswahl zwischen bereits entschlüsselten Kandidaten.
- **Kein Rust.** Die Rust-Portierung (z. B. für `keystore2`, das in AOSP in
  Rust geschrieben ist) steht als Folgeaufgabe aus, sobald eine Toolchain
  verfügbar ist — die C-API ist 1:1 übertragbar.

## Einordnung

`ct.py` bleibt die maßgebliche Referenz für Verhalten; `ct_core` ist die
Umsetzung für echte Systeme. Wer den C-Code ändert, muss `make check` grün
halten — der Crosscheck gegen die Python-Referenz ist der Drift-Schutz.

## Lizenz

[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/deed.de),
siehe [LICENSE](../../LICENSE).
