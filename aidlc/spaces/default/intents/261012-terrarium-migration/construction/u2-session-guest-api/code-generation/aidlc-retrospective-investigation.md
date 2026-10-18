# AI-DLCの過去の失敗の振り返り — 2026-10-14

対象: このチャットの経緯、移管intentのaudit ERROR_LOGGED 12件と失敗確認記録、更新時の観測、最新版のguard/validator。製品・CI試験の再実行や移管の状態変更は行っていない。

| 候補 | 調査結果 | 扱い |
| --- | --- | --- |
| directory claimに生成source mapがあると受付拒否 | 最新版の実validatorで再現。明示的excludeをsource一覧は尊重するがdirectory受付は尊重しない | 検証済み、Issue #2472起票済み |
| ignored exact fileをjj追跡しても受付拒否 | HEAD収録またはregistry paths登録が条件。index追跡だけを認めないのは上流テストでも期待される仕様。一方、拒否文が登録という対処を案内しない | 最新validatorで同一ignored fileが登録後成功を検証済み。案内改善Issue #2474起票 |
| レビューiteration 2が拒否（intent-capture/units-generation） | auditはnext iteration 1を明示。リセット後の番号を誤指定した操作に整合 | AI-DLC不具合の根拠なし。新規Issueなし |
| baseline-failure / halt-and-ask checkpoint拒否 | CLIの許容enum以外を指定した操作。auditは有効値を列挙 | 呼び出し誤り。新規Issueなし |
| NFR unit completeがno active unitで拒否 | auditではactive unitを開始していない。単独の拒否記録では遷移不具合と断定不可 | 不具合未確認。状態遷移の同一再現なし、起票しない |
| delegated agentの動的実行パス拒否 | 最新guardは解決可能なliteral assignmentを処理し、解決不能の実行名をfail closedと明記 | 安全判定の意図された制約というコード根拠。古い失敗と同一条件の最新実行は未検証、起票しない |
| 非対話PATHでaidlcが見つからない | 更新後、直接launcherとmise実体のversion一致、runtime/trust clean | 現在の設定は検証済み。元の不具合を最新版で再現できる根拠なし |
| 長い計画原文の受渡し失敗 | 初回の正確なコマンドとstderrが今回調査したauditには残っていない。要約で開始できたことだけではOS argv限界/CLI/呼び出しのどれかを判別不可 | 未検証。以前の「文章量だけが原因」という断定を根拠にしない。新規Issueなし |
| update dry-runのSigstore初期化失敗 | 通常sandboxで発生、同一操作をhost権限で実行すると署名検証成功。ネットワーク不能条件のdry-runはexit 3、無効channelはexit 2 | 今回の環境制約に整合。複数コマンドを続けたshellのexit 0はupdate単体の成功証明ではない。新規Issueなし |
| 型不整合・consumer入力欠落・CORS・証明書/実SHA・ビルダーmake・CI Bun絶対パス・pack数・Worker coverage | 各audit decisionは製品試験入力/依存/収集処理の修正に対応する | AI-DLC側の不具合として起票する根拠なし |

## 追加Issue

[Issue #2474](https://github.com/awslabs/aidlc-workflows/issues/2474): ignored-fileレビュー拒否にHEAD条件と明示登録の対処を案内する改善。仕様を緩める要求ではなくFeatureとして起票。Issue/PR検索で同一の対処案内改善を確認できなかった。GitHub connectorの作成権限が403で不足するため既存gh API認証で投稿し、connectorでopenと本文一致を確認。

実再現ログ: .artifacts/migration-session/aidlc-investigation/reproduce-map-claim-expanded.log。実ソースを変更せず一時jj-colocated fixtureのみで実行。map生成後のexact ignored-file claimは拒否し、同じfileをregistry pathsへ登録すると成功した。

今回確定できなかった候補を既知の不具合として報告しない。次に同じ失敗が出たときは版、正確なargv/入力、stderr、状態を保存して最小再現を作り、最新release/mainと既存Issue/PRを照合する。
