# Team Allocation

## Ownership

Bolt（実装を動く結果まで仕上げる作業）は全4件ともaidlc-developer-agent（AI）が実装責任を持つ。Team Formationは今回のclassicで適用外。現時点で人間の別チームへのUnit所有は設定していない。作業はこの会話から進め、各stageで指定された担当とレビューを使う。

| Bolt | Unit | 主担当 | 検証 |
|---|---|---|---|
| B1 | U1 | aidlc-developer-agent | main sessionで逐次 |
| B2 | U2 | aidlc-developer-agent | main sessionで逐次 |
| B3 | U3 | aidlc-developer-agent | main sessionで逐次 |
| B4 | U4 | aidlc-developer-agent | main sessionで逐次 |

## Coordination

単位ごとの設計とコード生成を逐次行う既存設定を保持する。複数チームでの所有やswarm実行は人間の選択なしに有効化しない。担当files・README節は../units-generation/unit-of-work.mdの所有に従い、他単位の変更を取り消さない。

ローカルrepository操作はjj。隔離作業場所を承認済みmainから作り、rootにある過去intentの記録や差分を製品の同一sourceと推定しない。新たなpush・設定適用には具体的な変更結果を提示する。

人間は「この会話で進める」を選択し、solo所有を記録済み。根拠：../domain-design/components.md、../units-generation/unit-of-work.md、../practices-discovery/team-practices.md、delivery-planning-questions.md。
