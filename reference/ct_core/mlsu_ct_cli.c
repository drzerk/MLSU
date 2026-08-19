/* mlsu_ct_cli.c — deterministic command-line interface for cross-checking
 * the C helpers against the Python reference (reference/mlsu/ct.py).
 *
 * usage: mlsu_ct_cli <command> <args...>
 *   mask    <hexflag>            -> <hex 0x00|0xFF>
 *   select  <hexmask> <hexa> <hexb>  -> <hex out>
 *   compare <hexa> <hexb>        -> <hex 0x00|0xFF>
 *   fold    <width> <count> <hexflags> <hexvalues> -> <hex found-byte+out>
 *   wipe    <hex>                -> <hex zeros>
 *
 * All values are hex without "0x"; sizes are small (test vectors only).
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "mlsu_ct.h"

static int hexval(char c)
{
    if (c >= '0' && c <= '9') return c - '0';
    if (c >= 'a' && c <= 'f') return c - 'a' + 10;
    if (c >= 'A' && c <= 'F') return c - 'A' + 10;
    return -1;
}

static size_t hex_decode(const char *s, uint8_t *out, size_t max)
{
    size_t len = strlen(s);
    size_t i, n = 0;
    if (len % 2 != 0) return (size_t)-1;
    for (i = 0; i + 1 < len && n < max; i += 2) {
        int hi = hexval(s[i]), lo = hexval(s[i + 1]);
        if (hi < 0 || lo < 0) return (size_t)-1;
        out[n++] = (uint8_t)((hi << 4) | lo);
    }
    return n;
}

static void hex_print(const uint8_t *buf, size_t len)
{
    size_t i;
    for (i = 0; i < len; i++) {
        printf("%02x", buf[i]);
    }
    printf("\n");
}

#define MAX_BUF 4096

int main(int argc, char **argv)
{
    uint8_t a[MAX_BUF], b[MAX_BUF], out[MAX_BUF];
    size_t n;

    if (argc < 2) {
        fprintf(stderr, "usage: %s mask|select|compare|fold|wipe <args>\n", argv[0]);
        return 2;
    }

    if (strcmp(argv[1], "mask") == 0 && argc == 3) {
        uint8_t f;
        n = hex_decode(argv[2], &f, 1);
        if (n != 1) return 2;
        printf("%02x\n", mlsu_mask_from_flag(f));
        return 0;
    }

    if (strcmp(argv[1], "select") == 0 && argc == 5) {
        uint8_t mask;
        size_t na, nb;
        n = hex_decode(argv[2], &mask, 1);
        na = hex_decode(argv[3], a, MAX_BUF);
        nb = hex_decode(argv[4], b, MAX_BUF);
        if (n != 1 || na == (size_t)-1 || nb == (size_t)-1 || na != nb) return 2;
        mlsu_select(mask, a, b, out, na);
        hex_print(out, na);
        return 0;
    }

    if (strcmp(argv[1], "compare") == 0 && argc == 4) {
        size_t na, nb;
        na = hex_decode(argv[2], a, MAX_BUF);
        nb = hex_decode(argv[3], b, MAX_BUF);
        if (na == (size_t)-1 || nb == (size_t)-1 || na != nb) return 2;
        printf("%02x\n", mlsu_compare(a, b, na));
        return 0;
    }

    if (strcmp(argv[1], "fold") == 0 && argc == 6) {
        size_t width, count;
        size_t nf, nv;
        char *end;
        width = strtoul(argv[2], &end, 10);
        count = strtoul(argv[3], &end, 10);
        if (*end != '\0' || width == 0 || count == 0 || width * count > MAX_BUF) return 2;
        nf = hex_decode(argv[4], a, count); /* flags: count bytes */
        nv = hex_decode(argv[5], b, width * count); /* values */
        if (nf != count || nv != width * count) return 2;
        out[0] = mlsu_fold_select(a, b, width, count, out + 1);
        hex_print(out, width + 1);
        return 0;
    }

    if (strcmp(argv[1], "wipe") == 0 && argc == 3) {
        n = hex_decode(argv[2], a, MAX_BUF);
        if (n == (size_t)-1) return 2;
        mlsu_wipe(a, n);
        hex_print(a, n);
        return 0;
    }

    fprintf(stderr, "unknown command or bad arguments\n");
    return 2;
}
