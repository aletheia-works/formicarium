# 最終レビュー対象の個別指定

検証済み: ユーザー承認済みの .gitignore39件例外とsource-manifestの.gitignore claim追加を適用。実 .gitignore は提案規則と一致、39件は --no-index 判定でも非ignore、全SHA256は不変。AI-DLC本体・生成JS・source map・remoteは変更していない。

検証済み: 最終レビュー要求は scripts/migration-session/ のdirectory claimがignore対象 ci-core.js.map を含むため拒否された。reviewerはまだ起動していない。

提案: source-manifest.jsonの scripts/migration-session/ と tests/migration-session/ という2つのdirectory claimを、実在するTS・JS・型宣言・JSONの個別pathへ展開する。既存の個別claimと重複を排除し、計91個別pathとする。source mapは補助build出力として除外を維持し、JSの例外を拡大しない。

完全な提案: .artifacts/migration-session/source-manifest-exact-proposal.json。
検証script: .artifacts/migration-session/prepare-exact-review-manifest.mjs。

検証済み: 提案の91pathすべてが --no-index 判定で非ignore、directory claim0件、実source-manifestは未変更。製品ソース・試験・生成byteの変更は0件。適用後に最終レビュー要求を再実行し、受理されたら別担当による最終レビューと承認済み計画を続行する。AI-DLCレビュー要求の受理・最終レビュー成功は未検証。追加push/CIなし。失敗時は確認する。
