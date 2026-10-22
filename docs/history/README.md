# 作業の記録

これまでの作業ごとに、目的・決定・設計の要点・品質の目標と結果・残った課題をまとめたもの。どれも記録の時点の内容で、今の手順や API は各トピックの文書（[`../`](../)）を正とする。

| 期間              | 作業                                           | 文書                                                                           |
| ----------------- | ---------------------------------------------- | ------------------------------------------------------------------------------ |
| 2026-10-03〜10-05 | blink を wasm で動かす PoC                     | [261003-blink-wasm-poc.md](261003-blink-wasm-poc.md)                           |
| 2026-10-05〜10-06 | pitchfork を formicarium で動かす PoC          | [261005-pitchfork-on-blink.md](261005-pitchfork-on-blink.md)                   |
| 2026-10-06〜10-10 | npm パッケージ化と terrarium への組込み        | [261006-npm-terrarium-release.md](261006-npm-terrarium-release.md)             |
| 2026-10-10〜10-12 | Bun 移行と CI の整備                           | [261010-bun-ci-modernization.md](261010-bun-ci-modernization.md)               |
| 2026-10-12〜10-22 | terrarium からの移行：目的・要件・全体設計     | [261012-terrarium-migration-plan.md](261012-terrarium-migration-plan.md)       |
| 2026-10-12〜10-22 | terrarium からの移行：各部分の設計・検証・運用 | [261012-terrarium-migration-results.md](261012-terrarium-migration-results.md) |

元の詳しい記録（要件、設計、試験の証拠など）は、git の commit `8096c7b4` の `aidlc/spaces/default/intents/` にある。

```bash
jj file list -r 8096c7b4 'aidlc/spaces/default/intents/261012-terrarium-migration'
```
