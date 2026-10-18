## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-10-10T02:04:18Z
**Iteration:** 1

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | scripts/release/evidence.ts > validateEvidenceのcheck検査; scripts/release/decision.ts > adoptionのADOPTION_CHECKS検査 | 検証済み（静的条件の照合とmainの隔離観測）：公開済みRCのterrarium受入れに必要な実導入差分の証拠が欠落しても拒否されない。validateEvidenceはcheck.terrariumを検査せず、adoptionはinstalledVersion、baselineCommit、integrationCommitの存在だけを検査し、diffSha256を参照しない。mainはterrarium-nodeのfixtureでdiffSha256を空文字にし、validateEvidenceが受け入れることをexit0で観測した。fixtureのtemporary directoryは片付けられ、製品sourceと実証拠は変更されていない。tests/release/decision.test.tsのstable成功fixtureでも、その値を拒否する条件が保存・解決・採用経路に存在しないため、ほかのpassed条件が揃ったstable判定から実導入差分の欠落を検出できない。stable全経路の動的再現は未実施。現行の保存済み実測結果が無効だという指摘ではなく、未公開のRC採用判定APIの入力検証不足である。 | RC受入れに採用するterrarium情報の必須項目とdiffSha256の形式を検査し、実導入差分artifactの参照と原bytesのSHA照合を採用条件へ追加する。成功fixtureから差分digest・artifactを欠落または改変した場合、stableがblockedになる回帰を追加する。 | Resolved (reviewer) |
| R-02 | Major | scripts/release/collect.ts > collectCommand stop / child close | 観測collectorの期限処理は直接の子だけをSIGKILLし、stdio終了を待つcloseで完了する。stdout/stderrを継承した孫プロセスが残ると期限後も完了しない。mainの有限fixtureではtimeoutMs=500に対し孫の寿命1800msまで待ち、elapsedMs=1881.398となった（verification/ci-traceability-repair-v1/reviewer-timeout-observation.json）。終了分類は正しくfailed/timeoutだが、長寿命の孫があれば逐次検証と証拠保存を止め得る。CI専用run.tsはプロセス群を停止するため、今回の遠隔成功を否定する所見ではない。 | collectorでも子孫を終了できる処理と、stdioの終了を無期限に待たない完了処理を実装する。stdioを継承する有限寿命の孫を使うtimeoutおよび実行中abort回帰で、子孫終了と期限付近でのsettle、failed分類、原ログ保存を確認する。 | Resolved (reviewer) |
| R-03 | Minor | docs/release-assurance.md > 現在の状態と版の境界（2026-10-10） / Trusted Publishingと未確認事項 | 現在の説明が「遠隔CI…未実施」「遠隔CI成功…実確認したという主張はない」のままで、code-summary.mdの現行欄とrun38011644576のacceptance=trueに矛盾する。Trusted Publisher・公開済みRC受入れ・実公開の不足は引き続き正しいが、CI未実施と混在して次の担当者を誤誘導する。 | 現行説明にrun URL、source SHA、436試験とnative2件、固定24coverage80.51%と保存証拠への参照を反映する。旧CI未実施の記述は時点を付けた履歴へ移し、Trusted Publisher・実RC導入・公開・工程承認の未完条件は明示して保持する。 | Resolved (reviewer) |

> R-02 Reviewer note: 検証済み（source読取・main保存観測）：scripts/release/collect.ts の collectCommand stop はPOSIX独立process groupをSIGKILLし、250msでstdout/stderrのdrainを打ち切る。tests/release/collect.test.ts の継承pipe孫fixtureはtimeout/abort双方で期限付近のsettle、孫PIDのESRCH、failed分類、取得ログとSHAを検査する。main-results.jsonでは旧実装7/9成功・2失敗（2082.427292ms / 2099.892333ms）から正式build後35/35成功・skip0へ改善し、両ケース608.948667ms / 607.926ms（100msの終了確認待ちを含む）。3対象sourceのSHAは独立再計算で保存記録と一致。

> R-03 Reviewer note: 検証済み（文書・保存証拠読取）：docs/release-assurance.md の現行欄にrun38011644576のURL、source c75bc285f0320e2f3cb234569fa9cc4bc4588a9d、9必須check・436試験とnative2件・80.51%・46receipt・保存証拠pathを反映している。CI未実施の記述は2026-10-08履歴へ移動し、今回のcollector修正後の遠隔再実行とは区別する。Trusted Publisher、公開済みRC導入、実公開と工程承認の未完条件を保持している。

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| shasum -a 256 scripts/release/collect.ts tests/release/collect.test.ts docs/release-assurance.md | PASS：9cafa5a99c43934a4cf3540b0ca1c121562156a39644cf81f0878d723172efc4、00fce2c301be49b747e42bb0b1610f5bc5c328565d05e0ae81ea170e5230097c、c9d7a02fe9f324790e629fa82b7cda44cc004ddfcc76c72a55731c0df0cf0cec | 独立読取対象はmain-results.jsonの検証対象と同じbytes。 |
| mainの保存済みcollector-final-20261010/main-results.json | PASS：release35/35、fail0、skip0；正式product/test tscとemit exit0 | main観測を読取確認。独立レビュアーはbuild/testを再実行していない。 |
| remote-run-38011644576.json読取 | PASS：acceptance=true、source一致、固定24 coverage80.51%、executionIdentity記録あり | R-03の現行CI成功説明は保存証拠に対応する。遠隔CIの再実行・GitHubの再照会は行っていない。 |
| collectCommand stop / finish / close の静的照合 | PASS：通常exit0だけpassed；timeout/abortはfailedを保持；timer/listener解放とbounded drainあり | 孫によるpipe保持が逐次collectorを無期限に止める旧経路を解消する。 |

### Summary

U4のR-02/R-03修正を対象とした独立差分レビューはREADY。Windows taskkill経路とprocess groupを明示離脱した孫の終了は未検証であり、後者の終了保証範囲とbounded pipe待ちは文書に明示されている；この判定は実公開や正式Unit完了の承認を意味しない。
