# 要件と作業単位の対応

## Requirement Mapping

User Storiesは今回未生成のためFRを全件列挙する。主担当をtraceabilityのtargetとし、共同担当は要件の部分責任を表す。

| Requirement | Unit ID | Directory | 共同担当/責任 |
|---|---|---|---|
| FR1 | U1 | u1-migration-preflight | U3は正式install経路の測定を追加 |
| FR2 | U2 | u2-session-guest-api | 主担当が完結 |
| FR3 | U4 | u4-command | 主担当が完結 |
| FR4 | U3 | u3-install | 主担当が完結 |
| FR5 | U2 | u2-session-guest-api | U3が取得中cancel/再install、U4がcommand経由の競合を検証 |
| FR6 | U2 | u2-session-guest-api | U3/U4統合後にcandidateを再検証、U6がconsumer移管、U9が最終証拠照合 |
| FR7 | U5 | u5-fixed-guest-build | 主担当が完結 |
| FR8 | U5 | u5-fixed-guest-build | 主担当が完結 |
| FR9 | U5 | u5-fixed-guest-build | U1がbaseline 1件の試行、U5がbaseline/fix正式経路を完結 |
| FR10 | U6 | u6-recipe-runtime | U2/U4が公開API、U5が固定成果物を供給 |
| FR11 | U6 | u6-recipe-runtime | 主担当が完結 |
| FR12 | U6 | u6-recipe-runtime | 主担当が完結 |
| FR13 | U7 | u7-showcase-guests | 主担当が完結 |
| FR14 | U7 | u7-showcase-guests | U8も公開import/fixture境界を継承 |
| FR15 | U8 | u8-showcase-site | U7が受入済みcatalog/candidateを供給 |
| FR16 | U9 | u9-retirement-acceptance | U6/U8の両経路受入が前提 |

## Nonfunctional Mapping

| Requirement | Units | 確認責任 |
|---|---|---|
| NFR1 | U1, U3, U9 | U1初期測定、U3正式経路測定、U9証拠照合 |
| NFR2 | U1–U9 | 各変更の既存品質とcoverage、最終証拠U9 |
| NFR3 | U2, U3, U5, U6, U7 | 検証・byte所有・archive境界と各consumer不正入力 |
| NFR4 | U1, U3, U5, U7 | 取得/build有限deadlineとcancel、原因表示 |
| NFR5 | U5, U7, U8 | 同key/候補の直列化・原子的受入・旧成果物保持 |
| NFR6 | U2, U6, U7, U8 | Node/3ブラウザ、COI/Worker/waitAsync、Safari区別 |
| NFR7 | U3, U4, U6, U8 | progress/transcript/端末の入力保持とescape/keyboard |
| NFR8 | U1–U9 | 出所/権限/license/切戻し/承認。最終退役条件U9 |

## Implementation Within Each Unit

各単位内は入力identity・境界の確認→対象層の実装→その層の試験→単位の統合受入・証拠固定。新機能はtest-after、不具合は再現失敗の観測→修正→同じ試験の成功確認。U1は取得/工程計測とbaseline試行、U2は共有状態/検証と公開consumer、U3は選択/取得と登録取消、U4はparser/builtinと振分け、U5はkey/metadataとbuild再利用、U6は移行前比較証拠とbundle/Contract/再現比較、U7は候補identityと各ツール受入、U8は候補消費/UIと配布候補確認、U9は証拠集約/利用調査と案内・外部操作の個別承認準備を内部の確認順とする。単位間の着手順をこの表で決定しない。

## Coverage Verification

FR1–FR16を各1行、全9単位に主担当の行を割り当てる。NFR1–NFR8も対応する。FR9は試行と正式経路、FR5/FR6は共通状態と下流統合で共同責任を明示する。実装/受入結果は未検証で、要件割当を達成証拠と混同しない。
