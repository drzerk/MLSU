# Reference implementation — a model of the selection logic

A runnable model of the core mechanism from the
[concept paper](../README.en.md): **one PIN, several encrypted areas, at most
one of them opens.**

This is not Android code and not something to put on a real device. It is a
model built to be broken — so that wrong assumptions surface in Python instead
of in a lock screen patch. Since the Stufe-0 extension there is also a
persistent store file and a command line tool (`mlsu-cli`) for experimenting
with the mechanism.

*🇬🇧 English · [🇩🇪 Deutsch](README.md)*

---

## Running it

```bash
pip install -r requirements.txt

python3 demo.py                              # walk through the mechanism once
python3 -m unittest discover -s tests -v     # 60 tests (19 requirements + 41 storage/CLI)
python3 bench/timing.py --samples 300        # timing measurement (SR-3, SR-9)
python3 bench/timing.py --samples 12 --kdf strong   # with the concept parameters

python3 -m mlsu --store demo.store init      # CLI: create a store
python3 -m mlsu --store demo.store enroll 471903 1    # enrol profile 1
python3 -m mlsu --store demo.store enroll 220561 2    # enrol profile 2
python3 -m mlsu --store demo.store unlock 471903      # check a PIN
python3 -m mlsu --store demo.store status             # status (no profile count)
```

## What is modelled

| File | Contents |
|---|---|
| `mlsu/params.py` | Cost parameters, slot count — every experiment states what it ran with |
| `mlsu/keystore.py` | Key derivation, slots, unlocking; the mechanism itself |
| `mlsu/counters.py` | Model of hardware rate limiting (Weaver, with throttle timestamps) |
| `mlsu/ct.py` | Branch-free selection between candidates |
| `mlsu/storage.py` | Persistent store file: fixed binary format, atomic writes, validation |
| `mlsu/cli.py` | `mlsu-cli` — enrol, unlock, status; exit codes for scripts |
| `tests/` | One test per requirement from [P0](../docs/p0-requirements.en.md) plus persistence and CLI tests |
| `bench/timing.py` | Measurement rig for SR-3 and SR-9 |

## Persistence and CLI (Stufe-0 extension)

Since the Stufe-0 extension the store survives restarts: slots, failure
counters and throttle timestamps live in **one fixed-size file**. The size
does not change when a profile is enrolled — even on disk the profile count
is not readable from the file size (SR-8).

Each CLI invocation: load the store → check the rate limit → perform the
operation → write back atomically (`tempfile` + `fsync` + `rename`, no torn
store after a crash).

**Exit codes** (for scripts):

| Code | Meaning |
|---|---|
| 0 | Success (store created, profile enrolled, PIN unlocked) |
| 1 | Wrong PIN — no profile matches the input |
| 2 | Permanent lockout after too many failed attempts |
| 3 | Throttled — the rate limiter refuses the attempt for now |
| 4 | Store error (missing, corrupted, unsupported format) |
| 5 | Usage error (arguments, full store, PIN too short) |

The rate limit is enforced **before** any key derivation — a throttled
attempt does not charge the counters (like Weaver hardware, which would not
even accept the attempt). A burst of wrong PINs therefore reaches the
permanent lockout only through the delays (30 s → 300 s → 1 h), not in a
test loop; the tests create the lockout through the API instead. What becomes
visible is F-1 in action: the **decoy slots and the hidden profile** collect
failed attempts and get throttled too.

### Known deviation: the state byte (SR-8)

The store file carries one state byte per slot (0 = decoy, 1 = enrolled).
Without it a fresh process could not know which slot is free — and the CLI
would have to refuse enrolling a new profile after a restart. An examiner can
read *how many* profiles are enrolled from the file. This is a **documented
deviation** from the SR-8 ideal, not a hidden defect: a real MLSU must keep
this bookkeeping out of readable storage (e.g. only inside the already
unlocked private profile) or accept that the profile count is readable. The
slots themselves remain indistinguishable — same size, same shape, decoys
open for no PIN (that is what the SR-8 tests check). `status --verbose`
explicitly warns that the slot table it prints is metadata a product must not
show.

The structure follows section 6.1 of the concept paper:

```
PIN_i --Argon2id--> pin_key_i --AEAD unwrap--> profile_key_i
```

Two properties make the difference to "two profiles side by side":

1. **Fixed slot count.** Storage always holds `SLOT_COUNT` slots. Unoccupied
   slots contain random data that no PIN opens and are indistinguishable from
   occupied ones. Unlocking always computes every slot.
2. **No master key.** Every profile key is generated independently. Knowing one
   PIN teaches you nothing about the other areas.

## What this model cannot do

- **No statement about SR-2** (no key material of other profiles in RAM).
  CPython copies immutable `bytes` freely and zeroes nothing. That requirement
  is not testable here — not even negatively. See finding F-2.
- **No real constant time.** The interpreter allocates, the GC runs, integers
  are objects. `mlsu/ct.py` gets the *shape* of the selection right, no more.
- **No statement about real hardware.** What is measured is a Python model on a
  shared machine. A negative measurement is a sanity check, not proof.
- **No real file system or metadata layer.** The persistence layer stores
  slots and counters as one file. That is a model of the unlock mechanism, not
  of the Android file system (FBE, partitions, flash wear-leveling), and it
  says nothing about the metadata leaks from section 6.3 of the concept paper.

In short: this model can show that something does **not** work. It cannot show
that something is secure.

## Results

Five findings came out of building it, including a conflict between two
requirements and a methodological error in the rig itself:
[docs/p0-findings.en.md](../docs/p0-findings.en.md).

## License

[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/),
see [LICENSE](../LICENSE).
