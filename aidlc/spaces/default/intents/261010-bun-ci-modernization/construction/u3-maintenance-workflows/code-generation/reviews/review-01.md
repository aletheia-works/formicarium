## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-10-10T15:16:33Z
**Iteration:** 1

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | scripts/maintenance/receipt.ts > validateAcquisitionPolicy / .github/maintenance/policy.json > acquisition.protectedPaths | validatorはprotectedPathsにworkflowPath `.github/workflows/ci.yml`そのものが含まれることを要求するが、tracked policyは親ディレクトリ`.github`だけを指定する。ID・producer・hostを埋めwriterを有効化しても、この条件でINVALID_POLICYとなり取得へ進めない。試験fixtureはCIの完全pathを指定しており実設定との差を検出しない。 | 親ディレクトリによる保護をvalidatorが正しく認めるか、tracked policyを必須完全pathに合わせる。実policyから未設定identityだけを妥当値に置き換えた正常有効化試験を追加する。 | New |
| R-02 | Major | .github/workflows/maintenance.yml > prepare permissions / scripts/maintenance/runner.ts > prepareのobserveProtection呼出し | prepareはcontents/actions/checks/pull-requests readのGITHUB_TOKENを使うが、正常な依存候補でobserveProtectionを呼び、Administration read必須のGET branch protectionへアクセスする。merge jobにはそのApp権限がある一方、prepareには取得可能な認証供給がないため、保護mainを持つ正常依存更新でも再現前に拒否される。偽HTTP試験はこの権限差を再現していない。 | prepareに書込み権限を渡さず保護情報を得る認証経路を設計・接続するか、保護照合を適切な信頼側へ移す。目的別tokenの権限とAPIを対応づけ、prepare正常例とAdministration不足時拒否を試験する。 | New |

### Validation Tool Results

| Tool / Check | Result | Interpretation |
|---|---|---|
| Ruby/JSON・SHA256による読取検査 | PASS：manifest20pathが存在、generated inventory43件の実hash/sizeが全件一致 | 検証済み：tracked runnerとignored JS/mapsの記録を対応づけた。 |
| 実policyとvalidator述語の静的確認 | protectedPaths.includes(workflowPath) = false | 第1Majorを直接確認。writer初期無効自体は意図した安全条件であり指摘ではない。 |
| prepare権限と公式API照合 | [Get branch protection](https://docs.github.com/en/rest/branches/branch-protection#get-branch-protection)はAdministration readを要求 | 第2Majorの根拠。実GitHub呼出しは未実施。 |
| 公式job schema確認 | [GitHub公式OpenAPI](https://github.com/github/rest-api-description/blob/main/descriptions/api.github.com/api.github.com.json)のjobにはrun_attemptが存在 | 文書の古い例に属性がないことだけを不具合とは扱わない。実API・attempt対応の検証は今後必要。 |
| bounded取得・再現・C2/C3・writeの静的追跡 | 8MiB stream/展開、member16、file500、独立2job receipt→3check、固定Biome/Bunのcredentialなし再現、実U2、最終再取得、expectedHeadOid/sha、write最大1回 | 共通必要checksを両操作で維持。HTTP/GraphQL失敗と通信結果不明を区別し、後者はread照合のみで再送しない。writerは信頼bundleのみを実行しinstall/buildを持たない。 |
| 主セッションの最新観測記録 | 5tasks exit0、39トップレベル/108pass/0fail/0skip、tooling156pass、既存2skip維持、actionlint0、Bun→Biome bundle再生成一致 | ドキュメント根拠：local-observations.mdと主セッション報告。レビュー担当はbuild/testを再実行していない。 |

### Summary

入力・実行供給・原子的head引数・未知結果の再送禁止の実装は設計に整合する。実設定の正常有効化とprepareの保護情報取得に2件の接続不具合が残るため、運用前に対応が必要。READYは単独advisoryの判定基準によるもので、実CI・80%coverage・App権限・原子的競合・整形後CIの受入れ完了を意味しない。今回のレビューでは修正を行っていない。
