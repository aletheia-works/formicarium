---

title: ランタイムの構成
description: formicarium のパッケージが Linux のゲストを動かす仕組みを、層ごとに説明します。
---

formicarium は、改変していない static な x86-64 Linux のバイナリ（ELF。多くは musl でビルドしたもの）を、
カーネルを起動せずに、ブラウザと Node.js の WebAssembly で動かします。このページはパッケージ
（`@aletheia-works/formicarium`）を説明します。このサイト自体の構成は
[構成のガイド](/formicarium/ja/guides/architecture/)にあります。

## 入口

| import                                | 提供するもの                                                                                                                                      |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@aletheia-works/formicarium`         | ゲストの検証と登録、[インストーラ](/formicarium/ja/development/install-api/)、[command session](/formicarium/ja/development/command-api/)、エラー |
| `@aletheia-works/formicarium/node`    | Node.js 24 以降向けの `createSession`                                                                                                             |
| `@aletheia-works/formicarium/browser` | ブラウザ向けの `createSession`。ページは cross-origin isolated（COOP/COEP）である必要があります                                                   |

## 1 回の実行の流れ

**Session** は、ゲストのファイルシステム（ファイル・ディレクトリ・symlink の一覧）、作業ディレクトリ、
登録したゲストを持ちます。操作は一度に 1 つだけで、同時に来た実行・install・ファイル操作は `BUSY` で拒否します。

実行のたびに、**新しい Worker** を立てます（Node.js では `worker_threads`、ブラウザでは module Worker）。
1. Worker はコアの資産を読み込み、評価する前に SHA-256 をビルド情報と照合します。
2. Session のファイルとゲストのバイナリを新しいメモリ上のファイルシステムに置き、引数と環境変数を渡してゲストを実行し、
   stdout と stderr を流します。
3. 終了したら、引き継ぐ場所（作業ディレクトリと home ディレクトリ）を写し取り、終了コードと一緒に返します。

Session がその写しを取り込むのは、実行が成功したときだけです。timeout・中断・写し取りの失敗では Worker を止め、
前の状態を残すので、各手順は分かっている状態のファイルシステムから始まります
（[ADR 0008](/formicarium/ja/development/decisions/0008-fresh-instance-per-step/)）。
同じ `inodeId` を持つファイルは hard link のまま残り、symlink と mode も保たれます。

## 層

| 層             | ファイル（`runtime/`）                                         | 役割                                                                                                            |
| -------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| 公開 API       | `public.ts`、`node/api.ts`、`web/api.ts`                       | 3 つの入口と、その入力の検査                                                                                    |
| Session        | `state.ts`、`lifecycle.ts`、`session-port.ts`、`validation.ts` | ファイルシステムの状態、1 つだけの予約、timeout と後始末                                                        |
| ゲスト         | `guest-validation.ts`、`install*.ts`、`command*.ts`            | 検証、カタログからの install、command                                                                           |
| Worker         | `protocol.ts`、`worker-execution.ts`、`*/package-worker.ts`    | Session と Worker の間のメッセージ、Worker 1 つにつき 1 回の実行                                                |
| ゲストの入出力 | `guest-io.ts`                                                  | ファイルの配置、出力の取得、写し取り                                                                            |
| コアとの境界   | `core.ts`                                                      | エミュレータのコアを知る唯一のファイル（[ADR 0003](/formicarium/ja/development/decisions/0003-core-boundary/)） |

`types/` には公開する型宣言があります。`scripts/`・`tests/`・`web/` は開発用の道具で、パッケージには含みません。

## コア

今のコアは [jart/blink](https://github.com/jart/blink) の fork
（[aletheia-works/blink](https://github.com/aletheia-works/blink) の `formicarium-wasm` ブランチ。`blink.lock` で固定）を、
Emscripten でインタプリタのみの WebAssembly にしたものです
（[ADR 0002](/formicarium/ja/development/decisions/0002-interpreter-only-jit-deferred/)）。
ゲストのスレッドは Emscripten の pthread で動くので、ブラウザでは `SharedArrayBuffer`、つまり cross-origin isolation が必要です。
このコアに固有の決定は、リポジトリの
[`docs/decisions/`](https://github.com/aletheia-works/formicarium/tree/main/docs/decisions) にあります。

コアは [paludarium](https://github.com/aletheia-works/paludarium)（Rust で作り直した blink。`@aletheia-works/paludarium-wasm`
として公開）に置き換えます。そのとき変わるのは、`runtime/core.ts` と、コアを読み込む Worker だけです。

## 制限

- ゲストはネットワークを使えません（[ADR 0007](/formicarium/ja/development/decisions/0007-no-guest-network-in-browser/)）。
- ゲストのメモリの上限は 1 GB です。
- ブラウザでは cross-origin isolation（COOP/COEP か、それを付ける service worker）が必要です。
- macOS の実機の Safari では確かめていません。Playwright の WebKit で代用しています。
