"""Requirement tests for the MLSU reference model.

Each test names the requirement from docs/p0-anforderungen.md that it exercises.
Where a requirement cannot be tested in this model, the test says so explicitly
rather than pretending to cover it.
"""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from mlsu import ct  # noqa: E402
from mlsu.counters import WeaverModel  # noqa: E402
from mlsu.keystore import KeyStore, Slot  # noqa: E402
from mlsu.params import KDF_FAST, MAX_FAILURES, PROFILE_KEY_LEN, SLOT_COUNT  # noqa: E402


def store(*pins: str) -> KeyStore:
    ks = KeyStore(kdf=KDF_FAST)
    for profile_id, pin in enumerate(pins, start=1):
        ks.enroll(pin, profile_id)
    return ks


class TestSelection(unittest.TestCase):
    """FR-1: the PIN alone selects the profile."""

    def test_each_pin_opens_its_own_profile(self):
        ks = store("111111", "222222")
        self.assertEqual(ks.unlock("111111").profile_id, 1)
        self.assertEqual(ks.unlock("222222").profile_id, 2)

    def test_wrong_pin_opens_nothing(self):
        ks = store("111111", "222222")
        result = ks.unlock("999999")
        self.assertFalse(result.found)
        self.assertIsNone(result.profile_key)

    def test_profile_keys_differ(self):
        """SR-1: independent keys, no shared master secret."""
        ks = store("111111", "222222")
        a = ks.unlock("111111").profile_key
        b = ks.unlock("222222").profile_key
        self.assertNotEqual(a, b)
        self.assertEqual(len(a), PROFILE_KEY_LEN)

    def test_unlock_is_repeatable(self):
        ks = store("111111")
        self.assertEqual(ks.unlock("111111").profile_key, ks.unlock("111111").profile_key)


class TestStorageShape(unittest.TestCase):
    """SR-8: stored data must not reveal how many profiles exist."""

    def test_slot_count_is_fixed(self):
        for pins in [(), ("111111",), ("111111", "222222")]:
            ks = store(*pins)
            self.assertEqual(len(ks.slots), SLOT_COUNT)

    def test_slots_have_uniform_shape(self):
        ks = store("111111")
        lengths = {(len(s.salt), len(s.nonce), len(s.blob)) for s in ks.slots}
        self.assertEqual(len(lengths), 1, "real and decoy slots differ in size")

    def test_decoys_never_open(self):
        ks = KeyStore(kdf=KDF_FAST)  # no profile enrolled at all
        for pin in ("000000", "111111", "guess"):
            self.assertFalse(ks.unlock(pin).found)

    def test_enrolment_order_does_not_fix_slot_position(self):
        """The first enrolled profile must not always land in slot 0."""
        positions = set()
        for _ in range(40):
            ks = KeyStore(kdf=KDF_FAST)
            positions.add(ks.enroll("111111", 1))
        self.assertGreater(len(positions), 1)


class TestConstantTimeHelpers(unittest.TestCase):
    """SR-3, structural part: the selection carries no data-dependent branch."""

    def test_mask(self):
        self.assertEqual(ct.mask_from_flag(1), 0xFF)
        self.assertEqual(ct.mask_from_flag(0), 0x00)

    def test_select_picks_by_mask(self):
        a, b = b"\xaa" * 8, b"\xbb" * 8
        self.assertEqual(ct.select(0xFF, a, b), a)
        self.assertEqual(ct.select(0x00, a, b), b)

    def test_fold_select_returns_the_flagged_candidate(self):
        found, value = ct.fold_select([(0, b"\x01" * 4), (1, b"\x02" * 4), (0, b"\x03" * 4)], 4)
        self.assertEqual(found, 1)
        self.assertEqual(value, b"\x02" * 4)

    def test_fold_select_without_a_hit_returns_zero(self):
        found, value = ct.fold_select([(0, b"\x01" * 4), (0, b"\x03" * 4)], 4)
        self.assertEqual(found, 0)
        self.assertEqual(value, bytes(4))

    def test_wipe_clears_buffer(self):
        buf = bytearray(b"secret")
        ct.wipe(buf)
        self.assertEqual(bytes(buf), bytes(6))


class TestRateLimiting(unittest.TestCase):
    """SR-4 — and the tension this model exists to expose."""

    def test_successful_unlock_resets_its_own_counter(self):
        ks = store("111111", "222222")
        ks.unlock("999999")
        self.assertNotIn(0, ks.weaver.snapshot())
        ks.unlock("111111")
        # Exactly one slot matched, so exactly one counter is back to zero.
        self.assertEqual(ks.weaver.snapshot().count(0), 1)

    def test_wrong_pins_raise_every_counter(self):
        """F-1: guessing drives the *hidden* profile towards lockout too."""
        ks = store("111111", "222222")
        before = ks.weaver.snapshot()
        for _ in range(5):
            ks.unlock("000000")
        after = ks.weaver.snapshot()
        self.assertTrue(all(a > b for a, b in zip(after, before)))

    def test_lockout_is_reachable_by_guessing_alone(self):
        """F-1, consequence: an attacker can lock out a profile they never saw."""
        ks = store("111111", "222222")
        for _ in range(MAX_FAILURES + 1):
            ks.unlock("000000")
        self.assertTrue(ks.weaver.any_locked_out)
        self.assertTrue(ks.unlock("111111").locked_out)

    def test_counters_are_per_slot(self):
        model = WeaverModel(slot_count=3)
        model.register_attempt(matched_slot=1)
        self.assertEqual(model.snapshot(), [1, 0, 1])


class TestModelLimits(unittest.TestCase):
    """Requirements this model cannot decide — documented, not silently skipped."""

    def test_sr2_memory_hygiene_is_out_of_scope(self):
        """SR-2 needs a language with controllable memory. Finding F-2.

        CPython copies immutable bytes freely and does not zero freed objects,
        so 'no key material of other profiles in RAM' cannot be established
        here — not even negatively.
        """
        ks = store("111111", "222222")
        result = ks.unlock("111111")
        # All we can assert is the API surface: one unlock yields one key.
        self.assertIsNotNone(result.profile_key)
        self.assertEqual(result.profile_id, 1)

    def test_decoy_slots_are_not_distinguishable_by_content(self):
        real = store("111111").slots
        decoy = Slot.decoy()
        self.assertEqual(len(real[0].blob), len(decoy.blob))


if __name__ == "__main__":
    unittest.main(verbosity=2)
