# U1 Local Observations

## Workspace and Baseline

検証済み。main sessionで逐次実行。隔離jj workspace /private/tmp/formicarium-bun-ci-u1、parent12a92eabf70f6772f11e33f698e3db5088992270、bookmark codex/bun-ci-u1。rootの未統合変更は持ち込まない。

Bun1.4.2 install --ignore-scriptsは初回sandboxのtempdir EPERM後、同じcommandをhost権限で再試行して成功。package-lockからtext bun.lockを生成。Node24.21.0 PATHでbun run build exit0、変更前bun run test:unitは179 tests/177pass/0fail/2skip。skipはactual official release supply資産不足の既存項目で、受入れ成功に含めない。

## Dependency and Task Checks

検証済み。isolatedでbun install --frozen-lockfile --ignore-scripts exit0、build exit0、Nodeの.build/tests/tooling/bun-tasks.test.jsは7pass/0fail/0skip。

新しい /private/tmp/formicarium-u1-frozen-positive にmanifest/bun.lockのみを置き、bun install --frozen-lockfile --ignore-scripts --no-cache exit0、57packages installed。元のnode_modulesなし。negative fixtureはtypescriptをdevDependenciesから除外して同一lockを維持し、同commandはexit1「lockfile had changes, but lockfile is frozen」。本作業及び正負fixtureのlock SHA256は1c8b5e26b37595f2bf5b2e2e2e74579b5f53b3804db3bcfabb746ce86c1f23a6で無変更。npm lock84件とBun lock84件の解決name/version multisetは完全一致（Python Counter、差分両方空）。

## Quality Checks and Bug Reproduction

検証済み。quality-evidence.test.jsの初回は7pass/0fail/0skip。コード読取からsignal付きstatus0と空producerを疑い、先に再現assertionを追加して再実行。2file14testsで12pass/2fail/0skip、exit1。失敗は「task failures and interrupted tasks propagate nonzero results」0 != 1と「missing duplicate and empty check inventories fail closed」Missing expected exception。修正後14pass/0fail/0skip。candidate試験はeager importによるcoverage-inventory ENOENTを観測後、CLI内lazy importへ修正し、計画の3file20testsが20pass/0fail/0skip。

## Ordinary CI and Consumer Checks

検証済み。実shellcheckを指定したactionlintで新ci.ymlとcandidate-verify.ymlはexit0。型検査・buildはexit0。軽量試験は179tests/177pass/0fail/既存skip2と追加20pass/0fail/0skip。削除済みnpm lock参照の既存試験を実際に失敗させ、Bun.JSONCによるlock照合へ修正後green。TypeScript7には旧parser APIがなくbuildが失敗したため、固定BunのJSONC APIを使用。full lintは既存release/probeの整形/import順違反を観測後、安全なformatter修正のみでexit0（既存warning6/info3は残る）。

検証済み。rootのdirty=false、blink.lock一致のcore成果物をコピーし、hello/exit3不足を補った後、実Node API/Worker13pass/0fail/0skip。新しいprivateローカルcandidateをBun pm packで生成し、全24fileのinventory・各digestをverify-packageで照合、tarball SHA256 05bd48611997918a90e4fe40ff751dc7fe722f0ab90d3222de0f64826190b0fb。別directoryのconsumerにBunで導入後、Node consumer11pass/0fail/0skip。ブラウザconsumer33件は逐次実行中、結果待ち。

検証済み。変更をfile patchでrootへ選択反映。miseの既存framework latestを保持し、probeはrootの既存内容へformatterを適用（隔離版で置換せず）。旧verify/publish/gitignoreとguest sourceは変更しない。root frozen installは58installs/84packages無変更、root lint/buildはexit0。

## Limits

検証済み。ブラウザconsumerは33pass（Chromium11/Firefox11/WebKit11）、9.1分、1worker/retry0。rootへ反映後の型検査・light179件中177pass/既存skip2とtooling20pass・actionlintはいずれもexit0。実Safariは未検証。

検証済み。新候補入力1373file/188sourceのdigest preflight成功。移送archivev3は1374regular member、104494068bytes、SHA256 cc182cb477eb7747b3b4418c3e13b4938f2364dabb806f1727aacd875952dc08。初期archiveはdirectory/AppleDoubleを含むため不採用。v3を実installerへ渡したローカル展開は成功（HTTP transportだけmock）。重い回帰・coverageの実行ではない。

通常workflowの実GitHub CI、candidate重い回帰、新source固定coverage、初期trustedbasevalidatorの導入は未検証。ここに書いたmock境界試験・軽量試験をその代替にしない。外部push/CI dispatch/設定変更は未実施。
