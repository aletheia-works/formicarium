# U4 command Code Summary

## Step 31：Build and Test の Loop-back 1（Node の版の固定、2026-10-22）

この節が、この file の中で最も新しい。下の節は、それぞれの時点の記録として残す。

- 原因（検証済み）：Build and Test で、人間の承認により起動した `migration-acceptance.yml` の run 39702294398（main `6b5bac1f`）が、U3 の `tests/migration-install/runner-ready.test.ts` の Node の patch の版の固定（`26.12.0`、CI は 26.12.1）で失敗し、U4 の completion が止まった。log：formicarium の `.artifacts/build-and-test/logs/migration-acceptance-39702294398.log`。U4 の `tests/migration-command/runner-ready.test.ts` の15–16行にも同じ固定（題の「Node 26.12.0」と `assert.equal(process.versions.node, '26.12.0')`）があった。
- 修正（不具合の修正の順、検証済み）：手元の Node を 26.12.1 にし、直す前の U4 の試験が `actual: '26.12.1'` で失敗することを観測した（3件中 fail 1）。そのあと、版の確認を major の版（`Number(process.versions.node.split('.')[0])` が 26）に改め、題を「U4 runner executes Node 26 ESM with the string and encoding primitives the parser uses」に直した。文字列と encoding の primitive の確認は残した。同じ試験が 3 pass になった。製品のコードと基準は変えていない。`unit-test-instructions.md` の Node の版の記述も、major の版だけを確かめる書き方と 26.12.1 の実体 path に直した。
- PR：aletheia-works/formicarium#65（U3 の同じ修正と1つ、`test/runner-node-major`、head `4c96f634`、1 commit・2 file、署名あり、親 `6b5bac1f`）、merge `6a90a45b`。
- merge の後の確認（検証済み、GitHub の読取り）：main の CI（run 39706177745）の success を待ってから人間の承認で起動した `migration-acceptance.yml` の run 39709015067（`6a90a45b`、2026-10-22T02:01:09Z〜02:38:22Z、Node 26.12.1）は、全 step が success。U4 command の単体試験 112 pass（runner-ready を含む）、ブラウザの受入 12・45・9 passed、U4 の completion（local-provisional）も success。log：`.artifacts/build-and-test/logs/migration-acceptance-39709015067.log`。この completion は `local-provisional` で、U4 の正式受入の扱いは下の節の記録のまま変えない。
- 未実施：この節の独立レビューと、intent の検証コマンドによる U4 の checkpoint の確認（Step 31 の後半）。

## 6回目の再開：terrarium の削除（PR #58）の後の確認（2026-10-21、Step 28〜30）

下の節は、それぞれの時点の記録として残す。

U4 の Code Generation は、レビューの回数を使い切っていた。そのため、人間の判断（2026-10-21「はい、開き直して良いです。」）で開き直した。土台は upstream の main `5735433d`（PR aletheia-works/formicarium#58 の merge）。U4 の製品コードの振る舞いと公開 API は変えていない。

### Step 28：#58 が U4 の file に与えた影響（検証済み）

U4 の `source-manifest.json` の path のうち、#58 が変えたのは次の4つ。

- `README.md`：terrarium の言及を消しただけ。
- `package.json`：`scripts` の `test:integration`・`test:node-unit` から、消した `tests/terrarium/` の試験を除いただけ。`exports`・`files` は変わらない。
- `runtime/command-parse.ts`：comment の1行（`terrarium's .sort()` → `Array.prototype.sort()`）だけ。code は変わらない。
- `scripts/release/inventory.ts`：guest の配布の部品の path を、`integration/guest-distribution/` に変えただけ。

結論：U4 の振る舞い（C03 の command、`createCommandSession`、B1 の受入）は変わっていない。

- B1 の受入済みの pack（Release `b1-a3370ca4df1f`）と、その証拠は作り直していない。
- #58 の後の pack との違いは、`README.md`・`package.json` の scripts・`runtime/command-parse.js` の comment だけ（U9 の Step 5）。

試験の結果（main session で1つずつ、2026-10-21）：

| コマンド | 結果 |
|---|---|
| `mise run typecheck` | exit 0 |
| `mise run build` | exit 0 |
| `mise run test:light` | bun 71 pass・37 pass、node 120件（118 pass・2 skip・0 fail）、node 124 pass |
| `mise run migration:command-unit` | 107件のうち 106 pass・1 fail |

`migration:command-unit` の1件の失敗は `tests/migration-command/consumer.test.js` である。この試験は、stage した候補を指す環境変数（`FORMICARIUM_CANDIDATE` など）が無いと、`tests/migration-session/consumer-input.ts` の最初の確認で必ず失敗する。今回は準備していないので、未検証とする。

### Step 29：記録の更新

- `traceability.json`・`source-manifest.json` に、#58 で移した file・消した file を指す行は無かった（`grep` で確かめた）。
- この節を足した。

## 5回目の再開：main sessionの確認、受入の1回目、Step 27（2026-10-20）

### 人間の判断
- Step 19（止まった点）：B。記録はU4だけが受け付け、U2・U3はU4の完了確認の中で流れる試験で覆う。U2・U3を単独で正式に受け入れたとは主張しない（計画のStep 19・25を直し、再承認を受けた）。
- 追跡されない古い生成JS 7組（`runtime/web/{app,coi-sw,sessions,worker}.js`、`scripts/release/{bootstrap,bundle}.js`、`scripts/migration-session/ci.js` と各 `.js.map`、`.build/scripts/migration-session/ci.js*`）は人間の了承で消した。元の `.ts` はPR #15・#16・#32で消えていた（jjの履歴で確認）。`mise run build` の後も戻らないことを確かめた。`scripts/maintenance/*.js` などsource identityに入らない残りは消していない。
- 受入の1回目の失敗への対応：A（Step 27、下）。

### Step 22：main sessionの確認（検証済み、1つずつ実行）
- `mise run lint:all` exit 0（警告48・info 47は前と同じ）。`mise run typecheck` は新しい試験の1か所（`assert.match` の3つ目の引数の型）で失敗したので直し、exit 0。`mise run build` exit 0。
- `node --test tests/migration-command/acceptance-ci.test.js`：17/17。`runner-ready.test.js`：3/3（Node v26.12.0）。`mise run test-light`：130/130。
- `mise run migration-command-unit`：108/108（今のsourceから作った候補と、repositoryの外の独立consumerで）。
- `acceptance-inputs.js inspect ci/migration-command/inputs.json` exit 0。actual-siteのarchiveは手元にあった（2026-10-15）。SHA256 `9c0dd08a…307f`、36727106 bytes。`verify-archive` の10 fileは手元の `.artifacts/migration-install/actual-site` の同じfileとSHA256がすべて一致した（11件目はaubeのguest）。
- この途中で、U4の `package.json` の2行のためにU1のsourceが変わり、U1のレビューを受け直した（review-18、READY）。U1の検証コマンドはexit 0で、checkpointを承認した。
- prereleaseのRelease `migration-inputs-actual-site-v2`：人間の依頼で、main sessionがJamBalaya56562のアカウントに切り替えて `gh release create` で作り、Marukome0743に戻した。APIのdigest `sha256:9c0dd08a…307f`・size 36727106と、実際に取得したfileのSHA256・sizeが一致した。tagはmain `4aad1813`。

### Step 23：PR #50と受入の1回目（検証済み）
- PR aletheia-works/formicarium#50（1 commit・9 file、署名verified）を作り、人間がmergeした（main `22b662d2`）。
- 人間の依頼で、JamBalaya56562のアカウントで受入のworkflowを手動実行した（run 39373780795）。U4の完了確認の工程でfailure。それより前の工程（install・build・typecheck、U2のbundleの復元、3つの入力の取得と照合、actual-siteの復元、候補とconsumer、jobの証明書）と、後始末・2つのartifactのuploadは成功した。
- 失敗は `tests/node/build.test.js` の1件（「pitchfork.build-info に当てたパッチ・UI の node・UI の成果物が記録され、今のパッチと一致する」、actualがパッチの行、expectedが `undefined`）。U2のbundleの `dist/guests/pitchfork` は古いパッチ版（v2.30.0）で、今のmainの試験は今の `ci.yml` が作るパッチなしのpitchfork（v2.30.1）を前提にする。手元では今のmainの手順で作り直したpitchforkを使っていたので通っていた。

### Step 27：mainのCIのpitchforkを使う（人間の判断A、計画を直して再承認）
- `scripts/migration-command/acceptance-inputs.ts` に `main-ci-pitchfork <commit>` を足した。GitHub RESTで、`.github/workflows/ci.yml` の、`push`・`main`・同じcommit・`completed`/`success`・repositoryとhead repositoryが `aletheia-works/formicarium` のrunがちょうど1つであること、artifact `product-build-guests-<commit>-<runID>-<attempt>` がちょうど1つで期限内・digestの形・runとheadに結び付くこと、ZIPのSHA256とsizeがAPIと一致することを確かめ、ZIPの `guests/pitchfork`・`guests/pitchfork.build-info`・`guests/pitchfork.commit` の3つだけを `dist/guests/` に置き換える（pitchforkは755、ほかは644）。置き換えたfileのSHA256とsizeを `.artifacts/migration-command/acceptance-inputs-main-ci-pitchfork-<runID>.json` に残す（completionのartifactに入る）。
- workflowに、U2のbundleの復元の直後にこの工程を足した。jobの権限に `actions: read` を足した（書込みはない）。tokenは、この工程の環境変数 `GH_TOKEN: ${{ github.token }}` だけで渡す。受入のworkflowは、同じcommitのmainのCIが終わった後に動かす。
- 試験：`acceptance-ci.test.ts` に4件（runの選び方の拒否、artifactの照合の拒否、3つの必須と3つ以外を使わないこと、置き換えの全体〈digestの不一致では何も変えない、aubeは変えない、mode、記録にtokenがない、tokenはAPIの宛先だけ〉）を足し、workflowの定義の試験を `actions: read` とtokenの工程1つ・工程の順に合わせた。
- 確認（検証済み、1つずつ）：`acceptance-ci.test.js` 21/21、lint:all・typecheck・build exit 0、test-light 130/130、`migration-command-unit` 112/112（候補とconsumerを作り直して）、actionlint exit 0。本物のAPIで、main `22b662d2` のCI（run 39373734675）からscratchpadへ取り出せることを確かめた（artifact digest `sha256:606e897e…249c`、pitchfork SHA256 `629123d1…6ec4`、39680792 bytes、build-infoは `ref=v2.30.1` でパッチの行がない）。手元の `dist/guests/pitchfork` とはbytesが違う。この試験が通ることは次のCIのrunで確かめる（今は推測）。
- PR aletheia-works/formicarium#51（1 commit・3 file、署名verified）を人間がmergeした（main `2e0358a2`）。

### Step 23–24：受入の2回目と観測（検証済み）
- main `2e0358a2` のCI（run 39378155940）が成功で終わった後、人間の依頼でJamBalaya56562のアカウントで受入のworkflowを手動実行し（run 39378404328）、Marukome0743に戻した。約39分ですべての工程がsuccess（`main-ci-pitchfork`、U4の完了確認、後始末、2つのartifact）。
- CIの完了確認の結果（artifactの中身で確認）：`local-provisional`・`localPassed: true`・`b1.formal: false`・`realSafari: 未検証`。B1は31行すべてpassed（pack `a3370ca4…4046`、source `2e0358a2`）。coverageは23JS全realmで行92.16%（2055中1894、基準80%）。36試行passed（基準3000ms）。最も遅いのはbiome/Firefoxの中央値2938.28ms（余裕約2%。U3・U4の既知の残余リスクと同じ種類）。
- `mise run migration-command-observe 39378404328 2e0358a2…` で観測した。`.artifacts/migration-command/ci-39378404328/` に `run.json`・`jobs.json`・`commit.json`・`artifacts.json`・2つのZIP・`observed-ci-summary.json`（SHA256 `1108f962…8b20`）を残した。記録は `unit: u4-command`・`conclusion: success`・`commitVerified: true`・job `accept` 1つ・`candidateSha256 a3370ca4…4046`・`sourceIdentity 0d2b798a…008c`。残したfileのどれにもtokenは無い。

### Step 25：手元の正式な完了確認（検証済み）
- main sessionが `.artifacts/migration-command/step25/` に2つのwrapper（`run-formal-completion.sh`・`run-u1-trials.sh`）を用意した。どちらも実行のたびに1日のlocalhost証明書（SAN `DNS:localhost`、CA:FALSE、serverAuth）を作り、login keychainへ一時的に信頼させ、終わったら信頼と証明書を消して不在を確かめる。`--check` はmain sessionが流して通った。本番は人間がターミナルで1つずつ実行した。終了後、main sessionが両方のCNで `security find-certificate` が44（不在）、`dump-trust-settings` に残りがないことを確かめた。秘密鍵の残りは人間が消した（hookがscript内の削除を拒否したため）。
- U4の正式な完了確認：候補はCIのrunと同じtarball（`a3370ca4…4046`、source `2e0358a2`、sourceIdentity `0d2b798a…008c`）、観測の記録 `1108f962…8b20` を `FORMICARIUM_COMMAND_CI_EVIDENCE` に渡した。`completion-c66698d0-…/completion-report.json`：`status: verified-with-ci`・`acceptancePassed: true`・`b1.formal: true`・`realSafari: 未検証`。`b1-acceptance.json`（SHA256 `0c6e547f…7a35`）：31行すべてpassed、evidenceId `u4-b1-ci-39378404328-1`、inventorySha256 `e8083776…06ba`、preflightEvidenceId `u1-real-browser-ci-attempt-2`。coverage 92.16%（2055中1894）。36試行passed（最も遅いのはbiome/Firefoxの中央値2484.14ms）。
- U2・U3：人間の判断B（Step 19）により単独の正式な完了確認は行わない。U4の完了確認の中のU2・U3の試験はすべて通った。
- U1の今の確認：36試行は36 passed（Node v26.12.0、Playwright 1.64.1、attempt `.artifacts/migration-preflight/step25-browser-20261020T103352Z`）。今のsourceのU3の候補（`candidate-f46ce105-…`、tarballはU4と同じ `a3370ca4…`）で `current-completion.js prepare`（input SHA256 `046cb1dd…cd82`）・`run`・`verify` を流し、`verified: true`・`currentSourceVerified: true`・`status: current-local-verification`・`acceptancePassed: false`（U1単独では正式受入にならない設計のとおり）。coverageは86.42%。
- 計測のwrapperが `FORMICARIUM_PREFLIGHT_ATTEMPT` を相対pathで渡したため、Playwrightの出力（空のdirectoryと `.last-run.json`）が `tests/migration-preflight/.artifacts/` にもでき、biomeのlintがこれを拾って失敗した。証拠ではないので消して、lintが通ることを確かめた。

### 計画のStep 1〜16の印について
5回目の再開を締めるときに、前の再開のStep 1〜16にも印を付けた。Step 1〜9は古い土台で実施した履歴（結果は下の古い節。新しい土台の成功証拠には付け替えない）、Step 11〜15は4回目の再開で実施済み。Step 10（古い土台の最終レビューと完了確認）とStep 16（4回目の再開の独立レビューとcheckpoint）は、計画に書いたとおりStep 26で置き換えた（実施したのは、5回目の再開の独立レビューとcheckpoint）。

### Step 26：B1のpackのRelease（検証済み）
- 人間の承認で、JamBalaya56562のアカウントでprerelease `b1-a3370ca4df1f`（tagは `2e0358a2`、latestにしない）を作り、Marukome0743に戻した。資産は `aletheia-works-formicarium-0.3.0-b1-a3370ca4df1f.tgz`（`a3370ca4…4046`、267867 bytes）・`b1-acceptance.json`（`0c6e547f…7a35`）・`SHA256SUMS`。Release notesに、npmの0.3.0とは中身が違うこととSafari実機が未検証であることを書いた。APIのdigestと、実際に取得したfileのSHA256が一致した。showcaseの `validateB1Pack`・`checkEvidence` が値を受け付け、`packDistribute` を本物のReleaseに向けて流して配布の記録まで作れた。
- PR aletheia-works/formicarium#52（`showcase/b1-pack.json`、`showcase/tests/config.test.ts`、`showcase/README.md`、1 commit・署名verified）を人間がmergeした（main `c9b37c4a`）。確認：lint:all・build・showcase typecheck exit 0、showcase unit 96/96、test-light 130/130。
- #52より前のmain `2e0358a2` のU8のscheduleのrun（39400837294）は、予想どおり `b1-pack-unavailable` で止まった。

## 5回目の再開：mainでの正式受入の仕組み（2026-10-20、Steps 17–21）

開発担当がStep 17の調査と、Steps 18–21のコード・試験file・記録を書いた。build・typecheck・lint全体・試験は、規則どおりmain sessionが1つずつ実行する。この節の作成時点で、新しいコードの試験は1件も実行しておらず、成功は未検証である。Step 19には止まった点がある（下の「止まった点」）。U1〜U3のfileと製品コード（`runtime/`・`types/`・`scripts/migration-{session,install,preflight}/` とその試験）は変えていない。

### 作ったもの・変えたもの
- 新規：`scripts/migration-command/acceptance-inputs.ts`（3つの入力の照合・取得と、actual-siteの復元）、`ci/migration-command/inputs.json`（入力の一覧）、`scripts/migration-command/observe-ci.ts`（runの観測と `observed-ci-summary` の作成）、`mise-tasks/migration/command-observe.sh`（task `migration-command-observe`）、`.github/workflows/migration-acceptance.yml`（手動の受入）、`tests/migration-command/acceptance-ci.test.ts`（3つの部品とworkflowの定義の試験、計17件。入力7・actual-site 3・観測3・workflow 4）。
- 変更：`package.json`（`migration:command:observe` の追加と、`migration:command:unit` への `acceptance-ci.test.js` の追加）、`tests/migration-command/runner-ready.test.ts`（一覧の件数6→7。理由は下の「試験手順との違い」）、`docs/command-api.md`（「正式受入（U4とB1）の手順」の節）、この記録の `traceability.json`・`source-manifest.json`。

### 試験手順（`unit-test-instructions.md`）との違い
`unit-test-instructions.md` は、承認済みの計画の一部なので変えていない（一度書き足したところ、承認の照合が外れてshellが止まったため、元のbytesに戻した）。違いはここに記録する。手順書へ反映するかは、main sessionと人間が決める（反映すると計画の再承認が要る）。
- `tests/migration-command/runner-ready.test.ts` を1か所だけ変えた。この試験は `migration:command:unit` の一覧がちょうど6件であることを確かめていたので、手順書のとおり `acceptance-ci` を一覧に加えると失敗する。`U4_UNIT_FILES` に `acceptance-ci` を加え、試験名を「seven」にした。手順書の「U4の他の試験fileは変えない」と食い違うが、一覧に加える指示と両立させるための最小の変更である。U1〜U3の試験fileは変えていない。
- 「作った記録を、U2・U3・U4の検査がどれも受け付ける」試験は書いていない。U4の `checkCommandCIEvidence` が受け付けることだけを確かめる（下の「止まった点」）。
- actionlintは試験の中では呼ばない（受入jobにactionlintを入れないため）。workflowのactionlintは `mise run lint:all` で確かめる（今回は開発担当が1 fileに実行してexit 0）。
- 試験は `.artifacts/` の下に一時directoryを作って消す。追跡された `ci/migration-command/inputs.json`・`mirror-input.json`・`acceptance-evidence.json`・workflowを読むので、repositoryの直下で実行する。

### 部品の中身（コードを読めば分かることの要約）
- `acceptance-inputs.ts`：一覧は正規形のJSON（重複keyを拒否）で、fieldと3つの名前・置き場所が固定。`aube.tar.gz`・`biome.elf` は `mirror-input.json` の公式の行（URL・size・`downloadSha256`）と一致すること、`actual-site-v2.tar.gz` はcodeに固定した値（size 36727106、SHA256 `9c0dd08a…307f`、Release `migration-inputs-actual-site-v2`）と一致することを求める。取得は既存の `fetchAsset`（httpsだけ、1回の302を `release-assets.githubusercontent.com`・`objects.githubusercontent.com` へだけ許す、size上限で打ち切り）。全部を照合してから書き、既存のfileは上書きしない（同じbytesなら使う）。archiveは既存の `unpackTar`（link・特殊・危険なpath・重複を拒否）で読み、10 fileの完全一致を求める。11件目（aubeのguest、`c7d7d136…`）は、U2の入力が置く `dist/guests/aube` から取る（古いU3の作りと同じ）。最後にU3の `inspectInstallActualSite` が固定11ファイルを検査する。既存のactual-siteは検査だけして書き直さない。CLIは `restore`・`inspect`・`verify-archive`。
- `observe-ci.ts`：GitHub RESTで、run（`id`・`run_attempt`・repositoryとhead repositoryが `aletheia-works/formicarium`・`path` が `.github/workflows/migration-acceptance.yml`・`event` が `workflow_dispatch`・`head_branch` が `main`・`head_sha`・`completed`/`success`）、その試行の全job（成功、job `accept` が1つ）、commit（`verification.verified: true`）、artifactの一覧（ちょうど2つ、期限内、digestの形、runとheadに結び付く）を確かめる。2つのZIPを `fetchAsset` のActionsのstorageへのredirectの型で取り、digestとsizeを照合する。候補のZIPから、manifest（`unit: 'u4-command'`、sourceIdentityの再計算）とtarballのSHA256、`local-provisional-report.json`（`localPassed: true`、`b1.formal: false`、同じpack・source）、`b1-acceptance.json`（既存の `validateB1`、31行がpassed、preflightのidは手元の追跡fileと一致）を確かめ、もう1つのZIPの報告とB1が同じbytesであることを確かめる。`incomplete.json` があれば拒否する。結果を `.artifacts/migration-command/ci-<run-id>/` に、RESTの応答・ZIP・`observed-ci-summary.json`（flag `wx`）として書き、記録のSHA256を出力する。tokenは `GITHUB_TOKEN` か `GH_TOKEN` から読み、API以外の宛先には送らず、fileと出力に書かない。
- workflow：`workflow_dispatch` だけ、job条件はrepositoryとmainのref、権限は全体とjobで `contents: read`、secretsなし、`ubuntu-24.04`、360分、checkoutは `persist-credentials: false`、actionsはcommit SHAで固定。miseは `jdx/mise-action` v5.2.1で入れ、`node` と `bun` だけを最新版で入れ、実体のbin（shimではない）をPATHの先頭に置く（`MISE_TASK_RUN_AUTO_INSTALL: 'false'`）。順番は install-frozen → build → typecheck → `ci-core.js`（固定のblinkとU2の入力）→ `acceptance-inputs.js restore` → Playwrightの3browser → このcommitで `migration-command-stage` と `$RUNNER_TEMP` の独立consumer → `showcase/scripts/tls.ts create` のjob専用CAとleaf（CAの鍵はすぐ消える）→ system store・NSS・Firefox profileへの信頼 → `FORMICARIUM_COMMAND_LOCAL_ONLY=1 mise run migration-command-completion` → `always()` で信頼と鍵を消す → `always()` で2つのartifact（7日）。基準の値はworkflowに書かず、既存のcodeのまま使う。

### Step 17：道具の版（2026-10-20に調べた、検証済み：`npm view`・GitHub API・nodejs.orgのindex）
| 道具 | 最新 | 今の値 | 差 |
|---|---|---|---|
| Node | 26.12.0（2026-10-14） | `mise.toml` latest、手元の解決 26.12.0、`showcase*.yml` の固定 26.12.0、`ci.yml` latest | なし |
| Bun | 1.4.3（2026-10-10） | `packageManager: bun@1.4.3`、手元 1.4.3、`showcase*.yml` 1.4.3 | なし |
| @playwright/test | 1.64.1 | 1.64.1 | なし |
| TypeScript | 7.0.2 | 7.0.2 | なし |
| @biomejs/biome | 2.5.15 | ^2.5.15 | なし |
| @types/node | 26.6.5 | ^26.6.5 | なし |
| mise | v2026.10.15（2026-10-19） | 手元 2026.10.14 | 手元が1つ古い（`mise.toml` は版を持たない） |
| actions/checkout | v7.0.1 `3d3c42e5…` | 同じ | なし |
| actions/setup-node | v7.1.0 `949feb24…` | 同じ | なし（新しいworkflowでは使わない） |
| oven-sh/setup-bun | v2.2.0 `0c5077e5…` | 同じ | なし（新しいworkflowでは使わない） |
| jdx/mise-action | v5.2.1 `fc42bcc7…`（2026-10-19） | `showcase.yml`・`test-lint-check.yml` は v5.1.2 `08ae2a09…` | 既存の2つが古い。新しいworkflowは v5.2.1。既存のworkflowは範囲外なので変えていない |
| actions/upload-artifact | v7.0.2 `cf430e03…` | 同じ | なし |
| actions/download-artifact | v8.0.2 `90008278…` | 同じ | なし（新しいworkflowでは使わない） |

依存の版は変えていない（main sessionが更新・installする決まり）。`tests/migration-command/runner-ready.test.ts` は `process.versions.node === '26.12.0'` を固定で求める。今は最新と一致するが、Nodeの新しい版が出ると、mise latestで動くCIではこの試験が失敗する（残余リスク。変えていない）。runner-readyの実行はmain sessionが行う（未実行）。

### Step 17：追跡される `.ts` のない生成JS（読取りだけで調べた、検証済み）
`jj --ignore-working-copy file list` と、`runtime`・`types`・`scripts`・`tests` の `.js` を比べた。消していない（main sessionが消す）。
- source identityに入るもの（`sessionSourceInventory` が走査するdirectoryの中、手元とCIで値が変わる）：`runtime/web/app.js`・`coi-sw.js`・`sessions.js`・`worker.js`（10-18の古い残り）、`scripts/release/bootstrap.js`・`bundle.js`（同）、`scripts/migration-session/ci.js`（`.build/scripts/migration-session/ci.js` が古く残っていて、`scripts/emit.ts` が毎回のbuildで写し戻す。`.build` の中で追跡 `.ts` のない `.js` はこれだけ）。
- source identityに入らないもの：`scripts/maintenance/*.js`（11件）、`tests/tooling/maintenance-*.test.js`（9件）、`tests/tooling/publication-bootstrap.test.js`・`publication-bundle.test.js`。
- それぞれに `.js.map` もある。`runtime/web/package-worker.bundle.js` はbuildの生成物（`buildWorkerBundle`）で、古い残りではない。追跡されないJSONとsymlinkは、上の4つのdirectoryに0件。

### 止まった点（Step 19）：1つの記録をU2・U3・U4がどれも受け付けることはできない
計画とdispatchは「1つの `observed-ci-summary` をU2・U3・U4の検査がどれも受け付ける」ことを求めるが、今の検査では成り立たない（検証済み：fileを読んだ）。U2・U3は変えていない。
- U4（`scripts/migration-command/completion.ts` 271–279行）：`unit === 'u4-command'`、U4の候補の `sourceIdentity`（`commandSourceInventory` のhash）・tarball・commitと一致すること。
- U3のCLI（`scripts/migration-install/completion.ts` 488行の `runInstallCompletion()` はoptionなし）：`checkInstallCandidate`（111行）が `installCandidateInventory`（`scripts/migration-install/stage.ts`）を呼び、`commandSourceInventory` が渡されないとU4の候補を拒否する。したがって、`mise run migration-install-completion` が受け付けるのはU3の候補（`unit: 'u3-install'`）だけで、記録の `sourceIdentity` はその候補のもの（`installSourceInventory` のhash）でなければならない（368–376行）。
- U2（`scripts/migration-session/completion.ts` 54行）：候補は `unit: 'u2-session-guest-api'` だけ。記録の `sourceIdentity` はU2の候補のもの（`sessionSourceInventory` のhash）でなければならない（121–131行）。
- 3つのinventoryは包含関係（U2 ⊂ U3 ⊂ U4）にあり、hashは互いに違う。1つの記録の `sourceIdentity` は1つの値なので、3つを同時に満たせない。

そのため、`observe-ci.ts` はU4の記録を1つだけ書き、試験ではU4の `checkCommandCIEvidence` が受け付けることだけを確かめた。Step 19のboxは付けていない。人間に決めてもらう選択肢：
- A：受入のworkflowで、同じcommitからU2とU3の候補も作ってartifactに入れ、`observe-ci.ts` がunitごとに1つずつ記録を書く（計画の「1つ」を「unitごとに1つ」に変える。U2・U3のコードは変えない）。手元のStep 25では、それぞれの候補を作り直し、記録と一致することを確かめる。
- B：mainでのU2・U3の回帰は、U4の完了確認（U2・U3の単体・browser試験、coverage、36試行をU4の候補で流す）で覆うとし、Step 25の(2)(3)（U2・U3の正式な完了確認）を外す。
- C：U2・U3の検査を変える（U1〜U3のやり直しを伴う）。
どれを選んでも、Step 25(2)(3)の書き方は今のままでは実行できない。

### ほかの判断・計画との違い
- completionのartifactは、directory全体ではなく、生log（`*.log`）・JSONの報告・coverageの報告とrealmの台帳・計測の報告と試行を上げる（古いU4のworkflowの一覧に近い）。理由：計測付きの写しやbrowserの結果まで入れるとsizeが読めず、観測側の既存の上限（`ASSET_LIMITS.inputBytes`、約256MB）とzip64のない `unpackZip` を超えるおそれがある（推測）。計画の「全体」と違うので、レビューで確認してほしい。
- 入力の取得は、一覧のsizeを上限にして読み、超えたら止める。CIの受入jobでは、U2の入力（`ci/migration-session/inputs.bundle.json`、追跡済み）を先に戻す必要がある（11件目のguestをそこから取るため）。
- `MISE_TASK_RUN_AUTO_INSTALL` の名前と、mise-actionがPATHに置くもの（shimか実体か）は、公式の文書で確かめていない（推測）。どちらでも、実体のbinを先頭に置くstepと、`command -v` と `mise which` の一致の確認で、shimを使わない。
- 候補のtarballがCIと手元で同じbytesになるか（Step 25の前提）は、npm packの決定性と同じNode・Bun・TypeScriptの版に頼る（推測、未検証）。古い生成JS（上の一覧）が手元に残ると、source identityが一致しない。
- 検証済み：新しい6 file（`acceptance-inputs.ts`・`observe-ci.ts`・`acceptance-ci.test.ts`・`runner-ready.test.ts`・`inputs.json`・`package.json`）に `biome check` がエラー・警告なし。`actionlint 1.7.12` が `.github/workflows/migration-acceptance.yml` にexit 0。`ci/migration-command/inputs.json` が正規形（`JSON.stringify(…, null, 2) + '\n'` と一致）。過去のarchive（`6a70a60e` の親の `ci/migration-install/payload/9c0dd08a….bin`）のSHA256 `9c0dd08a…307f`・size 36727106・10 fileを、書き出さずに読んで確かめた。
- 未検証：typecheck、build、全試験、workflowの実際の動作、mise-actionの動作、GitHubのrelease downloadのredirect先、artifactのZIPの形（`unpackZip` で読めるか。既存の公開の経路が実際のartifactで使っている、ドキュメント根拠）。

### main sessionが次に実行するコマンド（1つずつ、この順に）
1. 古い生成JSを消す（追跡されない、gitignoreされたfileだけ）：
   `rm -- .build/scripts/migration-session/ci.js .build/scripts/migration-session/ci.js.map scripts/migration-session/ci.js scripts/migration-session/ci.js.map runtime/web/app.js runtime/web/app.js.map runtime/web/coi-sw.js runtime/web/coi-sw.js.map runtime/web/sessions.js runtime/web/sessions.js.map runtime/web/worker.js runtime/web/worker.js.map scripts/release/bootstrap.js scripts/release/bootstrap.js.map scripts/release/bundle.js scripts/release/bundle.js.map tests/tooling/publication-bootstrap.test.js tests/tooling/publication-bootstrap.test.js.map tests/tooling/publication-bundle.test.js tests/tooling/publication-bundle.test.js.map`
   と、`rm -- scripts/maintenance/*.js scripts/maintenance/*.js.map tests/tooling/maintenance-*.test.js tests/tooling/maintenance-*.test.js.map`（`scripts/maintenance` は空になる）。
2. `chmod +x mise-tasks/migration/command-observe.sh`（file toolで作ったので実行bitがない。ほかのtaskは `-rwxr-xr-x`）。
3. `mise run lint:all`
4. `mise run typecheck`
5. `mise run build`（終わったら、上の一覧の `.js` が戻っていないことを確かめる）
6. `node --test --test-concurrency=1 tests/migration-command/acceptance-ci.test.js`（17件。fail・skip 0）
7. `node --test --test-concurrency=1 tests/migration-command/runner-ready.test.js`（最新のNodeで。Step 17の残り）
8. `mise run test-light`
9. `mise run migration-command-unit`（7 file。件数とfail・cancel・skip・TODO 0を記録する）
10. `node scripts/migration-command/acceptance-inputs.js inspect ci/migration-command/inputs.json`（networkなしで一覧を確かめる）
11. Step 22のarchive：`jj --ignore-working-copy file show -r '6a70a60e-' ci/migration-install/payload/9c0dd08a854487501c5b2dcd2dc9ce5f703bddf993fc0156586776c2cf63307f.bin` を `.artifacts/migration-install/actual-site-v2.tar.gz` へ書き出し（既存なら止める）、`node scripts/migration-command/acceptance-inputs.js verify-archive .artifacts/migration-install/actual-site-v2.tar.gz` の10行が、`scripts/migration-install/actual-site.ts` の `INSTALL_ACTUAL_SITE_FILES` から11件目（`dist/aube/83a42e28…/guest`）を除いたものと一致することを確かめる。
12. そのあとは計画のStep 22（Releaseは人間が作る）〜26。Step 25の(2)(3)は、上の「止まった点」の判断を受けてから。
## 4回目の再開：新しい土台（upstreamのmain `2a79860`）への合わせ（2026-10-18、Steps 11–16）

review-04のR-09〜R-12を、記録の更新と古い生成物の削除だけで直した。U4の製品コード（`runtime/command*.ts` ほか）と受入の入口のコード（`scripts/migration-command/*.ts`）は変えていない。lint・build・試験・候補作成・完了確認（Step 15）とレビュー・checkpoint（Step 16）はmain sessionが行う。この節の作成時点では、新しい土台でのU4の試験・coverage・36試行・B1の事前確認はどれも未実行（未検証）である。R-05〜R-08（Minor）は今回の範囲外として残す。

**この節より下（Status、実装したもの、追加Stepで直したもの、検証の結果、最終レビューへの対応、未完・未検証）は、古い土台の履歴である。** そこに出てくる `scripts/migration-command/ci.ts`・`ci-inputs.ts`・`mapCommandCICommand`、`.github/workflows/migration-command-u4.yml`、`.github/publication/` の公開runnerの作り直し、生成JSのjj追跡、sourceIdentity `cb49d17b…`（372 file）、pack `61b209ae…`、署名付きhead `9722db3e…`、branch `codex/terrarium-migration-u4`、CI run 39025918280・39029827794、ローカル22工程・B1 31 check・正式36試行・coverage 92.16%、検証コマンドの案 `verify-final-u4.mjs` は、古いsourceに結び付いたもので、新しい土台の成功証拠へ付け替えない。

### 新しい土台の状態（fileで確かめたこと、検証済み）（R-09）
- `git ls-files`：`scripts/migration-command` は `b1.ts`・`completion.ts`・`coverage.ts`・`measure.ts`・`stage.ts` の5件。`tests/migration-command` は12件（`.ts` と `browser-modules.d.ts`）。`ci.ts`・`ci-inputs.ts`・`.github/workflows/migration-command-u4.yml` はない（PR #32で退役）。追跡される `.js` はない（`.gitignore` 9行 `/scripts/**/*.js`、12行 `**/*.js.map`）。生成JSは `mise run build` が作る。
- task：`mise-tasks/migration/command-{unit,browser,stage,completion}.sh` が `bun run migration:command:*` を呼ぶ。実体はpackage.jsonの `migration:command:unit`（6個の個別試験：runner-ready・parse・dispatch・public・consumer・acceptance）、`migration:command:browser`（`consumer.spec.ts` を `--workers=1 --retries=0`）、`migration:command:stage`、`migration:command:completion`。
- 配布：`scripts/package/stage-package.ts` の `FIRST_PARTY_JS` は23件（`runtime/command-parse.js`・`command.js` を含む）、`PACKAGE_FILES` は33件。`tests/package/pack.test.ts` 36–37行が23・33を確かめる。
- `completion.ts`：`requireInstallActualSite(root)`（291行・339行）、`FORMICARIUM_COMMAND_LOCAL_ONLY`（304行）、CI証拠の照合 `checkCommandCIEvidence`（262–280行、`recordKind: 'observed-ci-summary'`）、reportの `status`（384行）・`acceptancePassed: !localOnly && ci !== null`（396行）・blockers（398行）・`b1.formal`（403行付近）。
- `traceability.json`：FR6の対象は `scripts/migration-command/b1.ts`（関連に `completion.ts`・`scripts/migration-install/actual-site.ts`）、NFR8.1は退役した `ci.ts` から `scripts/migration-command/completion.ts` へ、NFR8.2は退役したworkflowから `tests/package/pack.test.ts`（license/noticesの同梱）へ直した。FR6とNFR8.1は、正式受入が今は成立しないのでGAPにした（下の受入の方法）。ほかの対象（runtime 2件、`types/index.d.ts`、`docs/command-api.md`、`scripts/migration-command/{b1,completion,coverage}.ts`、`tests/migration-command/*` 4件、`tests/package/pack.test.ts`、`scripts/migration-install/actual-site.ts`）は、すべて `git ls-files --error-unmatch` で追跡されている（exit 0）。

### 受入の方法（人間が決めた、2026-10-18。U3と同じ）と必須入力（R-10）
古い土台での受入（ローカル22工程、署名付きCI run 39029827794、B1 31 check）は、古いsourceの履歴として残す。新しい土台では、手元のactual-siteと `FORMICARIUM_COMMAND_LOCAL_ONLY=1` で暫定の完了確認だけを行う。その結果は `status: 'local-provisional'`・`acceptancePassed: false`・`b1.formal: false` であり、U4の正式受入でもB1の正式な行でもない。
- (a) actual-site：`completion.ts` は最初に `requireInstallActualSite`（`scripts/migration-install/actual-site.ts` 164–172行）を呼ぶ。これは `U2_ACTUAL_SITE` が `.artifacts/migration-install/actual-site` と一致することを求め、固定11ファイルを検査するだけである。手元には検査済みのcopy（U3の確認で使ったもの）だけがあり、clean checkoutから作る手段（旧 `scripts/migration-install/ci-inputs.ts`・`ci.ts`）は追跡コードにない。したがって、このファイル群は手作業で用意する前提である。ローカル専用モードでも、これがなければcompletionは最初に止まる。
- (b) CI証拠：非localの完了（`verified-with-ci`）は `FORMICARIUM_COMMAND_CI_EVIDENCE` の `recordKind: 'observed-ci-summary'` を求める。追跡コードで `observed-ci-summary` を扱うのは、`scripts/migration-command/completion.ts`・`scripts/migration-install/completion.ts`・`scripts/migration-session/completion.ts` の検査側と、`tests/migration-command/acceptance.test.ts` の試験用の値だけで、書く側（旧 `scripts/migration-command/ci.ts` とworkflow）はない。CI証拠がないとblockersは `['new U4 signed CI not independently verified']` になる。したがって、新しい土台では `verified-with-ci` の完了とB1の正式な行は今は成立しない。
- (c) この2つ（actual-siteの作り方と、CI証拠の作り手または非local受入の要件）は、U1〜U4のまとめた最終確認とterrariumの受入で決める。基準は緩めない。それまでU4は正式受入未了である。

### `source-manifest.json`（R-11）：47件 → 48件
追加した4件：`mise-tasks/migration/command-browser.sh`・`command-completion.sh`・`command-stage.sh`・`command-unit.sh`（PR #29でU4のtaskとして追加されたもの）。48件すべてが `git ls-files --error-unmatch` で追跡対象であることを確かめた（exit 0）。

外した3件と理由（fileとPR #29（`f5bc078`）のdiffを読んで、U4が書いた内容が残っていないことを確かめた）：
- `mise.toml`：U4のtaskはない（`[tools]` だけ。U4のtaskは `mise-tasks/` にある）。PR #29で変わっておらず、最後の変更はmainのPR #24。
- `tests/tooling/publication-alignment.test.ts`：PR #29で変わっておらず（最後はmainのPR #27）、項目7で書いた23件・33fileの期待値は残っていない。
- `scripts/terrarium/coverage.ts`：項目1の `mode: 'strip'`（521行）は、PR #29より前のmainに既にあった（`f5bc078~1` の475行）。PR #29の差分は `HISTORICAL_U1_JS`・`CURRENT_U1_REALMS` などU1の世代の判定で、U4の内容ではない（U1・U2のmanifestがこのfileをclaimしている）。

外さずに残した共有fileと理由（U4が書いた内容が今のfileに残っていることを確かめた）：
- `bun.lock`：Step 1の `@types/node` `^26.6.5`（12行、PR #29で `^26.6.4` から）。U3も同じ行を引き受けてclaimしている。
- `scripts/release/inventory.ts`：項目7の `runtime/command-parse.js`・`runtime/command.js`（35–36行）。
- `tests/package/core.test.ts`：項目5の `'-L', '/dev/null'`（81–82行）。
- `tests/package/coverage.test.ts`：`command`・`command-parse` と23件（832・841–842・1017・1138行）。項目4。
- `tests/package/pack.test.ts`：23件・33件（36–37行）。項目4。
- `tests/package/public.test.ts`：`createCommandSession`（9行）。項目4。
- `tests/terrarium/coverage.test.ts`：`command-parse`・`command` と23件（426–433行）。項目4。
- `tests/migration-install/consumer.spec.ts`・`consumer.test.ts`・`hash-regression.spec.ts`：`u3-install` と `u4-command` の両方を受け付ける（9・13・6行）。項目4。U3もclaimしている。
- `tests/migration-install/lifecycle.test.ts`：模擬portの `resolvePath()`（44行）。項目3。U3もclaimしている。
- `tests/migration-preflight/current-completion.test.ts`：23件と `runtime/command.js`（288–289行）。項目4。
- `tests/migration-session/reservation.test.ts`：`resolvePath` の回帰（228行以降）。項目3。U2もclaimしている。
- `tsconfig.json`：`tests/migration-command/browser-modules.d.ts`（27行）。項目2。
- `tsconfig.tests.json`：`tests/migration-command/types-invalid.ts` の除外（8行）。Step 4。

manifestに加えなかったもの（参考）：`scripts/package/coverage.ts` 383行の許可リストの `command`（古い土台の最後の確認で人間の指示により直したもの）は残っているが、U1〜U3のmanifestが既にclaimしており、この計画のStep 13の対象に入っていないので加えていない。`tests/terrarium/current-candidate.test.ts` の31→33の変更は、mainのPR #34で `PACKAGE_FILES` との照合に置き換わり、U4の内容は残っていない。

### 古い生成物の削除（R-12の一部）と残余リスク（R-12）
- gitignoreされた古い生成物8件を `rm` で消した：`scripts/migration-command/ci.js`・`ci.js.map`・`ci-inputs.js`・`ci-inputs.js.map`（`git check-ignore -v` で `.gitignore` 9行・12行に一致）と、`.build/scripts/migration-command/` の同じ4件（`.gitignore` 5行 `/.build/` に一致）。どれも追跡されておらず（`git ls-files --error-unmatch` は不一致）、対応する `.ts` はない。消したあと、`scripts/migration-command`・`tests/migration-command`・`.build/scripts/migration-command`・`.build/tests/migration-command` のすべての `.js` に、追跡される同名の `.ts` があることを確かめた。`ci*` は0件。
- 残余リスク（R-12）：`commandSourceInventory`（`scripts/migration-command/stage.ts` 47行）と `sessionSourceInventory`（`scripts/migration-session/stage.ts` 62行）は、正規表現 `/\.(?:ts|js|json)$/` でdirectoryを走査し、追跡の有無を見ない。生成 `.js` も拾うので、`sourceFiles`・`sourceIdentity` は追跡sourceだけのmanifestとも、clone直後の状態とも一致せず、build前後でも変わる。消した `ci.js`・`ci-inputs.js` は、残っていればU4のsourceIdentityに入っていた。コードは変えていない。直すと U2の `stage.ts` が変わり、U1〜U3の承認に影響するので、直すかどうかはU1〜U4の最終確認で決める。
- 残余リスク：`completion.ts` 349行の固定値 `coverageReport.files.length !== 23` は、いまの値（23）では正しいが、配布一覧が変わると黙って合わなくなる。直すかどうかはU1〜U4の最終確認で決める。

### Step 15：新しい土台での確認（2026-10-18、main sessionが1つずつ実行、検証済み）
- `mise run lint:all` exit 0（エラーなし。警告48件・情報47件は既存）。`mise run typecheck` exit 0。`mise run build` exit 0（build後も `scripts/migration-command`・`scripts/migration-install`・`.build/scripts/migration-command` に `ci*` は0件）。
- `mise run test:light` exit 0：bun 71件・37件pass、node 125件中123pass・fail 0・skip 2（既存）、tooling 130件pass。
- 候補：`FORMICARIUM_SESSION_SOURCE=2a79860351b7bdeabff8b3424393694943a6a6bb mise run migration-command-stage` exit 0。`.artifacts/migration-command/candidate-d77d6fc3-f79e-4534-bf44-e369865f4981/package.manifest.json`（sourceIdentity `50ce5bc2…d209`、pack SHA256 `430189e8…6625`。packの中身はU3の新しい候補と同じ）。独立consumerは `/private/tmp/formicarium-u4-consumer-20261018`。固定guestは `.artifacts/u2-release-inputs/aube-v2.7.0/aube`。
- `mise run migration-command-unit` exit 0：91件pass、fail・cancel・skip・TODO 0。
- `mise run migration-command-browser` exit 0：9件pass（Chromium・Firefox・WebKit、1worker・retry0）。
- 暫定の完了確認：`.artifacts/migration-command/tls-20261018/run-local-provisional-completion.sh` を人間がターミナルで実行した（ログインkeychainへの一時的な信頼の登録は人間が承認。U3と同じ有効期限1日のlocalhost証明書、SHA256 `c2afea8e…5795`）。`dist/guests/pitchfork` はU3の確認で今のmainの手順で作り直したもの。
  - 全22工程exit 0（出力 `.artifacts/migration-command/completion-81bcc843-3352-489b-aeda-aaea62db0c19`）。`local-provisional-report.json`：`status: 'local-provisional'`、`localPassed: true`、`acceptancePassed: false`、`b1.formal: false`、blockerは `new U4 signed CI not independently verified`、実機Safariは未検証。
  - coverage：23JS、1613 realm、行2055中1894（92.16%）、基準80% passed。
  - 36試行：passed、基準3000ms。非download中央値の最大はBiome/Firefoxの2793.58ms（余裕約7%。aube/Firefox 2010.80ms、ほかは1100ms以下）。ローカル1回の値で、余裕は小さい（U3のR-06と同じ種類の残余リスク）。
  - B1の事前確認：`b1-acceptance.json` の31 checkがすべてpassed。ローカルの行であり、B1の正式な行ではない。
  - 終了後、証明書はkeychainにない（`security find-certificate` exit 44）。
- これはU4の暫定の確認であり、正式受入でもB1の正式な行でもない。正式受入（actual-siteの作り方とCI証拠）は、U1〜U4のまとめた最終確認とterrariumの受入で決める。

## Status

U4（C05の公開command API）の実装、ローカルの正式受入、署名付きCIの照合が、最終的なsourceで成功した。独立した最終レビューと、新しい読取り専用の検証コマンドの承認・設定、U4のcheckpointは、まだ済んでいない。実機のSafariは未検証。

- source：sourceIdentity `cb49d17b41f70d7ac5b962fcbba0328b6481d17ae4d65a07d3eda6e68074b53b`（372 file）、pack `61b209ae1c98690f4f69eeca25c06f6485d05420c339283416e0aff91ea9cb98`（33 file、第一者配布JS 23件）。
- 署名付きhead：`9722db3e254dd73604f42ed4d85cbc53edf35404`（親 `ec8ab359…`、その親 `7c7ceaf4…`。GitHubのverificationはverified・valid）。branch `codex/terrarium-migration-u4`。

## 実装したもの

- `runtime/command-parse.ts`：InputGuard・Tokenizer・ListingFormatter（D1／W2、BR4.2–BR4.7、BR4.11）。孤立surrogateは `isWellFormed()`、byte数は `TextEncoder` の長さ。lsはUTF-16 code unit順。
- `runtime/command.ts`：CommandDispatcher・BuiltinAdapter・InstallAdapter・GuestRunAdapter・ResultBuilder（BR4.1、BR4.8–BR4.17）。判定順は INVALID_INPUT → ABORTED → DISPOSED／BUSY。予約名は `ls` `cat` `rm` `cd` `install`。guest runはtimeoutMsを渡さない。
- 公開API：`runtime/public.ts` の `createCommandSession`、`types/index.d.ts` の `CommandOptions`・`CommandResult`・`CommandSession`。内部portは非公開。
- 配布：第一者配布JSを21件から23件に（`runtime/command.js`・`runtime/command-parse.js`）。
- 受入入口：`scripts/migration-command/{stage,coverage,completion,ci,ci-inputs,b1,measure}.ts` と `.github/workflows/migration-command-u4.yml`（contents read、専用branch、直列、360分、job専用CA、artifact 7日）。
- 文書：`docs/command-api.md`、README.mdのAPI一覧。

## 追加Stepで直したもの（人間の承認による）

1. `scripts/terrarium/coverage.ts` を `mode:'strip'` に（Node 26）。
2. tsconfig.jsonにU4のbrowser型宣言を追加。
3. U2の内部SessionPortに `resolvePath` を追加（U2がBR2.12として引き受け、C02に追記）。
4. 23件に合わせて、U1〜U3の試験・入口の期待値を更新（各Unitがやり直しで引き受け）。
5. blink.log：`runtime/core.ts` の `blinkCore.argv` が先頭で `-L /dev/null` を渡す。回帰試験は `tests/migration-command/public.test.ts`（計画では新しいfileの予定だったが、`mise.toml` を変えるとU1〜U3がやり直しになるため既存のU4のfileに置いた）。`tests/package/core.test.ts` の期待値を更新。
6. U4の薄いmeasure CLI（`scripts/migration-command/measure.ts`）。U3の受入入口からU4への依存をなくし、U4の `stage.ts` の重複定義を削除。
7. 公開用inventory（`scripts/release/inventory.ts`）を23件・33fileに。公開runnerを固定のBun 1.4.3・Biome 2.5.15で作り直した。公開の境界（U4/B1の証拠なしでは23件のpackを公開しない）は維持。
8. U4のCIのcommand対応に `scripts/migration-command/measure.js` を追加し、全工程をCIの対応に通す試験を追加。

ほかに、最後のまとめた確認の中で、`tests/terrarium/current-candidate.test.ts` の期待値（31→33）、U4のNode realmの期待値（U3＋3 worker）、共有の `scripts/package/coverage.ts` のsuiteの許可リスト（`command` を追加）を、人間の指示で直した。どれも先にREDを確かめてから直した。

## 検証の結果（mainの観測、Node v26.12.0）

- ローカルの正式受入（候補 candidate-dd7a49a3、completion-210dad10）：22工程pass、coverage 92.16%（2055行中1894行、23 file、skip 0）、正式36試行pass（最大の中央値 biome/firefox 2559.2ms）、B1の31 checkがpass（ローカルなので `formal:false`）。
- 署名付きCI：1回目（run 39025918280）は `measure` 工程がCIのcommand対応で拒否されてfailure（項目8で修正）。2回目（run 39029827794、attempt 1）はsuccess。job `verify` の全stepがsuccess。artifact sha256:42a8372d…（473608 bytes）。CIの22工程pass、coverage 92.16%、正式36試行pass（Linux HeadlessChrome 156など。最大の中央値 biome/firefox 1785.8ms）、B1の31 checkがpass（sourceCommitは署名付きhead）。sourceとpackはローカルの受入と一致。
- 読取り専用の検証の案（`.artifacts/migration-command/verify-final-u4.mjs`、binding `final-u4-binding-39029827794.json`、binding SHA256 c4c7407b3fe5d7e45ebd251419e48cabb48f7bf8cb3339327244243f7e14e9c3）：開発中の試走でpass（約46秒）。改変の拒否の試験（`verify-final-u4.test.mjs`）は10件pass。この検証コマンドは、人間の承認を受けてから設定する。
- 既存の回帰：test-light（package 194・tooling 237件）、U4のunit 96件、browser 9件、Nodeのcoverage 188件。どれもfail・skip 0。

## 最終レビュー（review-01、NOT-READY）への対応

- Major（検証コマンドがU3のものより弱い）：検証コマンドを直した。U1の固定資産とU4のCI入力manifest（SHA256 48fdb7f5…、CIが使ったものと一致）からformal catalogを作り直し、各試行の `raw.input` とcatalogSha256を照合する。TLSのissuer・subject・protocolとhost benchmarkを照合する。B1のbrowser行は、ログに `[chromium] ›`・`[firefox] ›`・`[webkit] ›` の結果行があることを確かめる。B1の `sourceCommit`（CIは署名付きhead、ローカルはbase revision）と `preflightEvidenceId`（`readPreflightEvidenceId` で読み直した値）は、検証対象の外の値と照合する。署名前のcommit `f5340c80…` と署名付きhead `9722db3e…` のtree（`d7a2b4ef…`）と親を、ローカルのgitで照合する。証明書の削除の受領記録（`.artifacts/migration-command/trust-cleanup-final-u4.json`）を封印し、検証のたびにkeychainに無いことも読取りで確かめる。
- Minor（試験が名前の理由で失敗するとは限らない）：80%・中央値・B1の各試験を、名前の理由で拒否されることを確かめる形に直した。B1では、sourceCommitの違いと、browserのproject結果行の欠落も拒否することを加えた。改変の拒否の試験は10件pass。
- Minor（計画の項目5の記述）：計画に実施時の変更を追記した。
- Minor（README.mdの87行目、docs/command-api.mdの5行目の「未検証」の記述が、署名付きCI成功後の状態と食い違う）：直していない。README.mdはpackに入るので、直すとsourceとpackのidentityが変わり、最後のまとめた確認とCIをやり直すことになる。次にsourceを変えるときに直す。
- Minor（空入力と取消済みsignalの組み合わせ）：設計の判断も試験もない。製品コードの変更になるので、今回は直さず、持ち越す。

## 未完・未検証

- 独立した最終レビュー、新しい検証コマンドの承認と設定、U4のcheckpoint。
- 実機のSafari（WebKitの結果を実機の合格としない）。
- U5〜U9は未着手。U5はU4の完了を開始条件とする。
- publication（npm公開）は、この計画に含めない。
