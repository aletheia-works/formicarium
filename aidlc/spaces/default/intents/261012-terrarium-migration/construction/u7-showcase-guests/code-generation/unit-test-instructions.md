# U7 showcase-guests 単体試験の手順

## Framework and Configuration

- runnerはNode 26.12.0の `node:test`（`--test-concurrency=1`）。TypeScriptはemitせず、Nodeの型の除去で直接実行する（`showcase/tsconfig.json` は `erasableSyntaxOnly`・`noEmit`、型検査だけに使う）。
- 本体の `@aletheia-works/formicarium` は、`mise run showcase-stage` で `showcase/node_modules/` に展開したpackを使う。試験はこのpackの公開exportだけをimportする。
- browserの受入はPlaywright 1.64.1（`showcase/tests/playwright.config.ts`、Chromium・Firefox・WebKit、workers 1、retries 0、timeout 840000ms）。
- 開始時に、Step 1で各toolの最新版を確かめる。

## Commands

すべてmain sessionで1つずつ実行する。U7のfileだけを対象にする。

1. runnerの確認（最初に1回）：

```bash
node --test --test-concurrency=1 showcase/tests/runner-ready.test.ts
```

2. 本体のpackの展開（単体試験の前に1回。`verify` の形）：

```bash
mise run showcase-stage
```

3. U7の単体試験と行coverage（showcaseのscriptだけを分母にし、80%未満は失敗）：

```bash
node --test --test-concurrency=1 --experimental-test-coverage --test-coverage-include='showcase/scripts/**' --test-coverage-lines=80 showcase/tests/runner-ready.test.ts showcase/tests/config.test.ts showcase/tests/resolve.test.ts showcase/tests/acquire.test.ts showcase/tests/archive.test.ts showcase/tests/build-key.test.ts showcase/tests/build.test.ts showcase/tests/reuse.test.ts showcase/tests/catalog.test.ts showcase/tests/pack.test.ts showcase/tests/candidate.test.ts showcase/tests/boundary.test.ts showcase/tests/mode.test.ts showcase/tests/workflow.test.ts
```

`mise run showcase-unit` は、このcommandと同じものを宣言する。

4. 型検査：

```bash
mise run showcase-typecheck
```

5. 境界の検査（違反のない現在のtree）：

```bash
mise run showcase-boundary
```

6. 受入（取得と候補の作成の後。ネットワークを使う）：

```bash
mise run showcase-accept-node
```

```bash
mise run showcase-accept-browser
```

## Coverage Target

- showcaseのscript（`showcase/scripts/**`）の行coverage80%以上。分母からfileを外さない。未収集のfileは失敗として扱う。
- 本体の第一者配布JSのcoverage80%以上は本体のCIのまま変えない（U7は本体のfileを変えない）。

## Mocking and Stubbing

- GitHub APIとrelease資産の取得は、`fetch` を試験の中で差し替える（`t.mock.method(globalThis, 'fetch', …)`）。実ネットワークは単体試験で使わない。
- source buildは、短い期限と小さなshellのprocessで、timeout・取消・process groupの終了・stagingの除去を模擬する。実際のcargoのbuildは単体試験で行わない（LinuxのCIだけ）。
- 再利用元のrunとartifactの一覧は、GitHub REST APIの応答の固定JSONで模擬する。
- ELFの検証は公開の `validateGuest` をそのまま使い、試験用の小さな静的ELFと動的ELF（PT_INTERPあり）を `showcase/tests/fixtures/` に生成用のcodeとして置く（バイナリfileはcommitしない）。

## Test Data

- `showcase/tests/fixtures/`：試験用の小さなELFの組立て、tar.gzの組立て（正常・escape・link・重複・truncate・上限）、GitHub APIの応答のJSON。
- `showcase/tests/boundary-fixtures/`：境界の違反を1件ずつ入れたsourceの断片。
- `showcase/fixtures/`（demo fixture）は試験の入力に使わない（候補の `fixtureInventorySha256` の計算だけで使う）。回帰用の `fixtures/` も使わない。
