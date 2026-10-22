# U2 code summary（2026-10-16 再開）

## Step 36：`scripts/ci/run.ts` を U2 の一覧に足し、この intent の変更でない148件を外した（2026-10-22、人間の判断「はい、その形で進めて下さい。」）

- Code Generation の段階を閉じるとき、どの Unit の一覧にも無い変更が146件あると AI-DLC が止めた。私の計算（WORKFLOW_STARTED の baseline `baseline-d4cdc9bc3d99.tsv`〈2026-10-12 18:54〉と今の作業場所の差のうち、どの Unit の `source-manifest.json` にも無く、ignore されていないもの）では150件。各 file を formicarium の main（`5735433d`）と比べて分類した（一覧は formicarium の `.artifacts/u9-retirement/uncovered-report.md`、追跡しない）。
- この intent の変更：`scripts/ci/run.ts` の1件。PR #29（`f5bc078c`）が、migration の session・install・command の coverage の suite（`MIGRATION_COVERAGE_SUITES`、`migration-session/guest-validation` などの試験の一覧）を足した。今の file にその内容が残り（40行・47行・324行）、SHA256 `0d1fcffc7cc5f8c8562c72e573cc2373ddcaeaf2122d9e13bd798fc4a43750a5` は main の `5735433d` と同じ（検証済み）。U2 の session・guest-validation の試験を含むので、U2 の `source-manifest.json` に足した（71件）。code は変えていない。
- AI-DLC の設定：`.aidlc-source-paths.json`（何を source の確認から外すかを書く file）。`exclude` に自分自身を足した。
- この intent の変更でないもの：148件。intent の開始前（2026-10-11〜12）に main に入った変更（#3・#8・#9・#11・#14・#15・#17・#18・#19・#20・#23・#24・#27。うち50件は main で消された file）と、開始後のほかの作業（dependabot の #28・#37、release 0.3.0 の #30、OpenTofu の #39）と、`OUTCOMES.md`（main の初めの snapshot と同じ）。baseline を取ったときの作業場所が main より古かったため、差に見えた。人間の判断で、folder ではなく file の名前で1件ずつ `.aidlc-source-paths.json` の `exclude` に足した（`exclude` は151件）。影響：この148件は、この intent の残りの段階で source の確認の対象から外れる。この intent の作業でこれらの file を変える予定は無い。intent を閉じた後の D7 で AI-DLC の記録ごと消す。

## Step 35：固定の入力の payload を U2 の一覧に足した（2026-10-21）

この節が、この file の中で最も新しい。

Code Generation の段階を閉じるとき、どの Unit の一覧にも無い変更として、AI-DLC が `ci/migration-session/payload/*.bin` を挙げた。これは U2 の CI の固定の入力なので、人間の判断で U2 の `source-manifest.json` に 18 件を足した。計画の Step と内容、製品コードは変えていない。

読取りの確認（2026-10-21、`node` で `ci/migration-session/inputs.bundle.json` と disk を比べた）：

- `inputs.bundle.json` の `files`：19行で、SHA256 は 18 種類。2行が同じ内容を指す。
- U2 の一覧に足した path：18件。
- disk の `ci/migration-session/payload/`：18 file。
- 一覧にあって bundle に無いもの、bundle にあって一覧に無いもの、disk にあって一覧に無いもの：どれも0件。

## Step 32〜34：terrarium の削除（PR #58）の後の確認（2026-10-21、7回目の再開）

この節が、この file の中で最も新しい。下の節は、それぞれの時点の記録として残す。

U2 の Code Generation は、レビューの回数を使い切っていた。そのため、人間の判断（2026-10-21「はい、開き直して下さい」）で開き直した。土台は upstream の main `5735433d`（PR aletheia-works/formicarium#58 の merge）。U2 の製品コード（`runtime/`・`types/`）と公開 API は変えていない。

### Step 32：#58 が U2 の file に与えた影響（検証済み）

`jj diff -r u9-remove-terrarium` のうち、U2 の `source-manifest.json` の path に当たる file を読んだ。

- `scripts/migration-session/stage.ts` の `sessionSourceInventory`：消した3件（`docs/terrarium-integration.md`、`tests/terrarium/current-candidate.test.{ts,js}`）を一覧から外しただけ。外した file は存在しないので、残すと readFile で失敗する。
- `scripts/release/inventory.ts`：guest の配布の部品の path を、`integration/terrarium/guest-distribution/` から `integration/guest-distribution/` に変えただけ。件数は変わらない。
- `scripts/terrarium/coverage.ts`：固定の terrarium の試験の中の文字列を置き換える先の path を、移した先に変えただけ。
- `tests/release/publication-alignment-fixture.ts`・`tests/tooling/publication-version.test.ts`：release の判定から外した `ADOPTION_CHECKS`（terrarium の consumer の受入）を、`RC_CHECKS` に置き換えただけ。
- `README.md`・`package.json`：terrarium の言及と、消した試験の glob を除いただけ。
- `docs/terrarium-integration.md`・`tests/terrarium/current-candidate.test.ts`：#58 で消した（terrarium だけの受入）。

結論：U2 の振る舞い（C02・C03、候補の inventory の作り方、coverage の分母）は変わっていない。

試験の結果（main session で1つずつ、2026-10-21）：

| コマンド | 結果 |
|---|---|
| `mise run typecheck` | exit 0 |
| `mise run build` | exit 0 |
| `mise run test:light` | bun 71 pass・37 pass、node 120件（118 pass・2 skip・0 fail）、node 124 pass |
| `mise run migration:session-unit` | 48件のうち 47 pass・1 fail |

`migration:session-unit` の1件の失敗は `tests/migration-session/consumer.test.js` である。この試験は、stage した候補を指す環境変数（`FORMICARIUM_CANDIDATE`・`FORMICARIUM_CONSUMER`・`FORMICARIUM_SESSION_GUEST`）が無いと、`tests/migration-session/consumer-input.ts` の最初の確認で必ず失敗する。今回は準備していないので、未検証とする。

### Step 33：記録の更新

- `source-manifest.json`：#58 で消した `tests/terrarium/current-candidate.test.ts` と `docs/terrarium-integration.md` を外した。
- `traceability.json`：移した file・消した file を指す行は無かった（`rg` で確かめた）。
- 開いている指摘の扱い：
  - R-16：下の「5回目の再開」の見出しの土台（`bbf97ba6`）は、その時点の値として残す。今の土台は、この節の `5735433d` である。その時点の46件の試験は、`checkSessionCandidate` の U2 の identity の確認を通していない（その時の候補の unit は `u4-command`）。
  - R-18：U2 の完了の coverage の根拠は、人間の判断（2026-10-19）どおり、U1〜U4 をまとめた収集とする。U2 の試験だけで測った値（59.75%）は、参考の値として残す。
  - R-15：`completion.ts` の比較を path の集合にする変更は、code の変更なので、この再開（記録だけ）では直さない。Minor として残る。
  - R-17：intent の検証コマンドは `migration:session-unit` を含まない。`completion.test.js` は `migration:session-unit` の中でだけ動く。Minor として残る。

## Step 30a：review-01（NOT-READY）の指摘の修正（2026-10-19）

この節が今の状態である。下の「6回目の再開」の節は、この修正の直前の状態として残す。表記は下の節と同じ（**検証済み**・**ドキュメント根拠**・**推測**）。Step 31（独立レビュー・checkpoint・PR）は行っていない。製品コード（`runtime/**`）は変えていない。変えたのは試験の2つの file と、U2 の coverage の realm の一覧（`scripts/migration-session/coverage.ts`、配布物に入らない開発用の script）である。

### 変えた file
- `tests/package/worker-bundle.test.ts`（U2 の新しい file）：R-02 と R-04。7件→8件。
- `tests/migration-session/consumer.spec.ts`（U2 の file）：R-01 と R-05 の試験を1件足した。3件→4件。後のレビューの R-07 で、main の bundle Worker を URL ではなく name で探すように直した（下の R-07）。`playwright.config.ts` は変えていない（`testMatch` が `consumer.spec.ts` なので、宣言 task の `migration-session-browser` と coverage の収集でもこの試験が走る。検証済み：下の R-07 の coverage の収集で 3ブラウザ×4件が走った）。
- `scripts/migration-session/coverage.ts`（U2 の file）：R-07。`SESSION_REALMS.browserCases` に新しい試験の題名と Worker の realm の数 20 を足した。
- `traceability.json`：NFR8.1 → `tests/package/worker-bundle.test.ts`、NFR2.2 → `scripts/migration-session/coverage.ts` の行を足した。`source-manifest.json`：変えた3つの file は既に一覧にあるので、変更は無い。
- U1・U3・U4 が claim する file は変えていない。U3 の `INSTALL_REALMS`（`scripts/migration-install/coverage.ts`）と U4 の `COMMAND_REALMS` は `SESSION_REALMS.browserCases` を展開して作るので、U3・U4 の file を変えずに新しい試験が入る（ドキュメント根拠：両方の file の読取り。U1〜U4 の収集が通ったことは下で検証済み）。

### R-07：coverage の収集での新しい試験（後のレビューの指摘、検証済み）
- 指摘：`SESSION_REALMS.browserCases` に新しい試験が無く、`reportCoverage` が「計画の case の数と realm の数」の不一致で拒否する。また、coverage の下では page の `Worker` が `/coverage-browser-worker.mjs` に置き換わるので、`page.waitForEvent('worker', w.url() === defaultURL)` が一致せず止まる（推測とされていた）。
- 直す前の観測1（止まること）：`node scripts/migration-session/coverage.js prepare .artifacts/migration-session/r07-red-20261019/coverage` の後、その `tests/migration-session` で `node …/@playwright/test/cli.js test --config playwright.coverage.config.mjs --workers=1 --retries=0 --project=chromium -g 'default bundle Worker'` を実行した。1 failed（14.0m）：`Test timeout of 840000ms exceeded.` `Error: page.waitForEvent: Test timeout of 840000ms exceeded.`（`waiting for event "worker"`、spec の 116 行目＝手順2）。手順1（URL と name の記録）はこの時点で通っていた。timeout は変えていない。
- 直したこと1：手順2の main の bundle Worker に name `waitasync-main-probe` を付けて起動し、返事を受けた後に `page.workers()` の各 Worker で `self.name` を読んで、その名前の Worker 1つだけで `typeof Atomics.waitAsync` を読む（`expect(inspected).toEqual(['undefined'])`）。bundle は name が `em-pthread` でなければ main の経路を通るので、name を付けても main の振る舞いは同じである（ドキュメント根拠：`runtime/web/package-worker.ts` の読取り）。既定の URL の性質は、手順1の page 側の `Worker` の引数の記録で確かめる。coverage の収集の包みより外側で引数を記録するので、どちらの実行でも同じ値になる（検証済み：下の2つの実行で `defaultURL` と子の URL が一致）。
- 直す前の観測2（report の拒否）：直したこと1の後、`SESSION_REALMS` を変える前に、新しい copy `.artifacts/migration-session/r07-a-20261019/coverage` で U2 の収集を `completion.ts` と同じ順に1つずつ実行した（package の Node 115 pass、U2 の Node 46 pass、package の browser 99 passed、U2 の browser 12 passed）。report は `Error: missing planned browser case: chromium` で拒否した。新しい試験の realm は3ブラウザとも 21行（host 1＋Worker 20、すべて登録済み）だった。
- 直したこと2：`SESSION_REALMS.browserCases` に新しい試験を 20 で足した。内訳は aube の実行1回の17（既存の case と同じ数）と、普通の Worker・main の bundle Worker・子の bundle Worker の3つである。子 Worker の数は aube の実行1回で16と、既存の case の17と同じく固定なので、数は固定にした（検証済み：3ブラウザ・3回の実行のどれでも子 Worker 16）。
- 閾値（80）、分母（23 file）、timeout、worker 1、retry 0 は変えていない。

### tool の版（検証済み）
- **Bun 1.4.3**（`/Users/mutoakio/.local/share/mise/installs/bun/1.4.3/bin/bun --version`、`mise latest bun` も 1.4.3）。Node 26.12.0（`mise latest node` も 26.12.0）。
- node の試験は mise の実体の path で実行し、`buildWorkerBundle` が呼ぶ `bun` も、PATH の先頭に mise の実体の dir を置いて shim を使わないようにした（`which bun` → `/Users/mutoakio/.local/share/mise/installs/bun/1.4.3/bin/bun`）。

### R-02：`.artifacts` が無い状態での失敗と修正（検証済み）
- 再現の方法：本物の `.artifacts` を消さないため、試験の一時 dir の親を環境変数 `FORMICARIUM_WORKER_BUNDLE_ARTIFACTS`（既定は `.artifacts`、root からの相対）で変えられるようにした。親を、存在しない `.artifacts/r02-clean-checkout/.artifacts` にして実行した（実行前に `ls` で無いことを確かめた）。親の path が違うだけで、`mkdtemp` を呼ぶ処理は clean checkout と同じである。
- 直す前（RED）：`mise run build` exit 0 の後、`FORMICARIUM_WORKER_BUNDLE_ARTIFACTS=.artifacts/r02-clean-checkout/.artifacts node --test --test-concurrency=1 tests/package/worker-bundle.test.js` で7件のうち pass 6・fail 1・skip 0。fail は `two Bun builds of the same modules give the built bundle bytes`（`ENOENT: no such file or directory, mkdtemp '…/.artifacts/r02-clean-checkout/.artifacts/worker-bundle-WrHgGf'`）。
- 直したこと：`mkdtemp` の前に `await mkdir(artifacts, { recursive: true })` を呼ぶ（`tests/package/coverage.test.ts` と同じ形）。
- 直した後（GREEN）：`mise run build` exit 0 の後、同じコマンドで7件 pass・fail 0・skip 0。親の dir が作られた（`.artifacts/r02-clean-checkout/.artifacts` は空のまま残る。`.artifacts/` は SCM の対象外）。

### R-04：配布する bundle と作り直した bundle の一致（検証済み）
- 新しい試験 `staged package bundle has the bytes of a Bun rebuild from the staged originals`：`stagePackage` で `.artifacts/worker-bundle-stage-*/package` に配布物を作り、manifest の bundle の SHA256 と stage された bundle が同じことを確かめる。stage された bundle を消し、stage された `runtime/**`（配布する元の file だけ）から `buildWorkerBundle` で作り直し、同じ SHA256 になることと、source map の `sources` が `FIRST_PARTY_JS` の中だけであることを確かめる。
- これで、`runtime/*.js` を変えて bundle を作り直さずに stage した場合（review の R-04 の推測の場合）は、この試験が失敗するはずである（推測：その状態を作って実行してはいない）。stage-package・verify-package 自体には照合を足していない（製品の script を変えないため。見送りの理由）。Bun の版は build-info に残していない。この code-summary に Bun 1.4.3 を記録した。
- bundle の SHA256 は `8cc5f46890d469bd8516ffbf9dd3f81bde91c38bb00f97e79d2c70c15772ee98` のまま（`shasum -a 256`）。U2 候補 `candidate-9497a91c…` の tgz の中の bundle も同じ値（`tar -xOzf … | shasum -a 256`）。

### R-01・R-05：bundle の Worker の中の `Atomics.waitAsync` と子 Worker の URL（検証済み）
- 新しい試験 `default bundle Worker and its em-pthread children share one URL and lack Atomics.waitAsync`（`consumer.spec.ts`、install した U2 候補の package を配る）：
  1. page の `Worker` を包んで、既定の `createSession()` で本物の aube `--version` を実行し、page が作るすべての Worker の URL と name を記録する。最初の Worker は既定の URL（`/runtime/web/package-worker.bundle.js`）で name なし、残りはすべて name `em-pthread` で、URL は既定の URL と同じであることを確かめる。
  2. 既定の URL を main の Worker として（name `waitasync-main-probe` を付けて）起動し、不正な要求への `EXECUTION` の返事を受けてから（bundle が評価された後）、Playwright の `worker.evaluate` で、その name の Worker の中の `typeof Atomics.waitAsync` を読む（R-07 で URL ではなく name で探すように直した）。
  3. 既定の URL を name `em-pthread` の子として起動し、`core-bootstrap` の `moduleURL` に、`typeof Atomics.waitAsync` を返す blob の module を渡す。bundle は core の loader を import するのと同じ `import(descriptor.moduleURL)` でこれを読むので、core の loader を import する時点の値が分かる。
  4. 比べるために、bundle ではない普通の module Worker の中の値も記録する。
- 結果（`--project` を付けて1つずつ、workers=1、retries=0。各4 passed、fail・skip 0）：

| browser | 普通の Worker | main の bundle Worker | 子の bundle Worker（core の import の時点） | 子 Worker の数 | 子の URL が既定の URL と同じ |
|---|---|---|---|---|---|
| chromium | `function` | `undefined` | `undefined` | 16 | true |
| firefox | `function` | `undefined` | `undefined` | 16 | true |
| webkit | `function` | `undefined` | `undefined` | 16 | true |

- 3つのブラウザとも普通の Worker には `Atomics.waitAsync` があるので、この試験は bundle の `delete Atomics.waitAsync` が無くなれば失敗する（推測：delete を外した bundle で実行してはいない）。
- review の R-05 の (b)（U6 の観測は `options.assets` 相当で、既定の切り替えを通っていない）について：既定の切り替えと子 Worker の URL はこの試験（3ブラウザ、分離は `crossOriginIsolated` の COI server）で確かめ、coi-serviceworker の分離の下での動作は U6 の明示の URL の観測で確かめた。この2つを組み合わせて根拠にしている。

### R-03：人間が認めた差の書き方
- 試験指示の「1つの file の package Worker の確認」の1と5は、下の節の差の2（coverage は計測を入れた元の file から bundle を作り直す。source map は範囲の検査に使う）と差の3（文字列の specifier の動的 import は `node:*` だけ、実行時の値の2つは `core.js` と同じで残る）と同じ内容になっている（ドキュメント根拠：両方の文を読んで比べた）。この code-summary の書き方もそれに合わせている。

### R-06：U2 の試験だけの coverage
- 人間の判断（試験指示の5）に従い、U2 の試験だけの収集の値は**参考の値**として記録し、根拠は U1〜U4 をまとめた収集とする。R-07 を直した後、新しい試験を含めて両方を新しい copy で1つずつやり直した（検証済み）：
  - U2 だけ（`.artifacts/migration-session/r07-b-20261019/coverage`、U2 候補 `candidate-9497a91c…`）：package の Node 115 pass、U2 の Node 46 pass、package の browser 99 passed、U2 の browser 12 passed（すべて fail・skip 0）。report は **1228/2055 行＝59.75%**、23 file、1441 realm、`passed: false`（`Error: fixed inventory line coverage 59.75% is below 80%`。realm の検査は通った）。SHA256 `ba0485159953022855595e1cc5a91040523b57a1a5b70e3a5192ff2d0dc6c7a3`。
  - U1〜U4 をまとめた収集（`scripts/migration-command/completion.ts` と同じ coverage の command を1つずつ。`.artifacts/migration-command/r07-combined-20261019/coverage`、U4 候補 `candidate-413e2265…`、consumer は scratchpad の `u4-bundle-consumer`）：package の Node 115 pass、U2〜U4 の Node 188 pass、package の browser 99・U2 12・U3 9・U4 9 passed（すべて fail・skip 0）。report は **1894/2055 行＝92.16%**、23 file、1676 realm、threshold 80、`passed: true`、error なし。SHA256 `6ce151cc32c28e66f8a23e6f317a5da8964a982ad580fac8e638845f7fb3a8ee`。bundle は report の file に無い。
  - 行の数は、下の節の Step 28（1228/2055、1894/2055）と同じである。realm は新しい試験の3ブラウザ×21 だけ増えた（1378→1441、1613→1676）。
- bundle に替える前の U2 の試験だけの収集は**未測定**である。したがって、bundle に替えたことで U2 の試験だけの行が減っていないことは示せていない。この点は Step 31 の人間への報告に載せる。

### R-07 を直した後の試験（main session で1つずつ、2026-10-19）
- `mise run build`：exit 0。
- U2 だけの収集と U1〜U4 の収集：上の R-06 のとおり。
- `consumer.spec.ts` を `--project=chromium`・`firefox`・`webkit` の順に：各4 passed（fail・skip 0）。waitAsync は3ブラウザとも、普通の Worker `function`、main の bundle `undefined`、子の bundle（core の import の時点）`undefined`。子 Worker 16、子の URL は既定の URL と同じ。
- `mise run lint:all`：exit 0、error 0（warning 48・info 47、前と同じ数）。変えた3つの file の diagnostic は、`scripts/migration-session/coverage.ts` の変えていない行（133行目、`session-collection-boundary.json` の書出しの `+ '\n'`）の info `useTemplate` 1件だけ。指摘の範囲の外なので直していない。
- `mise run typecheck`：exit 0。
- `mise run test:light`：exit 0。bun 71・37 pass、node 125 件のうち pass 123・skip 2、node 130 pass、fail 0（skip の2件は前と同じ数）。

### R-07 より前の試験（main session で1つずつ、2026-10-19）
- `mise run build`：exit 0。
- `node --test --test-concurrency=1 tests/package/worker-bundle.test.js`：8 pass・fail 0・skip 0。
- `node --test --test-concurrency=1 tests/package/public.test.js`：6 pass・fail 0・skip 0。
- `node node_modules/@playwright/test/cli.js test --config tests/migration-session/playwright.config.ts tests/migration-session/consumer.spec.ts --project=chromium`、続けて `firefox`、`webkit`：各4 passed（計12、fail・skip 0）。入力は `FORMICARIUM_CANDIDATE=.artifacts/migration-session/candidate-9497a91c-65ff-4f3d-a9c0-a812f0c2fef5/package.manifest.json`、`FORMICARIUM_CONSUMER=`（scratchpad の）`u2-bundle-consumer`、`FORMICARIUM_SESSION_GUEST=.artifacts/u2-release-inputs/aube-v2.7.0/aube`。今回は製品コードを変えていないので、候補は作り直していない。
- `mise run lint:all`：exit 0、error 0（warning 48・info 47。前と同じ数）。変えた2つの file には diagnostic が無い（`node_modules/.bin/biome check` で確かめた）。
- `mise run typecheck`：exit 0。
- `mise run test:light`：exit 0。bun 71 pass・37 pass、node 125 件のうち pass 123・skip 2、node 130 pass。fail 0。skip の2件は数が前と同じで、前からの既知のもの（「Actual release assets absent」）と読む（ドキュメント根拠：名前は今回の出力では確かめていない）。成功には数えない。

### 未検証・していないこと
- Step 31（独立レビュー、intent の検証コマンドでの checkpoint、push、PR）。
- coverage 付きの `migration-session-completion`・`migration-command-completion` の全工程（probe・aube の回帰、CI 証拠を含む）。上の収集は、その中の coverage の command だけを1つずつ実行した結果である。
- 実機 Safari。

## 6回目の再開：WebKit のための1つの file の package Worker（2026-10-19、Steps 25–30）

この節は Step 30a の直前の状態である。下の「5回目の再開」の節は、その直前の状態の履歴として残す。表記：**検証済み**＝この作業でコマンドを実行して出力を確かめた。**ドキュメント根拠**＝記録・設定・source の読取り。**推測**＝確かめていない。Step 31（独立レビュー・checkpoint・PR）は行っていない。

### 変えた file
- `scripts/package/worker-bundle.ts`（新規）：`bun build runtime/web/package-worker.js --target browser --format esm --external 'node:*' --sourcemap=external --outdir runtime/web --entry-naming '[name].bundle.[ext]'` を実行する `buildWorkerBundle` と、source map の `sources` を root からの path に直す `workerBundleSources` を置いた。
- `scripts/emit.ts`：build の最後の段階で `buildWorkerBundle` を呼ぶ。`runtime/web/package-worker.bundle.js` と `.map` ができる（どちらも `.gitignore` の `/runtime/**/*.js`・`**/*.js.map` で追跡されない。ドキュメント根拠）。
- `runtime/web/api.ts`：`options.assets` が無いときの既定の Worker の URL を `./package-worker.bundle.js` に替えた。`options.assets` があるときの扱い、子 Worker の `child-create`（同じ `workerURL` を使う）、公開 API・型・C02/C03 は変えていない。Node の Worker（`runtime/node/*`）も変えていない。
- `package.json` の `files`、`scripts/package/stage-package.ts` の `PACKAGE_FILES` に bundle を足した（`FIRST_PARTY_JS` には入れない）。`verify-package.ts` は `PACKAGE_FILES` を使うので file は変えていない。
- `scripts/package/coverage-inventory.json`：`exclusions` に bundle を「生成物」として理由付きで足した。分母の `files` は変えていない（23件のまま）。
- `scripts/package/coverage.ts`：計測用の写しでは、bundle を写さず、計測を入れた元の `runtime/*.js` から同じ `bun build` で作り直す。作り直した bundle の source map の `sources` が固定の一覧（`FIRST_PARTY_JS`）の中だけであることと、package Worker を含むことを確かめ、外れたら失敗にする。
- `tests/package/worker-bundle.test.ts`（新規、7件）と `tests/package/pack.test.ts`（`PACKAGE_FILES` の件数 33→34）。

### 承認済みの計画との差・判断（人間の確認が要るもの）
1. **`scripts/release/inventory.ts` の `PACKAGE_FILES` にも bundle を足した**。計画の Step 26 は名前を挙げていない。この file は stage-package との値の一致を前提にしており（file の注記、ドキュメント根拠）、`scripts/release/publication.ts` が tarball の一覧をこれと比べるため、足さないと新しい pack を拒否する（推測。publication を新しい pack で実行してはいない）。
2. **coverage の対応のさせ方**：計画は「bundle の中で動いた行は source map で元の `runtime/*.js` に対応させる」。実装では、source map の行の対応で数を移すのではなく、計測を入れた元の file から bundle を作り直し、bundle の中の文がそのまま元の file の文の数を増やすようにした。source map は、bundle が固定の一覧の外の module を含まないことの検査に使う。browser の Worker の realm が元の file を登録して数えることは確かめた（下の Step 28）。
3. **動的 import の試験の読み方**：計画・試験指示は「`node:*` 以外の動的 import が無い」。実際の bundle には、検証済みの blink loader（blob URL）を読む `import(…url)` と `import(…descriptor.moduleURL)` の2つ（文字列ではなく実行時の値）が残る。これは元の `runtime/core.js` にある2つと同じで、bundle で増えたものではない。試験は「文字列の specifier は `node:*` だけ」「値の specifier は `core.js` と同じ2つだけ」と確かめる。U6 の記録の「`node:*` の動的 import だけが残る」は、この2つを数えていない（検証済み：AST の数え）。
4. **source map は配らない**：他の `runtime/*.js` の `.js.map` も配っていないのに合わせた。`--sourcemap=external` なので、bundle に `sourceMappingURL` の行は無い（末尾は `//# debugId=F06E7DD2014A626B64756E2164756E21`）。
5. **独立した consumer の置き場**：`tests/migration-session/consumer-input.ts` は consumer が repository の外にあることを求める。そのため、この session の scratchpad（`/private/tmp/claude-501/…/scratchpad/u2-bundle-consumer`、`…/u4-bundle-consumer`）に `npm install` した。
6. **U2 だけの coverage の report は 80% に届かない**（下の数値。人間の判断で参考の値とし、根拠は U1〜U4 をまとめた収集。上の Step 30a の R-06）。U3/U4 の file（`install-*`・`command*`）を U2 の試験が実行しないためで、bundle の変更とは関係が無いと読む（推測：変更前の同じ収集は実行していない）。U1〜U4 をまとめた収集では 92.16% で通る。`migration-session-completion` を今の23件の分母で実行すると、この理由で失敗するはずである（推測、未実行）。

### tool の版（Step 25、検証済み）
- `jj git fetch`：「Nothing changed.」。`main`・`main@upstream`・`main@origin` はどれも `112e036e`（#36）。
- Node 26.12.0、Bun 1.4.3、TypeScript 7.0.2、@playwright/test 1.64.1、Biome 2.5.15、@types/node 26.6.5、yaml 2.9.1、istanbul-lib-coverage 3.2.2、istanbul-lib-instrument 6.0.3。どれも latest と同じ（`mise latest`・`npm view <pkg> dist-tags.latest`）。`mise outdated` は rust `stable` の1行だけ（固定ではない `stable` 指定）。
- 変更前の確認：`node --test --test-concurrency=1 tests/package/public.test.js` 6 pass。`node node_modules/@playwright/test/cli.js test --config tests/migration-session/playwright.config.ts tests/migration-session/consumer.spec.ts`（既存の候補 `candidate-a7e27b2d…` と consumer `/private/tmp/formicarium-b1-consumer-20261018`）9 passed（3ブラウザ×3件）。

### bundle の bytes（検証済み）
- `runtime/web/package-worker.bundle.js`：23,276 bytes、**SHA256 `8cc5f46890d469bd8516ffbf9dd3f81bde91c38bb00f97e79d2c70c15772ee98`**。`mise run build` を何度か実行しても同じ値。別の dir に写した module から2回作っても同じ値（worker-bundle の試験）。
- source map の `sources`：`runtime/core.js`・`contracts.js`・`errors.js`・`protocol.js`・`guest-io.js`・`worker-execution.js`・`web/package-worker.js` の7件（すべて `FIRST_PARTY_JS`）。

### 試験（main session で1つずつ、node は mise の実体の path）
- Step 27：`mise run build` の後、`node --test --test-concurrency=1 tests/package/worker-bundle.test.js` 7 pass・fail 0・skip 0。`node --test --test-concurrency=1 tests/package/public.test.js` 6 pass・fail 0・skip 0。
- Step 28：U2 候補 `.artifacts/migration-session/candidate-9497a91c-65ff-4f3d-a9c0-a812f0c2fef5/package.manifest.json`（`mise run migration-session-stage`、0.3.0、34 file、tgz SHA256 `a3370ca4df1f969ca613fe7253c831933d594b14f9650c609a6ced4581834046`）で、`consumer.spec.ts` を `--project=chromium`・`firefox`・`webkit` の順に実行し、各3 passed（計9、fail・skip 0）。install した `runtime/web/api.js` は bundle を既定にしている。
- Step 28 の coverage（`scripts/migration-session/completion.ts` と同じ coverage の command を1つずつ、`.artifacts/migration-session/bundle-coverage-20261019/coverage`）：package の Node 115 pass、U2 の Node 46 pass、package の browser 99 passed、U2 の browser 9 passed。report は23件すべての file を出し、1228/2055 行＝**59.75%**、1378 realm、`passed: false`（上の6）。bundle の Worker の realm（例：`real installed browser archive …` の34個、`same installed U2 pack …` の17個）は、3ブラウザとも `runtime/web/package-worker.js`・`core.js`・`worker-execution.js`・`protocol.js`・`guest-io.js` を登録し、文の数を持つ（検証済み：`coverage-realms.json` と `coverage-metadata.json` の layout で数えた）。
- Step 28 の coverage（U1〜U4 をまとめた収集。`scripts/migration-command/completion.ts` と同じ coverage の command を1つずつ、U4 候補 `.artifacts/migration-command/candidate-413e2265-f65f-48e3-af1f-a47a990e779c/package.manifest.json`。tgz は U2 候補と同じ SHA256）：package の Node 115 pass、U2〜U4 の Node 188 pass、package の browser 99・U2 9・U3 9・U4 9 passed。report `.artifacts/migration-command/bundle-coverage-20261019/coverage/coverage-report.json`（SHA256 `a34ff77a1a36b14d002f7ee16ad54c0bb92c94cb2af7c00a669db206dc52002f`）は **1894/2055 行＝92.16%、23 file、1613 realm、`passed: true`、threshold 80**。
- Step 29：下の「U6 の観測のやり直し」。
- Step 30（すべて exit 0）：
  - `mise run lint:all`：error 0（warning 48・info 47。Step 24 の記録と同じ数）。途中で新しい試験の file の整形の error が1件出たので、整形を直した。
  - `mise run typecheck`、`mise run build`。
  - `mise run test:light`：bun 71 pass・37 pass、node 125 件のうち pass 123・skip 2（前からの `actual official aube release supply …`・`actual latest pitchfork …`、「Actual release assets absent」。成功には数えない）、node 130 pass。fail 0。
  - `mise run migration-session-unit`（U2 候補）：55 pass・fail 0・skip 0。
  - `mise run migration-install-browser`（U3、U4 候補で）：45 passed。`mise run migration-command-browser`（U4）：9 passed。
  - `mise run test:consumer`（U2 候補）：214 pass・fail 0・skip 0。
- 不具合修正の順序：`tests/package/pack.test.js` は、bundle を足した後に `34 !== 33` で1件 fail した（RED、検証済み）。件数の期待値を 34 に直した後、`mise run test:consumer` の中で pass した（GREEN）。判定の条件は緩めていない（tarball の一覧が `PACKAGE_FILES` と一致することはそのまま）。

### U6 の観測のやり直し（Step 29、検証済み）
- pack：U6 の Step 1 の手順（`bun scripts/ci/tasks.ts build`、`node scripts/package/stage-package.js --out .artifacts/u6-recipe-runtime/private-bundle`、`bun x npm@latest pack … --ignore-scripts`、`verify-package.js`）。既存の `private/` を消さないよう、名前を `private-bundle` にした。`.artifacts/u6-recipe-runtime/private-bundle.tgz`（34 file、267,868 bytes、**SHA256 `72172c2887057468e6dbd2bf7213ee6b2983de4361378147849bdc6f234bbe1b`**、version 0.2.1）。中の bundle は `8cc5f468…`。
- 結果：候補2の置き場、`coepCredentialless` を false に固定、配布物の bundle の Worker で、3ブラウザ × en・ja × 初回・再訪問の**12の訪問（2端末ずつで24の ready）すべてで基準を満たした**。詳細は U6 の code-summary の「Step 3 の配布物の bundle での観測のやり直し」。
- 計画の「24組」は、3×2×2＝12 の訪問に2端末を掛けた数と読んだ（推測）。

### 未検証・していないこと
- Step 31（独立レビュー、intent の検証コマンドでの checkpoint、push、PR）。
- coverage 付きの `migration-session-completion`・`migration-command-completion` の全工程（probe・aube の回帰、CI 証拠を含む）：実行していない。上の coverage は、その中の coverage の command だけを1つずつ実行した結果である。
- 新しい pack での `scripts/release/publication.ts` の確認、npm に公開済みの 0.2.1 との比較。
- 実機 Safari（WebKit 27.2 は Playwright の同梱版）。

## 5回目の再開：新しい土台（upstreamのmain `bbf97ba6`）への合わせ（2026-10-18、Steps 20–24）

この節が、今の状態を書いた節である。下の節は古い土台・古いtoolchainの履歴であり、新しい土台での根拠にしない。

### 変えたfile
- `scripts/migration-session/completion.ts`（R-06）：coverage reportの件数の検査が `report.files.length !== 16` で固定されていた。これを `FIRST_PARTY_JS.length`（今は23件）と比べる形に直した。
- **承認済みの計画との差**：直す前に、この検査を export した関数 `assertSessionCoverageReport(report, candidateSha256)` へ切り出した（判定は変えず、拒否のメッセージも `U2 current candidate coverage incomplete` のまま）。検査は `runSessionCompletion` の中にあり、試験から確かめるには今のsourceに合う候補・consumer・guestが要るためである。`runSessionCompletion` は、切り出した関数を同じ位置で呼ぶ。main sessionが、この進め方を承認した。
- `tests/migration-session/completion.test.ts`：3件を加えた。
  - 件数が `FIRST_PARTY_JS` と同じreportを受け付けること。
  - 16件・1件少ない・1件多いreportを拒否すること。
  - passed false、threshold 79、別のpackのSHAを拒否すること（今までの条件を緩めていないことを確かめる）。
- `traceability.json`：NFR8.2の対象を、消した `scripts/migration-session/ci.ts` から `scripts/package/stage-package.ts` に変えた（このfileの `PACKAGE_FILES` に `LICENSE`・`THIRD_PARTY_NOTICES.md` がある）。ほかの14件の対象を含め、15件の対象fileがすべてあることを確かめた。
- `source-manifest.json`：U2の内容がない `mise.toml` を外した（`migration-session` のtaskがない）。U2のtaskの実体である `mise-tasks/migration/session-{browser,completion,stage,unit}.sh` を加えた。Step 20で変えた2つのfileは、すでに一覧にある。

### 新しい土台での状態（今のfileで確かめた）
- #32で、`scripts/migration-session/ci.ts`・`.github/workflows/migration-session-u2.yml` は消えた。`ci-core.ts`・`ci-inputs.ts` は残る。`.github/publication/` は、このrepoにない（追跡もされていない）。
- 配布JSは23件（`scripts/package/stage-package.ts` の `FIRST_PARTY_JS`）。下の節にある「16JS」「21JS」は、古い土台の時点の件数である。
- U2のtaskは、package.jsonの `migration:session:{unit,browser,stage,completion}` と `mise-tasks/migration/session-*.sh` にある。
- R-05について：計画の「検証と停止条件」にあるv8の証拠と旧 `verification-command.txt` は、古い土台・古いtoolchainの履歴である。下の節のv10・v4〜v7と、`ci.ts`・`migration-session-u2.yml` による確認も同じく履歴である。新しい土台での確認は、intentの新しい検証コマンド `mise run typecheck && mise run build && mise run test:light && mise run migration-preflight-unit && mise run migration-preflight-current-unit && mise run migration-guest-build-unit && mise run showcase-unit` で行う。

### 観測結果（main session、2026-10-18、Node v26.12.0、1つずつ実行）
- 直す前（RED）：`mise run build` exit 0。そのあと `node --test --test-concurrency=1 tests/migration-session/completion.test.js` を実行し、9件のうちpass 7・fail 2・skip 0。
  - fail：`completion accepts a coverage report that covers every distributed JS file`（Got unwanted exception "U2 current candidate coverage incomplete"）
  - fail：`completion refuses a coverage report whose file count differs from the distribution inventory`（Missing expected exception）
- 直した後（GREEN）：`mise run build` exit 0。同じコマンドで9件pass、fail・skip 0。
- `mise run lint:all`：exit 0（warning 48・info 47、エラーなし）。変えた2つのfileには、info 2件がある。どちらも変えていない行（completion.tsのreceiptと `incomplete.json` の書出しの `+ '\n'`）の `useTemplate` である。
- `mise run typecheck`：exit 0。`mise run build`：exit 0。
- `mise run test:light`：exit 0。
  - 1つ目のsuiteは125件で、pass 123・fail 0・skip 2。skipした2件は、前からある既知のもので、成功には数えない（`actual official aube release supply ...` と `actual latest pitchfork patched static musl supply ...`。どちらも「Actual release assets absent」）。
  - 2つ目のsuiteは130件で、すべてpass。fail・skip 0。
- `mise run migration-session-unit`：exit 0。46件pass、fail・skip 0。使った入力は次のとおり。
  - `FORMICARIUM_CANDIDATE`：`.artifacts/migration-command/candidate-a7e27b2d-…/package.manifest.json`（unit u4-command、0.3.0、33件）
  - `FORMICARIUM_CONSUMER`：`/private/tmp/formicarium-b1-consumer-20261018`
  - `FORMICARIUM_SESSION_GUEST`：`.artifacts/u2-release-inputs/aube-v2.7.0/aube`
  - 候補の33件のうち28件（配布JS 23件・型3件・LICENSE・NOTICES）は、今のworkspaceのfileとSHA256が同じ。違う5件（assets 3件・README.md・package.json）は、stagingがbuild出力や版から作るものである。この候補は、Step 20の変更より前に作られた。ただし、Step 20で変えた2つのfileはpackageに入らない。
- Step 20の試験の再実行：9件pass、fail・skip 0。

### 未検証・まだしていないこと
- `mise run migration-session-browser`、coverage付きの `migration-session-completion`、intentの検証コマンド：今回は実行していない。
- 独立レビュー、checkpoint、push、PR：main sessionが行う。Step 24のboxは未チェックのまま残した。
- 実機Safari：未検証。

## 4回目の再開：review-08の指摘の修正（2026-10-17、Step 18）

人間が承認した修正案 `u2-resolvepath-contract-proposal.md`（案A）に従い、review-08のR-08〜R-10を直した。
- R-08：functional-designを開き直し、BR2.12（C02の `resolvePath`）とWF2.6を加え、`contract-summary.md` のC02に追記した。そのレビューはREADY。contract-design自体はやり直していない（エンジンはcontract-designを「drifted」と表示する。人間が選んだ扱い）。
- R-09：`runtime/session-port.ts` の `resolvePath` のJSDocに、戻り値は呼出し時点のcwdであること、予約を取らずdispose・reset・abortを検査しないこと、同期で `INVALID_INPUT` を投げること、呼出し側は予約保持中か同じtickのうちに使うことを書いた。interfaceのコメントだけで、生成した `session-port.js` は変わらない（追記した文は `.js` に含まれない）。
- R-10：`current-recovery-verification.md` の冒頭に、3回目の再開で製品コードが変わったことへの参照を加えた。
- traceability.json：BR2.12を `runtime/lifecycle.ts`・`tests/migration-session/reservation.test.ts` に対応づけた。
- mainの観測（Node v26.12.0）：`mise run build` exit 0。`node --test --test-concurrency=1 tests/migration-session/reservation.test.js` は12件pass、fail・skip 0。

## 3回目の再開：U4の変更の引受け（2026-10-17、Step 16）

U4の追加Step項目3・4で、U2がclaimするfileが変わった。人間の判断で、この変更をU2の変更として引き受けた。下のStep 14の「U2の製品コードは変わっていない」は、この変更より前の記述である。
- 製品コード：`runtime/session-port.ts` の `SessionPort` に `resolvePath(path: string): string` を加えた。`runtime/lifecycle.ts`（生成した `lifecycle.js` にも反映済み）が実装する。相対pathは現在のcwdに付け、既存の `normalizePath` で正規化する。空・`..`・NUL・文字列でない値は `INVALID_INPUT`。cwdを読むだけで、session状態を変えず、予約も取らない。
- 既存の振る舞いを変えないこと（fileを読んで確認）：`runtime/validation.ts`（`normalizePath`）は変わっていない。既存のSessionPortのmethodとC02/C03の振る舞いは変わっていない。`session-port.js` はpackageのfilesに入るが、exportsには出していない（U4のconsumer試験が `ERR_PACKAGE_PATH_NOT_EXPORTED` を確かめる）。
- 試験：`tests/migration-session/reservation.test.ts` に2件を加えた（相対・`.`・絶対pathの解決とcd・resetの後の解決／不正な値の拒否、状態不変、予約を取らないこと）。`tests/package/public.test.ts` のroot exportの一覧に `createCommandSession` を加えた。`pack.test.ts`・`package/coverage.test.ts`・`terrarium/coverage.test.ts` の件数（23件・33件）と名前の一覧は、U1のStep 18と同じ変更である。どれも期待値を実際の一覧に合わせただけで、判定条件は緩めていない。
- `tests/migration-install/lifecycle.test.ts` の模擬portへの `resolvePath` の追加はU3のfileなので、U3のやり直しで引き受ける。
- source-manifest.json：上のfileはすべて既にclaimしている。追加はない。traceability.json：既存の行（BR2.5・NFR4.2→`reservation.test.ts`、BR2.7→`session-port.ts`）が今回の変更を覆う。行の追加はない。
- mainの観測（2026-10-17、Node v26.12.0）：`mise run build` 成功。`node --test --test-concurrency=1 tests/migration-session/reservation.test.js` は12件pass（resolvePathの2件を含む）、`tests/package/public.test.js` は6件pass。どちらもfail・skip 0。
- 最終的なsourceでのU1〜U4のまとめた確認はU4の後に行う。それまでは、v10を変更後のsourceの成功証拠として扱わない。

## 2回目の再開：U4の作業を戻した後（2026-10-17、Step 14）

U2のレビュー（review-06）の後に、U2がclaimする共有fileが変わった。理由は2つある。
1. 一時的に外していたU4の作業を戻した。
2. AI-DLCを2.11.1-preview.20261016.1に更新した（人間の承認済み）。

mainが、7c7ceaf4との差分（`jj diff --stat`）を確かめた。
- `runtime/public.ts`：1行追加（`createCommandSession` のexport）。
- `types/index.d.ts`：68行追加（C05の型）。
- `scripts/package/stage-package.ts`・`coverage-inventory.json`：各2行追加。配布JSに `runtime/command.js`・`runtime/command-parse.js` を加え、23件になった。
- `README.md`：6行追加。
- `package.json`：files、@types/node 26.6.5。
- `mise.toml`：U4のtaskとAI-DLCのpin。

`public.ts` と `index.d.ts` に、削除した行はない。既存のU2のAPI（C02の内部port、C03の `validateGuest`・`fixtureToFsEntries`・`runValidatedGuest`・`registerValidatedGuest`）の定義は変わっていない。U2の製品コード（`runtime/guest-validation.ts`・`session-port.ts`・`lifecycle.ts`・`state.ts` など）も変わっていない。

intentの検証コマンドは、人間の承認により、U1の試験を今のsourceで実行するコマンドに置き換わった（mainの実行で101/101がpass）。下のv10の照合は、U4の作業を戻す前のsourceに結び付いている。U4を含む最終的なsourceでの確認（U2の単体・browser・consumer・coverageを含むU1〜U4のまとめた確認）と、新しい検証コマンドは、U4の作業がすべて終わった後に行う。それまでは、v10を変更後のsourceの成功証拠として扱わない。

## 現在の結果：v10（2026-10-17、最新toolchain）

方針（人間の指示、2026-10-17）：古い版のtoolで作った記録は履歴であり、今のtoolchainの根拠にしない。最新版（Node 26.12.0、Bun 1.4.3、Playwright 1.64.1）で実行した成否だけで確かめる。

- 入力：`.artifacts/migration-preflight/current-recovery-input-20261017-v10.json`（SHA256 `56c78183f6b1af91f9e1de7a1179c6d9ba416ff2be584834d4f5931a050d6fb9`）。reportの `preparedInput.sha256` と一致することを読取りで確認した。
- report：`.artifacts/migration-preflight/current-completion-7de2263f-2f39-4236-8895-82b7f32b55a8/current-local-verification-report.json`（SHA256 `e7760ddbe0e943d0830e8a7093c30a5898cfc86f8d49ed5d94f7e55dab197a01`）。この値は承認済み検証コマンドの引数と一致する。ファイル自体のSHA256はmainの検証コマンドが照合した（本記録では再計算していない）。
- reportの読取り：`exitCode` 0、`signal` null、`currentSourceVerified` true、`preflightEvidenceNode` `v26.12.0`。20工程すべて `exitCode` 0。全体は `2026-10-17T02:15:47.174Z`〜`02:34:25.193Z`、工程1（build）の開始 `02:15:48.007Z`、工程20（coverage report）の終了 `02:33:57.987Z`。
- U2の試験を含む工程：工程7 `mise run migration-session-unit`、工程9 `mise run migration-session-browser`、工程11 `mise run test-consumer`、工程15–16 計測Node（工程16はtests/migration-session/のguest-validation・fixture・reservation・public・consumerを含む）、工程17 計測packageブラウザ、工程18 計測U2ブラウザ（tests/migration-session）、工程20 coverage report。
- coverage（同じdirectoryの `coverage/coverage-report.json`）：1768/1929行＝91.65%、skipped 0、threshold 80、passed true、配布JS 21件、realm 1495件。
- 承認済みの検証コマンド：`aidlc/spaces/default/intents/261012-terrarium-migration/verification/verification-command-u1u2-v10.txt`（Node 26.12.0の `current-completion.js verify`、入力・reportと上記2つのSHA256を指定）。mainが実行し、`verified:true` を観測した（mainの観測であり、本記録での実行ではない）。
- U2の製品コードは変えていない。コードの変更はU1のfileだけである。v8とv10のcoverage reportで、U2のruntime/guest-validation.js・session-port.js・state.js・lifecycle.js・public.jsを含む全21配布JSの `sourceSha256` が同じであることを読取りで確認した。
- 境界：`acceptancePassed=false`、`mergeAllowed=false`、`laterUnitAcceptance=false`（mainがv10 reportのtop-level fieldを読み取って確認した）。現在sourceの署名付きCIとmergeは未受入れ（reportの `pending` に `current same-source signed CI before merge` がある）。実機Safariは未検証（reportの `realSafari` は `未検証`）。
- 以下のv8・v4〜v7の記述は、古いtoolchain（Node 24.21.0）での履歴であり、今の判定には使わない。

## 今回の変更と現在の証拠

検証済み（固定入力・結果・原ログの読取り照合）：既存C02/C03実装を保持し、U2記録を現在のv8証拠へ整合した。今回の変更は本summary、current-recovery-verification.mdと計画Step9/10の完了checkboxのみ。traceability.jsonの26対応とsource-manifest.jsonの91個別パスは全て存在し、一覧の重複なしのため内容を保持した。アプリケーションコード、承認済み計画本文・試験指示、U1成果物・完了承認、封印証拠は変更していない。

v8入力SHA256は25d44cb9c6def3cdc65317d76add2ecb90b5010fc05f4e097f982cdf98655bd0、結果SHA256はfe0d5a01fe5e193258f10371d9cd7c3a446b8b820f3005dabcaeca0300b63079。mainによる既存の全21工程（2026-10-16T10:18:42.073Z–10:42:13.335Z）は全てexit0。21JS/31pack、1768/1929行（91.65%）、1495 realms（Playwright Node12件を含む）、skip0。394 source・435 evidence・actualSite全rowsと独立consumer31ファイルのSHAは不一致0。U2 Node44、3ブラウザ9、計測付きU2/U3 Node115、既存consumer204・Node core28・ブラウザcore33の成功を原ログで照合した。本U2再開で全21工程を新規実行したとは主張しない。

主担当が同じ承認済み短時間verifyを今回再実行しexit0、verified=true、currentSourceVerified=trueを観測した。正式U2 checkpointは本記録時点で未完了。acceptancePassed=false、mergeAllowed=false、laterUnitAcceptance=falseを保持する。現在同一sourceの統合前署名付きCI、現在候補のU3正式HTTPS36試行・専用CIは未完了。共有SHA256改善と生記録照合は既存の検証対象であり、本再開で再実装しない。U3コードの存在から受入れを推定せず、U4/B1、U5開始、公開を許可しない。実機Safariは未検証。

## 実装判断・試験と計画との差分

ドキュメント根拠と実装読取り：guest私有copy/WeakMap brand、同期SHA256・ELF検証、fixture/path/inode検証、唯一のsession予約/token/epoch、取消・cleanupと原子的commitを維持する。既に承認されたU3の共有SHA256改善を含む現在sourceがv8検証対象。追跡表のOKは実装/試験ファイルへの対応であり、正式受入れ状態ではない。

品質基準80%、180秒期限、非download中央値3秒、probe600秒、aubeブラウザ840秒、1worker/retry0、probe8項目、native一致、wasm1GBと容量上限を変更していない。今回の記録整合に新規テストは追加せず、既存suiteを再実行していない。計画との差分なし。正式完了確認は主担当が承認済みverification-command.txtを使用する。

旧v4–v7および旧16JS/26pack署名付きCIは履歴であり、v8へ再ラベルしない。詳細はcurrent-recovery-verification.mdを参照する。

## 以下は再開前の履歴（16JS/26pack、現在候補のCI証拠ではない）

以下の「現在」「現」「未完」等は当時のattemptに限る。現在の状態は上記とcurrent-recovery-verification.mdを規範とし、過去のsource/pack・署名付きCIを現在の21JS/31packへ再ラベルしない。

U2 の guest/fixture 検証、session 排他・取消、C03 公開 API を実装した。レビューで見つかった有限symlink再利用の誤拒否を修正し、AI-DLC preview更新を含む現在sourceに対する統合前CI run38438640770/attempt1成功をmainが独立確認した。固定16 JS/1370 realms、1201/1336 lines＝89.89%、threshold80/passed=true。Step9のcanonical command承認・完了確認は未完、U2 acceptancePassed=falseを保持する。

## 履歴：統合前 CI 観測（当時のレビュー修正後）

[run38438640770](https://github.com/Marukome0743/formicarium/actions/runs/38438640770) attempt1、job115439127501はsuccess。head d9beae83ba98e5bffdd6ae3653e40da4f47612c1はGitHub署名Verified。sourceIdentity e8a6105297897a01bf1d1b636d81b1c3c2078ef5d40cb78b3982b736e139725f、pack SHA c2d801b1f0abb8bac8aa619778844b8979a6c7ed9d69267fc58b4607c180a245。現在の277 sourceFiles全件とCI一覧、署名後の新local candidate/独立consumer packが一致した。

artifact11836212352は211870 bytes、ZIP SHA 4a63b7d55bd3ff16f00ae098abbde60a851d83b6c755710272613da134b695c9がGitHub digestと一致。全16 file line mapから1201/1336と89.89%を独立再計算し、1370 realm名の重複なし、threshold80/passed=trueを確認。observed summary SHAは3b0d190609a1322a2c1d6b7bf41656ea7c981aaa9132284ee6ab59b53607d8d3。同recordのci-observed-38438640770.jsonとci-trial-38438640770.logを参照。rawは.artifacts/migration-session/ci-evidence-38438640770/に保存。

CI入口10件、unit177 pass/既存known skip2、tooling236、U2 Node44/browser9、consumer189、Node build/probe/aube28、browser probe/aube33が成功。計測Node package115/U2 44、browser package99/U2 9も成功。既存skip2は成功件数へ加算しない。実機Safariは未検証、U3/U4/C06/B1・公開は未受入。

fixtureToFsEntriesのactiveリンク集合をリンク自身のtarget解決中に限定し、caller suffixの有限な2回/3回再利用を受理する。修正前の新回帰1失敗をmainで観測し、修正後fixture9件とU2 Node44/browser9を成功。自己・相互・parent-component循環/root脱出/非directory親の拒否を維持。

## 過去の統合前 CI 観測（修正前source）

[run38393506506](https://github.com/Marukome0743/formicarium/actions/runs/38393506506) の head は `268b323d96bfbcd2eb2fe0e03d5941eedc033871`（GitHub署名Verified）、sourceIdentity は `93e5957fccb5e862c13f8f1f56a10e97699ee64214004b9ce9a9f7d77f6f17de`、fresh pack SHA256 は `e68fec9379c70008dd43d4980bd756336b94297c1dd376f0e1aabbc3297a2ae0`。以前の local source/packへ再ラベルせず、CIの実head、新stage、独立consumerと逐次suite/全realmを別の証拠として記録する。

main は artifact11814487608 の ZIP を取得し、SHA256 `a10834eca73b5ca5e904cec4d8c645d62d861f6dd3dc5532905d71f2bf769b83` の一致を観測した。展開先は `.artifacts/migration-session/ci-evidence-38393506506/`。`completion-090b4c8e-9359-463d-b5ed-8961217ab900/coverage/coverage-report.json` は固定16 files/1370 realms、1199/1334 lines＝89.88%。raw Node/browser realms、mapping metadata、候補manifest、core復元receiptも保持する。main の独立相互照合 `verify-ci-evidence.mjs` はexit0で、同recordの `ci-observed-38393506506.json`、実ログ `ci-trial-38393506506.log` に保存済み。job内部 `checksCompleted=true` だけを最終受入根拠にしない。

CIの `ci-job-observations.json` は実assembly日時 `2026-10-13T12:44:45.915Z`、acceptancePassed=false、jobConclusionは独立GitHub API観測を要求する。Step9 canonical承認・レビュー/checkpoint、実機Safari、U3/U4/C06/B1と公開は未完/未検証。下記のCI未検証という記述は、その時点の過去 local attempt の状態として保持する。

## 変更

- runtime/guest-validation.ts と生成 JS：同期 SHA256/canonical metadata、全 ELF/metadata identity、容量境界、private WeakMap handle、fixture copy/path/link/hardlink 検証。
- runtime/state.ts、lifecycle.ts、session-port.ts と生成 JS：token/epoch、単一予約、atomic guest registry、予約済み継続、reset/dispose 取消と有限 Worker cleanup。C02 は公開 exports に含めない。
- runtime/public.ts と生成 JS、types/index.d.ts：C03 の validateGuest/fixtureToFsEntries/runValidatedGuest/registerValidatedGuest と型。
- package.json の files、scripts/package/stage-package.ts/JS と coverage-inventory.json：新 2 JS を含む固定 16 配布 inventory。root 版は変更しない。
- tests/migration-session/ と生成 JS：guest 9、fixture 9、reservation 10、public 8、実 consumer 8、三ブラウザ 3 ケース、型 fixture、completion 境界 3（fake executor を明示）。tests/package/lifecycle.test.ts/JS は承認済み reset 取消仕様に従い旧 reset BUSY 期待のみ変更。
- scripts/migration-session/ と生成 JS、mise.toml：staging 0.3.0 pack、working source inventory、逐次 completion、追加 coverage 収集。README.md/docs/terrarium-integration.md は API と制約・候補状態を説明。
- scripts/migration-session/{ci,ci-inputs,ci-core}.ts/生成JS、tests/migration-session/ci.test.ts/生成JS、専用 migration-session-u2.yml：固定task adapter、19 destination/全SHA/capを要求するbranch-owned payload、固定Git object bundleのnetworkなし復元、実CI head/source/pack結合、独立consumer、raw realm artifact。setup-bun後に絶対path/実行可能/version1.4.2を検証し BUN_EXECUTABLEを登録する。
- tests/package/{public,coverage,pack}.test.ts/JS、tests/terrarium/{coverage,current-candidate}.test.ts/JS：承認済み7 export、現16 JS/26 pack files と歴史14 JS/24 coverage の境界を明示する。旧証拠の入力を現候補の証拠へ再ラベルしない。
- scripts/release/{inventory,publication,publication-cli}.ts/JS、tests/release/publication-alignment-fixture.ts/JS、tests/tooling/{publication-alignment,publication-version}.test.ts/JS：現配布の準備と歴史的公開 proof を分離し、現 U2 公開を fail closed にする。正式 generator により .github/publication/{runner.mjs,bootstrap.mjs,runner-manifest.json} を main が再生成・独立再生成照合した。

## 決定と境界

caller の固定カタログから GuestExpectation を渡す。未知 metadata field も canonical digest に含める。入力 byte/metadata を内部 copy し、公開 handle の構造を複製して権限を作れない。JSON 重複 key は raw JSON 所有者の責務であり、U2 object API が復元したとは主張しない。

既存 raw run の guest 非ゼロ結果、snapshot、timeout、Worker cleanup を維持する。reset は取消・cleanup 後に seed FS/cwd を復元し registry を消去する。登録、run、FS は同じ session 予約を使い内部継続は二重 acquire しない。

暫定 candidate は staging 内の 0.3.0。sourceCommit は base revision として明示し、実 working source の SHA inventory を別に bind する。公開 0.2.1 pack と変更前 JS14/型3 は main で一致確認したが、core assets は Emscripten 6.0.12/6.0.10 で byte 不一致である。原因を compiler 版だけと断定しない。新 candidate 自身で検証する。

coverage は固定16 JS（未 import は0）を分母にする。既存 25 Node Worker/33 browser ケースを保持し、U2 Node Worker 5 と browser 17/0/17 Worker を厳密検査する。runtime/node/api.ts と lifecycle.ts が同期 spawn するため、取消 consumer ケースにも実 Worker が存在する。前回の4という予定値は誤りであり、実5件を削除せず保持する。新 consumer ケースは最初の実 byte output の Promise barrier 後に reset し、Worker bootstrap を実行したことを確かめてから取消と再利用を検査する。即時取消は既存 reservation 試験を保持する。host が登録 bit や product counter を書いて成功に見せることはしない。実 pack/installed byte を先に照合し、instrumented copy は別の収集境界として記録する。foreign-instance 試験は元 installed package を保持する。

## main の観測済み結果

正確なコマンド・失敗/Retry 履歴・候補 path は observed-verification.md に記録される。

- runner-ready 3 成功、build/typecheck 成功。
- guest/fixture 17 成功（128 MiB/256 MiB 境界を含む）。
- reservation + 既存 state/lifecycle 33 成功（新 reservation 10）。
- public 8、独立 Node consumer 8 成功。
- 同一新 pack の Chromium/Firefox/WebKit 9 成功、17.5 秒、worker 1/retry 0。

前回の path Retry は source identity `bfd874b51fd00605b48e10c94e12935f4aaad6e61c5f96f9ad8d0175b68d5d49`、candidate `0fba587c...`、独立 consumer `de8cce69...` へ bind して main が実行した。以下はその attempt の観測であり、最終集計は取消 Worker の未登録で失敗した。略記 path の完全値と pack SHA は observed-verification.md の実コマンドを参照する。

- build/typecheck 成功、stage の固定16 JS/26 files と独立 installed bytes を照合済み。
- coverage helper の guest path を `resolve(root, envPath)` で absolute にし、fresh path-check の専用 browser discovery で9件を確認した。
- 現再試行の test-light：unit 177 pass/0 fail/既存 known skip 2、tooling 236 pass/0 fail。
- 現再試行の U2 Node 43 pass、三ブラウザ9 pass、既存 consumer189 pass、Node build/probe/aube28 pass、三ブラウザ probe/aube33 pass。
- その再試行の measured package Node115、measured U2 Node43、package browser99、U2 browser9は全pass。最終80% reportは取消 Workerの未登録により非成功。

既存 known skip2 は成功件数へ含めず、統合前 CI と同様に checkpoint で明示する。前の path失敗 attempt で measured U2 Node43 と package browser99 が成功していても、現再試行の証拠へ流用しない。

## 過去の失敗・診断と local 完了結果

### Worker 集計修正の main 境界検証と診断

修正後の format/build/typecheck は exit0、completion 境界6件は188.987916 msで成功、非計測の独立 consumer8件は6690.538292 msで成功した。fresh 診断 copy の consumer8件は292440.111708 msで成功し、5 Workerすべてで実 bootstrap bit1を観測した。各 Worker の非ゼロ statement数は230/230/230/184/230で、取消 Workerも実測値として残る。

診断集計は固定16 files、1199/1334 lines＝89.88%で成功した。ただし prior host/fresh hostの明示した max union、prior package Node/browserの provenance付きコピーを使用した診断である。新 source の最終coverageや受入証拠ではなく、過去outputを上書きしていない。前回の source `bfd874b...` では measured U2 Node43/package browser99/U2 browser9が全成功し、最終集計だけが未登録 Workerで失敗した。

main は新 source identity `6d6be261d196a83a0774f289ad56ef019923dfa819e4c79b697953ce0efece98`、candidate `49df6ae6-977f-4cad-9391-633083a2cd1c`、独立 consumer `2c80314e-8bd9-473c-b564-9305d69d360b` の fresh full retry を exit0で完了した。packは同じ実16 JS/26filesだが、source/試験と測定 attemptは新規であり、前の結果を流用していない。完全 path/pack SHA/コマンドは observed-verification.md を参照する。

fresh測定：package Node115 pass（6540.33075 ms）、U2 Node43 pass（743312.092125 ms）、package browser99 pass（9.1分）、U2 browser9 pass（9.3分）。`.artifacts/migration-session/completion-d3a2ae8c-d7c2-421d-8360-30ba2e63c8f6/coverage/coverage-report.json` は固定16 files/1370 realms、1199/1334 lines＝89.88%、threshold80/passed=true。local-provisional-report は実 assembly日時 `2026-10-13T10:47:31.682Z`、localPassed=true/acceptancePassed=false、統合前CI未検証を記録する。診断 max unionを使った89.88%とは別の fresh全試験・全realmの最終local結果である。Step8/9はCI/canonical承認待ちのため未完を保持する。

取消 Worker の集計修正前 attempt（source `bfd874b...`）では全 Node/browser 試験が成功した後、最終集計で5 Node Workerのうち4番目が bootstrap 未登録・全0であると判明した。誤った exact4 予定値だけを5へ広げても未登録拒否が残るため、ユーザー承認の下で上記の実 output barrier と exact5検査を実装した。既存 tests/migration-session/completion.test.ts に missing/extra/duplicate/未登録の拒否と entered cancellation Workerの保持を確認する狭い回帰3件を追加した。新 runner/task/試験指示は追加・変更していない。この修正の build・境界試験・診断・fresh full retryは上記のとおり成功した。過去測定 byte は診断にだけ用い、新 source の final local結果へ流用していない。

test-light の既存 export/固定一覧期待を新 C03 の7 export/現16 JSへ合わせた。歴史的 Terrarium/release coverage は明示した旧14 JS/旧24固定一覧へ分離した。配布一覧の17既存失敗に対する修正では publication 準備を16 JS/26 pack filesへ同期し、既存公開 gate は現 U2 pack を新 module proof不足で拒否する。歴史的24 pack の mocked 正例を明示固定し、現26 pack＋歴史24coverageでは executor 0 を検査する負例を追加した。正式 bundle generator の generate/verify と tooling236は main が成功を観測済み。任意の追加 evidence field による公開権限の拡張はしない。

過去の失敗は記録を保持する：型 fixture の注釈位置、browser webServer cwd、旧 export/分母期待、publication 旧一覧、fixture rename 残り、consumer 旧 count2件、coverage helper の相対 guest path。各失敗後の Retry 承認に従って scoped 修正・再生成・新 staging/独立 consumer・再実行を行った。生成済み coverage output や凍結 U1 report の手編集で通していない。

共通 local command は人の承認済みで main 実行成功。固定16 JS coverage ≥80% の最終local観測は完了し、その後の上記CI source/packでも統合前CI成功を実観測した。canonical承認は未完。traceability.json の OK は実装/試験ファイルへの対応であり、U2最終受入を示すものではない。

最終 completion は CI 入力が欠ければ重い処理前に拒否する。明示した local-only モードは local-provisional-report.json に acceptancePassed=false と CI 未検証を保存し、U2 最終受入へ昇格しない。実機 Safari、U3 install/U4 command/C06/B1、実公開は未検証/対象外。U1 の source/実36試行/CI 証拠は変更していない。

計画本文・Testing Contract・試験指示は変更していない。Step1–8 の実完了だけを tick し、Step9 は canonical承認/完了確認前のため未完を保持する。専用branchのblob/input manifestと検証に必須の既存依存閉包は main の隔離checkout記録で追跡し、主workspaceのignored scratchを製品source claimへ含めない。
