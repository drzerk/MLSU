"""Duress scenario — walk through the concept's core situation once.

    python3 simulate_duress.py

Shows what a person holding the device sees when the wrong PIN is entered
under duress, and how the way back works **without a visible hint**
(concept paper 8.2): the lock screen is identical every time — the PIN alone
decides which area opens. Nothing in the store, the file size or the unlock
flow reveals that a second profile exists.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from mlsu.keystore import KeyStore  # noqa: E402
from mlsu.params import KDF_FAST  # noqa: E402

PRIVATE_PIN = "471903"
DURESS_PIN = "220561"
NAMES = {1: "private area", 2: "restricted area"}


def what_observer_sees(store: KeyStore, pin: str) -> str:
    """The observable outcome of entering *pin* at the lock screen."""
    result = store.unlock(pin)
    if result.locked_out:
        return "nothing — the rate limiter refuses"
    if result.found:
        return f"opens the {NAMES[result.profile_id]}"
    return "opens nothing"


def main() -> None:
    store = KeyStore(kdf=KDF_FAST)
    store.enroll(PRIVATE_PIN, profile_id=1)
    store.enroll(DURESS_PIN, profile_id=2)

    print("SCENARIO: a control at the border demands the PIN.\n")

    print("  The owner enters the duress PIN:")
    print(f"    → {what_observer_sees(store, DURESS_PIN)}")
    print("  The restricted area looks normal: apps, contacts, photos —")
    print("  the setup seeded plausible activity (concept 8.1). From the")
    print("  examiner's point of view the private area never existed.\n")

    print("LATER — the owner is alone again. The way back, without a hint:")
    print("  lock the device (the lock screen is identical), then enter the")
    print("  private PIN:")
    print(f"    → {what_observer_sees(store, PRIVATE_PIN)}\n")
    print("  No menu, no switch, no hint that a second area exists — the")
    print("  PIN alone chose the area (concept 5).\n")

    print("What an observer could measure:")
    print(f"  storage: {store.slot_count} slots, always the same file size")
    print("  unlock outcome: exactly one area opens, or none")
    print("  timing: every unlock evaluates all slots (SR-3, see bench/timing.py)")
    print("  counters: every failed guess raises ALL counters (F-1) — the")
    print("  hidden profile gets throttled too, and so does its owner after")
    print("  enough guessing (that is the honest price of SR-4)\n")

    print("Honest limits (concept 9): an examiner who knows the ROM knows")
    print("that a second profile CAN exist. MLSU does not promise invisibility")
    print("to forensics — it prevents accidental discovery and keeps the UI")
    print("clean. It is not a tool to evade investigations.")


if __name__ == "__main__":
    main()
