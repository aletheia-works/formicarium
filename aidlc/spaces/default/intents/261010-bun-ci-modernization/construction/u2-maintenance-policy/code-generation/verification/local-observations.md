# Local Observations — U2

## Execution Context

2026-10-10。checkout /Users/mutoakio/Documents/formicarium。実行者はmain session、実装担当はdelegated developer。以下はmainの観測結果通知を記録したもの。delegateはinstall/build/testを実行していない。Node24.21.0、Bun1.4.2。直接Node実体はmainがmise管理実体へ解決した。

## Runner Baseline

mainでmise run install-frozen exit0（58 installs / 84 packages、変更なし）、typecheck exit0、build exit0。既存quality-evidence生成JSは7pass/0fail/0skip。runner確認後に入力sourceを実装した。

## Layer Results

| 層 | mainの実行command（Nodeは管理実体） | 結果 |
|---|---|---|
| 入力 | mise run build → node --test .build/tests/tooling/maintenance-input.test.js | build0、7pass/0fail/0skip |
| 証拠 | mise run build → node --test .build/tests/tooling/maintenance-evidence.test.js | build0、7pass/0fail/0skip |
| 判定 初回 | mise run build | TS2532、policy.ts(24,7),(24,15),(25,31),(25,39)、試験未実行 |
| 判定 修正後 | 同じmise run build → node --test .build/tests/tooling/maintenance-policy.test.js | 成分存在確認＋tuple型へ修正後build0、8pass/0fail/0skip |
| 契約 | mise run build → node --test .build/tests/tooling/maintenance-contract.test.js | build0、6pass/0fail/0skip |

各層Greenの通知後に次層へ進めた。試験名は4TS test sourceに記録されている。

## Final Checks

mainが新7TSへBiome check --writeを適用。input.tsのnoControlCharactersInRegex2件を観測したため、禁止範囲U+0000–001F/U+007Fを維持するcharCode判定へ修正した。再度の新7TS Biome check --writeはexit0/no fixes。

承認済み5tasksをmainで逐次実行しすべてexit0：install-frozen（58/84 unchanged）、check（169files、既存6warnings/3infos）、typecheck、build、light。lightは既存179tests=177pass/2既存skip、tooling48pass、合計225pass/2既存skip。既存skipを成功と記録しない。

mainのU2限定command：

```sh
node --test .build/tests/tooling/maintenance-input.test.js .build/tests/tooling/maintenance-evidence.test.js .build/tests/tooling/maintenance-policy.test.js .build/tests/tooling/maintenance-contract.test.js
```

28pass/0fail/0skip。SHA256 inventoryはこの最終build後のsource/generatedファイルを読取hashした値。

## Unverified Boundaries

実GitHub CI、固定配布JS80%以上のcoverage・全realm receipts、Node/browser/nativeの重い候補回帰、U3実APIの真正性/原子的expected head/実push/mergeは今回未検証。純粋fixtureと偽executor接続をその代替にしない。既存runtime/core/guest/RCと品質上限を変更していない。

