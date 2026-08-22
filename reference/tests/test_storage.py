"""Persistence: fixed layout, atomic write, validation."""

from __future__ import annotations

import os
import unittest

from mlsu.params import KDF_TEST, SLOT_COUNT, store_file_size
from mlsu.storage import (
    StoreError,
    create_store,
    deserialize,
    load_store,
    save_store,
    serialize,
)

from support import DURESS_PIN, PRIVATE_PIN, enrolled_store, fresh_store, temp_path


class TestSerializeRoundTrip(unittest.TestCase):
    def test_round_trip_preserves_slots(self) -> None:
        store = enrolled_store()
        store.unlock("000000")
        restored = deserialize(serialize(store))
        self.assertEqual(restored.slot_count, store.slot_count)
        self.assertEqual(restored.kdf.name, store.kdf.name)
        self.assertEqual(restored.enrolled_count(), 2)
        self.assertEqual(restored.unlock(PRIVATE_PIN).profile_id, 1)
        self.assertEqual(restored.unlock(DURESS_PIN).profile_id, 2)

    def test_serialized_size_is_canonical(self) -> None:
        store = fresh_store()
        self.assertEqual(len(serialize(store)), store_file_size(SLOT_COUNT))


class TestAtomicFile(unittest.TestCase):
    def test_create_and_load(self) -> None:
        with temp_path() as path:
            created = create_store(path, KDF_TEST, slot_count=4)
            created.enroll(PRIVATE_PIN, 1)
            save_store(path, created)
            loaded = load_store(path)
            self.assertEqual(loaded.unlock(PRIVATE_PIN).profile_id, 1)
            self.assertEqual(os.path.getsize(path), store_file_size(4))

    def test_missing_store(self) -> None:
        with self.assertRaises(StoreError):
            load_store("/tmp/mlsu-does-not-exist-xyz.store")

    def test_bad_magic(self) -> None:
        with temp_path() as path:
            with open(path, "wb") as handle:
                handle.write(b"XXXX" + b"\x00" * 100)
            with self.assertRaises(StoreError):
                load_store(path)

    def test_truncated_file(self) -> None:
        with temp_path() as path:
            create_store(path, KDF_TEST, slot_count=4)
            with open(path, "r+b") as handle:
                handle.truncate(16)
            with self.assertRaises(StoreError):
                load_store(path)

    def test_unknown_version(self) -> None:
        store = fresh_store()
        data = bytearray(serialize(store))
        data[4] = 99
        with self.assertRaises(StoreError):
            deserialize(bytes(data))

    def test_unknown_kdf_id(self) -> None:
        store = fresh_store()
        data = bytearray(serialize(store))
        data[6] = 42
        with self.assertRaises(StoreError):
            deserialize(bytes(data))


class TestStatusByteDeviation(unittest.TestCase):
    def test_status_byte_is_readable(self) -> None:
        """Documented SR-8 deviation: occupancy is in the clear."""

        store = enrolled_store()
        data = serialize(store)
        occupied = 0
        # header 32, each record starts with status
        for i in range(store.slot_count):
            status = data[32 + i * 94]
            if status == 1:
                occupied += 1
        self.assertEqual(occupied, 2)


if __name__ == "__main__":
    unittest.main()
