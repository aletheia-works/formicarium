# terrarium への組み込み方の調査メモ（FR8.1）

intent `261005-pitchfork-on-blink` の調査メモです。terrarium（ツールごとに wasm にビルドして、ブラウザの端末で 1 つの CLI を動かす）
で、ツールごとのビルドの代わりに formicarium（x86-64 の static-musl バイナリをそのまま blink で動かす）を使う方法をまとめます。
組み込みそのものは行っていません（requirements.md の Out of Scope）。

根拠の種類は AGENTS.md に合わせて **検証済み / ドキュメント根拠 / 推測** と書きます。実測値は Build and Test で記入します。

## 1. terrarium での使い方の案

terrarium には入口が 3 つあります（terrarium の README、ドキュメント根拠）。リンク（`?ref=&run=&fixture=&cwd=&tool=`）、
`<terrarium-terminal>` 要素（`run()` で 1 コマンドずつ実行し、`code` と `output` を返す）、iframe（`postMessage` で
`terrarium:run` と `terrarium:exit` をやり取りする）です。formicarium を使う形として、次の 2 案を比べます。

| 観点 | 案 A：`runtime/` をライブラリとして読み込む | 案 B：formicarium のページを iframe で埋め込む |
|---|---|---|
| 形 | terrarium の `terminal.mjs`（または `<terrarium-terminal>`）が、ツールごとの `<tool>.js`/`<tool>.wasm` の代わりに `runtime/guest-io.mjs` の `runGuest`／`runSession` と `runtime/core.mjs` のコアを Worker で呼ぶ | terrarium のページに `web/index.html?session=...` を iframe で置き、結果（書き起こし）を受け取る |
| 端末の操作感 | terrarium の端末をそのまま使える。1 コマンドごとに `runGuest` を呼び、`persist` の中身を次へ渡す（今の `runSession` と同じ仕組み） | 今の formicarium のページには対話的な入力がない。`postMessage` で 1 コマンドずつ受け付ける口を新しく作る必要がある |
| 分離 | terrarium のページと同じ権限で動く（terrarium の要素と同じ扱い） | 別のオリジンに置けば分離できる。ただし COOP/COEP の下の iframe は `allow="cross-origin-isolated"` と、CORP か `credentialless`（Chromium のみ）が要る（terrarium の README、ドキュメント根拠） |
| 配布 | `runtime/` の 4 ファイル（`core.mjs`、`guest-io.mjs`、`session.mjs`、`registry.mjs`）と `dist/blink/`、ゲストのバイナリを terrarium の `web/` から配る | formicarium のページをそのまま配る。terrarium 側の変更は小さい |
| コアの置き換え（paludarium） | `runtime/core.mjs` の記述子を差し替えるだけで済む（ADR 0003、ドキュメント根拠） | 同じ。iframe の中だけが変わる |

推奨は **案 A** です（推測）。terrarium の価値は「端末でコマンドを打つと、そのツールが実際に出すものが見える」ことで、
その端末と `run()` の API を保ったまま実行部だけを差し替えられるからです。案 B は分離の利点がありますが、
対話の口を formicarium に作り直すことになり、`credentialless` が Chromium だけという制約も残ります。

## 2. terrarium 側で必要な変更

案 A の場合（推測。terrarium のコードは読んだだけで、変更も実行もしていない）：

- `web/tools.json`（ツールの一覧）に「実行方式」を足す。今の「ツールごとの wasm」と「formicarium のコアで x86-64 バイナリを動かす」を選べるようにする
- `web/terminal.mjs` の実行部を、実行方式で分ける。formicarium の方式では、Worker で `runGuest` を呼び、
  コマンドごとに `persist` のディレクトリ（`/work` と `/root`）の写しを次へ渡す
- 端末で打たれた 1 行を、formicarium の手順と同じ規則（`runtime/session.mjs` の `splitShellWords`）で分ける。
  `|` や `$` のように sh が別の意味に解釈する文字は、黙って違う動きをせずにエラーとして表示する
- `fixture`（`/work` に置くサンプル）は、terrarium の `fixtures/` をそのまま `runSession` の `entries` に写せる
- ビルドの CI（GitHub Actions）は、ツールごとの wasm ビルド（Rust の std と依存 crate へのパッチを含む）の代わりに、
  `x86_64-unknown-linux-musl` の static ビルドだけになる。terrarium の `scripts/build-pitchfork.sh` が当てている
  pitchfork 自身へのパッチ（`patches/tools/pitchfork-*.patch`）も要らなくなる（今回、pitchfork のソースは変えずに
  ビルドする。FR1.1）
- `ref`（`pr-<number>` などのビルドの選択）は、ゲストのバイナリの置き場所の選択に置き換わる。コア（`dist/blink/`）は全ツールで共通

## 3. ゲストを 1 つ足すのに要った変更（今回の実績）

pitchfork を足すのに変えた formicarium のファイルです。2 つ目以降のゲストのための作り替え（一覧の一元化、手順の文法の拡張）を含みます。

| 区分 | ファイル | 内容 | 次のゲストでも要るか |
|---|---|---|---|
| ビルド | `scripts/build-guests.sh` | 対象 `pitchfork` と取得元（`PITCHFORK_REPO`／`PITCHFORK_REF`）、static であることの確認。release ビルドが埋め込む web UI を、先に `dist/guests/aube` で `aube install --frozen-lockfile && aube run build` してから作る | 要る（対象を 1 つ足す。ツールごとのビルドの事情は個別に要る） |
| ビルド | `scripts/build-guests.sh` | v2.30.1 は上流の musl 型修正を含むため、ローカルパッチなしでビルドする。UI に使った node の版を build-info に記録する | ツールによる |
| 表 | `runtime/registry.mjs`（新規） | ゲスト・環境変数・手順の唯一の表 | 要る（1 行ずつ足す） |
| 手順 | `fixtures/sessions/pitchfork-basic.txt`、`fixtures/pitchfork-basic/` | terrarium から写した手順とサンプル | 要る |
| 基準値 | `fixtures/baseline/pitchfork-basic.native.txt` | `bash scripts/native-baseline.sh pitchfork-basic` が作る | 要る（スクリプトの変更は不要） |
| テスト | `tests/node/pitchfork-basic.test.mjs`、`tests/browser/pitchfork-basic.spec.mjs` | 書き起こしの一致と状態の引き継ぎ | 要る |
| 作り替え（初回だけ） | `runtime/session.mjs` | `cat` の手順、`sh -c` と同じ引数の分割、ツール名の受け取り | 不要 |
| 作り替え（初回だけ） | `runtime/guest-io.mjs` | `runSession` の `cat` のステップ | 不要 |
| 作り替え（初回だけ） | `web/sessions.js`、`web/worker.js` | 表から一覧を作る、手順ごとのツール名と `persist` | 不要 |
| 作り替え（初回だけ） | `scripts/native-baseline.sh`、`scripts/session-info.mjs`（新規）、`scripts/lib/node.sh`（新規） | 手順名を引数で受け取り、表から設定を得る。再現性の確認 | 不要 |

次のゲストからは、ビルドの対象・表の 1 行・fixture・基準値・テストの 5 か所で済む見込みです（推測。2 つ目のゲストで確かめる）。
blink の fork とコアの記述子（`runtime/core.mjs`）は、今回変えていません。8 コマンドは Node.js と 3 ブラウザのすべてで、
最初から native と一致しました（2026-10-06。FR7.1 の修正は不要でした）。

## 4. 制約

- **COOP/COEP**：コアは pthread（`SharedArrayBuffer`）を使うので、ページは cross-origin isolated でなければならない。
  ヘッダーを付けられない配信先では `web/coi-sw.js`（service worker）で付ける（README、ドキュメント根拠）。
  terrarium も同じ制約を持っており、`web/coi-serviceworker.js` がある（ドキュメント根拠）
- **ネットワークなし**：ブラウザ版のゲストにはネットワークがない。fork は inet の `socket()` を `EAFNOSUPPORT` で拒否する
  （NFR3、`docs/architecture.md`）。aube は更新の確認を `AUBE_NO_UPDATE_CHECK=1` で止めている。
  registry からの取得が要る操作（オンラインの `aube install` など）はできない
- **wasm のメモリ上限 1 GB**：`-sMAXIMUM_MEMORY=1GB`。WebKit がインスタンスごとに上限まで確保するため 4 GB から下げた。
  1 GB を超えるメモリを使うゲストは動かない（README、`tests/node/build.test.mjs` が固定）
- **手順の文法**：formicarium の手順は `<tool> ...`、`rm -rf <相対パス>`、`cat <相対パス>` の 3 つだけを受け付け、
  パイプ・リダイレクト・変数の展開などは拒否する。terrarium の端末で任意のシェルの構文を打てるようにするなら、
  sh そのもの（busybox など）をゲストとして動かすか、端末側で解釈を足す必要がある（推測）
- **状態の引き継ぎ**：コマンドごとにコアを起動し直し、`persist` のディレクトリの中身だけを次へ渡す。
  その外（例：`/tmp`）に書かれたものは消える。hard link は別々のファイルになり、mtime は引き継がない
  （`code-quality-assessment.md` の Q4、検証済み（読み取り））。pitchfork の書き込み先は計画の Step 4 で確かめる
- **デーモン**：pitchfork のスーパーバイザーや IPC は対象外（requirements.md の Out of Scope）。terrarium の pitchfork も
  スーパーバイザーの要らないコマンドだけを対象にしている（`scripts/build-pitchfork.sh` のコメント、ドキュメント根拠）
- **起動の固定費**：コマンドごとに blink を起動し直すので、1 コマンドあたり 0.3〜0.5 秒の固定費がかかる（README、ドキュメント根拠）

## 5. 置き換えの判断材料として測った値

2026-10-06 に、このノート PC で測った値です。このマシンは同じ計算でも速さが最大 2.4 倍揺れるので（AGENTS.md）、比較の目安にとどめます。

### サイズ

| 対象 | formicarium | terrarium（ツールごとの wasm） |
|---|---|---|
| コア（`dist/blink/blink.wasm` ＋ `blink.mjs`） | 455,584 ＋ 132,512 バイト（約 0.6 MB。全ゲストで共通） | なし（ツールごとに含む） |
| pitchfork（`dist/guests/pitchfork`、x86-64 static-musl、release） | 40,223,816 バイト（約 40 MB） | 未計測（terrarium 側のビルド物は今回測っていない） |
| aube（`dist/guests/aube`） | 31,471,776 バイト（約 31 MB） | 未計測（同上） |

### 手順ごとの実行時間（pitchfork-basic）

Node.js は `tests/node/pitchfork-basic.test.mjs` を 3 回実行したときの `stepMs`（コアの起動を含む、各ステップの実時間）です。値は 3 回の最小〜最大です。

| コマンド | Node.js（3 回） |
|---|---|
| `pitchfork --version` | 2.0〜4.6 秒 |
| `pitchfork daemons` | 1.6〜8.5 秒 |
| `pitchfork daemons add db --run "postgres -D data"` | 2.0〜5.4 秒 |
| `pitchfork daemons remove worker` | 2.5〜3.8 秒 |
| `cat pitchfork.toml`（JS 側。コアを起動しない） | 0 秒 |
| `pitchfork status api` | 2.4〜3.1 秒 |
| `pitchfork settings set general.interval 5s` | 4.3〜10.1 秒 |
| `pitchfork settings get general.interval` | 2.3〜4.7 秒 |
| 合計 | 24.9〜32.7 秒 |

ブラウザは、Playwright のテスト 1 件（ページの読み込みと判定を含む）の時間を 3 回ずつ測りました。コマンドごとの内訳は、テストの注釈 `elapsed` に残ります。

| ブラウザ | 3 回のテスト時間 |
|---|---|
| Chromium | 28.0〜34.3 秒（29.0、28.0、34.3） |
| Firefox | 51.2 秒〜3.1 分（1.3 分、51.2 秒、3.1 分） |
| WebKit | 46.8 秒〜2.2 分（2.2 分、1.0 分、46.8 秒） |

テストの時間の上限は、上の最大値の 3 倍を 60 秒単位で切り上げて決めました（計画の Step 11・12、NFR2）。Node.js は 120 秒、ブラウザは 600 秒です（`tests/shared/pitchfork-basic.mjs`）。

## 6. 未解決の事項

- terrarium のツールごとの wasm のサイズと実行時間は、今回測っていない。どちらが勝つかは未検証
- pitchfork v2.29.0 は musl 向けにそのままではコンパイルできず、型だけを直す 1 行のパッチ
  （`patches/pitchfork-2.29.0-musl-ioctl.patch`）を当てた。この記述はv2.29.0時点の履歴。v2.30.1では上流修正済みで、パッチと適用処理を削除した
- terrarium の端末で、手順の文法の外（パイプ、リダイレクト、変数）を打たれたときの扱い（4 節）。
  エラーにするか、sh をゲストとして動かすかは決めていない
- 実機の Safari（macOS）では確かめていない（WebKit で代用。既存の未解決事項と同じ）
- 組み込みの API：案 A の場合、`runtime/` を npm パッケージとして切り出すか、terrarium に写すか

## 7. U3 common runtime adoption（2026-10-08）

本intentで承認した構成では、terrariumは通常dependencyとして同じformicarium npm tarballを導入する。
旧設計の未決事項のうち、runtimeの複製・汎用shell追加は採用しない。
既存公開Session/Toolは保持し、aube/pitchforkの端末だけをC1公開APIへ接続する。
base/ref/fixture/cwdとC4イベント・queue・keyboard、C5 exact-originを翻訳する。

検証済み：mainのadapter/C3/asset unitは26 pass、型検査成功。
quote隣接は既存splitArgsと比較してRed（10 pass/1 fail）を観測し、同じsuiteでGreen（11 pass/0 fail）。
最新aube2.7.0のnativeとinstalled C1 Node Workerは、空/workから `init --bare` を実行して
`/work/package.json` を生成し、公開readFileで内容を確認した。
pitchfork2.30.1はmainでビルド成功（38分36秒）、nativeとinstalled C1 Workerのversionはexit0で一致した。
commitは `1054549e85470b08d9507e2c82c850959a4b3914`、guest SHA-256は
`f30395a418e526e939350cc87e03d43c92d1aa0a0b0b104130761a8b8daa841e`。
C4/C5全browser suiteの成功は未検証。

tarball SHA-256は `969e9fab854d4499da1d38087bd601b65042b6d50b086c8fc8ddaefd0752f810`。
mainでU1の既存候補と23配布fileが一致した。同じpackのterrarium導入であり、新provider buildではない。
guest/fixturesは外部の完全なsite-v3候補で供給し、npmに入れない。
同じ既存パッチをlatest pitchforkへ適用する。aubeを再ビルドしない。

### 実行手順と同一性

external terrariumのpackage install/lock、CSS生成、Bun bundle、各suiteはmainだけが逐次実行する。
`FORMICARIUM_GUEST_SITE` に完全なlatest siteを明示し、`assemble-pages.sh` はinstalled23fileと全ref資産のhashを検証後に配置する。
`TERRARIUM_BUN` にmiseで確認したBun実体、`PLAYWRIGHT_BROWSERS_PATH` に対応するbrowser実体cacheを設定する。
専用Playwright configはChromium/Firefox/WebKit、1worker、retry0。
browser suiteは実tarball/Worker/latest guestを利用し、local Pages相当と実Pagesを区別する。

### 固定23 coverage inventory

U1固定13 + U2固定3 + U3のadapter/catalog/terminal/legacy Session/index/npm/page計7を保持する。
export-only入口もfile一覧に残す。生成blink・xterm・型・guest・tests/development scriptsは理由付き別検証。
U3のTSは同じsource bytesをtranspile→instrument→main Bun bundleし、実配布bundleとの対応を記録する。
未importは0、missing realm・旧generation/source/candidate receiptは失敗。
prepareは新規outputdirのみで、旧結果を上書きして採用できない。
同じpackのU1既存coverageはimmutable component importとして元世代/source/hash/realm一覧を明示し、
現在世代を実行したと偽装しない。U2新guest候補には今世代C3 counterが必要。
検証済み：fresh generation `47181b67-22c6-4eff-9993-4488e2c103ed` の Node26 cases、browser45 cases は全成功。
固定23 files は1567 lines中1283 covered、skipped0、81.87%で80% floorを満たした。
source identityは `10e59a2ce434302860783e7d0436efda25e21ab2d5a22354d0a06f6f9c23b9f6`、
candidateは `3e3401c5a93bca5c7635d2ba0761bd72125b3421319c6ce054b178e011602983`。
Node receiptはmain親processの実exit0観測から確定し、attemptは
`1284a873-3a20-42d6-88dc-b9d51a1275b5`。今世代46 receiptsと既存U1 immutable component importを区別する。
collectorのmissing raw/旧attempt/nonzero等の負例は9 pass。
結果は `.artifacts/u3-coverage-v1/{inventory,report,coverage-final}.json`。統合前CIは未検証。
80% floor・統合前CIは維持する。U4が全体判定を所有する。

### 未検証・公開前事項

- U2 R-01 stale receipt/R-02 retained ref missing assetは未解消。U3のfreshdir/完全候補使用を修正完了とは呼ばない。
- 検証済み：C4 30 cases、C5修正後15 cases（22.3秒）、bridge consumer6 cases（12.2秒）。
  C5は同origin3成功/cross-origin Chromium成功とFirefox/WebKit拒否/隔離不足3拒否を含む。
  計測用browser再実行45 casesも成功し、最終coverageは81.87%。
- 負例では要素未接続・Session未作成のためmarker state自体が存在しないこととWorker request0を独立記録する。
  正例の実guest marker生成/readFileと、陰性で存在しないSessionを読めたという主張は区別する。
- 実GitHub Pages、service-worker実配信、公開済みRC受入れ、実機Safari、統合前CIは未検証。
- push/tag/npm/JSR/Pages公開の承認は本実装計画に含まれない。

### C5 local hostの配信前提（Red→Green検証済み）

mainのFirefox traceでcross-origin子documentがCORP不足によりnavigation時点で遮断され、
子のJSが実行されず `terrarium:error` も届かないことを観測した。
local iframe test serverには `Cross-Origin-Resource-Policy: cross-origin` を明示し、
文書を読み込んだ後のcredentialless互換性拒否とguest非実行を検査する。
COEPの資産要求とiframeへの再帰適用は
[MDN COEP](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cross-Origin-Embedder-Policy)、
credentialless例外は[MDN iframe credentialless](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/IFrame_credentialless)を根拠とする。
CORPは隔離自体を有効化しない。隔離不足のfixtureは親も子も `/plain/` でCOOP/COEPを省略し、
実際の双方の `crossOriginIsolated === false` をassertしてから拒否を検査する。
正常ケースの通知・marker生成、拒否ケースの通知・Worker request0という基準は維持する。
実GitHub Pagesのresponse headersと任意header設定可否は未検証であり、
このlocal配信条件での成功を実Pagesの成功とは扱わない。
