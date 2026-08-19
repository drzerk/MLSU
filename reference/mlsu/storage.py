"""Persistent storage for the MLSU key store.

Serialises a :class:`~mlsu.keystore.KeyStore` to one fixed-size binary file so
that enrolment, counters and lockout survive restarts — the step from the
in-memory model to a usable Stufe-0 module.

Format (version 1, big-endian):

::

    header (32 bytes)
      0   4   magic b"MLSU"
      4   2   format version (1)
      6   2   slot count
      8   1   Argon2 time cost
      9   4   Argon2 memory cost (KiB)
     13   1   Argon2 parallelism
     14   2   Argon2 hash length
     16  16   reserved, zero

    then slot_count records of RECORD_SIZE bytes each:

      0   1   state byte: 0 = decoy slot, 1 = enrolled slot
      1   16  salt
     17   12  nonce
     29   49  AEAD blob (payload + Poly1305 tag)
     78   4   failure counter (u32)
     82   8   last failure timestamp (f64, unix seconds; negative = none)

The file size is fixed from the moment the store is created: enrolment
overwrites an existing record instead of growing the file, so the file size
never reveals how many profiles were enrolled.

Known deviation from SR-8 (documented, not hidden):

    The per-slot *state byte* is needed for one practical reason: the CLI must
    be able to enrol a new profile in a fresh process, and the only way to
    know which slot is free without a PIN is to record it. A real MLSU must
    keep this bookkeeping out of the storage an examiner can read (e.g. only
    in the already-unlocked private profile) or accept that the profile count
    is readable from the store file. The in-memory slots themselves remain
    indistinguishable — decoys and real slots have identical shape, which is
    what the SR-8 tests check.

This module does not add security: writing a store file is a convenience for
the model, not a protection against tampering. An attacker who can modify the
file can already deny service or read the (AEAD-protected) blobs only without
a PIN.
"""
import os
import struct
import tempfile

from .counters import SlotCounter
from .keystore import PAYLOAD_LEN, KeyStore, Slot
from .params import (
    KDF_STRONG,
    NONCE_LEN,
    SALT_LEN,
    SLOT_COUNT,
    KdfParams,
)

MAGIC = b"MLSU"
VERSION = 1

HEADER_SIZE = 32
#: Bytes per slot record: state + salt + nonce + blob(PAYLOAD_LEN + tag) +
#: failures(u32) + last_failure_at(f64). Computed so the layout tracks param
#: changes instead of drifting.
RECORD_SIZE = 1 + SALT_LEN + NONCE_LEN + (PAYLOAD_LEN + 16) + 4 + 8

TAG_SIZE = 16  # Poly1305 tag inside the blob

MAX_SLOT_COUNT = 64


class StorageFormatError(ValueError):
    """The store file is not a valid MLSU store of this version."""


def file_size(slot_count: int) -> int:
    return HEADER_SIZE + RECORD_SIZE * slot_count


def _pack_header(kdf: KdfParams, slot_count: int) -> bytes:
    return (
        MAGIC
        + struct.pack(">HH", VERSION, slot_count)
        + struct.pack(">BI", kdf.time_cost, kdf.memory_cost_kib)
        + struct.pack(">BH", kdf.parallelism, kdf.hash_len)
        + bytes(16)
    )


def _pack_record(slot: Slot, enrolled: bool, counter: SlotCounter) -> bytes:
    # last_failure_at is None in memory when no delay is pending; the file
    # stores that as -1.0, so that a genuine unix timestamp (including 0.0)
    # stays unambiguous (see counters.SlotCounter).
    last_failure_at = -1.0 if counter.last_failure_at is None else counter.last_failure_at
    return (
        struct.pack(">B", 1 if enrolled else 0)
        + slot.salt
        + slot.nonce
        + slot.blob
        + struct.pack(">I", counter.failures)
        + struct.pack(">d", last_failure_at)
    )


def _parse_header(data: bytes) -> tuple[KdfParams, int]:
    if len(data) < HEADER_SIZE:
        raise StorageFormatError("Datei zu kurz für einen MLSU-Header")
    magic, version, slot_count = struct.unpack(">4sHH", data[:8])
    if magic != MAGIC:
        raise StorageFormatError("kein MLSU-Store (Magic fehlt)")
    if version != VERSION:
        raise StorageFormatError(f"nicht unterstütztes Format v{version}")
    if not 1 <= slot_count <= MAX_SLOT_COUNT:
        raise StorageFormatError(f"Slot-Anzahl {slot_count} ungültig")
    time_cost, mem_kib = struct.unpack(">BI", data[8:13])
    parallelism, hash_len = struct.unpack(">BH", data[13:16])
    kdf = KdfParams(
        time_cost=time_cost,
        memory_cost_kib=mem_kib,
        parallelism=parallelism,
        hash_len=hash_len,
    )
    if not (kdf.time_cost > 0 and kdf.memory_cost_kib > 0 and kdf.parallelism > 0):
        raise StorageFormatError("ungültige KDF-Parameter im Header")
    return kdf, slot_count


def _parse_record(data: bytes, record: int) -> tuple[Slot, bool, SlotCounter]:
    start = HEADER_SIZE + record * RECORD_SIZE
    end = start + RECORD_SIZE
    chunk = data[start:end]
    state = chunk[0]
    if state not in (0, 1):
        raise StorageFormatError(f"ungültiger Slot-Status {state} in Record {record}")
    salt = chunk[1 : 1 + SALT_LEN]
    nonce = chunk[1 + SALT_LEN : 1 + SALT_LEN + NONCE_LEN]
    blob = chunk[1 + SALT_LEN + NONCE_LEN : 1 + SALT_LEN + NONCE_LEN + PAYLOAD_LEN + TAG_SIZE]
    failures = struct.unpack(">I", chunk[-12:-8])[0]
    stored_at = struct.unpack(">d", chunk[-8:])[0]
    last_failure_at = None if stored_at < 0.0 else stored_at
    slot = Slot(salt=salt, nonce=nonce, blob=blob)
    counter = SlotCounter(failures=failures, last_failure_at=last_failure_at)
    return slot, bool(state), counter


def encode_store(store: KeyStore) -> bytes:
    """Serialise a key store to the on-disk byte format."""
    if len(store.slots) != store.slot_count:
        raise ValueError("slot list length does not match slot_count")
    out = bytearray(_pack_header(store.kdf, store.slot_count))
    enrolled = {i for i in range(store.slot_count)} - set(store._free_slots)
    for index, slot in enumerate(store.slots):
        out += _pack_record(slot, index in enrolled, store.weaver.counters[index])
    return bytes(out)


def decode_store(data: bytes) -> KeyStore:
    """Parse the byte format back into a :class:`KeyStore`.

    Raises :class:`StorageFormatError` for anything that is not a store of
    this format — a truncated file, wrong magic, unsupported version, bad
    slot count. The caller decides what to do with the error; this function
    never silently guesses.
    """
    kdf, slot_count = _parse_header(data)
    expected = file_size(slot_count)
    if len(data) != expected:
        raise StorageFormatError(
            f"Dateigröße {len(data)} B weicht von erwarteten {expected} B ab "
            f"(Slot-Anzahl {slot_count})"
        )
    slots: list[Slot] = []
    counters: list[SlotCounter] = []
    free_slots: list[int] = []
    for record in range(slot_count):
        slot, enrolled, counter = _parse_record(data, record)
        slots.append(slot)
        counters.append(counter)
        if not enrolled:
            free_slots.append(record)
    return KeyStore.restore(kdf=kdf, slots=slots, counters=counters, free_slots=free_slots)


def save_store(store: KeyStore, path: str) -> None:
    """Atomically write the store to *path*.

    Writes to a temporary file in the same directory, fsyncs, then renames
    over the target — a crash mid-write leaves either the old or the new
    file, never a torn one.
    """
    directory = os.path.dirname(os.path.abspath(path))
    fd, tmp_path = tempfile.mkstemp(prefix=".mlsu-", suffix=".tmp", dir=directory)
    try:
        with os.fdopen(fd, "wb") as handle:
            handle.write(encode_store(store))
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(tmp_path, path)
    except BaseException:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
        raise


def load_store(path: str) -> KeyStore:
    """Read and parse the store at *path*.

    Raises ``FileNotFoundError`` if the file is missing and
    :class:`StorageFormatError` if it is malformed.
    """
    with open(path, "rb") as handle:
        data = handle.read()
    return decode_store(data)


def create_store(kdf: KdfParams = KDF_STRONG, slot_count: int = SLOT_COUNT) -> KeyStore:
    """A fresh store: slot_count decoy slots, no profiles, no counters."""
    if not 1 <= slot_count <= MAX_SLOT_COUNT:
        raise ValueError(f"slot_count muss zwischen 1 und {MAX_SLOT_COUNT} liegen")
    return KeyStore(kdf=kdf, slot_count=slot_count)


__all__ = [
    "MAGIC",
    "VERSION",
    "HEADER_SIZE",
    "RECORD_SIZE",
    "MAX_SLOT_COUNT",
    "StorageFormatError",
    "encode_store",
    "decode_store",
    "save_store",
    "load_store",
    "create_store",
    "file_size",
]
