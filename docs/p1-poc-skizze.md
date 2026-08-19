# P1 — PoC-Skizze: Änderungspunkte in AOSP

**Multi-Layer Secure Unlock (MLSU)** · Phase P1 des [Machbarkeitspfads](../README.md#11-machbarkeitspfad)

*[🇩🇪 Deutsch](p1-poc-skizze.md) · [🇬🇧 English](p1-poc-sketch.en.md)*

| | |
|---|---|
| **Status** | Skizze — Code-Gerüst, kein Patch, nichts zu flashen |
| **Version** | 0.2 |
| **Vorgänger** | [P0-Anforderungen](p0-anforderungen.md), [P0-Befunde](p0-befunde.md), [Konzeptpapier](../README.md) |
| **Ergänzung** | [P1-Verifikation](p1-verifikation.md) — die U/O-Markierungen dieses Dokuments gegen den AOSP-Quellcode geprüft (Stand 2026-08-19); Korrekturen daraus sind eingearbeitet |
| **Ziel** | Ein ROM-Projekt (GrapheneOS, CalyxOS, eigener AOSP-Fork) kann diesen Fahrplan direkt übernehmen |
| **Grundlage** | AOSP `master` / Android 15+ (Private Space), Stand 2026-08 |

---

## 1. Zweck und Methodik

Dieses Dokument übersetzt das Konzept in konkrete Änderungspunkte am Android-Quellcode.
Es ist ein **Fahrplan mit Code-Gerüsten**, keine Implementierung: Die Skizzen zeigen,
*wo* und *wie* der Eingriff aussieht, und markieren ehrlich, was vor dem Bau noch
verifiziert werden muss.

Status-Konvention wie in [P0](p0-anforderungen.md#2-methodik-und-verifikationsstatus):

| Status | Bedeutung |
|---|---|
| **V** | Im AOSP-Quellcode oder in der offiziellen API-Doku nachgelesen (Fundstelle im Text) |
| **U** | Plausibel aus Modell- bzw. Erfahrungswissen — **vor P1 zu prüfen** |
| **O** | Offen — widersprüchliche oder fehlende Information, Designentscheidung nötig |

---

## 2. Strategische Erkenntnis: Private Space ist das Fundament

Android 15 hat mit **Private Space** einen großen Teil der MLSU-Infrastruktur bereits
nach AOSP gebracht. Fakten (V):

- Neuer User-Typ `android.os.usertype.profile.PRIVATE` (API 35) — ein
  **eigenständiger User im Multi-User-Modell** mit eigenem credential-encrypted
  Storage (CE) und eigenem Sperrgeheimnis [1][2].
- Versteckbarkeit ist vorgesehen: Launcher-Apps brauchen `ACCESS_HIDDEN_PROFILES`
  und bekommen Broadcasts `ACTION_PROFILE_AVAILABLE`/`ACTION_PROFILE_UNAVAILABLE` [1].
- Gesperrt wird der Private Space über `UserManager.requestQuietModeEnabled`; das
  Profil ist dann pausiert, Apps inaktiv [1][2].
- Die CE-/DE-Trennung pro User ist seit Android 7 Standard (V): vold verwaltet je
  User Schlüssel unter `/data/misc/vold/user_keys/{de,ce}/<userId>`, entsperrt mit
  `vdc cryptfs unlock_user_key <id> <serial> <token> <secret>` [3][4].

**Was das für MLSU bedeutet:** Das Konzeptpapier (Abschnitt 7) beschrieb den Eingriff
als Umbau von `LockSettingsService`, `vold`, `keystore2` und SystemUI. Mit Private
Space verschiebt sich das zu einem **deutlich kleineren, klar abgegrenzten Kern:**

> MLSU = PIN-Routing in `LockSettingsService` + „der zweite User bleibt unsichtbar".

Alles andere — zwei CE-Bereiche, eigene Locks, eigene Keystore-Namespaces,
App-Trennung, Hidden-Profile-Mechanik — existiert bereits und wird **geerbt**.

Zwei Verifikationsergebnisse stützen und schärfen diese Aussage
([p1-verifikation.md](p1-verifikation.md), Stand 2026-08-19):

- **AOSP hat bereits einen „eine Eingabe, zwei Profile"-Pfad** (V): den *Unified
  Lock*. `LockSettingsService` kann ein Profil mit einem Credential entsperren,
  das aus dem Synthetic Password des Eltern-Users abgeleitet ist
  (`getDecryptedPasswordForUnifiedProfile`, „Unlock profile with unified lock").
  Er ist anders gebaut als MLSU — abgeleitet statt geroutet, alles-oder-nichts
  statt genau-eines, Profil bleibt sichtbar — bestätigt aber: Der Eingriff ist
  ein Routing- und Unsichtbarkeitsproblem, kein neues Kryptografieproblem. Zugleich
  gilt die Vorsichtsregel aus Konzept 9.5 doppelt: Der Unified-Lock-Pfad muss bei
  deaktiviertem MLSU unverändert funktionieren, und das Routing darf nicht
  versehentlich in ihn hineinlaufen (siehe 4.1).
- **Die Weaver-HAL bestätigt das Zähler-Modell** (V): Slots sind ein Array
  `[0, getConfig().slots)`, Drosselung ist **pro Slot**, ein `write` macht den
  alten Slot-Inhalt unwiederbringlich (`IWeaver.aidl`). Das Referenzmodell
  (`counters.py`) bildet diese Semantik korrekt ab; die Slot-Anzahl ist eine
  Gerätekonstante, die M4 über `getConfig().slots` misst (siehe 8.2).

Der Unterschied zu Private Space bleibt der Kern des Konzepts:

| | Private Space | MLSU |
|---|---|---|
| Auswahl des Bereichs | separates UI („Privaten Bereich anzeigen", eigene PIN-Eingabe) | **eine einzige PIN-Eingabe am identischen Sperrbildschirm** |
| Existenz des zweiten Bereichs | erkennbar (User-Typ, Launcher-API, Einstellungen) | kein UI-Hinweis irgendwo |
| Fehlversuchszähler | pro Profil getrennt, aber nur das angefragte Profil wird geprüft | alle Profile werden **immer** geprüft (SR-3), Zähler je Profil (SR-4) |

---

## 3. Zielarchitektur des PoC

```
        ┌────────────────────────────────────────────────┐
        │ SystemUI Keyguard (UNVERÄNDERT, identisch)     │
        │   eine PIN-Eingabe, keine Profilzahl, keine    │
        │   Biometrie (Konzept 9.6)                      │
        └───────────────────────┬────────────────────────┘
                                │ PIN
                                ▼
        ┌────────────────────────────────────────────────┐
        │ LockSettingsService  ← MLSU-Routing (NEU)      │
        │   doVerifyCredential prüft gegen ALLE          │
        │   verknüpften Profile, immer, ohne frühe       │
        │   Rückkehr (SR-3)                              │
        └───────────┬──────────────────┬─────────────────┘
                    │                  │
         unlockLskfBasedProtector      │ (kein Match → Fehlversuch
         je Profil (bestehend)         │  wird ALLEN Profilen
         └─ Gatekeeper/Weaver          │  angelastet, SR-4/F-1)
            je Profil ein Slot (SR-4)  │
                    ▼                  ▼
        ┌────────────────────────────────────────────────┐
        │ genau ein Match:  StorageManager.unlockUser(id)│
        │   vold: unlock_user_key → CE-Schlüssel des     │
        │   gematchten Profils im RAM, anderes Profil    │
        │   bleibt gesperrt (SR-2)                       │
        └────────────────────────────────────────────────┘
                    │
                    ▼
        UserManager/AMS: gematchter User wird aktiv;
        anderer User in allen UIs unsichtbar (NEU, Filter)
```

Grundsatz aus dem Konzeptpapier (5.): **Ein einziger, unveränderter
Sperrbildschirm.** Das MLSU-Routing findet unterhalb der UI statt — Keyguard
weiß nicht, dass es zwei Profile gibt.

---

## 4. Komponenten im Detail

### 4.1 C1 — LockSettingsService: das MLSU-Routing (der Kern)

**Ist-Zustand (V):** `LockSettingsService.doVerifyCredential(...)` ruft für den
übergebenen `userId` `SyntheticPasswordManager.unlockLskfBasedProtector()` auf;
bei Erfolg folgt `onCredentialVerified` → CE-Entsperrung des Users. Verifiziert
wird also genau **ein** Profil — das aktive [5][6][8]. Daneben existiert der
**Unified-Lock-Pfad** [8]: Für Profile mit abgeleiteter Sperre entsperrt
`doVerifyCredential` zuerst den Eltern-User („Unlock parent by using parent's
challenge") und prüft das Profil danach mit dem abgeleiteten Credential
(„Unlock profile with unified lock"). Beide Pfade sind für MLSU relevant: Der
erste wird durch das Routing ersetzt, der zweite muss unangetastet bleiben
(Konzept 9.5).

**Soll:** Die Eingabe wird gegen die Protectors **aller MLSU-verknüpften Profile**
geprüft. Struktureller Zwang:

1. **Keine frühe Rückkehr** (SR-3): Die Schleife läuft immer über alle Profile,
   egal ob ein früheres gematcht hat. Das ist die Konstantzeit-Forderung des
   Konzepts — auf Binder-/HAL-Ebene bleibt das eine offene Frage (Konzept 12.1,
   siehe Abschnitt 8).
2. **Fehlversuche treffen alle Profile** (SR-4, F-1): Wenn nichts matcht, werden
   die Fehlversuchszähler aller geprüften Weaver-/Gatekeeper-Slots erhöht — genau
   wie im [Referenzmodell](../reference/README.md). Der Anwender sperrt damit auch
   sein verstecktes Profil, wenn jemand rät — gewollt, ehrlich dokumentiert (F-1).
3. **Ein Match ⇒ genau eines:** Die Profile haben unabhängige Schlüssel (SR-1),
   daher kann höchstens einer matchen. Das Ergebnis bestimmt, welcher User
   entsperrt wird — ohne dass die UI die Wahl sieht.

**Gerüst (Java, Skizze):**

```java
// LockSettingsService — Skizze des MLSU-Routings (nur der neue Pfad)
// Signatur und Aufrufkonvention gegen AOSP verifiziert (p1-verifikation.md V1/V2,
// Stand 2026-08-19): unlockLskfBasedProtector(gatekeeper, protectorId,
// credential, userId, challenge). Die Protector-ID kommt je User aus
// getCurrentLskfBasedProtectorId(userId); die restlichen Parameter (challenge,
// aufrufender User) übernimmt der echte Pfad aus doVerifyCredential.
public @NonNull VerifyCredentialResponse doVerifyCredentialForMlsu(
        @NonNull LockscreenCredential credential, int callingUserId) {

    // MLSU-Konfiguration: welche User sind verknüpft? (nur im privaten Profil
    // hinterlegt, siehe 4.7 — kein Eintrag im sichtbaren DE-Speicher)
    final int[] mlsuUsers = mlsuConfig.getLinkedUsers();          // z. B. [10, 11]

    int matchedUser = UserHandle.USER_NULL;
    SyntheticPassword matchedSp = null;

    // SR-3: IMMER alle Profile durchrechnen — keine frühe Rückkehr.
    for (int userId : mlsuUsers) {
        AuthenticationResult result = mSpManager.unlockLskfBasedProtector(
                mGatekeeper, getCurrentLskfBasedProtectorId(userId), credential,
                userId, /* challenge */ null);
        // KEIN break, KEIN if-early-return: Schleife läuft komplett.
        if (result.syntheticPassword != null) {
            matchedUser = userId;
            matchedSp = result.syntheticPassword;
        }
    }

    if (matchedUser == UserHandle.USER_NULL) {
        // Fehlversuch wurde bereits jedem Protector angelastet (SR-4/F-1).
        return VerifyCredentialResponse.ERROR;
    }

    // CE des gematchten Profils entsperren — anderes Profil bleibt gesperrt
    // und sein CE-Schlüssel wird beim Sperren aus dem Kernel-Keyring entfernt
    // (SR-2, Kernel-Anteil verifiziert: KeyUtil.evictKey → FS_IOC_REMOVE_
    // ENCRYPTION_KEY; Userspace-Kopien bleiben M4-Messung, siehe 4.3).
    mStorageManager.unlockUser(matchedUser, /* token */ null, matchedSp.deriveKeyStorePassword());
    // Interner Profilwechsel: AMS macht matchedUser aktiv; Keyguard ändert sich NICHT.
    return VerifyCredentialResponse.OK;
}
```

> **Einordnung:** Das Gerüst zeigt die *Form* des Eingriffs. Die echte
> Implementierung muss den bestehenden `doVerifyCredential`-Pfad (Challenge,
> `onCredentialVerified`, StrongAuth, Biometrie-Deferred-Queue) sauber
> weiterverwenden statt zu duplizieren — sonst entstehen zwei Pfade, die
> auseinanderlaufen (Konzept 9.5: Angriffsfläche wächst).

### 4.2 C2 — SyntheticPasswordManager: kaum Änderung

**Ist-Zustand (V):** Jeder User hat seinen eigenen LSKF-basierten Protector mit
eigenem Gatekeeper-Handle bzw. eigenem **Weaver-Slot**; `weaverVerify()` lädt bei
Fehlversuch genau diesen Slot [5][7]. Das ist bereits „ein Slot pro Profil" (SR-4).

**Soll:** Keine strukturelle Änderung. Zwei Prüfpunkte:

- **Weaver-Slot-Anzahl** (Konzept 12.2, P0-Leseliste L4): Die Zahl ist eine
  Gerätekonstante, die der HAL meldet — `IWeaver.getConfig().slots` (V); der
  SP-Manager begrenzt Slots über genau diese Konfiguration
  (`weaverVerify`: `slot >= mWeaverConfig.slots`, V). Eine öffentliche Konstante
  für Titan M/M2 gibt es nicht; die Zahl wird in M4 am Zielgerät gemessen.
  Zusätzlich zu prüfen: Der SP-Manager belegt einen Weaver-Slot auch für den
  **secdiscardable-Key** — zwei Profile könnten vier Slots brauchen, nicht zwei
  (V, p1-verifikation.md §4).
- **Verhalten bei Sperre:** Ist ein Profil dauerhaft gesperrt, muss die Prüfung
  der übrigen Profile unverändert weiterlaufen — die Dauersperre eines Profils
  darf die *Zeit* der Gesamtauswertung nicht ändern (SR-3). Wie `weaverVerify`
  in diesem Fall reagiert, ist zu prüfen (U).

### 4.3 C3 — vold / StorageManager: CE des gewählten Profils

**Ist-Zustand (V):** `StorageManager.unlockUser(userId, token, secret)` → vold
lädt den CE-Schlüssel des Users; Schlüssel liegen unter
`/data/misc/vold/user_keys/ce/<userId>` [3][4]. Die Binder-Primitive sind
`unlockCeStorage(userId, secret)` → `fscrypt_unlock_ce_storage(...)` und
`lockCeStorage(userId)` → `fscrypt_lock_ce_storage(...)` (V, `VoldNativeService.cpp`).
Der `vdc cryptfs`-Kommandoname aus [3] ist beim M0 auf dem Ziel-Build
gegenzuprüfen. Schlüsselmechanik (V, `KeyUtil.cpp`): Der CE-Schlüssel wird mit
`FS_IOC_ADD_ENCRYPTION_KEY` in den Kernel-fscrypt-Keyring gelegt (ioctl-Puffer
selbstnullend); `evictKey()` entfernt ihn mit `FS_IOC_REMOVE_ENCRYPTION_KEY`
und räumt offene Dateien per Backoff nach (3,2 s → 51,2 s).

**Soll:** MLSU ruft `unlockUser` nur für den gematchten User. Beim Profilwechsel
und beim Sperren: `lockCeStorage`/`evictKey` für das *andere* Profil, damit sein
CE-Schlüssel aus dem Kernel-Keyring verschwindet (SR-2). **Kernel-Anteil
verifiziert (V):** Nach `lock` existiert der Schlüssel nicht mehr im Keyring.
**Offen bleibt der Userspace-Anteil (U):** transient angefasste Kopien
(vold-`KeyBuffer`, keystore2-Daemon, Keymaster-BLOBs) und deren Lebensdauer —
eine der wichtigsten M4-Messungen, im Python-Modell nicht abbildbar (F-2).

### 4.4 C4 — SystemUI Keyguard: bewusst keine Änderung

**Soll: unverändert.** Das ist der Punkt des Konzepts: Der Sperrbildschirm zeigt
weiterhin genau das, was er heute zeigt. Konkret:

- Keine Angabe zur Profilzahl, kein User-Auswahl-Icon, kein „anderes Profil
  verfügbar"-Hinweis (Konzept 5.1, 8.3).
- Fehlversuchszähler und Wartezeiten identisch wie ohne MLSU — die UI zeigt
  nur, was der aktive User ohnehin sehen würde (U: wie sich die
  Weaver-Throttle-Zeiten auf die Keyguard-Anzeige auswirken, ist zu prüfen).
- **Biometrie aus** (Konzept 9.6): Fingerabdruck/Gesicht können den Bereich nicht
  über „Wissen" wählen. Im MLSU-Betrieb entweder auf ein Profil beschränkt oder
  deaktiviert — Designentscheidung (O), vor P1 zu treffen.

### 4.5 C5 — UserManager/AMS: der zweite User verschwindet

**Ist-Zustand (V):** Private Space hat bereits die Hidden-Profile-Mechanik:
`USER_TYPE_PROFILE_PRIVATE`, Launcher-Zugriff nur mit `ACCESS_HIDDEN_PROFILES`,
Broadcasts beim Sperren/Entsperren [1][2].

**Soll:** Der Duress-/zweite User erhält dieselbe Unsichtbarkeits-Behandlung,
**plus** systemweite Filterung der üblichen Leckstellen (Konzept 6.2/6.3):

| Leck | Maßnahme (Skizze) |
|---|---|
| UserSwitcher / Launcher / Settings-Userliste | PRIVATE-Typ-Filter erben (V vorhanden) |
| Settings-Suche, „Über das Telefon", Kontenliste | Suche/Liste pro aktivem Profil; kein cross-profile Eintrag (U) |
| Benachrichtigungsverlauf, Media-Store, Zwischenablage | getrennt je Profil — von Private Space teilweise geerbt, Rest zu prüfen (U) |
| Einstellungs-Eintrag „MLSU aktiviert" | **nur im privaten Profil** sichtbar (Konzept 8.3) (O: wo genau) |
| Modem/eSIM-Logs, Bootzähler, Crash-Reports | profilneutral protokollieren (Konzept 6.3) — Systemweite Logging-Änderung, P2-Thema |

### 4.6 C6 — Einrichtungsassistent: der kritischste Teil (UX)

Das Konzeptpapier nennt den Setup-Flow „den kritischsten Teil aus Nutzersicht"
(7., 8.). Skizze des Ablaufs im privaten Profil:

1. Erste PIN setzen (privates Profil, „normale" Einrichtung).
2. **„Zweiten Bereich einrichten?"** — explizit, mit der
   Bedrohungsmodell-Tabelle aus Abschnitt 4 des Konzeptpapiers in einfachen
   Worten: „Schützt vor Person X am Gerät. Schützt **nicht** vor Geräteforensik."
3. Zweite PIN setzen + **Pflicht-Inhalte**: Das System schlägt vor, Kontakte,
   Fotos, Apps und plausible Aktivität in den Duress-Bereich zu legen — ein
   leeres zweites Profil ist verdächtiger als gar keines (Konzept 8.1).
4. **Rückweg bei PIN-Verwechslung** (Konzept 8.2): Wer unter Stress die falsche
   PIN eingibt, landet im falschen Bereich. Es braucht einen Rückweg **ohne
   sichtbaren Hinweis** (z. B. lange Notruf-Geste mit stillem Wechsel zurück ins
   private Profil — Designidee, O).
5. Klartext-Grenzen, bevor irgendetwas gespeichert wird (Konzept 8.4).

### 4.7 C7 — MLSU-Konfiguration (Provisioning)

**O:** Wo liegt die Verknüpfung „User A + User B = MLSU-Set"? Anforderungen:
nicht im sichtbaren DE-Speicher (Konzept 6.2), nur aus dem privaten Profil
änderbar, standardmäßig aus (Konzept 9.5). Naheliegend: eine datei-basierte
Konfiguration im CE-Speicher des privaten Profils, gelesen von
`LockSettingsService` nach dessen Entsperrung. Designentscheidung vor P1.

---

## 5. Minimaler PoC-Pfad (Meilensteine)

Die Reihenfolge folgt dem Grundsatz aus dem Konzeptpapier (6.4): erst der Kern,
dann alles andere. Jeder Meilenstein hat ein **Prüfkriterium**, kein „sollte".

| Meilenstein | Inhalt | Prüfkriterium |
|---|---|---|
| **M0** | Basis: AOSP 15+ auf Emulator oder Pixel mit unlockbarem Bootloader; zwei User (davon einer PRIVATE), beide mit eigenem PIN; Stock-Verhalten verstehen | `vdc cryptfs unlock_user_key` für User 2 funktioniert; Private Space einrichtbar |
| **M1** | **PIN-Routing in LSS** (4.1): Eingabe prüft gegen beide Protectors, matcht den richtigen User, CE wird entsperrt. Noch ohne Konstantzeit-Anspruch | PIN 1 → Profil 1, PIN 2 → Profil 2, falsche PIN → nichts; Wechsel ohne Neustart |
| **M2** | **Konstantzeit + Zähler** (SR-3/SR-4): Schleife läuft immer über alle Profile; Fehlversuche laden beide Zähler; Wartezeiten wie im Modell. Zeitmessung mit dem [bench-Rig](../reference/bench/timing.py) als Referenz | Zeitdifferenz zwischen „Match Profil 1 / Profil 2 / Miss" unterhalb der Messschwelle (Methodik: P0-Befund F-4: interleaved messen!) |
| **M3** | **Unsichtbarkeit** (4.5, 4.6): zweiter User aus allen UIs; Setup-Flow; Duress-Rückweg; Biometrie-Entscheidung | Checkliste aus Abschnitt 6.3 des Konzeptpapiers abgearbeitet; kein UI-Hinweis in Screenshot-Durchlauf |
| **M4** | Hardware: Weaver-Slot-Zahl messen, CE-Schlüssel-RAM-Verhalten (4.3), `lock_user_key`-Timing | Messprotokoll; SR-2-Teilaussage möglich |

Vor M4 wird das Feature **niemandem** empfohlen (Konzept 11, P4-Gate).

---

## 6. Vergleich: Stock/Pixel vs. MLSU-PoC

| Bereich | Stock Android 15 | MLSU-PoC (Skizze) |
|---|---|---|
| Zweiter Bereich | Private Space (sichtbar, eigener Unlock-UI) | wie Private Space, aber PIN-Routing |
| PIN-Auswahl | UI führt zum zweiten Lock | eine PIN, kein UI-Hinweis |
| Konstante Auswertungszeit | n/a (ein Profil geprüft) | alle Profile immer (SR-3) |
| Fehlversuchszähler | je Profil | je Profil, aber alle laden bei Miss (F-1) |
| CE-Schlüssel im RAM | nur des aktiven Users | nur des aktiven Users, Wechsel erzwingt lock (U) |
| Biometrie | optional je Profil | deaktiviert/beschränkt (O) |

---

## 7. Verknüpfung mit den P0-Befunden

| Befund | Bedeutung für den PoC |
|---|---|
| **F-1** (Fehlversuche sperren versteckte Profile) | Im AOSP-Kontext *gewollt* nachbilden: alle Protectors laden bei Miss. Konsequenz für UX dokumentieren (Konzept 8.2). |
| **F-2** (kein RAM-Nachweis in Python) | `lock_user_key`-Verhalten auf echter Hardware messen (M4) — der einzige Ort, wo SR-2 prüfbar wird. |
| **F-3** (Konstantzeit-Tag-Vergleich) | Betrifft den AEAD-Unwrap im SP-Manager (C/C++ in `frameworks/base`/keystore — nicht im Java-Gerüst sichtbar). Als Anforderung an die Implementierung übernehmen. |
| **F-4** (Messmethodik) | Das bench-Rig ist die Referenz für M2 — inklusive der gelernten Lektion (interleaved, randomisiert, nicht getrennt messen). |
| **F-5** (Zielkonflikt) | Konkret im Setup-Flow adressieren (4.6): Trennung vs. Bedienbarkeit. |

---

## 8. Risiken und offene Fragen (vor M1 zu klären)

Stand der Liste nach der Quellenprüfung 2026-08-19
([p1-verifikation.md](p1-verifikation.md) §6); unveränderte Punkte sind als
solche markiert.

1. **Konstantzeit über Binder/HAL** (Konzept 12.1): Die Schleife in LSS ist
   strukturell konstant, aber Binder-Roundtrips zu Gatekeeper/Weaver und der
   AEAD-Unwrap sind es nicht garantiert. Ehrliche Einschätzung: SR-3 auf echter
   Hardware bleibt eine **offene Messfrage** (M2, Messmethodik F-4).
   *(unverändert offen)*
2. **Weaver-Slot-Anzahl** (Konzept 12.2): reicht die Slot-Zahl gängiger
   Secure Elements für 2+ Profile? *(teilweise geklärt)* Der Messweg ist
   verifiziert (`IWeaver.getConfig().slots`, V); die Zahl selbst bleibt eine
   M4-Messung, inkl. secdiscardable-Slot-Verbrauch (siehe 4.2).
3. **CE-Schlüssel im RAM** (SR-2): Verhält sich `lock_user_key` so, dass der
   Schlüssel tatsächlich aus dem Speicher verschwindet? *(teilweise geklärt)*
   Kernel-Keyring-Entfernung belegt (V, `KeyUtil.evictKey`); Userspace-Kopien
   bleiben M4-Messung (siehe 4.3).
4. **Single-active-user**: Android erlaubt genau einen aktiven User — das
   *hilft* MLSU (zweiter Bereich ist nie gleichzeitig aktiv), erzwingt aber
   sauberes Umschalten inkl. Medien-/Benachrichtigungs-Neustart (U).
   *(unverändert)*
5. **Biometrie** (Konzept 9.6): Entscheidung deaktivieren vs. ein Profil.
   *(unverändert O; D3-Empfehlung „deaktivieren" gilt weiter)*
6. **OTA/Reset/Gerätewechsel** (Konzept 12.6): Was passiert mit dem MLSU-Set?
   *(unverändert O)*
7. **Legal/UX**: Der Duress-Rückweg und die „plausible Aktivität" (8.1) sind
   Design- und Rechtsfragen, keine Codeprobleme — früh mit der Zielgruppe
   testen (P4-Nutzerstudie, Konzept 10). *(unverändert O)*

---

## 9. Quellen

1. [UserManager.USER_TYPE_PROFILE_PRIVATE — API 35](https://developer.android.com/reference/android/os/UserManager) (V)
2. [Android 15 — Private Space (AOSP-Übersicht)](https://developer.android.com/work/versions/android-15) (V)
3. [vdc cryptfs unlock_user_key — Befehlsbeispiel aus Forensik-Praxis](https://xdaforums.com/t/mate-9-how-to-retrieve-encrypted-files-from-a-broken-system-userdata-partition.3894561/) (V: Befehl; U: Details der Schlüsselverwaltung)
4. [CE-/DE-Schlüsselpfade unter /data/misc/vold/user_keys](https://xdaforums.com/t/mate-9-how-to-retrieve-encrypted-files-from-a-broken-system-userdata-partition.3894561/) (V)
5. [SyntheticPasswordManager.java — unlockLskfBasedProtector, weaverVerify, unwrapSyntheticPasswordBlob](https://android.googlesource.com/platform/frameworks/base/+/master/services/core/java/com/android/server/locksettings/SyntheticPasswordManager.java) (V)
6. [LockSettingsService.java — doVerifyCredential / SP-Verwaltung](https://android.googlesource.com/platform/frameworks/base/+/master/services/core/java/com/android/server/locksettings/LockSettingsService.java) (V: Struktur; U: Einzelheiten des Verify-Pfads)
7. [Analyse des LSS-Verify-Flows (sekundär)](https://medium.com/@salamsajid7/hunting-android-lockscreen-bypasses-on-pixel-a-campaign-walkthrough-8601f12f9963) (U: sekundäre Quelle, im Quellcode gegenprüfen)
8. [LockSettingsService.java — Zeilengenaue Fundstellen: doVerifyCredential (2618–2620), onCredentialVerified (2691/2692/3379), Unified Lock (1678, 2769–2782), Aufrufstellen unlockLskfBasedProtector (1230, 1247, 2460, 2668)](https://cs.android.com/android/platform/superproject/+/android-latest-release:frameworks/base/services/core/java/com/android/server/locksettings/LockSettingsService.java) (V, 2026-08-19)
9. [SyntheticPasswordManager.java — Zeilengenaue Fundstellen: unlockLskfBasedProtector (1534), weaverVerify-Slotgrenze (793–794), secdiscardable-Slot (1776–1778)](https://cs.android.com/android/platform/superproject/+/android-latest-release:frameworks/base/services/core/java/com/android/server/locksettings/SyntheticPasswordManager.java) (V, 2026-08-19)
10. [IWeaver.aidl — Slot-Array, getConfig().slots, Drosselung pro Slot](https://android.googlesource.com/platform/hardware/interfaces/+/refs/heads/main/weaver/aidl/android/hardware/weaver/IWeaver.aidl) (V, 2026-08-19)
11. [KeyUtil.cpp — installKey/evictKey/waitForBusyFiles (fscrypt-Keyring)](https://android.googlesource.com/platform/system/vold/+/refs/heads/main/KeyUtil.cpp) und [VoldNativeService.cpp — unlockCeStorage/lockCeStorage](https://android.googlesource.com/platform/system/vold/+/refs/heads/main/VoldNativeService.cpp) (V, 2026-08-19)
12. [P1-Verifikation — vollständige Quellenliste und Einordnung](p1-verifikation.md) (V, 2026-08-19)

---

## Lizenz

[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/deed.de),
siehe [LICENSE](../LICENSE).
