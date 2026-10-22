# 配布の記録

人間の回答（`deployment-execution-questions.md`、2026-10-22）：Q1 A（この段階では npm に公開しない）、Q2 A（読取り・artifact の取得・公開の site での受入。取得は承認済み）、Q3 A（時間帯は決めない）。

## Sources

`../deployment-pipeline/cd-config.md`・`deployment-strategy.md`・`rollback-runbook.md`、`../environment-provisioning/environment-inventory.md`、`../../construction/build-and-test/test-results.md`（build-test-results）、GitHub REST と公開の site の読取り（2026-10-22）。

## 配布先ごとの状態（2026-10-22）

| 配布先 | 配布した commit・版 | 経路と run | 結果 |
|---|---|---|---|
| formicarium の showcase site（`https://aletheia-works.github.io/formicarium/`） | `1bdd984a`（PR #69 の merge。main の最新） | main への push → `showcase-site.yml` run 39761271174（runNumber 58） | success（deploy・verify-deployment）。deploy は約13.3秒（log の時刻） |
| vivarium の docs（`https://aletheia-works.github.io/vivarium/`） | `8a2649ef`（PR #562 の merge） | main への push → `deploy-docs.yml` run 39760158634 | success |
| npm `@aletheia-works/formicarium` | `latest: 0.3.0`（変えていない） | release PR #64（0.4.0）は open | **この段階では公開しない**（Q1 A）。#64 の merge（＝公開の承認）は人間が判断する |
| vivarium の guest の Release | 変えていない（`guest-biome-086287f8…`・`guest-biome-dabb518b…`） | — | — |

- この段階では、新しい配布の操作（merge・workflow の起動・公開）をしていない。配布は main への merge で済んでいたものを確かめた。
- database の migration・依存のサービス・AWS は無い。deploy の時間帯は決めない（Q3 A）。
- 前の段階で見つけた失敗（Build and Test の Not Met・Unverified、U9 の `NFR8.2`）は、この配布の範囲では変わらない。
