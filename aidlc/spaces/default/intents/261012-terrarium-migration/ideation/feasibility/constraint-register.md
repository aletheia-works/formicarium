# Constraint Register

## Constraints and Verification

| ID | 分類 | 制約・根拠 | 適用・確認 |
|---|---|---|---|
| C01 | 技術 | vivarium→formicarium一方向、本体→showcase禁止。intent Q1/Q3/Q6 | dependency/import検査 |
| C02 | 技術 | 静的musl x86-64、カタログ限定、任意URL拒否。計画/ADR0007 | digest/ELF/build-infoと拒否系試験 |
| C03 | 技術 | コア固有知識runtime/coreに限定、C fork JIT対象外。ADR0002/0003 | API設計・変更範囲レビュー |
| C04 | 品質 | probe600s、aube browser840s、worker1/retry0、probe8、native一致、wasm1GB | 現行基準をTesting Contractに移す |
| C05 | 再現性 | 40桁commit、repository、builder hash、依存UI固定、同入力成果物再利用 | baseline/fixのbuild-info・2回目実証 |
| C06 | 互換 | runtime.name=formicariumとdeprecated terrarium、ready/run/transcript維持。intent Q4 | Contract/schema/en/ja/consumer試験 |
| C07 | 配布 | 公開・deprecation・archive・state/ruleset変更は具体的承認。計画 | 退役まで既存サービスと既存版保持 |
| C08 | 組織 | ユーザーが優先度・範囲・公開判断、報告はこのチャットの節目。intent Q2/Q5 | 各承認点で具体的結果提示 |
| C09 | 費用/期限 | 固定期限・追加予算なし、費用発生前相談。feasibility Q1 | CI利用可能量・権限を運用前確認 |
| C10 | 規制/ライセンス | 追加要件なし、既存条件維持。feasibility Q2 | 移管するコード・バイナリ・UI依存の通知/ライセンス確認 |
| C11 | 運用 | jjでローカル履歴操作、mise管理ツール、測定中に重い並行処理禁止。AGENTS | main sessionから適切な試験を直列実行 |
| C12 | ブラウザ | same-origin Worker、COI/CSP、Atomics.waitAsync削除維持。ADR0009/計画 | 3ブラウザ受入、Safari実機は別途未検証 |

## Unverified Conditions

新規AWS、追加の法規認証、締切、費用を仮定しない。公開権限と実際のinfra stateは未検証。ローカルpackageと公開版の差を解消するまでバージョン作業の基点を確定しない。
