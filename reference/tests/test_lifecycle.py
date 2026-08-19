"""Lifecycle tests: PIN change and profile removal.

Covers the operations added in the Stufe-0 extension: re-keying a profile
without rotating its key, deleting a profile so its slot becomes a decoy
again, and the lockout/throttle interaction of both.
"""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from mlsu.keystore import KeyStore  # noqa: E402
from mlsu.params import KDF_FAST, MAX_FAILURES, SLOT_COUNT  # noqa: E402
from mlsu.storage import decode_store, encode_store  # noqa: E402


def store(*pins: str) -> KeyStore:
    ks = KeyStore(kdf=KDF_FAST)
    for profile_id, pin in enumerate(pins, start=1):
        ks.enroll(pin, profile_id)
    return ks


class TestChangePin(unittest.TestCase):
    def test_change_pin_keeps_profile_and_key(self):
        """Re-keying must not rotate the profile key (data stays encrypted
        with the same key — only the PIN-derived protector changes)."""
        ks = store("111111", "222222")
        key_before = ks.unlock("111111").profile_key
        slot, profile_id = ks.change_pin("111111", "333333")
        self.assertEqual(profile_id, 1)
        self.assertIsNotNone(slot)
        self.assertFalse(ks.unlock("111111").found, "old PIN must be dead")
        result = ks.unlock("333333")
        self.assertEqual(result.profile_id, 1)
        self.assertEqual(result.profile_key, key_before)

    def test_change_pin_wrong_old_pin(self):
        ks = store("111111")
        self.assertIsNone(ks.change_pin("999999", "333333"))

    def test_change_pin_short_new_pin_is_cli_matter(self):
        """The model itself does not enforce PIN length — the CLI does."""
        ks = store("111111")
        self.assertIsNotNone(ks.change_pin("111111", "12"))

    def test_change_pin_second_profile_unaffected(self):
        ks = store("111111", "222222")
        ks.change_pin("111111", "333333")
        self.assertEqual(ks.unlock("222222").profile_id, 2)

    def test_change_pin_locked_out(self):
        ks = store("111111")
        for _ in range(MAX_FAILURES + 1):
            ks.unlock("000000")
        self.assertIsNone(ks.change_pin("111111", "333333"))

    def test_change_pin_survives_save_load(self):
        ks = store("111111")
        ks.change_pin("111111", "333333")
        loaded = decode_store(encode_store(ks))
        self.assertEqual(loaded.unlock("333333").profile_id, 1)
        self.assertFalse(loaded.unlock("111111").found)


class TestRemoveProfile(unittest.TestCase):
    def test_remove_turns_slot_into_decoy(self):
        ks = store("111111", "222222")
        slot, profile_id = ks.remove_profile("111111")
        self.assertEqual(profile_id, 1)
        self.assertIsNotNone(slot)
        self.assertFalse(ks.unlock("111111").found, "removed profile is gone")
        # the freed slot accepts a new profile
        ks.enroll("333333", 3)
        self.assertEqual(ks.unlock("333333").profile_id, 3)

    def test_remove_keeps_other_profile(self):
        ks = store("111111", "222222")
        ks.remove_profile("111111")
        self.assertEqual(ks.unlock("222222").profile_id, 2)

    def test_remove_wrong_pin(self):
        ks = store("111111")
        self.assertIsNone(ks.remove_profile("999999"))

    def test_remove_locked_out(self):
        ks = store("111111")
        for _ in range(MAX_FAILURES + 1):
            ks.unlock("000000")
        self.assertIsNone(ks.remove_profile("111111"))

    def test_remove_survives_save_load(self):
        ks = store("111111", "222222")
        ks.remove_profile("111111")
        loaded = decode_store(encode_store(ks))
        self.assertFalse(loaded.unlock("111111").found)
        self.assertEqual(loaded.unlock("222222").profile_id, 2)
        self.assertEqual(len(loaded.slots), SLOT_COUNT, "file shape unchanged")

    def test_unlock_result_exposes_slot(self):
        ks = store("111111", "222222")
        hit = ks.unlock("111111")
        self.assertIsNotNone(hit.slot)
        self.assertIsInstance(hit.slot, int)
        self.assertIsNone(ks.unlock("999999").slot)

    def test_removed_slot_counter_is_fresh(self):
        ks = store("111111", "222222")
        ks.remove_profile("111111")
        # the removed slot is a fresh decoy: counter at 0
        self.assertIn(0, ks.weaver.snapshot())


if __name__ == "__main__":
    unittest.main()
