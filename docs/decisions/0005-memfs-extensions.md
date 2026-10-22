# 0005. ファイルシステムは Emscripten の MEMFS を拡張する

- 状態：採用（2026-10-04）
- 決めた人：コード生成（計画の Step 6 の分岐に従った判断）

## Context（背景）

probe と aube には、hard link、symlink、flock、rename、read_dir が要る（FR4.1）。計画では、まず blink の
`--enable-vfs`（エミュレータ内のファイルシステム）を試し、使えなければ MEMFS を拡張することにしていた。

## Decision（決定）

blink の VFS ではなく、Emscripten の MEMFS を拡張する。fork に `blink/emscriptenfs.{c,js}` を作り、hard link
（同じ inode の共有）と、実際に排他する BSD 方式の flock を追加した。

## Consequences（結果）

- probe のファイル系の 4 項目と aube #1645 が、すべての環境で合格した。
- ファイルシステムは実行用の Worker の側にあり、pthread からのファイル操作は代行依頼になる。
- 手順の間でファイルを引き継ぐとき、hard link は別々のファイルとして写る（[0008](0008-fresh-instance-per-step.md)）。

## Alternatives Rejected（退けた案）

- **blink の VFS（`--enable-vfs`）**：ビルドは通るが、hostfs が `linkat` と `flock` をホストに渡すだけで、Emscripten 上では機能しない。

## 参照

commit `8096c7b4` の `aidlc/spaces/default/intents/261003-blink-wasm-poc/construction/code-generation/code-summary.md`、`docs/architecture.md`
