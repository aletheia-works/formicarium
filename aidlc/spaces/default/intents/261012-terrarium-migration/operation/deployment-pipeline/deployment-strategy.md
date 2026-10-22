# 配布の方針

## Sources

`deployment-pipeline-questions.md`（回答）、`cd-config.md`、team.md「Deployment」、GitHub の公式の文書「GitHub Pages limits」（2026-10-22 に読んだ）。

## 方針

- **配布の形**：library（npm）と静的な site（GitHub Pages）。blue/green・canary・rolling のような段階の切替は使わない。切替は版（npm の dist-tag）と main の commit（Pages）で行う。feature flag は入れない（Q5 A）。
- **環境**：staging のサービスは無い（team.md）。公開の前の確認は、PR の CI（`ci-required`・`showcase-site-required` ほかの必須の check）・release candidate の検証・merge の後の手動の受入（`migration-acceptance.yml`）で行う（Q2 A）。

## 昇格の行列

| 段 | 何を確かめるか | 誰が通すか |
|---|---|---|
| PR | lint・typecheck・build・test-light・製品の回帰（node・3ブラウザ）・U1 の preflight と U5 の guest-build の単体・showcase site の受入（関係する変更のとき） | 必須の check（自動）と人の merge |
| main | 同じ CI。showcase site は deploy と verify-deployment | 自動 |
| 受入 | `migration-acceptance.yml`（U2〜U4 の consumer・ブラウザ・completion） | 人が起動する（main の CI の成功の後） |
| release PR | release-please が版と release notes を作る | **人が merge する＝npm への公開の承認**（Q1） |
| RC（必要なときだけ） | `x.y.z-rc.N` を npm の `next` に出す | release PR の merge |
| stable | npm の `latest` | release PR の merge |

## npm の公開の承認（Q1）

- release PR を merge することが、その版を npm に公開する承認である。merge の後、tag と `publish.yml` は人の追加の承認なしに進む（`release` environment に required reviewers は無い）。
- そのため、release PR を merge する前に、版・release notes・CI と受入の結果を確かめる。merge したくない版は merge しない。
- 毎週の自動の merge（`release-merge.yml`）は `WEEKLY_RELEASE_MERGE_ENABLED=false` で止まっている。これを `true` にすると、公開の承認の点が無くなるので、変えるときは人間の判断で、この方針と runbook を直してから行う。

## GitHub Pages の上限と記録（Q4 A'）

| 上限（公式の文書） | formicarium の showcase site | vivarium の docs |
|---|---|---|
| 公開する site は 1 GB まで | build ごとに全体の bytes を確かめ（1073741824 未満）、記録する | build ごとに全体の bytes を確かめ（同じ上限）、記録する |
| 1 file の上限 | 文書に無い。最大の file の path と bytes を build ごとに記録する | 同じく記録する |
| 転送量は月 100 GB の soft limit | 監視しない | 監視しない |
| deploy は10分で timeout | deploy の時間を build ごとに step summary に記録する | 記録しない（deploy の job は1 step だけ） |
| build は1時間に10回の soft limit | 独自の GitHub Actions の workflow なので、かからない | 同じ |

- 変更の後の最初の記録（検証済み、2026-10-22）：
  - formicarium の showcase site（PR aletheia-works/formicarium#69 の merge `1bdd984a`、run 39761271174、success）：人間の承認で取得した artifact `showcase-site-build` の `logs/check-site.json`（`.artifacts/deployment-pipeline/site-build-39761271174/`）は、site 全体 148,507,859 bytes・126 file、最大の file は `guests/biome/2.6.2/biome-linux-x64-musl` の 83,524,512 bytes、problems なし。deploy は log の時刻で `actions/deploy-pages` の開始 10:48:30.37Z から「Reported success!」10:48:43.71Z まで約13.3秒（上限10分）。step summary に書いた `deploy took … ms` の値そのものは、ログインが要る画面のため読んでいない。
  - vivarium の docs（PR aletheia-works/vivarium#562 の merge `8a2649ef`、deploy-docs の run 39760158634、success）：log に「Site: 235607368 bytes, largest file repro/biome/migrate-override-bracket-spacing/guests/baseline/biome 112564936 bytes」。
