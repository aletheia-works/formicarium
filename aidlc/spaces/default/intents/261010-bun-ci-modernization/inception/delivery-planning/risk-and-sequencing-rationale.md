# Risk and Sequencing Rationale

## Economic Rationale

Bolt（実装を動く結果まで仕上げる作業）の順序は、最小の統合経路を先に確かめるCockburnの考え方と、その後に人間が選んだ日常保守の価値を優先する方針に基づく。形式的な点数付けは追加しない。U1で移行の成立を確かめ、U2/U3で通常運用の負担を減らし、U4で未来の公開経路を整える。

U3の前提U1/U2、U4の前提U1を満たす順序で、承認済みDAGからの逸脱はない。別案U1→U4→U2→U3は公開準備を早めるが、人間は保守自動化を優先する回答を選んだ。完了の順序は実際のUnit設定と依存DAGに従い、文書だけで実行順を変更しない。

## Risk Register

| Risk | Likelihood | Impact | 対応と確認時期 |
|---|---|---|---|
| BunとNode固有生成・Worker・coverageの不適合 | Medium | High | B1でbaselineとconsumer回帰、Node境界を明示 |
| 整形pushがlint成功待ちで成立しない／merge条件が緩む | Medium | High | 受け入れ済み契約R-01を保持。B2/B3で操作別の正負試験を実施、矛盾は失敗として扱う |
| 古いhead・改変artifactによる誤書込み | Medium | High | B2/B3で出所・digest・head照合、条件付きAPI、拒否executor0回 |
| GitHub権限・required checks・token設定が不足 | Medium | High | B3で具体設定と費用・権限を提示。未適用は未運用として記録 |
| 軽量CIを回帰・coverage合格と読み替える | Medium | High | B1/B4でpurposeと固定inventoryを照合 |
| 公開gateや既存RCへの影響 | Low | High | B4で拒否回帰、RCタグ・入力・dist-tag不変更 |

## Accepted Concern and Sources

contract-designの操作別required checks指摘は人間がApproveで受け入れた。解消済みとも、要求緩和の承認とも扱わない。後続の設計・試験で観測し、整形pushと依存mergeの受入れ条件を満たせない場合は完成としない。

根拠：../requirements-analysis/requirements.md、../domain-design/components.md、../units-generation/unit-of-work-dependency.md、unit-of-work-story-map.md、../contract-design/contract-summary.md、delivery-planning-questions.md、../practices-discovery/team-practices.md。
