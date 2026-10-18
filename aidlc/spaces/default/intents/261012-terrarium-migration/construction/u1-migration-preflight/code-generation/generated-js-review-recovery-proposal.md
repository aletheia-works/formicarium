# U1生成JS 2件のレビュー復旧案

## 検証済み

v8の21工程と独立raw照合は成功（report SHA256 fe0d5a01fe5e193258f10371d9cd7c3a446b8b820f3005dabcaeca0300b63079）。独立レビュー要求は、source-manifestの `scripts/migration-preflight/current-coverage.js` がGit ignore対象のため拒否され、レビュー未開始。`jj --ignore-working-copy file list` でも以下2件が未追跡だった。

- `scripts/migration-preflight/current-coverage.js`
- `tests/migration-preflight/current-completion.test.js`

`.gitignore` の `/scripts/**/*.js` と `/tests/**/*.js` が適用されている。既存U2/U3の生成JSには個別pathの例外があるが、この2件にはない。

## 最小修正案

1. 正式復旧計画へ `.gitignore` の個別path追加を明記し、人間の実装前承認を得る。
2. `.gitignore` に以下2行だけを追加する。生成JSの内容は変更しない。

```
!/scripts/migration-preflight/current-coverage.js
!/tests/migration-preflight/current-completion.test.js
```

3. jjで上記2件をローカル追跡し、同2件の内容SHAがv8封印と一致すること、ほかのignore規則や追跡対象を広げていないことを確認する。`.js.map` は追加しない。commit/push/CIは行わない。
4. U1 source-manifestへ `.gitignore` を個別claimし、記録の変更範囲を整合させる。現在のsource/候補/pack/入力/全生証拠の一致を確認し、過去成功結果を変更後ソースへ付け替えない。v8に封印された対象がすべて不変なら同21工程の無用な再実行はせず、独立レビューを再要求する。不一致なら停止する。
5. レビュー後、新しい短い完了確認の実コマンドを提示して人間の承認を得る。AI-DLC本体、180秒、非download中央値3秒、coverage80%、容量上限、worker1/retry0は維持する。
