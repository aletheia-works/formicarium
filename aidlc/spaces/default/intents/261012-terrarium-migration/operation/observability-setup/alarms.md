# 通知（alarm）

新しい通知の仕組みは作らない（Q1 A、Q3 A）。SNS などは使わない。

## Sources

`observability-setup-questions.md`（人間の回答：Q1〜Q5 すべて A、2026-10-22）、monitoring-design（`../../construction/u8-showcase-site/infrastructure-design/monitoring-design.md` と U1・U5・U6・U7 の同じ file）、security-design（`../../construction/u8-showcase-site/nfr-design/security-design.md` の S20）、performance-design（`../../construction/u6-recipe-runtime/nfr-design/performance-design.md`・`../../construction/u8-showcase-site/nfr-design/performance-design.md`）、infrastructure-specification（各 Unit の `infrastructure-design/infrastructure-specification.md`）、reliability-design は無い（どの Unit も作っていない）、`../deployment-execution/health-check-report.md`、`../deployment-pipeline/deployment-strategy.md`。

## 通知の経路

| 条件 | 重さ | 経路 | 対応 |
|---|---|---|---|
| main の workflow の run が failure（push の run） | 注意 | GitHub Actions の標準の通知。push の run は、その run を起こした人（merge した人）に届く | run の log と summary を見て直す。配布済みの site は自動で戻さない（切戻しは `../deployment-pipeline/rollback-runbook.md`） |
| Showcase site の verify-deployment が failure | 注意 | 同上 | 同上 |
| `workflow_dispatch` の run（受入など）が failure | 注意 | 起動した人への標準の通知 | 同上 |
| npm の公開（`publish.yml`）が failure | 注意 | tag を作った run の人への標準の通知 | `../deployment-pipeline/rollback-runbook.md` の 0・1 |

## U8-NFR8.9 の判定（Q3 A）

- 要件（`../../construction/u8-showcase-site/nfr-requirements/security-requirements.md` 50行）：日次の run の失敗を標準の通知で知らせる。各 run の job summary に最後に deploy した run からの日数と失敗した job を出す。schedule の自動の無効化を月1回人が確かめる。
- 今の形：schedule は U8 の #54 で無くなり、配布は main への push と `workflow_dispatch` だけになった。そのため「日次の run」と「月1回の schedule の確認」は当てはまらない。run の失敗は標準の通知（push した人へ）で届く。summary の job は日数と失敗した job を出す（`showcase/site/tests/unit/summary.test.ts` の「job results are read from needs and failed jobs are named」ほか7件、Build and Test の site の単体 185 pass に含まれる。run 39716574987 の summary の log に「最後に deploy した run からの日数: 0日」「失敗した job: なし」）。
- 設計との違い（記録）：(1) schedule の前提は #54 で無くなった。(2) monitoring-design の「配布の停止（日数 2 以上で summary の job を失敗にして通知）」は、今の code と試験（「an old deployment never fails a run: the summary only shows the days」）では、日数を出すだけで失敗にしない。どちらも人間の回答 Q3 A により、今の形で NFR8.9 を満たすと記録する。
- 未検証：標準の通知が実際に届くこと（failure の run を起こしていない）。
