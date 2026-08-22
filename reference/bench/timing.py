#!/usr/bin/env python3
"""Timing rig for SR-3 / SR-9.

Method (finding F-4): all input classes are measured in one session, in a
fresh random order each round. Separate runs produce clock-drift artefacts
that look like leaks.

A negative result on a shared machine is a sanity check, not a proof.
Exit code 1 means the Welch-t statistic crossed the threshold of 4.5.
"""

from __future__ import annotations

import argparse
import random
import statistics
import sys
import time
from pathlib import Path
from typing import Dict, List, Sequence, Tuple

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from mlsu.keystore import KeyStore
from mlsu.params import KDF_BY_NAME


PRIVATE_PIN = "471903"
DURESS_PIN = "220561"
WRONG_PIN = "883190"

CLASSES = ("private_hit", "duress_hit", "wrong_pin_miss")
THRESHOLD = 4.5


def _welch_t(a: Sequence[float], b: Sequence[float]) -> float:
    if len(a) < 2 or len(b) < 2:
        return 0.0
    ma = statistics.mean(a)
    mb = statistics.mean(b)
    va = statistics.variance(a)
    vb = statistics.variance(b)
    denom = (va / len(a) + vb / len(b)) ** 0.5
    if denom == 0:
        return 0.0
    return (ma - mb) / denom


def _measure_once(store: KeyStore, pin: str) -> float:
    store.reset_failure_counters()
    started = time.perf_counter()
    store.unlock(pin)
    return (time.perf_counter() - started) * 1000.0


def run(samples: int, kdf_name: str) -> int:
    kdf = KDF_BY_NAME[kdf_name]
    store = KeyStore(kdf=kdf, slot_count=4)
    store.enroll(PRIVATE_PIN, 1)
    store.enroll(DURESS_PIN, 2)

    pins = {
        "private_hit": PRIVATE_PIN,
        "duress_hit": DURESS_PIN,
        "wrong_pin_miss": WRONG_PIN,
    }
    collected: Dict[str, List[float]] = {name: [] for name in CLASSES}

    print(f"MLSU timing rig  samples={samples}  kdf={kdf.label()}")
    print("interleaved, per-round shuffled (F-4)")
    print()

    order = list(CLASSES)
    for _round in range(samples):
        random.shuffle(order)
        for name in order:
            collected[name].append(_measure_once(store, pins[name]))

    print(f"{'class':<18} {'mean':>10} {'median':>10} {'min':>10}")
    for name in CLASSES:
        series = collected[name]
        print(
            f"{name:<18} {statistics.mean(series):10.2f} "
            f"{statistics.median(series):10.2f} {min(series):10.2f}"
        )

    print()
    pairs: List[Tuple[str, str, float]] = []
    names = list(CLASSES)
    flagged = False
    for i, left in enumerate(names):
        for right in names[i + 1 :]:
            t = _welch_t(collected[left], collected[right])
            pairs.append((left, right, t))
            mark = "  **" if abs(t) >= THRESHOLD else ""
            print(f"Welch-t {left} vs {right}: {t:+.3f}{mark}")
            if abs(t) >= THRESHOLD:
                flagged = True

    print()
    if flagged:
        print(f"signal above |t|={THRESHOLD} — on a shared host this is often noise.")
        return 1
    print(f"no class pair crossed |t|={THRESHOLD}.")
    return 0


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="MLSU interleaved timing rig")
    parser.add_argument("--samples", type=int, default=30)
    parser.add_argument("--kdf", choices=("fast", "strong", "test"), default="fast")
    args = parser.parse_args(argv)
    if args.samples < 2:
        print("need at least 2 samples", file=sys.stderr)
        return 2
    return run(args.samples, args.kdf)


if __name__ == "__main__":
    raise SystemExit(main())
