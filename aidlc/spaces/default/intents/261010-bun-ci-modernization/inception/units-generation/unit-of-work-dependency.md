# Unit Dependencies

## Dependency DAG

```yaml
units:
  - name: u1-bun-quality
    kind: packaging
    depends_on: []
  - name: u2-maintenance-policy
    kind: library
    depends_on: []
  - name: u3-maintenance-workflows
    kind: packaging
    depends_on: [u1-bun-quality, u2-maintenance-policy]
  - name: u4-publication-alignment
    kind: packaging
    depends_on: [u1-bun-quality]
```

辺は「利用側が依存先を必要とする」を表す。U3→U1、U3→U2、U4→U1。全4単位を一度ずつ宣言し、自己参照・循環なし。

## Integration Points

| 利用側 | 提供側 | 接続 |
|---|---|---|
| U3 | U1 | 現在headのcheck結果、workflow/run/SHA/artifact識別、固定toolchainと生成task |
| U3 | U2 | 入力を受ける純粋判定、許可又は理由付き拒否、固定fixtureによる契約試験 |
| U4 | U1 | 固定依存導入、sourceに対応した候補回帰・coverage証拠。軽量CIの証拠とは区別 |

具体schema、公開method、workflow check名はContract Designで定義する。U2の照合対象である証拠は入力データであり、実CIを呼ぶ依存ではない。

## Integrated Slice and Independent Work

U1は独立したBun依存導入から通常CIの軽量検査までの実行経路を持つため、後続単位なしで最小統合経路を実証できる。残る単位を先に作らなければ実行できない設計文書だけの単位にしない。skeletonの適用と具体的検証command・checkpointは後続段階で確認する。

U1とU2には互いの依存がない。前提が整えばU3とU4も互いの依存がない。ただしこれは並行可能性の記述であり、並行build/testの許可や実行順の指定ではない。ビルド・テストは逐次実行し、経済的な優先順位とBolt構成はDelivery Planningで決める。

## Sources and Verification Status

unit-of-work.md、units-generation-questions.md、../domain-design/components.md、../domain-design/decisions.md、../requirements-analysis/requirements.md。DAGは設計案で、各単位の実装・外部運用は未検証。
