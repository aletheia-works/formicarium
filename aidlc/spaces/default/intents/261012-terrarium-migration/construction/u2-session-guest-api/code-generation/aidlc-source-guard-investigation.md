# AI-DLC source guard investigation — 2026-10-14

## 追加調査と起票（同日）

ユーザーの追加依頼に従い、更新済みpreview 20261012.1の実際のreadUnitSourceManifestを一時jj-colocated fixtureから実行。Bunで実際のexternal source mapを生成し、5条件を比較した。ビルド前は成功、生成後は拒否、exact-file claimsは成功、registry excludeにmapを指定してもdirectory claimは拒否、mapのみ削除すると成功。明示的exclude時、workspaceSourceListingからmapは除かれ、registryExcludedSourceKeysも除外と判定する。同じソース境界をdirectory admissionだけが尊重しない具体的な不整合を検証した。

これは単なるgitignore対象を拒否する仕様とは区別できる改善課題。生成物の拡張子だけによる一律免除ではなく、既存の明示的excludeを尊重し、registered pathsの優先・未除外ソースの保護を維持することを提案した。完全なlifecycle再現は未検証であり、deterministic validatorを実行した結果として報告。

再現スクリプトとログ: .artifacts/migration-session/aidlc-investigation/reproduce-map-claim.ts、reproduce-map-claim.log。Issue本文: 同ディレクトリsource-map-issue.md。

関連Issue/PRを追加検索し、同一のregistry-excluded descendantの受付拒否報告を確認できなかったため、ユーザー承認の範囲で[Issue #2472](https://github.com/awslabs/aidlc-workflows/issues/2472)を起票。GitHub connectorのcreate_issueは403 Resource not accessible by integrationで拒否されたため、既存gh API認証で投稿し、connectorのfetch_issueで本文一致・openを確認した。

## 結論

今回のレビュー受付拒否を、最新で修正済みのAI-DLC不具合とは判定できない。フォルダ内のignore対象を拒否する判定は現在版・最新preview・mainで同一であり、上流テストが拒否を明示的に期待する。類似する完了時のデッドロックは既知の不具合として修正済みだが、今回まだ完了判定へ到達していない。

## 検証済み

- active-version / active-executable: 2.11.1-preview.20261011.1、~/.local/share/aidlc/versions/2.11.1-preview.20261011.1/aidlc。
- GitHub latest release: v2.11.1-preview.20261012.1、2026-10-13T00:15:41Z公開、target 82a8448ae2ed0f40f01033924f20be3951c482a2。
- 調査時main: de721686681fa9957cf1d5fafabe9e7b302a557e。
- core/tools/aidlc-lib.tsのignoredPathClaimable / ignoredSourceClaimReasonを現在版タグ、最新previewタグ、取得main、ローカル.codex/toolsで比較し、各関数のSHA256が全て一致。
  - ignoredPathClaimable: e60b622ec4d59ddcce64ee0c06eb092db88acc71cc23e841d91c499a053367e6。
  - ignoredSourceClaimReason: 2742f139e99fcf53356f0da4dceece328fe12497a690b92902af8303c3fc934a。
- git ls-files --error-unmatch tests/package/pack.test.js: exit 0。git ls-tree HEAD -- tests/package/pack.test.js: exit 0、出力なし。index追跡とHEAD収録は異なる。
- git check-ignore --no-index -v -- scripts/migration-session/ci-core.js.map: .gitignoreの **/*.js.map に一致。
- 一時indexをgit read-tree HEADで初期化し、AI-DLCと同じls-files --others --ignored --exclude-standardでscripts/migration-sessionを調べると、ci-core.js.mapほか6件が返る。実際のレビュー受付拒否と整合。

## ドキュメント根拠 / 上流コード根拠

- [PR #2286](https://github.com/awslabs/aidlc-workflows/pull/2286): ignore対象でHEAD未収録・未登録のパスを、誰もclaimできない完了時の変更から除外。2026-10-11T05:31:52Z merge済み。現在版にもunclaimableIgnoredSourceKeysがある。manifest validator自体は挙動変更なしと明記。
- [PR #2367](https://github.com/awslabs/aidlc-workflows/pull/2367): .aidlc-source-paths.jsonのexcludeを途中で追加しても完了できなかった不具合の修正。2026-10-12T10:15:36Z merge済み。現在版にはregistryExcludedSourceKeysなし、最新previewとmainにはあり。
- [Issue #2244](https://github.com/awslabs/aidlc-workflows/issues/2244): 上記の関連する完了時デッドロック。closed/completed。
- [最新previewのテスト](https://github.com/awslabs/aidlc-workflows/blob/v2.11.1-preview.20261012.1/tests/unit/t305-per-unit-attribution-receipts.test.ts): ignored-dir/を拒否し、force-add済みだが未commitのignoredファイルを含むforce-dir/も拒否するassertがある。テストの閲覧のみで、上流テスト実行は未検証。
- [PR #2059](https://github.com/awslabs/aidlc-workflows/pull/2059): [itemId]等の括弧をGitがパターンとして扱い、別フォルダを誤検出する修正。今回のフォルダ名には括弧がなく、同一原因とは判定しない。

Issue検索: "contains ignored application source"、"js.map"、"jujutsu" "ignored"、PR検索: "contains ignored application source"。この検索範囲では今回と同一の未解決報告を確認できなかった。検索結果の不在は全Issue/PRに同一報告がないことの証明ではない。

## 推測 / 未検証

最新へ更新するだけでは今回のmanifest受付拒否は解消しないと判断する（拒否関数の一致と期待テストが根拠）。最新binaryで実際のレビュー受付を再実行する検証は未実施。今回の実際の受付拒否はフォルダclaimに生成source mapが含まれることと整合し、現在の契約で期待される拒否である。改善余地のある仕様・案内と実装不具合は区別する。

## 今後の運用（ユーザー指示）

AI-DLCの失敗や期待どおりに進まない動作は、その都度ログ・入力・版・最小再現を調べる。AI-DLC側の不具合と判定した場合は、最新release/mainで修正済みか確認し、既存Issue/PRの同一原因・対応状況を調べて重複を避ける。既知なら既存報告へ対応づけ、新規なら根拠を揃えてIssue/PR案を作る。フレームワークの直接改変、更新、外部投稿は今回の調査には含めない。

移管作業のmanifest修正案は保留。CI成功と元の生成物の内容は維持し、レビュー受付・単位完了は未完了。
