# U5 fixed-guest-build Code Summary

## Step 46：Build and Test の Loop-back 2（追跡表の target、2026-10-22、人間の決定 A）

この節が、この file の中で最も新しい。下の節は、それぞれの時点の記録として残す。

- 原因（検証済み）：`aidlc engine sensor-traceability --stage build-and-test` は、`OK` の行の target を workspace の中の実在する1つの file の相対 path としてだけ受け付ける（`.claude/tools/aidlc-sensor-traceability.ts` の `codeTargetProblem`）。U5 の `OK` 19行のうち18行は、target が vivarium の `<sha>:<path>` と説明の文で、Fail の原因になった（`.artifacts/build-and-test/sensor-traceability.txt`）。
- 修正（`traceability.json` だけ。製品のコード・試験・基準は変えていない）：
  - `OK`（3行）：`FR9`・`NFR3.3`・`NFR8.2`。target は `scripts/migration-guest-build/verify.ts`。
  - `N/A`（15行）：`FR7`・`FR8`・`NFR2.2`・`NFR3.1`・`NFR3.2`・`NFR3.4`・`NFR3.5`・`NFR4.1`・`NFR4.2`・`NFR5.1`〜`NFR5.4`・`NFR8.1`・`NFR8.3`。理由は「formicarium の workspace の外の aletheia-works/vivarium で実装…この表では N/A とする」。
  - `N/A`（1行）：`NFR2.1`。理由は「U5 は配布 JS を変えない」。
  - 19行すべての `note` に、前の target の文をそのまま移した。表の先頭の `note` に「N/A の行の多くは別のリポジトリで実装した行である」と書いた。
- 確認（検証済み）：直した後の `aidlc engine sensor-traceability --stage build-and-test`（`.artifacts/build-and-test/sensor-traceability-2.txt`）で、U5 の行は未対応に出ない。U5 の理由は各 ID の `not_applicable` に出る。全体の判定は Fail のまま（U7 の `NFR8.1` と、U1・U3 の `GAP`、U9 の `Deferred`。U5 の範囲ではない）。
- 未実施：独立レビューと、intent の検証コマンドによる U5 の checkpoint の確認（Step 47）。

## Step 37・38：review-07 と前からの Minor の修正（2026-10-21、人間の指示）

人間の指示「先ほどの U5 の Minor 3件を直す Step を足す」「前からの Minor 6件（R-02・R-06・R-09・R-13・R-14・R-16）も対象にして下さい」による。土台は formicarium の `main@upstream` `5735433d`（#58、terrarium の削除の後）。

### formicarium 側の code の修正（Step 38、検証済み）
- R-14（不具合の修正の順）：先に `tests/migration-guest-build/verify.test.ts` に「a build-info that is not an object or has no dependency list is refused as input」を足し、直す前に失敗することを観測した（`mise run migration-guest-build-unit`：10件中 pass 9・fail 1。`null` の build-info で `error.code` が `undefined`、`INVALID_INPUT` でない）。そのあと `scripts/migration-guest-build/verify.ts` の `checkSet` で、build-info を読んだ直後に、object であること（`build-info must be an object`）と `dependencies` が配列であること（`build-info dependencies must be a list`）を `refuse` で確かめるようにした。同じ試験が通った。
- R-13：`scripts/migration-guest-build/assets.ts` の `nodeAssets` が `{ directory, assets }` を返すようにし、`verify.ts` の `main()` が `finally` で一時 directory を消すようにした（`createSession` や照合が失敗しても消す。`nodeAssets` の中で書込みに失敗したときも消す）。照合の本体は `verifyWith` に分けたが、中身は変えていない。`verify.test.ts` に「the command line verifies a saved set and leaves no temporary directory」を足した。aube の set を一時 directory に書き、`node scripts/migration-guest-build/verify.js` を子 process で実行して、証拠の file（`--version` の exit 0、ELF の SHA256）ができること、`--out` が無いと `--out is required` で失敗すること、どちらの後も `TMPDIR` に一時 directory が残らないことを確かめる。この試験が直す前に失敗することは観測していない（未検証。R-13 は後片付けの漏れで、直した後の振る舞いを試験で固定した）。（2026-10-22：Step 40 で、assets を書いた後の拒否〈別の `--key`〉の後片付けを確かめる形に改め、`TMPDIR`・`TEMP`・`TMP` を渡すようにした。下の「Step 40」の節。）
- R-13 の重複：`nodeAssets` と `tests/package/fixtures.ts` の `developmentAssets` は、同じ処理だが置き場所を分けたままにする。製品の script が試験の fixture を import しないためで、`developmentAssets` は試験の `t.after` で後片付けを登録する作りである。
- main session で1つずつ実行した（2026-10-21、Node 26.12.0）：
  - `mise run build` exit 0、`mise run typecheck` exit 0。
  - `mise run lint:all` exit 0（警告47・info 47 は既存。変えた3 file は `biome check` で指摘0）。
  - `mise run test:light` exit 0：node 120件中 pass 118・fail 0・skip 2（既存の skip。実際の aube・pitchfork の公式 Release の取得の試験で、Release の資産が手元に無いため）、ほかの組 124件 pass。
  - `mise run migration-guest-build-unit` exit 0：11件 pass、fail・skip 0。

### 今の土台での確認（Step 37 の指摘2・R-16、検証済み）
- intent の検証コマンドの各 task を、`5735433d` の上で main session が1つずつ実行した（2026-10-21）。`typecheck`・`build`・`test:light`・`migration-guest-build-unit` は上のとおり。`migration-preflight-unit` exit 0（57件 pass）、`migration-preflight-current-unit` exit 0（21件 pass）、`showcase-unit` exit 0（100件 pass）。どれも fail・skip 0。
- 下の「Step 22」の件数（9件など）は、2026-10-18 の土台 `2a79860` での結果である。今の土台の結果は上のとおりで、これが R-16（Step 22 の件数を再実行していない）に代わる。保存済みの Release 2組への照合（`migration-guest-build-verify`）は、今回は再実行していない（R-13 の子 process の試験が同じ `main()` の経路を通る）。
- `package.json` の U5 の2行（`migration:guest-build:unit`・`migration:guest-build:verify`）は、今は106–107行にある。下の節の「104–105行」「105・106行目」は、それぞれの記録の時点の行番号である。
- `verify.ts` の13行は U1 の `scripts/migration-preflight/unique-json.ts`（`parseUniqueJSON`。重複 key の拒否）に依存する。U1 のこの file を変えるときは、U5 の `migration-guest-build-unit` も実行する。

### 試験の前提（Step 37 の指摘1）
- `verify.test.ts` は、追跡されない生成物 `dist/blink/`（`blink.mjs`・`blink.wasm`・`build-info.json`）と `dist/guests/`（aube・hello・exit3・probe）を読む。`mise run build` は tsc と `scripts/emit.ts` だけで、これらを作らない。`dist/blink/` は `mise run build-blink-wasm`、`dist/guests/` は `mise run build-guests` が作る。aube はゲストのソースが変わっていなければ再ビルドしない（1時間以上かかる）。`unit-test-instructions.md` にも書いた。下の「R-14の後半」の「`mise run build` を先に実行するので、通常は満たされる」は誤りだった。

### Step 30 の印（Step 37 の指摘3）
- 計画の Step 30 の本文にある「review-05 の R-01・R-04 により未完了に戻した」は、review-05 の時点の経過である。そのあと Step 32 で計画の file の SHA256 の一致を確かめ、人の回答「2は完了にして下さい」（2026-10-19、上の「人の確認」）で完了にしたので、印は `[x]` である。計画の Step 30 の本文は変えない。

### R-02（記録だけ）
- 壊れた mbx の cache で build が失敗するか同じ digest になるかは、本物の mbx では未検証である。container での実際の build が要るため、今回は試験を作らない。上流の試験（#536）は、壊れた cache で build が失敗したときに artifact と作業 directory が残らないことだけを確かめる。mbx あり／なしで同じ ELF digest（`3d7e7e8c…`）になることは、実 CI の run 39073445357 と 39080082205 で確かめた。`traceability.json` の NFR5.4 をこれに合わせた。

### PR（Step 38・39、人間の承認による）
- formicarium：PR aletheia-works/formicarium#59（`fix/guest-build-verify-input`、1 commit・3 file、署名あり）。CI の lint の失敗は CI が入れる最新の Biome 2.6.2 によるもので、#59 の変更が原因ではなかった。人間の指示で Biome の更新を別の PR aletheia-works/formicarium#60（merge `66bb684a`）にし、#59 をその上と、dependabot の #61（`9f79fb2c`）の上に rebase した。head `5f3306f0`、merge `d9772f84`（検証済み：GET）。rebase の後に Biome 2.6.2 で lint:all・build・`migration-guest-build-unit` 11件が通った。
- vivarium：PR aletheia-works/vivarium#553（`docs/fixed-guest-builder-withheld-env`、1 commit・1 file、署名あり）、merge `23e9f452`（検証済み：GET）。

### Step 39：R-09・R-06（2026-10-21）
- R-09：`aletheia-works/vivarium@23e9f452:tools/fixed-guest-builder/src/process.ts` の `WITHHELD` の上に、名前による除外の限界（`*_KEY`・`SSH_AUTH_SOCK` などは外れない。秘密を足す workflow はここにも足す）を2行のコメントで書いた。振る舞いは変えていない。merge 前の手元で `mise run ci:fixed-guest-builder` exit 0（188 pass・0 fail・行 98.49%。出力の `could not compile` は build の失敗を模す試験のもの）。
- R-06：人間の承認で、JamBalaya56562 のアカウントで `fixed-guest-bump.yml` を1回起動した（recipe `src/layer1_wasm/biome-migrate-override-bracket-spacing/recipe.json`、role `baseline`）。run 39608682081（`workflow_dispatch`、head `23e9f452`）は success で、全 step（`Leave the merge to a person` を含む）が success（検証済み：jobs の GET）。起動の前の `git ls-remote` では、baseline の branch `main` の先端は `bbbd95d7`、fix の branch の先端は宣言どおり `a5bd0ce8` だった。
- できた PR は aletheia-works/vivarium#554（作者 `app/aletheia-works-bot`、head `131df6d2`、変更は recipe.json の1 file）。GraphQL で `autoMergeRequest` は `null`、timeline には `AutoMergeDisabledEvent`（2026-10-21T13:32:32Z、actor `aletheia-works-bot`）があった（検証済み）。これで R-06（auto-merge が外れること）を実 run で確かめた。`AutoMergeEnabledEvent` は timeline に出ず、有効だった間の長さは確かめていない。PR は merge しない（人間が閉じる）。
- 新しく気付いたこと（未対応・記録のみ）：#554 の差分は baseline の `commit` を `bbbd95d7` に動かすほか、recipe.json の `tags` と `reference` の1行の配列・object を複数行に書き直している（bump の CLI が JSON を書き直すときに元の書式を保たない）。`accepted` は変わっていない。直すかどうかは別に決める。

### Step 40：review-08 の Minor 3件（2026-10-22、人間の指示、PR aletheia-works/formicarium#62 で merge 済み `2faec369`）
- 指摘2（不具合の修正の順）：先に `tests/migration-guest-build/verify.test.ts` に、`dependencies` に object でない要素（`[null, …]`）がある build-info と、`null` の catalog・`entries: [null]` の catalog の試験を足した。直す前は2件が失敗した（12件中 pass 10・fail 2。どちらも `error.code` が `undefined` の `TypeError`）。`dependencies: [null]` の1要素だけでは、`guestBuildKey` の並べ替えが比較を呼ばず `does not follow`（`INVALID_INPUT`）になるので、2要素で試した。そのあと `scripts/migration-guest-build/verify.ts` に `isObject` を足し、`checkSet` で build-info・各 dependency・catalog・catalog entry が object であることを `refuse` で確かめるようにした。同じ試験が通った（12件 pass）。
- 指摘1：CLI の試験に、assets を書いた後の拒否（別の `--key`。`another key`）を足し、その後も一時 directory が残らないことを確かめる。必須の引数が無い場合は assets の前に拒否されるので、拒否の内容だけを確かめる形にした。子 process に `TMPDIR`・`TEMP`・`TMP` を渡す。`main()` の `finally` の `rm` を一時的に外すと、この試験が失敗し（12件中 fail 1）、戻すと通ることを確かめた（検証済み）。
- 指摘3：下の古い節の「`mise run build` を先に実行するので、通常は満たされる」に、誤りである旨の注記を足した。
- 確認（`main@upstream` `d9772f84` の上の change、Biome 2.6.2 の別の作業場所で main session が1つずつ実行）：`mise run lint:all` exit 0（エラー0）、`typecheck`・`build` exit 0、`test:light` exit 0（node 120件中 pass 118・skip 2〈既存〉、ほか 124件 pass）、`migration-guest-build-unit` exit 0（12件 pass）。

### Step 41：bump の PR の題（2026-10-22、人間の指示、PR aletheia-works/vivarium#555 で merge 済み `f4be3299`）
- 原因（検証済み）：bot の PR aletheia-works/vivarium#554 の Commitlint（run 39608896977）が、commit の題 `fixed-guest: bump baseline in src/layer1_wasm/…/recipe.json` を `type-empty`・`subject-empty` で拒否した。`bot-pull-request` は PR の題をそのまま commit の題に使う。
- 修正（vivarium の `main@upstream` `23e9f452` の上の change）：先に `tools/fixed-guest-builder/tests/workflows.test.ts` の期待を `chore(layer1): bump the ${{ inputs.role }} guest of ${{ steps.bump.outputs.slug }}` に変え、失敗を観測した（13件中 fail 1）。そのあと `.github/workflows/fixed-guest-bump.yml` で bump の step に `slug` の出力を足し、PR の題をその形にした。今回の recipe では題は80文字で、100文字以内。
- 確認（vivarium、1つずつ）：`bun test tests/workflows.test.ts` 13件 pass、`mise run ci:fixed-guest-builder` exit 0（188 pass）、`fixed-guest-builder:check`・`fixed-guest-builder:typecheck`・`actions:check` exit 0。`mise run lint:all` は `shell:check` が手元の macOS の bash に `globstar` が無いため動かず（今回の変更と無関係、未検証）。
- PR：aletheia-works/formicarium#62（Step 40、head `099e31a7`、1 commit・2 file、署名あり、親 `d9772f84`）、aletheia-works/vivarium#555（Step 41、head `8e7cf139`、1 commit・2 file、署名あり、親 `23e9f452`）。#62 は merge `2faec369`、#555 は merge `f4be3299`（検証済み：GET、2026-10-22）。#554 は人間が閉じた。

### Step 42：bump の PR を自動で merge する設計への変更（2026-10-22、人間の決定、PR aletheia-works/vivarium#556 で merge 済み `dee1ba5e`）
- 設計：D7 の「PRのmergeは人が行う」を、必須の check がすべて通ったら自動で merge する、に変えた。`nfr-design/security-design.md` の D7 に日付つきの注記を足した（元の文は残した）。要件（FR8・NFR3.5）は merge の方法を決めていないので変えていない。branch の直接の解決、D1 の確認、記録、PR を作る job だけの書込み権限は変えていない。宣言の `commit` だけが動き、`accepted` は変わらない。
- 影響：宣言の branch の先端（baseline は biome の `main`、fix は fork の branch）が、必須の check を通れば人の確認なしに vivarium の main の宣言に入る。新しい commit の build と受け入れは、これまでどおり人が行う。
- 修正（vivarium、#555 の branch の上の change。#555 と同じ file に触るため）：先に `tools/fixed-guest-builder/tests/workflows.test.ts` の試験を「open bump PRs with the bot and let them merge themselves」（`bot-pull-request` が最後の step で、`--disable-auto` が無いこと）に変え、失敗を観測した（13件中 fail 1）。そのあと `.github/workflows/fixed-guest-bump.yml` から「Leave the merge to a person」の step とその前のコメントを外し、PR の本文を「It merges itself once the required checks pass. The fixed build for the new key runs separately.」にした。`tools/fixed-guest-builder/README.md` の bump の説明を同じように直した。
- 確認（vivarium、1つずつ）：`bun test tests/workflows.test.ts` 13件 pass、`mise run ci:fixed-guest-builder` exit 0（188 pass）、`fixed-guest-builder:check`・`fixed-guest-builder:typecheck`・`actions:check`・`markdown:check` exit 0。
- PR：aletheia-works/vivarium#556（`feat/fixed-guest-bump-auto-merge`、head `8a8f3cf5`、1 commit・3 file、署名あり、親 `f4be3299`）。#555 の merge の後の main に rebase してから、試験 13件・builder の CI 188件・`actions:check` を再実行して通った。merge `dee1ba5e`（検証済み：GET、2026-10-22）。
- R-06：前提（auto-merge を外す）がこの変更で無くなった。#554 での確認は、変更前の設計の証拠として残す。
- 未検証：変更後の bump の実 run で PR が実際に自動で merge されること（repository の auto-merge の設定と必須の check に依る）。

### Step 43・44：review-09・10 と NFR Design review-03・04 の Minor（2026-10-22、人間の指示、記録と設計だけ）
- 必須の check の読み方（検証済み）：2026-10-22 に `gh api repos/aletheia-works/vivarium/rules/branches/main` を読み、`required_status_checks` が10個（`Unit (resolveReproFile)`・`Polyglot lint`・`check / Commitlint`・`E2E (chromium|firefox|webkit)`・`regression (chromium|firefox|webkit)`・`Test MCP server`）だった。同じ読取りで、ruleset の種類は `deletion`・`required_linear_history`・`required_signatures`・`pull_request`・`required_status_checks`・`non_fast_forward`。
- bot の PR での報告（検証済み）：`gh pr checks 554 --repo aletheia-works/vivarium` で、recipe.json だけを変える bot の PR に10個すべてが報告され、9個が pass、`check / Commitlint` だけが fail（題の形。#555 で直した）。ほかに必須でない check（`Test fixed guest builder` など）も pass、`auto-merge`・`bump Layer 1 runtimes`・`review` は skip。
- ruleset の迂回（未検証）：`gh api repos/aletheia-works/vivarium/rulesets/23666241` は `bypass_actors: null`、`current_user_can_bypass: never` を返した。私たちの権限では迂回できる相手を読めないので、App が迂回できるかは未検証。
- token の権限：`fixed-guest-bump.yml` の top-level の権限は `contents: read`・`actions: read`。PR の作成は `actions/create-github-app-token` の App token（`permission-contents: write`・`permission-pull-requests: write`）。これを D7 に分けて書き、Threat Response に bot の資格情報の脅威を足した（`nfr-design/security-design.md`）。
- `commit` と `accepted` が違う間：aletheia-works/vivarium@f4be3299 の `src/layer1_wasm/_shared/formicarium_terminal.ts`・`src/layer1_wasm/biome-migrate-override-bracket-spacing/repro.ts`・`docs/scripts/stage-formicarium-assets.ts` を読み、配布と照合が `accepted` の commit・`buildKey`・digest で行われることを確かめた（読んだだけで実行していない）。D7 に書いた。
- NFR8.2 の裏付け（検証済み）：Step 40 の後の checkpoint の確認（`aidlc engine bolt checkpoint --action verify --unit u5-fixed-guest-build --kind unit`）は 2026-10-21T19:52:14Z–19:53:07Z に exit 0（intent の検証コマンド、`migration-guest-build-unit` は12件）。そのときの作業場所の中身は、formicarium の `5735433d` に #59・#62 の3 file と `.gitignore` を足したもの（#60・#61・#63 は入っていない）。
- `traceability.json` の FR8 の「push 前」を merge 済み（#556 `dee1ba5e`）に直した。

### Step 45：review-11 と NFR Design review-05 の Minor（2026-10-22、人間の指示、記録と設計だけ）
- `traceability.json` の FR8 で2回あった #556 と「変更後の実 run は未検証」の文を1つにした。
- `nfr-design/security-design.md` の D7 と Threat Response で、確かめたこと（`fixed-guest-bump.yml` を読んだ token の権限と `secrets.BOT_PRIVATE_KEY` の受け取り、`gh api` で読んだ ruleset の種類と必須の check、#554 の check の報告、`bypass_actors` が読めないこと）と、未検証のこと（repository の auto-merge が有効か、ruleset の `pull_request` が承認の数を求めるか、secret の置き場所の水準と読める人、App が ruleset を迂回できるか、変更後の bump の実 run での自動の merge）を分けた。未検証のことは次に bump を実際に動かすときに確かめる。

## 人の確認（2026-10-19）

- 確認の run 39196723994 の承認の画面に、承認を待つ job の名前 `publish 5c1fbc28…86ac86` が出ていて、prepare の job summary の計画の SHA256 と同じだった（人の回答「1は出ていましたし、同じでした」）。これで Step 36 の「人に確かめてもらう」を満たした。
- Step 30 の「job summary の計画の SHA256 を確かめる」は、summary の本文を REST で読めないため、計画の file の SHA256 の一致（Step 32）で代える。人の回答「2は完了にして下さい」により Step 30 を完了とした。旧い形の fix の run 39188781155 は取り消されず、承認の後に `VERIFY_FAILED` で止まり、何も書かなかった（記録済み）。
- 残る未検証：build から `workflow_call` で呼ぶ経路（この run は `workflow_dispatch`）と、そのとき呼ばれた publish の job が順番の待ちの対象に見えるか、2つの release が実際に重なったときの待ち。次に build から release まで通すときに確かめる。

## Step 36：#540 の merge と確認の run（2026-10-19）

外部操作（push・PR・merge・workflow の起動・environment の承認）は、人の承認を受けて main session と書込み権限のある人が行った。この記録のために行ったのは、vivarium の `jj git fetch`・`jj diff` と `gh api` の GET だけである。

### merge（検証済み）
- PR aletheia-works/vivarium#540 は merge commit `a80df74e` で main に入った（main session の報告。PR head `17a02b65`、署名は有効）。`jj git fetch` の後の vivarium の log で、`a80df74e`（`fix(tools): show the plan SHA256 at approval and take release turns without a concurrency group (#540)`）が `c15d5bfa`（#539）の次にあることを確かめた。
- `jj diff --from 18ab5807 --to a80df74e --stat` と `jj diff --from 17a02b65 --to a80df74e --stat` は、どちらも「0 files changed」だった。つまり、上の節で試験した手元の change と PR head と merge の tree は同じである。`a80df74e` の変更は上の節の15 file（627行追加・49行削除）。
- 上流の参照は `aletheia-works/vivarium@a80df74e:.github/workflows/fixed-guest-release.yml`・`fixed-guest-build.yml`、`aletheia-works/vivarium@a80df74e:tools/fixed-guest-builder/src/turn.ts`・`busy.ts`・`cli.ts`・`github.ts`・`release.ts`・`README.md`、`aletheia-works/vivarium@a80df74e:tools/fixed-guest-builder/tests/turn.test.ts`・`busy.test.ts`・`cli.test.ts`・`workflows.test.ts`・`release.test.ts`・`prepare.test.ts`・`helpers/fake-github.ts` とする。
- 未検証：#540 の上流 CI の結果と、merge 後の main での `mise run ci:fixed-guest-builder` の再実行。この記録では確かめていない。

### 人の決定
- 重なった build は、今の形（待たずに `BUSY` と原因で止める）のままにする（人の回答 A、2026-10-19）。上の節の「人の判断が要る点」の1件目は、これで決まった。

### 確認の run 39196723994（main session の GET で検証済み。job の名前と step の結果は、この記録のための jobs の GET でも確かめた）
- `workflow_dispatch` で、head は `a80df74e`、入力は `build_run_id` 39178190974（baseline の build）。
- `prepare` は success だった。
- `publish` job の名前は `publish 5c1fbc28ff267a350c13b969d3337288240182aaf6e3e0cb8c04d732fb86ac86` で、log の `PLAN_SHA256` と同じ値だった。
- environment `fixed-guest-release` は JamBalaya56562 が承認した。
- step `Wait for the publish turn` は success で、`waitedMs` は 14398 だった。動いている run はほかに無かった。
- step `Publish under the approved plan` は success で、結果は `"status": "already-published"` だった。
- Release `guest-biome-086287f8…322c` は変わっていない。`published_at` は 2026-10-19T02:50:35Z のままで、3つの asset の digest も同じである。

### 残る未検証
- `workflow_call` の経路（build の最後から release を呼ぶ形）。確認の run は `workflow_dispatch` だけで、この経路を通っていない。
- 呼ばれた publish job が、呼んだ build の run の jobs に steps 付きで出て、turn の待ちの対象になるか（推測のまま）。
- 承認の画面の表示が、人にどう見えたか。job の名前が承認の画面に出て、summary の SHA256 と見比べられたかは、人の確認を得ていない。job summary の本文も、REST では読めないため未確認のまま。
- 2つの release が実際に重なったときの待ち。
- `source-manifest.json` は変えていない。この file は formicarium で追跡される U5 の file だけを書く形（R-12）で、#540 は formicarium の file を変えていない。上流の file は `traceability.json` に上流の形で書いた。

## Steps 32–36：review-05 の指摘の修正（2026-10-19）

vivarium の fork で `jj git fetch`（「Nothing changed.」）の後、`main@upstream` `c15d5bfa`（#539 の merge）の上の空の change に bookmark `fix/fixed-guest-release-approval` を付けて作った。push・PR・workflow の起動・GitHub への書込みはしていない（Step 36 の外部操作と、Step 31 は未実施）。

### Step 32：計画の artifact の照合（R-01、検証済み）
- `gh run download <run> --repo aletheia-works/vivarium --name fixed-guest-plan --dir .artifacts/u5-fixed-guest-build/plans/<run>` で、run ごとに空の directory へ取った（読取りだけ。中身は `plan.json` 1つ、各 1135 bytes）。file は信用しない data として、hash と読取りだけをした。`.artifacts/` は追跡されない。
- `shasum -a 256` の結果：
  - 39191728502（baseline）：`6c338e0185b80e2b17512d68d0ebcfef448c02013e4eef06cf3cc4230cd63981`。log の `PLAN_SHA256` と一致。
  - 39191750168（fix）：`90a3b5f26d70ce827772f076e38249698bde325a67cc0bd60eb63e024ad47e58`。log の `PLAN_SHA256` と一致。
- artifact の metadata（`gh api .../runs/<run>/artifacts` の GET）：baseline は id 12159988807・645 bytes・zip `sha256:f4e3c1d3…f8246e`、fix は id 12159239749・646 bytes・zip `sha256:44fa568e…d2c02`。Step 30 の記録と一致する。
- 計画と Release（`gh api .../releases/tags/<tag>` の GET）の照合。どちらの Release も draft・prerelease ではない。
  - baseline：計画の `targets` は tag `guest-biome-086287f8…322c` と `biome`・`build-info.json`・`catalog.json` で、Release の asset の名前と同じ。`inputDigests` の `elfSha256` `97c88a1c…b7a6`・`buildInfoSha256` `80f07338…f0d5`・`catalogSha256` `20b78f3f…1412` は、asset の digest と一致した。`buildKey` は tag の key と同じ。
  - fix：tag `guest-biome-dabb518b…c24d`。`elfSha256` `364ef17d…ff84`・`buildInfoSha256` `00bb12d6…f357`・`catalogSha256` `df8feef3…0f10` が asset の digest と一致した。
  - どちらの計画も `approvalReference` は自分の release の run の URL、`acceptanceEvidenceIds` は build の run（39178190974・39178274922）。
- 不一致は無かったので、止めずに進めた。job summary の本文そのものは、今も REST で読めない（未検証）。

### Step 34 の前に読んだ GitHub の公式の文書（文書根拠）
- https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax （`concurrency`）と https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency ：group で同時に動くのは1つで、待つものは `pending` になる。既定の `queue: single` では pending は1つだけで、新しいものが来ると既にある pending の job や run は取り消されて置き換わる。`cancel-in-progress` は動いているものの取り消しの設定で、pending の取り消しを止める設定としては書かれていない。`queue: max` にすると pending は100まで FIFO で持てる（`cancel-in-progress: true` とは併用できない）。
- 同じ文書は、`workflow_call` で呼ばれた workflow の concurrency には触れていない。reusable workflow の文書（https://docs.github.com/en/actions/how-tos/reuse-automations/reuse-workflows ）も触れていない。
- context の表（https://docs.github.com/en/actions/reference/workflows-and-actions/contexts ）：`jobs.<job_id>.name` は `needs` を使える。
- `queue: max` を使えない理由（検証済み）：最新の actionlint 1.7.12（2026-03-30 公開、`gh api` で確認）が `unexpected key "queue" for "concurrency" section` で拒否した（`.artifacts/u5-fixed-guest-build/scratch/queue-check.yml` で確認）。vivarium の CI は actionlint を通すので、この方式は採らなかった。

### 選んだ形（Steps 33–35）
- Step 33（R-01）：`fixed-guest-release.yml` の `publish` job の `name` を `publish ${{ needs.prepare.outputs.plan_sha256 }}` にした。`PLAN_SHA256` の env と同じ式で、prepare の出力の値は summary の `Plan SHA256` と同じ値（`cli.ts prepare` が両方に同じ `plan.sha256` を書く。既存の cli の試験で確かめている）。README に「承認の前に、job の名前の SHA256 が summary の値と同じことを確かめ、計画を読む」と書いた。承認の画面に job の名前がどう出るか（`workflow_call` のときは `release / publish <sha>` と出るか）は推測で、Step 36 の merge 後に人が確かめる。
- Step 34(a)（R-08・R-02）：release の workflow の concurrency group を外した。`publish` job に step `Wait for the publish turn`（`cli.ts publish-turn`）を、書込みの step の直前に置いた。`src/turn.ts` の `waitForPublishTurn` は、`fixed-guest-release.yml` と `fixed-guest-build.yml` の `in_progress` の run の job を読み、その step を持つ job（publish の job。呼ばれた release も含むことを狙う）のうち、(1) turn の step を成功で終えて書いているもの、又は (2) まだ待っていて run ID が自分より小さいもの、が居る間は待つ。待ちは 5秒から倍にして60秒まで、上限20分（publish job の timeout 30分の内。既存の publish は26秒で終わった：run 39191728502 の job の時刻、検証済み）。上限を超えたら何も書かずに `BUSY`（exit 2）で、待っている run ID と「build の run ID で release をもう一度起動する」ことを出す。空いたと見たときは、step の状態の遅れに備えて10秒後にもう一度確かめてから進む。承認を待つ間は group に入らないので、承認待ちが後の release に取り消されることも、ほかの release を止めることもない。
- Step 34(b)（R-07）：`checkNotBusy` に job の条件を足し、build は他の run の `build <tool>` job が `in_progress` のときだけ BUSY にする（`isBuildJob`）。release の段階だけが動いている build の run は数えない。bump は今のまま（run 単位）。
- Step 34(c)：build の job の concurrency group（`fixed-guest-build`）も同じ取り消しが起こり得る（文書根拠）。job の timeout は 4時間の build の期限と後片付けで埋まっていて、job の中で長く待つ余地が無い（timeout は延ばさない）。そこで group を外し、他の build が動いている間に始めた build は、待たずに `BUSY`（exit 2）で原因を出して止める形にした。黙って取り消されることはなくなるが、2つ目の build は待たずに失敗する（人の判断が要る点に書いた）。
- Step 35（R-03）：`publishSet` に `allowlist` を必須の入力として足し、何かを読む・書く前に `identity.repository` が `allowlist.json` の `repositories` にあることを確かめる。無ければ `INVALID_INPUT` で何も書かない（公開済みの key の検証だけの経路でも同じ）。`cli.ts release` は publish の時点で `allowlist.json` を読む。R-06（#539 の原因は推測のまま）は記録だけ：#539 は `c15d5bfa` で merge 済み（検証済み）、merge 後の CI での再発は未観察。
- 変えていないもの：build key を決める file（`container/build.sh`・`tools.json`・`src/key.ts`）、C12 の計画と照合、job ごとの権限（広げていない）、production の既定値、coverage の閾値と各 timeout。

### 変えた file（上流 vivarium、bookmark `fix/fixed-guest-release-approval`、未 push）
- `.github/workflows/fixed-guest-release.yml`、`.github/workflows/fixed-guest-build.yml`
- `tools/fixed-guest-builder/src/turn.ts`（新規）、`src/busy.ts`、`src/cli.ts`、`src/github.ts`（`runJobs` が steps も返す）、`src/release.ts`、`README.md`
- `tools/fixed-guest-builder/tests/turn.test.ts`（新規）、`tests/busy.test.ts`、`tests/cli.test.ts`、`tests/workflows.test.ts`、`tests/release.test.ts`、`tests/prepare.test.ts`（job の形に `steps` を足しただけ）、`tests/helpers/fake-github.ts`

### RED と GREEN（vivarium の root で1つずつ実行。bun は実体 `/Users/mutoakio/.local/share/mise/installs/bun/latest/bin/bun`、Bun 1.4.3）

| command | 修正前（RED、検証済み） | 修正後（GREEN、検証済み） |
|---|---|---|
| `bun test tools/fixed-guest-builder/tests/busy.test.ts tools/fixed-guest-builder/tests/workflows.test.ts` | 17 pass・3 fail：`checkNotBusy > counts only the other runs whose matching job is in progress`（`Received: "BUSY"`）、`never park a build or a release in a concurrency group`（build job に group）、`show the plan SHA256 in the name of the job waiting for approval`（`Received: "publish"`） | 20 pass・0 fail |
| `bun test tools/fixed-guest-builder/tests/prepare.test.ts tools/fixed-guest-builder/tests/release.test.ts` | 21 pass・2 fail：`writes nothing when the repository has left allowlist.json since the build`（`Received: undefined`）、`reads a run, its latest jobs and its artifacts…`（steps が無い） | 23 pass・0 fail |
| `bun test tools/fixed-guest-builder/tests/turn.test.ts`（新規 file。手順書の command に無いので足した） | 0 pass・1 fail：`Cannot find module '../src/turn.ts'` | 7 pass・0 fail（後で2件足して9件） |

- その後に足した試験（test-after）：`isBuildJob`、CLI の `publish-turn`（exit 0 と、他が先に居るときの exit 2・`BUSY`）、既定の待ちの上限が publish job の timeout から5分を引いた内にあること、turn の step が失敗した job を待たないこと。

### 回帰（Step 36 の手元の部分、1つずつ実行）

| command | 結果 |
|---|---|
| `mise run ci:fixed-guest-builder`（1回目） | 検証済み：`tsc --noEmit` 成功、186 pass・0 fail だが exit 1。Bun の関数 coverage の既定の閾値で `src/turn.ts` が 88.89%（既定の `sleep` が試験を通らない）。閾値は変えず、上の試験を足した |
| `mise run ci:fixed-guest-builder`（2回目） | 検証済み：exit 0、188 pass・0 fail・571 expect、行 98.49%・関数 98.49%（`src/turn.ts` 関数 100%・行 98.39%） |
| `mise run fixed-guest-builder:check` | 検証済み：47 file、指摘なし |
| actionlint 1.7.12（実体、`-shellcheck` に ShellCheck 0.11.0 の実体）`fixed-guest-build.yml`・`fixed-guest-release.yml`・`fixed-guest-bump.yml`・`test-fixed-guest-builder.yml` | 検証済み：exit 0 |
| ShellCheck 0.11.0（実体）`container/build.sh`・`tests/fixtures/fake-docker.sh`・`stuck-git.sh` | 検証済み：exit 0 |

- 整形は package の Biome（`tools/fixed-guest-builder/node_modules/.bin/biome format --write`）を、変えた file だけに当てた。
- tool の版（検証済み、`gh api` の latest release）：Bun 1.4.3、actionlint 1.7.12、ShellCheck 0.11.0 はどれも最新。
- commit message：`fix(tools): show the plan SHA256 at approval and take release turns without a concurrency group`（本文の最後に `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`）。

### 記録の修正（R-04・R-05）
- R-04：計画の Steps 24–29・29a に印を付けた（#538 `e9084941`・#539 `c15d5bfa` で merge 済み、検証済み）。Step 30 の本文の経過の注記は計画に既にある（計画は印のほかは変えない）。Step 30 は、Step 36 の merge 後に承認の画面を確かめるまで未完のまま。
- R-05：`traceability.json` の NFR2.2 を最新の件数（#539 の後 174件・98.49%、今回の change 188件・98.49%）に、NFR4.1 を「#539 は c15d5bfa で merge 済み、merge 後の CI での再発は未観察」に直した。上の「Step 31」の節の「#539 は未 merge」は、その時点の記録である。

### 人の判断が要る点と残るリスク
- 人の判断：build が重なったとき、今は待たずに `BUSY` で止まる（黙った取り消しは無くなる）。待たせたい場合は、build の前に待つための別の job を置く形が要る（Actions の分数を使う）。どちらにするか。
- 推測：呼ばれた workflow の job は、呼んだ build の run の jobs に steps 付きで出る（既存の `prepare.test.ts` が仮定する名前 `release / prepare` と同じ前提）。実 run で確かめていない。出ない場合、build から呼ばれた publish は待ちの対象に入らず、書込みの重なりは `publishSet` の draft → 検証 → publish で抑えるだけになる。
- 推測：step の状態の反映の遅れは10秒の再確認で足りると考えた。2つが同時に turn を取る窓は小さく残る（その場合も公開済みは消さず、上書きもしない）。
- Step 36 の外部操作（fork への push、上流への PR、merge 後の release の経路の1回の実行と、承認の画面の job の名前と summary の SHA256 の照合）は未実施。それぞれ内容を示して承認を受ける。

## Step 31（記録の部分）：6回目の再開（Steps 24–30・29a）のまとめ（2026-10-19）

独立レビューと intent の検証コマンドによる checkpoint は、この記録の後に main session が行う（未実施）。

### 上流 vivarium の本体
- 検証済み（`gh api` の GET と、vivarium の `jj diff -r e9084941 --stat`）：Steps 24–29 の変更は PR #538 で merge された（`e9084941`、14 file）。参照は上流の形で書く：
  - `aletheia-works/vivarium@e9084941:tools/fixed-guest-builder/src/prepare.ts`（新規）、`src/cli.ts`・`src/github.ts`・`src/reuse.ts`・`src/busy.ts`
  - `aletheia-works/vivarium@e9084941:tools/fixed-guest-builder/tests/prepare.test.ts`（新規）、`tests/helpers/fake-github.ts`（新規）、`tests/busy.test.ts`・`tests/cli.test.ts`・`tests/release.test.ts`・`tests/workflows.test.ts`
  - `aletheia-works/vivarium@e9084941:.github/workflows/fixed-guest-release.yml`・`fixed-guest-build.yml`、`aletheia-works/vivarium@e9084941:tools/fixed-guest-builder/README.md`
- 検証済み：`71e0ef92..e9084941` で builder と `fixed-guest-bump.yml` に触れた commit は、#538 と #537（`b6ce42a9`、U6 の変更）の2つ。#537 の分（`src/bump.ts`・`tests/bump.test.ts`・`fixed-guest-bump.yml` など）は U5 のこの再開の変更ではない。
- 検証済み：build key を決める file（`container/build.sh`・`tools.json`・`src/key.ts`）は #538 で変わっていない（#538 の14 file に含まれない）。
- Step 29a の修正は PR aletheia-works/vivarium#539（head `fix/fixed-guest-builder-size-limit-test`、`e3ae7d78dd0e4ee853557ce0cdbc9da7ce4cde83`、1 commit、base `main`）。GET で `state: open`・`merged: false`、つまり未 merge であることを確認した（検証済み）。対象は `tools/fixed-guest-builder/src/pipeline.ts`・`tests/pipeline.test.ts`・`tests/fixtures/stuck-git.sh`。merge されるまで、`e9084941` には入っていない。
- Release：`guest-biome-086287f8…`（baseline）と `guest-biome-dabb518b…`（fix）。詳しくは下の「Step 30」。

### formicarium 側の U5 の file
- 検証済み（読んで確認）：U5 の formicarium 側の file には、今回の再開で変更が無い。
  - 対象は `scripts/migration-guest-build/`・`tests/migration-guest-build/`・`mise-tasks/migration/guest-build-unit.sh`・`guest-build-verify.sh`・`package.json`。
  - formicarium の `jj diff --from main@upstream --to @ --stat` は、これらについて「0 files changed」だった（`main@upstream` は `227a6cf9`、#38）。
- 検証済み：Step 22 の土台（`2a79860`）から `main@upstream` までの間に、これらの file で変わったのは `package.json` の `files` への1行（`runtime/web/package-worker.bundle.js`、#38 の変更）だけである。U5 の内容である `migration:guest-build:unit`・`migration:guest-build:verify` の2行（105・106行目）は変わっていない。
- そのため `source-manifest.json` は変えていない。この file は formicarium で追跡される file だけを書く形（R-12）で、上流の file は `traceability.json` に上流の形で書く。

### `traceability.json` の更新
- FR7・NFR4.1・NFR5.1・NFR5.3・NFR8.1・NFR8.3 に、`e9084941` の file、PR #539（未 merge）、release の run 39191728502・39191750168、2つの Release を足した。
- ほかの行（FR8・FR9・NFR2.x・NFR3.x・NFR4.2・NFR5.2・NFR5.4・NFR8.2）は今回変えていない。

### 残る未検証
- `workflow_call` の経路（build の最後から release を呼ぶ形）での concurrency。Step 30 の2つの run は `workflow_dispatch` で起動したので、呼ばれた workflow の top-level の concurrency が効くかは確かめていない。
- job summary の本文（計画の JSON・SHA256・digest の表示）。REST に読む API が無く、計画の artifact も download していない。publish が prepare の出力の SHA256 で照合したことは、log で検証済み。
- PR #539 の上流の CI と merge。merge の後の main での `mise run ci:fixed-guest-builder` も未確認。

## Step 30：外部操作の記録（2026-10-19）

外部操作（merge・workflow の起動・environment の承認）は、すべて書込み権限のある人が行った。この記録のために行ったのは `gh api` の GET（run・jobs・approvals・artifacts・job の log・Release）だけで、書込みはしていない。

- 検証済み（人の報告と、`jj git fetch` 後の `main@upstream`）：vivarium#538 は `e9084941`（`feat(tools): derive the fixed guest release from the build run (#538)`）で merge された。
- 人の報告・一部検証済み：#538 の CI の失敗は run 39191078848 の attempt 1（job 117863810077、`runBuild > stops a source above the size limit before building` が 5001.33ms で timeout、直前に `killed 1 dangling process`）。attempt 2（job 117865110695）は success（GET で確認）。この試験の修正は Step 29a。
- 検証済み：新しい fixed-guest-release を、`workflow_dispatch`（`main`、head `e9084941`）で build の run ID だけを入力にして2回起動した。どちらも job `prepare`・`publish` が success、environment `fixed-guest-release` の承認は `approved`（承認者 JamBalaya56562）。

| release の run | build の run | prepare（作成→完了） | publish（作成→開始→完了） | 計画の SHA256（prepare の出力を publish が受けた値） | 計画の artifact | 結果 |
|---|---|---|---|---|---|---|
| 39191728502 | 39178190974（baseline） | 02:49:03→02:49:15 | 02:49:15→02:50:12→02:50:38 | `6c338e0185b80e2b17512d68d0ebcfef448c02013e4eef06cf3cc4230cd63981` | `fixed-guest-plan` 645 bytes、zip `sha256:f4e3c1d3…f8246e` | `"status": "published"`、tag `guest-biome-086287f859011917208c205bd00239373027ed52fffdc7d07f9526129268322c` |
| 39191750168 | 39178274922（fix） | 02:50:38→02:50:55 | 02:50:55→02:51:29→02:51:50 | `90a3b5f26d70ce827772f076e38249698bde325a67cc0bd60eb63e024ad47e58` | `fixed-guest-plan` 646 bytes、zip `sha256:44fa568e…d2c02` | `"status": "published"`、tag `guest-biome-dabb518b1731e82752bf6f26471df6ba9ad41947b7a31352cdc45638e746c24d` |

（時刻は 2026-10-19 の UTC。prepare は build の artifact を digest で照合して取得した：baseline `fixed-guest-39178190974` `sha256:c95878d5…ecd47ec`、fix `fixed-guest-39178274922` `sha256:a4783201…f66ab16`。log で検証済み。）

- 検証済み（Release の GET。人の照合と一致し、build の receipt とも一致）：どちらの Release も draft ではなく、作者は `github-actions[bot]`、`target_commitish` は `main`。
  - baseline（published 02:50:35）：`biome` 112564936 bytes `sha256:97c88a1cb957ecb557ddf9eb9299c8a515d4b7f2c0dd50c60ed91e19ffdeb7a6`、`build-info.json` `sha256:80f07338112d59145fddaffae25f57b58692cf2710900a2dc6ced9345392f0d5`、`catalog.json` `sha256:20b78f3f576d6a48d2a1c71e41c8ed32f052e3f9e9a0f1d58473ff4c6c361412`
  - fix（published 02:51:48）：`biome` 112500608 bytes `sha256:364ef17da79a6eadb508e93cceb3c1c33d7619e80a94bb9846db2cd57712ff84`、`build-info.json` `sha256:00bb12d690d48023f9df7233413dbae1aac05110dc7aa374d00e0c973922f357`、`catalog.json` `sha256:df8feef387a7d221ac5238c3efcaf961b892a2e96d53b440558c596fe35e0f10`
- 未検証：job summary の本文（計画の JSON と各 digest の表示）。REST に job summary を読む API が無いため、GET では読めなかった。計画の artifact も download していない（file の download は別の承認が要る）。publish が prepare の出力の SHA256 で計画を照合して公開したことは、log（`PLAN_SHA256` と `"status": "published"`）で検証済み。
- 検証済み（時刻から）：concurrency は期待どおり順番にした。2つ目の run 39191750168 は 02:49:19 に作られたが、その `prepare` job は 1つ目の run が終わった 02:50:38 に作られた（約79秒待った）。待っている間に1つ目の publish（02:50:22–02:50:35）は BUSY にならずに公開した。待っていた run の状態が `pending` だったことそのものは、時刻からの推測（その時点の状態の記録は無い）。
- 未検証：`workflow_call`（build の最後から release を呼ぶ経路）での concurrency。今回の2つは `workflow_dispatch` で起動したので、呼ばれた workflow の top-level の concurrency が効くかは確かめていない（「人の判断が要る点と残るリスク」の推測のまま）。次に build から release まで通すときに確かめる。
- 検証済み：古い形の run は何も書いていない。baseline の run 39188699745（02:10:19 作成、job `release biome` 02:11:58–02:12:14）は承認後に BUSY で失敗した（人の報告。step `Publish under the approved plan` の failure は GET で確認）。fix の run 39188781155（02:11:19 作成、job 02:13:54–02:14:09）は、計画の取り違えで `{"error":{"code":"VERIFY_FAILED","message":"the plan differs from the approved SHA256"}}` で失敗した（log で確認）。計画の Step 30 の「承認せず取り消してもらう」とは違い、この run は承認（`approved`）された後に、照合で止まった。どちらの tag の Release も、published_at は新しい run の時刻（02:50:35・02:51:48）である。

## Step 29a：不安定な試験の修正（2026-10-19、bookmark `fix/fixed-guest-builder-size-limit-test`）

vivarium の fork で、`jj git fetch` の後の `main@upstream` `e9084941` の上の空の change に bookmark `fix/fixed-guest-builder-size-limit-test` を付けて作った（#538 の change とは別）。この時点では push・PR はしていなかった。その後、人の承認により PR aletheia-works/vivarium#539（head `e3ae7d78`、未 merge）として push・作成された（上の「Step 31」）。

- 原因（推測。根拠は CI の log と再現）：CI の attempt 1 で、試験は 5001.33ms で timeout し、Bun が `killed 1 dangling process` と出した。監視の間隔は 10ms なので、遅い runner では clone の途中で上限 10 bytes を超えたと判断して `spawnGroup` の stop が SIGTERM を送る。その git が SIGTERM ですぐに終わらないと（git の signal handler の中で止まる、など。どこで止まったかは未確認）、SIGKILL は `DEFAULT_KILL_GRACE_MS`（30秒）の後になり、試験の 5秒を超える。試験は production の 30秒の待ち時間を使っていて、`BuildDeps` から監視つきの git にそれを渡す手段が無かった。手元（macOS、git 2.54.0）で本物の git の clone を途中で止める実験では、3–12ms で止まった（再現しなかった）。
- 再現（RED、検証済み）：`tests/fixtures/stuck-git.sh`（新規）を `git` として PATH の先頭に置く試験を足した。clone のときだけ、先に SIGTERM を無視してから上限を超える file を書き、終わらずに待つ（それ以外の command は本物の git に渡す）。これで clone の途中の stop を毎回通る。直す前に `bun test tools/fixed-guest-builder/tests/pipeline.test.ts` で、新しい試験 `runBuild > stops a clone that ignores SIGTERM above the size limit within the kill grace` が `killed 1 dangling process`・5001.10ms で timeout した（15 pass・1 fail）。`-t 'ignores SIGTERM'` だけの2回目も 5003.35ms で timeout した。CI の失敗と同じ形である。
- 修正（最小）：`src/pipeline.ts` の `BuildDeps` に省略できる `killGraceMs` を足し、`watchedGit`（source と依存の clone・checkout の2か所）から `runMonitored` に渡す。省略したときは今のまま 30秒。試験の `deps()` は `killGraceMs: 200` を渡す。production の既定の待ち時間、上限を超えたら止めて `LIMIT_EXCEEDED` にする振る舞い、試験の timeout（5秒）は変えていない。CLI は `killGraceMs` を渡さない。
- 変更前の基準（検証済み）：同じ command で 15 pass・0 fail（11.33s）。

修正の後、vivarium の root で1つずつ実行した（bun は実体 `/Users/mutoakio/.local/share/mise/installs/bun/latest/bin/bun`、Bun 1.4.3）。

| command | 結果 |
|---|---|
| `bun test tools/fixed-guest-builder/tests/pipeline.test.ts`（修正後、GREEN） | 検証済み：16 pass・0 fail・42 expect（12.35s）。`-t 'size limit'` の2件は合わせて 847ms |
| `mise run ci:fixed-guest-builder` | 検証済み：`tsc --noEmit` 成功、174 pass・0 fail・534 expect、行 98.49%・関数 98.41%（閾値は変えていない。`src/process.ts` の関数は 92.86% → 100%） |
| `mise run fixed-guest-builder:check` | 検証済み：45 file、指摘なし |
| ShellCheck 0.11.0（実体）`tests/fixtures/stuck-git.sh`・`fake-docker.sh` | 検証済み：exit 0（計画の command の外で、新しい shell の file のために足した確認） |

- commit message（jj describe）：`test(tools): stop a SIGTERM-deaf clone in the size-limit test within a short grace`（本文の最後に `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`）。
- 残るリスク（推測）：本物の git が CI で SIGTERM に応じなかった具体的な理由は確かめていない。production では、SIGTERM に応じない git は最大30秒の後に SIGKILL で止まり、`LIMIT_EXCEEDED` になる（今のまま）。

## 再開：Release を build の run から割り出す形（2026-10-19、追加Steps 24–29）

vivarium の fork（`~/Documents/vivarium`）で、`main@upstream` `b6ce42a9` の上の1つの change に、bookmark `fixed-guest-release-from-run` を付けて作った。push・PR・workflow の起動・Release への書込みはしていない（Step 30・31 は未実施）。

### 構成と tool（Step 24）

- 検証済み：`jj git fetch` は「Nothing changed.」。`main@upstream` は `b6ce42a9`（`main@origin` は1つ後ろの `71e0ef92`）。
- 検証済み：Bun 1.4.3、TypeScript 7.0.2、Biome 2.5.15、@types/bun 1.4.3、actionlint 1.7.12、ShellCheck 0.11.0 は、いずれも最新版（`mise latest`・npm registry と bun.lock の照合）。使う Action（checkout v7.0.1 `3d3c42e5…`、mise-action v5.2.0 `9b200bce…`、download-artifact v8.0.2 `9000827c…`、upload-artifact v7.0.2 `cf430e03…`、cache v6.1.0）は latest release の tag と SHA が一致し、古いものは無い。
- 検証済み：変更前の main で `mise run ci:fixed-guest-builder`（= `bun run typecheck && bun run test`）は 160 pass・0 fail・行 98.43%。
- 注意（手順の逸脱）：npm registry の版の確認に `npm view` を1回使ったが、この `npm` は mise の shim だった（読取りだけ。以後は実体の path を使った）。

### 実装（Steps 25・27・28）

- `src/prepare.ts`（新規）：`deriveSet` が、(1) GitHub API で build の run を確かめる（repository と head repository が `aletheia-works/vivarium`、path が `.github/workflows/fixed-guest-build.yml`、`main`、`workflow_dispatch`、`html_url` が run ID と一致、完了済みか自分自身の run、artifact `fixed-guest-<id>` が1つで期限切れでない）、(2) receipt を読み、`ciRunUrl` がその run であること、tag `guest-<tool>-<key>` から tool を割り出す、(3) run の job `build <tool>` が completed/success であること、(4) `tools.json` から binary と target、(5) artifact の set（`<key>/` の3つの file だけ。再利用のときは receipt だけで、公開済みの Release を token なしで取得）を `verifyArtifactSet` で検証し、receipt の3つの digest、catalog の URL、build-info の target と `reference.ciRunUrl` を突き合わせる。どれかが違えば失敗する。計画は今の `makePublishPlan` で作る。rollback の文と approvalReference（`environment fixed-guest-release approval in run <release の run の URL>`）は code に固定。`renderSummary` が計画の JSON・SHA256・tag・各 digest を job summary 用の Markdown にする。
- `src/cli.ts`：`plan` subcommand を `prepare --build-run-id <id> --artifacts <dir> --plan-out <file> --summary <file>` に置き換えた。`release` の入力を `--workflow --build-run-id --artifacts --plan --plan-sha256` にし、publish job の中でも `deriveSet` で identity を割り出し直してから、今の `publishSet` で公開する（`checkPlan` が、計画の SHA256 と prepare の出力の一致、targets と digest を確かめる）。
- `src/github.ts`：`workflowRun`・`runJobs`（`filter=latest`）・`runArtifacts` を追加。1ページ（100件）を超えたら失敗にする。`src/reuse.ts`：`findPublished` が検証した file の bytes も返す（再利用の set を publish に渡すため）。
- `src/busy.ts`（Step 27、不具合修正）：`in_progress` の別の run だけを BUSY と数える。`queued`・`waiting`・`pending` は数えない。
- `.github/workflows/fixed-guest-release.yml`：起動は `workflow_dispatch` と `workflow_call`（どちらも入力 `build_run_id` だけ）。top-level の権限は `{}`。`prepare` job（`contents: read`・`actions: read`、environment なし）が計画を作り、summary に出し、SHA256 を job の出力に、計画の file を artifact `fixed-guest-plan` にする。`publish` job（`needs: prepare`、`environment: fixed-guest-release`、`contents: write`・`actions: read`）が計画を取り、prepare の出力の SHA256 で公開する。concurrency `fixed-guest-release`（`cancel-in-progress: false`）、repository と main の条件、`persist-credentials: false`、SHA 固定は保った。
- `.github/workflows/fixed-guest-build.yml`：top-level の権限を `{}` にし、build job に今と同じ `contents: read`・`actions: read` を明示した（広げていない）。concurrency（group `fixed-guest-build`、`cancel-in-progress: false`）は、人間の判断（2026-10-19「提案通りで進めて下さい」）で workflow の top level から build job だけへ移した（release の承認待ちが次の build を止めないため）。最後に `release` job（`needs: build`、`contents: write`・`actions: read`、`uses: ./.github/workflows/fixed-guest-release.yml`、`build_run_id: ${{ github.run_id }}`）を足した。
- build key を決める file（`container/build.sh`・`tools.json`・`src/key.ts`）と mbx の cache key は変えていない。参考欄の `runnerScriptsSha256` は src の変更で変わる（key には入らない）。

### 試験（Steps 26・27・29）

vivarium の root で1つずつ実行した（bun は実体 `/Users/mutoakio/.local/share/mise/installs/bun/latest/bin/bun`）。

| command | 結果 |
|---|---|
| `bun test tools/fixed-guest-builder/tests/prepare.test.ts` | 検証済み：8 pass・0 fail（skip 0） |
| `bun test tools/fixed-guest-builder/tests/busy.test.ts`（修正前） | 検証済み：5 pass・1 fail。`does not count runs that wait for their turn or for approval` が `Received: "BUSY"` で失敗（RED） |
| 同（修正後） | 検証済み：6 pass・0 fail（GREEN） |
| `bun test tools/fixed-guest-builder/tests/workflows.test.ts tools/fixed-guest-builder/tests/release.test.ts tools/fixed-guest-builder/tests/cli.test.ts` | 検証済み：37 pass・0 fail |
| `mise run ci:fixed-guest-builder` | 検証済み：173 pass・0 fail、行 98.49%・関数 98.04%（閾値は変えていない）。途中の1回目は `github.ts` の関数 coverage 89.66% で exit 1 になり、新しい API の試験を足して通した |
| `mise run fixed-guest-builder:check` | 検証済み：45 file、指摘なし |
| actionlint 1.7.12（実体、`-shellcheck` に ShellCheck 0.11.0 の実体） `.github/workflows/*.yml` | 検証済み：exit 0（`mise run actions:check` も exit 0） |
| ShellCheck 0.11.0（実体） `scripts/*.sh` と `mise-tasks`・`tools` の `*.sh` | 検証済み：exit 0。`mise run shell:check` は macOS の bash 3.2 に `globstar` が無く、検査の前に止まる（既存の環境の問題。同じ file の集合を `find` で渡して実行した） |
| `mise run markdown:check`（README） | 検証済み：指摘なし |
| formicarium の root で `mise run migration-guest-build-unit` | 検証済み：9 pass・0 fail・cancelled 0・skipped 0・todo 0 |

- 計画の file 名と違う所：test の command は計画の名前どおり。workflow・API の試験は `release.test.ts` に1件足した（`createGitHubApi` の新しい3つの呼出し）。
- 試験の fixture は、run 39178190974 の receipt・build-info の形（検証済み：保存済みの copy を読んだ）と、`gh api` の GET で読んだ run・job・artifact の形（`inputs: null`、job 名 `build biome`、artifact `fixed-guest-39178190974`）に合わせた。保存済みの本物の artifact に対する `deriveSet` の実行はしていない（未検証。その directory には人が置いた `plan.json` があり、そのままでは「余分な file」で拒否される）。

### 人の判断が要る点と残るリスク

- 推測：呼ばれた workflow の top-level の `concurrency` が `workflow_call` でも効くかは、公式の文書で確かめられなかった（文書は caller と callee で同じ group 名を使わないことだけを注意している。group 名は別）。同じ key を同時に書かないことは、publish の busy 確認と `publishSet` の draft→検証→publish でも守る。実際の動きは Step 30 で確かめる。
- 決定済み（人間の判断 2026-10-19）：build の concurrency は build job に置く。workflow の top level に置くと、呼んだ release の承認を待つ間も group が保たれ、次の build が待つため（推測。job に移した後の実際の動きは Step 30 で確かめる。未検証）。同じ key の書込みは、release の workflow の concurrency と busy の確認で順番にする。
- 移した後の再実行（検証済み）：`bun test tools/fixed-guest-builder/tests/workflows.test.ts` 12 pass・0 fail（build job だけに group があり、top level と release job には無いことを確かめる）、`mise run ci:fixed-guest-builder` 173 pass・0 fail・行 98.49%・関数 98.04%、`mise run fixed-guest-builder:check` 45 file 指摘なし、actionlint 1.7.12（実体、`-shellcheck` に ShellCheck 0.11.0 の実体）exit 0。
- 決定済み（人間の判断 2026-10-19）：run が完了していても、後ろの release job が失敗・却下されると run の conclusion は success にならない。そこで run の conclusion ではなく、job `build <tool>` の completed/success を確かめる（やり直しの起動を通すため）。
- 自分自身の run（呼ばれた場合）は、未完了でも job `build <tool>` が成功していれば通す。

## 再開：新しい土台（formicariumのupstream main `2a79860`）への合わせ（2026-10-18、Steps 18–21）

review-03のR-10〜R-14と、残っていたR-08を、記録の更新だけで直した。U5のcode（formicariumの `scripts/migration-guest-build/*.ts`・`tests/migration-guest-build/verify.test.ts`・task 2件、上流vivariumのbuilderとworkflow）は変えていない。lint・typecheck・build・test:light・`mise run migration-guest-build-unit`・保存済みのRelease 2組の照合（Step 22）と、レビュー・checkpoint（Step 23）はmain sessionが行う。**この節の作成時点では、新しい土台でのU5の試験と照合はどれも未実行（未検証）である。**

**この節より下（Status、実装したもの、上流への反映、検証の結果、最終レビューへの対応、計画からずれた所、未完・未検証）は、古い土台・案の置き場所での履歴である。** そこに出てくる `proposals/vivarium/u5/`（formicariumの中の案）、`bun test --cwd proposals/...`、`verify-final-u5.mjs` と135件のbinding、`node --test tests/migration-guest-build/verify.test.js` の直接実行は、古い土台のもので、新しい土台の成功証拠へ付け替えない。

### 証拠の分け方（R-10、計画の「証拠の分け方」どおり）

U5は次の2つに分かれる。

**(1) 上流vivariumの本体**（aletheia-works/vivarium、main のmerge `71e0ef9202227626656047746d224278e1e51d5f`、PR #531・#533〜#536）
- 場所：`tools/fixed-guest-builder/`（README・allowlist.json・biome.json・bun.lock・bunfig.toml・package.json・tools.json・tsconfig.json、`container/build.sh`、`src/` 18件、`tests/` 21件（試験17件とfixtures 1件・helpers 3件））と、workflow 4つ（`.github/workflows/fixed-guest-build.yml`・`fixed-guest-release.yml`・`fixed-guest-bump.yml`・`test-fixed-guest-builder.yml`）。計52件のfile。
  - 根拠（検証済み、保存済みの記録の読取り）：`.artifacts/migration-guest-build/upstream-tree-71e0ef92.json` は `sha` が `71e0ef92…`、`truncated: false` で、`fixed-guest` を含むentryが58件（directory 6件を除くとfile 52件）。`upstream-commit-71e0ef92.json` のmessageは「fix(tools): record the mbx cache restore before the build and harden inputs (#536)」。`upstream-compare-f1bf9058-71e0ef92.json` は `ahead 1` で、変わったfileは workflow 1件と `src/cli.ts`・`lockfile.ts`・`pipeline.ts`・`process.ts`・`source.ts`、tests 6件（`fake-docker.sh` を含む）。build keyを決める `container/build.sh`・`tools.json`・`src/key.ts` は含まれない。
- CIのrun（上流のActions）：39073445357（baseline、mbxあり）、39076793651（baselineの再利用）、39077142098（fix、mbxあり）、39079897400（fixの再利用）、39080082205（baseline、mbxなし）と、Release 2組のrun 39076401324・39079705708。保存済みの記録は `.artifacts/migration-guest-build/run-*`・`release-*`。
- builderの試験（`bun test`、158件成功・行coverage 98.43%）・actionlint・ShellCheckは、上流のcheckout（`proposals/vivarium/u5/` にあった案と同じ内容。review-02が今回再実行として観測）で行ったもので、formicariumでは再実行しない。新しい土台のformicariumには、そのsourceは無い（`git ls-files proposals` は0件。`proposals/vivarium/u5/` は追跡されておらず、review-03の `find proposals` ではnode_modulesの空の殻だけ）。上流のfileの中身は、今回は読み直していない（保存済みの記録と既存のreview-01〜03による）。

**(2) formicarium側の確認**（formicariumのmain、PR #31 `880cfd4` で追加）
- `scripts/migration-guest-build/verify.ts`・`assets.ts`、`tests/migration-guest-build/verify.test.ts`、`mise-tasks/migration/guest-build-unit.sh`（alias `migration-guest-build-unit`、`bun run migration:guest-build:unit` を呼ぶ）・`guest-build-verify.sh`（alias `migration-guest-build-verify`、`bun run migration:guest-build:verify` を呼ぶ）、package.json 104–105行の2行。
- 根拠（検証済み）：上の6件は `git ls-files --error-unmatch` で追跡対象（exit 0）。`git log` の最後の変更はどれも `880cfd4`。生成JS（`verify.js` など）は追跡されず、`mise run build` が作る。
- 新しい土台では、intentの検証コマンド（`mise run typecheck && mise run build && mise run test:light && mise run migration-preflight-unit && mise run migration-preflight-current-unit && mise run migration-guest-build-unit && mise run showcase-unit`）と、Step 22の照合（保存済みのRelease 2組に対する `mise run migration-guest-build-verify`）を、U5のformicarium側の証拠とする。どちらもこの節の作成時点では未実行。

### 完了確認の記録（R-11、R-08）

- 古い土台の完了確認のcommand（`.artifacts/migration-guest-build/verify-final-u5.mjs` と、135件をSHA256で固定した `final-u5-binding-71e0ef92.json`）は、**古い土台での完了確認の履歴**とする。新しい土台では使わない。review-03によれば、この script は `proposals/vivarium/u5` の52件を期待するので、`proposals/` が空の今は成功しないと推測される（実行していない、未検証）。
- `.artifacts/` は追跡されていない（検証済み：`git check-ignore -v` で `.gitignore` 114行 `.artifacts/` に一致、`git ls-files .artifacts` は0件）。したがって `.artifacts/migration-guest-build/` の保存済みの記録（upstream-*.json、run-*、release-*、*-reuse-evidence.json、binding）は、この手元にだけある証拠である。cloneし直すと無くなる。
- R-08の古い数値を、下の履歴の節でも揃えた：builderの試験は158件・行98.43%（#536の修正後。修正前の観測は146件・98.36%）、bindingは135件・案は52件（#536より前のbindingは131件・51件）、Majorの修正は「#536で71e0ef92にmerge済み」。

### `source-manifest.json`（R-12）：4件 → 6件

- 外した1件：`biome.json`。U5の変更（`!!proposals/vivarium/u5` の1行）は今の `biome.json` に無い（`grep proposals biome.json` は一致なし）。PR #31での `biome.json` の差分は、showcaseの `overrides`（`noRestrictedImports` など。U7のもの）で、U5の内容ではない（`git show 880cfd4 -- biome.json` を読んで確認）。
- 加えた3件：`mise-tasks/migration/guest-build-unit.sh`・`guest-build-verify.sh`（検証コマンドの `mise run migration-guest-build-unit` が実際に動かす）と `package.json`。
- 残した3件：`scripts/migration-guest-build/assets.ts`・`verify.ts`、`tests/migration-guest-build/verify.test.ts`。
- 6件すべてが追跡対象であることを `git ls-files --error-unmatch` で確かめた（exit 0）。
- `package.json` は共有fileである。U5の内容は104–105行の `migration:guest-build:unit`（`node --test --test-concurrency=1 tests/migration-guest-build/verify.test.js`）と `migration:guest-build:verify`（`node scripts/migration-guest-build/verify.js`）の2行だけである。PR #31の同じ差分にある `showcase:*` の行はU7のもので、U5はclaimしない。

### 残余リスク（R-13・R-14、codeは変えない。直すかどうかは別に決める）

（2026-10-21：R-13・R-14 は上の「Step 37・38」で直した。この節は 2026-10-18 の時点の記録である。）

- R-13：`assets.ts` の `nodeAssets`（8–30行）は、`tests/package/fixtures.ts` の `developmentAssets`（151行）と同じ処理の複製である。`nodeAssets` を呼ぶのは `verify.ts` の `main()`（239–240行）だけで、試験は `developmentAssets` を使うので、`nodeAssets` と `main()` の引数処理は試験を通らない。`mkdtemp`（21行）で作る一時directoryは、どこでも消されない。Step 22の `mise run migration-guest-build-verify` がこの経路を実際に1回通る（未実行）。
- R-14：`checkSet`（`verify.ts` 71行〜）は、build-infoの `dependencies` を確かめずに `guestBuildKey(info)`（104行。`runtime/guest-validation.ts` 218行で `[...info.dependencies]`）を呼ぶ。そのため、`buildKey`・`tool`・`source` が期待と一致し、正規化したJSONで、`dependencies` が無い（または配列でない）build-infoは、`INVALID_INPUT` の拒否でなく `TypeError` で止まる。止まること自体は変わらず、成果物を受け入れることはない。コードを読んだ限りの判断で、実行はしていない。review-03の例の `{}` は、97行の `buildKey` の照合で先に `INVALID_INPUT` になると読める（推測、未実行）。
- R-14の後半：`verify.test.ts` は `dist/guests/`（aube・hello・exit3・probe）と `dist/blink/` を読む。これらは生成物で追跡されない。検証コマンドは `mise run build` を先に実行するので、通常は満たされる。`unit-test-instructions.md` には書いていない（承認を外さないため、変えない）。（2026-10-22 の注記：この「`mise run build` で満たされる」は誤りである。正しくは冒頭の「試験の前提（Step 37 の指摘1）」のとおり、`mise run build-blink-wasm` と `mise run build-guests` が作る。）

### 持ち越す上流の残余リスク

R-03（`prevent_self_review=false`・`can_admins_bypass` の既定値。1人運用で、run nameの計画のSHA256の目視照合が統制）、R-05（`docker run` の `--cap-drop ALL`・`no-new-privileges` が無い）、R-06（bumpのauto-mergeが短い間有効。本物のbumpのrunは未実行。2026-10-22：Step 39 の実 run で外れることを確かめたあと、Step 42 で自動で merge する設計に変えたので、この指摘の前提は無くなった）、R-07（上流のActionsのcacheが10.21GBで既定の上限10GBを超える）、R-09（`process.ts` の `WITHHELD` は名前の一致による除外で、`*_KEY`・`SSH_AUTH_SOCK` などは外れない）は、上流のfileの指摘で、formicariumからは直せない。上流の残余リスクとして持ち越す。R-01・R-02・R-04は、review-02・03で上流 `71e0ef92` の内容により解決済みとされた。

### Step 22：新しい土台でのformicarium側の確認（2026-10-18、main sessionが1つずつ実行、検証済み）
- `mise run lint:all` exit 0、`mise run typecheck` exit 0、`mise run build` exit 0。
- `mise run test:light` exit 0：bun 71件・37件pass、node 125件中123pass・fail 0・skip 2（既存）、tooling 130件pass。
- `mise run migration-guest-build-unit` exit 0：9件pass、fail・cancel・skip・TODO 0。
- 保存済みのRelease 2組への照合（`mise run migration-guest-build-verify`。`--binary` は `--set` からの相対名）：
  - baseline：`--set .artifacts/migration-guest-build/release-39076401324/downloaded --binary biome --tool biome --key 15432368…6321 --repository https://github.com/biomejs/biome --commit 2405c762…37fb --first-receipt run-39073445357/extracted/receipt.json --reuse-receipt run-39076793651/extracted/receipt.json`。exit 0。出力 `baseline-reuse-evidence-20261018.json` は保存済みの `baseline-reuse-evidence.json` とbyte単位で一致した（`cmp`）。
  - fix：`--set release-39079705708/downloaded --binary biome --tool biome --key 4751f68d…d24d --repository https://github.com/jambalaya56562/biome --commit f79f85d5…b206 --first-receipt run-39077142098/extracted/receipt.json --reuse-receipt run-39079897400/extracted/receipt.json`。exit 0。出力 `fix-reuse-evidence-20261018.json` は保存済みの `fix-reuse-evidence.json` とbyte単位で一致した。
  - どちらも、formicariumのNode版の公開APIで `--version` がexit 0（`Version: 0.0.0`）、ELF・build-info・catalogのdigest、`buildKey`、再利用（`compiled=false`・同じdigest）の照合が通った。Releaseの再取得・CI・上流への書込みはしていない。
- 入力は手元の `.artifacts/`（追跡されない）にある保存済みのfileで、cloneし直すと無くなる（残余リスク）。

---

以下は古い土台・案の置き場所での記録の履歴である。

## Status

Step 1–17は完了した。最終レビュー（review-01）はREADYで、Majorと、Minorのうち3件は、上流のPR（aletheia-works/vivarium#536、merge 71e0ef92）で直した。完了確認のcommandは人間の承認を受けて、当時のintentの検証commandに設定し、正式に実行して成功した（exit 0、135件）。このcommandは新しい土台では使わない（上の「完了確認の記録」）。

```
/Users/mutoakio/.local/share/mise/installs/node/26.12.0/bin/node .artifacts/migration-guest-build/verify-final-u5.mjs .artifacts/migration-guest-build/final-u5-binding-71e0ef92.json 6a5ac9ee2b23575b7a2294017fe0c4b5f70be391b65b64b199ecc548ad078ef3
```

このcommandは、CIのrunが使ったmain（f1bf9058）と今のmain（71e0ef92）の間で、build keyを決めるfile（`container/build.sh`・`tools.json`・`src/key.ts`）が変わっていないことと、上流のmainが案の52件と一致することも確かめた。

## 実装したもの

vivariumの固定guestのbuilderを、新しいpackage `tools/fixed-guest-builder/`（Bun・TypeScript）と、workflow 4つとして作った。当時はformicariumの `proposals/vivarium/u5/` に同じpathの形で置き（案の置き場所での履歴。今のformicariumには無い）、上流の aletheia-works/vivarium へ PR で反映した。以下のpathは、上流の `71e0ef92` の `tools/fixed-guest-builder/` からの相対pathである。

- 宣言の検証（`src/declaration.ts`）：許可一覧、URLの正規化（`.git`・末尾の `/`・小文字、`:443` などの既定のportも拒否）、40桁のcommit、`reference` を入力にしない。依存として取得してよいrepositoryの一覧（`dependencyRepositories`）を、guestを宣言できる一覧と分けた。
- sourceの取得と確認（`src/source.ts`）：blobなしclone、`GIT_NO_LAZY_FETCH=1` でのcommitの存在と、repository自身のbranch・tagからの到達の確認。SHAでの直接fetchはしない。submoduleを拒否する。sourcePatchesはSHA256を確かめてから当てる。
- 取得元の検査とkey（`src/lockfile.ts`、`src/key.ts`）：`Cargo.lock` の必須、取得元の許可、registryの置換の拒否。keyは、formicarium（C03）が再計算する式に合わせ、ほかの入力はbuilderHashとdependenciesを通して入れる。U1のbaselineの `buildKey`（3c4d9fd1…）を再現する試験がある。
- 取得の監視と期限（`src/monitor.ts`、`src/deadline.ts`、`src/process.ts`）：process groupで動かし、上限を超えたら止める。4時間の期限で、後片付けの失敗が元の原因を隠さない。
- containerでのbuild（`src/build.ts`、`container/build.sh`）：digestで固定したimageの照合、`rust-toolchain` との版の照合、diskの空き20GiBの事前確認、networkを切ったofflineのbuild、`RUSTUP_TOOLCHAIN` と `CARGO_TARGET_DIR` の固定、fileの持ち主の復元、消せない場合のcontainerを通した削除、失敗時のbuildの出力の末尾の表示。
- 成果物の検証と再利用（`src/artifact.ts`、`src/http.ts`、`src/reuse.ts`）：重複keyの拒否、上限の境界、正規化したJSONのbuild-info、C11の取得規則、公開済みのReleaseだけを再利用とみなす。
- Releaseへの書込み（`src/release.ts`、`src/github.ts`、`src/busy.ts`）：C12の操作計画とそのSHA256の照合、draft → 取得し直して検証 → publish、公開済みなら検証だけ、再現しないELFの拒否、必須の承認者のいないenvironmentでの書込みの拒否、busyの確認。
- bump-upstream（`src/bump.ts`）：`git ls-remote` でbranchを直接解決し、PRの情報だけでは更新しない。
- CLI（`src/cli.ts`）と workflow（`fixed-guest-build.yml`・`fixed-guest-release.yml`・`fixed-guest-bump.yml`・`test-fixed-guest-builder.yml`）。
- formicariumの照合の入口（formicariumの `scripts/migration-guest-build/verify.ts`、`assets.ts`）：成果物を独立に検証し、formicariumのNodeの公開APIで `--version` を実行する。再利用のreceiptも照合する。

## 上流への反映（すべて人間の承認による）

| PR | 内容 | merge |
|---|---|---|
| aletheia-works/vivarium#531 | builder・workflow・既存の経路への追記 | 90dd87e3 |
| aletheia-works/vivarium#533 | 承認者（JamBalaya56562、ID 88115388）をTerraformに渡す | f23e532a |
| aletheia-works/vivarium#534 | 1回目のbuildの失敗の修正（`RUSTUP_TOOLCHAIN`・後片付け・fileの持ち主） | bad23e67 |
| aletheia-works/vivarium#535 | 2回目のbuildの失敗の修正（`CARGO_TARGET_DIR`・診断） | f1bf9058 |
| aletheia-works/vivarium#536 | 最終レビューのMajor（mbxのcacheの記録）とMinor 3件 | 71e0ef92 |

Terraform Applyで、`fixed-guest-release` のenvironment（必須の承認者JamBalaya56562、mainだけ）ができた。fixのcommit `f79f85d5` は JamBalaya56562/biome のどのrefからも辿れなかったため、人間の承認で tag `vivarium/biome-12265-fix` を作った。

## 検証の結果

formicariumの観測（Bun 1.4.3、Node 26.12.0、TypeScript 7.0.2、Biome 2.5.15、古い土台）：

- builderの `bun test --coverage`：exit 0、158件すべて成功、行coverage 98.43%（#536の修正後の観測、review-02。修正前は146件・98.36%）、関数coverageはfileごとに91.67%以上。
- formicariumの照合の試験（`node --test tests/migration-guest-build/verify.test.js`）：9件すべて成功。
- formicariumの `test:light`：失敗0（194件中2件skipは既存のskipの指定、237件すべて成功）。型検査2つも成功。
- 上流のPRのCIの必須checkは、どれも成功してからmergeした（vivariumのセッションの報告とAPIで確認）。

vivariumのCI（上流main f1bf9058、Node 26.12.0、Bun 1.4.3）：

| run | 内容 | 結果 |
|---|---|---|
| 39043868354 | baselineの1回目 | 失敗（`RUSTUP_TOOLCHAIN` の未指定。原因は後片付けのEACCESに隠れた） |
| 39045653488 | baselineの2回目 | 失敗（mbxがtargetを `/mbx` に移した） |
| 39073445357 | baseline、mbxあり | 成功。key 15432368…、ELF 3d7e7e8c…（114,647,744 bytes）、compile 約36.5分 |
| 39076401324 | baselineのRelease（plan f90a3890…） | 成功。JamBalaya56562が承認 |
| 39076793651 | baselineの再利用 | 成功。`compiled=false`、同じdigest、43秒 |
| 39077142098 | fix、mbxあり | 成功。key 4751f68d…、ELF 882228d7…、compile 約35.5分 |
| 39079705708 | fixのRelease（plan 9a6e9ee8…） | 成功。JamBalaya56562が承認 |
| 39079897400 | fixの再利用 | 成功。`compiled=false`、同じdigest、54秒 |
| 39080082205 | baseline、mbxなし | 成功。key 2a28e252…、ELFはmbxありと同じ 3d7e7e8c… |

- 公開したReleaseは `guest-biome-15432368…` と `guest-biome-4751f68d…`。tokenなしで取得した3つのfileのSHA256は、承認した計画の `inputDigests` と一致した。repositoryのlatestは `v0.4.0` のまま。
- formicariumで、2つのguestの `--version` は exit 0（`Version: 0.0.0`）。
- sourceと依存の大きさ：source 約235–237MB（上限2GiBの約11%）、依存 約611MB（上限4GiBの約14%）。上限の半分を超えたものはない。
- mbxのcacheは280,390,161 bytesで1つ保存された（keyはbuilderごとに1つ）。上流のActionsのcacheは10.21GBで、既定の上限10GBを少し超えている。

完了確認の入口（`.artifacts/migration-guest-build/verify-final-u5.mjs`、古い土台の履歴）：135件のfileをSHA256で固定したbinding（`final-u5-binding-71e0ef92.json`。#536より前の版は131件）に対して、上の9つのrunのREST・artifactのZIP・Release・承認の記録・formicariumの証拠と、上流mainのtreeと案の52件（#536より前は51件）の一致を、読取だけで確かめる。改変を拒否する試験（`verify-final-u5.test.mjs`）は12件すべて成功した。

## 最終レビュー（review-01、READY、Major 1・Minor 6）への対応

- Major（人間の指示で直した）：build-infoの `reference.mbxCacheRestored` は、compileの後に `/mbx` の中身を数えていたため、mbxありでは必ず `true` になっていた。cacheのkeyも記録していなかった。
  - 修正：作業の最初（どのcontainerも動く前）に数えるようにし、workflowが求めたkeyと一致したkey（`reference.mbxCacheKeys`）を記録する。PR #536で上流の71e0ef92にmerge済み。build.shとtools.jsonは変えないので、build keyとmbxのcacheのkeyは変わらない。
  - **公開済みの2つのbuild-infoの `mbxCacheRestored` は信用できない。** baseline（`guest-biome-15432368…`、run 39073445357）は、cacheの復元が「not found」だったのに `true` と記録されている。fix（`guest-biome-4751f68d…`、run 39077142098）は、exact hitで `true` は偶然合っているが、数え方は誤っていた。どちらにも `mbxCacheKeys` は無い。公開済みのReleaseは変えない（C12）。実際の復元の結果は、各runのlogの「Restore the mbx cache」の行で確かめる。
  - この値はkeyにもELFにも入らない参考欄で、ELFの正しさ（digestとsource・keyの照合、mbxありとなしで同じELF）には影響しない。
- Minorは、人間の判断（「まとめて直してください」）で、次の3件を同じvivariumのPR（#536、71e0ef92にmerge済み）で直した。
  - 壊れたmbxのcacheの試験：壊れたcacheでbuildが失敗したとき、artifactが残らず作業directoryも消えることを試験で確かめる。本物のmbxの動きは、CIでは確かめていない。
  - 依存のgit（react/react）のcommitの到達：commitだけのbareのclone（`--filter=tree:0`）で、そのrepository自身のbranch・tagから辿れることを、依存の取得の前に確かめる。本物のreact/reactでは3秒・18MBで、Biomeが固定する `78c2d377` は辿れた。
  - tokenを子processに渡さない：git・docker・containerに渡す環境変数から、`ACTIONS_*`・`GITHUB_TOKEN`・`*_TOKEN` などを外す。
- 次のMinorは持ち越す（上の「持ち越す上流の残余リスク」）。
  - `prevent_self_review=false` と `can_admins_bypass` の既定値：承認者が1人なので、変えるなら2人目の承認者を置くかどうかを人間が決める。
  - bumpのauto-mergeが短い間だけ有効になる：vivariumの共有のActionの動きで、本物のbumpはrecipeにguestを宣言するU6の後でないと試せない。
  - 上流のActionsのcacheが10GBを超えている：repository全体の使い方の話で、NFR8.3により相談する。
  - `docker run` の権限を絞ること（`--cap-drop` など）：buildを壊すおそれがあり、本物のbuildで確かめる必要があるため、別のPRにする。

## 計画からずれた所（承認済みの追記に記録）

- formicariumの `mise.toml`・`tsconfig.json` への変更は、U1–U4のreviewの証拠を外したため元に戻し、案の置き場所を `proposals/vivarium/u5/` に移した（人間の回答A）。新しい土台では、この置き場所と `biome.json` の1行はどちらも無い。
- 実装の途中で分かったこと（keyの式、正規化したbuild-info、依存のrepositoryの一覧、auto-mergeの解除、承認者のいないenvironmentの拒否、cacheのkey、run nameの計画のSHA256、PRの試験のworkflow、コメントの規則、関数coverageの既定の閾値）は、計画の2026-10-17の追記に記録した。

## 未完・未検証

- 成功したときはbuildの出力をCIのlogに出さないため、mbxのcacheの当たり外れの数が分からない（Minor）。Biomeでは、mbxによる時間の短縮は3分ほどだった。
- `can_admins_bypass` は provider の既定値の `true` のまま（人間の判断待ち、任意）。
- Safari実機、本物のbump-upstreamのrun、`fixed-guest-bump` のPRの作成は、まだ動かしていない。
