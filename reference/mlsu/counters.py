"""Model of hardware rate limiting (Weaver).

Semantics taken from ``IWeaver.aidl`` as verified in P1:

* throttling is *per slot*
* a successful read of one slot does not reset another slot
* a failed attempt that is refused because the slot is already throttled
  does not further charge the counter (the hardware would not accept it)

Finding F-1: because unlock must evaluate every slot, a *miss* charges every
slot. A *hit* resets only the matched slot (SR-4 as restated after F-1).
"""

from __future__ import annotations

from typing import Iterable, Optional, Sequence

from .params import MAX_FAILURES, throttle_seconds


class SlotCounter:
    """Failure counter + last-failure timestamp for one Weaver slot."""

    __slots__ = ("failures", "last_failure_at")

    def __init__(self, failures: int = 0, last_failure_at: Optional[float] = None) -> None:
        self.failures = int(failures)
        self.last_failure_at = last_failure_at

    @property
    def locked_out(self) -> bool:
        return self.failures >= MAX_FAILURES

    def delay(self) -> float:
        return throttle_seconds(self.failures)

    def remaining(self, now: float) -> float:
        if self.locked_out:
            return float("inf")
        delay = self.delay()
        if delay <= 0 or self.last_failure_at is None:
            return 0.0
        elapsed = now - self.last_failure_at
        if elapsed >= delay:
            return 0.0
        return delay - elapsed


def any_locked_out(counters: Sequence[SlotCounter]) -> bool:
    return any(c.locked_out for c in counters)


def rate_limit_remaining(counters: Sequence[SlotCounter], now: float) -> float:
    """Refuse the whole attempt if *any* slot is still cooling down.

    Revealing *which* slot is throttled would leak occupancy. The model
    therefore takes the maximum remaining delay across all slots.
    """

    if any_locked_out(counters):
        return float("inf")
    remaining = 0.0
    for counter in counters:
        remaining = max(remaining, counter.remaining(now))
    return remaining


def charge_failure(counters: Iterable[SlotCounter], now: float) -> None:
    """A miss charges every slot (F-1)."""

    for counter in counters:
        if counter.failures < MAX_FAILURES:
            counter.failures += 1
        counter.last_failure_at = now


def record_success(counters: Sequence[SlotCounter], matched_index: int) -> None:
    """A hit resets only the matched slot; others stay untouched (SR-4)."""

    counters[matched_index].failures = 0
    counters[matched_index].last_failure_at = None


def reset_all(counters: Iterable[SlotCounter]) -> None:
    for counter in counters:
        counter.failures = 0
        counter.last_failure_at = None
