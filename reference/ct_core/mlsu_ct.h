#ifndef MLSU_CT_H
#define MLSU_CT_H

#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/*
 * Branch-free candidate folding. Specification for the AOSP selection path.
 *
 * flags[i] is treated as 0 or non-zero. payloads is n * payload_len bytes,
 * row-major. out_payload must have payload_len bytes. out_found is set to
 * 0 or 1. When several flags are set the payloads are OR-ed.
 *
 * This function visits every candidate. It does not early-return on a hit.
 */
void mlsu_fold_select(const uint8_t *flags,
                      const uint8_t *payloads,
                      size_t n,
                      size_t payload_len,
                      uint8_t *out_found,
                      uint8_t *out_payload);

#ifdef __cplusplus
}
#endif

#endif /* MLSU_CT_H */
