# Team Practices

既存の承認済み実践を引き継ぎ、2026-10-10の調査・今回の人間の指示・Q1回答を統合した実践案。実装・実行結果や外部操作の承認とは区別する。

## Way of Working

- 私たちはローカルの履歴、bookmark、fetch、pushにjjを使い、mainを統合先とする。短命の作業bookmarkをレビュー後に統合し、判断の記録を残す。mise管理の実体を解決し、宣言taskはmise runを使う。
- Bun移行と通常CI・保守workflowの整備は、既存のnpm/terrarium公開作業とは別intentで進める。受入れ中の公開RC、そのタグ、固定入力を変更しない（人間の回答）。
- 公開先mainは12a92eabであり、以前の「リモート未作成」は過去の状態として扱う。現在の作業コピーを公開済みsourceと同一と推定しない。

## Walking Skeleton

- 既存のNode/ブラウザ公開API・Worker・wasm配置を基盤に、Bunで依存を固定導入し、型検査・ビルド・軽量テストまで動く最小経路を最初に確認する（提案・未検証）。
- Bunによる開発手順の変更だけでNode利用者への互換性を保証したと扱わない。npm tarballのNode/ブラウザconsumer確認と配布資産確認を維持する。全面的なruntime置換は既存指示から導かない。

## Testing Posture

- **Methodology**: test-after
- **Ordering**: 通常の実装は各テスト可能な層の実装後にテストを作成・実行し、不具合修正は再現テストの失敗を観測して修正後に同じテストの成功を確認する。
- ビルドとテストはmain sessionで逐次実行する。Node向けconsumer、Worker、process.execPath、Node専用flagの意味を確認し、Bunへ一括置換しない。Bun実行を採る箇所は実結果で互換性を確認する（未検証）。
- 既存Biome・TypeScript・Playwright・node:testを証拠として使う。通常PR/main CIは固定候補入力を要求しない軽量経路から整備し、重いnative/ブラウザ回帰・配布coverageは別の明示経路へ対応づける（提案）。軽量CI成功だけで全受入れを通過したと扱わない。
- 統合前CIと第一者配布JS固定一覧の行coverage80%以上を維持する。未収集ファイルを分母から消さず、Worker/別process/realmも記録し、欠落・skipを成功へ置換しない。
- probe600秒、aubeブラウザ840秒、1worker、retryなし、probe8項目合格、native出力一致、wasm1GBを維持する。未変更aubeは再ビルドせず、計測時に重い処理を並行しない。新規コア回帰はnative Linuxでも確認する。実機Safariは未検証のまま区別する。

## Deployment

- 私たちはBunとbun.lockを開発依存管理の基準へ移行する（人間の指示）。導入版、frozen導入、install scriptの許可、cache鍵とCI/ローカルのtask対応は設計・実行で確認する。現状はpackage-lock.jsonとnpm ciであり、移行成功は未検証。
- publish.ymlに加え、通常CIと保守workflowを整備する。兄弟repoのlint/typecheck/test/build、Actions/Bun依存更新、PR情報整理の構成を参考にし、Terraform/Pages/JSR等の対象外機能はコピーしない。
- @aletheia-works/formicariumのnpm公開とGitHub Releaseは版ごとの人間の承認後に行う。Bun開発導入とnpm OIDC公開executorの採否は独立に検証し、改変・不足証拠を公開開始前に拒否する既存境界を維持する。
- RCはnext、stableはlatestを計画の基本とする。既存RCのlatest維持は当該公開への人間の個別決定であり、今回変更しない。不具合時は追加公開を止め既知の版へ誘導する。
- workflowの最小権限、信頼したAction参照、未信頼PRからの公開拒否、source/pack SHA・固定入力・provenance・noticesの対応を確認する。通常CIに公開権限を渡さない。
- 私たちは自動ラベル付け・依存更新PR作成、条件を限定した整形修正push、CI合格した小さい依存更新の条件付き自動mergeを設計・実装対象とする（人間のQ1回答C）。自動mergeは対象・除外・main保護・必要checksを明示する。整形pushは対象ファイル、fork、権限、実行済みheadと現在headの照合を定義し、未信頼コードをwrite権限で実行しない。具体条件と拒否試験は後続設計・検証で確定する。設定の外部適用・必要token・push・公開は既存の承認条件に従う。

## Code Style

- 現行authoringはTypeScript、ESMと生成JSの配置である。既存Biomeとstrict TypeScriptを基準に変更範囲へ適用し、全体整形・改名を混ぜない。
- camelCase、定数UPPER_SNAKE_CASE、クラスPascalCase、目的コメント、共通処理/Node/browser境界を維持する。コア固有知識はruntime/core.tsの現行対応箇所に閉じ、ブラウザWorkerのdelete Atomics.waitAsyncを維持する。
- 入力不正、通常のゲスト終了、host/core失敗を区別する既存契約を守る。技術導入だけを理由にエラー契約を一括変更しない。
- 入力境界・パス・隔離ヘッダ、依存取得元と機密検出を変更範囲に対応づける。lintやPlaywrightだけでSAST/DAST全体の成功と扱わない。
