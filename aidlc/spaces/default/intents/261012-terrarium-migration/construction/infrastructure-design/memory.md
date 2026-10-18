<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs. Add observations at the review step, not by editing here directly.

## Interpretations
- 2026-10-16T20:40:47Z [unit u4-command] — U3で受入済みの専用CI経路の構成（固定入力、全realm coverageとrunner台帳、job専用CAのFirefox profile、独立ZIP照合、短い完了確認コマンド）を基に、U4とB1統合受入（C06の必須check集合）を設計した。U3の証拠や完了確認コマンドは流用しない。workflow名・branch名・CI入力の具体値は、Code Generationの計画で承認を受ける。
- 2026-10-13T19:45:45Z [unit u3-install] — 既存U2 CIは専用16JS分母なのでU3の成功へ再ラベルしない。新source/pack/coverage/正式36試行を準備し、localhost証明書登録とpush/CIは具体コマンドの承認後だけ実施する。
- 2026-10-18T01:55:00Z [unit u7-showcase-guests] — クラウド資源なし。GitHub Actions・Release・repositoryの設定だけで設計した。人間の回答はQ1〜Q3すべてA（B1のpackはReleaseのprerelease資産、repositoryの保護はformicarium内のOpenTofu、失敗は標準通知とjob summary）。NFR Design 2回目のMinorも反映した（candidateIdからrun固有の記録を除く、distributeをmainのU8 workflowに限る条件、候補artifactの中身とb1-pack.json）。upstreamのrulesetは空で、Actionsの設定は権限がなく読めなかった。
2026-10-12T23:23:13Z — [unit u2-session-guest-api] 新規cloud基盤なし。既存CI/pack/realm coverage経路へのAPI試験追加だけを設計し、具体コマンド・push対象は実装計画へ委譲した。
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->

## Deviations
- 2026-10-18T01:58:00Z [unit u7-showcase-guests] — 1回目のレビューはNOT-READY（Major 4件）。workflow_callの中のgithub contextは呼出し元のものなので、distributeの条件と再利用元の条件を直した。CODEOWNERSが1人だけでレビュー必須にできないため、人間にQ4で確認し、terrariumと同じruleset（承認数0、code owner review不要、admin bypass、必須checkはci-requiredだけ）にした（Q2の「CODEOWNERSのレビュー」とNFR Design §2を人間の判断で改めた）。2回目はREADY（Minor 3件）。Minorは凍結のまま、Code Generationで扱う：terrariumのmain.tfはrulesetのimport blockを持たずstateの正本はCI artifactなので、import手順を文書にする。「最後の配布可能runからの日数」を書くjobを決める。前のcommitへの切戻しはU8からdistributeで呼ぶ必要がある。
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->

## Tradeoffs
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->

## Open questions
- 2026-10-16T20:43:48Z [unit u4-command] — レビューREADY（Minor 3件）。凍結のまま、U4 Code Generation計画へ反映する：(1) Pipeline 7のB1証拠に、C06の名前付きfield（preflightEvidenceId・logSha256）を含める。Node/3browserの各行を、ローカル実行とCI実行のどちらから取るかを明記する。(2) CI artifactの保持期間（1日）が、人間の承認待ち（Pipeline 10→11）の間に切れないようにする。保持期間を延ばすか、run完了の直後に取得する手順を計画に入れる。(3) traceabilityのNFR2.1・NFR8.2を、節単位ではなく具体的なcheckへ対応付ける。
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
