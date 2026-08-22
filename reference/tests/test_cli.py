"""CLI exit codes and the documented command surface."""

from __future__ import annotations

import io
import os
import unittest

from mlsu.cli import (
    EXIT_LOCKOUT,
    EXIT_MISS,
    EXIT_OK,
    EXIT_STORE,
    EXIT_THROTTLED,
    EXIT_USAGE,
    main,
)
from mlsu.params import MAX_FAILURES
from mlsu.storage import load_store

from support import DURESS_PIN, PRIVATE_PIN, temp_path


def run(argv) -> tuple[int, str]:
    buf = io.StringIO()
    code = main(argv, out=buf)
    return code, buf.getvalue()


class TestCliLifecycle(unittest.TestCase):
    def test_init_enroll_unlock_status(self) -> None:
        with temp_path() as path:
            code, out = run(["--store", path, "init", "--kdf", "test"])
            self.assertEqual(code, EXIT_OK)
            self.assertIn("Neuer Store", out)

            code, out = run(["--store", path, "enroll", PRIVATE_PIN, "1"])
            self.assertEqual(code, EXIT_OK)
            self.assertIn("Profil 1", out)

            code, out = run(["--store", path, "enroll", DURESS_PIN, "2"])
            self.assertEqual(code, EXIT_OK)

            code, out = run(["--store", path, "unlock", PRIVATE_PIN, "--show-key"])
            self.assertEqual(code, EXIT_OK)
            self.assertIn("Entsperrt: Profil 1", out)
            self.assertIn("Profilschlüssel:", out)

            code, out = run(["--store", path, "unlock", "111111"])
            self.assertEqual(code, EXIT_MISS)

            code, out = run(["--store", path, "status"])
            self.assertEqual(code, EXIT_OK)
            self.assertIn("Slots: 4", out)
            self.assertNotIn("belegt", out)

            code, out = run(["--store", path, "status", "--verbose"])
            self.assertEqual(code, EXIT_OK)
            self.assertIn("SR-8", out)
            self.assertIn("belegt", out)

    def test_change_pin_and_remove(self) -> None:
        with temp_path() as path:
            run(["--store", path, "init", "--kdf", "test"])
            run(["--store", path, "enroll", PRIVATE_PIN, "1"])
            code, out = run(["--store", path, "change-pin", PRIVATE_PIN, "135790"])
            self.assertEqual(code, EXIT_OK)
            self.assertEqual(run(["--store", path, "unlock", "135790"])[0], EXIT_OK)
            self.assertEqual(run(["--store", path, "unlock", PRIVATE_PIN])[0], EXIT_MISS)
            code, out = run(["--store", path, "remove", "135790"])
            self.assertEqual(code, EXIT_OK)
            self.assertIn("decoy", out)
            self.assertEqual(run(["--store", path, "unlock", "135790"])[0], EXIT_MISS)

    def test_lock_is_documentation(self) -> None:
        with temp_path() as path:
            run(["--store", path, "init", "--kdf", "test"])
            code, out = run(["--store", path, "lock"])
            self.assertEqual(code, EXIT_OK)
            self.assertIn("SR-2", out)

    def test_missing_store(self) -> None:
        code, out = run(["--store", "/tmp/mlsu-missing-xyz.store", "status"])
        self.assertEqual(code, EXIT_STORE)
        self.assertIn("Store-Fehler", out)

    def test_usage_errors(self) -> None:
        with temp_path() as path:
            run(["--store", path, "init", "--kdf", "test"])
            code, _ = run(["--store", path, "enroll", "12", "1"])
            self.assertEqual(code, EXIT_USAGE)
            code, _ = run(["--store", path, "unlock"])
            self.assertEqual(code, EXIT_USAGE)

    def test_throttle_exit_code(self) -> None:
        with temp_path() as path:
            run(["--store", path, "init", "--kdf", "test"])
            run(["--store", path, "enroll", PRIVATE_PIN, "1"])
            now_store = load_store(path)
            # Charge to the first throttle step via the API, persist, then CLI.
            t = 2_000_000_000.0
            for _ in range(5):
                now_store.unlock("000000", now=t)
            from mlsu.storage import save_store

            save_store(path, now_store)
            code, out = run(["--store", path, "unlock", "000000"])
            self.assertEqual(code, EXIT_THROTTLED)
            self.assertIn("Gesperrt", out)

    def test_lockout_exit_code(self) -> None:
        with temp_path() as path:
            run(["--store", path, "init", "--kdf", "test"])
            run(["--store", path, "enroll", PRIVATE_PIN, "1"])
            store = load_store(path)
            t = 2_000_000_000.0
            for _ in range(MAX_FAILURES):
                store.unlock("000000", now=t)
                t += 10_000.0
            from mlsu.storage import save_store

            save_store(path, store)
            code, out = run(["--store", path, "unlock", PRIVATE_PIN])
            self.assertEqual(code, EXIT_LOCKOUT)

    def test_file_size_stable_across_cli_ops(self) -> None:
        with temp_path() as path:
            run(["--store", path, "init", "--kdf", "test", "--slots", "4"])
            size = os.path.getsize(path)
            run(["--store", path, "enroll", PRIVATE_PIN, "1"])
            self.assertEqual(os.path.getsize(path), size)
            run(["--store", path, "enroll", DURESS_PIN, "2"])
            self.assertEqual(os.path.getsize(path), size)
            run(["--store", path, "remove", PRIVATE_PIN])
            self.assertEqual(os.path.getsize(path), size)


if __name__ == "__main__":
    unittest.main()
