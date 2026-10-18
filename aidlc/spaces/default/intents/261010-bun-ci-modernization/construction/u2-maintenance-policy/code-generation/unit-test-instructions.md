# Unit Test Instructions — U2

## Status

計画段階。U2試験は未作成・未実行。Plan Approval後にmain sessionだけがbuild/test/installを1つずつ実行する。開発runnerはBun、node:test生成JSの実行はNodeを使う。mise lsと設定から管理実体を解決し、shim/mise execを使わない。

## Prerequisites

U1の固定Bun1.4.2、Node24.21、bun.lock、strict TypeScript、Biomeを使用する。sourceはscripts/**/*.ts、tests/**/*.tsから既存buildにより生成される。test:lightのtooling globで新試験を取り込むためU1設定編集は不要。mainが承認されたcheckoutで依存導入・型検査・buildを完了してから対象JSを実行する。

宣言taskの実行はmise runを使い、直接Bun/Node commandは解決済み実体を用いる。以下のbun/nodeはcommandと引数を示す。実行記録には実際の絶対実体pathとcheckoutを残す。

```sh
bun install --frozen-lockfile --ignore-scripts
bun run typecheck
bun run build
```

## Layer Commands

各層を実装してから試験を作成する。mainは各層ごとに成功したbuildの後、対応commandを逐次実行し、成功を確認して次層へ進む。未作成JSをrunner readinessで実行しない。

```sh
node --test .build/tests/tooling/maintenance-input.test.js
node --test .build/tests/tooling/maintenance-evidence.test.js
node --test .build/tests/tooling/maintenance-policy.test.js
node --test .build/tests/tooling/maintenance-contract.test.js
```

最終U2限定command：

```sh
node --test .build/tests/tooling/maintenance-input.test.js .build/tests/tooling/maintenance-evidence.test.js .build/tests/tooling/maintenance-policy.test.js .build/tests/tooling/maintenance-contract.test.js
```

全体の既存light成功はmainの完了検査で別途確認する。上記U2限定commandを無条件の全suiteへ差し替えない。

## Fixtures and Assertions

各ファイルの予定トップレベル件数は7、7、8、6。table subtestsで各拒否字段を1つずつ正常fixtureから変更し、期待固定reason code、reject、無許可を検証する。正常fixtureは信頼policy、独立観測、提出envelopeを別objectとして生成する。getter、prototype、空集合、重複、limit境界、パス逸脱も固定fixtureで扱う。時計・random・API・ネットワーク・credentialは不要。

C2結合は実U1 validateEvidenceへ実際のartifact bytesとdigestを渡す。fake check配列を成功結果だけ返すstubで置き換えない。policy required producersを観測の弱い集合で代用しない。成功時だけC3の2引数requestを構築し、ValidationFailureのnull metadataはMaintenanceDecisionと区別する。

整形fixtureは提案と再現の完全digest一致・固定設定を表し、整形以外/分類不明/空差分矛盾を個別拒否する。依存fixtureはdirectUpdates0/1/2件、stable patch/minorの数値比較、悪い版、bot、allowlist、lock一致と無関係推移差分、main保護・mergeableを確認する。受入れ済み共通checksの制約を明示し、整形lint不成功もrejectとする。

deep-freezeと前後snapshotで入力不変、集合順違いでdecisionId/理由一致、理由固定順・重複なし・任意PR文字列非出力を確認する。純粋policyへexecutorを渡さず、試験内呼出側がallow時だけfake executorを呼ぶ。reject/no-op0回、allow1回とheadの引渡しを確認し、U3実操作保証とは区別する。

## Pass / Failure Handling

対象試験fail0、skip0、欠落fixtureなしがU2の合格条件。型/build失敗時は古い生成JSを結果に使わない。エラーはmainへ報告し、再現試験Redを観測してから修正、同一commandのGreenを記録する。layer成功を観測する前に次層へ進まない。

## Coverage and Whole Acceptance

U2単体成功は配布coverage80%以上・統合前実CI・全realm receiptsの代替ではない。固定一覧と分母を維持し、skipや未実行を成功へ変換しない。既存Node/browser consumer、probe600秒・aube840秒・1worker・retry0・8項目/native一致・wasm1GBは全体受入れで維持する。

## Observed Results

未検証。実行時にmainがcommand、checkout、実体version、exit code、named tests/pass/fail/skipと関連logを別のverification/local-observations.mdへ記録する。Plan Approval後は承認済み計画内容と本手順書を書き換えない。

