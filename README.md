# formicarium

Contribution and community guidance: [CONTRIBUTING.md](https://github.com/aletheia-works/formicarium/blob/main/CONTRIBUTING.md),
[Code of Conduct](https://github.com/aletheia-works/formicarium/blob/main/CODE_OF_CONDUCT.md), and [security policy](https://github.com/aletheia-works/formicarium/blob/main/SECURITY.md).

An open-source user-mode x86 Linux emulator for the browser, in the spirit
of CheerpX: run unmodified Linux binaries in WebAssembly, without booting a
kernel, so that CLI bug reproductions can run as-is in a web page.

Status: proof of concept complete (blink on wasm, 2026-10-05). The handover
document is [`OUTCOMES.md`](OUTCOMES.md). Background research is in
[`docs/research/cheerpx-oss.md`](docs/research/cheerpx-oss.md).

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
} finally {
  await session.dispose();
}
```

`guestBytes` is a caller-provided static ELF64 little-endian x86-64 Linux executable. Guests are distributed separately. Node requires version 24 or later. The browser entry is `@aletheia-works/formicarium/browser`; serve its Worker and assets on the same origin with `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`. Browsers require Worker, SharedArrayBuffer and cross-origin isolation. No service worker setup is included.

The browser evaluates the verified loader bytes as a Blob module. Its Content Security Policy must explicitly allow `blob:` in `script-src` and WebAssembly compilation (for example, `script-src 'self' blob: 'wasm-unsafe-eval'; worker-src 'self'; connect-src 'self'`). Root and pthread Workers start from same-origin HTTP module URLs; arbitrary Blob Worker URLs are rejected. A policy that blocks the verified module rejects the run with `ASSET_LOAD`.

The default run deadline is 600000 ms and includes Worker startup. Supply `timeoutMs` or an AbortSignal explicitly when needed. Each run creates a fresh Worker. A session accepts one active run; concurrent operations reject with `BUSY`. Nonzero guest exits resolve with byte stdout/stderr. Failures reject with `ExecutionError`, a stable code and copied partial byte output. `decodeUtf8` uses replacement decoding; preserve raw bytes when fidelity matters. `onOutput` receives ordered copied chunks; callback exceptions fail the run.

Filesystem entries are copied at input and output. Persisted roots are cwd/home; executable and temporary system paths are excluded. Files sharing `inodeId` preserve hard links, symlinks remain links, and modes are preserved. Use `listEntries`, `readFile`, `remove`, `setCwd` and `reset` between runs. If the selected cwd was removed between runs, the next run recreates its missing directory ancestors with mode 0755 while preserving existing directory modes and rejecting file or symlink collisions. A successful run commits its snapshot after cleanup; timeout, abort or failed snapshot rolls it back. `dispose` is idempotent and permanently closes the session. Cleanup failure closes the session.

Default assets resolve relative to the installed package. Explicit `assets` requires absolute loaderURL, wasmURL, buildInfoURL and workerURL. Loader/wasm SHA-256 digests and clean pinned core metadata are checked before initialization. The checked loader bytes are evaluated without rereading the original URL. Node uses a run-specific directory with mode 0700 and an exclusive loader copy with mode 0400; pthreads use that same copy. The host owns these files and browser Blob URLs, stops owned Workers before releasing them, and releases resources after normal completion, abort, timeout or disposal even when the root Worker is forcibly terminated. Missing or mixed assets reject with `ASSET_LOAD`; initialization failure is `CORE_INIT`. See `THIRD_PARTY_NOTICES.md` and `assets/build-info.json` for provenance. Local test observations from the first npm release are recorded at commit `8096c7b4` and summarised in `docs/history/261006-npm-terrarium-release.md`; real Safari and full product regression/CI remain separate verification obligations.

## guest・install・command API

0.3.0 から、root export に次の API がある。実機 Safari では未検証である。

### guest の検証と登録

```js
import { createSession } from '@aletheia-works/formicarium/node';
import {
  validateGuest,
  fixtureToFsEntries,
  runValidatedGuest,
  registerValidatedGuest,
  decodeUtf8,
} from '@aletheia-works/formicarium';

// expected は呼出し元の固定カタログから渡す。
// { elfSha256, buildInfoSha256, identity: GuestBuildInfo }
const guest = validateGuest(guestBytes, expected);
const entries = fixtureToFsEntries([
  {
    path: '/work/input',
    type: 'file',
    mode: 0o644,
    inodeId: 'input',
    data: new TextEncoder().encode('example'),
  },
]);
const session = await createSession({ entries });
try {
  await registerValidatedGuest(session, 'tool', guest);
  const result = await runValidatedGuest(session, guest, {
    args: ['--version'],
  });
  console.log(result.exitCode, decodeUtf8(result.stdout));
} finally {
  await session.dispose();
}
```

`validateGuest` と `fixtureToFsEntries` は同期である。guest は static ELF64 little-endian x86-64 Linux で最大 128 MiB、canonical build metadata は最大 1 MiB。fixture は最大 4096 entries・合計 256 MiB・UTF-8 path 4096 bytes で、root からの逸脱、symlink loop、矛盾する hardlink を拒否する。guest・metadata・fixture の bytes は内部へ copy し、以後の入力の変更は実行に反映しない。handle の複製や、別の package instance で作った handle は `INVALID_INPUT` になる。

run・登録・FS 操作は session ごとに同じ排他を使い、競合は `BUSY` になる。`reset()` は実行を取り消して cleanup を待ち、登録・FS・cwd を初期状態へ戻す。`dispose()` は cleanup の後に終端となり、以後は `DISPOSED` になる。取消は `ABORTED`、guest の非ゼロ exit は従来どおり結果として返す。内部の予約 API は package exports に公開しない。

### カタログからの install

`createInstaller(session, catalog)` は、呼出し元が用意した固定カタログを検証・copy する。`installer.install('tool')` 又は `installer.install('tool@version')` で HTTPS 上の ELF・tar.gz を取得・検証し、同じ session へ登録する。既定版はカタログの defaults だけから選ぶ。通信や登録の失敗で旧 guest を置き換えず、run・FS・別の install との競合は `BUSY` になる。公開型、カタログの必須情報、取消・進捗・エラーと例は [install API](docs/install-api.md) を参照。

### 端末の command

`createCommandSession(session, { catalog })` は 1 行の文字列を解釈し、`ls [path]`・`cat path`・`cd path`・`rm -rf path` を session の FS 操作へ、`install <selection>` を同じカタログの install へ、それ以外を登録済み guest の実行へ振り分ける。shell の構文（pipe・リダイレクト・変数展開・glob など）は展開せず `INVALID_INPUT` にする。各 command は session の予約を 1 回だけ使い、直接の API や別の command session との競合は `BUSY` になる。結果の stdout・stderr は原本の bytes で、表示への変換と表示の上限は UI 側の責任である。構文、予約名、取消と timeout、UI への受渡しの条件は [command API](docs/command-api.md) を参照。

## showcase の最新版ゲスト

[`showcase/`](showcase/) は、aube・pitchfork・Biome の最新の安定版を解決・取得（公式の static musl 資産がない pitchfork は source build）・検証し、公開 export（`@aletheia-works/formicarium`、`/node`、`/browser`）だけを使って Node・Chromium・Firefox・WebKit で `--version` を受入して、showcase の候補（catalog と manifest）を作ります。本体の `runtime/`・`types/` からは参照せず、境界は機械検査します。専用の CI は [`.github/workflows/showcase.yml`](.github/workflows/showcase.yml) です。構成と手順は [showcase の README](showcase/README.md) を参照して下さい。受入（3ツール×Node・3ブラウザの12行）はCIで通っています（2026-10-20のmainではrun 39412286499）。`distribute` の実行は、2026-10-20 の showcase site の最初の配布で確かめました（[showcase の README](showcase/README.md) の記録）。実機Safariは未検証です。

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

| 層                    | 場所                                           | コアへの依存                                                       |
| --------------------- | ---------------------------------------------- | ------------------------------------------------------------------ |
| コアの記述子          | `runtime/core.js`                              | ここだけがコアを知る（ビルド物の場所、コマンドラインの組み立て方） |
| 入出力の共通部        | `runtime/guest-io.js`、`runtime/session.js`    | なし（Emscripten の FS API だけを使う）                            |
| Node.js の実行環境    | `runtime/node/`                                | なし                                                               |
| 配布用ブラウザAPI     | `runtime/web/`                                 | なし                                                               |
| 検証用Web UI          | `web/`、`scripts/serve.js`                     | なし                                                               |
| コア（blink の fork） | `blink.lock` → `.vendor/blink` → `dist/blink/` | —                                                                  |

置き換えるときは、`runtime/core.ts` に paludarium の記述子を足し、`dist/` にそのビルド物を置く。

## 前提ツール

| ツール                     | 用途                                                       | 入手                                                                                                                                                          |
| -------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bun latest                 | 開発依存の固定導入、開発task                               | `mise.toml`（`mise install`）                                                                                                                                 |
| Node.js latest             | ランナー、consumer、Worker、テスト、計測                   | `mise.toml`（`mise install`）。公開packageの対応範囲はNode >=24                                                                                               |
| Docker Desktop または wslc | blink の wasm ビルド、ゲストのビルド、native の基準値      | wslc（`C:\Program Files\WSL\wslc.exe`）を優先し、動かなければ docker を使う。`FORMICARIUM_CONTAINER` で指定もできる                                           |
| emsdk                      | ローカルでの Emscripten（`FORMICARIUM_BUILD=host` のとき） | `~/AppData/Local/emsdk`（Windows）または `~/emsdk`。`git clone https://github.com/emscripten-core/emsdk && ./emsdk install latest && ./emsdk activate latest` |
| Git、Git Bash              | スクリプトの実行（Windows）                                | —                                                                                                                                                             |
| Playwright のブラウザ      | ブラウザのテストと計測                                     | `mise run install-frozen` → `bun node_modules/@playwright/test/cli.js install chromium firefox webkit`                                                        |

Windows では、mise のツールは非対話シェルの PATH に載らない。`~/AppData/Local/mise/installs/<tool>/<version>/` の実体を直接呼ぶ。

blink の wasm ビルドは、既定ではコンテナ（`emscripten/emsdk:<ローカルの emsdk と同じ版>`）で行う。blink の
`configure` と `Makefile` は POSIX の sh と GNU make を前提にしていて、Windows の emsdk からはそのまま動かせないため
（`emconfigure ./configure` が `WinError 193` で止まる）。sh と GNU make がある Linux や macOS では
`FORMICARIUM_BUILD=host` でローカルの emsdk を使える。

## ビルド

### 通常CIと候補検証

`ci.yml`は全PRとmain pushで`quality`（30分）、`product-build`（各140分）、`product-regression`（各90分）、`product-tests`（集約5分）、`commit-format`（10分）、`ci-required`（5分）を実行する。品質taskはfrozen導入→lint→typecheck→build→Bun中心の軽量検査とNode固有検査の順。通常CIはcontents readだけを使い、checkout credentialを保存しない。製品ビルドはwasm・probe・aube/pitchforkの3ジョブ、回帰試験はNode・3ブラウザの4ジョブへ分割する。コンパイラimageと入力が同じ場合に個別成果物cacheを使い、cache missでもビルドと検査を実行する。native検査と全回帰試験はcache hitでも省略しない。cross-repository consumerと配布coverageはcandidate検証で別途確認する。

commit形式は信頼済みbaseの`scripts/ci/commit-format.ts`で検査する。導入前mainにこのvalidatorがない初回は安全側で失敗する。初期導入の手順は管理者がレビューと外部操作の承認後に決め、PR側validatorへのfallbackやcheck除外で回避しない。既存の`verify.yml`と`publish.yml`、公開RCと固定RC入力branchは保持する。

候補SHAの回帰は`candidate-verify.yml`のworkflow_dispatchで実行する（`candidate-required`、360分）。既存の登録済み`verify.yml`も同じ手順の互換入口として維持する。初回の通常CIでは、baseが移行前の固定SHA `12a92eabf70f6772f11e33f698e3db5088992270` の場合だけ、検証済みSHA `7fc23afedef9a2296cb24026c0f19998a6933da7` のcommit形式検査を使用する。以後はtrusted baseの検査を使用し、PRから検査コードを選ばない。事前にmain担当者が、そのSHAから新しいtarball/siteを生成し、変更のないcore/guestとprovenance/native baselineを照合して入力bundleを作る。`candidateSourcePaths(root)`が列挙した第一者source全てを`bundle.ts`の`sourcePaths`へ渡し、schemaVersion1 manifestとpayload inventoryを固定する。新sourceへ旧RCの検証結果を転用しない。

承認後、管理者は新しい固定commitのHTTPS raw URLを`FORMICARIUM_MODERNIZATION_INPUT_URL`、archive SHA256を`FORMICARIUM_MODERNIZATION_INPUT_SHA256`へ設定する。旧`FORMICARIUM_CI_INPUT_*`は変更しない。入力不足、未知member、symlink、digest/source/provenance不一致は試験前に拒否する。準備した入力と環境があれば`mise run verify-candidate`も同じ入口を使う。未変更guestは再ビルドしない。

必要checksの設定候補は`quality`、`commit-format`、`ci-required`、`candidate-required`。実設定と実CIは管理者の承認後に確認するため、workflowファイルがあるだけで運用済みとは扱わない。PRのGitHub run/checkがmerge SHAを示す場合も、checkoutしたhead SHAとreceiptを独立照合する。通常receiptのself申告は権限判断に使わず、run/attempt/workflow/producerとartifact digestをGitHub APIで確認する。保守自動化・自動merge・公開操作は別単位で整備する。

失敗時はlog、実行SHA、lock/toolchain、入力archive digestを確認し、新commit・新入力で再検証する。skip/cancel/pendingは成功へ置き換えない。入力がない状態で候補checkを成功扱いしない。公開や外向きpushは別承認を要する。実機Safariは未検証で、WebKit結果とは区別する。

| 論理task         | mise入口                    | Bun scripts                | 実行境界                                    |
| ---------------- | --------------------------- | -------------------------- | ------------------------------------------- |
| install-frozen   | `mise run install-frozen`   | `bun run install:frozen`   | Bun latest、frozen、script無効              |
| lint             | `mise run check`            | `bun run check`            | Biome                                       |
| typecheck        | `mise run typecheck`        | `bun run typecheck`        | TypeScript                                  |
| build            | `mise run build`            | `bun run build`            | tscとBun emitter                            |
| test-light       | `mise run test-light`       | `bun run test:light`       | Bun unit/tooling＋Node consumer/publication |
| test-consumer    | `mise run test-consumer`    | `bun run test:consumer`    | Node consumer、別途資産準備                 |
| verify-candidate | `mise run verify-candidate` | `bun run verify:candidate` | Node/browser/nativeと固定80%coverage        |

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

`mise run test-consumer` は wasm・guest・検証済みの npm アーカイブ・独立した consumer を使うため、各テストの資産と環境変数を準備してから実行する。Playwright は `.spec.ts` を読み、3 ブラウザ・1 worker・再試行なしを維持する。失敗時には trace と screenshot を保存する。開発依存はtext `bun.lock`をコミットし、frozen導入でlockの変更を拒否する。導入scriptは全て無効化し、`trustedDependencies: []`でBunの既定許可にも頼らない。cacheなし確認は`bun scripts/ci/tasks.ts install-frozen --cacheless`で実行する。Node向けconsumer・Worker・固有flagsをBun runtimeへ置換しない。

```bash
mise run install-frozen
mise run build                   # TypeScript を JavaScript にコンパイルする
mise run build-blink-wasm   # blink.lock のコミットを取得し、dist/blink/blink.mjs と blink.wasm を作る
mise run build-guests       # dist/guests/ に probe・hello・exit3・aube（v2.6.1）・pitchfork（v2.30.1）を作る（aube は 1 時間以上かかる）
mise run native-baseline    # fixtures/baseline/aube-1645.native.txt（native の基準値）を作る
mise run native-baseline pitchfork-basic --check-reproducible   # pitchfork の基準値（2 回作って一致を確かめる）
bun node_modules/@playwright/test/cli.js install chromium firefox webkit
```

`mise run fetch-blink` は `blink.lock` のコミットだけを `.vendor/blink` に取得する。fork と upstream の差分は
`git -C .vendor/blink diff <upstream_commit> <commit>`（値は `blink.lock`）で一覧できる。
- probe だけを作り直すときは `mise run build-guests probe`（1 分ほど）。aube は入力が変わらない限り作り直さなくてよい。
- pitchfork だけを作るときは `mise run build-guests pitchfork`（初回は 35 分ほど）。公式リポジトリ（jdx/pitchfork）の
  タグ `v2.30.1` を取得し、コミットを `dist/guests/pitchfork.commit` に記録する（`PITCHFORK_REF` で変えられる）。
  - release ビルドは web UI を埋め込むので、先に `ui/` を `dist/guests/aube` で `aube install --frozen-lockfile && aube run build`
    する。上流UIのNode実行には公式 `node:current-alpine` の最新系列を使う（`PITCHFORK_UI_NODE_IMAGE`で変更可能）
  - 上流ソースを修正せずにビルドする。ソース変更が残るキャッシュは拒否する
  - UI に使った node の版と UI 成果物の sha256 を `dist/guests/pitchfork.build-info` に記録する
    ビルド後、`dist/guests/` のすべてのゲストが static な x86-64 の ELF であること（`PT_INTERP` がないこと）を確かめる。
- ゲスト・環境変数・手順の一覧は `runtime/registry.ts` の 1 か所にある。ゲストを足すときは、そこに 1 行足し、
  `build-guests.sh` の対象・fixture・基準値・テストを足す。
- `mise run native-baseline [<手順>] [--check-reproducible]` は、表の手順（既定は `aube-1645`）の基準値を作る。
  手順の設定は `bun scripts/session-info.js <手順>` で表から読む（シェル補助はBunを優先し、必要時はNodeを使う）。
- wasm メモリの上限は 1 GB（`-sMAXIMUM_MEMORY=1GB`）。WebKit がインスタンスごとに上限までメモリを確保するため、
  4 GB から下げた。1 GB を超えるメモリを使うゲストは動かない。
- `dist/blink/build-info.json` の `blinkSourceDirty` が `true` のビルド（未公開の修正を含む）では、
  `tests/node/build.test.js` の 1 件が意図どおり失敗する。

### fork を直すとき

1. `.vendor/blink-src`（fork のコピー）で修正する。この PoC では jj で管理している。
2. `BLINK_SRC=.vendor/blink-src mise run build-blink-wasm` でビルドして試す（通常の取得経路は `checkout --force` と
   clean を呼ぶので、ローカルの修正には使わない）。
3. 修正を新しいコミットにして `formicarium-wasm` に push し、`blink.lock` の `commit=` を更新する。
   公開済みのコミットに変更が混ざらないように注意する（jj は作業中の変更を今のコミットに取り込むため、先に `jj new` しておく）。
4. `mise run fetch-blink` と `mise run build-blink-wasm` でクリーンビルドし、全テストを実行する。
5. レビュー用に、差分の写しを `patches/` に置く。

## 保守 workflow

共通の保守は vivarium と同じ GitHub Actions の構成を使います。`dependabot-auto-merge.yml`、`labeler.yml`、`assign.yml`、`dependency-review.yml`、`claude-review.yml`、`commitlint.yml` は aletheia-works/.github の共有 workflow を呼び出します。
- `dependabot-auto-merge.yml`: `dependabot/fetch-metadata` で更新内容を読み、major 以外の更新は `gh pr merge --auto --squash` で予約します。main の required checks が成功し、branch protection の条件を満たしてから GitHub が統合します。major 更新は自動統合しません。
- `lint-autofix.yml` / `lint-autofix-apply.yml`: 権限なしで Biome の修正 patch を作り、別 job が許可された既存ファイルの差分だけを確認して適用します。head が変わっていれば適用しません。適用先は同じ repository の PR に限ります。
- `labeler.yml` / `.github/labeler.yml`: `actions/labeler` によるファイル分類と、既存 repository と同じ Conventional Commits の type label を使います。
- `assign.yml`、`dependency-review.yml`、`commitlint.yml`: 担当者とマイルストーンの設定、依存更新のレビュー、Conventional Commits の検査です。
- `claude-review.yml`: 許可された作成者の PR を Claude Code がレビューします。`docs/decisions/`、`docs/history/` と AGENTS.md に照らして差分を確かめます。

Bun 1.4.2 / bun.lock による依存管理、固定 Node、`ci.yml` の lint・型検査・build・軽量試験、候補回帰・coverage・公開前検査は formicarium 固有の検証として維持します。
整形の適用には既存の repository secret `TF_TOKEN_GITHUB` を使います。Dependabot の auto-merge は `GITHUB_TOKEN` を使います。
整形 patch は workflow・依存定義・lockfile・tool設定を変更できず、PR のコードを privileged job で実行しません。
独自の TypeScript 保守 runner、producer ID の登録、保守用 policy、`MAINTENANCE_ENABLED` は不要です。

## 将来の RC / stable 公開

`publish.yml` は `v*` tag を入口とし、実行時に `X.Y.Z-rc.N`（N は正整数）または `X.Y.Z` の厳密な版、tag、source SHA、公開先、版ごとの人の承認を照合します。RC は `next`、stable は `latest` を使います。stable は同じ基底版の公開 RC の採用記録と差分検査も必要です。既存 `v0.1.0-rc.1` と `codex/release/rc1-inputs` は履歴の固定入力として保持します。

readonly verify job は Bun latest と `bun.lock` で依存を導入し、TypeScript の公開前検査を直接実行します。公開候補は通常 CI と別に `candidate-verify.yml` の `candidate-required`、9 個の必須検査、固定 inventory の全 realm receipt と 80% coverage を要求します。GitHub API の run/attempt/source/workflow/producer、artifact digest、report bytes を独立照合し、skip・missing・非成功を拒否します。stable の公開 RC 採用記録と差分検査も維持します。

検査成功後、`candidate.tgz` だけを標準の upload/download-artifact で同じ workflow run の後続 job へ渡します。各 writer は verify job の SHA256 出力とダウンロード後の bytes を照合します。生成 runner・bootstrap・独自の転送 manifest は使いません。npm 公開は YAML に記載した `bunx npm@latest publish`（OIDC・provenance・RC は next、stable は latest）、GitHub Release は `gh release create` で実行します。npm CLI の実行にだけ Node latest を用意します。publish job だけに id-token:write、release job だけに contents:write を与え、両方で environment `release` を使います。Release は独立した操作承認があるときだけ作ります。

`scripts/release/publication-policy.json` の workflow / producer ID、許可した archive redirect host は独立確認後に設定する前提です。現状の null ID と `writerEnabled: false` は公開用 artifact の作成を拒否します。公開先の設定、tag / branch push、公開実行は別の承認が必要です。

外部 write の結果が不明な場合は自動再送しません。npm registry の同じ版・integrity・dist-tag、GitHub Release の tag / asset digest、run log を読み返し、人が状態を確定してから復旧を判断します。publish が失敗すれば release を起動せず、npm 成功後の Release 失敗も部分成功として扱います。共有 tag concurrency は実行中の処理を cancel しません。

Dependabot は毎週月曜 05:00（Asia/Tokyo）に Bun の依存と Actions を更新します。
自動統合の設定は vivarium と同じ YAML にあり、main の品質 checks と branch protection が最終判断を行います。
停止するときは GitHub Actions の対象 workflow を Disable workflow にします。

## 実行

```bash
# Node.js の Worker で実行する。終了コードはゲストのもの（見つからなければ 127）
node runtime/node/run.js dist/guests/probe
node runtime/node/run.js --copy-in fixtures/aube-local-deps:/work --cwd /work/app \
  --env AUBE_NO_UPDATE_CHECK=1 dist/guests/aube list

# ブラウザで実行する（COOP/COEP 付きの開発用サーバー）
bun scripts/serve.js --port 8787
#   http://127.0.0.1:8787/web/index.html?guest=probe
#   http://127.0.0.1:8787/web/index.html?session=aube-1645
#   http://127.0.0.1:8787/web/index.html?session=pitchfork-basic
```

ページは `crossOriginIsolated` を表示し、結果を `<pre id="output" data-testid="output">` と `data-exit-code` 属性に出す。
ヘッダーを設定できない配信先（GitHub Pages など）では、`web/coi-sw.js`（service worker）が COOP/COEP を付ける。

診断用に `--core-flag -s`（blink のシステムコール記録）と `--core-flag -e`（ログを stderr に出す）を渡せる。
ブラウザでは URL に `&core-flag=-s` を付ける（`-e` は自動で付く）。

Git Bash では、`--copy-in fixtures/...:/work` の `/work` が Windows のパスに書き換えられてしまう。
`MSYS_NO_PATHCONV=1 node runtime/node/run.js ...` のように、変換を止めて実行する。

ブラウザの実行用 Worker（`web/worker.js`）は、コアを読み込む前に `Atomics.waitAsync` を無効にしている。
WebKit で Emscripten の代行依頼の通知が取りこぼされ、ゲスト全体が止まることがあったため（`docs/results/failures.md` の L-3）。

aube は `--version` や `install` のたびに registry へ更新の確認をしに行く。ブラウザにはネットワークがなく、条件を
native の基準値とそろえるため、`AUBE_NO_UPDATE_CHECK=1` で止めて実行する（`runtime/registry.js` の `GUESTS.aube.env`）。

手順ファイル（`fixtures/sessions/*.txt`）は、`<ゲスト> ...`、`rm -rf <相対パス>`、`cat <相対パス>` の 3 つを受け付ける。
引数は native の基準値（`sh -c`）と同じ規則で分ける（単引用符、二重引用符、`\`）。`|`、`;`、`$`、`*` など、sh が
分割以外の意味に解釈する文字は、結果が食い違わないように拒否する（`runtime/session.js` の `splitShellWords`）。

## テスト

```bash
node --test tests/node/build.test.js      # fork の固定とビルド（pitchfork が static な ELF であることも）
node --test tests/node/runner.test.js     # Node.js のランナー、ゲストと手順の表、入口の検証
node --test tests/node/session.test.js    # 手順の解釈（引数の分割、cat）。ビルド物なしで実行できる
node --test tests/node/probe.test.js      # probe の全項目（Node.js）
node --test tests/node/aube-1645.test.js  # aube #1645 の書き起こし（Node.js）
node --test tests/node/measure.test.js    # 計測結果の形式
node --test tests/node/pitchfork-basic.test.js   # pitchfork-basic（Node.js）
npx playwright test tests/browser/probe.spec.js tests/browser/aube-1645.spec.js   # probe と aube #1645（Chromium・Firefox・WebKit）
npx playwright test tests/browser/pitchfork-basic.spec.js   # pitchfork-basic（Chromium・Firefox・WebKit）
```

pitchfork のテストの前提は `mise run build-guests pitchfork` と
`mise run native-baseline pitchfork-basic --check-reproducible`。pitchfork が書き込む場所の調査
（どのコマンドがどこに書くか、`status api` が何を返すか）は `mise run pitchfork-probe-paths` で native に確かめられる。

Safari の代わりに Playwright の WebKit で確かめている。実機の Safari（macOS）での確認はまだしていない。

probe には、合格判定の 8 項目のほかに、引数で個別に指定したときだけ動く回帰用の項目がある。

| 項目               | 確かめること                                                          |
| ------------------ | --------------------------------------------------------------------- |
| `futex-deadline`   | `FUTEX_WAIT_BITSET` の絶対期限が、別の待ち手への wake で短くならない  |
| `page-fault-race`  | 複数スレッドが同じ新しいページに同時に触れても、ページが混線しない    |
| `madvise-dontneed` | `madvise(MADV_DONTNEED)` の後、プライベートな匿名メモリがゼロで読める |

2026-10-05 のクリーンビルドでの結果は、Node.js 41/41、ブラウザ 33/33、ブラウザの 3 回繰り返し 99/99。
繰り返しの確認は次のとおり。

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
fixtures/             aube #1645 と pitchfork の入力、手順、native の基準値
runtime/              コアに依存しない実行環境（Node.js・ブラウザ）。ゲストと手順の表は runtime/registry.js
scripts/              ビルド・取得・基準値・計測・開発用サーバー
tests/                node --test と Playwright のテスト
docs/                 アーキテクチャの要約、設計上の決定（decisions/）、非機能要件のまとめ、ライセンスの確認、計測値、通らなかった項目と直したもの、JIT の判断材料、作業ごとの記録（history/）、調査（research/）
patches/              fork に入れた修正の写し（レビュー用）
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

### PR product tests

`ci.yml` runs on pull requests and pushes to `main`. In addition to lint,
TypeScript checks and lightweight tests, `product-tests` builds the locked blink
wasm core and probe/aube/pitchfork Linux guests from source, checks reproducible
native transcripts against the committed baselines, then runs Node regressions
and Chromium, Firefox and WebKit sequentially (one worker, no retries).
`ci-required` requires the product job to succeed. Compiled products, build metadata and Playwright
failure diagnostics are retained for seven days. Jobs use read-only permissions
and do not receive repository secrets.

The temporary digest-pinned input archive supplies only the unavailable locked
core source bundle to PR tests; its prebuilt products are not reused. Extended
cross-repository consumer and coverage checks remain in `candidate-verify.yml`.
That workflow uses the current run’s latest Playwright in the disposable
terrarium coverage workspace without changing the reviewed input snapshot.

CI selects `ubuntu-latest`, Node `latest` and Bun `latest` on each run. Playwright, Biome and TypeScript
are refreshed with `bun add --dev --no-save --ignore-scripts @playwright/test@latest @biomejs/biome@latest typescript@latest`,
so tests use the latest release while preserving the committed dependency lock.
Bun runs dependency installation, build, lint, type checks, the development server, general unit/tooling tests and browser tooling. Explicit
Node tests retain Node to verify the published Node consumer and Worker behavior.
The wasm compiler image is `emscripten/emsdk:latest` in PR product tests.

Product builds use three parallel jobs: wasm, probe, and aube/pitchfork. Aube
and pitchfork stay together because the pitchfork UI depends on aube and the
builds share Cargo downloads. Each component is cached by resolved Docker image
IDs and its build inputs; pitchfork also includes the actual aube bytes. CI
pulls current compiler images before cache lookup. Native checks run before
sharing artifacts, even on cache hits. Node, Chromium, Firefox and WebKit then
run in four isolated matrix jobs, each with one worker and no retries. All
matrix results must succeed for the existing product-tests/ci-required gates.
Artifacts include source SHA, run ID and attempt to keep reruns isolated.

## 開発タスクとスクリプトの配置

実行用タスクは `mise-tasks/` に置く。miseが自動検出するため、`mise.toml`への個別登録は不要。
`mise tasks ls`で一覧を確認し、`mise run build-guests probe`のように引数を渡せる。
固定依存の導入は `mise run install-frozen`（キャッシュなしは `--cacheless`）。
通常の確認は `mise run check`、`mise run typecheck`、`mise run build`、`mise run test-light`。
- `mise-tasks/`: 開発タスク、wasm・ゲストのビルド、ソース取得、native基準値作成、書き込み先調査。
- `scripts/lib/`と`scripts/emscripten-env.sh`: 複数タスクから読み込むコンテナ・環境設定。単独実行するタスクにはしない。
- `scripts/ci/`: 候補入力の検証・証拠収集。`tasks.ts`はキャッシュなし導入の引数検証と既存CIの入口に限定し、通常のmiseタスクはBunへ直接渡す。
- `scripts/package/`・`scripts/release/`: テストから使う検証・配布ロジック。YAMLへ複製せず、引き続き単体試験する。
- `.github/workflows/`: PRイベント、matrix、キャッシュ、artifact、保守自動化の制御。製品ビルドはローカルと同じ `mise-tasks/` の実装を実行する。

生成された `.js`・`.js.map`は `mise run build` の出力で、管理対象のスクリプトではない。
製品ビルドをCI専用YAMLへ移すとローカル再現性を失うため、共有する実行ファイルを1つに保つ。
候補検証のソース一覧には `mise-tasks/` も含め、タスク変更を検証対象から漏らさない。

配置の共通方針はvivariumに合わせる。実行用シェルはルートの `mise-tasks/` に用途別（`build/`、`test/`、`ci/`、`diagnostics/`、`install/`）の `.sh` ファイルとして置き、説明は `#MISE description` で記載する。
共有・検証ロジックは `scripts/`、回帰試験は `tests/`、手順・判断は `docs/`、CI制御は `.github/workflows/` に置く。製品固有の `runtime/`・`guest/` は役割を保つ。
既存の `mise run build-guests` などはaliasで維持し、`mise run build:guests` のような用途別タスク名も使える。
