# U4 command 単体・統合試験手順

## mainでの正式受入の仕組み（2026-10-20、追加Step 17–26）

新しい試験file `tests/migration-command/acceptance-ci.test.ts` を加える。U4の他の試験fileと、U1〜U3の試験fileは変えない。枠組みは既存の `node:test`（最新のNode。Step 17で確かめた版を記録する）。試験は `mise run build` が生成する `tests/migration-command/acceptance-ci.test.js` を実行する。

U4だけの実行（個別path）：
```sh
mise run build
node --test --test-concurrency=1 tests/migration-command/acceptance-ci.test.js
```
`mise run migration-command-unit` の一覧（`package.json` の `migration:command:unit`）にも、このfileを個別pathで加える。globや全体の探索には置き換えない。

必須ケース（実装の後に書いて実行する。部品ごとに5–8件）：
- 入力の照合（`acceptance-inputs.ts`）：SHA256の不一致、sizeの上限+1、一覧の欠落・unknown field・重複key、既存fileの上書き、archiveの中の `..`・絶対path・link・余分なfile、固定11ファイルの不一致を拒否する。正しい入力を受け付け、固定11ファイルが揃う。
- 観測（`observe-ci.ts`）：runの失敗・未完了、別のworkflowのpath・event・branch・head・repository、commitの署名なし、失敗したjob、artifactのdigestの不一致、ZIPの中の候補の欠落・不一致を拒否する。正しい観測から、`observed-ci-summary` を1つ作る。作った記録を、U4の検査（`scripts/migration-command/completion.ts` の `checkCommandCIEvidence`）が受け付ける。U2・U3の検査はUnitごとに別の候補と `sourceIdentity` を求めるので、この記録の対象にしない（2026-10-20、人間の判断B）。tokenを記録とlogに書かない。
- mainのCIのpitchforkの取得（計画Step 27、`acceptance-inputs.ts`）：別のworkflowのpath・event・branch・head・repository、失敗・未完了のrun、該当するrunがない・複数ある、artifactの名前の不一致・期限切れ、ZIPのdigestの不一致、ZIPに3つ（`dist/guests/pitchfork`・`pitchfork.build-info`・`pitchfork.commit`）のどれかがない、3つ以外のpathを置こうとする、を拒否する。正しい入力では3つだけを置き換え、SHA256とsizeを記録する。GitHubのAPIは偽のlocal serverで置き換える。
- workflowの定義：triggerが `workflow_dispatch` だけ、repositoryとmainのrefの条件、権限が `contents: read` と `actions: read` だけでwriteが無いこと（`actions: read` は計画Step 27のmainのCIのartifactの取得のため）、pitchforkの取得がU2のbundleの復元の後・候補を作る前にあること、actionsのcommit SHAの固定、timeout、artifactの保持期間7日、`FORMICARIUM_COMMAND_LOCAL_ONLY=1`、信頼設定の後始末が `always()`、secretsを使わないこと。actionlintも実行する。

mockとstub：GitHubのAPIは、試験の中で立てる偽のlocal serverで置き換える。取得の試験も、偽のlocal serverとその場で作った小さなfileを使う。外部のnetwork・本番の資産は使わない。

この節の試験の成功は、仕組みの拒否の性質だけを確かめる。正式受入の成功（CIの受入1回、観測、手元のU4の正式な完了確認（U2・U3の試験を含む）、U1の今の確認）は、計画のStep 23–25の別工程であり、基準（install 180秒、非download中央値3000ms、probe 600秒、aube 840秒、1worker・retry 0、23JS全realmの行coverage 80%、容量上限）は変えない。

## 新しい土台（upstreamのmain）での確認（2026-10-18、追加Step 11–16）

新しい試験は加えない。U4の製品コード・受入の入口のコードは変えない。下の各節の、`scripts/migration-command/ci.ts`・`ci-inputs.ts`、`.github/workflows/migration-command-u4.yml`、`.github/publication`、生成JSの追跡、署名付きCIを使う手順は、古い土台で行った手順の履歴であり、新しい土台では実行しない。新しい土台では、生成JSは追跡されず、`mise run build` が作る。taskは `mise-tasks/migration/command-*.sh` が `bun run migration:command:*` を呼ぶ。

mainで1つずつ実行する。
1. `mise run lint:all`
2. `mise run typecheck`
3. `mise run build`
4. `mise run test:light`
5. `mise run migration-command-stage`（新しい土台のsourceでU4の候補を作る。base revisionは `FORMICARIUM_SESSION_SOURCE` に40桁で渡す）。作った候補の `package.manifest.json` を `FORMICARIUM_CANDIDATE` に、その候補のtarballを入れたリポジトリ外の独立consumerを `FORMICARIUM_CONSUMER` に、固定guest（`.artifacts/u2-release-inputs/aube-v2.7.0/aube`）を `FORMICARIUM_SESSION_GUEST` に設定する。
6. `mise run migration-command-unit`（件数とfail・cancel・skip・TODO 0を記録する）
7. `mise run migration-command-browser`（3browser、1worker・retry0）
8. `FORMICARIUM_COMMAND_LOCAL_ONLY=1 mise run migration-command-completion`。`U2_ACTUAL_SITE` に手元の `.artifacts/migration-install/actual-site` を渡し、`requireInstallActualSite` が固定11ファイルを検査する。`dist/guests/` のpitchforkは今のmainの手順で作ったもの（パッチなし、UI node 26以上）を使う（U3の確認で作り直し済み）。36試行のための証明書の一時登録・削除はkeychainの信頼設定の変更なので、wrapperを人間がターミナルで実行し、終わったら削除・未登録を確かめる。結果は `local-provisional`（`acceptancePassed=false`、`b1.formal=false`）であり、正式受入でもB1の正式な行でもない。

準備できない入力や、実行できない工程は、未検証として記録する。install180秒、非download中央値3000ms、probe600秒、aube840秒、1worker・retry0、23JS全realmの行coverage 80%、容量上限は変えない。actual-siteとCI証拠を作る手段は追跡コードにないため、`verified-with-ci` の完了・B1の正式な行・U4の正式受入は、U1〜U4のまとめた最終確認とterrariumの受入で行う。

---

以下は古い土台での手順の履歴である。

## 実行時点

U4の製品コードと試験は未実装で、以下の実行結果はすべて未検証である。U3までの成功（CI 38948209404、U3完了確認）はU3の証拠であり、U4の成功として扱わない。全build・testはmain sessionで一つずつ実行する。

## 試験の構成

- 枠組み：既存の `node:test`（最新の Node 26。runner-ready の試験は major の版の 26 だけを確かめ、patch の版は固定しない）、Playwright 1.64.1（Chromium/Firefox/WebKit、`--workers=1 --retries=0`）、TypeScript 7.0.2の型検査。新しい試験依存は追加しない。
- 置き場所：`tests/migration-command/`。TSを書き、`mise run build` が同じ場所へJSを生成する。試験はその生成JSを実行する。
- 型fixture：`types-invalid.ts` はtsconfig.tests.jsonの通常buildから除外し、consumer.test.tsが専用の型検証で明示的にcompileして、期待どおり失敗することを確かめる。

## コマンド

Nodeは `mise ls` で実体pathを確認して使う。2026-10-22 の値は `/Users/mutoakio/.local/share/mise/installs/node/26.12.1/bin/node`（以下 `<node>`）。各U4試験の前に `mise run build` を実行する。

1. runner（最初のテストより前に実行できることを確認する）：
   ```sh
   <node> --test --test-concurrency=1 tests/migration-command/runner-ready.test.js
   ```
2. 入力検証・Tokenizer・ls表示：
   ```sh
   <node> --test --test-concurrency=1 tests/migration-command/parse.test.js
   ```
3. 振分け・adapter・取消・結果：
   ```sh
   <node> --test --test-concurrency=1 tests/migration-command/dispatch.test.js
   ```
4. 公開API・直接APIとの競合：
   ```sh
   <node> --test --test-concurrency=1 tests/migration-command/public.test.js
   ```
5. 独立tarballのNode consumerと型：
   ```sh
   <node> --test --test-concurrency=1 tests/migration-command/consumer.test.js
   ```
6. 3browserのconsumer（宣言後のmise task）：
   ```sh
   mise run migration-command-browser
   ```
   中身は `<node> node_modules/@playwright/test/cli.js test tests/migration-command/consumer.spec.ts --config tests/migration-command/playwright.config.ts --workers=1 --retries=0`。
7. 受入入口の拒否試験：
   ```sh
   <node> --test --test-concurrency=1 tests/migration-command/acceptance.test.js
   ```
8. まとめて実行（宣言後のmise task）：`mise run migration-command-unit`。1–5と7の6ファイルを個別pathで列挙する。globや全workspace探索、skipに置き換えない。

## 必須ケース

- InputGuard：文字列以外、空文字、65536 bytesの受理と65537 bytesの拒否、多byte文字の境界、孤立surrogate（`isWellFormed()`）、LF/CR/NUL。
- Tokenizer：機能設計W2の例表9件。引用外の `| & ; < > $` backtick `* ? ( ) { }` の拒否と `[ ] ~ # ! =` のliteral。`''` `""` の空Token、引用の連結、二重引用内の `\"` `\\` と他の `\x`、引用外の `\x`、未閉引用と末尾backslashのmessage、非ASCII・NBSP・全角空白の保持、連続する空白・tab。
- ListingFormatter：dir/symlink/file、表示文字列の順（`a.b` が `a/` より先）、0件の空bytes、非ASCIIの名前。
- CommandDispatcher：builtin・install・guest runの振分け、予約名、`install ls@x` 後も `ls` がbuiltinになること、pwdがguest runとして扱われること（未登録ならNOT_FOUND）、判定順序 INVALID_INPUT → ABORTED → DISPOSED/BUSY。
- BuiltinAdapter：`ls`（0／1引数、`-` で始まる引数の拒否）、`cat path`、`cd path`、`rm -rf path`、不正形（`rm -r -f`、余分な引数）の予約前拒否、U2のNOT_FOUND/NOT_FILEの伝播、開始後のabortが結果に影響しないこと、release漏れがないこと。
- InstallAdapter：引数の個数、成功行の書式、Progressの中継、失敗時に旧登録を保持すること、事前abort、C04のエラーの伝播。
- GuestRunAdapter：非0終了のresolve、ExecutionErrorのreject、未登録のNOT_FOUNDと予約の解放、onOutputの中継、timeoutMsを渡さないこと、取消。
- ResultBuilder：呼出しごとに新しいUint8Arrayを返すこと、内部bufferや元のRunResultと共有しないこと、emptyの結果。
- 公開API・consumer：偽造session・他packageのsessionの拒否、同じSessionに作った2つのCommandSessionのBUSY、直接APIとのBUSY、reset/dispose、連続操作（cd→ls→cat→rm→ls）、command経由と直接installの結果一致。Node/3browserで同じ確認をし、実行時のbrowserの版を記録する。
- 受入入口：B1必須集合の欠落・重複・failed・unverified・未知environment・log不一致、C06のnamed field欠落、exit0でもskip/fail/空summaryを含むログ、U3の証拠・完了確認コマンドの流用を、すべて拒否する。

## 期待するcoverage

全23配布JS（既存21件とruntime/command.js・runtime/command-parse.js）を分母とし、Node・Worker・別process・browser・Playwright runnerの全realmの生counterで、行coverage80%以上を確認する。測るのは計画Step 8の正式受入れで、単体試験の実行だけでは判定しない。未収集のファイルを分母から除かない。

## mockとstub

- U2/U3の振る舞いには、実際のSessionと実際の内部portを使う。portやSessionを偽物に差し替えない（排他と状態不変を実物で確かめるため）。
- install系の取得には、U3と同じ制御されたlocal test serverとfixture（tests/migration-install/の既存fixture）を使う。外部network・本番assetは使わない。
- guest runには、U2の既存試験guest（tests/migration-session/fixtures.ts）を使う。新しいguestは作らない。

## 試験データ

非ASCII・全角空白・NBSP・孤立surrogate・境界長の入力は試験内で生成する。FSの初期内容は `fixtureToFsEntries` で作る。試験は互いに独立したSessionを使い、終了時にdisposeする。

## 結果の記録

実行したcommand、開始と終了の時刻、exit、試験の件数、失敗行、source/packのidentityを残す。単体試験の成功だけではU4の完了としない。coverage・正式36試行・既存回帰・B1・署名付きCI・正式の完了確認は、計画Steps 8–10の別工程である。失敗したら、再現結果と修正案を示して確認する。
