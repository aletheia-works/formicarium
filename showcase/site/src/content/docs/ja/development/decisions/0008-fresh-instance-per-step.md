---

title: '0008. 手順ごとに新しいコアのインスタンスを作る'
description: command ごとに新しいコアで動かし、ファイルは写し取って引き継ぐ。
---

- 状態：採用（2026-10-04）
- 決めた人：実装中の判断

## 背景

aube #1645 の再現は 4 手順（`aube install`、`rm -rf node_modules`、`aube install --frozen-lockfile`、`aube list`）で、
手順の間でファイルを引き継ぐ必要があります。

## 決定

command ごとに、新しいコアのインスタンスで動かします。作業ディレクトリと home ディレクトリは、手順の後に
JavaScript の側で写し取り、次のインスタンスに置き直します（paludarium に移してからは `fromCoreSnapshot` と `toCoreEntries`、
blink では `snapshotFs` と `populateFs`）。手順を進めるのは
`runtime/guest-io.ts` の `runSession` で、`rm -rf` は JavaScript の側で行います。パッケージの Session も、
実行ごとに新しい Worker を立てる同じ形です。

## 結果

- 実装が単純で、手順ごとの状態がきれいに分かれます。
- command ごとに起動の固定費（blink のコアでは 0.3〜0.5 秒）がかかり、JIT では縮みません。
- WebKit はインスタンスごとに wasm メモリの上限まで確保し、ページの処理が終わるまで手放しません。
  ゲストのメモリの上限を 1 GB にしているのはこのためです。

## 退けた案

- **1 つのインスタンスで shell を動かし、command を続けて実行する**：ゲストの shell とプロセスの生成（`fork` と `exec`）が
  要るが、当時のコアだった blink の fork ではプロセスの `fork` を無効にしていた。
