# 健康の確認の報告

## Sources

`smoke-test-results.md`、`deployment-log.md`、`../environment-provisioning/validation-report.md`、`../deployment-pipeline/deployment-strategy.md`、GitHub REST と公開の site の読取り（2026-10-22）。

## 確認

| 対象 | 確認 | 結果 |
|---|---|---|
| formicarium の showcase site | `site-identity.json` が main の最新（`1bdd984a`）と一致。run 39761271174 の verify-deployment が success。deployed の evidence 27 checks passed。site 全体 148,507,859 bytes（上限 1 GB）、最大の file 83,524,512 bytes | 健康 |
| vivarium の docs | deploy-docs の run 39760158634 が success。site 全体 235,607,368 bytes、最大の file 112,564,936 bytes。公開の recipe の page で3ブラウザ12行 passed | 健康 |
| npm | `latest: 0.3.0`・`next: 0.1.0-rc.1` を読めた。0.4.0 は未公開（release PR #64 は open） | 変化なし |

## 残る所見（この段階で直さない）

- npm の Trusted Publishing の信頼先は未検証（Environment Provisioning の Q4 B）。
- 使っていない `production` environment（formicarium・vivarium）。
- 実機の Safari は未検証。
- Build and Test の残る失敗（U5-NFR8.3、U9 の5件、TC-1、U5-NFR2.2）と、追跡の確認の U9 `NFR8.2`。Deployment Pipeline で答えた4件（U6-NFR6.4・8.5、U8-NFR6.4b・8.5）と、この段階で確かめた3件（U6-W5・U8-NFR8.1b・U8-NFR8.10）は、目標の一覧の上では Build and Test の判定のまま（`Unverified`）で、それぞれの段階の記録に答えがある。
