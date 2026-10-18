# showcase

最新の安定版の aube・pitchfork・Biome を、formicarium の**公開 export だけ**で
受入し、showcase の候補（C09 `ShowcaseCandidateManifest`、catalog、guest）を作る。
配布（Pages）は U8 が、この候補を受け取って行う。showcase は候補を長期保存しない。

この文書の手順と試験は、追加した時点では実行していない（未検証）。実機 Safari は
WebKit の結果で置き換えず、未検証として記録する。

## 構成

```text
showcase/
├── package.json              # private。依存は持たず、本体は stage した pack を使う
├── tsconfig.json             # strict、erasableSyntaxOnly、noEmit（型検査だけ）
├── tools.json                # ツールの条件（repository・tag の形・資産・source build）
├── allowed-sources.json      # 受け付ける repository（main の定義だけを使う）
├── trusted-callers.json      # distribute を受け付ける U8 workflow と再利用元の workflow
├── b1-pack.json              # B1 の pack の Release（作るまでは null）
├── fixtures/                 # demo fixture（U8 が使う。回帰用の fixtures/ とは別）
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

| 工程 | script | 内容 |
|---|---|---|
| mode | `scripts/mode.ts` | `verify`（既定）か `distribute`。`distribute` は main の U8 workflow（`schedule`・`workflow_dispatch`）からの呼出しだけ |
| 解決 | `scripts/resolve.ts` | `releases/latest`（draft・prerelease を除く）、annotated tag を辿った 40 桁の commit、資産の digest・size・URL、license。`resolutions.json` に 1 回だけ書く |
| pack | `scripts/pack.ts` | `verify`：同じ commit を本体の stager と `npm pack` で包む。`distribute`：`b1-pack.json` の Release の pack と C06 の証拠を取得し `packSha256` を照合 |
| 取得 | `scripts/acquire.ts` | C11 の規則（HTTPS、credential なし、redirect 5 hop、120 s、128 MiB）で取得し、SHA256・size を照合、tar.gz を検査、公開 `validateGuest` で検証 |
| source build | `scripts/build.ts`、`builders/cargo.sh` | `prepare`：tag と commit の一致、codeload の source、toolchain の選択、buildKey。`compile`：token なしの独立した process group で build |
| 再利用 | `scripts/reuse.ts` | main の信頼した workflow の成功 run の `showcase-candidate` から、buildKey・ELF・build-info を照合して再利用 |
| catalog | `scripts/catalog.ts` | C04 `GuestCatalog`（same-origin の相対 URL）。公開 `createInstaller` で受理を確かめる |
| 受入 | `scripts/accept-node.ts`、`tests/accept.spec.ts` | `install <tool>` と `<tool> --version`。3 ツール × Node・Chromium・Firefox・WebKit の 12 行 |
| 候補 | `scripts/candidate.ts` | 12 行がすべて合格したときだけ manifest を作る。`verify` は常に `distributable: false` |

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
5. C09 の `resolvedTools[].tool` の型は今は 3 ツールに限られるので、4 つ目を
   加えるときは契約の変更をレビューに出す。

## mode と U8

`showcase.yml` は `pull_request`・`push`（main）・`workflow_dispatch`・
`workflow_call` で動く。直接の実行には `mode` の入力がなく、常に `verify` になる。
`distribute` は、`trusted-callers.json` の `distributeCaller` が main から
`schedule` か `workflow_dispatch` で呼んだときだけ受け付ける。U8 は `candidate`
job が成功し、出力 `distributable` が `true` のときだけ配布を始める。

## B1 の pack の Release

`distribute` は `b1-pack.json` が指す Release の pack を使う。今は `null` で、
`distribute` は `b1-pack-unavailable` で失敗する。Release は、人間が対象
（pack・C06 の証拠・その SHA256）を承認した後にだけ作る。

1. B1 受入で固定した pack と C06 `ApiAcceptance` の JSON を用意し、SHA256 を確かめる。
2. prerelease の `b1-<packSha256 の先頭 12 桁>` を作り、2 つの資産と SHA256 の一覧を上げる。
   上書きと削除はしない。
3. `b1-pack.json` に tag・資産名・SHA256 を書く PR を出し、main に入れる。

## 定期実行の確認（月 1 回）

public repository では、活動がないと `schedule` の workflow が自動で無効になり、
そのときは run も通知も起きない。月に 1 回、人間が Actions の画面で U8 の
workflow が有効であることを確かめる。各 run の `candidate` job の summary には
「最後に配布可能な候補を作った run からの日数」が出る。

## 切り戻し（Rollback）

- showcase の変更：PR を revert する。
- 前の候補に戻す：候補は長期保存しないので、前の commit で U8 から
  `mode: distribute` で呼び直す（`showcase.yml` を直接動かすと `verify` になり、
  配布できる候補にならない）。
- B1 の pack：`b1-pack.json` を前の tag に戻す PR。Release の資産は消さない。
- repository の設定：`infra/github/README.md` の手順。

## 未検証のこと

- 単体試験・型検査・Biome・境界の検査・受入・CI は、追加した時点では実行していない。
- 各ツールの最新 release の公式資産の形、pitchfork の upstream の toolchain の宣言。
- 実機 Safari。
