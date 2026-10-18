# aube purge 診断（Step39）

libmimalloc-sys 0.1.49 の同一crate内のdefault v3をリンクする専用診断。
aube、runtime、core、baseline、製品の環境設定は変更しない。
exclusive 128 MiB arenaで128個の64–512 KiB割当を行い、4種類の解放run、
強制heap/global collect、残存全byte検査、再割当を実施する。
要求するlive bytesは最大64 MiB、exclusive arena予約128 MiB。
主セッションのtraceでは別のautomatic arenaの1 GiB仮想予約も観測済み。
従って総仮想予約が1 GiB未満とは主張しない。wasm物理memory上限1 GiBは維持。
stderrのphaseにより
free / heap collect / global collect / 再利用のどこで止まるかを区別できる。

## 正確なソース入力

crate: `/private/tmp/formicarium-mimalloc.crate`

SHA-256: `6a45a52f43e1c16f667ccfe4dd8c85b7f7c204fd5e3bf46c5b0db9a5c3c0b8e9`

主セッションが照合・展開済みのディレクトリ:
`/private/tmp/formicarium-mimalloc-reproduction-v1/libmimalloc-sys-0.1.49`

新規環境では`shasum -a 256 /private/tmp/formicarium-mimalloc.crate`で上記と
一致を確認し、空の専用一時ディレクトリに`tar -xf`で展開する。
第三者ソースをリポジトリへvendorしない。ソースは変更せず使用する。

## ビルド（主セッションのみ）

Linux x86_64 muslのコンテナで、照合済みcrateを`/work/crate`、この診断を
`/work/diagnostic`に読み取り専用マウントし、空の出力を`/out`にマウントする。
使用する既存コンテナimageのdigest、compiler version、コマンドと出力を保存する。
以下はそのコンテナ内の正確なコンパイルコマンド（`cc`はmusl compiler）:

```sh
cc -std=c11 -O3 -static -pthread -ftls-model=initial-exec \
  -Wno-error=date-time -DMI_DEBUG=0 -DMI_BUILD_RELEASE -DNDEBUG \
  -I/work/crate/c_src/mimalloc/v3/include \
  -I/work/crate/c_src/mimalloc/v3/src \
  /work/crate/c_src/mimalloc/v3/src/static.c \
  /work/diagnostic/main.c -o /out/aube-purge
```

build.rsのrelease/default v3と同じdefines/TLS指定を使用する。
secure/debug/override/no-thp等の非default featureは有効にしない。
`-O3`はrelease診断の指定であり、aubeの元ビルドの全compiler flagsと
一致することは未検証。allocator public API経由のpurge再現を目的とする。

## native → 同一ELF blink（主セッションのみ）

コンテナ内で先に`/out/aube-purge`を実行し、phaseとPASS、exit codeを保存する。
native失敗時はblink結果を正しい期待値として扱わない。
出力ELFのSHA-256を保存し、同じbytesをNode runnerへ渡す。
Node実体パスは主セッションでmiseから解決した絶対パスを使う。
現在の`runtime/node/run.ts`のCLIに従う正式呼出し:

```sh
/ABSOLUTE/NODE runtime/node/run.js --timeout 600 /private/tmp/formicarium-mimalloc-reproduction-v1/aube-purge
/ABSOLUTE/NODE runtime/node/run.js --timeout 600 --env MIMALLOC_PURGE_DELAY=-1 /private/tmp/formicarium-mimalloc-reproduction-v1/aube-purge
```

最初の実行はpurge設定を上書きしない。第2実行だけ診断controlとしてpurgeを
無効化する。どちらも同じELF、600秒上限で逐次実行し、phase/exit/timeoutを保存。
製品に環境設定を追加する指示ではない。
必要なら既存の`--core-flag -s --core-flag -e`でsyscall traceを採取する。

## 適用限界

作成時点では本診断のbuild/実行は未検証。成功してもaube固有のthread、
subprocess、割当順の問題まで否定できない。arena境界を実際に訪問したか、
purge bitmapのどのindexが停止したかはtrace/guest PCで確認する。
purgeを無効化したcontrolのみ成功しても、それを製品修正として採用しない。

## bitmap直接診断（Step39）

`bitmap.c`は照合済み未改変`src/static.c`を同一translation unitにincludeする。
private実装を直接観測するための専用ELFであり、allocatorの改変ではない。
1024bitの独立期待配列に対し、全bit/全64bit、63/64・511/512境界と
その近傍のsetN/clearN、already-set数、popcountを照合する。
iterator幅1/8/32/64について、訪問集合・重複拒否・callback上限・
callback時のatomic clear・早期終了時のrestorationを検査する。
幅1と幅>1で拒否したcurrent rangeの復元仕様が異なる点も区別する。
これは単一threadでatomic命令の結果を検査するもので、競合の証明ではない。

コンテナの同じmount/flagsで以下を使用する。`static.c`を別入力として
加えない（double compileを避ける）:

```sh
cc -std=c11 -O3 -static -pthread -ftls-model=initial-exec \
  -Wno-error=date-time -DMI_DEBUG=0 -DMI_BUILD_RELEASE -DNDEBUG \
  -I/work/crate/c_src/mimalloc/v3/include \
  -I/work/crate/c_src/mimalloc/v3/src \
  /work/diagnostic/bitmap.c -o /out/aube-purge-bitmap
```

nativeで`/out/aube-purge-bitmap`を先に確認し、同ELF bytesで:

```sh
/ABSOLUTE/NODE runtime/node/run.js --timeout 600 /private/tmp/formicarium-mimalloc-reproduction-v1/aube-purge-bitmap
```

本追加診断のbuild/実行は未検証。元の割当診断は主セッションでnativeと
blink purge-onがexit0、traceでDONTNEEDを観測済みだが、aube停止は未再現。

## BSF zero-input互換性診断（Step39）

`bsf-zero.c`はmimalloc fallbackと同じ`+r`制約でdestinationを64に初期化し、
64bit BSFのinput=0と`0x8000`を実行する。直後のSETZでZFも観測する。
期待値はzeroがdestination64/ZF1、nonzeroがdestination15/ZF0。
zero-inputのdestinationは命令仕様上undefinedであり、64保持をIntelの
アーキテクチャ保証と主張しない。ここでは同じLinux x86_64 nativeで観測する
挙動とmimallocの依存をblinkとの互換性要件として切り分ける。

同じLinux x86_64 muslコンテナで:

```sh
cc -std=c11 -O2 -static /work/diagnostic/bsf-zero.c -o /out/aube-purge-bsf-zero
```

native `/out/aube-purge-bsf-zero`が上記の期待値でexit0になることを先に観測し、
ELF SHAを保存した同じbytesで:

```sh
/ABSOLUTE/NODE runtime/node/run.js --timeout 600 /private/tmp/formicarium-mimalloc-reproduction-v1/aube-purge-bsf-zero
```

blinkでzero destination0となればexit1のRedとして保存する。
nativeが異なる挙動なら互換性前提を見直し、結果を成功扱いにしない。
本診断のbuild/実行は作成時点で未検証。core修正は別Step40の承認対象。
