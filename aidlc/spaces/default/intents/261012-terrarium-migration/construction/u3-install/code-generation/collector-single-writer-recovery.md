# 共有coverage bridge：単一writerの確認と修正記録

## 状態

2026-10-16。承認済みのCI修正案1–5に基づく作業。製品installの180秒、非download中央値3秒、probe600秒、aube840秒、1worker/retry0、全21配布JS・行coverage80%以上、容量上限は変更しない。AI-DLC本体と製品runtime/SHAは変更していない。

検証済み：mainのREDは .artifacts/migration-install/collector-repair-red-20261016.json。build exit0、coverage試験13件中12pass・1fail・skip0。新試験は実bridgeの2048incrementすべてのcounter値と毎setter store列が一致した後、getter Atomic.load増分2049により失敗した（期待0）。時間の閾値を使った推定ではない。

mainのGREEN観測は .artifacts/migration-install/collector-repair-targeted-20261016.json。build/typecheck exit0、coverage17pass・fail/cancel/skip/TODO0、U3 acceptance32pass・fail/cancel/skip/TODO0、実配信8pass・fail/cancel/skip/TODO0、対象Biome check exit0。mainが対象試験だけformatし、再build/対象再試験まで成功した。その後、下記の新候補全18工程と正式36試行も成功した。追加CIは後述のとおり失敗し、ローカル成功からCI TIMEOUT解消を断定しない。

## 単一writerの根拠

次はソース読取りによるドキュメント根拠。新テストで実buffer/Workerの可視性も確認する。

| 所有経路 | 実装上の根拠 |
|---|---|
| 汎用realm | scripts/package/coverage.ts:32のcreateRealmは呼出しごとにnew SharedArrayBufferを作る。realm間でcounter bufferを再利用しない |
| Node host / Worker | 同:211–214の生成preloadはhost bufferを1個作り、Worker生成ごとに別のnew SharedArrayBufferを割当てる。同:139のworker wrapperは渡された自分のbufferだけを__coverageCountersに設定する |
| browser host / Worker | 同:217–222の生成initはページhostと各Workerに別bufferを割当てる。同:147のWorker bootstrapは自分宛のevent.data.bufferだけを使用する |
| browser descendant Worker | 同:148–153はchildごとにnew SharedArrayBufferを作り、childへbootstrapし、親hostへ観測用bufferを通知する。親の__coverageCountersは親自身のbufferのまま |
| host collector / merger | 同:66、70、78、86のmergeRealmsはAtomics.loadで登録とcounterを読む。生成preload終了処理、browser afterEachもbufferを読んで保存するだけでstatement counterを書かない |
| U2/U3 wrapper | scripts/migration-session/coverage.tsとscripts/migration-install/coverage.tsには__coverageCountersへの新しい書込みやAtomics.store/add/exchange等がなく、共通collectorを利用する |
| 同realm内の再import | 固定instrumenterの生成moduleはcoverage[path]が存在して同hashなら同actualCoverageを再利用する。修正前の封印済み生成例 .artifacts/migration-install/reference-regressions-5908a7fa-fd16-487f-96ce-9592ac915803/coverage/runtime/guest-validation.js:4968–4978で確認。同じ固定file/hashの.sを別closureへ二重登録していない |
| blink pthreadの除外 | Node em-pthreadとbrowser /assets/blink.mjsは第三者core用の経路としてcollector wrapperを通さない。製品21JS用counterの別writerを作るものではない |

対象3helperの__coverageCountersとAtomic書込みを検索し、statement counterの書込みはbridgeSourceのsetterだけと確認した。登録markerの書込みもそのrealmのbootstrap/bridgeだけ。テストが行う初期化・異常counter注入は検証fixtureであり、製品collectorの所有関係ではない。

## 実装の変更

scripts/package/coverage.ts:47の各statement accessorにrealm内の最新値を持たせる。初期値は既存SharedArrayBufferからAtomics.loadで取得する。getterはその最新値を返し、setterは従来どおり非負安全整数を検証してMAX_INT32へ飽和し、毎回Atomics.storeで公開した後に最新値を更新する。

file.path/statement map照合、realm登録、全statement counter、毎回のAtomic書込み、ゼロ・正数・飽和の意味は維持する。hit-only化・sampling・counter省略・SHA省略・skipを追加していない。hostは引き続きAtomic読取りだけで、Worker中断前に成功したsetterの値を読める。

## 新しい回帰

- 実bridge2048increment：全counter値と毎回のAtomic.store列1..2048を維持し、反復getterでAtomic.loadを増やさない。
- 非ゼロ初期値37を読み、increment後38をcache/buffer両方へ保持。不正setter値でcache/bufferがどちらも変化しない。
- 従来のAtomic read/write方式と、reset・increment・MAX_INT32境界・巨大安全整数のcounter列が一致する。
- 二つのrealmでbufferが別物で、片方の100incrementが他方の値を変更しない。
- 実Workerが4096回の値を公開して待機し、hostが読取り、Workerをterminateした後も4096を読み取れる。全21JS分母を維持し、未実行の他fileを消して合格にはしない。

既存12件の固定21JS分母、未登録/欠落/重複realm、飽和・不正値・負counter拒否も残す。新試験は計5件で合計17件。全build/testはmainだけが逐次実行する。

## 新候補のローカル全検証（検証済み）

- 全18工程report：.artifacts/migration-install/collector-regressions-8fa92cd9-e437-4fcf-8d70-a72ccb958e9e/regression-report.json
- report SHA256：8a81d25f1e6809b09f85d871062bdaad66038c321cbc5b093082739a1ad02442
- 全18工程exit0。計測付きcombined Nodeは115pass・skip0、elapsed1330.658秒。計測付きbrowserはpackage99件、U2の9件、U3の9件が全pass。全21JS coverageは1768/1929=91.65%、skip0。
- 正式36試行report：.artifacts/migration-install/formal36-collector-20261016/measurement-report.json
- measurement SHA256：ac3a7bf2d0d94507e8ddc52ea71e1d3743a96e0ea0d707e4dc7fe629dc7a4408
- source identity8897cea442a680b469c474b0a8164175b5499a48f200cc1bd6eb8f7f4054967c、pack SHA256 cc89a7dcdd015da80b9c11569a4fef2daa8b3f2131610caa7fa20682c6e995b2。reportでtrialCount36・passed=true・thresholdMs3000を確認した。

| 非download中央値(ms) | Chromium | Firefox | WebKit |
|---|---:|---:|---:|
| aube | 834.7950000166893 | 1911.9599999999998 | 731.7199999999999 |
| Biome | 1124.1999998688698 | 2633.08 | 1071.7399999999998 |

全6組が3000ms以下。mainは証明書cleanup wrapper exit0と、別途find-certificate exit44による未登録を確認した。

計測負荷の解釈：同じローカルcombined suiteの旧1378.647秒と新1330.658秒は交互実行・負荷統制した比較ではなく、改善率やCI余裕の証明にはしない。旧CI失敗test25の今回ローカル時間499308.411583msは複数installとrunを含む試験全体、test27は118774.469333ms。install単位の180秒deadlineを試験全体時間へ読み替えず、期限を延長していない。

## 共有部品への影響と残作業（現在）

mainが新source identity=8897cea442a680b469c474b0a8164175b5499a48f200cc1bd6eb8f7f4054967c、CI manifest SHA256=f229d672ea9093659447a32b98af33031a384937c69ddb82d2955ef2f5e689f5を固定した。CI入力は従来と同じ22logical行・254668126bytesで268435456bytes上限内。新候補は .artifacts/migration-install/candidate-814696a5-7374-4064-91a1-d0005dd8b6f2/package.manifest.json、tar SHA256=cc89a7dcdd015da80b9c11569a4fef2daa8b3f2131610caa7fa20682c6e995b2で製品pack bytesは不変。全回帰・coverageと正式36試行は上記まで成功した。

U1のpackage coverage、U2のsession coverage、U3のcombined coverageは同じbridgeSourceを使うため、共有変更としてU3 source-manifestへscripts/package/coverage.ts、scripts/package/coverage.js、tests/package/coverage.test.ts、tests/package/coverage.test.jsを個別claimした。既存106パスを保持して計110パス。過去のU1/U2記録・封印済みproofと、固定eb50/run38766787639向けartifact verifier/bindingは変更しない。

検証済み：人間承認後、mainが追加署名付きpushとCI再試行1回を実行した。signed head=c30e2a9b90eabaa35a2fd9ee51d313209ce9290e、GitHub verified=true/reason=valid、署名前後のtree=5cf3a2327c348bcb9c738e347fd8f63c84bd1a55は一致する。run38784488074・attempt1・job116592855385は途中観測時点でin_progress（最終結果はfailure、後述）。準備・build・typecheck・入力復元・core・独立consumer工程は成功したが、この途中観測後、CI全体はfailureで終了した。push記録は .artifacts/migration-install/collector-signed-push-38784488074.json。

検証済み：mainが新verifierを実行し11pass・0fail・0skip。実ローカル証拠のpositive componentは16.97秒で成功しacceptancePassed=falseを維持、同じpending bindingのwhole acceptance拒否も確認した。記録は .artifacts/migration-install/collector-verifier-tests-20261016.json。CI成功・独立レビュー・正式完了確認は未完了で、U3完了とはしない。

## 追加CIの最終結果

2026-10-16 CI最終結果（検証済み）：run38784488074・attempt1は39分4秒でfailure。追加push・再試行は行っていない。command14のinstrumented combined Nodeは115件中114pass・1fail・0skip。test25は成功（719975.642834ms、複数install/runを含む試験全体）、test27だけが初回install待機中に180681.584382msでInstall deadline/TIMEOUTとなった（install.js:1252、validateGuest/yield後、試験line149）。180秒の期限は変更していない。incomplete.jsonのobservedCommandsは13。CI browser coverage・最終report・formal36には到達せず、cleanup/uploadは成功した。ローカル18工程・正式36試行の成功証拠は保持するが、CI成功・U3完了は主張しない。

独立取得した失敗CI資料：.artifacts/migration-install/ci-failed-38784488074-1/artifact.zip（143386bytes・22members、SHA256=74b190b75dd24923d094583fe19587cd1e25904fb4f0e885cbc6caa93dbc396d）、同ディレクトリのjob.log、およびmembers/migration-install/completion-fe92ef9c-05bc-4928-929f-4fbabf00e9ec/incomplete.json。API照合済みZIPとしてmainが保存した。新pending bindingとread-only helperは合格証拠へ変更せず、原因調査中である。
