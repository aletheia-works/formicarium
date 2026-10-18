# U3 install 単体・統合試験手順

## 今回の再開（2026-10-17、追加Step 12–13）
新しい試験は追加しない。U3の製品コードは変わっていないので、今回は記録の更新と独立レビューを行う。checkpointの確認には、intentに記録された検証コマンド（人間が承認した、U1の試験を今のsourceで実行するコマンド）を使い、mainが実行する。最終的なsource（U4を含む）での、U3の単体・browser・consumer・coverage・正式36試行・専用CIの確認は、U4の作業がすべて終わった後に、U1〜U4のまとめた確認の中で行う。下の各節は、それより前の手順として残す。

## 実行時点
既存U3部品、共有SHA最適化、独立Node/3browser consumerとSHA回帰は実装・観測済み。v5固定入力による21工程は全exit0、21JSのcoverage91.65%・skip0であるが、その正式確認の対象はU1/U2でありU3受入れへ流用しない。文書更新前候補の正式36試行成功は履歴として保持する。現在のU3候補の正式受入れは未完了。本再開はCI実配信入力の不足と必須試験skip許容の修正を対象とする。失敗再現をmainで観測してから修正・再検証する。runnerの既存確認結果は保持する。

## コマンド
Nodeはmise lsで管理版を確認し、現行実パスを使う。現在の承認対象設計値は /Users/mutoakio/.local/share/mise/installs/node/24.21.0/bin/node。buildは既存declared mise taskを確認して使い、U3 test実行前にJSを生成する。

1. runner: `/Users/mutoakio/.local/share/mise/installs/node/24.21.0/bin/node --test --test-concurrency=1 tests/migration-install/runner-ready.test.js`
2. catalog: `/Users/mutoakio/.local/share/mise/installs/node/24.21.0/bin/node --test --test-concurrency=1 tests/migration-install/catalog.test.js`
3. transfer: `/Users/mutoakio/.local/share/mise/installs/node/24.21.0/bin/node --test --test-concurrency=1 tests/migration-install/transfer.test.js`
4. archive: `/Users/mutoakio/.local/share/mise/installs/node/24.21.0/bin/node --test --test-concurrency=1 tests/migration-install/archive.test.js`
5. lifetime/API: `/Users/mutoakio/.local/share/mise/installs/node/24.21.0/bin/node --test --test-concurrency=1 tests/migration-install/lifecycle.test.js tests/migration-install/public.test.js`
6. consumer/types: `/Users/mutoakio/.local/share/mise/installs/node/24.21.0/bin/node --test --test-concurrency=1 tests/migration-install/consumer.test.js`。このfixtureが専用types-valid/invalidのコンパイル結果も検証する。
7. browser: 更新後 `mise run migration-install-browser`。固定Playwright CLIで`test tests/migration-install/consumer.spec.ts tests/migration-install/hash-regression.spec.ts --config tests/migration-install/playwright.config.ts --workers=1 --retries=0`を実行し、3browser projectを明示する。
8. unit aggregate: 更新後 `mise run migration-install-unit`。既存7個と新hash-regression.test.jsの計8個を個別列挙し、glob/全workspace探索/skipへ置換しない。
9. hash regression: `/Users/mutoakio/.local/share/mise/installs/node/24.21.0/bin/node --test --test-concurrency=1 tests/migration-install/hash-regression.test.js`。
10. 同期C03共有回帰: `/Users/mutoakio/.local/share/mise/installs/node/24.21.0/bin/node --test --test-concurrency=1 tests/migration-session/guest-validation.test.js tests/migration-session/public.test.js tests/migration-install/public.test.js`。

## 今回のCI修正を先に検証するコマンド

mainでビルド後、失敗再現・修正後の両方に同じ単位内のコマンドを使う。

```sh
/Users/mutoakio/.local/share/mise/installs/node/24.21.0/bin/node --test --test-concurrency=1 tests/migration-install/acceptance.test.js
```

ここへ実配信入力の正常復元と欠落・改変・不正path・symlink・容量上限/+1、およびexit0でもTAP/Node spec/Playwrightのskip/fail/空summaryを拒否する試験を追加する。外部ネットワーク・実guest実行を必要としない小さなfixtureで拒否条件を検証し、実配信確認は次の別コマンドで行う。

```sh
/Users/mutoakio/.local/share/mise/installs/node/24.21.0/bin/node --test --test-concurrency=1 tests/guest-distribution/integration.test.js
```

後者はU3 CIと同じ入力復元後、U2_ACTUAL_SITEを検証済み復元先へ設定して実行する。8pass・fail0・skip0を要求する。site未設定時の既存6pass・2skip・exit0という失敗例は保持し、修正後はU3受入入口がそれを拒否することを確認する。圧縮入力の実byte数を既存CI manifest合計へ加算し256MiB以下を実測する。10件のarchiveと既存CI参照1件から構成した後も固定11ファイルと全byte数/SHAを検査する。圧縮・展開や容量の計数を緩めて通さない。

## 重複guestの固定参照方式：承認後の実装・検証

全11件archiveの実測59173768bytesを既存217941020bytesへ加算すると277114788bytesで、256MiBを8679332bytes超過する。旧archiveを保持し、参照方式用の新archive `.artifacts/migration-install/actual-site-v2.tar.gz` をwx新規作成する。mainのread-onlyメモリ内計測では10件archive36727106bytes、合計254668126bytes、余裕13767330bytes。新実装のend-to-end成功は未検証で、以下は計画承認後にだけ実行する。

固定参照元は `dist/guests/aube`、36948544bytes、SHA256=c7d7d13692d01c5f6adc5511c40adc6b3769080b7c433b44c411a3e52ebcd99e。固定参照先はサイト内の `dist/aube/83a42e281acf38e98fbbddf590e77746dcb9dfdb12cce4b27d1eb1926e1e5b5d/guest`。別pathにも同じSHAがあってもfallbackせず、参照sourceを新しいlogical入力行として重複追加せず、既存行の数・byte合計も減算しない。

既存28ケースに、正常な参照copy、欠落、wrong source path、同サイズ改変、source/ancestor symlink、archiveへの参照guest再混入、10件側のextra/missing、fallback拒否、復元後11件の各上限/+1を追加する。新しい拒否テストはmainで失敗を観測してから実装し、同じコマンドで成功を確認する。意図的skip/TODOの子試験は実ログを検査し、親へstdoutを転送して親summaryを汚染しない。

mainで逐次実行する。実装・生成JSを確定するまでCI入力を作り直さない。

```sh
mise run build
mise run typecheck
/Users/mutoakio/.local/share/mise/installs/node/24.21.0/bin/node --test --test-concurrency=1 tests/migration-install/acceptance.test.js
```

acceptance成功後、圧縮だけを先に作成・inspectする。prepare-siteは新version pathへ出力し、inspect-siteは10件のsealと固定参照設計の整合を検査する。source不足を自動取得や別path探索で埋めない。

```sh
/Users/mutoakio/.local/share/mise/installs/node/24.21.0/bin/node scripts/migration-install/ci-inputs.js prepare-site .artifacts/u2-guest-distribution/site-repair-v1
/Users/mutoakio/.local/share/mise/installs/node/24.21.0/bin/node scripts/migration-install/ci-inputs.js inspect-site .artifacts/migration-install/actual-site-v2.tar.gz
```

新archiveの実byte数と既存logical合計217941020bytesの和が268435456bytes以下であることを確認する。超過なら停止し、既存ciは変更しない。上限内で全ソース・生成JSが確定した後だけ、旧canonical CI入力をUUID付き新規保存先へ移し、新規prepare/inspect/restoreする。保存先の既存ファイルを上書きしない。

```sh
mv -n ci/migration-install ".artifacts/migration-install/ci-inputs-before-reference-$(uuidgen)"
/Users/mutoakio/.local/share/mise/installs/node/24.21.0/bin/node scripts/migration-install/ci-inputs.js prepare ci/migration-install
/Users/mutoakio/.local/share/mise/installs/node/24.21.0/bin/node scripts/migration-install/ci-inputs.js inspect ci/migration-install/inputs.bundle.json
/Users/mutoakio/.local/share/mise/installs/node/24.21.0/bin/node scripts/migration-install/ci-inputs.js restore ci/migration-install/inputs.bundle.json
U2_ACTUAL_SITE="$PWD/.artifacts/migration-install/actual-site" /Users/mutoakio/.local/share/mise/installs/node/24.21.0/bin/node --test --test-concurrency=1 tests/guest-distribution/integration.test.js
```

restoreは固定manifest sourceとblob、復元済み `dist/guests/aube` をbytes/SHA・regular fileとして検査してから、10件とcopy1件でサイトを構成する。既存siteがある場合は全11件を再検査し、黙って上書きしない。圧縮入力は既存CI manifestの通常の論理合計へ加え、materialized11件にも256MiB合計・128MiB個別・1MiB metadata・4096entryを適用する。最後の実配信8pass・skip0後も、新source/pack/consumerでcoverage・回帰・36試行・署名付きCI・正式完了確認を別途実施する。push/CIの具体コマンドと新しい短い完了確認コマンドは、従来どおり個別承認を待つ。

## CI 38766787639：共有coverage bridge修正の追加手順

同stageの `ci-38766787639-failure-and-repair-proposal.md` の承認対象1–5だけを実施する。CIの計測付きNodeは115件中113pass・2fail・skip0で、2件はinstall180秒期限を超過した。Atomic getter反復コストの寄与は推測のため、実測前に唯一の原因や改善量を断定しない。旧失敗ZIPと旧source成功証拠は保持する。

実装前に、realmごとのcounter単一writerとhost読取りだけの所有関係を、生成bridge・Node/Worker/browserの経路で確認する。共有部品のU1/U2への影響も記録する。保証できなければ修正を適用せず確認する。保証できた場合だけ、初期Atomics.load＋realm内最新値getterと、毎回の飽和Atomics.store後の最新値更新へ変更する。hit-only、sampling、counter省略は不可。

tests/package/coverage.test.tsの既存境界・飽和・不正値拒否に、従来方式との同じcounter列、複数realmの独立性、Worker中断後のhost可視性を追加する。不具合修正の失敗観測→修正→同じ試験で成功をmainで逐次実施する。新しいapproval receipt記録前に実装・試験を開始しない。

```sh
mise run build
mise run typecheck
/Users/mutoakio/.local/share/mise/installs/node/24.21.0/bin/node --test --test-concurrency=1 tests/package/coverage.test.js
/Users/mutoakio/.local/share/mise/installs/node/24.21.0/bin/node --test --test-concurrency=1 tests/migration-install/acceptance.test.js
```

対象回帰後、mainが新source・候補・独立consumerを準備し、FORMICARIUM_CANDIDATE/FORMICARIUM_CONSUMER/FORMICARIUM_SESSION_GUESTと検証済みU2_ACTUAL_SITEをその実入力へ設定する。既存出力を上書きしない新規coverageディレクトリを用い、以下の同じ12個別ファイル・115試験の実行件数・経過時間・fail/cancel/skip/TODO0を確認する。期待件数に合わせてskipや分母削除を行わない。

```sh
FORMICARIUM_U3_REPAIR_COVERAGE="$PWD/.artifacts/migration-install/collector-repair-coverage-20261016"
/Users/mutoakio/.local/share/mise/installs/node/24.21.0/bin/node scripts/migration-install/coverage.js prepare "$FORMICARIUM_U3_REPAIR_COVERAGE"
/Users/mutoakio/.local/share/mise/installs/node/24.21.0/bin/node --import "$FORMICARIUM_U3_REPAIR_COVERAGE/coverage-session-node-preload.mjs" --test --test-reporter=tap --test-isolation=none "$FORMICARIUM_U3_REPAIR_COVERAGE/tests/migration-session/guest-validation.test.js" "$FORMICARIUM_U3_REPAIR_COVERAGE/tests/migration-session/fixture.test.js" "$FORMICARIUM_U3_REPAIR_COVERAGE/tests/migration-session/reservation.test.js" "$FORMICARIUM_U3_REPAIR_COVERAGE/tests/migration-session/public.test.js" "$FORMICARIUM_U3_REPAIR_COVERAGE/tests/migration-session/consumer.test.js" "$FORMICARIUM_U3_REPAIR_COVERAGE/tests/migration-install/catalog.test.js" "$FORMICARIUM_U3_REPAIR_COVERAGE/tests/migration-install/transfer.test.js" "$FORMICARIUM_U3_REPAIR_COVERAGE/tests/migration-install/archive.test.js" "$FORMICARIUM_U3_REPAIR_COVERAGE/tests/migration-install/lifecycle.test.js" "$FORMICARIUM_U3_REPAIR_COVERAGE/tests/migration-install/public.test.js" "$FORMICARIUM_U3_REPAIR_COVERAGE/tests/migration-install/consumer.test.js" "$FORMICARIUM_U3_REPAIR_COVERAGE/tests/migration-install/hash-regression.test.js"
```

その後は新sourceに対する固定CI入力prepare/inspect/restore、新候補の全回帰・全21JS/全realm coverage80%以上・正式36試行を別工程として実行する。install180秒、非download中央値3秒、probe600秒、aube840秒、1worker、retry0、既存容量上限を維持する。正式36試行は計測を掛けない製品経路で実行し、証明書一時登録・削除は既存の具体承認手順に従う。

ローカル検証成功後にだけ、mainが追加の署名付きpushとCI再試行1回の実コマンドを提示して個別承認を待つ。CI失敗から合格の完了確認を生成しない。既存artifact verifierの旧source/失敗run向けbindingは履歴として残し、新source・実CI結果に対応する短い完了確認コマンドを改めて提示・承認してから確定する。

## CI 38784488074：直接counter生成の承認後手順

現在の実装前承認対象は本節である。前節までのCI入力・getter cache修正手順は既存作業の履歴として保持し、今回の変更を本節へ限定する。

正式計画の追加Step 8と同stageの `ci-38784488074-failure-and-next-plan.md` に限定する。現時点は計画のみで、実装承認後にmainがすべてのbuild/testを逐次実行する。旧getter cache修正と17件成功は履歴として維持する。CIの114pass/1failはtest27初回installの180681.584382ms TIMEOUTであり、単独CPU profile126673.701459msは統制した原因証明ではない。

先にtests/package/coverage.test.tsへ実instrumented fixtureの回帰を追加する。旧方式と新方式について、全statementの全hit・全counter列・各更新のAtomic書込み列・飽和・返値・評価順序・例外・function/branch countsを同じ入力で比較する。新しい直接記録経路を要求して現実装で失敗するREDを観測後、scripts/package/coverage.ts内の最小AST修正で同じ試験をGREENにする。対応不能な生成形を拒否するケース、複数realm独立性、Worker終了後のhost可視性を含める。sampling/ignore/hit-only/batch/分母削除は禁止。新helper moduleは計画へ個別pathと理由を追加するまで作らない。

```sh
mise run build
mise run typecheck
/Users/mutoakio/.local/share/mise/installs/node/24.21.0/bin/node --test --test-concurrency=1 tests/package/coverage.test.js
/Users/mutoakio/.local/share/mise/installs/node/24.21.0/bin/node --test --test-concurrency=1 tests/migration-install/acceptance.test.js
```

RED時は意図した失敗を確認して停止し、mainの確認後に本体修正する。修正後は同じ4コマンドを逐次再実行する。生成JSはmain build以外で変更しない。function/branch計測とstatement mapを保ち、初期値・飽和・例外後状態も旧方式と比較する。

対象GREEN後、mainが新source/consumer/candidateと固定CI入力をprepare/inspect/restoreし、検証済みU2_ACTUAL_SITEとFORMICARIUM_CANDIDATE/FORMICARIUM_CONSUMER/FORMICARIUM_SESSION_GUESTを新入力に設定する。前節の合同Nodeコマンドの12個別ファイル・115件はそのまま使い、coverage出力だけ未使用の新規path（例 `.artifacts/migration-install/direct-counter-coverage-20261016`）へ変更する。既存coverageやraw proofへ追記・上書きしない。115件すべてのpositive summary・fail/cancel/skip/TODO0を確認し、単独テスト成功で全受入れとしない。

その後、承認済みSteps 9–11の全18工程、全21配布JS/全realm coverage80%以上、正式36試行を新source/packで再実行し、U1/U2共有計測への影響も新証拠で確認する。install180秒、非download中央値3000ms、probe600秒、aube840秒、1worker、retry0、容量上限と論理集計規則は変更しない。証明書一時登録・36試行・削除/未登録確認は既存の具体承認手順に従う。旧U1/U2封印証拠、v5由来記録、失敗ZIP、pending binding/verifierは保持する。

全ローカル成功後にだけ、追加署名付きpushとCI1回の実コマンドを提示して別途承認を待つ。新CI独立API/ZIP・レビュー・新しい短い正式完了確認までU3未完了を維持する。CI用コマンドの実行や旧bindingの書換えはこの計画改訂作業に含めない。

## Playwright Node bootstrap：範囲拡張承認後の手順

同stageの `direct-counter-playwright-bootstrap-proposal.md` と正式計画の新追加Step 8を実装前承認対象とする。この改訂では実装しない。変更はscripts/package/coverage.ts、scripts/migration-session/coverage.ts、scripts/migration-install/coverage.ts、tests/package/coverage.test.ts、tests/migration-install/acceptance.test.tsとmain生成の各JSに限定する。Testing Contractは維持し、全build/testはmainだけで逐次実行する。

実生成・実Node子processで、Playwright collectionと同じhelper→計測contracts importのwriter未初期化を再現する。REDをmainで観測後に、専用bootstrapの先行importと独立SAB/writerを実装し同じ試験をGREENにする。子processの実行と終了を観測し、mockだけの初期化判定で代用しない。既存20件/acceptance32件を維持し、package/U2/U3設定すべての先行import、suite/processごとの開始登録と終了raw receipt、実カウントのmergeを追加する。

欠落した開始/終了、重複、改変、未知suite/process、未登録counter、負値/非整数/サイズ不一致、異常終了を拒否する。起動した全processの開始登録と終了receiptを照合し、既存Node/session receiptsが不変であることも確認する。全21JSとbrowser host/Worker/descendantを維持し、新runner realmsを分母・収集対象から除外しない。writer不在fallbackや非計測importで回避しない。

```sh
mise run build
mise run typecheck
/Users/mutoakio/.local/share/mise/installs/node/24.21.0/bin/node --test --test-concurrency=1 tests/package/coverage.test.js
/Users/mutoakio/.local/share/mise/installs/node/24.21.0/bin/node --test --test-concurrency=1 tests/migration-install/acceptance.test.js
```

対象GREEN後、新候補を固定する前に新規coverage出力をprepareし、次の実collection入口をmainで確認する。`<new-coverage>`は今回だけの未使用project内出力の絶対pathで置換する。Playwright CLIは既存固定インストールを使う。以下のcwdはproject rootで、各configのtestDirが対応testsディレクトリを指定する。出力・開始登録・全終了raw receiptを新出力内に限定する。`--list`は収集入口の事前確認でありbrowser試験実行の代用ではない。

```sh
/Users/mutoakio/.local/share/mise/installs/node/24.21.0/bin/node node_modules/@playwright/test/cli.js test browser-api.spec browser-worker.spec browser-broker.spec consumer.spec --config <new-coverage>/tests/package/playwright.coverage.config.mjs --workers=1 --retries=0 --list
/Users/mutoakio/.local/share/mise/installs/node/24.21.0/bin/node node_modules/@playwright/test/cli.js test consumer.spec --config <new-coverage>/tests/migration-session/playwright.coverage.config.mjs --workers=1 --retries=0 --list
/Users/mutoakio/.local/share/mise/installs/node/24.21.0/bin/node node_modules/@playwright/test/cli.js test consumer.spec --config <new-coverage>/tests/migration-install/playwright.coverage.config.mjs --workers=1 --retries=0 --list
```

CLI相対pathは上のコマンドではproject root基準とする（tests側cwdを採る場合は同じCLI絶対pathへ解決して実コマンドを記録する）。list起動した全processの正常な登録/終了receiptを検証し、開始のみや未捕捉processを成功扱いしない。実workerのbootstrap/終了raw収集は上記実Node子process回帰と後続browser実行の双方で確認する。

入口成功後に新source/候補/consumer/CI入力を固定し、全18工程・全21JS/全realm coverage80%以上・正式36試行を改めて実施する。install180秒、非download中央値3000ms、probe600秒、aube840秒、1worker、retry0、容量上限/論理集計規則は不変。証明書操作・追加署名付きpushとCI1回・正式完了コマンドはそれぞれ既存の具体承認境界に従う。旧U1/U2proof・失敗出力・pending verifier/bindingを編集せず、全18/36/CIの完了を先取りしない。

## 独立起動台帳・CI添付：承認後のレビュー対応

runner-registry-ci-review-repair-proposal.mdを正式計画へ反映した実装前承認対象。この改訂では実装しない。既存5TS/生成5JS境界にworkflow `.github/workflows/migration-install-u3.yml` を個別追加し、今回の本体変更はpackage collectorと既存2試験に限定する。Testing Contractは不変、全build/testはmainのみで逐次実行する。

実Node複数processの正常全rawを確認した後、1processのbegin/end両方をfixture内で除去し、拒否すべきREDをmainで観測してから修正し同じ試験をGREENにする。期待集合は `<coverage>/coverage-playwright-node/{package,session,install}/launches.jsonl` の独立起動台帳を根拠にする。recordはgeneration version/id/out/metadataSha256・suite・pid・ppidを持ち、O_APPENDの1writeで改行付き1record全bytesを追記する。台帳とbegin/endの全identity集合の完全一致を検証する。

台帳欠落/空、片側/両receipt欠落、重複launch/receipt、未知pid/generation、ppid/output/metadata改変、不正JSONL/途中行、不正counter/異常終了、未知suiteを拒否する。台帳にないreceiptも拒否し、並行実processのrecordが混ざらず正常時は全rawをmergeすることを確認する。既存54件・全counter/store/realm検証・既存node/session receiptsを維持する。

```sh
mise run build
mise run typecheck
/Users/mutoakio/.local/share/mise/installs/node/24.21.0/bin/node --test --test-concurrency=1 tests/package/coverage.test.js
/Users/mutoakio/.local/share/mise/installs/node/24.21.0/bin/node --test --test-concurrency=1 tests/migration-install/acceptance.test.js
```

workflowの既存upload pathsを削除せず、正式計画の具体3patternsでgeneration JSON・全begin/end JSON・固定launches JSONLを添付する。実生成pathとの一致を確認する。新CIではAPI digest/size照合済みZIPからgeneration・台帳・全begin/endとsource/pack/runを独立再照合し、旧binding/verifierを新sourceへ付け替えない。

対象GREEN後、前節の3suite --listを別の新規coverage出力で行い、同じstrict validatorで台帳/全begin/endを確認する。新source/候補/consumer/CI入力で全18工程・21JS全realm coverage80%以上・正式36試行を逐次再実行する。b608の全18/正式36成功（最大中央値2586.64ms、証明書削除済み）は履歴であり新sourceの代用にしない。180秒/3000ms/全caps/1worker/retry0は不変。macOS認証可能時の証明書実コマンド承認・削除/未登録確認、別承認push/CI1回、新U3正式完了確認まで未完了を維持し、旧U1/U2-onlyコマンドはU3に使わない。

## CI 38898228292：Firefox TLS修正の承認後手順

正式計画の最終追加Step 8と `ci-38898228292-firefox-tls-repair-proposal.md` を実装前承認対象とする。この改訂では実装しない。全build/testはmainだけで逐次実行し、Testing Contractは維持する。

先にtests/migration-install/acceptance.test.tsへ、Firefox起動方式の選択（profile未設定時は現行launch、設定時はlaunchPersistentContext＋試行ごとのnewContext）、不正profile（相対path・不在・symlink・cert9.dbなし）の計測前拒否、全contextの `ignoreHTTPSErrors:false` を、browserを起動しない単位で追加する。mainがREDを観測してから measure.ts を修正し、同じコマンドでGREENを確認する。

```sh
mise run build
mise run typecheck
/Users/mutoakio/.local/share/mise/installs/node/24.21.0/bin/node --test --test-concurrency=1 tests/migration-install/acceptance.test.js
```

GREEN後、修正版workflowと同じCA・leaf・nssdb・Firefox profile手順を、Docker上の `mcr.microsoft.com/playwright:v1.63.0-noble` で実行し、TLS検証を有効にしたままFirefox/Chromium/WebKitがHTTPSへ接続できることを確認する（再現スクリプトは `.artifacts/migration-install/firefox-tls-repro/`）。その後、新source/CI入力/候補/consumerで全18工程（`mise run migration-install-completion`、FORMICARIUM_INSTALL_LOCAL_ONLY=1）とローカル正式36試行を逐次再実行する。証明書の期限確認、承認後の一時登録、終了後の削除・未登録確認は既存手順に従う。追加署名付きpush/CI1回は別途承認を待つ。

## CI 38909083334：最新toolchain更新の承認後手順

正式計画の最終追加Step 8を実装前承認対象とする。この改訂では実装しない。全build/testはmainだけで逐次実行し、Testing Contractは維持する。

1. 先に `tests/migration-install/runner-ready.test.ts` と `tests/package/runner-ready.test.ts` の版期待値を、Node 26.12.0・Bun 1.4.3へ更新する。旧toolchain（Node 24.21.0・Bun 1.4.2）のまま次を実行し、版不一致のREDを観測する。
   ```sh
   mise run build
   /Users/mutoakio/.local/share/mise/installs/node/24.21.0/bin/node --test --test-concurrency=1 tests/migration-install/runner-ready.test.js
   ```
2. toolchainを更新する（`mise install`、`mise ls` で実体pathを確認、package.jsonの@playwright/test 1.64.1、`bun install` によるbun.lock更新、固定CLIで同梱browserを導入）。以後のNode実体pathは `mise ls` が示すNode 26.12.0のpath（予定値 `/Users/mutoakio/.local/share/mise/installs/node/26.12.0/bin/node`）を使う。
3. 同じrunner-ready試験を新Nodeで再実行してGREENを確認し、続いて次を逐次実行する。
   ```sh
   mise run build
   mise run typecheck
   mise run test-light
   <新node> --test --test-concurrency=1 tests/migration-install/acceptance.test.js tests/migration-session/ci.test.js
   ```
   保守・公開の tooling 試験（tests/tooling/ 配下で版を照合するもの）が test-light に含まれない場合は、個別pathで実行する。
4. 新source/CI入力/候補/consumerで、全18工程（`mise run migration-install-completion`、FORMICARIUM_INSTALL_LOCAL_ONLY=1）を実行する。その後、承認後にローカル正式36試行を実行し、終了後の削除・未登録を確認する。追加の署名付きpush/CI1回は別途承認を待つ。

## 追加SHAの必須ケース（既存）
独立Node crypto/WebCryptoの結果を比較し、空入力、既知vector、55/56/63/64/65byte padding境界、複数block、binary、offset付きviewを5–8以上の意味のあるケースで確認する。既存C03の不正ELF/digest/metadata/偽造handle拒否、コピー保護を維持する。Node/3browserの公開consumerと新候補の実36試行は、純SHA試験とは別に確認する。速さの予測を合格結果として扱わない。

## 必須ケース
catalog5–8+: snapshot mutation、default/exact選択、欠落/重複/未知字段、canonical digest、URL/名前/サイズ境界、偽造session。
transfer5–8+: 正常ELF/archive、unknown length、過大stream、宣言値不一致、SHA不一致、HTTPS/redirect制限、cancel/timeout、cleanup。
archive5–8+: 実asset展開、header/checksum/end不正、総量/count/path境界、duplicate/traversal、root外link/cycle/missing、PAX/GNU規則、選択非regular、cancel。
lifetime5–8+: 競合BUSY、caller cancel、deadline、reset/dispose、旧guest保持、atomic置換、late completion/旧token release、reader/listener/timer cleanup。
progress5–8+: sequence/phase/byte/unknown total、例外非干渉、reentry BUSY、terminal後無し、早期digest計測の非download計上。
consumer: 同一tarballの公開export/型、Node・3browserで正常installと実run、失敗再install/競合/中断/状態保持。全テストのpass/fail/skipと観測内容を記録し、fixture省略を成功へ変えない。

## 結果記録
実行command・開始終了・exit・テスト件数・失敗行・source/pack identityを残す。通常単体成功だけではU3完了としない。coverage/36試行/既存回帰/署名CI/正式短い完了確認は計画Steps9–11の別受入れ工程である。失敗時は再現結果と修正案を提示して確認する。

## Testing Contract

```json
{
  "version": 1,
  "methodology": "test-after",
  "source": "team",
  "ordering": "通常の実装は各テスト可能な層の実装後にテストを作成・実行し、不具合修正は再現テストの失敗を観測して修正後に同じテストの成功を確認する。",
  "scope": "classic",
  "test_strategy": "standard",
  "project_type": "brownfield",
  "applicable_notes": [
    {
      "layer": "org",
      "text": "We treat tests as a first-class deliverable in every Bolt. The specific\nmethodology (TDD, BDD, ATDD, or classic test-after) is affirmed at\npractices-discovery and recorded in `team.md` under this heading with explicit\n`Methodology` and `Ordering` fields; Code Generation resolves those fields\nindependently from coverage, tooling, and scope notes.\n\nWhen no posture has been affirmed, our default per scope is:\n- **Methodology**: test-after\n- **Ordering**: implement each applicable testable layer, then write and run\n  that layer's tests.\n- `mvp`, `enterprise`, `feature`, `infra`, `classic` add an 80% line-coverage\n  floor and CI execution before merge.\n- `bugfix`, `security-patch` add a targeted regression for the specific\n  bug/vulnerability and require the existing suite to remain green.\n- `express` uses the Minimal strategy: requirement-driven unit tests (one per\n  requirement, with a happy-path floor per component); existing tests remain\n  green.\n- `poc`, `refactor`, `workshop` add no extra new-test floor and require the\n  existing suite to remain green.\n\nThe active `Test Strategy` still applies in every scope and determines test\nvolume/types. Scope floors are additive; they never reduce or replace the\nselected strategy.\n\nBuild and Test verifies defined coverage floors and affirmed quality targets;\nthey may not be weakened to make a step pass.\n\nAffirm a stricter posture in `team.md` if the team commits to one."
    },
    {
      "layer": "team",
      "text": "- **Methodology**: test-after\n- **Ordering**: 通常の実装は各テスト可能な層の実装後にテストを作成・実行し、不具合修正は再現テストの失敗を観測して修正後に同じテストの成功を確認する。\n- ビルドとテストはmain sessionで逐次実行する。Node向けconsumer、Worker、process.execPath、Node専用flagの意味を確認し、Bunへ一括置換しない。Bun実行を採る箇所は実結果で互換性を確認する（未検証）。\n- 既存Biome・TypeScript・Playwright・node:testを証拠として使う。通常PR/main CIは固定候補入力を要求しない軽量経路から整備し、重いnative/ブラウザ回帰・配布coverageは別の明示経路へ対応づける（提案）。軽量CI成功だけで全受入れを通過したと扱わない。\n- 統合前CIと第一者配布JS固定一覧の行coverage80%以上を維持する。未収集ファイルを分母から消さず、Worker/別process/realmも記録し、欠落・skipを成功へ置換しない。\n- probe600秒、aubeブラウザ840秒、1worker、retryなし、probe8項目合格、native出力一致、wasm1GBを維持する。未変更aubeは再ビルドせず、計測時に重い処理を並行しない。新規コア回帰はnative Linuxでも確認する。実機Safariは未検証のまま区別する。"
    }
  ],
  "obligations": {
    "strategy": "standard",
    "strategy_volume": [
      "Five to eight tests per component.",
      "Unit tests plus integration tests for key boundaries.",
      "Add E2E, performance, or security tests when requirements demand them."
    ],
    "scope_floor": [
      "Keep the existing test suite green.",
      "This scope adds no extra new-test floor beyond the selected test strategy."
    ],
    "combination_rule": "Apply every selected-strategy obligation and every scope-floor obligation; neither replaces the other, and a targeted scope regression may add the narrowest necessary test type beyond the strategy default."
  },
  "plan_profile": {
    "methodology": "test-after",
    "runner_step": "Verify the existing test runner/configuration and record the exact unit-scoped command.",
    "runner_ready_before_first_test": true,
    "testable_layers": [
      "Data model / database behavior",
      "Repository / data access",
      "Business logic",
      "API / endpoint",
      "Frontend behavior"
    ],
    "steps": [
      "Project structure and production configuration skeleton.",
      "Verify the existing test runner/configuration and record the exact unit-scoped command.",
      "Data model / database behavior - implement.",
      "Data model / database behavior - write and run its tests after implementation.",
      "Repository / data access - implement.",
      "Repository / data access - write and run its tests after implementation.",
      "Business logic - implement.",
      "Business logic - write and run its tests after implementation.",
      "API / endpoint - implement.",
      "API / endpoint - write and run its tests after implementation.",
      "Frontend behavior - implement.",
      "Frontend behavior - write and run its tests after implementation.",
      "Environment/build configuration.",
      "Documentation and traceability."
    ]
  },
  "input_sha256": "sha256:c174dde61b23d97d1733ad98b91568ee85c7de913db166d498965b6845a4c286",
  "contract_sha256": "sha256:10b6f50c2e853225a46984ab35ccfb615ca938fd59f89dd0c81174ba91834d14"
}
```


