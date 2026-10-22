# U8 showcase-site の単体試験の手順

## Framework

- formicarium の repository（`~/Documents/formicarium`、bookmark `u8-showcase-site`）で実行する。toolchain は formicarium の `mise.toml`（node は latest）。宣言された task は `mise run` で実行し、mise の shim や `mise exec` は使わない。直接の実行は mise の実体の path（`~/.local/share/mise/installs/<tool>/latest/bin`）を使う。
- 単体：node:test（U7 の showcase と同じ `node --test`、型の除去で TS を直接実行、`--test-concurrency=1`）。
- ブラウザ：Playwright（latest。`showcase/site/tests/playwright.config.ts`、retries 0、workers 1、1件 180秒、準備完了まで 120秒）。
- 依存：`showcase/site/bun.lock` と `bun install --frozen-lockfile --ignore-scripts`（`showcase/site` で）。
- build・test は main session で1つずつ実行する。重い並行処理をしない。

## Unit-scoped commands

すべて formicarium の repository の root で実行する。Step 2 で動くことを確かめる。

Data model（Step 4）：

```bash
node --test --test-concurrency=1 showcase/site/tests/unit/model.test.ts
```

Repository / data access（Step 6）：

```bash
node --test --test-concurrency=1 showcase/site/tests/unit/fetch-limited.test.ts showcase/site/tests/unit/catalog.test.ts showcase/site/tests/unit/fixture-index.test.ts showcase/site/tests/unit/formicarium-loader.test.ts showcase/site/tests/unit/fetch-verify-candidate.test.ts showcase/site/tests/unit/stage-formicarium.test.ts
```

Business logic（Step 8・Step 11）：

```bash
node --test --test-concurrency=1 showcase/site/tests/unit/verify-candidate.test.ts showcase/site/tests/unit/build-fixture-index.test.ts showcase/site/tests/unit/inventory.test.ts showcase/site/tests/unit/notices.test.ts showcase/site/tests/unit/inject-csp.test.ts showcase/site/tests/unit/check-site.test.ts
```

```bash
node --test --test-concurrency=1 showcase/site/tests/unit/evidence.test.ts showcase/site/tests/unit/deploy-guard.test.ts showcase/site/tests/unit/post-deploy-check.test.ts showcase/site/tests/unit/summary.test.ts showcase/site/tests/unit/buffer.test.ts showcase/site/tests/unit/keys.test.ts showcase/site/tests/unit/output.test.ts showcase/site/tests/unit/status.test.ts
```

API / endpoint（Step 13）：

```bash
node --test --test-concurrency=1 showcase/site/tests/unit/routes.test.ts showcase/site/tests/unit/i18n.test.ts showcase/site/tests/unit/cards.test.ts showcase/site/tests/unit/guides.test.ts
```

Frontend behavior（Step 15。単体と、1ブラウザずつの受入）：

```bash
node --test --test-concurrency=1 showcase/site/tests/unit/terminal-host.test.ts
```

```bash
bunx playwright test --config showcase/site/tests/playwright.config.ts --project=chromium --workers=1
```

```bash
bunx playwright test --config showcase/site/tests/playwright.config.ts --project=firefox --workers=1
```

```bash
bunx playwright test --config showcase/site/tests/playwright.config.ts --project=webkit --workers=1
```

境界の検査（Step 17。U7 の file への変更）：

```bash
node --test --test-concurrency=1 showcase/tests/boundary.test.ts
```

build と workflow（Step 19・Step 20）：

```bash
node --test --test-concurrency=1 showcase/site/tests/unit/build-site.test.ts showcase/site/tests/unit/workflow.test.ts
```

配布の契機の変更（Step 24。summary・workflow と、U7 の file の mode）：

```bash
node --test --test-concurrency=1 showcase/site/tests/unit/summary.test.ts showcase/site/tests/unit/workflow.test.ts
```

```bash
node --test --test-concurrency=1 showcase/tests/mode.test.ts
```

coverage（Step 16。node の lcov と、Chromium の受入で集めた V8 を合わせる）：

```bash
node --test --test-concurrency=1 --experimental-test-coverage --test-reporter=lcov --test-reporter-destination=showcase/site/.work/coverage/lcov.info showcase/site/tests/unit/*.test.ts
```

```bash
node showcase/site/tests/coverage/merge-coverage.ts --lcov showcase/site/.work/coverage/lcov.info --v8 showcase/site/.work/coverage/v8 --sourcemaps showcase/site/.work/sourcemaps --denominator showcase/site/coverage-denominator.json --out showcase/site/.work/coverage/report
```

file の名前は計画の名前で、実装の時に名前を変えた場合は、code-summary に実際の command を書く（この file は変えない）。

## Expected coverage

- showcase/site の第一者の `.ts` の module の行 coverage 80% 以上。分母は `showcase/site/coverage-denominator.json`（NFR Design の S2 の一覧）に固定し、未実行の file を0%として残す。基準を下げて通さない。分母の file の増減は理由を示して人の承認を受ける。
- `.astro` の file、Starlight と Astro の設定、生成物、xterm、formicarium の pack、第三者の code、試験の file と試験の道具は、理由付きで分母から除く。
- Firefox・WebKit は coverage を測らず、動作だけを受け入れる。

## Mocking and stubbing

- 取得（catalog・fixture の index・候補・Actions の API・npm の照会・公開 URL）は fetch を注入し、遅い応答と時刻は偽の時計で作る。網の外へ出ない試験にする。
- 端末は formicarium の browser API（createSession・createCommandSession・fixtureToFsEntries）と xterm を偽物で置き換え、状態の遷移・取消・失敗を作る。本物の formicarium と guest は Playwright の受入だけで使う。
- workflow の試験は YAML を読むだけで、GitHub に問い合わせない。

## Test data

- demo の fixture は `showcase/fixtures/`（U7。読むだけ）。
- 単体の build の試験は、試験の中の一時の dir に作る小さな候補（偽の guest の bytes、catalog、manifest）を使い、終わったら消す。
- 受入の候補は、main の CI の showcase.yml の run の `showcase-candidate`（GET だけ）を `showcase/site/.work/` に置く（git に入れない）。pack は同じ commit から U7 の pack.ts の verify の手順で作る。
- 敵対的な出力の harness の data（HTML・ANSI の問合せ・OSC 8・巨大な1行）は試験の file の中に持ち、site には入れない。
