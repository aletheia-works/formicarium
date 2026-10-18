## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-10-16T19:52:47Z
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | scripts/migration-install/ci-inputs.ts > INSTALL_INPUT_POLICY; scripts/migration-install/ci.ts > prepareInstallCI / verifyInstallCI; .github/workflows/migration-install-u3.yml > Prepare current U3 inputs and independent consumer | CI入力policyは既存CI_INPUT_PATHSとmirrorのaube/Biomeだけで、実配信siteの11ファイルを復元しない。prepare/verify/workflowにもU2_ACTUAL_SITEの設定がない。tests/guest-distribution/integration.test.tsの実配信2件はこの変数がないとskipし、mainの再現記録も8件中6pass/2skipを示す。専用CIは要求される実配信検証を実行できない。 | 実配信ファイルの相対path・全一覧・SHAを固定し、有界入力として復元してU2_ACTUAL_SITEへ結び付ける。既存217941020bytesへの単純追記は256MiBのlogical総量を超えるため、重複資産再利用などで上限を維持する設計にする。metadata1MiB/file128MiB/total256MiB/4096entriesを保持し、欠落・改変・path逸脱・容量超過の拒否とCI相当環境での実配信2件skip0をmainで検証する。 | Resolved (reviewer) |
| R-02 | Major | scripts/migration-install/completion.ts > executeInstallCommand / runInstallCompletion; scripts/migration-install/ci.ts > verifyInstallCI | executeInstallCommandの成功条件はcode===0かつsignalなしのみで、TAP/Playwrightのskip・未実行要約を検査しない。runInstallCompletionとverifyInstallCIにもその拒否条件はなく、coverage/36試行が通ればchecksCompleted=trueを出力できる。package.jsonのtest:lightはguest-distribution試験を含み、上記2skipでもexit0になる実測があるため、入力不足が専用CIの終了コードだけでは顕在化しない。全工程が既に誤合格したという主張ではない。 | 必須実配信入力の事前検査に加え、U3の受入入口で各必須試験の正の実行件数とfail/skip/cancel/TODOなしをraw出力から確認する。CIのmapped executor経由にも同じ検査を適用し、exit0でも必須2件skipを拒否する回帰試験をmainで実行する。既存rawログ保存とcoverage/36試行の個別照合を維持する。 | Resolved (reviewer) |
| R-03 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u3-install/code-generation/unit-test-instructions.md > コマンド; aidlc/spaces/default/intents/261012-terrarium-migration/verification-command.txt > 共通検証コマンド | reviewer自身によるU3 unit/browser/共有回帰および記録済み共通コマンドの再実行は未検証。main-only指定に従って実行していない。共通v5結果のcompletedUnitsはU1/U2、acceptancePassedとlaterUnitAcceptanceはfalseであり、U3の正式受入を示さない。最終cc89a7…候補の正式36試行・署名付きCIもcode-summaryで未完と明示されている。 | mainで新候補に結び付いた必須試験・正式36試行・署名付き同一候補CIの結果を揃え、U3専用の完了確認コマンドを提示・承認後に確認する。既存v5や旧d3df71…候補の36試行を新候補の受入へ置き換えない。 | Resolved (reviewer) |
| R-04 | Major | .github/workflows/migration-install-u3.yml > Preserve current metadata, raw command logs and all realm/trial observations / path lines 94–99 | 新collectorが必要とするcoverage-playwright-generation.jsonとcoverage-playwright-node/<suite>/<pid>.begin.json・.end.jsonがartifact保存対象にない。coverage-node*.json、coverage-session-node*.json、**/coverage-realms.jsonはいずれも新receiptへ一致せず、coverage-report.jsonはrunner名と集計結果だけを保存する。CI成功後もZIPだけから新runnerの開始終了・generation・生カウントを独立再検証できない。現在のローカル証拠欠落を主張するものではない。 | generationと全suiteのbegin/end raw receiptをCI artifactへ保存する。独立ZIP検証の必須inventoryも整合させ、receipt欠落・改変を拒否し、全runnerの生カウントから同じcoverageを再計算できることをmainで検証する。 | Resolved (reviewer) |
| R-05 | Major | scripts/package/coverage.ts > readPlaywrightNodeRealms lines 380–385 and reportCoverage lines 588–590 | process期待集合を現存beginから作り、suite内1組以上・names.length===begins.length*2で進む。reportCoverageも読取り結果をexpectedへ追加するため、起動済み1processのbegin/end両方が欠けると期待集合からも消える。mainの読取専用falsificationで実12realmのpackage PID32536の両entryをreaddir結果から仮想的に隠すと11realmとして受理された（実ファイル変更なし）。正常実行では4process×3suiteを確認できるが、全process欠落拒否の保証には不足する。 | 現存receiptと独立した実行側の予定・起動記録へprocess集合を固定し、全begin/endと厳密比較する。1processの両receipt欠落、余分な一致pair、親子・suite・generation不一致を拒否する回帰を加え、実Playwrightの全runner/workerでmainが確認する。 | Resolved (reviewer) |
| R-06 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u3-install/code-generation/code-summary.md > Status 先頭ブロック（CI 38948209404の中央値） | 3000ms上限に対し、CIのBiome/Firefox非download中央値は2775.52ms（余裕約7%）。直前のCI 38909083334は3006.24msで不合格だった。1回のCI成功は合格だが、runner間のばらつきで再び上限を超える余地が小さい。基準は緩めていないため設計違反ではない。 | 基準は変更しない。Unit checkpointまたはBuild and Testで、この余裕の小ささを残余リスクとして人間に明示する。後続のvalidate（純JS SHA-256）改善案は別途維持する。 | New |
| R-07 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u3-install/code-generation/code-summary.md > Status（CI run 38948209404のartifact）; .github/workflows/migration-install-u3.yml > upload-artifact `retention-days: 1` | 独立照合の根拠となるCI ZIPはGitHub上で1日で失効する。sealed bindingは `.artifacts/` のローカルコピーに依存する。 | ZIPのSHA256とbinding（9abbceb8…）をaidlc配下の完了記録へ残すか、必要なら保持日数を延ばす案を人間に示す。再検証は保存済みコピーで行うと明記する。 | New |
| R-08 | Minor | scripts/migration-install/measure.ts > launchPersistentContext 後の `persistent.browser()` | Playwrightの公式説明ではpersistent contextの `browser()` は通常nullで、そこからの `newContext` に依存している。CI 38948209404でFirefox 36試行が全てTLS検証ありで成功したため現在のPlaywright 1.64.1では動作するが、版更新で挙動が変わるとnullのガードでthrowして計測が止まる（誤合格にはならず安全側）。 | 現状のまま許容する。Playwright版更新時にこの経路の確認を再実行項目へ含める。 | New |

> R-03 Reviewer note: U3専用の試験（acceptance・U3 runner-ready・U1 runner-ready、計41件）をreviewerがNode 26.12.0で再実行し、pass41/fail0/skip0。U3完了確認コマンド verify-toolchain-u3.mjs をbinding 9abbceb8… で実行し exit0、`toolchain-u3-completed-with-independent-ci`、署名検証済み、local/CIともcoverage 1768/1929=91.65%、formal36 local/CI両方passed、realSafari未検証、laterUnitAcceptance false。残りは完了確認コマンドの人間承認のみで、これは本レビューの範囲外。

> R-04 Reviewer note: migration-install-u3.yml のupload pathに `coverage-playwright-generation.json`、`coverage-playwright-node/**/*.json`（begin/end）、`coverage-playwright-node/**/*.jsonl`（launches）が追加済み。CI run 38948209404のZIPに3 suite分の launches.jsonl と全 begin/end が実在することをファイル一覧で確認した（install 3組、package 4組、session 3組のpid receipt）。verifierがZIP側も独立に照合する。

> R-05 Reviewer note: coverage.ts の生成bootstrapは、製品import・counter初期化・begin書込みより前に launches.jsonl へO_APPENDの1回writeを行い、短書込みはthrowする。readPlaywrightNodeRealms は期待pid集合を台帳から作り、suite directoryが「launches.jsonl＋台帳全pidのbegin/end」と厳密に一致することを要求する。1 processのbegin/end両方欠落でも台帳側が期待するため `Playwright missing or extra process receipt` で拒否される。回帰は coverage.test の両receipt欠落ケース（RED→GREENがcode-summaryに記録済み）。

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| `node --test --test-concurrency=1 tests/migration-install/acceptance.test.js tests/migration-install/runner-ready.test.js tests/package/runner-ready.test.js`（Node 26.12.0） | tests 41, pass 41, fail 0, cancelled 0, skipped 0 | 今回の変更範囲のU3回帰はreviewerの再実行で緑。coverage.test.js（台帳回帰）は指定コマンドに含まれず、reviewerは再実行していない。code-summaryの22/22を根拠とする（未再検証）。 |
| `node .artifacts/migration-install/verify-toolchain-u3.mjs <binding> 9abbceb8…` | exit0、`verified: toolchain-u3-completed-with-independent-ci`、runnerLedgersVerified true、local/CI runner realm 12/12、coverage 91.65%、formal36 local/CI true、signatureVerified true | R-03〜R-05の修正をCI実成果物で裏付ける。`realSafari: 未検証`、`laterUnitAcceptance: false` はそのまま区別される。 |
| aidlc-state.md の記録済みConstruction Verification Command | 実行せず | U1/U2のv8コマンドであり、U3の受入れ証拠ではない。U3の根拠は上記U3専用コマンドと試験のみとした。 |

### Summary

前回の未解決3件（台帳の欠落検出、CI artifactへの生記録保存、U3専用の再確認）は、コード・workflow・CI ZIPの実物で解消を確認した。Firefox TLS修正（job限定CAと専用profile、後始末step）とtoolchain更新も、CI実行とverifierで整合している。残りは3000ms上限への余裕の小ささなど非ブロッキングのMinorのみ。
