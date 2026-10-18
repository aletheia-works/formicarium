# U3 直接counter：Playwright Node初期化の復旧案

状態：実装前の範囲拡張案。既存の承認済み計画・手順書は未変更。本案の実装は人間確認後に正式計画へ反映して承認する。

## 検証済みの結果

- Babel AST切替後、mainでbuild/typecheck成功。計測回帰20件、U3 acceptance32件が全pass・skip0。整形後の再検証も52件全pass・skip0。
- 新source identityはa91709015baec1a9f2379b2d53f90f2438d8e175aa57108b25a1f0171cdc5c85。CI入力22件・254668126bytes、上限268435456bytes以下。製品pack SHAはcc89a7dcdd015da80b9c11569a4fef2daa8b3f2131610caa7fa20682c6e995b2を維持。
- 新全18工程の先行14工程はexit0。計測付き合同Node115件も115pass・fail/cancel/skip/TODO0、185662.609667ms。前回CI失敗のtest27は16322.909958msで成功。ただしローカル観測でありCI成功の証拠ではない。
- 第15工程のPlaywrightは試験本体前にTypeError: globalThis.__coverageStatementWriter is not a functionでexit1。第16–18工程は未実行。全18工程・coverage・正式36試行・CI・U3完了は未達。
- 保存先：.artifacts/migration-install/direct-counter-regressions-c0973cec-fd81-403a-b964-bbe8a3319e5a。incomplete.jsonとcommand-15.logを保持し、成功へ付け替えない。

## 原因

生成されたtests/package/consumer.spec.jsがNode上でscripts/package/stage-package.jsをimportし、そのhelperが計測済みruntime/contracts.jsをimportする。Istanbulの通常登録は実行されるが、直接writerのbridgeはbrowser init側にしかなく、このNode collectionプロセスでは未初期化だった。AI-DLC本体はこの実行経路に関与していない。

## 修正対象

- scripts/package/coverage.ts：Playwright用Node bootstrap生成、独立realmの登録・生カウント保存、全runner realmの検証・merge、package設定への初期import。
- scripts/migration-session/coverage.ts：U2専用Playwright設定生成への同bootstrap初期import。
- scripts/migration-install/coverage.ts：U3専用Playwright設定生成への同bootstrap初期import。
- tests/package/coverage.test.ts、tests/migration-install/acceptance.test.ts：実生成・実Node子processの初期化と収集、3suite設定の起動、欠落・重複・不正receipt拒否の回帰。
- 上記5件の対応JSはmainのbuildで生成する。既存source-manifest内の個別claimを確認し、不足があれば当該実パスだけ追加する。
- 新しい手書きmoduleや依存、製品runtime、SHA算法、公開API、AI-DLC本体は変更しない。生成bootstrap/receiptは新規coverage出力内に限定する。

## 品質境界

各Playwright runner/workerプロセスは独立SAB・writerを持ち、suiteとプロセスを区別した生receiptを保存する。開始登録と終了receiptを照合する仕組みを実装し、起動だけしたプロセス、欠落、重複、未登録、不正counterを拒否する。既存coverage-node.jsonとcoverage-session-node.jsonは上書きしない。既存browser host/Worker/descendantの全realm・全21JS分母・各hitのAtomic.store・飽和を維持し、新たに捕捉するrunner realmも検証してmergeする。

writer不在を通常counterへfallbackさせる、元の非計測モジュールへimportを逃がす、skip/ignore/samplingを追加する方法は採らない。install180秒、非download中央値3000ms、probe600秒、aube840秒、1worker、retry0、全容量上限を維持する。

## 実行順序

1. 人間が範囲拡張を選択した後、正式計画と手順書へ反映し、新しい実装前承認を取得する。
2. 実生成・実Node importによる初期化欠落のREDをmainで確認し、初期化と全realm収集を実装して同じ試験をGREENにする。通常回帰20件を維持し、欠落/重複/改変/異常終了を追加する。
3. mainでbuild/typecheckと対象回帰。新候補を固定する前に、Playwrightの実collection入口が成功し全runner receiptが得られることを短い確認で先に検証する。
4. 新source/候補/独立consumer/CI入力で全18工程を逐次再実行し、全21JS・全realm coverage80%以上を検証する。今回の失敗出力や旧成功証拠は上書きしない。
5. 正式36試行は証明書登録・削除の具体コマンドを提示して承認後に行う。ローカル成功後、追加署名付きpushとCI1回の具体コマンドを提示し、個別承認を待つ。新CI・レビュー・正式完了確認の前にU3完了を生成しない。
