# Bolt Plan

## Sequence

Bolt（ひとまとまりの実装を動く結果まで仕上げる作業）を1単位ごとに区切る。人間の優先回答に従いU1→U2→U3→U4とする。依存関係に逆行しない。各単位の設計とコード生成を逐次進める既存設定を維持し、並行実行への変更はしない。

| Bolt | Unit | 内容 | 所有者 |
|---|---|---|---|
| B1 | U1 u1-bun-quality | Bun・通常CI・品質経路 | aidlc-developer-agent |
| B2 | U2 u2-maintenance-policy | 副作用なしの保守判定 | aidlc-developer-agent |
| B3 | U3 u3-maintenance-workflows | 保守workflowと外部入口 | aidlc-developer-agent |
| B4 | U4 u4-publication-alignment | 公開workflowの適合 | aidlc-developer-agent |

## Definitions of Done and Demonstrations

### B1

最小の統合経路として、固定Bunのcacheなしfrozen導入からlint・型検査・build・軽量testまで成功する。lock不一致は失敗。通常PR/main CIとcommit形式検査の結果が当該sourceへ対応し、Node/browser consumerを維持する。重い回帰・固定第一者JS80%coverageは軽量CIと区別して記録する。

仮説：Bunによる開発依存管理が、生成JSとNode/browser製品境界を維持したまま動く。デモはclean作業場所での導入→生成→対象testの実出力。最初のcheckpointで使う実検証commandは、人間に個別確認して固定する。設計承認だけを実行済みと扱わない。

### B2

共通照合と整形/依存判定を外部APIなしで実装する。正常例、直接依存0/1/2件、非整形、不一致、fork、古い証拠、混合・公開・Action変更の拒否を観測する。判定はcredential/executorを受け取らない。

仮説：許可条件を純粋な判定と固定fixtureで再現できる。デモは正常・拒否のnamed testsと理由。契約の操作別必要checksの未定義は受け入れ済みの懸念として残り、整形失敗時のpushと同じ証拠でのmerge拒否を検証対象にする。動作が要求と矛盾すれば修正計画へ戻し、成功と記録しない。

### B3

更新PR・ラベル設定と2つの外部入口を実装し、信頼元・artifact・現在head・expected head・最小権限・重複防止を確認する。拒否時は偽executor0回、許可時は対象操作1回。整形後に新SHAの通常CIが走る経路を確認する。保守手順・設定未適用の区別を記載する。

仮説：判定と操作を分けても、stale結果や未信頼コードによる誤push/mergeを拒否できる。デモは偽executor試験と、個別承認後に可能なGitHub実CIの結果。外部適用前はローカル検証済みと実運用済みを区別する。expected headを原子的に保証できなければ自動操作を拒否する。

### B4

既存の公開gateをBun開発基盤へ接続し、未来のRC/stable版の検査、改変・未承認・coverage不足で公開executor0回、Node/browser consumerの維持を確認する。OIDC用CLIを明示し、既存RCタグ・固定入力・dist-tagを変更しない。

仮説：開発Bun化後も承認済み候補と証拠の一致だけが公開開始を許す。デモはgate拒否試験とworkflow検査。npm公開やRelease作成は今回の完了条件に含めない。

## Common Completion Boundary

完了は実装・観測結果・必要レビュー・checkpointの承認に基づく。統合前に当該SHAの実CIと固定第一者JS coverage80%以上、既存品質上限、全体回帰を満たす。Build and Testは全単位の完成後に全体確認を行う。token・外部設定・pushは具体的な対象と結果に対する既存の承認条件を維持する。

根拠：../requirements-analysis/requirements.md、../domain-design/components.md、../units-generation/unit-of-work.md、unit-of-work-dependency.md、unit-of-work-story-map.md、../contract-design/contract-summary.md、../practices-discovery/team-practices.md、delivery-planning-questions.md。
