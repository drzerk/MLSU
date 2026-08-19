/* mlsu_ct.h — constant-time helpers for the MLSU reference model.
 *
 * This is the C specification of reference/mlsu/ct.py: branch-free selection
 * between unlock candidates, as it must be implemented in the AOSP
 * integration path (see docs/p1-poc-skizze.md, components C1/C2, finding F-3).
 *
 * The functions are deliberately tiny and arithmetic-only: no branches on
 * secret-dependent values, no table lookups indexed by secret data, every
 * byte of every input is touched exactly once.
 *
 * Honest limitation: C compilers are allowed to transform code. This header
 * documents the intended constant-time shape; a security review must confirm
 * the emitted assembly (objdump) for the actual build flags. See README.md.
 */
#ifndef MLSU_CT_H
#define MLSU_CT_H

#include <stddef.h>
#include <stdint.h>

/* 0xFF if flag is odd, 0x00 otherwise. No branch, no lookup.
 * Matches ct.mask_from_flag in reference/mlsu/ct.py. */
uint8_t mlsu_mask_from_flag(uint8_t flag);

/* out[i] = (a[i] & mask) | (b[i] & ~mask) for every i.
 * Both inputs must have length len; every byte of a and b is read exactly
 * once regardless of mask. Element-wise, so out may alias a or b. */
void mlsu_select(uint8_t mask, const uint8_t *a, const uint8_t *b,
                 uint8_t *out, size_t len);

/* 0xFF if a == b byte-for-byte, 0x00 otherwise, without branching.
 * This is the tag comparison a real AEAD unwrap must use (finding F-3:
 * reference/model relies on an exception, which is not constant time). */
uint8_t mlsu_compare(const uint8_t *a, const uint8_t *b, size_t len);

/* Reduce `count` candidates (flag, value of `width` bytes) to the last one
 * with a set flag — matches ct.fold_select. Every candidate is processed
 * exactly once, no early exit. Returns 0x01 if any flag was set, 0x00
 * otherwise. `flags` has `count` bytes; `values` has count*width bytes;
 * `out` is written with `width` bytes (zeroed if nothing matched). */
uint8_t mlsu_fold_select(const uint8_t *flags, const uint8_t *values,
                         size_t width, size_t count, uint8_t *out);

/* Overwrite buf with zeros. Only meaningful for memory the caller can
 * guarantee is not shared elsewhere (see finding F-2). */
void mlsu_wipe(uint8_t *buf, size_t len);

#endif /* MLSU_CT_H */
