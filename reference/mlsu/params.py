"""Cost parameters and layout constants for the MLSU reference model.

Every experiment must name the KDF it ran with. ``KDF_STRONG`` is the
parameter set from the concept paper (section 6.1). ``KDF_FAST`` is the
default for interactive work. ``KDF_TEST`` is intentionally cheap so the
requirement tests stay fast; it is not a security parameter.
"""

from __future__ import annotations

from dataclasses import dataclass


SLOT_COUNT = 4
MAX_FAILURES = 30
MIN_PIN_LEN = 4

SALT_LEN = 16
NONCE_LEN = 12
PROFILE_KEY_LEN = 32
PAYLOAD_LEN = 1 + PROFILE_KEY_LEN  # profile_id || profile_key
TAG_LEN = 16
BLOB_LEN = PAYLOAD_LEN + TAG_LEN

STORE_MAGIC = b"MLSU"
STORE_VERSION = 1
STORE_HEADER_LEN = 32
# status(1) + profile_id(1) + failures(1) + reserved(1) + last_failure_at(8)
# + salt(16) + nonce(12) + blob(49) + pad(5) = 94
SLOT_RECORD_LEN = 94

KDF_ID_FAST = 0
KDF_ID_STRONG = 1
KDF_ID_TEST = 2


@dataclass(frozen=True)
class KdfParams:
    """Argon2id parameters. ``memory_cost_kib`` is KiB, matching argon2-cffi."""

    name: str
    time_cost: int
    memory_cost_kib: int
    parallelism: int
    hash_len: int = 32
    kdf_id: int = KDF_ID_FAST

    def label(self) -> str:
        return (
            f"Argon2id(t={self.time_cost}, m={self.memory_cost_kib}KiB, "
            f"p={self.parallelism})"
        )


KDF_FAST = KdfParams(
    name="fast",
    time_cost=1,
    memory_cost_kib=8192,
    parallelism=1,
    hash_len=32,
    kdf_id=KDF_ID_FAST,
)

KDF_STRONG = KdfParams(
    name="strong",
    time_cost=3,
    memory_cost_kib=65536,
    parallelism=1,
    hash_len=32,
    kdf_id=KDF_ID_STRONG,
)

# Tiny memory so unit tests do not spend seconds per derivation.
KDF_TEST = KdfParams(
    name="test",
    time_cost=1,
    memory_cost_kib=8,
    parallelism=1,
    hash_len=32,
    kdf_id=KDF_ID_TEST,
)

KDF_BY_ID = {
    KDF_ID_FAST: KDF_FAST,
    KDF_ID_STRONG: KDF_STRONG,
    KDF_ID_TEST: KDF_TEST,
}

KDF_BY_NAME = {
    "fast": KDF_FAST,
    "strong": KDF_STRONG,
    "test": KDF_TEST,
}


def throttle_seconds(failures: int) -> float:
    """Weaver-style exponential backoff. Matches the interactive simulator."""

    if failures < 5:
        return 0.0
    if failures < 10:
        return 30.0
    if failures < 20:
        return 300.0
    return 3600.0


def store_file_size(slot_count: int = SLOT_COUNT) -> int:
    """Fixed on-disk size. Enrolment must not change this (SR-8)."""

    return STORE_HEADER_LEN + slot_count * SLOT_RECORD_LEN
