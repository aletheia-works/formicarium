# ライセンスの確認（blink の fork）

「jart/blink の ISC ライセンスは、formicarium の Apache-2.0 と両立する」という前提と、
fork 元を限定することについて、確認した内容を記録する。

## 対象

| 項目                     | 内容                                                                                                                  |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| fork 元                  | [jart/blink](https://github.com/jart/blink)（これ以外の fork は使わない。webix・portabox・lanmower/blink は使わない） |
| fork                     | [aletheia-works/blink](https://github.com/aletheia-works/blink) の `formicarium-wasm` ブランチ                        |
| 固定するコミット         | `blink.lock` の `commit`（upstream の基点は `upstream_commit`）                                                       |
| blink のライセンス       | ISC License（`LICENSE`、Copyright 2022 Justine Alexandra Roberts Tunney）                                             |
| formicarium のライセンス | Apache License 2.0（`LICENSE`）                                                                                       |

## 確認したこと

- 確認日：2026-10-04。`.vendor/blink/LICENSE`（`blink.lock` のコミット）の本文を読んで確認した（根拠：ファイルの本文）。
- ISC License は、著作権表示と許諾表示をすべての複製に含めることだけを条件に、使用・複製・改変・配布を認める寛容なライセンスである。
  Apache-2.0 のプロジェクトから参照し、ビルド物（`dist/blink/blink.wasm` と `blink.mjs`）を配布することと矛盾しない（根拠：ライセンス本文。法的な助言ではない）。
- fork での変更（`blink/emufd.c`、`blink/emufd.h`、`blink/emscriptenfs.c`、`blink/emscriptenfs.js` の追加と、既存ファイルの修正）は、
  fork 側で blink と同じ ISC License の表示を付けている。
- blink のバイナリに含まれる第三者のコード：
  - Emscripten のランタイムと libc（musl を含む）。Emscripten は MIT と University of Illinois/NCSA、musl は MIT。いずれも表示を残せば配布できる。
  - blink の `third_party/libz`（zlib）は blinkenlights（`compress.c`）だけが使い、`blink` 本体のリンクには含まれない（`blink.mk` と `compress.c` の参照元で確認）。

## 配布するときにすること

- `dist/blink/` を配布するときは、blink の `LICENSE`（ISC）と Emscripten・musl のライセンス表示を同梱する。
- この PoC では、まだ配布（GitHub Pages への公開など）はしていない。公開する段階で、上の表示を同梱する手順を追加する。

## 未確定のこと

- fork での変更を upstream（jart/blink）に還元するかどうかは、要件の Open Questions のまま。還元する場合も ISC のままで支障はない。
