# U4 command 単体・統合試験手順

## 実行時点

U4の製品コードと試験は未実装で、以下の実行結果はすべて未検証である。U3までの成功（CI 38948209404、U3完了確認）はU3の証拠であり、U4の成功として扱わない。全build・testはmain sessionで一つずつ実行する。

## 試験の構成

- 枠組み：既存の `node:test`（Node 26.12.0）、Playwright 1.64.1（Chromium/Firefox/WebKit、`--workers=1 --retries=0`）、TypeScript 7.0.2の型検査。新しい試験依存は追加しない。
- 置き場所：`tests/migration-command/`。TSを書き、`mise run build` が同じ場所へJSを生成する。試験はその生成JSを実行する。
- 型fixture：`types-invalid.ts` はtsconfig.tests.jsonの通常buildから除外し、consumer.test.tsが専用の型検証で明示的にcompileして、期待どおり失敗することを確かめる。

## コマンド

Nodeは `mise ls` で実体pathを確認して使う。現在の値は `/Users/mutoakio/.local/share/mise/installs/node/26.12.0/bin/node`（以下 `<node>`）。各U4試験の前に `mise run build` を実行する。

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
