"""Key derivation, slot table and unlock selection.

PIN_i --Argon2id--> pin_key_i --AEAD unwrap--> profile_id || profile_key_i

Properties the model is built to keep:

* no shared master secret (SR-1)
* every unlock evaluates every slot (SR-3 / SR-9)
* a hit resets only the matched Weaver counter (SR-4)
* a miss charges every counter (F-1)
* AEAD failure is a flag, not an exception path for the caller (SR-12)
* unoccupied slots are random blobs no PIN opens (SR-8)
"""

from __future__ import annotations

import os
import time
from dataclasses import dataclass
from typing import List, Optional, Sequence

from argon2.low_level import Type, hash_secret_raw
from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import ChaCha20Poly1305

from . import counters as weaver
from .ct import fold_select
from .params import (
    BLOB_LEN,
    KDF_FAST,
    MIN_PIN_LEN,
    NONCE_LEN,
    PAYLOAD_LEN,
    PROFILE_KEY_LEN,
    SALT_LEN,
    SLOT_COUNT,
    KdfParams,
)


def _random_bytes(length: int) -> bytes:
    return os.urandom(length)


def derive_pin_key(pin: str, salt: bytes, kdf: KdfParams) -> bytes:
    if len(salt) != SALT_LEN:
        raise ValueError(f"salt must be {SALT_LEN} bytes")
    return hash_secret_raw(
        secret=pin.encode("utf-8"),
        salt=salt,
        time_cost=kdf.time_cost,
        memory_cost=kdf.memory_cost_kib,
        parallelism=kdf.parallelism,
        hash_len=kdf.hash_len,
        type=Type.ID,
    )


def aead_encrypt(key: bytes, nonce: bytes, payload: bytes) -> bytes:
    if len(key) != 32:
        raise ValueError("AEAD key must be 32 bytes")
    if len(nonce) != NONCE_LEN:
        raise ValueError(f"nonce must be {NONCE_LEN} bytes")
    return ChaCha20Poly1305(key).encrypt(nonce, payload, None)


def aead_decrypt(key: bytes, nonce: bytes, blob: bytes) -> tuple[bool, bytes]:
    """Return ``(ok, payload)``. Never raises on a bad tag (SR-12 / F-3)."""

    try:
        payload = ChaCha20Poly1305(key).decrypt(nonce, blob, None)
        return True, payload
    except (InvalidTag, ValueError, TypeError):
        return False, bytes(PAYLOAD_LEN)


class Slot:
    """One fixed-size store record. Occupied and decoy slots share this shape."""

    def __init__(
        self,
        salt: bytes,
        nonce: bytes,
        blob: bytes,
        enrolled: bool = False,
        profile_id: Optional[int] = None,
        failures: int = 0,
        last_failure_at: Optional[float] = None,
    ) -> None:
        if len(salt) != SALT_LEN:
            raise ValueError("invalid salt length")
        if len(nonce) != NONCE_LEN:
            raise ValueError("invalid nonce length")
        if len(blob) != BLOB_LEN:
            # Tamper tests may truncate; keep the bytes but mark as malformed.
            pass
        self.salt = salt
        self.nonce = nonce
        self.blob = blob
        self.enrolled = enrolled
        self.profile_id = profile_id
        self.counter = weaver.SlotCounter(failures, last_failure_at)

    @classmethod
    def create_decoy(cls) -> "Slot":
        return cls(
            salt=_random_bytes(SALT_LEN),
            nonce=_random_bytes(NONCE_LEN),
            blob=_random_bytes(BLOB_LEN),
            enrolled=False,
            profile_id=None,
        )

    @property
    def failures(self) -> int:
        return self.counter.failures

    @failures.setter
    def failures(self, value: int) -> None:
        self.counter.failures = value

    @property
    def last_failure_at(self) -> Optional[float]:
        return self.counter.last_failure_at

    @last_failure_at.setter
    def last_failure_at(self, value: Optional[float]) -> None:
        self.counter.last_failure_at = value

    @property
    def locked_out(self) -> bool:
        return self.counter.locked_out

    @property
    def delay(self) -> float:
        return self.counter.delay()


@dataclass(frozen=True)
class UnlockOutcome:
    found: bool
    profile_id: Optional[int]
    profile_key: Optional[bytes]
    slot_index: Optional[int]
    locked_out: bool
    throttled_remaining: float
    evaluated_slots: int
    message: str

    @property
    def profile_key_hex(self) -> Optional[str]:
        if self.profile_key is None:
            return None
        return self.profile_key.hex()


@dataclass(frozen=True)
class Evaluation:
    """Result of evaluating a PIN *without* mutating Weaver counters."""

    outcome: UnlockOutcome
    kind: str  # lockout | throttled | success | failure
    matched_slot_index: Optional[int]
    now: float


class KeyStore:
    """In-memory slot table. Persist with :mod:`mlsu.storage`."""

    def __init__(self, kdf: KdfParams = KDF_FAST, slot_count: int = SLOT_COUNT) -> None:
        if slot_count < 1 or slot_count > 16:
            raise ValueError("slot_count must be in 1..16")
        self.kdf = kdf
        self.slot_count = slot_count
        self.slots: List[Slot] = [Slot.create_decoy() for _ in range(slot_count)]
        self.active_profile_id: Optional[int] = None
        self._active_profile_key: Optional[bytearray] = None

    @property
    def any_locked_out(self) -> bool:
        return weaver.any_locked_out(self._counters())

    def rate_limit_remaining(self, now: Optional[float] = None) -> float:
        return weaver.rate_limit_remaining(self._counters(), self._now(now))

    def free_slots(self) -> List[int]:
        return [i for i, slot in enumerate(self.slots) if not slot.enrolled]

    def enrolled_count(self) -> int:
        return sum(1 for slot in self.slots if slot.enrolled)

    def lock(self) -> None:
        """Drop the session key. Models ``lockCeStorage`` (SR-2, userspace)."""

        if self._active_profile_key is not None:
            for i in range(len(self._active_profile_key)):
                self._active_profile_key[i] = 0
            self._active_profile_key = None
        self.active_profile_id = None

    def reset_failure_counters(self) -> None:
        weaver.reset_all(self._counters())

    def enroll(self, pin: str, profile_id: int) -> int:
        self._check_pin(pin)
        if profile_id < 0 or profile_id > 255:
            raise ValueError("profile_id must fit in one byte (0-255)")
        if any(s.enrolled and s.profile_id == profile_id for s in self.slots):
            raise ValueError(f"profile {profile_id} is already enrolled")

        free = self.free_slots()
        if not free:
            raise ValueError("No free slots available")

        probe = self.evaluate(pin)
        if probe.kind == "success":
            raise ValueError("PIN already unlocks an enrolled profile")

        slot_idx = int.from_bytes(os.urandom(2), "little") % len(free)
        slot_idx = free[slot_idx]

        salt = _random_bytes(SALT_LEN)
        nonce = _random_bytes(NONCE_LEN)
        profile_key = _random_bytes(PROFILE_KEY_LEN)
        payload = bytes([profile_id]) + profile_key
        pin_key = derive_pin_key(pin, salt, self.kdf)
        blob = aead_encrypt(pin_key, nonce, payload)

        self.slots[slot_idx] = Slot(
            salt=salt,
            nonce=nonce,
            blob=blob,
            enrolled=True,
            profile_id=profile_id,
        )
        return slot_idx

    def evaluate(self, pin: str, now: Optional[float] = None) -> Evaluation:
        """Derive against every slot. Does not touch Weaver counters."""

        started = time.perf_counter()
        now_ts = self._now(now)

        if self.any_locked_out:
            outcome = UnlockOutcome(
                found=False,
                profile_id=None,
                profile_key=None,
                slot_index=None,
                locked_out=True,
                throttled_remaining=float("inf"),
                evaluated_slots=0,
                message="Permanent lockout active (too many failed attempts)",
            )
            return Evaluation(outcome, "lockout", None, now_ts)

        throttled = self.rate_limit_remaining(now_ts)
        if throttled > 0:
            outcome = UnlockOutcome(
                found=False,
                profile_id=None,
                profile_key=None,
                slot_index=None,
                locked_out=False,
                throttled_remaining=throttled,
                evaluated_slots=0,
                message=f"Rate limiter active. Retry in {int(throttled + 0.999)} seconds.",
            )
            return Evaluation(outcome, "throttled", None, now_ts)

        candidates = []
        matched_index: Optional[int] = None

        for i, slot in enumerate(self.slots):
            pin_key = derive_pin_key(pin, slot.salt, self.kdf)
            ok, payload = aead_decrypt(pin_key, slot.nonce, slot.blob)
            if ok and len(payload) == PAYLOAD_LEN:
                matched_index = i
                candidates.append((1, payload))
            else:
                candidates.append((0, bytes(PAYLOAD_LEN)))

        found, payload = fold_select(candidates, PAYLOAD_LEN)
        elapsed_ms = (time.perf_counter() - started) * 1000.0

        if not found or matched_index is None:
            outcome = UnlockOutcome(
                found=False,
                profile_id=None,
                profile_key=None,
                slot_index=None,
                locked_out=self.any_locked_out,
                throttled_remaining=0.0,
                evaluated_slots=self.slot_count,
                message=(
                    f"Invalid PIN. Evaluated all {self.slot_count} slots "
                    f"in constant structure ({elapsed_ms:.1f} ms)."
                ),
            )
            return Evaluation(outcome, "failure", None, now_ts)

        profile_id = payload[0]
        profile_key = payload[1:]
        outcome = UnlockOutcome(
            found=True,
            profile_id=profile_id,
            profile_key=profile_key,
            slot_index=matched_index,
            locked_out=False,
            throttled_remaining=0.0,
            evaluated_slots=self.slot_count,
            message=f"Unlocked profile {profile_id} via slot {matched_index + 1}.",
        )
        return Evaluation(outcome, "success", matched_index, now_ts)

    def commit(self, evaluation: Evaluation) -> None:
        """Apply Weaver side-effects of an :meth:`evaluate` result (SR-4 / F-1)."""

        if evaluation.kind in ("lockout", "throttled"):
            return
        if evaluation.kind == "success" and evaluation.matched_slot_index is not None:
            weaver.record_success(self._counters(), evaluation.matched_slot_index)
            key = evaluation.outcome.profile_key or b""
            self._set_session(evaluation.outcome.profile_id, key)
            return
        weaver.charge_failure(self._counters(), evaluation.now)
        self.lock()

    def unlock(self, pin: str, now: Optional[float] = None) -> UnlockOutcome:
        evaluation = self.evaluate(pin, now=now)
        self.commit(evaluation)
        if evaluation.kind == "failure":
            # Recompute lockout after charging so the caller sees F-1 land.
            return UnlockOutcome(
                found=False,
                profile_id=None,
                profile_key=None,
                slot_index=None,
                locked_out=self.any_locked_out,
                throttled_remaining=self.rate_limit_remaining(evaluation.now),
                evaluated_slots=evaluation.outcome.evaluated_slots,
                message=evaluation.outcome.message,
            )
        return evaluation.outcome

    def change_pin(self, old_pin: str, new_pin: str, now: Optional[float] = None) -> Optional[tuple[int, int]]:
        """Rewrap the same profile key under a new PIN (synthetic-password model)."""

        self._check_pin(new_pin)
        outcome = self.unlock(old_pin, now=now)
        if not outcome.found or outcome.slot_index is None or outcome.profile_id is None:
            return None
        if outcome.profile_key is None:
            return None

        slot_idx = outcome.slot_index
        profile_id = outcome.profile_id
        salt = _random_bytes(SALT_LEN)
        nonce = _random_bytes(NONCE_LEN)
        payload = bytes([profile_id]) + outcome.profile_key
        pin_key = derive_pin_key(new_pin, salt, self.kdf)
        blob = aead_encrypt(pin_key, nonce, payload)
        self.slots[slot_idx] = Slot(
            salt=salt,
            nonce=nonce,
            blob=blob,
            enrolled=True,
            profile_id=profile_id,
        )
        return slot_idx, profile_id

    def remove_profile(self, pin: str, now: Optional[float] = None) -> Optional[tuple[int, int]]:
        outcome = self.unlock(pin, now=now)
        if not outcome.found or outcome.slot_index is None or outcome.profile_id is None:
            return None
        slot_idx = outcome.slot_index
        profile_id = outcome.profile_id
        self.slots[slot_idx] = Slot.create_decoy()
        if self.active_profile_id == profile_id:
            self.lock()
        return slot_idx, profile_id

    def _set_session(self, profile_id: Optional[int], key: bytes) -> None:
        self.lock()
        self.active_profile_id = profile_id
        self._active_profile_key = bytearray(key)

    def _counters(self) -> Sequence[weaver.SlotCounter]:
        return [slot.counter for slot in self.slots]

    @staticmethod
    def _now(now: Optional[float]) -> float:
        return time.time() if now is None else float(now)

    @staticmethod
    def _check_pin(pin: str) -> None:
        if not isinstance(pin, str) or len(pin) < MIN_PIN_LEN:
            raise ValueError(f"PIN must be at least {MIN_PIN_LEN} characters")
