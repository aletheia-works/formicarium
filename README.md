# formicarium

Contribution and community guidance: [CONTRIBUTING.md](https://github.com/aletheia-works/formicarium/blob/main/CONTRIBUTING.md),
[Code of Conduct](https://github.com/aletheia-works/formicarium/blob/main/CODE_OF_CONDUCT.md), and [security policy](https://github.com/aletheia-works/formicarium/blob/main/SECURITY.md).

An open-source user-mode x86 Linux emulator for the browser, in the spirit
of CheerpX: run unmodified Linux binaries in WebAssembly, without booting a
kernel, so that CLI bug reproductions can run as-is in a web page.

Status: proof of concept complete (blink on wasm, 2026-10-05). The handover
document is [`OUTCOMES.md`](OUTCOMES.md). Background research is in
[`aidlc/spaces/default/knowledge/documents/research/cheerpx-oss.md`](aidlc/spaces/default/knowledge/documents/research/cheerpx-oss.md)
(copied from aletheia-works/terrarium).

## Local runtime package candidate

`@aletheia-works/formicarium@0.1.0-rc.1` is a private local candidate and is not published. Install the exact verified archive locally:

```sh
npm install /absolute/path/aletheia-works-formicarium-0.1.0-rc.1.tgz
```

```js
import { createSession } from '@aletheia-works/formicarium/node';
import { decodeUtf8 } from '@aletheia-works/formicarium';
const session = await createSession({ cwd: '/work', home: '/home/guest' });
try {
  const result = await session.run({ guest: guestBytes, args: ['--version'] });
  console.log(result.exitCode, decodeUtf8(result.stdout));
} finally { await session.dispose(); }
```

`guestBytes` is a caller-provided static ELF64 little-endian x86-64 Linux executable. Guests are distributed separately. Node requires version 24 or later. The browser entry is `@aletheia-works/formicarium/browser`; serve its Worker and assets on the same origin with `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`. Browsers require Worker, SharedArrayBuffer and cross-origin isolation. No service worker setup is included.

The browser evaluates the verified loader bytes as a Blob module. Its Content Security Policy must explicitly allow `blob:` in `script-src` and WebAssembly compilation (for example, `script-src 'self' blob: 'wasm-unsafe-eval'; worker-src 'self'; connect-src 'self'`). Root and pthread Workers start from same-origin HTTP module URLs; arbitrary Blob Worker URLs are rejected. A policy that blocks the verified module rejects the run with `ASSET_LOAD`.

The default run deadline is 600000 ms and includes Worker startup. Supply `timeoutMs` or an AbortSignal explicitly when needed. Each run creates a fresh Worker. A session accepts one active run; concurrent operations reject with `BUSY`. Nonzero guest exits resolve with byte stdout/stderr. Failures reject with `ExecutionError`, a stable code and copied partial byte output. `decodeUtf8` uses replacement decoding; preserve raw bytes when fidelity matters. `onOutput` receives ordered copied chunks; callback exceptions fail the run.

Filesystem entries are copied at input and output. Persisted roots are cwd/home; executable and temporary system paths are excluded. Files sharing `inodeId` preserve hard links, symlinks remain links, and modes are preserved. Use `listEntries`, `readFile`, `remove`, `setCwd` and `reset` between runs. If the selected cwd was removed between runs, the next run recreates its missing directory ancestors with mode 0755 while preserving existing directory modes and rejecting file or symlink collisions. A successful run commits its snapshot after cleanup; timeout, abort or failed snapshot rolls it back. `dispose` is idempotent and permanently closes the session. Cleanup failure closes the session.

Default assets resolve relative to the installed package. Explicit `assets` requires absolute loaderURL, wasmURL, buildInfoURL and workerURL. Loader/wasm SHA-256 digests and clean pinned core metadata are checked before initialization. The checked loader bytes are evaluated without rereading the original URL. Node uses a run-specific directory with mode 0700 and an exclusive loader copy with mode 0400; pthreads use that same copy. The host owns these files and browser Blob URLs, stops owned Workers before releasing them, and releases resources after normal completion, abort, timeout or disposal even when the root Worker is forcibly terminated. Missing or mixed assets reject with `ASSET_LOAD`; initialization failure is `CORE_INIT`. See `THIRD_PARTY_NOTICES.md` and `assets/build-info.json` for provenance. Local test observations are recorded in the active AI-DLC U1 record; real Safari and full product regression/CI remain separate verification obligations.

## この PoC でしていること

[jart/blink](https://github.com/jart/blink)（x86-64 Linux のユーザーモードエミュレータ）の fork
[aletheia-works/blink](https://github.com/aletheia-works/blink)（`formicarium-wasm` ブランチ）を
Emscripten で wasm にビルドし（インタプリタのみ、JIT なし）、static-musl の x86-64 バイナリを
Node.js の Worker と、COOP/COEP 付きのブラウザページ（Chromium・Firefox・WebKit）で実行する。

- 合否の判定：Rust の probe（`guest/probe/`）と、aube #1645 の再現（`fixtures/sessions/aube-1645.txt`）
- 計測：aube の 4 コマンド（`--version`、初回 install、frozen install、list）の時間を CheerpX 1.3.9 と比べる
- 結果：[`docs/results/`](docs/results/)（計測値は `README.md`、通らなかった項目と直したものは `failures.md`、
  JIT の判断材料は `jit-decision.md`）

### 結果（2026-10-05）

- probe の全 8 項目（multi-thread tokio のタイマーと `UnixStream::pair`、4 並列の rayon、Mutex/Condvar、
  ファイルの作成・hard link・symlink・flock）が、Node.js・Chromium・Firefox・WebKit のすべてで合格した。
- aube #1645 の再現は、すべての環境で native（x86-64 Linux）と同じ出力になった。
- aube の 4 コマンドの合計は Chromium で約 12 秒、WebKit で約 20 秒（10 回の中央値）。install は解釈実行が 9 割以上を占め、
  ネイティブの約 75 倍かかる。CheerpX 1.3.9 と比べると、install は CheerpX の上限と同程度、frozen install は 1.5〜4 倍遅い。
- JIT の開発は後回しにした。コアを paludarium に置き換えるときに取り組む（[`docs/results/jit-decision.md`](docs/results/jit-decision.md)）。

### 将来の構想：コアの置き換え

エミュレータのコアは、別リポジトリ **paludarium**（Rust 版 blink）に置き換える予定。そのため formicarium は、
コアを「wasm モジュール 1 つ＋起動用の JS（Emscripten の MODULARIZE 形式）」として扱い、ブラウザ側と統合部分を
コアから分けている。

| 層 | 場所 | コアへの依存 |
|---|---|---|
| コアの記述子 | `runtime/core.js` | ここだけがコアを知る（ビルド物の場所、コマンドラインの組み立て方） |
| 入出力の共通部 | `runtime/guest-io.js`、`runtime/session.js` | なし（Emscripten の FS API だけを使う） |
| Node.js の実行環境 | `runtime/node/` | なし |
| ブラウザの実行環境 | `runtime/web/`、`scripts/serve.js` | なし |
| コア（blink の fork） | `blink.lock` → `.vendor/blink` → `dist/blink/` | — |

置き換えるときは、`runtime/core.ts` に paludarium の記述子を足し、`dist/` にそのビルド物を置く。

## 前提ツール

| ツール | 用途 | 入手 |
|---|---|---|
| Bun 1.4.2 | 開発依存の固定導入、開発task | `mise.toml`（`mise install`） |
| Node.js 24.21.0 | ランナー、consumer、Worker、テスト、計測 | `mise.toml`（`mise install`）。公開packageの対応範囲はNode >=24 |
| Docker Desktop または wslc | blink の wasm ビルド、ゲストのビルド、native の基準値 | wslc（`C:\Program Files\WSL\wslc.exe`）を優先し、動かなければ docker を使う。`FORMICARIUM_CONTAINER` で指定もできる |
| emsdk | ローカルでの Emscripten（`FORMICARIUM_BUILD=host` のとき） | `~/AppData/Local/emsdk`（Windows）または `~/emsdk`。`git clone https://github.com/emscripten-core/emsdk && ./emsdk install latest && ./emsdk activate latest` |
| Git、Git Bash | スクリプトの実行（Windows） | — |
| Playwright のブラウザ | ブラウザのテストと計測 | `mise run install-frozen` → `node node_modules/@playwright/test/cli.js install chromium firefox webkit` |

Windows では、mise のツールは非対話シェルの PATH に載らない。`~/AppData/Local/mise/installs/<tool>/<version>/` の実体を直接呼ぶ。

blink の wasm ビルドは、既定ではコンテナ（`emscripten/emsdk:<ローカルの emsdk と同じ版>`）で行う。blink の
`configure` と `Makefile` は POSIX の sh と GNU make を前提にしていて、Windows の emsdk からはそのまま動かせないため
（`emconfigure ./configure` が `WinError 193` で止まる）。sh と GNU make がある Linux や macOS では
`FORMICARIUM_BUILD=host` でローカルの emsdk を使える。

## ビルド

### 通常CIと候補検証

`ci.yml`は全PRとmain pushで`quality`（30分）、`commit-format`（10分）、`ci-required`（5分）を実行する。品質taskはfrozen導入→lint→typecheck→build→軽量Node検査の順。通常CIはcontents readだけを使い、checkout credentialを保存しない。OS/Bun/Node/lock digestで依存cacheを分け、cache missでも検査を実行する。通常CI成功は重い回帰や配布coverageの成功を意味しない。

commit形式は信頼済みbaseの`scripts/ci/commit-format.ts`で検査する。導入前mainにこのvalidatorがない初回は安全側で失敗する。初期導入の手順は管理者がレビューと外部操作の承認後に決め、PR側validatorへのfallbackやcheck除外で回避しない。既存の`verify.yml`と`publish.yml`、公開RCと固定RC入力branchは保持する。

候補SHAの回帰は`candidate-verify.yml`のworkflow_dispatchで実行する（`candidate-required`、360分）。既存の登録済み`verify.yml`も同じ手順の互換入口として維持する。初回の通常CIでは、baseが移行前の固定SHA `12a92eabf70f6772f11e33f698e3db5088992270` の場合だけ、検証済みSHA `7fc23afedef9a2296cb24026c0f19998a6933da7` のcommit形式検査を使用する。以後はtrusted baseの検査を使用し、PRから検査コードを選ばない。事前にmain担当者が、そのSHAから新しいtarball/siteを生成し、変更のないcore/guestとprovenance/native baselineを照合して入力bundleを作る。`candidateSourcePaths(root)`が列挙した第一者source全てを`bundle.ts`の`sourcePaths`へ渡し、schemaVersion1 manifestとpayload inventoryを固定する。新sourceへ旧RCの検証結果を転用しない。

承認後、管理者は新しい固定commitのHTTPS raw URLを`FORMICARIUM_MODERNIZATION_INPUT_URL`、archive SHA256を`FORMICARIUM_MODERNIZATION_INPUT_SHA256`へ設定する。旧`FORMICARIUM_CI_INPUT_*`は変更しない。入力不足、未知member、symlink、digest/source/provenance不一致は試験前に拒否する。準備した入力と環境があれば`mise run verify-candidate`も同じ入口を使う。未変更guestは再ビルドしない。

必要checksの設定候補は`quality`、`commit-format`、`ci-required`、`candidate-required`。実設定と実CIは管理者の承認後に確認するため、workflowファイルがあるだけで運用済みとは扱わない。PRのGitHub run/checkがmerge SHAを示す場合も、checkoutしたhead SHAとreceiptを独立照合する。通常receiptのself申告は権限判断に使わず、run/attempt/workflow/producerとartifact digestをGitHub APIで確認する。保守自動化・自動merge・公開操作は別単位で整備する。

失敗時はlog、実行SHA、lock/toolchain、入力archive digestを確認し、新commit・新入力で再検証する。skip/cancel/pendingは成功へ置き換えない。入力がない状態で候補checkを成功扱いしない。公開や外向きpushは別承認を要する。実機Safariは未検証で、WebKit結果とは区別する。

| 論理task | mise入口 | Bun scripts | 実行境界 |
|---|---|---|---|
| install-frozen | `mise run install-frozen` | `bun run install:frozen` | Bun固定版、frozen、script無効 |
| lint | `mise run check` | `bun run check` | Biome |
| typecheck | `mise run typecheck` | `bun run typecheck` | TypeScript |
| build | `mise run build` | `bun run build` | tscとNode emitter |
| test-light | `mise run test-light` | `bun run test:light` | Node node:test |
| test-consumer | `mise run test-consumer` | `bun run test:consumer` | Node consumer、別途資産準備 |
| verify-candidate | `mise run verify-candidate` | `bun run verify:candidate` | Node/browser/nativeと固定80%coverage |

すべてプロジェクトのルートで実行する。

実装・開発スクリプト・テスト・Playwright 設定は TypeScript で管理する。`mise run build` は型チェック後、生成した `.js` をソースと同じディレクトリに配置する。生成物は jj に記録しない。生成された blink loader は元の形式を維持する。`coi-sw.ts` は classic service worker として登録するため、ビルドでは型だけを除去し ESM の export を加えない。

```bash
mise run install-frozen
mise run check       # Biome による lint・format・import の検査
mise run typecheck   # 実装とテストの strict 型チェック
mise run build
mise run test-light  # Node単体テストと開発tooling検査
bun run check:fix    # Biome の安全な自動修正
```

Windows では POSIX permission bits の検査だけを skip する。同じ検査を Linux で実行することで権限の条件を確認する。外部の実配布資産に関するテストも、資産を未準備のときは未検証として表示する。

`mise run test-consumer` は wasm・guest・検証済みの npm アーカイブ・独立した consumer を使うため、各テストの資産と環境変数を準備してから実行する。Playwright は `.spec.ts` を読み、3 ブラウザ・1 worker・再試行なしを維持する。失敗時には trace と screenshot を保存する。開発依存はtext `bun.lock`をコミットし、frozen導入でlockの変更を拒否する。導入scriptは全て無効化し、`trustedDependencies: []`でBunの既定許可にも頼らない。cacheなし確認は`node scripts/ci/tasks.ts install-frozen --cacheless`で実行する。Node向けconsumer・Worker・固有flagsをBun runtimeへ置換しない。

```bash
mise run install-frozen
mise run build                   # TypeScript を JavaScript にコンパイルする
bash scripts/build-blink-wasm.sh   # blink.lock のコミットを取得し、dist/blink/blink.mjs と blink.wasm を作る
bash scripts/build-guests.sh       # dist/guests/ に probe・hello・exit3・aube（v2.6.1）・pitchfork（v2.29.0）を作る（aube は 1 時間以上かかる）
bash scripts/native-baseline.sh    # fixtures/baseline/aube-1645.native.txt（native の基準値）を作る
bash scripts/native-baseline.sh pitchfork-basic --check-reproducible   # pitchfork の基準値（2 回作って一致を確かめる）
node node_modules/@playwright/test/cli.js install chromium firefox webkit
```

`bash scripts/fetch-blink.sh` は `blink.lock` のコミットだけを `.vendor/blink` に取得する。fork と upstream の差分は
`git -C .vendor/blink diff <upstream_commit> <commit>`（値は `blink.lock`）で一覧できる。

- probe だけを作り直すときは `bash scripts/build-guests.sh probe`（1 分ほど）。aube は入力が変わらない限り作り直さなくてよい。
- pitchfork だけを作るときは `bash scripts/build-guests.sh pitchfork`（初回は 35 分ほど）。公式リポジトリ（jdx/pitchfork）の
  タグ `v2.29.0` を取得し、コミットを `dist/guests/pitchfork.commit` に記録する（`PITCHFORK_REF` で変えられる）。
  - release ビルドは web UI を埋め込むので、先に `ui/` を `dist/guests/aube` で `aube install --frozen-lockfile && aube run build`
    する。UI に使う node はメジャー版 24 に固定し（`PITCHFORK_UI_NODE_MAJOR`）、違う版が入ったら止まる
  - v2.29.0 は musl 向けにそのままではコンパイルできないので、型だけを合わせる 1 行のパッチ
    `patches/pitchfork-2.29.0-musl-ioctl.patch` を当てる（動作は変わらない）
  - 当てたパッチの sha256、UI に使った node の版、UI の成果物の sha256 を `dist/guests/pitchfork.build-info` に記録する
  ビルド後、`dist/guests/` のすべてのゲストが static な x86-64 の ELF であること（`PT_INTERP` がないこと）を確かめる。
- ゲスト・環境変数・手順の一覧は `runtime/registry.ts` の 1 か所にある。ゲストを足すときは、そこに 1 行足し、
  `build-guests.sh` の対象・fixture・基準値・テストを足す（[`docs/terrarium-integration.md`](docs/terrarium-integration.md) の 3 節）。
- `bash scripts/native-baseline.sh [<手順>] [--check-reproducible]` は、表の手順（既定は `aube-1645`）の基準値を作る。
  手順の設定は `node scripts/session-info.js <手順>` で表から読む（node は PATH、`FORMICARIUM_NODE`、mise の順に探す）。
- wasm メモリの上限は 1 GB（`-sMAXIMUM_MEMORY=1GB`）。WebKit がインスタンスごとに上限までメモリを確保するため、
  4 GB から下げた。1 GB を超えるメモリを使うゲストは動かない。
- `dist/blink/build-info.json` の `blinkSourceDirty` が `true` のビルド（未公開の修正を含む）では、
  `tests/node/build.test.js` の 1 件が意図どおり失敗する。

### fork を直すとき

1. `.vendor/blink-src`（fork のコピー）で修正する。この PoC では jj で管理している。
2. `BLINK_SRC=.vendor/blink-src bash scripts/build-blink-wasm.sh` でビルドして試す（通常の取得経路は `checkout --force` と
   clean を呼ぶので、ローカルの修正には使わない）。
3. 修正を新しいコミットにして `formicarium-wasm` に push し、`blink.lock` の `commit=` を更新する。
   公開済みのコミットに変更が混ざらないように注意する（jj は作業中の変更を今のコミットに取り込むため、先に `jj new` しておく）。
4. `bash scripts/fetch-blink.sh` と `bash scripts/build-blink-wasm.sh` でクリーンビルドし、全テストを実行する。
5. レビュー用に、差分の写しを `patches/` に置く。

## 保守 workflow

通常 CI の成功後に `maintenance.yml` が独立した API 観測と整形・依存更新の再現を行います。
整形 push と依存更新の squash merge は別の job で実行し、直前の head と
`quality`・`commit-format`・`ci-required` を再確認します。書込みは head 条件付きで 1 回だけ行い、
結果が不明な場合は読取りで照合します。自動再送はしません。失敗した lint を整形で迂回しません。

`.github/maintenance/policy.json` は観測済みの CI・保守 workflow ID と作成元を登録しています。
自動書込みは `writerEnabled` と repository variable `MAINTENANCE_ENABLED=true` の両方で有効になります。
有効化には独立確認した workflow・producer App・更新 Bot の数値 ID、workflow/config digest、
artifact の許可 redirect host、main の保護設定が必要です。`MAINTENANCE_ENABLED` も設定してください。
既存の terrarium と同じ repository secret `TF_TOKEN_GITHUB` を使います。
必要権限は Contents / Pull requests write、Actions / Administration read です。
公開 repository の Checks API は Checks 権限を指定せず読取り可能で、実際の読取検査も成功しています。
この credential は信頼済み base の固定 runner にだけ渡し、checkout には保存しません。
prepare は信頼済みツールの導入後に親の API 取得だけで使用し、隔離した再現 child へは渡しません。
同じ credential は write 権限も持つため、read 専用 App token による権限分離はありません。
子プロセスの環境は PATH/HOME/TMPDIR/CI/cache の許可項目だけで組み立て、token や秘密鍵を除外します。
secret の登録と読取確認は完了しています。実際の push・merge 成功は、対象となる保守実行の結果で確認してください。
`verify.yml` の手動実行で verification を `credential` にすると、checkout・依存導入・書込みなしで token の読取 API を検証します。
この検査の成功は Contents / Pull requests の書込み権限の実行検証を意味しません。

書込み job は trusted base にある Node 用 bundle を実行し、PR のコードや install script を実行しません。
bundle 更新時は固定 Bun で次を実行し、source と bundle の再生成一致を確認してください。

```bash
bun build scripts/maintenance/runner.ts --target=node --format=esm --packages=bundle --outfile=.github/maintenance/runner.mjs
biome check --write --config-path=biome.json .github/maintenance/runner.mjs
```

### 将来の RC / stable 公開

`publish.yml` は `v*` tag を入口とし、実行時に `X.Y.Z-rc.N`（N は正整数）または `X.Y.Z` の厳密な版、tag、source SHA、公開先、版ごとの人の承認を照合します。RC は `next`、stable は `latest` を使います。stable は同じ基底版の公開 RC の受け入れ証拠と差分検査も必要です。既存 `v0.1.0-rc.1` と `codex/release/rc1-inputs` は履歴の固定入力として保持します。上の U1 導入時の workflow 保持記述に対し、この U4 で `publish.yml` の将来版対応を追加しています。

readonly verify job は Bun 1.4.2 と `bun.lock` で導入・ビルドし、固定生成済み Node runner の再現を確認します。公開候補は通常 CI と別に `candidate-verify.yml` の `candidate-required`、9 個の必須検査、固定 inventory の全 realm receipt と 80% coverage を要求します。GitHub API の run/attempt/source/workflow/producer、artifact digest、署名済み report bytes を独立照合し、skip・missing・非成功を拒否します。

publish / release job は同じ tag SHA の checkout にある Node builtin bootstrap と trusted manifest で転送物を検証してから runner を起動します。writer では install / build を行いません。npm 11.19.0 は固定 URL と SHA512 を検証した archive から展開し、Node 24.21.0 で固定 CLI を実行します。npm の OIDC 権限は publish job、contents write は release job だけに与えます。Bun は開発用で、Node consumer と Worker の runtime は変えません。

`.github/publication/trusted-policy.json` の workflow / producer ID、許可した archive redirect host は独立確認後に設定する前提です。現状の null ID と `writerEnabled: false` は安全側で拒否し、実 CI・公開の運用開始を示しません。公開先の設定、tag / branch push、公開実行は別の承認が必要です。

外部 write の結果が不明な場合は自動再送しません。npm registry の同じ版・integrity・dist-tag、GitHub Release の tag / asset digest、run log を読み返し、人が状態を確定してから復旧を判断します。publish が失敗すれば release を起動せず、npm 成功後の Release 失敗も部分成功として扱います。共有 tag concurrency は実行中の処理を cancel しません。

Dependabot は毎週月曜 05:00（Asia/Tokyo）に Bun の依存と Actions を更新します。
Bun の更新はグループ化せず、直接の許可済み devDependency 1 件の固定版 patch/minor だけを merge 判定の対象とします。
range・major・prerelease・複数依存・Actions 更新は手動確認へ残します。
設定仕様は [Dependabot の公式資料](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference) を参照してください。
`pr-labels.yml` は PR の path metadata からラベルだけを追加します。

停止時は `MAINTENANCE_ENABLED` を無効にし、必要なら`TF_TOKEN_GITHUB` のアクセス権を取り消してください。
不明な書込み結果は PR・commit・merge の実状態を照合してから手動復旧します。
実 GitHub CI、App が起動する後続 CI、runtime の全 realm/80% coverage、実 API の atomic 操作は未検証です。

## 実行

```bash
# Node.js の Worker で実行する。終了コードはゲストのもの（見つからなければ 127）
node runtime/node/run.js dist/guests/probe
node runtime/node/run.js --copy-in fixtures/aube-local-deps:/work --cwd /work/app \
  --env AUBE_NO_UPDATE_CHECK=1 dist/guests/aube list

# ブラウザで実行する（COOP/COEP 付きの開発用サーバー）
node scripts/serve.js --port 8787
#   http://127.0.0.1:8787/runtime/web/index.html?guest=probe
#   http://127.0.0.1:8787/runtime/web/index.html?session=aube-1645
#   http://127.0.0.1:8787/runtime/web/index.html?session=pitchfork-basic
```

ページは `crossOriginIsolated` を表示し、結果を `<pre id="output" data-testid="output">` と `data-exit-code` 属性に出す。
ヘッダーを設定できない配信先（GitHub Pages など）では、`runtime/web/coi-sw.js`（service worker）が COOP/COEP を付ける。

診断用に `--core-flag -s`（blink のシステムコール記録）と `--core-flag -e`（ログを stderr に出す）を渡せる。
ブラウザでは URL に `&core-flag=-s` を付ける（`-e` は自動で付く）。

Git Bash では、`--copy-in fixtures/...:/work` の `/work` が Windows のパスに書き換えられてしまう。
`MSYS_NO_PATHCONV=1 node runtime/node/run.js ...` のように、変換を止めて実行する。

ブラウザの実行用 Worker（`runtime/web/worker.js`）は、コアを読み込む前に `Atomics.waitAsync` を無効にしている。
WebKit で Emscripten の代行依頼の通知が取りこぼされ、ゲスト全体が止まることがあったため（`docs/results/failures.md` の L-3）。

aube は `--version` や `install` のたびに registry へ更新の確認をしに行く。ブラウザにはネットワークがなく、条件を
native の基準値とそろえるため、`AUBE_NO_UPDATE_CHECK=1` で止めて実行する（`runtime/registry.js` の `GUESTS.aube.env`）。

手順ファイル（`fixtures/sessions/*.txt`）は、`<ゲスト> ...`、`rm -rf <相対パス>`、`cat <相対パス>` の 3 つを受け付ける。
引数は native の基準値（`sh -c`）と同じ規則で分ける（単引用符、二重引用符、`\`）。`|`、`;`、`$`、`*` など、sh が
分割以外の意味に解釈する文字は、結果が食い違わないように拒否する（`runtime/session.js` の `splitShellWords`）。

## テスト

```bash
node --test tests/node/build.test.js      # FR1：fork の固定とビルド（pitchfork が static な ELF であることも）
node --test tests/node/runner.test.js     # FR2.1：Node.js のランナー、ゲストと手順の表、入口の検証
node --test tests/node/session.test.js    # 手順の解釈（引数の分割、cat）。ビルド物なしで実行できる
node --test tests/node/probe.test.js      # FR3・FR4・FR5（Node.js）
node --test tests/node/aube-1645.test.js  # FR7.1（Node.js）
node --test tests/node/measure.test.js    # FR6：計測結果の形式
node --test tests/node/pitchfork-basic.test.js   # pitchfork-basic（Node.js）
npx playwright test tests/browser/probe.spec.js tests/browser/aube-1645.spec.js   # FR2.2・FR5.2・FR7.1
npx playwright test tests/browser/pitchfork-basic.spec.js   # pitchfork-basic（Chromium・Firefox・WebKit）
```

pitchfork のテストの前提は `bash scripts/build-guests.sh pitchfork` と
`bash scripts/native-baseline.sh pitchfork-basic --check-reproducible`。pitchfork が書き込む場所の調査
（どのコマンドがどこに書くか、`status api` が何を返すか）は `bash scripts/pitchfork-probe-paths.sh` で native に確かめられる。

Safari の代わりに Playwright の WebKit で確かめている。実機の Safari（macOS）での確認はまだしていない。

probe には、合格判定の 8 項目のほかに、引数で個別に指定したときだけ動く回帰用の項目がある。

| 項目 | 確かめること |
|---|---|
| `futex-deadline` | `FUTEX_WAIT_BITSET` の絶対期限が、別の待ち手への wake で短くならない |
| `page-fault-race` | 複数スレッドが同じ新しいページに同時に触れても、ページが混線しない |
| `madvise-dontneed` | `madvise(MADV_DONTNEED)` の後、プライベートな匿名メモリがゼロで読める |

2026-10-05 のクリーンビルドでの結果は、Node.js 41/41、ブラウザ 33/33、ブラウザの 3 回繰り返し 99/99。
繰り返しの確認（NFR1）は次のとおり。

```bash
npx playwright test tests/browser/probe.spec.js tests/browser/aube-1645.spec.js --repeat-each=3
node --test tests/node/probe.test.js tests/node/aube-1645.test.js   # 3 回
```

## 計測

```bash
node scripts/measure-aube.js --trials 10   # docs/results/aube-timings.json と docs/results/README.md を書く
```

ほかの重い処理（コンテナでのビルドなど）を止めてから計測する。並行負荷で値が大きく変わる。
このノート PC では、何も動かしていなくても同じ計算の時間が最大 2.4 倍変わることがあった。そのため計測スクリプトは、
各試行の前後にホストの固定計算の時間（`hostBenchMs`）も記録し、表の「ホスト基準」の列に出す。
値が大きい試行は、ホストが遅い時間帯に当たったと見てよい。

## ディレクトリ

```
OUTCOMES.md           PoC の引き継ぎ文書
blink.lock            fork の URL とコミット
guest/probe/          static-musl x86-64 のゲスト（probe・hello・exit3）
fixtures/             aube #1645 と pitchfork の入力（terrarium から取り込み）、手順、native の基準値
runtime/              コアに依存しない実行環境（Node.js・ブラウザ）。ゲストと手順の表は runtime/registry.js
scripts/              ビルド・取得・基準値・計測・開発用サーバー
tests/                node --test と Playwright のテスト
docs/                 アーキテクチャの要約、設計上の決定（decisions/）、非機能要件のまとめ、ライセンスの確認、計測値、通らなかった項目と直したもの、JIT の判断材料
patches/              fork に入れた修正の写し（レビュー用）
aidlc/                AI-DLC の作業記録（要件、計画、レビュー、テストの証拠）
```

## 既知の制約

詳しくは [`docs/results/failures.md`](docs/results/failures.md) と [`OUTCOMES.md`](OUTCOMES.md) の 8 節。

- 実機の Safari（macOS）では確かめていない。
- 計測の条件が CheerpX とそろっていない（背面での計測をしていない。計測はこのノート PC 1 台だけ）。
- WebKit は、まれに同じ処理が全体に遅くなる（不具合による停止ではなく、マシンの状態の影響と見ている）。
- ファイルをコピーしたプライベートなページに `MADV_DONTNEED` をかけても、ファイルの内容には戻らない。
- 手順ごとに blink を起動し直すので、1 コマンドあたり 0.3〜0.5 秒の固定費がかかる。
- wslc はこのマシンで動かず、Docker で代用している。

## License

Apache License 2.0（blink の fork は ISC。[`docs/licenses.md`](docs/licenses.md) を参照）
