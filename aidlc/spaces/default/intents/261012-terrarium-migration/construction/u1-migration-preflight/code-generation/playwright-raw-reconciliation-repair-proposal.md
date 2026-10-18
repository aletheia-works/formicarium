# 現在の完了確認：Playwright Node生記録の照合修正案

## 検証済みの事象

固定入力v7（SHA256 fa4a62fc442c9665b58885e1ab69a5fe90e3132f591080148cdc08f3890f6c7c）のホスト実行は21工程すべてexit0。その後の独立再計算が `raw current coverage differs from aggregate` で停止した。出力は `.artifacts/migration-preflight/current-completion-bdbdeb9a-0b89-4aa4-9592-7a450be5d2b8/` に保存し、成功へ書き換えない。

集計には1495 realms、全21配布JS、1768/1929行=91.65%、skip0を記録。`readPlaywrightNodeRealms(out, ['package','session','install'])` は実生記録の12プロセスを正常に読み、すべて集計のrealmNamesに存在した。一方 `scripts/migration-preflight/current-coverage.ts` はNode host/Worker、session host/Worker、browser rawだけを再計算し、Playwright Node rawを追加していない。

## 修正範囲と順序

1. `tests/migration-preflight/current-completion.test.ts` に、実生成bootstrap由来のPlaywright Node記録を含む正常集計が独立再計算と一致する回帰を追加し、mainで現行の不一致をREDとして観測する。必要なfixtureはproject内の新規出力へ置き、既存成功・失敗証拠を変更しない。
2. `scripts/migration-preflight/current-coverage.ts` が既存 `readPlaywrightNodeRealms` を利用し、package/session/install全suiteの生記録を厳密検証したうえで、同じmetadata/layoutへ全カウントを追加して再計算する。集計値・割合・分母・realm名の厳密比較を維持する。欠落、identity不一致、異常終了、counter不正を無視しない。
3. 同じ回帰をGREENにし、正常ケースに加えて片側receipt欠落、generation不一致、カウント変更、realm名変更等を拒否することを確認する。U3で計画済みの独立起動台帳改善はここで先行実装しない。
4. mainでbuild/typecheck、U1単体/current-unitを逐次確認する。対応する生成JSは通常buildで更新する。AI-DLC本体、製品runtime/SHA/API、180秒期限、非download中央値3秒、coverage80%、全容量上限、worker1/retry0を維持する。
5. 修正によりsourceが変わるため、新候補・独立consumer・固定入力を新規作成する。旧v7や今回の21工程結果を新sourceへ付け替えない。新21工程の実コマンドを提示し、人間の承認後にホスト権限で実行する。成功後に独立レビューと新しい短い完了確認コマンドの承認へ進む。

今回の修正対象は上記2件のTSと対応する生成JS。push・CI起動・証明書操作は含めない。
