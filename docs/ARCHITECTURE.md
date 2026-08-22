# Software architecture of this repository

MLSU is a *research* project. Nothing here is a flashable Android build.
The runnable software is a reference model of the lock-screen selection
logic plus an interactive explorer that makes the same mechanism visible.

```
                    ┌──────────────────────────────────┐
                    │  Interactive explorer (this SPA) │
                    │  React + Vite + Express          │
                    │  src/crypto/mlsuEngine.ts        │
                    └──────────────┬───────────────────┘
                                   │ same selection rules
                    ┌──────────────▼───────────────────┐
                    │  Python reference  reference/    │
                    │  Argon2id + ChaCha20-Poly1305    │
                    │  fixed-size store + CLI          │
                    └──────────────┬───────────────────┘
                                   │ fold_select spec
                    ┌──────────────▼───────────────────┐
                    │  C core  reference/ct_core       │
                    │  branch-free candidate folding   │
                    └──────────────────────────────────┘
```

## What each layer is for

| Layer | Language | Role |
|---|---|---|
| Explorer | TypeScript | Teach the mechanism, threat model and findings. WebCrypto AES-GCM stands in for AEAD; PBKDF2 stands in for Argon2id so the UI stays interactive. |
| Reference | Python | The model the requirements are tested against. Real Argon2id and ChaCha20-Poly1305. Persistent store. CLI with stable exit codes. |
| `ct_core` | C | The control-flow that a future AOSP binding would copy: visit every slot, fold with a mask, never early-return. |

## What is deliberately *not* here

- No patch against `LockSettingsService`. The change points live as a sketch in [`p1-poc-skizze.md`](p1-poc-skizze.md).
- No claim that SR-2 (no foreign keys in RAM) is proven. Python and JavaScript cannot prove it (finding F-2).
- No claim of constant wall-clock time. The structure is constant; the runtime is not.

## Data flow of one unlock

1. Rate-limit check (any slot still cooling → refuse the whole attempt).
2. For each of `SLOT_COUNT` slots: `Argon2id(PIN, salt_i)` → AEAD unwrap → `(flag, payload)`.
3. `fold_select` over the flags (no early return).
4. Hit: reset only the matched Weaver counter (SR-4). Miss: charge every counter (F-1).
5. Session holds at most one profile key; `lock()` drops it.

## Persistence

`reference/mlsu/storage.py` writes one file of size
`32 + slot_count × 94` bytes. Enrolment does not change the size.
A status byte per slot is a documented SR-8 deviation — see
[`reference/README.md`](../reference/README.md).
