<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs. Add observations at the review step, not by editing here directly.

## Interpretations
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->
- 2026-10-22T11:00:00Z — 公開の承認は release PR の merge とした; 人間の回答。release environment に reviewers は付けず、runbook の冒頭に「merge＝公開の承認」と書いた。

## Deviations
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->
- 2026-10-22T11:00:00Z — 質問の前提を2つ誤り、回答の後に直した; Q1 は毎週の自動の merge が止まっている（WEEKLY_RELEASE_MERGE_ENABLED=false）ことを確かめずに書き、Q4 は GitHub Pages の公式の文書を読まずに「1 file 100 MB」と書いた。どちらも訂正を質問の file に残し、人間に確かめ直した。

## Tradeoffs
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->

## Open questions
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
