# Deployment Execution の確認

## Sources

- `../deployment-pipeline/cd-config.md`・`deployment-strategy.md`・`rollback-runbook.md`、`../environment-provisioning/environment-inventory.md`、`../../construction/build-and-test/build-and-test-summary.md`・`test-results.md`。
- 読取り（2026-10-22）：`https://aletheia-works.github.io/formicarium/site-identity.json`（sourceCommit `1bdd984a…`、runNumber 58）、open の PR（release PR aletheia-works/formicarium#64「chore(main): release 0.4.0」、label `autorelease: pending`。前の #41 は closed）、npm の dist-tags（`latest: 0.3.0`）。
- Build and Test で後の段階（deployment-execution）に回した3件：U6-W5（公開 site での受入）、U8-NFR8.1b（今の source を配布した run の証拠）、U8-NFR8.10（deploy の後の `site-identity.json` の確認）。

## 今の配布の状態（観測した事実）

- formicarium の showcase site：main への merge のたびに `showcase-site.yml` が deploy する。今の公開の site の `site-identity.json` の sourceCommit は `1bdd984a`（#69 の merge）で、run 39761271174 の verify-deployment は success。
- vivarium の docs：main への merge のたびに `deploy-docs.yml` が deploy する（run 39760158634、`8a2649ef`、success）。
- npm：`latest` は 0.3.0。release PR #64（0.4.0）が open。merge すると tag ができ、`publish.yml` が人の追加の承認なしに公開する（公開の承認は merge。`../deployment-pipeline/deployment-strategy.md`）。
- AWS・database の migration・依存のサービス・常時稼働のサーバーは無い。

## Q1: npm の 0.4.0 の公開

A. この段階では公開しない。release PR #64 の merge（＝公開の承認）は人間が判断して行う。この段階の記録には「未公開、#64 は open」と書く（推奨）。
B. 人間が今 #64 を merge し、`publish.yml` の公開と registry の照合を、この段階で確かめて記録する。
X. Other (please specify)

[Answer]: A

## Q2: 公開の site の smoke test と後の段階の3件

A. 読取りと public の site への browser の受入で確かめる（推奨）：(1) formicarium の公開の site の `site-identity.json` が main の最新の commit と一致すること（U8-NFR8.10）。(2) 人間の承認で run 39761271174 の artifact `showcase-site-evidence-39761271174-deployed`（23.5 KB）を取得し、全行 passed と sourceCommit を確かめる（U8-NFR8.1b）。(3) vivarium の公開の page で、U6 の受入の script（`.artifacts/u6-recipe-runtime/acceptance/pages-acceptance.mjs`）を Chromium・Firefox・WebKit で1つずつ実行する（U6-W5。network と browser、1回あたり数分）。
B. (1) だけを行い、(2)(3) は未検証として残す。
X. Other (please specify)

[Answer]: A

## Q3: deploy の時間帯

A. 決めない。静的な site と library で、利用者への停止は無い（推奨）。
B. 決める（具体的に書いてください）。
X. Other (please specify)

[Answer]: A

## Assumptions & Open Questions

None.

公開・merge・artifact の取得・workflow の起動の前に、対象を示して人間の承認を受ける。
