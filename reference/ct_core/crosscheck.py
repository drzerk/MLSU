#!/usr/bin/env python3
"""Compare C fold_select against the Python specification."""

from __future__ import annotations

import random
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from mlsu.ct import fold_select  # noqa: E402


def run_c(n: int, payload_len: int, flags: list[int], payloads: list[bytes]) -> tuple[int, bytes]:
    blob = b"".join(payloads)
    flag_str = "".join("1" if f else "0" for f in flags)
    cli = Path(__file__).resolve().parent / "mlsu_ct_cli"
    proc = subprocess.run(
        [str(cli), "fold", str(n), str(payload_len), flag_str, blob.hex()],
        check=True,
        capture_output=True,
        text=True,
    )
    line = proc.stdout.strip()
    # found=1 payload=aabb...
    parts = dict(item.split("=", 1) for item in line.split())
    return int(parts["found"]), bytes.fromhex(parts["payload"])


def main() -> int:
    rng = random.Random(20260822)
    cases = 64
    for i in range(cases):
        n = rng.randint(1, 6)
        payload_len = rng.choice((1, 4, 16, 33))
        flags = [rng.randint(0, 1) for _ in range(n)]
        payloads = [bytes(rng.getrandbits(8) for _ in range(payload_len)) for _ in range(n)]
        py_found, py_payload = fold_select(list(zip(flags, payloads)), payload_len)
        c_found, c_payload = run_c(n, payload_len, flags, payloads)
        if bool(c_found) != py_found or c_payload != py_payload:
            print("mismatch on case", i, file=sys.stderr)
            print(" flags", flags, file=sys.stderr)
            print(" py", py_found, py_payload.hex(), file=sys.stderr)
            print(" c ", c_found, c_payload.hex(), file=sys.stderr)
            return 1
    print(f"ok — {cases} random cases match Python fold_select")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
