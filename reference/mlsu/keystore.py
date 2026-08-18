"""The MLSU key store: PIN in, one profile key out — or nothing.

Model of the mechanism described in the concept paper, section 6.1:

    PIN_i --Argon2id--> pin_key_i --unwrap--> profile_key_i

Every enrolled profile owns an independently generated profile key. No master
secret exists, so learning one profile's PIN reveals nothing about the others
(SR-1).

Storage always holds SLOT_COUNT slots. Slots without a profile hold random
bytes that no PIN can unwrap, and unlocking derives a key for every slot
regardless — so neither the running time nor the stored data reveals how many
profiles exist (SR-8, SR-9).
"""
from dataclasses import dataclass
import os

from argon2.low_level import Type, hash_secret_raw
from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import ChaCha20Poly1305

from . import ct
from .counters import WeaverModel
from .params import (
    KDF_STRONG,
    NONCE_LEN,
    PROFILE_KEY_LEN,
    SALT_LEN,
    SLOT_COUNT,
    KdfParams,
)

#: Payload wrapped in a slot: one profile id byte plus the profile key.
PAYLOAD_LEN = 1 + PROFILE_KEY_LEN


@dataclass
class Slot:
    """One key slot as it would sit on disk. All fields look random."""

    salt: bytes
    nonce: bytes
    blob: bytes  # AEAD ciphertext of the payload, including tag

    @staticmethod
    def decoy() -> "Slot":
        """A slot no PIN can open, indistinguishable from a real one."""
        return Slot(
            salt=os.urandom(SALT_LEN),
            nonce=os.urandom(NONCE_LEN),
            blob=os.urandom(PAYLOAD_LEN + 16),  # +16 = Poly1305 tag
        )


@dataclass
class UnlockResult:
    found: bool
    profile_id: int | None
    profile_key: bytes | None
    locked_out: bool = False

    def __repr__(self) -> str:  # keep key material out of logs and tracebacks
        state = "locked out" if self.locked_out else ("hit" if self.found else "miss")
        return f"<UnlockResult {state} profile={self.profile_id}>"


def derive_pin_key(pin: str, salt: bytes, kdf: KdfParams) -> bytes:
    return hash_secret_raw(
        secret=pin.encode("utf-8"),
        salt=salt,
        time_cost=kdf.time_cost,
        memory_cost=kdf.memory_cost_kib,
        parallelism=kdf.parallelism,
        hash_len=kdf.hash_len,
        type=Type.ID,
    )


class KeyStore:
    """SLOT_COUNT slots, of which any number may carry a profile."""

    def __init__(self, kdf: KdfParams = KDF_STRONG, slot_count: int = SLOT_COUNT):
        self.kdf = kdf
        self.slot_count = slot_count
        self.slots: list[Slot] = [Slot.decoy() for _ in range(slot_count)]
        self.weaver = WeaverModel(slot_count=slot_count)
        # Slots are picked at random on enrolment, so slot position carries no
        # information about the order profiles were set up in.
        self._free_slots = list(range(slot_count))

    def enroll(self, pin: str, profile_id: int) -> int:
        """Place a new profile in a random free slot. Returns the slot index."""
        if not self._free_slots:
            raise RuntimeError("no free slots")
        if not 0 <= profile_id <= 255:
            raise ValueError("profile_id must fit in one byte")

        pick = int.from_bytes(os.urandom(2), "big") % len(self._free_slots)
        index = self._free_slots.pop(pick)

        salt = os.urandom(SALT_LEN)
        nonce = os.urandom(NONCE_LEN)
        profile_key = os.urandom(PROFILE_KEY_LEN)  # independent per profile
        payload = bytes([profile_id]) + profile_key

        pin_key = derive_pin_key(pin, salt, self.kdf)
        blob = ChaCha20Poly1305(pin_key).encrypt(nonce, payload, None)

        self.slots[index] = Slot(salt=salt, nonce=nonce, blob=blob)
        return index

    def unlock(self, pin: str) -> UnlockResult:
        """Try the PIN against every slot and return at most one profile.

        Invariants this method exists to enforce:

        * every slot is derived and every blob is opened, always — no early
          return, no skipping of decoys (SR-3);
        * the selection between candidates is branch-free (SR-3);
        * a failed attempt is charged to the rate limiter (SR-4).
        """
        if self.weaver.any_locked_out:
            return UnlockResult(False, None, None, locked_out=True)

        candidates: list[tuple[int, bytes]] = []
        matched_slot: int | None = None

        for index, slot in enumerate(self.slots):
            pin_key = derive_pin_key(pin, slot.salt, self.kdf)
            aead = ChaCha20Poly1305(pin_key)
            try:
                payload = aead.decrypt(slot.nonce, slot.blob, None)
                flag = 1
            except InvalidTag:
                # A real implementation must get this flag from a constant-time
                # tag comparison rather than an exception. Finding F-3.
                payload = bytes(PAYLOAD_LEN)
                flag = 0
            if flag:
                matched_slot = index
            candidates.append((flag, payload))

        found, payload = ct.fold_select(candidates, PAYLOAD_LEN)
        self.weaver.register_attempt(matched_slot)

        if not found:
            return UnlockResult(False, None, None)
        return UnlockResult(True, payload[0], payload[1:])
