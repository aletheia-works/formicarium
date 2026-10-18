## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-10-18T01:55:00Z
**Iteration:** 2
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u7-showcase-guests/infrastructure-design/cicd-pipeline.md > Triggers and Modes（`mode: distribute` の受付条件） | 条件に「`github.event_name` が `workflow_call`」とあるが、`workflow_call` で呼ばれたworkflowの `github` context は呼出し元のものなので、`github.event_name` は `schedule` か `workflow_dispatch` になり、`workflow_call` にはならない（`github.workflow_ref` も呼出し元のworkflowを指す）。書かれたとおりに実装すると、U8の日次buildからの `distribute` はすべて拒否される。一方、`showcase.yml` を直接 `workflow_dispatch` した場合と、U8経由の呼出しを `event_name` では区別できない。この条件は「PRのrunは配布する候補を作れない」ことを守る唯一の門なのに、成立しない。また「`workflow_dispatch`（main）→ 入力で `verify`（既定）」の行は、`distribute` を選べるのかが書かれておらず、上の条件と矛盾しうる。 | 受付条件を、呼出し先で実際に取れる値で書き直す。例：`github.event_name` ∈ {`schedule`, `workflow_dispatch`}、`github.ref == refs/heads/main`、`github.workflow_ref` がmainのU8のworkflowを指す（`showcase.yml` 自身を指す直接実行は `distribute` を拒否）、PR・pushは拒否。`workflow_dispatch` で `showcase.yml` を直接動かすときの `mode` の可否も表に明記する。 | Resolved (reviewer) |
| R-02 | Major | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u7-showcase-guests/infrastructure-design/cicd-pipeline.md > Stages 2. acquire（再利用元の条件）／infrastructure-specification.md > Actions artifact | 再利用元を「同じworkflow file（`showcase.yml`）、head branch `main`、`pull_request` 以外のevent」のrunに限っているが、U8から `workflow_call` で動いた日次buildのartifactは、呼出し元（U8）のrunに属し、そのrunのworkflow fileはU8のものになる。そのため、日次buildで作られた再利用元はこの条件に一致せず、再利用は `showcase.yml` を直接動かした `push`・`workflow_dispatch` のrunにしか効かない。NFR4.1（180分のsource buildの回避）が日次経路で働くかが設計から言えない。upstream（NFR Design §5）は `schedule`・`workflow_call` を再利用元のeventに含めており、この文書の条件はそれとも食い違う。 | 再利用元を探す条件を、実際に取れるrunの属性に合わせて決める。例：呼出し元のworkflow（`showcase.yml` かmainのU8のworkflow）の一覧、artifactの名前、`head_branch == main`、event、conclusion、保存期限。照合はbuildKeyなどの内容で行うことを維持し、どのworkflow fileのrunを許すかを一覧で固定する。 | Resolved (reviewer) |
| R-03 | Major | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u7-showcase-guests/infrastructure-design/cicd-pipeline.md > Triggers and Modes（`pull_request` のpaths）と Repository Protection（必須checkに `showcase` の受入job） | `pull_request` を `paths` で絞ったworkflowのjobをmainのrulesetの必須checkにすると、そのpathsに触れないPRではworkflowが起動せず、必須checkが「待機中」のまま残ってmergeできなくなる（GitHubの既知の挙動）。現行のformicariumは `ci.yml`・`maintenance.yml` で同じmainに対しPRを受けており、本体だけの変更や依存更新のPRがすべて止まる。 | 必須checkにする場合は、paths条件を外して常に起動し、中で変更範囲を判定して不要な工程をskipとして成功させる別のgate job（名前を固定）を置く。あるいは必須checkにせず、`showcase` の変更を扱うPRだけで必須にする別の方法を選び、どちらかを設計として確定する。skipを成功へ置き換えないというチームの規則とどう両立するかも明記する。 | Resolved (reviewer) |
| R-04 | Major | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u7-showcase-guests/infrastructure-design/cicd-pipeline.md > Repository Protection（Q2=A）／.github/CODEOWNERS（`* @JamBalaya56562`） | mainのrulesetで「CODEOWNERSのレビュー必須」としているが、現状のCODEOWNERSは全pathを1人の `@JamBalaya56562` が持つ。同じ人がPRを作るとレビューを自分で承認できず、bypass actorを書かない限り全PRが止まる。また既存の `maintenance.yml` の `dependency-merge`（CI合格した小さい依存更新の条件付き自動merge、チームのDeployment規則）は、同じrulesetのcode owner review必須とも衝突する。現行terrariumの `infra/github/main.tf` は `require_code_owner_review = false`・承認数0・admin roleのbypassで、設計はこれと異なるのに、差を述べていない。 | rulesetの値を具体に決める：承認数、code owner reviewの要否、bypass actor（誰が、いつ）、`maintenance.yml` の自動mergeと衝突しない形（対象の除外、又は別の保護）。CODEOWNERSの対象一覧は `*` が既に覆うので、より限定したowner（`showcase/**` など）を追加する案も含めて、実効があるレビュー要件になるように書く。 | Resolved (reviewer) |
| R-05 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u7-showcase-guests/infrastructure-design/infrastructure-specification.md > IaC（`infra/github/`）／cicd-pipeline.md > Repository Protection | OpenTofuのstateの保存先（現行terrariumは `backend "local"`）、planとapplyを実行する人と必要なtoken（administration権限）、`required_checks` の名前を既存のformicariumの `ci.yml` などとどう整合させるかが書かれていない。stateがなければ、importしたplanの確認も「前の状態のplanでrollback」も再現できない。 | stateの置き場所（localで十分なら、その理由とstateを失ったときのimport手順）と、必要なtokenの権限、必須checkの名前の一覧と責任を追記する。 | Resolved (reviewer) |
| R-06 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u7-showcase-guests/infrastructure-design/monitoring-design.md > Alerts（runの失敗の通知先）／SLIs / SLOs | 通知先を「scheduleはworkflowを最後に変えた人」としているが、GitHubでは、scheduleのrunの通知はcron構文を最後に変えた人に届く。また、publicなrepositoryでは活動がないと一定期間後にscheduleのworkflowが自動で無効になり、この場合はrunの失敗が起きず通知もない。「前回の配布物が残る」ので、候補が作られない日が続いても気づけない。 | 通知先の説明を実際の挙動に合わせる。無効化と長期の停止は、標準の通知の範囲外であることを残りのリスクとして書くか、権限を増やさない確認（最後の成功runからの日数をjob summaryに出す、手動の点検の頻度など）を足す。 | Resolved (reviewer) |
| R-07 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u7-showcase-guests/infrastructure-design/cicd-pipeline.md > Repository Protection（state） | 「現行terrariumと同じ `backend "local"`」「全資源を `import` block で取り込むのでstateを失っても作り直せる」と書くが、terrariumの `main.tf` が `import` block を持つのはrepository・pages・一部のlabelだけで、rulesetには持たない。rulesetのimportにはAPIで引くidが要り、固定の `import` blockだけでは書けない。terrariumのREADMEは、stateの正本はCIのartifactで定期backupもあると書いており、「同じ手順」ではない。 | 「terrariumと同じ」という表現を直し、rulesetは作成後にidを調べて `import` する手順（又は、stateを失ったときはrulesetを読取りで照合してからimportする手順）を、Code Generationで文書にする旨を明記する。 | New |
| R-08 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u7-showcase-guests/infrastructure-design/monitoring-design.md > Alerts（job summaryの日数）／cicd-pipeline.md > Secrets and Permissions | 「最後に `distributable: true` の候補を作ったrunからの日数」は前のrunとそのartifactを読むので `actions: read` が要るが、cicd-pipelineで `actions: read` を持つのは `acquire` と `catalog` だけで、summaryを書くjobがどれか決まっていない。 | 日数の計算を `acquire` か `catalog` の中で行うと決めて両方の文書に書く。 | New |
| R-09 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u7-showcase-guests/infrastructure-design/cicd-pipeline.md > Rollback（showcaseの変更） | 「前のcommitでworkflowを動かし直して前の候補へ切り戻す」と書くが、`showcase.yml` の直接の `workflow_dispatch` は `verify` だけで `distributable: false` になり、配布できる候補は作れない。 | 切戻しはPRのrevertでmainを戻したうえで、U8の日次経路で配布可能な候補を作り直す、と書き直す。 | New |

> R-01 Reviewer note: 受付条件が、呼出し先で実際に取れる値（入力 `mode`、呼出し元の `github.event_name`・`github.ref`・`github.workflow_ref`）で書き直された。直接の `workflow_dispatch` と `push`・`pull_request` は `mode` の入力を持たず `verify` だけ、と表で明記された。caller側の値を使う点は公式文書に基づく設計で、実workflowでの確認は未検証（文書にもそう書かれている）。

> R-02 Reviewer note: 再利用元を、runのworkflow fileが `trusted-callers.json` の一覧にある・`head_branch` が `main`・eventが `push`/`schedule`/`workflow_dispatch`・conclusionが `success`・artifact名 `showcase-candidate`・保存期限内、と実際に取れる属性で決め、内容（buildKey、ELFのSHA256、source identity、`validateGuest`）での照合も維持している。U8の日次経路でも再利用が働く。

> R-03 Reviewer note: showcaseの受入は必須checkにしない（Q4=A）。必須checkは `ci-required` だけで、実際の `.github/workflows/ci.yml` は `pull_request` に paths の絞りがなく `ci-required` が `if: always()` で常に起動する。待機のまま残る経路はない。

> R-04 Reviewer note: rulesetの値（承認数0、code owner reviewは必須にしない、`RepositoryRole` admin（actor_id 5）の常時bypass、削除・force push禁止、linear history、署名必須、review threadの解決必須）が決まった。terrariumの `infra/github/main.tf` の `github_repository_ruleset.main` と一致する。`maintenance.yml` の `dependency-merge` はsquash mergeで、承認数0・必須checkが `ci-required` だけなので衝突しない。

> R-05 Reviewer note: stateの置き場所（`backend "local"`、commitしない）、失ったときの手順、tokenの権限（administration書込み、対象repoだけ、CIに置かない）、必須check名（`ci-required`）が追記された。stateの再作成手順の書き方に残る小さな齟齬は、新規の指摘として下に挙げる。

> R-06 Reviewer note: scheduleの通知先が「cron構文を最後に変えた人」に直った。scheduleの自動無効化はmonthlyの人間の確認と、最後に配布可能な候補を作ったrunからの日数のjob summaryで補う、と残るリスクが明記された。

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| traceability.json（手作業で `verification.md` の形と照合） | 形は合う（`stage`・`unit`・`upstream_ids`・`coverage[]` の `id`/`status`/`target`）。16件の `NFR` IDはすべて、この Unitの `security-requirements.md` に実在する。 | 構造上の問題なし。 |
| 実repositoryとの照合 | `ci.yml`: `pull_request` にpaths絞りなし、`ci-required` は `if: always()`。`maintenance/policy.json` の `requiredCheckProducers` に `ci-required`。terrariumの `main.tf`: 承認数0、code owner review false、admin always bypass、署名・linear history・thread解決あり。 | R-03・R-04 の修正内容と一致する。 |

### Summary

前回のMajor 4件（`workflow_call` の受付条件、再利用元、必須checkの待機、ruleset）は、実際に取れる値と実repositoryの設定に合う形で直っている。残るのは、OpenTofuのstate再作成の記述、日数summaryの権限、rollbackの手順という、実装で詰められる3件のMinorだけなので、Critical・Majorはなく READY とする。
