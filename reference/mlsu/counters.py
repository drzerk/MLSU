"""Model of hardware-enforced rate limiting (Weaver / Gatekeeper).

Real Weaver gives each slot an independent failure counter and a throttle the
software side cannot skip. This models the observable behaviour, not the
hardware.

The interesting property is not the throttle curve — it is what happens to the
counters of the profiles that were *not* being unlocked. See finding F-1.
"""
from dataclasses import dataclass, field
import time

from .params import MAX_FAILURES


def throttle_seconds(failures: int) -> float:
    """Delay imposed before the next attempt is accepted.

    Roughly the shape Android uses: free attempts, then a growing delay.
    """
    if failures < 5:
        return 0.0
    if failures < 10:
        return 30.0
    if failures < 20:
        return 300.0
    return 3600.0


@dataclass
class SlotCounter:
    failures: int = 0
    #: Unix timestamp of the last failed attempt charged to this slot, or
    #: ``None`` if no delay is pending (fresh slot, or the matching slot was
    #: unlocked successfully). Persisted so a restart cannot reset the clock
    #: on the throttle — hardware would keep this state too. The file format
    #: encodes ``None`` as -1.0.
    last_failure_at: float | None = None

    @property
    def locked_out(self) -> bool:
        return self.failures >= MAX_FAILURES

    @property
    def delay(self) -> float:
        return throttle_seconds(self.failures)


@dataclass
class WeaverModel:
    """One counter per slot, as SR-4 requires."""

    slot_count: int
    counters: list[SlotCounter] = field(default_factory=list)

    def __post_init__(self) -> None:
        if not self.counters:
            self.counters = [SlotCounter() for _ in range(self.slot_count)]

    def register_attempt(self, matched_slot: int | None, now: float | None = None) -> None:
        """Account one unlock attempt across all slots.

        Every slot was tried — that is what SR-3 demands — so every slot that
        did not match records a failure. Only the matching slot resets.

        This is where the model bites: an attacker who guesses PINs drives the
        counters of profiles they have never seen towards lockout. The
        alternative — incrementing only the counter of the profile the user
        "meant" — is not implementable, because a failed attempt carries no
        information about which profile was intended.
        """
        now = time.time() if now is None else now
        for index, counter in enumerate(self.counters):
            if index == matched_slot:
                counter.failures = 0
                counter.last_failure_at = None
            else:
                counter.failures += 1
                counter.last_failure_at = now

    def reset(self) -> None:
        """Clear all counters.

        No production system may offer this — it exists so measurements can
        isolate the unlock path from the rate limiter. Rate limiting is not a
        timing property; leaving it engaged during a timing run measures the
        lockout branch instead of the KDF.
        """
        for counter in self.counters:
            counter.failures = 0
            counter.last_failure_at = None

    @property
    def any_locked_out(self) -> bool:
        return any(c.locked_out for c in self.counters)

    def snapshot(self) -> list[int]:
        return [c.failures for c in self.counters]
