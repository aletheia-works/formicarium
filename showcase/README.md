# showcase

最新の安定版の aube・pitchfork・Biome を、formicarium の**公開 export だけ**で
受入し、showcase の候補（`ShowcaseCandidateManifest`、catalog、guest）を作る。
配布（Pages）は showcase site（`site/`、`showcase-site.yml`）が、この候補を受け取って
行う。showcase は候補を長期保存しない。

単体試験・境界の検査・`verify` の受入（3 ツール × Node・Chromium・Firefox・WebKit の
12 行）は CI で通っている（最初は run 39113037176、2026-10-20 の main `c9b37c4a` では
run 39412286499）。macOS の実機 Safari の 3 行も受入に加え（`accept-safari` job）、
15 行がそろわないと候補を作らない（15 行がそろった最初の main の run は 40151083995、
`82a01c27`、Safari 26.6.2）。WebKit の結果を Safari の代わりにはしない。

## 構成

```text
showcase/
├── package.json              # private。依存は持たず、本体は stage した pack を使う
├── tsconfig.json             # strict、erasableSyntaxOnly、noEmit（型検査だけ）
├── tools.json                # ツールの条件（repository・tag の形・資産・source build）
├── allowed-sources.json      # 受け付ける repository（main の定義だけを使う）
├── trusted-callers.json      # distribute を受け付ける showcase-site workflow と再利用元の workflow
├── formicarium-release.json  # distribute が使う npm の版（版・integrity・タグのコミット）
├── fixtures/                 # demo fixture（showcase site が使う。回帰用の fixtures/ とは別）
├── builders/cargo.sh         # cargo を絶対 path で呼ぶ builder
├── scripts/                  # 解決・取得・build・再利用・catalog・pack・候補・受入・境界
└── tests/                    # node:test の単体試験、Playwright の受入、違反 fixture
```

script は TypeScript のまま Node の型の除去で動く（emit しない）。import は
`@aletheia-works/formicarium`・`/node`・`/browser` と Node の組込み（試験では
`@playwright/test` も）だけで、本体の内部・本体から showcase への依存・回帰用
fixture の共有は `scripts/boundary.ts` と Biome の `noRestrictedImports` で拒否する。

生成物は `showcase/.work/`（取得物・staging・site・受入 log・候補）と
`showcase/node_modules/`（SHA256 を確かめてから展開した本体の pack）に置き、
どちらも commit しない。

## 流れ

| 工程         | script                                                                     | 内容                                                                                                                                                         |
| ------------ | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| mode         | `scripts/mode.ts`                                                          | `verify`（既定）か `distribute`。`distribute` は main の showcase-site workflow（main への `push`・`workflow_dispatch`）からの呼出しだけ                     |
| 解決         | `scripts/resolve.ts`                                                       | `releases/latest`（draft・prerelease を除く）、annotated tag を辿った 40 桁の commit、資産の digest・size・URL、license。`resolutions.json` に 1 回だけ書く  |
| pack         | `scripts/pack.ts`                                                          | `verify`：同じ commit を本体の stager と `npm pack` で包む。`distribute`：`formicarium-release.json` の版を npm から取得し、integrity とタグのコミットを照合 |
| 取得         | `scripts/acquire.ts`                                                       | TransferPolicy の規則（HTTPS、credential なし、redirect 5 hop、120 s、128 MiB）で取得し、SHA256・size を照合、tar.gz を検査、公開 `validateGuest` で検証     |
| source build | `scripts/build.ts`、`builders/cargo.sh`                                    | `prepare`：tag と commit の一致、codeload の source、toolchain の選択、buildKey。`compile`：token なしの独立した process group で build                      |
| 再利用       | `scripts/reuse.ts`                                                         | main の信頼した workflow の成功 run の `showcase-candidate` から、buildKey・ELF・build-info を照合して再利用                                                 |
| catalog      | `scripts/catalog.ts`                                                       | `GuestCatalog`（same-origin の相対 URL）。公開 `createInstaller` で受理を確かめる                                                                            |
| 受入         | `scripts/accept-node.ts`、`tests/accept.spec.ts`、`tests/accept-safari.ts` | `install <tool>` と `<tool> --version`。3 ツール × Node・Chromium・Firefox・WebKit・実機 Safari の 15 行                                                     |
| 候補         | `scripts/candidate.ts`                                                     | 15 行がすべて合格したときだけ manifest を作る。`verify` は常に `distributable: false`                                                                        |

toolchain は upstream の宣言（`rust-toolchain.toml`・`rust-toolchain`、UI の
Node は `.node-version`・`mise.toml`・`.tool-versions` の正確な版）に従い、
なければ最新の安定版（Rust は `stable`、Node は実行中の Node）を使う。
upstream の contributor 向け wrapper は使わない。

## ローカルでの実行

すべて main session で 1 つずつ実行する。

```bash
SHOWCASE_SOURCE_COMMIT=<40 桁の commit> mise run showcase-stage
mise run showcase-typecheck
mise run showcase-unit
mise run showcase-boundary
```

受入はネットワークを使う。`resolve.ts` は `origin/main` の `allowed-sources.json`
を読むので、その file が main に入るまでは解決できない。

```bash
GITHUB_TOKEN=<読取りの token> node showcase/scripts/resolve.ts
node showcase/scripts/acquire.ts
node showcase/scripts/catalog.ts
mise run showcase-accept-node
mise run showcase-accept-browser   # SHOWCASE_TLS_* と、job CA を信頼した browser が要る
mise run showcase-accept-safari    # macOS。SHOWCASE_TLS_*、keychain で job CA を信頼した Safari、port 4444 の safaridriver が要る
```

`showcase-accept-node` は job 専用の CA を `showcase/.work/tls/` に作り、
`NODE_EXTRA_CA_CERTS` で子 process だけに信頼させ、終了時に消す。browser の
受入は TLS の検証を緩めない（`ignoreHTTPSErrors: false`、Safari では
`acceptInsecureCerts` を使わない）ため、CA を信頼した環境（CI の手順）でだけ動く。
Safari の job は macOS の System keychain に job CA を信頼させ、leaf が localhost で
信頼されることを確かめてから受入し、終了時に job CA を keychain から消す（管理者の
信頼設定の項目は、使い捨ての runner に残ることがある）。pitchfork は CI の Linux で build したものだけで
受入し、ローカル（macOS）では build しない。

## ツールの追加

1. upstream が公式の x86-64 static musl 資産を出しているかを確かめる。
2. `allowed-sources.json` に repository を加える PR を出し、main に入れる
   （許可一覧は main の定義だけが効く）。
3. `tools.json` に条件を加える。公式資産があれば `release-asset`
   （`asset` の名前、`format`、tar.gz なら `archiveEntry`）、なければ
   `source-build`（`builder: "cargo"`、`binary`）。script に分岐は書かない。
4. `fixtures/` に demo fixture を加える。
5. manifest の `resolvedTools[].tool` の型は今は 3 ツールに限られるので、4 つ目を
   加えるときは契約の変更をレビューに出す。

## mode と showcase site

`showcase.yml` は `pull_request`・`push`（main）・`workflow_dispatch`・
`workflow_call` で動く。直接の実行には `mode` の入力がなく、常に `verify` になる。
`distribute` は、`trusted-callers.json` の `distributeCaller` が main への
`push` か main の `workflow_dispatch` で呼んだときだけ受け付ける（`schedule` は
拒否する。showcase site は日次の実行をやめた）。showcase site は `candidate`
job が成功し、出力 `distributable` が `true` のときだけ配布を始める。

## npm で公開された版

`distribute` は `formicarium-release.json` が指す npm の版
（`@aletheia-works/formicarium`）を使う。取得した tarball の sha512 が固定した
`integrity` と npm の `dist.integrity` に一致し、tarball が `registry.npmjs.org` にあり、
tag `v<version>` のコミットが `sourceCommit` に一致したときだけ使う。版が `null` のときは、
`distribute` は `release-unavailable` で失敗する。
1. 安定版の publish（`publish.yml`）が成功すると、`showcase-release-pin.yml` が
   `scripts/pin-release.ts` でその版を確かめ（`distribute` と同じ取得と照合）、
   `formicarium-release.json` を書き換える PR を bot で作る。RC は固定しない。
2. その PR を main に入れると、`showcase-site.yml` がその版で受け入れてから配布する。
3. 手で固定するときは `node showcase/scripts/pin-release.ts <version>` か、版を指定した
   `showcase-release-pin.yml` の手動の実行。

## 配布の契機

showcase site は日次の実行をやめ、サイトの変更が main に入ったときと main からの手動の実行で
配布する。ゲストの新しい候補（新しい release の取込み）は自動では配布されないので、
人間が main から showcase-site の workflow を手動で実行する。各 run の `candidate` job の
summary には「最後に配布可能な候補を作った run からの日数」が出る。

## 切り戻し（Rollback）

- showcase の変更：PR を revert する。
- 前の候補に戻す：候補は長期保存しないので、前の commit の showcase-site から
  `mode: distribute` で呼び直す（`showcase.yml` を直接動かすと `verify` になり、
  配布できる候補にならない）。
- formicarium の版：`formicarium-release.json` を前の版に戻す PR（`pin-release.ts` で作り直す）。
- repository の設定：`infra/github/README.md` の手順。

## 未検証のこと

- iOS の Safari。
- `accept-safari` job が keychain に job CA を信頼させる手順は、GitHub の macOS runner でだけ
  動かす。手元の Mac の信頼設定は変えないので、ローカルで Safari の受入を動かすには、
  その Mac で job CA を信頼させる必要がある。
- 単体試験は showcase の script 全体の行 coverage 80% 以上を満たすが、`accept-node.ts`
  （子 process での受入）と `tls.ts`（job 専用の CA）の多くの経路は単体試験では通らず、
  CI の受入 job でだけ守られる。受入が壊れたときは、ここが局所的な回帰の検出の弱い所である。

確かめたこと：2026-10-20 の main `c9b37c4a` の候補 artifact（run 39412286499）で、
`manifest.json` の 13 個の資産の SHA256 と大きさ、受入 log と catalog の SHA256、
candidateId の再計算がすべて一致し、3 ツールの build-info、`NOTICES.md` と 5 個の
license があった。

`distribute` の実行：2026-10-20 の main `94970a9e` の push で、
`showcase-site.yml` の run 39422079965 が `showcase.yml` を `mode: distribute` で呼び、
当時の `b1-pack.json` の Release の pack（`a3370ca4…`。今は npm の版に置き換えた）で候補を作り、その候補で site の
配布まで成功した。「配布の契機」の節の candidate job の summary の日数は、
`showcase/tests/candidate.test.ts` の `days since the last distributable run, and the
job summary line` が根拠である（run の summary の値は確かめていない）。
