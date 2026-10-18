# U7 showcase-guests コード生成の要約

## Status

- 実装（Step 1–8・10・11）は upstream の main に PR aletheia-works/formicarium#31（merge `880cfd4a`）で取り込み済み。この記録の作成時点（2026-10-18）の working copy は main `bbf97ba6` の上で、`jj diff -r '880cfd4a..bbf97ba6'` は `showcase/`・`.github/workflows/showcase.yml`・`mise-tasks/showcase/`・`package.json`・`biome.json`・`.gitignore`・`README.md`・`runtime/`・`types/`・`web/` のいずれも 0 files changed（検証済み）。U7 のコードはこの stage で書き直していない。
- Step 9（受入）は人間の回答（Q1：CIで受入。audit `QUESTION_REPLIED` 2026-10-18T03:10:25Z）に従い、CI の `showcase.yml` run 39113037176 で行った（検証済み、下記）。
- Step 12（ローカルの確認）はすべて main session で 1 つずつ実行し、すべて exit 0（検証済み、下記）。
- push・PR・GitHub への書込み・artifact の取得・Release の作成はこの stage で行っていない。

## Files created/modified

U7 が作成・変更した application source（`source-manifest.json` と同じ範囲。生成物の `showcase/node_modules/`・`showcase/.work/` は含めない）。

- 新規：`showcase/package.json`、`showcase/tsconfig.json`、`showcase/README.md`、`showcase/tools.json`、`showcase/allowed-sources.json`、`showcase/trusted-callers.json`、`showcase/b1-pack.json`、`showcase/builders/cargo.sh`、`showcase/fixtures/`（demo fixture 3 種）、`showcase/scripts/`（20 file）、`showcase/tests/`（試験 14 file＋`accept.spec.ts`・`playwright.config.ts`、`fixtures/` 5 file、`boundary-fixtures/`）、`.github/workflows/showcase.yml`、`mise-tasks/showcase/{unit,boundary,stage,typecheck,accept-node,accept-browser}.sh`。
- 変更：`package.json`（`showcase:*` の 7 script）、`.gitignore`（`/showcase/node_modules/`・`/showcase/.work/`・`/showcase/.probe/`）、`biome.json`（`showcase/**` の `noRestrictedImports` と除外）、`README.md`（showcase の案内 1 節）。
- 本体の `runtime/`・`types/`・配布物・既存の試験は変えていない（検証済み：PR #31 の差分一覧に含まれない）。

## Key implementation decisions

- showcase は公開 export（root・`/node`・`/browser`）だけを使い、tar.gz の展開と正規化 JSON（buildKey・candidateId）は showcase の中に実装した。最終の検証は公開の `validateGuest`・`createInstaller`・`createCommandSession` がもう一度行う（ドキュメント根拠：計画の「前提と境界」）。
- upstream の規約への合わせ（2026-10-18、人間の指示）：task は `mise.toml` ではなく `package.json` の `showcase:*` と `mise-tasks/showcase/*.sh` に置いた。repository の保護の OpenTofu（`infra/github/`）は、upstream の既存の `infra/github/` が管理しているため新しく作らなかった。
- source build の toolchain は upstream の宣言を優先し、なければ最新の安定版（CI では rustup の stable 1.99.1。acquire job の log `latest update on 2026-10-15 for version 1.99.1`）。pitchfork の `sourcePatches` は空。
- `showcase/b1-pack.json` は B1 の Release を作るまで全 field `null`。`distribute` は `b1-pack-unavailable` で失敗する（`showcase/tests/pack.test.ts` の `distribute fails closed without a B1 Release`）。

## Test coverage summary

Step 12（main session、逐次、2026-10-18、Node v26.12.0・Bun 1.4.3・TypeScript 7.0.2）：

| コマンド | 結果 | 状態 |
|---|---|---|
| `mise run lint:all` | exit 0。Biome `Checked 376 files ... Found 48 warnings. Found 47 infos.`（警告・info はすべて `showcase/` 以外の既存 file。file 別の集計で `showcase/` は 0 件）。actionlint・ShellCheck も `set -euo pipefail` の下で通過 | 検証済み |
| `SHOWCASE_SOURCE_COMMIT=bbf97ba668deedb2e4e7d2f7d446417af860b53c mise run showcase-stage` | `verify b65e88160ba4fac9067814097b72bf8912dcb1d64ad8debd15e601a43485bffd`。CI run 39113037176（`880cfd4a`）の pack SHA256 と一致 | 検証済み |
| `mise run showcase-typecheck` | exit 0 | 検証済み |
| `mise run showcase-unit` | exit 0。tests 91・pass 91・fail 0・skipped 0（2766ms）。`showcase/scripts/**` の行 coverage 87.76%（all files、閾値 80% の `--test-coverage-lines=80`）、branch 81.46%、funcs 85.71% | 検証済み |
| `mise run showcase-boundary` | exit 0。`boundary: no violation` | 検証済み |
| `mise run typecheck` | exit 0（本体の `tsconfig.json` と `tsconfig.tests.json`） | 検証済み |
| `mise run test:light` | exit 0。bun test 71 pass／0 fail、bun test 37 pass／0 fail、node:test 125 件（pass 123・skipped 2・fail 0。skip は既存の `--test-skip-pattern` の 2 件）、node:test 130 pass／0 fail | 検証済み |

- coverage の分母：`showcase/scripts/` の 20 file がすべて計測表に出ている（未収集の file はない。`showcase/tests/boundary.test.ts` の `every showcase script is loaded, so none is missing from the coverage denominator`）。file 別では `accept-node.ts` 55.67%、`tls.ts` 55.14%、`candidate.ts` 76.65% が 80% 未満。閾値は計画どおり全体（all files）に掛かり、この 3 file の未計測部分は CI の受入 job で実行される経路（job TLS・子 process・CLI 入口）である。基準は変えていない。
- 最初の `showcase-unit` は、以前の staging の pack（`0.1.0-rc.1`、commit `93dc2a8e`）が `showcase/node_modules/` に残ったまま実行した（91 pass、87.76%）。単体試験の手順どおり現在の commit で `showcase-stage` をやり直し、typecheck・unit・boundary を再実行した結果を上の表に記録した。

Step 9 の受入（CI、`gh run view 39113037176 -R aletheia-works/formicarium --log` を読取りのみ）：

- run：workflow `Showcase guests`、event `push`、branch `main`、head `880cfd4ad913fbd10d0c58d73fb158af7c5c2042`、conclusion `success`。job は resolve 31s、acquire 282s、catalog 24s、accept 135s、candidate 25s（いずれも success）。
- 解決した版（resolve job）：`aube v2.7.2 052f70fdf99d89ef50beb3816a1305fc2217efa5`、`pitchfork v2.31.0 21afa795375d8875f1a02dada7452c9efcd8b1b7`、`biome @biomejs/biome@2.5.15 0b4c11f553a7e702f9851af139662e1de45dc131`。
- 取得・build（acquire job）：`aube 2.7.2 5fc0c63b…6850`、`biome 2.5.15 42b6fd36…e656`（公式資産）。pitchfork は `buildKey ec191512…f71f`、`reused: none` の後に source build（`Finished release profile ... in 3m 45s`）、`pitchfork 2.31.0 3d605106…cd39`。
- catalog（catalog job）：`showcase-ef1863a0ae49016748c194ee4af6cd49 76445afd…20d9`（catalogId と catalog の正規化 SHA256）。
- 受入 12 行（accept job、すべて `passed`。`passed` は stdout の版が `resolutions.json` の tag と一致したときだけ付く：`showcase/scripts/acceptance.ts`）：

| tool | node | chromium | firefox | webkit |
|---|---|---|---|---|
| aube | install 1680ms／--version 524ms | 1392／668 | 1575／690 | 989／447 |
| pitchfork | 1515／501 | 1297／658 | 1414／668 | 757／447 |
| biome | 1028／752 | 2118／950 | 2301／998 | 1159／714 |

- 環境（観測した版）：Node v26.12.0、`@playwright/test@1.64.1`、Chrome for Testing 156.0.8078.4（chromium v1248）、Firefox 157.0（v1555）、WebKit 27.2（v2370）。Playwright は `Running 9 tests using 1 worker`、`--workers=1 --retries=0`、`9 passed (37.2s)`。
- 候補（candidate job）：`98c37f3a45d5c973dd1a1f98041ab5ce8913d0e8a67d67e9194dfe64b1a78204 distributable=false`、artifact `showcase-candidate`（ID 12131028903、61651538 bytes、digest `0b020cdb…fd7e`）。

## Traceability

`traceability.json` の各行の根拠。試験名は `mise run showcase-unit`（91 pass）で実行済み。

| ID | 実装 | 根拠の試験・観測 | 状態 |
|---|---|---|---|
| FR13 | `.github/workflows/showcase.yml`、`showcase/scripts/{resolve,acquire,build,catalog,candidate}.ts` | CI run 39113037176 の 5 job success・12 行 passed | 検証済み |
| FR14 | `showcase/scripts/boundary.ts`、`biome.json` | `boundary.test.ts`：`each violation fixture fails with exactly its one violation`、`the Biome rule refuses internal imports from showcase and allows the public export`。`workflow.test.ts`：`the showcase CI does not copy the heavy body regressions` | 検証済み |
| NFR2.1 | 本体を変えない、showcase の CI に重い本体試験を入れない | `mise run test:light`・`mise run typecheck` exit 0、`workflow.test.ts` の上記試験。aube は公式資産で再 build なし（acquire log） | 検証済み |
| NFR2.2 | `showcase/scripts/acceptance.ts` | `candidate.test.ts`：`every tool x environment row must exist once and pass`、`a missing acceptance row or a pack of another mode creates no candidate`。lint・型・単体の各 exit 0 | 検証済み |
| NFR3.1 | `showcase/scripts/config.ts`、`showcase/tools.json` | `config.test.ts` の 8 試験（必須 field・重複 tool・未知の build 種別・許可一覧外・tag の規則・`b1-pack.json`・重複 key） | 検証済み |
| NFR3.2 | `showcase/scripts/resolve.ts` | `resolve.test.ts` の 7 試験。CI resolve log の 3 行 | 検証済み |
| NFR3.3 | `showcase/scripts/acquire.ts` | `acquire.test.ts`：`a checksum mismatch and a dynamic ELF are refused`、`the streamed size must equal the declared size in both directions` ほか | 検証済み |
| NFR3.4 | `showcase/scripts/build.ts`、`showcase/builders/cargo.sh` | `build.test.ts`：`toolchains follow upstream declarations, else the latest stable`、`a commit the tag no longer names, ... is refused`。`acquire.test.ts`：`the acquire job stores verified copies and never builds a release-asset tool`。CI の pitchfork source build | 検証済み |
| NFR3.5 | `showcase/scripts/archive.ts`、`showcase/scripts/catalog.ts` | `archive.test.ts` の 7 試験、`catalog.test.ts`：`the 4 MiB catalog limit accepts its value and refuses one byte more`、`the generated catalog ... is accepted by createInstaller` | 検証済み |
| NFR3.6 | `showcase/scripts/boundary.ts` | `boundary.test.ts` の 5 試験、`mise run showcase-boundary` の `boundary: no violation` | 検証済み |
| NFR4.1 | `showcase/scripts/{acquire,build,github}.ts` | `build.test.ts`：`a deadline ends the whole process group and staging is removed afterwards`。`acquire.test.ts`：`the deadline covers the whole request and is reported as deadline`。`resolve.test.ts`：`rate limits, offline and invalid bodies keep their cause and are not retried` | 検証済み |
| NFR4.2 | `showcase/scripts/accept-node.ts`、`showcase/tests/accept.spec.ts` | CI accept log の 12 行の install と `--version` の ms | 検証済み |
| NFR5.1 | `showcase/scripts/candidate.ts` | `candidate.test.ts`：`the same inputs give the same candidateId; run records do not change it`、`changing one identity input changes the candidateId` | 検証済み |
| NFR5.2 | `.github/workflows/showcase.yml`（`showcase-candidate` の upload と出力） | `workflow.test.ts`：`PR runs cancel older revisions only; the candidate is uploaded once at the end`。CI の artifact ID 12131028903。U8 側の受取りと digest の照合は U8 の範囲 | 検証済み（U7 側）／未検証（U8 側） |
| NFR5.3 | `showcase/scripts/pack.ts` | `pack.test.ts` の 5 試験。ローカルと CI の pack SHA256 `b65e8816…` が一致 | 検証済み（verify）／未検証（distribute の実行） |
| NFR6.1 | `showcase/tests/accept.spec.ts`、`showcase/scripts/accept-node.ts` | CI の 12 行 passed、Node・Playwright・browser の版を log で観測。実機 Safari は未検証 | 検証済み（4 環境）／未検証（Safari） |
| NFR8.1 | `showcase/scripts/mode.ts`、`.github/workflows/showcase.yml` | `mode.test.ts` の 6 試験、`workflow.test.ts`：`permissions are read-only; only acquire, catalog and candidate read actions`、`actions are pinned by commit SHA ...`、`every checkout keeps credentials out of the workspace` | 検証済み |
| NFR8.2 | `showcase/README.md`（Rollback）、`showcase/scripts/candidate.ts`（license・notices） | `workflow.test.ts`：`the source build step gets no token and runs after reuse lookup`、`build.test.ts`：`the build environment is an allow list that refuses tokens`。候補の notices の中身は artifact 未取得のため未検証 | 検証済み（token の除外・手順書）／未検証（notices の中身） |

## Tests written but not executed in this stage

- ローカルの受入（`mise run showcase-accept-node`・`mise run showcase-accept-browser`）：実行していない。人間の回答 Q1（CIで受入）により CI の受入で置き換えた。理由は、`resolve.ts` が `origin/main` の許可一覧だけを読むことと、browser の受入が job 専用 CA を信頼した環境を要すること（macOS では人間の操作が要る）。
- pitchfork の source build：ローカル（macOS）では実行していない（計画どおり Linux の CI だけ）。CI の acquire job で build 済み。
- 実機 Safari：未検証。WebKit の結果で置き換えない（NFR6.1）。
- 候補 artifact の中身（`manifest.json`・受入 log・license と notices・build-info）：artifact を取得していないので未検証。CI の log で見えた値だけを上に記録した。
- candidate job の job summary（「最後に `distributable: true` の候補を作った run からの日数」）：log には出ないので、今回の run の値は未検証。計算は `showcase/tests/candidate.test.ts` の `days since the last distributable run, and the job summary line` で検証済み。
- `distribute` mode の実行：未検証。B1 の Release がまだなく（`showcase/b1-pack.json` は `null`）、U8 の workflow も未作成。
- browser の COI：`showcase/tests/accept.spec.ts` は `crossOriginIsolated` が偽なら `not-cross-origin-isolated` で行を失敗させるので、CI の 9 行の `passed` は COI の成立を含む（検証済み、log と code から）。CSP（blob・wasm）は `showcase/scripts/accept-server.ts` が付ける（ドキュメント根拠）。Worker の `delete Atomics.waitAsync` は本体の browser Worker のもので、U7 は変えていない。応答 header の実測値は artifact・log にないので未検証。

## Deviations from the plan

- Step 1：`mise.toml` への task の宣言は、upstream の規約に合わせて `package.json` の `showcase:*` と `mise-tasks/showcase/*.sh` に置き換えた（人間の指示、2026-10-18）。
- Step 9：ローカルの受入を CI の受入で置き換えた（人間の回答 Q1）。
- Step 11：OpenTofu（`infra/github/` の新設、`tofu fmt -check`・`tofu validate`）は、upstream の既存の `infra/github/` が管理しているため取り下げた。`showcase/README.md` と本体 `README.md` の 1 節は作成済み。
- Step 12：計画の一覧に加えて、単体試験の手順の 2（`showcase-stage`）を `SHOWCASE_SOURCE_COMMIT` を付けて実行した（README の手順どおり。付けないと `config-invalid: verify needs the 40-hex source commit` で止まる）。
- 記録との差（未修正、指摘外の変更をしないため）：本体 `README.md` の showcase の節と `showcase/README.md` の「未検証のこと」は「受入・CI は未検証」と書いているが、CI の受入は run 39113037176 で通った。文言の更新は別の変更として人間の判断を待つ。

## Sources

- `aidlc/spaces/default/intents/261012-terrarium-migration/construction/u7-showcase-guests/code-generation/code-generation-plan.md`（承認済みの計画）
- `aidlc/spaces/default/intents/261012-terrarium-migration/construction/u7-showcase-guests/nfr-requirements/security-requirements.md`（NFR2.1–NFR8.2）
- `aidlc/spaces/default/intents/261012-terrarium-migration/inception/requirements-analysis/requirements.md`（FR13・FR14）
- audit `mutounomacbook-pro-local-c4e3e4a409a8.md`（Q1・Q2 の回答、2026-10-18T03:10:25Z）
- GitHub Actions run 39113037176 の log（読取りのみ）
