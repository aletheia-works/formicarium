# U6 recipe-runtime の単体試験の手順

## Framework

- vivarium の fork（`~/Documents/vivarium`、bookmark `u6-formicarium-recipe`）で実行する。toolchain は vivarium の `mise.toml`（node・bun は latest）。宣言された task は `mise run` で実行し、mise の shim や `mise exec` は使わない。
- docs と script の単体：bun test（vivarium の既存の構成）。`tools/fixed-guest-builder`：その package の bun test。
- ブラウザ：Playwright（latest。`src/layer1_wasm/playwright.config.ts`）。U6 の spec は `retries: 0` と `test.setTimeout(180_000)` を自分で持つ。1 worker。
- build・test は main session で1つずつ実行する。重い並行処理をしない。

## Unit-scoped commands

すべて vivarium の repository の root（`~/Documents/vivarium`）で実行する。Step 2 で既存の試験に対して動くことを確かめる。

```bash
bun test docs/scripts/__tests__/recipesIndex.test.ts
```

```bash
bun test docs/scripts/__tests__/stageFormicariumAssets.test.ts docs/scripts/__tests__/coiServiceWorkerPin.test.ts
```

```bash
bun test docs/scripts/__tests__/resolveReproFile.test.ts docs/scripts/__tests__/layer1Bundle.test.ts docs/scripts/__tests__/workflows.test.ts
```

```bash
bun test src/layer1_wasm/biome-migrate-override-bracket-spacing/verdict.test.ts src/layer1_wasm/_shared/_test/formicarium_terminal.test.ts
```

```bash
bun test tools/fixed-guest-builder/tests/bump.test.ts
```

Playwright（`src/layer1_wasm` で、1ブラウザずつ）：

```bash
bunx playwright test tests/biome-migrate-override-bracket-spacing.spec.ts --project=chromium --workers=1
```

```bash
bunx playwright test tests/biome-migrate-override-bracket-spacing.spec.ts --project=firefox --workers=1
```

```bash
bunx playwright test tests/biome-migrate-override-bracket-spacing.spec.ts --project=webkit --workers=1
```

file の名前は計画の名前で、実装の時に vivarium の既存の名付けに合わせて変えた場合は、code-summary に実際の command を書く（この file は変えない）。

Step 18a（公開 site の dotfile の欠落の修正、bookmark `fix/pages-include-hidden-files`）：新しい試験の失敗を直す前に観測し、直した後に同じ command で通ることを確かめる。

```bash
bun test docs/scripts/__tests__/workflows.test.ts docs/scripts/__tests__/stageFormicariumAssets.test.ts
```

続けて `mise run ci:docs-unit`、`mise run docs:check`、actionlint（実体の binary）を1つずつ実行する。公開 site での確かめは、merge と deploy の後に、Step 18 の W5 を `.artifacts/u6-recipe-runtime/acceptance/` の一回限りの script で3ブラウザ × en・ja × 初回・再訪問で行う。

## Expected coverage

- U6 で足す第一者の TS（AssetStager、coi-serviceworker の pin、recipes index の U6 の検証、判定の部品、共有 module、recipe の repro）の行 coverage 80% 以上。分母の一覧は Step 15 で file に固定し、未実行の file を0%として残す。基準を下げて通さない。
- bun の coverage（`--coverage`）と、Chromium の V8 の coverage を source map で TS の行へ対応させた結果を合わせる。Firefox・WebKit は coverage を測らず、動作だけを受け入れる。

## Mocking and stubbing

- AssetStager は fetch・時計・file の書込み先を注入する。網の外へ出ない試験にする。redirect・上限・deadline は偽の応答で作る。
- 共有 module は formicarium の browser API を偽物で置き換え、照合の失敗・run の結果・取消を作る。本物の formicarium と ELF は Playwright の試験だけで使う。
- 上流の bump は今の試験と同じ local の repository を使う。

## Test data

- fixture は recipe の `fixture/`（`.prettierrc` と `biome.json`）。
- tarball は formicarium の main から作った配布候補（`local` mode の入力。git に入れない）。Step 3・Step 14 の ELF は旧題材の保存済みの Biome の ELF（stand-in。判定の合否に使わない）、Step 17 以降は新しい題材の Release の ELF。どちらも gitignore の下に置く。
- 試験用の改変した tarball・ELF は試験の中で一時の dir に作り、終わったら消す。
