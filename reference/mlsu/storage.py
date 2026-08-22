"""Persistent store file: fixed binary layout, atomic writes, validation.

The file size is a function of ``slot_count`` only. Enrolling or deleting a
profile does not change it (SR-8). Each slot carries a status byte so a
fresh process can offer a free slot after restart — a documented deviation
from ideal indistinguishability (see reference/README.md).
"""

from __future__ import annotations

import os
import struct
import tempfile
from .keystore import KeyStore, Slot
from .params import (
    BLOB_LEN,
    KDF_BY_ID,
    SLOT_COUNT,
    SLOT_RECORD_LEN,
    STORE_HEADER_LEN,
    STORE_MAGIC,
    STORE_VERSION,
    KdfParams,
    store_file_size,
)


class StoreError(Exception):
    """The file is missing, truncated, or not an MLSU store."""


_HEADER_STRUCT = struct.Struct("<4sBBBxxxxx16s")  # 4+1+1+1+5+16 = 28... wait
# Explicit packing so the header is exactly STORE_HEADER_LEN bytes.
# magic[4] version[1] slot_count[1] kdf_id[1] reserved[25]


def _pack_header(slot_count: int, kdf: KdfParams) -> bytes:
    reserved = b"\x00" * 25
    header = STORE_MAGIC + bytes([STORE_VERSION, slot_count, kdf.kdf_id]) + reserved
    if len(header) != STORE_HEADER_LEN:
        raise RuntimeError("header packing bug")
    return header


def _unpack_header(blob: bytes) -> tuple[int, int, int]:
    if len(blob) < STORE_HEADER_LEN:
        raise StoreError("store header truncated")
    magic = blob[0:4]
    if magic != STORE_MAGIC:
        raise StoreError("not an MLSU store (bad magic)")
    version = blob[4]
    if version != STORE_VERSION:
        raise StoreError(f"unsupported store version {version}")
    slot_count = blob[5]
    kdf_id = blob[6]
    if slot_count < 1 or slot_count > 16:
        raise StoreError(f"implausible slot_count {slot_count}")
    if kdf_id not in KDF_BY_ID:
        raise StoreError(f"unknown kdf id {kdf_id}")
    return version, slot_count, kdf_id


def _pack_slot(slot: Slot) -> bytes:
    status = 1 if slot.enrolled else 0
    profile_id = slot.profile_id if slot.profile_id is not None else 0
    failures = max(0, min(255, slot.failures))
    last = int(slot.last_failure_at) if slot.last_failure_at else 0
    blob = slot.blob
    if len(blob) < BLOB_LEN:
        blob = blob + b"\x00" * (BLOB_LEN - len(blob))
    elif len(blob) > BLOB_LEN:
        blob = blob[:BLOB_LEN]
    record = (
        bytes([status, profile_id & 0xFF, failures, 0])
        + struct.pack("<Q", last & 0xFFFFFFFFFFFFFFFF)
        + slot.salt
        + slot.nonce
        + blob
        + b"\x00" * 5
    )
    if len(record) != SLOT_RECORD_LEN:
        raise RuntimeError(f"slot packing bug: {len(record)} != {SLOT_RECORD_LEN}")
    return record


def _unpack_slot(record: bytes) -> Slot:
    if len(record) != SLOT_RECORD_LEN:
        raise StoreError("slot record has the wrong size")
    status = record[0]
    profile_id = record[1]
    failures = record[2]
    last = struct.unpack_from("<Q", record, 4)[0]
    salt = record[12:28]
    nonce = record[28:40]
    blob = record[40:40 + BLOB_LEN]
    enrolled = status == 1
    return Slot(
        salt=salt,
        nonce=nonce,
        blob=blob,
        enrolled=enrolled,
        profile_id=profile_id if enrolled else None,
        failures=failures,
        last_failure_at=float(last) if last else None,
    )


def serialize(store: KeyStore) -> bytes:
    parts = [_pack_header(store.slot_count, store.kdf)]
    for slot in store.slots:
        parts.append(_pack_slot(slot))
    data = b"".join(parts)
    expected = store_file_size(store.slot_count)
    if len(data) != expected:
        raise RuntimeError(f"serialized size {len(data)} != {expected}")
    return data


def deserialize(data: bytes) -> KeyStore:
    if len(data) < STORE_HEADER_LEN:
        raise StoreError("store file too small")
    _, slot_count, kdf_id = _unpack_header(data[:STORE_HEADER_LEN])
    expected = store_file_size(slot_count)
    if len(data) != expected:
        raise StoreError(f"store has size {len(data)}, expected {expected}")
    store = KeyStore(kdf=KDF_BY_ID[kdf_id], slot_count=slot_count)
    slots = []
    offset = STORE_HEADER_LEN
    for _ in range(slot_count):
        slots.append(_unpack_slot(data[offset : offset + SLOT_RECORD_LEN]))
        offset += SLOT_RECORD_LEN
    store.slots = slots
    return store


def save_store(path: str, store: KeyStore) -> None:
    """Atomic replace: write temp file, fsync, rename over the destination."""

    data = serialize(store)
    directory = os.path.dirname(os.path.abspath(path)) or "."
    os.makedirs(directory, exist_ok=True)
    fd, tmp_path = tempfile.mkstemp(prefix=".mlsu-", suffix=".tmp", dir=directory)
    try:
        with os.fdopen(fd, "wb") as handle:
            handle.write(data)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(tmp_path, path)
    except Exception:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
        raise


def load_store(path: str) -> KeyStore:
    if not os.path.exists(path):
        raise StoreError(f"store not found: {path}")
    try:
        with open(path, "rb") as handle:
            data = handle.read()
    except OSError as exc:
        raise StoreError(f"cannot read store: {exc}") from exc
    return deserialize(data)


def create_store(path: str, kdf: KdfParams, slot_count: int = SLOT_COUNT) -> KeyStore:
    store = KeyStore(kdf=kdf, slot_count=slot_count)
    save_store(path, store)
    return store
