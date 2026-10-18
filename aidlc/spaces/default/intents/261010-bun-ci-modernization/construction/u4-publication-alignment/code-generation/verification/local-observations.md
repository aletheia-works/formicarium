# U4 Local Observations

## Runner Readiness

検証済み。2026-10-11 JST、main session。

- `mise run build`: exit0。
- 初期instructionsの `.build/tests/release` 六ファイル: exit1、6ファイルとも試験前に `.build/scripts/package/coverage-inventory.json` ENOENT。生成JSが参照する隣接JSONがこの配置にない。
- emit後の `tests/release` 六ファイル、Node24.21.0 `--test --test-concurrency=1`: exit0、61 tests/pass61/fail0/skip0、10720.8935ms。
- 人間がコマンド訂正と訂正版Plan Approvalを承認。instructionsだけを生成先 `tests/release` と `tests/tooling` へ限定訂正。実装範囲・試験39項目・品質基準は変更なし。

## Scope

## Step 14 JSON Bound — Readiness and Red

検証済み。2026-10-11 JST、main session。外部での修復後、`aidlc engine state unit start --stage code-generation --unit u4-publication-alignment` はexit0、UNIT_STARTED（2026-10-10T20:46:29Z）。今回はID不一致の拒否なし。ID処理の恒久的な修正を確認したという意味ではない。

`mise run build` exit0。既存release六ファイル（Exact Unit Commands）のbaselineは61/pass61/fail0/skip0、11385.975875ms、exit0。

追加試験の最初のbuildはexit1、publication-assets.test.ts155/156のunpackTar引数不足TS2554。これは容量不具合のRedに数えず、古いJSは実行しなかった。試験呼出しを既存3引数へ訂正したbuildはexit0。

修正前Red：Node24.21.0 `--test --test-concurrency=1 tests/tooling/publication-assets.test.js tests/tooling/publication-bootstrap.test.js tests/tooling/publication-alignment.test.js` はexit1、36 tests/pass24/fail12/skip0、15199.601292ms。request/publication/evidenceの8MiB+1が直接CLI・安全展開・bootstrapで受理され、9 subcaseが `Missing expected rejection/exception`、親3件もfail。8MiB丁度の正常署名・API対応の経路は成功。既存streamの虚偽Content-Lengthと実chunk増加のcancel試験も成功した。productionはこのRedまで未変更。

## Step 15 Initial Green and Generated Bootstrap

source修正後build exit0。同3filesは38/pass34/fail4/skip0、19584.7685ms、exit1。直接CLIとassetsの超過拒否は成功したが、bootstrap試験はまだ古いtracked bootstrap.mjsを使い、3超過subcaseと親1件が失敗した。生成資産の更新前の全体成功とは扱わない。

main固定Biome2.5.15で変更6TSを正規化（exit0、設定変更・unsafe fixなし）、固定Node24.21.0で `scripts/release/bundle.ts generate <Bun1.4.2> <Biome2.5.15>` exit0、build exit0。同3filesを再実行して38/pass38/fail0/skip0、40587.162041ms、exit0。実tracked bootstrapでも超過時runner0、直接CLIの超過時executor0、8MiB丁度の正常経路、虚偽ZIPサイズとbounded filesystem read portの読込増加/closeを確認。個別8MiB修正の残る内部JSON parse経路を次の同計画の追加回帰で確認する。

## Step 15 Secondary JSON Read — Red

report/inventory/publisher/indexの実JSONを8MiB丁度/+1へ増やし、必要なenvelope/index/artifact digestを対応づけた追加subcaseを準備。最初のbuildはTS2542（readonly fixture recordへの代入）でexit1、古いJSは実行せず、コピーしたrecordへの置換後build exit0。

同3filesの追加Redは46/pass42/fail4/skip0、23575.786417ms、exit1。inventory/publisher/index超過3subcaseは `Missing expected rejection`、親1件もfail。report超過は既に転送archiveの上限で拒否されたため、これだけでlocal読込前の制限を立証したとは扱わない。全ての丁度8MiB正常例は成功。残るJSON解析前のbounded読込を同承認済み修正内で接続する。

## Step 15–17 Current Green

mainで変更source/試験を固定Biomeにより正規化し、固定Bun/固定Biome生成、buildともexit0。同3filesは46/pass46/fail0/skip0、24073.245417ms、exit0。bounded readerへJSON parse callsitesを接続したsourceで、report/inventory/publisher/index・request/publication/envelopeの丁度8MiBを維持し、超過拒否を確認した。固定生成の独立temp verifyもexit0。

承認済み5tasksの全commandはexit0。frozen導入58 installs/84 packages/no changes。既存suite179 total/pass177/fail0/既存skip2（3974.638334ms）、tooling234/pass234/fail0/skip0（29507.654875ms）。lintの既存warning/infoは保持し、設定や下限は変更していない。含まれるU4試験と後続scoped再実行の件数を合算しない。

最終scoped検査：U4 Exact Unit Commandsの6filesは39top/76total/pass76/fail0/skip0、25468.767167ms、exit0。既存release Exact Unit Commandsの6filesは61/pass61/fail0/skip0、13039.271333ms、exit0。publish.ymlのactionlint1.7.12＋explicit shellcheck0.11.0はexit0。

main実bytes：bootstrap.mjs 22108B SHA25640d11ed7b1187ed4adc2ea52be1d847689d3bc97cb476a44ec51177c00488cd6、runner.mjs 76611B SHA2569e126fc77b69bf1bcd34399ffea12c6406ab9d25135f2cac00ece086026d003a、runner-manifest.json339B SHA256611fd737e7110793ed043c9f851c7803f20c85bd8d06484da54c1f69034a7af0、trusted-policy.json808B SHA25631777237ffd76c78d9e76322ac2817b30d9d92bbc61bf49540d9e82bed38c7b6。

外部CI・公開候補の重い回帰・全realm80%は未検証。今回外部push・設定・公開なし。

## Step 13 Final Local Verification

main整形・bundle再生成後、承認済み `mise run install-frozen && mise run check && mise run typecheck && mise run build && mise run test-light` 全体exit0。既存suite179 tests/pass177/fail0/skip2、新tooling206 tests/pass206/fail0/skip0（16475.349667ms）。lint warningsは残るがerrorなし、設定変更なし。root既存release6 files：61/pass61/fail0/skip0、11291.241ms。U4新6 files：39top/50total/pass50/fail0/skip0、11124.5185ms。外部CIと実公開は未実施、外部ID未設定のためwriter無効のまま。

## Step 13 First Five-Task Run

固定依存導入exit0（58 installs/84 packages/no changes）。check exit1、204 files/32 errors/32 warnings/18 infos、U4 TS整形とunusedを担当へ修正依頼。`&&` によりtypecheck/build/test-lightは未実行。lint設定は変更しない。

## Step 10–11 Connection Green

main固定Bun/Biome bundle generate exit0、build exit0。root version/CLI/alignment3 files：20 tests/pass20/fail0/skip0、13897.695583ms、exit0。独立fake API観測と署名report一致、RC/stable正常時Node＋固定npm一回、欠落参照/偽producer/report改変時executor0、不明結果の自動再送なし、実workflow境界を検証。actionlint1.7.12＋shellcheck0.11.0 publish.yml exit0。外部CI・実公開は未実施。

## Step 10 API Connection — Early Compile / Regression

main `mise run build` exit0。root publication-version / publication-cli 2 files、Node24.21.0 `--test --test-concurrency=1`：14 tests/pass6/fail8/skip0、6774.44675ms、exit1。8件とも validator の `publication triggers differ` が正常経路を先に拒否（workflow.js:13、publication-cli.js:42）。Steps10–11途中のworkflow/fixture契約整合として担当へ修正依頼。API接続正常経路の成功証拠には採用しない。

## Bundle Reproduction Green

main固定Bun/Biome `bundle.ts verify` exit0。build exit0後root publication-bundle.test.js：6/pass6/fail0/skip0、2188.707125ms、exit0。実tracked runner/bootstrap/manifest bytes再現、runner/bootstrap改変、config改変、版不一致、Node無依存起動、必須資産欠落を検証。生成物importsはNode builtinのみで、Istanbul依存を含まないこともmain rgで確認。

## Asset / Bootstrap Green

同生成入口exit0、修正build exit0。Node root evidence/assets/bootstrap3ファイル：21top/32total/pass32/fail0/skip0、6136.584541ms、exit0。actual固定npm、stream cap/cap+1、tar/ZIP展開/member上限・unsafe/link/special/重複・資格情報なしredirect・timeout、実tracked bootstrap/policy/manifest正常、改変runner/manifest・偽出所/古いattempt・未設定ID・bootstrap上書きでrunner0を検証。policy変更後C2回帰も成功。

## Asset / Bootstrap First Generation

main `node scripts/release/bundle.ts generate <Bun1.4.2> <Biome2.5.15>` exit0、tracked runner/bootstrap/manifest生成。続くbuild exit1、assets.test.ts TS2345（unpackZip memberLimit default8192がliteral型へ推論され、境界値16/1/10が不適合）。修正依頼。失敗build後にmainが誤って試験を実行したため、古いemitのevidenceがpolicy不一致で18failになった出力は現sourceの試験証拠へ採用しない。新assets/bootstrap試験はこの時点で未実行。

## C2 Evidence Layer

検証済み。build exit0、root publication-evidence.test.js7 top/18total tests、pass18/fail0/skip0、1066.075084ms、exit0。tracked policyのcheck名とidentityを正常fixtureへ使い、未観測外部IDはnull・writerEnabled=falseで拒否。fake API ID fixtureは実repo設定済みと扱わない。ordinary-ci、空/欠落/重複/非successchecks、偽producer、stale attempt/source/workflow、artifactbytes改変、80%未満/0分母、inventory/realmreceipt不一致が拒否。

## Version Layer — First Run

修正後同コマンド：build exit0、version tests6/pass6/fail0/skip0、1290.136416ms。原因は旧fixture helperが0.1.0以外のapproval operationをpublish-rcへ設定すること。U4正常stable fixtureで独立publish-stable承認を明示し、本体の承認拒否条件は緩めていない。

`mise run build` exit0。root publication-version.test.js Node sequential：6 tests/pass5/fail1、1576.695084ms。future stable正常例のみ `publication blocked: approval:publish-stable`（gatePublication publication-cli.js:42、test:312）。future RC・旧RC・invalid semver・tag/channel・不足承認executor0は成功。mainが失敗を観測後、担当へ承認条件を弱めない修正を依頼。

## Fixed npm Asset

追加のmain検証：gzip展開64MiB以内、member4096以内・regular/dir・package配下安全path・重複なしを確認後temp展開し、Node24.21.0で `package/bin/npm-cli.js --version` 実行。exit0、version11.19.0、members1943、expandedBytes12200542。依存install/lifecycleなし、tempcleanup済み。

検証済み。公式URL `https://registry.npmjs.org/npm/-/npm-11.19.0.tgz` をcurl HTTPS限定/max-time120/max-filesize33554432でread-only取得、exit0。実bytes2998121、Node crypto SHA512は固定 `sha512-SDd/hHg3KqHE5Ht2NHWxNYNtqCQ2pXAPLl6OtQhPyED5PHsRfrOtO199MZTIG2cQoQ1ZRI9t28shrD+2cr3AAw==` と一致。tar内package/package.jsonはversion11.19.0、bin/npm-cli.js存在。資産 `/private/tmp/formicarium-u4-npm-11.19.0.tgz`。CLI起動と安全展開は後続手順で検証する。

外部公開・push・設定適用は行っていない。以降のmain観測をここへ追記する。
