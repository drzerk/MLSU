#include "mlsu_ct.h"

#include <string.h>

void mlsu_fold_select(const uint8_t *flags,
                      const uint8_t *payloads,
                      size_t n,
                      size_t payload_len,
                      uint8_t *out_found,
                      uint8_t *out_payload)
{
    uint8_t any = 0;
    size_t i;
    size_t j;

    if (out_payload != NULL && payload_len > 0) {
        memset(out_payload, 0, payload_len);
    }

    for (i = 0; i < n; i++) {
        /* mask is 0x00 or 0xFF without a secret-dependent branch on payload. */
        uint8_t bit = flags[i] != 0 ? 1u : 0u;
        uint8_t mask = (uint8_t)(0u - bit);
        const uint8_t *row = payloads + (i * payload_len);

        any = (uint8_t)(any | bit);
        for (j = 0; j < payload_len; j++) {
            out_payload[j] = (uint8_t)(out_payload[j] | (row[j] & mask));
        }
    }

    if (out_found != NULL) {
        *out_found = any != 0 ? 1u : 0u;
    }
}
