# 初期試行の技術選択

## Sources

`../../../inception/requirements-analysis/requirements.md`、`../../../inception/contract-design/contract-summary.md` C01/C11、`aidlc/spaces/default/codekb/formicarium/technology-stack.md`。文書根拠。導入済み版・実際の互換性・性能は実装時に観測する。

## Decisions

| 選択 | 理由・制約 |
|---|---|
| 既存TypeScript strict/ESM、公開Node/browser API | U1の目的は既存経路の成立確認。未来のinstall/command APIを先に作らない。コア知識は既存core対応箇所に限定 |
| 既存Playwright Chromium/Firefox/WebKit、1worker/retry0 | 同じC01 schemaで36行を取得。実機Safariの代替成功とは呼ばない |
| performance.now等monotonic clock、JSON証拠と読める集計 | fetchを分離し5工程合計を検査。壁時計の調整で工程時間が変わらない |
| 既存Bun frozen導入・宣言mise task、mise管理ツール実体 | CodeKBのNode24.21.0/Bun1.4.2等は宣言値。mise lsで実体を確認し、shim/mise execを使わない。Node consumerをBunに一括置換しない |
| 既存wasm/Worker資産と既存静的配信 | COI/SAB/CSPを維持。aubeのソース変更なし再buildとコアJITを追加しない |
| vivariumの最小baseline CI試行 | remote固定commit存在、build-info/key/digest、第2回compile省略を観測する。汎用builderはU5で設計。旧入力一時利用はFR9の試行に限定し製品依存として残さない |
| jjでローカル履歴、外部操作は対象を示して承認 | sibling変更前にAGENTS/実体/既存試験を確認。公開/CI書込み/費用はその操作の承認境界に従う |

新DB、SaaS監視、追加backend、分散cache、リトライライブラリは不要。fetch/buildの失敗は有限終了と証拠で扱い、別URLへ自動迂回しない。

## Verification Boundaries

コード計画でファイル・実コマンド・fixture・CI所有者・baseline/回帰/coverage範囲を指定する。本段階で試験・build・公開は実行していない。初回の単位完了確認前に、整備した入口の共通検証コマンドを人間に提示して承認を得る。
