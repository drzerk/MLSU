"""PIN change, profile removal, session lock, enrolment rules."""

from __future__ import annotations

import unittest

from mlsu.params import MIN_PIN_LEN

from support import DURESS_PIN, PRIVATE_PIN, THIRD_PIN, WRONG_PIN, enrolled_store, fresh_store


class TestChangePin(unittest.TestCase):
    def test_profile_key_survives_pin_change(self) -> None:
        store = enrolled_store()
        before = store.unlock(PRIVATE_PIN)
        self.assertTrue(before.found)
        result = store.change_pin(PRIVATE_PIN, "135790")
        self.assertIsNotNone(result)
        after = store.unlock("135790")
        self.assertTrue(after.found)
        self.assertEqual(after.profile_id, before.profile_id)
        self.assertEqual(after.profile_key, before.profile_key)
        self.assertFalse(store.unlock(PRIVATE_PIN).found)

    def test_wrong_old_pin_is_rejected(self) -> None:
        store = enrolled_store()
        self.assertIsNone(store.change_pin(WRONG_PIN, "135790"))

    def test_new_pin_must_meet_minimum_length(self) -> None:
        store = enrolled_store()
        with self.assertRaises(ValueError):
            store.change_pin(PRIVATE_PIN, "1" * (MIN_PIN_LEN - 1))


class TestRemoveProfile(unittest.TestCase):
    def test_removed_slot_becomes_decoy(self) -> None:
        store = enrolled_store()
        removed = store.remove_profile(PRIVATE_PIN)
        self.assertIsNotNone(removed)
        slot_idx, profile_id = removed  # type: ignore[misc]
        self.assertEqual(profile_id, 1)
        self.assertFalse(store.slots[slot_idx].enrolled)
        self.assertFalse(store.unlock(PRIVATE_PIN).found)
        self.assertEqual(store.unlock(DURESS_PIN).profile_id, 2)

    def test_remove_wrong_pin(self) -> None:
        store = enrolled_store()
        self.assertIsNone(store.remove_profile(WRONG_PIN))
        self.assertEqual(store.enrolled_count(), 2)


class TestEnrollRules(unittest.TestCase):
    def test_duplicate_profile_id_rejected(self) -> None:
        store = enrolled_store()
        with self.assertRaises(ValueError):
            store.enroll(THIRD_PIN, 1)

    def test_duplicate_pin_rejected(self) -> None:
        store = enrolled_store()
        with self.assertRaises(ValueError):
            store.enroll(PRIVATE_PIN, 9)

    def test_full_store_rejected(self) -> None:
        store = fresh_store(slot_count=2)
        store.enroll("111111", 1)
        store.enroll("222222", 2)
        with self.assertRaises(ValueError):
            store.enroll("333333", 3)

    def test_short_pin_rejected(self) -> None:
        store = fresh_store()
        with self.assertRaises(ValueError):
            store.enroll("12", 1)

    def test_profile_id_range(self) -> None:
        store = fresh_store()
        with self.assertRaises(ValueError):
            store.enroll("123456", 256)

    def test_enroll_picks_a_free_slot(self) -> None:
        store = fresh_store()
        used = {store.enroll(f"10000{i}", i + 1) for i in range(4)}
        self.assertEqual(used, {0, 1, 2, 3})


class TestSessionLock(unittest.TestCase):
    def test_lock_clears_active_profile(self) -> None:
        store = enrolled_store()
        store.unlock(PRIVATE_PIN)
        self.assertEqual(store.active_profile_id, 1)
        store.lock()
        self.assertIsNone(store.active_profile_id)

    def test_failure_clears_session(self) -> None:
        store = enrolled_store()
        store.unlock(PRIVATE_PIN)
        store.unlock(WRONG_PIN)
        self.assertIsNone(store.active_profile_id)


class TestEvaluateCommit(unittest.TestCase):
    def test_evaluate_does_not_mutate_counters(self) -> None:
        store = enrolled_store()
        before = [s.failures for s in store.slots]
        store.evaluate(WRONG_PIN)
        self.assertEqual([s.failures for s in store.slots], before)

    def test_commit_failure_charges_all(self) -> None:
        store = enrolled_store()
        ev = store.evaluate(WRONG_PIN)
        store.commit(ev)
        self.assertEqual([s.failures for s in store.slots], [1, 1, 1, 1])

    def test_commit_success_resets_only_match(self) -> None:
        store = enrolled_store()
        store.unlock(WRONG_PIN)
        ev = store.evaluate(PRIVATE_PIN)
        store.commit(ev)
        matched = next(s for s in store.slots if s.profile_id == 1)
        self.assertEqual(matched.failures, 0)


if __name__ == "__main__":
    unittest.main()
