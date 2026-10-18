# Unit of Work

## Unit Definitions

承認済みの分割計画。実装・動作は未検証。すべて同じrepositoryへ配置し、mainへの統合を対象とする。独立した新サービスや公開packageを増やさない。

| Unit ID | Directory | Kind | Components | Deployment | Complexity |
|---|---|---|---|---|---|
| U1 | u1-bun-quality | packaging | DevelopmentTasks, QualityVerification | shared | L |
| U2 | u2-maintenance-policy | library | MaintenancePolicy | embedded | M |
| U3 | u3-maintenance-workflows | packaging | MaintenanceOperations | shared | L |
| U4 | u4-publication-alignment | packaging | PublicationBoundary | shared | M |

## Responsibilities and Boundaries

### U1: Bun・品質検証

package.json、bun.lock、mise task、開発・生成JSコマンド、通常PR/main CI、commit形式検査、検証手順を担当する。package-lock.jsonを除去する。既存の重い回帰・配布coverage経路をBun開発環境へ接続し、軽量CIと区別する。ToolchainDefinitionとVerificationEvidenceを所有する。

この単位だけでfrozen導入→lint→型検査→ビルド→軽量テストまで実行可能な統合経路を作る。以降の保守単位がなくても動く。Node固有flag・process.execPath・Worker・consumer確認はNode runtimeを明示する。統合前には当該SHAの実CIと固定第一者JS coverage80%以上を必要とし、軽量成功で代用しない。

### U2: 保守判定

保守判定の共有コードと試験を担当する。MaintenanceDecisionを所有し、head・信頼元・証拠・許可パス・整形差分再現・唯一の直接依存変更とlock再現を照合する。入力取得・credential・API呼出し・push・mergeを持たない。U1が作る実CIを要求せず、取得済みの証拠をfixtureとして単独検証できる。

整形以外の差分、改変・古い証拠、fork、不明分類を拒否する。直接依存0件・2件以上、major・prerelease・allowlist外・Action更新・公開境界・混合差分・lock不一致・非成功checksを拒否する。判定契約と固定fixtureをU3へ提供する。

### U3: 保守workflow

更新PR設定、PRラベル、整形pushと依存mergeの個別入口、必要な権限・token・repository設定の手順、拒否・障害時の復旧資料を担当する。MaintenanceAttemptを所有する。U1の現在headに対応するchecksとU2の判定を利用する。

外部情報の取得と操作直前の再照合、expected head条件、重複操作防止、結果記録を担当する。拒否時の偽executor起動0回を検証する。書込みcredentialのある環境でPR由来script・config・依存導入を実行しない。commit形式検査の実行担当はU1であり、この単位は必要checksの一つとしてその結果を参照する。

### U4: 公開workflow適合

publish.ymlと公開検査のBun開発基盤への接続、未来のRC/stable版に対応する検査、版別の公開手順を担当する。PublicationInputを所有する。U1のtoolchainと候補検証証拠を利用する。既存の公開CLIを再利用し、source・tarball・入力SHA・承認・provenance・coverageの境界を維持する。

未承認版・不足証拠・改変時の公開executor起動0回を確認する。既存RCを再公開せず、タグ・固定入力・dist-tagを変更しない。npm OIDC用CLIは開発Bunとは別に必要性を明示する。通常CI・保守workflowへOIDC公開権限を渡さない。

## Ownership and Integration

共通CIと開発taskの所有者はU1、判定コードはU2、保守入口と設定はU3、公開入口はU4。U3/U4はU1の共有workflowやtaskへ無断で重複定義を追加せず、変更が必要な場合は契約と担当範囲を調整する。READMEの開発・品質節はU1、保守節はU3、公開節はU4が担当する。

unitのkindは設計資料の適用範囲を示す。packagingでも権限・入力拒否・実行結果の検証を免除しない。コードとworkflowを別々の外部サービスとして扱わない。

## Constraints and Sources

jjを使い、ビルド・テストはmain sessionで逐次実行する。既存品質上限、Node/browser API、Atomics.waitAsync除去を維持する。コア/JIT・未変更guest再ビルド・無関係な整形は対象外。外部push・設定適用・公開には具体的結果に対する既存の承認条件が適用される。

根拠：../domain-design/components.md、../domain-design/decisions.md、../requirements-analysis/requirements.md、units-generation-questions.md。実装順と優先順位はDelivery Planningで決める。
