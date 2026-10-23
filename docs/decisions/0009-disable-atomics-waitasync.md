# 0009. ブラウザの実行用 Worker で Atomics.waitAsync を無効にする

- 状態：採用（2026-10-05）
- 決めた人：ユーザー（計画の変更範囲外の修正として承認。全ブラウザへの適用も、検証のうえ維持）

## Context（背景）

WebKit で、aube が数十秒から無期限に止まることがあった。システムコールの記録では、全スレッドが同時に黙っていた。
Emscripten の実行環境は、`Atomics.waitAsync` があると、スレッド間の代行依頼をそれで待つ。診断用に `waitAsync` を使わない
設定に固定すると、WebKit の 8 回すべてが 16〜43 秒で終わった（修正前は 8 回中 2 回が 4 分で打ち切り）。

## Decision（決定）

`runtime/web/worker.mjs` で、コアを読み込む前に `delete Atomics.waitAsync` を実行し、`postMessage` で通知する経路を使わせる。
WebKit だけでなく、すべてのブラウザに適用する。

## Consequences（結果）

- WebKit の停止が消えた（修正後 8 回すべてが 19〜38 秒）。
- Chromium と Firefox では、速さに差が出なかった（各 12 回・14 回、p ≥ 0.18）。
- pthread 用の Worker には効かない。そちら向けの通知に `waitAsync` を使う経路は残っている。
- Emscripten の更新や読み込み順の変更で効かなくなっても、それを検出するテストはない。

## Alternatives Rejected（退けた案）

- **WebKit だけで無効にする**：性能上の利点がなく、分岐が増える。同じ取りこぼしがほかのブラウザで起きる可能性も残る。
- **ビルド時に、生成された JS を書き換える**：Emscripten の版が変わると壊れやすく、再ビルドも要る。
