"""One test per P0 requirement that the model can actually speak to."""

from __future__ import annotations

import unittest

from mlsu.keystore import aead_decrypt, aead_encrypt, derive_pin_key
from mlsu.params import (
    MAX_FAILURES,
    PAYLOAD_LEN,
    PROFILE_KEY_LEN,
    SLOT_COUNT,
    throttle_seconds,
)
from mlsu.storage import save_store

from support import (
    DURESS_PIN,
    PRIVATE_PIN,
    WRONG_PIN,
    enrolled_store,
    fresh_store,
    temp_path,
)


class TestSR1IndependentKeys(unittest.TestCase):
    def test_profile_keys_are_independently_generated(self) -> None:
        store = enrolled_store()
        a = store.unlock(PRIVATE_PIN)
        b = store.unlock(DURESS_PIN)
        self.assertTrue(a.found and b.found)
        self.assertIsNotNone(a.profile_key)
        self.assertIsNotNone(b.profile_key)
        self.assertNotEqual(a.profile_key, b.profile_key)
        self.assertEqual(len(a.profile_key or b""), PROFILE_KEY_LEN)

    def test_knowing_one_pin_does_not_open_the_other(self) -> None:
        store = enrolled_store()
        self.assertEqual(store.unlock(PRIVATE_PIN).profile_id, 1)
        self.assertNotEqual(store.unlock(PRIVATE_PIN).profile_id, 2)
        self.assertEqual(store.unlock(DURESS_PIN).profile_id, 2)


class TestSR3ConstantStructure(unittest.TestCase):
    def test_every_unlock_evaluates_every_slot(self) -> None:
        store = enrolled_store()
        calls = {"n": 0}
        original = derive_pin_key

        def counting(pin, salt, kdf):
            calls["n"] += 1
            return original(pin, salt, kdf)

        import mlsu.keystore as ks

        ks.derive_pin_key = counting  # type: ignore[method-assign]
        try:
            store.unlock(PRIVATE_PIN)
            hits = calls["n"]
            calls["n"] = 0
            store.unlock(WRONG_PIN)
            misses = calls["n"]
        finally:
            ks.derive_pin_key = original  # type: ignore[method-assign]
        self.assertEqual(hits, SLOT_COUNT)
        self.assertEqual(misses, SLOT_COUNT)

    def test_evaluate_has_no_early_return_on_first_hit(self) -> None:
        store = enrolled_store()
        ev = store.evaluate(PRIVATE_PIN)
        self.assertEqual(ev.outcome.evaluated_slots, store.slot_count)
        ev2 = store.evaluate(WRONG_PIN)
        self.assertEqual(ev2.outcome.evaluated_slots, store.slot_count)


class TestSR4Counters(unittest.TestCase):
    def test_success_resets_only_the_matched_slot(self) -> None:
        store = enrolled_store()
        store.unlock(WRONG_PIN)
        before = [slot.failures for slot in store.slots]
        self.assertTrue(all(c == 1 for c in before))
        store.unlock(PRIVATE_PIN)
        matched = store.slots[[s.profile_id for s in store.slots].index(1)]
        self.assertEqual(matched.failures, 0)
        others = [s.failures for s in store.slots if s.profile_id != 1]
        self.assertTrue(all(c == 1 for c in others))

    def test_failure_increments_every_slot(self) -> None:
        store = enrolled_store()
        store.unlock(WRONG_PIN)
        self.assertEqual([s.failures for s in store.slots], [1, 1, 1, 1])

    def test_lockout_is_reachable_by_guessing_alone(self) -> None:
        store = enrolled_store()
        now = 1_700_000_000.0
        for _ in range(MAX_FAILURES):
            store.unlock(WRONG_PIN, now=now)
            now += 10_000.0
        self.assertTrue(store.any_locked_out)
        last = store.unlock(PRIVATE_PIN, now=now + 10_000.0)
        self.assertFalse(last.found)
        self.assertTrue(last.locked_out)


class TestSR8FixedFootprint(unittest.TestCase):
    def test_file_size_does_not_change_on_enrol_or_remove(self) -> None:
        store = fresh_store()
        with temp_path() as path:
            save_store(path, store)
            import os

            empty = os.path.getsize(path)
            store.enroll(PRIVATE_PIN, 1)
            save_store(path, store)
            one = os.path.getsize(path)
            store.enroll(DURESS_PIN, 2)
            save_store(path, store)
            two = os.path.getsize(path)
            store.remove_profile(PRIVATE_PIN)
            save_store(path, store)
            after = os.path.getsize(path)
        self.assertEqual(empty, one)
        self.assertEqual(one, two)
        self.assertEqual(two, after)

    def test_decoy_and_enrolled_slots_have_the_same_field_sizes(self) -> None:
        store = enrolled_store()
        sizes = {
            (len(s.salt), len(s.nonce), len(s.blob))
            for s in store.slots
        }
        self.assertEqual(len(sizes), 1)

    def test_decoy_opens_for_no_pin(self) -> None:
        store = fresh_store()
        for guess in ("0000", "471903", "abcdefgh", "99999999"):
            self.assertFalse(store.unlock(guess).found)


class TestSR9UnconditionalEvaluation(unittest.TestCase):
    def test_wrong_pin_still_visits_occupied_and_empty_slots(self) -> None:
        store = enrolled_store()
        outcome = store.unlock(WRONG_PIN)
        self.assertEqual(outcome.evaluated_slots, store.slot_count)
        self.assertFalse(outcome.found)


class TestSR12AeadFlag(unittest.TestCase):
    def test_bad_tag_returns_flag_not_exception(self) -> None:
        key = b"\x11" * 32
        nonce = b"\x22" * 12
        blob = b"\x33" * (PAYLOAD_LEN + 16)
        ok, payload = aead_decrypt(key, nonce, blob)
        self.assertFalse(ok)
        self.assertEqual(len(payload), PAYLOAD_LEN)

    def test_round_trip_valid_payload(self) -> None:
        from os import urandom

        key = urandom(32)
        nonce = urandom(12)
        payload = bytes([7]) + urandom(32)
        blob = aead_encrypt(key, nonce, payload)
        ok, out = aead_decrypt(key, nonce, blob)
        self.assertTrue(ok)
        self.assertEqual(out, payload)


class TestFR1PinSelectsProfile(unittest.TestCase):
    def test_pin_alone_selects_the_area(self) -> None:
        store = enrolled_store()
        self.assertEqual(store.unlock(PRIVATE_PIN).profile_id, 1)
        self.assertEqual(store.unlock(DURESS_PIN).profile_id, 2)
        self.assertIsNone(store.unlock(WRONG_PIN).profile_id)


class TestThrottleSchedule(unittest.TestCase):
    def test_throttle_steps(self) -> None:
        self.assertEqual(throttle_seconds(0), 0)
        self.assertEqual(throttle_seconds(4), 0)
        self.assertEqual(throttle_seconds(5), 30)
        self.assertEqual(throttle_seconds(9), 30)
        self.assertEqual(throttle_seconds(10), 300)
        self.assertEqual(throttle_seconds(20), 3600)

    def test_throttled_attempt_does_not_charge(self) -> None:
        store = enrolled_store()
        now = 1_000.0
        for _ in range(5):
            store.unlock(WRONG_PIN, now=now)
        self.assertEqual(store.slots[0].failures, 5)
        blocked = store.unlock(WRONG_PIN, now=now + 1.0)
        self.assertGreater(blocked.throttled_remaining, 0)
        self.assertEqual(store.slots[0].failures, 5)


if __name__ == "__main__":
    unittest.main()
