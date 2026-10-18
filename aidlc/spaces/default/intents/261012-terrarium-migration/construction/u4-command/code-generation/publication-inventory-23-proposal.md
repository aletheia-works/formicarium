# 修正案：公開用inventoryを23件へ更新する

作成：2026-10-17。状態：人間の承認待ち。承認を受けるまで、どれも実行しない。

## 1. 何が起きたか

最後のまとめた確認のD2（U3の受入、`mise run migration-install-completion`）が、3番目の工程 `test-light` で止まった。原因は、`tests/tooling/publication-alignment.test.ts` の2件のfailである。
- 「current publication preparation keeps exact twenty-one JS and thirty-one pack file inventory」：公開用inventory（`scripts/release/inventory.ts`）は21件・31fileのままである。一方、配布用inventory（`scripts/package/stage-package.ts`）は、U4で23件・33fileになった。両者の一致を求める試験がfailした。
- 「current install pack with historical coverage invokes zero publication executors」：期待する拒否は「U2 publication missing module coverage」である。しかし、その前の照合（`archive inventory differs`）で、別の理由で拒否された。

計画の項目4で「既知の未解決」として記録していた2件である。試験を成功へ書き換えたり、skipしたりはしない。D1（U1の36試行）は36件passだった。D3とFは実行していない。証明書は削除し、keychainにないことも確かめた。

## 2. 直し方（案）

1. `scripts/release/inventory.ts` の `FIRST_PARTY_JS` に、`runtime/command-parse.js` と `runtime/command.js` を、配布用inventoryと同じ位置（`runtime/install.js` の後ろ）に加える。これで23件になる。`PACKAGE_FILES` は自動で33fileになる。`HISTORICAL_U1_JS`（14件）と `HISTORICAL_PACKAGE_FILES`（24件）は変えない。
2. `tests/tooling/publication-alignment.test.ts` の期待値と試験名を、21件・31fileから23件・33fileへ変える。配布用inventoryとの完全一致を求める判定は、そのまま残す。
3. 公開の安全の境界は変えない。publication CLIは、`HISTORICAL_PACKAGE_FILES` にないfileを含むpackを、引き続き「U2 publication missing module coverage; U4/B1 evidence required」で拒否する。2件目の試験は、inventoryがそろえば、本来の拒否理由まで届くようになる。つまり、23件のpackは、U4/B1の証拠なしには公開されない。この点は、試験の結果で確かめる。
4. 公開runnerを作り直す。`.github/publication/runner.mjs` は `inventory.ts` を取り込んだbundleなので、固定の版（Bun 1.4.3、Biome 2.5.15）で作り直し、`.github/publication/runner-manifest.json` のSHA256を更新する。実行するコマンド：

   ```bash
   node scripts/release/bundle.ts generate /Users/mutoakio/.local/share/mise/installs/bun/1.4.3/bin/bun $PWD/node_modules/.bin/biome
   ```

   `bootstrap.mjs` は、中身が変わらなければ同じbytesになる見込み（推測）。変わった場合は記録する。
5. 試験：不具合修正の順序に従う。今の2件のfailをREDとして記録済みなので、1〜4を直したあと、同じ2件と `publication-bundle`・`publication-bootstrap`・`publication-version`・`publication-assets` の試験、`mise run test-light` を、mainで1つずつ実行する。どれもfail・skip 0であることを確かめる。
6. `ci/migration-install/inputs.bundle.json`（U3のCIの固定入力）は、`runner.mjs` のSHA256（873738ab…）を持っている。今回のU3の受入はローカル限定（`FORMICARIUM_INSTALL_LOCAL_ONLY=1`）なので、この固定入力は使わない見込みである（推測）。D2の再実行でこの不一致のために止まったら、止めて報告する。U3のCI入力は、今回は作り直さない。

## 3. 影響：承認済みのUnitのやり直し

変えるfileは、次のUnitもclaimしている。そのため、strictのGuard Policyでは、そのUnitの承認が今のsourceに結び付かなくなる。

| file | このintentでclaimしているUnit |
|---|---|
| `scripts/release/inventory.ts` | U1、U2 |
| `tests/tooling/publication-alignment.test.ts` | U1、U2 |
| `.github/publication/runner.mjs` | U1、U2、U3 |
| `.github/publication/runner-manifest.json` | U1、U2、U3 |
| `.github/publication/bootstrap.mjs`（変わった場合だけ） | U1、U2 |

したがって、U1・U2・U3を、もう一度1回ずつやり直す必要がある。手順は今日と同じで、各Unitで次を行う。
1. 開き直す。
2. 計画に追加Stepを書き、承認を受ける。
3. 独立レビューを受ける。この試行のやり直しのレビューは使用済みなので、人間の依頼として記録する。
4. 検証コマンドでcheckpointを確かめる。

変更の原因はU4（配布JSを23件に増やした）なので、変更そのものはU4の計画の項目7として行う。U1〜U3では、その変更を引き受けたことを記録する。

別のintent `261010-bun-ci-modernization`（u4-publication-alignment）も、この3つのfileをclaimしている。そのintentはBuild and Testまで完了している。そのintentの記録は変えない。そこでのレビューと受入は、当時のsourceの履歴として扱う。

## 4. 変えないこと

- 受入れ中の公開RC、そのタグ、固定入力（チーム規則）。今回の変更は、これから作る公開の準備だけに効く。
- `HISTORICAL_U1_JS`・`HISTORICAL_PACKAGE_FILES` と、公開をU4/B1の証拠なしには許さない境界。
- AI-DLC本体、品質基準（180秒、非download中央値3000ms、coverage 80%、容量上限、worker 1・retry 0）。
- 公開・push・CIは、この案に含めない。

## 5. 順序（承認後）

1. U4の計画に項目7を加え、承認を受ける。
2. 項目7を実施し、上の試験を確かめる。
3. U1→U2→U3の順に、やり直す（各Unitで計画の承認とレビューの依頼をいただく）。
4. 最後のまとめた確認を、Bからやり直す（候補と独立consumerを、新しいsourceで作り直す）。D1の36試行は、sourceのfileに結び付かない記録（guest・ブラウザ・NodeとPlaywrightの版）なので、使い回せる見込みである（推測）。Fの組み立てで不一致が出たら、D1からやり直す。証明書の登録には、またmacOSの認証が必要になる。

## 6. ほかの選択肢

- 案B：公開用inventoryを21件のままにして、U3・U4の受入を止めておく。公開経路の判断を先にする場合の選択である。U3・U4の受入は、test-lightが通るまで進められない。
- 試験のskipや期待値の緩和で通す方法は、品質基準の緩和にあたるので、取らない。
