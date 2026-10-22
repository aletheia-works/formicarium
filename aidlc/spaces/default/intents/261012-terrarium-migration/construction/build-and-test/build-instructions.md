# Build Instructions

intent 261012-terrarium-migration の Build and Test で使う build の手順。formicarium は `aletheia-works/formicarium`、受入の一部は `aletheia-works/vivarium` にある。

## 土台

- formicarium は、upstream の main の最新（2026-10-22 の時点で `6b5bac1f`、#63 の後）で build と試験を行う。
- この session の主な作業場所（`/Users/mutoakio/Documents/formicarium`）は AI-DLC の記録の change で、元は古い `5735433d` である。そこで、main の最新の jj workspace（`.artifacts/ws-biome`、`jj new main@upstream`）で実行する。結果の記録には、実行した commit を書く。
- vivarium の受入は、vivarium の upstream の main（2026-10-22 の時点で `e4ef0dc4`、#557 の後）で行う。

## 依存の取得

道具は mise で管理し、版を固定せずに最新を使う（`mise.toml` の `[tools]`。node・bun は `latest`）。

```bash
mise install
bun install --frozen-lockfile
```

- showcase の受入は、`showcase/node_modules/@aletheia-works/formicarium`（`mise run showcase:stage` が置く）が要る。
- showcase の site は、`cd showcase/site && bun install --frozen-lockfile` が要る。
- Playwright のブラウザ：`npx playwright install`（Chromium・Firefox・WebKit）。

## 生成物（ソースが変わらない限り作り直さない）

- `dist/blink/`（`blink.mjs`・`blink.wasm`・`build-info.json`）：`mise run build:blink-wasm`。blink は `blink.lock` の commit で、Emscripten でビルドする。
- `dist/guests/`（probe・hello・exit3・aube・pitchfork）：`mise run build:guests`。
  - **aube は、ゲストのソースが変わっていなければ作り直さない**（v2.6.1 で1時間以上かかる。project の決まり）。
  - pitchfork は、変わったときだけ作り直す。
  - 新しい作業場所では、主な作業場所の `dist/` をそのまま写して使う（今回は `cp -R ../../dist ./dist`。中身は作り直していない）。

## build

```bash
mise run typecheck
mise run build
```

`mise run build` は、`tsc -p tsconfig.json`、`tsc -p tsconfig.tests.json`、`bun .build/scripts/emit.js` を行う。`dist/` は作らない。

## build の確認

- `mise run lint:all`：Biome（2.6.2）・actionlint・ShellCheck。エラー0 が合格。既存の警告48・info 47 は数だけを記録する。
- `mise run typecheck` と `mise run build` の exit 0。

## よくある問題

- `mise run lint:all` の Biome の版が CI と違う：CI は Biome の最新を入れる。手元も `bun install` で `package.json` の `^2.6.2` に揃える。
- showcase の試験が `@aletheia-works/formicarium` を見つけられない：`mise run showcase:stage` を先に実行する（または主な作業場所の `showcase/node_modules` を写す）。
- migration の consumer の試験が「U2 candidate, independently installed consumer and real guest inputs required」で失敗する：その試験は、CI の候補と本物のゲストの入力を前提にする。手元に入力が無ければ、その試験は CI の結果で確かめる。
- zsh の `path` は PATH と結び付いた特別な変数なので、shell の loop の変数名に使わない。
