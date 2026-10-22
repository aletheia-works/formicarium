# npm パッケージ化と terrarium への組込み（2026-10-06〜2026-10-10）

## 目的と範囲

terrarium はツールごとに wasm へ移植した実行部を持っていた。これを、static-musl のゲストをそのまま動かす formicarium の共通ランタイムへ置き換えることが目的だった。
- formicarium を `@aletheia-works/formicarium` の npm パッケージにする。JS API、Node とブラウザの Worker、ビルド済みの blink loader/wasm、型定義、LICENSE と第三者表示、build-info を同梱する。
- aube と pitchfork のゲストと fixture は terrarium 側で ref ごとに配布する。npm パッケージには入れない。
- terrarium の既存の入口（ページのリンク、`<terrarium-terminal>`、`run()`、iframe API）は変えずに、実行部だけを置き換える。基準は terrarium の main commit `60dd0dc448f3a67d226dc8a3c6b3afcf4709823d`。
- 公開リポジトリを作り、GitHub Release と npm で `0.1.0-rc.1` を出す。terrarium で受け入れを確かめてから `0.1.0` を出す。公開は GitHub Actions の Trusted Publishing で行う。
- 対象外：Rust crate、JSR、paludarium の実装、C fork の JIT、ゲストのネットワーク、デーモン、汎用の対話 CLI と shell、aube・pitchfork 以外のツールの移行、変更のない aube の再ビルド、実機 Safari の必須化、新しい性能目標。

作業は 4 つに分けた。実行ランタイムと npm パッケージ、ゲストの ref 別配布、terrarium への組込み、公開前の検証と公開判断。記録は 2026-10-10 の検証の途中で終わっている。

## 主な決定

- **責任を 4 つに分ける。** コアの扱い、1 回のゲスト実行、run をまたぐファイル状態、Worker の寿命を別の部品にした。ファイル状態の持ち主は 1 つだけにする。terrarium に状態を持たせると、UI と Node の利用者で規則が二重になるため。Node とブラウザの違いは Worker の adapter の中に閉じる。
- **共通パッケージとゲスト配布を分ける。** コアの版とゲストの ref を別々に追える。ゲストを npm に入れる案は要件（FR1.3、FR6）に反するので採らなかった。詳細は [guest-distribution.md](../guest-distribution.md)。
- **terrarium の互換は翻訳層で保つ。** 低層の API は stdout/stderr の bytes と終了の分類を返す。terrarium の code/output/transcript とイベントへの対応は terrarium 側で行う。formicarium に DOM 依存を入れない。
- **RC と stable の判定を分ける。** 公開済みの RC を terrarium で受け入れることを RC 公開の前提にすると、循環してしまう。そこで RC は公開前の検査と最小 consumer の成功で判定し、stable には公開済み RC の受け入れと全 NFR を求めることにした。判定の詳細は [release-assurance.md](../release-assurance.md)。
- **terrarium の端末は stdout と stderr を両方表示する。** 基準の terrarium が同じ表示に両方を流しているため。native と比べる記録は stdout だけで別に取る。
- **hard link と symlink は run をまたいで保つ。** 基準の terrarium が inode で hard link を作り直しているため。
- **Worker の終了を確かめられないときは、session を使えなくする。** run は `EXECUTION` で失敗し、状態は保存しない。以後の操作は `DISPOSED` になる。正常に止められた timeout/abort の後は、続けて実行できる。
- **ブラウザでは、照合済みの loader bytes を Blob module として評価する。** 照合した bytes と pthread の起動の両方を満たすため。そのため、consumer の CSP で `blob:` を許す必要がある。Node は run ごとの非公開ディレクトリに置いたコピーを使う。
- 既存の制約はそのまま守る。コア固有の知識は core に閉じる（[ADR 0003](../decisions/0003-core-boundary.md)）。run ごとに新しいインスタンスを使う（[ADR 0008](../decisions/0008-fresh-instance-per-step.md)）。ブラウザの Worker では `Atomics.waitAsync` を消す（[ADR 0009](../decisions/0009-disable-atomics-waitasync.md)）。wasm メモリの上限は 1 GB（[ADR 0010](../decisions/0010-wasm-memory-1gb.md)）。

## 仕様・設計の要点

**パッケージの中身。** exports は `.`（Node の builtin を使わない共通の helper と型）、`./node`、`./browser`、`./assets/blink.mjs`、`./assets/blink.wasm`、`./assets/build-info.json`。aube と pitchfork の ELF、fixture、開発用の probe、作業記録は入れない。Node は 24 以上。最終の tarball は 24 ファイルで、loader・wasm・build-info は同じビルドの組にし、`blink.lock` の commit と dirty=false を照合する。使い方は [README.md](../../README.md) の「Local runtime package candidate」にある。

**実行 API（Node とブラウザで同じ意味）。**
- `createSession({ assets?, cwd?, home?, entries? })` と `decodeUtf8`。cwd の既定は `/work`、home は `/root`。
- `Session` のメソッドは `run`、`readFile`、`remove`、`listEntries`、`setCwd`、`reset`、`dispose`。
- `run` は `guest`（static-musl x86-64 の ELF）、`args`、`env`、`timeoutMs`（既定 600000 ms）、`signal`、`onOutput` を受け取る。結果は `exitCode` と、bytes の `stdout`/`stderr`。
- エラーの code は `INVALID_INPUT`、`ASSET_LOAD`、`UNSUPPORTED_ENV`、`CORE_INIT`、`EXECUTION`、`SNAPSHOT`、`TIMEOUT`、`ABORTED`、`BUSY`、`DISPOSED`、`NOT_FOUND`、`NOT_FILE`。
- 1 つの session で同時に動く run は 1 つ。重なった呼び出しは `BUSY` で拒否し、暗黙に並べない。
- 状態は、正常に終了したときだけ丸ごと反映する。非 0 の終了も正常終了として扱う。失敗、timeout、中止では前の状態を残す。
- timeout は受け付けてから、資産の取得、初期化、実行、snapshot までの全体で測る。
- `/`、`/guest`、`/dev`、`/proc`、`/tmp` は持ち越す root にしない。`..` や途中の symlink を含む path は拒否する。

**terrarium 側。** `cd`/`ls`/`cat`/`rm`/`pwd` は上の公開ファイル操作に翻訳する。pipe・リダイレクト・展開は shell として実行せず、明示的なエラーにする。未知のコマンドは基準どおり code 127。iframe は、承認した親の origin だけから受け取り、その origin だけへ送る（`*` は使わない）。埋め込みの条件ごとの合否は次の表で固めた（FR5.4）。

| 条件                                        | Chromium                 | Firefox                    | WebKit                     |
| ------------------------------------------- | ------------------------ | -------------------------- | -------------------------- |
| 同一 origin、隔離の条件あり                 | 成功                     | 成功                       | 成功                       |
| 外部 origin（GitHub Pages、credentialless） | 成功                     | 未対応の通知、ゲスト未実行 | 未対応の通知、ゲスト未実行 |
| 隔離の条件なし                              | 原因の通知、ゲスト未実行 | 同左                       | 同左                       |

**公開の流れ。** `v*` tag を入口に、verify、publish、Release の 3 つの job に分けた。権限は publish だけに `id-token: write`、Release だけに `contents: write`。npm の長期 token は使わない。この設計は [release-assurance.md](../release-assurance.md) にある。いまの通常の公開は [automated-releases.md](../automated-releases.md) の手順に変わっている。

## 品質の目標と結果

目標の数値：Node 24 以上と Chromium・Firefox・WebKit。probe 600 秒、aube のブラウザ 840 秒、pitchfork はブラウザ 600 秒・Node 120 秒。worker 1、retry なし、probe 8 項目すべて合格、native と同じ出力、wasm 1 GB。固定した第一者の配布 JS で行 coverage 80% 以上（実行されなかったファイルも分母に入れる）。統合の前に CI を通す。

測った結果（2026-10-10）：
- 公開用 tarball（SHA256 `8334d7f1…`）：Node 115/115、ブラウザ 123/123、terrarium の Node 30/30・ブラウザ 45/45。
- 固定 24 ファイル（ランタイム 14、ゲスト配布 3、terrarium 7）の coverage：1450/1801 行 = 80.51%、skip 0、収集の記録 46 件。ランタイムの 14 ファイルだけでは 862/982 行 = 87.78%、ゲスト配布の 3 ファイルは 249/254 行 = 98.03%。
- 検証用 fork での遠隔 CI（[run 38040455333](https://github.com/Marukome0743/formicarium/actions/runs/38040455333)、source `12a92eab`）：必須の 9 check がすべて成功。試験 438 件と native 2 件、skip 0。ただし、この CI が測ったのは private の v9 tarball（`dfcc3e63…`）。公開用 tarball とは package.json 以外の 23 ファイルの bytes が同じことを照合した。
- 機密パターンの検出 0 件。`npm audit` の脆弱性 0 件。依存 84 件のライセンス宣言と、blink・Emscripten・musl の原文が同梱されていることを照合した。
- 実機 Safari 27.0.1：ランタイム単体の 5 ケースは成功した。terrarium 組込みの候補では試していない。

| 要件                  | 判定                                                                            |
| --------------------- | ------------------------------------------------------------------------------- |
| NFR1 環境             | Unverified（公開済み RC の registry 照合と、実際の terrarium への導入が未実施） |
| NFR2 上限             | Met                                                                             |
| NFR3 coverage と CI   | Met                                                                             |
| NFR4 隔離と入力の検証 | Met                                                                             |
| NFR5 出所と整合       | Met（全履歴の安全を認定したものではない）                                       |
| NFR6 コアの境界       | Met                                                                             |
| NFR7 失敗の区別と記録 | Met                                                                             |

要件の対応表は 95 件のうち 69 件が PASS、26 件が FAIL だった。FAIL は主に、公開・公開済み RC の受け入れ・Trusted Publishing の実設定に関わるもの。全体の検証は成功としていない。

## 運用・リリースの手順

公開候補の作り方、証拠の保存、RC と stable の判定、coverage の測り方、初回パッケージの bootstrap の順序は [release-assurance.md](../release-assurance.md) にある。ゲスト配布物の作り方は [guest-distribution.md](../guest-distribution.md) にある。いまの stable 公開は [automated-releases.md](../automated-releases.md) に従う。

記録にだけ残っている注意：
- ゲストのソースが変わっていなければ aube は再ビルドしない。
- pitchfork v2.30.1 は上流で musl の型が直っているので、ローカルのパッチは要らない。

## 成果

- ランタイムの npm 候補：`0.1.0-rc.1`。検証に使った private の v9 tarball は `dfcc3e6384b5ed14ddefbccd4806b9f1be2d858129e74216f116668142571f6d`（core `a882fb2f`、dirty=false）。公開用の tarball は `8334d7f14c31109e5be3ec90147aa02105d8d839c4c79eccc1c25cb88eabbb3a`（package.json だけを変えた）。
- ゲストの ref 別配布の候補（aube v2.6.1/v2.7.0、pitchfork v2.30.0）。terrarium の組込みは、ローカルで pitchfork v2.30.1 を使って確かめた。
- `publish.yml` と公開前の検査（ローカルの境界試験 74/74）。
- 公開先は `aletheia-works/formicarium`、workflow `publish.yml`、environment `release` に決まった。
- 記録の期間中には、公開リポジトリの作成、push、npm 公開、GitHub Release のどれも行っていない。PR 番号も記録にはない。

## 残った課題

- npm の Trusted Publisher の実設定がない（対象パッケージがまだ登録されていなかった）。CLI の認証もない（`npm whoami` が ENEEDAUTH）。
- 実 OIDC での公開、RC の公開、公開済み RC の terrarium での受け入れ、stable の公開が未実施。
- 実機 Safari での terrarium 組込み候補、実際の GitHub Pages での配信、ゲストの実配信が未検証。
- 公開用 tarball での遠隔 CI は未実行。遠隔 CI の成功は private の v9 についてのもの。
- collector の Windows 経路が未検証。
- terrarium のソースは別リポジトリにあるため、変更をどちらの記録で管理するかを決め直す提案が残った。

## 元の記録

記録は git の commit `8096c7b4` の `aidlc/spaces/default/intents/261006-npm-terrarium-release/` にある。
