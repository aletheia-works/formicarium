# Outcomes Pack

**Scope**: poc
**Stages delivered**: 7 approved / 7 total
**Duration**: 2096 min

formicarium の PoC（ワークフロー `261003-blink-wasm-poc`）の引き継ぎ文書。ワークフローを再実行しなくても、この PoC を引き継いで動かし、続きを作れるようにまとめた。各項目の詳しい根拠は、括弧内のファイルにある。作成日は 2026-10-05。

## 1. What Was Built

### 目的と結論

- **目的**：CheerpX のような「カーネルを起動せずに、改変していない x86 Linux バイナリをブラウザで動かす」仕組みを、オープンソースで作れるかを確かめる。jart/blink（x86-64 Linux のユーザーモードエミュレータ）を Emscripten で wasm にし（インタプリタのみ、JIT なし）、Node.js の Worker と COOP/COEP 付きのブラウザページで動かす（commit `8096c7b4` の `aidlc/spaces/default/intents/261003-blink-wasm-poc/inception/requirements-analysis/requirements.md`）。
- **結論**：**実現できた。** 合格条件の Rust probe（tokio のタイマー、`UnixStream::pair`、rayon、Mutex/Condvar、ファイルの作成・hard link・symlink・flock）は、Node.js・Chromium・Firefox・WebKit のすべてで全項目合格した。aube #1645 の再現も、すべての環境で native と同じ出力になった。
- **JIT の判断**：JIT 開発は後回しにすると決めた（2026-10-05、ユーザーの判断）。コアは将来 paludarium（Rust 版 blink）に置き換える構想なので、そちらで取り組む（`docs/results/jit-decision.md`）。

### 範囲

`poc` の範囲で実行した。ステージは、初期化（3）、意図の整理、要件分析、コード生成、ビルドとテストの 7 つ。ユニット分割はしていない（ステージ単位の 1 回の実装）。コード生成では、ブラウザでの断続的な失敗を受けて、ビルドとテストから 1 回差し戻した（Loop-back 1）。

### 作ったもの

| 部分                     | 内容                                                                                                                               |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| blink の fork            | `aletheia-works/blink` の `formicarium-wasm` ブランチ。upstream（`f006a4f`）に 5 コミットを追加した（下の表）                      |
| 実行環境                 | `runtime/`：コアに依存しない入出力の共通部、Node.js の Worker 版ランナー、ブラウザのページと Worker、COOP/COEP 用の service worker |
| ゲスト                   | `guest/probe/`：合格判定用の Rust probe（8 項目と、回帰用の 3 項目）。hello・exit3（ランナーの試験用）。aube v2.6.1（static-musl） |
| ビルドと計測のスクリプト | `scripts/`：blink の取得とビルド、ゲストのビルド、native の基準値、計測                                                            |
| テスト                   | `tests/node/`（`node --test`）、`tests/browser/`（Playwright）                                                                     |
| 結果の記録               | `docs/results/`：計測値、CheerpX との比較、通らなかった項目と直したもの、JIT の判断材料                                            |

**fork に追加したコミット**（`blink.lock` は `4b5c67d5` を指す）

| コミット  | 内容                                                                                                                                                                                      |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `817687f` | Emscripten の pthread で動かす。eventfd2・epoll・socketpair・pipe のエミュレート（`blink/emufd.c`）、futex の bitset、MEMFS への hard link と flock の追加（`blink/emscriptenfs.{c,js}`） |
| `50bc466` | aube を動かす中で見つけた不具合の修正（PEXTRW、float→int 変換、wasm32 での LOCK BTS のデッドロック、ファイルの mmap の高速化）。ブラウザ版ではネットワークを使わない                      |
| `247610f` | 終了処理の修正（終了するスレッドを待つ、実行時と Worker を止める）                                                                                                                        |
| `7e1d743` | Loop-back 1：futex の期限の修正、非線形メモリでのページ管理表の競合の修正                                                                                                                 |
| `4b5c67d` | `madvise(MADV_DONTNEED)` で、プライベートな匿名メモリをゼロにする                                                                                                                         |

### 主な技術判断

- **コアは「wasm 1 つ＋起動用の JS」として扱う。** コア固有の知識は `runtime/core.mjs` だけに置き、paludarium に置き換えやすくした。
- **ファイルシステムは、blink の VFS ではなく Emscripten の MEMFS を拡張した。** blink の hostfs は `linkat` と `flock` をホストに渡すだけで、Emscripten 上では機能しないため。
- **eventfd・epoll・socketpair は blink の中でエミュレートした。** ホストの epoll には頼らない。
- **手順ごとに blink を起動し直す。** ファイルシステムの中身は JS 側で引き継ぐ。
- **ブラウザの実行用 Worker では `Atomics.waitAsync` を無効にした（L-3）。** WebKit で通知が取りこぼされ、ゲスト全体が止まっていたため。
- **wasm メモリの上限は 1 GB。** WebKit がインスタンスごとに上限までコミットするため（4 GB では aube の 4 手順で約 14 GB になった）。

### 技術スタックと版

| 項目       | 版                                                                                  |
| ---------- | ----------------------------------------------------------------------------------- |
| Node.js    | 24（`mise.toml`。検証は 24.21.0）                                                   |
| Emscripten | 6.0.10（コンテナ `emscripten/emsdk:6.0.10`）                                        |
| Rust       | stable、ターゲット `x86_64-unknown-linux-musl`（コンテナ `rust:alpine`）            |
| Playwright | `@playwright/test` ^1.55.0（検証は 1.63.0。Chromium 153、Firefox 155、WebKit 26.6） |
| aube       | v2.6.1（`bd94e42f`）                                                                |
| blink      | `aletheia-works/blink@4b5c67d5`（upstream `jart/blink@f006a4f`）                    |
| コンテナ   | Docker Desktop（wslc が使えない場合）                                               |

## 2. Repository Structure

```
formicarium/
  blink.lock              fork の URL・ブランチ・コミット、upstream のコミット
  mise.toml               node・rust・cmake・ninja の定義
  package.json            Playwright だけを依存に持つ
  playwright.config.mjs   3 ブラウザ、worker 1、開発用サーバーの起動
  scripts/
    fetch-blink.sh        blink.lock のコミットを .vendor/blink に取得（一致しなければ止まる）
    build-blink-wasm.sh   blink を wasm にビルドし dist/blink/ に置く（BLINK_SRC で別のコピーも可）
    build-guests.sh       probe・hello・exit3・aube を static-musl でビルドし dist/guests/ に置く
    native-baseline.sh    aube #1645 を x86-64 Linux コンテナで native に実行し、基準値を保存
    measure-aube.mjs      aube の 4 コマンドを計測し docs/results/ に書く（ホスト基準も記録）
    serve.mjs             COOP/COEP を付ける依存なしの開発用サーバー
    lib/                  コンテナの選択、計測結果の検証と表の生成
  runtime/
    core.mjs              コアの記述子（コア固有の知識はここだけ）
    guest-io.mjs          ゲストと入力ファイルの配置、stdout/stderr/終了コードの取得、手順の実行
    session.mjs           手順書の解析と書き起こし
    node/                 Node.js の Worker 版ランナー（run.mjs が CLI）
    web/                  ブラウザのページ、Worker、許可リスト（sessions.mjs）、service worker
  guest/probe/            Rust の probe（src/main.rs と回帰項目）、hello、exit3
  fixtures/               aube #1645 の入力、手順書、native の基準値
  tests/
    node/                 build・runner・probe・aube-1645・measure
    browser/              probe.spec・aube-1645.spec・diagnostics（失敗時の証拠の保存）
  docs/
    licenses.md           blink（ISC）を Apache-2.0 から使うことの確認
    results/              計測値（README.md、aube-timings.json）、failures.md、jit-decision.md
  patches/                fork に入れた修正の写し（レビュー用）
  .vendor/  dist/         取得物とビルド物（.gitignore で除外）
```

## 3. Setup Guide

詳しい手順は `README.md` にある。要点は次のとおり。
- **前提**：Node.js 24、Docker Desktop（または wslc）、Git と Git Bash（Windows）、Playwright のブラウザ。Windows の非対話シェルでは mise のツールが PATH に載らないので、`~/AppData/Local/mise/installs/<tool>/<version>/` の実体を直接呼ぶ。
- **手順**（プロジェクトのルートで）

```bash
npm install
npx playwright install chromium firefox webkit
bash scripts/build-blink-wasm.sh
bash scripts/build-guests.sh
bash scripts/native-baseline.sh
```

- `build-guests.sh` の aube のビルドは 1 時間以上かかる。probe だけなら `bash scripts/build-guests.sh probe`。
- **環境変数**：必須のものはない。任意で `FORMICARIUM_CONTAINER`（`docker` か `wslc`）、`FORMICARIUM_BUILD=host`（ローカルの emsdk。Windows では未検証）、`BLINK_SRC`（ローカルで修正した blink のコピーからビルドする）、`FORMICARIUM_EXTRA_LINK_FLAGS`（診断用のリンクのフラグ）。秘密情報は使わない。
- **テスト**

```bash
node --test tests/node/build.test.mjs tests/node/runner.test.mjs tests/node/probe.test.mjs tests/node/aube-1645.test.mjs tests/node/measure.test.mjs
npx playwright test tests/browser/probe.spec.mjs tests/browser/aube-1645.spec.mjs
```

## 4. Build and Deploy

- **ビルド**：上の Setup Guide のとおり。`dist/blink/build-info.json` の `blinkCommit` が `blink.lock` と一致し、`blinkSourceDirty` が `false` であることを `build.test.mjs` が確かめる。
- **最終の検証結果**（2026-10-05、クリーンビルド。証拠は commit `8096c7b4` の `aidlc/spaces/default/intents/261003-blink-wasm-poc/construction/build-and-test/madvise/clean-*.txt`）

| 実行                                     | 結果           |
| ---------------------------------------- | -------------- |
| Node.js の 5 ファイル                    | 41/41 合格     |
| ブラウザ（3 種）                         | 33/33 合格     |
| ブラウザの 3 回繰り返し                  | 99/99 合格     |
| Node.js の probe と aube の 3 回繰り返し | 18/18 × 3 合格 |
- **計測**：`node scripts/measure-aube.mjs --trials 10`。ほかの重い処理を止めて実行する。
- **デプロイ**：この範囲（`poc`）には含まれない。IaC もない。ブラウザ版は静的ファイルと service worker だけで動く設計なので、GitHub Pages のような静的ホスティングに置ける想定（未検証）。
- **fork を直すとき**：`.vendor/blink-src` で jj を使って修正し、`BLINK_SRC=.vendor/blink-src` でビルドして試す。公開するときは新しいコミットとして push し、`blink.lock` を更新してクリーンビルドする。公開済みのコミットに変更が混ざらないよう注意する（commit `8096c7b4` の `aidlc/spaces/default/intents/261003-blink-wasm-poc/construction/build-and-test/build-instructions.md`）。

## 5. Architecture Decisions

各決定の背景・結果・退けた案は、1 件 1 ファイルの ADR として [`docs/decisions/`](docs/decisions/) にある。下の表はその要約。

| 決定                                                         | 検討した代わりの案              | 選んだ理由                                                                                                           |
| ------------------------------------------------------------ | ------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| jart/blink の fork を使う（Rust 版は別リポジトリで並行開発） | 最初から Rust 版を作る          | まず既存の blink で実現性を確かめるため（[ADR 0001](docs/decisions/0001-blink-fork.md)）                             |
| fork 元は jart/blink に限る                                  | webix、portabox、lanmower/blink | 後者にはマルウェア混入の履歴がある                                                                                   |
| インタプリタのみ（JIT なし）                                 | JIT も作る                      | PoC の範囲を絞るため。JIT は計測の後に判断（→ 後回しに決定）                                                         |
| blink のビルドはコンテナで行う                               | Windows のローカルの emsdk      | `emconfigure ./configure` が WinError 193 で止まり、GNU make もないため                                              |
| MEMFS を拡張する                                             | blink の VFS（`--enable-vfs`）  | hostfs が Emscripten 上で `linkat` と `flock` を扱えないため                                                         |
| ブラウザ版はネットワークなし                                 | Emscripten の WebSocket 中継    | 依存（`ws`）が増え、native の基準値と条件がそろわないため                                                            |
| 手順ごとに blink を起動し直す                                | 1 つのインスタンスを使い回す    | 実装を単純に保つため。起動の固定費 0.3〜0.5 秒が残る                                                                 |
| `Atomics.waitAsync` を無効にする（全ブラウザ）               | WebKit だけで無効にする         | WebKit で通知が取りこぼされた。Chromium と Firefox では速さの差がない（各 12 回・14 回、p ≥ 0.18）ので、分岐させない |
| wasm メモリの上限 1 GB                                       | 4 GB                            | WebKit がインスタンスごとに上限までコミットするため。aube と probe は 1 GB で動く                                    |
| 計測にホストの速さを添える                                   | 回数を増やすだけ                | このマシンでは同じ計算の時間が最大 2.4 倍変わるため                                                                  |

制約：テストの方針は test-after（`poc` の既定）。品質の目標（タイムアウトの上限、worker 1、retries 0、全 8 項目の合格、aube の native 一致、既存テストの失敗 0）は、一度も緩めていない。

## 6. What to Commit vs Archive

作業の記録（要件、計画、レビュー、監査ログ、証拠）は、2026-10-22 にリポジトリから外した。要点は [`docs/history/`](docs/history/) にまとめ、元の記録は commit `8096c7b4` の `aidlc/` に残っている。

| Artifact                                        | Action                                                       | Destination            |
| ----------------------------------------------- | ------------------------------------------------------------ | ---------------------- |
| `docs/results/`（計測、failures、jit-decision） | Already committed                                            | —                      |
| 設計上の決定（ADR、12 件）                      | 作成済み（2026-10-05）                                       | `docs/decisions/`      |
| アーキテクチャの要約（1 ページ）                | 作成済み（2026-10-05）                                       | `docs/architecture.md` |
| 品質目標の判定表                                | 作成済み（2026-10-05）                                       | `docs/nfr-summary.md`  |
| アプリケーションのコード                        | `blink-wasm-poc` ブックマークにコミット済み（push は未実施） | —                      |

## 7. Workflow Footprint

PoC は 7 段階で進め、すべて承認された。進め方の記録は 6 節の commit に残っている。

## 8. Known Limitations and What to Tackle Next

### 未解決のまま残したもの（`docs/results/failures.md`）

- **実機の Safari で確認していない**（U-1）。Windows のため、Playwright の WebKit で代わりに確かめた。macOS で確かめる必要がある。
- **計測の条件が CheerpX とそろっていない**（U-2）。背面での計測をしていない。ばらつきの主因はホストの速さの変動と分かったが、このノート PC 1 台でしか測っていない。
- **WebKit がまれに均等に遅くなる**。不具合による停止ではなく、マシンの状態の影響と見ている（推測）。ほかのアプリを閉じた状態か、別のマシンで確かめる余地がある。
- **ファイルをコピーしたプライベートなページの `MADV_DONTNEED`**：Linux ではファイルの内容に戻るが、blink では書き換えた内容が残る（未実装）。
- **wslc が動かない**（U-3）。Docker で代用している。
- **作業日誌の未解決の問い（1 件）**：意図の整理の段階で、方針転換（blink を使わない → fork を使う）を意図書にどう反映するかを確認する、というもの。要件分析で「fork を使う」と確定し、`project.md` に記録したので、実質的には決着している。

### 技術的な負債

- 終了時に、まだ起動していないスレッドを最大 30 秒待つ（`247610f`）。通常は 1〜4 秒で終わるが、根本的には Worker の起動を待つ仕組みが要る。
- ページ管理表（`g_hostpages`）は縮まず、広げるたびに古い配列を残す（`7e1d743`、レビューの R-05）。長く動くゲストでは増え続ける。
- `KillOtherThreads` の `pthread_kill` は、pthread あての通知に `Atomics.waitAsync` を使う経路が残っている（L-3 は実行用の Worker だけに効く）。
- 手順ごとに blink を起動し直すので、1 コマンドあたり 0.3〜0.5 秒の固定費がかかる。

### 次に取り組むこと（提案）

1. macOS の Safari 実機で、probe と aube #1645 を確かめる。
2. formicarium のリポジトリを GitHub に作り、`blink-wasm-poc` を push する（今はローカルだけ）。
3. 起動の固定費を減らす（blink を常駐させ、コマンドをまたいで使い回す）。JIT とは独立に体感を改善できる。
4. paludarium（Rust 版 blink）への置き換えに向けて、`runtime/core.mjs` の境界と、この PoC のテスト一式を受け入れ条件として引き継ぐ。
5. 背面での計測と、別の機種での計測を追加する。
