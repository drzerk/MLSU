"""Branch-free candidate folding (the *shape* of SR-3 selection).

CPython is not constant-time. This module specifies the control-flow that a
production binding (see ``ct_core/``) must implement with bitwise masking:
always visit every candidate, never take a secret-dependent early return.
"""

from __future__ import annotations

from typing import Iterable, Sequence, Tuple


Candidate = Tuple[int, bytes]


def fold_select(
    candidates: Sequence[Candidate] | Iterable[Candidate],
    payload_len: int,
) -> tuple[bool, bytes]:
    """Fold ``(flag, payload)`` pairs into a single payload.

    ``flag`` is treated as 0 or non-zero. When several flags are set the
    payloads are OR-ed together — independent keys make a double match
    vanishingly unlikely, and the model must not branch on that case.
    """

    any_found = 0
    result = bytearray(payload_len)

    for flag, payload in candidates:
        bit = 1 if flag else 0
        mask = 0xFF if bit else 0x00
        any_found |= bit
        plen = len(payload)
        for i in range(payload_len):
            byte = payload[i] if i < plen else 0
            result[i] |= byte & mask

    return any_found != 0, bytes(result)
