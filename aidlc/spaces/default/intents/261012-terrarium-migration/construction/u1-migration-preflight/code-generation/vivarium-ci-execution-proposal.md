# 固定Biome baseline CI試行の具体案

作成日：2026-10-13。未実施。承認済み実装計画Step8の外部操作確認。

## 対象と差分

対象は公開フォーク `Marukome0743/vivarium`。remote originをjjで確認。remote mainの基点は `694026b28b949eb2972c8b42b95b1e291ae2ab0e`（公式RESTで確認）。専用ブランチ `codex/terrarium-migration-baseline-u1` に以下4ファイルの変更だけを置く。

- integration/vivarium/preflight/baseline-controller.mjs（新規）
- integration/vivarium/preflight/build-baseline.sh（新規）
- integration/vivarium/preflight/baseline-workflow.yml（新規）
- .github/workflows/vivarium-verdict-self-test.yml（専用ブランチの内容だけを同じCI案へ差替）

完全差分：[vivarium-ci-proposal.patch](vivarium-ci-proposal.patch)。mainとupstreamには反映しない。既存の別作業の変更は含めない。専用checkoutでjjを使い変更・bookmark・署名付きpushを行い、pushしたcommitがVerifiedであることと上記4ファイルだけの差分を確認してから実行する。既存bookmarkがあれば勝手に上書きしない。

GitHubは手動実行するworkflowがdefault branchにも存在することを要求するため、既存workflow ID `381088086` を使い専用ブランチをrefに指定する。既存default workflowの状態activeをRESTで確認済み。差替は専用ブランチだけで、mainの定期self-testは維持する。[GitHub手動実行の仕様](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow)。

## 承認対象の具体操作

1. 上記4ファイルだけの専用jj checkout/commitを作り、originの専用bookmarkへ署名付きpushする。
2. commit/diff/署名を確認後、上記workflowをその専用refで1回手動実行する。dispatch入力controller_sha256は下記値。
3. CI run URL、first/reuse receipt、actual inputs、受入ELF/build-infoと必要ログを取得し、ローカル証拠へ保存してdigestを照合する。
4. 成功時は実証拠を受入入力へ反映し、承認済み計画の残りの検証へ続行する。失敗・権限拒否なら記録して停止し、原因と対応案を確認する。

PR作成・mainへのmerge・upstream変更・Release公開はこの承認対象に含めない。

## 固定入力

| 移設する入力 | SHA256 |
|---|---|
| baseline-controller.mjs、16591 bytes | 581071ad54af94289aaf378f7c0a77b28cfa375babf476ccf226f9981ca5116a |
| build-baseline.sh、1242 bytes | eb1b90bc946609159023cb267fcb087cd3455edc7d86bd6935cdc3438dada2b5 |
| baseline-workflow.yml、4997 bytes | c6307dfe2f239a830b24309329f152870ae1a0a013bf701754b1544d1088a0ea |

ビルド対象：biomejs/biome commit `2405c7620169bd0719166af09a8d89cc76fb37fb`。Node24.21.0、Rust1.98.1、musl x86-64。linux/amd64 Rustコンテナmanifest `sha256:6d9066cf04ed2cc9d1a406016f4c9b2574bafda23f9e88bcad8e5d24fa6aec8e`。Cargo --lockedとsource4入力SHAを照合。実rustc/cargo version文字列・builder inventory・環境をkeyへ含める。詳細確認はbaseline-input-observations.md。

初回ビルド後、同じキーで2回目を実行してcompileSkipped=true・ELF同一digest・version exit0を確認する。ローカルfixture成功をこの実績に代用しない。

## 実行・保存・費用

standard ubuntu-24.04 runnerの1job。build全体4時間、job250分。contents readだけの権限、単一writer、失敗時staging破棄、子process groupと固有Dockerコンテナの終了処理。実OS取消はまだ未検証。

成果物名 `terrarium-migration-baseline-<run_id>`、Actions artifact保持1日。ELF上限128MiBと小さなmetadata/receiptだけを保存し、target/build cache全体はuploadしない。証拠は期限前にローカルへ保存する。

公開repoのstandard runner実行は無料（文書根拠）。artifact保存のアカウント残量は未確認。超過時は公式$0.25/GB-monthから、約129MiBを1日保存する概算は$0.002未満。請求額確定の保証ではなく、無料枠不足・想定外課金が判明すれば停止する。[GitHub Actions料金](https://docs.github.com/en/billing/concepts/product-billing/github-actions)。有料大型runner・Release・新サービスは使わない。

## 切戻しと未検証

停止時は対象runを取消し、ログと必要証拠を保存する。mainは変更しないため本番差分の切戻しは不要。試行ブランチは調査用に保持し、不要になった時点で削除を確認する。artifactは1日で失効する。

GitHub connectorのrepo metadataはpush=falseで、SSH経由push/Actions起動の実権限は未検証。承認が権限の存在を保証するものではない。拒否された場合は説明して停止する。jj署名を無効にしたり別アカウントへ切替えて実行しない。

このCIが成功しても、最終回帰・固定分母coverage80%・初回検証コマンドの承認・独立コードレビューが揃うまでU1は未完。
