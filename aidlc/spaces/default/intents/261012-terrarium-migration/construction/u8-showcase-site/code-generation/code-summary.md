# U8 showcase-site Code Generation の要約

## Step 32：Build and Test の Loop-back 2（Node の版の固定、2026-10-22、人間の指示）

この節が、この file の中で最も新しい。下の節は、それぞれの時点の記録として残す。

- 原因（検証済み）：`.github/workflows/showcase-site.yml` の12か所が `node-version: '26.12.0'` と固定しており、人間の承認で起動した run 39716574987（main `6a90a45b`）のどの job も、最新の Node 26.12.1 ではなく v26.12.0 で動いた（`.artifacts/build-and-test/logs/showcase-site-39716574987.log` の setup-node）。
- 修正（`.github/workflows/showcase-site.yml` だけ）：12か所を、`ci.yml` と U7 の `showcase.yml` と同じ `node-version: 'latest'` と `check-latest: true` の2行にした。ほかの行、試験、基準は変えていない。`showcase/site/tests/unit/workflow.test.ts` は Node の版を確かめていない（`grep` で一致なし）。U7 の修正と同じ jj workspace `.artifacts/ws-biome`（`main@upstream` `6a90a45b` の上、まだ commit していない）。2つの workflow に `26.12` は残っていない。
- 確認（検証済み、1つずつ、Node v26.12.1、`.artifacts/build-and-test/logs/lb2/`）：`mise run lint:all` exit 0、`mise run showcase-site:unit` exit 0（185 pass・0 fail・0 skip）、`mise run showcase:boundary` exit 0、actionlint 1.7.12 で `showcase-site.yml`・`showcase.yml` exit 0。
- 未実施：push と PR、merge の後の `showcase.yml`・`showcase-site.yml` の起動と最新の Node での結果の確認、独立レビュー、intent の検証コマンドでの U8 の checkpoint の確認（Step 33）。

## terrarium の削除（PR #58）の後の確認（2026-10-21、Step 29〜31）

この節が、この file の中で最も新しい。

U8 の Code Generation は、レビューの回数を使い切っていた。そのため、人間の判断（2026-10-21「はい、開き直して良いです。」）で開き直した。土台は upstream の main `5735433d`（PR aletheia-works/formicarium#58 の merge）。

### Step 29：#58 が U8 の file に与えた影響（検証済み）

U8 の `source-manifest.json` の path のうち、#58 が変えたのは次の4つ。どれも U8 の site・workflow・Pages の OpenTofu の振る舞いを変えていない。

- `infra/github/main.tf`：comment の「as in vivarium and terrarium」を「as in vivarium」にしただけ。
- `infra/github/README.md`：terrarium の link を消しただけ。
- `showcase/site/tooling/astro-check/package.json`：`description` の文から terrarium の言及を消しただけ。
- `package.json`：`scripts` の、消した `tests/terrarium/` の試験の glob を直しただけ。

試験の結果（main session で1つずつ、2026-10-21）：

| コマンド | 結果 |
|---|---|
| `mise run showcase-site:unit` | 185 pass・0 fail |
| `mise run showcase:boundary` | `boundary: no violation` |
| `mise run lint:all` | exit 0 |

#58 の merge の後の main の `showcase-site.yml` の push の run 39532777387（`5735433d`）は success だった（`gh run list`、読取り）。showcase の demo の fixture（`Hello, terrarium!`）は、#58 では変えていない（U9 の記録の「U9 の外に残すもの」）。

### Step 30：記録

- `traceability.json`・`source-manifest.json` に、#58 で移した file・消した file を指す行は無かった。
- この節を足した。

## Status

- Step 1–26 はすべて完了。実装は upstream の main に次の PR で取り込み済み（いずれも fork の 1 commit、署名は verified）。
  - #40 `2aca9197`（Pages と `github-pages` environment）
  - #43 `c140ca9a`（site と workflow）
  - #44 `9a35348f`（`!cancelled()` と `showcase-site-required`）
  - #45 `bbbb723f`（Firefox・WebKit の受入の修正）
  - #46 `42676b3a`（必須の check）
  - #48 `6d28dc7c`・#49 `4aad1813`（ruleset への移行）
  - #54 `94970a9e`（配布の契機の変更）
  - #55 `8dd0e4a4`（承認者を外す）
- 最初の配布：main `94970a9e` の push で `showcase-site.yml` run 39422079965 が動いた。JamBalaya56562 が deploy を承認し、全 job が success になった（検証済み、`gh run view`）。
- 公開先：https://aletheia-works.github.io/formicarium/ 。`site-identity.json` は runNumber 23、sourceCommit `94970a9ecd375f7c67b9635a4ca115e4ebcbad70`、candidateId `5e1297ed…80f2`（検証済み、`curl`）。
- About の説明文・website・topics の OpenTofu 管理（#56 `68b71421`）は U8 の計画の外の変更である。人間の依頼で同じ流れで行った（Apply run 39428901074 success）。

## Files created/modified

`source-manifest.json` と同じ範囲。生成物の `showcase/site/.work/`・`dist/`・`node_modules/` は含めない。

- 新規
  - `showcase/site/` の全体：package.json・bun.lock・tsconfig・`astro.config.mjs`・`coverage-denominator.json`
  - `public/`：coi-config.js・favicon
  - `scripts/`：16 file
  - `src/`：model・terminal・i18n・pages・components・content の guides 6ページ（en・ja）・examples
  - `tests/`：unit・accept・coverage・playwright.config
  - `tooling/astro-check/`
  - `.github/workflows/showcase-site.yml`
  - `mise-tasks/showcase-site/{build,unit,accept,coverage}.sh`
  - `showcase/tests/boundary-fixtures/site/`
- 変更
  - `showcase/scripts/boundary.ts`・`showcase/tests/boundary.test.ts`（site の規則）
  - `showcase/scripts/mode.ts`・`showcase/tests/mode.test.ts`（Step 23）
  - `showcase/README.md`
  - `.github/workflows/showcase.yml`（paths に `!showcase/site/**`）
  - `biome.json`・root `package.json`・`.gitignore`
  - `infra/github/{main.tf,versions.tf,.terraform.lock.hcl,README.md}`
- 本体の `runtime/`・`types/` は変えていない（検証済み：各 PR の file 一覧）。

## Key implementation decisions

- **Step 1：** @playwright/test は site の依存に入れず、root の 1.64.1 を使う。二重に入れると読込みが二重になって止まるため。
- **Step 1：** jj の change は `jj new main@upstream qzznrkln` の2親で作った。main@upstream だけから作ると、U8 の記録が disk から消えるため。
- **Step 2：** Biome 2.5.15 は `.astro` の `<script>` と template での使用を見ない。そのため `biome.json` の `showcase/site/**/*.astro` で noUnusedVariables・noUnusedImports を off にした。`.astro` の import の境界は `boundary.ts` で検査する（S1）。この扱いは担当者の判断で、人間の判断の記録は無い。
- **Step 2：** @astrojs/check 0.9.10 の peer は TypeScript 7 に未対応である。そのため `showcase/site/tooling/astro-check`（TypeScript 6.0.3、別の bun.lock）で実行する。
- **Step 12–13：** page を build して試すため、`terminal-host.ts`（Step 14）と `build-site.ts`（Step 18）を先に書いた。notices の範囲は、Expressive Code の package 群と @pagefind/default-ui に広げた（人間が受け入れた、2026-10-19 22:14Z）。
- **Step 16：** coverage の分母に、S2 の一覧の外の 9 file（`addedBeyondS2`）を足した（人間が承認、2026-10-19 22:14Z）。
- **Step 21：** provider 6.13 では `github_repository` の `pages` が非推奨なので、`github_repository_pages` を使い、`ignore_changes = [pages]` を残した。`tofu init -upgrade` が lock の constraints を書き換えなかったので、`~> 6.13` に手で直した（hash は不変）。
- **#44：** `if:` に暗黙の `success()` が付き、祖先の skip で受入まで skip されていた。build の後の job の `if:` に `!cancelled() &&` を付けた。必須の check は workflow ごとに置き、中で判定する形にした（人間の判断）。`changes` job と `showcase-site-required`（`summary.ts --required`）を足し、PR の paths を外した。
- **#46・#48・#49：** provider 6.13.0 の不具合（integrations/github #3420）で、classic の branch protection の更新が 422 になった。人間の判断で、必須の check を画面で足した後に `github_repository_ruleset.main` へ移行した。
- **Step 23（2026-10-20 の人間の判断）：** 日次の schedule をやめた。配布は main への push（site の path）と main の手動の実行だけにした。pack は B1 の Release `b1-a3370ca4df1f`。`mode.ts`（U7 の file）は distribute を `push`・`workflow_dispatch` で受け付け、`schedule` を拒否する。

## Test coverage summary

手元（main session、逐次）：

| 時点 | コマンド | 結果 | 状態 |
|---|---|---|---|
| Step 16（2026-10-19） | merge-coverage（node lcov＋Chromium V8） | 180/180 pass、94.58%（5082/5373 行）、missing: none | 検証済み |
| Step 15（2026-10-19） | Chromium の受入（main の showcase.yml run 39202946079 の候補） | 16 passed（4.0m）。Firefox・WebKit は手元で未実行 | 検証済み（Chromium） |
| Step 17 | `node showcase/scripts/boundary.ts`、`mise run showcase-unit` | `boundary: no violation`、96/96 pass、87.95% | 検証済み |
| Step 18 | `build-site.ts prepare/assemble --mode verify` | 126 files、130954069 bytes | 検証済み |
| Step 20 | Biome・tsc・astro check・actionlint 1.7.12 | エラー 0、astro check 83 files 0 errors、actionlint exit 0 | 検証済み |
| Step 21 | `tofu fmt -check`・`tofu validate`（OpenTofu 1.13.1、provider 6.13.0） | exit 0、Success | 検証済み |
| Step 24（2026-10-20） | `mise run showcase-site:unit` | tests 184・pass 184・fail 0 | 検証済み |
| Step 24 | `mise run showcase:unit`、`node --test showcase/tests/mode.test.ts` | 100/100 pass、6/6 pass | 検証済み |
| Step 24 | `mise run showcase:boundary`、`mise run showcase:typecheck`、`mise run lint:all` | `boundary: no violation`、exit 0、Biome エラー 0（警告 48・info 47 は U8 外の既存）・actionlint・shellcheck 通過 | 検証済み |

CI：

| run | 内容 | 結果 |
|---|---|---|
| 39344102408（PR #43）・39344404560（main） | accept・coverage・evidence が暗黙の `success()` で skipped | success。ただし受入は未実行 |
| 39346628327（PR #44）・39346966574（main） | accept-firefox・accept-webkit の `[ui-states-keyboard]` en・ja が失敗 | failure（#45 で修正） |
| PR #45 の run | changes・3ブラウザの受入・coverage・evidence・summary・showcase-site-required | success（deploy は skipped） |
| 39422079965（main、push、`94970a9e`） | candidate（distribute）→ build → 3ブラウザ → coverage → evidence → deploy → verify-deployment | 全 job success |

run 39422079965 の内訳：
- 受入の時間：accept-chromium 398s、accept-firefox 245s、accept-webkit 246s。
- coverage（artifact `showcase-site-coverage`）：94.51%（5151/5450 行、閾値 80%）、`missing: none`。80% 未満の file は `scripts/inventory.ts` 70.65% の1つで、閾値は全体に掛かる。
- 証拠 `showcase-site-evidence-39422079965-deployed`：artifact digest `sha256:cdf2931f…5d8f`。中の file の SHA256 は次のとおり。
  - `evidence.json`：`45db9db96299d327d9763ff76b71791e168baaa65a7d6382d1a6d53095d463cb`
  - `checks.json`：`2a1af24a941a31839abb0acaa4224b7c71fca0e28cebdad8f0d534135bc371e9`
  - `site-inventory.json`：`49a3c6fbd3ef41c8a37a6a3078f313679ea11f0e94cd95f8f58843af13b51e1e`
- evidence.json の中身：27行すべて `passed`、evidenceId `fa9e45b699540b81353b4474ae5f3957f7e728ae52f169d5c67725578d9295f4`。identity の pack は formicariumPackSha256 `a3370ca4…4046` で、B1 の pack と一致する。formicariumSourceCommit は `2e0358a2`。siteInventorySha256 は `e48966f4…d83a` で、deployedIdentity と一致する。

公開 site の確認（Step 25、2026-10-20、main session、逐次）：

- 方法：`showcase/site/.work/public-check/`（gitignore の一時の spec。repository には入れない）を、Playwright 1.64.1、1 worker、retry なしで実行した。
- 確かめたこと（en・ja のそれぞれで）：
  - `site-identity.json` と4つの page の 200
  - 空の端末が ready になり、状態の文が出る
  - aube・biome・pitchfork の個別の page が ready になる。page・Worker・子 Worker の分離、`ls` の fixture、`--version` の版が1回ずつ出ること、CSP の違反が 0 件
- 結果：Chromium 10 passed（1.2m）、Firefox 10 passed（59.7s）、WebKit 10 passed（59.9s）。

## Traceability

`traceability.json` の各 ID は、実装の file と次の根拠に対応する。

| ID | 根拠 | 状態 |
|---|---|---|
| FR15 | run 39422079965 の配布と、公開の site の3ブラウザ × en・ja の確認 | 検証済み |
| BR1.1–BR1.3、NFR5.1 | `verify-candidate.test.ts`・`fetch-verify-candidate.test.ts`、evidence の `candidate-identity` 行 | 検証済み |
| BR2.1–BR2.4、NFR8.7 | `routes.test.ts`・`cards.test.ts`・`i18n.test.ts`・`guides.test.ts`。公開 page の 200 | 検証済み |
| BR3.1–BR3.8、BR4.1–BR4.2、NFR7.1–NFR7.4 | `terminal-host`・`buffer`・`keys`・`output`・`status` の単体試験、受入の `ui-states-keyboard`・`empty-terminal-install`・`fixture-isolation` 行 | 検証済み |
| BR4.3、NFR6.5 | `routes.test.ts`（文書の page が端末の module を読まない）、`check-site.ts` | 検証済み |
| BR5.1–BR5.4、NFR3.1、NFR4.1、NFR6.4、NFR6.6、NFR6.7 | `catalog`・`fixture-index`・`formicarium-loader`・`inject-csp`・`check-site` の試験、`browser-coi` 行、公開 site の分離と CSP 0 件 | 検証済み |
| BR6.1、NFR8.4、NFR5.3（S7・S15） | `workflow.test.ts`（push と main の手動だけが DIST、deploy の needs と if、権限）、push の run 39422079965・39435971322、main の手動の run 39509852083 | 検証済み（push・main の手動）／未検証（main 以外の手動の実際の run） |
| BR6.2、BR6.3、NFR5.2、NFR8.10 | `deploy-guard.test.ts`・`post-deploy-check.test.ts`、run 39422079965 の verify-deployment success | 検証済み |
| BR6.4 | `workflow.test.ts` の `pages write, id-token write and deploy-pages exist only in the deploy job` | 検証済み |
| NFR8.2 | 最初の deploy の人間の承認、#55 の Apply（`reviewers` の削除、environment の規則は `branch_policy` だけ） | 検証済み |
| BR7.1、NFR6.1–NFR6.3 | 3ブラウザ × 16件の受入（CI）、1 worker・retry なし・180秒 | 検証済み |
| BR7.2、NFR8.1、NFR8.8 | 証拠の2段（`showcase-site-evidence-39422079965` と `-deployed`）、27行 passed | 検証済み |
| NFR2.1–NFR2.3 | `boundary` の検査、lint・型・単体・coverage 94.51% | 検証済み |
| NFR8.3 | `notices.test.ts`、check-site | 検証済み |
| NFR8.5 | guides の maintenance（切戻しの手順。Step 24 で push での再配布に直し、Step 27 で (b) の workflow の無効化を外した） | ドキュメント根拠（実行は未検証） |
| NFR8.6 | `summary.test.ts` の URL の query を落とす試験 | 検証済み |
| NFR8.9 | 2026-10-20 に置き換え（下の表） | 置き換え済み |
| NFR8.11 | `bun install --frozen-lockfile --ignore-scripts`、`bun pm untrusted` 0 件 | 検証済み |

## 置き換えの表

| 元の定め | 置き換え | 根拠 |
|---|---|---|
| BR6.1・S15：配布は schedule（04:17 UTC）と main の `workflow_dispatch` | main への push（`showcase/site/**`・`showcase-site.yml`・`showcase/scripts/**`）と main の `workflow_dispatch`。PR と main 以外の手動は verify | 人間の判断 2026-10-20（「ドキュメントが更新されたらその都度、deploy」「schedule はやめる」）、PR #54 |
| S7：PR・push の run は showcase.yml を呼ばず deploy を持たない | PR と main 以外の手動の run は showcase.yml を呼ばず deploy を持たない。main への push は配布の run（`workflow.test.ts` の該当の試験を直した） | 同上 |
| NFR8.9：distribute の run は最後の deploy から2日以上で失敗 | 失敗にしない。日数は summary に表示だけ。失敗した job と `showcase-site-required` は残る | 同上（日次の run が無いと日数は失敗の兆候にならない） |
| U7 の `mode.ts`：distribute は schedule・`workflow_dispatch` | `push`・`workflow_dispatch`（schedule は拒否） | 同上。U7 の他の file は変えていない |
| Infrastructure Design：必須の check は classic の branch protection | `github_repository_ruleset.main` | provider 6.13.0 の #3420、人間の判断（#48・#49） |
| NFR8.4：main の schedule と `workflow_dispatch` だけが distribute、push は verify | main への push（site の path）と main の `workflow_dispatch` が distribute。PR と main 以外の手動は verify | 人間の判断 2026-10-20、PR #54 |
| NFR8.5 (a)：U8 の変更が原因なら revert の PR を merge し、手動で配布する（push では配布しない） | revert の push が site を配布し直す。その run が失敗したら main で手動の実行 | 同上 |
| NFR8.5 (b)：日次の配布を止め（workflow を無効にし）、tools.json を PR で直す | workflow を無効にしない（必須の check が報告されず PR が merge できない）。PR で直して merge し、main で手動の実行 | review-01 R-01、PR #57 |
| NFR2.3：site の検査は PR・push で verify、schedule・手動で distribute | PR と main 以外の手動で verify、main への push と main の手動で distribute | 人間の判断 2026-10-20、PR #54 |
| NFR8.2：日次で自動に配布し、最初の deploy だけ承認者が承認する | site の変更の push と手動の実行で配布し、最初の deploy の後に承認者を外した（以後は承認なし） | 同上と PR #55 |
| BR1.3：mode は schedule・main の手動の呼出しで distribute | main への push・main の手動の呼出しで distribute（`mode.ts`） | 人間の判断 2026-10-20、PR #54 |
| 計画の Step 20：schedule `17 4 * * *` | Step 23 で置き換え（計画の Step 20 に注を付けた） | 同上 |

## Tests written but not executed in this stage

- Firefox・WebKit の受入を手元で実行していない（certutil・keychain を変えられないため）。CI（PR #45 と run 39422079965）では通っている。
- 実機の Safari：未検証。WebKit の結果では置き換えない。
- NFR8.5 の切戻しの手順（revert の push での再配布）：実際には実行していない。
- 承認なしの deploy（#55 の後）：run 39435971322（push）と 39509852083（手動）で確かめた（下の Step 27・28 の節）。
- `workflow_dispatch`：main の手動は run 39509852083 で確かめた。main 以外の branch の手動が verify で deploy しないことは、実際の run では未実行で、根拠は `workflow.test.ts` の `if:` の評価だけである。
- npm 0.3.0：CI の verify の pack と integrity が違う。そのため guides は npm の導入の手順を出していない（`guides.test.ts` で切替えを検証済み）。

## Deviations from the plan

- Step 1・2・12–13・16・21：上の「Key implementation decisions」のとおり。
- Step 15：Firefox・WebKit の受入を手元で行わず、CI に任せた。
- Step 20：最初の workflow は、受入が暗黙の `success()` で skip される形だった。#44 で直した。
- Step 22：基盤の PR の後、必須の check の追加（#46）で provider の不具合が出た。ruleset への移行（#48・#49）を足した。
- Step 23・24：2026-10-20 の人間の判断で計画に足した Step である（Plan Approval 済み）。
- Step 25：計画は「main から showcase-site.yml を手動で実行」だったが、最初の配布は #54 の merge の push（run 39422079965）で動いた。push の paths に workflow が入るため。
- Step 27・28：review-01（READY、Major 1・Minor 7）の指摘を直すため、人間の判断（2026-10-20「Major・Minor とも全部直す」）で U8 の Code Generation を開き直して足した Step である（Plan Approval 済み）。

## review-01 の指摘の修正（Step 27・28、2026-10-20）

- Step 27（PR aletheia-works/formicarium#57、1 commit・5 files、+67 −18、署名 verified）：
  - R-08：`deploy` の `needs` に `candidate`、`if` に `needs.candidate.result == 'success'` を足した。`workflow.test.ts` に `a distribute run whose candidate did not succeed never deploys` を足した。
  - R-07：`changes` の grep に `showcase/tools.json`・`showcase/fixtures/`・`showcase/b1-pack.json` を足した（PR だけ）。
  - R-01・R-02：guides の maintenance（en・ja）の切戻し (b) と「最初の deploy」の節を直した。
  - R-03：`showcase/README.md` の「未検証のこと」から distribute の実行を外し、run 39422079965 の結果を「確かめたこと」に足した。
  - 手元（main session、逐次）：`mise run showcase-site:unit` 185/185 pass、`mise run showcase:unit` 100/100 pass、`mise run showcase:boundary` `boundary: no violation`、`mise run lint:all` exit 0（Biome のエラー 0）。
  - CI：PR #57 の check は 21 pass・6 skipping。merge は `c8497135`。
  - merge の push の run 39435971322（main、`c8497135`）：全 job が success。deploy は承認を待たずに動いた（`approvals` の API で 0 件。#55 の後の最初の承認なしの deploy）。公開の `site-identity.json` は runNumber 31、sourceCommit `c8497135`。
  - 手動の run 39509852083（2026-10-20、人間の指示で JamBalaya56562 が `gh workflow run showcase-site.yml --ref main` を実行。その後 Marukome0743 に戻した）：
    - event は `workflow_dispatch`、head は `c8497135`。
    - candidate（distribute）・build・3ブラウザ・coverage・evidence・deploy・verify-deployment・showcase-site-required・summary がすべて success だった。fetch-candidate・verify-pack は skipped。
    - 承認は 0 件。公開の `site-identity.json` は runNumber 33、candidateId `d56a9ed9…e182`。
    - candidateId が run 31 の `93b1f8f1…40f3` と違う理由は確かめていない（未検証）。
    - main の手動が distribute になることは、これで実際の run で確かめた。main 以外の branch の手動は、実際の run では未実行。
- Step 28：
  - R-04：`traceability.json` の BR2.1・BR2.3・BR2.4・BR3.5–BR3.8・BR5.2・BR6.3・BR6.4 の target を直し、BR6.1・NFR8.2・NFR8.4・NFR8.5 の detail を直した。
  - R-05：上の Deviations と「Tests written but not executed」に書いた。
  - R-06：上の置き換えの表に NFR8.4・NFR8.5・NFR2.3・NFR8.2・BR1.3 と計画の Step 20 を足した。

## Sources

- `aidlc/spaces/default/intents/261012-terrarium-migration/construction/u8-showcase-site/code-generation/code-generation-plan.md`（承認済みの計画、26 Step）
- `aidlc/spaces/default/intents/261012-terrarium-migration/construction/u8-showcase-site/nfr-design/security-design.md`（S1–S22）
- `aidlc/spaces/default/intents/261012-terrarium-migration/construction/u8-showcase-site/nfr-requirements/security-requirements.md`（NFR2.1–NFR8.11）
- `aidlc/spaces/default/intents/261012-terrarium-migration/construction/u8-showcase-site/functional-design/rules.md`（BR1.1–BR7.2）
- `aidlc/spaces/default/intents/261012-terrarium-migration/inception/requirements-analysis/requirements.md`（FR15）
- GitHub Actions の run 39422079965・39427948343・39428901074 と、PR #40・#43–#46・#48・#49・#54–#56（読取り）
