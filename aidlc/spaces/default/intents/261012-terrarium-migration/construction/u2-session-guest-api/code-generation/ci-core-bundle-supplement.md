# U2 CI core のローカル object bundle 補足

ユーザーが固定 SHA の Git object bundle の実装・ローカル検証を承認した。外部 push と CI 再試行の実コマンドは、検証後に main が別途提示する。CI 成功はまだ未検証。

入力 manifest の schema/version/producer は維持し、必須 destination に `.artifacts/migration-session/blink-source.bundle` を追加する（19 files）。main が既存 detached HEAD の repository から `git bundle create <path> HEAD` で self-contained v2 bundle を生成し、実 bytes/SHA256 を deduplicated payload manifest へ固定する。各 file128MiB、合計256MiB、metadata1MiB の境界を維持する。bundle は object/ref 形式であり、元 repository の config、hooks、credentials は転送しない。

workflow の blink remote checkout を削除し、build/typecheck/CI境界試験後に `node scripts/migration-session/ci-core.js ci/migration-session/inputs.bundle.json` を実行する。全 payload SHA 検査後、fresh staging repository に Git format 必須の local bundle verify/fetch/checkout を実施する。network protocol を拒否し、system/global config と hooks を使用しない。既存 `.vendor/blink` を上書きせず、失敗時は自分で作成した staging と新規 input copies を除去する。

受入条件は `blink.lock` の full HEAD `a882fb2f3df14115b7e46f6812fb296eef5934d7`、upstream `f006a4fc6f9b8de9272504fdff0dbbe5ce5dc580` の実 object存在、upstream diff の `blink/emufd.c`、clean checkout である。prepare-local/prepare の両方で restored core を再確認する。unit の mock Git観測を実 object bundle成功と呼ばない。main が実 bundle復元・改変拒否・既存 Node28回帰を逐次検証して結果を記録する。

新規 implementation の検証は未実施。以前の fresh local completion89.88% は以前の source identity の証拠として保持し、新 CI sourceへ再ラベルしない。U1固定14証拠、U2配布16分母、公開の U4/B1 拒否は不変。
