---

title: '0010. wasm メモリの上限を 1 GB にする'
description: コアの共有 WebAssembly メモリは 1 GB まで伸び、それ以上は伸びない。
---

- 状態：採用（2026-10-05）
- 決めた人：ユーザー

## 背景

WebKit は、コアのインスタンスごとに WebAssembly メモリの上限まで確保し、ページの処理が終わるまで手放しません。
以前の blink のコアで当初の上限 4 GB のとき、aube #1645 の 4 手順で WebKit の確保は約 14 GB に達しました。
Chromium では増えません。上限を 1 GB にしても速さは変わらず（各 8 回、p ≥ 0.57）、確保の量は手順ごとに約 1.1 GB に
減りました。aube と probe は 1 GB で動きます。

## 決定

コアの共有メモリは 1 GB（64 KiB のページで 16384）まで伸びるようにします。paludarium に移してからは、上限はコア自身が
決めています（`index.mjs` の `maximum: 16384` と、wasm が import するメモリの同じ上限）。`tests/node/build.test.ts` が
`dist/paludarium/` の写しから両方を読み、どちらかが変わると失敗します。

## 結果

- メモリの少ない環境で、WebKit がメモリ不足になる危険が下がります。
- 1 GB を超えるメモリを使うゲストは動きません。
- 上限を変えた paludarium のリリースでは、この決定を見直すまで build のテストが失敗します。

## 退けた案

- **4 GB のまま**：WebKit の確保が積み上がります。
- **手順の間でインスタンスを解放させる**：解放の時期は JavaScriptCore のガベージコレクションに依存し、formicarium からは
  制御できません。

## その後の測定（2026-11-02）

上の背景は、以前の blink のコアで測ったものです。macOS の Safari 27.2 は、単純なページでも paludarium でも、もうそう
ふるまいません。どの場合も新しい WebDriver のセッションで動かし、ページのプロセスの physical footprint を `vmmap` で
読みました。

- 共有メモリは、使ったページの分しか確保しません。ページに約 1 MB のメモリを 4 つ置くと、上限が 64 MB でも 1 GB でも
  4 GB でも、増えたのは 4〜6 MB でした。
- Worker で作ったメモリは、Worker が終わると解放されます。100 MB を作って書き込む Worker を 8 回動かしても、増えたのは
  約 1 MB でした。
- formicarium の実行は積み上がりません。1 つの Session で `hello` を 8 回動かすとページは約 24 MB 大きくなり（最大
  151 MB）、`aube --version` を 4 回では約 10 MB でした（最大 532 MB）。どちらも 15 秒後と `dispose` の後で同じでした。

つまり macOS では、背景と、結果の最初の項目と、退けた案の最初の項目は以前のコアにしか当てはまらず、上限でメモリが
節約されることもありません。上限の 1 GB はそのままです。上限は paludarium が決めていて、iOS では測っていません。また WebKit の
[bug 255103](https://bugs.webkit.org/show_bug.cgi?id=255103) は、iOS で大きな上限の共有メモリが
「Out Of Memory」で作れないと報告しています。
