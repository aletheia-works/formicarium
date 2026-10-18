<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs. Add observations at the review step, not by editing here directly.

## Interpretations
- 2026-10-09T11:05:00Z — 人間承認済みSteps85–88では新しい製品変更がなく、mainが保存346file・候補24file・runtime14・traceability57・component14と現identityを照合した。exit0とrunner3/3成功を観測し、coverage87.78%/1253realmと現sessionSafari5caseは保存済みの実行結果として再レビューへ渡す。全suite再実行と区別し、遠隔CI・公開・旧Safari原因の未検証を保持する。
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->

## Deviations

- 2026-10-10T04:39:23Z [unit u4-release-assurance] — 最初の手動release実行がsessionへyieldした後にCI試験を開始し、短時間重複した。性能測定はなく、逐次検証の証拠には使用しない。mainと隔離候補でcloseを待つrun-local.mjsにより正式build→release35→CI13を逐次再実行し全成功を原ログ付きで保存した。
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->

## Tradeoffs

- U3承認済み修復のmain検証：正式assembleCandidateを明示local sourceRoot/inputs/destination/main bundle callbackで利用しcandidate v2を作成。外部source78/tgz/guest不変、scoped46/bridge6/専用45合格。asset stagingだけではiframe /web/のindex.html/terminal.mjsが欠けるため完全host組立てを採用した。coverage v2 sealはmember外部symlinkを拒否、検査を緩めず依存をowned workspaceへ展開コピー。main回帰16件とfreshv3 seal/Node30件合格、browserと最終閾値は測定中。旧失敗世代・歴史owner承認を保持。

- 2026-10-09T12:11:00Z（U3）: 検証済み。保存audit原111851bytesのprefixと現在113715bytesを別々に記録し、許可された非承認追記13eventのみ受け入れた。修正前回帰12件中5件失敗、修正後初回11合格/1失敗はshortened fixtureの削除改行を追記先頭で復元していた。人間の再開承認後、実文字も削除し異なるprefixをassertした同12件が全合格。外部owner結果は歴史的観測として受入れ、現U1v9候補の実行成功やowner新承認とは扱わない。
- 2026-10-09T11:43:28Z [unit u2-guest-distribution] — 保存された測定結果を現在のソースへ適用する前に、測定copyのTS・実行JS・供給候補のSHA256を照合する。古いreview snapshotとの2ファイル差異は最新v3測定copyと一致した。配布3JSと候補11ファイルも一致し、不要な再ビルド・再測定を行わず完了資料を整合する。
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->

## Open questions
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->

## Interpretations
- 2026-10-07T12:40:00Z — 人間のApprove Planに対する保護された承認記録を取得し、U1実装へ進む。終了候補はcleanup後commitとし、明記した内部期限の短縮と既存外側限界の維持を承認対象に含めた。

## Open questions
- 2026-10-07T12:40:00Z — このMacの既存ビルド成果物が欠落しており、事前suiteは32件中24pass・8failを観測した。固定コアコミットをjjで取得しDockerを起動、既存手順で再ビルド中。製品tarball・realWorker・coverageの成功はまだ未検証。

### 2026-10-07T13:48:42Z
- Observation: exact tarball consumer trials found browser pthread descendants active after forced outer termination; direct real-pthread timer oracle reproduced Chromium abort/timeout and WebKit abort. Host-owned descendant broker fixed it; v3 all three-browser consumer/nested/broker 33 passed.
- Decision: generated blink Node-only workerData is normalized in core, generic host options validation remains strict. Missing Worker asset and current unsupported-major child control were reproduced in all browsers, then v4 corrected classification and preflight cancellation; 15 browser regression cases passed.
- Evidence: v4 tgz SHA256 3fc9bc589c624cf5f9854c863198532e119b1467faad8e79c1b996e3ff05cc06; external empty consumer Node 15 passed. v3 collector readiness retained host plus 17 Node Worker realms and 94 tests passed, not final coverage acceptance.
- Remaining: final v4 browser suite and full 13-file merged coverage, independent review and next required checkpoint. Real Safari, broad guest regressions, CI and publication remain unverified.

## Interpretations — 2026-10-07T18:12Z

人間のApprove Planを今回の段階のreceiptへ記録。mainのみ試験し、実生成loader差替えRedをNode2件と3browserでmarker1として観測してからGreenへ進んだ。cwdもNodeENOENT/CORE_INITと3browserCORE_INITのRed後に親復元を修正。旧v4成功は修正証明に流用しない。

## Tradeoffs — 2026-10-07T18:12Z

回答Aに従うBlobは明示CSP許可を必要とし任意Blob child許可へ広げない。host台帳がroot強制終了後の資源解放を所有。browser pthread bootstrapが第一者moduleを読むため全childrealmをcoverage収集へ加える。中間v5/v6と最終候補を混同せず、文書凍結後に新候補を作る。
