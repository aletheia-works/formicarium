<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs. Add observations at the review step, not by editing here directly.

## Interpretations
- 2026-10-19T12:05:00Z [unit u8-showcase-site] — NFR Design の残りの Major は Q1=A（PR・push の pack は PR 自身の commit から作り、照合の (6) を verify だけ緩める）で解いた。Q2=B で Pages と github-pages の environment を OpenTofu で管理するので、token に Pages・Environments の権限を足す人の作業と、最初の deploy の後に reviewers を外す PR が要る。承認者は CODEOWNERS の JamBalaya56562 を既定にし、OpenTofu の PR の承認のときに変えられるとした。provider の下限を最新の 6.13 に上げる。
- 2026-10-16T20:40:47Z [unit u4-command] — U3で受入済みの専用CI経路の構成（固定入力、全realm coverageとrunner台帳、job専用CAのFirefox profile、独立ZIP照合、短い完了確認コマンド）を基に、U4とB1統合受入（C06の必須check集合）を設計した。U3の証拠や完了確認コマンドは流用しない。workflow名・branch名・CI入力の具体値は、Code Generationの計画で承認を受ける。
- 2026-10-13T19:45:45Z [unit u3-install] — 既存U2 CIは専用16JS分母なのでU3の成功へ再ラベルしない。新source/pack/coverage/正式36試行を準備し、localhost証明書登録とpush/CIは具体コマンドの承認後だけ実施する。
- 2026-10-18T01:55:00Z [unit u7-showcase-guests] — クラウド資源なし。GitHub Actions・Release・repositoryの設定だけで設計した。人間の回答はQ1〜Q3すべてA（B1のpackはReleaseのprerelease資産、repositoryの保護はformicarium内のOpenTofu、失敗は標準通知とjob summary）。NFR Design 2回目のMinorも反映した（candidateIdからrun固有の記録を除く、distributeをmainのU8 workflowに限る条件、候補artifactの中身とb1-pack.json）。upstreamのrulesetは空で、Actionsの設定は権限がなく読めなかった。
2026-10-12T23:23:13Z — [unit u2-session-guest-api] 新規cloud基盤なし。既存CI/pack/realm coverage経路へのAPI試験追加だけを設計し、具体コマンド・push対象は実装計画へ委譲した。
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->

## Deviations
- 2026-10-18T01:58:00Z [unit u7-showcase-guests] — 1回目のレビューはNOT-READY（Major 4件）。workflow_callの中のgithub contextは呼出し元のものなので、distributeの条件と再利用元の条件を直した。CODEOWNERSが1人だけでレビュー必須にできないため、人間にQ4で確認し、terrariumと同じruleset（承認数0、code owner review不要、admin bypass、必須checkはci-requiredだけ）にした（Q2の「CODEOWNERSのレビュー」とNFR Design §2を人間の判断で改めた）。2回目はREADY（Minor 3件）。Minorは凍結のまま、Code Generationで扱う：terrariumのmain.tfはrulesetのimport blockを持たずstateの正本はCI artifactなので、import手順を文書にする。「最後の配布可能runからの日数」を書くjobを決める。前のcommitへの切戻しはU8からdistributeで呼ぶ必要がある。
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->

## Tradeoffs
- 2026-10-19T02:40:00Z [unit u6-recipe-runtime] — クラウドの資源は無く、GitHub Pages・Actions・Release・npm だけで設計した。公式の上限（公開 site 1GB、deploy 10分、転送量 月100GB の soft）を確かめ、転送量は1回の訪問で約219MiB のため約460回で届くと人間に示した。人間の回答 Q1=A（自動の判定のまま、通知が来たら見直す）、Q2=A（U7 と同じ通知と job summary）。regression の3ブラウザは main の ruleset の必須 check なので、PR の照合の失敗で merge が止まる。matrix の各 job が自分で取得し、job の間で artifact を信用しない（取得の重複は受け入れる）。
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->

## Open questions
- 2026-10-19T12:10:00Z [unit u8-showcase-site] — review-02 READY（Minor 4件）。設計は凍結のまま、Code Generation の計画で扱う：(1) coverage の needs を accept の3つと build にし、accept・deploy の `if` を式で書く。(2) 置き換えの表に、security-design の S7（deploy の needs の全列挙、PR・push の run は deploy の job を持たない）と S15 の fork の記述を加える。(3) traceability.json の工程番号を今の cicd-pipeline に合わせる（build は12工程、配置は工程8、照合は工程3）。(4) fetch-candidate の「候補が無い・期限切れ」の試験を足す。showcase-site.yml を main に入れるのは、基盤の apply と最初の deploy の承認の準備ができた後にする（先に入れると 04:17 UTC の schedule が Pages の無い状態で失敗し通知が出る）。加えて人が確かめること：repository の変数 FORMICARIUM_INFRA_APPLY_ENABLED の値と、Actions の artifact の既定の保持期間（main session の account では 403）。NFR Design から持ち越した buffer の件は buffer.ts とその試験で扱う。
- 2026-10-19T03:00:00Z [unit u6-recipe-runtime] — 1回目のレビューは NOT-READY（Major 2件：vivarium の `.gitignore` と開発用 server の変更の一覧が無い、coverage 80% の merge 前の gate が無い）。変更の一覧と、必須 check `regression (chromium)` の中の coverage の step を足した。2回目は READY（Minor 2件）。凍結のまま Code Generation の計画で扱う：(1) R-09 AssetStager の全体6分は C11 に無い運用上の上限（厳しくする向き）。計測で見直すときは人の承認を受ける。(2) R-10 job の時間の予算に coverage の step を入れる（chromium の job だけ長くなる）。coverage の artifact の保持期間を決める。
- 2026-10-16T20:43:48Z [unit u4-command] — レビューREADY（Minor 3件）。凍結のまま、U4 Code Generation計画へ反映する：(1) Pipeline 7のB1証拠に、C06の名前付きfield（preflightEvidenceId・logSha256）を含める。Node/3browserの各行を、ローカル実行とCI実行のどちらから取るかを明記する。(2) CI artifactの保持期間（1日）が、人間の承認待ち（Pipeline 10→11）の間に切れないようにする。保持期間を延ばすか、run完了の直後に取得する手順を計画に入れる。(3) traceabilityのNFR2.1・NFR8.2を、節単位ではなく具体的なcheckへ対応付ける。
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
