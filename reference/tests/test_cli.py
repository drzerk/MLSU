"""End-to-end tests for the mlsu CLI (mlsu/cli.py).

Each test drives ``main()`` in-process against a store file in a temporary
directory — the same code path a user gets from ``python3 -m mlsu``.
"""
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from mlsu.cli import (  # noqa: E402
    EXIT_LOCKED_OUT,
    EXIT_OK,
    EXIT_STORE_ERROR,
    EXIT_THROTTLED,
    EXIT_USAGE,
    EXIT_WRONG_PIN,
    main,
)
from mlsu.params import KdfParams, MAX_FAILURES, SLOT_COUNT  # noqa: E402
from mlsu.storage import load_store, save_store  # noqa: E402


def cli(store_path: str, *argv: str) -> tuple[int, str]:
    """Run the CLI against *store_path* and capture stdout."""
    import io

    from contextlib import redirect_stdout

    buf = io.StringIO()
    with redirect_stdout(buf):
        code = main(["--store", store_path, *argv])
    return code, buf.getvalue()


class TestInit(unittest.TestCase):
    def test_init_creates_store(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "s.store")
            code, out = cli(path, "init")
            self.assertEqual(code, EXIT_OK)
            self.assertTrue(os.path.exists(path))
            self.assertIn("Neuer Store", out)
            store = load_store(path)
            self.assertEqual(store.slot_count, SLOT_COUNT)

    def test_init_refuses_overwrite_without_force(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "s.store")
            cli(path, "init")
            code, _ = cli(path, "init")
            self.assertEqual(code, EXIT_USAGE)
            code, _ = cli(path, "init", "--force")
            self.assertEqual(code, EXIT_OK)

    def test_init_with_slots_and_kdf(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "s.store")
            code, out = cli(path, "init", "--slots", "2", "--kdf", "strong")
            self.assertEqual(code, EXIT_OK)
            self.assertIn("2", out)
            self.assertIn("64MiB", out)  # KDF_STRONG
            store = load_store(path)
            self.assertEqual(store.slot_count, 2)
            self.assertEqual(
                store.kdf,
                KdfParams(time_cost=3, memory_cost_kib=64 * 1024, parallelism=1, hash_len=32),
            )


class TestEnroll(unittest.TestCase):
    def test_enroll_after_init(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "s.store")
            cli(path, "init")
            code, out = cli(path, "enroll", "471903", "1")
            self.assertEqual(code, EXIT_OK)
            self.assertIn("Profil 1", out)
            store = load_store(path)
            self.assertEqual(store.unlock("471903").profile_id, 1)

    def test_enroll_multiple_profiles(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "s.store")
            cli(path, "init")
            self.assertEqual(cli(path, "enroll", "111111", "1")[0], EXIT_OK)
            self.assertEqual(cli(path, "enroll", "222222", "2")[0], EXIT_OK)
            store = load_store(path)
            self.assertEqual(store.unlock("222222").profile_id, 2)

    def test_enroll_rejects_short_pin(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "s.store")
            cli(path, "init")
            code, _ = cli(path, "enroll", "12", "1")
            self.assertEqual(code, EXIT_USAGE)

    def test_enroll_rejects_bad_profile_id(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "s.store")
            cli(path, "init")
            code, _ = cli(path, "enroll", "123456", "256")
            self.assertEqual(code, EXIT_USAGE)

    def test_enroll_full_store(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "s.store")
            cli(path, "init", "--slots", "2")
            cli(path, "enroll", "111111", "1")
            cli(path, "enroll", "222222", "2")
            code, out = cli(path, "enroll", "333333", "3")
            self.assertEqual(code, EXIT_USAGE)
            self.assertIn("belegt", out)

    def test_enroll_refused_on_locked_store(self):
        """Enrolling into a permanently locked store would create a profile
        that can never unlock — the CLI refuses instead."""
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "s.store")
            cli(path, "init")
            store = load_store(path)
            for _ in range(MAX_FAILURES + 1):
                store.unlock("000000")
            save_store(store, path)
            code, _ = cli(path, "enroll", "471903", "1")
            self.assertEqual(code, EXIT_LOCKED_OUT)


class TestUnlock(unittest.TestCase):
    def test_correct_pin_opens_profile(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "s.store")
            cli(path, "init")
            cli(path, "enroll", "471903", "1")
            code, out = cli(path, "unlock", "471903")
            self.assertEqual(code, EXIT_OK)
            self.assertIn("Profil 1", out)

    def test_show_key_only_when_asked(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "s.store")
            cli(path, "init")
            cli(path, "enroll", "471903", "1")
            _, out = cli(path, "unlock", "471903")
            self.assertNotIn("Profilschlüssel", out)
            _, out = cli(path, "unlock", "471903", "--show-key")
            self.assertIn("Profilschlüssel", out)

    def test_wrong_pin(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "s.store")
            cli(path, "init")
            cli(path, "enroll", "471903", "1")
            code, _ = cli(path, "unlock", "000000")
            self.assertEqual(code, EXIT_WRONG_PIN)

    def test_missing_store(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "nope.store")
            code, _ = cli(path, "unlock", "1234")
            self.assertEqual(code, EXIT_STORE_ERROR)

    def test_wrong_pin_charges_counters_persistently(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "s.store")
            cli(path, "init")
            cli(path, "enroll", "471903", "1")
            cli(path, "unlock", "000000")
            store = load_store(path)
            self.assertEqual(store.weaver.snapshot(), [1] * SLOT_COUNT)

    def test_lockout_via_cli(self):
        """The CLI refuses attempts on a permanently locked store.

        Lockout is driven through the API here: with throttle enforcement a
        burst of wrong PINs via the CLI is slowed to one attempt per delay
        period, so 30 failures cannot happen in a test. That stretching of
        guesses is exactly what the rate limiter is for.
        """
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "s.store")
            cli(path, "init")
            cli(path, "enroll", "471903", "1")
            store = load_store(path)
            for _ in range(MAX_FAILURES + 1):
                store.unlock("000000")
            save_store(store, path)
            code, out = cli(path, "unlock", "471903")
            self.assertEqual(code, EXIT_LOCKED_OUT)
            self.assertIn("Gesperrt", out)

    def test_throttle_via_cli(self):
        """After 5 failures the rate limiter refuses — even the correct PIN."""
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "s.store")
            cli(path, "init")
            cli(path, "enroll", "471903", "1")
            for _ in range(5):
                cli(path, "unlock", "000000")
            code, out = cli(path, "unlock", "471903")
            self.assertEqual(code, EXIT_THROTTLED)
            self.assertIn("Gesperrt", out)
            self.assertIn("s", out)  # "Nächster Versuch erst in 30 s"

    def test_throttled_attempt_does_not_touch_store(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "s.store")
            cli(path, "init")
            cli(path, "enroll", "471903", "1")
            for _ in range(5):
                cli(path, "unlock", "000000")
            before = open(path, "rb").read()
            code, _ = cli(path, "unlock", "471903")
            self.assertEqual(code, EXIT_THROTTLED)
            after = open(path, "rb").read()
            self.assertEqual(before, after)  # no counters charged, no rewrite


class TestChangePinCli(unittest.TestCase):
    def test_change_pin_via_cli(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "s.store")
            cli(path, "init")
            cli(path, "enroll", "471903", "1")
            code, out = cli(path, "change-pin", "471903", "123456")
            self.assertEqual(code, EXIT_OK)
            self.assertIn("geändert", out)
            code, _ = cli(path, "unlock", "123456")
            self.assertEqual(code, EXIT_OK)
            code, _ = cli(path, "unlock", "471903")
            self.assertEqual(code, EXIT_WRONG_PIN)

    def test_change_pin_wrong_old_pin(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "s.store")
            cli(path, "init")
            cli(path, "enroll", "471903", "1")
            code, _ = cli(path, "change-pin", "999999", "123456")
            self.assertEqual(code, EXIT_WRONG_PIN)

    def test_change_pin_rejects_short_new_pin(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "s.store")
            cli(path, "init")
            cli(path, "enroll", "471903", "1")
            code, _ = cli(path, "change-pin", "471903", "12")
            self.assertEqual(code, EXIT_USAGE)

    def test_change_pin_persists(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "s.store")
            cli(path, "init")
            cli(path, "enroll", "471903", "1")
            cli(path, "change-pin", "471903", "123456")
            store = load_store(path)
            self.assertEqual(store.unlock("123456").profile_id, 1)

    def test_change_pin_throttled(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "s.store")
            cli(path, "init")
            cli(path, "enroll", "471903", "1")
            for _ in range(5):
                cli(path, "unlock", "000000")
            code, _ = cli(path, "change-pin", "471903", "123456")
            self.assertEqual(code, EXIT_THROTTLED)


class TestRemoveCli(unittest.TestCase):
    def test_remove_via_cli(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "s.store")
            cli(path, "init")
            cli(path, "enroll", "471903", "1")
            code, out = cli(path, "remove", "471903")
            self.assertEqual(code, EXIT_OK)
            self.assertIn("gelöscht", out)
            code, _ = cli(path, "unlock", "471903")
            self.assertEqual(code, EXIT_WRONG_PIN)
            # freed slot can take a new profile
            code, _ = cli(path, "enroll", "333333", "3")
            self.assertEqual(code, EXIT_OK)

    def test_remove_wrong_pin(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "s.store")
            cli(path, "init")
            cli(path, "enroll", "471903", "1")
            code, _ = cli(path, "remove", "999999")
            self.assertEqual(code, EXIT_WRONG_PIN)
            code, _ = cli(path, "unlock", "471903")
            self.assertEqual(code, EXIT_OK, "profile must be untouched")

    def test_remove_throttled(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "s.store")
            cli(path, "init")
            cli(path, "enroll", "471903", "1")
            for _ in range(5):
                cli(path, "unlock", "000000")
            code, _ = cli(path, "remove", "471903")
            self.assertEqual(code, EXIT_THROTTLED)


class TestLockCli(unittest.TestCase):
    def test_lock_reports_locked(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "s.store")
            cli(path, "init")
            cli(path, "enroll", "471903", "1")
            code, out = cli(path, "lock")
            self.assertEqual(code, EXIT_OK)
            self.assertIn("gesperrt", out.lower())

    def test_lock_missing_store(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "nope.store")
            code, _ = cli(path, "lock")
            self.assertEqual(code, EXIT_STORE_ERROR)


class TestStatus(unittest.TestCase):
    def test_status_hides_profile_count(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "s.store")
            cli(path, "init")
            cli(path, "enroll", "471903", "1")
            cli(path, "enroll", "220561", "2")
            code, out = cli(path, "status")
            self.assertEqual(code, EXIT_OK)
            self.assertIn(f"Slots: {SLOT_COUNT}", out)
            self.assertNotIn("Profil 1", out)
            self.assertNotIn("belegt", out)  # occupancy is SR-8 metadata

    def test_status_verbose_shows_slot_table(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "s.store")
            cli(path, "init")
            cli(path, "enroll", "471903", "1")
            code, out = cli(path, "status", "--verbose")
            self.assertEqual(code, EXIT_OK)
            self.assertIn("Slot 1:", out)
            self.assertIn("SR-8", out)  # warns about the metadata it reveals

    def test_status_missing_store(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "nope.store")
            code, _ = cli(path, "status")
            self.assertEqual(code, EXIT_STORE_ERROR)


if __name__ == "__main__":
    unittest.main()
