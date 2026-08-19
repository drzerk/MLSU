/* test_mlsu_ct.c — unit tests mirroring the Python tests in
 * tests/test_keystore.py (TestConstantTimeHelpers) plus F-3 coverage.
 * Build with:  make test   (or: cc -std=c11 -O2 -o test_mlsu_ct mlsu_ct.c test_mlsu_ct.c)
 */
#include <stdio.h>
#include <string.h>

#include "mlsu_ct.h"

static int failures = 0;

#define CHECK(cond, name)                                                     \
    do {                                                                      \
        if (cond) {                                                           \
            printf("ok   %s\n", name);                                        \
        } else {                                                              \
            printf("FAIL %s\n", name);                                        \
            failures++;                                                       \
        }                                                                     \
    } while (0)

static void test_mask(void)
{
    CHECK(mlsu_mask_from_flag(0x00) == 0x00, "mask_from_flag(0) == 0x00");
    CHECK(mlsu_mask_from_flag(0x01) == 0xFF, "mask_from_flag(1) == 0xFF");
    CHECK(mlsu_mask_from_flag(0x02) == 0x00, "mask_from_flag(2) == 0x00");
    CHECK(mlsu_mask_from_flag(0x41) == 0xFF, "mask_from_flag(0x41) == 0xFF (odd)");
}

static void test_select(void)
{
    uint8_t a[8], b[8], out[8];
    int i;
    for (i = 0; i < 8; i++) a[i] = 0xAA;
    for (i = 0; i < 8; i++) b[i] = 0xBB;

    mlsu_select(0xFF, a, b, out, 8);
    CHECK(memcmp(out, a, 8) == 0, "select(0xFF) picks a");

    mlsu_select(0x00, a, b, out, 8);
    CHECK(memcmp(out, b, 8) == 0, "select(0x00) picks b");

    /* mixed mask: 0x0F selects low nibble of a, high nibble of b */
    mlsu_select(0x0F, a, b, out, 8);
    CHECK(out[0] == 0xBA, "select(0x0F) mixes nibbles");

    /* out may alias b (in-place fold semantics) */
    mlsu_select(0xFF, a, b, b, 8);
    CHECK(memcmp(b, a, 8) == 0, "select aliases b");
}

static void test_compare(void)
{
    uint8_t a[6] = {1, 2, 3, 4, 5, 6};
    uint8_t b[6] = {1, 2, 3, 4, 5, 6};
    uint8_t c[6] = {1, 2, 3, 4, 5, 7};

    CHECK(mlsu_compare(a, b, 6) == 0xFF, "compare equal == 0xFF");
    CHECK(mlsu_compare(a, c, 6) == 0x00, "compare differ == 0x00 (last byte)");
    c[5] = 6;
    c[0] = 9;
    CHECK(mlsu_compare(a, c, 6) == 0x00, "compare differ == 0x00 (first byte)");
    CHECK(mlsu_compare(a, a, 0) == 0xFF, "compare empty == 0xFF");
}

static void test_fold_select(void)
{
    uint8_t flags[3] = {0, 1, 0};
    uint8_t values[3 * 4] = {1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3};
    uint8_t out[4];
    uint8_t found;

    found = mlsu_fold_select(flags, values, 4, 3, out);
    CHECK(found == 0x01, "fold found flag");
    CHECK(memcmp(out, values + 4, 4) == 0, "fold picks the flagged candidate");

    flags[1] = 0;
    found = mlsu_fold_select(flags, values, 4, 3, out);
    CHECK(found == 0x00, "fold without hit: found == 0");
    {
        int i;
        for (i = 0; i < 4; i++) CHECK(out[i] == 0, "fold without hit: zeroed");
    }

    /* last flagged candidate wins, matching ct.fold_select */
    flags[0] = 1;
    flags[1] = 1;
    flags[2] = 1;
    found = mlsu_fold_select(flags, values, 4, 3, out);
    CHECK(found == 0x01, "fold multiple hits: found == 1");
    CHECK(memcmp(out, values + 8, 4) == 0, "fold multiple hits: last wins");
}

static void test_wipe(void)
{
    uint8_t buf[8] = {1, 2, 3, 4, 5, 6, 7, 8};
    int i;
    mlsu_wipe(buf, 8);
    for (i = 0; i < 8; i++) CHECK(buf[i] == 0, "wipe zeroes buffer");
}

int main(void)
{
    test_mask();
    test_select();
    test_compare();
    test_fold_select();
    test_wipe();

    if (failures == 0) {
        printf("\nAll ct_core C tests passed.\n");
        return 0;
    }
    printf("\n%d test(s) failed.\n", failures);
    return 1;
}
