"""Weaver counter model."""

from __future__ import annotations

import unittest

from mlsu.counters import (
    SlotCounter,
    any_locked_out,
    charge_failure,
    rate_limit_remaining,
    record_success,
    reset_all,
)
from mlsu.params import MAX_FAILURES


class TestSlotCounter(unittest.TestCase):
    def test_no_delay_below_five(self) -> None:
        counter = SlotCounter(failures=4, last_failure_at=10.0)
        self.assertEqual(counter.remaining(11.0), 0.0)
        self.assertFalse(counter.locked_out)

    def test_delay_counts_down(self) -> None:
        counter = SlotCounter(failures=5, last_failure_at=100.0)
        self.assertAlmostEqual(counter.remaining(110.0), 20.0)
        self.assertEqual(counter.remaining(130.0), 0.0)

    def test_lockout_is_infinite(self) -> None:
        counter = SlotCounter(failures=MAX_FAILURES, last_failure_at=1.0)
        self.assertTrue(counter.locked_out)
        self.assertEqual(counter.remaining(1e12), float("inf"))


class TestAggregate(unittest.TestCase):
    def test_remaining_is_the_max_across_slots(self) -> None:
        counters = [
            SlotCounter(failures=5, last_failure_at=0.0),
            SlotCounter(failures=10, last_failure_at=0.0),
        ]
        # at t=10: first has 20s left, second has 290s left
        self.assertAlmostEqual(rate_limit_remaining(counters, 10.0), 290.0)

    def test_charge_and_success(self) -> None:
        counters = [SlotCounter(), SlotCounter(), SlotCounter()]
        charge_failure(counters, 50.0)
        self.assertEqual([c.failures for c in counters], [1, 1, 1])
        record_success(counters, 1)
        self.assertEqual(counters[0].failures, 1)
        self.assertEqual(counters[1].failures, 0)
        self.assertIsNone(counters[1].last_failure_at)
        self.assertEqual(counters[2].failures, 1)

    def test_reset_all(self) -> None:
        counters = [SlotCounter(3, 1.0), SlotCounter(MAX_FAILURES, 2.0)]
        reset_all(counters)
        self.assertFalse(any_locked_out(counters))
        self.assertEqual([c.failures for c in counters], [0, 0])

    def test_charge_does_not_exceed_max(self) -> None:
        counters = [SlotCounter(failures=MAX_FAILURES, last_failure_at=1.0)]
        charge_failure(counters, 2.0)
        self.assertEqual(counters[0].failures, MAX_FAILURES)


if __name__ == "__main__":
    unittest.main()
