#include <mimalloc.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

/* Explicit arena places freed runs at differing slice/bitmap positions.
 * Mimalloc may separately reserve an automatic arena; this does not bound
 * total virtual reservations. This is a diagnostic, not an aube change. */
enum { SLOT_COUNT = 128, ROUND_COUNT = 4, SLICE = 65536 };
struct slot { unsigned char *p; size_t size; unsigned char value; };

static void phase(unsigned round, const char *name) {
  fprintf(stderr, "aube-purge round=%u phase=%s\n", round, name);
  fflush(stderr);
}

static void fail(unsigned round, unsigned index, const char *reason) {
  fprintf(stderr, "FAIL round=%u slot=%u reason=%s\n", round, index, reason);
  fflush(stderr);
  exit(1);
}

static void verify(struct slot *slots, unsigned round) {
  for (unsigned i = 0; i < SLOT_COUNT; ++i) {
    if (!slots[i].p) continue;
    const volatile unsigned char *p = slots[i].p;
    for (size_t j = 0; j < slots[i].size; ++j) {
      if (p[j] != slots[i].value) {
        fprintf(stderr, "mismatch byte=%zu expected=%u actual=%u\n",
                j, slots[i].value, p[j]);
        fail(round, i, "live allocation changed");
      }
    }
  }
}

static void allocate(mi_heap_t *heap, struct slot *s, unsigned round,
                     unsigned index) {
  /* > small-page allocations; aggregate requested bytes are 36 MiB.
   * Rotating sizes moves holes across bitmap-word and 2 MiB positions. */
  s->size = (size_t)(1 + ((index + round) % 8)) * SLICE;
  s->value = (unsigned char)(1 + ((index * 37 + round * 19) % 254));
  s->p = mi_heap_malloc(heap, s->size);
  if (!s->p) fail(round, index, "allocation failed");
  memset(s->p, s->value, s->size);
}

static void collect(mi_heap_t *heap, struct slot *slots, unsigned round) {
  phase(round, "before-heap-collect");
  mi_heap_collect(heap, true);
  phase(round, "after-heap-collect-before-global-collect");
  mi_collect(true);
  phase(round, "after-global-collect");
  verify(slots, round);
  phase(round, "live-bytes-verified");
}

int main(void) {
  mi_arena_id_t arena = 0;
  phase(0, "reserve-exclusive-128MiB-arena");
  if (mi_reserve_os_memory_ex((size_t)128 * 1024 * 1024,
                              false, false, true, &arena) != 0) {
    fail(0, 0, "arena reservation failed");
  }
  mi_heap_t *heap = mi_heap_new_in_arena(arena);
  if (!heap) fail(0, 0, "arena heap creation failed");
  struct slot slots[SLOT_COUNT] = {0};
  for (unsigned i = 0; i < SLOT_COUNT; ++i) allocate(heap, &slots[i], 0, i);
  verify(slots, 0);

  for (unsigned round = 0; round < ROUND_COUNT; ++round) {
    phase(round, "before-free-runs");
    for (unsigned i = 0; i < SLOT_COUNT; ++i) {
      /* Alternate isolated holes, adjacent pairs, and long runs. */
      const unsigned widths[ROUND_COUNT] = {1, 2, 8, 64};
      unsigned width = widths[round];
      if ((i / width + round) % 2 == 0) {
        mi_free(slots[i].p);
        slots[i].p = NULL;
      }
    }
    phase(round, "after-free-runs");
    collect(heap, slots, round);
    phase(round, "before-reallocate");
    for (unsigned i = 0; i < SLOT_COUNT; ++i) {
      if (!slots[i].p) allocate(heap, &slots[i], round + 1, i);
    }
    verify(slots, round);
    phase(round, "reallocated-bytes-verified");
  }

  phase(ROUND_COUNT, "before-final-free");
  for (unsigned i = 0; i < SLOT_COUNT; ++i) {
    mi_free(slots[i].p);
    slots[i].p = NULL;
  }
  collect(heap, slots, ROUND_COUNT);
  mi_heap_delete(heap);
  phase(ROUND_COUNT, "before-final-global-collect");
  mi_collect(true);
  phase(ROUND_COUNT, "done");
  puts("PASS aube-purge live-bytes and reuse");
  return 0;
}
