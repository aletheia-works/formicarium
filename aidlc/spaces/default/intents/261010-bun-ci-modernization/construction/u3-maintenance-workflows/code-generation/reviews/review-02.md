## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-10-10T16:53:19Z
**Iteration:** 1

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | scripts/maintenance/receipt.ts > validateAcquisitionPolicy / .github/maintenance/policy.json > acquisition.protectedPaths | validatorはprotectedPathsにworkflowPath `.github/workflows/ci.yml`そのものが含まれることを要求するが、tracked policyは親ディレクトリ`.github`だけを指定する。ID・producer・hostを埋めwriterを有効化しても、この条件でINVALID_POLICYとなり取得へ進めない。試験fixtureはCIの完全pathを指定しており実設定との差を検出しない。 | 親ディレクトリによる保護をvalidatorが正しく認めるか、tracked policyを必須完全pathに合わせる。実policyから未設定identityだけを妥当値に置き換えた正常有効化試験を追加する。 | Resolved (reviewer) |
| R-02 | Major | .github/workflows/maintenance.yml > prepare permissions / scripts/maintenance/runner.ts > prepareのobserveProtection呼出し | prepareはcontents/actions/checks/pull-requests readのGITHUB_TOKENを使うが、正常な依存候補でobserveProtectionを呼び、Administration read必須のGET branch protectionへアクセスする。merge jobにはそのApp権限がある一方、prepareには取得可能な認証供給がないため、保護mainを持つ正常依存更新でも再現前に拒否される。偽HTTP試験はこの権限差を再現していない。 | prepareに書込み権限を渡さず保護情報を得る認証経路を設計・接続するか、保護照合を適切な信頼側へ移す。目的別tokenの権限とAPIを対応づけ、prepare正常例とAdministration不足時拒否を試験する。 | Resolved (reviewer) |

> R-01 Reviewer note: 実tracked policyのprotectedPathsへ `.github/workflows/ci.yml` の完全pathが追加され、validateAcquisitionPolicyのexact includes条件と一致した。wiring回帰は実policyへ外部IDだけを補って正常検査を行う。mainが当該失敗のRedと修正後同commandのGreenを記録している。

> R-01 Earlier decision: Accepted risk

> R-02 Reviewer note: prepareはtrusted toolsの導入後にrepo限定専用App tokenを取得し、contents/actions/checks/pull-requests/administrationを全てreadへ限定する。tokenを親API取得へ渡し、private keyはtoken Actionのみ。dependency経路のobserveProtectionを403にする回帰は保護read1回とwrite0回を確認する。format writerへAdministrationを追加せず、再現childはenv allowlistでcredentialを除去する。実App適用・実保護APIアクセスは別途未検証。

> R-02 Earlier decision: Accepted risk

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| Rubyによるpolicy述語・source/trace参照検査（読取のみ） | PASS：実workflowPathがprotectedPathsに完全一致、source-manifest20パスとtraceability22 targetが存在しID集合が一致 | 検証済み。親NFR1–5の実在targetも含む。未知外部IDとwriter無効の拒否条件は維持。 |
| Ruby SHA256/size_bytes検査（読取のみ） | PASS：generated-artifactsの43件が実bytesに一致 | 検証済み。tracked Node runnerとignored生成物の申告を分離し、source-manifestはpath-only。 |
| workflow・API経路・回帰の静的照合 | PASS：専用read Appの権限とrepo範囲、導入後のtoken取得、private key非転送、再現child env allowlist、dependency限定の保護取得が整合 | source/ドキュメント根拠。C2独立取得・実C3・head条件付き外部操作・未知結果再送禁止の境界を維持。 |
| mainの現attempt観測記録 | 同3files Red43 pass/4 fail→修正後47 pass/0 fail、全U3 39 top/110 actual pass/0 fail/0 skip、5tasks全exit0、tooling208 pass、既存light177 pass/2 skip、actionlintと固定bundle再生成一致成功 | 既存観測を参照。誤403 fixtureと旧エラー名期待の訂正も明示され、初期失敗を現結果に混ぜていない。レビュー自身はbuild/testを実行していない。 |

### Summary

2件の先行指摘は現在の実装境界と追加回帰で解消され、新規の具体的指摘はない。prepareの保護読取を専用read Appで可能にしながら、writer目的別権限、trusted base、credentialなし再現、必要な共通3checks、独立C2/C3と最終head照合を保持している。

READYはローカル実装レビューの判定である。実App/secret/保護設定、実GitHub CI、当該SHAの第一者配布JS80%以上・全realm receipts、実atomic競合、整形後CI起動、定期更新稼働は未検証。writerEnabled=falseと未設定外部IDを維持し、局所成功を外部運用開始の証拠にしていない。
