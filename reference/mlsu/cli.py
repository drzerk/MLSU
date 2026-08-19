"""Command line interface for the MLSU Stufe-0 module.

Usage (from ``reference/``)::

    python3 -m mlsu --store demo.store init
    python3 -m mlsu --store demo.store enroll 471903 1
    python3 -m mlsu --store demo.store unlock 471903
    python3 -m mlsu --store demo.store change-pin 471903 123456
    python3 -m mlsu --store demo.store remove 471903
    python3 -m mlsu --store demo.store lock
    python3 -m mlsu --store demo.store status

Every command opens the store file, works on it, and writes it back
atomically — so counters, lockout and enrolment survive restarts.

Exit codes (useful for scripting):

    0  success (unlock matched, store created, profile enrolled)
    1  wrong PIN — no profile matched
    2  permanent lockout after too many failed attempts
    3  throttled — the rate limiter refuses the attempt for now
    4  store error (missing, corrupted, unsupported format)
    5  usage error (bad arguments, full store, ...)
"""
import argparse
import os
import sys

from .keystore import KeyStore
from .params import KDF_FAST, KDF_STRONG, SLOT_COUNT
from .storage import StorageFormatError, create_store, load_store, save_store

EXIT_OK = 0
EXIT_WRONG_PIN = 1
EXIT_LOCKED_OUT = 2
EXIT_THROTTLED = 3
EXIT_STORE_ERROR = 4
EXIT_USAGE = 5

PIN_MIN_LEN = 4
PIN_MAX_LEN = 64


def _describe_throttle(store: KeyStore) -> str:
    remaining = store.rate_limit_remaining()
    if remaining == float("inf"):
        return "dauerhaft"
    if remaining > 0:
        return f"in {remaining:.0f} s"
    return "sofort"


def cmd_init(args: argparse.Namespace) -> int:
    path = args.store
    if os.path.exists(path) and not args.force:
        print(f"Fehler: {path} existiert bereits. --force überschreibt den Store.")
        return EXIT_USAGE
    kdf = KDF_STRONG if args.kdf == "strong" else KDF_FAST
    store = create_store(kdf=kdf, slot_count=args.slots)
    save_store(store, path)
    print(f"Neuer Store angelegt: {path}")
    print(f"  Slots: {args.slots} (alle decoys), KDF: {kdf.describe()}")
    return EXIT_OK


def cmd_enroll(args: argparse.Namespace) -> int:
    pin = args.pin
    if not PIN_MIN_LEN <= len(pin) <= PIN_MAX_LEN:
        print(f"Fehler: PIN muss {PIN_MIN_LEN}–{PIN_MAX_LEN} Zeichen lang sein.")
        return EXIT_USAGE
    try:
        store = load_store(args.store)
    except (OSError, StorageFormatError) as exc:
        print(f"Fehler: Store nicht lesbar: {exc}")
        return EXIT_STORE_ERROR
    if store.weaver.any_locked_out:
        print("Fehler: Store ist dauerhaft gesperrt — Einrichten nicht möglich.")
        return EXIT_LOCKED_OUT
    try:
        index = store.enroll(pin, args.profile_id)
    except RuntimeError:
        print(f"Fehler: Alle {store.slot_count} Slots sind belegt.")
        return EXIT_USAGE
    except ValueError as exc:
        print(f"Fehler: {exc}")
        return EXIT_USAGE
    save_store(store, args.store)
    print(f"Profil {args.profile_id} eingerichtet (Slot {index + 1} von {store.slot_count}).")
    return EXIT_OK


def cmd_unlock(args: argparse.Namespace) -> int:
    store, code = _load_and_check_throttle(args.store)
    if code is not None:
        return code
    result = store.unlock(args.pin)
    save_store(store, args.store)  # counters changed on success and on miss

    if result.locked_out:
        print("Gesperrt: Zu viele Fehlversuche — Store dauerhaft gesperrt.")
        return EXIT_LOCKED_OUT
    if not result.found:
        print("Fehler: Kein Profil entspricht dieser PIN.")
        return EXIT_WRONG_PIN
    print(f"Entsperrt: Profil {result.profile_id}.")
    if args.show_key:
        print(f"Profilschlüssel: {result.profile_key.hex()}")
    return EXIT_OK


def _load_and_check_throttle(path: str) -> tuple[KeyStore | None, int | None]:
    """Load the store and enforce the rate limit before any derivation.

    Returns (store, None) when the attempt may proceed, or (None, exit_code)
    when the CLI must refuse. Every command that derives from a PIN goes
    through here — like Weaver hardware, a throttled attempt is not even
    accepted, let alone charged.
    """
    try:
        store = load_store(path)
    except (OSError, StorageFormatError) as exc:
        print(f"Fehler: Store nicht lesbar: {exc}")
        return None, EXIT_STORE_ERROR
    remaining = store.rate_limit_remaining()
    if remaining == float("inf"):
        print("Gesperrt: Zu viele Fehlversuche — Store dauerhaft gesperrt.")
        return None, EXIT_LOCKED_OUT
    if remaining > 0:
        print(f"Gesperrt: Nächster Versuch erst in {remaining:.0f} s.")
        return None, EXIT_THROTTLED
    return store, None


def cmd_change_pin(args: argparse.Namespace) -> int:
    if not PIN_MIN_LEN <= len(args.new_pin) <= PIN_MAX_LEN:
        print(f"Fehler: Neue PIN muss {PIN_MIN_LEN}–{PIN_MAX_LEN} Zeichen lang sein.")
        return EXIT_USAGE
    store, code = _load_and_check_throttle(args.store)
    if code is not None:
        return code
    changed = store.change_pin(args.old_pin, args.new_pin)
    save_store(store, args.store)  # counters changed by the verification
    if changed is None:
        print("Fehler: Keine Profil entspricht der aktuellen PIN.")
        return EXIT_WRONG_PIN
    slot, profile_id = changed
    print(f"PIN von Profil {profile_id} geändert (Slot {slot + 1} von {store.slot_count}).")
    return EXIT_OK


def cmd_remove(args: argparse.Namespace) -> int:
    store, code = _load_and_check_throttle(args.store)
    if code is not None:
        return code
    removed = store.remove_profile(args.pin)
    save_store(store, args.store)  # counters changed by the verification
    if removed is None:
        print("Fehler: Keine Profil entspricht dieser PIN.")
        return EXIT_WRONG_PIN
    slot, profile_id = removed
    print(f"Profil {profile_id} gelöscht (Slot {slot + 1} ist wieder ein decoy).")
    return EXIT_OK


def cmd_lock(args: argparse.Namespace) -> int:
    try:
        load_store(args.store)
    except (OSError, StorageFormatError) as exc:
        print(f"Fehler: Store nicht lesbar: {exc}")
        return EXIT_STORE_ERROR
    # The model holds no unlock state between invocations, so there is
    # nothing to discard here. On a device this is the moment where the CE
    # key of the active profile would be dropped (SR-2).
    print(
        "Store gesperrt. Das Modell hält keinen Entsperr-Zustand zwischen "
        "Aufrufen — auf einem Gerät würde hier der CE-Schlüssel des aktiven "
        "Profils verworfen (SR-2)."
    )
    return EXIT_OK


def cmd_status(args: argparse.Namespace) -> int:
    try:
        store = load_store(args.store)
    except (OSError, StorageFormatError) as exc:
        print(f"Fehler: Store nicht lesbar: {exc}")
        return EXIT_STORE_ERROR

    locked = "dauerhaft" if store.weaver.any_locked_out else "nein"
    print(f"Store: {args.store}")
    print(f"  Slots: {store.slot_count} | KDF: {store.kdf.describe()}")
    print(f"  Sperre: {locked} | Nächster Versuch: {_describe_throttle(store)}")

    if args.verbose:
        print("\n  Hinweis: Diese Slot-Tabelle verrät die Profilanzahl (SR-8).")
        print("  Ein Produkt dürfte sie nicht anzeigen — Dev-Werkzeug nur.")
        for index, counter in enumerate(store.weaver.counters):
            kind = "belegt" if index not in store._free_slots else "decoy"
            delay = f"{counter.delay:.0f} s" if counter.delay else "—"
            print(
                f"  Slot {index + 1}: {kind:<6} | Fehlversuche: {counter.failures:<3} "
                f"| Wartezeit: {delay}"
            )
    return EXIT_OK


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="mlsu-cli",
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--store",
        default="mlsu.store",
        help="Pfad zur Store-Datei (Standard: mlsu.store)",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    p_init = sub.add_parser("init", help="Neuen Store anlegen (alle Slots decoys)")
    p_init.add_argument("--slots", type=int, default=SLOT_COUNT, help=f"Slot-Anzahl (Standard: {SLOT_COUNT})")
    p_init.add_argument("--kdf", choices=["fast", "strong"], default="fast",
                        help="KDF-Parameter: fast für Experimente, strong = Konzeptparameter (Standard: fast)")
    p_init.add_argument("--force", action="store_true", help="Vorhandenen Store überschreiben")
    p_init.set_defaults(func=cmd_init)

    p_enroll = sub.add_parser("enroll", help="Profil in einen freien Slot einrichten")
    p_enroll.add_argument("pin", help="Neue PIN (4–64 Zeichen)")
    p_enroll.add_argument("profile_id", type=int, help="Profil-ID (0–255)")
    p_enroll.set_defaults(func=cmd_enroll)

    p_unlock = sub.add_parser("unlock", help="PIN versuchen und Profil entsperren")
    p_unlock.add_argument("pin", help="Zu prüfende PIN")
    p_unlock.add_argument("--show-key", action="store_true",
                          help="Profilschlüssel ausgeben (nur zum Experimentieren)")
    p_unlock.set_defaults(func=cmd_unlock)

    p_status = sub.add_parser("status", help="Store-Status anzeigen (ohne Profilzahl)")
    p_status.add_argument("--verbose", action="store_true", help="Slot-Tabelle anzeigen (Dev-only, verrät SR-8-Metadaten)")
    p_status.set_defaults(func=cmd_status)

    p_change = sub.add_parser("change-pin", help="PIN eines Profils ändern (erfordert die aktuelle PIN)")
    p_change.add_argument("old_pin", help="Aktuelle PIN des Profils")
    p_change.add_argument("new_pin", help="Neue PIN (4–64 Zeichen)")
    p_change.set_defaults(func=cmd_change_pin)

    p_remove = sub.add_parser("remove", help="Profil löschen — der Slot wird wieder ein decoy (erfordert die PIN des Profils)")
    p_remove.add_argument("pin", help="PIN des zu löschenden Profils")
    p_remove.set_defaults(func=cmd_remove)

    p_lock = sub.add_parser("lock", help="Store sperren (Modell: kein gehaltener Entsperr-Zustand)")
    p_lock.set_defaults(func=cmd_lock)

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
