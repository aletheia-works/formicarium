# U9 retirement-acceptance の Code Generation の要約

## Step 11：CI Pipeline の境界の確認の後（NFR8.2 の承知、2026-10-22、人間の回答 A）

この節が、この file の中で最も新しい。下の節は、それぞれの時点の記録として残す。製品のコードは変えていない。

- 原因（検証済み）：CI Pipeline の Construction → Operation の確認が FAIL（`verification/phase-check-construction.md`）で、U9 の `NFR8.2` が `Deferred` のまま残った。JSR の `@aletheia-works/terrarium` は削除できず archive。2026-10-22 の読取りで `meta.json` は 200、GitHub の3つの repository は無く、`https://aletheia-works.github.io/terrarium/` は 404（`.artifacts/build-and-test/logs/b2/p17.txt`）。版 0.1.0・0.2.0・0.3.0 が残ることと、npm の 404（最初の読取りは registry の 502）は、Build and Test の `test-results.md` の「U9 の外部の読取り」の行による。
- Step 11：`traceability.json` の `NFR8.2` は `Deferred` のまま変えず、note に上の事実と、人間が失敗のままと承知して記録すると決めたこと（2026-10-22、U1・U3・U9 の進め方の質問への回答 A。CI Pipeline の Q5 の回答 A は「持ち主の段階に戻る」）、Operation へ進むかは CI Pipeline の境界の確認で人間に諮ること、JSR の運営への依頼はしていないことを書いた。`N/A` にすると要件を緩めることになるので、しなかった。
- この行のため、`aidlc engine sensor-traceability --stage build-and-test` は Fail のまま残る（未対応は `NFR8` の `u9-retirement-acceptance: NFR8.2` だけ。`.artifacts/build-and-test/sensor-traceability-5.txt`）。
- 未実施：独立レビューと、intent の検証コマンドによる U9 の checkpoint の確認（Step 12）。

## Status

- 計画の Step 1〜9 を行い、この記録で Step 10 を終える。
- formicarium の PR aletheia-works/formicarium#58 を merge した（`5735433d`、1 commit、61 file、署名は verified）。
- vivarium の PR aletheia-works/vivarium#548 を merge した（`497a200a`、1 commit、3 file、署名は verified）。
- 外部の削除は人間が行った。
  - npm・GitHub の repository・fork 2つ・branch は削除済み。
  - JSR は削除できず、人間の判断で archive にした。
  - 手元の clone はゴミ箱に移した。
  - 下の Step 8 の表を参照。
- formicarium の upstream の branch `codex/release/rc1-inputs` は、09:36Z の時点で残っていた。人間がもう一度削除し、09:53:39Z に `gh api .../branches` と `jj git fetch`（`codex/release/rc1-inputs@upstream [deleted]`）で、消えたことを確かめた。ゴミ箱も、人間が空にした（人間の報告。私は確かめていない）。

## Step 1：前の確認（2026-10-21、読取りだけ）

詳細は `step2-classification.md` の「Step 1 の結果」。

- **U6 の証拠：** `.artifacts/u6-recipe-runtime/evidence-c10/acceptance-evidence.json`
  - SHA256 `3939063d978c73e390d2bb0a7a25422e9b46f530313363b77225d08f861f7dba`（記録と一致）
  - evidenceId `u6-recipe-runtime-dcf959a1541a-2026-10-19`、19行すべて passed
- **U8 の証拠：** run 39509852083 の `showcase-site-evidence-39509852083-deployed` の `evidence.json`
  - SHA256 `11e9192b843573311c0b6ec1522593a03d007f742ce658f854860a6b32eefba3`
  - evidenceId `835c5175…2f59`、sourceCommit `c8497135`、27行すべて passed
- **利用の記録（S9）：**
  - 2026-10-21T00:24:23Z と 04:12:35Z（削除の直前）に取った。どちらも npm の直近30日が 469件、直近1週間が 154件。
  - JSR の版は `0.1.0`・`0.2.0`・`0.3.0`。
  - GitHub の dependents は page から読めなかった（未検証）。
- **organization の ruleset（S8）：** `admin:org` の権限が無く、私は読めなかった。人間が画面で確かめ、「対象にしていない」と回答した。両 repository の `infra/` の一致は comment だけで、#58 で消した。
- **性能の記録（S10）：** U1 の初期の測定と U3 の正式な経路の測定は、`construction/u1-migration-preflight/` と `construction/u3-install/` の code-summary にある（それぞれの記録の日付のとおり。測り直していない）。
- **検索の範囲（S6）：**
  - formicarium と vivarium は、upstream の全 branch を `git grep` した（読取り）。
  - 他の aletheia-works の repository は `gh search code` だけを使った。結果は0件だったが、index の取りこぼしで、証明にはならない。他の repository の branch は対象外とした。

## Step 2：分類と人間の判断

`step2-classification.md` を参照。人間の回答（2026-10-21、すべて A）：

| 質問 | 回答 |
|---|---|
| Q1 | release の判定から terrarium の consumer の受入を外し、代わりは足さない |
| Q2 | 名前に terrarium がある formicarium 自身の code は、名前を変えて残す |
| Q3 | 移行の道具と固定の証拠は、D7 まで残す |
| Q4 | CHANGELOG の過去の項目を書き換える |
| Q5 | vivarium にも PR を出す |
| Q6 | `codex/*` の2本の branch を、人間が削除する |

Step 3 の途中に出た判断（2026-10-21、すべて A）：

| 判断 | 回答 |
|---|---|
| S-A：release の coverage の固定24件（terrarium の source 7件を含む） | この PR では残す。U9 の後に、formicarium 自身の配布 JS に寄せる別の作業として直す |
| S-C：Safari の診断 | この作業を閉じた後に、AI-DLC の記録と一緒に消す（D7） |
| S-D：退役した質問の記録 | 同上 |
| S-E：移行計画の要約 | 同上 |
| 消した試験1件の扱い | 一般の性質（検査に落ちた入力では envelope・index を作らない）を、artifact の digest の不一致で確かめる試験に直した |

## Step 3：削除と書き換え（PR #58）

developer の記録：`.artifacts/u9-retirement/step3-notes.md`

- **release の判定：**
  - `scripts/release/{decision,types,evidence,collect}.ts` から、`terrarium-*` と `iframe-*` の consumer の受入を外した。iframe の3件も terrarium の metadata を必須にしていたため。iframe の3件を外したままにすることは、人間が 2026-10-21 に確かめた（「外したままでよい」に A と回答。review-01 の指摘の後）。
  - 試験：`tests/release/*` と `tests/tooling/publication-{version,evidence}.test.ts`
  - 文書：`docs/release-assurance.md`・`docs/automated-releases.md`
- **消した file：** `scripts/terrarium/{acceptance,prepare,current-candidate}.ts`、`tests/terrarium/` の7件（`coverage.test.ts` は S-A で残す）、`docs/terrarium-integration.md`
- **消した試験と対象の code の対応（NFR2.2。#58 の前の import で確かめた）：**

  | 消した試験 | 対象の code（一緒に消したもの） |
  |---|---|
  | `tests/terrarium/acceptance.test.ts` | `scripts/terrarium/acceptance.ts` と、`scripts/terrarium/evidence.ts` の `verifyInstalledPackage`・`resultEvidence` |
  | `tests/terrarium/current-candidate.test.ts` | `scripts/terrarium/current-candidate.ts` |
  | `tests/terrarium/assets.test.ts` | `scripts/terrarium/prepare.ts` |
  | `tests/terrarium/adapter.test.ts` | `scripts/terrarium/evidence.ts` の、消した2つの関数 |
  | `tests/terrarium/consumer.spec.ts`・`playwright.config.ts`・`serve.ts` | terrarium の site を配る受入（terrarium の checkout が要る）。対象の code は terrarium の側にある |

  - coverage の分母（固定24件、`scripts/release/inventory.ts` の `FILES`）は変えていない（S-A=A）。消した `scripts/terrarium/*` の3件は、分母に入っていなかった。
- **移す前の path（5件）：** `integration/terrarium/guest-distribution/{fixtures,manifest,resolver}.ts`・`index.d.ts`・`resolver.d.ts` → 同じ名前で `integration/guest-distribution/` に移した。
- **移した file：** `integration/terrarium/guest-distribution/` → `integration/guest-distribution/`（5件）
  - import と一覧も移した先に合わせた：`scripts/guest-distribution/*`、`scripts/release/inventory.ts`、`scripts/ci/release-candidate.ts`、`tests/guest-distribution/*`、`tests/browser-modules.d.ts`
- **移行の道具の参照（Q3）：**
  - `scripts/migration-preflight/assets.ts` の import
  - `tests/migration-preflight/serve.ts` の配信の正規表現
  - `scripts/migration-session/stage.ts` の `sessionSourceInventory`：消した3件を外した
- **文書と comment：** README・AGENTS.md・CHANGELOG（Q4。link はそのまま）・docs・infra の comment・runtime の comment 2件など
- **公開の名前（NFR2.4）：** `types/`・`runtime/public.*`・`exports` から見える名前は変えていない
- **CI の後の修正：**
  - PR の site の build が `candidate-mismatch: 7-fixtures` で失敗した（run 39528183953）。fixture を PR で変えると、main の候補の fixture の inventory と合わなくなるため。
  - showcase の demo の fixture（`showcase/fixtures/biome-basic/app/example.js`）と、その期待値（`showcase/site/tests/accept/site.spec.ts`）の変更を PR から外した。
  - その後 CI は通り、merge された。

## Step 4：手元の確認（main session、1つずつ、2026-10-21）

| コマンド | 結果 |
|---|---|
| `mise run typecheck` | exit 0 |
| `mise run build` | exit 0（tsc と emit。aube は再 build していない） |
| `mise run lint:all` | 最初は Biome の import の並び 1件で失敗した。`biome check --write tests/release/fixtures.ts` で直した後、exit 0 |
| `mise run test:light` | bun 71 pass・37 pass、node 120 件（118 pass・2 skip・0 fail）、node 124 pass。足した試験も実行された |
| `mise run showcase:unit` | 100 pass |
| `mise run showcase-site:unit` | 185 pass |
| `mise run showcase:boundary` | `boundary: no violation` |
| `mise run migration-preflight-unit` | 57 pass |
| `mise run migration-preflight-current-unit` | 21 pass |
| `mise run migration-guest-build-unit` | 9 pass |
| `mise run migration:command-unit`・`migration:install-unit` | 106 pass・1 fail、68 pass・1 fail |

最後の行の失敗は、どちらも `consumer.test.js` である。この試験は、stage した候補を指す環境変数（`FORMICARIUM_CANDIDATE`・`FORMICARIUM_CONSUMER`・`FORMICARIUM_SESSION_GUEST`）が無いと、`tests/migration-session/consumer-input.ts` の最初の確認で必ず失敗する。今回の変更とは関係なく、未検証として残す。

## Step 5：pack の確認

- `npm pack --dry-run --json` の file は 31件。
- `main@upstream` から変わったのは次の3つだけ：`README.md`、`package.json`（`scripts` の `test:integration`・`test:node-unit` だけ）、`runtime/command-parse.js`（`.ts` の comment の1行）。
- 公開 API と動作の変更は無い。`showcase/b1-pack.json` は変えていない。

## Step 6：PR

- **formicarium #58：**
  - 最初の head は `61280b44`（63 file）。fixture を外した後の head は `8e3b30bc`（61 file）で、署名は verified。
  - 人間が merge した（`5735433d`）。merge の後の main の CI は、すべて success。
- **vivarium #548：**
  - head は `29d34dcf`（3 file：`docs/site/{en,ja}/spec/contract-v1.md`、`docs/site/public/spec/recipe.schema.json`）、署名は verified。
  - `CHANGELOG.md` は、vivarium の最新の main に存在しなかったので、変更していない。
  - `docs` の `bun run test:unit` は 205 pass・1 skip・1 fail。失敗した `repro i18n … ships a translation` は、変更の前の main でも同じく失敗した。
  - PR の CI は 17 pass・3 skipping・失敗 0（`gh pr checks 548`、2026-10-21T11:00Z に読取り）。
  - 人間が merge した（`497a200a`）。
- **source-manifest.json について：** formicarium の repository の中の、今ある追跡されている file だけを載せた（49件）。次のものは、この節と Step 3 に書いた。
  - vivarium の3 file
  - #58 で消した file
  - 移す前の path

## Step 7・8：削除の手順書と人による削除

- 手順書：`.artifacts/u9-retirement/deletion-runbook.md`（追跡しない）。merge と CI の成功の後に書き、人間の承認を受けた。

| 手順 | 対象 | 結果 | 確かめた日時（UTC）と方法 |
|---|---|---|---|
| 1 | npm `@aletheia-works/terrarium` | 人間が unpublish した | 09:19:09Z、`npm view` と registry の URL が 404 |
| 2 | JSR `@aletheia-works/terrarium` | 削除できなかった（「Only empty packages can be deleted」）。人間の判断で archive にした。yank はしていない | 09:22:32Z と 09:36:17Z、`meta.json` は 200（3つの版のデータは残る）、`api.jsr.io/packages?query=terrarium` の items は空 |
| 3 | `aletheia-works/terrarium` | 人間が削除した | 04:28:53Z・09:36:17Z、`gh repo view` が見つからない、Pages が 404 |
| 4 | fork `Marukome0743/terrarium`・`JamBalaya56562/terrarium` | 人間が削除した | 同上、`gh repo view` が見つからない |
| 5 | branch `codex/verify/0.2.0-inputs`・`codex/release/rc1-inputs` | 2本とも人間が削除した（`codex/release/rc1-inputs` は2回目で消えた） | 09:36:17Z と 09:53:39Z、`gh api .../branches`、`jj git fetch` |
| 6 | `~/Documents/terrarium` | 人間の依頼（「6も可能なら行って欲しいです」）で、私がゴミ箱（`~/.Trash/`）に移した。完全な削除は、人間がゴミ箱を空にして行った（人間の報告） | 元の場所に無いことを `ls` で確かめた。ゴミ箱の中は権限で一覧できず、未検証 |

- **手順書からのずれ（手順 6）：** 手順書では手順 6 も人間が行うことになっていた。人間の依頼で、私が戻せる操作（ゴミ箱への移動）だけを行い、元に戻せない削除（ゴミ箱を空にする）は人間が行った。
- **実行の順（NFR8.8）：** 記録にあるのは、実行の時刻ではなく、私が確かめた時刻だけである。人間の報告からは、次の順だったと分かる。手順書の順（npm → JSR → repository）とは違い、npm と JSR は後になった。
  - repository・fork・branch：04:28Z の確認より前に、人間が実行した。
  - npm の unpublish と JSR の archive：その後に、人間が実行した（「1と2は家に帰ってからやります」）。
  - 依頼の返答を待つ間に手順 3 以降を進めることは、手順書で認めていた。npm より先に repository を消したのは、人間の都合による。
  - 削除の直前の利用の記録（04:12Z）は、npm の unpublish より数時間前のものである。

- JSR の FAQ（`https://jsr.io/docs/faq`）によると、利用者が版を削除できるのは公開から24時間以内などの場合だけで、package は版が無いときだけ削除できる。運営への削除の依頼は、人間の判断で送っていない。
- 方針の「全削除」からの差：JSR の3つの版は archive の状態で残り、URL を知っていれば取得できる。

## Step 9：後の確認（2026-10-21T09:36Z）

- S7 の確認は、上の表のとおり。jj の remote は、formicarium・vivarium とも `origin`・`upstream` だけ。
- 言及の検索（`jj file list` の `aidlc/` の外を `rg -il terrarium`）：34 file。32 file は人間が後の作業に回すと決めたもの。2 file（showcase の demo の fixture）は、CI の制約（PR で fixture を変えると site の受入が main の候補と合わない）で PR から外したもの。
- 他の aletheia-works の repository：`gh search code terrarium --owner aletheia-works` を 2026-10-21T11:00:28Z にやり直した。結果は0件。formicarium の main には一致があるので、index の取りこぼしで、0件の証明にはならない。
  - Q3 の固定の証拠と移行の道具：`ci/migration-session/`、`docs/results/terrarium-migration-preflight*`、`scripts/migration-*`、`tests/migration-*` の参照、`docs/command-api.md`
  - S-A の release の coverage：`scripts/terrarium/coverage.ts`・`scripts/ci/{run,verification}.ts`・`scripts/release/inventory.ts`・`tests/terrarium/coverage.test.ts`・`tests/ci/verification.test.ts`・`tests/tooling/candidate-inputs.test.ts`・`.github/workflows/ci.yml`・`package.json`・`README.md`・`docs/release-assurance.md`・`scripts/migration-session/stage.ts`
  - S-C〜S-E：`tests/safari/verify.ts`、`docs/results/retired-release-question-20261012.json`、`docs/terrarium-migration-plan-summary.md`
  - showcase の demo の fixture（PR から外した2件）：`showcase/fixtures/biome-basic/app/example.js`、`showcase/site/tests/accept/site.spec.ts`
- `inputs.tar.gz` の検索：`.github/workflows/ci.yml` の `modernization-inputs.tar.gz`（aletheia-works の固定の入力で、個人のものではない）と、`docs/terrarium-migration-plan-summary.md`（S-E）。
- branch：
  - formicarium の upstream の `main` は 34 file、release-please の branch は 35 file。
  - `codex/release/rc1-inputs` は、その後に削除された（09:53:39Z）。
  - vivarium の upstream の `main` は0件。release-please の branch は3件で、release PR の古い branch の内容。

## 置き換えの表

| 元の定め | 置き換え | 根拠 |
|---|---|---|
| FR16：deprecation・archive で退役し、既存の版は削除しない | npm・repository・fork・branch は削除した。JSR は利用者が削除できないので、archive にした | 人間の方針（全削除）と、2026-10-21 の JSR についての人間の判断 |
| 計画の Step 4：`aidlc/` の外の言及が0件 | 34 file が残る。32 file は人間が後の作業に回すと決めたもの、2 file は CI の制約で外した fixture | Q3・S-A・S-C〜S-E と、fixture の CI の制約 |
| 手順書の順（npm → JSR → repository）と、手順 6 を人間が行うこと | repository・fork・branch が先、npm・JSR が後になった。手順 6 は、人間の依頼で私がゴミ箱に移し、人間が空にした | 人間の都合と依頼（Step 7・8 の注） |
| 計画の Summary：vivarium は変えない | 3 file を変えた（PR #548） | Step 1 で upstream の main に4件の言及が見つかり、人間が Q5=A と回答した |

## U9 の外に残すもの

- **S-A：** release の coverage の固定24件を、formicarium 自身の配布 JS に寄せる作業（別の作業）。
- **showcase の demo の fixture：** 文字列の変更は、main で変更して新しい候補を作ってから。PR で fixture を変えると、site の受入が main の候補と合わず失敗するため。
- **D7：** この intent を閉じた後に、別の PR で消す。対象は、AI-DLC の記録・memory・codekb・knowledge・`aidlc/active-memory/`、Q3 の移行の道具と固定の証拠、S-C〜S-E。

## Tests written but not executed

- `consumer.test.js`（migration の command と install）：上の Step 4 のとおり、環境変数が無いと必ず失敗するので未検証。
- probe・aube のブラウザ・移行の受入は、手元では実行していない。site の3ブラウザの受入は、PR #58 の CI と、merge の後の main の CI で通った。
- 実機の Safari：未検証。

## Sources

- `code-generation-plan.md`、`unit-test-instructions.md`、`step2-classification.md`（このディレクトリ）
- `.artifacts/u9-retirement/{mentions.txt,step3-notes.md,deletion-runbook.md,remaining-after.txt}` と、各 log
- `../nfr-requirements/security-requirements.md`、`../nfr-design/security-design.md`
- GitHub の PR #58・#548、run 39528183953、merge の後の main の run（読取り）
