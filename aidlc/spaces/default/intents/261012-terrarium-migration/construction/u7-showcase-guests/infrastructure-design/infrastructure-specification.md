# showcase候補供給の基盤

## Sources

根拠は次のとおり。
- `../nfr-design/security-design.md`（§1–§11）と `../nfr-design/reviews/review-02.md` のMinor
- `../nfr-requirements/security-requirements.md`、`../nfr-requirements/tech-stack-decisions.md`
- `../../../inception/domain-design/components.md`（Showcase：latestのtool設定・builder・demo fixture・siteの所有、専用CIの受入と配布候補）
- `../../../inception/contract-design/contract-summary.md`（C06・C09・C11・C12）
- formicariumの現状（`.github/CODEOWNERS` は `* @JamBalaya56562`、upstreamのrulesetは2026-10-18に空、Actionsの設定は権限がなく読めなかった）と、現行terrariumの `infra/github/main.tf`
- 人間の回答（`infrastructure-design-questions.md` の Q1–Q4、すべてA）

U7はクラウドの資源を使わず、GitHubのActions・Release・repositoryの設定だけで動く。以下は設計であり、未適用・未検証。

## Deployment

| Facet | Choice | Rationale |
|---|---|---|
| compute model | GitHub-hosted runner（`ubuntu-latest`）の一時的なjob。常駐のserviceはない | 現行terrariumと同じ。新しい常駐serviceを作らない（units-generationの決定） |
| networking | runnerからHTTPSでGitHub API・release資産・upstreamのrepositoryへ出るだけ。受け付ける入口はない | C11の取得の規則。credentialなし、redirectは各hopを検査 |
| storage | 工程間と、U8への候補の受渡しはActions artifact（既定の保存期限）。B1のpackは、formicariumのGitHub Releaseのprerelease資産（Q1=A） | 候補は長期保存しない（NFR5.2）。B1のpackは日次buildが長く使うので、7日のartifactでは足りない |
| environments | `pull_request`・`push`（main）・`workflow_dispatch`・`workflow_call`（U8）の4つの契機。stagingや本番の環境はない。配布はU8が受け持つ | showcaseは候補を作るだけ。配布（Pages）はU8と承認後の既存executor |
| IaC | repositoryの設定（mainのruleset、Actionsの設定）は、formicariumのrepo内のOpenTofu（`infra/github/`）で定義する。適用は人間の承認後（Q2=A） | 現行terrariumの `infra/github/` と同じ道具。terrariumは退役するので、formicariumの設定はformicarium自身が持つ |
| resource sizing | 各jobのtimeoutは、`resolve` 10分、`acquire` 180分、`catalog` 15分、`accept` 60分、`candidate` 10分（初期値、Code Generationで実測して見直す） | NFR4.1。source buildは180分で切る。受入はaube browser 840sの既存の上限より長く取るが、本体の試験の上限は変えない |
| cost | public repositoryのGitHub-hosted runnerとartifact・Releaseの範囲で、新規費用は見込まない。費用が出る場合は事前に相談する | NFR8.2 |

## Infrastructure Services

| Service | Role | Configuration | Notes |
|---|---|---|---|
| GitHub Actions workflow `showcase.yml` | build・受入の実行 | §「CI/CD」は `cicd-pipeline.md`。権限は `contents: read`、再利用と取得のjobだけ `actions: read`（NFR Design Q4=A） | 書込み権限とsecretなし |
| Actions artifact `showcase-candidate` | 候補の受渡し（queueの代わり） | 中身：`manifest.json`（C09＋付加field）、`catalog.json`、guestのELFとbuild-info、受入log、licenseとnotices、`resolutions.json`。全工程の成功後にだけupload | U8は同じworkflowの中で受け取る |
| Actions artifact（中間） | job間の受渡し | `resolutions`、`acquired`、`catalog-pack`、`acceptance-log`。保存期限は1日 | 中間のものは候補ではない |
| GitHub Release（prerelease）`b1-<packSha256の先頭12桁>` | B1のpackの保存先 | 資産：pack（`.tgz`）と、C06の受入証拠（`ApiAcceptance` のJSON）と、その2つのSHA256の一覧。作るのは人間が具体的な対象を承認したときだけ（別のjob、又は手作業）。上書きと削除はしない | showcaseは読むだけ。tagとpackSha256の対応は `showcase/b1-pack.json`（仮）に書き、CODEOWNERSの対象にする |
| GitHub REST API | 最新版の解決、Release・artifactの取得 | workflowの読取り用token。rate limitの失敗は原因を記録して失敗 | retryしない |
| repositoryの設定（OpenTofuで定義） | 保護 | mainのruleset（Q4=A）：PR必須、承認数0、CODEOWNERSのレビューは必須にしない、管理者roleのbypass、削除・force pushの禁止、署名必須、必須checkは既存の `ci-required` だけ（showcaseは必須にしない）。Actions：forkのPRのworkflowは外部の協力者すべてに承認を求める、`GITHUB_TOKEN` の既定権限は読取り。stateは `backend "local"`（repoにcommitしない、失ったら `import` で作り直す）。planとapplyは管理者の人間のtokenで手元で行う | 適用は人間の承認後。providerにActionsの承認の設定がない場合は、画面での手順と、それを確かめる読取りの確認を文書にする（未検証）。詳細は `cicd-pipeline.md` の Repository Protection |
| `showcase/trusted-callers.json`（仮） | 信頼する呼出し元の一覧 | `distribute` を受け付けるU8のworkflow fileと、再利用元に使うworkflow file（`showcase.yml` とU8のworkflow） | 変更はPRで明示し、人間がmerge前に確かめる |

## Shared Infrastructure

| Shared Resource | Owner Unit | Consumer Units | Access Boundary |
|---|---|---|---|
| `showcase.yml` の `workflow_call` | U7 | U8 | U8は `mode`（`verify`／`distribute`）だけを渡し、出力 `candidate-id`・`distributable` と候補のartifactを受け取る。U8はlatestを解決し直さない |
| GitHub Release `b1-*` | U2/U4（B1受入の証拠の所有） | U7（読取り） | 書込みは承認後だけ。U7はpackSha256の照合だけを行う |
| mainのrulesetとCODEOWNERS | formicarium（全Unit） | U7・U8ほか | 必須checkは本体の `ci-required` だけ。CODEOWNERSは通知用（`* @JamBalaya56562`）。showcaseの検査の定義（workflow・scripts・設定・許可一覧・`b1-pack.json`・`trusted-callers.json`）の変更は、PRで明示して人間が確かめる |

## Rollback

`showcase/`、`showcase.yml`、`infra/github/` の追加はPR単位で戻せる。Releaseの `b1-*` は削除しない（C12）。OpenTofuの適用を戻すときは、前の状態のplanを人間が承認して適用する。現行terrariumの最新版ビルドはFR16まで動かしたままにする。

## Assumptions & Open Questions

- formicariumのActionsの現在の設定（forkのPRの承認、tokenの既定権限）は、権限がなく読めていない。OpenTofuのimportの前に、管理者の権限で確かめる。
- GitHubのOpenTofu providerが、forkのPRのworkflowの承認の設定を扱えるかは未確認。
