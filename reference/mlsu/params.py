"""Tunable parameters of the MLSU reference model.

These are modelling parameters, not hardened production values. The point of
having them in one place is that every experiment states which set it used.
"""
from dataclasses import dataclass


@dataclass(frozen=True)
class KdfParams:
    """Argon2id cost parameters."""

    time_cost: int
    memory_cost_kib: int
    parallelism: int
    hash_len: int = 32

    def describe(self) -> str:
        return (
            f"Argon2id(t={self.time_cost}, "
            f"m={self.memory_cost_kib // 1024}MiB, p={self.parallelism})"
        )


#: Concept-paper parameters (README section 6.1). Slow on purpose.
KDF_STRONG = KdfParams(time_cost=3, memory_cost_kib=64 * 1024, parallelism=1)

#: Reduced parameters for experiments that need thousands of samples.
#: Security-irrelevant here: the timing rig measures *differences* between
#: inputs, and those do not depend on the absolute cost.
KDF_FAST = KdfParams(time_cost=1, memory_cost_kib=8 * 1024, parallelism=1)

#: Number of key slots written to storage, independent of how many profiles
#: are actually enrolled. Unused slots hold indistinguishable random data.
#:
#: This is what keeps the *number* of profiles out of the observable behaviour:
#: unlocking always performs SLOT_COUNT derivations. See SR-9 in the P0 document.
#: The cost is real — every unlock pays for SLOT_COUNT KDF runs — which is why
#: the value is small and why decision D2 recommends starting with two profiles.
SLOT_COUNT = 4

SALT_LEN = 16
NONCE_LEN = 12
PROFILE_KEY_LEN = 32

#: Failed attempts before a slot enters permanent lockout in the Weaver model.
MAX_FAILURES = 30
