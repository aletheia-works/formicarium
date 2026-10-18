## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-10-16T10:52:26Z
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | scripts/migration-preflight/baseline.ts > readAccepted, lines 293–294; integration/vivarium/preflight/baseline-controller.mjs > readAccepted | cacheのbuild-info.jsonは容量確認なく全量を読みJSON.parseで処理する。重複fieldで最後の値を正しい値にしたmetadataは、重複を失ったobjectとしてidentity/canonical照合を通り、runBaselineのreuse経路はcompileSkipped=trueを返し得る。共通型の正規化規則は重複key拒否、C11はmetadata1MiB、U1 NFR3.2/DS2はduplicate拒否を要求する。この命題はreadAccepted/reuse境界に限定する。後から既存cacheを改変した場合、最終verifyFileのfirst/reuse receiptとraw buildInfoSha256照合は通常その改変を拒否するため、最終受入まで通るとは主張しない。 | cached build-infoにも1MiB上限と重複keyを保持して拒否するJSON読取りを適用し、CLI入力と生成controllerへ反映する。最後の値が正しい重複key、escaped alias、上限+1をreuse拒否する試験を追加し、既存receiptとのraw SHA照合は維持する。 | Unresolved |
| R-02 | Minor | scripts/migration-preflight/assets.ts > extractTar, lines 295–391 / acquireAsset extract phase | 全entry検査・link検査は同期ループで、signal/deadlineを受け取らず、event loopへ制御を返す分割点もない。C11とDS2が求めるCPU処理の分割境界での取消確認がこの区間にはない。取得・gzip stream・後続digestには取消経路があるが、tar検査中に届く取消の処理はその区間が終了するまで遅れる。実上限入力の遅延時間は未検証であり、今回の性能試行失敗とは扱わない。 | 全entry・link検査に適切な分割点でyieldとsignal/deadline確認を設け、途中取消で後続の登録へ進まない境界試験をmain sessionで実行する。 | Unresolved |
| R-03 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u1-migration-preflight/code-generation/unit-test-instructions.md > Unit-Scoped Commands | 今回の回復レビューではbrowser/verifyと記録済み完了確認コマンドを再実行していない。記録済みコマンドはU2の固定結果・旧source inventoryを読むため、現在の候補全体に対する成功証拠としては未検証。過去の36試行・CI・coverageの履歴と、現在のソースを用いた受入を区別する必要がある。 | 現在の候補と入力に対応する検証入口・証拠をmain sessionで照合する。過去の成功結果を新しい候補の完了証拠に置き換えず、未再実行範囲を明記する。 | Resolved (reviewer) |
| R-04 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u1-migration-preflight/code-generation/unit-test-instructions.md > Unit-Scoped Commands / 完了確認の復旧手順 | このレビューでmise run migration-preflight-unit/browser/verifyおよび記録済み復旧コマンドの独立再実行は未検証。dispatchがbuild/test実行を禁止し、main sessionでの逐次実行を指定しているため実行しなかった。mainのv4ログと固定結果は読取り確認したが、レビュー自身の試験成功や新しい正式checkpoint確認とは区別する必要がある。 | 正式checkpointでは、現在の入力・結果SHAへ固定した実コマンドと未完のCI/U3範囲を提示し、所定の承認後にmain sessionで確認する。今回のlocal成功を統合前CIやU3性能受入へ置き換えない。 | Unresolved |
| R-05 | Major | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u1-migration-preflight/code-generation/current-recovery-verification.md > 実行と固定証拠・受入状態とレビュー残件; code-summary.md > 現在コードの完了確認の復旧 | v4の390 current source封印を現ファイルとSHA256照合すると15件が異なる。runtime/guest-validation.ts/js、mise.toml、README.md、installのCI・completion・試験入力等を含む。v4自体の入力SHA 4ea97606…と結果SHA a3a9a207…は保存されているが、その時点の成功は現在sourceの完了確認を証明しない。「現在コード」とする引継ぎは現状と一致せず、短いverifyもassertCurrentIdentityの一致条件を満たさない。直近のU3 local18工程はU1単体/current-completionを含まず、U1の21工程と同一の検証集合でもない。 | v4を実行時点の履歴として保持し、現在sourceからの差分と再利用できる証拠を明記する。現在の正式完了確認には、新source/pack/必須工程に結び付いた証拠と承認済みの検証入口を用意しmainで確認する。U3の承認済みSHA改善を取り消したり、旧証拠のSHA・成功属性を書き換えたりしない。 | Resolved (reviewer) |

> R-01 Reviewer note: 検証済み（静的確認）：scripts/migration-preflight/baseline.tsのreadAcceptedはbuild-info.jsonを全量readFileしJSON.parseする。metadata1MiBとraw重複key拒否は追加されていない。生成controllerの同境界についての既存指摘も未修正。最終receiptまで突破するという主張ではない。

> R-02 Reviewer note: 検証済み（静的確認）：scripts/migration-preflight/assets.tsのextractTarは引き続きsignal/deadline引数のない同期entry/link走査である。最大入力時の取消遅延実測は未検証。

> R-04 Reviewer note: main-only指定に従い、reviewerはmise run migration-preflight-unit/current-unit/browserと記録済み正式verifyを再実行していない。mainのv8実ログからU1単体55/current19のpass、fail/cancel/skip/TODO0を読取り確認した。新短い正式コマンドの人間承認・設定・実行は未完であり、本レビューのread-only照合をその実行と同一視しない。

> R-05 Reviewer note: v8入力と結果のSHAが指定値に一致し、394 currentSource・435 evidenceFilesの全SHA、21子工程のexit0と全rawLogSha256、新候補manifest/tarball、独立consumer31ファイルの一致を確認した。code-summaryは旧v4/v6/v7を当時の履歴と区分し、現在結果をv8だけへ結び付ける。Playwright Node12件を含む1495realmから独立集計した1768/1929行=91.65%もreportと一致。旧結果を現sourceへ再ラベルする欠落は解消。正式verifyの未実行とCI/U3/merge未受入は明示され、R-04と区別する。

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| read-only SHA256によるv8入力・結果照合 | 入力25d44cb9c6def3cdc65317d76add2ecb90b5010fc05f4e097f982cdf98655bd0、結果fe0d5a01fe5e193258f10371d9cd7c3a446b8b820f3005dabcaeca0300b63079、一致 | 新実行の固定証拠を読取り確認した。正式verify自体は実行していない。 |
| read-only source/evidence/log/package照合 | currentSource394、evidence435、21commands全exit0/ログSHA一致、候補manifest/tarball一致、installed31全一致 | 追跡整備後にも封印対象の不変を確認した。U1/U2 local範囲の証拠である。 |
| read-only生counter独立集計 | 1495realm、Playwright Node12、非整数/負数/Int32上限超過0、1768/1929=91.65%、reportのrealm数・行集計と一致 | aggregateだけを信用せず全Node/Worker/browser/Playwright Nodeのrawから算出した。記録のskippedは0。 |
| main実ログの試験要約読取り | U1 55/current19/light193+237/受入CI境界43/U2 44/install74/通常browser9+45/consumer204/既存Node28/browser33/coverageNode115+115/browser99+9+9、すべてpass・該当する失敗/取消/skip/TODO0 | reviewerが試験を再実行した結果ではなく、封印されたmain実行の観測を確認した。 |
| current-coverage.tsと新current-completion.test.tsの静的追跡 | package/session/installのreadPlaywrightNodeRealmsを独立再計算へ追加し、既存の分母/layout/realm/集計一致判定を維持。小さい自己完結fixtureは実生成bootstrapをNode子processで動かし、片側receipt欠落・generation違い・counter改変・realm名改変を拒否する | 製品や過去の1495realm結果の流用ではなく、欠落していた入力経路を検査する回帰になっている。 |
| source-manifest / .gitignore / jj --ignore-working-copy file listによる追跡確認 | 102個別申告pathに欠落なし。.gitignoreを個別claim。exact2JS例外と両JSの追跡を確認、**/*.js.map除外維持 | 通常jj file listはsnapshot時にsandbox拒否されたため、snapshotしないread-only指定で確認した。生成JSはv8封印とも一致し、再生成・編集はしていない。 |
| mise run migration-preflight-unit / mise run migration-preflight-current-unit / 新正式verify | 未実行：dispatchのmain-only指定、正式verifyは承認前 | 独立レビュー内の試験実行は未検証。承認済み実行の前提としない。 |

### Summary

Criticalなし、未解消Major1件・Minor2件のためREADY。v8の現在sourceとraw証拠の対応は確認できたが、新短い正式コマンドの承認・実行、現在の署名CI、U3受入、merge許可は別途未完である。
