# Build and Test Summary

intent `261012-terrarium-migration`（scope classic、Test Strategy Standard）。品質担当が 2026-10-22 に、保存された log・artifact・記録を読んで作り、main session の2回目以降の実行（`test-results.md` の「## Loop-back 1 の後の実行」「### U1 の preflight…」「### 残りの軽い確認…」「### Loop-back 2 の後の実行」）の結果で仕上げた（Step 9 の終わり。`Pending` は残っていない）。品質担当は command を実行していない（例外：読取りだけの `shasum`・`grep`・`ls`・JSON の読取り）。

## 全体の状態

- **build**：今の main（`6a90a45b`）で、手元（Node 26.12.1、Bun 1.4.3）の `mise run lint:all` が exit 0（エラー0、警告48・info 47：`logs/b2/lint:all.log`）。intent の検証コマンド（typecheck・build・test:light・preflight・guest-build・showcase-unit）も exit 0（`logs/b2/VC.log`、03:12:33Z〜03:13:26Z）。CI の quality の job も成功（`ci-39706177745.log` 1728–2188 行）。
- **前回の失敗**：Loop-back 1（Node の patch 版の固定）は #65 で直り、今の main の `migration-acceptance.yml`（run 39709015067）が成功した。Loop-back 2（showcase の2つの workflow の `node-version: '26.12.0'` の固定）は PR #66（merge `f7b70cac`、`node-version: 'latest'`・`check-latest: true`）で直り、push の run 39724950076（Showcase guests）と 39724950133（Showcase site）が、すべての setup-node で Node v26.12.1 で成功した。
- **CI Pipeline の境界の確認の後**：Construction → Operation の確認が FAIL になり、人間の判断で U1・U3・U9 の Code Generation に戻った。U1 は PR #68（merge `e0842371`）で `extractTar` の取消（NFR4.1）と trial の記録（NFR1.2）を直し、36試行をやり直した。U3/U4 は正式な完了確認（`verified-with-ci`・`b1.formal: true`）を作った。U9 は `NFR8.2` を人間が失敗のままと承知して記録した。最新の main `e0842371` で `lint:all` と検証コマンドが exit 0（B3）、main の CI run 39746861827 が success（test-results.md）。
- **判定の数**（170件）：`Met` 147、`Not Met` 6、`Unverified` 10、`N/A` 7、`Pending` 0。
- **結論**：Build and Test は**まだ失敗**（stage file の失敗の条件：`Not Met` 6件と `Unverified` 10件がある）。build と、最新の道具で実行したすべての command は成功した。残る原因は次の3種類。(1) U9 の記録の欠けと、人間が決めた置き換え（5件。U9-NFR8.2 は人間が失敗のままと承知）。(2) U5-NFR8.3（Release に license・notices が無い）。(3) 人間が後で扱うと決めた所見（U5-NFR2.2 の vivarium の Biome、TC-1）と、後の段階へ延期した8件。直し方は「所見」に書いた。

### 前提（必要なもの）

- 今の main の jj workspace（`.artifacts/ws-biome`、`6a90a45b`）、mise の latest（Node 26.12.1）、`dist/blink/`・`dist/guests/`（作り直さない）。
- vivarium の今の main（2回目の実行では `06b96398`：`logs/b2/vivarium/base.txt`）。
- U1 の preflight のブラウザの計測のための証明書の一時登録（人間）：`.artifacts/build-and-test/u1-cert-commands.md`。登録・計測のあと、人間が削除し、件数0を確かめた（test-results.md）。

## 試験の種類（作った手順書）

| 種類 | 手順書 | 主な対象 |
|---|---|---|
| build | `build-instructions.md`（既存） | lint・typecheck・build |
| 単体 | 各 Unit の `unit-test-instructions.md` | U1〜U9 |
| 結合・E2E | `integration-test-instructions.md` | 独立 install の consumer、3ブラウザ、showcase の受入、vivarium の受入、既存の回帰 |
| 性能 | `performance-test-instructions.md` | probe 600秒・aube 840秒、3000ms の中央値、U6・U8 の時間の上限 |
| セキュリティ | `security-test-instructions.md` | 入力の境界・COI/CSP・workflow の権限・秘密・notices |

## Unit ごとの coverage の目標

| Unit | 目標 | 今の状態 |
|---|---|---|
| U1〜U4（第一者の配布 JS 23件、全 realm） | 行 ≥80%、固定分母 | 92.16%（1894/2055、23 file）：`Met`（MA:4839） |
| U5 | builder の package の行 coverage を下げない | 98.49%、188 pass・0 fail（`logs/b2/vivarium/ci:fixed-guest-builder.log`）。ただし lint の Biome が最新ではないので U5-NFR2.2 は `Unverified` |
| U6 | 第一者 TS の行 ≥80%（`u6-coverage.json`） | repro-regression の PR の CI：`N/A`（ci-pipeline） |
| U7 | `showcase/scripts/**` の行 ≥80% | 88.60%（`logs/b2/VC.log` 547 行）：`Met` |
| U8 | `showcase/site` の第一者 `.ts` の行 ≥80%（node の lcov と Chromium の V8 の合算） | 合算 94.51%（5151/5450、Node v26.12.1 の run 39724950133）：`Met`（手元の単体だけの値は 73.78%） |
| U9 | 新しい目標なし。分母（release の固定24件）を変えない | 記録で `Met`（U9-NFR2.2） |

## Target Verification Matrix

略記：
- `CI` = `.artifacts/build-and-test/logs/ci-39706177745.log`（ci.yml、`6a90a45b`、Node 26.12.1、Playwright 1.64.1）。
- `MA` = `.artifacts/build-and-test/logs/migration-acceptance-39709015067.log`（同じ commit、成功）。
- `CMP` = `.artifacts/build-and-test/ci-39709015067/migration-command/completion-5e0a9e37-72ba-4470-8adc-80d8e57b3cd6/`（同じ run の artifact）。
- `B2` = `.artifacts/build-and-test/logs/b2/`（手元、`6a90a45b`、Node 26.12.1）。`VIV` = `B2/vivarium/`（vivarium `06b96398`）。
- `SG` = `.artifacts/build-and-test/logs/showcase-39716571748.log`、`SS` = `.artifacts/build-and-test/logs/showcase-site-39716574987.log`（どちらも `6a90a45b` で成功したが、workflow が `node-version: '26.12.0'` に固定していたので Node v26.12.0 で動いた：SG:163、SS:228。**履歴で、判定の根拠にしない**）。
- `SG2` = `.artifacts/build-and-test/logs/showcase-39724950076.log`（Showcase guests、`f7b70cac`、push）、`SS2` = `.artifacts/build-and-test/logs/showcase-39724950133.log`（Showcase site、同じ commit、push）。どちらも Loop-back 2 の後で、setup-node はすべて Node v26.12.1（SG2:167・474・1705、SS2:232・4206・5223・6090・7742・8466 など）。
- `B3` = `.artifacts/build-and-test/logs/b3/`（手元、最新の main `e0842371`、CI Pipeline の境界の確認の後に U1・U3・U9 を直した後）。
- `FC` = `.artifacts/ws-u3-formal/.artifacts/migration-command/completion-934d4082-3237-4cbb-97ec-a4b918edb0ed/`（U3/U4 の正式な完了確認、source `6a90a45b`）。
- `<rec>` = `aidlc/spaces/default/intents/261012-terrarium-migration/`。数字は log の行。

判定の規則：
- 後の段階が持つ配布・観測の確認は、stage file の Step 9 の4（deployed な環境が要る確認は延期できるが `Unverified` のまま）に従って `Unverified`。CI の義務は Step 1 に従って `N/A`。
- 前回、根拠が SG・SS だけだった12件（U7-NFR4.2・8.2、U8-NFR6.1・6.2・6.4・6.5・2.2・6.6・6.7・7.1・7.2・8.11）と TC-2・TC-3 は、Loop-back 2 の後の SG2・SS2（最新の Node）で判定し直した。
- 後の段階が持つ U8-NFR8.1b・8.10 は、SS2 で deploy と verify-deployment が成功したが、`Unverified`（延期）のままにした。理由：(a) stage file は、deployed な環境が要り後の段階が持つ確認を、延期しても `Unverified` のままとする。(b) 期待値（配布した run の deployed の証拠が全行 passed、`site-identity.json` の一致）を示す中身が log に出ず、deployed の証拠の artifact も読んでいないので、この段階で目標を満たしたと引用できない。(c) release の配布とその後の確認は Deployment Execution の持ち分である。
- 人間が「後で扱う」と決めた所見（test-results.md「### 後で扱う所見」）：U1-NFR1.2・U5-NFR2.2・TC-1。判定はそのままにし、各行に「人間の判断で後で扱う」と書いた。そのうち U1-NFR1.2 は、その後 CI Pipeline の境界の確認を受けて U1 に戻り、PR #68 で直したので `Met` にした。

| Target ID | Source | Expected | Actual | Evidence | Owning Stage | Verdict |
|---|---|---|---|---|---|---|
| FIX-01 | project.md Mandated、team.md、REQ NFR2 | probe の1回 ≤600秒 | Node の probe suite 5643.7ms、ブラウザの probe 全項目 1.3〜1.9秒 | CI:7470、MA:2943・2954・2965 | build-and-test | Met |
| FIX-02 | 同上 | probe の8項目がすべて合格 | tokio-timer・unix-stream-pair・rayon・mutex-condvar・fs-basic・fs-hardlink・fs-symlink・fs-flock が pass、3ブラウザ「probe の全項目が PASS する」 | CI:7460–7467、MA:2925（28 pass・skip 0）、MA:2943・2954・2965 | build-and-test | Met |
| FIX-03 | 同上 | aube のブラウザの1回 ≤840秒 | aube-1645 は 6.4/8.1/7.0秒、各 suite 12 passed（19.2〜25.2秒） | MA:2936・2947・2958、CI:7002・6409・5659 | build-and-test | Met |
| FIX-04 | 同上 | 全 Playwright config が1 worker | 全 config が `workers: 1`（root 15・preflight 18・session 6・install 5・command 5・showcase 7・site 12・vivarium layer1 13 行）。手元の実行も「using 1 worker」（U1 36件、U6、COI） | `.artifacts/ws-biome/` の各 `playwright.config.ts` と `~/Documents/vivarium/src/layer1_wasm/playwright.config.ts`（品質担当の読取り）、B2/u1-preflight-browser-2.log 4、MA:2594・2614・2664 | build-and-test | Met |
| FIX-05 | 同上 | retry なし | formicarium の全 config が `retries: 0`。vivarium の config は `process.env["CI"] ? 1 : 0` だが、U6 の spec が `test.describe.configure({ retries: 0, mode: 'serial' })` で上書きする。実行は `--retries=0` | 同上、`~/Documents/vivarium/src/layer1_wasm/tests/biome-migrate-override-bracket-spacing.spec.ts` 48 行 | build-and-test | Met |
| FIX-06 | 同上 | native の基準出力と完全一致 | Node の aube・pitchfork、3ブラウザの aube が一致。native baseline は2回の実行で一致 | CI:7424・7449・4083・4098、MA:2936・2947・2958 | build-and-test | Met |
| FIX-07 | 同上 | wasm の上限 1GB | 「ビルド物は blink.lock のコミットから、JIT なしで作られている」（`-sMAXIMUM_MEMORY=1GB` を assert）が pass | CI:7433、MA の regression（2925 の suite） | build-and-test | Met |
| FIX-08 | project.md、team.md、U2/uti R-01 | bundle の Worker で `Atomics.waitAsync === undefined`、子 Worker の URL が既定と同じ | 3ブラウザで `mainBundleWaitAsync:"undefined"`・`childBundleWaitAsyncAtCoreImport:"undefined"`・`childURLsEqualDefault:true` | MA:2597・2602・2607 | build-and-test | Met |
| FIX-09 | org.md classic、team.md、REQ NFR2 | 23 JS の全 realm の行 ≥80% | 92.16%（1894/2055）、threshold 80、passed true | MA:4839 | build-and-test | Met |
| COV-DENOM | team.md、U2〜U4 NFR2.2 | 分母は固定の全 file、bundle は理由付きで除く | digests 23件、exclusions 4種に理由、「bundle is distributed and packed, but excluded from the coverage denominator」 | MA:4839、MA:2850 | build-and-test | Met |
| FIX-10 | project.md Forbidden | 変わっていない aube を作り直さない | 実行の前（B2/p0.txt、03:12:24Z）と、全実行の後（品質担当の `shasum -a 256`、03:52:05Z）で同じ `c7d7d13692d0…cd99e`。大きさ 36948544、mtime Oct 21 21:32 のまま | B2/p0.txt、`.artifacts/ws-biome/dist/guests/aube` | build-and-test | Met |
| FIX-11 | project.md Mandated | build・test は1つずつ、性能計測は負荷なし | 手元の command の時間帯は重ならない（VC 03:12:33Z〜03:13:26Z、U1 の2回目 03:46:02Z〜03:47:27Z など）。CI の run は remote。U1 の計測時の負荷の値は記録が無い（U1-NFR1.2 で扱う） | test-results.md の各節の時刻 | build-and-test | Met |
| VC-1 | STATE Construction Verification Command | 検証コマンドが exit 0 | 最新の main `e0842371`（#66・#67・#68 を含む）で exit 0。bun 71・tooling 38・node 118（skip 2 は既存）・release 124・preflight 58（U1 の取消の試験を足した）・preflight-current 21・guest-build 12・showcase 100 pass（行 88.60%）。前回の `6a90a45b` でも exit 0 | B3/VC.log 10・16・145・282・350・381・403・515・548 行、B2/VC.log | build-and-test | Met |
| INC-NFR1 | REQ NFR1 | 非DL5工程の中央値 ≤3000ms（U1・U3、3ブラウザ×2ツール） | U1：6組の trial1–5 の中央値 602.5〜1896.1ms（最大の組は aube/firefox）。U3：1091.9〜2587.3ms。trial0・最大・fetch は別に記録 | `.artifacts/ws-biome/.artifacts/migration-preflight/mirror-browser-20261022/trials/`（36 file、品質担当の集計）、`CMP/measurement/measurement-report.json` | build-and-test | Met |
| INC-NFR2 | REQ NFR2 | skip・欠落を成功にしない | 全 command の summary が fail 0。既存の skip 2 は pattern で区別（B2/VC.log 148）。vivarium の tarball なしの1 skip は「This is not a pass.」と出し、tarball を渡した再実行で 209 pass・0 skip。失敗した command（showcase-stage・showcase-accept-node・U1 の1回目）は成功として数えていない | B2/VC.log 148、VIV/ci:docs-unit-tarball.log、test-results.md | build-and-test | Met |
| TC-1 | 各 Ux/plan Testing Contract | 部品ごとに5〜8件以上 | log は file・部品ごとの件数を出さない（bun は suite の合計だけ、node の spec は試験名だけ）。参考に source の `test(`／`it(` を file ごとに数えると、多くは5件以上だが5件未満の file もある（例：preflight `completion.test.ts` 3、install `hash-regression.test.ts` 4、runner-ready 3〜4）。file は部品と一対一でないので判定できない。**人間の判断で後で扱う所見**（test-results.md「### 後で扱う所見」） | 品質担当の source の読取り（`.artifacts/ws-biome/tests/`・`showcase/tests`・vivarium の tests） | build-and-test | Unverified |
| TC-2 | 同上 | 単体と主な境界の結合 | U1〜U6 は最新の道具で実行。U7・U8 のブラウザの結合も Loop-back 2 の後に Node v26.12.1 で成功（U7 9 passed、U8 16 passed×3ブラウザ） | 下の U7・U8 の行、SG2:3602、SS2:5837・7487・8212 | build-and-test | Met |
| TC-3 | 同上 | 要件の E2E・性能・安全の試験 | U1・U3・U6 の性能と、U8 の性能・E2E（受入）・安全の試験が最新の道具で成功 | 下の U8-NFR6.x・NFR7.x の行 | build-and-test | Met |
| TC-4 | 同上 scope_floor | 既存の試験が green | test:light・preflight・guest-build・showcase・site の単体・vivarium の builder/docs/U6 の単体と Playwright がすべて fail 0 | B2/VC.log、B2/showcase-site:unit.log 188–193、VIV/*.log | build-and-test | Met |
| TC-5 | 同上 plan_profile | 最初の試験の前に runner が動く | package・U3・U4・showcase の runner-ready が pass（「runs on the Node version showcase/package.json requires, as ESM with type stripping」） | CI:1921 の command、MA、B2/VC.log の showcase の節 | build-and-test | Met |
| CI-1 | org.md、team.md、Testing Contract | 選んだ試験を merge の前に CI で実行 | CI Pipeline での判定：Met（足りなかった3つの単体を PR #67 で `ci-required` に入れ、PR の CI run 39734731092 で 57・21・12 件 pass。U2〜U4 の consumer は merge の後の手動の受入） | CI Pipeline, later in this plan, sets up CI to run these tests before merge。`construction/ci-pipeline/quality-gates.md` 43 行 | ci-pipeline | N/A |
| U1-NFR1.1 | U1/nreq NFR1.1 | 36行が一意、各組の trial1–5 で extract+digest+validate+register+run の中央値 ≤3000ms、trial0・最大・fetch は別、失敗を除外しない | U1 の修正（PR #68）の後の36試行：36 file（2ツール×3ブラウザ×trial0–5 が各1件）、全 exitCode 0。trial1–5 の5工程の中央値は aube chromium 460.7・firefox 515.3・webkit 489.0、biome chromium 586.5・firefox 674.1・webkit 457.3ms、5工程の最大 871.1ms。trial0・最大・fetch は別に記録。修正の前の36試行（`mirror-browser-20261022`、中央値 ≤1896.1ms）も基準の内 | `.artifacts/ws-biome/.artifacts/migration-preflight/mirror-browser-20261022b/trials/`（品質担当の集計）、`.artifacts/build-and-test/logs/u1lb/preflight-browser.log` 4・43（1 worker、36 passed） | build-and-test | Met |
| U1-NFR1.2 | 同 NFR1.2 | 1 worker、重い並行負荷なし。browser・Node・OS・CPU・ツールの版、sourceCommit、負荷、cache の条件を記録 | U1 の修正（PR #68）の後の36試行の `environment` に、`os`（`Darwin 27.0.0 arm64`）・`cpu`（`Apple M1 x8`）・`loadBefore`・`loadAfter`（load average）・`testSourceCommit`（`e915bf48…`、試験を実行した change）と、Node v26.12.1・Playwright・browser の版・cache の条件がある。1 worker。資産の固定値の `sourceCommit` は別に残る。前回の `Not Met`（OS・CPU・負荷が無い）はこれで解消した | `.artifacts/ws-biome/.artifacts/migration-preflight/mirror-browser-20261022b/trials/` の `environment`（品質担当の読取り）、`<rec>construction/u1-migration-preflight/code-generation/code-summary.md` の「Step 31〜34」 | build-and-test | Met |
| U1-NFR3.1 | 同 NFR3.1 | archive・ELF の拒否、検証した copy だけ実行 | preflight 57 pass。「unselected absolute, traversal, duplicate, link escape, loop and parent aliases reject」「digest, source metadata, mandatory inputs, build key and ELF bounds reject」「ELF dynamic/bounds faults … never create an accepted artifact」 | B2/VC.log 349 | build-and-test | Met |
| U1-NFR3.2 | 同 NFR3.2 | SHA256・identity の検証、未知の field は許す | 「canonical metadata preserves unknown fields and rejects invalid JSON identities」「fixed commit, immutable image, inventory binding, source pins and compile recipe are mandatory」 | B2/VC.log 349 | build-and-test | Met |
| U1-NFR4.1 | 同 NFR4.1 | 時間とサイズの上限、境界は許し +1 は拒否 | 「all size boundaries are inclusive, plus one is rejected…」「stream byte bound is inclusive, plus one rejected and C11 cannot be increased」。PR #68 で足した取消の試験「a tar scan stops at its next entry boundary once the signal is cancelled」も最新の main で pass（58 pass） | B3/VC.log 298・350、B2/VC.log 349 | build-and-test | Met |
| U1-NFR4.2 | 同 NFR4.2 | HTTPS・redirect 5 hop・retry なし | 「every redirect hop is inspected: five accepted, sixth rejected, loops refused」「HTTP failures, redirect and opaque responses, body/network errors do not retry」「credentials, non-HTTPS URLs … reject」 | B2/VC.log 349 | build-and-test | Met |
| U1-NFR5.1 | 同 NFR5.1 | baseline の再利用（compileSkipped）・単一 writer | 「first fixture build is atomically accepted; same-key second call skips compilation and checks version」「same key has one writer…」「baseline identity, key, digest, reuse and CI URL are mandatory」。completion は U1 の CI の証拠 `u1-real-browser-ci-attempt-2` を読んだ | B2/VC.log 349、`CMP/local-provisional-report.json`（preflightEvidence） | build-and-test | Met |
| U1-NFR6.1 | 同 NFR6.1 | 3ブラウザで COI/SAB・same-origin Worker・CSP、実機 Safari は区別 | 全 trial が `isolated: "true"`、origin `https://localhost:4182`、3ブラウザで guest の実行が exitCode 0。実機 Safari は未検証として区別 | trials の `environment`、B2/u1-preflight-browser-2.log | build-and-test | Met |
| U1-NFR7.1 | 同 NFR7.1 | 時刻 offset・期間の検証、unknown を0にしない | 「schema, timestamp, environment and source identity reject malformed values」「negative, nonfinite, missing and summed overflow timings reject」「missing acquisition timing and nonmonotonic clock fail instead of becoming zero」 | B2/VC.log 349 | build-and-test | Met |
| U1-NFR8.1 | 同 NFR8.1 | 対応付け・秘密を出さない・最小権限 | preflight-current 21 pass（「current identity rejects altered source inventory…」）。試行の workflow は `permissions: contents: read` | B2/VC.log 380、`.artifacts/ws-biome/integration/vivarium/preflight/baseline-workflow.yml` 11–12 行 | build-and-test | Met |
| U2-NFR3.1 | U2/nreq NFR3.1 | 私有 copy で ELF・SHA256・identity を検証 | U2 の単体 55 pass。「ELF architecture, dynamic interpreter, table overflow and load memory overflow reject」「full ELF and metadata digests reject tamper and unknown fields affect identity」 | MA:2379 | build-and-test | Met |
| U2-NFR3.2 | 同 NFR3.2 | 非公開 brand、偽造を拒否、入力の後の変更が効かない | 「forged and another module instance handles carry no authority」「installed private handle runs fixed official aube after original input mutation」 | MA:2379 | build-and-test | Met |
| U2-NFR3.3 | 同 NFR3.3 | fixture の path・link・hardlink の検証 | 「relative, NUL, root escape, duplicate normalized and non-directory root reject」「safe sibling link accepts while root escape … loops reject」「hardlinks preserve inode identity but differ in mode or content reject」 | MA:2379 | build-and-test | Met |
| U2-NFR3.4 | 同 NFR3.4 | ELF・fixture・entry・path・metadata の上限と +1 | 「entry and UTF8 path exact boundaries accept and plus one rejects」「expanded file byte exact boundary…」「metadata exact byte limit…」「ELF exact byte limit accepts and plus one refuses before digest」 | MA:2379 | build-and-test | Met |
| U2-NFR3.5 | 同 NFR3.5 | metadata の schema、未知 field も hash、孤立 surrogate・重複を拒否 | 「canonical keys sort recursively and reject unsafe numbers, cycles and lone surrogate」「metadata required identities, schema, key and duplicate dependency reject」 | MA:2379 | build-and-test | Met |
| U2-NFR4.1 | 同 NFR4.1 | 単一予約・queue なし、reset/dispose の epoch | 「install reservation blocks direct run, FS, register and other acquire without a queue」「old release and commit cannot touch a newer reservation」 | MA:2379 | build-and-test | Met |
| U2-NFR4.2 | 同 NFR4.2 | 失敗時に原子的に保持、ABORTED・DISPOSED・UNSUPPORTED_ENV | 原子性・ABORTED・DISPOSED は U2 の単体で pass。UNSUPPORTED_ENV の試験（`tests/package/browser-api.spec.ts`「isolation deficiency is UNSUPPORTED_ENV and guest never starts」）を含む coverage-package が Node 26.12.1・`--workers=1 --retries=0` で exitCode 0 | MA:2379、`CMP/local-provisional-report.json` の commands[16]（label coverage-package） | build-and-test | Met |
| U2-NFR6.1 | 同 NFR6.1 | Node と3ブラウザで正・拒否の試験 | ブラウザの consumer 12 passed（1 worker） | MA:2594–2612 | build-and-test | Met |
| U2-WB | U2/uti Step 27、U2/plan | bundle に静的 import・`import.meta` 無し、同じ bytes、既定の Worker、`options.assets` 優先 | 結合 183 pass。「built Worker bundle has no static import, re-export or import.meta」「two Bun builds of the same modules give the built bundle bytes」「browser createSession starts the bundle Worker by default」「options.assets Worker URL is used as given…」 | MA:2875 | build-and-test | Met |
| U2-COI24 | U2/uti Step 29 | 3ブラウザ×en・ja×初回・再訪問で COI・SAB、2端末の ready | 今の main で作り直した pack（`32964d0c…`、CI の候補と同じ）で12の訪問すべて pageCOI・pageSAB true、24端末が ready、各ブラウザ 2 passed | `B2/coi/coi-{chromium,firefox,webkit}.log`（U6S8SUM の行） | build-and-test | Met |
| U2-NFR8.1 | 同 NFR8.1 | exports/types/consumer を同じ source/pack に対応付け | 「fresh installed U2 pack exposes C03 while internal C02 imports are forbidden」 | MA:2379 | build-and-test | Met |
| U2-NFR8.2 | 同 NFR8.2 | 秘密を出さない、notices を pack に保持 | 「license/notices/types/readme are nonempty and guests stay external」、workflow は secret を使わない | MA:2875、MA:2585 の suite | build-and-test | Met |
| U3-NFR1.1 | U3/nreq NFR1.1 | 正式 install の36試行で中央値 ≤3000ms、初回・最大・fetch を別に記録 | `passed: true`、36試行、6組の中央値 1091.9〜2587.3ms（最大は biome/firefox の 2614.3ms）、firstMs・maxMs・fetch を別に記録 | `CMP/measurement/measurement-report.json` | build-and-test | Met |
| U3-NFR3.1 | 同 NFR3.1 | catalog の deep copy と検証 | U3 の単体 74 pass。「catalog deep snapshot retains unknown identity fields and exact defaults」 | MA:2463 | build-and-test | Met |
| U3-NFR3.2 | 同 NFR3.2 | サイズ・entry・path の上限、escape・bomb の拒否 | 「metadata counts toward 4096 entry bound…」「name and numeric byte boundaries include maxima but reject overflow」「every link rejects missing target, root escape…」 | MA:2463 | build-and-test | Met |
| U3-NFR3.3 | 同 NFR3.3 | download と ELF の digest を照合、brand 付き copy だけ登録 | 「download SHA mismatch rejects before any archive inspection」「installer uses public-shape result and commits owned bytes…」 | MA:2463 | build-and-test | Met |
| U3-NFR4.1 | 同 NFR4.1 | 120000ms・180000ms、TIMEOUT、5 hop、retry なし | 「Node follows five inspected HTTPS redirects…」「fetch deadline uses monotonic >= cutoff…」「network, HTTP and interrupted body failures are ASSET_LOAD without fallback」 | MA:2463 | build-and-test | Met |
| U3-NFR4.2 | 同 NFR4.2 | 取消で cleanup を待ち、旧 epoch が新操作を変えない | 「caller abort during body cancels stream…」「real Session reset/dispose classify owner reason and await cancelled fetch cleanup」 | MA:2463 | build-and-test | Met |
| U3-NFR6.1 | 同 NFR6.1 | Node と3ブラウザで同じ install、UNSUPPORTED_ENV、相対 URL は INVALID_INPUT | ブラウザ 45 passed、「URL rejects origin-less relative…」、UNSUPPORTED_ENV の試験を含む coverage-package が exitCode 0 | MA:2614–2662、MA:2463、`CMP/local-provisional-report.json` commands[16] | build-and-test | Met |
| U3-NFR7.1 | 同 NFR7.1 | Progress の順序、unknown と0の区別、callback 例外 | 「progress keeps operation identity, increasing sequence…」「unknown total and known zero remain distinct…」 | MA:2463 | build-and-test | Met |
| U3-NFR8.1 | 同 NFR8.1 | 操作の対応付け、actual-site の検査 | `localPassed: true`、candidate・sourceCommit `6a90a45b…`・sourceIdentity・actualSite・distributionInventory 23件を同じ report に記録。「a changed archive or reference is refused, and U3 inspector is the default final gate」。正式な完了確認でも `acceptancePassed: true`（下の U4-NFR8.1b の行） | `CMP/local-provisional-report.json`、MA:2585 の suite、`FC/completion-report.json` | build-and-test | Met |
| U3-NFR8.2 | 同 NFR8.2 | 新費用・認証・外部 write なし、秘密を出さない、notices 保持 | job の権限 `Actions: read`・`Contents: read`・`Metadata: read`、「license/notices…」 | MA:23–26、MA:2875 | build-and-test | Met |
| U4-NFR3.1 | U4/nreq NFR3.1 | 65536 bytes まで受理、65537 と不正文字を拒否 | U4 の単体 112 pass。「InputGuard refuses 65537 bytes…」「InputGuard refuses LF, CR and NUL…」 | MA:2585 | build-and-test | Met |
| U4-NFR3.2 | 同 NFR3.2 | path は guest path、host に触れない | 「relative paths resolve against the current cwd…」「"..", empty and root-removing relative paths are INVALID_INPUT…」 | MA:2585 | build-and-test | Met |
| U4-NFR3.3 | 同 NFR3.3 | 呼出しごとに新しい bytes | 「cat bytes are a fresh copy per call…」 | MA:2585 | build-and-test | Met |
| U4-NFR4.1 | 同 NFR4.1 | 事前 abort は予約なし、builtin は中断しない | 「ABORTED wins over DISPOSED and BUSY, and a preabort takes no reservation」 | MA:2585 | build-and-test | Met |
| U4-NFR4.2 | 同 NFR4.2 | timeoutMs を渡さず既定 600000ms | 「onOutput receives the guest chunks and no timeoutMs is passed (600000 ms default)」 | MA:2543 | build-and-test | Met |
| U4-NFR5.1 | 同 NFR5.1 | 予約1回、BUSY、失敗で状態不変 | 「two command sessions on one Session share its single reservation (BUSY)」 | MA:2585 | build-and-test | Met |
| U4-NFR6.1 | 同 NFR6.1 | 独立 tarball の Node と3ブラウザ、browser の版を記録 | ブラウザ 9 passed、chromium 156.0.8078.4・firefox 157.0・webkit 27.2 | MA:2664–2685 | build-and-test | Met |
| U4-NFR7.1 | 同 NFR7.1 | 非ASCII・NBSP・空引数を保持、ls は UTF-16 順 | 「Tokenizer preserves non-ASCII, NBSP and full-width space…」「ListingFormatter sorts … by UTF-16 code units」 | MA:2585 | build-and-test | Met |
| U4-NFR7.2 | 同 NFR7.2 | 予約名は guest から呼べない | 「reserved names stay builtins even when a guest with that name is registered」 | MA:2585 | build-and-test | Met |
| U4-NFR8.1a | 同 NFR8.1、U4/uti | B1 の必須集合を事前確認、`local-provisional`・`b1.formal=false` | `status: local-provisional`、`localPassed: true`、`b1.formal: false`、`b1-acceptance.json` の31 checks すべて passed、blocker は「new U4 signed CI not independently verified」だけ | `CMP/local-provisional-report.json`、`CMP/b1-acceptance.json` | build-and-test | Met |
| U4-NFR8.1b | 同 NFR8.1、U4/plan Step 17–27 | 今の source で `verified-with-ci`・`b1.formal:true` | 新しい根拠：正式な完了確認（U3 の Step 28）が `status: verified-with-ci`・`acceptancePassed: true`・`b1.formal: true`・blockers 0、22 command すべて exitCode 0（Node 26.12.1）、`b1-acceptance.json` 31 checks すべて passed、measurement 36試行 passed、coverage 92.16%。CI の観測（`observed-ci-summary.json`）は run 39709015067 の `conclusion: success`・`commitVerified: true`。source は `6a90a45b`（sourceFiles 357件、sourceIdentity `af5a4b26…`）。**今の source かどうか**：その後の main には #66・#67・#68 がある。品質担当が sourceFiles の357件の SHA256 を `.artifacts/ws-biome` の今の file と比べ、すべて一致した。ただし ws-biome がどの revision にあるかは jj を使えないので確かめていない（U3 の Step 27 で一時に `6a90a45b` にした記録がある）ので、`e0842371` で同じという点は未確認。CI Pipeline での判定は Not Met（正式受入の前の記録による） | CI Pipeline, later in this plan, sets up CI to run these tests before merge。`FC/completion-report.json`・`FC/b1-acceptance.json`・`.artifacts/ws-u3-formal/.artifacts/migration-command/ci-39709015067/observed-ci-summary.json`、`construction/ci-pipeline/quality-gates.md` 44 行 | ci-pipeline | N/A |
| U4-NFR8.2 | 同 NFR8.2 | workflow_dispatch だけ、read 権限、secret なし、`always()`、actionlint | 「the workflow is manual only … read-only and secret-free」「trust removal and both 7-day artifacts run always…」、`mise run lint:all`（actionlint・ShellCheck を含む）が exit 0 | MA:2585、B2/lint:all.log | build-and-test | Met |
| U5-NFR2.2 | U5/nreq NFR2.2 | builder の lint・型・試験、skip・欠落なし、coverage を下げない | 型・試験は 188 pass・0 fail・98.49%。lint の `bunx --bun biome` は vivarium の lockfile の Biome 2.5.15（`docs:check` が「CLI version 2.5.15」と表示）で、最新の 2.6.2（CI:1339 の後の「installed @biomejs/biome@2.6.2」）ではない。**人間の判断で後で扱う所見**（vivarium の Biome の更新の PR） | VIV/ci:fixed-guest-builder.log、VIV/fixed-guest-builder:check.log、VIV/docs:check.log | build-and-test | Unverified |
| U5-NFR3.1 | 同 NFR3.1 | allowlist・40桁の commit を必須 | builder の全試験（prepare・declaration を含む19 file）188 pass・0 fail | VIV/ci:fixed-guest-builder.log（「188 pass」「0 fail」） | build-and-test | Met |
| U5-NFR3.2 | 同 NFR3.2 | commit が宣言した repository の ref から辿れる | 同上（source.ts を含む） | 同上 | build-and-test | Met |
| U5-NFR3.3 | 同 NFR3.3 | build-info・catalog の検証と上限 | guest-build 12 pass（「a build-info with a repeated key or above 1 MiB is refused」「a catalog that does not match the files is refused」）と builder の試験 | B2/VC.log 402、VIV/ci:fixed-guest-builder.log | build-and-test | Met |
| U5-NFR3.4 | 同 NFR3.4 | sourcePatches の記録、patch の変更で別 key | builder の試験 pass（key.ts 96.97%、source.ts 98.15%） | VIV/ci:fixed-guest-builder.log | build-and-test | Met |
| U5-NFR3.5 | 同 NFR3.5 | bump は branch を直接解決して記録 | builder の試験 pass（bump.ts 100%） | 同上 | build-and-test | Met |
| U5-D7-AUTO | U5/ndes D7 | bump の PR は必須の check が通ったら自動 merge | CI Pipeline での判定：Unverified（仕組み `gh pr merge --auto --squash` はあるが、#556 の後の実際の bump の PR が無い） | CI Pipeline, later in this plan, sets up CI to run these tests before merge。`construction/ci-pipeline/quality-gates.md` 45 行 | ci-pipeline | N/A |
| U5-NFR4.1 | 同 NFR4.1 | 4時間の期限、取消で process group と staging を片付ける | builder の試験 pass（deadline.ts・process.ts） | 同上 | build-and-test | Met |
| U5-NFR4.2 | 同 NFR4.2 | 取得の上限、上限値で受理・+1 で打切り | builder の試験 pass（monitor.ts・http.ts） | 同上 | build-and-test | Met |
| U5-NFR5.1 | 同 NFR5.1 | 同じ key の直列化、draft → 照合 → publish | builder の試験 pass（busy.ts 100%、release.ts） | 同上 | build-and-test | Met |
| U5-NFR5.2 | 同 NFR5.2 | 同じ key の2回目は compile を省き同 digest | builder の試験 pass（reuse.ts）、guest-build「reuse needs a compiling first run and a non-compiling second run with the same digests」 | 同上、B2/VC.log 402 | build-and-test | Met |
| U5-NFR5.3 | 同 NFR5.3 | key ごとの Release に一組、上書きしない | `guest-biome-086287f8…`・`guest-biome-dabb518b…` の2件が、それぞれ `biome`・`build-info.json`・`catalog.json` の一組だけ。buildKey は recipe の `accepted` と一致 | VIV/releases.txt | build-and-test | Met |
| U5-NFR5.4 | 同 NFR5.4 | mbx の有無で同じ digest、cache は main だけ | builder の試験 pass（build.ts・pipeline.ts） | VIV/ci:fixed-guest-builder.log | build-and-test | Met |
| U5-NFR8.1 | 同 NFR8.1 | build の job は `contents: read` だけ、Release の書込みは承認付きの別 job、actionlint・ShellCheck | workflows の試験 pass。actionlint 1.7.12（ShellCheck 0.11.0 付き）で全 workflow exit 0。ShellCheck で24 file exit 0（宣言された task は macOS の bash 3.2 で動かないので、同じ file の集合に直接実行） | VIV/ci:fixed-guest-builder.log、VIV/actionlint-all.log、VIV/shellcheck.log・shellcheck-files.txt | build-and-test | Met |
| U5-NFR8.2 | 同 NFR8.2 | build-info に source URL・commit・target・rustc・sourcePatches・入力、baseline と fix の `--version` 成功と再利用、builder を二重に残さない | 今の2つの Release（`guest-biome-086287f8…`・`guest-biome-dabb518b…`）の `build-info.json` に `source`（repository・commit）・`target`（x86_64-unknown-linux-musl）・`rustc`（1.98.1）・`sourcePatches`（空）・`dependencies`（cargo-lock・make の commit と digest）・`reference.builder`（image の digest・command・environment）がある。SHA256 は recipe の `accepted` の `buildInfoSha256`（`80f07338…`・`00bb12d6…`）と一致。2つの `builderHash` は同じ（`510a57ee…`）。U1 の baseline（2405c762）と fix（f79f85d5）の `--version` の成功と再利用は保存済みの再利用の証拠（exitCode 0）。vivarium の builder は `tools/fixed-guest-builder` だけ | `.artifacts/build-and-test/u5-release-metadata/*/build-info.json`（人間の承認で取得、2026-10-22）、`.artifacts/migration-guest-build/*-reuse-evidence.json`、`vivarium/releases.txt` | build-and-test | Met |
| U5-NFR8.3 | 同 NFR8.3 | 秘密を出さない、notices 保持 | 秘密：今の2つの Release の `build-info.json`・`catalog.json`（4 file）に token・secret・password・authorization・bearer・`ghp_` などの pattern の一致なし。builder の source と保存済みの証拠も一致なし。license・notices：Release の asset は `biome`・`build-info.json`・`catalog.json` の3つだけで、license・notices の file は無い。`catalog.json` の entry にも license・notices の欄は無く、`tools/fixed-guest-builder/src/*.ts` に license・notice を扱う code は無い（`rg -i`）。notices の保持を示す証拠が無く、Release の中身と食い違う | `.artifacts/build-and-test/u5-release-metadata/`（人間の承認で取得、2026-10-22）、`rg` の結果 | build-and-test | Not Met |
| U6-NFR6.1 | U6/nreq perf NFR6.1 | 3ブラウザ×en・ja の各件 ≤180秒、retry 0 | 各ブラウザで en・ja が pass、最長 10.6秒（firefox en）、1 worker | VIV/u6-pw-{chromium,firefox,webkit}.log | build-and-test | Met |
| U6-NFR6.2 | 同 NFR6.2 | 取得は120秒で TIMEOUT、bytes と時間を記録 | `verdict.test.ts`・`formicarium_terminal.test.ts` 31 pass、Playwright pass | VIV/u6-layer1-unit.log、VIV/u6-pw-*.log | build-and-test | Met |
| U6-NFR6.3 | 同 NFR6.3 | 1 page で2組、wasm 1GB、baseline → fix | 「en/ja: both terminals start isolated, verify and run the recorded commands」が3ブラウザで pass | VIV/u6-pw-*.log | build-and-test | Met |
| U6-NFR6.4 | 同 NFR6.4 | site 全体が Pages の上限以下 | 延期（deploy の記録と公式情報） | Deployment Pipeline | deployment-pipeline | Unverified |
| U6-NFR6.5 | 同 NFR6.5 | 今の `accepted` の ELF ≤128MiB | 2件の ELF が 112,564,936 bytes と 112,500,608 bytes（≤134,217,728）、buildKey は `accepted` と一致 | VIV/releases.txt | build-and-test | Met |
| U6-NFR2.2 | U6/nreq sec NFR2.2 | 第一者 TS の行 ≥80% | CI Pipeline での判定：Met（vivarium の `regression (chromium)`、run 39730248956 で 83.51%） | CI Pipeline, later in this plan, sets up CI to run these tests before merge。`construction/ci-pipeline/quality-gates.md` 46 行 | ci-pipeline | N/A |
| U6-NFR3.1 | 同 NFR3.1 | guests[] の検証 | `ci:docs-unit` 208 pass・0 fail（recipesIndex.test を含む） | VIV/ci:docs-unit.log 120–125 | build-and-test | Met |
| U6-NFR3.2 | 同 NFR3.2 | tarball と各 file の SHA256、entry の拒否 | 同上（stageFormicariumAssets.test） | 同上 | build-and-test | Met |
| U6-NFR3.3 | 同 NFR3.3 | ブラウザで取り直して照合してから登録 | 「en: a changed ELF is not run and the page says why」が3ブラウザで pass | VIV/u6-pw-*.log | build-and-test | Met |
| U6-NFR3.4 | 同 NFR3.4 | pin が無い間は pending、ローカル tarball も照合 | `FORMICARIUM_LOCAL_TARBALL=<今の main の pack 32964d0c…>` で 209 pass・0 skip・0 fail | VIV/ci:docs-unit-tarball.log | build-and-test | Met |
| U6-NFR3.5 | 同 NFR3.5 | coi-serviceworker v0.1.7 の SHA256 固定 | `ci:docs-unit` pass（coiServiceWorkerPin.test） | VIV/ci:docs-unit.log | build-and-test | Met |
| U6-NFR3.6 | 同 NFR3.6 | pin の PR で npm の provenance を確かめる | `npm audit signatures` で provenance と attestation を確認（検証済みの記録） | `<rec>construction/u6-recipe-runtime/code-generation/code-summary.md` 564–576 行 | build-and-test | Met |
| U6-NFR4.1 | 同 NFR4.1 | 取得の120秒と上限 | `ci:docs-unit` pass（stageFormicariumAssets.test） | VIV/ci:docs-unit.log | build-and-test | Met |
| U6-NFR4.2 | 同 NFR4.2 | 要素が外れたら取消・dispose | formicarium_terminal.test pass | VIV/u6-layer1-unit.log | build-and-test | Met |
| U6-NFR6.7 | 同 NFR6.7 | 3ブラウザ×en・ja で同じ結果、COI・waitAsync 削除 | en・ja が3ブラウザで pass、COI の観測で browser の版・OS を記録。実機 Safari は未検証 | VIV/u6-pw-*.log、B2/coi/*.log | build-and-test | Met |
| U6-NFR6.8 | 同 NFR6.8 | coi-serviceworker の page から Worker が分離の下で起動（候補2、`coepCredentialless` false） | candidate 2・`cred: false(forced)` で pageCOI・pageSAB true、子 Worker も分離 | B2/coi/coi-*.log（U6S8SUM） | build-and-test | Met |
| U6-NFR7.1 | 同 NFR7.1 | 出力の buffer の境界 | formicarium_terminal.test pass | VIV/u6-layer1-unit.log | build-and-test | Met |
| U6-NFR7.2 | 同 NFR7.2 | 状態の文字表示、keyboard だけ | 同上 | 同上 | build-and-test | Met |
| U6-NFR7.3 | 同 NFR7.3 | unknown と0の区別、時刻 offset | 同上 | 同上 | build-and-test | Met |
| U6-NFR8.1 | 同 NFR8.1 | C10 の証拠に pin・pack・accepted・digest、全行 passed | SHA256 `235cd94c…be21` が最新の記録と一致、19行すべて passed | `.artifacts/u6-recipe-runtime/evidence-c10/acceptance-evidence.json`、U6 の code-summary 1030 行 | build-and-test | Met |
| U6-NFR8.2 | 同 NFR8.2 | 削除・dispatch・pin・merge は個別の承認後に人が行う | 承認の後に実行した記録 | U6 の code-summary 714・783・961 行 | build-and-test | Met |
| U6-NFR8.3 | 同 NFR8.3 | site に LICENSE・notices・MIT・Biome の license | `ci:docs-unit` pass（stageFormicariumAssets.test の check-site） | VIV/ci:docs-unit.log | build-and-test | Met |
| U6-NFR8.4 | 同 NFR8.4 | AssetStager は token を使わない、workflow の契機と権限、actionlint | `ci:docs-unit` pass（workflows.test など）、actionlint で全 workflow exit 0 | VIV/ci:docs-unit-tarball.log、VIV/actionlint-all.log | build-and-test | Met |
| U6-NFR8.5 | 同 NFR8.5 | revert で前の site に戻せる | 延期 | Deployment Pipeline の切戻しの手順 | deployment-pipeline | Unverified |
| U6-W5 | U6/uti Step 18a | 公開 site で24組の W5 | 延期（公開 site・network） | Deployment Execution | deployment-execution | Unverified |
| U7-COV | U7/uti Coverage Target | `showcase/scripts/**` の行 ≥80% | 88.60% | B2/VC.log 547 | build-and-test | Met |
| U7-NFR2.2a | U7/nreq NFR2.2 | 12行の1行でも欠ければ候補を作らない | 「every tool x environment row must exist once and pass」「a missing acceptance row or a pack of another mode creates no candidate」 | B2/VC.log 514 の suite | build-and-test | Met |
| U7-NFR2.2b | 同 NFR2.2、U7/ndes §8 | 実際の12行がすべて合格 | CI Pipeline での判定：Met（run 39724950076、Node v26.12.1：Node の受入3行とブラウザの受入9行） | CI Pipeline, later in this plan, sets up CI to run these tests before merge。`construction/ci-pipeline/quality-gates.md` 47 行、SG2:2328–2330・3592–3602 | ci-pipeline | N/A |
| U7-NFR3.1 | 同 NFR3.1 | 設定 data の検証 | 「a missing required field or an unknown field is refused」「a duplicate tool is refused」「a repository outside the main allow list is refused」 | B2/VC.log 514 の suite | build-and-test | Met |
| U7-NFR3.2 | 同 NFR3.2 | latest release を1回だけ解決して固定 | 「resolves every tool once, peels annotated tags and writes resolutions once」「a prerelease or draft latest release is refused」 | 同上 | build-and-test | Met |
| U7-NFR3.3 | 同 NFR3.3 | 公式資産の SHA256・サイズ、出所の記録 | 「an official tar.gz asset yields the configured entry and C03 metadata」「a checksum mismatch and a dynamic ELF are refused」 | 同上 | build-and-test | Met |
| U7-NFR3.4 | 同 NFR3.4 | source build は公式資産の無いツールだけ、commit が tag から辿れる | 「the acquire job … never builds a release-asset tool」「a commit the tag no longer names … is refused」 | 同上 | build-and-test | Met |
| U7-NFR3.5 | 同 NFR3.5 | C11 の上限、+1 拒否、catalog の受理 | 「expanded size, entry count and path bytes accept the limit and refuse +1」「the generated catalog … is accepted by createInstaller」「the 4 MiB catalog limit…」 | 同上 | build-and-test | Met |
| U7-NFR3.6 | 同 NFR3.6 | 公開 export だけ import | 「the current tree has no boundary violation」、`boundary: no violation` | B2/VC.log 514 の suite、B2/showcase-boundary.log | build-and-test | Met |
| U7-NFR4.1 | 同 NFR4.1 | 取得120秒、process group の終了、job の timeout | 「the deadline covers the whole request…」「a deadline ends the whole process group and staging is removed afterwards」「job timeouts follow the infrastructure design」 | B2/VC.log 514 の suite | build-and-test | Met |
| U7-NFR4.2 | 同 NFR4.2 | 受入の log に取得と `--version` までの時間・環境・版 | Node v26.12.1 の run で、各ツール×環境の install と `--version` の時間を ms で記録（例：aube/node install 1117 ms・`--version` 406 ms、biome/firefox 2067 ms・670 ms）。手元は前の工程の出力が無く実行できない（macOS） | SG2:167（node v26.12.1）・2328–2330・3592–3600、B2/showcase-accept-node.log | build-and-test | Met |
| U7-NFR5.1 | 同 NFR5.1 | candidateId の正規化 digest、途中終了で候補を残さない | 「the same inputs give the same candidateId; run records do not change it」「changing one identity input changes the candidateId」 | B2/VC.log 514 の suite | build-and-test | Met |
| U7-NFR5.2 | 同 NFR5.2 | 候補は Actions artifact、U8 は再解決しない | 「PR runs cancel older revisions only; the candidate is uploaded once at the end」、site 側「the newest qualifying run supplies the candidate」 | B2/VC.log 514 の suite、B2/showcase-site:unit.log | build-and-test | Met |
| U7-NFR5.3 | 同 NFR5.3 | `formicariumPackSha256` が B1 と一致 | 「distribute refuses a pack or C06 evidence that does not match」「distribute accepts the B1 pack…」 | B2/VC.log 514 の suite | build-and-test | Met |
| U7-NFR6.1 | 同 NFR6.1 | 4環境で3ツールの `--version` | CI Pipeline での判定：Met（同じ run で4環境×3ツールの `--version` が passed） | CI Pipeline, later in this plan, sets up CI to run these tests before merge。`construction/ci-pipeline/quality-gates.md` 48 行 | ci-pipeline | N/A |
| U7-NFR8.1 | 同 NFR8.1 | job の権限、`persist-credentials: false`、SHA 参照 | 「permissions are read-only; only acquire, catalog and candidate read actions」「actions are pinned by commit SHA…」「every checkout keeps credentials out of the workspace」、actionlint を含む lint:all が exit 0 | B2/VC.log 514 の suite、B2/lint:all.log | build-and-test | Met |
| U7-NFR8.2 | 同 NFR8.2 | token・response を出さない、notices を候補に含める | token の部分は手元で pass（「the build environment is an allow list that refuses tokens」「compile runs the builder without a token…」）。notices：候補の作業領域に `showcase/.work/licenses/` が入り（SG2 の resolve の job）、その候補から作った site の build で「THIRD_PARTY_NOTICES holds formicarium, the guests and every site package」が pass し、guest の notices が無いと build が失敗する規則（「missing formicarium or guest notices fail the build」）の下で build・deploy が成功した。候補の artifact の中身は直接は読んでいない（間接の根拠） | B2/VC.log 514 の suite、SG2:265、SS2:4508、B2/showcase-site:unit.log 116 | build-and-test | Met |
| U8-NFR6.1 | U8/nreq perf NFR6.1 | 各件 ≤180秒、準備 ≤120秒、retry 0、1 worker、16件、job 60分 | Node v26.12.1 で「Site acceptance (16 tests, 1 worker, no retry, 180 s each)」が chromium 16 passed（6.1m）・firefox 16 passed（2.8m）・webkit 16 passed（3.2m） | SS2:8212・5837・7487（accept の各 job の setup-node は v26.12.1：SS2:7742・5223・6090） | build-and-test | Met |
| U8-NFR6.2 | 同 NFR6.2 | 取得の 120秒・180秒、bytes と時間を記録 | 120秒は単体で pass（「a response slower than the 120 s deadline fails as deadline」）。受入は16件×3ブラウザが pass し、evidence の job が受入の log から証拠を組み立てた。bytes と時間の値そのものは受入の artifact にあり、log には出ない | B2/showcase-site:unit.log 53、SS2:5837・7487・8212、SS2 の evidence の job | build-and-test | Met |
| U8-NFR6.3 | 同 NFR6.3 | 1 page に1端末、wasm 1GB、buffer の境界 | 「1048575 and 1048576 bytes are kept; 1048577 drops the first line only」「9999 and 10000 lines are kept; 10001 drops exactly one line」「a cut inside an escape sequence moves past its end」 | B2/showcase-site:unit.log 4–7 | build-and-test | Met |
| U8-NFR6.4 | 同 NFR6.4 | site 全体 <1073741824 bytes、guest は1か所 | Node v26.12.1 の build の job で、check-site（1GB 未満を検査する）を含む「Assemble, check and inventory the site」が成功し、Pages の artifact では各 guest が `guests/<tool>/<version>/` の1か所だけ。大きさの値そのものは log に出ない | SS2:4206（node v26.12.1）・4430・4699–4855、B2/showcase-site:unit.log 37 | build-and-test | Met |
| U8-NFR6.4b | 同 NFR6.4 | Pages の1 file の上限と転送量 | 延期 | Deployment Pipeline | deployment-pipeline | Unverified |
| U8-NFR6.5 | 同 NFR6.5 | 文書の page は guest 等を取らない | build の試験が pass（「documentation pages and /tools/ load no terminal module and no service worker」）。受入の件 (5) を含む16件が Node v26.12.1 で3ブラウザとも pass | B2/showcase-site:unit.log 130、SS2:5837・7487・8212 | build-and-test | Met |
| U8-NFR2.1 | U8/nreq sec NFR2.1 | site の import 規則と境界の拒否 | 「site: .astro frontmatter and <script> imports are checked…」「site: build output, Astro types, node_modules and the staged pack are not scanned」、`boundary: no violation` | B2/VC.log 514 の suite、B2/showcase-boundary.log | build-and-test | Met |
| U8-NFR2.2 | 同 NFR2.2 | `showcase/site` の第一者 `.ts` の行 ≥80%（合算） | 「showcase site coverage: 94.51% (5151/5450 lines, threshold 80%」（node の lcov と Chromium の V8 を固定分母で合算、coverage の job は Node v26.12.1） | SS2:8579・8466 | build-and-test | Met |
| U8-NFR2.3 | 同 NFR2.3 | build の job がすべての契機で検査 | CI Pipeline での判定：Met（`build` の job は PR と push の両方で動き、push の run 39724950133 で success） | CI Pipeline, later in this plan, sets up CI to run these tests before merge。`construction/ci-pipeline/quality-gates.md` 49 行 | ci-pipeline | N/A |
| U8-NFR3.1 | 同 NFR3.1 | catalog と index の SHA256、path 規則 | 「loadCatalog checks the embedded SHA256…」「fixture index: 4096 entries and 4096-byte paths pass, one more fails」 | B2/showcase-site:unit.log 28・102 | build-and-test | Met |
| U8-NFR4.1 | 同 NFR4.1 | 120秒、上限を stream で止める、retry なし、pagehide で取消 | 「returns the body and sends no credentials, no redirect and no retry」「the streamed total is bounded…」「pagehide cancellation aborts the request…」 | B2/showcase-site:unit.log 50–54 | build-and-test | Met |
| U8-NFR5.1 | 同 NFR5.1 | U7 の受入済み候補だけ、7項目の照合 | (1)〜(7) の試験が pass | B2/showcase-site:unit.log 169–176 | build-and-test | Met |
| U8-NFR5.2 | 同 NFR5.2 | deploy は直列、古い run を拒否、API の失敗は deploy しない | 「a newer deployed run refuses this deployment」「an API failure fails closed」 | B2/showcase-site:unit.log 38–42 | build-and-test | Met |
| U8-NFR5.3 | 同 NFR5.3 | 失敗・verify の run は deploy しない | 「deploy needs every earlier gate…」「a distribute run whose candidate did not succeed never deploys」 | B2/showcase-site:unit.log 181–182 | build-and-test | Met |
| U8-NFR6.6 | 同 NFR6.6 | coi-serviceworker の固定、COEP、24組の分離 | coi の bytes の検査が pass（単体 36 行）。分離の受入を含む16件が Node v26.12.1 で3ブラウザとも pass | B2/showcase-site:unit.log 36、SS2:5837・7487・8212 | build-and-test | Met |
| U8-NFR6.7 | 同 NFR6.7 | CSP 指令、受入で違反0件 | 指令の試験が pass（単体 82–86 行）。CSP 違反を失敗にする受入の16件が3ブラウザとも pass | B2/showcase-site:unit.log 82–86、SS2:5837・7487・8212 | build-and-test | Met |
| U8-NFR7.1 | 同 NFR7.1 | 出力は文字、OSC 8 を開かない | output.test が pass（117–122 行）。敵対的な出力の harness を含む受入が3ブラウザとも pass | B2/showcase-site:unit.log 117–122、SS2:5837・7487・8212 | build-and-test | Met |
| U8-NFR7.2 | 同 NFR7.2 | keyboard だけ、65536 bytes、390px | keys・status が pass（93–99 行）。390px の確認を含む受入が3ブラウザとも pass | B2/showcase-site:unit.log 93–99、SS2:5837・7487・8212 | build-and-test | Met |
| U8-NFR7.3 | 同 NFR7.3 | unknown と0の区別、時刻 offset | 「install progress tells an unknown total from a zero total」「every state has an English and a Japanese sentence」 | B2/showcase-site:unit.log 149–150 | build-and-test | Met |
| U8-NFR7.4 | 同 NFR7.4 | fixture の mode 正規化と特殊 file の拒否 | 「modes are normalised…」「an empty directory fails the build」「a symbolic link fails the build」「a special file (FIFO) fails the build」 | B2/showcase-site:unit.log 11–14 | build-and-test | Met |
| U8-NFR8.1 | 同 NFR8.1 | 2段の証拠、欠落・重複・failed で失敗 | 「evidence: missing, duplicate, failed and unverified rows are refused」「the deployed evidence adds the deploy logs and deployedIdentity」 | B2/showcase-site:unit.log 44–49・107–109 | build-and-test | Met |
| U8-NFR8.1b | 同 NFR8.1 | 今の source を配布した run の証拠が全行 passed | 延期。新しい根拠：SS2（`f7b70cac`、Node v26.12.1）は evidence・deploy・verify-deployment まで成功した。ただし `showcase-site-evidence-39724950133-deployed` の中身（全行 passed）は読んでおらず、release の配布は Deployment Execution の持ち分なので、stage file の規則どおり延期のまま | SS2 の evidence・deploy の job（Deployment Execution が持つ） | deployment-execution | Unverified |
| U8-NFR8.2 | 同 NFR8.2 | artifact の保持7日、job summary の項目 | 「timeouts, pinned actions, credentials and artifacts follow the infrastructure design」「job results are read from needs and failed jobs are named」 | B2/showcase-site:unit.log 154・186 | build-and-test | Met |
| U8-NFR8.3 | 同 NFR8.3 | notices に license 本文 | 「a package without a license file fails the build」「THIRD_PARTY_NOTICES holds formicarium, the guests and every site package」 | B2/showcase-site:unit.log 110–116 | build-and-test | Met |
| U8-NFR8.4 | 同 NFR8.4 | pages・id-token の write は deploy の job だけ、distribute は push と dispatch だけ | 「pages write, id-token write and deploy-pages exist only in the deploy job」「distribute is accepted only from main U8 started by push or workflow_dispatch」 | B2/showcase-site:unit.log 183、B2/VC.log 514 の suite | build-and-test | Met |
| U8-NFR8.5 | 同 NFR8.5 | 切戻しの手順 | 延期 | Deployment Pipeline | deployment-pipeline | Unverified |
| U8-NFR8.6 | 同 NFR8.6 | token を出さない、URL の query を落とす | 「URLs in logs and summaries lose their query and fragment」 | B2/showcase-site:unit.log 157 | build-and-test | Met |
| U8-NFR8.7 | 同 NFR8.7 | guides の API が pack に実在、npm の integrity | 「npm instructions appear only when npm has this pack with the same integrity」「the embedding example type-checks against the staged pack types」 | B2/showcase-site:unit.log 73–76 | build-and-test | Met |
| U8-NFR8.8 | 同 NFR8.8 | `site-identity.json` の項目、inventory の一致 | 「the identity file holds run number, source commit and candidate only」「a recorded inventory is read back and compared with the final bytes」 | B2/showcase-site:unit.log 87–91 | build-and-test | Met |
| U8-NFR8.9 | 同 NFR8.9 | 失敗の通知と summary、月1回の確認 | 延期（Actions の通知） | Observability Setup | observability-setup | Unverified |
| U8-NFR8.10 | 同 NFR8.10 | deploy の後に `site-identity.json` の一致を確かめる | 延期。新しい根拠：SS2 の verify-deployment の step「The deployed site-identity.json names this run (30 s, at most 10 min)」（`post-deploy-check.ts`）が成功した。ただし step は一致の内容を log に出さず、release の配布後の確認は Deployment Execution の持ち分なので、延期のまま | SS2:9501–9507（Deployment Execution が持つ） | deployment-execution | Unverified |
| U8-NFR8.11 | 同 NFR8.11 | `bun.lock` を commit、`--frozen-lockfile --ignore-scripts` | Node v26.12.1 の build の job で `bun install --frozen-lockfile --ignore-scripts` が成功し、続く build が完了 | SS2:4206・4304–4305・4366 | build-and-test | Met |
| U9-NFR1.1 | U9/nreq NFR1.1 | 一覧の各行に記録の path と測定の日付 | U9 の記録は2つの dir の code-summary を指すだけで、測定の日付が無い | `<rec>construction/u9-retirement-acceptance/code-generation/code-summary.md` 30 行 | build-and-test | Not Met |
| U9-NFR2.2 | 同 NFR2.2 | 消した試験と対象の code の対応表、分母の変更に承認 | 対応表あり、分母は変えていない（S-A=A） | U9 の code-summary 52・67–77 行 | build-and-test | Met |
| U9-NFR2.3 | 同 NFR2.3 | 変わった pack の file の一覧、comment・文書だけ、`b1-pack.json` 不変 | 31件中3件だけ変わり、動作の変更なし | U9 の code-summary 110–114 行 | build-and-test | Met |
| U9-NFR2.4 | 同 NFR2.4 | 名前の一覧が変更の前にあり、変更後に両 repository の CI が成功 | 一覧あり、両方の CI が成功 | U9 の step2-classification.md 39 行、`.artifacts/u9-retirement/step3-notes.md` 122–124 行、U9 の code-summary 120・125 行 | build-and-test | Met |
| U9-NFR8.1 | 同 NFR8.1 | U6 と U8 の証拠の SHA256・全行 passed | U6 は U6-NFR8.1 のとおり。U8 の `evidence.json` の SHA256 `11e9192b…efba3` が記録と一致、27 checks すべて passed（sourceCommit `c8497135`、削除の前の条件として記録された証拠） | `.artifacts/build-and-test/u8-39509852083/`、test-results.md の「重い確認」の表 | build-and-test | Met |
| U9-NFR8.2 | 同 NFR8.2 | repository・fork が無い、npm 404、JSR の meta が404 か版0件、Pages 404 | repository・fork 2つは無い、Pages 404、npm は2回目で 404。JSR の meta は 200 で3つの版が残る（人間の判断で archive）。**人間が失敗のままと承知して記録した**（U9 の `traceability.json` の `NFR8.2` は `Deferred` のまま） | B2/p17.txt 3・5・7・13・15 行、test-results.md の U9 の行、`<rec>construction/u9-retirement-acceptance/code-generation/code-summary.md` の「Step 11」 | build-and-test | Not Met |
| U9-NFR8.3 | 同 NFR8.3 | 依頼の有無・日時・返答と人間の判断、手順書に deprecate の command が無い | JSR の運営への依頼は人間の判断で送っていない、手順書に deprecate の command は無い | U9 の code-summary 138–139・152 行、`deletion-runbook.md` 24・32 行 | build-and-test | Met |
| U9-NFR8.4 | 同 NFR8.4 | 手順書と記録に token の値が無い | token の pattern の一致なし | 品質担当の `grep`（`deletion-runbook.md`・U9 の code-summary、一致0件） | build-and-test | Met |
| U9-NFR8.5 | 同 NFR8.5 | 履歴を書き換えない、`infra/github` に ruleset の変更なし | #58 は通常の commit。`infra/github` の差分は README と main.tf の各1〜2行で、main session の読取りでは説明の文だけ | B2/p18-p21.txt 17–21 行、test-results.md の remote・infra の行 | build-and-test | Met |
| U9-NFR8.6 | 同 NFR8.6 | 残してよい path の外で一致0件 | 今の main で `aidlc/` の外に34 file（32 file は人間が後の作業に回し、2 file は CI の制約で残した） | B2/p19-files.txt | build-and-test | Not Met |
| U9-NFR8.7 | 同 NFR8.7 | organization の ruleset と他の `infra/` に参照なし | formicarium の `infra/` は一致なし。vivarium は、test-results.md が実体の rg で一致なしと書くが、B2/p18-p21.txt にはやり直しの出力が無い（shim の error の節のまま）。品質担当が `grep -rIil terrarium ~/Documents/vivarium/infra` で一致なし（rc=1）を確かめた（checkout の revision は jj を使えないので未確認）。ruleset は人間が画面で確認 | B2/p18-p21.txt 7–8 行、品質担当の `grep`、U9 の code-summary 29 行 | build-and-test | Met |
| U9-NFR8.8 | 同 NFR8.8 | 各段の日時と結果が順に並ぶ | 記録には確認の時刻だけで、実行の時刻が無い。段 (1) の日時が表に無い。実際の順は (4) が (2)(3) より先 | U9 の code-summary 136–150 行 | build-and-test | Not Met |
| U9-NFR8.9 | 同 NFR8.9 | 手順書に、元に戻せない・PR は revert・第三者の複製は消えない | 3点とも書いてある | `deletion-runbook.md` 5–7 行 | build-and-test | Met |
| U9-NFR8.10 | 同 NFR8.10 | download・JSR の版・dependents の値、取得の日時と URL | npm の値と日時・JSR の版はある。取得元の URL が無く、dependents は「読めなかった（未検証）」 | U9 の code-summary 25–28 行、step2-classification 16 行 | build-and-test | Not Met |
| U9-NFR8.11 | 同 NFR8.11 | fork と手元の clone が無い、jj の remote に terrarium が無い | fork 2つは無い、`~/Documents/terrarium` は無い（品質担当の `ls`）、両 repository の remote は origin・upstream だけ | B2/p17.txt 5・7 行、B2/p18-p21.txt 1–6 行 | build-and-test | Met |

### 数の確認

| Verdict | 件数 | 行 |
|---|---|---|
| Met | 147 | — |
| Not Met | 6 | U5-NFR8.3（Release に license・notices が無い）、U9-NFR1.1、U9-NFR8.2（人間が失敗のままと承知）、U9-NFR8.6、U9-NFR8.8、U9-NFR8.10 |
| Unverified | 10 | 人間の判断で後で扱う：TC-1、U5-NFR2.2。後の段階へ延期（8）：U6-NFR6.4・8.5・W5、U8-NFR6.4b・8.1b・8.5・8.9・8.10 |
| N/A | 7 | CI-1、U4-NFR8.1b、U5-D7-AUTO、U6-NFR2.2、U7-NFR2.2b、U7-NFR6.1、U8-NFR2.3 |
| Pending | 0 | — |
| 合計 | 170 | |

## 準備の評価

| 観点 | 判定 | 理由 |
|---|---|---|
| build-ready | はい | 今の main・最新の Node で lint:all（actionlint・ShellCheck を含む）・typecheck・build が exit 0（B2） |
| test-ready | はい | 最新の道具（Node v26.12.1）ですべての試験が成功した。U1 の修正の後の36試行、U3/U4 の正式な完了確認、U7・U8 のブラウザの受入（SG2・SS2）、U8 の合算 coverage 94.51%、最新の main `e0842371` の検証コマンド（B3）を含む |
| deployment-ready | いいえ | `Not Met` 6件（U5 1・U9 5）と `Unverified` 10件（人間の判断で後で扱う 2件、延期 8件）。stage file の失敗の条件に当たる。cross-unit traceability も Fail のまま（未対応は U9 の `NFR8.2` だけ。所見 3） |

## 所見

1. **workflow の Node の版の固定（Loop-back 2 で解決）**：`.github/workflows/showcase.yml`（5か所）と `showcase-site.yml`（12か所）が `node-version: '26.12.0'` と固定していた。そのため run 39716571748・39716574987 は Node v26.12.0 で動き（SG:163、SS:228）、履歴として扱った。PR #66（merge `f7b70cac`）で `node-version: 'latest'`・`check-latest: true` に直し、push の run 39724950076・39724950133 がすべての setup-node で Node v26.12.1 で成功した。固定だけが理由で `Unverified` だった12件と TC-2・TC-3 は、その run で `Met` になった。
2. **vivarium の Biome が最新でない（人間の判断で後で扱う所見。vivarium の Biome の更新の PR）**：`tools/fixed-guest-builder/package.json`・`docs/package.json` は `^2.5.15` で、lockfile が 2.5.15 に解決する（`docs:check` の「CLI version 2.5.15」）。最新は 2.6.2。U5-NFR2.2 の lint は古い版の結果になる。`docs/biome.json` の schema 2.5.12 と CLI の不一致も info として出ている。
3. **cross-unit traceability の Fail（承認の場で示す）**：**最新**（`.artifacts/build-and-test/sensor-traceability-6.txt`）：`"pass": false`、未対応は `NFR8` だけで、原因は U9 の `NFR8.2`（`Deferred`、人間が失敗のままと承知）。U1 の `GAP`（`NFR3.2`・`NFR4.1`）は U1 の Step 33 で、U3 の `GAP` 7行は U3 の Step 29（正式な完了確認）で `OK` になり、未対応に出なくなった。以下はその前の経過：Loop-back 2 で、U5 の行（人間の決定 A：実装は vivarium にあるので `N/A`）と U7 の `NFR8.1` の target を直した。3回目の実行（`.artifacts/build-and-test/sensor-traceability-3.txt`）では読めない target は0件だが、`"pass": false`、未対応は `NFR1`・`NFR2`・`NFR3`・`NFR4`・`NFR8` のまま。原因は、各 Unit が Code Generation で意図して付けた状態である。U1 の `GAP`（`NFR3.2`・`NFR4.1`）、U3 の `GAP`（`FR1`・`FR6`・`BR3.10`・`NFR1.1`・`NFR2.1`・`NFR2.2`・`NFR8.1`。正式受入が `local-provisional` のままの行）、U9 の `Deferred`（`NFR8.2`）。最初の記録はこの `not_built` を見落としていた（`cross-unit-traceability.md` の「訂正と再実行」）。Target Verification Matrix では U3 の性能（U3-NFR1.1）などの手元の目標は `Met` だが、追跡表の `GAP` は U3 の正式受入（CI の B1、ci-pipeline）が残ることを表す。直すか受け入れるかは人間の判断が要る。
4. **U9 の `Not Met` 5件**：記録の欠け（U9-NFR1.1・8.8・8.10）と、人間が決めた置き換え（JSR は削除できず archive：U9-NFR8.2、34 file を後の作業 D7 へ：U9-NFR8.6）。後の2件は人間の判断で受け入れるか、目標を変えずに失敗として残すかを決める必要がある。npm の値と dependents は package を消したので取り直せない。
5. **vivarium の `ci:docs-unit` の1 skip**：tarball を渡した再実行で 209 pass・0 skip になり、解消した（VIV/ci:docs-unit-tarball.log）。
6. **U9 の vivarium の `infra/` の検索の記録**：test-results.md は実体の rg でやり直したと書くが、B2/p18-p21.txt は更新されておらず（shim の error の節のまま）、log の根拠が無い。品質担当の読取りの `grep` で一致なしを確かめた。log の file に実際の出力を残すことを勧める。
7. **U1 の計測の環境の記録（解決）**：PR #68 で trial の記録に `os`・`cpu`・`loadBefore`・`loadAfter`・`testSourceCommit` を足し、36試行をやり直した（中央値 457.3〜674.1ms）。U1-NFR1.2 は `Met`。以下は前の記録：U1-NFR1.2 は OS・CPU・負荷と、試験の source の sourceCommit の記録を求めるが、trial の `environment` に OS・CPU・負荷の欄が無く、`sourceCommit` は mirror を作った `7c7ceaf4` である。計測の値（中央値 ≤1896.1ms）は U1-NFR1.1 を満たす。直す候補：`tests/migration-preflight/consumer.spec.ts` の trial の記録に OS・CPU・host の負荷と実行した source の commit を足し、36試行をやり直す（試験 1 file の数行、計測 約1.5分、証明書の一時登録がもう一度要る）。
8. **U5 の今の Release の metadata**：人間の承認（2026-10-22）で `guest-biome-086287f8…`・`guest-biome-dabb518b…` の `build-info.json`・`catalog.json` だけを取得した（`.artifacts/build-and-test/u5-release-metadata/`、4 file、2〜4 KB）。U5-NFR8.2 は Met（必要な欄があり、SHA256 は recipe の accepted と一致）。U5-NFR8.3 は、秘密の pattern は無いが、Release に license・notices の file が無く、builder にも扱う code が無いので Not Met。
9. **TC-1（人間の判断で後で扱う所見）**：log は部品ごとの件数を出さない。source の file ごとの数では5件未満の file がある（`completion.test.ts` 3 など）が、file は部品と一対一でない。部品の一覧（logical-components・plan）と試験の対応表を作って数えるのが直し方（読取りだけ）。
10. **mise の shim**：B2/p18-p21.txt の最初の vivarium の検索が mise の shim を通った（project の Forbidden）。結果は使っていない。
11. **`mise run showcase-stage` の exit 1**：`SHOWCASE_SOURCE_COMMIT` か `GITHUB_SHA` が要る、手元の環境の不足（製品の不具合ではない）。showcase-unit は VC-1 の中で pass したので、判定には影響しない。
12. **延期した8件の扱い**：dispatch の最初の指示は後の段階の行を `N/A` としていたが、stage file は `N/A` を CI の義務にだけ認め、延期は `Unverified` のまま成功に数えないと定める。この表は stage file に従った。U8-NFR8.1b・8.10 については、SS2 で `f7b70cac` を Pages に配布し、verify-deployment も成功した。それでも、deployed の証拠の中身を読んでおらず、release の配布は Deployment Execution の持ち分なので、延期のままにした（判定の規則の節）。
13. **残る失敗のまとめ（U1・U3・U9 を直した後）**：`Not Met` 6件（U5-NFR8.3 は Release に license・notices が無い。U9 の5件は記録の欠けと、人間が決めた置き換えで、U9-NFR8.2 は人間が失敗のままと承知）。U1-NFR1.2 は PR #68 で解消した。残りは`Unverified` 10件（後で扱う TC-1・U5-NFR2.2、延期 8件）、cross-unit traceability の Fail。どれも Code Generation の不具合の修正（loop-back）では直らない、人間の判断か後の段階の作業である。U5-NFR8.3 の license・notices は、vivarium の builder と Release の作り方の変更（U5 の範囲）で直る。

## 既知の制約

1. CI の artifact（run 39709015067）は 2026-10-29 ごろに期限が切れる。必要な file は `.artifacts/build-and-test/ci-39709015067/` に取ってある。
2. 品質担当が読んだ source の一部（`tests/node/build.test.ts:57` など）は主な作業場所（`5735433d`）のもの。判定は今の main の試験名と結果で行った。
3. 実機の Safari は未検証（各 NFR6 の行の注記、U3 の measurement の `realSafari: 未検証`、U6 の証拠の `unverified`）。独立した目標の行は無い。
4. `tests/terrarium/current-candidate.test.js`（U1 の uti の新しい土台の手順3）は U9 の #58 で消えたので実行しない。
5. U1 の計測の入力（mirror の資産）は、`.artifacts/ws-biome/.artifacts/migration-preflight/mirror-assets-node26-20261017b/` に写し、manifest の path だけを直した（資産の中身と固定値は不変：test-results.md）。
6. vivarium の checkout の revision は、品質担当が jj を使えないので、読取りの `grep` の時点のものを確かめていない（実行の記録では `06b96398`）。
7. formicarium の判定の土台は2つある。手元と migration の受入は `6a90a45b`、showcase の2つの run は `f7b70cac`（PR #66 の merge。test-results.md の記録では PR は1 commit・2 file の workflow の変更だけ。`6a90a45b` との間に他の commit が無いかは、品質担当は jj を使えないので確かめていない）。
8. SS2 の deploy で、`https://aletheia-works.github.io/formicarium/` は `f7b70cac` の site に置き換わった（push の自動の run）。
9. U3/U4 の正式な完了確認（FC）の source は `6a90a45b`。最新の main `e0842371` との間の #66・#67・#68 が配布の候補の sourceFiles（357件）を変えないことは、品質担当の SHA256 の照合（`.artifacts/ws-biome` の今の file と357件すべて一致）でしか確かめておらず、ws-biome の revision は未確認。#68 は `scripts/migration-preflight/` と試験だけという見込みも推測。
10. U1 の修正の後の36試行の `testSourceCommit` は `e915bf48…`（PR #68 の merge の前の change）。merge の後の `e0842371` で同じ内容かは、品質担当は jj を使えないので確かめていない（B3 の検証コマンドは `e0842371` で exit 0）。
11. U4-NFR8.1b などの CI の義務の行は、`aidlc-state.md` で `ci-pipeline` がまだ `[ ]` なので、stage file の Step 1 どおり `N/A` のままにし、CI Pipeline での判定（`quality-gates.md`）を書き添えた。U4-NFR8.1b の CI Pipeline での判定（Not Met）は正式な完了確認より前のもので、CI Pipeline で見直す必要がある。
