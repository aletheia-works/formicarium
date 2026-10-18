# RAID Log

## Risks

| ID | リスク/影響 | 対応・閉じる証拠 | 担当 |
|---|---|---|---|
| R01 | Releaseリダイレクト/CORSでinstall不可 | フェーズ0の3ブラウザfetch、不可なら同originミラー | 実装担当 |
| R02 | 非DL処理が遅く空端末の導入体験不成立 | 工程別時間、閾値確定、設計変更/事前導入 | 実装担当・ユーザー |
| R03 | 固定ビルドで依存やbuilder変更が追跡できない | 完全入力キー/build-info、2回目同digest再利用 | CI担当 |
| R04 | 公開API移管が現行UI/Contractを壊す | deprecated互換、旧verdict比較、Node/3ブラウザ受入 | 実装担当 |
| R05 | 先行退役で利用者/下流が停止 | 4/6完了、依存調査、移行案内、具体的承認後7 | ユーザー・運用担当 |
| R06 | CI容量/権限/ライセンス不足 | 試行と配布前の実在確認、必要費用は事前相談 | CI担当・ユーザー |

## Assumptions

| ID | 仮定（未検証） | 検証方法 |
|---|---|---|
| A01 | terrariumの既存builderを境界変更で移せる | baseline1件試行、pitchfork依存固定を後続試験 |
| A02 | GitHub Releaseを固定成果物の保存先に使える | 権限・quota・catalog/digest照合、同一入力再利用 |
| A03 | 既存COI/CSPでbundle済みAPIを動かせる | vivarium3ブラウザでcommit照合とverdict一致 |

## Issues

| ID | 現在の問題 | 解消条件 |
|---|---|---|
| I01 | フェーズ0計測とbaseline試行は未実施 | docs/resultsの測定とCI証拠を揃えてから大規模移管 |
| I02 | 個人inputs.tar.gz依存がworkflowに残る | 全関連repo検索と公開API置換後consumer検証 |
| I03 | ローカルprivate rcと公開0.2.1の基点不一致 | jj履歴/公開sourceを照合し作業基点を確定 |
| I04 | Safari実機、file-backed MADV_DONTNEED等の既知未解決事項 | 現行限界として保持、今回の合格を過大主張しない |

## Dependencies

| ID | 依存 | 順序/管理 |
|---|---|---|
| D01 | 汎用API/command/installと0.3.0 consumer追従 | 0→1→2/5、公開は具体的承認 |
| D02 | 固定builder/catalogと再現UI | 2→3→4、fixture/verdictはrecipe側 |
| D03 | latest builderとshowcase site/Pages | 5→6、失敗時前回サイト維持 |
| D04 | 退役 | 4と6完了後7、旧版保持、infra state/ruleset確認 |
| D05 | Biome比較元 | baseline biomejs/biome 2405c7620169bd0719166af09a8d89cc76fb37fb、fix JamBalaya56562/biome f79f85d58ae499647c127f1e90a4931e3dbbb206。ビルド時にremote存在照合 |

## Ownership and Review

担当欄は作業責任で、チーム割当の確定ではない。ユーザーが判断責任を持つ。後続要件・配送計画で各項目を試験/作業へ紐付け、結果が揃った項目だけを閉じる。
