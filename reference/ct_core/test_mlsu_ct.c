#include "mlsu_ct.h"

#include <stdio.h>
#include <string.h>

static int failures = 0;

static void expect_eq(const char *name, int cond)
{
    if (!cond) {
        fprintf(stderr, "FAIL %s\n", name);
        failures += 1;
    }
}

static void test_no_match(void)
{
    uint8_t flags[2] = {0, 0};
    uint8_t payloads[8] = {1, 2, 3, 4, 5, 6, 7, 8};
    uint8_t out[4];
    uint8_t found = 1;

    mlsu_fold_select(flags, payloads, 2, 4, &found, out);
    expect_eq("no_match.found", found == 0);
    expect_eq("no_match.zero", out[0] == 0 && out[1] == 0 && out[2] == 0 && out[3] == 0);
}

static void test_first_match(void)
{
    uint8_t flags[2] = {1, 0};
    uint8_t payloads[8] = {0x11, 0x22, 0x33, 0x44, 0xff, 0xff, 0xff, 0xff};
    uint8_t out[4];
    uint8_t found = 0;

    mlsu_fold_select(flags, payloads, 2, 4, &found, out);
    expect_eq("first.found", found == 1);
    expect_eq("first.payload", memcmp(out, payloads, 4) == 0);
}

static void test_last_match(void)
{
    uint8_t flags[3] = {0, 0, 1};
    uint8_t payloads[6] = {0xaa, 0xbb, 0xcc, 0xdd, 0x10, 0x20};
    uint8_t out[2];
    uint8_t found = 0;

    mlsu_fold_select(flags, payloads, 3, 2, &found, out);
    expect_eq("last.found", found == 1);
    expect_eq("last.payload", out[0] == 0x10 && out[1] == 0x20);
}

static void test_or_of_two_hits(void)
{
    uint8_t flags[2] = {1, 1};
    uint8_t payloads[4] = {0x01, 0x0f, 0x04, 0xf0};
    uint8_t out[2];
    uint8_t found = 0;

    mlsu_fold_select(flags, payloads, 2, 2, &found, out);
    expect_eq("or.found", found == 1);
    expect_eq("or.payload", out[0] == 0x05 && out[1] == 0xff);
}

int main(void)
{
    test_no_match();
    test_first_match();
    test_last_match();
    test_or_of_two_hits();
    if (failures != 0) {
        fprintf(stderr, "%d test(s) failed\n", failures);
        return 1;
    }
    printf("ok — 4 unit tests\n");
    return 0;
}
