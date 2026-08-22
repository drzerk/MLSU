"""``mlsu-cli`` — enrol, unlock, status. Exit codes are stable for scripts.

0 success · 1 wrong PIN · 2 lockout · 3 throttled · 4 store error · 5 usage
"""

from __future__ import annotations

import argparse
import sys
from typing import Optional, Sequence, TextIO

from .keystore import KeyStore
from .params import KDF_BY_NAME, MIN_PIN_LEN, SLOT_COUNT
from .storage import StoreError, create_store, load_store, save_store


EXIT_OK = 0
EXIT_MISS = 1
EXIT_LOCKOUT = 2
EXIT_THROTTLED = 3
EXIT_STORE = 4
EXIT_USAGE = 5


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="mlsu",
        description="MLSU Stufe-0 reference CLI (model, not a real lock screen).",
    )
    parser.add_argument(
        "--store",
        default="mlsu.store",
        help="path to the fixed-size store file (default: mlsu.store)",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    init = sub.add_parser("init", help="create a new store of decoy slots")
    init.add_argument("--slots", type=int, default=SLOT_COUNT)
    init.add_argument("--kdf", choices=sorted(KDF_BY_NAME), default="fast")

    enroll = sub.add_parser("enroll", help="enrol a profile into a random free slot")
    enroll.add_argument("pin")
    enroll.add_argument("profile_id", type=int)

    unlock = sub.add_parser("unlock", help="evaluate a PIN against every slot")
    unlock.add_argument("pin")
    unlock.add_argument("--show-key", action="store_true")

    change = sub.add_parser("change-pin", help="rewrap the same profile key")
    change.add_argument("old_pin")
    change.add_argument("new_pin")

    remove = sub.add_parser("remove", help="turn a profile slot back into a decoy")
    remove.add_argument("pin")

    sub.add_parser("lock", help="document CE-key discard (model holds no session)")

    status = sub.add_parser("status", help="print store status without the profile count")
    status.add_argument(
        "--verbose",
        action="store_true",
        help="print the slot table (leaks occupancy — not for a product UI)",
    )
    return parser


def _refuse_if_limited(store: KeyStore, stdout: TextIO) -> Optional[int]:
    if store.any_locked_out:
        print("Gesperrt: Zu viele Fehlversuche — Store dauerhaft gesperrt.", file=stdout)
        return EXIT_LOCKOUT
    remaining = store.rate_limit_remaining()
    if remaining > 0:
        print(f"Gesperrt: Nächster Versuch erst in {remaining:.0f} s.", file=stdout)
        return EXIT_THROTTLED
    return None


def main(argv: Optional[Sequence[str]] = None, out: Optional[TextIO] = None) -> int:
    stdout = out or sys.stdout
    argv = list(sys.argv[1:] if argv is None else argv)
    parser = _parser()
    try:
        args = parser.parse_args(argv)
    except SystemExit as exc:
        code = exc.code
        return EXIT_USAGE if code not in (0, None) else 0

    try:
        return _dispatch(args, stdout)
    except StoreError as exc:
        print(f"Store-Fehler: {exc}", file=stdout)
        return EXIT_STORE
    except ValueError as exc:
        print(f"Fehler: {exc}", file=stdout)
        return EXIT_USAGE
    except OSError as exc:
        print(f"Store-Fehler: {exc}", file=stdout)
        return EXIT_STORE


def _dispatch(args: argparse.Namespace, stdout: TextIO) -> int:
    command = args.command
    path = args.store

    if command == "init":
        if args.slots < 1 or args.slots > 16:
            print("Fehler: --slots muss zwischen 1 und 16 liegen.", file=stdout)
            return EXIT_USAGE
        kdf = KDF_BY_NAME[args.kdf]
        store = create_store(path, kdf=kdf, slot_count=args.slots)
        print(
            f"Neuer Store angelegt: {path}\n"
            f"  Slots: {store.slot_count} (alle decoys), KDF: {kdf.label()}",
            file=stdout,
        )
        return EXIT_OK

    if command == "lock":
        print(
            "Store gesperrt. Das Modell hält keinen Entsperr-Zustand zwischen "
            "Aufrufen — auf einem Gerät würde hier der CE-Schlüssel des "
            "aktiven Profils verworfen (SR-2).",
            file=stdout,
        )
        return EXIT_OK

    store = load_store(path)

    if command == "status":
        locked = "dauerhaft" if store.any_locked_out else "nein"
        remaining = store.rate_limit_remaining()
        if remaining == float("inf"):
            nxt = "dauerhaft"
        elif remaining > 0:
            nxt = f"in {remaining:.0f} s"
        else:
            nxt = "sofort"
        print(
            f"Store: {path}\n"
            f"  Slots: {store.slot_count} | KDF: {store.kdf.name.upper()}\n"
            f"  Sperre: {locked} | Nächster Versuch: {nxt}",
            file=stdout,
        )
        if args.verbose:
            print(
                "\n  Hinweis: Diese Slot-Tabelle verrät die Profilanzahl (SR-8).\n"
                "  Ein Produkt dürfte sie nicht anzeigen — Dev-Werkzeug nur.",
                file=stdout,
            )
            for idx, slot in enumerate(store.slots):
                kind = "belegt" if slot.enrolled else "decoy"
                delay = f"{slot.delay:.0f} s" if slot.delay > 0 else "—"
                print(
                    f"  Slot {idx + 1}: {kind:<6} | Fehlversuche: {slot.failures:<3} "
                    f"| Wartezeit: {delay}",
                    file=stdout,
                )
        return EXIT_OK

    if command == "enroll":
        if len(args.pin) < MIN_PIN_LEN:
            print(f"Fehler: PIN muss mindestens {MIN_PIN_LEN} Zeichen lang sein.", file=stdout)
            return EXIT_USAGE
        limited = _refuse_if_limited(store, stdout)
        if limited is not None:
            return limited
        slot_index = store.enroll(args.pin, args.profile_id)
        save_store(path, store)
        print(
            f"Profil {args.profile_id} eingerichtet "
            f"(Slot {slot_index + 1} von {store.slot_count}).",
            file=stdout,
        )
        return EXIT_OK

    if command in ("unlock", "change-pin", "remove"):
        limited = _refuse_if_limited(store, stdout)
        if limited is not None:
            return limited

    if command == "unlock":
        outcome = store.unlock(args.pin)
        save_store(path, store)
        if outcome.locked_out and not outcome.found:
            print("Gesperrt: Zu viele Fehlversuche — Store dauerhaft gesperrt.", file=stdout)
            return EXIT_LOCKOUT
        if outcome.throttled_remaining > 0 and not outcome.found:
            print(
                f"Gesperrt: Nächster Versuch erst in {outcome.throttled_remaining:.0f} s.",
                file=stdout,
            )
            return EXIT_THROTTLED
        if not outcome.found:
            print("Fehler: Kein Profil entspricht dieser PIN.", file=stdout)
            return EXIT_MISS
        print(f"Entsperrt: Profil {outcome.profile_id}.", file=stdout)
        if args.show_key and outcome.profile_key_hex:
            print(f"Profilschlüssel: {outcome.profile_key_hex}", file=stdout)
        return EXIT_OK

    if command == "change-pin":
        if len(args.new_pin) < MIN_PIN_LEN:
            print(f"Fehler: PIN muss mindestens {MIN_PIN_LEN} Zeichen lang sein.", file=stdout)
            return EXIT_USAGE
        changed = store.change_pin(args.old_pin, args.new_pin)
        save_store(path, store)
        if changed is None:
            if store.any_locked_out:
                print("Gesperrt: Zu viele Fehlversuche — Store dauerhaft gesperrt.", file=stdout)
                return EXIT_LOCKOUT
            print("Fehler: Kein Profil entspricht der aktuellen PIN oder Store gesperrt.", file=stdout)
            return EXIT_MISS
        slot_index, profile_id = changed
        print(
            f"PIN von Profil {profile_id} geändert "
            f"(Slot {slot_index + 1} von {store.slot_count}).",
            file=stdout,
        )
        return EXIT_OK

    if command == "remove":
        removed = store.remove_profile(args.pin)
        save_store(path, store)
        if removed is None:
            if store.any_locked_out:
                print("Gesperrt: Zu viele Fehlversuche — Store dauerhaft gesperrt.", file=stdout)
                return EXIT_LOCKOUT
            print("Fehler: Kein Profil entspricht dieser PIN oder Store gesperrt.", file=stdout)
            return EXIT_MISS
        slot_index, profile_id = removed
        print(
            f"Profil {profile_id} gelöscht "
            f"(Slot {slot_index + 1} ist wieder ein decoy).",
            file=stdout,
        )
        return EXIT_OK

    print(f"Unbekannter Befehl: {command}", file=stdout)
    return EXIT_USAGE


if __name__ == "__main__":
    sys.exit(main())
