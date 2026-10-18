# U3 install 実装計画

## Summary
- Builds: 3回目の再開（追加Step 16–19）。review-05のR-10（U3の受入入口がU4の `stage.ts` をimportし、moduleが循環して依存が逆向き）とR-11（reportのunitが固定）を、修正案の案Aで直す。受入の規則はU3側に置き、U4の候補のsource一覧は呼出し側から受け取る。
- Touches: `scripts/migration-install/stage.ts`・`completion.ts`・`coverage.ts`・`measure.ts` と生成JS、`tests/migration-install/acceptance.test.ts` と生成JS、U3の記録。U4のfileは変えない（U4側の呼出しの変更はU4の計画で行う）。
- Tests: 先に再現試験を書いてfailを観測し、直してからpassを確かめる（acceptance・lifecycle、fail・skip 0）。独立レビューと、intentの検証コマンドによるcheckpointの確認を行う。最終的なsourceでのU3の正式36試行・専用CIは、U4の後にまとめて行う。

前回（toolchain更新）の要約：開発toolchainを最新版（Node.js 26.12.0、Bun 1.4.3、Playwright 1.64.1＝Firefox 157.0）へ全リポジトリで一貫更新し、CI正式36試行のBiome/Firefox中央値3000ms超過を新toolchainで再判定した。触ったのはmise.toml、package.json/bun.lock、scripts/ci/tasks.tsのTOOLCHAIN、U2/U3 ci.ts、各workflow・maintenance/publication policyとrunner、README、版を照合する試験とfixture、固定CI入力。試験は旧版の照合が失敗するREDとGREEN、test-light、全18工程・21JS全realm coverage80%以上、ローカル正式36試行、署名付きCI。

## 前提と境界
承認済みC02/C03/C04/C11、U3 functional-design、nfr-requirements、nfr-design、infrastructure-designを実装根拠とする。直接要件FR1/FR4/FR5/FR6とBR3.1–3.10に追跡する。User Storiesは生成されていない。
U2完了済み証拠は保持し、U3の成功証拠として流用しない。AI-DLC本体と品質基準は変更しない。U4のコマンド構文、U5以降のビルド・配布は対象外。DB、永続repository、独立UIは存在しないため該当層は省略する。
全ビルド・試験はmain sessionで逐次実行する。通常は各層の実装後にテストを書いて実行する。失敗時は観測結果と修正案を示して確認を待つ。

## Steps
Steps 1–7は既存実装の履歴として保持する。本再開での修正はStep 8のCI入力・skip拒否と、Steps 9–11の現在候補に対する受入れに限定する。共有SHA256・公開API・製品の容量や時間の基準は変更しない。
- [x] Step 1: 構成とrunner確認。既存tsconfig.json/tsconfig.tests.jsonとBunビルド、node:test、Playwrightを調査し、tests/migration-install/runner-ready.test.tsを作成する。ビルド後、専用runner-ready.test.jsを最初に実行して、Node24・ESM・独立consumer入力・テスト探索範囲を確認する。新規テストを走らせる前に実行可能性を観測し記録する。mise.tomlに専用タスクを宣言する。
- [x] Step 2: カタログ層をruntime/install-catalog.tsへ実装後、tests/migration-install/catalog.test.tsを作成・実行する。全字段・canonical metadata・深いsnapshot・既定/厳密選択・長さ/サイズ・URLを検証する。Nodeではoriginのない相対URLをINVALID_INPUTとしてfetch前に拒否し、ブラウザではdocument originだけを使う。BR3.1/3.2、D1。
- [x] Step 3: runtime/install-transfer.tsを実装後、tests/migration-install/transfer.test.tsを作成・実行する。HTTPS/credential omit、Node全redirect検査最大5、ブラウザredirect:error、128MiB実受信上限、宣言値整合、120秒deadline、download SHAを検証する。未知長progress total=null、ネットワーク失敗にretry/fallbackを付けない。BR3.4/3.6、D2。
- [x] Step 4: runtime/install-archive.tsを実装後、tests/migration-install/archive.test.tsを作成・実行する。DecompressionStream gzipと独立tar scannerを採用し、Node/3ブラウザの実在機能を確認する。512byte header/checksum/numeric/padding/end/trailing、全entry検査、256MiB展開総量、4096entry、4096byte path、1MiB metadataを維持する。USTARと実アセットが必要とするGNU/PAXを限定対応し、未知形式/sparse/deviceを拒否する。duplicate/traversal/link graph cycle/欠落/root逸脱/選択非regularを拒否する。ホストFSへ展開しない。BR3.5、D3。機能不足が判明したら設計変更を黙って行わず確認する。
- [x] Step 5: runtime/install-lifecycle.tsとruntime/install.tsを実装後、tests/migration-install/lifecycle.test.tsとpublic.test.tsを作成・実行する。既存runtime/session-port.tsのacquire/install reservation・epoch・signal・commitGuest/releaseとC03 validateGuestを使い、public registerへの再入を避ける。install180秒deadline、chunk yield、同期validation前後チェック、最初のterminal理由、finally cleanup、旧guest保持とatomic commitを検証する。progress callback例外/reentry/terminal後通知も検証する。既存portに変更が必要なら最小変更をruntime/session-port.tsと対応U2テストに限定し、二重所有を作らない。BR3.3/3.6–3.9、D4/D5。
- [x] Step 6: runtime/public.tsとtypes/index.d.tsへC04 createInstaller・Catalog・Progress・InstallResultを公開する。公開entry点は増やさずinternal portは非公開。実装後にtests/migration-install/types-valid.ts、types-invalid.ts、consumer.test.ts、consumer.spec.ts、playwright.config.tsを作成する。偽造session、mutation、BUSY、cancel/reset/dispose、失敗再install、成功置換を独立tarballのNode/Chromium/Firefox/WebKitで確認する。BR3.1/3.3/3.7/3.8、FR4/FR5/FR6。
- [x] Step 7: 追加の性能改善。performance-recovery-proposal.mdの36試行未達（Biome/Firefox中央値3435.58ms、validate中央値2636.46ms）に対応し、runtime/guest-validation.tsのguestSha256に限定して、64byte blockごとの状態8要素のdestructuringと配列・entries iteratorによる更新を、8個の直接読み出し・直接更新へ置き換える。64round、全block、padding/endianness、全ELF hash、所有copy、metadata/buildKey照合、同期C03とprivate brandを維持する。U2共有ソースと生成JSをU3の個別source claimへ含め、共有C03回帰と独立レビューを行う。実装後にtests/migration-install/hash-regression.test.tsとhash-regression.spec.tsを作成し、独立Node crypto/WebCryptoで既知vector、空入力、55/56/63/64/65byte境界、複数block、binary、offset付きUint8Arrayを照合する。既存C03異常入力/偽造handle拒否・copy保護とNode/3browser consumerも再検証する。tests/migration-install/browser-modules.d.tsに必要なSHA試験用型宣言を追加し、playwright.config.ts、mise.toml、runner-ready.test.ts、scripts/migration-install/ci.ts/completion.tsとそのacceptance.test.tsの個別パスを新しい8件の単体・2本のブラウザspecへ整合する。runtime共有最適化以外のアルゴリズム変更やhash省略は加えない。効果不足は確認する。
- [x] Step 8: 配布と検証入口を実装する。package.json、scripts/package/stage-package.ts、scripts/package/coverage-inventory.jsonを新規runtime5件と生成JSに整合する。scripts/migration-install/stage.ts、completion.ts、coverage.ts、measure.ts、ci.ts、ci-inputs.tsと生成JS、ci/migration-install/inputs.bundle.json、.github/workflows/migration-install-u3.ymlを専用入口として作る。既存U2入口の証拠形式・同一入力復元を利用するが、U3専用inventory/identity/全工程一覧を再生成する。重複実装を避けるため共通化が必要ならscripts/migration-session/stage.ts、completion.ts、coverage.ts、ci.ts、ci-inputs.tsの内部関数抽出に限定しU2互換を回帰検証する。mise.tomlのmigration-install-unit/browser/stage/completion/measureタスクは個別パスを指定する。型invalid fixtureをtsconfig.tests.jsonの通常buildから除外し、専用型検証で明示実行する。
- [x] Step 9: 正式受入れを逐次実行する。新しい全第一者JS固定一覧を分母に、未収集ファイルも残し、Node/Worker/別process/browser全realmの生coverageを収集して行coverage80%以上を検証する。既存probe8項目・native一致・wasm1GB・waitAsync削除を維持する。probe600秒/aube840秒、1worker、retry0。36試行は既存固定assetと同一origin HTTPSミラーで、非ダウンロード中央値3秒以下を確認し、download SHA処理時間を非download側へ計上する。計測に重い処理を並行しない。localhost証明書登録/削除が必要なら指紋と実コマンドを提示して承認を受け、finallyで削除する。
- [x] Step 10: U3専用候補をローカルに準備し、固定core SHA・全source inventory・tarball SHAを一致させる。署名付きjj pushと1回のCI試行は具体的コマンド提示後の個別承認を待つ。CIは実Bun絶対パス/版を確認しBUN_EXECUTABLEを設定、固定coreをローカルobject入力から復元する。GitHub署名Verified、head/run attempt、生artifact ZIP・全realm・coverage・同一候補を検証する。既存U2成功runは代用しない。
- [x] Step 11: README.md、docs/install-api.md、code-summary.md、traceability.jsonを作成し、生成JSを内容変更せずjj追跡する。レビューsource-manifestは個別実ファイルを列挙し、未意図の.js.mapを混入させない。独立最終レビューを行う。全工程が成功した新規U3結果の生ログとsource/CIを固定する短い完了確認コマンドを作成・改変拒否も検証し、実コマンドを提示して承認を待つ。承認後の正式確認成功で通常完了へ進む。

## 今回のCI入力・受入入口修正

1. 不具合の失敗観測を残す。既存のU2_ACTUAL_SITE未設定時の実観測（実配信8試験中6pass・2skip、exit0）を保持し、tests/migration-install/acceptance.test.tsへ、必須入力欠落とexit0でもskipを含む結果を受入れが拒否すべきことを示す失敗試験を追加する。ビルド後の現行入口で失敗をmainが観測してから修正する。
2. scripts/migration-install/ci-inputs.tsの実配信サイト入力を、圧縮する10ファイルと既存CI入力からcopyする1ファイルに分ける。固定11ファイルの相対path・byte数・SHA256は維持する。既存CI manifest内の `dist/guests/aube`（36948544bytes、SHA256=c7d7d13692d01c5f6adc5511c40adc6b3769080b7c433b44c411a3e52ebcd99e）だけを固定参照し、サイトの `dist/aube/83a42e281acf38e98fbbddf590e77746dcb9dfdb12cce4b27d1eb1926e1e5b5d/guest` へcopyする。同じbyteを持つ別pathへのfallbackや任意source指定は導入しない。残り10ファイルを新しい `.artifacts/migration-install/actual-site-v2.tar.gz` へwxで作成し、既存の全11ファイルarchiveは保持する。新archive1件だけを既存manifestの通常files集計へ加え、元の全logical行と217941020bytesの集計を保持する。payloadの重複排除や参照を理由に既存logical行を減算しない。

   全11ファイルarchiveの実測59173768bytesを追加すると277114788bytesとなり、256MiB上限268435456bytesを8679332bytes超過したため採用しない。mainのread-only・メモリ内USTAR/gzip level9計測では、上記1guestを除く10ファイルarchiveは36727106bytes、合計254668126bytes、余裕13767330bytesだった。これは計画案のサイズ検証だけで、新archiveの作成・復元・受入成功は未検証。実装後の実ファイルを再計測し、合計超過なら停止する。

   参照元はmanifestの固定path/bytes/SHAと実blob、復元後sourceのregular file/全byte/SHAを確認してから使用する。10ファイルarchiveは欠落・未知path・重複・不正header/padding/end・symlink・改変を拒否し、参照先guestがarchive内へ再混入した場合も拒否する。参照元を先に復元・検証した後、bounded copyで新規サイトを構成する。最後にarchive由来10件と参照由来1件の全11ファイルのbyte数/SHAと余分なfile/directoryなしを確認する。圧縮入力と復元後サイトの双方に合計256MiB・個別128MiB・metadata1MiB・4096entryを適用し、定数と集計規則を緩めない。製品runtime、共有SHA、U1/U2の封印証拠は変更しない。
3. scripts/migration-install/ci.tsと.github/workflows/migration-install-u3.ymlで、必須試験の開始前にサイトを復元し、U2_ACTUAL_SITEを復元先へ固定する。独立した後続processにも同じ検証済みパスを引き継ぐ。欠落時は試験を成功扱いせず開始前に拒否する。通常の軽量CIや本体公開APIへ新しい必須入力を広げない。
4. scripts/migration-install/completion.tsとci.tsのU3受入境界で、実行した必須テストの生ログを検査する。exit0に加え、正の実試験数、fail/cancel/skip/TODOなしを要求し、TAP・Node spec・Playwrightの実際のsummary形式を扱う。保存済みCIログを再検証する側にも同じ条件を適用し、skipを含むログからchecksCompletedや合格証拠を作らせない。build等の非テストcommandへ試験summaryを要求しない。U1/U2専用current-completionの成功をU3の完了へ流用しない。
5. 既存acceptance28ケースを維持し、固定参照の正常copy、参照元欠落・wrong source path・同サイズSHA改変・symlink、archiveへの参照guest再混入、10件の欠落/extra、fallback禁止、materialized11件の総量/個別/metadata/entry上限/+1を追加する。不具合の再現テストの失敗をmainで観測してから参照方式を実装し、同じ試験で成功を確認する。既存TAP/Node spec/Playwrightの正summary・skip/fail/空結果拒否も維持する。mainでbuild、typecheck、単位内acceptanceを逐次実行した後、新圧縮ファイルを作成・inspectして実合計を確認する。全ソース/生成JSを確定してから旧ci/migration-installを新規UUID付き.artifactsへrename保存し、canonical入力をprepare/inspect/restoreする。旧bundle/payload・全11件archive・v5/旧reportを上書きしない。CIと同じ復元環境でtests/guest-distribution/integration.test.jsの8件が全実行され、8pass・skip0となることを先に確認する。個別source-manifestと新固定CI入力を整合させる。
6. 修正後のsource/pack/consumerを新しく固定し、Steps 9–11へ戻る。旧v5の21工程と旧候補の正式36試行は履歴として保持する。正式36試行後は証明書削除・未登録を確認し、署名付きpushと1回のCIの実コマンドは別途承認を待つ。新U3結果を証明する短い完了確認コマンドも提示して承認を待つ。

## 追加Step 8：CI 38766787639の計測処理修正

根拠は同stageの `ci-38766787639-failure-and-repair-proposal.md` の「承認対象の修正案」1–5。人間は180秒期限と品質基準を維持した実装・再検証を明示承認した。AI-DLCの新approval receipt記録後にだけ実装する。本変更はStep 8の共有計測部品に限定し、Steps 1–7の製品実装・SHA・公開APIを再設計しない。

1. CI attempt1/run38766787639/job116531969277の失敗ZIP・13工程成功・計測付きNode115件中113pass/2fail/skip0を保持する。2件はvalidateGuest後の180秒TIMEOUTであり、coverage getter/setterのAtomic反復コストの寄与は現時点で推測・未検証。CI失敗をAI-DLC本体の不具合や成功証拠として扱わない。
2. scripts/package/coverage.tsのbridgeSourceと、そのNode/Worker/browserの生成・観測経路を調査し、counterがrealmごとに単一writer、hostの役割が読取りだけであることを確認して影響資料へ残す。共有部品のU1/U2利用も対象にする。単一writerを確認できなければ適用せず停止して確認する。
3. 確認できたcounterに限り、初期値をAtomics.loadで一度取り、getterはrealm内の最新値を参照する。setterは従来どおり非負安全整数を検証し、MAX_INT32へ飽和した値を毎回Atomics.storeで公開した後に最新値を更新する。counter列、statement map、realm登録、Atomic書込みと飽和の意味を維持する。hit-only化・sampling・SHA省略・試験skipは行わない。
4. tests/package/coverage.test.tsへ従来方式とのcounter列一致、複数realmの独立性、Worker中断後のhost可視性を追加し、既存の境界・飽和・不正値拒否を維持する。不具合の再現試験をmainで観測してから最小修正し、同じ試験で再確認する。build/typecheck、package coverage試験、U3 acceptanceを順番に実行した後、新候補から計測付きU2/U3 Nodeの同じ115件を省略せず実行して、成功件数・skip0・実時間を観測する。性能改善量は観測前に断定しない。
5. 実装・mainの生成後に共有変更4パス（scripts/package/coverage.ts、scripts/package/coverage.js、tests/package/coverage.test.ts、tests/package/coverage.test.js）をU3の個別source-manifest claimへ明示し、旧U1/U2の封印証拠は編集しない。新source/candidate/consumer/CI入力を固定し、全回帰・全21配布JS/全realm coverage80%以上・正式36試行を新しく実行する。install180秒、非download中央値3秒、probe600秒、aube840秒、1worker、retry0、容量上限と論理集計規則は不変。旧sourceの成功証拠・失敗ZIPを保存し、上書き・付替えをしない。ローカル成功後に追加の署名付きpushとCI再試行1回の実コマンドを提示して個別承認を待つ。新CI成功と新短縮完了確認を得る前にU3完了を生成しない。

## 追加Step 8：CI 38784488074後の直接counter生成修正（実装前承認対象）

構築：共有collectorのstatement直接記録を具体化し、mainのRED→GREEN後、新source・候補・consumer・固定入力を構築する。
変更：scripts/package/coverage.tsとtests/package/coverage.test.ts、およびmain build生成の対応JSだけを対象とし、install180秒と全品質基準を維持する。
検証：実instrumented fixtureのcounter/全Atomic書込み/AST意味一致、Node115件、全18工程・全21JS coverage80%以上・正式36試行を確認し、追加push/CI1回は別途承認を待つ。

根拠は同stageの `ci-38784488074-failure-and-next-plan.md`。この節は計画改訂のみで、実装は人間が本改訂を承認してから開始する。Steps 1–7と前節のgetter cache修正は実施済みの履歴として保持する。共有配布JSの一覧・製品tarball・SHA算法・公開APIは変更しない。

1. 検証済みの失敗を保持する：run38784488074 attempt1は114pass/1fail/skip0、test27の最初のinstallが180681.584382msでTIMEOUT。test25は成功したが複数install/run全体の時間をinstall期限へ読み替えない。単独CPU profileの126673.701459msは診断であり、統制した原因証明・性能比較・CI合格証拠ではない。直接記録がCI期限超過を解消するかは未検証。
2. scripts/package/coverage.ts内の既存生成処理へ限定して、Istanbulが生成するstatement incrementをrealm専用の直接記録関数へASTで結ぶ。新moduleは予定しない。必要になった場合は実装前に個別pathと必要性を計画へ追加して確認する。単一writer/realm専用bufferを維持し、全statementの全hit、各更新のAtomics.store、MAX_INT32飽和、registration、host可視性を維持する。function/branch計測・statement mapは変更しない。
3. 生成式の返値（post/pre incrementを含む対応範囲）、評価順序、例外、飽和時counter値をAST単位で保証し、非対応の生成形は黙って省略せず明示拒否する。正規表現による無条件置換、ignore、sampling、hit-only、batch書込み、SHA省略、skip追加は行わない。realm外の共有writerを導入しない。
4. tests/package/coverage.test.tsに実instrumented fixtureを追加し、旧方式との全counter列・全Atomic書込み列・返値・評価順序・例外・function/branch countsを比較する。新直接経路を要求する意味のあるREDをmainが観測してから最小修正し、同一ケースのGREENを確認する。既存17ケースを維持し、飽和、非対応形拒否、複数realm独立性、Worker終了後host可視性も検証する。時間閾値だけの不安定なテストで置き換えない。
5. mainがbuild/typecheck・対象回帰後に新source inventoryとCI入力を確定する。共有4個別パスは既存U3 source-manifest claimを維持する。U1/U2への共有影響は新しい全回帰証拠で検証し、封印済みU1/U2証拠・旧v5由来記録・旧新失敗ZIP・旧pending verifier/bindingは編集・付替えしない。U1再レビューiteration4 READYは前提確認でありU3受入れの代用ではない。
6. Steps 9–11を新sourceで再実行する。同じ合同Node115件を省略せず、全18工程・全21JS/全realm coverage80%以上・正式36試行をmainで逐次実行する。install180秒、非download中央値3000ms、probe600秒、aube840秒、1worker、retry0、全容量上限・論理集計規則を維持する。性能比較を別途行う場合のみABBAと順位検定を用い、CIの代用にはしない。
7. ローカル成功後に追加の署名付きpushとCI再試行1回の実コマンドを提示し、人間承認後だけ実行する。新CI成功後も独立API/ZIP照合・レビュー・新source/run用の短い正式完了確認コマンドの提示と承認を必要とし、失敗runやローカル成功だけでU3完了を生成しない。実機Safariは未検証のまま。

## 追加Step 8：Playwright Node bootstrapと全runner収集（実装前承認対象）

構築：専用Playwright Node bootstrapと開始登録・終了raw receipt照合を生成し、3suiteの実collection入口を新候補固定前に確認する。
変更：下記5TSとmain生成5JSに限定し、独立runner realmも全て検証・mergeする。install180秒と全品質基準は維持する。
検証：実Node processのRED→GREEN、3suite入口、全18工程・全21JS/全realm coverage80%以上・正式36試行を経て、追加push/CI1回は別途承認を待つ。

根拠は同stageの `direct-counter-playwright-bootstrap-proposal.md`。本改訂は計画のみで、実装は新しい実装前承認後に開始する。Steps 1–7、getter cache修正、直接counter AST修正とその対象20件/acceptance32件成功は履歴として保持する。source a91709015baec1a9f2379b2d53f90f2438d8e175aa57108b25a1f0171cdc5c85の先行14工程・合同Node115件成功はローカル観測。第15工程はNode collection時のwriter未初期化で失敗し、全18工程・coverage・36・CI成功とはしない。失敗出力 direct-counter-regressions-c0973cec-fd81-403a-b964-bbe8a3319e5a を保存する。

1. 変更範囲を scripts/package/coverage.ts、scripts/migration-session/coverage.ts、scripts/migration-install/coverage.ts、tests/package/coverage.test.ts、tests/migration-install/acceptance.test.ts の5個別TSと、main buildが生成する各対応JSに限定する。新しい手書きmodule・依存は追加しない。source-manifestの個別claimを確認し、不足する当該実パスだけ追加する。製品runtime・SHA算法・公開API・AI-DLC本体・配布一覧は変更しない。
2. package coverage生成処理で専用Playwright Node bootstrapを新規coverage出力内に生成し、package/U2/U3の各設定の最初のimportに結ぶ。Node collectionのconsumer.spec→stage-package helper→instrumented contracts importより先にwriterを用意する。各runner/worker processへ独立SAB・writerを割り当て、suite/process identityを区別した開始登録と終了raw count receiptを保存する。既存coverage-node.json/coverage-session-node.jsonは上書きしない。
3. 全開始登録と全終了receiptを厳密照合し、開始だけ・終了だけ・欠落・重複・未登録・異常終了・不正counterを拒否する。新runner realmも全件検証して既存Node/session/browser host/Worker/descendant realmsへmergeする。全21JS分母、全statement hit、毎Atomic.store、飽和、function/branch計測を維持する。通常counter fallback、非計測importへの逃避、起動の任意化、skip/ignore/sampling、未収集realm削除で成功させない。
4. 実生成bootstrapと実Node子processで未初期化importのREDをmainが観測してから修正し、同じ試験をGREENにする。既存20件とacceptance32件を維持し、3suite設定の起動とraw収集、開始/終了欠落・重複・改変・未知suite/process・不正counter・異常終了拒否を追加する。試験の意図したRED以外の失敗は原因を報告して確認する。全build/testはmainが逐次実行する。
5. 対象build/typecheck/回帰後、新候補を固定する前に3suiteの実Playwright collection入口を短い確認で起動する。試験発見の成功だけでなく、起動した全Node runner/workerの開始登録・正常終了raw receiptが得られ検証できることを確認する。browser測定や全回帰はこの入口確認で代用しない。
6. 新source/candidate/独立consumer/固定CI入力でSteps 9–11へ戻り、全18工程・全21JS/全realm coverage80%以上を逐次再実行する。U1/U2の封印proofと旧成功/失敗/pending bindingは保持し、新しい共有影響の検証だけを新証拠へ記録する。install180秒、非download中央値3000ms、probe600秒、aube840秒、1worker、retry0、全容量上限・論理集計規則は不変。
7. 正式36試行は証明書一時登録・計測・削除/未登録確認の実コマンドを提示し承認後に実施する。ローカル成功後だけ追加署名付きpushとCI1回の実コマンドを提示して個別承認を待つ。新CIの独立API/ZIP照合・レビュー・新しい正式完了確認前にU3完了を生成しない。

## 追加Step 8：独立起動台帳とCI生記録添付（実装前承認対象）

同stageのrunner-registry-ci-review-repair-proposal.mdとreview-02.mdの2件のMajorへの対応。本改訂は計画のみで、新しい実装前承認後に着手する。b608 sourceの全18工程・21JS91.65%/1495realmと正式36試行成功（formal36-node-bootstrap-20261016/measurement-report.json、最大組中央値2586.64ms、trust/証明書削除・未登録確認済み）は旧sourceの履歴として保持し、新sourceへ付け替えない。旧U1/U2-only完了コマンドをU3受入れに使わない。

1. 既存5TS/生成5JSの範囲にworkflowの個別path `.github/workflows/migration-install-u3.yml` を明示追加する。今回の変更はscripts/package/coverage.ts、tests/package/coverage.test.ts、tests/migration-install/acceptance.test.tsとmain生成の対応JS、および当該workflowに限定する。session/installの既存先行importを維持する。source-manifestのworkflow claimを確認し不足時だけ同pathを追加する。新手書きmodule・依存・製品runtime/SHA/API・AI-DLC本体は変更しない。
2. 生成bootstrapは製品import前に、`<coverage>/coverage-playwright-node/<suite>/launches.jsonl`（suiteはpackage/session/install）へgeneration version/id/out/metadataSha256・suite・pid・ppidを記録し、その後に個別begin/endを記録する。台帳名をこの具体値に固定する。O_APPENDで開いたdescriptorへ改行付き1recordを1回のwriteで追記し全bytes書込みを確認する。partial writeを分割追記して続行せず拒否する。並行processでもrecordを混在させない。
3. generation・全launch・全begin/endのidentity集合を完全照合する。全suiteの台帳は存在し非空で、generation/out/metadata/suite/pid/ppidが一致し、重複pid・未知identity・余分なrecordがないことを要求する。全launchに正確に1begin/1endが必要で、両receiptとも欠落したprocessも拒否する。台帳欠落/空/不正JSONL/途中行/重複/改変・未登録counter・異常終了を拒否し、既存Int32/marker検査と全realm mergeを維持する。既存node/session rawを上書きせず、fallback・ignore・sampling・skipで成功させない。
4. 実Node複数processの回帰で1processのbegin/end両方の欠落を拒否すべきREDをmainが観測してから修正し、同じ試験をGREENにする。片側欠落、台帳欠落/空/重複、未知pid/generation、ppid/output/metadata改変、途中行、不正counter/異常終了、正常全processのraw保持を検証する。既存54件を維持し、意図したRED以外の失敗は報告して確認する。
5. workflowの既存artifact pathsを保持し、`.artifacts/migration-install/completion-*/coverage/coverage-playwright-generation.json`、`.artifacts/migration-install/completion-*/coverage/coverage-playwright-node/**/*.json`、`.artifacts/migration-install/completion-*/coverage/coverage-playwright-node/**/*.jsonl` を追加する。実生成pathとの対応を確認し、新CI独立ZIPでgeneration・台帳・全begin/endと同一source/pack/runを再照合する。権限拡大・CI回数増加はしない。旧pending verifier/bindingや成功/失敗ZIPを変更しない。
6. mainがbuild/typecheck・対象回帰・別新規出力の3suite入口確認後、新source/候補/consumer/CI入力で全18工程・全21JS/全realm coverage80%以上を再実行する。install180秒、非download中央値3000ms、probe600秒、aube840秒、1worker/retry0、全容量上限・論理集計規則は不変。旧U1/U2封印proofを編集しない。
7. 新候補の正式36試行は利用者がmacOS認証できる時に実コマンドを提示し承認後に実行する。不在時の条件付き承認を認証代行やpush承認へ読み替えない。終了後はtrustと証明書を削除し未登録を確認する。ローカル成功後だけ追加署名付きpush/CI1回を個別承認へ出し、新CI・独立ZIP照合・再レビュー・正式完了確認前にU3完了とはしない。

## 追加Step 8：CI 38898228292のFirefox TLS修正（実装前承認対象）

根拠は同stageの `ci-38898228292-firefox-tls-repair-proposal.md`。本改訂は計画のみで、新しい実装前承認後に着手する。前節の独立起動台帳・CI添付は実装・検証済みの履歴として保持する（RED→GREEN、3suite入口、source ec7fc54a…の全18工程exit0・91.65%・1495realm、ローカル正式36試行passed・最大中央値2712.46ms・証明書削除/未登録確認、commit 5cc071ce Verified、CI run38898228292の工程1–18 exit0）。CI run38898228292は第19工程でFirefox `SSL_ERROR_UNKNOWN` により失敗しており、CI成功とは扱わない。

1. 変更は `.github/workflows/migration-install-u3.yml`、`scripts/migration-install/measure.ts` とmain生成の `measure.js`、`tests/migration-install/acceptance.test.ts` とmain生成の `.js` に限定する。source-manifestの個別claimを確認し、不足する当該pathだけ追加する。新module・依存・製品runtime/SHA/API・AI-DLC本体は変更しない。
2. workflowは、job専用CA（CA:TRUE、pathlen0、keyCertSign、nameConstraints permitted DNS:localhost、1日）とそのCAで署名したleaf（SAN DNS:localhost、CA:FALSE、serverAuth、1日）を作る。CAをシステムCAと `~/.pki/nssdb`（'C,,'）へ登録し、leaf指紋を `FORMICARIUM_INSTALL_TLS_SHA256` とする。job専用Firefox profileを作ってCAを 'C,,' 登録し、`FORMICARIUM_INSTALL_FIREFOX_PROFILE` に絶対pathを設定する。cleanupでシステムCA・nssdb・profile・秘密鍵を削除し、不在を確認する。権限拡大・CI回数増加はしない。
3. measure.tsは、`FORMICARIUM_INSTALL_FIREFOX_PROFILE` 設定時だけ、Firefoxを `launchPersistentContext(profile)` で起動し、その `browser()` から従来どおり試行ごとに `newContext({ignoreHTTPSErrors:false})` を作る。profileは絶対path・実directory・非symlink・cert9.dbありを要求し、満たさなければ計測前に拒否する。未設定時（ローカルmacOS）は現行launchのまま。Chromium/WebKit、試行数、URL、pin、phase、3000ms判定は変えない。`ignoreHTTPSErrors:true` や証明書検証の無効化は行わない。
4. acceptance試験に、profile指定の有無による起動切替、不正profile（相対・不在・symlink・cert9.dbなし）拒否、`ignoreHTTPSErrors:false` 維持を、browserを起動しない単位で追加する。mainがREDを観測してから実装し、同じ試験でGREENを確認する。既存33件を維持する。
5. mainがbuild/typecheck/対象回帰を行い、修正版workflowと同じ証明書・profile手順をDocker上のPlaywright v1.63.0 noble imageで実行し、Firefox/Chromium/WebKitのTLS接続を確認する（x86_64 runnerでの同一挙動は未検証として扱う）。
6. 新source/CI入力/候補/consumerで全18工程とローカル正式36試行（既存keychain方式、期限確認、終了後の削除・未登録確認）を再実行する。install180秒、非download中央値3000ms、probe600秒、aube840秒、1worker/retry0、全容量上限・論理集計規則は不変。
7. ローカル成功後だけ追加署名付きpush/CI1回の実コマンドを個別承認へ出す。新CI・独立ZIP照合・再レビュー・正式完了確認前にU3完了とはしない。

## 追加Step 8：CI 38909083334後の最新toolchain更新（実装前承認対象）

根拠：CI run38909083334（commit 6dc9c43a、Verified）は、工程1–18が全exit0、Firefox TLS修正後の36trialが全てexit0/CORS passedだった。しかし、Biome/Firefoxの非download中央値が3006.24ms（基準3000ms、超過6.24ms、validate中央値1875.7ms）で不合格だった。ローカルmacOSは同じsource cf637f9aで2608.64msで合格した。人間は「Playwright・Node・Bunとも最新版を使う」と指示し、本計画の作成を承認した（2026-10-17）。前節までのFirefox TLS修正・独立起動台帳は実装・検証済みの履歴として保持する。

確認済みの事実：Playwright 1.64.0のリリースノートで、同梱Firefoxが155.0から157.0へ上がった。1.64.1はElectron・Chromiumの修正だけ。Firefox 156/157のリリースノートには、WebAssembly・SpiderMonkey・JITの性能改善の記載がない。したがって、更新で中央値が3000ms以下になるかは未検証で、実測で判定する。最新版は npm/nodejs.org/GitHub release で確認した（Node.js 26.12.0（2026-10-14、Current。LTSは24.22.0）、Bun 1.4.3（2026-10-10）、@playwright/test 1.64.1（2026-10-14））。Biome・TypeScript・istanbulは既に最新。

1. 版の更新を一貫して行う。対象は `git grep` で特定した次の個別path（生成JSはmain buildが作る）。
   - toolchain定義：mise.toml（node/bun）、package.json（`@playwright/test` 1.64.1）、bun.lock（`bun install` で更新）、scripts/ci/tasks.ts の TOOLCHAIN、scripts/ci/ordinary-receipt.ts。
   - U2/U3入口：scripts/migration-install/ci.ts、scripts/migration-session/ci.ts の Node版照合。
   - 保守・公開：scripts/maintenance/bundle.ts・receipt.ts・reproduce.ts、scripts/release/bundle.ts・publication-evidence.ts、.github/maintenance/policy.json・runner.mjs、.github/publication/trusted-policy.json・runner.mjs の `bun1.4.2-node24.21.0` を新しい toolchainRevision に揃える。
   - workflow：.github/workflows/ci.yml、verify.yml、candidate-verify.yml、maintenance.yml、pr-labels.yml、publish.yml、migration-session-u2.yml、migration-install-u3.yml の node-version・bun-version・cache key・版照合。
   - 文書：README.md の版表。
   - 試験：tests/migration-install/runner-ready.test.ts、tests/package/runner-ready.test.ts、tests/tooling/ 配下で版を照合する試験（bun-tasks、maintenance-acquisition/integration/operations/reproduction/wiring、publication-bundle、quality-evidence）、tests/fixtures/timings-valid.json（版を含む場合だけ）。
   - 既存のRCタグ、その固定入力、公開済み証拠、U1/U2の封印proof・承認済み検証コマンド（verification-command.txt のNode 24.21.0実体path）は変更しない。integration/ と docs/results/ の過去記録も変更しない。
2. ローカルでは、mise管理のNode 26.12.0とBun 1.4.3を導入し（`mise install`）、`mise ls` で実体pathを確認する。Playwright 1.64.1の同梱browserを固定CLIで導入する（`node node_modules/@playwright/test/cli.js install chromium firefox webkit`）。U3の試験手順のNode実体pathは、新しいmise実体へ更新する。
3. 不具合修正の順序に従う。先に、版照合の試験（runner-ready 2件）を新しい版の期待値へ更新し、旧toolchainのまま実行してREDを観測する。その後に toolchain を更新し、同じ試験でGREENを確認する。
4. mainが逐次実行する：build、typecheck、test-light、U3 acceptance、U2 ci.test、保守・公開の tooling 試験。Node 26で Node専用flag（`--test-isolation`、`--experimental-*`、`process.execPath` を使う子process、Worker、stripTypeScriptTypes警告）の意味が変わっていないかを、実結果で確認する。意図したRED以外の失敗は、原因を報告して確認する。
5. 新source/CI入力/候補/consumerで、全18工程と、ローカル正式36試行（既存keychain方式、証明書の期限確認、承認後の一時登録、終了後の削除・未登録確認）をやり直す。install180秒、非download中央値3000ms、probe600秒、aube840秒、1worker/retry0、全容量上限・論理集計規則は不変。
6. ローカル成功後だけ、追加の署名付きpush/CI1回の実コマンドを個別承認へ出す。CIでなおBiome/Firefoxが3000msを超えた場合は、基準を変えずに停止する。そのうえで、validate（純JS SHA-256）の改善案を別途提示する。新CI・独立ZIP照合・再レビュー・正式完了確認の前に、U3完了とはしない。

リスク：Node 26はmajor更新（LTSではなくCurrent）で、Node専用APIの挙動差が試験で顕在化する可能性がある。保守・公開のtoolchainRevisionの変更は、今後のmaintenance/publicationの照合値を変える（既存RCタグとその入力は不変）。

## 追加Step：U4の作業を戻した後の再確認（2026-10-17、Code Generationの再開）

U3のレビューの後に、U3がclaimする共有fileが変わった。理由は3つある。
- 一時的に外していたU4の作業（Steps 1–7）を戻した。
- AI-DLCを2.11.1-preview.20261016.1に更新した（人間の承認済み）。
- U4の追加Stepで人間が決めた修正のうち、2件を先に入れた。`tsconfig.json` のincludeにU4のbrowser型宣言を加えた。U1がclaimする `scripts/terrarium/coverage.ts` を `mode:'strip'` にした（Node 26は `transform` をやめた）。

変わったのは `package.json`（files、@types/node 26.6.5）、`bun.lock`、`runtime/public.ts`（`createCommandSession` のexportを追加）、`types/index.d.ts`（C05の型を追加）、`scripts/package/stage-package.ts`・`coverage-inventory.json`（配布JSが23件に）、`tsconfig.tests.json`、`README.md`、`mise.toml`（U4のtaskとAI-DLCのpin）である。U3の製品コード（runtime/install*.ts など）は変わっていない。

人間の承認により、intentの検証コマンドは、U1の試験を今のsourceで実行するコマンドに置き換わった。前の検証コマンド（`verify-toolchain-u3.mjs`）は、封印したsourceとの一致を求めるので、今のsourceでは通らない（330件のはずが334件になる）。U3の受入（CI 38948209404と、正式36試行）は、U4の作業を戻す前のsourceに結び付いている。最終的なsource（U4を含む）での、U3の正式36試行・専用CI・完了確認と、新しい検証コマンドは、U4の作業がすべて終わった後に、U1〜U4のまとめた確認の中で行う。

- [x] Step 12: U3の記録（code-summary.md）に、今回の変更と、U3の製品コードが変わっていないことを書く。追加されたexport・型・配布一覧が、C04の `createInstaller` とその型を変えないことも確かめて書く。U3の受入がU4前のsourceに結び付いていることと、最終的な確認はU4の後に行うこと、それまではU3の受入結果を変更後のsourceの成功証拠として扱わないことを明記する。（FR4/NFR8）
- [x] Step 13: 独立レビューを受ける。そのあと、intentに記録された検証コマンドでU3のcheckpointを確かめ、通常の単位完了承認を自動で進める。

## 追加Step：U4の変更のうち、U3のfileに当たるものを引き受ける（2026-10-17、2回目の再開）

U4の追加Step項目3・4で、U3がclaimするfileが変わった。人間の判断で、その変更をU3の変更として引き受け、U3をこの1回だけやり直す。変更はmainのworking copyにすでにある。Step 12の「U3の製品コードは変わっていない」は、今回も成り立つ（runtime/install*.tsは変わっていない）。
- 項目3：`tests/migration-install/lifecycle.test.ts` の模擬portに `resolvePath()` を加えた（呼ばれたら `unexpected resolve` で失敗する）。U2がC02に `resolvePath` を加えたため（U2 BR2.12、C02に追記済み）、型を合わせるためだけの変更である。
- 項目4（受入の入口）：`scripts/migration-install/completion.ts`・`coverage.ts`・`measure.ts`（と生成JS）は、候補のunitとして `u3-install` に加えて `u4-command` も受け付ける（`INSTALL_REGRESSION_UNITS`）。source inventoryは候補のunitに応じて選ぶ（`candidateSourceInventory`。U3はU3の一覧、U4はU4の一覧）。配布JSの件数の照合は21件から23件（`FIRST_PARTY_JS.length`）にした。この2つの補助関数はU4の `scripts/migration-command/stage.ts` にある。
- 項目4（試験）：`tests/migration-install/consumer.test.ts`・`consumer.spec.ts`・`hash-regression.spec.ts` は、候補のunitとして `u3-install` か `u4-command` を受け付ける。`tsconfig.tests.json` は、通常のbuildから `tests/migration-command/types-invalid.ts` も除外する。
- `tests/package/coverage.test.ts` の件数（23件）と名前の一覧は、U1のStep 18・U2のStep 16と同じ変更である。

- [x] Step 14: 上の変更をU3の変更として確かめ、U3の記録（code-summary.md、source-manifest.json、traceability.json）に書く。fileを読んで、次を確かめる。
  - 受け付けるunitを広げても、拒否の条件を緩めていないこと。ほかのunit・欠落・skip・不一致は従来どおり拒否する。U3の候補は従来どおりU3のsource一覧と照合する。
  - 配布JSの件数の照合は、実際の一覧（`FIRST_PARTY_JS`）に合わせただけであること。coverageの分母から未収集のfileを除かず、80%の基準も変えていないこと。
  - U3の入口がU4の `scripts/migration-command/stage.ts` をimportするという、unitの依存の向きを記録する。U3単独の受入の判定は、この関数のU3の分岐だけを使う。
  - 模擬portの `resolvePath` は呼ばれたら失敗するので、installの経路がpathの解決を使わないことを試験が引き続き確かめること。
  - mainで `mise run build` のあと、`node --test --test-concurrency=1 tests/migration-install/lifecycle.test.js tests/migration-install/acceptance.test.js` を逐次実行し、件数とfail・skip 0を記録する。
  - 最終的なsourceでのU3の正式36試行・専用CI・完了確認は、U4の後に、U1〜U4のまとめた確認の中で行う。それまでは、U3の受入結果を変更後のsourceの成功証拠として扱わない。（FR4/FR6/NFR8）
- [x] Step 15: 独立レビューを受ける。そのあと、intentに記録された検証コマンドでU3のcheckpointを確かめ、通常の単位完了承認を自動で進める。

## 追加Step：review-05の指摘の修正（2026-10-17、3回目の再開）

review-05（READY）のR-10（Major）とR-11（Minor）を直す。人間は修正案 `u3-acceptance-dependency-proposal.md` の案Aを選んだ（2026-10-17）。上のStep 15は、この修正より前の流れとして残す。拒否の条件、U3の製品コード、品質基準は変えない。

確認済みの呼出し（fileの読取り）：U4は、`scripts/migration-command/ci.ts`・`completion.ts`・`b1.ts` からU3の `completion.js` の関数をimportする。U4の `completion.ts` は、U3の `scripts/migration-install/measure.js` を子processのCLIとして起動する（`command('measure', ...)`）。U4の `coverage.ts` は、U3の `INSTALL_REALMS` だけを使う。

- [x] Step 16: 先に再現試験を書き、failを観測する（`tests/migration-install/acceptance.test.ts`）。
  - U3の受入入口（`scripts/migration-install/completion.ts`・`coverage.ts`・`measure.ts`）が、`scripts/migration-command/` のmoduleをimportしないこと（sourceを読んで確かめる試験）。
  - U3の関数に `u4-command` の候補を渡したとき、呼出し側がsource一覧を渡さなければ拒否すること。
  - U3のCLI（`completion.js`・`measure.js`）は、`u3-install` の候補だけを受け付けること。
  - reportに候補のunit（`candidate.unit`）が入り、`laterUnits` の文言が候補のunitに合うこと（R-11）。
  - mainで `mise run build` のあと `node --test --test-concurrency=1 tests/migration-install/acceptance.test.js` を実行し、追加した試験のfailを観測する。意図したfail以外の失敗が出たら、止めて報告する。
- [x] Step 17: 直す（R-10・R-11）。
  - U3の `scripts/migration-install/stage.ts` に、受け入れるunitの一覧（`u3-install`・`u4-command`）を置く。U3の候補には、従来どおり `installSourceInventory` を使う。
  - U3の `checkInstallCandidate`・`measureInstall`・coverageの照合関数は、`u4-command` の候補に使うsource一覧を、呼出し側から引数（option）で受け取る。渡されなければ拒否する。U3の入口から `scripts/migration-command/` へのimportをなくす。
  - reportに `candidate.unit` を書き、`laterUnits` を候補のunitに合わせる。
  - U4側の呼出しの変更（`commandSourceInventory` を渡すこと、U3のmeasure CLIの代わりにU4の薄いCLIで同じ関数を呼ぶこと）は、U4のfileなので、U4の計画（再承認を受ける予定）に1項目として加え、そちらで行う。U3のこのStepでは、U4のfileを変えない。そのため、U4の試験・入口は、U4の計画の項目を実施するまで、U4の候補では動かない。これはU4の作業の途中の状態として扱う。
  - mainで `mise run build` のあと、`node --test --test-concurrency=1 tests/migration-install/acceptance.test.js tests/migration-install/lifecycle.test.js` を逐次実行し、Step 16の試験を含めてpassし、fail・skip 0であることを確かめる。
- [x] Step 18: U3の記録（code-summary.md、source-manifest.json、traceability.json）を更新する。`scripts/migration-install/stage.ts` と生成JSのclaimを確かめ、足りなければ足す。
- [ ] Step 19: 独立レビューを受ける（この試行のやり直しのレビューはreview-05で使ったため、人間の依頼として記録する）。そのあと、intentに記録された検証コマンドでU3のcheckpointを確かめ、通常の単位完了承認を自動で進める。最終的なsourceでのU3の正式36試行・専用CI・完了確認は、U4の後に、U1〜U4のまとめた確認の中で行う。

## テスト設計と追跡（共通）
CatalogResolver、AssetTransfer、ArchiveInspector、OperationLifetime、ProgressReporterは各5–8以上の意味のあるケース。SessionPort/validateGuest境界と独立consumerを統合テストで確認する。定数を読み返すだけのテストではなく、境界直前/超過、正しいarchiveと不正archive、race時の状態・旧guest・後始末を観測する。
FR4→Steps2–7、FR5→Steps5–7、FR1→Steps7/9–11、FR6→Steps6–11。BR3.10→Steps8–11。NFR1–4/6–8の12詳細IDは各D1–D6実装と受入れへ逆方向も追跡する。
追加Step7は公開C03契約を変えずに実装の割当て量を減らす計画変更である。元のStep5のU2変更限定には、この承認対象のguest-validation.ts/生成JS変更を明示的に追加する。未達結果は正式受入れへ置換せず、新source inventory・候補・独立consumerと実36試行で再判定する。
実機Safariは未検証と明記する。WebKitで代替して実機合格としない。新規コア不具合はnative Linux再現を先に行う。新規費用/公開/本番適用はこの計画の承認に含めない。

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


