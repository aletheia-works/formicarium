# Code Summary — U2

## Implementation

入力snapshotとschema検証、U1 validateEvidenceを使う独立証拠adapter、共有の純粋C3判定を実装した。source/testの変更はsource-manifest.jsonの7TSのみ。生成JSはignoredのためgenerated-artifacts.jsonへ分離した。承認済み計画内容・試験手順・Testing Contractを変更していない。

raw不正はnull識別情報のValidationFailure、妥当な2引数C3はDecisionを返す。adapter成功時だけtrustedWorkflowを生成し、必須producer/check集合をpolicyから固定する。整形は完全再現とsegment-aware path、依存は直接dev更新1件のstable patch/minorとlock一致を要求する。受入れ済み共通checks制約を両operationへ適用する。

## Verification

検証済み（main session実行・報告）：層別7/7/8/6、結合U2計28pass・fail0・skip0。最終frozen導入/check/typecheck/build/lightの5tasks exit0。lightは既存177pass・2既存skipとtooling48pass、合計225pass・2既存skip。詳細はverification/local-observations.md。

初回policy buildのTS2532は成分存在確認とtuple型で修正し、同build成功後に試験を実行した。制御文字regexのBiomeエラーは同範囲をcharCodeで拒否する実装へ修正し、対象formatter/checkを通した。

## Boundaries

U2のallowは再利用可能な操作tokenではない。U3は独立取得の真正性と書込み直前再照合・原子的expected headを保証する必要がある。実API操作、統合前実CI、固定第一者配布JS80%coverageと全realm receipts、browser/native回帰、実機Safariは今回未検証。既存probe600秒/aube840秒/1worker/retry0/wasm1GB等を変更していない。独立レビューへ提出する段階で、レビュー完了を主張しない。

