<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs. Add observations at the review step, not by editing here directly.

## Interpretations
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->
- 2026-10-22T06:14:14Z — 後の段階が持つ配布・観測の8件は N/A ではなく Unverified とした; stage file は N/A を CI の義務にだけ認め、延期した確認は Unverified のまま成功に数えないと定めるため。そのため Code Generation の修正だけでは Build and Test は全部の合格にならない。

## Deviations
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->
- 2026-10-22T06:14:14Z — Loop-back を2回行った; 1回目は U3・U4 の runner-ready 試験の Node の patch 固定（PR #65）、2回目は showcase の2つの workflow の Node の固定（PR #66）と追跡表の target（U5・U7）。どちらも最新の道具を使う決まりに合わない固定が原因で、基準は緩めていない。
- 2026-10-22T06:14:14Z — U1 の preflight の mirror の資産を、実行する作業場所（.artifacts/ws-biome）の .artifacts の下に写して manifest の path だけ直した; serve.ts が mirror の file を project の .artifacts の下に限るため。資産の中身と固定値は変えていない。
- 2026-10-22T09:36:47Z — 独立した consumer は、どの project の外にも置く; project の .artifacts の中に置くと、npm が上の階層の package.json に install して main checkout を変え、TypeScript が上の階層の tsconfig.json を見つけて試験が TS5112 で失敗した。人間の判断で session の scratchpad に置いて成功した。

## Tradeoffs
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->
- 2026-10-22T06:14:14Z — U5 の追跡表は、vivarium だけが実装する行を N/A と理由で表した（人間の決定 A）; 道具が workspace の外の file を読めないため。代わりに「そのまま残して所見にする」案もあったが、集計を通す方を人間が選んだ。N/A は「別のリポジトリで実装」の意味であると表の note に書いた。

## Open questions
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
- 2026-10-22T06:14:14Z — U1・U3 の GAP 9行と U9 の Deferred 1行は追跡の確認を Fail のままにする; 承認の場で人間の判断が要る。U1-NFR1.2、vivarium の Biome、TC-1 は人間が後で扱うと決めた。
