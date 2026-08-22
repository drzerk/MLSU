#!/usr/bin/env python3
"""Walk the selection mechanism once: two PINs, one lock screen, at most one opens."""

from __future__ import annotations

from mlsu.keystore import KeyStore
from mlsu.params import KDF_TEST, SLOT_COUNT


PRIVATE_PIN = "471903"
DURESS_PIN = "220561"
WRONG_PIN = "999999"


def main() -> int:
    store = KeyStore(kdf=KDF_TEST, slot_count=SLOT_COUNT)
    slot_a = store.enroll(PRIVATE_PIN, 1)
    slot_b = store.enroll(DURESS_PIN, 2)
    print("MLSU reference model — one walk-through")
    print(f"  enrolled profile 1 in slot {slot_a + 1}")
    print(f"  enrolled profile 2 in slot {slot_b + 1}")
    print(f"  store always holds {store.slot_count} slots (SR-8)")
    print()

    for label, pin in (
        ("private PIN", PRIVATE_PIN),
        ("duress PIN", DURESS_PIN),
        ("wrong PIN", WRONG_PIN),
    ):
        outcome = store.unlock(pin)
        counters = [slot.failures for slot in store.slots]
        print(f"{label} ({pin})")
        print(f"  found={outcome.found} profile={outcome.profile_id} slot={outcome.slot_index}")
        print(f"  evaluated_slots={outcome.evaluated_slots} lockout={outcome.locked_out}")
        print(f"  weaver counters={counters}")
        store.lock()
        print()

    print("Notes")
    print("  · A miss charged every slot (F-1).")
    print("  · A hit reset only the matched slot (SR-4).")
    print("  · This model cannot prove SR-2 (see docs/p0-befunde.md, F-2).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
