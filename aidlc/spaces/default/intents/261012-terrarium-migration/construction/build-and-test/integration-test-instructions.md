# Integration Test Instructions

intent `261012-terrarium-migration`（scope classic、Test Strategy Standard）の Build and Test の結合試験の手順。単体の手順は各 Unit の `code-generation/unit-test-instructions.md` にあり、ここでは Unit をまたぐ境界・独立 install した consumer・ブラウザの受入・既存の回帰をまとめる。品質担当が読取りだけで書いた（command は実行していない）。

## 土台と前提

- **土台**：formicarium の upstream の main の最新（2026-10-22 の時点で `6a90a45b`）。この session の主な作業場所は古い `5735433d` の記録の change なので、試験は main の最新の jj workspace（`.artifacts/ws-biome` を `jj git fetch` のあと `jj new main@upstream` で更新）で行う。結果には実行した commit を書く。
- **道具**：mise の `latest`（2026-10-22 の CI では Node 26.12.1、Bun 1.4.3、Playwright 1.64.1、Biome 2.6.2）。古い版で作った結果は履歴で、今の根拠にしない（project の決まり）。そのため、`.artifacts/build-and-test/logs/` の接頭辞なしの手元 log（`6b5bac1f`・Node 26.12.0）と、`showcase-39605579785/39605579932.log`（Node 26.12.0）は**履歴**として扱う。
- **vivarium**：U5・U6 の試験は `~/Documents/vivarium` の upstream の main の最新（2026-10-22 の時点で `e4ef0dc4`、実行の前に fetch して確かめる）で行う。
- **逐次**：build と試験は main session で1つずつ実行する。重い並行処理をしない。各 command の開始・終了の時刻を記録する（FIX-11）。

## 生成物と aube の扱い（必ず守る）

- `dist/blink/`・`dist/guests/` は作り直さない。新しい workspace には主な作業場所の `dist/` を写す（`cp -R ../../dist ./dist`）。
- **`mise run build-guests` を引数なしで実行しない。** 引数なしは `all` になり aube を作り直す（`mise-tasks/build/guests.sh` の既定）。`dist/guests/aube` があるときは、`build-guests` を一切使わない。probe のソースが変わったときだけ `mise run build-guests probe` を使う。
- 実行の前と後で `shasum -a 256 dist/guests/aube` を記録し、同じであることを確かめる（FIX-10）。

## framework の設定

| 層 | framework | 設定 |
|---|---|---|
| Node の結合（package・migration の consumer） | `node:test`（`--test-concurrency=1`） | `package.json` の `test:integration`・`migration:*:unit`。build 済みの `.build/` と `tests/**/*.js` を使う |
| ブラウザの結合 | Playwright（latest） | 各 `playwright.config.ts` は `workers: 1`・`retries: 0`。実行の flag でも `--workers=1 --retries=0` を付ける |
| showcase | `node:test`（TS の型除去）と Playwright | `showcase/tests/`、`showcase/site/tests/`、`showcase/site/tests/playwright.config.ts` |
| vivarium | `bun test` と Playwright | vivarium の `mise.toml` と各 config |

上限（緩めない）：probe 600秒、aube のブラウザ 840秒、1 worker、retry なし、probe の8項目すべて合格、native の基準出力と完全一致、wasm 1GB、ブラウザ Worker の `delete Atomics.waitAsync`。

## 実行する command（1つずつ）

番号は `/Users/mutoakio/Documents/formicarium/.artifacts/build-and-test/pending-commands.md` の P 番号と同じ。

### A. formicarium（今の main）

1. `mise run lint:all`（P1）：Biome・actionlint・ShellCheck。CI の quality の job は Biome だけを実行するので、actionlint・ShellCheck は手元でしか確かめられない。
2. `mise run showcase-stage`（P2）：showcase の consumer に `@aletheia-works/formicarium` を置く（`npm pack` と展開）。
3. intent の検証コマンド（P3、VC-1。書かれたとおり1行で実行する）：
   ```bash
   mise run typecheck && mise run build && mise run test:light && mise run migration-preflight-unit && mise run migration-preflight-current-unit && mise run migration-guest-build-unit && mise run showcase-unit
   ```
   `migration-guest-build-unit` は `dist/blink/`・`dist/guests/` を前提にする。`showcase-unit` は `showcase/tests/` の14 file（boundary・mode・workflow を含む）を coverage 80% の条件で実行する。
4. `mise run showcase-typecheck`（P4）、`mise run showcase-boundary`（P5）。
5. `mise run showcase-site:unit`（P6）：`showcase/site/tests/unit/*.test.ts` と lcov。取得は fetch を注入した試験で、網の外へは出ない（U8 の uti）。
6. `mise run migration-preflight-browser`（P9）：U1 の36行。`.artifacts/migration-preflight/mirror-assets-attempt-1/aube.tar.gz` など U1 の受入済みの資産が workspace に要る（`ws-biome` には無かった：`u3fix-migration:install-unit.log`）。主な作業場所から読取りで写す。
7. U2 の COI の24組の観測（P10）：`.artifacts/u6-recipe-runtime/s8-observation/` の手順（U2 の uti Step 29、U6 の code-summary Step 3）。具体の command は記録に無く、main session が特定する（未確認）。
8. showcase site の受入（P11）：準備として `cd showcase/site && bun install --frozen-lockfile --ignore-scripts`（network）と、main の CI の showcase.yml の `showcase-candidate` を `showcase/site/.work/` に GET で置く。続けて1ブラウザずつ：
   ```bash
   mise run showcase-site-accept -- --project=chromium
   mise run showcase-site-accept -- --project=firefox
   mise run showcase-site-accept -- --project=webkit
   ```
   U8 の uti は `bunx playwright test …` と書くが、`bunx` は network から取得するかもしれない（推測）。宣言された task（`showcase-site:accept` は repository の Playwright を `--workers=1 --retries=0` で使う）を使う。config の webServer が site の build を含むかは未確認。
9. `mise run showcase-accept-node`（P13、network）：aube・Biome の取得と `--version`。

### B. vivarium（今の main）

10. `mise run ci:fixed-guest-builder`、`mise run fixed-guest-builder:check`（P14）。`tools/fixed-guest-builder/tests/bump.test.ts` が含まれていなければ `bun test tools/fixed-guest-builder/tests/bump.test.ts` も。
11. `mise run ci:docs-unit` と、U6 の uti の `bun test docs/scripts/__tests__/…`・`bun test src/layer1_wasm/biome-migrate-override-bracket-spacing/verdict.test.ts src/layer1_wasm/_shared/_test/formicarium_terminal.test.ts`（P15）。
12. `src/layer1_wasm` で Playwright を1ブラウザずつ（P16）：`bunx playwright test tests/biome-migrate-override-bracket-spacing.spec.ts --project=<chromium|firefox|webkit> --workers=1`。vivarium に宣言された task があればそれを使う。

## CI でしか確かめられないもの（理由）

| 確認 | 理由 | 今回の証拠 |
|---|---|---|
| `tests/migration-{session,install,command}/consumer.test.js` と3ブラウザの consumer | CI の候補・独立 install した consumer・本物のゲストの入力（`FORMICARIUM_CANDIDATE`・`FORMICARIUM_CONSUMER`・`FORMICARIUM_SESSION_GUEST`）が要る。手元に無いと最初の確認で必ず失敗する | `migration-acceptance-39709015067.log`（`6a90a45b`）：U2 55・U3 74・U4 112 pass、ブラウザ 12・45・9 passed |
| B1 の正式な受入（`verified-with-ci`・`b1.formal:true`） | 同じ source の main の CI の run と artifact が要る | U4-NFR8.1b、ci-pipeline の段階が持つ |
| pitchfork の受入（U7 の12行） | pitchfork は CI で build したものだけを受け入れる | U7-NFR2.2b・U7-NFR6.1、ci-pipeline |
| showcase site の build の job（すべての契機） | showcase-site.yml の run | U8-NFR2.3、ci-pipeline |

`migration-acceptance.yml` は `workflow_dispatch` だけで、起動は人間の承認が要る。

## coverage の目標（Standard、classic の80%）

| 対象 | 目標 | 確かめ方 |
|---|---|---|
| 第一者の配布 JS 23件（全 realm の合算） | 行 ≥80%、分母は固定一覧、未収集は0% | completion の coverage report（今回：92.16%、MA:4839） |
| `showcase/scripts/**` | 行 ≥80% | `showcase-unit`（`--test-coverage-lines=80`） |
| `showcase/site` の第一者 `.ts` | 行 ≥80%（node の lcov と Chromium の V8 を合算、`coverage-denominator.json`） | P6 → P11（chromium）→ P12 |
| vivarium の U6 の第一者 TS | 行 ≥80%（`u6-coverage.json`） | repro-regression の PR の CI（ci-pipeline） |

除外（生成 blink・型・ゲスト ELF・試験と開発の script）は理由付きで記録する。閾値を満たすために除外を変えない。

## 試験の data と環境

- 候補：U2〜U4 は `mise run migration-{session,install,command}-stage` で作る。CI では `ci/migration-session/inputs.bundle.json` と `scripts/migration-command/acceptance-inputs.js` が入力を用意する。
- TLS：install・command の completion は一時の CA を使う。手元で行うときは、証明書の一時登録と後始末を**人間がターミナルで**行う（CI の job では job の中で登録し、`always()` で消している：MA の後始末の step）。
- fixture：`fixtures/`・`showcase/fixtures/` は読むだけ。PR で showcase の fixture を変えると site の受入が main の候補と合わなくなる（U9 の code-summary）。
- network：showcase の受入・`showcase-accept-node`・`bun install`・`gh run download` は network を使う。

## 結果の記録

各 command について、commit・道具の版・開始と終了の時刻・pass/fail/skip/todo/cancelled の数・timeout と worker/retry の値を記録する。skip・欠落・retry で通った結果を合格にしない。結果は main session が `test-results.md` と `build-and-test-summary.md` の Target Verification Matrix に反映する。
