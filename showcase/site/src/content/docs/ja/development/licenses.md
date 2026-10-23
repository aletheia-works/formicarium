---

title: コアのライセンス
description: blink のコアのライセンスと、パッケージに一緒に入れるもの。
---

今のコアは jart/blink の fork です。このページは、そのライセンスが formicarium に合う理由と、
一緒に配布する必要があるものを記録します。

| 項目                     | 内容                                                                                           |
| ------------------------ | ---------------------------------------------------------------------------------------------- |
| fork 元                  | [jart/blink](https://github.com/jart/blink) だけ。blink のほかの fork は使わない               |
| fork                     | [aletheia-works/blink](https://github.com/aletheia-works/blink) の `formicarium-wasm` ブランチ |
| 固定する commit          | `blink.lock` の `commit`（upstream の基点は `upstream_commit`）                                |
| blink のライセンス       | ISC License（`LICENSE`、Copyright 2022 Justine Alexandra Roberts Tunney）                      |
| formicarium のライセンス | Apache License 2.0                                                                             |

## 両立

- ISC License は、著作権表示と許諾表示をすべての複製に含めることだけを条件に、使用・複製・改変・配布を認めます。
  Apache-2.0 のプロジェクトから使い、ビルドしたコア（`blink.mjs` と `blink.wasm`）を配布することとは矛盾しません。
  ライセンスの本文を読んだうえでの判断で、法的な助言ではありません。
- fork での変更（`blink/emufd.c`、`blink/emufd.h`、`blink/emscriptenfs.c`、`blink/emscriptenfs.js` の追加と、
  既存のファイルの修正）には、fork の側で同じ ISC の表示を付けています。
- コアに含まれる第三者のコードは、Emscripten のランタイム（MIT と University of Illinois/NCSA）と、それに含まれる
  musl libc（MIT）です。どちらも表示を残せば配布できます。blink の `third_party/libz` は blinkenlights だけが使い、
  コアにはリンクしません。

## 配布に含めるもの

npm のパッケージには `THIRD_PARTY_NOTICES.md` を入れています。blink の ISC License、zlib、Emscripten のライセンス、
musl のライセンスを、固定したビルド用のイメージから読み取って載せています。パッケージの stage では、コアの commit と
ソースに変更がないことを記録し、loader と wasm の SHA-256 を加えます。

fork での変更を jart/blink に還元するかどうかは、まだ決めていません。還元する場合も ISC のままで支障はありません。

コアを [paludarium](https://github.com/aletheia-works/paludarium) に移すときは、このページも合わせて変わります。
