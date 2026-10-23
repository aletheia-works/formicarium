# 0010. wasm メモリの上限を 1 GB にする

- 状態：採用（2026-10-05）
- 決めた人：ユーザー

## Context（背景）

WebKit は、blink のインスタンスごとに wasm メモリの上限（当初 4 GB）をコミットし、ページの処理が終わるまで手放さなかった。
aube #1645 の 4 手順で、WebKit のコミットは約 14 GB に達した。Chromium では増えない。上限を 1 GB にしても速さは変わらなかった
（各 8 回、p ≥ 0.57）が、確保の量は手順ごとに約 1.1 GB に減った。aube と probe は 1 GB で動く。

## Decision（決定）

`scripts/build-blink-wasm.sh` で `-sMAXIMUM_MEMORY=1GB` にする。`tests/node/build.test.mjs` でこの設定を固定する。

## Consequences（結果）

- メモリの少ない環境で、WebKit がメモリ不足になる危険が下がる。
- 1 GB を超えるメモリを使うゲストは動かない。

## Alternatives Rejected（退けた案）

- **4 GB のまま**：WebKit の確保が積み上がる。
- **手順の間でインスタンスを解放させる**：解放の時期は JavaScriptCore のガベージコレクションに依存し、制御できない。
