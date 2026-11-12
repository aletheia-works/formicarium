/*
 * hello と同じ出力の、動的リンクのゲスト（ADR 0016 の確認用）。
 * libc だけを使うので、動かすのに要るのは musl の動的リンカ（/lib/ld-musl-x86_64.so.1）だけ。
 */
#include <stdio.h>

int main(int argc, char **argv) {
  puts("hello from formicarium guest");
  for (int i = 1; i < argc; i++) printf("arg: %s\n", argv[i]);
  return 0;
}
