# CD の構成

人間の回答（`deployment-pipeline-questions.md`、2026-10-22）：Q1 は訂正の後に「release PR の merge を公開の承認とし、runbook にそう明記する」、Q2 A、Q3 A、Q4 は訂正の後に A'（build ごとに全体・最大の file・deploy の時間を記録）、Q5 A。

## Sources

- `deployment-pipeline-questions.md`（訂正1・2を含む）。
- `../../construction/ci-pipeline/ci-config.md`・`quality-gates.md`、`../../construction/*/infrastructure-design/`。
- formicarium の upstream main `e0842371` の `.github/workflows/release.yml`・`release-merge.yml`・`release-candidate.yml`・`publish.yml`・`showcase-site.yml`、`.github/release-please-config.json`、`infra/github/release.tf`・`main.tf`。
- vivarium の upstream main `952e94f8` の `.github/workflows/deploy-docs.yml`・`fixed-guest-release.yml`、`docs/scripts/stage-formicarium-assets.ts`。
- GitHub の公式の文書「GitHub Pages limits」（2026-10-22 に読んだ）。GitHub REST の environment・variable の読取り、npm の dist-tags の読取り（2026-10-22）。

## 配布先と経路

| 配布先 | 経路 | 人の承認の点 | 公開の後の確認 |
|---|---|---|---|
| npm `@aletheia-works/formicarium` | main への push → `release.yml`（release-please が release PR を作る・更新する。`RELEASE_AUTOMATION_ENABLED=true`）→ **人が release PR を merge**（`WEEKLY_RELEASE_MERGE_ENABLED=false` なので自動の merge はない）→ `v*` の tag → `publish.yml`（merge 済みの release PR と CI の成功を確かめ、environment `release` で Trusted Publishing、`--provenance`） | release PR の merge（＝公開の承認） | `publish.yml` の後の job（registry の integrity の照合） |
| GitHub Release（formicarium の pack・B1 の pack） | 人間が承認した操作で作る（例：`b1-a3370ca4df1f`） | 作る前の承認 | SHA256 の照合 |
| GitHub Pages（showcase site） | main への push → `showcase-site.yml`（candidate・build・3ブラウザの受入・coverage・evidence の後に deploy、verify-deployment） | main への merge（PR の必須の check が通ったもの） | verify-deployment（`site-identity.json` の一致） |
| vivarium の guest の Release | `fixed-guest-build.yml` → `fixed-guest-release.yml`（environment `fixed-guest-release` の required reviewers の承認） | environment の承認 | builder の `verifyArtifactSet` |
| vivarium の docs（GitHub Pages） | main への push → `deploy-docs.yml`（build・staging・check-site の後に deploy） | main への merge | なし（check-site は deploy の前） |

## この段階の変更（Q4 A'）

- formicarium（PR aletheia-works/formicarium#69、head `d9e03e77`、1 commit・4 file、署名あり、merge `1bdd984a`）：
  - `showcase/site/scripts/check-site.ts`：`SiteCheckResult` に `largest`（最大の file の path と bytes）を足した。build の記録（`.work/logs/check-site.json`）に入る。
  - `showcase/site/scripts/build-site.ts`：build の summary に最大の file を書く。
  - `.github/workflows/showcase-site.yml`：deploy の job の `actions/deploy-pages` の前と後に時刻を取り、`deploy took <ms> ms` を step summary に書く（GitHub Pages の deploy は10分で timeout）。
  - `showcase/site/tests/unit/check-site.test.ts`：最大の file が報告されることを確かめる。
  - 確認（jj workspace `.artifacts/ws-biome`、main `e0842371` の上、Node 26.12.1、1つずつ）：actionlint exit 0、`mise run lint:all` exit 0、`mise run showcase-site:unit` 185 pass・0 fail、`mise run showcase:boundary` exit 0。
- vivarium（PR aletheia-works/vivarium#562、head `4d03cdd9`、1 commit・2 file、署名あり、merge `8a2649ef`）：
  - `docs/scripts/stage-formicarium-assets.ts`：`SiteReport` に `largest` を足し、step summary と log に書く。
  - `docs/scripts/__tests__/stageFormicariumAssets.test.ts`：最大の file が報告されることを確かめる。
  - 確認（vivarium main `952e94f8` の上）：`mise run ci:docs-unit` 208 pass・1 skip（tarball を渡さないときの既存の skip）・0 fail、`mise run docs:check` exit 0。

## 変えないもの

- `release` environment（required reviewers は付けない。Q1）。
- release-please の設定、`publish.yml`、必須の check、ruleset、OpenTofu。
- site の大きさの基準（1 GB 未満）。1 file の基準は足さない（公式の文書に無い）。
- feature flag は入れない（Q5）。
