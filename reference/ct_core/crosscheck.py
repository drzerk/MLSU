"""Cross-check the C constant-time helpers against the Python reference.

Builds the C CLI, then feeds it hundreds of random vectors and compares the
output with reference/mlsu/ct.py byte for byte. This is the guard that keeps
the C specification and the Python model from drifting apart.

    python3 crosscheck.py            # from reference/ct_core/
    make check                       # builds + runs C tests + this script

Exit code 0 if everything matches, 1 otherwise.
"""
import os
import random
import subprocess
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from mlsu import ct  # noqa: E402

CLI = os.path.join(os.path.dirname(os.path.abspath(__file__)), "mlsu_ct_cli")
ROUNDS = 400
SEED = 20260819

random.seed(SEED)


def run_cli(*args: str) -> bytes:
    proc = subprocess.run([CLI, *args], capture_output=True, check=True)
    return proc.stdout.decode().strip()


def check(label: str, got: str, want: str) -> None:
    if got != want:
        print(f"FAIL {label}: C={got} Python={want}")
        sys.exit(1)


def main() -> int:
    if not os.path.exists(CLI):
        print("C CLI nicht gebaut — zuerst `make mlsu_ct_cli` (oder `make check`).")
        return 2

    failures = 0
    for _ in range(ROUNDS):
        # mask
        flag = random.randrange(256)
        got = run_cli("mask", f"{flag:02x}")
        want = f"{ct.mask_from_flag(flag):02x}"
        check(f"mask({flag:#x})", got, want)

        # select
        n = random.randint(1, 32)
        a = bytes(random.randrange(256) for _ in range(n))
        b = bytes(random.randrange(256) for _ in range(n))
        mask = ct.mask_from_flag(random.randrange(2))
        got = run_cli("select", f"{mask:02x}", a.hex(), b.hex())
        want = ct.select(mask, a, b).hex()
        check(f"select(n={n})", got, want)

        # compare
        c = bytes(random.randrange(256) for _ in range(n))
        if random.random() < 0.5:
            c = b  # equal case
        got = run_cli("compare", a.hex(), c.hex())
        want = "ff" if a == c else "00"
        check(f"compare(n={n})", got, want)

        # fold_select
        width = random.randint(1, 16)
        count = random.randint(1, 8)
        flags = [random.randrange(2) for _ in range(count)]
        values = bytes(random.randrange(256) for _ in range(width * count))
        got = run_cli("fold", str(width), str(count), bytes(flags).hex(), values.hex())
        found, folded = ct.fold_select(list(zip(flags, [values[i * width:(i + 1) * width]
                                                        for i in range(count)])), width)
        want = f"{found:02x}" + folded.hex()
        check(f"fold(w={width},c={count})", got, want)

        # wipe
        buf = bytes(random.randrange(256) for _ in range(n))
        got = run_cli("wipe", buf.hex())
        want = bytes(n).hex()
        check(f"wipe(n={n})", got, want)

    print(f"crosscheck: {ROUNDS} Runden x 5 Operationen gegen Python-Referenz — alle identisch.")
    return 0 if failures == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
