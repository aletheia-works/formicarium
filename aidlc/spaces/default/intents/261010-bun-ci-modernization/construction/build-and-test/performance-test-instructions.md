# Performance Test Instructions

## Targets

全てmain sessionで逐次実行。mise task又はmise管理の実体を使う。未変更guestを再ビルドせず、外部push・設定適用・公開は別承認。各単位の承認済み code-generation-plan.md、unit-test-instructions.md、code-summary.mdを入力とする。

source-complete target inventoryはbuild-and-test-summary.mdを参照。保守read要求10秒/全60秒/retry最大2、write一回。公開30分job/タグconcurrency、archive stream/展開/member上限。fake clockと容量境界試験を使い、ゲスト速度改善を主張しない。

## Candidate Regression

既存candidate-required経路のprobe600秒、aube browser840秒、1worker、retry0、8probe、native出力一致、wasm1GBを維持。実候補のnative/browser回帰と全realm行coverage80%は未検証。後続性能検証stageはSKIPなので成功扱いで繰り延べない。aube再ビルド・JIT・無関係benchmarkは対象外。
