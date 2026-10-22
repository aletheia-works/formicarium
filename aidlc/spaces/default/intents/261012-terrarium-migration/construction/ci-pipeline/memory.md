<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs. Add observations at the review step, not by editing here directly.

## Interpretations
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->

## Deviations
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->
- 2026-10-22T09:45:00Z — PR の CI に足す試験は、新しい job ではなく既存の product-regression の node の suite に step を1つ足した; その suite は build と製品を持ち、ci-required は product-tests を通してそれを要るので、必須の check と ruleset を変えずに済んだ。

## Tradeoffs
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->
- 2026-10-22T09:45:00Z — 境界の確認が FAIL のとき、U1・U3・U9 に戻って直した; U1 は code の修正と36試行、U3 は観測と正式な完了確認、U9 は直せない理由の記録。残った U9 の NFR8.2 の1行は、人間の判断で失敗のまま記録して Operation へ進んだ。

## Open questions
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
