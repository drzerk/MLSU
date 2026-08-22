#include "mlsu_ct.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static int hex_nibble(int ch)
{
    if (ch >= '0' && ch <= '9') {
        return ch - '0';
    }
    if (ch >= 'a' && ch <= 'f') {
        return ch - 'a' + 10;
    }
    if (ch >= 'A' && ch <= 'F') {
        return ch - 'A' + 10;
    }
    return -1;
}

static int parse_hex(const char *hex, uint8_t *out, size_t out_len)
{
    size_t hex_len = strlen(hex);
    size_t i;

    if (hex_len != out_len * 2) {
        return -1;
    }
    for (i = 0; i < out_len; i++) {
        int hi = hex_nibble((unsigned char)hex[i * 2]);
        int lo = hex_nibble((unsigned char)hex[i * 2 + 1]);
        if (hi < 0 || lo < 0) {
            return -1;
        }
        out[i] = (uint8_t)((hi << 4) | lo);
    }
    return 0;
}

static void print_hex(const uint8_t *data, size_t len)
{
    size_t i;
    for (i = 0; i < len; i++) {
        printf("%02x", data[i]);
    }
}

int main(int argc, char **argv)
{
    size_t n;
    size_t payload_len;
    size_t i;
    uint8_t *flags = NULL;
    uint8_t *payloads = NULL;
    uint8_t *out = NULL;
    uint8_t found = 0;
    int rc = 2;

    if (argc != 6 || strcmp(argv[1], "fold") != 0) {
        fprintf(stderr,
                "Usage: %s fold <n> <payload_len> <flags 0/1> <payloads hex>\n",
                argv[0]);
        return 2;
    }

    n = (size_t)strtoul(argv[2], NULL, 10);
    payload_len = (size_t)strtoul(argv[3], NULL, 10);
    if (n == 0 || payload_len == 0 || n > 64 || payload_len > 256) {
        fprintf(stderr, "n and payload_len out of range\n");
        return 2;
    }
    if (strlen(argv[4]) != n) {
        fprintf(stderr, "flags string must have exactly n characters\n");
        return 2;
    }

    flags = (uint8_t *)calloc(n, 1);
    payloads = (uint8_t *)calloc(n * payload_len, 1);
    out = (uint8_t *)calloc(payload_len, 1);
    if (flags == NULL || payloads == NULL || out == NULL) {
        fprintf(stderr, "out of memory\n");
        goto done;
    }

    for (i = 0; i < n; i++) {
        if (argv[4][i] != '0' && argv[4][i] != '1') {
            fprintf(stderr, "flags must be 0 or 1\n");
            goto done;
        }
        flags[i] = (uint8_t)(argv[4][i] == '1' ? 1 : 0);
    }

    if (parse_hex(argv[5], payloads, n * payload_len) != 0) {
        fprintf(stderr, "payloads hex has the wrong length or is not hex\n");
        goto done;
    }

    mlsu_fold_select(flags, payloads, n, payload_len, &found, out);
    printf("found=%u payload=", (unsigned)found);
    print_hex(out, payload_len);
    printf("\n");
    rc = 0;

done:
    free(flags);
    free(payloads);
    free(out);
    return rc;
}
