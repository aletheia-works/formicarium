## 公開候補のfresh検証 — 2026-10-10

検証済み：exact公開tarball SHA8334d7f14c31109e5be3ec90147aa02105d8d839c4c79eccc1c25cb88eabbb3aでNode115/115、ブラウザ123/123（11.6m）、terrarium Node30/30・ブラウザ45/45（1.3m）が成功。固定24ファイル1450/1801行=80.51%、skip0、fresh receipt46、全必須realmとtarball bindingを製品validatorで確認。generation 99dd50bd-b39e-4000-bf38-49d1f1f17d80。24 packed filesのSHAと23非manifest不変、機密パターン検出0も照合した。

初回はU1 reportフォルダ名の必須形式、次にTERRARIUM_BUN未指定で測定scaffoldが停止。元の成功試験・失敗ログを保持し、同一report bytesを正規保存名へ複製、明示Bunを設定して未実行のbrowserだけ実行した。製品source・閾値・候補を変更せず2回のin-stage fixで完了。原commands.jsonには設定拒否も残す。全コマンド初回成功とは主張しない。

現source12a92eabの実CIと、公開candidate固有のfreshローカルcoverageを別証拠として結合する。CIが公開candidateをインストールしたとは主張しない。npm初回登録・Trusted Publisher実設定・実OIDC・公開RC導入・Release/stableは未検証。Build and Test全体を成功にしない。

## Target Verification Matrix — Current

| Target ID | Source | Expected | Actual | Evidence | Owning Stage | Verdict |
|---|---|---|---|---|---|---|
| NFR1.1 | aidlc/spaces/default/intents/261006-npm-terrarium-release/construction/u1-runtime-package/nfr-requirements/security-requirements.md | Node>=24とChromium/Firefox/WebKitの空consumerで公開import、Worker、同梱資産、guest実行を確認する。Node builtinをbrowser/sharedに要求しない | 公開tarballのfresh Node115/3browser123成功、現source実CI回帰成功。実機Safariは未検証 | verification/public-candidate-coverage-v1/result.json; verification/publication-boundary-v1/remote-reconciliation.json | Build and Test | Met |
| NFR1.2 | aidlc/spaces/default/intents/261006-npm-terrarium-release/construction/u1-runtime-package/nfr-requirements/security-requirements.md | browserの必須隔離/SharedArrayBuffer等がない場合UNSUPPORTED_ENV、資産不足ASSET_LOAD、factory失敗CORE_INIT。guest未開始を確認する。実機Safariは未検証を維持 | 公開tarballのfresh Node115/3browser123成功、現source実CI回帰成功。実機Safariは未検証 | verification/public-candidate-coverage-v1/result.json; verification/publication-boundary-v1/remote-reconciliation.json | Build and Test | Met |
| NFR2.1 | aidlc/spaces/default/intents/261006-npm-terrarium-release/construction/u1-runtime-package/nfr-requirements/security-requirements.md | wasmメモリ上限1GB、既存probe600秒/aube browser840秒/pitchfork browser600秒・Node120秒、1worker/retryなしを維持する。runの既定600000msはC1どおり、aubeには840000msを明示する | 公開tarballのfresh Node115/3browser123成功、現source実CI回帰成功。実機Safariは未検証 | verification/public-candidate-coverage-v1/result.json; verification/publication-boundary-v1/remote-reconciliation.json | Build and Test | Met |
| NFR2.2 | aidlc/spaces/default/intents/261006-npm-terrarium-release/construction/u1-runtime-package/nfr-requirements/security-requirements.md | deadlineは受付からasset/core/guest/snapshotまで。current message採用時にも期限とsignalを判定し、CPU-bound中止はhost terminateで行う。新しいlatency SLOを追加しない | 公開tarballのfresh Node115/3browser123成功、現source実CI回帰成功。実機Safariは未検証 | verification/public-candidate-coverage-v1/result.json; verification/publication-boundary-v1/remote-reconciliation.json | Build and Test | Met |
| NFR3.1 | aidlc/spaces/default/intents/261006-npm-terrarium-release/construction/u1-runtime-package/nfr-requirements/security-requirements.md | 固定された第一者配布JS13ファイルを全件分母に含め行coverage>=80%。Node/Worker/browserで同一source lineのunionを集約する。未importは0、realm収集欠落は失敗/未検証 | 公開tarball8334d7f1…のfresh固定24測定1450/1801=80.51%、46収集記録、Node115/browser123/terrarium Node30/browser45成功。現source12a92eab実CIも成功。CIはprivate v9で、23非manifest bytes一致を明示 | verification/public-candidate-coverage-v1/result.json; verification/publication-boundary-v1/remote-reconciliation.json | Build and Test | Met |
| NFR4.1 | aidlc/spaces/default/intents/261006-npm-terrarium-release/construction/u1-runtime-package/nfr-requirements/security-requirements.md | ELF/input/path/type/mode/inode/envを受付時検証してcopyする。root外、..、NUL、中間symlink、親file/symlink、HOME不一致を全体拒否。初期親自動0755と明示modeを両立する | 公開tarballのfresh Node115/3browser123成功、現source実CI回帰成功。実機Safariは未検証 | verification/public-candidate-coverage-v1/result.json; verification/publication-boundary-v1/remote-reconciliation.json | Build and Test | Met |
| NFR4.2 | aidlc/spaces/default/intents/261006-npm-terrarium-release/construction/u1-runtime-package/nfr-requirements/security-requirements.md | host FSをmountしない。通常のguestからhost network/FSへ権限を与えず、guest network非対応を維持する。daemonは有限runとしてtimeout/終了する。Worker自体を悪意ある任意JSに対するOS sandboxと主張しない | 公開tarballのfresh Node115/3browser123成功、現source実CI回帰成功。実機Safariは未検証 | verification/public-candidate-coverage-v1/result.json; verification/publication-boundary-v1/remote-reconciliation.json | Build and Test | Met |
| NFR4.3 | aidlc/spaces/default/intents/261006-npm-terrarium-release/construction/u1-runtime-package/nfr-requirements/security-requirements.md | session別state/Worker/bytesを非共有とし、run世代/version/形状/sequenceを検査する。古い通知は不採用、current不正通知はEXECUTIONでrollback | 公開tarballのfresh Node115/3browser123成功、現source実CI回帰成功。実機Safariは未検証 | verification/public-candidate-coverage-v1/result.json; verification/publication-boundary-v1/remote-reconciliation.json | Build and Test | Met |
| NFR4.4 | aidlc/spaces/default/intents/261006-npm-terrarium-release/construction/u1-runtime-package/nfr-requirements/security-requirements.md | seed/current/返却bytesとsnapshotは独立コピー。root内リンクとmode/削除を保持し、異常snapshot・特殊fileはSNAPSHOTで全体rollbackする。失敗時の部分stateを次runへ渡さない | 公開tarballのfresh Node115/3browser123成功、現source実CI回帰成功。実機Safariは未検証 | verification/public-candidate-coverage-v1/result.json; verification/publication-boundary-v1/remote-reconciliation.json | Build and Test | Met |
| NFR5.1 | aidlc/spaces/default/intents/261006-npm-terrarium-release/construction/u1-runtime-package/nfr-requirements/security-requirements.md | loader/wasm/build-infoを同一ビルドとし、blink.lock sourceCommitとdirty=false、各digest、LICENSE/notices、型をpack候補に含め照合する。guest/fixture/private記録を除外する | 公開tarballのfresh Node115/3browser123成功、現source実CI回帰成功。実機Safariは未検証 | verification/public-candidate-coverage-v1/result.json; verification/publication-boundary-v1/remote-reconciliation.json | Build and Test | Met |
| NFR6.1 | aidlc/spaces/default/intents/261006-npm-terrarium-release/construction/u1-runtime-package/nfr-requirements/security-requirements.md | コア固有のfactory/argv/locateFile/補助資産/FS参照知識はruntime/core.mjsに閉じる。guest登録表を製品実行の条件にしない | 公開tarballのfresh Node115/3browser123成功、現source実CI回帰成功。実機Safariは未検証 | verification/public-candidate-coverage-v1/result.json; verification/publication-boundary-v1/remote-reconciliation.json | Build and Test | Met |
| NFR6.2 | aidlc/spaces/default/intents/261006-npm-terrarium-release/construction/u1-runtime-package/nfr-requirements/security-requirements.md | browser Workerはcoreロード前にdelete Atomics.waitAsyncを実行する。3browser試験で維持を確認しWebKitを除外しない | 公開tarballのfresh Node115/3browser123成功、現source実CI回帰成功。実機Safariは未検証 | verification/public-candidate-coverage-v1/result.json; verification/publication-boundary-v1/remote-reconciliation.json | Build and Test | Met |
| NFR7.1 | aidlc/spaces/default/intents/261006-npm-terrarium-release/construction/u1-runtime-package/nfr-requirements/security-requirements.md | stdout/stderr bytes、正常非0exit、INVALID_INPUT/ASSET_LOAD/CORE_INIT/EXECUTION/SNAPSHOT/TIMEOUT/ABORTEDを区別しPromiseを一度だけsettleする。callback throwはEXECUTION、partial bytesはhost受信済み範囲 | 公開tarballのfresh Node115/3browser123成功、現source実CI回帰成功。実機Safariは未検証 | verification/public-candidate-coverage-v1/result.json; verification/publication-boundary-v1/remote-reconciliation.json | Build and Test | Met |
| NFR7.2 | aidlc/spaces/default/intents/261006-npm-terrarium-release/construction/u1-runtime-package/nfr-requirements/security-requirements.md | env/input値、任意cause stack、秘密入りoutputを診断/public証拠へ無条件転記しない。公開fixtureは秘密なし。error protocolは安全なcode/messageと受信bytesだけ | 公開tarballのfresh Node115/3browser123成功、現source実CI回帰成功。実機Safariは未検証 | verification/public-candidate-coverage-v1/result.json; verification/publication-boundary-v1/remote-reconciliation.json | Build and Test | Met |
| NFR7.3 | aidlc/spaces/default/intents/261006-npm-terrarium-release/construction/u1-runtime-package/nfr-requirements/security-requirements.md | 正常doneは候補snapshotとして保持し、Worker終了確認後にcommit・予約解除・結果settleする。終了確認不能時は候補をcommitせずEXECUTIONでrejectしsessionをdisposedへ移す。以後の操作DISPOSED、disposeは冪等 | 公開tarballのfresh Node115/3browser123成功、現source実CI回帰成功。実機Safariは未検証 | verification/public-candidate-coverage-v1/result.json; verification/publication-boundary-v1/remote-reconciliation.json | Build and Test | Met |
| NFR7.4 | aidlc/spaces/default/intents/261006-npm-terrarium-release/construction/u1-runtime-package/nfr-requirements/security-requirements.md | 通常timeout/abortはWorker終了確認できた場合前stateを保持して再実行可能。終了確認不能の場合だけNFR7.3を優先し、既存のTIMEOUT/ABORTED情報はsafe causeに保持する。dispose要求ではstateを破棄し再利用しない | 公開tarballのfresh Node115/3browser123成功、現source実CI回帰成功。実機Safariは未検証 | verification/public-candidate-coverage-v1/result.json; verification/publication-boundary-v1/remote-reconciliation.json | Build and Test | Met |
| u1-runtime-package-testing | aidlc/spaces/default/intents/261006-npm-terrarium-release/construction/u1-runtime-package/code-generation/code-generation-plan.md#Testing Contract | test-after、standard、component5–8、既存suite green、全配布JS80%以上、統合前CI | 公開tarball8334d7f1…のfresh固定24測定1450/1801=80.51%、46収集記録、Node115/browser123/terrarium Node30/browser45成功。現source12a92eab実CIも成功。CIはprivate v9で、23非manifest bytes一致を明示 | verification/public-candidate-coverage-v1/result.json; verification/publication-boundary-v1/remote-reconciliation.json | Build and Test | Met |
| u2-guest-distribution-testing | aidlc/spaces/default/intents/261006-npm-terrarium-release/construction/u2-guest-distribution/code-generation/code-generation-plan.md#Testing Contract | test-after、standard、component5–8、既存suite green、全配布JS80%以上、統合前CI | 公開tarball8334d7f1…のfresh固定24測定1450/1801=80.51%、46収集記録、Node115/browser123/terrarium Node30/browser45成功。現source12a92eab実CIも成功。CIはprivate v9で、23非manifest bytes一致を明示 | verification/public-candidate-coverage-v1/result.json; verification/publication-boundary-v1/remote-reconciliation.json | Build and Test | Met |
| u3-terrarium-integration-testing | aidlc/spaces/default/intents/261006-npm-terrarium-release/construction/u3-terrarium-integration/code-generation/code-generation-plan.md#Testing Contract | test-after、standard、component5–8、既存suite green、全配布JS80%以上、統合前CI | 公開tarball8334d7f1…のfresh固定24測定1450/1801=80.51%、46収集記録、Node115/browser123/terrarium Node30/browser45成功。現source12a92eab実CIも成功。CIはprivate v9で、23非manifest bytes一致を明示 | verification/public-candidate-coverage-v1/result.json; verification/publication-boundary-v1/remote-reconciliation.json | Build and Test | Met |
| u4-release-assurance-testing | aidlc/spaces/default/intents/261006-npm-terrarium-release/construction/u4-release-assurance/code-generation/code-generation-plan.md#Testing Contract | test-after、standard、component5–8、既存suite green、全配布JS80%以上、統合前CI | 公開tarball8334d7f1…のfresh固定24測定1450/1801=80.51%、46収集記録、Node115/browser123/terrarium Node30/browser45成功。現source12a92eab実CIも成功。CIはprivate v9で、23非manifest bytes一致を明示 | verification/public-candidate-coverage-v1/result.json; verification/publication-boundary-v1/remote-reconciliation.json | Build and Test | Met |
| NFR1 | aidlc/spaces/default/intents/261006-npm-terrarium-release/inception/requirements-analysis/requirements.md | Node>=24、Chromium・Firefox・WebKitでFR1–FR7の対象検証が通る。iframeの成功/未対応の必須判定はFR5.4の表に従い、Firefox/WebKitのcredentialless外部originケースを成功必須とは扱わない。実機macOS Safariは未検証を明記し初回stableの必須条件にしない。未対応環境では原因を示す | 公開tarballのNode115・3browser123・terrarium30/45成功。公開済みRCのregistry integrity/実terrarium導入はまだ実行していない | verification/public-candidate-coverage-v1/result.json | Build and Test | Unverified |
| NFR2 | aidlc/spaces/default/intents/261006-npm-terrarium-release/inception/requirements-analysis/requirements.md | probe1回600秒、aube-1645ブラウザ840秒、1worker、retryなし、probe8項目全通過、native出力一致、wasmメモリ上限1GBを維持。pitchforkは既存600秒browser/120秒Nodeを基準に対象テストで確認する。負荷下の計測で性能を断定しない | 現source12a92eab実CIの原ログとSHAを照合。既存Node54/browser36/native2成功、runtime/core/guest不変 | verification/publication-boundary-v1/remote-reconciliation.json; verification/publication-boundary-v1/raw-log-validation.md | Build and Test | Met |
| NFR3 | aidlc/spaces/default/intents/261006-npm-terrarium-release/inception/requirements-analysis/requirements.md | 第一者の配布JS全体を固定一覧で80%以上の行coverage。未実行/未収集ファイルを除外して達成しない。Node/Worker/browser計測を収集し欠落を検出、統合前CIで必須検証を実行 | 公開tarball8334d7f1…のfresh固定24測定1450/1801=80.51%、46収集記録、Node115/browser123/terrarium Node30/browser45成功。現source12a92eab実CIも成功。CIはprivate v9で、23非manifest bytes一致を明示 | verification/public-candidate-coverage-v1/result.json; verification/publication-boundary-v1/remote-reconciliation.json | Build and Test | Met |
| NFR4 | aidlc/spaces/default/intents/261006-npm-terrarium-release/inception/requirements-analysis/requirements.md | ゲストネットワーク・デーモンを許可せず、iframeorigin制限、入力/path検証、端末間状態分離を回帰検証。資産取得のhost通信とゲストnetworkを区別 | 現source12a92eab実CIの原ログとSHAを照合。既存Node54/browser36/native2成功、runtime/core/guest不変 | verification/publication-boundary-v1/remote-reconciliation.json; verification/publication-boundary-v1/raw-log-validation.md | Build and Test | Met |
| NFR5 | aidlc/spaces/default/intents/261006-npm-terrarium-release/inception/requirements-analysis/requirements.md | loader/wasm/build-info/noticesの出所と整合を確認。コア取得元commitとdirty=false、guestrefを追跡可能。公開候補の機密・依存・ライセンス確認結果を記録し、未確認を安全確認済みとしない | exact公開tarball24 files SHA一致、機密パターン検出0、23非manifest bytes不変。core/guest/licenseの旧監査を同一bytesで採用。全履歴の安全認定ではない | verification/public-candidate-coverage-v1/public-tarball-audit.json; verification/public-validation-v1/licenses.json | Build and Test | Met |
| NFR6 | aidlc/spaces/default/intents/261006-npm-terrarium-release/inception/requirements-analysis/requirements.md | コア固有知識はruntime/core.mjsの境界へ保持。browser Workerのdelete Atomics.waitAsyncを維持。ゲストを変えるために公開JS実装を変更しなくてよい | 現source12a92eab実CIの原ログとSHAを照合。既存Node54/browser36/native2成功、runtime/core/guest不変 | verification/publication-boundary-v1/remote-reconciliation.json; verification/publication-boundary-v1/raw-log-validation.md | Build and Test | Met |
| NFR7 | aidlc/spaces/default/intents/261006-npm-terrarium-release/inception/requirements-analysis/requirements.md | 実行成功/失敗/timeout/中止を識別でき、stdout/stderr/終了コードとビルド・版情報を受入れ記録へ保存できる。機密値をログへ残さず、未検証を明示 | 現source12a92eab実CIの原ログとSHAを照合。既存Node54/browser36/native2成功、runtime/core/guest不変 | verification/publication-boundary-v1/remote-reconciliation.json; verification/publication-boundary-v1/raw-log-validation.md | Build and Test | Met |

## 実CI検証 — Loop-back 4

検証済み：承認された検証forkへの署名付きpush、CI入力URL/SHAの更新、実CI run [38040455333](https://github.com/Marukome0743/formicarium/actions/runs/38040455333) は初回成功。source 12a92eabf70f6772f11e33f698e3db5088992270 と入力commit 07be6a465d175c4c7267ac6a861b4dad80517176 の署名Verifiedを読み戻した。ZIP SHA256 13fb06bdabb47f3a19a32824764ec1d2dfc0b98c4a8128a134a7eab0f7ae4933一致、原1611ファイルを保存。境界74/74、9必須checkすべてexit0・timeoutなし・skip0（438件とnative2件。境界74件と一部重複するため合算しない）。固定24ファイル1450/1801行=80.51%、46収集記録のgeneration/source/site/execution identity一致、必須realm構成と同一tarball bindingを製品validatorで確認。証拠: verification/publication-boundary-v1/remote-reconciliation.json。

この遠隔coverageはprivate v9 tarball dfcc3e63…の測定。report.candidateSha256はsite identityでありnpm archive SHAではない。公開candidate8334d7f1…のfreshローカル測定を別途実行中。公開先aletheia-worksへのpush、npm操作、Releaseは今回の承認に含まれず実施していない。以下の旧判定・旧実行記録は履歴であり、本節の実CI成功より前の観測を含む。

## Current Verification — Loop-back 4, 2026-10-10

検証済み：承認済みStep31–35の修正を正式build/emit後にmainで実行し、公開CLI・publication・workflow・release・CIの7ファイル74/74件成功、fail/cancel/skip0、21630.481125ms。実npm/ghは起動せず偽executorのみ。境界の改変・RC回帰欠落/failed/timeout・coverage欠落/80%未満を拒否し、不成立時の公開処理起動0回を確認。原観測は `../u4-release-assurance/code-generation/verification/publication-boundary-v1/main-results.md`。

独立レビュー `../u4-release-assurance/code-generation/reviews/review-09.md` はREADY、新規所見なし、R-05/R-06/R-07はFixed。native sensorsは4対象全pass・指摘0。正式UNIT_STARTED/UNIT_COMPLETEDは今回は通常CLIでexit0。承認済みprivate v9実パッケージcheckpointはNode21/21とChromium/Firefox/WebKit各1、計3/3成功、exit0。proof c742a40a-6730-4d5c-8f33-b1393443e816、fingerprint sha256:7f13f699996f07ebf80856804fe19cd6d526d92f582c35880a3bdc447546cc0b、verified/approved=true。この旧候補checkpointを公開candidateのfresh coverageへ転用しない。

CI用のローカルsourceはSSH署名後の 12a92eabf70f6772f11e33f698e3db5088992270（署名前c68024cdd6a826a562d6388a4a551a31948f62e2）。今回の境界74件をCIでも実行しログを保存する検証workflowを準備。既存private v9の1373ファイル回帰/coverage payloadは維持する。新公開candidate SHA8334d7f14c31109e5be3ec90147aa02105d8d839c4c79eccc1c25cb88eabbb3aのfresh coverage/CI、実OIDC・Trusted Publisher設定・公開RC・実terrarium RC導入は未検証。外部操作承認はStep31–35のPlan Approvalに含まれない。

## 現在の検証結果 — U4完了記録の再試行後

検証済み：承認された隔離修正版でUNIT_STARTED/UNIT_COMPLETEDがexit0。既存承認コマンドによるNode21/21、Chromium/Firefox/WebKit各1件、計3/3成功。checkpoint verified=true/approved=true、Build and Testへ移行。既存インストール・設定・公開先を変更していない。

新公開candidate SHA8334d7f14c31109e5be3ec90147aa02105d8d839c4c79eccc1c25cb88eabbb3aはNode11/11・browser33/33・strict型成功、24file SHA一致、23非manifest file不変。publication/workflow/release/CIの64件成功、最終wrapper変更後publication8件成功。原観測はverification/publication-v1/main-results.md。旧v9のcheckpoint成功を新candidateのcoverage/CIへ転用しない。

## Historical Target Verification Matrix

| Target ID | Source | Expected | Actual | Evidence | Owning Stage | Verdict |
|---|---|---|---|---|---|---|
| NFR1.1 | aidlc/spaces/default/intents/261006-npm-terrarium-release/construction/u1-runtime-package/nfr-requirements/security-requirements.md | Node>=24とChromium/Firefox/WebKitの空consumerで公開import、Worker、同梱資産、guest実行を確認する。Node builtinをbrowser/sharedに要求しない | 現source/candidateと保存試験を再照合、ローカル回帰成功 | verification/resume-20261010-v2/results.json | Build and Test | Met |
| NFR1.2 | aidlc/spaces/default/intents/261006-npm-terrarium-release/construction/u1-runtime-package/nfr-requirements/security-requirements.md | browserの必須隔離/SharedArrayBuffer等がない場合UNSUPPORTED_ENV、資産不足ASSET_LOAD、factory失敗CORE_INIT。guest未開始を確認する。実機Safariは未検証を維持 | 現source/candidateと保存試験を再照合、ローカル回帰成功 | verification/resume-20261010-v2/results.json | Build and Test | Met |
| NFR2.1 | aidlc/spaces/default/intents/261006-npm-terrarium-release/construction/u1-runtime-package/nfr-requirements/security-requirements.md | wasmメモリ上限1GB、既存probe600秒/aube browser840秒/pitchfork browser600秒・Node120秒、1worker/retryなしを維持する。runの既定600000msはC1どおり、aubeには840000msを明示する | 現source/candidateと保存試験を再照合、ローカル回帰成功 | verification/resume-20261010-v2/results.json | Build and Test | Met |
| NFR2.2 | aidlc/spaces/default/intents/261006-npm-terrarium-release/construction/u1-runtime-package/nfr-requirements/security-requirements.md | deadlineは受付からasset/core/guest/snapshotまで。current message採用時にも期限とsignalを判定し、CPU-bound中止はhost terminateで行う。新しいlatency SLOを追加しない | 現source/candidateと保存試験を再照合、ローカル回帰成功 | verification/resume-20261010-v2/results.json | Build and Test | Met |
| NFR3.1 | aidlc/spaces/default/intents/261006-npm-terrarium-release/construction/u1-runtime-package/nfr-requirements/security-requirements.md | 固定された第一者配布JS13ファイルを全件分母に含め行coverage>=80%。Node/Worker/browserで同一source lineのunionを集約する。未importは0、realm収集欠落は失敗/未検証 | 旧source70b345c3の80.51%は保存済み。新公開source7fac2756・candidate8334d7f1のfresh CI/固定24coverageは未検証 | verification/publication-v1/main-results.md; verification/publication-v1/prepared-ci-source.json | Build and Test | Unverified |
| NFR4.1 | aidlc/spaces/default/intents/261006-npm-terrarium-release/construction/u1-runtime-package/nfr-requirements/security-requirements.md | ELF/input/path/type/mode/inode/envを受付時検証してcopyする。root外、..、NUL、中間symlink、親file/symlink、HOME不一致を全体拒否。初期親自動0755と明示modeを両立する | 現source/candidateと保存試験を再照合、ローカル回帰成功 | verification/resume-20261010-v2/results.json | Build and Test | Met |
| NFR4.2 | aidlc/spaces/default/intents/261006-npm-terrarium-release/construction/u1-runtime-package/nfr-requirements/security-requirements.md | host FSをmountしない。通常のguestからhost network/FSへ権限を与えず、guest network非対応を維持する。daemonは有限runとしてtimeout/終了する。Worker自体を悪意ある任意JSに対するOS sandboxと主張しない | 現source/candidateと保存試験を再照合、ローカル回帰成功 | verification/resume-20261010-v2/results.json | Build and Test | Met |
| NFR4.3 | aidlc/spaces/default/intents/261006-npm-terrarium-release/construction/u1-runtime-package/nfr-requirements/security-requirements.md | session別state/Worker/bytesを非共有とし、run世代/version/形状/sequenceを検査する。古い通知は不採用、current不正通知はEXECUTIONでrollback | 現source/candidateと保存試験を再照合、ローカル回帰成功 | verification/resume-20261010-v2/results.json | Build and Test | Met |
| NFR4.4 | aidlc/spaces/default/intents/261006-npm-terrarium-release/construction/u1-runtime-package/nfr-requirements/security-requirements.md | seed/current/返却bytesとsnapshotは独立コピー。root内リンクとmode/削除を保持し、異常snapshot・特殊fileはSNAPSHOTで全体rollbackする。失敗時の部分stateを次runへ渡さない | 現source/candidateと保存試験を再照合、ローカル回帰成功 | verification/resume-20261010-v2/results.json | Build and Test | Met |
| NFR5.1 | aidlc/spaces/default/intents/261006-npm-terrarium-release/construction/u1-runtime-package/nfr-requirements/security-requirements.md | loader/wasm/build-infoを同一ビルドとし、blink.lock sourceCommitとdirty=false、各digest、LICENSE/notices、型をpack候補に含め照合する。guest/fixture/private記録を除外する | 現source/candidateと保存試験を再照合、ローカル回帰成功 | verification/resume-20261010-v2/results.json | Build and Test | Met |
| NFR6.1 | aidlc/spaces/default/intents/261006-npm-terrarium-release/construction/u1-runtime-package/nfr-requirements/security-requirements.md | コア固有のfactory/argv/locateFile/補助資産/FS参照知識はruntime/core.mjsに閉じる。guest登録表を製品実行の条件にしない | 現source/candidateと保存試験を再照合、ローカル回帰成功 | verification/resume-20261010-v2/results.json | Build and Test | Met |
| NFR6.2 | aidlc/spaces/default/intents/261006-npm-terrarium-release/construction/u1-runtime-package/nfr-requirements/security-requirements.md | browser Workerはcoreロード前にdelete Atomics.waitAsyncを実行する。3browser試験で維持を確認しWebKitを除外しない | 現source/candidateと保存試験を再照合、ローカル回帰成功 | verification/resume-20261010-v2/results.json | Build and Test | Met |
| NFR7.1 | aidlc/spaces/default/intents/261006-npm-terrarium-release/construction/u1-runtime-package/nfr-requirements/security-requirements.md | stdout/stderr bytes、正常非0exit、INVALID_INPUT/ASSET_LOAD/CORE_INIT/EXECUTION/SNAPSHOT/TIMEOUT/ABORTEDを区別しPromiseを一度だけsettleする。callback throwはEXECUTION、partial bytesはhost受信済み範囲 | 現source/candidateと保存試験を再照合、ローカル回帰成功 | verification/resume-20261010-v2/results.json | Build and Test | Met |
| NFR7.2 | aidlc/spaces/default/intents/261006-npm-terrarium-release/construction/u1-runtime-package/nfr-requirements/security-requirements.md | env/input値、任意cause stack、秘密入りoutputを診断/public証拠へ無条件転記しない。公開fixtureは秘密なし。error protocolは安全なcode/messageと受信bytesだけ | 現source/candidateと保存試験を再照合、ローカル回帰成功 | verification/resume-20261010-v2/results.json | Build and Test | Met |
| NFR7.3 | aidlc/spaces/default/intents/261006-npm-terrarium-release/construction/u1-runtime-package/nfr-requirements/security-requirements.md | 正常doneは候補snapshotとして保持し、Worker終了確認後にcommit・予約解除・結果settleする。終了確認不能時は候補をcommitせずEXECUTIONでrejectしsessionをdisposedへ移す。以後の操作DISPOSED、disposeは冪等 | 現source/candidateと保存試験を再照合、ローカル回帰成功 | verification/resume-20261010-v2/results.json | Build and Test | Met |
| NFR7.4 | aidlc/spaces/default/intents/261006-npm-terrarium-release/construction/u1-runtime-package/nfr-requirements/security-requirements.md | 通常timeout/abortはWorker終了確認できた場合前stateを保持して再実行可能。終了確認不能の場合だけNFR7.3を優先し、既存のTIMEOUT/ABORTED情報はsafe causeに保持する。dispose要求ではstateを破棄し再利用しない | 現source/candidateと保存試験を再照合、ローカル回帰成功 | verification/resume-20261010-v2/results.json | Build and Test | Met |
| u1-runtime-package-testing | aidlc/spaces/default/intents/261006-npm-terrarium-release/construction/u1-runtime-package/code-generation/code-generation-plan.md#Testing Contract | test-after、standard、component5–8、既存suite green、全配布JS80%以上、統合前CI | 旧source70b345c3の80.51%は保存済み。新公開source7fac2756・candidate8334d7f1のfresh CI/固定24coverageは未検証 | verification/publication-v1/main-results.md; verification/publication-v1/prepared-ci-source.json | Build and Test | Unverified |
| u2-guest-distribution-testing | aidlc/spaces/default/intents/261006-npm-terrarium-release/construction/u2-guest-distribution/code-generation/code-generation-plan.md#Testing Contract | test-after、standard、component5–8、既存suite green、全配布JS80%以上、統合前CI | 旧source70b345c3の80.51%は保存済み。新公開source7fac2756・candidate8334d7f1のfresh CI/固定24coverageは未検証 | verification/publication-v1/main-results.md; verification/publication-v1/prepared-ci-source.json | Build and Test | Unverified |
| u3-terrarium-integration-testing | aidlc/spaces/default/intents/261006-npm-terrarium-release/construction/u3-terrarium-integration/code-generation/code-generation-plan.md#Testing Contract | test-after、standard、component5–8、既存suite green、全配布JS80%以上、統合前CI | 旧source70b345c3の80.51%は保存済み。新公開source7fac2756・candidate8334d7f1のfresh CI/固定24coverageは未検証 | verification/publication-v1/main-results.md; verification/publication-v1/prepared-ci-source.json | Build and Test | Unverified |
| u4-release-assurance-testing | aidlc/spaces/default/intents/261006-npm-terrarium-release/construction/u4-release-assurance/code-generation/code-generation-plan.md#Testing Contract | test-after、standard、component5–8、既存suite green、全配布JS80%以上、統合前CI | 旧source70b345c3の80.51%は保存済み。新公開source7fac2756・candidate8334d7f1のfresh CI/固定24coverageは未検証 | verification/publication-v1/main-results.md; verification/publication-v1/prepared-ci-source.json | Build and Test | Unverified |
| NFR1 | aidlc/spaces/default/intents/261006-npm-terrarium-release/inception/requirements-analysis/requirements.md | Node>=24、Chromium・Firefox・WebKitでFR1–FR7の対象検証が通る。iframeの成功/未対応の必須判定はFR5.4の表に従い、Firefox/WebKitのcredentialless外部originケースを成功必須とは扱わない。実機macOS Safariは未検証を明記し初回stableの必須条件にしない。未対応環境では原因を示す | Node/Chromium/Firefox/WebKit対象試験は原証拠再照合成功。FR7.3の公開済みRC実導入は独立した残条件 | verification/hooks-disabled-resume-v1/remote-reconciliation.json; verification/public-validation-v1/preflight.json | Build and Test | Unverified |
| NFR2 | aidlc/spaces/default/intents/261006-npm-terrarium-release/inception/requirements-analysis/requirements.md | probe1回600秒、aube-1645ブラウザ840秒、1worker、retryなし、probe8項目全通過、native出力一致、wasmメモリ上限1GBを維持。pitchforkは既存600秒browser/120秒Nodeを基準に対象テストで確認する。負荷下の計測で性能を断定しない | 保存同一runtime/core/guestの遠隔回帰と原1610file/ZIP SHAを再照合 | verification/resume-20261010-v2/remote-ci-reconciliation.json | Build and Test | Met |
| NFR3 | aidlc/spaces/default/intents/261006-npm-terrarium-release/inception/requirements-analysis/requirements.md | 第一者の配布JS全体を固定一覧で80%以上の行coverage。未実行/未収集ファイルを除外して達成しない。Node/Worker/browser計測を収集し欠落を検出、統合前CIで必須検証を実行 | 旧source70b345c3の80.51%は保存済み。新公開source7fac2756・candidate8334d7f1のfresh CI/固定24coverageは未検証 | verification/publication-v1/main-results.md; verification/publication-v1/prepared-ci-source.json | Build and Test | Unverified |
| NFR4 | aidlc/spaces/default/intents/261006-npm-terrarium-release/inception/requirements-analysis/requirements.md | ゲストネットワーク・デーモンを許可せず、iframeorigin制限、入力/path検証、端末間状態分離を回帰検証。資産取得のhost通信とゲストnetworkを区別 | 保存同一runtime/core/guestの遠隔回帰と原1610file/ZIP SHAを再照合 | verification/resume-20261010-v2/remote-ci-reconciliation.json | Build and Test | Met |
| NFR5 | aidlc/spaces/default/intents/261006-npm-terrarium-release/inception/requirements-analysis/requirements.md | loader/wasm/build-info/noticesの出所と整合を確認。コア取得元commitとdirty=false、guestrefを追跡可能。公開候補の機密・依存・ライセンス確認結果を記録し、未確認を安全確認済みとしない | core commit/dirty=false・資産digest・guestref照合成功。候補24files/source164files/history24commits225blobsの機密パターン検出0、npm audit脆弱性0、84依存license宣言とblink/Emscripten/musl原文同梱を照合 | verification/public-validation-v1/preflight.json; verification/public-validation-v1/licenses.json | Build and Test | Met |
| NFR6 | aidlc/spaces/default/intents/261006-npm-terrarium-release/inception/requirements-analysis/requirements.md | コア固有知識はruntime/core.mjsの境界へ保持。browser Workerのdelete Atomics.waitAsyncを維持。ゲストを変えるために公開JS実装を変更しなくてよい | 保存同一runtime/core/guestの遠隔回帰と原1610file/ZIP SHAを再照合 | verification/resume-20261010-v2/remote-ci-reconciliation.json | Build and Test | Met |
| NFR7 | aidlc/spaces/default/intents/261006-npm-terrarium-release/inception/requirements-analysis/requirements.md | 実行成功/失敗/timeout/中止を識別でき、stdout/stderr/終了コードとビルド・版情報を受入れ記録へ保存できる。機密値をログへ残さず、未検証を明示 | 保存同一runtime/core/guestの遠隔回帰と原1610file/ZIP SHAを再照合 | verification/resume-20261010-v2/remote-ci-reconciliation.json | Build and Test | Met |

## Failure Diagnosis and Impact — Current

全体成功にはしない。検証済みの静的照合：publication/workflow試験はgatePublication/publicationCliを直接呼ばない（review-08 R-05）。公開直前のrequest/tgz/pack外source/core/contextの統合拒否、RC回帰欠落・failed・timeout、coverage欠落・80%未満、OIDC/config隔離・不成立時executor起動0回の直接試験がない。R-06のCLI例の引数とR-07の現source coverage対応も修正が必要。根因はU4 Code Generation。U1–U3は保持する。

具体修正：外部送信なしのCLI境界試験を追加し、必要ならexecutor注入の最小変更を行う。正常bundleと各改変を渡し、拒否時npm/gh起動0回、正常時exact tarball/dist-tag/隔離configを捕捉する。上記RC否定試験を追加しCLI例・traceabilityを訂正する。mainで正式tsc/emit・対象回帰を逐次実行し、U4の現attemptレビューを取得する。推測見積り：2–4時間、ローカル追加費用なし、Actions費用は契約依存で未検証。リスクは公開前検査の変更・旧証拠への誤対応で、外部送信を偽executorで止め、閾値・旧証拠を保持する。fresh CI/push/npm bootstrap/信頼設定/RC公開/terrarium実受入れは別の具体的外部承認が必要。

自動loop-backは3/3。4回目を自動実行せず人間のRetry with fixを待つ。失敗許容/Abortは未選択。旧Loop-Back Logと全履歴は以下に保持。

# Test Results

## 最新照合の最終判定 — 2026-10-10

検証済み：正式build3段階exit0、ローカルNode140件fail/skip0。最新CI job114136356761 successとhead70b345c39fa17840a093ea11b0cec748b0a25f2fをconnectorで読戻し、artifact11661230131原ZIPのSHA256 412e39a043b2c7710bd76c94c01b875f4617a8b7aa26eeeace410172074643dc一致、1610原files・9checkのstdout/stderr SHA、438試験/native2、fixed24/80.51%/46receiptを再照合。main source168pinも一致。証拠はverification/hooks-disabled-resume-v1/{local-results,results,current-source-binding,remote-reconciliation,cross-unit}.json。今回fresh遠隔実行ではなく成功attempt2の再照合である。

## Historical Target Verification Matrix

| Target ID | Source | Expected | Actual | Evidence | Owning Stage | Verdict |
|---|---|---|---|---|---|---|
| NFR1.1 | aidlc/spaces/default/intents/261006-npm-terrarium-release/construction/u1-runtime-package/nfr-requirements/security-requirements.md | Node>=24とChromium/Firefox/WebKitの空consumerで公開import、Worker、同梱資産、guest実行を確認する。Node builtinをbrowser/sharedに要求しない | 現source/candidateと保存試験を再照合、ローカル回帰成功 | verification/resume-20261010-v2/results.json | Build and Test | Met |
| NFR1.2 | aidlc/spaces/default/intents/261006-npm-terrarium-release/construction/u1-runtime-package/nfr-requirements/security-requirements.md | browserの必須隔離/SharedArrayBuffer等がない場合UNSUPPORTED_ENV、資産不足ASSET_LOAD、factory失敗CORE_INIT。guest未開始を確認する。実機Safariは未検証を維持 | 現source/candidateと保存試験を再照合、ローカル回帰成功 | verification/resume-20261010-v2/results.json | Build and Test | Met |
| NFR2.1 | aidlc/spaces/default/intents/261006-npm-terrarium-release/construction/u1-runtime-package/nfr-requirements/security-requirements.md | wasmメモリ上限1GB、既存probe600秒/aube browser840秒/pitchfork browser600秒・Node120秒、1worker/retryなしを維持する。runの既定600000msはC1どおり、aubeには840000msを明示する | 現source/candidateと保存試験を再照合、ローカル回帰成功 | verification/resume-20261010-v2/results.json | Build and Test | Met |
| NFR2.2 | aidlc/spaces/default/intents/261006-npm-terrarium-release/construction/u1-runtime-package/nfr-requirements/security-requirements.md | deadlineは受付からasset/core/guest/snapshotまで。current message採用時にも期限とsignalを判定し、CPU-bound中止はhost terminateで行う。新しいlatency SLOを追加しない | 現source/candidateと保存試験を再照合、ローカル回帰成功 | verification/resume-20261010-v2/results.json | Build and Test | Met |
| NFR3.1 | aidlc/spaces/default/intents/261006-npm-terrarium-release/construction/u1-runtime-package/nfr-requirements/security-requirements.md | 固定された第一者配布JS13ファイルを全件分母に含め行coverage>=80%。Node/Worker/browserで同一source lineのunionを集約する。未importは0、realm収集欠落は失敗/未検証 | 最新collectorを含むrun38024772634 attempt2の原証拠照合成功。438試験/native2、fixed24行1450/1801=80.51%、46receipt、source168pin一致 | verification/hooks-disabled-resume-v1/remote-reconciliation.json | Build and Test | Met |
| NFR4.1 | aidlc/spaces/default/intents/261006-npm-terrarium-release/construction/u1-runtime-package/nfr-requirements/security-requirements.md | ELF/input/path/type/mode/inode/envを受付時検証してcopyする。root外、..、NUL、中間symlink、親file/symlink、HOME不一致を全体拒否。初期親自動0755と明示modeを両立する | 現source/candidateと保存試験を再照合、ローカル回帰成功 | verification/resume-20261010-v2/results.json | Build and Test | Met |
| NFR4.2 | aidlc/spaces/default/intents/261006-npm-terrarium-release/construction/u1-runtime-package/nfr-requirements/security-requirements.md | host FSをmountしない。通常のguestからhost network/FSへ権限を与えず、guest network非対応を維持する。daemonは有限runとしてtimeout/終了する。Worker自体を悪意ある任意JSに対するOS sandboxと主張しない | 現source/candidateと保存試験を再照合、ローカル回帰成功 | verification/resume-20261010-v2/results.json | Build and Test | Met |
| NFR4.3 | aidlc/spaces/default/intents/261006-npm-terrarium-release/construction/u1-runtime-package/nfr-requirements/security-requirements.md | session別state/Worker/bytesを非共有とし、run世代/version/形状/sequenceを検査する。古い通知は不採用、current不正通知はEXECUTIONでrollback | 現source/candidateと保存試験を再照合、ローカル回帰成功 | verification/resume-20261010-v2/results.json | Build and Test | Met |
| NFR4.4 | aidlc/spaces/default/intents/261006-npm-terrarium-release/construction/u1-runtime-package/nfr-requirements/security-requirements.md | seed/current/返却bytesとsnapshotは独立コピー。root内リンクとmode/削除を保持し、異常snapshot・特殊fileはSNAPSHOTで全体rollbackする。失敗時の部分stateを次runへ渡さない | 現source/candidateと保存試験を再照合、ローカル回帰成功 | verification/resume-20261010-v2/results.json | Build and Test | Met |
| NFR5.1 | aidlc/spaces/default/intents/261006-npm-terrarium-release/construction/u1-runtime-package/nfr-requirements/security-requirements.md | loader/wasm/build-infoを同一ビルドとし、blink.lock sourceCommitとdirty=false、各digest、LICENSE/notices、型をpack候補に含め照合する。guest/fixture/private記録を除外する | 現source/candidateと保存試験を再照合、ローカル回帰成功 | verification/resume-20261010-v2/results.json | Build and Test | Met |
| NFR6.1 | aidlc/spaces/default/intents/261006-npm-terrarium-release/construction/u1-runtime-package/nfr-requirements/security-requirements.md | コア固有のfactory/argv/locateFile/補助資産/FS参照知識はruntime/core.mjsに閉じる。guest登録表を製品実行の条件にしない | 現source/candidateと保存試験を再照合、ローカル回帰成功 | verification/resume-20261010-v2/results.json | Build and Test | Met |
| NFR6.2 | aidlc/spaces/default/intents/261006-npm-terrarium-release/construction/u1-runtime-package/nfr-requirements/security-requirements.md | browser Workerはcoreロード前にdelete Atomics.waitAsyncを実行する。3browser試験で維持を確認しWebKitを除外しない | 現source/candidateと保存試験を再照合、ローカル回帰成功 | verification/resume-20261010-v2/results.json | Build and Test | Met |
| NFR7.1 | aidlc/spaces/default/intents/261006-npm-terrarium-release/construction/u1-runtime-package/nfr-requirements/security-requirements.md | stdout/stderr bytes、正常非0exit、INVALID_INPUT/ASSET_LOAD/CORE_INIT/EXECUTION/SNAPSHOT/TIMEOUT/ABORTEDを区別しPromiseを一度だけsettleする。callback throwはEXECUTION、partial bytesはhost受信済み範囲 | 現source/candidateと保存試験を再照合、ローカル回帰成功 | verification/resume-20261010-v2/results.json | Build and Test | Met |
| NFR7.2 | aidlc/spaces/default/intents/261006-npm-terrarium-release/construction/u1-runtime-package/nfr-requirements/security-requirements.md | env/input値、任意cause stack、秘密入りoutputを診断/public証拠へ無条件転記しない。公開fixtureは秘密なし。error protocolは安全なcode/messageと受信bytesだけ | 現source/candidateと保存試験を再照合、ローカル回帰成功 | verification/resume-20261010-v2/results.json | Build and Test | Met |
| NFR7.3 | aidlc/spaces/default/intents/261006-npm-terrarium-release/construction/u1-runtime-package/nfr-requirements/security-requirements.md | 正常doneは候補snapshotとして保持し、Worker終了確認後にcommit・予約解除・結果settleする。終了確認不能時は候補をcommitせずEXECUTIONでrejectしsessionをdisposedへ移す。以後の操作DISPOSED、disposeは冪等 | 現source/candidateと保存試験を再照合、ローカル回帰成功 | verification/resume-20261010-v2/results.json | Build and Test | Met |
| NFR7.4 | aidlc/spaces/default/intents/261006-npm-terrarium-release/construction/u1-runtime-package/nfr-requirements/security-requirements.md | 通常timeout/abortはWorker終了確認できた場合前stateを保持して再実行可能。終了確認不能の場合だけNFR7.3を優先し、既存のTIMEOUT/ABORTED情報はsafe causeに保持する。dispose要求ではstateを破棄し再利用しない | 現source/candidateと保存試験を再照合、ローカル回帰成功 | verification/resume-20261010-v2/results.json | Build and Test | Met |
| u1-runtime-package-testing | aidlc/spaces/default/intents/261006-npm-terrarium-release/construction/u1-runtime-package/code-generation/code-generation-plan.md#Testing Contract | test-after、standard、component5–8、既存suite green、全配布JS80%以上、統合前CI | 最新collectorを含むrun38024772634 attempt2の原証拠照合成功。438試験/native2、fixed24行1450/1801=80.51%、46receipt、source168pin一致 | verification/hooks-disabled-resume-v1/remote-reconciliation.json | Build and Test | Met |
| u2-guest-distribution-testing | aidlc/spaces/default/intents/261006-npm-terrarium-release/construction/u2-guest-distribution/code-generation/code-generation-plan.md#Testing Contract | test-after、standard、component5–8、既存suite green、全配布JS80%以上、統合前CI | 最新collectorを含むrun38024772634 attempt2の原証拠照合成功。438試験/native2、fixed24行1450/1801=80.51%、46receipt、source168pin一致 | verification/hooks-disabled-resume-v1/remote-reconciliation.json | Build and Test | Met |
| u3-terrarium-integration-testing | aidlc/spaces/default/intents/261006-npm-terrarium-release/construction/u3-terrarium-integration/code-generation/code-generation-plan.md#Testing Contract | test-after、standard、component5–8、既存suite green、全配布JS80%以上、統合前CI | 最新collectorを含むrun38024772634 attempt2の原証拠照合成功。438試験/native2、fixed24行1450/1801=80.51%、46receipt、source168pin一致 | verification/hooks-disabled-resume-v1/remote-reconciliation.json | Build and Test | Met |
| u4-release-assurance-testing | aidlc/spaces/default/intents/261006-npm-terrarium-release/construction/u4-release-assurance/code-generation/code-generation-plan.md#Testing Contract | test-after、standard、component5–8、既存suite green、全配布JS80%以上、統合前CI | 最新collectorを含むrun38024772634 attempt2の原証拠照合成功。438試験/native2、fixed24行1450/1801=80.51%、46receipt、source168pin一致 | verification/hooks-disabled-resume-v1/remote-reconciliation.json | Build and Test | Met |
| NFR1 | aidlc/spaces/default/intents/261006-npm-terrarium-release/inception/requirements-analysis/requirements.md | Node>=24、Chromium・Firefox・WebKitでFR1–FR7の対象検証が通る。iframeの成功/未対応の必須判定はFR5.4の表に従い、Firefox/WebKitのcredentialless外部originケースを成功必須とは扱わない。実機macOS Safariは未検証を明記し初回stableの必須条件にしない。未対応環境では原因を示す | Node/Chromium/Firefox/WebKit対象試験は原証拠再照合成功。FR7.3の公開済みRC実導入は独立した残条件 | verification/hooks-disabled-resume-v1/remote-reconciliation.json; verification/public-validation-v1/preflight.json | Build and Test | Unverified |
| NFR2 | aidlc/spaces/default/intents/261006-npm-terrarium-release/inception/requirements-analysis/requirements.md | probe1回600秒、aube-1645ブラウザ840秒、1worker、retryなし、probe8項目全通過、native出力一致、wasmメモリ上限1GBを維持。pitchforkは既存600秒browser/120秒Nodeを基準に対象テストで確認する。負荷下の計測で性能を断定しない | 保存同一runtime/core/guestの遠隔回帰と原1610file/ZIP SHAを再照合 | verification/resume-20261010-v2/remote-ci-reconciliation.json | Build and Test | Met |
| NFR3 | aidlc/spaces/default/intents/261006-npm-terrarium-release/inception/requirements-analysis/requirements.md | 第一者の配布JS全体を固定一覧で80%以上の行coverage。未実行/未収集ファイルを除外して達成しない。Node/Worker/browser計測を収集し欠落を検出、統合前CIで必須検証を実行 | 最新collectorを含むrun38024772634 attempt2の原証拠照合成功。438試験/native2、fixed24行1450/1801=80.51%、46receipt、source168pin一致 | verification/hooks-disabled-resume-v1/remote-reconciliation.json | Build and Test | Met |
| NFR4 | aidlc/spaces/default/intents/261006-npm-terrarium-release/inception/requirements-analysis/requirements.md | ゲストネットワーク・デーモンを許可せず、iframeorigin制限、入力/path検証、端末間状態分離を回帰検証。資産取得のhost通信とゲストnetworkを区別 | 保存同一runtime/core/guestの遠隔回帰と原1610file/ZIP SHAを再照合 | verification/resume-20261010-v2/remote-ci-reconciliation.json | Build and Test | Met |
| NFR5 | aidlc/spaces/default/intents/261006-npm-terrarium-release/inception/requirements-analysis/requirements.md | loader/wasm/build-info/noticesの出所と整合を確認。コア取得元commitとdirty=false、guestrefを追跡可能。公開候補の機密・依存・ライセンス確認結果を記録し、未確認を安全確認済みとしない | core commit/dirty=false・資産digest・guestref照合成功。候補24files/source164files/history24commits225blobsの機密パターン検出0、npm audit脆弱性0、84依存license宣言とblink/Emscripten/musl原文同梱を照合 | verification/public-validation-v1/preflight.json; verification/public-validation-v1/licenses.json | Build and Test | Met |
| NFR6 | aidlc/spaces/default/intents/261006-npm-terrarium-release/inception/requirements-analysis/requirements.md | コア固有知識はruntime/core.mjsの境界へ保持。browser Workerのdelete Atomics.waitAsyncを維持。ゲストを変えるために公開JS実装を変更しなくてよい | 保存同一runtime/core/guestの遠隔回帰と原1610file/ZIP SHAを再照合 | verification/resume-20261010-v2/remote-ci-reconciliation.json | Build and Test | Met |
| NFR7 | aidlc/spaces/default/intents/261006-npm-terrarium-release/inception/requirements-analysis/requirements.md | 実行成功/失敗/timeout/中止を識別でき、stdout/stderr/終了コードとビルド・版情報を受入れ記録へ保存できる。機密値をログへ残さず、未検証を明示 | 保存同一runtime/core/guestの遠隔回帰と原1610file/ZIP SHAを再照合 | verification/resume-20261010-v2/remote-ci-reconciliation.json | Build and Test | Met |

## 現在の未達と影響

全体FAIL：公開RCの実terrarium導入、Trusted Publisher実設定、公開source/history全体監査は未検証。cross-unit69/95PASS・26FAILを保持。後続validation stageは選択されていない。CIとローカル試験成功で実運用条件を置換しない。library/version/container/algorithm/flagで全未達を直す候補は特定できない。公開準備監査だけでは実導入/実設定の証拠は成立せず、個別の外部操作承認が必要。Loop-back2/3の記録は以下に保存したままとする。失敗受入れや停止は人間が選択するまで記録しない。

## 保存履歴（以下は以前の観測）

## Build

検証済み：product tsc、test tsc、正式emitの3段階は各exit0。emitのExperimentalWarningは警告でありexit0。今回の244 generated JS/mapのemit前後SHA差分は0。product tscをinventory保存より先に実行したため.build全体のbefore比較は未実施、この比較はrootのemit前後に限定する。既存core/guestの再ビルド・repack/installは行っていない。

## Tests

| 今回の実行 | 成功 | 失敗 | skip | 証拠 |
|---|---:|---:|---:|---|
| U1 runner | 3 | 0 | 0 | verification/run-20261010-v1/u1-runner.stdout.log |
| U2 Node | 41 | 0 | 0 | verification/run-20261010-v1/u2-node.stdout.log |
| U3 Node | 48 | 0 | 0 | verification/run-20261010-v1/u3-node.stdout.log |
| U4 Node | 33 | 0 | 0 | verification/run-20261010-v1/u4-node.stdout.log |
| U2 3browser | 15 | 0 | 0 | verification/run-20261010-v1/u2-browser.stdout.log |
| U3 3browser | 6 | 0 | 0 | verification/run-20261010-v1/u3-browser.stdout.log |

Node125、browser21を別集計する。collector self-testとconsumer型検査は各exit0、件数に加算しない。U2の歴史的latest pitchforkタイトルはv2.30.0、U3は明示v2.30.1。実行環境は既存Node24/Playwright、browser1worker/retry0。新テスト失敗・assertion stackはない。全コマンドargv/exit、stdout/stderr SHAを隣のJSON/logへ保存。

## Preserved Evidence

U1: 346証拠、24候補file、固定14runtime、862/982=87.78%、1253realm、Safari5caseの現identity照合exit0。
U2: 固定3、249/254=98.03%、20receiptのgeneration/source/candidate一致exit0。
U3/U4: 固定24、1450/1801=80.51%、skip0、46receipt、execution seal、owner12pinとaudit prefix/current一致exit0。
これらは保存測定の再照合であり今回の新coverage測定・Safari再実行・外部owner新承認ではない。Safari旧timeout/hidden原因と恒久解消は未検証。

## Target Verification Matrix

build-and-test-summary.mdの同名節に全20行の最終判定を保存。Pendingは残さない。全Testing ContractとNFR3.1のCI条件はUnverified。適用targetをN/Aへ置換しない。

## Failure Diagnosis and Impact

Build and Test全体は不合格。コマンドは成功したが統合前遠隔CIが未検証。リポジトリ公開/送信をしない既存指示のもとでは、ローカルのlibrary/version/container/algorithm/flag変更で遠隔CI実績を作れない。新たな外部公開を無断実行しない。

cross-unit gate: 95 IDs中exact OK+実在target56、39不足。うち31は直接FR/親NFR対応不足、8はU4の明示Deferredの外部条件。記録の修復候補は、要件とAC/試験の対応を根拠付きで対象Unitのtraceabilityへ追加し、正式再レビューすること。推測の工数1–2時間、追加サービス費用なし、製品bytes変更なし、正式Unit再レビューによる工程再開リスクあり。この記録修復だけでは遠隔CI/外部8条件を解決できない。

主要阻害要因は外部運用条件であり、現在許可されたローカルの差替え可能な次元には、全targetをMetにする修正を特定できない。自動loop-backは0/3。失敗を許容して次の確認へ進めるか、ここで止めるかを人間に確認する。工程承認・release成功とは扱わない。

## Additional Verification — User Requested

追加検証後、ユーザーは遠隔CIと要件対応記録の不足も修復するよう要求した。失敗許容・停止は選択していない。

## Loop-Back Log

### Loop-back 1 — 2026-10-09T19:54:02Z

Diagnosis: 追加351件成功後も要件対応39件と統合前遠隔CIが不足。

Root-cause stage: Code Generation。U1〜U4の対応記録とU4の正式CI。

Planned fix: 既存修正・証拠をKeepし、traceabilityを実試験と照合してModify。外部条件を虚偽のOKへ変更しない。package/coverage/consumer/releaseを含むCI計画と冷起動の資産identity、送信対象を具体化し再レビューする。送信前に具体的差分・宛先の承認を得る。再開始中はStopを無効へ戻し、Code Generation全体完了後のみ復元する。

Estimated impact: 推測：記録修復1–2時間、CI構築・冷起動検証半日〜1日。Actions費用はアカウント枠に依存し未検証。外部公開・署名によるcore SHA変更・可変guest依存の再現不一致がリスク。既存証拠は保持し変更後は同一性を再照合する。

記録時の逸脱：初回追記はPythonの文字encodingで失敗し、正式jump後の再追記は計画承認待ちの書込み保護に拒否された。U1内ci-traceability-repair-plan.mdへ診断を保持し、改訂U1計画承認後にこのledgerを追記した。

ユーザー回答「追加検証して下さい。」を正式記録し、失敗許容/停止は選択していない。追加Nodeはpackage138/138、core54/54、追加core browser36/36、fail0/skip0。各コマンドはmain逐次、1worker/retry0。log/argv/exit/SHAはverification/additional-20261010-v1。公開package browser123/123（11.7分、exit0）、fail0/skip0。追加検証の合計はNode192、browser159、全351件成功。Chromium/Firefox/WebKitで実際のarchive、Worker中止/期限、子Worker終了、snapshot、loader/CSPを確認した。要件不足39件の分類と18storyの根拠対応、同HEAD全event CI 0件も同directoryに保存。追加試験に新しい製品修正・build・guest再生成はない。


## Resume Verification — 2026-10-10 v2

検証済み：正式product/test tscとemit各exit0、U1 runner3/U2 Node41/U3 Node48/U4 Node35/CI Node13、合計140件、fail/skip0。U2三browser15/U3三browser6、合計21件成功。collector self-testと型consumer各exit0。各Unit保存証拠の再照合exit0。遠隔run38011644576の1610原fileとZIP SHA一致、保存436件/native2と80.51%は以前の成功実行である。最新collectorとその試験のSHAは遠隔sourceと異なり、現在sourceのCI成功ではない。

実行argv/cwd/時刻/exit/stdout・stderr SHAはverification/resume-20261010-v2/results.json、browserは同directoryのstdout/stderr。ブラウザ1worker/retry0、既存期限不変。新coverage計測・Safari再実行・core/guest再build・公開操作なし。

最新Target Verification Matrixはbuild-and-test-summary.md先頭とverification/resume-20261010-v2/target-inventory.json。全27targetにMet/Unverifiedを設定しPendingなし。cross-unit.jsonは69PASS/26FAIL。未達は公開済みRC受入れ、Trusted Publisher/公開経路、公開候補機密・依存・licenseの最終確認等の外部条件と対応記録。要件原文のない新条件を追加していない。

## Current Failure Diagnosis

保存遠隔runの成功後、collectorの子孫process停止/pipe drain修正が正式U4で入った。source SHA比較はscripts/release/collect.tsとtests/release/collect.test.tsの不一致を観測した。現sourceの統合前CIはUnverified。ライブラリや品質閾値を変更する必要はなく、U4だけで既存検証専用CI候補に2ファイルを反映し、必要な正確な送信内容の承認後に同じ検証を再実行できる。公開RC・実設定・全公開確認の残条件はこの修正だけでは解消しない。

### Loop-back 2 — 2026-10-10T03:35:47.424Z

Diagnosis: 現collectorはローカル35回帰成功だが遠隔CI成功sourceと2ファイルSHAが異なる。全体合格は未検証。

Root-cause stage: Code Generation、u4-release-assuranceだけ。U1–U3の製品と承認済み証拠をKeep。

Planned fix: U4計画へ最新collectorを含む署名済み検証専用source候補の作成・最小2file差分確認・送信先/commit/実行範囲/既存入力の不変照合・必要な最終送信承認・fresh遠隔CIのraw結果照合を追加する。先に新attemptのPlan Approvalを得る。公開RC/実設定など26未達の必要操作と所有者を具体化し、架空のOKを追加しない。公開job・registry設定・publishは本修正のCI送信承認に含めない。

Estimated impact: 推測、候補準備/照合30–60分、CI実行20–40分、Actions費用は既存枠依存で未検証。再送信の外部公開と署名commit変更のリスクがあるため具体候補を提示して最終確認する。製品/core/guest/tarball/入力bundle bytesの変更なしを確認する。全体公開条件の残作業は未見積として別途具体化し、このCI修正で解消済みとはしない。


## Hooks-disabled Resume — 2026-10-10

### Loop-back 3 — 2026-10-10 npm実設定確認後

Diagnosis: ログイン済みnpm組織画面でowner/2FA有効・公開2package・staged0を実確認。対象formicariumがなくTrusted Publisher tupleを照合できない。ローカル候補はprivate=true/repositoryなし、公開workflowなし。機密/依存/notice追加検証は成功しNFR5をMetへ更新したが、FR9/10の実経路とFR7.3の公開RC受入れが残る。CI438件・coverage80.51%の原証拠は再照合済み。

Root-cause stage: Code Generation、u4-release-assurance。過去計画は検証専用CIと判定APIに限定し、必要な公開経路を後続へ引き継いでいた。U1–U3製品・既存core/guest・承認済み証拠はKeep。

Planned fix: U4の修復計画で、公開専用manifest/private/repository整合、承認対象tag/candidateに固定したTrusted Publishing workflow、実設定と供給先identityを照合する具体的手順、RC公開後の実terrarium受入れを準備する。実装前に新Plan Approvalを得る。候補準備と検証を先に完了し、npm登録/信頼設定/push/RC公開の具体的な外部操作承認は最後に分離する。RC実受入れをRC公開前提にして循環させない。

Estimated impact: 推測、ローカル実装・回帰半日–1日、遠隔公開前検証20–40分とRC受入れを別途。ローカル新規費用なし、Actions料金は契約依存で未検証。リスクは未承認tag公開・artifact/source不一致・誤った信頼tuple。候補SHA、対象workflow、最小権限、操作承認を固定して検証する。製品runtime/core/guestの再buildは不要。

検証済み：一時停止解除とBuild and Test再開が成功。正式product/test TypeScript buildとemit各exit0、release35/35とCI13/13、runner3/U2 41/U3 48が成功し合計140件、fail/skip0。U1–U4保存証拠の照合各exit0。mainで逐次実行し、フックによる拒否は観測されなかった。ログはverification/hooks-disabled-resume-v1/local-results.jsonとresults.json。latest-ci-v1のsource pinsと現sourceのSHA/size全件一致をcurrent-source-binding.jsonへ保存。

未検証：最新遠隔CI原ZIP/全artifactの今回再照合。既存helperは/private/tmp/formicarium-u4-ci-inputs-latest-v1/manifest.json不在で失敗したため、保存source pinsの照合を別に実施した。過去のrun38024772634 attempt2の438件/native2/80.51%成功は保存記録であり、今回のfresh遠隔実行ではない。要件対応は95件中69PASS/26FAILを再確認。公開RC/実設定/全公開監査を完了扱いにせず、全stageの成功・承認は記録していない。

### Loop-back 4 — 2026-10-10 人間のRetry with fix

Diagnosis: review-08 R-05の公開CLI結合拒否・RC否定試験が不足。R-06 CLI例とR-07現source coverage対応も要修正。

Root-cause stage: Code Generation、u4-release-assurance。U1–U3をKeep。

Planned fix: 外部送信なしのgatePublication/publicationCli境界試験、改変・必須回帰欠落/failed/timeout・coverage欠落/80%未満の拒否、偽executorで公開起動0回と正常引数を検証。必要ならexecutor注入のみ最小変更。CLI例とtraceabilityを訂正。新Plan Approval後に実装、mainで正式build/対象回帰、freshレビュー。

Estimated impact: 推測2–4時間、ローカル追加費用なし、Actions費用未検証。公開前検査の回帰・証拠境界誤対応のリスク。品質基準・旧証拠保持。外部操作は別承認。

Human authorization: Retry with fix。自動3回上限後の人間指示による再試行。
