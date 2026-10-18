#include <stdint.h>
#include <stdio.h>

/* Matches mimalloc's fallback: +r initializes the destination to 64.
 * For zero input its preservation is a native compatibility expectation,
 * not an architectural guarantee (BSF's zero-input destination is undefined). */
static int probe(uint64_t input, uint64_t expected, unsigned char expected_zf) {
  uint64_t destination = 64;
  unsigned char zf;
  __asm__ volatile("bsfq %2, %0; setz %1"
                   : "+r"(destination), "=qm"(zf)
                   : "r"(input)
                   : "cc");
  printf("bsf input=%016llx destination=%llu zf=%u expected=%llu/%u\n",
         (unsigned long long)input, (unsigned long long)destination,
         (unsigned)zf, (unsigned long long)expected, (unsigned)expected_zf);
  fflush(stdout);
  return destination == expected && zf == expected_zf;
}

int main(void) {
  int nonzero = probe(UINT64_C(0x8000), 15, 0);
  int zero = probe(0, 64, 1);
  if (!nonzero || !zero) {
    fputs("FAIL bsf native compatibility\n", stderr);
    return 1;
  }
  puts("PASS bsf native compatibility");
  return 0;
}
