"""Walk through the mechanism once, printing what an observer would see.

    python3 demo.py
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from mlsu.keystore import KeyStore  # noqa: E402
from mlsu.params import KDF_FAST, MAX_FAILURES  # noqa: E402

PRIVATE_PIN = "471903"
RESTRICTED_PIN = "220561"


def show(store: KeyStore, pin: str, comment: str) -> None:
    result = store.unlock(pin)
    if result.locked_out:
        outcome = "locked out — the rate limiter refuses"
    elif result.found:
        name = {1: "private area", 2: "restricted area"}[result.profile_id]
        outcome = f"opens the {name} (key {result.profile_key[:4].hex()}…)"
    else:
        outcome = "opens nothing"
    print(f"  PIN {pin} → {outcome:<52} {comment}")


def main() -> None:
    store = KeyStore(kdf=KDF_FAST)
    store.enroll(PRIVATE_PIN, profile_id=1)
    store.enroll(RESTRICTED_PIN, profile_id=2)

    print("\nTwo profiles enrolled. Storage holds this — one line per slot:\n")
    for i, slot in enumerate(store.slots):
        print(f"  slot {i}: salt={slot.salt.hex()[:16]}… blob={slot.blob.hex()[:16]}… ({len(slot.blob)} B)")
    print(
        "\n  Two of these carry a profile and two are decoys. Nothing in the\n"
        "  stored data says which is which, or that a second profile exists.\n"
    )

    print("Unlocking:\n")
    show(store, PRIVATE_PIN, "← what the owner enters")
    show(store, RESTRICTED_PIN, "← what the owner enters under duress")
    show(store, "000000", "← a guess")

    print("\nThe same PIN always reaches the same profile, and the profile keys")
    print("are independent — knowing one tells you nothing about the other:\n")
    a = store.unlock(PRIVATE_PIN).profile_key
    b = store.unlock(RESTRICTED_PIN).profile_key
    print(f"  profile 1 key: {a.hex()}")
    print(f"  profile 2 key: {b.hex()}")

    print(f"\nNow {MAX_FAILURES} wrong guesses — watch every counter rise, including")
    print("the one belonging to the profile the guesser has never seen:\n")
    store.weaver.reset()
    for step in range(MAX_FAILURES + 1):
        store.unlock("000000")
        if step in (0, 4, 14, MAX_FAILURES):
            print(f"  after {step + 1:>3} failed attempts: counters {store.weaver.snapshot()}")

    print()
    show(store, PRIVATE_PIN, "← the owner is locked out too (finding F-1)")
    print()


if __name__ == "__main__":
    main()
