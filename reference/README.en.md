# Reference implementation — a model of the selection logic

A runnable model of the core mechanism from the
[concept paper](../README.en.md): **one PIN, several encrypted areas, at most
one of them opens.**

This is not Android code and not something to use. It is a model built to be
broken — so that wrong assumptions surface in 400 lines of Python instead of in
a lock screen patch.

*🇬🇧 English · [🇩🇪 Deutsch](README.md)*

---

## Running it

```bash
pip install -r requirements.txt

python3 demo.py                              # walk through the mechanism once
python3 -m unittest discover -s tests -v     # 19 requirement tests
python3 bench/timing.py --samples 300        # timing measurement (SR-3, SR-9)
python3 bench/timing.py --samples 12 --kdf strong   # with the concept parameters
```

## What is modelled

| File | Contents |
|---|---|
| `mlsu/params.py` | Cost parameters, slot count — every experiment states what it ran with |
| `mlsu/keystore.py` | Key derivation, slots, unlocking; the mechanism itself |
| `mlsu/counters.py` | Model of hardware rate limiting (Weaver) |
| `mlsu/ct.py` | Branch-free selection between candidates |
| `tests/` | One test per requirement from [P0](../docs/p0-requirements.en.md) |
| `bench/timing.py` | Measurement rig for SR-3 and SR-9 |

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
- **No storage, metadata or file system layer.** That is the harder part of the
  concept and is not represented here at all.

In short: this model can show that something does **not** work. It cannot show
that something is secure.

## Results

Five findings came out of building it, including a conflict between two
requirements and a methodological error in the rig itself:
[docs/p0-findings.en.md](../docs/p0-findings.en.md).

## License

[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/),
see [LICENSE](../LICENSE).
