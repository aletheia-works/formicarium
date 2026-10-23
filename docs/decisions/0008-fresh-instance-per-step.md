# 0008. 手順ごとに blink の新しいインスタンスを作る

- 状態：採用（2026-10-04）
- 決めた人：コード生成（実装中の判断）

## Context（背景）

aube #1645 の再現は、`aube install` → `rm -rf node_modules` → `aube install --frozen-lockfile` → `aube list` の 4 手順で、
手順の間でファイルの状態を引き継ぐ必要がある。

## Decision（決定）

手順ごとに blink の新しいインスタンスを作って 1 コマンドを実行する。作業ディレクトリと HOME の中身は、JS の側で
写し取って（`snapshotFs`）次のインスタンスに置き直す（`populateFs`）。`rm -rf` は JS の側で行う。

## Consequences（結果）

- 実装が単純で、手順ごとの状態がきれいに分かれる。
- 1 コマンドあたり 0.3〜0.5 秒の起動の固定費がかかる。JIT では縮まない。
- WebKit は、インスタンスごとに wasm メモリの上限まで確保し、ページの処理が終わるまで手放さない（→ [0010](0010-wasm-memory-1gb.md)）。
- 手順の間で、hard link は別々のファイルとして写る。

## Alternatives Rejected（退けた案）

- **1 つのインスタンスでシェルを動かし、続けて実行する**：ゲストのシェルとプロセスの生成（fork と exec）が要る。
  この fork ではプロセスの fork が無効になっている。

## 参照

`runtime/guest-io.mjs`（`runSession`）
