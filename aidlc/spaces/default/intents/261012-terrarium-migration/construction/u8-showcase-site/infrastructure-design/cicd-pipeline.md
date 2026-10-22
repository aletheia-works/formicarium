# U8 showcase-site の CI/CD

## Sources

`infrastructure-design-questions.md`（Q1=A、Q2=B、Q3=A）、`infrastructure-specification.md`、`monitoring-design.md`、`../nfr-design/security-design.md`（S1〜S22）・`performance-design.md`（P1〜P5）・`logical-components.md`、`../nfr-requirements/security-requirements.md`、`../functional-design/functional-spec.md`（W1〜W3）、`../../../inception/contract-design/contract-summary.md`（C09・C10）。NFR Design の review-02 の残り（Major 1・Minor 3）のうち、Major（PR・push の候補）と Minor 2つ（build の配置と SKIPPED、build の needs と if）はこの文書で扱う。残りの1つ（performance-design の P3 の表示の buffer を最初の LF の直後で切ると、長い1行で buffer のほぼ全体が捨てられる件）は page の設計なので、Code Generation の `buffer.ts` とその単体試験で扱う（LF までが 4096 bytes を超えるなら LF を待たずに文字境界と escape 列の終わりで切る。作業の記録の Open questions の案）。この stage の review-01（NOT-READY、Major 4・Minor 5）を反映した。

読み取った事実（2026-10-19）：`.github/workflows/showcase.yml`（`workflow_call` の入力 `mode`、出力 `candidate-id`・`distributable`、top-level の権限は contents read で、acquire・catalog・candidate の job が `actions: read` を要る、concurrency の group `showcase-${{ github.event_name }}-${{ github.event.pull_request.number || github.run_id }}`、resolve の job の verify の pack は bun 1.4.3 の準備・`node scripts/ci/tasks.ts install-frozen`・`node scripts/ci/tasks.ts build`・`node scripts/migration-session/ci-core.js ci/migration-session/inputs.bundle.json`・`node showcase/scripts/pack.ts verify`（`SHOWCASE_SOURCE_COMMIT: github.sha`）の順、work の artifact の保持 1 日）、`showcase/trusted-callers.json`（`distributeCaller` は `.github/workflows/showcase-site.yml`）、`.github/workflows/terraform-apply.yml`（main への push で、`vars.FORMICARIUM_INFRA_APPLY_ENABLED == 'true'` のときだけ apply）・`terraform-plan.yml`・`dependency-review.yml`、`infra/github/.terraform.lock.hcl`（commit 済み）。repository の変数 `FORMICARIUM_INFRA_APPLY_ENABLED` の値と、Actions の artifact の既定の保持期間は、main session の account の権限では読めなかった（403。未確認）。設計で、workflow は未作成。

## NFR Design との関係（置き換え）

この文書は、凍結した NFR Design の次の箇所を置き換える（Code Generation はこの文書に従う。review-01 R-08）。

| NFR Design・Functional Design の箇所 | 置き換える節 | 新しい内容 |
|---|---|---|
| security-design の S15 の fetch-candidate（`showcase-candidate` と `showcase-work-resolve` を取る） | 「PR・push の候補」 | `showcase-candidate` だけを取り、pack は verify-pack の job が PR の commit から作る |
| security-design の S3 の工程 2・3（pack の取得と展開） | 「build の工程」 | distribute は同じ run の `showcase-work-resolve`、verify は verify-pack の artifact |
| security-design の S15（mode は showcase-site.yml の最初の step で決める） | 「mode の決め方」 | job の `if` の式で決める |
| security-design の S15・S20（summary は日数が2以上で失敗） | 「summary」 | distribute の run で、deploy が成功した run があるときだけ失敗にする |
| functional-spec の W1 手順1（PR・push も showcase.yml を呼ぶ） | 「起動と mode」 | 呼ばない |

## 起動と mode

mode は job の `if` の式で決める（step の出力を使わない。review-01 R-02）。

```text
DIST = (github.event_name == 'schedule' || github.event_name == 'workflow_dispatch')
       && github.ref == 'refs/heads/main'
```

| 契機 | DIST | mode | 候補と pack | 配布 |
|---|---|---|---|---|
| `schedule`（`17 4 * * *`、04:17 UTC） | true | distribute | candidate の job が showcase.yml を `mode: distribute` で呼ぶ。pack は同じ run の `showcase-work-resolve` | すべての job が成功したとき |
| `workflow_dispatch`（main） | true | distribute | 同上 | 同上 |
| `workflow_dispatch`（main 以外） | false | verify | fetch-candidate と verify-pack | しない |
| `pull_request`（下の paths） | false | verify | 同上 | しない |
| `push`（main、下の paths） | false | verify | 同上 | しない |

pull_request と push の paths：`showcase/site/**`、`.github/workflows/showcase-site.yml`、`showcase/scripts/**`。U7 の mode.ts は、呼ばれた showcase.yml の中で入力を検証する。

## 工程（job の順と gate）

```text
candidate (DIST) ───────────────────────┐
fetch-candidate (!DIST) ─┐              ├─> build ─> accept-chromium ─┐
verify-pack (!DIST) ─────┴──────────────┘          ─> accept-firefox  ─┼─> coverage ─> evidence ─> deploy (DIST) ─> verify-deployment
                                                   ─> accept-webkit   ─┘
summary (always)
```

<!-- Text fallback: distribute のときは candidate、verify のときは fetch-candidate と verify-pack が動き、その後に build。build の後に accept の3つが並び、その後に coverage と evidence。distribute のときだけ deploy と verify-deployment が続く。summary は常に最後に動く。 -->

| job | needs | if | 権限 | timeout | gate（失敗で止まる条件） |
|---|---|---|---|---|---|
| candidate | — | DIST | contents read・actions read（呼ばれた showcase.yml の job の最大の要求。review-01 R-03） | showcase.yml のとおり | U7 の全工程。出力 distributable が true でなければ build で失敗 |
| fetch-candidate | — | !DIST | contents read・actions read | 10 分 | 下の「PR・push の候補」 |
| verify-pack | — | !DIST | contents read | 30 分 | 下の「PR・push の候補」の pack の工程 |
| build | candidate, fetch-candidate, verify-pack | `!cancelled() && ((needs.candidate.result == 'success') \|\| (needs.fetch-candidate.result == 'success' && needs.verify-pack.result == 'success'))` | contents read | 30 分 | 下の「build の工程」のどれか |
| accept-chromium・accept-firefox・accept-webkit | build | build の成功 | contents read | 60 分 | P1 の16件のどれか、CSP の違反、inventory の不一致 |
| coverage | build, accept-chromium | accept の3つの成功 | contents read | 15 分 | 80% 未満、分母の file の欠落 |
| evidence | build, accept-*, coverage | すべての成功 | contents read | 10 分 | 必須の行の欠落・重複・failed・unverified |
| deploy | evidence | DIST かつ上のすべての成功 | contents read・pages write・id-token write・actions read | 15 分 | 承認（最初だけ）、deploy-guard、inventory の再計算、deploy-pages |
| verify-deployment | deploy | deploy の成功 | contents read | 15 分 | 10分で identity が一致しない |
| summary | すべて | `always()` | contents read・actions read | 5 分 | 下の「summary」 |

workflow の YAML を読む単体試験で確かめる：event（schedule・main の手動・main 以外の手動・pull_request・push）ごとに動く job と skipped の job の組（build 以降が skipped にならないこと）、deploy が DIST と全成功の条件だけで動くこと、pages write と deploy-pages が deploy の job だけにあること、candidate の権限が showcase.yml の job の要求（actions read）を含むこと、verify の run で summary が日数だけでは失敗しないこと。

## PR・push の候補（Q1=A。NFR Design の残りの Major）

- fetch-candidate：Actions の API で、main の showcase.yml の run のうち、event が push か workflow_dispatch で、conclusion が success の最新の run を探し、`showcase-candidate`（manifest・site/・acceptance-log.json・resolutions.json）を取る。日次の distribute の候補（showcase-site.yml の run の中にあり、distributable が true）は使わない（verify の候補は「distributable が false」の照合を通るものだけにし、配布の候補を検証の入力に混ぜない。review-01 R-05）。
- 候補が古くなること：showcase.yml の paths から `showcase/site/**` を外すので、showcase.yml の直接の run は U7・本体の変更のときだけ起きる。対象の run が無い・artifact が期限切れのときは fetch-candidate を失敗にし、job summary に「main で showcase.yml を手動で実行する」と出す。この復旧の手順を maintenance の guide に書く。artifact の既定の保持期間は未確認で、Code Generation の前に人が repository の設定の画面で確かめて記録する（review-01 R-05）。
- verify-pack：showcase.yml の resolve の verify と同じ順で、bun（root の `packageManager` の版）の準備 → `node scripts/ci/tasks.ts install-frozen` → `node scripts/ci/tasks.ts build` → `node scripts/migration-session/ci-core.js ci/migration-session/inputs.bundle.json` → `node showcase/scripts/pack.ts verify`。`SHOWCASE_SOURCE_COMMIT` は `github.sha`（pull_request では merge の commit。その commit の pack を作る）。pack を artifact `showcase-site-verify-pack`（保持 1 日）に上げる。timeout 30 分（U7 の resolve の job の 10 分の工程に、install と build を含めた上限。超えたら失敗で、上げるときは計測を示して人の承認を受ける）。
- 照合：BR1.2 の (1)・(3)・(4)・(5)・(7) を行い、manifest の distributable が false であることを確かめる。(2) と (6) は verify では判定せず、(6) の pack の SHA256 と manifest の formicariumPackSha256 の値を log に出すだけにする（review-01 R-06）。verify の候補は配布しないので、緩めるのは配布の外だけ。

## build の工程

1. checkout、mise の tool の準備。
2. 候補と pack の取得：distribute は同じ run の `showcase-candidate`・`showcase-work-resolve`、verify は fetch-candidate と verify-pack の artifact。
3. verify-candidate（distribute は BR1.2 の7項目、verify は上の5項目と log）。
4. pack の照合と `showcase/site/node_modules/@aletheia-works/formicarium` への展開（型の解決にも使う）。
5. `bun install --frozen-lockfile --ignore-scripts`。
6. Biome、boundary.ts（site の規則と、SKIPPED に `showcase/site/dist`・`showcase/site/.astro`・`showcase/site/node_modules`）、tsc、astro check、node の単体試験（lcov）、workflow の YAML の試験。
7. build-fixture-index（`demo-fixtures/`）。
8. 配置：pack の file を `public/_formicarium/<version>/` へ、候補の `site/`（`catalog.json` と `guests/`）を `public/` の root へ、coi-serviceworker.js と coi-config.js を `public/` の root へ、bytes のまま写す（Astro の `public/` は build の出力にそのまま入る）。
9. Astro の build（hidden の source map）、`.map` を抜く。
10. inject-csp、notices、build-site-identity。
11. check-site、inventory。
12. upload-pages-artifact（`retention-days: 7`、dotfile を含む）、`showcase-site-sourcemaps`、inventory・lcov の artifact。

## 受入（accept-*）

- 各 job が `github-pages` の artifact を取って展開し、inventory を計算し直して build の値と一致を確かめる。
- serve-pages-like（header なし、base `/formicarium`、U7 の tls.ts の job 専用の CA の HTTPS）で配り、Playwright（retries 0、workers 1、1件 180秒）で P1 の16件を流す。
- accept-chromium だけ V8 の coverage を集め、artifact に上げる。

## deploy の手順

1. `github-pages` environment（最初の deploy だけ承認者がいる）。
2. deploy-guard（Actions の API で、この workflow の `deploy` の job が成功した run の最大の run_number が自分より大きければ失敗。API の失敗も失敗）。
3. `github-pages` の artifact を取り、inventory を計算し直して evidence の siteInventorySha256 と照合する。
4. `actions/deploy-pages`（最新。今は v5.0.1。commit SHA で固定）。
5. deploy-pages の成功の後だけ、`-deployed` の証拠を上げる。
6. job の出力に `page_url` を出す。

concurrency：deploy の job は group `showcase-site-pages`・`cancel-in-progress: false`。workflow 全体は、PR の run が `showcase-site-pr-<番号>` で古い run を取り消し、他の run は run ごとに独立。

## summary（review-01 R-01）

- 常に、最後に deploy した run からの日数（`deploy` の job が成功した最新の run。無ければ「まだ deploy していない」）と、失敗した job の名前を job summary に出す。
- 失敗にするのは、DIST の run で、deploy が成功した run があり、日数が 2 以上のときだけ（日次の配布の停止を通知する）。verify の run と、まだ deploy が無いときは表示だけ。

## 基盤の変更の流れ（Q2=B。review-01 R-04・R-09）

前提の確認（人が行い、結果を記録する）：

1. repository の変数 `FORMICARIUM_INFRA_APPLY_ENABLED` が `true` か、OpenTofu の state が既にあるか（今は未確認）。未有効なら、有効化と module 全体の初回 Apply（import と必須の check の名前を含む）は U8 の変更とは別に、`infra/github/README.md` の手順で内容を示して人の承認を受けてから先に行う。U8 の PR はそれを引き起こさない。
2. token：`TF_TOKEN_GITHUB` の fine-grained token に、Repository permissions の Pages と Environments の Read and write を足して作り直し、secret を更新する（人が行う。会話に token を貼らない）。OpenTofu の PR の plan より前に済ませる（plan が新しい resource を読めるように）。

OpenTofu の PR（1つ）：

- `github_repository.this` に `pages { build_type = "workflow" }` を足し、`ignore_changes` から `pages` を外す。
- `github_repository_environment` の `github-pages`：`deployment_branch_policy { protected_branches = true, custom_branch_policies = false }`（main は classic の保護があるので、保護された branch だけが deploy できる）、`reviewers { users = [<承認者の user の ID>] }`、`depends_on = [github_repository.this]`。Pages を workflow で有効にすると `github-pages` の environment が自動で作られ得るので、既にあれば `import` の block で取り込む（main.tf の repository と同じ形）。どちらになるかは plan で確かめる。
- provider の版を `~> 6.13` にし、`tofu init -upgrade` で `.terraform.lock.hcl` を更新して同じ PR に入れる。
- `infra/github/README.md` の token の権限の節に Pages・Environments を足す。

plan の comment で確かめること：差分が Pages の追加・environment の作成（又は取込み）・provider の版だけで、branch の保護・label・変数に差分が無いこと。

その後：人の承認で merge → terraform-apply が apply（前提 1 が有効のとき）→ 最初の deploy（承認者が承認）→ site を確かめる → OpenTofu の別の PR で reviewers を外す（内容を示して承認を受けてから）。

## 切戻し

- U8 の変更：PR を revert して main に merge → main から showcase-site.yml を手動で実行 → verify-deployment の成功を確かめる。
- 新しいツールの release：Actions の画面で showcase-site.yml を無効にする（前回の site のまま）→ U7 の tools.json の条件を PR で直す → 有効に戻して main から手動で実行する。
- 基盤：OpenTofu の PR の revert。Pages を無効にする変更は site を消すので、内容を示して承認を受けてから。
- 前の run の artifact を deploy し直す手段は作らない（deploy-guard が古い run を拒否する）。

## 依存と version

- site の依存：`showcase/site/bun.lock` と `bun install --frozen-lockfile --ignore-scripts`。更新は PR と dependency-review（bun.lock を読めるかは最初の PR で確かめる）。
- GitHub Actions：`actions/upload-pages-artifact`（v5.0.0）・`actions/deploy-pages`（v5.0.1）・`actions/download-artifact`・`actions/upload-artifact`・`actions/checkout` を最新版の commit SHA で固定する（U7 と同じ形）。

## Assumptions & Open Questions

None.
