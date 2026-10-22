# U8 showcase-site の基盤の仕様

## Sources

`infrastructure-design-questions.md`（Q1=A、Q2=B、Q3=A、2026-10-19）、`../nfr-design/performance-design.md`・`security-design.md`・`logical-components.md`、`../functional-design/functional-spec.md`、`../../../inception/domain-design/components.md`（Showcase の外部依存：Pages hosting）、`../../../inception/contract-design/contract-summary.md`（C09・C10・C11）。NFR Design の review-02（NOT-READY で打ち切り）の残り（Major 1・Minor 3。作業の記録の Open questions）を、人間の回答によりこの工程で扱う。読み取った事実（2026-10-19）：formicarium の `infra/github/{main,versions}.tf`（`integrations/github ~> 6.12`、`github_repository` の `ignore_changes = [pages]`）と `README.md`（token に Pages・Environments の権限なし）、`.github/CODEOWNERS`（`* @JamBalaya56562`）、`gh api repos/aletheia-works/formicarium/pages` が 404（Pages なし）、provider の最新の release は v6.13.0、`actions/deploy-pages` は v5.0.1、`actions/upload-pages-artifact` は v5.0.0。設計で、作成・設定は未実施。

## Deployment

| Facet | Choice | Rationale |
|---|---|---|
| 計算の形 | 静的 site（Astro の static の出力）を GitHub Pages で配る。server・function は無い | FR15。Pages は静的 file だけを配る |
| 配布の先 | `https://aletheia-works.github.io/formicarium/`（Astro の `site` と `base: /formicarium`） | Functional Design の Q1=A |
| 分離 | coi-serviceworker で COOP・COEP を page の側で付ける（Pages は header を付けられない） | NFR6.6 |
| 環境 | GitHub の `github-pages` environment の1つだけ（staging は無い）。PR・push の verify の run は配らず、job の中の一時の HTTPS の server だけで受け入れる | team の Deployment の方針（staging のサービスを前提にしない） |
| IaC | OpenTofu（formicarium の `infra/github`）で Pages と environment を管理する（Q2=B）：`github_repository.this` に `pages { build_type = "workflow" }` を足し、`ignore_changes` から `pages` を外す。`github_repository_environment` で `github-pages` を定義し、deploy は保護された branch（main）だけに限る（`protected_branches = true`）。最初の deploy の承認者（reviewers）を置き、最初の deploy の後に別の PR で外す（NFR Requirements の Q2=A）。apply は既存の terraform-apply の workflow が `FORMICARIUM_INFRA_APPLY_ENABLED` が true のときだけ行う。前提の確認と順序は `cicd-pipeline.md` の「基盤の変更の流れ」 | Q2=B。設定を code と PR の記録に残す |
| provider | `integrations/github` を最新（今は v6.13.0）に上げる（`~> 6.13`） | ユーザーの規則（最新の tool）。今の `~> 6.12` は 6.13.0 を含むが、下限を最新に揃える |
| token | OpenTofu の fine-grained token（`TF_TOKEN_GITHUB`）に Repository permissions の Pages と Environments の Read and write を足す（人が token を作り直し、secret を更新する。`infra/github/README.md` の手順に足す） | Q2=B の必要条件。今の token には無い |
| 承認者 | 最初の deploy の承認者は `JamBalaya56562`（CODEOWNERS の既定の maintainer。user の ID で指定）。他の人にするなら、OpenTofu の PR の承認のときに変える | 承認は書込みの権限のある人が行う（team の Deployment の方針） |
| 日次 | `schedule: cron "17 4 * * *"`（04:17 UTC、13:17 JST）と main からの `workflow_dispatch` | Q3=A |
| runner | GitHub-hosted の `ubuntu-24.04`（U7 の showcase.yml と同じ） | 既存の構成と同じ |
| 大きさ | site 全体 1073741824 bytes 未満（check-site で検査）。U6 で約 112 MB の ELF を含む site を vivarium の Pages に配れた | NFR6.4 |

## Infrastructure Services

| Service | Role | Configuration | Notes |
|---|---|---|---|
| GitHub Pages | cdn | build_type workflow、source は Actions の artifact、custom domain なし、HTTPS は Pages の既定 | 1 file の上限と転送量は Code Generation の最初の deploy の前に公式の文書で確かめ、記録する（未確認） |
| GitHub Actions の artifact | storage（受渡し） | `github-pages`（Pages の artifact、`retention-days: 7`）、`showcase-site-sourcemaps`（1 日）、`showcase-site-evidence-<run_id>` と `-deployed`（90 日）、inventory・lcov（1 日） | 候補の artifact（U7）は U7 の設定のまま |
| GitHub Actions の API | 照会 | 古い run の拒否（deploy-guard）、最後の deploy からの日数（summary）、PR・push のときの候補の run の検索（fetch-candidate）。job の token の actions read | token は job の `GITHUB_TOKEN` だけ |
| npm の registry | 照会（読取り） | guides の npm の導入の手順を出すかの照会（`npm view`） | 書込みはしない |

## Shared Infrastructure

| Shared Resource | Owner Unit | Consumer Units | Access Boundary |
|---|---|---|---|
| `showcase.yml`（workflow_call） | U7 | U8 | U8 は schedule・main の手動のときだけ mode=distribute で呼ぶ。PR・push では呼ばない |
| `showcase-candidate`・`showcase-work-resolve` の artifact | U7 | U8 | 同じ run（distribute）か、main の showcase.yml の最新の成功した run（verify の候補だけ）から読む |
| `showcase/scripts/`（candidate.ts・pack.ts・boundary.ts・tls.ts・paths.ts） | U7 | U8 | U8 は export された関数を import する。boundary.ts とその試験だけに site の規則を足す |
| `infra/github`（OpenTofu） | formicarium（全 Unit） | U8 | U8 は Pages と environment の resource を足す PR を出す。apply は既存の terraform-apply の workflow と人の承認で行う |
| `biome.json`（root） | formicarium | U8 | showcase/site の生成物の dir を対象から外す |

## PR・push のときの候補（Q1=A）

| 入力 | 取得元 | 照合 |
|---|---|---|
| guest・catalog・manifest・受入 log | main の showcase.yml の最新の成功した run（push か workflow_dispatch、main の定義）の `showcase-candidate`（保持期間の指定なし。repository の既定で、値は未確認） | BR1.2 の (1)・(3)・(4)・(5)・(7)。manifest の distributable が false であること |
| formicarium の pack | verify-pack の job が、その run の commit（`github.sha`）から U7 の showcase.yml の resolve と同じ順（install-frozen・build・ci-core・pack.ts verify）で作る | (6) は verify では判定せず、pack の SHA256 と manifest の formicariumPackSha256 の値を log に出すだけ |
| job の出力（candidate-id・distributable） | 無い（showcase.yml を呼ばない） | (2) は verify では行わない |

`showcase-candidate` が見つからない・期限切れのときは fetch-candidate を失敗にし、main で showcase.yml を手動で動かすよう job summary に出す。verify の候補は配布しないので、(2)・(6) を緩めるのは配布の外だけ（NFR Design の review-02 の Major）。詳しい job の構成は `cicd-pipeline.md`。

## Assumptions & Open Questions

None.
