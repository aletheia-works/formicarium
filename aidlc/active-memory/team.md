<!-- AI-DLC keeps this copy in step with aidlc/spaces/default/memory/team.md. Edit that file; this copy is replaced. -->
# Team-Level Rules

> This team's affirmed practices and corrections. Loaded after `org.md` as
> strict-additive guidance; contradictions with broader policy are rejected.
> Populated by the practices-discovery affirmation gate. Edit at the gate,
> not directly.

## Way of Working

- 私たちはリポジトリ操作に Jujutsu（jj）を使う。mise の実体を版番号固定なしで解決する（人間の指示：AGENTS.md）。
- これまでの formicarium はローカルの blink-wasm-poc bookmark に作業を記録している（検証済み：main の jj log、evidence.md E3）。公開リポジトリ作成・push は現在実施しない。
- 公開対象を確認してから public リポジトリを用意する意図は既に記録済み。再質問しない。
- 公開後は main を統合先とし、短命の作業 bookmark の変更をレビュー後にまとめて統合する（人間の回答 Q1）。作業単位の履歴と判断の記録を残す。現状の blink-wasm-poc を main へ改名済みとは扱わず、公開準備時に具体化する。

## Walking Skeleton

- 既存 PoC の Node/ブラウザ実行構成を基盤として利用する（ドキュメント根拠：architecture.md）。
- 私たちは最初に npm tarball から Node とブラウザ Worker を動かす最小版を作り、端から端まで接続を確認する（人間の回答 Q2）。既存 PoC 完了だけではパッケージ経由の確認を代替しない。実際の最小版と成功結果は未検証で、後続の設計・実装・人間のチェックポイントで確認する。

## Testing Posture

- **Methodology**: test-after
- **Ordering**: 通常の新規実装は各テスト可能な層を実装した後にその層のテストを作成・実行し、不具合修正は再現テストの失敗を先に観測してから修正し同じテストの成功を確認する。（人間の回答 Q3）
- node:test と Playwright の既存結合テストを利用する（検証済み：package.json scripts、code-quality-assessment.md）。今回の成功結果・coverage 値は未検証。
- classic の追加条件は行 coverage 80%以上と統合前 CI 実行（ドキュメント根拠：org.md Testing Posture）。基準を下げて通過させない。
- coverage の技術提案（未実装・未検証）：第一者が保守する配布 JS 全体（既存 runtime の未変更ファイル、共通処理、公開 API、Node/browser Worker adapter を含む）の一覧を事前に固定し、未実行ファイルも分母に含める。tests、生成 blink JS/wasm、第三者/vendor、ゲスト ELF、.d.ts、デモ・開発専用 scripts は理由を明示して対象外とし、資産・型・回帰検証を別途行う。設計で配布対象を確定し、閾値達成のために除外を変更しない。
- Worker/ブラウザ内の計測を収集・マージし、対象一覧と照合して欠落を検出する。未収集ファイルを分母から外さず0%または未測定として失敗／未検証を報告する。計測方式は担当者が未importファイル・別process/realmを含む試験を観測して選ぶ。対象一覧、除外理由、行数、レポート、実行コマンドを CI 成果物へ残す。ブランチ coverage の新しい数値条件は追加しない。
- 既存上限は probe 600秒、aube ブラウザ840秒、1worker、retryなし、probe 8項目全通過、native 出力一致、wasm 1GB。テストは main session が逐次実行する（人間の指示：AGENTS.md）。
- aube はソースが変わっていなければ再ビルドしない。計測は重い並行処理なしで行う。新しいコア不具合の回帰 probe は native Linux でも確認する。
- npm tarball の import/Worker/型/wasm・notices・build-info の同梱確認は設計候補（推測・未検証）。ゲストと fixture は terrarium 側の ref 別配布という既存意図を維持する。

## Guard Policy

<!-- Affirmed by the team. Mode: strict, relaxed, or off. Strict here holds for every intent and cannot be changed from chat. A section under the retired Change Control heading, written by an earlier release, is still read. -->

## Deployment

- 私たちの今回の配布対象は @aletheia-works/formicarium の npm パッケージと GitHub Release。0.1.0-rc.1 を公開し、terrarium で受入れ後に0.1.0へ進める意図が記録されている。GitHub Actions Trusted Publishing を整備する（ドキュメント根拠：aidlc-state.md）。再質問しない。
- 現在 package.json は private:true/version 0.0.0。公開スクリプトや .github CI は観測されていない（検証済み：package.json、CodeKB inventory）。現行の自動配布とは扱わない。
- ユーザーが対象版を承認した後、版タグから公開を開始する。RC は npm next、stable は latest とする。不具合時は追加公開を止め、利用者を既知の版へ誘導する（人間の回答 Q4）。staging サービスや常時稼働サーバーを前提にしない。公開 workflow・配布タグの実装は未検証。
- 公開経路の技術提案（未実装・未検証）：公開候補 source/pack の機密検出、依存確認、lockfile と blink.lock の取得元・commit、dirty=false を含む build-info、LICENSE/notices の同梱を確認する。JS devDependencies の照会だけで wasm 側を安全確認済みとは扱わない。Trusted Publishing の信頼先と workflow の対応、公開 job に限定した権限、未信頼の変更からの公開阻止を具体化する。実装時に公式情報と実設定で検証する。所見が残る場合は具体的な影響を示して人間の判断を得る。
- 公開先作成、push、npm publish は対象の最終確認・必要な承認を得るまで実施しない（人間の既存指示）。Rust crate/JSR・ネットワーク・デーモン・汎用対話CLI・C fork JIT は今回の対象外。

## Code Style

- 私たちは既存 ESM/.mjs、camelCase、定数 UPPER_SNAKE_CASE、クラス PascalCase、目的コメント、Node/browser と共通処理の境界を踏襲する（観測と技術提案：developer contribution）。公開面は設計で明示し、すべての内部 export を公開契約へ昇格させない。
- コア固有の知識は runtime/core.mjs に閉じる。ブラウザ Worker の delete Atomics.waitAsync を維持する（人間の指示・ADR 0003/0009）。
- lint/format の技術提案（未導入・未検証）：既存の2スペース・single quotes・semicolon と互換な最小設定を新規／変更ファイルに適用する。製品・具体設定・check コマンドは担当者が具体化し、後続工程で確認する。製品名だけの追加質問はしない。
- 入力不正は例外、通常のゲスト終了は exitCode、host/core 失敗は原因付き例外という区別を維持する提案とする。Worker を越えるエラーの契約は後続設計で定義し、Result 型への一括変更はしない（動作は未検証）。
- 静的セキュリティ確認は変更した API/Worker/ファイル入力を対象に具体化する。ブラウザ受入れでは入力境界・パス・隔離ヘッダを確認する候補とし、lint/Playwright 成功だけで SAST/DAST 全体の成功とは扱わない。常時稼働サービス用のスキャン基盤へ範囲を広げない（技術提案、未実施）。
- 指摘範囲内に修正を限定し、ついでの改善・全体改名・全体整形を混ぜない（人間の指示）。
## Forbidden

<!-- Team-specific forbidden patterns -->

## Mandated

<!-- Team-specific mandates -->

## Corrections

<!-- Self-learning loop appends here. -->
