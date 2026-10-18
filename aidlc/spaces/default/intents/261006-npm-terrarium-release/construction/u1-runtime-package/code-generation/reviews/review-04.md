## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-10-08T06:20:31Z
**Iteration:** 2

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | runtime/core.mjs > loadPackageCore / createCoreResourceOwner / installVerifiedLoaderURLBridge; runtime/node/api.mjs > resource control; runtime/web/api.mjs > resource control / childControl | 旧所見は照合済みloader bytesを使わず元URLを別importしていた点。検証済み（ソース読取り）：現行loadPackageCoreは照合後、owner.allocate(new Uint8Array(loader))のmoduleURLだけをimportする。Nodeはhost所有0700一時領域の排他的0400コピー、browserはhost所有Blobを使う。pthreadは同じコピーまたはsame-origin HTTP bootstrapを介した同じ所有Blobに結合される。hostはresource/child identityとURLを検査し、root終了後に資源を解放する。main-verificationに実loader mutationのNode・3browser Red/Green、marker0、CSP許可/拒否、pthread・資源解放の観測がある。今回もruntime digest一致を確認し、追加Node oracleが正常・abort・timeout・disposeのsettle後に所有領域の空を要求する。 | 元URL再取得の欠陥は解消。今回の範囲で追加修正なし。CI・全体guest回帰・実Safariの未検証条件を後続へ保持する。 | Resolved |
| R-02 | Major | runtime/guest-io.mjs > runGuest preRun / mkdirParents / mkdirIfMissing; tests/package/fixtures.mjs > memoryFs.mkdir; tests/package/consumer.test.mjs / consumer.spec.mjs > removed nested cwd | 旧所見はsetCwd後の祖先removeで途中親を再作成できない点。検証済み（ソース読取り）：現行preRunはmkdirParents(FS,cwd)を先に呼び、0755で不足親を順に作成してからcwdを作る。既存modeを保持しfile/symlink衝突を拒否する。偽FSにも親不存在の拒否条件がある。main-verificationに修正前Node unit/consumerと3browserのCORE_INIT Red、修正後公開操作列のGreen、異常runのrollback・次run・mode・seed・resetの観測がある。今回もruntime digest一致と保持されたconsumer oracleを確認した。 | 途中親不足の欠陥は解消。今回の範囲で追加修正なし。 | Resolved |
| R-03 | Major | aidlc/spaces/default/intents/261006-npm-terrarium-release/construction/u1-runtime-package/code-generation/code-summary.md > Final Revision Verification / workspace runtime13+README digest一致; README.md > Contribution and community guidance | 検証済み：前回reviewed-source-b7137bae6cce.tsvの64pathとのSHA256照合で変更はREADMEのみ。旧digest 0b1d91657d7463d8f195ca936f66ec856cfce8b1ab606589ffa80b59421d8df7に対し現digest 1cbb3b8ceaf412a3f9d944edaf7c3c525913e4c8a9fda52136cd3d489be34093。追加community段落を除いたbytesは旧digestと一致する。記録されたv7とのruntime13+README一致は現READMEには適用できない。v7 manifestとcoverage-v9 reportも現workspaceにないため、この回で候補を独立再照合できない。過去観測を否定しないが現候補同一性は未検証。 | 保存済みv7候補・証拠を元digestで復元照合する。追加READMEを配布する場合は元候補を上書きせず別候補へ結合し必要なpack/consumer差分検証を行う。過去runtime試験と現READMEを含む候補の合格を区別して記録する。 | New |
| R-04 | Minor | README.md > Contribution and community guidance; scripts/package/stage-package.mjs > PACKAGE_FILES; package.json > files | 検証済み（ソース読取り）：追加されたCONTRIBUTING.md、CODE_OF_CONDUCT.md、SECURITY.mdはrepo内には存在するが固定PACKAGE_FILESとpackage.jsonのfilesに含まれない。現READMEをstagingすると冒頭3本の相対リンクは空consumerのpackage内で解決しない。 | 配布READMEでは実在する公開repository URLを参照するか、承認された配布一覧と検証を更新して参照先も含める。 | New |

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| sensor-required-sections | 検証済み：plan / unit-test-instructions / code-summary全PASS、H2数6 / 5 / 8、findings 0 | 今回実行した文書構造検証。 |
| sensor-traceability | 検証済み：FAIL、missing_from_upstream_ids 25、他不整合配列は空 | 前回と同じ共有AC4/AC5.1/AC5.2/AC6の担当外範囲。unit-of-workのU3/U4責任に対応し、U1の追加実装要求としない。 |
| Source SHA256 / target existence | 検証済み：前回listing64path中READMEのみ変更、他63path一致。57一意ID、全target実在 | runtime・型・試験・helper変更なし。README除去対照で差分をcommunity段落へ限定した。候補同一性の制約はR-03。 |
| R-01 / R-02 source inspection | 検証済み：coreは照合bytesのowner moduleURLをimport、host所有temp/Blobを終了後解放。guest preRunはmkdirParents→mkdirIfMissing→chdir、lstatで非dir衝突拒否 | 旧2件の解消を現ソースで再確認。所見本文は前回どおり引継いだが、その実行・候補digest観測は当時の証拠であり今回の再実行ではない。 |
| Preserved tests / coverage | ドキュメント根拠：main-verificationのv7 Node20pass、v9 Node107pass、保存済みv8 browser99pass、695/758行91.68% | 新たなbuild/tests/lint/type-checkは実行せず。browser再収集と扱わず、元成果物が現workspaceにないためJSON・tgz独立再照合は未検証。 |
| Checkpoint / production limits | 未検証：レビュー後のcheckpoint再実行、CI、全体guest回帰、実Safari、公開 | mainがcheckpointを行う。過去pitchfork成果物欠落による既存32件中30pass/2failを全既存suite greenと扱わない。 |

### Summary

既存R-01/R-02はResolved。Criticalなし、未解決MajorはR-03の1件、MinorはR-04の1件であり定義された閾値ではREADY。U1現ソースへの一回のadvisoryレビューで、公開や現候補の受入れ合格を認定しない。

README変更を含む現候補と過去v7観測の境界を人間が判断する必要がある。保存候補・coverage元成果物の復元照合とcheckpoint再検証を未検証として保持し、runtime不変から候補・CI・実Safari・全体回帰成功を推測しない。レビュー対象やソースは変更していない。
