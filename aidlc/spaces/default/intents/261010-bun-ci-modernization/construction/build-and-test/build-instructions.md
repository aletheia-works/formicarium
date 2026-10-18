# Build Instructions

## Inputs and Setup

全てmain sessionで逐次実行。mise task又はmise管理の実体を使う。未変更guestを再ビルドせず、外部push・設定適用・公開は別承認。各単位の承認済み code-generation-plan.md、unit-test-instructions.md、code-summary.mdを入力とする。

Bun1.4.2、Node24.21.0、Biome2.5.15、text bun.lock。既存依存の解決版とignore-scriptsを維持する。

## Commands

`mise run install-frozen && mise run check && mise run typecheck && mise run build && mise run test-light`

buildが失敗したら古いemitを試験証拠に使わない。直近正式U4 checkpoint 76ce3e39-7ef5-43a2-8bfe-b6f7f35a6d60 はexit0、既存177pass/2skip、新tooling234pass。これは実CI・coverageの代替ではない。
