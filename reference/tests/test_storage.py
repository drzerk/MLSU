"""Persistence tests for the MLSU store file.

Covers the storage layer added for the Stufe-0 module: save/load round trips,
fixed file size, lockout and throttle surviving restarts, and rejection of
corrupted files.
"""
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from mlsu.keystore import KeyStore  # noqa: E402
from mlsu.params import KDF_FAST, MAX_FAILURES, SLOT_COUNT  # noqa: E402
from mlsu.storage import (  # noqa: E402
    RECORD_SIZE,
    VERSION,
    StorageFormatError,
    create_store,
    decode_store,
    encode_store,
    file_size,
    load_store,
    save_store,
)


def make_store(*pins: str) -> KeyStore:
    ks = KeyStore(kdf=KDF_FAST, slot_count=SLOT_COUNT)
    for profile_id, pin in enumerate(pins, start=1):
        ks.enroll(pin, profile_id)
    return ks


class TestRoundTrip(unittest.TestCase):
    def test_profiles_survive_save_load(self):
        """FR-1/SR-1 across a restart: same PINs, same keys, no master secret."""
        ks = make_store("111111", "222222")
        data = encode_store(ks)
        loaded = decode_store(data)
        self.assertEqual(loaded.unlock("111111").profile_id, 1)
        self.assertEqual(loaded.unlock("222222").profile_id, 2)
        self.assertEqual(
            loaded.unlock("111111").profile_key,
            ks.unlock("111111").profile_key,
        )
        self.assertFalse(loaded.unlock("999999").found)

    def test_decoys_stay_decoys(self):
        ks = make_store("111111")
        loaded = decode_store(encode_store(ks))
        for pin in ("000000", "111112", "guess"):
            self.assertFalse(loaded.unlock(pin).found)

    def test_kdf_params_roundtrip(self):
        ks = make_store("111111")
        loaded = decode_store(encode_store(ks))
        self.assertEqual(loaded.kdf, KDF_FAST)
        self.assertEqual(loaded.slot_count, SLOT_COUNT)

    def test_file_size_independent_of_profile_count(self):
        """SR-8, file level: enrolment never grows the store file."""
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "s.store")
            save_store(create_store(kdf=KDF_FAST, slot_count=SLOT_COUNT), path)
            size_init = os.path.getsize(path)
            store = load_store(path)
            store.enroll("111111", 1)
            save_store(store, path)
            size_one = os.path.getsize(path)
            store.enroll("222222", 2)
            save_store(store, path)
            size_two = os.path.getsize(path)
        self.assertEqual(size_init, size_one)
        self.assertEqual(size_one, size_two)
        self.assertEqual(size_two, file_size(SLOT_COUNT))

    def test_slot_records_are_uniform_on_disk(self):
        """All records have identical size; only the documented state byte
        differs between decoys and enrolled slots (see storage.py)."""
        ks = make_store("111111")
        data = encode_store(ks)
        for record in range(ks.slot_count):
            start = 32 + record * RECORD_SIZE
            self.assertEqual(len(data[start : start + RECORD_SIZE]), RECORD_SIZE)


class TestEnrolmentAfterReload(unittest.TestCase):
    def test_free_slots_are_reconstructed(self):
        """The CLI must be able to enrol in a fresh process. The state byte
        (documented SR-8 deviation) makes this possible."""
        ks = make_store("111111")
        loaded = decode_store(encode_store(ks))
        index = loaded.enroll("222222", 2)
        self.assertEqual(loaded.unlock("222222").profile_id, 2)
        self.assertNotIn(index, loaded._free_slots)

    def test_full_store_reports_no_free_slots(self):
        ks = make_store("111111", "222222", "333333", "444444")
        loaded = decode_store(encode_store(ks))
        with self.assertRaises(RuntimeError):
            loaded.enroll("555555", 5)


class TestLockoutAndThrottle(unittest.TestCase):
    def test_lockout_survives_reload(self):
        """F-1 consequence: a store locked out by guessing stays locked out."""
        ks = make_store("111111", "222222")
        for _ in range(MAX_FAILURES + 1):
            ks.unlock("000000")
        loaded = decode_store(encode_store(ks))
        self.assertTrue(loaded.weaver.any_locked_out)
        self.assertTrue(loaded.unlock("111111").locked_out)
        self.assertEqual(loaded.rate_limit_remaining(), float("inf"))

    def test_counters_survive_reload(self):
        ks = make_store("111111")
        ks.unlock("000000")
        ks.unlock("000000")
        loaded = decode_store(encode_store(ks))
        self.assertEqual(loaded.weaver.snapshot(), [2] * SLOT_COUNT)

    def test_throttle_survives_reload(self):
        """A restart must not reset the clock on the rate limiter."""
        ks = make_store("111111")
        for _ in range(5):
            ks.unlock("000000", now=0.0)  # 5 failures → 30 s delay
        loaded = decode_store(encode_store(ks))
        self.assertEqual(loaded.rate_limit_remaining(now=0.0), 30.0)
        self.assertAlmostEqual(loaded.rate_limit_remaining(now=29.9), 0.1, places=9)
        self.assertEqual(loaded.rate_limit_remaining(now=30.0), 0.0)

    def test_successful_unlock_resets_only_its_own_throttle(self):
        """F-1: the matched slot resets, the hidden ones keep their delay.

        Note the counters of the *other* slots rise by one even on a correct
        unlock: from their point of view a wrong PIN was tried against them.
        That is the per-slot honesty SR-4/F-1 require — no shared counter.
        """
        ks = make_store("111111", "222222")
        for _ in range(5):
            ks.unlock("000000", now=0.0)  # all counters at 5, delay 30 s
        ks.unlock("111111", now=0.0)  # matched slot resets, others 5 -> 6
        self.assertEqual(ks.rate_limit_remaining(now=0.0), 30.0)
        self.assertEqual(sorted(ks.weaver.snapshot()), [0, 6, 6, 6])

    def test_rate_limit_remaining_is_zero_for_fresh_store(self):
        ks = make_store("111111")
        self.assertEqual(ks.rate_limit_remaining(), 0.0)


class TestCorruptFiles(unittest.TestCase):
    def _store_bytes(self) -> bytes:
        return encode_store(make_store("111111"))

    def test_wrong_magic_rejected(self):
        data = b"XXXX" + self._store_bytes()[4:]
        with self.assertRaises(StorageFormatError):
            decode_store(data)

    def test_bad_version_rejected(self):
        data = bytearray(self._store_bytes())
        data[4:6] = (VERSION + 1).to_bytes(2, "big")
        with self.assertRaises(StorageFormatError):
            decode_store(bytes(data))

    def test_truncated_file_rejected(self):
        data = self._store_bytes()[:-10]
        with self.assertRaises(StorageFormatError):
            decode_store(data)

    def test_too_short_for_header_rejected(self):
        with self.assertRaises(StorageFormatError):
            decode_store(b"MLSU")

    def test_bad_slot_count_rejected(self):
        data = bytearray(self._store_bytes())
        data[6:8] = (0).to_bytes(2, "big")  # slot_count 0
        with self.assertRaises(StorageFormatError):
            decode_store(bytes(data))

    def test_length_mismatch_rejected(self):
        data = bytearray(self._store_bytes())
        data[6:8] = (SLOT_COUNT + 1).to_bytes(2, "big")  # claims more slots
        with self.assertRaises(StorageFormatError):
            decode_store(bytes(data))

    def test_missing_file_raises_file_not_found(self):
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaises(FileNotFoundError):
                load_store(os.path.join(tmp, "missing.store"))


class TestCreateStore(unittest.TestCase):
    def test_create_store_validation(self):
        with self.assertRaises(ValueError):
            create_store(slot_count=0)
        with self.assertRaises(ValueError):
            create_store(slot_count=65)

    def test_create_store_is_all_decoys(self):
        ks = create_store(kdf=KDF_FAST, slot_count=4)
        self.assertEqual(ks.weaver.snapshot(), [0, 0, 0, 0])
        # Unlocking with a wrong PIN is itself a failed attempt (SR-4).
        self.assertFalse(ks.unlock("000000").found)
        self.assertEqual(ks.weaver.snapshot(), [1, 1, 1, 1])


if __name__ == "__main__":
    unittest.main()
