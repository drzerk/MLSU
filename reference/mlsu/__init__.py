"""MLSU Stufe-0 reference model: one PIN, several sealed areas, at most one opens.

This package is a *model* of the lock-screen selection logic from the concept
paper. It is not Android code and must not be used to protect real data.

Heavy dependencies (argon2, cryptography) live in ``keystore`` / ``storage``
so that ``mlsu.ct`` can be imported by the C cross-check without them.
"""

from .params import (
    BLOB_LEN,
    KDF_FAST,
    KDF_STRONG,
    KDF_TEST,
    MAX_FAILURES,
    MIN_PIN_LEN,
    NONCE_LEN,
    PAYLOAD_LEN,
    PROFILE_KEY_LEN,
    SALT_LEN,
    SLOT_COUNT,
    KdfParams,
    throttle_seconds,
)
from .ct import fold_select

__all__ = [
    "BLOB_LEN",
    "KDF_FAST",
    "KDF_STRONG",
    "KDF_TEST",
    "MAX_FAILURES",
    "MIN_PIN_LEN",
    "NONCE_LEN",
    "PAYLOAD_LEN",
    "PROFILE_KEY_LEN",
    "SALT_LEN",
    "SLOT_COUNT",
    "KdfParams",
    "fold_select",
    "throttle_seconds",
]

__version__ = "1.0.0"
