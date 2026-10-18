## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-10-17T03:33:51Z
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
| R-06 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u3-install/code-generation/code-summary.md > Status 先頭ブロック（CI 38948209404の中央値） | 3000ms上限に対し、CIのBiome/Firefox非download中央値は2775.52ms（余裕約7%）。直前のCI 38909083334は3006.24msで不合格だった。1回のCI成功は合格だが、runner間のばらつきで再び上限を超える余地が小さい。基準は緩めていないため設計違反ではない。 | 基準は変更しない。Unit checkpointまたはBuild and Testで、この余裕の小ささを残余リスクとして人間に明示する。後続のvalidate（純JS SHA-256）改善案は別途維持する。 | Unresolved |
| R-07 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u3-install/code-generation/code-summary.md > Status（CI run 38948209404のartifact）; .github/workflows/migration-install-u3.yml > upload-artifact `retention-days: 1` | 独立照合の根拠となるCI ZIPはGitHub上で1日で失効する。sealed bindingは `.artifacts/` のローカルコピーに依存する。 | ZIPのSHA256とbinding（9abbceb8…）をaidlc配下の完了記録へ残すか、必要なら保持日数を延ばす案を人間に示す。再検証は保存済みコピーで行うと明記する。 | Unresolved |
| R-08 | Minor | scripts/migration-install/measure.ts > launchPersistentContext 後の `persistent.browser()` | Playwrightの公式説明ではpersistent contextの `browser()` は通常nullで、そこからの `newContext` に依存している。CI 38948209404でFirefox 36試行が全てTLS検証ありで成功したため現在のPlaywright 1.64.1では動作するが、版更新で挙動が変わるとnullのガードでthrowして計測が止まる（誤合格にはならず安全側）。 | 現状のまま許容する。Playwright版更新時にこの経路の確認を再実行項目へ含める。 | Unresolved |
| R-09 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u3-install/code-generation/code-summary.md > 今回の再開：U4の作業を戻した後（2026-10-17、Step 12）、および code-generation-plan.md > Step 13 | 最終確認で壊れる箇所の名前が記録にない。コードから読むと、少なくとも次が壊れる。(1) scripts/migration-install/completion.ts の checkInstallCandidate の `FIRST_PARTY_JS.length !== 21`（76行）と runInstallCompletion の `coverageReport.files.length !== 21`（363行）。配布JSは23件になり、command-parse.js と command.js が増えたため、どちらも常に失敗する。(2) candidate.sourceFiles と sourceIdentity の照合（checkInstallCandidate）。tsconfig.tests.json などU3がclaimする共有fileの内容が変わったため、封印済みの330件・54da5b22…の候補とは一致しない。verify-toolchain-u3.mjs の封印binding（9abbceb8…）も同じ理由で通らない。(3) `candidate.unit !== 'u3-install'` を固定する箇所。completion.ts 59・310・368行、coverage.ts 45・123・124行、measure.ts 150行、tests/migration-install/consumer.test.ts 13行・consumer.spec.ts 9行・hash-regression.spec.ts 6行。U4の候補は unit が u4-command になるため、U4込みの候補を渡すとU3の試験・coverage・計測が入口で拒否される。(4) runtime/public.js を静的に読むため、公開module集合に command.js と command-parse.js が加わる。U3 coverageの分母に入るが、U3の試験はこの2fileを実行しないので、aggregate 80%が割れる可能性がある（未計算、推測）。ブラウザ試験の `import('/runtime/public.js')`（consumer.spec.ts・measure.ts）も新しい2fileを配信できる前提になる。U2側のprepareSessionCoverage／SESSION_REALMSにも同様の件数固定がある可能性がある（未確認）。Step 13の「intentの検証コマンドでU3のcheckpointを確かめる」は、U1の試験を今のsourceで実行するものにすぎず、上の箇所を一つも実行しない。 | code-summary.mdに、上の(1)〜(4)を最終確認で直す項目として書く。candidateのunitを固定している箇所は、U3候補とU4を含む候補のどちらを入力にするかを決めて直す。件数21をinventoryから導くか23へ更新し、command.js/command-parse.jsを分母に入れたcoverageが80%以上かを実測する。あわせて、Step 13のcheckpoint確認はU3の受入証拠ではなく、U3は最終確認まで未再確認のままであることを一文で明記する。 | New |

> R-06 Reviewer note: 3000ms上限へ余裕約7%という残余リスク。基準は不変で、今回の変更では解消も悪化もしていない。最終確認時に再測定される。

> R-07 Reviewer note: CI ZIPの失効（retention 1日）。今回の再開で状況は変わらない。

> R-08 Reviewer note: persistent contextのbrowser()依存。Playwright版は変わっていないため同じ。

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| ファイル読取り: runtime/public.ts | 追加は `export { createCommandSession } from './command.js';` の1行だけ。既存のexport（createInstaller、runValidatedGuest、registerValidatedGuest、decodeUtf8、validateGuest、fixtureToFsEntries）は同一。 | 追加のみで、C04の呼出し形は変わらない。 |
| ファイル読取り: types/index.d.ts 55–80行 | Progress、InstallOptions、InstallResult（5フィールド）、Installer、createInstaller宣言は元のまま。C05（CommandOptions・CommandResult・CommandSession・createCommandSession）は80行以降への追加で、InstallResultを `installation?` として参照するだけ。 | 追加のみ。GuestCatalogの定義行は再読していないが、runtime/command.ts は install.js と install-catalog.js を読むだけで逆の依存はない。VCS差分は禁止のため、旧版との差分比較はしていない（recordのjj diff 0件の主張は未再検証）。 |
| ファイル読取り: scripts/migration-install/*.ts、tests/migration-install/*.ts | 上の新規指摘の箇所に件数21とunit固定があることを確認した。 | 実行はしていない。コードからの推論である。 |
| 試験・build実行 | 実行せず | 指示により実行しない。U3の受入結果（CI 38948209404、正式36試行、verify-toolchain-u3.mjs）は旧sourceのものとして扱う。 |

### Summary

U3の製品コード（runtime/install*.ts）と公開契約C04は、読み取れた範囲で追加のみの変更の影響を受けない。記録も、U3の受入が旧sourceに結び付き、最終確認がU4の後に延期されることを過大主張せずに書いている。最終確認で壊れる箇所の名前が記録に足りないため、Minorとして挙げた。ブロッキングなし。
