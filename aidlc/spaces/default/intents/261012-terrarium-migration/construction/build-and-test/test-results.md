# Build and Test Results

途中の結果（2026-10-22、Build and Test の1回目の実行）。目標の一覧（170件）の判定は、loop-back の後の実行で仕上げる。

## Build

- 土台：formicarium の upstream main `6b5bac1f`（jj workspace `.artifacts/ws-biome`）。Node 26.12.0（実行の時点）、Bun 1.4.3、Biome 2.6.2。
- `mise run lint:all` exit 0（エラー0、警告48・info 47）、`mise run typecheck` exit 0、`mise run build` exit 0。

## 試験（main session が1つずつ実行）

| command | 結果 |
|---|---|
| `mise run test:light` | exit 0。bun 71 pass、tooling 38 pass、node 120件中 118 pass・skip 2（既存）、124 pass |
| `mise run migration:preflight-unit` | 57 pass |
| `mise run migration:preflight-current-unit` | 21 pass |
| `mise run migration:guest-build-unit` | 12 pass |
| `mise run showcase:typecheck` | exit 0 |
| `mise run showcase:unit` | 100 pass |
| `mise run showcase:boundary` | exit 0 |
| `mise run showcase-site:unit` | 185 pass |
| `mise run migration:session-unit` | 48件中 47 pass・1 fail（`consumer.test.js`：「U2 candidate, independently installed consumer and real guest inputs required」。手元に CI の候補・consumer・ゲストの入力が無い） |
| `mise run migration:install-unit` | 69件中 1〜2 fail（同じ consumer の入力。ws-biome では U1 の aube の archive も無い） |
| `mise run migration:command-unit` | 107件中 106 pass・1 fail（同じ consumer の入力） |

consumer の試験の入力を作る CI として、人間の承認で `migration-acceptance.yml` を main で1回起動した（JamBalaya56562 の account、run 39702294398、head `6b5bac1f`、2026-10-22T00:52:19Z〜00:57:17Z）。結果は **failure**（log：`.artifacts/build-and-test/logs/migration-acceptance-39702294398.log`）。

- 失敗した試験：`tests/migration-install/runner-ready.test.js` の「U3 runner executes Node 26 ESM with web stream primitives」。`assert.equal(process.versions.node, '26.12.0')` に対して、CI の Node は `26.12.1`（`actual: '26.12.1'`、`expected: '26.12.0'`）。続いて `migration:install:unit` が exit 1 になり、U4 の completion が止まった。
- 同じ固定は `tests/migration-command/runner-ready.test.ts` の15–16行（`26.12.0`）にもある。ほかの runner-ready の試験（`tests/package`・`showcase`・`showcase/site`）は major の版だけを確かめている。
- 手元の Node も最新ではなかった（26.12.0）。`mise install node@latest` で 26.12.1 にした（project の決まり：最新の道具で開発・検証する）。

## Loop-back 1 の後の実行（2026-10-22、upstream main `6a90a45b`）

- 土台：jj workspace `.artifacts/ws-biome` を `jj new main@upstream`（`6a90a45b`）にした。Node v26.12.1、Bun 1.4.3。`dist/guests/aube` の SHA256 `c7d7d136…cd99e`（実行の前、`.artifacts/build-and-test/logs/b2/p0.txt`）。aube は再ビルドしていない。
- main の CI（run 39706177745、`6a90a45b`）：全 job success（Build probe・wasm・guests、quality、Product node・chromium・firefox・webkit、ci-required）。log：`.artifacts/build-and-test/logs/ci-39706177745.log`。
- 受入（run 39709015067、`6a90a45b`）：success（上の Loop-back 1 の記録と U3・U4 の code-summary）。

| command（1つずつ、`.artifacts/build-and-test/logs/b2/`） | 結果 |
|---|---|
| `mise run lint:all` | exit 0（警告48・info 47、エラー0） |
| `mise run showcase-stage` | exit 1：`pack verify failed: config-invalid: verify needs the 40-hex source commit`（`SHOWCASE_SOURCE_COMMIT` か `GITHUB_SHA` が要る。手元の環境の不足で、製品の不具合ではない。未解決） |
| intent の検証コマンド（VC-1：typecheck・build・test:light・preflight-unit・preflight-current-unit・guest-build-unit・showcase-unit） | exit 0（03:12:33Z〜03:13:26Z）。bun 71 pass、tooling 38 pass、node 120件中 118 pass・skip 2（既存）、124 pass、preflight 57 pass、preflight-current 21 pass、guest-build 12 pass、showcase 100 pass（行 coverage 88.60%） |
| `mise run showcase-typecheck` | exit 0 |
| `mise run showcase-boundary` | exit 0 |
| `mise run showcase-site:unit` | exit 0、185 pass（単体だけの行 coverage 73.78%。U8 の基準はブラウザの V8 と合わせた値で、合算は未実行） |
| remote・infra の読取り（`p18-p21.txt`） | formicarium・vivarium とも remote は origin・upstream だけ。両方の `infra/` に terrarium の言及なし（vivarium の最初の検索は mise の shim の error で実行されなかったので、実体の `rg`（`mise which rg`、ripgrep 15.2.0）でやり直し、一致なし rc=1。file の最後の行）。#58（`5735433d`）の `infra/github` の差分は説明の文だけで、ruleset は変えていない |

目標の一覧の判定（`build-and-test-summary.md`）は、この実行の結果をまだ反映していない。重い確認（ブラウザ・vivarium・artifact の取得）は未実行。

### 重い確認（人間の承認「残りの重い確認を1つずつ実行してください。CI の artifact の取得もして良いです」、2026-10-22）

| 確認 | 結果 |
|---|---|
| CI の artifact の取得：run 39709015067 の `migration-acceptance-completion-39709015067-1` | 取得した（`.artifacts/build-and-test/ci-39709015067/`）。`local-provisional-report.json`：`status: local-provisional`、`localPassed: true`、`sourceCommit` `6a90a45b…`、blocker は `new U4 signed CI not independently verified` の1件。`measurement-report.json`（unit u3-install）：`passed: true`、36試行、基準 3000ms、最も遅いのは biome/Firefox の最大 2614.3ms（中央値 2587.34ms）。`coverage-package`（`browser-api.spec`・`browser-worker.spec`・`browser-broker.spec`・`consumer.spec`、`--workers=1 --retries=0`、Node 26.12.1）は exitCode 0 で、UNSUPPORTED_ENV の試験を含む |
| CI の artifact の取得：run 39509852083 の `showcase-site-evidence-39509852083-deployed` | 取得した（`.artifacts/build-and-test/u8-39509852083/`）。`evidence.json` の SHA256 `11e9192b…efba3` は記録と一致。27 checks すべて passed。sourceCommit `c8497135`（2026-10-20）の配布の記録で、今の main の run ではない |
| `mise run showcase-accept-node` | exit 1：`ENOENT … showcase/.work/site/catalog.json`。前の工程（resolve・acquire・guest の build・catalog）の出力が要る。その工程は Linux の CI（`musl-tools` で guest を compile し、CA を system の信頼に入れる）で動く。手元の macOS では実行できない |
| U1 `mise run migration-preflight-browser` | 未実行。公式の資産は loopback の http では取得できない（前の記録の ASSET_LOAD）。HTTPS の mirror には、macOS の keychain への証明書の一時登録が要る。これは人間の操作なので、まだ行っていない |
| U2 の COI の24組の観測 | 未実行。今の main で pack を作り直し、観測用の page・`assets.json`・coi-serviceworker の写しを vivarium に置く手作業の手順（U6 の code-summary の「Step 3 の配布物の bundle での観測のやり直し」） |
| vivarium（main `06b96398`、Node 26.12.1、Bun 1.4.3、`.artifacts/build-and-test/logs/b2/vivarium/`） | `mise run ci:fixed-guest-builder` exit 0（188 pass・0 fail、行 coverage 98.49%。log の「could not compile」は失敗を模した試験の出力）。`mise run fixed-guest-builder:check` exit 0。`mise run ci:docs-unit` exit 0（208 pass・1 skip・0 fail）。`mise run docs:check` exit 0。`bun test …/verdict.test.ts …/formicarium_terminal.test.ts`：31 pass・0 fail |
| vivarium の U6 Playwright（`src/layer1_wasm`、Playwright 1.64.1、`--workers=1 --retries=0`） | chromium 3 passed（13.6s）、firefox 3 passed（31.4s）、webkit 3 passed（16.3s） |
| U9 の外部の読取り（`p17.txt`） | GitHub の `aletheia-works/terrarium`・`Marukome0743/terrarium`・`JamBalaya56562/terrarium` はどれも存在しない。npm の `@aletheia-works/terrarium` は 404（最初の `npm view` は registry の 502）。JSR の `meta.json` は 200（記録のとおり、削除できず archive。3つの版が残る）。`https://aletheia-works.github.io/terrarium/` は 404 |
| `aidlc/` の外の terrarium の言及（今の main） | 34 file（記録と同じ数、`p19-files.txt`） |


### 人間の指示の後（「U2 の COI の観測をしてください。U1 の証明書は自分で登録します。showcase.yml（verify）と showcase-site.yml を main で手動で起動してください」、2026-10-22）

- **起動**：JamBalaya56562 の account で `showcase.yml`（run 39716571748）と `showcase-site.yml`（run 39716574987）を main（`6a90a45b`）で起動し、Marukome0743 に戻した。
- **Showcase guests（run 39716571748）**：success（resolve・acquire・catalog・accept・candidate）。showcase の単体 100 pass（行 coverage 88.60%）、Node の受入 aube・pitchfork・biome が passed、ブラウザの受入 9 passed（32.1s）。log：`.artifacts/build-and-test/logs/showcase-39716571748.log`。
- **所見（Node の版の固定）**：`.github/workflows/showcase.yml`（5か所）と `showcase-site.yml`（12か所。`grep -c` で数え直した）が `node-version: '26.12.0'` と固定している。今の最新は Node 26.12.1（`gh release list -R nodejs/node`）。そのため、この run も古い Node（v26.12.0、log の setup-node）で動いた。最新の道具を使う決まりでは、古い版の結果は履歴であり、今の道具の証拠ではない。ほかの workflow（`ci.yml` など）は `latest`。Bun の `1.4.3` は今の最新と同じ。直すのは U7（`showcase.yml`）と U8（`showcase-site.yml`）の Code Generation の範囲。
- **U2 の COI の観測**：今の main で pack を作り直した（`.artifacts/ws-biome/.artifacts/u6-coi-6a90a45b/`、0.3.0、34 file、`verify-package.js` exit 0、tarball の SHA256 `32964d0c…5e7e` は CI の受入 run 39709015067 の候補と同じ）。U6 の手順の写し（候補2、`coepCredentialless` false）を vivarium の `src/layer1_wasm/biome-u6-s8-probe/`・`.scratch/u6-s8/` に置き（`.git/info/exclude` に一時に足した）、Playwright 1.64.1 で1ブラウザずつ実行した。chromium 2 passed、firefox 2 passed、webkit 2 passed。3ブラウザ × en・ja × 初回・再訪問の12の訪問すべてで、page と子 Worker（30〜32個）が crossOriginIsolated・SharedArrayBuffer、2端末とも ready（exit 0）、console の error なし。最も遅い訪問は firefox ja 初回の 35.6秒（上限 120秒）。log：`.artifacts/build-and-test/logs/b2/coi/`。置いた file は消さずに `.artifacts/build-and-test/coi-vivarium-staging-20261022/` へ移し、`.git/info/exclude` を戻した（SHA256 `03f34bb1…a32d` が前と同じ）。vivarium の `jj st` は「The working copy has no changes.」。
- **Showcase site（run 39716574987）**：success（全 job。candidate・build・accept-chromium・accept-firefox・accept-webkit・coverage・evidence・deploy・verify-deployment・showcase-site-required・summary）。site の受入は chromium 16 passed（6.0m）、firefox 16 passed（3.4m）、webkit 16 passed（3.0m）。合算の coverage は 94.51%（5450行中 5151、基準 80%）。mode は distribute で、`https://aletheia-works.github.io/formicarium/` に配布した（人間の承認どおり）。どの job も Node v26.12.0（上の所見のとおり古い版）。log：`.artifacts/build-and-test/logs/showcase-site-39716574987.log`。
- **U1 の preflight の準備**：前の証明書（`mirror-tls-20261017`）は 2026-10-19 に期限が切れていた。同じ設定で新しい証明書（`mirror-tls-20261022`、期限 2026-10-25T03:24:03Z、SHA256 `9180F6CE…0031`）を作った。登録・計測・削除の command は `.artifacts/build-and-test/u1-cert-commands.md`。登録は人間が行う。計測は未実行。

### U1 の preflight（人間が証明書を登録した後、2026-10-22）

- 人間が `mirror-tls-20261022` の証明書を login keychain に登録した。`security find-certificate … | grep -ci 9180F6CE…0031` は `1`。
- 1回目（03:45:35Z）：exit 1。`mirror file must be nonsymlink beneath project .artifacts`。mirror の file は、実行する作業場所（`.artifacts/ws-biome`）の `.artifacts` の下に置く決まり（`tests/migration-preflight/serve.ts` 139–142行）。試験は1件も走っていない。
- 対応：mirror の資産（`aube.tar.gz` SHA256 `fc2384d5…`、`biome.elf` `42b6fd36…`、`mirror-input.json`）を `.artifacts/ws-biome/.artifacts/migration-preflight/mirror-assets-node26-20261017b/` に写し、`mirror-manifest.json` の `file` の path だけを写し先に直した。資産の中身と固定値は変えていない。
- 2回目（03:46:02Z〜03:47:27Z）：`mise run migration-preflight-browser` exit 0、**36 passed（1.4m）**、`workers: 1`・`retries: 0`。全 trial の exitCode 0、Node v26.12.1、Playwright 1.64.1、Chromium 156.0.8078.4・Firefox 157.0・WebKit 27.2。trial の phase の合計（fetch〜run）の中央値／最大：aube chromium 824.8／905.7ms、firefox 2245.7／2614.0ms、webkit 777.1／1004.1ms、biome chromium 709.4／956.4ms、firefox 2477.9／2882.0ms、webkit 814.5／959.4ms。log：`.artifacts/build-and-test/logs/b2/u1-preflight-browser-2.log`、trial：`.artifacts/ws-biome/.artifacts/migration-preflight/mirror-browser-20261022/trials/`（36 file）。
- 入力の `sourceCommit` は mirror を作った時の `7c7ceaf4`（資産の固定値の記録）で、試験の source は今の main `6a90a45b`。
- 証明書の削除：人間が行った（人間の報告「削除しました」）。`security find-certificate … | grep -ci 9180F6CE…0031` は `0`（main session が確かめた）。

### 残りの軽い確認（2026-10-22、vivarium main `06b96398`）

| 確認 | 結果 |
|---|---|
| actionlint 1.7.12（実体、`-shellcheck` に ShellCheck 0.11.0）を vivarium の全 workflow に | exit 0、出力なし（`logs/b2/vivarium/actionlint-all.log`） |
| ShellCheck 0.11.0 を `mise run shell:check` と同じ file の集合（`scripts/*.sh`・`mise-tasks/**/*.sh`・`tools/**/*.sh`、24 file）に | exit 0、出力なし（`shellcheck.log`、一覧は `shellcheck-files.txt`）。宣言された task の `mise run shell:check` は、macOS の `/bin/bash` 3.2 が `shopt -s globstar` を持たないため、ShellCheck の前に exit 1（手元の環境の差。CI の Linux の bash では動く見込み、未検証） |
| `FORMICARIUM_LOCAL_TARBALL=<今の main の pack（SHA256 32964d0c…）> mise run ci:docs-unit` | exit 0、**209 pass・0 skip・0 fail**。tarball を渡さないときの1 skip（formicariumTypes の「NOT MEASURED」）は、この試験が tarball を要るためで、渡せば pass する |
| vivarium の guest の Release（`gh release list`・`gh release view`） | `guest-biome-086287f8…`・`guest-biome-dabb518b…` の2件（2026-10-19）。どちらも `biome`・`build-info.json`・`catalog.json` の一組だけ。recipe の `accepted` の buildKey（`086287f8…`・`dabb518b…`）と一致。ELF は 112,564,936 bytes と 112,500,608 bytes（上限 128MiB＝134,217,728 bytes の内）。`logs/b2/vivarium/releases.txt` |

### 目標の一覧の判定（2026-10-22、`build-and-test-summary.md`）

Met 131、Not Met 6、Unverified 26、N/A 7、Pending 0（170件）。stage の決まり（Step 9）では失敗。後の段階が持つ8件（deployment-pipeline・deployment-execution・observability-setup）は延期しても Unverified のまま残るので、Code Generation の修正だけではこの段階は全部の合格にならない。

### 後で扱う所見（人間の判断、2026-10-22「U1 の環境の記録、vivarium の Biome、TC-1 は所見として書き、後で扱う」）

- **U1-NFR1.2**（Not Met）：U1 の trial の記録（`tests/migration-preflight/consumer.spec.ts` が書く `environment`）に OS・CPU・負荷が無い。直すには U1 の Code Generation で記録を足し、36試行をやり直す（証明書の登録と削除は人間）。
- **U5-NFR2.2**（Unverified）：vivarium の lint が Biome 2.5.15（`^2.5.15` を lockfile が 2.5.15 に解決）で動く。最新は 2.6.2。直すのは vivarium の Biome の更新の PR。
- **TC-1**（Unverified）：部品ごとの試験の件数が log から読めない。各 Unit の記録に件数を書く必要がある。

### Loop-back 2 の後の実行（2026-10-22、upstream main `f7b70cac`、PR #66 の merge）

- PR aletheia-works/formicarium#66（`ci/showcase-latest-node`、head `072b1f4e`、1 commit・2 file、署名あり）：`showcase.yml`（5か所）と `showcase-site.yml`（12か所）の `node-version: '26.12.0'` を `node-version: 'latest'` と `check-latest: true` にした。merge `f7b70cac`。
- 土台の差：`jj log -r '6a90a45b..f7b70cac'` は `f7b70cac`（#66）の1件だけ。手元の確認と migration の受入（`6a90a45b`）と、showcase の run（`f7b70cac`）の間の差は、2つの workflow の Node の版だけである。
- merge の push で、main の workflow が自動で動いた（手動の起動は要らなかった）：CI 39724950208 success、Check Conventional Commit success、Release success。
- **Showcase guests（run 39724950076、event push）**：success。setup-node は5か所すべて **Node v26.12.1**。showcase の単体 100 pass・0 fail、Node の受入 aube（install 1117ms、`--version` 406ms）・pitchfork（1021ms、416ms）・biome（908ms、723ms）が passed、ブラウザの受入 9 passed（27.1s）。log：`logs/showcase-39724950076.log`。
- **Showcase site（run 39724950133、event push）**：success（全 job：candidate・build・accept-chromium・accept-firefox・accept-webkit・coverage・evidence・deploy・verify-deployment・summary・showcase-site-required）。setup-node は15か所すべて **Node v26.12.1**。site の単体 185 pass・0 fail、受入は chromium 16 passed（6.1m）・firefox 16 passed（2.8m）・webkit 16 passed（3.2m）、合算の coverage 94.51%（5450行中 5151、基準 80%）、`https://aletheia-works.github.io/formicarium/` への配布と配布後の確認も成功。log：`logs/showcase-39724950133.log`。
- 追跡表：`aidlc engine sensor-traceability --stage build-and-test`（`.artifacts/build-and-test/sensor-traceability-3.txt`）で、読めない target は0件。全体は Fail のまま（U1 の `GAP` 2行、U3 の `GAP` 7行、U9 の `Deferred` 1行。`cross-unit-traceability.md` の訂正の節）。

### U5 の今の Release の metadata（人間の承認、2026-10-22）

- 人間の承認（「vivarium の2つの Release から build-info.json と catalog.json だけを取得し、U5-NFR8.2・8.3 を確かめてから Accept failure にする」）で、`gh release download` で4 file だけを取得した（`.artifacts/build-and-test/u5-release-metadata/`、2,349〜4,019 bytes）。
- `build-info.json` の SHA256 は `80f07338…`（`guest-biome-086287f8…`）と `00bb12d6…`（`guest-biome-dabb518b…`）で、recipe の `accepted` の `buildInfoSha256` と一致。どちらにも `source`（repository・commit）・`target`・`rustc` 1.98.1・`sourcePatches`（空）・`dependencies`・`reference.builder` があり、`builderHash` は同じ（`510a57ee…`）。→ U5-NFR8.2 は Met。
- 4 file に token・secret・password・authorization・bearer・`ghp_` などの pattern の一致なし。しかし Release の asset は `biome`・`build-info.json`・`catalog.json` の3つだけで、license・notices の file は無い。`catalog.json` にも license・notices の欄は無く、vivarium の `tools/fixed-guest-builder/src/*.ts` に license・notice を扱う code は無い。→ U5-NFR8.3（「license・notices を保持する」）は Not Met。直すには U5（vivarium の builder と Release の作り方）の変更が要る。後で扱う所見とする。

### 最終の判定と Accept failure（2026-10-22）

- 目標の一覧（`build-and-test-summary.md`）：Met 146、Not Met 7、Unverified 10、N/A 7、Pending 0（170件）。Step 9 の失敗の条件に当たる。
- 人間の判断：**Accept failure**（「…確かめてから Accept failure にする」）。Loop-back は2回（上限3回）。残る失敗はどれも、この段階の手当てでは直らない。
  - Not Met：U1-NFR1.2（trial の記録の環境。人間の判断で後で扱う）、U5-NFR8.3（Release に license・notices が無い。後で扱う）、U9-NFR1.1・8.2・8.6・8.8・8.10（記録の欠けと、人間が決めた置き換え）。
  - Unverified：TC-1・U5-NFR2.2（人間の判断で後で扱う）、後の段階が持つ8件（U6-NFR6.4・8.5・W5、U8-NFR6.4b・8.1b・8.5・8.9・8.10）。
  - cross-unit traceability：Fail（U1 の `GAP` 2行、U3 の `GAP` 7行、U9 の `Deferred` 1行。`cross-unit-traceability.md`）。
- 基準・timeout を緩めた確認はない。build と、最新の道具で実行したすべての command は成功した（showcase-stage は手元の環境の不足、`shell:check` は macOS の bash 3.2 の差で、どちらも製品の失敗ではない）。

### CI Pipeline の境界の確認の後の戻り（2026-10-22）

CI Pipeline の Construction → Operation の確認（`verification/phase-check-construction.md`）が FAIL になり、人間の判断（CI Pipeline の Q5 の回答 A、そのあと U1・U3・U9 の進め方の質問への回答 A）で、U1・U3・U9 の Code Generation に戻った。人間が決めた戻りで、この file の Loop-Back Log の数には入れない。

- U1：PR aletheia-works/formicarium#68（head `2f77d308`、merge `e0842371`）で、`scripts/migration-preflight/assets.ts` の `extractTar` が64 entry ごとに取消を確かめるようにし（NFR4.1、R-02）、trial の記録に OS・CPU・負荷・試験の source の commit を足した（NFR1.2）。人間が証明書を一時に登録した間に36試行を実行し、36 passed（U1 の `code-summary.md` の「Step 31〜34」）。
- U3（U4 の正式な完了確認で覆う）：run 39709015067 の観測（`observed-ci-summary.json`、SHA256 `25700e77…`）と、新しい jj workspace `.artifacts/ws-u3-formal`（`6a90a45b`）での正式な完了確認が成功：`verified-with-ci`・`acceptancePassed: true`・`b1.formal: true`、B1 31行 passed、36試行 passed、coverage 92.16%（U3 の `code-summary.md` の「Step 27〜29」）。用意の途中で npm が main checkout に誤って install した件と、consumer の置き場所の件も、そこに書いた。
- U9：`NFR8.2` は `Deferred` のまま、人間が失敗のままと承知して記録（U9 の `code-summary.md` の「Step 11」）。
- 最新の main `e0842371`（#66・#67・#68 を含む）で1つずつ：`mise run lint:all` exit 0、intent の検証コマンド exit 0（node 118 pass・skip 2、124 pass、preflight 58 pass、preflight-current 21 pass、guest-build 12 pass、showcase 100 pass）。`.artifacts/build-and-test/logs/b3/`。main の CI run 39746861827 success。
- 追跡の確認（`.artifacts/build-and-test/sensor-traceability-6.txt`）：Fail のまま。未対応は `NFR8`（U9 の `NFR8.2`）だけ。U1・U3・U5・U7 の行は未対応に出ない。

### 2回目の最終の判定と Accept failure（2026-10-22）

- 目標の一覧（`build-and-test-summary.md`）：Met 147、Not Met 6、Unverified 10、N/A 7、Pending 0（170件）。Step 9 の失敗の条件に当たる。
- 人間の判断：**Accept failure**（「Accept failure で進めてください。」）。
  - Not Met：U5-NFR8.3（vivarium の Release に license・notices が無い）、U9-NFR1.1・8.2・8.6・8.8・8.10（記録の欠けと、人間が決めた置き換え。NFR8.2 は人間が失敗のままと承知）。
  - Unverified：TC-1・U5-NFR2.2（人間の判断で後で扱う）、後の段階が持つ8件。
  - 追跡の確認：Fail（U9 の `NFR8.2` だけ）。
  - U3・U4 の正式受入（`verified-with-ci`）の source は `6a90a45b`。その後の main（#66・#67・#68）で同じ候補になるかは確かめていない。
- 基準・timeout を緩めた確認はない。

## Loop-Back Log

### Loop-back 1 — 2026-10-22T01:05:00Z

- **Diagnosis**：U3 の `tests/migration-install/runner-ready.test.ts` と U4 の `tests/migration-command/runner-ready.test.ts` が、Node の patch の版を `26.12.0` に固定している。Node 26.12.1 が出たので、最新の Node を入れる CI（`migration-acceptance.yml`）で U3 の単体試験が失敗し、U4 の completion が止まった。製品のコードの不具合ではなく、Code Generation で書いた試験の前提（版の固定）の誤り。最新の道具を使う決まりとも合わない。
- **Root-cause stage**：code-generation（u3-install、u4-command）。
- **Planned fix**：2つの試験の版の確認を、ほかの runner-ready の試験と同じく major の版（26）と、その試験が名前で確かめる機能（ESM・web stream・文字列と encoding の primitive）の確認に改める。試験の題も「Node 26.12.0」を「Node 26」に直す。製品のコードと基準は変えない。formicarium に PR を作り、merge の後に `migration-acceptance.yml` をもう一度起動して、consumer の試験と completion を確かめる。
- **Estimated impact**：変更は試験の2 file・数行。U3・U4 の Code Generation を開き直すので、それぞれの計画の承認・独立レビュー・checkpoint がもう一度要る。PR 1つと、`migration-acceptance.yml` の1回の実行（今回は約5分）。費用は Actions の時間だけ。危険は小さい（試験の前提を緩めるのではなく、決まりの「最新の Node」に合わせる。major の版の下限は保つ）。

### Loop-back 2 — 2026-10-22T03:59:05Z

- **Diagnosis**：(1) `.github/workflows/showcase.yml`（5か所）と `showcase-site.yml`（12か所）が `node-version: '26.12.0'` と patch の版まで固定している。最新は Node 26.12.1 で、run 39716571748・39716574987 は古い Node で動いた。最新の道具を使う決まりに合わず、その run だけが根拠の12件（U7-NFR4.2・8.2、U8-NFR6.1・6.2・6.4・6.5・2.2・6.6・6.7・7.1・7.2・8.11）が Unverified。ほかの workflow（`ci.yml` など）は `latest`。(2) `aidlc engine sensor-traceability --stage build-and-test` が Fail。U5 の `traceability.json` の `OK` 18行は target が別のリポジトリ（`aletheia-works/vivarium@<sha>:<path>`）と説明の文で、道具が workspace の file として読めない。U7 の `NFR8.1` の1行は path の後に説明の文が続く（`cross-unit-traceability.md`）。
- **Root-cause stage**：code-generation（u7-showcase-guests：`showcase.yml` と traceability、u8-showcase-site：`showcase-site.yml`、u5-fixed-guest-build：traceability）。
- **Planned fix**：(1) 2つの workflow の `node-version` を、ほかの workflow と同じ `latest` にする（基準・試験は変えない）。formicarium に PR を作り、merge の後に人間の承認で `showcase.yml` と `showcase-site.yml` を main で起動し直す。(2) U7 の `NFR8.1` の target を path だけにし、説明は別の場所に移す。U5 は実装が workspace の外にあるので、target の書き方（formicarium の中の対応する file か、状態の付け方）を U5 の計画で示し、人間の承認を受ける。
- **Estimated impact**：workflow の2 file・17行の小さな変更と、記録の修正。PR 1つ、showcase の2つの run（それぞれ約15分、site は再配布する）。費用は Actions の時間だけ。危険は小さい（版の固定を外して最新に合わせるだけで、基準を緩めない）。U5・U7・U8 の Code Generation を開き直すので、それぞれの計画の承認・独立レビュー・checkpoint がもう一度要る。

