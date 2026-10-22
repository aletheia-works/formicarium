# U4 command 実装計画

## Summary

- Builds（5回目の再開、2026-10-20、追加Step 17–26）：mainの上で、U1〜U4をまとめた正式受入とB1の正式な行（`verified-with-ci`、`b1.formal: true`）を作る仕組み。手動で動かす受入のworkflow、入力を戻すscript、CIのrunを観測して `observed-ci-summary` を書くscript。
- Touches（5回目）：新規は `.github/workflows/migration-acceptance.yml`、`scripts/migration-command/acceptance-inputs.ts`、`scripts/migration-command/observe-ci.ts`、`ci/migration-command/inputs.json`、`tests/migration-command/acceptance-ci.test.ts`、`mise-tasks/migration/command-observe.sh`。変更は `package.json`（scriptの追加）と、U4の `unit-test-instructions.md`・`code-summary.md`・`traceability.json`・`source-manifest.json`。U1〜U3のfileと製品コードは変えない。
- Tests（5回目）：入力の照合・観測・workflowの定義の拒否試験を中心に約25件（各部品5–8件）。そのうえで、CIの受入1回、観測、手元のU4の正式な完了確認（U2・U3の試験を含む）、U1の今の確認（最新のNodeでの36試行）を行う。push・CI・Release・証明書の操作は、それぞれ実コマンドを示して個別に承認を受ける。
- 今回の再開（2026-10-18、追加Step 11–16）：U4の記録を新しい土台（upstreamのmain `2a79860`）に合わせ、review-04のR-09〜R-12を直す。受入の方法はU3と同じ「ローカル暫定＋最終確認へ」とする（人間の指示、2026-10-18）。U4の製品コード・受入の入口のコードは変えない。触るのはU4の記録（この計画、`unit-test-instructions.md`、`code-summary.md`、`traceability.json`、`source-manifest.json`）と、working copyに残るgitignoreされた古い生成物だけ。試験は加えず、mainでlint・typecheck・build・test:light・U4の候補作成・`migration-command-unit`・`migration-command-browser`・`FORMICARIUM_COMMAND_LOCAL_ONLY=1` の暫定の完了確認を1つずつ実行する。証明書の一時登録は人間がターミナルで行う。下の各行は、それより前の再開の要約（古い土台の履歴）である。
- Builds: C05の公開command API（`createCommandSession`／`execute`）。Tokenizer、builtin・install・guest runへの振分け、lsの表示を作る。あわせて、U4専用の受入入口（B1統合受入＝C06の証拠、CI経路、完了確認）を作る。
- Touches: 新規はruntime/command.ts・runtime/command-parse.ts、tests/migration-command/、scripts/migration-command/、.github/workflows/migration-command-u4.yml。変更はruntime/public.ts、types/index.d.ts、package.json、bun.lock（@types/nodeを最新の26系へ）、scripts/package/stage-package.ts・coverage-inventory.json、mise.toml、docs/command-api.md、README.md。
- Tests: Tokenizer・振分け・ls表示・取消・結果の単体試験（各部品5–8件以上、計約50件）と、独立tarballによるNode/3browser consumer・型試験。受入入口の拒否試験。そのうえで、全回帰・全配布JSと全realmのcoverage80%以上・正式36試行・B1全check・署名付きCI1回を受け入れる。push・CI・完了確認コマンドは別途承認する。
- 今回の再承認で加えたもの（2026-10-17）：項目5（`blink.log`。`runtime/core.ts` の `-L /dev/null`。回帰試験はU4の新しいfile `tests/migration-command/blink-log.test.ts` に置き、U2のfileは変えない）と、項目6（U3の受入入口への依存の向き。U4の薄いmeasure CLI、`completion.ts` の `measure` 工程の差し替え、U4の `stage.ts` の重複定義の削除）。項目5・6は実施済み。
- 2回目の再承認で加えるもの（2026-10-17）：項目7（公開用inventoryを23件・33fileへ更新し、公開runnerを固定の版で作り直す。公開の境界は変えない。U1〜U3のやり直しを伴う）。項目7は実施済み。
- 3回目の再承認で加えるもの（2026-10-17）：項目8（CIでmeasure工程が拒否された件。U4のCIのcommand対応にU4のmeasure CLIを加え、全工程をCIの対応に通す試験を加える。U4のfileだけを変える。そのあと、ローカルのU4の受入と、署名付きCIの2回目を行う）。

## 前提と境界

根拠は承認済みのU4 functional-design（W1–W6、BR4.1–BR4.17）、nfr-requirements（NFR2.1–NFR8.2の13件）、nfr-design（D1–D5）、infrastructure-design（cicd-pipeline.mdの12工程）。契約はC02/C04/C05/C06/C11で、要件はFR3・FR4・FR5・FR6である。User Storiesは生成されていないため、要件IDと設計IDへ直接対応させる。

既存のU2（Session・内部SessionPort・公開listEntries）とU3（createInstaller）を呼ぶだけにする。cwd・FS・登録guestの複製や、取得・展開・検証の再実装はしない。U2/U3の製品コード・公開API・SHA算法と、U1–U3の封印済み証拠・承認済み完了確認コマンドは変更しない。U2/U3の変更が必要と分かった場合は、黙って直さずに停止し、確認する。

AI-DLC本体は変更しない。品質基準は緩めない：install180秒、非download中央値3000ms以下、配布JSのcoverage80%以上、probe600秒、aube840秒、1worker、retry0、容量上限。DB・永続repository・独立UIは存在しないため、その層は省略する。UI条件はU6/U8へ受け渡す。全build・testはmain sessionで逐次実行する。各層の実装後にテストを書いて実行し、失敗したら観測結果と修正案を示して確認を待つ。

## 後工程扱いにしたレビュー指摘の反映

functional-design・nfr-requirements・nfr-design・infrastructure-designのレビューでMinorとされ、人間の判断で本計画へ持ち越した事項である。各Stepの実装と試験で扱う。

1. 孤立surrogateは `String.prototype.isWellFormed()` で検出し、INVALID_INPUTとする（Node/3browserで同じ判定）。byte数は `TextEncoder` で変換した後の長さで数える。
2. lsは表示文字列（`name/`、`name -> target`、`name`）全体をUTF-16 code unit順で並べる。NFR設計D4が機能設計W6（名前順）より優先する。例：`a.b` は `a/` より先。
3. 判定の順序は INVALID_INPUT（予約前の検証）→ ABORTED（事前abort）→ 予約時の DISPOSED／BUSY とし、試験で固定する。同期builtinは開始後に中断しない。
4. guest runはtimeoutMsを渡さず、Session.runの既定値600000msに従う。commandIdは持たない。操作の識別はrunIdとinstallation.operationIdで行う。
5. `ls` `cat` `rm` `cd` `install` は予約名とする。同名のguestはcommandからは呼べない。`install ls@x` のように予約名のtoolを登録できることも含め、JSDoc・docs・試験で示す。
6. U6/U8の責任となるUI条件（loading/empty/error、keyboard、進捗unknownと0の区別、時刻offset、表示上限）の受渡しを、JSDocとdocsに明記する。
7. browserのbuild番号は文書に固定しない。Playwrightの版と、実行時に観測した値を証拠に記録する。
8. 機能設計のtraceabilityに欠けていたFR4（BR4.1／BR4.12）を、本stageのtraceabilityで対応付ける。
9. B1の証拠には、C06の名前付き必須field（sourceCommit・packSha256・inventorySha256・preflightEvidenceId）と、各checkの`logSha256`を含める。B1の正式な行は、署名付きCI1回の生ログから作る。ローカル実行は事前確認であり、正式行の代わりにしない。
10. CI artifactの保持期間は、U4の専用workflowで7日にする（U3は1日）。そのうえで、run完了の直後に取得・保存する。保持期間を延ばすのは、証拠を失わない方向の変更である。
11. traceabilityのNFR2.1・NFR8.2は、節ではなく具体的な試験・入口のファイルへ対応付ける。

## Steps

- [ ] Step 1: 構成とrunnerの確認。開発に使う各toolが最新版かを確認する。2026-10-17の確認値は、Node 26.12.0、Bun 1.4.3、@playwright/test 1.64.1、TypeScript 7.0.2、Biome 2.5.15、istanbul-lib-instrument 6.0.3、Actions（checkout v7.0.1、setup-node v7.1.0、setup-bun v2.2.0、upload-artifact v7.0.2）。古いのは `@types/node`（^24.19.1。最新は26.6.5）だけなので、package.jsonを `^26.6.5` に更新し、`bun install` でbun.lockを更新する。開始時に新しい版が出ていれば、その版と差分を報告して確認する。tests/migration-command/runner-ready.test.tsを作り、Node 26.12.0・ESM・独立consumer入力・試験の探索範囲を確かめる。mainでbuild後、このrunner-ready試験を最初に実行し、実行できることを記録する。mise.tomlに `migration-command-unit`／`migration-command-browser`／`migration-command-stage`／`migration-command-completion` を個別path指定で宣言する。（FR6、NFR6.1）
- [ ] Step 2: 入力検証とTokenizerをruntime/command-parse.tsに実装する（InputGuard・Tokenizer・ListingFormatter）。内容はD1／W2の5状態、BR4.2–BR4.7、反映事項1・2。依存は追加しない。実装後にtests/migration-command/parse.test.tsを作成・実行する。確認するのは、W2の例表9件、65536／65537 bytesと多byte文字の境界、孤立surrogate、LF/CR/NUL、引用外のshell記号14種と `[ ] ~ # ! =` のliteral、`''` `""` の空Token、引用の連結、二重引用内の `\"` `\\` と他の `\x`、未閉引用・末尾backslash、非ASCII・NBSP・全角空白の保持。lsの表示は、dir/symlink/file、`a.b` と `a/` の順、0件の空bytesを確認する。（BR4.2–BR4.7、BR4.11、NFR3.1、NFR7.1）
- [ ] Step 3: 振分けとadapterをruntime/command.tsに実装する（CommandDispatcher、BuiltinAdapter、InstallAdapter、GuestRunAdapter、ResultBuilder）。factoryは `sessionPort(session)` で偽造sessionを拒否し、`createInstaller(session, catalog)` を1つだけ作る（catalog不正はC04のINVALID_INPUT）。cat/rm/cdは `acquire('fs')`→`builtin`→finallyで `release`。lsは公開 `session.listEntries` を1回。installは内部Installerへ選択1つと `{signal, onProgress}` を渡す。guest runは `acquire('run')`→`runInstalled(r, argv[0], rest, {signal, onOutput})`→finallyで `release`。形の検証（BR4.9、BR4.12）とsignalの事前確認は予約の前に行う。stdout/stderrは呼出しごとに新しいUint8Arrayにする。installの成功行は `installed <tool>@<versionOrName> (sha256 <digest>)\n`。実装後にtests/migration-command/dispatch.test.tsを作成・実行する。確認するのは、各builtinの形と不正形、`rm -r -f` の拒否、`ls -a` の拒否、未登録toolのNOT_FOUNDと予約の解放、非0終了のresolve、ExecutionErrorのreject、判定順序（反映事項3）、事前abortで予約を取らないこと、builtin開始後のabortが結果に影響しないこと、timeoutMsを渡さないこと、予約名、`install ls@x` 後も `ls` がbuiltinになること、結果bytesが内部bufferと別であること、拒否時にFS・cwd・登録が変わらないこと。（BR4.1、BR4.8–BR4.17、NFR3.2、NFR3.3、NFR4.1、NFR4.2、NFR5.1、NFR7.2）
- [ ] Step 4: 公開APIと型。runtime/public.tsへ `createCommandSession` を追加し、types/index.d.tsへ `CommandOptions`・`CommandResult`・`CommandSession`・`createCommandSession` をC05のshapeどおりに追加する。公開entry点は増やさず、内部portは非公開のままにする。JSDocに、予約名、builtinの同期完了と取消、既定timeout、原本bytes、UI条件のU6/U8への受渡しを書く（反映事項5・6）。実装後にtests/migration-command/public.test.tsと、types-valid.ts・types-invalid.tsを作成・実行する。確認するのは、root exportの存在、偽造session・他packageのsessionの拒否、同じSessionに2つのCommandSessionを作った場合のBUSY、直接API（`session.run`、`installer.install`、`registerValidatedGuest`）との競合BUSY、reset/dispose後のDISPOSED、連続操作（cd→ls→cat→rm→ls）でのcwd/FSの維持、install失敗後の旧登録の保持、ProgressとonOutputの中継。型invalid fixtureはtsconfig.tests.jsonの通常buildから除外し、専用の型検証で明示的に実行する。（BR4.1、BR4.10、BR4.15、FR3、FR4、FR5、NFR5.1、NFR7.2）
- [ ] Step 5: 配布物とconsumer。package.jsonのfiles、scripts/package/stage-package.tsのFIRST_PARTY_JS・PACKAGE_FILES、scripts/package/coverage-inventory.jsonに、runtime/command.jsとruntime/command-parse.jsを加える（第一者配布JSは21から23件になる）。既存の21件は分母から除かない。実装後にtests/migration-command/consumer.test.ts、consumer.spec.ts、playwright.config.ts、browser-modules.d.tsを作成・実行する。独立tarballを使い、Node／Chromium／Firefox／WebKitで同じ公開APIを確認する：空端末→install→guest run→builtin操作→reset、競合BUSY、install失敗後の旧登録保持、非ASCII入力の保持、command経由と直接installのInstallResult（tool・versionOrName・digest・buildKey）の一致、型と全配布資産の一致。実行時に観測したbrowserの版を記録する（反映事項7）。（FR3、FR5、FR6、NFR6.1、NFR8.1）
- [ ] Step 6: U4専用の受入入口を作る。scripts/migration-command/stage.ts、coverage.ts、completion.ts、ci.ts、ci-inputs.tsと、B1の証拠を組み立てるb1.tsを作成する。U2/U3の入口（scripts/migration-session/、scripts/migration-install/）の部品はimportして再利用し、変更しない。共通化のためにU2/U3側の変更が必要になった場合は、個別pathと理由を示して確認する。completionの工程は、U3の18工程に、U4のunit・browser・型の各試験と、U4の追加JSを含む計測付きcoverageを加えたものとする。b1.tsは、C06のB1必須集合（guest-validation・fixture-validation・handle-copy・install-lifecycle・command-behavior・package-consumer をnode/chromium/firefox/webkitの各行、types・package-inventory・source-baseline・coverage-80・probe-eight・aube-native-match・wasm-memory-cap をhost各1行）を、実在する生ログの `logSha256` から作る。`preflightEvidenceId` はU1の既存preflight証拠から読み、`packageVersion` は `0.3.0`。欠落・重複・failed・unverified・存在しないlogは拒否する。架空のdigestは作らない。.github/workflows/migration-command-u4.ymlは、U3のworkflowと同じ構成（contents read、専用branchのpushだけ、同じbranchの直列化、timeout360分、job専用CAとFirefox profile、cleanup）にする。artifactの保持期間は7日とし、生ログ・runner台帳・B1 JSONを添付する（反映事項9・10）。実装後にtests/migration-command/acceptance.test.tsを作成・実行する。確認するのは、B1必須集合の欠落・重複・failed・unverified・未知environment・log不一致の拒否、named fieldの欠落の拒否、exit0でもskip/fail/空summaryを含むログの拒否、U3の証拠やU3の完了確認コマンドを流用した入力の拒否。（BR4.10、NFR2.1、NFR2.2、NFR8.1、NFR8.2、FR6）
- [ ] Step 7: 文書と追跡。docs/command-api.mdを作成し、README.mdのAPI一覧を更新する。内容は、構文の範囲（拒否する記号、escape）、予約名、取消とtimeout、原本bytesとUI条件の受渡し、Safari実機が未検証であること。生成JSは内容を変えずにjjで追跡する。source-manifest.jsonには個別の実ファイルを列挙し、意図しない.js.mapを入れない。（NFR7.1、NFR7.2）
- [ ] Step 8: ローカルの正式受入れを逐次実行する。新しいsource・候補・独立consumer・固定CI入力を準備し、`mise run migration-command-completion` で全工程を実行する。全23配布JSと全realm（Node・Worker・別process・browser・Playwright runner）の生coverageで、行coverage80%以上を確認する。probe8項目・aube native一致・wasm1GB・waitAsync削除を維持し、未変更のaubeは再buildしない。その後、正式install36試行（`scripts/migration-install/measure.js` を新候補で実行。非download中央値3000ms以下、install180秒）を行う。証明書の一時登録が必要なら、既存証明書の期限と指紋を確かめ、実コマンドを提示して承認を受ける。終了後は信頼設定と証明書を削除し、未登録を確認する。計測中は重い処理を並行しない。（NFR2.1、NFR2.2、NFR8.1）
- [ ] Step 9: ローカル成功後にだけ、署名付きjj pushとCI1回の実コマンドを提示し、個別承認を待つ。CIでは、Bunの実絶対pathと版、Node 26.12.0を確かめる。run完了の直後に、GitHub REST（run/jobs/commit/artifacts）とZIPのdigest・sizeを取得・保存する。そのうえで、署名Verified・head・pack・生証拠（runner台帳とB1 JSONを含む）・同じ候補であることを独立に照合する。U3のbranchやrunをU4の成功として使わない。失敗した場合は、基準を変えずに停止し、修正案を示す。（NFR8.1）
- [ ] Step 10: 独立した最終レビューを行う。その後、U4（とB1）の新しいsource・report・生証拠・script SHAを固定した、読取専用の短い完了確認コマンドを作る。改変した証拠を拒否することも試験する。実コマンドを提示して承認を待ち、承認後の正式確認が成功したら通常の完了へ進む。U3の完了確認コマンドや、U1/U2のv8コマンドは使わない。code-summary.md・traceability.jsonはこのStepで仕上げる。（NFR8.1、FR6）

## 追加Step：build失敗と設計の不足への対応（2026-10-17、人間の回答）

Steps 1–7のコードを書いた後、mainの `bun install`（@types/node 26.6.5）と `mise run build` で、型エラーが2件出た。開発担当の報告とmainの確認で、設計の不足も3件見つかった。人間は4件すべてについて推奨案を選んだ。この追加Stepで、計画の境界を次のとおり広げる。それ以外の境界は変えない。

1. Node 26の `stripTypeScriptTypes` は `mode:'transform'` を廃止した。Node 26.12.0で実行すると `ERR_INVALID_ARG_VALUE ... must be one of: 'strip'` になる（mainが観測）。`scripts/terrarium/coverage.ts:497` の1か所だけを `mode:'strip'` に変える。対象のterrarium sourceがstripで通るか（消去できない構文がないか）を、terrariumのcoverage試験（tests/terrarium/coverage.test.js）で確かめる。通らなければ、停止して報告する。この不具合はU3のtoolchain更新から存在し、古い@types/nodeが型の不一致を隠していた。
2. `scripts/migration-install/measure.ts:326` は、browser側の `/runtime/public.js` の型に `createCommandSession` がないためエラーになる。U3のファイルは変えずに、tsconfig.jsonのincludeへ `tests/migration-command/browser-modules.d.ts` を加える。
3. U2の `normalizePath` は絶対pathだけを受け付ける。そのため、`cat a.txt` のような相対pathはINVALID_INPUTになる。設計（D2・BR4.16）は「cwd基準の解決はU2が行う」としていたが、それは誤りだった。U2の内部SessionPort（runtime/session-port.tsのinterfaceとruntime/lifecycle.tsの実装）に、相対pathを現在のcwd基準で絶対pathへ解決する同期methodを1つだけ加える。U2の状態は変えない。公開APIと既存の `normalizePath`・`..` 拒否・NUL拒否の規則は変えない。U4は、cat/rm/cdではfs予約の取得後にpathを解決してからbuiltinへ渡す。lsでは、解決してから同じtickで公開listEntriesを呼ぶ。試験は、U4（dispatch/public/consumer）の相対pathに加えて、U2の内部port回帰（tests/migration-session/reservation.test.tsへの追加）で、相対・`.`・絶対・`..`拒否・cd後の解決・状態不変を確認する。U2の封印済み証拠は変えない。
4. 配布JSを21件から23件に増やすと、件数やroot export一覧を固定した既存の試験・入口が失敗する。次の個別pathの期待値を、23件と `createCommandSession` へ最小限に更新する：tests/package/pack.test.ts、tests/package/coverage.test.ts、tests/terrarium/coverage.test.ts、tests/migration-preflight/current-completion.test.ts、tests/package/public.test.ts、scripts/migration-install/completion.ts（`=== 21` の検査）。U3の試験・計測（tests/migration-install/consumer.test.ts、consumer.spec.ts、hash-regression.spec.ts、scripts/migration-install/measure.ts）が候補unitを `u3-install` に固定している箇所は、`u3-install` と `u4-command` の両方を受け付けるように最小限に変える。U3の封印済み証拠・承認済み完了確認コマンドのbindingは変えない（今後のtreeでU3の完了確認を再実行しないことを記録する）。公開用inventory（scripts/release/inventory.tsと、それに一致を求めるtests/tooling/publication-alignment.test.ts）は今回は変えず、公開経路の判断として別途扱う。そのため `publication-alignment` が失敗した場合は、成功へ書き換えずに、既知の未解決として報告する。

各項目は、mainが修正後にbuild・typecheck・対象試験を逐次実行して確認する。意図しない失敗は報告して確認する。

### 2026-10-17の追記：実施済みの項目と、最後にまとめて行う確認

U1〜U3の再確認のあいだに、上の項目1と2は先に実施した。U1の再開（U1計画のStep 16）の中で行い、`tests/terrarium/coverage.test.js` は16/16でpassした。U4の試験の補助file（`tests/migration-command/harness.ts`）の型も1か所直した。`tests/migration-preflight/current-completion.test.ts` の23件の期待値も、U1の再開の中で更新した。

項目4の対象には、U3の再レビュー（review-04）が挙げた箇所も加える。
- `scripts/migration-install/completion.ts` の76・363行（21件の検査）と、59・310・368行（候補のunit）。
- `scripts/migration-install/coverage.ts` の45・123・124行（候補のunit）。
- `checkInstallCandidate` のsource一致の判定。
- U2の `SESSION_REALMS` などで、件数を固定している箇所。

ほかに、command.js・command-parse.jsが加わったことでU3のcoverageの分母が変わる点と、browser試験でこの2fileが配信されるかを確かめる。

intentの検証コマンドは、人間の承認により、U1の試験を今のsourceで実行するコマンドに一時的に置き換わっている（U1〜U3のcheckpointの確認に使用。101/101 pass）。U4の作業がすべて終わった後、最終的なsourceで、次をまとめて1回行う。
1. U1の36試行とcurrent completion（v11）。試行の記録に、NodeとPlaywrightの版を残す。
2. U3の受入。新しい候補での正式36試行と、U3の完了確認を最終的なsourceに合わせる。
3. Step 8〜10のU4の受入（B1、署名付きCI1回）。
4. 最終的なsourceに結び付いた新しい検証コマンドを作る。U1〜U4を覆うもので、人間の承認を受けて設定し、U4のcheckpointを確かめる。

各実行・push・CI・証明書の操作は、直前に実コマンドを示して承認を受ける。AI-DLCの版は、配布元の検査を通った新しいpreviewが出たら、速やかに更新する（人間の指示）。

### 2026-10-17の追記：項目5 guestの実行でblink.logが作られる不具合（人間の回答「不具合として別に直す」）

U4のbrowserのconsumer試験で、3つのbrowserとも同じ1件が失敗した。guestの実行後の `ls` に `blink.log` が出たためである。mainは読取り専用の診断（`.artifacts/u4-red/blink-log-check.mjs`）で、Nodeでも同じことを確かめた。空の `/work` でguestを1回実行すると、`/work/blink.log` ができた。

原因：blink（fork）は、`-L PATH` がないと、起動時にcwdへ `blink.log` を作る（`.vendor/blink-src/blink/log.c:43` の `DEFAULT_LOG_PATH`）。私たちのcoreの起動（`runtime/core.ts` の `blinkCore.argv`）は、`-L` を渡していなかった。

5. 次のように直す。
   - 変更するfile：`runtime/core.ts`。U4がclaimする。もともとは別のintent `261006-npm-terrarium-release` のu1-runtime-packageがclaimしていた。そのintentで受入れ中の公開RCのタグと固定入力は変えない。
   - 変更の中身：`blinkCore.argv` が、常に先頭に `-L /dev/null` を渡す。blink固有の知識は `runtime/core.ts` にだけ置く（ADR 0003）。診断用の `coreFlags` はその後ろに付ける。後ろの `-L` が優先されるので、診断でログが必要な場合は上書きできる。
   - 試験：不具合修正の順序に従う。
     1. 先に、U4の新しい試験file `tests/migration-command/blink-log.test.ts` へ回帰試験を加える。guestを実行した後、cwdに `blink.log` がなく、session FSにも作られていないことを確かめる。（2026-10-17の変更：はじめはU2の `tests/migration-session/` の既存試験fileに加える予定だった。しかし、U2がclaimするfileを変えると、承認済みのU2がまたやり直しになる。そのため、U4のfileに置く。）
     2. mainが、修正前のREDを観測する。
     3. 修正後、同じ試験でGREENを確かめる。
     4. 試験で、`/dev/null` がNodeとbrowserのsession FSにあって開けることも確かめる。
     5. `argv` の単体試験（既存の `tests/package/` のcore試験、または新しい1件）で、`-L /dev/null` が先頭にあることと、`coreFlags` の `-L` が後ろに付くことを確かめる。
   - U4のbrowser試験（`consumer.spec.ts`）とNodeの試験は、`blink.log` がないことを前提にしたまま、修正後にpassすることを確かめる。期待値を `blink.log` に合わせて書き換えない。
   - coreを使う既存の回帰（probe8項目、aube、native出力の一致、wasm1GB）は、最後にまとめて行う確認で実行する。guestのstdout・stderrに影響がないことを、実際に実行して確かめる。基準（600s/840s、worker1、retry0）は変えない。
   - `argv` の単体試験も、U4のfile（同じ `blink-log.test.ts`）に置き、U2・U3がclaimする既存の試験fileは変えない。

### 2026-10-17の追記：項目6 U3の受入入口への依存の向き（U3 review-05 R-10の後始末）

U3は、U3の再開（U3計画のStep 16–18、review-06 READY、checkpoint承認済み）で、受け入れるunitの一覧と、source一覧の選び方を、U3の `scripts/migration-install/stage.ts` に移した（`INSTALL_REGRESSION_UNITS`・`installCandidateInventory`・`InstallCandidateOptions`）。U3の入口は、U4のmoduleをimportしなくなった。U4の候補では、呼出し側が `commandSourceInventory` を渡さなければ拒否される。そのため、今のU4の `completion.ts` の `measure` 工程（U3の `scripts/migration-install/measure.js` をCLIで起動）は、U4の候補では拒否される。

6. 次のように直す。U3・U2のfileは変えない。
   - U4の薄いCLI `scripts/migration-command/measure.ts`（と生成JS）を作る。中身は、U3の `measureInstall(out, root, { commandSourceInventory })` を呼ぶだけにする。計測の手順・基準（36試行、非download中央値3000ms、install180秒）は、U3の関数のものをそのまま使う。
   - U4の `completion.ts` の `measure` 工程を、この新しいCLIに変える。
   - U4の `scripts/migration-command/stage.ts` にある `INSTALL_REGRESSION_UNITS` と `candidateSourceInventory` は、U3の定義と重なるので消す。U4の入口がこれらを使う場合は、U3の `stage.ts` からimportする（U4→U3の向き）。
   - 試験：U4の `tests/migration-command/acceptance.test.ts` に、次を加える。新しいCLIがU4の一覧を渡すこと。U4の `completion` の工程表で `measure` がU4のCLIを使うこと。U4のmoduleに、U3と同名の定義が残っていないこと。不具合修正の順序に従い、先にREDを観測してから直す。
   - 計測付きの実行（正式36試行）は、最後にまとめて行う確認の中で行う。

### 2026-10-17の追記：項目7 公開用inventoryを23件へ更新する（人間が承認した修正案 `publication-inventory-23-proposal.md`）

最後のまとめた確認のD2（U3の受入）が、`test-light` の工程で止まった。`tests/tooling/publication-alignment.test.ts` の2件（21件・31file前提）がfailしたためである（項目4で既知の未解決としていたもの）。D1（U1の36試行）は36件passした。D3とFは実行していない。証明書は削除し、不在を確かめた。

7. 次のように直す。
   - `scripts/release/inventory.ts` の `FIRST_PARTY_JS` に、`runtime/command-parse.js` と `runtime/command.js` を、配布用inventory（`scripts/package/stage-package.ts`）と同じ位置（`runtime/install.js` の後ろ）に加える（23件。`PACKAGE_FILES` は33file）。`HISTORICAL_U1_JS`（14件）と `HISTORICAL_PACKAGE_FILES`（24件）は変えない。
   - `tests/tooling/publication-alignment.test.ts` の期待値と試験名を、23件・33fileへ変える。配布用inventoryとの完全一致の判定は残す。
   - 公開の境界は変えない。publication CLIは、`HISTORICAL_PACKAGE_FILES` にないfileを含むpackを、引き続き「U2 publication missing module coverage; U4/B1 evidence required」で拒否する。2件目の試験で、この本来の拒否理由に届くことを確かめる。
   - 公開runnerを、固定の版（Bun 1.4.3、Biome 2.5.15）で作り直す：`node scripts/release/bundle.ts generate /Users/mutoakio/.local/share/mise/installs/bun/1.4.3/bin/bun $PWD/node_modules/.bin/biome`。`.github/publication/runner.mjs` と `runner-manifest.json` を更新する。`bootstrap.mjs` が変わった場合は記録する。
   - 試験：今の2件のfailをREDとして記録済み。直したあと、mainで1つずつ実行する：`publication-alignment`・`publication-bundle`・`publication-bootstrap`・`publication-version`・`publication-assets` の試験と、`mise run test-light`。どれもfail・skip 0（test-lightの既存のskip patternを除く）であることを確かめる。
   - `ci/migration-install/inputs.bundle.json`（U3のCIの固定入力）は、今回は作り直さない。ローカル限定の受入でこの不一致のために止まったら、止めて報告する。
   - 変えるfileは、U1・U2・U3もclaimしている。項目7のあと、U1→U2→U3の順にもう一度1回ずつやり直す（各Unitで、計画の承認とレビューの依頼を人間から受ける）。別のintent `261010-bun-ci-modernization` の記録は変えない。
   - そのあと、最後のまとめた確認を、Bから（新しいsourceで候補と独立consumerを作り直して）やり直す。D1の36試行は使い回せる見込みである（推測）。Fの組み立てで不一致が出たら、D1からやり直す。
   - 受入れ中の公開RC、そのタグ、固定入力は変えない。公開・push・CIは、この項目に含めない。

### 2026-10-17の追記：項目8 CIでmeasure工程が拒否された件（人間が承認した修正案 `u4-ci-measure-entry-proposal.md`）

最後のまとめた確認は、ローカルではすべて成功した（U4の受入：22工程pass、coverage 92.16%、正式36試行pass、B1の31 checkがpass）。署名付きpush（commit ec8ab359、GitHub Verified）のあと、CI run 39025918280（1回目）はfailureだった。正式36試行の前までの工程はpassしたが、`measure` 工程が「U2 CI Node entry refused」で拒否された。原因は、項目6で `measure` 工程を `scripts/migration-command/measure.js` に変えたのに、U4のCIのcommand対応（`scripts/migration-command/ci.ts` の `mapCommandCICommand`）が `scripts/migration-command/coverage.js` しか許していなかったことである。RESTの記録・artifact・失敗logは `.artifacts/migration-command/ci-39025918280/` に保存した。

8. 次のように直す。U4のfileだけを変える。
   - 先に、`tests/migration-command/acceptance.test.ts` に再現試験を書き、failを観測する。completionの全工程を `mapCommandCICommand` に通すとすべて受け付けられ、`measure` は `scripts/migration-command/measure.js` のまま、引数もそのままであることを確かめる。`scripts/migration-command/measure.js` でも、checkoutの外への絶対pathは拒否されることを加える。既存の拒否の試験（未知のtask、checkoutの外へのpath、任意の実行file）は残す。
   - `scripts/migration-command/ci.ts` の `mapCommandCICommand` で、直接起動できるNodeの入口に `scripts/migration-command/measure.js` を加える。`coverage.js` と同じく、checkoutの外の絶対pathは拒否する。ほかの入口は増やさない。
   - mainで、`mise run build` のあとに次を1つずつ実行し、fail・skip 0を確かめる：U4のacceptance、`migration-command-unit`、test-light。
   - そのあと、修正案の「直したあとの確認」の順で進める。U4の候補と独立consumerを作り直す。証明書を一時的に登録し、U4の受入（D3）をやり直す。証明書を削除し、不在を確かめる。U4のCI入力bundleを作り直す。ec8ab359の子commitを作り、bookmarkを動かして署名付きpushする。CIを1回だけ（2回目）動かす。各実行の直前に実コマンドを示す。失敗したら、基準を変えずに止めて相談する。
   - U3の候補にはU4のfileが入っていないので、U3の受入（D2）とU1のv11は使い回す見込みである（推測）。照合で不一致が出たら、止めて報告する。

## 追加Step：新しい土台（upstreamのmain）への合わせ（2026-10-18、4回目の再開）

人間の指示（「upstream/mainの変更に合わせて下さい」）で、U1〜U4のコードをupstreamのmainへ移した（PR aletheia-works/formicarium#29、merge `f5bc078c`）。その後、#31〜#35がmergeされ、mainは `2a79860` になった。
- #32で、U4の受入workflow（`.github/workflows/migration-command-u4.yml`）とCI専用の `scripts/migration-command/ci.ts`・`ci-inputs.ts`（`mapCommandCICommand` を含む）を消した。U3の `scripts/migration-install/ci.ts`・`ci-inputs.ts`・`ci/migration-install/` も消えた。
- upstreamのmainでは、生成JSと `.github/publication/` を追跡しない。taskはpackage.jsonの `migration:command:*` と `mise-tasks/migration/command-*.sh` に置く。
- 配布JSは `FIRST_PARTY_JS` の23件、package fileは `PACKAGE_FILES` の33件。
- intentの検証コマンドは、人間の承認で `mise run typecheck && mise run build && mise run test:light && mise run migration-preflight-unit && mise run migration-preflight-current-unit && mise run migration-guest-build-unit && mise run showcase-unit` に変わった。
- `source-manifest.json` は、追跡されたfileだけ（70件→47件）に直した。
- 上のStep 1–9と項目1–8の、CI・workflow・`.github/publication`・生成JSの追跡を作る・実行する記述と、署名付きCI（run 39029827794、head `9722db3e…`）・pack `61b209ae…` の結果は、古い土台・古いsourceで行った履歴として残し、書き換えない。新しい土台の成功証拠へ付け替えない。

新しい土台で取り直したレビュー（review-04、NOT-READY、Major 3・Minor 5）を、人間の指示（「U4のコード生成を開き直して、計画を新しい土台に合わせて承認を取り、受入方法はU3と同じ（ローカル暫定＋最終確認へ）にして、記録を直して」）で直す。

受入の方法（人間が決めた、2026-10-18。U3と同じ）：古い土台での受入（ローカル22工程、署名付きCI run 39029827794、B1 31 check）は履歴として残す。新しい土台では、手元に残るactual-site（`.artifacts/migration-install/actual-site`。`requireInstallActualSite` が固定11ファイルを検査する）を使い、`FORMICARIUM_COMMAND_LOCAL_ONLY=1` で暫定の完了確認だけを行う。その結果は `status: 'local-provisional'`・`acceptancePassed: false`・`b1.formal: false` であり、U4の正式受入でもB1の正式な行でもない。actual-siteを作る手段とCI証拠（`observed-ci-summary`）を作る手段は追跡コードに作り直さない。U4の正式受入とB1の正式な行は、U1〜U4のまとめた最終確認とterrariumの受入で決める。

- [ ] Step 11: 記録を新しい土台に合わせる（R-09）。`code-summary.md`・`unit-test-instructions.md`・`traceability.json` の、`ci.ts`・`ci-inputs.ts`・`mapCommandCICommand`・`migration-command-u4.yml`・`.github/publication`・生成JSの追跡・旧source identity（372 file）・旧pack・旧head・CI run 39029827794の記述を、古い土台の履歴として区別する。新しい土台の状態（いまのfileで確かめられること）と、上の受入の方法を書く。`traceability.json` の、消したfile（`scripts/migration-command/ci.ts`、workflow）を指す対象を、mainにある受入の入口（`scripts/migration-command/completion.ts`・`b1.ts` など）に直し、ほかの対象がすべてmainにあることを確かめる。
- [ ] Step 12: 受入の必須入力2つ（R-10）を、上の受入の方法として `code-summary.md` に記録する。(a) actual-siteは手元の検査済みのcopyだけがあり、clean checkoutから作る手段がないこと（手作業の前提）、(b) CI証拠の作り手がないため、`verified-with-ci` の完了とB1の正式な行は今は成立しないこと、(c) その2つを最終確認で決めること。
- [ ] Step 13: `source-manifest.json` を直す（R-11）。U4のtaskの実体 `mise-tasks/migration/command-browser.sh`・`command-completion.sh`・`command-stage.sh`・`command-unit.sh` を加える。manifestの共有file（`tests/package/*`、`tests/terrarium/coverage.test.ts`、`tests/tooling/publication-alignment.test.ts`、`scripts/release/inventory.ts`、`scripts/terrarium/coverage.ts`、`tests/migration-install/*`、`tests/migration-preflight/current-completion.test.ts`、`tests/migration-session/reservation.test.ts`、`mise.toml`、`bun.lock`）は、上の項目1–7と対応付け、新しい土台でU4が書いた内容が残っているかをfileとPR #29のdiffで確かめる。残っていなければ外し、残っていれば外さずに理由を `code-summary.md` に書く。
- [ ] Step 14: working copyの古い生成物を消す（R-12の一部）。`scripts/migration-command`・`tests/migration-command` と `.build/` の同じ場所に、対応する追跡 `.ts` のないgitignoreされた `.js`・`.js.map`（`ci.js`・`ci-inputs.js` など）が残っていれば消す。コードは変えない。`commandSourceInventory`・`sessionSourceInventory` が生成 `.js` も拾い、追跡の有無を見ないこと（R-12）と、`completion.ts` 349行の固定値 `coverageReport.files.length !== 23` は、残余リスクとして `code-summary.md` に書き、直すかどうかはU1〜U4の最終確認で決める（U2の `stage.ts` を変えるとU1〜U3の承認に影響するため）。
- [ ] Step 15: mainで1つずつ、`mise run lint:all`、`mise run typecheck`、`mise run build`、`mise run test:light` を実行する。続いて、新しい土台のsourceでU4の候補を作り（`mise run migration-command-stage`）、独立consumerを作って、`mise run migration-command-unit`・`mise run migration-command-browser` を実行し、件数とfail・skip 0を記録する。そのあと、手元のactual-siteと `FORMICARIUM_COMMAND_LOCAL_ONLY=1` で `mise run migration-command-completion`（全工程・23JS全realmのcoverage 80%以上・ローカル36試行・B1の事前確認）を実行する。証明書の一時登録・削除はkeychainの信頼設定の変更なので、wrapperの実コマンドを示し、人間がターミナルで実行する（終わったら削除・未登録を確かめる）。実行できない工程は未検証として記録する。install180秒、非download中央値3000ms、probe600秒、aube840秒、1worker・retry0、容量上限は変えない。
- [ ] Step 16: 独立レビューを受ける。そのあと、intentの検証コマンドでU4のcheckpointを確かめ、通常の単位完了承認を進める。コードの変更はないので、PRは作らない（記録はU1〜U3・U7の記録と一緒に、後でまとめる）。

R-05〜R-08（Minor）は今回の範囲外として残す。Step 10は、古い土台での最終レビューと完了確認の手順として未完了のまま残し、新しい土台ではStep 16で置き換える。

## 追加Step：mainでの正式受入とB1の正式な行（2026-10-20、5回目の再開）

人間の指示（「U1〜U4をまとめた最終確認とB1の正式な受入を今のmainで行い、そのpackでReleaseを作りましょう」）で、U4のCode Generationを開き直した。目的は、U8のshowcaseの配布に使うB1のpackを、正式な受入で固定することである。上の「受入の方法（2026-10-18）」のうち「actual-siteを作る手段とCI証拠を作る手段は追跡コードに作り直さない」という決定は、人間の判断（2026-10-20、決めごと1）で取り消す。ほかの基準は変えない。

人間が選んだ方針（2026-10-20、お勧めの5つ）：
1. 前の決定を取り消し、正式受入の仕組みを追跡コードとしてmainに置く。
2. 入力の置き場所：aubeの `aube.tar.gz` とbiomeの `biome.elf` は、`docs/results/terrarium-migration-preflight-evidence/mirror-input.json` の公式のrelease URLから取り、SHA256で照合する。actual-siteのarchive（`actual-site-v2.tar.gz`、36.7 MB、SHA256 `9c0d…`）は、prereleaseのReleaseの資産として置く（Releaseは人間が作る）。約125 MBの入力をrepositoryに戻さない。
3. 道具の版：Node・Bun・Playwright・Actionsは、実装を始める時点の最新版にする（古いworkflowのNode 26.12.0の固定は使わない）。U1の記録の証拠（Node v24.21.0）は履歴として扱い、U1の今の確認（36試行を含む）を最新版で取り直す。
4. guestの版：B1は、契約で固定したactual-siteの版（aube v2.6.1・v2.7.0の公式版、pitchfork v2.30.0のmusl向けパッチ版 `67bcb90c…`）のまま確かめる。pitchforkのパッチ版のELFは作り直さず、今のbytesを使う。今の `ci.yml` のaube・pitchforkの版とは別である。
5. packの版の番号：候補の版は今の固定（`0.3.0`）のまま変えない。B1のpackのReleaseと `code-summary.md` に、npmに公開済みの0.3.0とは中身が違うことを明記する。

仕組みの形（調査の結果に基づく。PR #32より前も、`observed-ci-summary` を書くworkflowはなく、main sessionがGitHubのAPIでrunを確かめて書いていた）：
- CIの受入は、U4の完了確認を `FORMICARIUM_COMMAND_LOCAL_ONLY=1` で1回流す（U2・U3の試験、23JSのcoverage、36試行、B1の31行を含む）。workflowは手動実行（`workflow_dispatch`）だけで、`github.repository == 'aletheia-works/formicarium'` かつ `github.ref == 'refs/heads/main'` のときだけ動く。権限は `contents: read` だけにする。
- main sessionが、そのrunをGitHubのRESTで観測し（runの結果・workflowのpath・head・eventとbranch・commitの署名・artifactのdigest）、`observed-ci-summary` を1つ書く。
- main sessionが、CIのartifactにある候補（同じtarball）を使って、手元でU2・U3・U4の正式な完了確認を流す。U4の正式な完了確認が `b1.formal: true` とC06のJSONを作る。

- [ ] Step 17: 道具の版を確かめる。Node・Bun・@playwright/test・TypeScript・Biome・mise・各Actions（checkout・setup-node・setup-bun・mise-action・upload-artifact）の最新版を調べ、`package.json`・`mise.toml` と比べる。古いものがあれば、その版と差分を報告してから更新する。runnerの準備として、既存の `tests/migration-command/runner-ready.test.ts` を最新のNodeで実行し、結果を記録する。手元に残る追跡されない生成JS（`scripts/migration-session/ci.js`、`scripts/release/bundle.js`・`bootstrap.js`、`runtime/web/` の一部など）が、`mise run build` の生成物か、古い残りかを確かめる。古い残りは消し、source identityが手元とCIで同じになることを確かめる。（NFR6.1）
- [ ] Step 18: 入力を戻すscript `scripts/migration-command/acceptance-inputs.ts` と、入力の一覧 `ci/migration-command/inputs.json` を作る。一覧には、3つの入力（`aube.tar.gz`・`biome.elf`・`actual-site-v2.tar.gz`）の取得元のURL、SHA256、size、置き場所を書く。scriptは、取得した各fileをsizeの上限の中で読み、SHA256を照合してから置く。上書きはしない。archiveを `.artifacts/migration-install/actual-site` へ展開した後、U3の `requireInstallActualSite`（`scripts/migration-install/actual-site.ts`）で固定11ファイルを検査する。展開は、既存の制限（path、link、件数、size）の中で行う。U3のfileは変えずにimportして使う。実装後に `tests/migration-command/acceptance-ci.test.ts` に試験を書いて実行する。確認するのは、SHA256の不一致・sizeの超過・一覧の欠落とunknown field・重複key・既存fileの上書き・archiveの中の `..` と絶対path・link・余分なfile・固定11ファイルの不一致の拒否と、正しい入力の受理。（NFR8.1、NFR8.2、FR6）
- [ ] Step 19: 観測のscript `scripts/migration-command/observe-ci.ts` と、task `mise-tasks/migration/command-observe.sh`（`package.json` の `migration:command:observe`）を作る。入力はrunのIDと、期待するcommit（mainの40桁）。GitHub RESTで、runの `conclusion: success`・`status: completed`・workflowのpathが `.github/workflows/migration-acceptance.yml`・eventが `workflow_dispatch`・branchが `main`・`head_sha` が期待するcommit・repositoryが `aletheia-works/formicarium` であること、commitの `verification.verified: true`、jobの結果がすべてsuccess、artifactのZIPのSHA256がAPIのdigestと一致することを確かめる。ZIPから候補の `package.manifest.json` とtarballを取り出し、`sourceCommit`・`sourceIdentity`・`candidateSha256` を読む。そのうえで、`recordKind: 'observed-ci-summary'`・`unit: 'u4-command'`・`conclusion: 'success'`・`sourceCommit`・`sourceIdentity`・`candidateSha256`・`runURL`・`runID`・`attempt` を持つ記録を1つ書き、そのSHA256を出力する。tokenは環境変数から読み、記録とlogに書かない。U4の検査（`scripts/migration-command/completion.ts` の `checkCommandCIEvidence`）が、この記録を受け付けることを試験で確かめる。（2026-10-20の変更、人間の判断B：U2・U3・U4の完了確認は、それぞれ自分のUnitの候補と、Unitごとに違う `sourceIdentity` を求めるので、1つの記録を3つすべてが受け付けることはできない。U2・U3の確認は、U4の完了確認の中で流れるU2・U3の試験で覆うことにし、U2・U3を単独で正式に受け入れたとは主張しない。U2・U3の検査は変えない。）実装後に、`acceptance-ci.test.ts` に試験を書いて実行する。確認するのは、失敗・未完了・別のworkflow・別のevent・別のbranch・別のhead・別のrepository・署名なし・失敗したjob・digestの不一致・ZIPの中の候補の欠落と不一致の拒否と、正しい観測からの記録の作成。GitHubのAPIは試験用の偽のserverで置き換え、外部のnetworkは使わない。（NFR8.1、FR6）
- [ ] Step 20: 受入のworkflow `.github/workflows/migration-acceptance.yml` を作る。triggerは `workflow_dispatch` だけ。jobの条件はrepositoryとmainのref。権限は `contents: read`。`ubuntu-24.04`、timeout 360分、`persist-credentials: false`、actionsはcommitのSHAで固定する。工程は次の順にする。(1) 依存のfrozenなinstall・build・typecheck、(2) `scripts/migration-session/ci-core.js` で固定のblinkを戻す、(3) `acceptance-inputs.js` で3つの入力を取得・照合し、actual-siteを戻す、(4) Playwrightの3browserのinstall、(5) このcommitから候補を作り（`FORMICARIUM_SESSION_SOURCE=$GITHUB_SHA`）、checkoutの外の `$RUNNER_TEMP` に独立consumerを作る、(6) jobだけで使うlocalhostのCA・leaf・NSS・Firefox profileを作る（U7・U8のshowcaseと同じ形。CAの鍵はすぐ消す）、(7) `FORMICARIUM_COMMAND_LOCAL_ONLY=1` でU4の完了確認を流す（`mise run migration-command-completion`。miseは `jdx/mise-action` で入れる）、(8) 常に、信頼設定と鍵を消す、(9) 完了確認のdirectory全体（生log・B1のJSON・`local-provisional-report.json`）と候補のmanifest・tarballを、保持期間7日のartifactに上げる。probe 600秒、aube 840秒、1worker、retry 0、install 180秒、非download中央値3000ms、wasm 1GB、23JSのcoverage 80%は、既存のcodeと設定のまま使い、workflowで変えない。実装後に、`acceptance-ci.test.ts` にworkflowの定義の試験を書いて実行する。確認するのは、trigger・条件・権限（write無し）・actionsのSHA固定・timeout・artifactの保持期間・`LOCAL_ONLY` の指定・信頼設定の後始末が `always()` であること・secretsを使わないこと。actionlintも実行する。（NFR2.1、NFR2.2、NFR8.1、NFR8.2）
- [ ] Step 21: 文書と追跡。`docs/terrarium-integration.md` の受入の節（又はU4の `docs/command-api.md`）に、正式受入の手順（Releaseの資産、workflowの実行、観測、手元の正式な完了確認）と、Safari実機が未検証であることを書く。`unit-test-instructions.md`・`traceability.json`（FR6・NFR8.1をGAPからこの仕組みへ）・`source-manifest.json` を更新する。（NFR7.1、FR6）
- [ ] Step 22: mainで1つずつ、`mise run lint:all`・`mise run typecheck`・`mise run build`・`mise run test:light`・`mise run migration-command-unit`（`acceptance-ci.test.js` を加えた一覧）を実行し、件数とfail・skip 0を記録する。続いて、actual-siteのarchiveを用意する。git履歴にある元のarchive（blob `9c0d…`）を取り出し、SHA256が一致することと、展開した中身が手元の固定11ファイルと一致することを確かめる。一致しなければ止めて報告する。人間に、prereleaseのRelease（tag `migration-inputs-actual-site-v2`）とその資産のアップロードをお願いする（実コマンドを示す）。
- [ ] Step 23: 変更のPRを作る（fork からのpush、上流へのPR。実コマンドを示して承認を受ける）。PRのCIが通り、人間がmergeした後、人間に受入のworkflowの手動実行をお願いする（又は承認を受けて実行する）。失敗した場合は、基準を変えずに止めて、観測した結果と修正案を示す。
- [ ] Step 24: run完了の直後に、`mise run migration-command-observe` で観測し、`observed-ci-summary` を書く。artifactのZIP・REST（run・jobs・commit・artifacts）の記録を `.artifacts/migration-command/ci-<runID>/` に保存する。
- [ ] Step 25: 手元の正式な完了確認を、main sessionで1つずつ流す。候補はCIのartifactのtarballと同じもの（SHA256が一致すること）を使い、独立consumerを作り直す。(1) U1：最新のNodeで、`mise run migration-preflight-browser`（36試行）とcurrent completionを取り直す（`current-local-verification` のまま。U1の記録の証拠は書き換えない）。(2) U4：`FORMICARIUM_COMMAND_CI_EVIDENCE` に観測の記録を渡して `mise run migration-command-completion`。U2・U3の単独の正式な完了確認は行わない（2026-10-20、人間の判断B。Step 19を参照）。U4の完了確認の中で流れるU2・U3の試験の結果を、U2・U3の確認として記録する。36試行の証明書の一時登録・削除はkeychainの信頼設定の変更なので、wrapperの実コマンドを示し、人間がターミナルで実行する。終わったら削除・未登録を確かめる。U4の `completion-report.json` が `status: 'verified-with-ci'`・`acceptancePassed: true`・`b1.formal: true` で、`b1-acceptance.json` の31行がすべてpassedであることを確かめる。計測中は重い処理を並行しない。未変更のaubeは作り直さない。（NFR2.1、NFR2.2、NFR8.1、FR6）
- [ ] Step 26: B1のpackのReleaseを用意する。pack（CIのartifactのtarball）とC06のJSONとそのSHA256の一覧を示し、人間の承認を受ける。人間が、prereleaseの `b1-<packSha256の先頭12桁>` を作り、2つの資産と一覧を上げる（上書き・削除はしない。npmの0.3.0とは別物であることをRelease notesに書く）。そのあと、`showcase/b1-pack.json` にtag・資産名・SHA256を書くPRを作る（U7のfileなので、U7の記録とあわせて扱う）。最後に、独立レビューを受け、intentの検証コマンドでU4のcheckpointを確かめる。このStepでStep 16を置き換える。（FR6、NFR8.1）

### 2026-10-20の追記：受入のrun 39373780795の失敗への対応（人間の判断A）

PR #50のmerge後（main `22b662d2`）、受入のworkflowの1回目（run 39373780795）は、U4の完了確認の工程で失敗した。失敗したのは `tests/node/build.test.js` の1件（「pitchfork.build-info に当てたパッチ・UI の node・UI の成果物が記録され、今のパッチと一致する」）だけで、それより前の工程（入力の取得と照合、actual-siteの復元、候補とconsumer、jobの証明書）と後始末・artifactのuploadは成功した。原因：今のmainの試験は、今の `ci.yml` が作るパッチなしのpitchfork（v2.30.1）を前提にするが、U2の入力のbundleから戻した `dist/guests/pitchfork` は古いパッチ版（v2.30.0）だった。手元では、今のmainの手順で作り直したpitchforkを使っていたので通っていた。基準と試験は変えない。

- [ ] Step 27: 受入のworkflowで、同じcommitのmainのCI（`ci.yml`）が作ったguestのartifact（`product-build-guests-<sha>-<runID>-<attempt>`）から、`dist/guests/pitchfork`・`dist/guests/pitchfork.build-info`・`dist/guests/pitchfork.commit` の3つだけを取り、U2のbundleから戻したものと置き換える。取る前に、GitHub RESTで次を確かめる：workflowのpathが `.github/workflows/ci.yml`、eventが `push`、branchが `main`、`head_sha` がこの受入のcommit（`github.sha`）と同じ、`status: completed`・`conclusion: success`、repositoryが `aletheia-works/formicarium`、artifactの名前が `product-build-guests-<github.sha>-` で始まり期限切れでないこと、ZIPのSHA256がAPIのdigestと一致すること。条件に合うrunが1つでなければ止める。ZIPの中の3つ以外は使わない。置き換えたfileのSHA256とsizeを記録に残す。部品は `scripts/migration-command/acceptance-inputs.ts` に足し（既存の観測の部品を使う）、workflowの工程はU2のbundleの復元の後・候補を作る前に置く。jobの権限に `actions: read` を加え（書込みは持たない）、tokenは `github.token` を環境変数で渡すだけにして、fileとlogに書かない。受入のworkflowは、そのcommitのmainのCIが終わった後に動かす。実装後に `tests/migration-command/acceptance-ci.test.ts` に試験を足して実行する。確認するのは、別のworkflow・event・branch・head・repository・失敗・未完了・該当なし・複数・名前の不一致・期限切れ・digestの不一致・ZIPに3つのどれかがない・3つ以外のpathの拒否と、正しい入力での置き換え。workflowの定義の試験も、`actions: read` だけを加えたことと、工程の順に合わせて直す。そのあと、Step 22の検査を1つずつやり直し、Step 23（PR、merge後の受入の再実行）からやり直す。（NFR8.1、FR6）

## 追加Step：terrarium の削除（PR #58）の後の確認（2026-10-21、6回目の再開）

U9 の PR aletheia-works/formicarium#58（merge `5735433d`）で terrarium を消した。U4 の source-manifest.json に当たる file のうち、#58 が変えたのは次の4つ。

- `README.md`：terrarium の言及を消した。
- `package.json`：`scripts` の、消した試験の glob を直した。
- `runtime/command-parse.ts`：comment の1行（`terrarium's .sort()` → `Array.prototype.sort()`）。
- `scripts/release/inventory.ts`：guest の配布の部品の path を `integration/guest-distribution/` に変えた。

U4 の Code Generation は、レビューの回数を使い切っていた。そのため、人間の判断（2026-10-21「はい、開き直して良いです。」）で開き直した。U4 の製品コードの振る舞いと公開 API は変えない。Step 1〜27 は履歴として残す。

- [ ] Step 28: #58 の影響を確かめる。
  - 上の4つの file の差分を読み、U4 の振る舞い（C03 の command、`createCommandSession`、B1 の受入）を変えていないことを確かめる。
  - 次を main session で1つずつ実行し、件数と fail・skip を記録する：`mise run typecheck`、`mise run build`、`mise run test:light`、`mise run migration:command-unit`
  - `consumer.test.js` などで、stage した候補の環境変数が要るものは、準備できなければ未検証として記録する。
  - B1 の受入済みの pack（Release `b1-a3370ca4df1f`）と、その証拠は作り直さない。#58 の後の pack は、comment と文書だけが違う（U9 の Step 5）。
  - 影響があれば止めて報告する。（FR6、NFR2、NFR8.1）
- [ ] Step 29: U4 の記録を、#58 の後の状態に合わせる。
  - `code-summary.md` にこの再開の節を足し、Step 28 の結果を書く。
  - `traceability.json`・`source-manifest.json` に、移した file・消した file を指す行があれば直す。
  - 製品コードは変えない。（NFR8.1）
- [ ] Step 30: 独立レビューを受ける。そのあと、intent の検証コマンドで U4 の checkpoint を確かめる。

### 2026-10-21 の Request Changes について

2026-10-21 に、Code Generation の段階を閉じるときの扱いで、人間の選んだ Request Changes が段階の全体に記録された。人間の意図は U2 の一覧の変更だけで、U4 の計画を変える指示ではなかった。この計画の Step と内容は変えない（人間の回答 2026-10-21「A」：計画をそのまま承認し直して Unit ごとに進める）。

## 追加Step：Build and Test の Loop-back 1（Node の版の固定、2026-10-22）

Build and Test で、人間の承認により起動した `migration-acceptance.yml`（run 39702294398、main `6b5bac1f`）が失敗した。U3 の `tests/migration-install/runner-ready.test.ts` が Node の patch の版を `26.12.0` に固定しており、CI が入れた最新の Node 26.12.1 で U3 の単体試験が失敗して、U4 の completion が止まった（Build and Test の `test-results.md` の Loop-Back Log 1）。U4 の `tests/migration-command/runner-ready.test.ts` の15–16行も同じ固定（`26.12.0`）を持つ。製品のコードの不具合ではなく、試験の前提の誤りで、最新の道具を使う決まりとも合わない。

- [ ] Step 31: `tests/migration-command/runner-ready.test.ts` の版の確認を、ほかの runner-ready の試験と同じく major の版（26）の確認に改め、試験の題の「Node 26.12.0」を「Node 26」に直す。試験が名前で確かめる機能（Node 26 の ESM と、parser が使う文字列と encoding の primitive）の確認は残す。製品のコードと基準は変えない。U3 の同じ修正と1つの PR（formicarium #65、head `4c96f634`、2 file、merge `6a90a45b`）にまとめた。merge の後、main の CI（run 39706177745）の成功を待ってから、人間の承認で `migration-acceptance.yml` を起動し、run 39709015067（head `6a90a45b`、Node 26.12.1）が成功した（U4 の command の試験 112 件と completion を含む）。あわせて `unit-test-instructions.md` の Node の版の記述を、major の版だけを固定する書き方に直す。このあと Step 30 と同じく、独立レビューを受け、intent の検証コマンドで U4 の checkpoint を確かめる。（NFR8.1）

## テスト設計と追跡

部品ごとの試験数（Standard、各5–8件以上の意味のあるケース）：InputGuard 6、Tokenizer 12、ListingFormatter 5、CommandDispatcher 8、BuiltinAdapter 6、InstallAdapter 5、GuestRunAdapter 6、ResultBuilder 3を目安にする（計約50件）。これに、公開APIの統合試験、Node/3browserのconsumer、型試験、受入入口の拒否試験を加える。定数を読み返すだけの試験は書かない。境界の直前と超過、拒否時の状態不変、競合時の後始末を観測する。

| 要件・設計 | Step |
|---|---|
| FR3（command） | 2、3、4、5 |
| FR4（install経由） | 3、4、5 |
| FR5（競合・状態） | 3、4、5 |
| FR6（B1・配布） | 1、5、6、8–10、18–26 |
| BR4.1–BR4.17 | 2（BR4.2–4.7、4.11）、3（BR4.1、4.8–4.17）、4（BR4.1、4.10、4.15） |
| NFR2.1、NFR2.2 | 6、8、20、25 |
| NFR3.1–NFR3.3 | 2、3 |
| NFR4.1、NFR4.2 | 3 |
| NFR5.1 | 3、4 |
| NFR6.1 | 1、5 |
| NFR7.1、NFR7.2 | 2、3、4、7 |
| NFR8.1、NFR8.2 | 5、6、8–10、18–20、24–27 |

Safari実機は未検証と明記し、WebKitの結果を実機の合格としない。新しいcore不具合が見つかった場合は、先にnative Linuxで再現する。新しい費用・公開・本番適用は、この計画の承認に含めない。

## Testing Contract

```json
{
  "version": 1,
  "methodology": "test-after",
  "source": "team",
  "ordering": "通常の新規実装は各テスト可能な層を実装した後にその層のテストを作成・実行し、不具合修正は再現テストの失敗を先に観測してから修正し同じテストの成功を確認する。（人間の回答 Q3）",
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
      "text": "- **Methodology**: test-after\n- **Ordering**: 通常の新規実装は各テスト可能な層を実装した後にその層のテストを作成・実行し、不具合修正は再現テストの失敗を先に観測してから修正し同じテストの成功を確認する。（人間の回答 Q3）\n- node:test と Playwright の既存結合テストを利用する（検証済み：package.json scripts、code-quality-assessment.md）。今回の成功結果・coverage 値は未検証。\n- classic の追加条件は行 coverage 80%以上と統合前 CI 実行（ドキュメント根拠：org.md Testing Posture）。基準を下げて通過させない。\n- coverage の技術提案（未実装・未検証）：第一者が保守する配布 JS 全体（既存 runtime の未変更ファイル、共通処理、公開 API、Node/browser Worker adapter を含む）の一覧を事前に固定し、未実行ファイルも分母に含める。tests、生成 blink JS/wasm、第三者/vendor、ゲスト ELF、.d.ts、デモ・開発専用 scripts は理由を明示して対象外とし、資産・型・回帰検証を別途行う。設計で配布対象を確定し、閾値達成のために除外を変更しない。\n- Worker/ブラウザ内の計測を収集・マージし、対象一覧と照合して欠落を検出する。未収集ファイルを分母から外さず0%または未測定として失敗／未検証を報告する。計測方式は担当者が未importファイル・別process/realmを含む試験を観測して選ぶ。対象一覧、除外理由、行数、レポート、実行コマンドを CI 成果物へ残す。ブランチ coverage の新しい数値条件は追加しない。\n- 既存上限は probe 600秒、aube ブラウザ840秒、1worker、retryなし、probe 8項目全通過、native 出力一致、wasm 1GB。テストは main session が逐次実行する（人間の指示：AGENTS.md）。\n- aube はソースが変わっていなければ再ビルドしない。計測は重い並行処理なしで行う。新しいコア不具合の回帰 probe は native Linux でも確認する。\n- npm tarball の import/Worker/型/wasm・notices・build-info の同梱確認は設計候補（推測・未検証）。ゲストと fixture は terrarium 側の ref 別配布という既存意図を維持する。"
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
  "input_sha256": "sha256:dd7d634a9c475bfe0b7fdd87b1566bd3f238a9b0ead389ae268b08de9bf333f2",
  "contract_sha256": "sha256:ce013e1551c9c06de1a756c04942d606c8dffe82caf0ae8422f95df28968c638"
}
```
