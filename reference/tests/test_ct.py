"""Branch-free folding: the Python specification for ct_core."""

from __future__ import annotations

import unittest

from mlsu.ct import fold_select
from mlsu.params import PAYLOAD_LEN


class TestFoldSelect(unittest.TestCase):
    def test_no_match(self) -> None:
        found, payload = fold_select(
            [(0, b"\x01" * PAYLOAD_LEN), (0, b"\x02" * PAYLOAD_LEN)],
            PAYLOAD_LEN,
        )
        self.assertFalse(found)
        self.assertEqual(payload, b"\x00" * PAYLOAD_LEN)

    def test_first_match(self) -> None:
        target = bytes([3]) + b"\xab" * 32
        found, payload = fold_select(
            [(1, target), (0, b"\xff" * PAYLOAD_LEN)],
            PAYLOAD_LEN,
        )
        self.assertTrue(found)
        self.assertEqual(payload, target)

    def test_last_match(self) -> None:
        target = bytes([9]) + b"\xcd" * 32
        found, payload = fold_select(
            [(0, b"\xff" * PAYLOAD_LEN), (0, b"\xee" * PAYLOAD_LEN), (1, target)],
            PAYLOAD_LEN,
        )
        self.assertTrue(found)
        self.assertEqual(payload, target)

    def test_two_matches_are_ored(self) -> None:
        a = bytes([0b0001]) + b"\x01" * 32
        b = bytes([0b0100]) + b"\x02" * 32
        found, payload = fold_select([(1, a), (1, b)], PAYLOAD_LEN)
        self.assertTrue(found)
        self.assertEqual(payload[0], 0b0101)
        self.assertEqual(payload[1], 0x03)

    def test_empty_candidate_list(self) -> None:
        found, payload = fold_select([], 4)
        self.assertFalse(found)
        self.assertEqual(payload, b"\x00" * 4)

    def test_short_payload_is_padded(self) -> None:
        found, payload = fold_select([(1, b"\xff")], 4)
        self.assertTrue(found)
        self.assertEqual(payload, b"\xff\x00\x00\x00")


if __name__ == "__main__":
    unittest.main()
