# Security Design — U2

## Boundary and Contract Adaptation

ドキュメント根拠・未実装/未検証。C3の判定はrequestとtrustedPolicyの2引数を維持する。独立観測の取得/検証はC2のadapterがU3の無権限側で先に行う。観測とenvelopeの照合失敗はC3を許可経路へ呼ばずrejectを返す。context.trustedWorkflowは単なるworkflow名の一致ではなく、この信頼側adapterの照合が成功した場合だけtrueとして構築する。PR artifactのbooleanをコピーしてはならない。

U2の純粋部分は取得済みenvelope内のrepo/source/run/attempt/check/producer/digestとpolicyを検査する。観測adapterも純粋なデータ照合を共有できるがnetwork取得は持たず、evaluateMaintenanceの第3引数は追加しない。U3は独立観測と提出envelopeの照合を実際に呼ぶcontract試験を持つ。この組合せでfunctional-designの「独立観測を別入力」と2引数C3を接続する。判定結果だけで取得の真正性を主張しない。

## Raw Input and Rejection

型付け前のraw入力検証をDecision生成から分離する。不正operation・欠落head・未知schemaなど識別不能な入力はValidationFailure（outcome reject、固定reason、識別不能metadataはnull）を返す。C3 Decisionは必要識別子がすべて妥当な場合のみ生成する。偽のhead/operation/decisionIdを埋めて型を満たさない。統合入口は両方を拒否として扱い、ValidationFailureをC3 Decisionやallow tokenとして扱わない。C3の有効request→Decision契約は保持し、raw parse境界の結果型を新しい内部契約として実装計画へ明記する。

## Validation and Bounded Processing

| 対象 | 固定方針 | 対応 |
|---|---|---|
| schema/型 | version1、plain data、必須型厳格。unknown operation拒否、追加の非権限metadataを許可しても判断に使わない | NFR1.2 NFR3.3 |
| collections | changedPaths最大500、checks/required producers最大100、directUpdates最大2（2でも規模拒否）、allowlists各最大100 | NFR1.2 NFR5.1 |
| strings | path最大1024文字、dependency名最大214文字、その他identity最大256文字。SHA40/digest64lowercase hex。空/control文字拒否 | NFR1.2 NFR5.1 NFR5.2 |
| path | root相対、slash区切り、空/dot/parent segment・backslash・absolute拒否。normalizeして許可に変換しない。allowlistはsegment-aware固定規則。別名・symlink観測不能はU3で拒否 | NFR2.2 NFR4.1 |
| evidence | C2独立照合を先に行い、同名check重複、欠落、未知producer、source/run不一致、非successを拒否 | NFR2.2 NFR3.1 NFR3.2 |
| reason | 固定コードと固定検査順。任意値を文字列連結しない。拒否優先、metadataは妥当な値のみ | NFR1.1 NFR5.2 |

2件を超えるdirectUpdatesは入力上限拒否、0/2件は規模条件拒否として区別する。limit値は許可を広げるものではなく有限処理の上限。順序が意味を持たない集合は一意性検査後に固定順で扱い、同じ内容の順序違いで結果がぶれないようにする。

## Pure Policy

共有context検査→operation固有検査→拒否優先→非空allow/空format no-opの順。共通requiredCheckProducersは両operationに同じ条件を適用し、整形前lint失敗は手動へ回す受入れ済み制約を維持する。未知状態は成功と扱わない。

versionはstableの妥当な3部数値として分類する。patch/minor昇版のみ許可し、rangeの判定不能、major、prerelease、同版、降版を拒否する。唯一の直接dev依存変更とlock再現digest一致を要求する。推移依存件数を上限へ加えないが無関係な差分を許容しない。

決定識別子は妥当な正規化入力・policy revisionからの衝突耐性digestを用いる。時刻・乱数・mutable globalを使わない。immutable inputと新しい返却値を用い、呼出し側の構造を変更しない。network/process/filesystem/credentialへの依存を持たない。

## Verification and Quality Preservation

| ID | 設計と確認 |
|---|---|
| NFR1.1 | 正規化・固定reason順・衝突耐性digest。凍結fixture反復比較 |
| NFR1.2 | raw parse、上限・版・型・集合検査。不正入力をfail closed |
| NFR2.1 | 純粋moduleの依存境界。executor/client引数なし、import確認 |
| NFR2.2 | C2 adapter先行照合とtrusted context生成。偽観測・policy拒否 |
| NFR3.1 | repo/source/run/attempt/producer/digestの個別改変拒否 |
| NFR3.2 | 全共通checks成功条件。U3の操作直前再照合と原子的expected head条件を維持 |
| NFR3.3 | raw ValidationFailureと妥当Decisionを分離。C3の2引数を保持し独立照合adapterで接続 |
| NFR4.1 | format完全一致、直接1件とlock再現。不成立fixtureからallow0件 |
| NFR4.2 | U1のCI/consumer経路へ統合し固定配布JS80%を別受入れで確認。既存上限を変更しない |
| NFR5.1 | 有限collections/string、単回評価、retryなし。境界値試験 |
| NFR5.2 | 固定reason、任意PR本文・secret未取得、invalid metadataはnull |

fixture成功は実CI/coverage/運用成立の証明ではない。main sessionで承認済み検証taskを逐次実行し、U3の偽executor接続ではreject/no-opが起動0回となることを追加確認する。今回core/guest/runtimeを変更しない。
