# Observability Setup の確認

## Sources

- monitoring-design（`../../construction/u1-migration-preflight/infrastructure-design/monitoring-design.md`、U5・U6・U7・U8 の同じ file）、security-design（`../../construction/u8-showcase-site/nfr-design/security-design.md` の S20「失敗の検知（NFR8.9）」ほか）、infrastructure-specification（各 Unit の `infrastructure-design/infrastructure-specification.md`）。performance-design は U6・U8 の `nfr-design/performance-design.md`。reliability-design の file は無い（どの Unit も作っていない）。
- `../deployment-execution/deployment-log.md`・`smoke-test-results.md`・`health-check-report.md`、`../deployment-pipeline/deployment-strategy.md`（site の大きさ・最大の file・deploy の時間の記録）。
- formicarium の upstream main `1bdd984a` の `.github/workflows/showcase-site.yml`（schedule は無い。U8 の #54 で、配布は main への push と `workflow_dispatch` だけになった）。
- Build and Test で後の段階（observability-setup）に回した1件：U8-NFR8.9（失敗の通知と summary、月1回の確認）。

## 今の観測（観測した事実）

- server・常時稼働のサービスは無い（library と静的な site）。CloudWatch・X-Ray・AWS は使わない。
- 観測できるもの：GitHub Actions の run の結果と job の log・job summary・artifact。showcase site の summary の job は「最後に deploy した run からの日数」と「失敗した job」を出す（run 39716574987 の summary の job の log：「最後に deploy した run からの日数: 0日」「失敗した job: なし」）。build の summary は site の大きさ・最大の file を、deploy の job は deploy の時間を出す（PR #69）。公開の site の `site-identity.json`。npm の dist-tags。
- 失敗の通知：GitHub Actions の標準の通知。push の run は、その run を起こした人（push した人）に送られる。
- U8 の設計（NFR8.9、monitoring-design）は「日次の schedule の run」と「schedule が自動で無効になっていないかの月1回の人の確認」を前提にしていたが、今の workflow に schedule は無い。

## Q1: 見る信号

A. 新しい仕組みは作らず、今ある信号を「観測の一覧」として定める（推奨）：main の各 workflow（CI・Showcase guests・Showcase site・deploy-docs ほか）の run の結果、showcase site の summary（最後の deploy からの日数・失敗した job）、site の大きさ・最大の file・deploy の時間、公開の site の `site-identity.json` と main の一致、npm の dist-tags。dashboard は作らず、Actions の画面と job summary を見る。
B. 公開の site を定期的に確かめる workflow（schedule で `site-identity.json` と main の一致、HTTP 200 を確かめ、合わなければ失敗して通知する）を新しく足す（code の変更。PR で承認を受ける）。
X. Other (please specify)

[Answer]: A

## Q2: SLO

A. 数値の SLO は置かない（訪問者向けの新しい目標を置かない、という U8 の NFR Requirements の方針）。記録だけにする（推奨）。
B. 数値の SLO を置く（具体的に書いてください）。
X. Other (please specify)

[Answer]: A

## Q3: U8-NFR8.9 の schedule の前提

U8 の設計の「日次の run」と「月1回の schedule の確認」は、schedule が無くなったので、そのままでは当てはまりません。どうしますか？

A. 今の形で NFR8.9 を満たすと記録する：run の失敗は GitHub の標準の通知（push した人へ）、各 run の summary に最後の deploy からの日数と失敗した job、schedule が無いので「月1回の schedule の確認」は不要。設計との違いは、U8 の #54 の決定によるものとして記録する（推奨）。
B. schedule の run を戻し、設計どおりの日次の確認と月1回の確認を行う（code の変更。PR で承認を受ける）。
X. Other (please specify)

[Answer]: A

## Q4: log と artifact の保持

A. 今の設定のままにする：Actions の log と artifact の保持は repository の既定と、各 workflow が指定する日数（infrastructure-specification の表。例：deployed の evidence は90日、受入の artifact は7日）（推奨）。
B. 保持の日数を変える（具体的に書いてください）。
X. Other (please specify)

[Answer]: A

## Q5: 分散の tracing と異常の検知

A. 入れない。server が無く、tracing の対象が無い。異常は run の失敗と summary で気づく（推奨）。
B. 入れる（具体的に書いてください）。
X. Other (please specify)

[Answer]: A

## Assumptions & Open Questions

None.

code・設定の変更、workflow の起動の前に、差分と対象を示して人間の承認を受ける。
