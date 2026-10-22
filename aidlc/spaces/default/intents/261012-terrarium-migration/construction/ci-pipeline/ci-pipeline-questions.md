# CI Pipeline の確認

## Sources

- `../build-and-test/build-and-test-summary.md`（CI の義務の7件：CI-1、U4-NFR8.1b、U5-D7-AUTO、U6-NFR2.2、U7-NFR2.2b、U7-NFR6.1、U8-NFR2.3。Owning Stage は ci-pipeline）、`../build-and-test/test-results.md`、`../build-and-test/cross-unit-traceability.md`。
- formicarium の upstream main `f7b70cac` の `.github/workflows/`（`ci.yml`・`migration-acceptance.yml`・`showcase.yml`・`showcase-site.yml` ほか）と `infra/github/main.tf`（main の ruleset、60行）。
- org.md「Way of Working」（trunk-based、短命の作業 branch、squash merge）、team.md「Way of Working」「Testing Posture」「Deployment」。

## 今の CI（観測した事実）

- 道具：GitHub Actions（formicarium と vivarium）。
- branch：main に統合する。PR は squash merge。main の ruleset の必須の check は `quality`・`commit-format`・`ci-required`・`check / Commitlint`・`showcase-site-required` の5つ（`infra/github/main.tf` 60行）。
- PR の CI（`ci.yml`、`pull_request` と main への `push`）：`quality` で lint・typecheck・build・`test-light`、`ci-required` までに probe・wasm・guests の build と Product（node・chromium・firefox・webkit）の試験。どの job も Node `latest`。
- PR の CI で動かないもの：intent の検証コマンドの一部（`migration-preflight-unit`・`migration-preflight-current-unit`・`migration-guest-build-unit`）。U2〜U4 の consumer の試験と completion は、main の CI の成果物が要るので `migration-acceptance.yml`（手動の `workflow_dispatch`）でだけ動く。
- `showcase.yml`・`showcase-site.yml` は関係する path の変更と main への push で動く。`showcase-site-required` は必須。

## Q1: PR の CI に足す試験

intent の検証コマンドのうち、PR の CI で動いていない `migration-preflight-unit`・`migration-preflight-current-unit`・`migration-guest-build-unit` を、merge の前に動かしますか？（CI-1「選んだ試験を merge の前に CI で実行」）

A. `ci.yml` に、この3つを1つずつ実行する job を足し、`ci-required` がその成功を要るようにする。必須の check の名前は変えないので、ruleset の変更は要らない（推奨）。
B. 今のままにし、CI-1 のこの部分を「手元の検証コマンドでだけ確かめる」として記録する。
X. Other (please specify)

[Answer]: A

## Q2: U2〜U4 の受入（`migration-acceptance.yml`）

U2〜U4 の consumer の試験と completion は、main の CI が作った候補と guest の artifact を使うので、PR の上では動かせません。どう扱いますか？

A. 今の設計のまま、main の CI が成功した後に人間が手動で起動する。受入の結果は Release の前の確認として記録する（推奨）。
B. main の CI の成功の後に自動で起動する（`workflow_run`）ように変える。起動のたびに Actions の時間（約40分）がかかる。
X. Other (please specify)

[Answer]: A

## Q3: vivarium 側の CI の義務

U5-D7-AUTO（bump の PR は必須の check が通ったら自動で merge）と U6-NFR2.2（第一者 TS の行 coverage 80%以上を PR の CI で確かめる）は、vivarium の CI の持ち分です。どう確かめますか？

A. vivarium の今の workflow と、main の最新の run を読取りだけで確かめ、結果を記録する。足りなければ、差分を示して vivarium に PR を作る（推奨）。
B. この段階では vivarium を扱わず、所見として残す。
X. Other (please specify)

[Answer]: A

## Q4: 成果物の置き場

新しい成果物の置き場を作りますか？

A. 作らない。npm（`@aletheia-works/formicarium`、Trusted Publishing）・GitHub Release（formicarium の pack、vivarium の guest）・GitHub Pages（showcase site）・Actions の artifact という今の置き場を使う（推奨）。
B. 新しい置き場を足す（具体的に書いてください）。
X. Other (please specify)

[Answer]: A

## Q5: Construction から Operation への境界の確認

この段階の最後に、Construction → Operation の確認があります。stage の決まりでは、追跡の確認が Fail で未解決の所見が残っていると、Operation へ進めず、持ち主の段階に戻ります。今は、U1 の `GAP` 2行・U3 の `GAP` 7行（正式受入が `local-provisional` のまま）・U9 の `Deferred` 1行で Fail です。どうしますか？

A. 境界の確認を Fail のまま記録し、持ち主の段階（U1・U3・U9 の Code Generation）に戻って、各行の状態を直すか、直せない理由を決める（推奨）。
B. 境界の確認を Fail のまま記録し、人間の判断として Operation に進む理由を書く。
X. Other (please specify)

[Answer]: A

## Assumptions & Open Questions

None.

どの選択肢も、push・PR・workflow の起動・ruleset の適用の前に、差分と対象を示して人間の承認を受ける。新しい費用は前に相談する。
