# Unit Test Instructions — U4

## Framework and Runner Readiness

既存node:test/tsconfig.tests.jsonを使う。main sessionでmise run build後、最初の試験前に既存tests/release baselineを実行する。実Nodeはmise lsで解決したNode24.21.0実体を使う。新規試験が存在する前は既存baselineでrunner readinessを観測する。

## Exact Unit Commands

baseline/回帰：
`/Users/mutoakio/.local/share/mise/installs/node/24.21.0/bin/node --test --test-concurrency=1 tests/release/decision.test.js tests/release/publication.test.js tests/release/workflow.test.js tests/release/evidence.test.js tests/release/collect.test.js tests/release/publication-cli.test.js`

新規U4のみ：
`/Users/mutoakio/.local/share/mise/installs/node/24.21.0/bin/node --test --test-concurrency=1 tests/tooling/publication-version.test.js tests/tooling/publication-evidence.test.js tests/tooling/publication-assets.test.js tests/tooling/publication-bootstrap.test.js tests/tooling/publication-bundle.test.js tests/tooling/publication-alignment.test.js`

各layer後は同一覧の当該ファイルのみ実行し、build/testはmain逐次。実装者は試験を実行せず、コマンドとfixtureを準備する。

## Targets and Fixtures

新規39項目（6/7/7/7/6/6）、各component5–8。正常ケースは実tracked policy/workflow/manifestを読み、架空fixtureだけで正常としない。GitHub API独立観測、run/attempt/artifact実bytes、trusted tagsourceをfixtureへ固定。既存署名入力を改称・弱化しない。archiveのmember/expanded/stream境界と固定npm SHA512、bootstrap実行前の改変拒否を試験する。

fake executor：reject0、allow最大1・固定argv、unknown再送0。外部書込API/registry公開は未実行。第一者JS固定inventory全realm行coverage80%と実CIは統合前別証拠。既存600/840秒・1worker・retryなし・8probe・native一致・1GiBを維持。

## Configuration and Test Data

## Individual JSON Regression

Step14–18では既存39トップレベルを保持し、assets/bootstrap/CLIの既存testへsubcaseを追加する。request.json・publication.json・evidence.jsonの個別8MiBを扱い、上限丁度と+1（虚偽サイズ申告・読込中増加を含む）を検査する。bootstrapの超過拒否はrunner起動0、CLIの超過拒否は公開executor0。正常サイズでも既存署名/API/manifest照合を省略しない。

追加試験を生成した後、mainが `mise run build` 成功を確認し、上記Exact Unit Commandsのassets/bootstrap/alignment当該filesで修正前Redを観測する。修正後同commandのGreenを確認し、全U4・既存release・承認済み5tasks・actionlintを逐次再実行する。個別JSON上限は総archive展開512MiB上限で代用しない。

## Existing Configuration and Test Data

既存tsconfigで6filesをemit。tempディレクトリは試験終了でcleanupし、API/credentialsはfake。npm実asset readonly取得はmainで上限/integrityを検証し、tokenなし。bundleはBun1.4.2→Biome2.5.15を同一手順でtemp再生成。生成資産を手編集して一致させない。

