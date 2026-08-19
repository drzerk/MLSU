/* mlsu_ct.c — implementation of the constant-time helpers (see mlsu_ct.h). */
#include "mlsu_ct.h"

uint8_t mlsu_mask_from_flag(uint8_t flag)
{
    /* 0u - (flag & 1u) wraps to 0xFFFFFFFF for odd, stays 0 for even;
     * the cast keeps the low byte. Purely arithmetic, no branch. */
    return (uint8_t)(0u - (flag & 1u));
}

void mlsu_select(uint8_t mask, const uint8_t *a, const uint8_t *b,
                 uint8_t *out, size_t len)
{
    const uint8_t not_mask = (uint8_t)~mask;
    size_t i;
    for (i = 0; i < len; i++) {
        out[i] = (uint8_t)((a[i] & mask) | (b[i] & not_mask));
    }
}

uint8_t mlsu_compare(const uint8_t *a, const uint8_t *b, size_t len)
{
    uint8_t diff = 0;
    size_t i;
    for (i = 0; i < len; i++) {
        diff |= (uint8_t)(a[i] ^ b[i]);
    }
    /* diff == 0 (equal) -> want 0xFF; diff != 0 -> want 0x00.
     * any is 1 iff diff != 0 (bit 31 of (diff | (0 - diff)) in uint32
     * wrap-around arithmetic). Invert: 0 - (any ^ 1) gives 0xFF/0x00. */
    {
        uint32_t any = (uint32_t)diff | (0u - (uint32_t)diff);
        any >>= 31;
        return (uint8_t)(0u - (any ^ 1u));
    }
}

uint8_t mlsu_fold_select(const uint8_t *flags, const uint8_t *values,
                         size_t width, size_t count, uint8_t *out)
{
    uint8_t found = 0;
    size_t i, c;
    for (i = 0; i < width; i++) {
        out[i] = 0;
    }
    for (c = 0; c < count; c++) {
        const uint8_t m = mlsu_mask_from_flag(flags[c]);
        const uint8_t not_m = (uint8_t)~m;
        const uint8_t *val = values + c * width;
        for (i = 0; i < width; i++) {
            out[i] = (uint8_t)((val[i] & m) | (out[i] & not_m));
        }
        found |= (uint8_t)(flags[c] & 1u);
    }
    return found;
}

void mlsu_wipe(uint8_t *buf, size_t len)
{
    size_t i;
    for (i = 0; i < len; i++) {
        buf[i] = 0;
    }
}
