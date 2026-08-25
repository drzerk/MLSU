#!/usr/bin/env python3
"""Play the core coercion scenario from the concept paper once.

Wrong PIN under pressure → the restricted area opens. Later the owner returns
to the private profile through the identical lock screen (concept §8.2).
The script also names what an observer can measure, and the limits (§9).
"""

from __future__ import annotations

import os
import tempfile

from mlsu.keystore import KeyStore
from mlsu.params import KDF_TEST
from mlsu.storage import save_store


PRIVATE_PIN = "471903"
DURESS_PIN = "220561"


def main() -> int:
    store = KeyStore(kdf=KDF_TEST, slot_count=4)
    store.enroll(PRIVATE_PIN, 1)
    store.enroll(DURESS_PIN, 2)

    fd, path = tempfile.mkstemp(prefix="mlsu-duress-", suffix=".store")
    os.close(fd)
    try:
        save_store(path, store)
        size_before = os.path.getsize(path)

        print("=== Phase 1 — checkpoint demand ===")
        print("Examiner: unlock the device.")
        print("Owner types the duress PIN, not the private one.")
        first = store.unlock(DURESS_PIN)
        print(f"  opened profile {first.profile_id} (restricted / travel)")
        print("  private CE key is not in the session (model: lock() after inspect)")
        store.lock()

        print()
        print("=== Phase 2 — what an observer can measure ===")
        save_store(path, store)
        size_after = os.path.getsize(path)
        print(f"  store file size before/after unlock: {size_before} / {size_after} bytes")
        print("  size is constant — occupancy is not readable from length (SR-8)")
        print(f"  Weaver counters after a *hit*: {[s.failures for s in store.slots]}")
        print("  (SR-4: only the matched slot was reset; others were not charged)")

        print()
        print("=== Phase 3 — return without a visible hint ===")
        print("Owner locks the device and types the private PIN on the same screen.")
        second = store.unlock(PRIVATE_PIN)
        print(f"  opened profile {second.profile_id} (private)")
        print("  no menu, no toggle, no 'switch user' (FR-1, FR-2)")
        store.lock()

        print()
        print("=== Limits (concept §9) — say these out loud ===")
        print("  · Not invisible: a known ROM that ships MLSU tells an examiner")
        print("    that a second profile *can* exist.")
        print("  · Not a defence against chip-off / FTL reconstruction (A5).")
        print("  · Not a defence against a compromised OS (A6).")
        print("  · Guessing PINs charges every slot (F-1), including the hidden one.")
        return 0
    finally:
        try:
            os.unlink(path)
        except OSError:
            pass


if __name__ == "__main__":
    raise SystemExit(main())
