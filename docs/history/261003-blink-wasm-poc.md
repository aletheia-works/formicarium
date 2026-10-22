# blink を wasm で動かす PoC（2026-10-03〜2026-10-05）

formicarium の最初の PoC の要約。結果の詳細は [`../../OUTCOMES.md`](../../OUTCOMES.md)、不具合と調査は [`../results/failures.md`](../results/failures.md)、構成は [`../architecture.md`](../architecture.md) にある。ここでは、それらに書かれていない経緯と、記録の要点だけを残す。

## 目的と範囲

- 目的：改変していない x86-64 Linux バイナリ（static-musl）を、カーネルを起動せずにブラウザで動かせるかを確かめる。最初の受益者は aletheia-works（vivarium での CLI バグ再現）で、その後に一般向けの OSS へ広げる。
- 背景：terrarium のようにツールごとに wasm ビルドする方式は負担が大きい。CheerpX は自前ホストも再配布もできず、32-bit のみなどの制約がある。
- 範囲：jart/blink（インタプリタのみ）を Emscripten でビルドし、Node.js の Worker と COOP/COEP 付きのページで動かす。合否は Rust probe と aube #1645 の再現。aube の計測で、JIT 開発を後回しにするかを判断する。
- 範囲外：JIT の開発、Rust 版 blink（paludarium）の実装。

## 主な決定

- **既存の blink の fork を使う**（[0001](../decisions/0001-blink-fork.md)）。要件の確認の途中で、一度「blink は更新が止まっているので使わず、Rust で再実装する」という回答があった。その後の明確化で、この PoC は既存の blink で進め、Rust 版は別リポジトリで並行して作り、将来コアを置き換える構想と確定した。変更の置き場所は fork と決めた。
- **合格条件に aube #1645 の再現を加えた**。probe の合格だけでは vivarium の用途を示せないため。ブラウザでの出力が native と一致することを求めた。
- **対象ブラウザは Safari を含む主要ブラウザすべて**とした。実機の Safari は確かめられず、Playwright の WebKit で代用した（下の「残った課題」）。
- **通らない項目は、内容ごとにユーザーが扱いを決める**。そのための記録が [`../results/failures.md`](../results/failures.md)。
- **インタプリタのみとし、JIT は後回し**（[0002](../decisions/0002-interpreter-only-jit-deferred.md)、判断材料は [`../results/jit-decision.md`](../results/jit-decision.md)）。
- 実装の判断は ADR にある：コアの境界（[0003](../decisions/0003-core-boundary.md)）、コンテナでのビルド（[0004](../decisions/0004-container-build.md)）、MEMFS の拡張（[0005](../decisions/0005-memfs-extensions.md)）、ファイル記述子のエミュレート（[0006](../decisions/0006-emulated-fds-in-core.md)）、ネットワークなし（[0007](../decisions/0007-no-guest-network-in-browser.md)）、手順ごとのインスタンス（[0008](../decisions/0008-fresh-instance-per-step.md)）、`Atomics.waitAsync` の無効化（[0009](../decisions/0009-disable-atomics-waitasync.md)）、wasm メモリ 1 GB（[0010](../decisions/0010-wasm-memory-1gb.md)）、ホスト基準（[0011](../decisions/0011-host-baseline-in-measurements.md)）、`MADV_DONTNEED`（[0012](../decisions/0012-madvise-dontneed-zero-in-place.md)）。

## 仕様・設計の要点

要件は FR1〜FR7 と NFR1〜NFR3 の 17 件だった。

| ID   | 内容                                                                                                            |
| ---- | --------------------------------------------------------------------------------------------------------------- |
| FR1  | fork の特定コミットを参照し（`blink.lock`）、1 つのコマンドでクリーンに wasm を作る                             |
| FR2  | Node.js の Worker と、`crossOriginIsolated` のページ（Chromium 系・Firefox・Safari）で動く                      |
| FR3  | `eventfd2`、`FUTEX_WAIT_BITSET`、edge-triggered の `epoll` をホストに頼らず実装する                             |
| FR4  | ブラウザで、作成・hard link・symlink・flock・rename・read_dir と `socketpair` を提供する                        |
| FR5  | probe（tokio のタイマー、`UnixStream::pair`、4 並列の rayon、Mutex/Condvar、ファイル操作）が全環境で全項目 PASS |
| FR6  | aube の 4 コマンド（`--version`、初回 install、frozen install、`list`）を測り、CheerpX 1.3.9 の値と並べる       |
| FR7  | aube #1645 の frozen install と `aube list` が native と同じ `0.0.0` を表示する                                 |
| NFR1 | 繰り返しても同じ合否（回数 3 回は確認していない前提だった）                                                     |
| NFR2 | 通らない項目は、項目名・環境・症状・見立てを記録する                                                            |
| NFR3 | 計測値に、ブラウザと版、OS、前面か背面か、試行回数を添える                                                      |

構造の要点：
- コア固有の知識は `runtime/core.mjs` だけに置き、`guest-io`・`session`・`node/`・`web/` は Emscripten の FS API に依存する（現在は `.ts`）。
- fork で直した blink の不具合は 8 件（PEXTRW、float→int 変換、wasm32 の LOCK BTS、ファイルの mmap、終了処理など）。表は [`../results/failures.md`](../results/failures.md) にある。
- 最初の検証でブラウザのテストが断続的に失敗し、実装に戻って直した。直したのは futex の期限（L-1）、ページ管理表の競合（L-2）、WebKit での停止（L-3）、テスト側の待ち（L-4）。L-1〜L-3 は [`../results/failures.md`](../results/failures.md) に記録がある。L-4 は probe の `futex_deadline` で、待ち手のスレッドが終わるまで wake を試し続けるようにした（判定の基準は変えていない）。

## 品質の目標と結果

性能の合格基準はなかった。品質目標と判定の全体は [`../nfr-summary.md`](../nfr-summary.md) にある。

| 目標               | 最初の検証（2026-10-04）                                     | 修正後（2026-10-05）                            |
| ------------------ | ------------------------------------------------------------ | ----------------------------------------------- |
| 既存テストの失敗 0 | Not Met（ブラウザ 61/63）                                    | Met（Node.js 36/36、ブラウザ 30/30）            |
| NFR1 再現性        | Not Met（Chromium で SIGSEGV、WebKit で 600 秒タイムアウト） | Met（ブラウザ 3 回で 90/90、Node.js 17/17 × 3） |
| 各要件にテスト     | Unverified                                                   | Met（17 件中 16 件はテスト。NFR2 は文書で確認） |
| NFR3 計測の記録    | Met                                                          | Met                                             |
- 修正後のビルドは、公開した fork のコミット `7e1d7439` からのクリーンビルド（`blinkSourceDirty: false`、3 分 43 秒）だった。
- 3 回の再計測では Chromium の install の中央値が 7.6 秒から 20.3 秒になった。ABBA の交互計測で、L-3 が原因ではないと分かった（[`../results/failures.md`](../results/failures.md) の U-6 の追加調査）。
- その後の `madvise` 修正後のクリーンビルドで、ブラウザ 33 件と 3 回繰り返し 99 件の合格が記録されている。10 回の計測値は [`../results/README.md`](../results/README.md) にある。

## 成果

- fork `aletheia-works/blink` の `formicarium-wasm` ブランチ。upstream `f006a4f` に `817687f`、`50bc466`、`247610f`、`7e1d743`、`4b5c67d` を追加した（内容は [`../../OUTCOMES.md`](../../OUTCOMES.md)）。
- `runtime/`、`guest/probe/`（8 項目と回帰用の項目）、`scripts/`、`tests/node/`、`tests/browser/`、`fixtures/`（#1645 の入力と native の基準値）、`docs/results/`、[`../licenses.md`](../licenses.md)。
- ゲストは aube v2.6.1（`bd94e42f`、x86-64 static-musl）。
- formicarium の PR 番号は記録にない。当時はローカルの作業で、GitHub への push は次の課題として残っていた。

## 残った課題

- 実機の Safari で確かめていない（U-1）。計測の条件が CheerpX とそろっていない（U-2）。wslc が動かず Docker で代用（U-3）。Windows のローカル emsdk ではビルドできない（U-4）。
- WebKit がまれに均等に遅くなる。ファイルをコピーしたプライベートなページの `MADV_DONTNEED` は未実装。
- 技術的な負債：終了時に未起動のスレッドを最大 30 秒待つ。ページ管理表は縮まず、古い配列を残す。pthread 側には `Atomics.waitAsync` の経路が残る。
- 記録の時点でのレビューの指摘：
  - L-2 の 2 つの修正のどちらが効いたかは切り分けていない。ブラウザでの修正前の失敗も取っていない。
  - L-3 の無効化を固定するテストがない。
  - eventfd の semaphore、level-triggered、`EPOLLONESHOT` を直接確かめるテストがない。fork の変更を x86-64 ネイティブ版の blink で回帰確認していない。
- blink への変更を upstream に還元するかは決めていない。

## 元の記録

git のコミット `8096c7b4` の `aidlc/spaces/default/intents/261003-blink-wasm-poc/` にある。
