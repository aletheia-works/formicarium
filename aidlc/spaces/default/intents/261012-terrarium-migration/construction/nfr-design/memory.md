<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs. Add observations at the review step, not by editing here directly.

## Interpretations
- 2026-10-16T20:35:18Z [unit u4-command] — 機能設計とNFR要件のレビューで後工程扱いにしたMinorを、D1–D5で具体化した。孤立surrogateはINVALID_INPUT。lsは表示文字列順に並べる（a.b が a/ より先）。予約前のabortはABORTED、同期builtinは中断しない。guest runはtimeoutMsを渡さない。commandIdは任意。予約名はJSDocとdocsに明記する。UI条件の受渡しを明記する。browserのbuild番号は実行時に記録する。機能設計traceabilityのFR4欠落はCode Generationの計画で扱う。
2026-10-12T23:21:11Z — [unit u2-session-guest-api] 入力所有権と予約epochの検証位置を具体化。CI最小権限・未信頼PR公開拒否を維持条件として明示し、U2が新しいworkflow/publish権限を持つとは扱わない。
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->

## Deviations
- 2026-10-18T01:40:00Z [unit u7-showcase-guests] — NFR要件のQ1は「contents: readだけ」だったが、Q3=A（mainの直近runのartifactからELFを再利用）にはactions: readが要るため、読取りの範囲で権限を加える設計にした。人間に確認が要る点として扱う。B1のpackはCI artifact（7日）にしかなく、配布候補用の長期保存先はInfrastructure Designで決める。
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->

## Tradeoffs
- 2026-10-18T01:45:00Z [unit u7-showcase-guests] — 1回目のレビューはNOT-READY（Major 3件）。forkのPRは検査そのものを外せるので、PRのrunの成果物を信頼せず、配布と再利用はmainの定義のrunだけに限る設計に改めた。actions: readの追加は人間にQ4で確認した（A）。2回目はREADY（Minor 3件）。Minorは凍結のまま、Infrastructure Design・Code Generationで扱う：provenance.reusedFromRunをcandidateIdから外す、mainのbranch保護の前提とdistributeをmainの定義に限る確認、候補artifactの中身とB1 packの取得元の指定。
- 2026-10-13T19:41:34Z [unit u3-install] — host streamとbounded scannerを設計候補にし、開発用U1 scriptを製品へimportしない。同期guest検証中のabort保証は主張せず、前後のsignal/deadline再確認と実測で安全性を検証する。
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->

## Open questions
- 2026-10-16T20:37:00Z [unit u4-command] — レビューREADY（Minor 4件）。凍結のまま、U4 Code Generation計画へ反映する：(1) 孤立surrogateの検出方法を1つに決める（`String.prototype.isWellFormed()` を使い、Node/browserで同じ判定にする）。(2) lsの並べ替えは、NFR設計D4（表示文字列順）が機能設計W6（名前順）より優先すると計画に明記する。(3) 判定の順序はINVALID_INPUT（予約前の検証）→ABORTED（事前abort）→予約時のDISPOSED/BUSYとし、試験で固定する。(4) `install ls@x` のように予約名のtoolを登録できる件は、JSDocだけでなくdocsと試験でも示す。
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
