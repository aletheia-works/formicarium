# U2生成JSのignore規則整合案

## 原因と確認結果

検証済み: 39件はjjおよびGit indexで追跡済み、全SHA256は追跡前と一致。最終レビュー要求は依然 tests/package/pack.test.js がignore対象として拒否される。git check-ignoreの通常判定では対象外だが、--no-index判定では対象となる。追跡状態を参照しないignore判定でも対象39件を除外対象から外す必要がある。AI-DLC内部で使用する判定方式そのものは未検証であり、上記は外部から観測した拒否と再現条件である。

## 具体的変更

1. root .gitignore の既存JS/map除外規則の直後、AI-DLC管理ブロックの外側に、39件の完全なroot相対パスごとの否定規則を追加する。`!/runtime/guest-validation.js` の形式で、ディレクトリ単位や `*.js` 全体を許可しない。
2. U2 code-generation/source-manifest.json のwritesに `{ "path": ".gitignore" }` を1件追加して、レビュー対象に今回の設定変更を含める。
3. 元の39件のSHA256、jj追跡、通常/--no-indexのignore判定を確認し、最終レビュー要求を再実行する。受理されたら別担当の最終レビューと承認済み計画を続行する。

生成JSの内容、TypeScript、ビルド・試験・coverage条件、AI-DLC本体と管理ブロックは変更しない。source maps、対象外の生成JS、node_modules、dist、.build、.artifacts、ローカルharnessは除外を維持する。追加push/CIはこの修正案の適用には含めない。

## 提案パッチと検証

完全な39件のパッチ: `.artifacts/migration-session/ignore-rules-proposal.patch`。
対象一覧と追跡前SHA256: `.artifacts/migration-session/review-tracking-before.json`。
検証script: `.artifacts/migration-session/prepare-ignore-proposal.mjs`。
検証結果: `.artifacts/migration-session/ignore-proposal-result.json`。

検証済み: 元のGit directoryをread-only参照し、別の作業ディレクトリの提案 .gitignore について git check-ignore --no-index を実行した。39件すべてが非ignoreへ変わり、対象外397パスは元の判定と一致。実在JS/mapsに加え、各主要directoryの未列挙の新規JSやharness/build/artifact等の対照を含む。生成39件のbyte変更0、root .gitignore変更0。git apply --checkで提案パッチが現在の .gitignoreへ適用可能であることも確認した。Gitによる実適用は行わない。

未検証: 実際の .gitignore 適用後のAI-DLCレビュー要求受理、および最終レビューの結果。受理・成功を先取りしない。

ドキュメント根拠: sessionSourceInventory（scripts/migration-session/stage.ts）は .gitignore をpack/source inventoryに列挙していない。この設定変更は先のCI結果を改変せず、新しい検証成功として再ラベルもしない。先のCI successとcoverage89.88%はそのrunの証拠として保持する。

## 承認対象と切戻し

承認対象は .gitignore の39 exact-path例外とsource-manifestの1claim追加、および最終レビュー再実行。失敗時は状況を確認する。切戻しは今回追加した例外ブロックとclaimだけを除去し、39件の既存byteと追跡状態を維持する。
