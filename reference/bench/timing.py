"""Timing rig for SR-3: does the unlock time reveal anything?

SR-3 asks that the evaluation take the same time regardless of which profile
matched and whether any matched at all. SR-9 extends that to the number of
enrolled profiles. This measures both.

Method: every class of input — including the ones belonging to different key
stores — is measured inside one interleaved loop, in random order per round.
Measuring classes in separate runs and comparing the results afterwards
manufactures differences that are really CPU frequency drift and cache state.
The first version of this rig made exactly that mistake and reported a signal
of t=+9.4 that vanished once the measurement was interleaved (finding F-4).

Statistic: Welch's t between two classes, as in TVLA. |t| > 4.5 is the usual
threshold for "distinguishable"; below that the measurement found no signal,
which is not the same as proving there is none.

Usage:
    python3 bench/timing.py --samples 300
    python3 bench/timing.py --samples 50 --kdf strong
"""
import argparse
import os
import random
import statistics
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from mlsu.keystore import KeyStore  # noqa: E402
from mlsu.params import KDF_FAST, KDF_STRONG  # noqa: E402

TVLA_THRESHOLD = 4.5


def welch_t(a: list[float], b: list[float]) -> float:
    ma, mb = statistics.fmean(a), statistics.fmean(b)
    va, vb = statistics.variance(a), statistics.variance(b)
    denom = (va / len(a) + vb / len(b)) ** 0.5
    return 0.0 if denom == 0 else (ma - mb) / denom


def measure(classes: dict[str, tuple[KeyStore, str]], samples: int) -> dict[str, list[float]]:
    """One measurement per class per round, class order shuffled each round."""
    timings: dict[str, list[float]] = {name: [] for name in classes}
    order = list(classes)
    for _ in range(samples):
        random.shuffle(order)
        for name in order:
            store, pin = classes[name]
            # Without this the rig measures the lockout branch after 30 misses,
            # not the unlock path. Bench-only; see WeaverModel.reset().
            store.weaver.reset()
            start = time.perf_counter_ns()
            store.unlock(pin)
            timings[name].append((time.perf_counter_ns() - start) / 1e6)
    return timings


def summarize(name: str, values: list[float]) -> str:
    return (
        f"  {name:<24} n={len(values):>4}  "
        f"mean={statistics.fmean(values):8.3f} ms  "
        f"median={statistics.median(values):8.3f} ms  "
        f"min={min(values):8.3f} ms  "
        f"sd={statistics.stdev(values):7.3f}"
    )


def compare(label: str, a: list[float], b: list[float]) -> bool:
    t = welch_t(a, b)
    verdict = "DISTINGUISHABLE" if abs(t) > TVLA_THRESHOLD else "no signal"
    print(f"  {label:<48} t={t:+8.2f}   {verdict}")
    return abs(t) > TVLA_THRESHOLD


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--samples", type=int, default=300, help="rounds per class")
    parser.add_argument("--kdf", choices=["fast", "strong"], default="fast")
    parser.add_argument("--seed", type=int, default=1)
    args = parser.parse_args()

    random.seed(args.seed)
    kdf = KDF_STRONG if args.kdf == "strong" else KDF_FAST

    two = KeyStore(kdf=kdf)
    two.enroll("111111", 1)
    two.enroll("222222", 2)
    one = KeyStore(kdf=kdf)
    one.enroll("111111", 1)
    none = KeyStore(kdf=kdf)

    classes = {
        "hit profile 1": (two, "111111"),
        "hit profile 2": (two, "222222"),
        "miss, 2 profiles": (two, "999999"),
        "miss, 1 profile": (one, "999999"),
        "miss, 0 profiles": (none, "999999"),
    }

    print(f"MLSU timing rig — {kdf.describe()}, {args.samples} rounds per class")
    print(f"{len(classes)} classes, interleaved in random order per round\n")

    timings = measure(classes, args.samples)
    for name in classes:
        print(summarize(name, timings[name]))

    print("\nSR-3 — which profile matched, and whether any matched")
    flagged = [
        compare("profile 1 vs profile 2", timings["hit profile 1"], timings["hit profile 2"]),
        compare(
            "hit vs miss",
            timings["hit profile 1"] + timings["hit profile 2"],
            timings["miss, 2 profiles"],
        ),
    ]

    print("\nSR-9 — how many profiles are enrolled")
    flagged.append(
        compare("2 profiles vs 1 profile", timings["miss, 2 profiles"], timings["miss, 1 profile"])
    )
    flagged.append(
        compare("1 profile vs 0 profiles", timings["miss, 1 profile"], timings["miss, 0 profiles"])
    )
    flagged.append(
        compare("2 profiles vs 0 profiles", timings["miss, 2 profiles"], timings["miss, 0 profiles"])
    )

    print("\nResult:", "SIGNAL FOUND" if any(flagged) else "no signal above the threshold")
    print(
        "Note: this measures a Python model on a shared machine. A negative\n"
        "result here is a sanity check, not evidence for SR-3 on real hardware."
    )
    return 1 if any(flagged) else 0


if __name__ == "__main__":
    raise SystemExit(main())
