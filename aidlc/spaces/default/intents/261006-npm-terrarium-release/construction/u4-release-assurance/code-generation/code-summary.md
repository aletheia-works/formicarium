# U4 Code Summary — Loop-back 4の現在観測

## CLI公開境界の実装と拒否検証（R-05〜R-07）

publication-cli.tsへnpm/gh executorの最小注入を追加した。既定は従来のexecFileSyncであり、gate/承認/OIDC検査を回避するフラグはない。新publication-cli.test.tsは常に偽executorを使う8群で正常gateと原archive/source/core/contextの個別拒否、不成立時起動0回、正常RC next/stable latestの同一tgz/registry/access/ignore-scripts/provenance/分離cwd/空userconfig/秘密env除去、独立Release承認とsource不一致拒否・tag/repo/assetを捕捉する。fixtureの空npmconfig siblingも後始末する。publication.test.tsへ必須回帰欠落/failed/timeoutとcoverage欠落/80%未満のblockedを直接確認する2群を追加した。製品拒否不足は新試験で観測されず、製品Red→修正の成功とは呼ばない。

検証済み（main観測）：product tsc exit0（56f6bf）。test tsc初回は新fixture filesの明示型不足TS7034/TS7005でexit1（a3c51a）。配列型を明示後exit0（dbaccc）、正式emit exit0（54be99）。初回は試験runnerの型不成立で、製品欠陥Redではない。7file suiteはCLI8/publication10/workflow8/既存release35/CI13、74/74 pass、fail/cancel/skip0、21630.481125ms、exit0（256f26/1c78b4/6b470a/61ff1f）。実外部送信は0、npm/gh正常到達は偽executor捕捉だけである。

## 記録整合と残る証拠境界

R-06のCLI例をplan <evidence-root> <request-json>、validate <publication-manifest> <identity-json> <exact-tgz>へ訂正し、旧誤例と各入力の役割を説明した。R-07のNFR3はDeferredとし、旧source70b345c3/run38024772634の検証済み80.51%と、現在publication source/公開candidate8334d7f1のfresh固定24coverage/統合前CI未検証を分離した。source-manifestへ新CLI試験TSを追加し、ignored生成JSは正式build inventoryで別管理する。

Step31–34の実装・mainローカル観測は完了。Step35の記録更新は完了したが、native sensors/独立advisory review/Unit正式手続はmainの後続作業であり未完。公開candidate bytes・U1–U3/core/guest/旧証拠を変更していない。実Trusted Publisher/対話CLI認証/bootstrap/OIDC/RC・Release公開/実RCterrarium受入れは未実施。固定24/80%/46receipt/worker1/retries0/既存期限/wasm1GBを保持する。以降のLoop-back3と旧CIは保存履歴であり、現在sourceの遠隔成功に昇格しない。

## 歴史：Loop-back 3のローカル観測

## 検証済み：公開専用candidateとローカル検証

mainが正式product/test TypeScript buildとemitを逐次実行し全exit0。新publication8件、workflow8件、既存release35件、CI13件は64/64 fail/skip0。最後のpublication wrapper補強（RC実公開にも既存全回帰と固定24 coverage80%以上を要求）後にもproduct/test tsc/emit exit0、publication8/8 fail/skip0を確認した（tool chunk 7a81b4）。既存decideReleaseのRC非循環条件とstable実RC採用条件を保持する。

public pack準備は成功。実archive24ファイル、package.json以外の23ファイル原bytesはv9と一致し、公開candidate SHA256は8334d7f14c31109e5be3ec90147aa02105d8d839c4c79eccc1c25cb88eabbb3a。local-publication.json/candidate-check.jsonに観測を保存。空consumer /private/tmp/formicarium-public-consumer-v1へ導入成功、strict NodeNext型チェックexit0、consumer.test.js11/11 fail/skip0。Chromium/Firefox/WebKit各11件、計33browserケースはexit0・33 passed (9.8m)、1worker/retries0（tool chunk69533b）。sandboxのブラウザ起動制限による先行exit1を保持し、ホスト権限の別outputで実行した。実Safariの検証ではない。詳細verification/publication-v1/main-results.md。

公開先は人間が指定したaletheia-works/formicarium。公開専用manifest/private/repository整合、原候補を保持するprepare/validate/plan、実source/tag/tuple/全必須checks/操作承認を再検査するgate、job権限を分けたpublish.yml、初回対話認証とstaged placeholderを含む手順を準備した。Step25–28は実装とmainのローカル観測をもって完了。Step29のfresh候補結合coverage/最新source遠隔CI/実公開RC受入れ、Step30の正式review/engine手続は未完でcheckboxを維持する。公開/設定変更の最終承認は行っていない。

## 記録・source claims・外部条件

source-manifestは追跡対象のTS/試験/workflow/docsだけをclaimsとして列挙する。生成JSはignore対象をengineがclaimsとして拒否する既知条件に従い除外し、mainの正式build生成inventoryへ別管理する。JSを手編集していない。U1–U3/v9/core/guestと旧receiptは保持。旧sourceのCI成功は下記の歴史であり、公開candidate新SHAや現在のpublication sourceの遠隔成功へ転用しない。

npm scope owner/2FA enforcementは実画面で確認済みだが、対象Trusted Publisher/CLI認証/初回OIDC/registry・Release実公開は未実施。main npmwhoami ENEEDAUTHを、ブラウザログインから認証済みと推定しない。fixtureの設定JSONは実設定証明ではない。公開済みRC受入れをRCの公開前条件に置かず、実RC導入差分と受入れをstableの前提として観測する。以下の過去節にあるpending/未検証表現はその時点の履歴であり、現在ローカル観測の合否はこの冒頭を参照する。

## 歴史：Latest Collector CI — run38024772634（attempt2成功）

検証済み（main）：最新collectorを含む隔離source70b345c39fa17840a093ea11b0cec748b0a25f2fを準備し、旧remote sourceとの差分はscripts/release/collect.tsとtests/release/collect.test.tsの2件、99追加/3削除。mainと隔離候補の正式product/test TypeScript build→emit→release35件→CI13件が逐次成功し、fail0/skip0。生成JSを正式buildと結合し、追加製品修正やguest/core/候補tarballの再build/repackをしていない。source-manifest.jsonは既存22 application-source claimsを維持する。

検証済み（main connector）：source70b345c39fa17840a093ea11b0cec748b0a25f2fとinput9d889c369900776fe923a2457e7a88b6f502cbcaはともにGitHub Verified/valid。input archive104524793 bytes、SHA256315a85eede294009d9269dd01185a9c154fd3c5a0e2aa1fc0ec983b3065a0354。原payload全1373件のsize/SHAは不変。manifestのsourceCommitと変更source pinだけを結合し、新input identityへ更新した。既存検証専用workflowと権限を保持し、具体的送信内容への人間の承認後に署名push・既存Actions変数更新を実行した。

[run38024772634](https://github.com/Marukome0743/formicarium/actions/runs/38024772634)のattempt2は検証済み：job114136356761と全stepがsuccess。必須9 checksはrelease35/Node54/browser36/U1 Node115/browser123/U3 Node30/browser45の計438試験とnative2件が成功、exit0・timedOut=false・skip0。fresh固定24 inventory exact match、coverage1450/1801=80.51%、46receipt（Node host1＋三browser各15）のpass/4identityfieldsが一致した。generation19267ef5-bd6f-4a33-8df7-9aa3e8ef2a1d、sourceIdentity96ae8b4c1b47f852d2cd2b138e27bc0e18fc752c381b128bb0c2bbe88c20df28、candidateIdentity2b62bb57a2c757a30ffa88609ebc605191b438510e98796b6d93df9570208e26、executionIdentity8c4620766c57465fa91cada5ddb897bd15faa193c024b6409a114a6ab87fdce4を原reportへ結合。artifact11661230131のZIP68325238 bytes、SHA256412e39a043b2c7710bd76c94c01b875f4617a8b7aa26eeeace410172074643dcはGitHub digestと一致。1610全ファイルのsize/SHAと各command原stdout/stderr SHAをremote-reconciliation.jsonで照合しacceptance=trueを確認。最新collector TS/正式生成JSとmain/隔離の161source pin、1373payload不変はsource-identities.jsonで検証済み。NFR3/Testing Contractの最新source CI条件は達成。原coverage内の旧U3説明文字列ci:unverifiedは書換えず、最新CI成立はroot acceptanceとGitHub receiptから独立確認した。公開RC実terrarium受入れ、Trusted Publisher実設定、公開source/history監査、Windows taskkillは別の未検証条件として保持。正式review/Unit完了手続はmainの後続手続であり未完。

attempt1は失敗として保持：release35件とnode-regression成功後、browser-regression35pass/1fail。WebKitのcrossOriginIsolated helloに対するpage.gotoが900000msでtimeoutした。根因は未解決の間欠的失敗であり、製品修正なしで同一source/inputの全jobをActions APIから別attempt2へ再実行した。Playwright retries0・worker1と既存品質制限は両attemptで変更していない。failure-reconciliation.json、remote-attempt-1.job.log/remote-attempt-1.jsonを保持し、成功のattempt2と混同しない。最新成功証拠はremote-attempt-2.json、remote-attempt-2.job.log、remote-reconciliation.json、remote-start.json。旧run38011644576の成功を今回sourceへ転用していない。

最新CIと独立した残条件：

| 条件 | 所有者・必要操作 | 必要証拠 |
|---|---|---|
| 公開済みRCの実terrarium受入れ | release担当とterrarium保守者が、個別の公開・導入承認後にRCを実導入し検証 | registryのRC版、基準/integration commit、実diff artifact SHA、実導入結果 |
| Trusted Publisher/OIDC・registry実設定 | repository/npm所有者が対象設定を確認・承認 | 設定の読戻しと承認対象版/tag/workflowの対応 |
| 公開source/history全体監査 | repository保守者とrelease担当が公開候補全体の取得元・license・機密を確認 | source/history/tarball inventoryと監査記録、具体的公開承認 |
| Windows taskkill経路 | collector保守者がWindows hostで子孫停止を検証 | native Windowsのtimeout/abort/pipe試験原ログ |

上表を今回のCI成功から完了扱いにせず、該当traceabilityのDeferredと公開判定blockedを維持する。Windows条件は未実行の環境経路であり、別の公開要件へ新規昇格しない。

逸脱：最初の手動local実行でreleaseの終了前にCI試験を開始し約1秒重複した。性能測定はなく、その結果を逐次証拠に使用しない。close待ちrun-local.mjsでmainと隔離候補を逐次再実行し、上記48件成功を正規証拠とした。

## Collector指摘の修正 — 2026-10-10（過去の観測）

検証済み（main）：R-02の継承pipeを持つ孫fixtureは修正前timeout/abortとも約2.1秒でsettleして9件中2fail。process group終了と250msのpipe drain上限を追加し、正式product/test tsc→emit後release35/35、fail0/skip0。timeout608.95ms、abort607.93msは終了確認用100msを含む。子孫のESRCH、failed分類、保存stdout/stderrとSHAを確認。Windows taskkill経路は未検証。R-03はdocs/release-assurance.mdへ保存遠隔run、source、436試験/native2、固定24/80.51%と証拠pathを反映。遠隔結果は今回変更前sourceの歴史として保持し、今回修正の遠隔再実行とは呼ばない。詳細verification/collector-final-20261010/main-results.json。正式Unit完了承認は未記録。

## Current CI Recovery — 2026-10-10

検証済み：run38009444961はcore補助供給、回帰123件（release33/Node54/browser36）、native基準、U1 Node115/browser123が成功し、固定coverage入力terrarium/web/terminal.mjsの供給不足でU3準備が停止した。原log・artifact ZIP SHAと1542ファイルを照合して保存し、acceptance=falseを保持。Node26 transform拒否はNode24.21.0で解消した。

修正はCI-only：terminal.mjs既存6405bytesを入力供給へ追加し欠落拒否を回帰、準備copy内のresolver3moduleを供給SHAで照合してseal前に配置、U3だけowner依存と同じPlaywright CLIへ変更した。collector・製品・core/guest・凍結U1–U3記録を変更していない。mainの正式2tsc/emit/Biomeはexit0、CI13件pass/fail0/skip0。署名済み送信候補側でも正式2tsc/emitと13件が成功した。

ローカル供給preflightはU3 Node30/browser45/fixed24 coverage1450対1801行80.51%/skip0/46receiptが成功。保存済み同pack U1 reportを使用したためfresh全component・遠隔成功とは扱わない。新record local-supply-preflight-v11.jsonと原52ファイルに分離した。Sandbox内のブラウザ起動Permission deniedはv10の失敗記録として保持し、ホスト権限の新v11で検証した。

署名済みsourcec75bc285f0320e2f3cb234569fa9cc4bc4588a9d/input1b11d07add724d05a966a76790a5757ad36b6969のGitHub Verified/validを確認し、承認済み範囲のrun38011644576を起動。remote-transfer-v6.jsonが記録。遠隔CIのjob success、全必須9 checksとraw command/log、artifact ZIP SHA a3c4d15a7fa483771eb7dd7d084845c3627de8a69863b4bcad1c89b52f9df6e4、および1610原ファイルを照合した。release33/Node54/browser36/U1 Node115/browser123/U3 Node30/browser45の計436件とnative2件がpass、fail0/skip0。fresh固定24 coverage1450/1801=80.51%、46receipt、generation fee5a381-0d08-4444-9f0a-a92afbe153d4、executionIdentity abf27bb6ed0cfb50d08957c9acab9a6e14dbeca47fcf9a7b21bc773c4ac0e23fを同pack dfcc3e6384b5ed14ddefbccd4806b9f1be2d858129e74216f116668142571f6dと結合しacceptance=trueを検証した。原log/ZIP/抽出物と照合receiptはremote-run-38011644576へ保存した。公開RC実導入・Trusted Publisher実設定・実公開・正式Unit/全stage承認はこの成功に含めない。39要件IDの4Unit対応和集合に不足なしを保存したが、要件達成・承認とは扱わない。131保存証拠の不変と164source SHA一致をprepared-owner-ci-repair.jsonへ記録した。Stop無効を保持する。

## Previous CI Attempts — historical observations

補助供給の追加承認後：source35ee4b5e845e6cdaff804344f4d8047083136f36とinputb5b549aea6e35f3e1b6732bc70391801da3cc5c4を署名付きで送信し、両方のGitHub verified=true/reason=validを確認。Actions URL/SHA変数を承認済みarchiveへ更新し、遠隔run38008104471を起動した。remote-transfer-v4.jsonが承認文と供給SHAの記録。実行中で全体合格はまだ未検証。要件対応sensorはpass=true、gaps/orphans/missing/invalidすべて空、findings_count=0をmainが観測した。Stop無効を保持する。

現時点：遠隔run38007330316のrelease33件pass/fail0/skip0を、Run/head SHA・原log・artifact ZIP SHA256・9原ファイルのSHAと照合して保存した。core-source-provenanceは固定a882fb2fが公開リポジトリに存在しないため停止し、全体acceptance=false。既存2commitの1,489bytes補助Git bundleとISC LICENSEを追加供給する案をローカルで具体化した。正式build/emitとCI11件がmain/送信用コピー双方で成功し、実bootstrap成功・再SHA固定した破損packの拒否を確認した。source-manifestは従来21claimsにcore-source.tsを加え22claims。追加2入力の外部送信は未実施であり、supplemental-core-transfer-plan.mdへ正確な署名候補・archiveSHA・検証結果・送信手順を保存している。既存製品/core/guest/旧証拠とStop無効を保持した。

最新観測：人間の具体的な送信・遠隔CI承認後、検証専用2ブランチをjj署名付きで送信し、GitHubのverified=true/reason=validを確認した。初回run38006395969はfresh checkoutの.artifacts親不在で検証前に停止。同じENOENTをmain回帰でRed1件として再現し、親だけ作成して結果leafのEEXIST拒否を保持する修正後、mainとisolated sourceのCI10件が全合格・fail0/skip0、正式2tsc/emitも成功した。

二回目run38007010306は初期化成功後、旧published mainのネイティブ基準2件と現在の供給manifestの不一致を拒否して停止した。現在の検証済み基準をisolated source allowlistへ追加し、存在する入力8件すべてのSHA一致を確認した。製品・guest/core・mainの基準・旧証拠は変更していない。原logと各失敗分類はverification/ci-traceability-repair-v1/remote-run-*.{json,log}へ保存した。遠隔試験・fresh coverage全体の合格はまだ未検証で、以下の旧観測と混同しない。

検証済み：mainのrelease3試験33件合格・0失敗・0skip。readonly helperで132 SHA/sizeと保存固定24 coverage 1450/1801行80.51%・46receipt・同generation/source/candidate/execution sealを照合。過去Red5→Green33を保持し、新coverage測定とは扱わない。証拠はverification/ci-traceability-repair-v1/main-tests.jsonとmain-reconciliation.json。

実装済み：検証専用workflow、厳密manifest/regular-file/SHA/commit/guest/ref/owner入力境界、allowlist bundle producer、公開URL+archiveSHA供給境界、逐次Node/3browser/nativeとfresh同pack U1→固定24 coverage接続、失敗分類とrawログ保存、8正常/否定試験群（実bundle作成ケースを追加）。mainの正式product/test tsc→emitはexit0、実bundle作成ケースを含む8回帰群は全合格・skip0（126.807875ms）。証拠：verification/ci-traceability-repair-v1/main-ci-tests.json。Bun件数解析修正を含め、最新版の正式product/test tscとemitはexit0。mainの実bundle producer・manifest/payload/source SHA検証もexit0（1574ファイル・260994553 bytes）。既存製品/core/guest生成物は変更していない。

未完：公開対象と入力bundleの機密/ライセンス確認（explicit1578files/260998862bytes、161checkout source filesをdraft inventory化、旧絶対pathをrelative派生manifestへ限定変換）、公式commit固定のguest MIT LICENSE原文・取得SHAをnoticesへ追加済み。具体的な署名push/供給承認、遠隔実行、Run/head SHA/rawartifact照合、Trusted Publisher実設定、公開RC実terrarium受入れ。workflow構文/ローカルfixture合格を遠隔成功へ代用しない。U3の参照先Minor指摘は未解決として引継ぐ。Stopは全Code Generation正式完了まで無効。

# U4 Code Summary

## Loop-back 3 — 公開専用候補とTrusted Publishing準備

新規scripts/release/{publication,publication-cli,workflow}.ts、tests/release/{publication,workflow}.test.ts、.github/workflows/publish.yml、docs/release-assurance.mdを実装した。既存types.tsにはcreate-github-release操作だけを追加し、既存decideRelease/validateEvidenceの判定を弱めずpublication wrapperでtuple/source/version/実設定artifactを結合する。正式buildの対応JSはmainが生成する。U1–U3/v9/core/guest/旧証拠は不変。

prepareは原archive24ファイル全SHAを検査しexclusive新outへ複製、公開manifestだけprivate=false/repository/public registry/access/版を変更する。validateはnpm archiveの実集合と各SHAを再検査し、保存manifestを変更しない。planはdigest-checked evidenceと実設定観測を検査するだけ。gateはGitHub event/repo/tag/commit、実workflow構造、候補core/固定source bytes、release checks/承認を再検査する。公開先は人間が確定したaletheia-works/formicarium、workflow publish.yml、environment release。

workflowはJSON形式の有効なYAMLで実構造を解析し、正確な2版タグのpush以外を拒否する。verify contents:read、publishだけOIDC、Releaseだけcontents:write。SHA-pinned input bundleをjobごとに再取得する。npmへ渡すのは再検査した同一tgzで、npm token/config fallbackを除き、GitHub Releaseには独立操作承認を要求する。公開CLIのpublish/releaseは明示job環境と具体的操作承認が揃う本番経路であり、ローカルplan/validateからは呼ばない。

## 検証済み結果と残る観測

mainからの観測報告：product tsc exit0、test tsc exit0、正式emit exit0、publication8/8、workflow8/8、既存release35/35、CI13/13、計64件fail/skip0。新規層はtest-afterで実装後main検証、既存欠陥の無断Green化はなし。新8ケースはmanifest/同size改変/不明公開先/版tag/links/inventory/registry/上書きとRC非循環/stable不足を検証、workflow8ケースは実構造/起点/context/tuple/job依存/gate/権限/token/actionpinを検証した。原コマンドはunit-test-instructions.mdのCurrent Verification Loop-back3とmain保存ログに対応する。

この最初の64件観測後のCLI core/pack外固定source照合、fetch parent/.npmrc拒否、npmconfig隔離、gate直前条件は、main正式product/test tsc/emit exit0と64/64 fail/skip0で再確認済み（tool chunk eb8e59）。その後publicaton wrapperへ、RC実公開にも既存REGRESSION_CHECKS全成功と原SHA検証済み固定24 coverage80%以上を必要とする狭い補強を追加した。既存decideRelease RCの最小consumer・非循環判定は変更せず、公開経路の全体品質条件を追加している。matching fixtureは同条件の原artifactへ結合したため、mainへ正式build/emitとpublication8件だけの再検査を依頼済み。新candidate SHAのpack/types/consumer/fresh coverage/遠隔CIはStep29のmain担当。実Trusted Publisher、CLI対話認証、bootstrap、npm/Release公開、実RC受入れは未実施。ローカルfixtureのobserved形JSONは実設定成功の証明ではない。

初回stagedは公的0.0.0-stage placeholderを作るため外部公開操作の最終承認対象。ブラウザログインをCLI認証へ転用せず、main npmwhoami ENEEDAUTHを記録する。ドキュメントの対話bootstrapとOIDC検証順序を実操作待ちとして残し、長期tokenを生成しない。未承認の外部操作前にローカル実装・候補・差分・レビューを仕上げる。Step29/30の外部受入れ・正式手続は完了checkboxにしない。

## 正式再開始の再検証 — attempt 6620d2c934cd0a17

検証済み（main観測、2026-10-10）：既存のrelease/evidence.test.js・decision.test.js・collect.test.jsを逐次実行し33/33、fail0、skip0、1935.638667ms。product/testのTypeScript検査はそれぞれ`--noEmit`でexit0、限定6TSのBiomeもexit0（既知のevidence.ts useTemplate info1件を保持）。今回production/testの変更・再build・emitは行っていない。旧正式buildの生成物で回帰を再実行した結果であり、今回のfresh build成功とは呼ばない。

既存R-01修正とRed→Green履歴、保存coverage、候補・guest/core・外部owner証拠を保持した。下記の旧attempt de720d18f39642ecに属する観測・レビュー・checkpointは履歴であり、新attemptの承認へ置き換えない。新観測はverification/official-restart-20261010-v2/main-results.jsonに分離する。source-manifestの15著作ソースclaims、18ACのtraceability（外部操作Deferred）を保持し、ignored生成物や診断cacheを追加claimしていない。

検証済み（main）：U3保存coverageのread-only reconcileがexit0、passed、savedCoverageReconciled=true。固定24、1450/1801=80.51%、skip0、46receipt、generation6e347c83-aca9-48b2-90bf-e0ce5ad9bb7d、executionIdentity2942cf1d2190942b222f57a24bde0be33015ef8c85bd0abb8bdb31509de30180、owner参照12と監査prefix111851/113715のsameSaved=trueを確認した。これは旧測定の今回照合であり、新測定・新owner承認ではない。

計画Step11に記載された正式build/emitの今回再実行は、既存修正・生成物を保持するため実施していない。旧正式build履歴と今回noEmit検査・回帰成功を区別して逸脱として明記し、noEmitだけで計画全体やstage完了を主張しない。Step8の独立レビュー・正式手続は未完のためcheckboxを残す。

遠隔CI、実Trusted Publisher設定、公開済みRC実受入れ、公開・操作承認は未検証で公開判定blockedを維持する。U3の現在候補と旧owner承認は区別し、新たなowner承認は取得していない。独立レビューと正式Unit/checkpoint・Code Generation全体の完了はmainのエンジン手続で確認する。本記録はそれらの完了承認を意味しない。Stopフックは全体完了確認まで無効のままとする。

## U4 Major R-01 recovery — 2026-10-10

検証済み（main観測）：正式product/test TypeScript buildとemitが成立した現実装で25件中20pass/5failのRedを観測。保存したRC受入れのdiffSha256を空にし、envelope/index SHAを正しく更新してもstable判定がallowed:trueになる再現を含む。これは旧collectorのR-01とは別のrelease受入れ入力の不具合である。

修正はscripts/release/types.ts/evidence.ts/decision.tsとtests/release/fixtures.ts/evidence.test.ts/decision.test.ts、docs/release-assurance.mdに限定。terrarium.diffArtifactを明示し、baselineCommit/integrationCommitの非空、候補版とinstalledVersionの一致、diffSha256形式、check.artifactDigestsとroot内regular nonsymlink原bytes SHAの一致を保存・解決時に必須とした。passed受入れでnull metadataも拒否する。RC→stable配布差分とは別の証拠を使い、不足/改変でstableをblockedに保つ。旧証拠は書き換えない。

同じ回帰のGreen25/25、3ファイル32/32を観測した後、無効なterrarium証拠のsaveがenvelope/indexを残さない追加回帰を含む最終33/33（skip0、1971.569ms）が成功。正式2tsc/emit、限定6TSのBiome checkはexit0（既存useTemplateのinfo1件は指摘外として保持）。最終試験後の新規テスト整形は意味変更なし、test build/emit/checkが再度exit0。保存済みfixed24 coverageは現source/candidate/realm/sealのread-only照合で1450/1801=80.51%、skip0、46fresh receiptを確認し、新測定と呼ばない。詳細はverification/official-recovery-20261010-v1/main-results.json。

source-manifestは歴史的15の著作ソースclaimsを保持する。正式build/emitされた対応6JSとsource maps、および.build内の対応6JS/mapsはmain-results.jsonのgeneratedOutputsへ列挙した。engineがGit-ignore対象をsource-review evidenceに認めないと拒否したため、生成物は別の検証inventoryとして保持し、ignore設定や保護機能を変更しない。U1/U2/U3凍結成果、guest/core、外部owner、hook生成ファイルを変更していない。遠隔CI・Trusted Publisher実設定・公開済みRC実受入れ・実公開/操作承認は未検証でblocked。U3代替測定先名のMinor指摘は別Unitの未解決事項として保持。独立レビューと正式checkpointの実行・承認はmainの後続手続であり、本記録は承認済みとしない。

## Implementation and Files — historical 15-claim baseline

source-manifest.jsonの15application-source claimsが今回の変更。生成JSは正式TypeScript/emitで生成し直接変更していない。coverage seal/executionIdentityによる測定copy/最終bundleの同一性、C6 immutable evidence/index/照合、C7 RC/stableとexplicit RC adoption・操作承認の判定、逐次command observer、公開前確認の手順を実装した。外部terrarium、AI-DLC生成ファイル、旧候補/receiptは変更していない。

最新版pitchforkの人間指示により、正式改訂Plan Approval後にbuild既定と独立expected ref/commitをv2.30.1へ更新した。既存muslパッチは不変。旧native基準をarchiveへ保存し、同じv2.30.1 ELFのnative2実行一致から新基準を生成した。U1/U3既存レビューの再照合は正式receiptへ記録し、実装再生成や承認偽装を行っていない。

## Earlier Local Verification — 2026-10-10 historical observations

検証済み（main）：core a882fb2f3df14115b7e46f6812fb296eef5934d7 dirty=false、v9 tgz dfcc3e6384b5ed14ddefbccd4806b9f1be2d858129e74216f116668142571f6d。aube Node4、build/runner/probe Node39、session/pitchfork Node11、probe/aube browser33、pitchfork browser3、pack/types9、指定collector4files41件が成功。134filesのbefore/after原bytesは不変。command・時刻・UUID・stdout/stderr SHAの正本はverification/current-*-v1のobservation.json。旧coreのaube timeoutは解決前の履歴であり、現在の回帰には流用していない。

C6修正は別candidate/source/executionのreport、偽realm、receipt欠落を拒否する。26testsのRed22pass/4fail後、整形後の正式2tsc/emitとGreen26pass/skip0をmainが観測した（c6-binding-green-formatted.log）。実U3v3 report/inventoryを読み取り専用artifactとしてvalidateEvidenceで正常受入れした（current-evidence-validation-result.json）。固定24・23measured・npm.ts未実行0を保持。evidenceSaved=falseで、envelope保存や公開判定は行っていない。sourceCommitは観測jj baseであり、working-tree第一者SHAを別結合しpublishable commitとは主張しない。source-manifestの15claimsは過去U4実装を含む集合であり、凍結済みU3 collectorを今回変更した主張ではない。

verification/current-v9-coverage-import-revalidation.jsonはU3 v3のseal1705files、24source、site/tgz、U1 report、46receiptsと再集計の一致を記録。1450/1801=80.51%、skip0、1253import realms、report SHA57349ddab883e663974b34eecdaa6e55430c701dfa97c43cbb759cdad7635d29。notFreshU4Execution=trueとして履歴採用し、旧80.56%と区別する。U3現在v9接続bridge6/owner-copy45は成功。旧owner承認のpitchfork2.30.0へ新候補を帰属させない。実機SafariはU1の5成功とU3候補未検証を区別する。

未検証は遠隔CI、source/history/native依存の完全確認、Trusted Publisher実設定、公開済みRC受入れ、stable差分・操作承認。verification/current-evidence-validation-result-v2.jsonでは公開envelopeも操作承認も渡さない実APIのRC判定がblockedであることを観測した。以下の結果は2026-10-08時点の履歴として保持する。

## Observed Verification — 2026-10-08履歴

検証済み：元collectorに対する改変3回帰はRed（12中3fail）、修正後coverage14とrelease22は36pass。main-verification.mdと保存raw logsが根拠。fresh seal後のNode30/browser45pass、固定24、1451/1801lines=80.56%、executionIdentity10e02129943632e9993cc5a721e7f5cb7a3273c73cff1c1efb28f32e2b78c59f。U1同packの明示importを保持する。

最新版の検証済み結果：正式build/main/tests/emit exit0、build9pass、pitchfork v2.30.1 native2回一致、Node11pass、browser3pass。詳細と版・入口の境界はpitchfork-v2301-verification.md。runner/probe Node29passで8probeと指定3回帰を含む。aube Node回帰は900000msでタイムアウトし、native一致の1テストがcancelled、補助3テストはpass、command exit1。verification/node-aube-regressionのraw logs/command/時刻/SHAを保持する。上限を延長していない。

検証済み：公開前の限定署名検査は現在の追跡693filesと候補tarball23text membersに所見なし。npm auditは0vulnerability/exit0。これは4種類の秘密鍵/token署名だけの検査であり、全文意味確認・history全体・native依存の安全確認ではない。verification/public-preflight.jsonとverification/npm-auditを参照。

## Earlier Quality, Deviations and Remaining Work — historical observations

probe600秒、aube browser840秒、pitchfork Node120秒/browser600秒、1worker/retries0、固定24/80%、wasm1GBを維持。実際の測定/入力不足を成功へ変更しない。

2026-10-08時点では旧coreのaube timeout、probe/aube browser、最新版terrarium入口が未完だった。現在のcoreでのNode/3browser成功とU3現在候補の成功は上の現行欄に示す。旧失敗の原因が恒久的に解消したとの結論は今回の成功だけから導かない。遠隔CI、source/history/native依存の完全確認、Trusted Publisher実設定、公開済みRC受入れ、stable差分・操作承認は未検証のまま公開をblockedに保つ。

## Sources

承認済みU4 plan/instructions、main-verification.md、pitchfork-v2301-verification.md、verificationの実command/log/SHA、.artifacts/u4-coverage-v1/report.json。旧U3 pitchfork v2.30.0結果とroot PoC v2.30.1結果は別版/別入口のまま保持する。PR/push/npm publish/GitHub Releaseは本作業で行っていない。
