"""Branch-free helpers.

Python cannot give real constant-time behaviour: the interpreter allocates,
the GC runs, integers are objects. These helpers exist so the *shape* of the
selection logic is right — no data-dependent branches, every candidate
touched exactly once — and so that a later implementation in C or Rust has a
specification to follow rather than prose.

What this file does NOT do is make the reference implementation safe to use.
See reference/README.md, "Was dieses Modell nicht kann".
"""


def mask_from_flag(flag: int) -> int:
    """Return 0xFF for flag == 1 and 0x00 for flag == 0, without branching."""
    return (-(flag & 1)) & 0xFF


def select(mask: int, a: bytes, b: bytes) -> bytes:
    """Return a if mask == 0xFF, b if mask == 0x00, touching every byte.

    Both inputs must have the same length; the caller pads. No comparison of
    the mask happens, so the executed instruction sequence is identical for
    both outcomes.
    """
    if len(a) != len(b):
        raise ValueError("select() requires equal-length inputs")
    return bytes((x & mask) | (y & ~mask & 0xFF) for x, y in zip(a, b))


def fold_select(candidates: list[tuple[int, bytes]], width: int) -> tuple[int, bytes]:
    """Reduce (flag, value) candidates to the one whose flag is set.

    Every candidate is processed. The result is the last candidate with a set
    flag; behaviour with several set flags is deliberately deterministic rather
    than an error, because raising on that condition would itself be a
    data-dependent branch.

    Returns (found, value) where found is 0 or 1.
    """
    acc = bytes(width)
    found = 0
    for flag, value in candidates:
        if len(value) != width:
            raise ValueError("candidate width mismatch")
        m = mask_from_flag(flag)
        acc = select(m, value, acc)
        found |= flag & 1
    return found, acc


def wipe(buf: bytearray) -> None:
    """Overwrite a mutable buffer in place.

    Only meaningful for bytearray. Anything that ever existed as an immutable
    bytes object cannot be wiped from Python — that limitation is the subject
    of finding F-2.
    """
    for i in range(len(buf)):
        buf[i] = 0
