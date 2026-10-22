# showcase

最新の安定版の aube・pitchfork・Biome を、formicarium の**公開 export だけ**で
受入し、showcase の候補（`ShowcaseCandidateManifest`、catalog、guest）を作る。
配布（Pages）は showcase site（`site/`、`showcase-site.yml`）が、この候補を受け取って
行う。showcase は候補を長期保存しない。

単体試験・境界の検査・`verify` の受入（3 ツール × Node・Chromium・Firefox・WebKit の
12 行）は CI で通っている（最初は run 39113037176、2026-10-20 の main `c9b37c4a` では
run 39412286499）。実機 Safari は WebKit の結果で置き換えず、未検証として記録する。

## 構成

```text
showcase/
├── package.json              # private。依存は持たず、本体は stage した pack を使う
├── tsconfig.json             # strict、erasableSyntaxOnly、noEmit（型検査だけ）
├── tools.json                # ツールの条件（repository・tag の形・資産・source build）
├── allowed-sources.json      # 受け付ける repository（main の定義だけを使う）
├── trusted-callers.json      # distribute を受け付ける showcase-site workflow と再利用元の workflow
├── b1-pack.json              # B1 の pack の Release（b1-a3370ca4df1f）
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

| 工程         | script                                           | 内容                                                                                                                                                        |
| ------------ | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| mode         | `scripts/mode.ts`                                | `verify`（既定）か `distribute`。`distribute` は main の showcase-site workflow（main への `push`・`workflow_dispatch`）からの呼出しだけ                    |
| 解決         | `scripts/resolve.ts`                             | `releases/latest`（draft・prerelease を除く）、annotated tag を辿った 40 桁の commit、資産の digest・size・URL、license。`resolutions.json` に 1 回だけ書く |
| pack         | `scripts/pack.ts`                                | `verify`：同じ commit を本体の stager と `npm pack` で包む。`distribute`：`b1-pack.json` の Release の pack と受入の証拠を取得し `packSha256` を照合        |
| 取得         | `scripts/acquire.ts`                             | TransferPolicy の規則（HTTPS、credential なし、redirect 5 hop、120 s、128 MiB）で取得し、SHA256・size を照合、tar.gz を検査、公開 `validateGuest` で検証    |
| source build | `scripts/build.ts`、`builders/cargo.sh`          | `prepare`：tag と commit の一致、codeload の source、toolchain の選択、buildKey。`compile`：token なしの独立した process group で build                     |
| 再利用       | `scripts/reuse.ts`                               | main の信頼した workflow の成功 run の `showcase-candidate` から、buildKey・ELF・build-info を照合して再利用                                                |
| catalog      | `scripts/catalog.ts`                             | `GuestCatalog`（same-origin の相対 URL）。公開 `createInstaller` で受理を確かめる                                                                           |
| 受入         | `scripts/accept-node.ts`、`tests/accept.spec.ts` | `install <tool>` と `<tool> --version`。3 ツール × Node・Chromium・Firefox・WebKit の 12 行                                                                 |
| 候補         | `scripts/candidate.ts`                           | 12 行がすべて合格したときだけ manifest を作る。`verify` は常に `distributable: false`                                                                       |

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
```

`showcase-accept-node` は job 専用の CA を `showcase/.work/tls/` に作り、
`NODE_EXTRA_CA_CERTS` で子 process だけに信頼させ、終了時に消す。browser の
受入は TLS の検証を緩めない（`ignoreHTTPSErrors: false`）ため、CA を信頼した
環境（CI の手順）でだけ動く。pitchfork は CI の Linux で build したものだけで
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

## B1 の pack の Release

`distribute` は `b1-pack.json` が指す Release の pack を使う。B1 は、この pack を受け入れた
terrarium 移行時の作業の名前で、Release の tag と資産の名前に残っている。今は
prerelease の [`b1-a3370ca4df1f`](https://github.com/aletheia-works/formicarium/releases/tag/b1-a3370ca4df1f)
を指す（main `2e0358a2` から作った pack と、command API の正式な完了確認の受入の証拠。
中の版の番号は `0.3.0` だが、npm の 0.3.0 とは中身が違う）。`b1-pack.json` が
`null` のときは、`distribute` は `b1-pack-unavailable` で失敗する。Release は、
人間が対象（pack・受入の証拠・その SHA256）を承認した後にだけ作る。
1. 受入で固定した pack と `ApiAcceptance` の JSON を用意し、SHA256 を確かめる。
2. prerelease の `b1-<packSha256 の先頭 12 桁>` を作り、2 つの資産と SHA256 の一覧を上げる。
   上書きと削除はしない。
3. `b1-pack.json` に tag・資産名・SHA256 を書く PR を出し、main に入れる。

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
- B1 の pack：`b1-pack.json` を前の tag に戻す PR。Release の資産は消さない。
- repository の設定：`infra/github/README.md` の手順。

## 未検証のこと

- 実機 Safari。
- 単体試験は showcase の script 全体の行 coverage 80% 以上を満たすが、`accept-node.ts`
  （子 process での受入）と `tls.ts`（job 専用の CA）の多くの経路は単体試験では通らず、
  CI の受入 job でだけ守られる。受入が壊れたときは、ここが局所的な回帰の検出の弱い所である。

確かめたこと：2026-10-20 の main `c9b37c4a` の候補 artifact（run 39412286499）で、
`manifest.json` の 13 個の資産の SHA256 と大きさ、受入 log と catalog の SHA256、
candidateId の再計算がすべて一致し、3 ツールの build-info、`NOTICES.md` と 5 個の
license があった。

`distribute` の実行：2026-10-20 の main `94970a9e` の push で、
`showcase-site.yml` の run 39422079965 が `showcase.yml` を `mode: distribute` で呼び、
`b1-pack.json` の Release の pack（`a3370ca4…`）で候補を作り、その候補で site の
配布まで成功した。「配布の契機」の節の candidate job の summary の日数は、
`showcase/tests/candidate.test.ts` の `days since the last distributable run, and the
job summary line` が根拠である（run の summary の値は確かめていない）。
