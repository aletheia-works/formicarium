# Environment Provisioning の確認

## Sources

- `../../construction/*/infrastructure-design/`（U5・U7・U8 の infrastructure-specification）、`../deployment-pipeline/cd-config.md`。
- GitHub REST の読取り（2026-10-22）：formicarium と vivarium の environment・repository の secret の名前・variable の名前・Pages・ruleset、formicarium の `terraform-plan.yml` の最近の run（39602237414・39528786145 は skipped）。
- formicarium の `infra/github/`（OpenTofu。repository・label・Pages の environment・main の ruleset・release の variable を管理）。

## 今の環境（観測した事実）

この project は AWS を使わない。環境は GitHub（repository の設定・environment・secret・variable・Pages・ruleset）と npm の registry である。VPC・subnet・security group・Secrets Manager は無い。

- formicarium：environment `github-pages`（protected branch だけ）・`production`（規則なし）・`release`（規則なし。`publish.yml` が使う）。secret は `TF_TOKEN_GITHUB` だけ。Pages は workflow で build、https あり。ruleset `main` は有効。
- vivarium：environment `fixed-guest-release`（required reviewers と branch policy）・`github-pages`（custom branch policy）・`production`（規則なし）。secret は `PROJECTS_TOKEN`・`TF_TOKEN_GITHUB`。bump が使う `BOT_CLIENT_ID`・`BOT_PRIVATE_KEY` は repository の一覧に無い（organization の設定にあると見込む。推測）。
- npm の Trusted Publishing の信頼先（npmjs.com の package の設定）は、ログインが要るので読めていない。

## Q1: この段階の範囲

A. AWS の用意はしない。GitHub と npm の環境を、読取りだけで確かめて記録する（environment の一覧と保護、secret と variable の名前と使う workflow、Pages、ruleset、OpenTofu の設定との違い）。secret の値は読まない（推奨）。
B. この段階は対象なしとして記録だけを残す。
X. Other (please specify)

[Answer]: A

## Q2: OpenTofu の設定と実際の状態のずれ

`terraform-plan.yml` の最近の run は skipped で、`infra/github` と GitHub の実際の状態のずれは確かめていません。どう確かめますか？

A. 私が読取りだけで、`infra/github/*.tf` が管理する項目（repository の設定・label・`github-pages` の environment・main の ruleset・release の variable）を GitHub REST の値と突き合わせ、違いを記録する。`terraform-plan.yml` は起動しない（推奨）。
B. 人間の承認で `terraform-plan.yml` を起動し、plan の結果（変更なしか）を確かめる。
X. Other (please specify)

[Answer]: A

## Q3: 規則の無い `production` environment

formicarium と vivarium の両方に、どの workflow も使っていない見込みの `production` environment（保護の規則なし）があります。どうしますか？

A. workflow が使っていないことを確かめて記録し、所見として残す。消すかどうかは後で人間が決める（推奨）。
B. 消す（人間が GitHub の画面で行う）。
X. Other (please specify)

[Answer]: A

## Q4: npm の Trusted Publishing の信頼先

npmjs.com の package の設定（信頼する repository と workflow）は、ログインが要るので私は読めません。どうしますか？

A. 人間が npmjs.com の package の設定を見て、信頼先が `aletheia-works/formicarium` の `publish.yml`（environment `release`）であることを教えてもらい、記録する。
B. 確かめず、未検証として記録する。
X. Other (please specify)

[Answer]: B

## Assumptions & Open Questions

None.

どの選択肢も、設定の変更・workflow の起動・削除の前に、対象と影響を示して人間の承認を受ける。secret の値は読まず、記録にも書かない。
