## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-10-10T07:53:33Z
**Iteration:** 1

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | scripts/release/evidence.ts > validateEvidenceのcheck検査; scripts/release/decision.ts > adoptionのADOPTION_CHECKS検査 | 検証済み（静的条件の照合とmainの隔離観測）：公開済みRCのterrarium受入れに必要な実導入差分の証拠が欠落しても拒否されない。validateEvidenceはcheck.terrariumを検査せず、adoptionはinstalledVersion、baselineCommit、integrationCommitの存在だけを検査し、diffSha256を参照しない。mainはterrarium-nodeのfixtureでdiffSha256を空文字にし、validateEvidenceが受け入れることをexit0で観測した。fixtureのtemporary directoryは片付けられ、製品sourceと実証拠は変更されていない。tests/release/decision.test.tsのstable成功fixtureでも、その値を拒否する条件が保存・解決・採用経路に存在しないため、ほかのpassed条件が揃ったstable判定から実導入差分の欠落を検出できない。stable全経路の動的再現は未実施。現行の保存済み実測結果が無効だという指摘ではなく、未公開のRC採用判定APIの入力検証不足である。 | RC受入れに採用するterrarium情報の必須項目とdiffSha256の形式を検査し、実導入差分artifactの参照と原bytesのSHA照合を採用条件へ追加する。成功fixtureから差分digest・artifactを欠落または改変した場合、stableがblockedになる回帰を追加する。 | Resolved (reviewer) |
| R-02 | Major | scripts/release/collect.ts > collectCommand stop / child close | 観測collectorの期限処理は直接の子だけをSIGKILLし、stdio終了を待つcloseで完了する。stdout/stderrを継承した孫プロセスが残ると期限後も完了しない。mainの有限fixtureではtimeoutMs=500に対し孫の寿命1800msまで待ち、elapsedMs=1881.398となった（verification/ci-traceability-repair-v1/reviewer-timeout-observation.json）。終了分類は正しくfailed/timeoutだが、長寿命の孫があれば逐次検証と証拠保存を止め得る。CI専用run.tsはプロセス群を停止するため、今回の遠隔成功を否定する所見ではない。 | collectorでも子孫を終了できる処理と、stdioの終了を無期限に待たない完了処理を実装する。stdioを継承する有限寿命の孫を使うtimeoutおよび実行中abort回帰で、子孫終了と期限付近でのsettle、failed分類、原ログ保存を確認する。 | Resolved (reviewer) |
| R-03 | Minor | docs/release-assurance.md > 現在の状態と版の境界（2026-10-10） / Trusted Publishingと未確認事項 | 現在の説明が「遠隔CI…未実施」「遠隔CI成功…実確認したという主張はない」のままで、code-summary.mdの現行欄とrun38011644576のacceptance=trueに矛盾する。Trusted Publisher・公開済みRC受入れ・実公開の不足は引き続き正しいが、CI未実施と混在して次の担当者を誤誘導する。 | 現行説明にrun URL、source SHA、436試験とnative2件、固定24coverage80.51%と保存証拠への参照を反映する。旧CI未実施の記述は時点を付けた履歴へ移し、Trusted Publisher・実RC導入・公開・工程承認の未完条件は明示して保持する。 | Resolved (reviewer) |
| R-04 | Minor | aidlc/spaces/default/intents/261006-npm-terrarium-release/construction/u4-release-assurance/code-generation/code-summary.md > Latest Collector CI — attempt1 | 同一source/inputの初回CIはWebKitのcrossOriginIsolated確認でpage.gotoが900000ms後に失敗した。attempt2の成功は検証済みだが、初回失敗の根因は未解決で、今後のCIでも長時間停止と手動再実行が必要になる可能性が残る。成功・失敗を分離した記録は適切である。 | 保持したattempt1のtrace、diagnostics、job logからnavigationと隔離初期化の停止箇所を調査し、再現条件と原因を別の修正作業へ引き継ぐ。品質上限やretries0を維持し、原因解消までは間欠的失敗を未解決として表示する。 | Accepted risk |
| R-05 | Major | aidlc/spaces/default/intents/261006-npm-terrarium-release/construction/u4-release-assurance/code-generation/unit-test-instructions.md > Current Verification — Loop-back 3, workflowの8ケース群 | 検証済みのソース観測：publication.test.tsはprepare/validate/planを、workflow.test.tsはworkflow構造とcontextを個別に呼ぶが、gatePublication/publicationCliを呼ぶ試験はない。新CLIが結合するrequestとtgzのSHA、pack外固定source、core provenance、実context、およびnpm実行前のOIDC/config隔離をまとめた公開到達経路は未検証である。また最終追加のRC用全REGRESSION_CHECKSと80%coverageには正常fixtureだけがあり、欠落・failed・timeout・coverage不足による拒否の直接oracleがない。64件の成功だけでは、この公開前境界の拒否動作までは確認できない。 | 外部送信を行わないCLI境界試験を追加する。正常bundleをgatePublicationへ渡し、tgz/request SHA・pack外source・core・contextを各々変更して拒否を確認する。RCの必須回帰欠落/failed/timeoutとcoverage欠落/80%未満もplanPublicationでblockedを確認する。npm/gh起動は注入した偽executor等で捕捉し、不成立時の起動0回と、正常時の同一candidate.tgz・dist-tag・隔離config引数をmainで検証する。 | New |
| R-06 | Minor | aidlc/spaces/default/intents/261006-npm-terrarium-release/construction/u4-release-assurance/code-generation/unit-test-instructions.md > Current Verification — Loop-back 3, 公開CLIのコマンド例 | 検証済みのソース観測：記載のplanはidentity-json/evidence-json、validateはmanifest-json/identity-jsonの2引数だが、publicationCliはplanにevidence-root/request-json、validateにmanifest-json/identity-json/tgzの3引数を要求する。記載どおりのvalidateはusage error、planはidentity JSONを証拠ディレクトリとして扱うため実行できない。docs/release-assurance.mdの例は実装と一致している。 | 現行節の例をplan <evidence-root> <request-json>とvalidate <publication-candidate-manifest-json> <identity-json> <exact-tgz>へ修正し、各入力の役割を実装と一致させる。 | New |
| R-07 | Minor | aidlc/spaces/default/intents/261006-npm-terrarium-release/construction/u4-release-assurance/code-generation/traceability.json > coverage[id=NFR3] | 検証済みの記録照合：NFR3はOKでsource70b345c3/run38024772634の成功を根拠にする一方、code-summary冒頭とpublication-v1/main-results.mdは現在のpublication source・公開candidate SHA8334d7f1のfresh CIと固定24coverageを未実施と明記する。現行traceabilityにはその候補境界がなく、現在sourceの統合前CIまで達成したと読める。過去runの成功自体を否定する所見ではない。 | NFR3の現行状態をDeferred等へ更新し、旧sourceの検証済み履歴と現在の公開candidate/sourceに必要なfresh coverage・CIを同じ行の理由で分ける。新証拠の取得後、そのsource commitとcandidate SHAを根拠として状態を更新する。 | New |

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| aidlc engine sensor-traceability --output-path …/code-generation/traceability.json --stage-slug code-generation | 検証済み：exit0、pass=true、findings_count=0、gaps/orphans/invalid_targets等は空 | IDとtargetの構造は成立。現行候補への達成根拠の新しさは上のMinorとして別途評価した。 |
| aidlc engine sensor-required-sections --output-path …/code-generation/code-generation-plan.md --stage-slug code-generation | 検証済み：exit0、pass=true、h2_count=11、findings_count=0 | 計画の必須構造を満たす。 |
| aidlc engine sensor-required-sections --output-path …/code-generation/unit-test-instructions.md --stage-slug code-generation | 検証済み：exit0、pass=true、h2_count=11、findings_count=0 | 指示書の構造は成立。CLI引数と拒否試験の具体性は所見として分けた。 |
| aidlc engine sensor-required-sections --output-path …/code-generation/code-summary.md --stage-slug code-generation | 検証済み：exit0、pass=true、h2_count=15、findings_count=0 | summaryの構造を満たす。 |
| mainの正式build・試験記録（publication-v1/main-results.md） | 記録照合済み：2tsc/emit exit0、publication8/workflow8/release35/CI13計64成功。最終wrapper後の再buildとpublication8成功。公開packのNode11・三browser33・strict型成功 | reviewerはbuild/testを再実行していない。mainの観測として採用し、CLIの外部公開成功へ昇格させない。 |

### Summary

単一advisory passの結果、Criticalなし、Major1件、Minor2件のためREADY。旧v9を保持する公開専用候補、候補SHA・tag/source/操作承認の照合、公開jobの権限分離、RC/stable採用の境界は実装から追跡できるが、実CLI境界の否定試験を公開前に補う判断が必要である。

実Trusted Publisher登録・CLI対話認証/bootstrap・OIDC・npm/Release公開・公開済みRCのterrarium受入れ・現在source/candidateのfresh CIは未検証として扱う。本判定はこれらの達成や外部操作の承認を意味しない。
