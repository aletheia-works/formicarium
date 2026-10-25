---

title: 設計上の決定
description: ランタイムの形を決めた判断を、1 件ずつ記録します。
sidebar: { label: 一覧, order: 0 }
---

各記録には、背景、決定、結果、退けた案を書いています。決定を足すときは次の番号を作り、この表に 1 行足します。
決定を覆すときは、元の記録を新しい番号で置き換えたと記し、理由を新しい記録に書きます。

| 番号                                                                              | 決定                                                | 状態 |
| --------------------------------------------------------------------------------- | --------------------------------------------------- | ---- |
| [0002](/formicarium/ja/development/decisions/0002-interpreter-only-jit-deferred/) | インタプリタのみとし、JIT は後回しにする            | 採用 |
| [0003](/formicarium/ja/development/decisions/0003-core-boundary/)                 | コアは wasm モジュール 1 つと loader としてだけ扱う | 採用 |
| [0007](/formicarium/ja/development/decisions/0007-no-guest-network-in-browser/)   | ブラウザでは、ゲストのネットワークを使わない        | 採用 |
| [0008](/formicarium/ja/development/decisions/0008-fresh-instance-per-step/)       | 手順ごとに新しいコアのインスタンスを作る            | 採用 |
| [0010](/formicarium/ja/development/decisions/0010-wasm-memory-1gb/)               | wasm メモリの上限を 1 GB にする                     | 採用 |
| [0011](/formicarium/ja/development/decisions/0011-host-baseline-in-measurements/) | 計測にホストの速さの基準値を添える                  | 採用 |
| [0013](/formicarium/ja/development/decisions/0013-interactive-guest-runs/)        | stdin と端末を使う対話的なゲストの実行              | 採用 |

以前の blink のコアに固有の決定（0001、0004、0005、0006、0009、0012）は、コアと一緒に削除しました。git の履歴に残っています。
その番号は使い回しません。
