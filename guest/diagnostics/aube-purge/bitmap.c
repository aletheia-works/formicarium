/* Include the exact, unmodified crate implementation in this diagnostic TU.
 * Do not also compile static.c when building this file. */
#include "static.c"
#include <stdio.h>
#include <stdlib.h>

enum { BIT_COUNT = 1024 };
typedef struct {
  mi_bitmap_t *bitmap;
  unsigned char expected[BIT_COUNT];
  unsigned char visited[BIT_COUNT];
  size_t calls;
  size_t last_start;
  size_t last_count;
  bool stop;
} visitor_state;

static void check(bool condition, const char *reason) {
  if (!condition) {
    fprintf(stderr, "FAIL bitmap reason=%s\n", reason);
    fflush(stderr);
    exit(1);
  }
}

static bool visit(size_t start, size_t count, mi_arena_t *arena, void *arg) {
  MI_UNUSED(arena);
  visitor_state *s = arg;
  check(++s->calls <= BIT_COUNT, "callback bound exceeded");
  check(count > 0 && start < BIT_COUNT && count <= BIT_COUNT - start,
        "callback range invalid");
  check(start / MI_BFIELD_BITS == (start + count - 1) / MI_BFIELD_BITS,
        "callback crossed field boundary");
  for (size_t i = start; i < start + count; ++i) {
    check(s->expected[i] && !s->visited[i], "unexpected or duplicate visit");
    check(!mi_bitmap_is_set(s->bitmap, i), "range was not atomically cleared");
    s->visited[i] = 1;
  }
  s->last_start = start;
  s->last_count = count;
  return !s->stop;
}

static void compare(mi_bitmap_t *bitmap, const unsigned char *expected) {
  size_t count = 0;
  for (size_t i = 0; i < BIT_COUNT; ++i) {
    check(mi_bitmap_is_set(bitmap, i) == (expected[i] != 0), "bit mismatch");
    count += expected[i] != 0;
  }
  check(mi_bitmap_popcountN(bitmap, 0, BIT_COUNT) == count, "popcount mismatch");
}

static void pattern(mi_bitmap_t *bitmap, unsigned char *bits, unsigned which) {
  mi_bitmap_init(bitmap, BIT_COUNT, false);
  memset(bits, 0, BIT_COUNT);
  const size_t starts[] = {0, 0, 63, 511, 56, 504};
  const size_t lengths[] = {BIT_COUNT, 64, 2, 2, 16, 16};
  size_t start = starts[which], count = lengths[which];
  size_t already = BIT_COUNT;
  check(mi_bitmap_setN(bitmap, start, count, &already), "initial setN transition");
  check(already == 0, "initial setN count");
  memset(bits + start, 1, count);
  compare(bitmap, bits);
  check(!mi_bitmap_setN(bitmap, start, count, &already), "repeat setN transition");
  check(already == count, "repeat setN count");
  compare(bitmap, bits);
  check(mi_bitmap_clearN(bitmap, start, count), "clearN transition");
  memset(bits + start, 0, count);
  compare(bitmap, bits);
  check(!mi_bitmap_clearN(bitmap, start, count), "repeat clearN transition");
  check(mi_bitmap_setN(bitmap, start, count, &already), "restore setN transition");
  memset(bits + start, 1, count);
  compare(bitmap, bits);
}

static void run(mi_bitmap_t *bitmap, unsigned which, size_t width, bool stop) {
  unsigned char original[BIT_COUNT];
  unsigned char remaining[BIT_COUNT];
  visitor_state s = {0};
  pattern(bitmap, original, which);
  s.bitmap = bitmap;
  s.stop = stop;
  /* Independent bit-array oracle: n>1 visits only fully set aligned groups;
   * n=1 visits every set bit, combined into field-local contiguous runs. */
  for (size_t base = 0; base < BIT_COUNT; base += width) {
    bool full = true;
    for (size_t j = 0; j < width; ++j) full = full && original[base + j];
    if (full) memset(s.expected + base, 1, width);
  }
  fprintf(stderr, "bitmap pattern=%u width=%zu stop=%u before-iterator\n",
          which, width, (unsigned)stop);
  fflush(stderr);
  bool result = _mi_bitmap_forall_setc_rangesn(bitmap, width, visit, NULL, &s);
  check(result == !(stop && s.calls != 0), "iterator result mismatch");
  memcpy(remaining, original, sizeof remaining);
  for (size_t i = 0; i < BIT_COUNT; ++i) {
    if (!stop) check(s.visited[i] == s.expected[i], "missing visit");
    if (s.visited[i]) remaining[i] = 0;
  }
  /* The generic n=1 routine restores the rejected callback's current range;
   * aligned n>1 restores only skipped/unvisited ranges, consuming current. */
  if (stop && width == 1 && s.calls) {
    memset(remaining + s.last_start, 1, s.last_count);
  }
  compare(bitmap, remaining);
  if (stop) check(s.calls <= 1, "early stop not respected");
  fprintf(stderr, "bitmap pattern=%u width=%zu stop=%u after-iterator calls=%zu\n",
          which, width, (unsigned)stop, s.calls);
  fflush(stderr);
}

int main(void) {
  size_t size = mi_bitmap_size(BIT_COUNT, NULL);
  mi_bitmap_t *bitmap = mi_malloc_aligned(size, MI_BCHUNK_SIZE);
  check(bitmap != NULL, "bitmap allocation failed");
  const size_t widths[] = {1, 8, 32, 64};
  for (unsigned p = 0; p < 6; ++p) {
    for (unsigned w = 0; w < 4; ++w) {
      run(bitmap, p, widths[w], false);
      run(bitmap, p, widths[w], true);
    }
  }
  mi_free(bitmap);
  puts("PASS aube-purge bitmap set/clear/visitor/restoration");
  return 0;
}
