"""Shared fixtures for the reference-model tests."""

from __future__ import annotations

import os
import tempfile
from contextlib import contextmanager
from typing import Iterator

from mlsu.keystore import KeyStore
from mlsu.params import KDF_TEST, SLOT_COUNT


PRIVATE_PIN = "471903"
DURESS_PIN = "220561"
THIRD_PIN = "581902"
WRONG_PIN = "000000"


def fresh_store(slot_count: int = SLOT_COUNT) -> KeyStore:
    return KeyStore(kdf=KDF_TEST, slot_count=slot_count)


def enrolled_store(slot_count: int = SLOT_COUNT) -> KeyStore:
    store = fresh_store(slot_count)
    store.enroll(PRIVATE_PIN, 1)
    store.enroll(DURESS_PIN, 2)
    return store


@contextmanager
def temp_path(suffix: str = ".store") -> Iterator[str]:
    fd, path = tempfile.mkstemp(prefix="mlsu-test-", suffix=suffix)
    os.close(fd)
    os.unlink(path)
    try:
        yield path
    finally:
        try:
            os.unlink(path)
        except OSError:
            pass
