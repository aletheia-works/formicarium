# U6 recipe-runtime のコード生成の記録

表記：**検証済み**＝この作業でコマンドを実行して出力を確かめた。**ドキュメント根拠**＝記録・設定の読取り。**推測**＝確かめていない。実行していないものは**未検証**と書く。

## Step 1–3（2026-10-19、main session からの委任）

### 結論

- Step 1・Step 2 は完了した。
- **Step 3 は、候補1・候補2の両方が合格の基準を満たさなかった。** 計画（Step 3）と NFR Design S8 の決め方に従い、ここで止めて人間の判断を待つ。Step 4 以降は始めていない。候補は選んでいない（Step 3 の欄はチェックしない）。
  - 候補1：Chromium・Firefox・WebKit の全組で、package の Worker の起動が COEP で拒否された（検証済み）。
  - 候補2：Chromium・Firefox は全8組で合格（検証済み）。WebKit は (a) 初回の訪問で Worker・子 Worker の `crossOriginIsolated` が `false`（`SharedArrayBuffer` は使え、2端末は ready）、(b) 再訪問で page が分離されず 120秒で ready にならない（検証済み）。

### Step 1：構成と tool の確認

**vivarium の土台**（検証済み）

- `jj git fetch`：「Nothing changed.」。`main@upstream`・`main@origin`・`main` はどれも `71e0ef9202227626656047746d224278e1e51d5f`（fix(tools): record the mbx cache restore before the build and harden inputs (#536)）。
- `jj new 'main@upstream'` の後に `jj bookmark create u6-formicarium-recipe -r @`。change id `oqzmynozumqozzxvzvwxqvttpqtwkxsk`、commit `6d1334fd5a238929ed29442f48b5e1d8df6d6d9a`（空の change、説明なし）。push はしていない。
- 以前の空の作業 change `pqmnxwkk`（説明なし・空）は `jj new` で破棄された。

**tool の版**（検証済み：`mise ls --current`・`mise outdated`・`mise latest`・`npm view <pkg> dist-tags`・各 lockfile・`playwright-core/browsers.json`）

| tool | 使った版 | 最新版 | 状態 |
|---|---|---|---|
| Node（mise、vivarium `latest`） | 26.12.0 | 26.12.0 | 最新 |
| Bun（mise、vivarium `latest`） | 1.4.3 | 1.4.3 | 最新 |
| npm（`bun x npm@latest`） | 12.2.0 | 12.2.0 | 最新 |
| TypeScript（vivarium・formicarium の lock） | 7.0.2 | 7.0.2 | 最新。vivarium の `docs/bun.lock` に推移的な依存として 4.9.5 が別にある（読取りだけ。影響は未検証） |
| @playwright/test（lock） | 1.64.1 | 1.64.1 | 最新 |
| 同梱ブラウザ | Chromium 156.0.8078.4（rev 1248）、Firefox 157.0（rev 1555）、WebKit 27.2（rev 2370） | 1.64.1 の同梱版 | インストール済み（`~/Library/Caches/ms-playwright`） |
| Biome（lock） | 2.5.15 | 2.5.15 | 最新 |
| actionlint（mise） | 1.7.12 | 1.7.12 | 最新 |
| ShellCheck（mise） | 0.11.0 | 0.11.0 | 最新 |
| coi-serviceworker（npm） | 0.1.7 | 0.1.7 | 最新。`coi-serviceworker.js` の SHA256 `d12bd536e27e39a773d7dc7adb1a1167d24002293e97ac81c995fb00cf8d4d5a`（npm の tarball と、vivarium の旧 recipe `biome-12265` の写し（3496af3）で一致） |
| @aletheia-works/formicarium（npm） | — | latest 0.2.1、next 0.1.0-rc.1 | 0.3.0 は未公開（pin file を置かない。NFR3.4） |
| tombi・rumdl（mise、U6 では未使用） | 1.8.4・0.2.79 → 1.8.6・0.3.0 | 1.8.6・0.3.0 | 古かったので `mise upgrade tombi rumdl` で更新した |
| Rust（vivarium の `mise.toml` で 1.99.0 に固定） | 1.99.0 | 1.99.1 | vivarium 自身の固定（規則の例外）。U6 の Step 1–3 では使わない。報告だけ |
| emcc（formicarium の既存の `dist/blink`） | 6.0.10（build-info） | 未確認 | wasm は作り直していない（下記）。最新版かは**未検証** |

- 実行には mise の shim を使わず、`mise which` で解決した実体（`~/.local/share/mise/installs/{bun,node}/latest/bin`）を PATH の先頭に置いて実行した。

**配布候補の tarball**（検証済み）

- formicarium の作業 copy の親は `main` = `112e036ed3678c50bd2832019af2752458098cf3`。作業 copy の差分は `aidlc/` と `.aidlc-source-paths.json` だけで、製品の file は main と同じ（`jj diff --name-only`）。
- 手順は `.github/workflows/release-candidate.yml` の「Stage the current package version and build」「Pack and verify the staged private inventory」と同じ（公開用の `prepare-public` は使っていない）：

```bash
bun scripts/ci/tasks.ts build
node scripts/package/stage-package.js --out .artifacts/u6-recipe-runtime/private
bun x npm@latest pack ./.artifacts/u6-recipe-runtime/private --ignore-scripts --pack-destination .artifacts/u6-recipe-runtime
mv .artifacts/u6-recipe-runtime/aletheia-works-formicarium-0.2.1.tgz .artifacts/u6-recipe-runtime/private.tgz
node scripts/package/verify-package.js .artifacts/u6-recipe-runtime/private.manifest.json .artifacts/u6-recipe-runtime/private.tgz
```

- 結果：`.artifacts/u6-recipe-runtime/private.tgz`（33 file、262.2 kB）、**SHA256 `b65e88160ba4fac9067814097b72bf8912dcb1d64ad8debd15e601a43485bffd`**。`verify-package.js` は成功。`git check-ignore -v` で `.gitignore:114:.artifacts/` に一致。
- version は main の `package.json` のとおり `0.2.1`。npm に公開済みの 0.2.1 と同じ bytes かは**未検証**（比べていない）。
- wasm は既存の `dist/blink`（2026-10-09 の build、`blinkCommit` = `blink.lock` の `a882fb2f…`、`blinkSourceDirty: false`）を使った。`stage-package.js` の provenance の照合は通った。wasm の再 build はしていない。

**tar の読み方の選択（Step 6 用）**：Step 1 の時点では選んでいない。Step 6 で記録する。

### Step 2：試験の runner の確認（検証済み）

vivarium の root で、既存の試験を1つずつ実行した。

| command | 結果 |
|---|---|
| `bun test docs/scripts/__tests__/recipesIndex.test.ts` | 3 pass、0 fail |
| `bun test docs/scripts/__tests__/resolveReproFile.test.ts` | 17 pass、0 fail |
| `bun test tools/fixed-guest-builder/tests/bump.test.ts` | 8 pass、0 fail |
| `mise run ci:fixed-guest-builder`（typecheck と `bun test --coverage tests/`） | 158 pass、0 fail、行 coverage 98.43% |
| `mise run ci:docs-unit`（generate の後に `bun test scripts/__tests__`） | 141 pass、**1 fail** |
| `src/layer1_wasm` で `bun run sync-layer2-assets` の後に `bunx playwright test tests/repro.spec.ts --project=chromium --workers=1` | 11 passed（25.9s） |

- `unit-test-instructions.md` の command の形（repository の root からの `bun test <path>`、`src/layer1_wasm` での `bunx playwright test <spec> --project=<browser> --workers=1`）は今の main で動く。instructions は変えていない。
- **docs の unit の 1 fail**：`reproI18n.test.ts` の「every reproduction page ships a translation」が `src/layer1_wasm/biome-12265` を欠落として報告した。この dir には追跡されていない ignore 済みの旧 build の残骸（`index.html`・`index.ja.html`・`repro.js`・`repro.js.map`）だけがある（`git status --ignored`）。同じ理由で `mise run repro:i18n` も「biome-12265 has an index.html but no entry in recipes.json」で失敗した。計画では、この残骸は Step 16 で一覧を示して承認を受けてから消すので、消していない。**main の試験そのものの失敗ではなく、手元の残骸による**（推測ではなく、失敗の出力の対象が残骸の dir であることを確認済み。消した後に通るかは未検証）。

### Step 3：S8 の置き場の観測（NFR6.8）

**環境**（検証済み）：macOS 27.0.1（Darwin 27.0.0 arm64）、Playwright 1.64.1 の同梱ブラウザ、1 worker、retry 0。server は deployed-shape の `docs/scripts/serve-repro.ts`（port 8769。COOP・COEP の header を付けない）。実機 Safari は**未検証**。

**置いたもの**（観測の後にすべて消した）

- formicarium：`private.tgz` を展開した一組（version 0.2.1）と、手で書いた `assets.json`。候補1は `src/layer1_wasm/_formicarium/`、候補2は観測用の page の dir の `_formicarium/`。
- 旧題材の stand-in の ELF（U5 の保存済みの Release。置き場と Worker の起動の確認だけに使い、判定には使わない）：baseline `release-39076401324/downloaded`（ELF `3d7e7e8c…1aaf`、114,647,744 bytes）、fix `release-39079705708/downloaded`（ELF `882228d7…abdf`）。どちらも en の dir の `guests/<role>/` に1か所だけ。
- 観測用の page：`src/layer1_wasm/biome-u6-s8-probe/`（URL `/vivarium/repro/biome/u6-s8-probe/`、ja は `/vivarium/ja/repro/biome/u6-s8-probe/`、`<base>` は en の dir）。coi-serviceworker 0.1.7 を置いた。page は `validateGuest` → `createSession({ assets })` → `registerValidatedGuest` → `createCommandSession(...).execute('biome --version')` を baseline と fix の2端末で行う。
- Playwright の観測 script（`page.on('worker')` で各 Worker の `self.name`・`crossOriginIsolated`・`SharedArrayBuffer` を読む）。候補2の ja の `_formicarium/` を返すために、`serve-repro.ts` と同じで ja の `<project>/<issue>/_formicarium/` の下だけを広げた写しの server を使った（Step 11 の予定の変更。vivarium の `serve-repro.ts` は変えていない）。
- staging 中は `.git/info/exclude` に2つの path を一時的に足して jj の change に入らないようにし、観測の後に元へ戻した。page・script の写し（ELF と package を除く）は formicarium の `.artifacts/u6-recipe-runtime/s8-observation/`（追跡されない）に残した。

**観測の結果**（検証済み。初回＝新しい browser context。再訪問＝同じ context で `page.reload()`。goto から ready までの上限 120秒）

| ブラウザ | 候補 | lang | 訪問 | page COI・SAB | Worker COI・SAB | 子 Worker（em-pthread） | 2端末 ready | 時間 | console の error |
|---|---|---|---|---|---|---|---|---|---|
| Chromium 156.0.8078.4 | 1 | en | 初回 | true・true | 起動せず | 0 | 失敗（`EXECUTION Run failed`、Worker の error event） | 1.3s | なし |
| Chromium 156.0.8078.4 | 1 | en | 再訪問 | true・true | 起動せず | 0 | 失敗（同上） | 1.2s | なし |
| Chromium 156.0.8078.4 | 1 | ja | 初回 | true・true | 起動せず | 0 | 失敗（同上） | 1.3s | なし |
| Chromium 156.0.8078.4 | 1 | ja | 再訪問 | true・true | 起動せず | 0 | 失敗（同上） | 1.2s | なし |
| Firefox 157.0 | 1 | en・ja | 初回・再訪問（4組） | true・true | 読めず（評価が10秒で終わらない） | 0 | 失敗（`EXECUTION Run failed`） | 4.1–4.4s | なし |
| WebKit 27.2 | 1 | en・ja | 初回（2組） | true・true | 起動せず | 0 | 失敗（`EXECUTION Run failed`） | 1.8s | `Refused to load '…/_formicarium/0.2.1/runtime/web/package-worker.js' worker because of Cross-Origin-Embedder-Policy.`、`Worker load was blocked by Cross-Origin-Embedder-Policy` |
| WebKit 27.2 | 1 | en・ja | 再訪問（2組） | false・false（SW は制御中） | — | — | 120秒で ready にならない | 120s | なし |
| Chromium 156.0.8078.4 | 2 | en・ja | 初回・再訪問（4組） | true・true | true・true（観測できた2つ） | 30–31、すべて true・true | ready（両端末 exit 0、`Version: 0.0.0`） | 3.2–3.4s | なし |
| Firefox 157.0 | 2 | en・ja | 初回・再訪問（4組） | true・true | true・true（2つ） | 32、すべて true・true | ready（同上） | 9.0–9.6s | なし |
| WebKit 27.2 | 2 | en | 初回 | true・true | **false**・true（2つ） | 32、COI **false**・SAB true | ready（同上） | 4.0s | なし |
| WebKit 27.2 | 2 | ja | 初回 | true・true | **false**・true（2つ） | 31、COI **false**・SAB true | ready（同上） | 4.1s | なし |
| WebKit 27.2 | 2 | en・ja | 再訪問（2組） | **false・false**（SW は制御中） | — | — | 120秒で ready にならない | 120s | なし |

- 候補2の ja の page は、Worker の URL が ja の dir（`/vivarium/ja/repro/biome/u6-s8-probe/_formicarium/0.2.1/runtime/web/package-worker.js`）になった（検証済み）。
- run の後に終わった Worker は Playwright が評価できず（「has been closed」）、数に入れていない。評価できた Worker はすべて上の値。
- 診断（候補ではない、検証済み）：WebKit の候補2の再訪問を `page.goto` にしても、page は `crossOriginIsolated: false` のままだった。一方、server が本物の COOP・COEP・CORP の header を付けると（coi-serviceworker は登録されない）、WebKit でも Worker・子 Worker の `crossOriginIsolated` は true で、再訪問も ready になった（en の初回・再訪問）。したがって WebKit の失敗は置き場ではなく、coi-serviceworker で分離する方式と WebKit 27.2 の組合せによると読める（原因の詳細は**推測**）。
- Chromium・Firefox の候補1の失敗は、Worker の本体が page の service worker の scope の外にあり COEP の header が付かないという S8 の心配どおりと読める（WebKit は console にそのとおり出た。Chromium・Firefox の理由は console に出ず、**推測**）。

**計画の規則による判定**

- 候補1：6組のどれも基準を満たさない → 候補2を観測した。
- 候補2：Chromium・Firefox の en・ja × 初回・再訪問は基準を満たした。WebKit は en・ja の初回で Worker・子 Worker の `crossOriginIsolated === true` を満たさず、再訪問では page の分離と2端末の ready を満たさない。
- **両方とも失敗。計画どおり止める。** 予備の案（page の scope の中の小さな module Worker）は、人間の判断の後でなければ試さない（NFR Design review-02 の R-09）。なお上の診断から、予備の案も WebKit の coi-serviceworker の問題は解かないと推測される（未検証）。

### Step 3 の追加調査：WebKit（2026-10-19、人間の判断「A. Investigate further, then decide」による）

基準は緩めていない。候補は選んでいない。Step 4 は始めていない。調査は WebKit だけで行い、組合せの確認のために最後の1案だけ Chromium・Firefox でも流した。環境・server・stand-in の ELF・後片付けの方法は前の観測と同じ（staging は `.git/info/exclude` で jj の外に置き、終わった後に消して戻した）。server は、ja の `<project>/<issue>/_formicarium/`・`formicarium-worker.js`・`bundled-worker.js` だけを広げた観測用の写し（vivarium の `serve-repro.ts` は変えていない）。page・script の写しは `.artifacts/u6-recipe-runtime/s8-observation/` にある。

**coi-serviceworker 0.1.7 の source の読取り**（ドキュメント根拠：npm の 0.1.7 と同じ bytes の `coi-serviceworker.js`、SHA256 `d12bd536…4d5a`）

- page 側の既定値は `coepCredentialless: () => !(window.chrome || window.netscape)`。そのため Chromium・Firefox では false、WebKit では **true** になる。設定は page の `window.coi` で上書きできる。
- page が SW に制御されていると、page は毎回 `{ type: "coepCredentialless", value }` を SW へ送る。SW はその値を global 変数（初期値 false）に入れ、それ以降のすべての応答に `Cross-Origin-Embedder-Policy: credentialless`（true のとき。CORP は付けない）か、`require-corp` と `Cross-Origin-Resource-Policy: cross-origin`（false のとき）を付ける。
- page 側は `window.crossOriginIsolated !== false` なら何もしない。分離されていないときに、登録が active で controller が無い場合だけ再読込する。**controller があって分離されていない page では再読込しない**。
- `coepDegrade` という設定は 0.1.7 の source に無い。`register()` は script の URL だけで呼ばれ、`updateViaCache` などの option は渡していない。

**観測**（検証済み。WebKit 27.2、macOS 27.0.1 arm64。初回＝新しい context、再訪問＝同じ context で `page.reload()`）

| 案 | coi の設定 | lang | 訪問 | page COI・SAB | Worker COI・SAB | 子 Worker COI・SAB | 2端末 ready | console の error |
|---|---|---|---|---|---|---|---|---|
| 候補2（前の観測） | 既定（WebKit では credentialless） | en・ja | 初回 | true・true | false・true | false・true（31–32） | ready | なし |
| 候補2（前の観測） | 既定 | en・ja | 再訪問 | **false・false** | — | — | 120秒で ready にならない | なし |
| 候補2 | `coepCredentialless` を false に固定 | en・ja | 初回・再訪問（4組） | true・true | true・true | true・true（15–16） | **失敗**（`EXECUTION`） | `Refused to load '…/runtime/core.js' worker because of Cross-Origin-Embedder-Policy.`、`protocol.js`・`worker-execution.js` も同じ、`Cannot load …/runtime/core.js due to access control checks.`、`Importing a module script failed.` |
| 予備の案（page の dir の小さな module Worker が site の `_formicarium/` の package Worker を import） | false に固定 | en・ja | 初回・再訪問（4組） | true・true | true・true（観測できたもの） | true・true（観測できたもの） | **失敗**（`EXECUTION`） | `Refused to load '…/repro/_formicarium/0.2.1/runtime/web/package-worker.js' worker because of Cross-Origin-Embedder-Policy.` |
| 予備の案 | 既定 | en・ja | 初回 | true・true | false・true | false・true（32） | ready | なし |
| 予備の案 | 既定 | en・ja | 再訪問 | **false・false** | — | — | 120秒で ready にならない | なし |
| 実験：候補2の置き場で package Worker を1つの file にまとめる（下記） | false に固定 | en・ja | 初回・再訪問（4組） | true・true | true・true | true・true（30–32） | **ready**（両端末 exit 0、`Version: 0.0.0`、3.8–4.1s） | なし |

- 同じ実験（1つの file の Worker と false の固定）は、Chromium 156.0.8078.4 でも4組すべて合格（3.2–3.5s）、Firefox 157.0 でも4組すべて合格（9.2–10.8s）した（検証済み）。
- Playwright の `response.headers()` で、文書と Worker の script が受け取った header を見た（検証済み）。
  - 既定の設定で WebKit の候補2：初回の文書は SW 経由で `coep=require-corp`。その後の Worker の script と文書の再訪問は `coep=credentialless`。`core.js` は SW 経由（`credentialless`）が5回、SW を通らない取得（header なし）が4回あった。
  - false に固定すると、文書と Worker の script はすべて SW 経由の `coep=require-corp` になった。
- 実験の1つの file の Worker：`bun build _formicarium/0.2.1/runtime/web/package-worker.js --target browser --format esm --external 'node:*'` で作った（8 module、23.36 KB、SHA256 `c430ff6a…c314`）。静的な import と `import.meta` は無い（`node:*` の動的 import だけが残る）。観測用の生成物で、formicarium・vivarium の code にはしていない。

**読み取れること**

- (b) 既定の設定での WebKit の2つの失敗は、coi-serviceworker の既定（WebKit では `credentialless`）で説明できる。初回の文書は SW の変数が初期値（false）のうちに `require-corp` で返るので分離される。その後 page が true を送るので、Worker の script と再訪問の文書は `credentialless` で返り、WebKit 27.2 では分離されない。controller があるので再読込もされない（header は検証済み。WebKit が `credentialless` を分離の条件に数えないことは観測からの読みで、WebKit の source や bug report は読んでいない＝**推測**）。`coepCredentialless` を false に固定すると、page と Worker の分離・再訪問は直った（検証済み）。
- (c) SW が合成した `require-corp` の下でも、WebKit 27.2 は Worker と子 Worker を分離する（false の固定で `crossOriginIsolated === true`。検証済み）。残る問題は、Worker の module の import（`core.js`・`protocol.js`・`worker-execution.js`、予備の案では site の `package-worker.js`）が「access control checks」で拒否されること。header の記録で SW を通らない取得が見えたので、WebKit では Worker の import の一部が SW を通らず、CORP の無い server の応答になって COEP で拒否されると読める（**推測**。本物の header の対照では server が CORP を付けるので通る）。GitHub Pages は CORP を付けられない（NFR Design S8 の前提。ドキュメント根拠）。
- (a) 予備の案は、false の固定では site の `_formicarium/` の package Worker の import が COEP で拒否され、既定では候補2と同じ失敗だった。**予備の案は WebKit の問題を解かない**（検証済み）。
- hard reload：Playwright の WebKit には hard reload の API が無いので試していない（未検証）。`updateViaCache`：0.1.7 は option を渡さないので差を作れず、試していない（未検証）。原因は上の header の値で説明できるので、この2つは結果を変えないと推測する。
- Worker が import を持たない1つの file なら、WebKit でも Worker の取得が SW を通り、3ブラウザ × en・ja × 初回・再訪問のすべてで基準を満たした（検証済み。ただし観測用の bundle で、配布の形ではない）。

**推奨と得失**（判断は人間。ここでは選んでいない）

- 推奨：**候補2の置き場、`window.coi = { coepCredentialless: () => false }` で `require-corp` に固定、package Worker を import の無い1つの file にする**。この組合せは、今回の観測で唯一 3ブラウザ × en・ja × 初回・再訪問の24組すべてで基準を満たした。
  - 得：基準を緩めずに WebKit も合格する。Chromium・Firefox の挙動は変わらない（既定でも false。ドキュメント根拠：coi の source）。site・Pages の構成は変えない。
  - 失：package Worker の bundle をどこで作るかを決める必要がある。formicarium の npm package が1つの file の Worker を出す（formicarium の変更・新しい版。U6 の範囲の外で、0.3.0 の内容に影響する）か、vivarium の site build が bundle を作る（npm の固定 bytes をそのまま置くという照合（C11・NFR3.x）に、生成物の検証が増える。bun build の版にも依存する）かのどちらか。`coepCredentialless` の固定は coi-serviceworker が文書化している設定で、file は変えない（固定 digest のまま）。ただし `credentialless` の COEP は使わなくなり、cross-origin の no-cors の取得には CORP が要る（今の recipe はすべて same-origin）。候補2の得失（ja への一組の写し、約1.2MiB）はそのまま残る。
- 次の選択肢：WebKit を既知の制限として扱う。これは基準の変更なので、人間の判断になる。
- 採らない：予備の案（解かないことを確認した）、`coepCredentialless` の固定だけ（Worker の import が拒否される）。
- 実機 Safari は未検証。WebKit 27.2（Playwright の同梱）の結果である。

### Step 3 の配布物の bundle での観測のやり直し（2026-10-19、U2 の Code Generation の Step 29）

人間の回答（A：1つの file の Worker を formicarium の package に入れる）を受けて、U2 で `runtime/web/package-worker.bundle.js` を配布物に足し、browser API の既定の Worker にした（U2 の code-summary の「6回目の再開」）。その pack で、上の「実験」の行と同じ観測をやり直した。基準は緩めていない。候補は選んでいない（Step 3 の欄は U6 の作業でチェックする）。Step 4 は始めていない。

**入力**（検証済み）
- pack：U6 の Step 1 と同じ手順で作った `.artifacts/u6-recipe-runtime/private-bundle.tgz`（version 0.2.1、34 file、267,868 bytes、SHA256 `72172c2887057468e6dbd2bf7213ee6b2983de4361378147849bdc6f234bbe1b`、`verify-package.js` 成功）。前の `private/`・`private.tgz` は残した。中の `runtime/web/package-worker.bundle.js` は SHA256 `8cc5f46890d469bd8516ffbf9dd3f81bde91c38bb00f97e79d2c70c15772ee98`（formicarium の build の出力と同じ）。
- 置き場：候補2（観測用の page の dir の `_formicarium/`）。`assets.json` の `entries.worker` を `runtime/web/package-worker.bundle.js` にした（手で書いたもの。AssetStager の出力ではない）。page は `?candidate=2&cred=0`（`window.coi = { coepCredentialless: () => false }`）。coi-serviceworker 0.1.7（SHA256 `d12bd536…4d5a`、vivarium の 3496af3 の写しと同じ bytes）。
- stand-in の ELF・page・script・server の写しは前と同じ（formicarium の `.artifacts/u6-recipe-runtime/s8-observation-bundle/` に、新しい `assets.json` と coi-serviceworker を加えた写しを残した）。環境も前と同じ（macOS 27.0.1 arm64、Playwright 1.64.1 の同梱ブラウザ、1 worker、retry 0、各訪問の上限 120秒）。

**結果**（検証済み。初回＝新しい context、再訪問＝同じ context で `page.reload()`）

| ブラウザ | lang | 訪問 | page COI・SAB | Worker（bundle）COI・SAB | 子 Worker（em-pthread） | 2端末 ready | 時間 | console の error |
|---|---|---|---|---|---|---|---|---|
| Chromium 156.0.8078.4 | en | 初回 | true・true | true・true（観測できた2つ） | 31、すべて true・true | ready（両端末 exit 0、`Version: 0.0.0`） | 3.5s | なし |
| Chromium 156.0.8078.4 | en | 再訪問 | true・true | true・true（2つ） | 30、すべて true・true | ready | 3.2s | なし |
| Chromium 156.0.8078.4 | ja | 初回 | true・true | true・true（2つ） | 30、すべて true・true | ready | 3.2s | なし |
| Chromium 156.0.8078.4 | ja | 再訪問 | true・true | true・true（2つ） | 31、すべて true・true | ready | 2.9s | なし |
| Firefox 157.0 | en | 初回 | true・true | true・true（2つ） | 32、すべて true・true | ready | 9.4s | なし |
| Firefox 157.0 | en | 再訪問 | true・true | true・true（2つ） | 32、すべて true・true | ready | 9.3s | なし |
| Firefox 157.0 | ja | 初回 | true・true | true・true（2つ） | 32、すべて true・true | ready | 9.1s | なし |
| Firefox 157.0 | ja | 再訪問 | true・true | true・true（2つ） | 32、すべて true・true | ready | 9.0s | なし |
| WebKit 27.2 | en | 初回 | true・true | true・true（2つ） | 30、すべて true・true | ready | 3.7s | なし |
| WebKit 27.2 | en | 再訪問 | true・true | true・true（2つ） | 32、すべて true・true | ready | 4.3s | なし |
| WebKit 27.2 | ja | 初回 | true・true | true・true（2つ） | 30、すべて true・true | ready | 3.8s | なし |
| WebKit 27.2 | ja | 再訪問 | true・true | true・true（2つ） | 32、すべて true・true | ready | 3.4s | なし |

- Worker の URL は、en が `/vivarium/repro/biome/u6-s8-probe/_formicarium/0.2.1/runtime/web/package-worker.bundle.js`、ja が `/vivarium/ja/repro/biome/u6-s8-probe/_formicarium/0.2.1/runtime/web/package-worker.bundle.js`。page の service worker は、どの訪問でも制御中だった。
- 観測の spec（`s8.spec.ts`）の判定はすべて通った：Chromium・Firefox・WebKit で各2 passed（en・ja。各 test が初回と再訪問を含む）。run の後に終わった Worker（「has been closed」）は、前と同じく数に入れていない。
- **12の訪問（3ブラウザ × en・ja × 初回・再訪問）、2端末ずつで24の ready のすべてで、基準（page・Worker・子 Worker の `crossOriginIsolated === true` と SAB、2端末の ready）を満たした。** 上の「実験」（観測用の bundle）と同じ結果が、配布物の bundle で得られた。
- 実機 Safari は未検証。

**後片付け**（検証済み）：vivarium の `src/layer1_wasm/biome-u6-s8-probe/`・`src/layer1_wasm/.scratch/`（この観測で作った）を消し、`.git/info/exclude` を元に戻した（SHA256 `03f34bb1…a32d` が前と同じ）。`jj status` は「The working copy has no changes.」、`@` は `oqzmynoz 6d1334fd u6-formicarium-recipe*（empty）`のまま。

### 旧題材の残骸の削除の後の docs の unit（検証済み）

人間が vivarium の `src/layer1_wasm/biome-12265/` を消した後に、`mise run ci:docs-unit` を1回実行した。**142 pass、0 fail**（306 expect、9 file）。前の1件の失敗（reproI18n）は無くなった。

### 人間の判断が要ること

1. **S8 の置き場（Step 3 の停止）**：候補2は Chromium・Firefox で動き、WebKit でも初回は2端末が実際に動く（SAB 使用可、`--version` exit 0）が、Worker の `crossOriginIsolated` が false で、再訪問では page が分離されない。候補2で進めて WebKit の扱い（基準・既知の制限・別の分離方式）を決めるか、予備の案や別の方式を検討するかの判断が要る。基準を緩める判断は人間が行う（ここでは緩めていない）。
2. ~~旧題材の残骸~~：2026-10-19 に人間が消した。その後の `mise run ci:docs-unit` は 142 pass・0 fail（上の節）。
3. **WebKit の調査の後の置き場と分離の方式**：上の「推奨と得失」を見て判断してほしい（bundle を formicarium と vivarium のどちらで作るか、または WebKit を既知の制限として扱うか）。

### 後片付け（検証済み）

- vivarium：`jj status` は「The working copy has no changes.」、`@` は `oqzmynoz 6d1334fd u6-formicarium-recipe*（empty）`。staging の ELF・tarball・観測の page・script・test-results の観測分は消した。`.git/info/exclude` は元に戻した。root の `.scratch/`（ignore 済み）は空の dir が残っている（観測の前から有ったかは未確認）。
- formicarium：製品の code・既存の試験・U1–U5/U7 の証拠は変えていない。足したのは `.artifacts/u6-recipe-runtime/`（追跡されない）と、この file だけ。

## Step 3（チェック）〜 Step 9（2026-10-19、main session からの委任）

### 土台（検証済み）

- `jj -R ~/Documents/vivarium git fetch`：「Nothing changed.」。`main@upstream` は `71e0ef92` のままで、rebase はしていない。
- 作業は bookmark `u6-formicarium-recipe` の change `oqzmynoz`（1つの作業 change）。最後の commit id は `fa5409067420bff15684b6088bb3bd21fa65f065`、説明は `feat(layer1): add formicarium recipe guests, the asset stager and the bracket-spacing verdict`。push・PR・workflow の起動はしていない。
- tool：`mise latest` で Bun 1.4.3・Node 26.12.0 が最新（検証済み）。実行は `~/.local/share/mise/installs/{bun,node}/latest/bin` を PATH の先頭に置き、宣言された task は `mise run` で実行した。**例外**：Step 4・5 の最初の Biome の整形2回（`bunx --bun biome check --write`）は PATH を付けずに実行し、mise の shim の bun（同じ 1.4.3 の実体）を通った。結果の bytes は変わらないと推測するが、規則から外れたことを記録する。
- 手順の逸脱（記録）：`generate-recipes-index.ts` の `function validateAccepted` に `export` を付けるのに `sed -i` を1回使った。coi-serviceworker の試験用の写しは bytes を保つために `mkdir -p` と `cp` で置いた（下の Step 7）。どちらも内容は SHA256 で確かめた。

### Step 3：チェックだけ

- 観測の結果は上の「Step 3 の配布物の bundle での観測のやり直し」と計画の新しい節のとおり。候補2（各 page の dir の `_formicarium/`）で進める。

### Step 4：Data model の実装（検証済み）

- `docs/site/public/spec/recipe.schema.json` に任意 field `guests` を足した（1〜2件。`role`（baseline・fix）・`tool`・`repository`（小文字の正規 URL の pattern）・`commit`（40桁）・`fixture`・`reference`（branch・pr）・`accepted`（commit・versionOrName・buildKey・elfSha256・buildInfoSha256 の5つが全部必須、追加の field は不可））。説明に「2026-10-19 revision」と書いた。`expected_runtime` の説明の terrarium・formicarium の変更は Step 16（BR6.2）で行う。
- `docs/scripts/generate-recipes-index.ts`：
  - `validateRecipeGuests`：`expected_runtime: formicarium` で guests の欠落・空、`fix_candidate` を拒否（BR1.1・BR1.8）。role の重複・未知の role・baseline の欠落を拒否（BR1.2）。tool・repository・commit・fixture・reference は fixed-guest-builder の `validateDeclaration` と `tools/fixed-guest-builder/allowlist.json` で検査し、書いた URL が正規形と完全に一致することも求める（BR1.3）。一部だけの `accepted`、形の違う digest、未知の field を拒否（BR1.4）。formicarium 以外の recipe に guests があれば拒否する（推測で足した規則：無視されるより失敗が分かりやすいため）。
  - `recipeState`：全 guest に accepted があり pin file（`src/layer1_wasm/formicarium.pin.json`）があれば active、無ければ pending（理由 `accepted-missing`・`pin-missing`）（BR1.7）。
  - `main`：pending の recipe は `recipes.json` に入れず、stderr に `PENDING: ... (理由)` を出す。宣言の誤りは index 生成を失敗させる（slug と field を出す）。`main` は `import.meta.main` のときだけ動くようにした（試験と AssetStager が import するため。他の generate-* と同じ形）。
- 設計の読み：BR1.7 の「index生成の出力に記録」は stderr の出力と読み、公開の `recipes.json`（Recipes index v1）には新しい field を足していない（推測を含む判断。site と回帰試験から外す方法は、index に入れないこと）。

### Step 5：Data model の試験（検証済み）

| command（vivarium の root） | 結果 |
|---|---|
| `bun test docs/scripts/__tests__/recipesIndex.test.ts` | 15 pass、0 fail（81 expect） |
| `mise run ci:docs-unit`（Step 5 の後） | 154 pass、0 fail |

- 足した場合：baseline と fix の受理と pending の理由、active の条件（pin なし・1つだけ accepted）、guests の欠落・空と `fix_candidate`、role の重複・baseline の欠落・未知の role、正規でない URL（大文字・`.git`・http・userinfo・gitlab）と allowlist 外、40桁でない commit（39桁・大文字・`main`・欠落）、一部だけの accepted・不正な buildKey・未知の field、他の runtime の recipe が従来どおり通ることと guests の拒否、tree のすべての recipe.json が通ること、一時の dir での `readFormicariumRecipe`、schema（ajv）の受理と拒否。

### Step 6：Repository / data access の実装（検証済み）

- `docs/scripts/coi-serviceworker-pin.ts`：版 `0.1.7`、SHA256 `d12bd536…4d5a`、`coiServiceWorkerProblem`・`findCoiServiceWorkerProblems`（写しがある dir と、formicarium の recipe（pending を含む）を検査）。
- `docs/scripts/stage-formicarium-assets.ts`（AssetStager）：
  - mode：`--mode pin`（`src/layer1_wasm/formicarium.pin.json` と公開の URL だけ。`--tarball`・`--expect`・`--layer1` を渡すと拒否）、`--mode local --tarball <tgz> --expect <json> [--layer1 <dir>]`（期待値の JSON に pin と、recipe・role ごとの guest の dir と accepted を書く。dir は JSON の場所からの相対）、`--mode check-site [--site <dir>]`（site の合計 1GiB 以下、すべての coi-serviceworker.js の digest、各 `_formicarium/assets.json` の file の存在と SHA256 と notices。ja の写しも同じ規則で照合する）。`docs/doc_build` の中へは書かない（拒否）。
  - pin の検証：field の完全一致、package 名、semver、SHA256・40桁、file 一覧の path 規則・path 順・重複なし・4096件以下、必須の file（`runtime/web/api.js`・`runtime/web/package-worker.bundle.js`・`assets/blink.mjs`・`assets/blink.wasm`・`assets/build-info.json`・`LICENSE`・`THIRD_PARTY_NOTICES.md`）。pin が無ければ formicarium の recipe はすべて pending で、取得はしない。
  - 取得：fixed-guest-builder の `fetchLimited` を使う（`credentials: 'omit'`、`redirect: 'manual'`、最大5 hop、各 hop の HTTPS・userinfo なし・loop 拒否、stream の累積で上限、最終 URL、retry なし）。header は付けない。環境変数は `GITHUB_STEP_SUMMARY` だけを読む（token は読まない）。各取得に `AbortSignal.timeout(120000)`、全体に `STAGE_DEADLINE_MS = 360000` をかけ、code に「C11 の上限ではない運用上の上限で、上げるには計測の review が要る」と注記した。失敗は `ASSET_LOAD`・`TIMEOUT`・`LIMIT_EXCEEDED`・`VERIFY_FAILED`・`INVALID_INPUT` で URL と原因を付ける。
  - 上限：tarball 128MiB、展開の合計 256MiB、entry 4096、path 4096 bytes、ELF 128MiB、build-info 1MiB、catalog 4MiB（境界値を許し +1 で失敗、累積は safe integer で確認）。
  - guest：tag `guest-<tool>-<accepted.buildKey>` の Release（`aletheia-works/vivarium`）から build-info・catalog・ELF（名前は `tools/fixed-guest-builder/tools.json` の binary）を取り、builder の `verifyArtifactSet`（buildKey の再計算、正規形、catalog の一致、tool・repository は guest、commit・buildKey は accepted）と、accepted の ELF・build-info の SHA256・versionOrName を照合する。active の recipe の coi-serviceworker.js も照合する。
  - formicarium の build-info：`assets/build-info.json` の `assetDigests`（loader・wasm）が tarball の blink.mjs・blink.wasm と一致することも確かめる（計画の「build-info の identity の照合」を guest と formicarium の両方と読んだ。formicarium 側は推測を含む解釈）。
  - 出力（候補2）：各 active の recipe の dir に `_formicarium/assets.json`（版を含まない固定の path。version・tarballSha256・sourceCommit・entries・files の各 SHA256）と `_formicarium/<version>/…`（`runtime/`（`runtime/node/` を除く）・`assets/`・`LICENSE`・`THIRD_PARTY_NOTICES.md`）、`guests/<role>/{biome,build-info.json,catalog.json}`。すべてを照合してから書く。書く前に、formicarium の recipe（pending を含む）の `_formicarium/` と `guests/` を消す。
  - job summary：`GITHUB_STEP_SUMMARY` があれば、item・最終 URL・bytes・SHA256・ms の表と staged・pending・失敗を追記する。
- **tar の読み方の選択：第一者の小さな実装（`readNpmTarball`）**。理由：(1) docs の依存に tar の library は無く（`docs/package.json` は jszip だけ。検証済み）、site の入力を守る step に新しい依存（供給網の面）を足さずに済む。(2) 要件は「disk へ直接展開せず、選んだ entry 以外も含めてすべての entry を先に検査する」ことで、npm の tarball は ustar と pax の通常の file だけなので、gunzip（`node:zlib`、出力の上限付き）の後に約100行で header の checksum・ustar の magic・型（通常の file と pax header だけ。symlink・hardlink・directory・device・FIFO・global pax・GNU long name を拒否）・path（`package/` の下、`..`・`.`・空の segment・絶対 path・NUL・backslash を拒否）・重複・entry 数・展開量・終端の後の data を検査できる。(3) library の API は entry を skip・展開する形が多く、全 entry の拒否を自分で確かめる必要がある（推測。具体の library の版は確かめていない＝未検証）。
- **`local` mode の実際の実行**（検証済み）：U6 の tarball（`private-bundle.tgz`、SHA256 `72172c28…be1b`）と U5 の保存済みの stand-in の Release（baseline `release-39076401324/downloaded`、fix `release-39079705708/downloaded`）を、formicarium の `.artifacts/u6-recipe-runtime/stage-check/`（追跡されない）に置いた試験用の recipe と期待値で staging した。

```bash
bun docs/scripts/stage-formicarium-assets.ts --mode local --tarball /Users/mutoakio/Documents/formicarium/.artifacts/u6-recipe-runtime/private-bundle.tgz --expect /Users/mutoakio/Documents/formicarium/.artifacts/u6-recipe-runtime/stage-check/expect.json --layer1 /Users/mutoakio/Documents/formicarium/.artifacts/u6-recipe-runtime/stage-check/layer1
bun docs/scripts/stage-formicarium-assets.ts --mode check-site --site /Users/mutoakio/Documents/formicarium/.artifacts/u6-recipe-runtime/stage-check/layer1
bun docs/scripts/stage-formicarium-assets.ts --mode pin
```

  - 結果：staged 230,113,882 bytes（ELF 114,647,744 と 114,662,736、各 digest は accepted と一致）、全体 0.49 秒で終了（timer が process を残さない）。`_formicarium/0.2.1/` に 27 file（`runtime/node/`・`types/`・`README.md`・`package.json` は置かない）、`entries.worker` は `0.2.1/runtime/web/package-worker.bundle.js`、`runtime/web/` は tarball の中身と `diff -r` で一致。`check-site` は「230119220 bytes, 1 coi-serviceworker copies, 1 formicarium bundles」。今の vivarium の tree での `--mode pin` は pin も formicarium の recipe も無いので何もせず exit 0。staging した ELF の写しはその後に消した（入力の recipe.json・expect.json・coi の写しは残した）。
  - pin の代わりの期待値の `sourceCommit` は formicarium の `main` の `112e036e…`（tarball を作った作業 copy の親）。0.3.0 の公開版の tag の commit ではない。

### Step 7：Repository / data access の試験（検証済み）

| command（vivarium の root） | 結果 |
|---|---|
| `bun test docs/scripts/__tests__/stageFormicariumAssets.test.ts docs/scripts/__tests__/coiServiceWorkerPin.test.ts` | 26 pass、0 fail（172 expect） |
| 同じ file と recipesIndex に `--coverage` | 行 coverage：`stage-formicarium-assets.ts` 92.87%（未実行は CLI の `main` だけ）、`coi-serviceworker-pin.ts` 97.37%、`generate-recipes-index.ts` 43.10%（未実行の大半は既存の index 生成の部分）。分母の確定は Step 15 |
| `mise run ci:docs-unit`（Step 9 の後に1回） | 180 pass、0 fail（11 file） |
| `mise run docs:check` | 0 error（既存の「schema の版が CLI の版と違う」の info 1件だけ） |

- fetch・時計（`timeoutSignal`・`now`）・書込み先（`layer1Dir`・`pinPath`・`summaryPath`）を注入した。網には出ない。改変した tarball・ELF は試験の中で一時の dir に作り、終わったら消す。
- 試験の場合：既定の上限が C11 の値であること、ustar の name・prefix・pax の path、`..`・`package//…`（絶対）・`package/` の外・symlink・hardlink・directory・FIFO・global pax・pax の linkpath・重複の拒否、entry 数・展開量・path の境界値と +1（小さい上限の注入に加え、実際の上限 4096・4097 entry）、gzip bomb・checksum の破損・終端の後の data・gzip でない入力、pin の形の誤り、file の改変・一覧に無い entry・一覧にあって無い file・古い build-info・空の notices、`local` mode の書込み先（recipe の dir だけ、前回の残りを消す、`runtime/node/`・README を置かない、`docs/doc_build` を拒否）、pin と違う tarball で何も書かないこと、accepted の無い recipe の pending、coi の写しの欠落と1 byte の変更、`GITHUB_TOKEN`・`NPM_TOKEN` を置いても request に付かないこと（credentials・redirect・header を検査）と最終 URL の記録、pin の無いときに取得しないこと、5 hop の成功と6 hop・HTTP・userinfo・loop の拒否、404・429・offline（1回だけ取得、retry なし）、各取得の deadline と6分の上限の TIMEOUT（要求した時間が 360000 と 120000 であること）、build-info 1MiB の境界と +1、別の tag の build-info・repository を変えて accepted を残した宣言・改変した ELF、`check-site` の en と ja の bundle の照合と改変・欠落・coi の不一致。
- 試験用の coi-serviceworker 0.1.7 の写しを `docs/scripts/__tests__/fixtures/coi-serviceworker.js` に置いた（SHA256 `d12bd536…4d5a`、file 先頭の MIT の注記を保つ）。今の tree には追跡された写しが無く、正しい写しを1 byte 変える試験と active の recipe の試験に要るため。第三者の file を整形しないように `docs/biome.json` の includes に `!**/scripts/__tests__/fixtures` を足した。Step 13 で recipe の写しが入った後も、試験は recipe に依存しないこの写しを使う。

### Step 8：Business logic の実装（検証済み）

- `src/layer1_wasm/biome-migrate-override-bracket-spacing/verdict.ts`（DOM・formicarium に依存しない。`_shared/verdict.js` から型だけを import）：`COMMANDS`（4つ）、`stripAnsi`、`parseJsonOutput`、`readOverrideBracketSpacing`（`includes` が `["*.js"]` の override の `formatter.bracketSpacing`、無ければ `javascript.formatter.bracketSpacing`、どちらかが false なら corrected。該当の override が無ければ失敗）、`runSession`（`.prettierrc` が fixture と同じ、`biome.json` が `{}`、各 exit が 0、の事前確認）、`settle`・`decide`（verdict は baseline だけ。失敗は `baseline_error`・`fix_error` で判定ではない。baseline が corrected なら unreproduced と `baseline_corrected: true`）、`canonicalJson`（key の辞書順、safe integer だけ、孤立 surrogate の拒否）、`fixtureSha256`（`{path, sha256}` を path 順の正規化 JSON にした SHA256、path の重複を拒否）、`commandSha256`、`buildEnvelope`（Result v1。runtime.name `formicarium`、extras に fixture_sha256・baseline と fix の commit と buildKey・pack_sha256）。
- `src/layer1_wasm/tsconfig.json` の exclude に `**/*.test.ts` を足した（bun test の file は `bun:test` を import するので、Layer 1 の tsc の build には入れない）。
- `mise run repro:typecheck`：成功（exit 0）。Layer 1 には Biome の設定が無いので、新しい file は docs の設定（`biome check --config-path docs`）で整形した。残りは bracket の key の info だけ（`_shared/verdict.ts` と同じ書き方）。
- override の `includes` を `["*.js"]` と完全一致で読むのは設計（BR4.3）のとおり。実際の Biome の migrate が `**/*.js` などに変えて出すかは**未検証**で、Step 17 で新しい ELF の出力で確かめる。

### Step 9：Business logic の試験（検証済み）

| command（vivarium の root） | 結果 |
|---|---|
| `bun test src/layer1_wasm/biome-migrate-override-bracket-spacing/verdict.test.ts` | 12 pass、0 fail（42 expect）。`--coverage` で `verdict.ts` の行 coverage 99.52% |

- 場合：2か所それぞれの corrected と、override はあるが option が無い reproduced、override の欠落（`**/*.js`・配列でない設定を含む）、command の順、ANSI と CRLF の除去、事前確認の不一致（`.prettierrc`・空でない `biome.json`）、migrate の非0、JSON の解析失敗、baseline だけで決まる verdict と fix の pane の状態、baseline が corrected のときの記録、失敗が判定にならないこと、同じ入力で同じ fixture の digest（順序に依らない、規則どおりの値）、command の digest の順序、正規化の拒否、Result v1 の extras。
- unit-test-instructions の2つ目の file（`src/layer1_wasm/_shared/_test/formicarium_terminal.test.ts`）は Step 14 で作るので、今回は1つ目だけを実行した。file の名前はすべて計画のとおりで、command の読み替えは無い。

### 人間の判断・確認が要ること

1. **Step 13 までの途中の状態**（検証済み）：recipe の dir `src/layer1_wasm/biome-migrate-override-bracket-spacing/` に今は `verdict.ts`・`verdict.test.ts` だけがあり、`recipe.json` が無い。そのため index を作り直すと、この dir が `language: unknown`・`expected_runtime` なしの recipe として `recipes.json` に入る（`bun run generate-index` で確認し、追跡されている `recipes.json`・`projects.json` は `jj restore` で main に戻した）。この状態で Layer 1 の Playwright（`repro.spec.ts` など）を動かすと、`expected_runtime` の検査で読込みの時点で失敗するはず（code の読取りによる。実行していない＝未検証）。Step 13 で `expected_runtime: formicarium` の recipe.json（accepted なし）を置けば pending になり index から外れる。この change を Step 13 の前に push・review に出さないこと。
2. **pending の recipe の page 生成**（推測）：`generate-repro-pages.ts` は `page.en.html` のある dir に `recipes.json` の entry を求め、`generate-repro-i18n.ts` も `index.html` のある dir に entry を求める。pending の recipe は index に入らないので、Step 13 で page を置くと、この2つが pending の recipe を飛ばすように直す必要がある（`readFormicariumRecipe` を import する形を想定）。計画の Step 11・13・16 の範囲で扱う見込み。
3. **`.gitignore` の path**（ドキュメント根拠）：計画の Step 11 の文は候補1の `src/layer1_wasm/_formicarium/` だが、候補2の出力は各 recipe の `src/layer1_wasm/<slug>/_formicarium/` と `guests/` になる。Step 11 では候補2に合わせた ignore の path（例 `src/layer1_wasm/*/_formicarium/`）が要る。今は ignore されていないので、`local` mode を vivarium の tree の中で動かすと staging（約219MiB）が jj の change に入る。Step 11 の前は `--layer1` で tree の外へ書くこと。
4. 計画の Step 1・Step 2 の欄は、code-summary では完了と記録されているが、計画の file ではチェックされていない。今回の指示は Step 3 からだったので触れていない。（その後 main session がチェックした。）

## Step 10 〜 Step 16（2026-10-19、main session からの2回目の委任）

### 土台と手順（検証済み）

- `jj git fetch`：「Nothing changed.」。`main@upstream` は `71e0ef92` のままで rebase は不要。作業は同じ change `oqzmynoz`（最後の commit id `22f6e19f`、説明 `feat(layer1): run the first formicarium recipe and retire terrarium`）。push・PR・GitHub への書込み・workflow の起動・Release の操作はしていない。
- tool は mise の実体の path（`~/.local/share/mise/installs/{bun,node,jq,shellcheck,uv}/latest/…`）か `mise run` で呼んだ。shim・`mise exec`・`sed -i`・shell の `mkdir`/`cp` は使っていない（試験・workflow・bundle script の中の `mkdir`/`cp` は製品の code）。coi-serviceworker.js の recipe の写しは file tool で書き、SHA256 `d12bd536…4d5a` が一致した。
- 範囲の逸脱と戻し（検証済み）：Step 14 で Biome の整形を `src/layer1_wasm/_shared` の dir 全体に向けてしまい、既存の 12 file（loader.ts・path_a.ts・style.css・terrarium_loader.ts など）が整形された。`jj restore` で12 file を main に戻し、意図した3 file だけが残ったことを `jj status` で確かめた。
- 注意（検証済み）：Step 12 の最初の `layer1Bundle` の実行では PATH に存在しない jq の path を足していたため、`jq` は PATH の後ろの mise の shim か `/usr/bin/jq` で解決された。その後の判定に使った実行は `mise run ci:docs-unit`（mise の実体の jq）である。

### Step 10：上流の bump の role 対応（検証済み）

- `tools/fixed-guest-builder/src/bump.ts`：`bumpGuest({ role })` で role（baseline・fix）の guest を1件だけ選ぶ。未知の role・role の欠落・重複を `INVALID_INPUT` で拒否。`commit` だけを動かし、`accepted` は消さない（以前の `elfSha256`・`buildInfoSha256` の削除をやめた）。record に `role` を足した。`cli.ts` は `--role`。
- `.github/workflows/fixed-guest-bump.yml`：入力を `recipe` と `role`（`choice`：baseline・fix）にし、branch を `fixed-guest-bump/<recipe の dir 名>-<role>`、title・run-name を role にした。権限・起動条件は変えていない。build の role 対応は U5 の dispatch の入力のままで変えていない。README を直した。
- `bun test tools/fixed-guest-builder/tests/bump.test.ts`：9 pass・0 fail（role の選択と accepted の保持、fork の repository、先頭のときの無変更、PR だけの拒否、role・allowlist の拒否）。`mise run ci:fixed-guest-builder`：160 pass・0 fail、行 coverage 98.43%（`bump.ts` 100%）。出力の「error: could not compile」は既存の build 失敗の試験の想定出力。`mise run fixed-guest-builder:check`：0 error。workflow の試験（`tests/workflows.test.ts`）に role の入力・branch・title の検査を足した。

### Step 11：API / endpoint の実装（検証済み）

- `.gitignore`：`src/layer1_wasm/*/_formicarium/` と `src/layer1_wasm/*/guests/`（候補2の実際の出力の path）。
- `scripts/bundle-layer1-pages.sh`：index に無い formicarium の recipe（pending）は飛ばす。ja の dir には page・coi-serviceworker.js に加えて recipe の `_formicarium/` を写す。ELF（`guests/`）は en の dir だけ。
- `docs/scripts/serve-repro.ts`：ja の側で各 recipe の dir の `_formicarium/` の下だけを返す。`servedByPages` を export し、server の起動を `import.meta.main` の中へ移した。`repro-dev-middleware.ts` は候補2でも変更不要（ja の `_formicarium/` は en の src の同じ file に解決される。試験で確認）。
- pending の recipe の扱い（前回の項目2）：`generate-recipes-index.ts` に `pendingRecipeEntries()` を足し、`generate-repro-pages.ts` と `generate-repro-i18n.ts` は pending の recipe にも手元の page を作る（Step 14 の `local` mode の試験のため）。site と回帰試験から外すのは、index に入れないことと bundle が飛ばすことで行う。

### Step 12：API / endpoint の試験（検証済み）

| command | 結果 |
|---|---|
| `bun test docs/scripts/__tests__/resolveReproFile.test.ts docs/scripts/__tests__/layer1Bundle.test.ts` | 27 pass・0 fail |

- `layer1Bundle.test.ts`（新規）：`git check-ignore --no-index` で `_formicarium/`・`guests/` の4 path が ignore され、recipe.json・coi-serviceworker.js・fixture は ignore されないこと。ja の `_formicarium/` が返り、recipe.json・repro.js・guests・fixture・他の recipe の `_formicarium` は 404 のままであること。一時の dir での bundle の後、en に staging 一式、ja に page・SW・`_formicarium` だけ、ELF が en に1か所ずつ、pending の recipe が載らないこと。
- 最初の実行で1件失敗した：`/ja/…/_formicarium/`（末尾が `/`）を 404 と期待したが、既存の「`/` で終わる path は返す」規則（変えていない）で返る。私の試験の期待の誤りなので、その1つの case を外した。

### Step 13：Frontend behavior の実装（検証済み）

- 共有 module（DOM に依存しない）`src/layer1_wasm/_shared/formicarium_terminal.ts`：使う API だけの型、`waitForIsolation`（15秒）、`loadFormicarium`（page の URL（`location.href`）の `_formicarium/assets.json` から URL を作り `import()`。相対 path 以外を拒否）、`fixtureEntries`、`fetchBytes`（`credentials: 'omit'`、stream の累積で上限、進捗の unknown と 0）、`TranscriptBuffer`（1048576 bytes・10000 行で先頭を UTF-8 の境界で捨てる）、`TerminalController`（build-info の tool・repository・commit・buildKey を accepted と照合 → `validateGuest` → `createSession` → `registerValidatedGuest` → command session、run の逐次化、入力の無効化、取消と古い応答の破棄、P2 の印）。
- custom element は `formicarium_terminal_element.ts` に分けた（`textContent` だけで表示、keyboard の form、要素が外れたら dispose）。理由は下の coverage の節。
- recipe の dir：`recipe.json`（pending。baseline `ef61338b24b7125fbc3cb3d4792ec90fa005a86e`、fix `25e3e2c2d97c5e1780d10833c9f63fc6dce0f8a9`、fixture `biome-migrate-prettier-override`）、`README.md`、`page.en.html`、`i18n.ja.json`、`repro.ts`、`fixture/.prettierrc`・`fixture/biome.json`、`coi-serviceworker.js`。
- **baseline の commit の解決**（検証済み）：`git ls-remote https://github.com/biomejs/biome refs/heads/main`（2026-10-18T20:24:02Z、git 2.54.0。読取りだけ）→ `ef61338b24b7125fbc3cb3d4792ec90fa005a86e	refs/heads/main`。
- **fix の branch の先頭が動いていた**（検証済み）：`git ls-remote https://github.com/JamBalaya56562/biome refs/heads/fix/migrate-prettier-override-bracket-spacing` → `a5bd0ce883a22980be20dfc87ba62006a43c3de8`。`gh api repos/JamBalaya56562/biome/compare/25e3e2c2…a5bd0ce8`（読取り）では a5bd0ce8 は 25e3e2c2 より 104 commit 先・1 commit 後ろで、branch が新しい main の上に rebase されたと読める（推測）。25e3e2c2 は repository の中にまだある。計画どおり fix は `25e3e2c2…` にした。
- runtime の shell（`generate-repro-pages.ts`）：`formicarium` は `<script>window.coi = { coepCredentialless: () => false };</script>` を coi-serviceworker.js の前に置く（en・ja の生成物の両方で確認）。preload なし。`page-templates.ts` の terminal の runtime を formicarium にした。
- formicarium の Worker は `assets.json` の既定の Worker（`runtime/web/package-worker.bundle.js`）を `assets` で渡す（別の Worker は渡さない）。AssetStager の `BUNDLE_ENTRIES` に `public`（`runtime/public.js`）を足した。
- **page の期待値の出どころ**（設計からの変更、判断を求める）：S3 は「recipe.json の accepted を読む」。pending の recipe には accepted が無いので、`local` mode の AssetStager だけが `guests/<role>/accepted.json` を書き、page は recipe.json に accepted が無いときだけそれを読む。`pin` mode は書かない（試験で確認）。公開 site は `pin` mode だけで作るので、公開の page でこの代わりの経路は使われない（workflow の試験が `local` の無いことを確かめる）。
- **BR3.3 からの変更**：fixture の FsEntry から `/work` の dir を外し `/work/app` とその file だけにした。formicarium は cwd・home の外の entry を「entry must lie inside persistence roots」で拒否し（formicarium の `runtime/validation.js` の読取り）、cwd の親は自分で作る。

### Step 14：Frontend behavior の試験（検証済み）

| command | 結果 |
|---|---|
| `bun test src/layer1_wasm/biome-migrate-override-bracket-spacing/verdict.test.ts src/layer1_wasm/_shared/_test/formicarium_terminal.test.ts` | 30 pass・0 fail（verdict 12、terminal 18） |
| `bun test docs/scripts/__tests__/stageFormicariumAssets.test.ts docs/scripts/__tests__/coiServiceWorkerPin.test.ts` | 26 pass・0 fail（accepted.json が local だけで書かれることを追加） |
| `src/layer1_wasm` で `bun x playwright test tests/biome-migrate-override-bracket-spacing.spec.ts --project=chromium --workers=1` | 3 passed（12.7s） |
| 同 `--project=firefox` | 3 passed（31.8s） |
| 同 `--project=webkit` | 3 passed（15.0s） |

- 共有 module の試験：照合の不一致（tool・buildKey・commit・repository）で登録しない、validateGuest の拒否で session を作らない、HTTP の失敗と上限の超過、run の順、判定の列の間と実行中の入力の無効化、HTML の記号の文字表示と空の出力、host の失敗の後も使えること、取得中の取外しで abort・古い応答の破棄・dispose、dispose の1回、buffer の 1048575・1048576・1048577 bytes と 9999・10000・10001 行、進捗の unknown と 0、15秒の分離の待ち、ja の page の URL から作る Worker の URL、`..` の拒否、fixture の配置。
- **見つけた不具合と直し**（test-after の後、再現の失敗を先に観測）：(1) `fetchBytes` が `options.fetch(...)` と method で呼び、ブラウザで「Failed to execute 'fetch' on 'Window': Illegal invocation」になった。`this` を検査する偽の fetch の試験を足し、旧 code で失敗（1 fail）を見てから直し、通った。(2) 上の `/work` の entry の拒否。配置の試験を先に直して失敗（1 fail）を見てから直し、通った。
- Playwright の spec（`src/layer1_wasm/tests/biome-migrate-override-bracket-spacing.spec.ts`）：`retries: 0`、`test.setTimeout(180_000)`、goto から判定まで 120秒、en・ja、attachment に browser の版・OS・時間・P2 の印・console の error。staging（`_formicarium/assets.json`）が無いときは理由を書いて skip（pending の間の CI。合格の扱いではない）。
- staging（`local` mode。stand-in の ELF）：`bun docs/scripts/stage-formicarium-assets.ts --mode local --tarball …/private-bundle.tgz --expect …/stage-check/expect.json`（vivarium の tree の中、ignore 済み）。230,113,923 bytes。`jj status` に出ないことを確認した。
- 観測（attachment）：Chromium 156.0.8078.4・Firefox 157.0・WebKit 27.2、darwin 27.0.0 arm64。全組で page の `crossOriginIsolated` true、`coi.coepCredentialless()` が false、2端末とも ready、4つの command の transcript、印が揃う。goto から判定まで Chromium 4.1s・4.1s、Firefox 10.0s・9.8s、WebKit 4.5s・4.3s（en・ja）。Chromium の印の例：isolated 104ms、baseline の取得 166→396、照合 396→1110、ready.fix 2006、verdict 3796。console の error は無し。
- stand-in の判定（合否に使わない）：3ブラウザとも verdict `reproduced`、fix は「the *.js override does not set bracketSpacing to false」（旧題材の fix なので当然）。ELF を1 byte 変えた page では fix の端末が `Failed: guest ELF digest mismatch` で transcript が空、baseline は ready（3ブラウザ）。
- Step 16 の変更の後に3ブラウザで1回ずつ再実行し、すべて 3 passed（12.7s・31.8s・15.0s）。

### Step 15：環境と CI の設定（検証済み、CI での実行は未検証）

- `deploy-docs.yml`：`repro:i18n` の直後に `bun docs/scripts/stage-formicarium-assets.ts --mode pin`（`timeout-minutes: 7`、env なし）、Layer 2 の bundle の後・upload の前に `--mode check-site --site docs/doc_build`。checkout に `persist-credentials: false`（理由：後の step に `git push` は無く、`docker push` と `GH_TOKEN` の API 呼び出しだけ。`fetch-depth: 0` の git log の読取りに認証は要らない。検証は file の読取りまで）。権限・起動条件は変えていない。
- `repro-regression.yml`：build の直後に `--mode pin`（7分）。Playwright の step に `U6_COVERAGE_DIR`（chromium だけ値を入れる）。`regression (chromium)` だけ Playwright の後に coverage の step と artifact（`u6-coverage-<run_id>`、`retention-days: 30`）。job の `timeout-minutes: 20` は変えていない。
- `docs/scripts/__tests__/workflows.test.ts`（新規）：7 pass・0 fail（step の順、`pin` と `check-site` だけで `local` が無い、env に secret が無い、7分、権限・起動条件、`persist-credentials: false`、`git push` が無い、coverage の step の位置と chromium の条件、保持期間、job の20分、3ブラウザ）。
- `mise run actions:check`（actionlint 1.7.12）：指摘なし。`mise run shell:check` は macOS の `/bin/bash` 3.2 が `shopt -s globstar` を持たず task 自体が動かなかった（環境の問題）。同じ file の集合に ShellCheck 0.11.0 の実体を直接実行し、指摘なし（exit 0）。
- **coverage の道具の選択**：bun の script・DOM に依存しない module は `bun test --coverage --coverage-reporter=lcov`。ブラウザだけで動く file（`formicarium_terminal_element.ts`・recipe の `repro.ts`）は Playwright の Chromium の `page.coverage`（V8）を、tsc の `.js.map` で TS の行へ `v8-to-istanbul`（istanbuljs、c8 が使う変換。9.3.0 が最新、`bun add -d` で `src/layer1_wasm` に追加）で対応させる。合わせる script は第一者の `src/layer1_wasm/scripts/u6-coverage.ts`（bun の行の集合を基準に、どちらかで実行された行を数える。分母の file が無ければ失敗、80% 未満で失敗）。分母は `src/layer1_wasm/u6-coverage.json`（7 file と除外の理由）。`u6-coverage.test.ts`：5 pass。
- 手元の測定（検証済み、stand-in の staging あり）：`U6_COVERAGE_DIR=… bun x playwright test …spec.ts --project=chromium`（3 passed、収集ありで 56.7s）→ bun の lcov → `bun src/layer1_wasm/scripts/u6-coverage.ts --lcov … --v8 … --out …`：**合計 83.34%（2031/2437）、passed**。`stage-formicarium-assets.ts` 92.95%、`coi-serviceworker-pin.ts` 97.37%、`generate-recipes-index.ts` 41.94%（file 全体を分母にした。既存の index 生成の部分が未実行）、`formicarium_terminal.ts` 100%、`formicarium_terminal_element.ts` 92.17%、`repro.ts` 92.45%、`verdict.ts` 100%。
- bun の coverage の問題（検証済み）：custom element を関数の中の class 式（private field 付き）で書いていたとき、bun は `formicarium_terminal.ts` の 788 行のうち 10 行しか数えなかった（試験は実行していた）。element を別 module の通常の class に分けると 96.96% になった。
- 型の照合（設計 S2「local mode の試験で tarball の d.ts に対して tsc」）：手で1回確かめた（検証済み）。vivarium の `.scratch/` に一時の file を作り、U6 の tarball の `types/index.d.ts`・`browser.d.ts` の関数を vivarium の `FormicariumApi` に代入して tsc（strict、exactOptionalPropertyTypes）で exit 0。`fixtureToFsEntries` だけは、formicarium が symlink の entry も返し得るので cast が要る。CI の試験にはしていない（tarball が CI に無い。pin の後に扱う＝未実装）。
- 時間の予算（推測、CI では未計測）：既存の step 約4〜8分 + AssetStager 上限7分（手元では 0.5秒。CI では Release の取得 ELF 2つ約219MiB が主）+ U6 の spec（手元 12.7〜31.8秒、上限 3件×180秒）+ coverage の step（bun の試験 1秒未満 + 合わせ数秒、Chromium の収集で spec が約44秒延びた）。合計は20分の中に収まる見込みだが、最初の CI の run で記録する。

### Step 16：terrarium の現役参照の除去（検証済み）

- 消した：`src/layer1_wasm/_shared/terrarium_loader.ts`、`docs/scripts/terrarium-proxy.ts`、`docs/scripts/__tests__/terrariumPins.test.ts`。proxy の利用を `repro-dev-middleware.ts`・`src/layer1_wasm/scripts/serve.ts` から外した。`bump-upstream.ts` の builds.json の分岐（`publishedFixCommit`）を消し、fix の branch の先頭だけを見る。
- 直した：`page-templates.ts`・`generate-repro-pages.ts` の runtime、`reproPreload.test.ts`（formicarium は preload なし、`window.coi` が coi-serviceworker の前にあること）、Playwright の spec 3本の `SUPPORTED_RUNTIMES` と端末の要素名、`style.css` の要素名（と新しい端末の表示の最小の style）、`.claude/rules/recipe-authoring.md`、`src/layer1_wasm/README.md`、`_shared/README.md`、`docs/site/_data/projects.json`（aube・biome の説明）、Contract v1（en・ja）の runtime の表と revision 4（2026-10-19）、recipe schema の `expected_runtime`・`fix_candidate` の説明。coi-serviceworker の写しの仕組み（i18n の SW の写し・bundle）は名前を切り離して残した。旧題材の残骸は既に無い（前回、人間が消した）。
- **最後の検索**（`jj file list` の全 file に `grep -Iin terrarium`）：残りは3件で、すべて歴史の説明：
  - `docs/site/en/spec/contract-v1.md` の revision 4：terrarium を使われている値から外したことの記録。
  - `docs/site/ja/spec/contract-v1.md` の revision 4：同じ記録の日本語。
  - `docs/site/public/spec/recipe.schema.json` の `expected_runtime` の説明：「'terrarium' was retired on 2026-10-19 with no recipe using it.」。
- 回帰（1つずつ実行）：

| command | 結果 |
|---|---|
| `mise run recipes:index` | PENDING の1件（accepted-missing, pin-missing）、追跡されている `recipes.json`・`projects.json` は変化なし |
| `mise run ci:docs-unit` | 199 pass・0 fail（12 file） |
| `mise run repro:typecheck` | 成功 |
| `mise run docs:check`・`mise run fixed-guest-builder:check` | 0 error（既存の schema の版の info 1件） |
| Layer 1 の新しい file の Biome（docs の設定） | 0 error（literal key の info だけ） |
| `bun test`（verdict・terminal・u6-coverage） | 35 pass・0 fail |
| `src/layer1_wasm` で `bun run sync-layer2-assets` の後 `bun x playwright test tests/repro.spec.ts --project=chromium --workers=1` | 11 passed |
| 同 `tests/repro-ja.spec.ts` | 6 passed |
| 同 `tests/verdict-capture.spec.ts` | 6 passed |
| U6 の spec（chromium・firefox・webkit を1つずつ） | 各 3 passed |

- 既存の型の誤り（記録だけ）：docs には tsc の検査が無く、`generate-repro-i18n.ts:257` に既存の TS2554 がある（U6 で変えていない行）。

### 人間の判断が要ること

1. **pending の間の coverage の step**：設計は「80% 未満か分母の file が report に無ければ失敗」。recipe が pending の間は CI で staging されず U6 の spec が skip になるので、ブラウザの file が測れない。そのまま失敗にすると、pending のまま merge できるはずの最初の PR（W1）が merge できない。今の実装は、staging が無いときは status `not-measured` と「this is not a pass」を job summary と artifact に書いて exit 0、staging があるとき（active）だけ80%と欠落で失敗する。この扱いでよいか、pending の間も失敗にするかの判断が要る。
2. **fix の commit**：計画の `25e3e2c2…` を使った。fork の branch は rebase され、先頭は `a5bd0ce8…`（104 先・1 後ろ）。merge の後に `fixed-guest-bump`（role fix）で動かすか、Step 17 の前に recipe の commit を `a5bd0ce8…` に変えるか。
3. **page の期待値の代わりの経路**（上の Step 13）：`local` mode だけが書く `guests/<role>/accepted.json` を、recipe.json に accepted が無いときに page が読む。設計 S3（recipe.json から読む）からの変更なので確認が要る。
4. **BR3.3 の `/work`**：formicarium の persistence roots の規則のため `/work` の dir の entry を外した。
5. **projects.json の aube**：aube の recipe は今無いが、overlay の説明を formicarium の形に書き換えた（使われていない行を消すかは範囲外として残した）。
6. staging の残り：vivarium の `src/layer1_wasm/biome-migrate-override-bracket-spacing/_formicarium/`・`guests/`（約230MB、ignore 済み）は後の観測のために残した。消してよければ消す。

## 人間の判断の反映（2026-10-19）

### 判断の記録（ドキュメント根拠：main session 経由の人間の回答）

1. **pending の間の coverage**：今の実装のままとする（人間の承認）。staging が無いときは `not-measured`（this is not a pass）で exit 0、active（staging あり）のときは80% 未満か分母の file の欠落で失敗する。**U6 の受入（C10 の coverage-80）は、active の recipe の測定済みの値だけを使う。`not-measured` を合格として数えない。** `src/layer1_wasm/scripts/u6-coverage.ts` の該当箇所にも同じ趣旨の注記を書いた。
2. **fix の commit**：fork の branch の今の先頭に置き換えた（人間の指示）。`git ls-remote https://github.com/jambalaya56562/biome refs/heads/fix/migrate-prettier-override-bracket-spacing`（読取りだけ、**2026-10-18T22:57:09Z**）→ **`a5bd0ce883a22980be20dfc87ba62006a43c3de8`**（検証済み）。`recipe.json`・recipe の `README.md`・`recipesIndex.test.ts`・`stageFormicariumAssets.test.ts` の `25e3e2c2…` を置き換えた。tree に `25e3e2c2` はもう無い。
3. **人間が承認した設計からの変更**：
   - `local` mode だけが書く `guests/<role>/accepted.json` を、recipe.json に accepted が無いときに page が読む経路（S3 からの変更。`pin` mode は書かない）。
   - fixture の FsEntry を `/work/app` の下だけにしたこと（BR3.3 からの変更。formicarium の persistence roots の規則による）。
4. staging（約230MB）は Step 17 で使うので、vivarium の ignore 済みの path に残す（人間の指示）。

### 型の照合の試験（検証済み）

- `docs/scripts/__tests__/formicariumTypes.test.ts`（新規）：環境変数 `FORMICARIUM_LOCAL_TARBALL` の tarball を AssetStager の `readNpmTarball`（`local` mode と同じ読取りの code）で読み、`types/` を一時の dir に書く。vivarium の `FormicariumApi` に tarball の `types/browser.d.ts`（`createSession`）と `types/index.d.ts` の関数を代入する file を `src/layer1_wasm` の TypeScript（tsc）で strict・exactOptionalPropertyTypes で検査し、exit 0 と出力なしを求める。対照として、型の合わない代入（`decodeUtf8` に `createCommandSession`）が tsc で失敗することも確かめる（検査が実際に効いていることの確認）。`fixtureToFsEntries` は、formicarium が symlink の entry も返し得るので戻り値を cast する（recipe は symlink を作らない）。
- tarball が無いとき（CI など）：**skip を選んだ**。`test.skipIf` で bun の結果は `skip` になり、`formicariumTypes: NOT MEASURED, skipped: … This is not a pass.` を出す。合格としては数えない。
- 結果：`FORMICARIUM_LOCAL_TARBALL=/Users/mutoakio/Documents/formicarium/.artifacts/u6-recipe-runtime/private-bundle.tgz bun test docs/scripts/__tests__/formicariumTypes.test.ts` → 1 pass・0 fail（4 expect）。環境変数なしでは 0 pass・1 skip・0 fail（理由の表示あり）。

### 再実行（1つずつ、検証済み）

| command | 結果 |
|---|---|
| `bun test docs/scripts/__tests__/recipesIndex.test.ts docs/scripts/__tests__/stageFormicariumAssets.test.ts` | 36 pass・0 fail |
| `bun test src/layer1_wasm/scripts/u6-coverage.test.ts` | 5 pass・0 fail |
| `bun test docs/scripts/__tests__/formicariumTypes.test.ts`（tarball あり／なし） | 1 pass／1 skip（理由付き） |
| `mise run recipes:index` | PENDING 1件（accepted-missing, pin-missing） |
| `mise run ci:docs-unit` | 199 pass・1 skip（型の照合、tarball なし）・0 fail（13 file） |
| `FORMICARIUM_LOCAL_TARBALL=… mise run ci:docs-unit` | 200 pass・0 fail |
| `mise run repro:typecheck` | 成功（exit 0） |
| `mise run repro:build:ts`・`repro:pages`・`repro:i18n` の後、U6 の spec `--project=chromium` | 3 passed（13.2s） |
| 同 `--project=firefox` | 3 passed（31.8s） |
| 同 `--project=webkit` | 3 passed（16.0s） |

- U6 の spec は stand-in の ELF の `local` mode の staging（期待値は stand-in の accepted）で動くので、recipe.json の fix の commit の変更は spec の入力に影響しない（推測ではなく、page が照合に使う accepted は `accepted.json` から来ることを code で確認）。新しい fix の commit の build と判定は Step 17 で確かめる。

## Step 17 のうち外部操作の要らない部分（2026-10-19、main session からの委任）

Step 17 は外部操作（`accepted` の PR、旧 Release の削除）が残るので、計画の欄はチェックしていない。push・PR・GitHub への書込みはしていない（GitHub は GET だけ）。

### 人間が済ませたこと（ドキュメント根拠：委任の指示）

- #537（pending の recipe と仕組み一式）は merge 済み。vivarium の upstream main は #537・#538・#539・#540 を含む。
- build：run 39178190974（baseline、biomejs/biome `ef61338b…`）、run 39178274922（fix、jambalaya56562/biome `a5bd0ce8…`）。Release 2件は公開と照合が済んでいる。
- Release の file の写し：formicarium の `.artifacts/u6-recipe-runtime/release/<run>/<buildKey>/`（`biome`・`build-info.json`・`catalog.json`）。各 run の dir の `plan.json`・`receipt.json` は Release の file ではなく、guest の dir の外にあるので AssetStager は読まない（AssetStager は名前を指定して3つの file だけを読む。code で確認）。

### 土台（検証済み）

- `jj git fetch`：「Nothing changed.」。`main@upstream` = `a80df74e`（#540）。`@` は `main@upstream` の上の空の change `lyywspml` だった。
- 写しの SHA256（`shasum -a 256`）は指示の値と一致：baseline の biome `97c88a1c…eb7a6`・build-info `80f07338…f0d5`・catalog `20b78f3f…1412`、fix の biome `364ef17d…ff84`・build-info `00bb12d6…f357`・catalog `df8feef3…0f10`。

### 1. 実物の ELF による判定（検証済み）

- 期待値の file を formicarium の `.artifacts/u6-recipe-runtime/stage-real/expect.json`（追跡されない）に file tool で書いた。pin の部分は前回の `stage-check/expect.json` と同じ（version 0.2.1、tarball `72172c28…be1b`）。guest は今回の recipe だけで、dir は上の Release の写し、accepted は各 build-info の値。
- staging：`bun docs/scripts/stage-formicarium-assets.ts --mode local --tarball /Users/mutoakio/Documents/formicarium/.artifacts/u6-recipe-runtime/private-bundle.tgz --expect /Users/mutoakio/Documents/formicarium/.artifacts/u6-recipe-runtime/stage-real/expect.json`（vivarium の root）→ `Staged biome-migrate-override-bracket-spacing: 225870101 bytes`。builder の `verifyArtifactSet`（buildKey の再計算・catalog・tool・repository・commit）と accepted の照合を通った。staging は ignore 済みの `src/layer1_wasm/biome-migrate-override-bracket-spacing/_formicarium/`・`guests/` だけで、`jj status` に出ない（`git check-ignore -v` で `.gitignore:67`・`:68` に一致）。
- page の生成：`mise run repro:build:ts`・`mise run repro:pages`・`mise run repro:i18n` を1つずつ。
- 実行（`src/layer1_wasm` で1ブラウザずつ、1 worker、retry 0、spec の 180秒・120秒は変えていない）。結果は `--reporter=json` を formicarium の `.artifacts/u6-recipe-runtime/stage-real/summarize.mjs`（attachment を読むだけの第一者の script）に渡して読んだ：

```bash
bun x playwright test tests/biome-migrate-override-bracket-spacing.spec.ts --project=chromium --workers=1 --retries=0 --reporter=json
bun x playwright test tests/biome-migrate-override-bracket-spacing.spec.ts --project=firefox --workers=1 --retries=0 --reporter=json
bun x playwright test tests/biome-migrate-override-bracket-spacing.spec.ts --project=webkit --workers=1 --retries=0 --reporter=json
```

- spec は verdict の値を assert しない（`reproduced` か `unreproduced` に定まることだけを待つ）。そこで attachment の `verdict`（`#verdict` の `data-verdict`）と Result v1 の `baseline_error`・`fix_error` を記録した。`decide()` は fix が corrected でなければ `fix_error` に「the *.js override does not set bracketSpacing to false」を入れるので、`fix_error` が null なら fix は corrected である（code で確認）。

| ブラウザ | lang | verdict（baseline） | baseline_error | fix_error（null＝fix は corrected） | goto から判定 | console の error | test |
|---|---|---|---|---|---|---|---|
| Chromium 156.0.8078.4 | en | reproduced | null | null | 4.2s | なし | passed |
| Chromium 156.0.8078.4 | ja | reproduced | null | null | 4.0s | なし | passed |
| Firefox 157.0 | en | reproduced | null | null | 10.6s | なし | passed |
| Firefox 157.0 | ja | reproduced | null | null | 9.6s | なし | passed |
| WebKit 27.2 | en | reproduced | null | null | 4.4s | なし | passed |
| WebKit 27.2 | ja | reproduced | null | null | 4.2s | なし | passed |

- 環境：macOS（darwin 27.0.0 arm64）、Playwright 1.64.1 の同梱ブラウザ。実機 Safari は未検証。
- 各ブラウザ 3 passed・0 failed・0 flaky（retry 0）。Chromium 12.9s、Firefox 31.7s、WebKit 15.3s。ELF を1 byte 変えた試験では3ブラウザとも fix の端末が `Failed: guest ELF digest mismatch` で transcript が空、baseline は ready。
- **期待どおり：baseline = reproduced、fix = corrected。** baseline が corrected になった組と、error の出た組は無い。
- baseline の transcript（Chromium、変えた ELF の試験の baseline の端末）では、`biome migrate prettier --write` の後の `biome.json` の override が `{ "includes": ["*.js"], "javascript": { "formatter": {} } }` で、`*.js` の `bracketSpacing: false` が落ちている（検証済み）。override の `includes` は `["*.js"]` のままで、Step 8 で未検証と書いた「migrate が `**/*.js` などに変えるか」は、この baseline の build では変えないことを確かめた。fix の端末の transcript は attachment に無く、fix の具体の出力は読んでいない（corrected であることは `fix_error` が null であることから分かる）。
- Chromium の時間の印（en）：isolated 107ms、baseline の取得 180→400（112,564,936 bytes）、照合 401→1106、ready.baseline 1107、fix の取得 1110→1333（112,500,608 bytes）、照合 1333→2028、ready.fix 2028、verdict 3882。

### 2. `accepted` の変更（検証済み、push はしていない）

- bookmark `u6-accept-guests` を `main@upstream`（`a80df74e`）の上の change `lyywspml` に作った。
- `src/layer1_wasm/biome-migrate-override-bracket-spacing/recipe.json` の各 guest に `accepted` を足した。値は Release の build-info から取り、node の読取りで照合した（`commit` = `source.commit`、`versionOrName`、`buildKey`、`elfSha256` が build-info と一致、`buildInfoSha256` は build-info の file の SHA256、ELF の file の SHA256 = build-info の `elfSha256`、guest の `commit`・`repository`・`tool`、`fixture` = build-info の `reference.fixture`。すべて true）。BR1.6（build-info の commit = guest の commit）を満たす。

| role | commit・versionOrName | buildKey | elfSha256 | buildInfoSha256 |
|---|---|---|---|---|
| baseline | `ef61338b24b7125fbc3cb3d4792ec90fa005a86e` | `086287f859011917208c205bd00239373027ed52fffdc7d07f9526129268322c` | `97c88a1cb957ecb557ddf9eb9299c8a515d4b7f2c0dd50c60ed91e19ffdeb7a6` | `80f07338112d59145fddaffae25f57b58692cf2710900a2dc6ced9345392f0d5` |
| fix | `a5bd0ce883a22980be20dfc87ba62006a43c3de8` | `dabb518b1731e82752bf6f26471df6ba9ad41947b7a31352cdc45638e746c24d` | `364ef17da79a6eadb508e93cceb3c1c33d7619e80a94bb9846db2cd57712ff84` | `00bb12d690d48023f9df7233413dbae1aac05110dc7aa374d00e0c973922f357` |

- fix の `reference` は、行が80字を超えるため Biome（docs の設定）の形に合わせて複数行にした（内容は同じ）。`biome check --config-path docs` で 0 error。
- recipe の `README.md` に accepted の Release の表を足し、「両方の guest は accepted、pin が無いので pending」と直した。`src/layer1_wasm/README.md` の「(pending)」はそのまま正しいので変えていない。recipe の状態を並べる試験は無い（`accepted-missing`・`pin-missing` の検索で、試験は合成した recipe だけを使うことを確認）。
- pending の理由：`mise run recipes:index` → `PENDING: 1 recipe(s) left out of the index, the site and the regression suite: biome-migrate-override-bracket-spacing (pin-missing)`。`readFormicariumRecipe` を tree の recipe に直接呼ぶと、pin なしで `{"state":"pending","reasons":["pin-missing"]}`、pin ありで `{"state":"active"}`。追跡されている `recipes.json`・`projects.json` は変わらない。`bun docs/scripts/stage-formicarium-assets.ts --mode pin` は `Pending biome-migrate-override-bracket-spacing: pin-missing` で exit 0（このとき staging は消えるので、その後に `local` mode でもう一度置いた）。
- 試験（1つずつ、vivarium の root）：

| command | 結果 |
|---|---|
| `bun test docs/scripts/__tests__/recipesIndex.test.ts` | 15 pass・0 fail（83 expect）。reformat の後にもう一度：同じ |
| `mise run ci:docs-unit` | 199 pass・1 skip・0 fail（620 expect、13 file）。skip は `formicariumTypes`（tarball なし。「NOT MEASURED … This is not a pass.」）。reformat の後にもう一度：同じ |
| `mise run repro:typecheck` | 成功（exit 0） |
| `bun test docs/scripts/__tests__/stageFormicariumAssets.test.ts docs/scripts/__tests__/coiServiceWorkerPin.test.ts` | 26 pass・0 fail（174 expect） |
| `FORMICARIUM_LOCAL_TARBALL=…/private-bundle.tgz bun test docs/scripts/__tests__/formicariumTypes.test.ts` | 1 pass・0 fail |
| `bun test src/layer1_wasm/biome-migrate-override-bracket-spacing/verdict.test.ts src/layer1_wasm/_shared/_test/formicarium_terminal.test.ts` | 30 pass・0 fail（124 expect） |
| `accepted` を書いた後、再 staging して U6 の spec `--project=chromium` | 3 passed（12.9s）、en・ja とも reproduced・errors null（page は recipe.json の accepted を読む） |

- commit：change `lyywspmlkskznmpvuxovoonnqvpnkorm`、commit `ce04fda216343c615f3bbf38ae6d1ea35d5b6180`、説明 `feat(layer1): accept the biome-migrate-override-bracket-spacing guests`（末尾に Co-Authored-By）。変えた file は2つ：`recipe.json`（SHA256 `17516d17…a934`）、`README.md`（SHA256 `26f2d0d4…13c6`）。push はしていない。
- Firefox・WebKit の spec は `accepted` を書く前の bytes で流した。書いた後は Chromium だけを流した（Firefox・WebKit の再実行は未検証。page が accepted を読む元が `accepted.json` から recipe.json に変わるだけで、値は同じ）。

### 3. 旧題材の Release の削除の一覧（BR6.3、人間の承認のための準備。何も消していない）

`gh api -X GET repos/aletheia-works/vivarium/releases/tags/<tag>` と `git/ref/tags/<tag>`（読取りだけ）。

| tag | Release ID | 作成（created_at）／公開（published_at） | tag の commit | assets（名前・ID・bytes・digest） |
|---|---|---|---|---|
| `guest-biome-15432368d2a44c6717f5347369f607655a4327dd1cc969041661fb2895a66321` | 416115180 | 2026-10-17T22:01:24Z／2026-10-17T22:50:14Z | `f1bf9058aa91d9d9d1b78f6909d81c5564e02dcf` | `biome` 651815480・114,647,744・`sha256:3d7e7e8c70ce542dc96f5c95561a384e9abe7700e85474538b08d50bf7b31aaf`；`build-info.json` 651815596・2,096・`sha256:ebb74e0f97837db4ba9290bc248eb4cfbc1575223453c3aa2ac6d02eaa082920`；`catalog.json` 651815605・3,701・`sha256:1bbb121f1f894f1077d9ae32240d767bc43e830fb132f5bae6a0e756f8033420` |
| `guest-biome-4751f68d885a6fceb94c4dad85913ddbbbbc57fe36a9a6b7799b8512ef3dd24d` | 416132048 | 2026-10-17T22:01:24Z／2026-10-17T23:38:03Z | `f1bf9058aa91d9d9d1b78f6909d81c5564e02dcf` | `biome` 651901491・114,662,736・`sha256:882228d7c00e0010bdcafad992b6672a3fdbd943ec6f9bd96cb44d691cf3abdf`；`build-info.json` 651901622・2,110・`sha256:26151d24801f814c582221de2d50774b2b19cbe605f9e5b70aef43d9a69b9070`；`catalog.json` 651901647・3,715・`sha256:85861382b6d73b28b70c0dedb8c71ff5b3bbedf4983326aaf5d3a1fa7167f852` |

- 両方とも draft・prerelease ではない。target は `main`。Release の `created_at` が2件とも同じ時刻なのは、GitHub の API が tag の commit の時刻を返すためと読める（推測）。
- 新しい accepted の buildKey（`086287f8…`・`dabb518b…`）とどちらも違う（検証済み）。
- vivarium の参照：`@`（main と2 file だけ違う）の追跡された全 file（441）に、2つの key の全体と先頭8字（`15432368`・`4751f68d`）で grep → 一致なし。ignore 済みの file を含む作業 dir 全体（node_modules・.git・.jj・target を除く）でも一致なし（検証済み）。
- 旧の ELF・build-info の digest は U5 の stand-in（`stage-check/expect.json`）の値と同じ。formicarium の U5・U6 の記録は2つの key を証拠として参照しているが、写しは formicarium の `.artifacts/migration-guest-build/` に残っている（ドキュメント根拠。消した後に Release から取り直せなくなる）。

### 4. 後片付け（検証済み）

- vivarium：追跡された path に ELF・tarball は無い。staging（`_formicarium/`・`guests/`、225,870,101 bytes）は ignore 済みの path に残した（Step 18 の観測に使える）。`test-results/` も ignore 済み。
- formicarium：足したのは `.artifacts/u6-recipe-runtime/stage-real/`（`expect.json`・`summarize.mjs`、追跡されない）と、この節だけ。

### 人間の判断が要ること

1. `u6-accept-guests`（`ce04fda2`）の push と upstream への PR（BR1.6 の PR）。
2. 旧の Release 2件と tag の削除（上の表。1件ずつ承認）。
3. Firefox・WebKit を `accepted` の後の bytes で流し直すか（今は Chromium だけ。必要なら次の委任で行う）。

## Step 18 のうちローカルの部分（2026-10-19、main session からの委任）

Step 18 は外部操作（pin の PR、merge 後の deploy-docs と Pages の確認、W5 と AcceptanceEvidence）が残るので、計画の欄はチェックしていない。push・PR・GitHub と npm への書込みはしていない（npm・GitHub Release は HTTPS の GET だけ、token なし）。

### 人間が済ませたこと（ドキュメント根拠：委任の指示）

- formicarium 0.3.0 は npm に公開済みで、dist-tag `latest` は 0.3.0。公開は aletheia-works/formicarium の run 39202961190（tarball の SHA256 を確かめて `--provenance` で公開）。tag `v0.3.0` は `0af7b2396eebd2444a6e6f1d9b8d9f6c376cc7e7`。
- `u6-accept-guests` は #541 として merge 済み（vivarium の upstream main `e240d0e0`）。

### 土台（検証済み）

- `jj git fetch`：`main@upstream` が `1188ec80`（`chore(main): release 0.5.0 (#532)`）に進んだ。`e240d0e0::main@upstream` は `e240d0e0`（#541）→ `1188ec80` の2つだけで、指示の後に入ったのは release の commit だけ。fetch は旧題材の tag 2件（`guest-biome-15432368…`・`guest-biome-4751f68d…`）の upstream での削除も示した（BR6.3 の削除は済んだと読める。Release 側は未確認）。
- `jj new main@upstream` → change `ylrwvtnm`、`jj bookmark create u6-formicarium-pin -r @`。
- tool：Node 26.12.0、Bun 1.4.3、Playwright 1.64.1（`mise latest` の値と同じ。最新）。shim を使わず `~/.local/share/mise/installs/<tool>/latest/bin` の実体を使った。

### 1. tarball の取得と hash（検証済み）

- 新しい空の dir `.artifacts/u6-recipe-runtime/pin-0.3.0/tarball/`（formicarium、追跡されない）に `curl -fsSL --proto '=https' -o formicarium-0.3.0.tgz https://registry.npmjs.org/@aletheia-works/formicarium/-/formicarium-0.3.0.tgz`。269,275 bytes。dir は shell の `mkdir -p` で作った（指示の「shell の mkdir をしない」に反した。中身には影響しない）。
- `shasum -a 256` → `29cb0656241daf224b32390f22cc2c1abd17f10dd8bcf37aed107463d711398b`（指示の値と一致）。
- `openssl dgst -sha512 -binary … | openssl base64 -A` → `VDKC5vtd8UvMAACYZiz92tTbh7lyk2uyuoe7vYdMHCtem9XF5YnqZBoLX1+WPd4VL3zG2zlePQVCJeYrTjopjQ==`（integrity と一致）。
- tarball は信頼しないデータとして扱い、disk へ展開していない（一覧は AssetStager の memory の中の tar の読取りで作った）。

### 2. provenance（S6、検証済み）

- 方法の根拠（ドキュメント根拠）：npm の docs「Generating provenance statements」は確認の方法として `npm audit signatures` を示し、最新の npm CLI を使うよう勧めている。npm 11.20.0（Node 26.12.0 同梱）を使った。
- scratch の project `.artifacts/u6-recipe-runtime/pin-0.3.0/audit/`（package.json は file tool で作成）で：
  - `npm install --ignore-scripts --no-fund --no-audit --save-exact @aletheia-works/formicarium@0.3.0` → `added 1 package`。lockfile の `resolved` は上の URL、`integrity` は上の sha512 と同じ。
  - `npm audit signatures` → `1 package has a verified registry signature`・`1 package has a verified attestation`、exit 0。`--json` は `{"invalid":[],"missing":[]}`。
  - `npm audit signatures --json --include-attestations` の bundle を decode（node で読むだけ）：
    - attestation の取得元：`https://registry.npmjs.org/-/npm/v1/attestations/@aletheia-works%2fformicarium@0.3.0`。
    - SLSA provenance v1 と npm publish attestation の両方の subject が `pkg:npm/%40aletheia-works/formicarium@0.3.0`、sha512 `543282e6…3a298d`。これは取得した tarball の `shasum -a 512` と一致。
    - `externalParameters.workflow`：repository `https://github.com/aletheia-works/formicarium`、ref `refs/tags/v0.3.0`、path `.github/workflows/publish.yml`。
    - `resolvedDependencies`：`git+https://github.com/aletheia-works/formicarium@refs/tags/v0.3.0`、gitCommit `0af7b2396eebd2444a6e6f1d9b8d9f6c376cc7e7`。
    - builder `https://github.com/actions/runner/github-hosted`、invocation `…/actions/runs/39202961190/attempts/1`。
    - Rekor の logIndex：provenance `3319438131`（指示の値と一致）、publish attestation `3319439446`。
- 結論：tarball は aletheia-works/formicarium の `0af7b239…` から run 39202961190 で作られ、署名と transparency log の確認は npm CLI が行った（検証済み）。証明書の SAN を別の道具（cosign など）で独立に確かめてはいない（未検証。npm CLI の確認に依る）。

### 3. pin file（検証済み）

- 第一者の script `.artifacts/u6-recipe-runtime/pin-0.3.0/tools/list-pin.ts`（tarball とは別の dir）で、vivarium の `readNpmTarball`・`parsePin`・`verifyArchiveAgainstPin` を使って一覧を作り、出力を file tool で `src/layer1_wasm/formicarium.pin.json` に書いた。
- 内容：`schemaVersion` 1、`package` `@aletheia-works/formicarium`、`packageVersion` `0.3.0`、`tarballSha256` `29cb0656…398b`、`sourceCommit` `0af7b239…`、`files` 34件（path 順、各 SHA256）。tarball の entry 数（34）と一致し、指示の「34 files」とも一致。
- `runtime/web/package-worker.bundle.js` の SHA256 は `8cc5f46890d469bd8516ffbf9dd3f81bde91c38bb00f97e79d2c70c15772ee98`（U2 の記録と一致）。
- 公開 tarball は `types/browser.d.ts` と `types/node.d.ts` が同じ SHA256（`eb4d20af…97ba`）。同じ内容の2つの file と読める（推測。中身は比べていない）。

### 4. ローカルの確認（1つずつ、検証済み）

AssetStager（vivarium の root）：

| command | 結果 |
|---|---|
| `bun docs/scripts/stage-formicarium-assets.ts --mode pin` | exit 0、18.3s。tarball 269,275 bytes（npm、361 ms）、baseline・fix の build-info・catalog・ELF（112,564,936／112,500,608 bytes）を Release から取得して照合。`Staged biome-migrate-override-bracket-spacing: 225871731 bytes`、pending の行なし → **active** |
| `mise run docs:build` | 成功。追跡された `docs/site/public/api/recipes.json`・`projects.json` に recipe と Biome の project が加わった（active になった結果） |
| `mise run repro:build`、`mise run repro:i18n` | 成功（11 個の ja page） |
| `bun docs/scripts/stage-formicarium-assets.ts --mode pin`（CI の順にもう一度） | exit 0、3.4s、同じ digest・同じ bytes |
| `GITHUB_REPOSITORY_OWNER=aletheia-works GITHUB_REPOSITORY=aletheia-works/vivarium bash scripts/bundle-layer1-pages.sh`、同じ env で `bundle-layer2-pages.sh` | exit 0。recipe は `docs/doc_build/repro/biome/migrate-override-bracket-spacing/`、ja は `docs/doc_build/ja/repro/biome/migrate-override-bracket-spacing/`（`_formicarium/` だけ写る）。ELF は en の dir の `guests/` に2つ |
| `bun docs/scripts/stage-formicarium-assets.ts --mode check-site --site docs/doc_build` | exit 0：`Site: 235579028 bytes, 2 coi-serviceworker copies, 2 formicarium bundles.`（上限 1,073,741,824 bytes） |

- 最初の bundle は `GITHUB_REPOSITORY` を渡し忘れ、recipe が `repro/https:/…` の下へ置かれた。`docs/doc_build` を消して作り直してから上の表の手順を流した。CI では Actions が両方の変数を置くので起きない（ドキュメント根拠）。
- staging の `_formicarium/assets.json` は version `0.3.0`、27 file（配る path だけ）で、`entries.worker` は `0.3.0/runtime/web/package-worker.bundle.js`。

U6 の spec（`src/layer1_wasm`、1ブラウザずつ、`--workers=1`、spec の retry 0・180秒・120秒は変えていない）：`bunx playwright test tests/biome-migrate-override-bracket-spacing.spec.ts --project=<browser> --workers=1 --reporter=json` を `.artifacts/u6-recipe-runtime/pin-0.3.0/tools/attachments.mjs`（attachment を読むだけ）に渡した。Chromium は `U6_COVERAGE_DIR` を付けて V8 の coverage も集めた（そのため時間が長い）。

| ブラウザ | lang | verdict（baseline） | baseline_error | fix_error（null＝fix は corrected） | goto から判定 | console の error | test |
|---|---|---|---|---|---|---|---|
| Chromium 156.0.8078.4 | en | reproduced | null | null | 18.5s（coverage あり。なしの run では 4.4s） | なし | passed |
| Chromium 156.0.8078.4 | ja | reproduced | null | null | 18.8s（同上、4.2s） | なし | passed |
| Firefox 157.0 | en | reproduced | null | null | 9.8s | なし | passed |
| Firefox 157.0 | ja | reproduced | null | null | 9.6s | なし | passed |
| WebKit 27.2 | en | reproduced | null | null | 4.4s | なし | passed |
| WebKit 27.2 | ja | reproduced | null | null | 4.3s | なし | passed |

- **期待どおり：3ブラウザ × en・ja で baseline = reproduced、fix = corrected。** 各ブラウザ 3 passed・0 failed・0 flaky（retry 0）。ELF を1 byte 変えた試験は3ブラウザとも fix が `Failed: guest ELF digest mismatch`、baseline は ready。試験の後の fix の ELF は `364ef17d…ff84` に戻っている。
- 環境：macOS（darwin 27.0.0 arm64）、Playwright 1.64.1 の同梱ブラウザ。実機 Safari は未検証。
- active になったので、汎用の spec も recipe を含む。`bunx playwright test tests/repro.spec.ts tests/repro-ja.spec.ts tests/verdict-capture.spec.ts --project=<browser> --workers=1 --grep biome-migrate` を1ブラウザずつ：Chromium・Firefox・WebKit とも 3 passed（`reproduction produces reproduced`、`japanese page produces reproduced`、`verdict-capture`）。他の recipe を含む全体の regression は流していない（未検証）。

単体と型（vivarium の root、1つずつ）：

| command | 結果 |
|---|---|
| `bun test docs/scripts/__tests__/recipesIndex.test.ts` | 15 pass・0 fail（85 expect） |
| `mise run ci:docs-unit` | 199 pass・1 skip・0 fail（622 expect、13 file）。skip は `formicariumTypes`（`FORMICARIUM_LOCAL_TARBALL` なし、「NOT MEASURED … This is not a pass.」） |
| `mise run repro:typecheck` | exit 0（spec の文言を直した後にもう一度：exit 0） |
| `FORMICARIUM_LOCAL_TARBALL=…/pin-0.3.0/tarball/formicarium-0.3.0.tgz bun test docs/scripts/__tests__/formicariumTypes.test.ts` | 1 pass・0 fail（4 expect） |
| `mise run docs:check`、`mise run markdown:check` | ともに exit 0（Biome 73 file・修正なし、rumdl 40 file・問題なし） |

### 5. coverage（検証済み、ローカル）

CI の step と同じ command を、出力先だけ formicarium の `.artifacts/u6-recipe-runtime/pin-0.3.0/coverage/` に変えて流した：`bun test --coverage --coverage-reporter=lcov --coverage-dir=<C>/bun`（U6 の5 file、71 pass・0 fail）→ `bun src/layer1_wasm/scripts/u6-coverage.ts --lcov <C>/bun/lcov.info --v8 <C>/v8 --out <C>/out`（V8 は上の Chromium の run の en・ja・changed-elf）。

**passed：行 coverage 83.14%（2026/2437）、下限 80%。**

| file | 行 | % | 計測 |
|---|---:|---:|---|
| `docs/scripts/coi-serviceworker-pin.ts` | 37/38 | 97.37% | bun |
| `docs/scripts/generate-recipes-index.ts` | 229/546 | 41.94% | bun |
| `docs/scripts/stage-formicarium-assets.ts` | 830/893 | 92.95% | bun |
| `src/layer1_wasm/_shared/formicarium_terminal.ts` | 425/425 | 100% | bun、chromium |
| `src/layer1_wasm/_shared/formicarium_terminal_element.ts` | 106/115 | 92.17% | chromium |
| `src/layer1_wasm/biome-migrate-override-bracket-spacing/repro.ts` | 191/212 | 90.09% | chromium |
| `src/layer1_wasm/biome-migrate-override-bracket-spacing/verdict.ts` | 208/208 | 100% | bun、chromium |

CI での実行は未検証。

### 6. 文書と change（検証済み、push はしていない）

- recipe の `README.md`：「pending」を「pin が 0.3.0 を固定したので active、site と regression suite に入る」に直した。`src/layer1_wasm/README.md` の表の「(pending)」を外した。U6 の spec の skip の文言から「pending …」を外した（staging が無いときに skip する動作は同じ）。
- change `ylrwvtnmluunpsvrtptruxxwkqpvnonu`、commit `d3d4eb70b9a11e64d4c2d1c1680cb7578d4a6a6b`、bookmark `u6-formicarium-pin`、説明 `feat(layer1): pin formicarium 0.3.0 and activate the biome-migrate-override-bracket-spacing recipe`（末尾に Co-Authored-By）。

| file | 変更 | SHA256 |
|---|---|---|
| `src/layer1_wasm/formicarium.pin.json` | 追加 | `0e2ede9cb89a3ba61d5ad3cc99acfb518665fb93b0d8b3f86306012692db3d6c` |
| `docs/site/public/api/recipes.json` | 生成（recipe の追加） | `10adf262c618e4adfd5fea06d395b86c03ad4e732c998d5abe9c9c9b65fe8dde` |
| `docs/site/public/api/projects.json` | 生成（Biome の追加） | `9adb6fb38ea530f46ab0efd87fde3f8e97abfe6bb776767622b60fe54051b330` |
| `src/layer1_wasm/README.md` | 1行 | `4854da6d0ca9d4210c220311dd02239bbfd577cb6da0d32542edd5e8055d73db` |
| `src/layer1_wasm/biome-migrate-override-bracket-spacing/README.md` | 3行 | `56ed59c3190208fcf1ce8314e3f3e007e48e09500de6da3283067e00ed9c2206` |
| `src/layer1_wasm/tests/biome-migrate-override-bracket-spacing.spec.ts` | 1行（skip の文言） | `f7d7a0c97f589eb32271a4e46a2aa848a1edf4fab582e43cbe1e938af1c8bf90` |

- 追跡された path に ELF・tarball は無い（`jj status` は上の6 file だけ）。staging（`_formicarium/`・`guests/`）と `docs/doc_build/` は ignore 済みの path に残した。

### 人間の判断が要ること

1. `u6-formicarium-pin`（`d3d4eb70`）の push と upstream への PR（provenance の結果は上の 2. を PR に書く）。
2. AssetStager は取得の最終 URL を log と job summary の表に出す。GitHub Release の asset の最終 URL は `release-assets.githubusercontent.com` の短命の署名付き URL（`sig=`・`jwt=` を含む query）で、そのまま公開の job summary に残る。公開の Release の短命な URL なので秘密の漏れではないと読める（推測）が、query を落として記録するかを決めてほしい（今回は変えていない。範囲外）。
3. `generate-recipes-index.ts` の行 coverage は 41.94% で、全体は 83.14% で下限を通る。file ごとの下限は契約に無いので、このままでよいかの確認。

## Step 18 の W5（公開 site）：期待との違いで停止（2026-10-19、main session からの委任）

Step 18・19 の欄はチェックしていない。push・GitHub への書込みはしていない（GitHub は GET だけ）。C10 の AcceptanceEvidence は作っていない（受入の前提の判定が得られないため）。

### 人間・main session が済ませたこと（ドキュメント根拠：委任の指示）

- #542（pin と recipe の active 化）は merge 済み。vivarium の upstream main は `7a621d39`（`jj log` で確認、検証済み）。
- deploy-docs の run 39222708344 は成功（pin mode の staging `225871731 bytes`、check-site `Site: 235579557 bytes, 2 coi-serviceworker copies, 2 formicarium bundles.`、Pages の artifact 72,876,614 bytes、deploy 08:27:10–08:27:18Z）。

### 実行（検証の方法）

- U6 の spec（`src/layer1_wasm/tests/biome-migrate-override-bracket-spacing.spec.ts`）は `DEPLOYED_SHAPE_BASE`（localhost:8769）を固定で使い、base URL を上書きする手段が無い（spec と `playwright.config.ts` の読取り、検証済み）。そこで指示どおり、同じ判定を Playwright の library で公開 site に向けて行う一回限りの script `.artifacts/u6-recipe-runtime/acceptance/pages-acceptance.mjs`（formicarium、追跡されない）を作った。上限は spec と同じ（組ごと 180秒、goto・reload から判定まで 120秒、retry なし、1ブラウザずつ）。
- tool：Node 26.12.0・Bun 1.4.3・Playwright 1.64.1（`mise latest`・`npm view @playwright/test version` で最新、検証済み）。mise の実体の path で実行した。

```bash
/Users/mutoakio/.local/share/mise/installs/node/latest/bin/node /Users/mutoakio/Documents/formicarium/.artifacts/u6-recipe-runtime/acceptance/pages-acceptance.mjs chromium
```

### 結果（検証済み。生の出力は `.artifacts/u6-recipe-runtime/acceptance/pages-chromium-2026-10-19T0831Z.json`）

| ブラウザ | lang | 訪問 | verdict | baseline_error・fix_error | page COI・SAB・SW 制御 | coepCredentialless | 端末 | 時間 |
|---|---|---|---|---|---|---|---|---|
| Chromium 156.0.8078.4 | en | 初回 | unreproduced | 両方 `/vivarium/repro/biome/migrate-override-bracket-spacing/fixture/.prettierrc returned HTTP 404` | true・true・true | false | 作られず | 1.2s |
| Chromium 156.0.8078.4 | en | 再訪問 | 同上 | 同上 | true・true・true | false | 作られず | 0.3s |
| Chromium 156.0.8078.4 | ja | 初回 | 同上 | 同上 | true・true・true | false | 作られず | 0.8s |
| Chromium 156.0.8078.4 | ja | 再訪問 | 同上 | 同上 | true・true・true | false | 作られず | 0.2s |

- 環境：macOS（darwin 27.0.0 arm64）。ELF の取得は起きていない（`fetch.*` の印なし）。console の error は `Failed to load resource: … 404` だけ。
- **期待（baseline=reproduced、fix=corrected）と違うので、指示どおりここで止めた。** Firefox・WebKit の公開 site の実行と、(b) ローカルの deployed-shape の再実行はしていない（未実行）。

### 原因（検証済み・ドキュメント根拠）

- `curl` で公開 site の `fixture/.prettierrc` は 404、`fixture/biome.json` は 200（3 bytes）、`_formicarium/assets.json` は 200（検証済み）。ローカルの `docs/doc_build/…/fixture/` には `.prettierrc`（70 bytes）がある（検証済み）。
- deploy-docs の `actions/upload-pages-artifact@fc324d35…`（v5.0.0）の `action.yml`（`gh api` の GET で読取り）は、入力 `include-hidden-files`（既定 `false`）が false のとき tar に `--exclude=.[^/]*` を付け、`.` で始まる file を artifact から外す（ドキュメント根拠）。deploy-docs はこの入力を渡していない（検証済み）。そのため Pages に `.prettierrc` が載らない。
- ローカルの `docs/doc_build` の中の `.` で始まる file は、この1つだけ（`find`、検証済み）。
- `check-site` は upload の前の dir を見るので、この除外を検出できない。ローカルの deployed-shape の spec と回帰の job も `serve-repro.ts` で dir を直接返すので検出できない（code の読取りからの読み。推測を含む）。

### 人間の判断が要ること

- 直し方（どれも vivarium の変更と PR・merge・deploy が要る）：
  - A. deploy-docs の upload に `include-hidden-files: true` を足す（今の site の dotfile はこの1つだけ。`.git`・`.github` は action が常に外す）。
  - B. fixture を `.` で始まらない名前で site に置き、page が guest の中の `/work/app/.prettierrc` へ写す（guest の中の path は同じなので fixture の digest は変わらない見込み＝推測）。
  - C. `check-site` か workflow の試験に「site に `.` で始まる file があり、upload がそれを外す」ことの検査を足す（A・B のどちらとも組み合わせる）。
- C10 の証拠・Step 19 の記録は、直した後の W5 の合格を待って作る。

## Step 18a：公開 site の dotfile の欠落の修正（items 1–4、2026-10-19、main session からの委任）

人間の回答「AとCをお願い致します」による。Step 18a の欄はチェックしていない（item 5 の push・PR と、merge・deploy の後の W5 のやり直しが残る）。push・GitHub への書込みはしていない（GitHub は GET だけ）。

### 1. bookmark（検証済み）

- `jj git fetch` の後、`main@upstream` は `7a621d39`（#542）のまま。`jj new 'main@upstream'` の上に bookmark `fix/pages-include-hidden-files` を作った。

### 2. 検査の設計（C）

- `check-site` は upload の前に動くので、upload の step 自身の設定を読む：`readUploadSettings()` が `.github/workflows/deploy-docs.yml` を `Bun.YAML` で読み、`actions/upload-pages-artifact@` の step がちょうど1つあることを確かめ（0・2以上は `INVALID_INPUT`）、`with.include-hidden-files` が `true` か `'true'` かを返す（action は入力を文字列 `'true'` と比べる）。workflow の command（`--mode check-site --site docs/doc_build`）は変えない。別の CLI 引数にしなかった理由：引数と upload の設定の2か所に同じ値を書くと食い違いうるため、1か所（upload の step）だけを正とした。
- `checkSite(siteDir, summaryPath, upload = readUploadSettings())`：site の中で path の一部が `.` で始まる file を一覧（`SiteReport.hiddenFiles`、site からの相対 path、整列済み）にし、`uploadDropsPath()` で upload が外すもの（`include-hidden-files` が false なら `.` で始まる部分を持つ path すべて、true でも `.git`・`.github` の下）があれば `VERIFY_FAILED` で、その path と設定を message に出す。一覧は console（`Hidden files: …`）と job summary にも出す。試験は3番目の引数で設定を明示して渡す。

### 3. RED（直す前、検証済み）

```bash
/Users/mutoakio/.local/share/mise/installs/bun/1.4.3/bin/bun test docs/scripts/__tests__/workflows.test.ts docs/scripts/__tests__/stageFormicariumAssets.test.ts
```

- 結果：`33 pass, 2 fail`（35 tests, 220 expect）。失敗の2件：
  - `deploy-docs … > uploads the hidden files the site ships, such as the recipe fixture .prettierrc (Step 18a)`：`Expected: true / Received: undefined`。
  - `checkSite against the Pages upload of hidden files (Step 18a) > a site with a fixture dotfile passes under the deploy-docs upload setting`：`StageError: the Pages upload (include-hidden-files: false) would drop repro/biome/migrate-override-bracket-spacing/fixture/.prettierrc`。
- 実の site でも：`bun docs/scripts/stage-formicarium-assets.ts --mode check-site --site docs/doc_build` は exit 1、同じ message（検査が今回の欠落を見つけることを確認）。

### 4. 修正（A）と GREEN（検証済み）

- deploy-docs の `Upload Pages artifact` の `with` に `include-hidden-files: true` を足した（理由の comment 付き）。
- 同じ command：`35 pass, 0 fail`（221 expect）。check-site：`Site: 235579028 bytes, 2 coi-serviceworker copies, 2 formicarium bundles.` と `Hidden files: repro/biome/migrate-override-bracket-spacing/fixture/.prettierrc.`、exit 0。
- 足した試験（stageFormicariumAssets.test.ts の新しい describe の6件と workflows.test.ts の1件）：dotfile の一覧と保持の合格、false で外れる file の名前付きの失敗、true でも `.git`・`.github` の下は失敗、dotfile の無い site は設定によらず合格、workflow の読取り（無い・`true`・`'true'`・step 0件で例外）、deploy-docs の実の設定で fixture の dotfile が通ること。

### action.yml（ドキュメント根拠：`gh api -X GET … repos/actions/upload-pages-artifact/contents/action.yml?ref=fc324d3547104276b827a68afc52ff2a11cc49c9`）

- 入力 `include-hidden-files` の説明：隠し file・dir（`.` で始まるもの）を含める。`.git` と `.github` はどちらにしても外す、と書かれている。既定 `"false"`。
- Linux・macOS（gtar）・Windows の3つの tar の step はどれも `--exclude=.git --exclude=.github` を常に付け、`inputs.include-hidden-files != 'true'` のときだけ `--exclude=.[^/]*` を足す。`--dereference --hard-dereference` も付く。続けて `actions/upload-artifact@bbbca2dd…`（v7.0.0）で tar を上げる。
- tar の `--exclude` が path のどの部分にも当たること（`.git` が深い dir にあっても外れること）は GNU tar の既定の振舞いからの読み（推測）。検査はこの読みに合わせて path のどの部分でも判定する（厳しくする向き）。

### site の dotfile の一覧

- 既存の `docs/doc_build`（2026-10-19 14:39 JST に作ったもの）を使った。作り直しは `repro:build`（Rust の wasm を含む）が要り重いので行っていない。`find docs/doc_build -name '.*'` の結果は1件だけ：`repro/biome/migrate-override-bracket-spacing/fixture/.prettierrc`（検証済み）。check-site の一覧も同じ1件。
- この site は #542 の merge の前に local で作ったもので、大きさは 235579028 bytes、CI の run 39222708344 の 235579557 bytes と 529 bytes 違う（検証済み）。#542 の内容と同じ site かは確かめていない（未検証）。違いの原因は未調査（推測：build の時刻や生成物の違い）。merge の後の deploy-docs の job summary の `Hidden files kept by the upload` で、CI の site の一覧を確かめる。

### 実行した検査（1つずつ、検証済み）

| command | 結果 |
|---|---|
| 上の bun test（2 file） | RED 33 pass・2 fail → GREEN 35 pass・0 fail |
| `mise run ci:docs-unit` | 206 pass、1 skip、0 fail（207 tests、13 files、636 expect）。skip は既存の `formicariumTypes: NOT MEASURED … FORMICARIUM_LOCAL_TARBALL is not set`（合格ではない）。出力の確認のため2回実行した |
| `mise run docs:check` | 73 files、修正なし、1 info（`biome.json` の schema 2.5.12 と CLI 2.5.15 の違い。既存で今回の範囲外のため直していない） |
| `/Users/mutoakio/.local/share/mise/installs/actionlint/1.7.12/actionlint -shellcheck …/shellcheck/0.11.0/shellcheck-v0.11.0/shellcheck` | 出力なし、exit 0（actionlint 1.7.12 は `mise latest` で最新） |

- bun 1.4.3（`mise latest bun` で最新）を mise の実体の path で実行した。

### vivarium の変更（commit `cdf61f15`、change `ulrkwttl`、bookmark `fix/pages-include-hidden-files`、親 `7a621d39`）

| file | SHA256 |
|---|---|
| `.github/workflows/deploy-docs.yml` | `e1a5b361778b9d95a6acb7c69bd21f8b18605929d3b9474268a26bed01f41fef` |
| `docs/scripts/stage-formicarium-assets.ts` | `e596c06749655fa6f9b70f239a5595dad67f09d45dc034c91e80c4c2d5fb8f19` |
| `docs/scripts/__tests__/stageFormicariumAssets.test.ts` | `e7c7f66b3038833422a99c9f34d89010f1da2fd12d2a793a5fe9943caa55963e` |
| `docs/scripts/__tests__/workflows.test.ts` | `9ddecbdb8fd29d3b69847b4bb5b59b8b77735b4a57cb0b238f8ec07ed5fbd870` |

- commit message：`fix(docs): upload the dotfiles the Pages site ships`（本文に原因・変更・試験、末尾に `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`）。

### 残り（未実施）

- item 5：fork への push と上流への PR は、内容を示して人間の承認を受けてから。merge と deploy の後に、Step 18 の W5（公開 site、3ブラウザ × en・ja × 初回・再訪問）と C10 の証拠をやり直す。

## Step 18a の完了と Step 18 の W5・C10、Step 19（2026-10-19、main session）

### Step 18a の push・PR・merge（検証済み）

- 人間の承認（「はい、お願いします。」）の後、`jj git push --remote origin --bookmark fix/pages-include-hidden-files`（commit `0ca00693b10a28f400c7c012ec6c572b04a8f8c5`。署名は push のときに付き、`cdf61f15` から変わった）。上流の PR [aletheia-works/vivarium#544](https://github.com/aletheia-works/vivarium/pull/544) を作った。PR の head は `0ca00693…`、commit 1件、GitHub の署名の確認は `verified: true`・`reason: valid`。
- 人が merge した。`jj git fetch` の後の `main@upstream` は `dcf959a1541a6cd1d7bc135e12baf79c8f4e27cd`（#544）。`jj diff --from main@upstream --to fix/pages-include-hidden-files --stat` は 0 file。`jj rebase -s @ -d main@upstream`、`jj abandon`、`jj bookmark delete` で片付けた。fork の branch は GitHub が merge のときに消していた（`gh api …/branches/fix/pages-include-hidden-files` が 404）。

### deploy-docs と Pages（検証済み）

- deploy-docs の run 39233229635（`dcf959a1`、push）：build 09:51:55–09:52:58Z、deploy 09:53:02–09:53:32Z、両方 success。build の log：`Staged biome-migrate-override-bracket-spacing: 225871731 bytes`、`Site: 235579557 bytes, 2 coi-serviceworker copies, 2 formicarium bundles.`、`Hidden files: repro/biome/migrate-override-bracket-spacing/fixture/.prettierrc.`。upload は `include-hidden-files: true` で、tar の一覧に `./repro/biome/migrate-override-bracket-spacing/fixture/.prettierrc` が入り、artifact は 72,876,601 bytes。log の後ろに出る `include-hidden-files: false` は action の中の `actions/upload-artifact` の入力で、tar はその前に作られている（action.yml の読取りによる）。
- `curl https://aletheia-works.github.io/vivarium/repro/biome/migrate-override-bracket-spacing/fixture/.prettierrc` → `200`、70 bytes、中身は `{"overrides":[{"files":["*.js"],"options":{"bracketSpacing":false}}]}`。
- site の大きさは 235,579,557 bytes（上限 1,073,741,824 bytes）、deploy の時間は build 63秒・deploy 30秒（NFR6.4）。

### W5：公開 site の受入（検証済み）

`.artifacts/u6-recipe-runtime/acceptance/pages-acceptance.mjs`（Step 18 で作った一回限りの script。変えていない）を、Node 26.12.0・Playwright 1.64.1 で1ブラウザずつ main session から実行した。上限は spec と同じ（組ごと 180秒、goto・reload から判定まで 120秒、retry なし）。

```bash
/Users/mutoakio/.local/share/mise/installs/node/latest/bin/node /Users/mutoakio/Documents/formicarium/.artifacts/u6-recipe-runtime/acceptance/pages-acceptance.mjs chromium
```

| ブラウザ | lang・訪問 | verdict | baseline_error・fix_error | goto・reload から判定 | 結果 |
|---|---|---|---|---|---|
| Chromium 156.0.8078.4 | en 初回・再訪問 | reproduced・reproduced | null・null | 17.2s・4.1s | passed |
| Chromium 156.0.8078.4 | ja 初回・再訪問 | reproduced・reproduced | null・null | 6.2s・4.1s | passed |
| Firefox 157.0 | en 初回・再訪問 | reproduced・reproduced | null・null | 13.7s・9.6s | passed |
| Firefox 157.0 | ja 初回・再訪問 | reproduced・reproduced | null・null | 12.1s・9.7s | passed |
| WebKit 27.2 | en 初回・再訪問 | reproduced・reproduced | null・null | 5.4s・5.2s | passed |
| WebKit 27.2 | ja 初回・再訪問 | reproduced・reproduced | null・null | 5.3s・4.9s | passed |

- 12件すべてで、page の `crossOriginIsolated`・SharedArrayBuffer・service worker の制御が true、`coepCredentialless` は false、2端末とも ready、4つの command の transcript と P2 の印が揃い、子の Worker（Chromium 31、Firefox・WebKit 32）まで分離されていた。runtime.extras の pack・fixture・build key・commit は下の identity と一致した。**期待どおり：3ブラウザ × en・ja × 初回・再訪問で baseline = reproduced、fix = corrected。**
- 生の出力：`.artifacts/u6-recipe-runtime/acceptance/` の `pages-chromium-2026-10-19T0959Z.json`、`pages-firefox-2026-10-19T1000Z.json`、`pages-webkit-2026-10-19T1001Z.json`。
- **観測（合否に入れない）**：Firefox の初回訪問だけ、console に Google Fonts（`fonts.gstatic.com`）の `downloadable font: download failed … status=2152398850` が出た（en 5件、ja 7件。再訪問は0件。Chromium・WebKit は0件）。U6 の spec も console の error を記録するだけで合否に使わない。原因は、初回に coi-serviceworker が page を読み直すときに取得中の font が中断されたためと読める（推測。status の値は NS_BINDING_ABORTED。確かめていない）。表示の font の問題で、判定・分離には影響していない。
- 実機 Safari は未検証（別の証拠なし。WebKit の行は Playwright の WebKit 27.2）。
- 環境：macOS（darwin 27.0.0 arm64）。tool は `mise latest` の値と同じ最新（Node 26.12.0、Bun 1.4.3、Playwright 1.64.1）。

### CI の結果（検証済み）

- repro-regression の run 39233229665（`dcf959a1`、push）：`regression (chromium)` 09:51:54–09:57:08Z、`regression (firefox)` 09:51:55–09:56:09Z、`regression (webkit)` 09:51:55–09:56:20Z、すべて success。各 job の log に pin mode の staging（baseline・fix の ELF・build-info・catalog の digest が accepted と一致）と `29 passed`（failed・flaky なし）がある。job の 20分の中に収まった（最長は chromium の 5分14秒）。
- 29件に U6 の recipe の6件（U6 の spec 3件、`repro.spec.ts`・`repro-ja.spec.ts`・`verdict-capture.spec.ts` の各1件）が入ることは、`dcf959a1` の tree で `CI=true bun x playwright test --list --project=<browser>` により確かめた（3ブラウザとも29件、うち recipe の6件。一覧だけで実行はしていない）。
- coverage の artifact `u6-coverage-39233229665`（id 12177419389、digest `sha256:0275e519…85e7`）：**passed、行 coverage 83.39%（2079/2493）、下限 80%**。`stage-formicarium-assets.ts` は #544 で増えて 883/949（93.05%）。ほかは Step 18 の手元の値と同じ（`generate-recipes-index.ts` 41.94%、`formicarium_terminal.ts` 100%、`formicarium_terminal_element.ts` 92.17%、`repro.ts` 90.09%、`verdict.ts` 100%、`coi-serviceworker-pin.ts` 97.37%）。

### host の行のログ（検証済み。`dcf959a1` の tree、working copy は空）

| command | 結果 | log |
|---|---|---|
| `bun test docs/scripts/__tests__/recipesIndex.test.ts` | 15 pass・0 fail（86 expect） | `evidence-c10/host-contract-schema.log` |
| `jj file list` の各 file に `grep -IinH terrarium` | 4件、すべて歴史の記述（`CHANGELOG.md` の #537 の項、Contract v1 の en・ja の revision 4、`recipe.schema.json` の `expected_runtime` の説明） | `evidence-c10/host-active-reference-cleanup.log` |

`CHANGELOG.md` の1件は、Step 16 の後に release-please が足した #537 の項で、現役の参照ではない。

### C10 の AcceptanceEvidence（検証済み）

- 組み立ての script：`.artifacts/u6-recipe-runtime/evidence-c10/tools/assemble.ts`（第一者、bun で実行）。既にある log だけを読み、identity を vivarium の `verdict.ts` の `canonicalJson`・`fixtureSha256`・`commandSha256` で計算し、Release の ELF・build-info を accepted と照合し、各行の log がその結果を示すことを確かめ、必須の集合（C06/C10 の U6 の profile、2026-10-18 の改訂）に欠落・重複が無いことを確かめる。1つでも合わなければ exit 1 で、何も出さない。
- 実行：`bun tools/assemble.ts > acceptance-evidence.json` → exit 0。出力は `.artifacts/u6-recipe-runtime/evidence-c10/acceptance-evidence.json`、SHA256 `559026445b2c1d90b6a7323783c73be889dd9b7ddf36e41336e875281cce93d2`、evidenceId `u6-recipe-runtime-dcf959a1541a-2026-10-19`、recordedAt `2026-10-19T10:06:20.039Z`。**review-01 の後に作り直した（下の「review-01 の指摘の修正」。今の値はそちら）。**
- 最初の実行は2つの理由で exit 1 だった：(1) CI の log の「failed」の検査が staging の行の `0 failed` に当たった（script の誤り。`[1-9]` で始まる数だけに直した）。(2) 上の Firefox の font の console error を失敗として数えた（spec の合否の条件に無いので、`observations` に残す形に直した）。どちらも基準を緩めたのではなく、spec の条件に合わせた。
- identity：

| field | 値 |
|---|---|
| sourceCommit（vivarium） | `dcf959a1541a6cd1d7bc135e12baf79c8f4e27cd` |
| formicariumSourceCommit・formicariumPackSha256（pin file） | `0af7b2396eebd2444a6e6f1d9b8d9f6c376cc7e7`・`29cb0656241daf224b32390f22cc2c1abd17f10dd8bcf37aed107463d711398b` |
| catalogSha256（`{baseline, fix}` の正規化 JSON） | `ab446c7db1faf69a44304a7d9d13716f6609eb5011ae77a48a6167d73d072d7b` |
| fixtureSha256・commandSha256 | `1bdadfe5e041ef444de8f829aa1cd1691cc38908b0f4508eca3a0ffdcde5e5f9`・`4fc8bf53533ef0c29dfa2a59de59d848c334b7d31b51fa71d5940479e02fc9f4` |
| baseline の buildKey・ELF・build-info | `086287f8…322c`・`97c88a1c…eb7a6`・`80f07338…f0d5` |
| fix の buildKey・ELF・build-info | `dabb518b…c24d`・`364ef17d…ff84`・`00bb12d6…f357` |

- checks：必須の19行すべて `passed`。

| check | environment | log |
|---|---|---|
| recipe-identity・reproduction-comparison・terminal-compatibility・browser-coi | chromium・firefox・webkit | 各ブラウザの公開 site の `pages-*.json` |
| contract-v1 | chromium・firefox・webkit | CI の `job-<browser>.log`（`verdict-capture.spec.ts` を含む 29 passed） |
| fixed-build-reuse | host | deploy-docs の build の log（Release の accepted の ELF をそのまま staging。再 build なし） |
| contract-schema | host | `host-contract-schema.log` |
| active-reference-cleanup | host | `host-active-reference-cleanup.log` |
| coverage-80 | host | CI の `u6-coverage.json`（83.39%）（2026-10-22 の注記：今は各行に `check-logs/<check>@<environment>.json` があり、coverage-80 は run の記録・artifact の記録も source に持つ。下の「Step 20・21」の節） |

- （review-01 の前の記述）`outputs` は16件（上の log、coverage の4 file、`--list` の3 file）の path と SHA256。`deployedIdentity` は入れていない（U6 の identity には site の inventory の定めが無い。site の inventory は U8 の SiteEvidenceIdentity）。今は `outputs` 46件で、`deployedIdentity` も入れた（下の「Step 20・21」の節）。`unverified` に実機 Safari を書いた。
- 追加の field（`checkLogs`・`sources`・`observations`・`unverified`）は、C10 が未知の field を受け付ける形で足した。共有の schema は U9 の所有で、U9 の照合の実装は未検証。

### 切戻しの手順（NFR8.5、ドキュメント根拠）

- 問題が出たら、#542（pin と recipe の active 化）を revert する PR を作る。pin file が無くなると recipe は pending に戻り（`generate-recipes-index.ts`）、site と regression の対象から外れる。#541（accepted）まで戻す必要があれば、続けて revert する。
- pin の無い tree の site build は、#542 の前の main（`1188ec80`）の deploy-docs の run 39201684062 で成功している。revert した tree そのものでの site build は行っていない（未実施）。

### Step 19：文書と追跡

- `traceability.json`：FR10–FR12、U6 の NFR（2.1–8.5）、BR1.1–BR8.1 を OK とし、FR16（terrarium の repository の退役）を U9 の範囲の N/A とした。Code Generation の target は workspace の実在の file だけが通るので、OK の行の target はこの code-summary とし、vivarium の具体の file は行ごとの `detail` に書いた。`aidlc engine sensor-traceability --output-path … --stage-slug code-generation` → `pass: true`、findings 0（検証済み）。
- `source-manifest.json`：vivarium はこの intent の記録した repo ではなく（Units Generation の承認の後は足せない）、formicarium の application source は U6 で変えていない（U2 の Worker の bundle は U2 の記録）。そのため `writes` は空にした。
- vivarium の U6 の変更（#537 `b6ce42a9`、#541 `e240d0e0`、#542 `7a621d39`、#544 `dcf959a1`）の file と、`dcf959a1` の時点の各 SHA256 を下に示す。一覧の元は `git diff-tree`（読取り）で、`.artifacts/u6-recipe-runtime/evidence-c10/u6-vivarium-files.tsv`（SHA256 `20d949f7dc2614d775c3c75c07f1665532b26cf8532b5599081e6ae1be57f163`）にも残した。#538・#539・#540 は U5 の変更なので入れていない。同じ file が複数の PR に出る行の SHA256 は、どれも `dcf959a1` の時点の値。

| PR | 変更 | file | `dcf959a1` の SHA256 |
|---|---|---|---|
| #537 | M | `.claude/rules/recipe-authoring.md` | `149075f81ba8f78948ebdc8735c4775f3c8d160fd39b9160c6400efbc09f6697` |
| #537 | M | `.github/workflows/deploy-docs.yml` | `e1a5b361778b9d95a6acb7c69bd21f8b18605929d3b9474268a26bed01f41fef` |
| #537 | M | `.github/workflows/fixed-guest-bump.yml` | `5e6921775e47a2ee97e2868683da1a809485bac8984975182241b9706d1324a2` |
| #537 | M | `.github/workflows/repro-regression.yml` | `547aeb8d28c01ddc908125ca91571bb6e666d87426bdc2d113c6aaab58808077` |
| #537 | M | `.gitignore` | `1191986d09f7d5f60a816459b370edec67228da1ef542fdf017591c4e9308970` |
| #537 | M | `docs/biome.json` | `68be1c8efda9e9a5c8376713f7ba8f01379c178f4936d31a9fbd822183ea640c` |
| #537 | A | `docs/scripts/__tests__/coiServiceWorkerPin.test.ts` | `5c491bacd001732017d2e28487dcfdc7b4286824baa204825a332b079600a49b` |
| #537 | A | `docs/scripts/__tests__/fixtures/coi-serviceworker.js` | `d12bd536e27e39a773d7dc7adb1a1167d24002293e97ac81c995fb00cf8d4d5a` |
| #537 | A | `docs/scripts/__tests__/formicariumTypes.test.ts` | `92792a4b9d3fd2b5e7bc4476a4ceb6ee56f365ae30ac2a1b670dbcdaeb7479e1` |
| #537 | A | `docs/scripts/__tests__/layer1Bundle.test.ts` | `82619130f23f8ffcd418158da12ff231e30918feaf5512d6ba350b92cb9ef182` |
| #537 | M | `docs/scripts/__tests__/recipesIndex.test.ts` | `1356ada7a3df6fc193cca29a22aff1a939a8caf6ef8f49d136a03d0756237936` |
| #537 | M | `docs/scripts/__tests__/reproPreload.test.ts` | `93f7577c5ee8cbccffaa833669a5ecd21dcecb28db979613c10472270376cef5` |
| #537 | M | `docs/scripts/__tests__/resolveReproFile.test.ts` | `49616eff80f9f569cbb90dcc7d853275e9e85a3308f312110145f71a7244ae35` |
| #537 | A | `docs/scripts/__tests__/stageFormicariumAssets.test.ts` | `e7c7f66b3038833422a99c9f34d89010f1da2fd12d2a793a5fe9943caa55963e` |
| #537 | D | `docs/scripts/__tests__/terrariumPins.test.ts` | （削除） |
| #537 | A | `docs/scripts/__tests__/workflows.test.ts` | `9ddecbdb8fd29d3b69847b4bb5b59b8b77735b4a57cb0b238f8ec07ed5fbd870` |
| #537 | A | `docs/scripts/coi-serviceworker-pin.ts` | `b4f45a5a15f937b5d70042a9715619058e62d4f139a6e200c5b96b99335d2c02` |
| #537 | M | `docs/scripts/generate-recipes-index.ts` | `4b82554c44159560d4f6a42f50e738e3a440ac8e875622d4d4498547fd3e7a5d` |
| #537 | M | `docs/scripts/generate-repro-i18n.ts` | `265e5afc00745e50ca3d838e8281fe2230b314898e483ca88c488e275026a5f3` |
| #537 | M | `docs/scripts/generate-repro-pages.ts` | `875fbf155ffe6d5e9ca776b2810547044dca6f7525bbdab4037d9a7be9e53a8b` |
| #537 | M | `docs/scripts/repro-dev-middleware.ts` | `dc5958aba9ecf3a4faf8b3216fe9a335e768d06a9857bbbd589eea231266a085` |
| #537 | M | `docs/scripts/serve-repro.ts` | `e00ad48058445f966bd62db577f68a65e288c81874192bd5b4a13835f6239b1f` |
| #537 | A | `docs/scripts/stage-formicarium-assets.ts` | `e596c06749655fa6f9b70f239a5595dad67f09d45dc034c91e80c4c2d5fb8f19` |
| #537 | D | `docs/scripts/terrarium-proxy.ts` | （削除） |
| #537 | M | `docs/site/_data/projects.json` | `983ee0ae472ed1da4088b8d3fcc6fce04953effd6c1e14fb2cdecff653da7265` |
| #537 | M | `docs/site/en/spec/contract-v1.md` | `49dc94641a939326f058b5cdda8e6cb8551425e2729f0c9d344cbf38862a057a` |
| #537 | M | `docs/site/ja/spec/contract-v1.md` | `e0eeda284e6c7b49e9ef19c66f9534942da92a8b30e150dc9b028a1c6b3f7ac0` |
| #537 | M | `docs/site/public/spec/recipe.schema.json` | `a42e41a2f0fcb11f109487f1fcdb8c2abae90d2ee3101546da5f353bb05900aa` |
| #537 | M | `scripts/bundle-layer1-pages.sh` | `36262c86c6cbf279bd20eeed27adafdfce0ddb2a17c37f66d571411244aa9895` |
| #537 | M | `src/layer1_wasm/README.md` | `4854da6d0ca9d4210c220311dd02239bbfd577cb6da0d32542edd5e8055d73db` |
| #537 | M | `src/layer1_wasm/_shared/README.md` | `c77b2dc9ad0fa42077b93798abe4df7919d4810707dd743cee5c98da4ff75e80` |
| #537 | A | `src/layer1_wasm/_shared/_test/formicarium_terminal.test.ts` | `497fdcc9ffa9f8e42597b8e7a6118ff3c87fe36c3408095b87977c5a2a5ea969` |
| #537 | A | `src/layer1_wasm/_shared/formicarium_terminal.ts` | `c3adf37f67b218499aee0d38e97fc711180d479634041fd9a46a5bb2c3ee96e7` |
| #537 | A | `src/layer1_wasm/_shared/formicarium_terminal_element.ts` | `3ef9c0e32c79bbb6a809c98ab5af07eb713827d3d483375360ee72dac04655da` |
| #537 | M | `src/layer1_wasm/_shared/style.css` | `a5324bc819429c1c29bd2ba70ddd84c04b5f67924c0b2613ac120d2477dfbb58` |
| #537 | D | `src/layer1_wasm/_shared/terrarium_loader.ts` | （削除） |
| #537 | A | `src/layer1_wasm/biome-migrate-override-bracket-spacing/README.md` | `56ed59c3190208fcf1ce8314e3f3e007e48e09500de6da3283067e00ed9c2206` |
| #537 | A | `src/layer1_wasm/biome-migrate-override-bracket-spacing/coi-serviceworker.js` | `d12bd536e27e39a773d7dc7adb1a1167d24002293e97ac81c995fb00cf8d4d5a` |
| #537 | A | `src/layer1_wasm/biome-migrate-override-bracket-spacing/fixture/.prettierrc` | `1b23df2d6dd2600f12909b3e3707063f4bfcfc10cb37143b6e3505a588c0f908` |
| #537 | A | `src/layer1_wasm/biome-migrate-override-bracket-spacing/fixture/biome.json` | `ca3d163bab055381827226140568f3bef7eaac187cebd76878e0b63e9e442356` |
| #537 | A | `src/layer1_wasm/biome-migrate-override-bracket-spacing/i18n.ja.json` | `a413d53289eae68cfc91d6cc322095befa90f9a2a36300e30e8d412de870a025` |
| #537 | A | `src/layer1_wasm/biome-migrate-override-bracket-spacing/page.en.html` | `e4c5c5797ff0d47fd0c9e83d6ecfb8687d45ba4bf4322e880ed5c320960adbfd` |
| #537 | A | `src/layer1_wasm/biome-migrate-override-bracket-spacing/recipe.json` | `17516d174503de67f83e977da1985989662d3ed854f93dcbc49d5f884ad0a934` |
| #537 | A | `src/layer1_wasm/biome-migrate-override-bracket-spacing/repro.ts` | `752e9d6795820279b6e7e90fe6bdf5baa3586402114712f395af7ced7a00b05c` |
| #537 | A | `src/layer1_wasm/biome-migrate-override-bracket-spacing/verdict.test.ts` | `0d83079872cb4fb6ec0c45bbbfc500e43d84a215907e524141ba84434fa7ec3e` |
| #537 | A | `src/layer1_wasm/biome-migrate-override-bracket-spacing/verdict.ts` | `f83a88746aae93a258670397ffc52fe8a5be430699e1c0afd76d5cba17e9ef2e` |
| #537 | M | `src/layer1_wasm/bun.lock` | `5622ea402f843c607f98d31779cdb371f963123d11104b5280bf8a1a2ccc2860` |
| #537 | M | `src/layer1_wasm/package.json` | `a39646e06c19a49eb2aa4a2f5dd86e5d099b78443f165959bd72bf5821cdf5b9` |
| #537 | M | `src/layer1_wasm/scripts/bump-upstream.ts` | `860ce45d65696db6529fd1c26f1cfc0abf63c310fcecb00a89adb53c47ecc1a7` |
| #537 | M | `src/layer1_wasm/scripts/page-templates.ts` | `438ec24c5ed198c3fcc1743ed5b6a948578d1f007e95f57b624649cea101818d` |
| #537 | M | `src/layer1_wasm/scripts/serve.ts` | `5ea3302b5e10fb5f4452f4a1c5c6ae7d0fd8f4cdd0b83d1d9872f3ae61d0402a` |
| #537 | A | `src/layer1_wasm/scripts/u6-coverage.test.ts` | `35d6a63028d590f1f389e24041e92618a832a202f3686be55bbf10ee5dcbee83` |
| #537 | A | `src/layer1_wasm/scripts/u6-coverage.ts` | `aa8dba5ed7d865c7a17c956266ba21df36552b9f8fdcba0879e65996c580d3fd` |
| #537 | A | `src/layer1_wasm/tests/biome-migrate-override-bracket-spacing.spec.ts` | `f7d7a0c97f589eb32271a4e46a2aa848a1edf4fab582e43cbe1e938af1c8bf90` |
| #537 | M | `src/layer1_wasm/tests/repro-ja.spec.ts` | `718c4d36fd060f0252d4c983185c7fedf1ad0986e2ed7c2e06e8158ea1b8fc32` |
| #537 | M | `src/layer1_wasm/tests/repro.spec.ts` | `7018ff53c8740e1077c3d7eb750577229d193010af97d19b56461facabeea72b` |
| #537 | M | `src/layer1_wasm/tests/verdict-capture.spec.ts` | `03f65ed38e2937917657eec158728a0b466198439e436b51af5469f745e7dc63` |
| #537 | M | `src/layer1_wasm/tsconfig.json` | `69dac5589910f3f4346616280d30d9c719009b0f29e0aef7c932422709a9cd7f` |
| #537 | A | `src/layer1_wasm/u6-coverage.json` | `24a82f289f6f5b345823f7dc317939ed2e8b1c458b3b48ad5a829f4ac1da710c` |
| #537 | M | `tools/fixed-guest-builder/README.md` | `0704d21ab67875c1309b3dc159cda21a3237991338ca1d45a0d141028769fa34` |
| #537 | M | `tools/fixed-guest-builder/src/bump.ts` | `fb90d9830964ab200a47a96cfdfc13280d29fb31729842f22c5affb8d57d4256` |
| #537 | M | `tools/fixed-guest-builder/src/cli.ts` | `2abbab47bb3b05438fee5502f90be403b933e35f2e3761422b8a26949e9c1558` |
| #537 | M | `tools/fixed-guest-builder/tests/bump.test.ts` | `7d2410b19fb856eb188e223ef7f3d4325af7e0ff5ae7d1d8a4562fd53c6a1e38` |
| #537 | M | `tools/fixed-guest-builder/tests/cli.test.ts` | `aecfde9eb53fee22b6789b2f2a5511414c2751c33d46dba87be47f90ca0dcae0` |
| #537 | M | `tools/fixed-guest-builder/tests/workflows.test.ts` | `7384018dd6fd2f1af55d6554b6c399e9ab96ce79113a20d58e5450c3a476030c` |
| #541 | M | `src/layer1_wasm/biome-migrate-override-bracket-spacing/README.md` | `56ed59c3190208fcf1ce8314e3f3e007e48e09500de6da3283067e00ed9c2206` |
| #541 | M | `src/layer1_wasm/biome-migrate-override-bracket-spacing/recipe.json` | `17516d174503de67f83e977da1985989662d3ed854f93dcbc49d5f884ad0a934` |
| #542 | M | `docs/site/public/api/projects.json` | `9adb6fb38ea530f46ab0efd87fde3f8e97abfe6bb776767622b60fe54051b330` |
| #542 | M | `docs/site/public/api/recipes.json` | `10adf262c618e4adfd5fea06d395b86c03ad4e732c998d5abe9c9c9b65fe8dde` |
| #542 | M | `src/layer1_wasm/README.md` | `4854da6d0ca9d4210c220311dd02239bbfd577cb6da0d32542edd5e8055d73db` |
| #542 | M | `src/layer1_wasm/biome-migrate-override-bracket-spacing/README.md` | `56ed59c3190208fcf1ce8314e3f3e007e48e09500de6da3283067e00ed9c2206` |
| #542 | A | `src/layer1_wasm/formicarium.pin.json` | `0e2ede9cb89a3ba61d5ad3cc99acfb518665fb93b0d8b3f86306012692db3d6c` |
| #542 | M | `src/layer1_wasm/tests/biome-migrate-override-bracket-spacing.spec.ts` | `f7d7a0c97f589eb32271a4e46a2aa848a1edf4fab582e43cbe1e938af1c8bf90` |
| #544 | M | `.github/workflows/deploy-docs.yml` | `e1a5b361778b9d95a6acb7c69bd21f8b18605929d3b9474268a26bed01f41fef` |
| #544 | M | `docs/scripts/__tests__/stageFormicariumAssets.test.ts` | `e7c7f66b3038833422a99c9f34d89010f1da2fd12d2a793a5fe9943caa55963e` |
| #544 | M | `docs/scripts/__tests__/workflows.test.ts` | `9ddecbdb8fd29d3b69847b4bb5b59b8b77735b4a57cb0b238f8ec07ed5fbd870` |
| #544 | M | `docs/scripts/stage-formicarium-assets.ts` | `e596c06749655fa6f9b70f239a5595dad67f09d45dc034c91e80c4c2d5fb8f19` |

### review-01 の指摘の修正（2026-10-19、main session）

review-01（NOT-READY、Major 2・Minor 10）に対して、Major の2件と、範囲の小さい Minor（R-04・R-05・R-08）を直した。

**R-01（各 check の log に identity の digest）**
- `assemble.ts` を、identity 全体の正規化 JSON の SHA256（`identitySha256`）を計算して証拠に載せる形に変えた。各行ごとに、log の記録 `evidence-c10/check-logs/<check>@<environment>.json` を書く。中身は check・environment・status・unit・sourceCommit・`identitySha256`、元の log の path と SHA256、元の log から読んだ事実。`checks[].logSha256` はこの記録の SHA256 にした。記録は全 check が成り立ったときだけ書く（1つでも合わなければ exit 1 で、何も書かない）。
- coverage-80 の記録は、CI の run 39233229665 の head が `dcf959a1` であること（`gh run list --commit dcf959a1…` で確認済み）と、coverage の4 file の SHA256 を持つ。host の2行の記録は、sourceCommit と、log から読んだ件数・一覧を持つ。
- 結果（検証済み）：`bun tools/assemble.ts > acceptance-evidence.json` → exit 0。**SHA256 `3939063d978c73e390d2bb0a7a25422e9b46f530313363b77225d08f861f7dba`**、`identitySha256` は `26a042306b12b59a86adc0f512b36ae171bf56b7fb05b0a214f6934a59a33c12`、recordedAt `2026-10-19T10:23:37.015Z`。19行すべて passed、記録は19件、`outputs` は37件。identity の値は前と同じ。

**R-02（BR6.3 の旧題材の Release の削除）**
- 承認と実行（ドキュメント根拠：この session の会話）：Step 17 の後、人間は削除を承認し、自分の権限の account で実行するよう求めた。永続の削除なので main session は自分では実行せず、GitHub の web 画面での削除の手順を示した。人間がその手順で Release 2件と tag を削除し、「はい、削除しました。」と答えた。
- 確認（検証済み、2026-10-19T10:22:33Z、GET だけ）：2件の tag（`guest-biome-15432368…66321`・`guest-biome-4751f68d…dd24d`）について、`releases/tags/<tag>` と `git/ref/tags/<tag>` はどちらも 404。Release ID の `releases/416115180`・`releases/416132048` も 404。旧の ELF・build-info の写しは formicarium の `.artifacts/migration-guest-build/` に残っている。
- Step 17 の節の「計画の欄はチェックしていない」は、その時点の記述である。上の削除の確認で Step 17 は完了した。

**R-04・R-05・R-08**
- R-04：`assemble.ts` は vivarium の `.git/HEAD` が `SOURCE_COMMIT` と同じであることを確かめるようにした（colocated の jj では、HEAD は working copy の親）。baseline・fix の catalog の SHA256（`20b78f3f…1412`・`df8feef3…0f10`）が、deploy-docs の log と CI の各 job の log にあることも照合する。
- R-05：`acceptance/pages-acceptance.mjs` と `evidence-c10/tools/assemble.ts` を、path と SHA256 で `outputs` に入れた。
- R-08：分離の条件に `workers.mainObserved > 0 && mainAllIsolated` と `workers.children > 0` を足した（記録の12行はすべて満たす）。`pages-acceptance.mjs` は W5 を実行した版のまま変えていない。合否の検査は `assemble.ts` 側で強めた。W5 の合否は spec より強い（verdict が reproduced、両方の error が null、子の Worker の分離、SW の制御も見る）。

**残した Minor（記録だけ）**（2026-10-22 の注記：その時点の記録。下のリストの R-03・R-06・R-07・R-09・R-10・R-11・R-12 は、末尾の「Step 20・21」の節と PR aletheia-works/vivarium#557〈merge `e4ef0dc4`〉で直した。）
- R-03：terminal-compatibility のブラウザの記録は、起動・実行・表示（2端末が ready、4つの command の transcript、CI の29件）だけを示す。C08 の API 互換（ReadyDetail・ExitDetail、run の逐次化、非0 exit、disconnect）は bun の単体試験（`formicarium_terminal.test.ts`、Step 14 と CI の chromium の coverage の step）で確かめたもので、ブラウザの行の記録には入れていない。
- R-06：`deployedIdentity` は U6 の identity に定めが無いので入れていない。U9・契約の所有者に確認する項目。
- R-07：pin の formicariumSourceCommit・pack と、B1 の C06（U4 の受入の候補）との比較は記録していない（未検証）。
- R-09：Firefox の font の原因は推測のまま。
- R-10：CI の型の照合（`formicariumTypes`）は skip のまま（NOT MEASURED）。
- R-11：実装の防御の3点（assets.json の data: URL、起動の失敗の後の dispose、check-site での `guests/*/accepted.json` の検出）は、vivarium の新しい PR が要るので U6 の範囲外とした。後の提案にする。
- R-12：Release の署名付き URL の扱いは、前からの別の提案のまま。

### 人間の判断が要ること

1. U6 のレビューの依頼と、その後の checkpoint の承認。
2. 前から残っている提案（AssetStager の取得の最終 URL の署名付きの query を log・job summary から外す。別の session の提案の card）は、U6 の範囲外のまま。（2026-10-22：下の Step 21 の R-12 で直した。）

## Step 20・21：review-03 の Minor 11件の修正（2026-10-22、人間の指示「minor11件の対応をお願いします。全て修正しましょう。」）

### vivarium の修正（Step 21、vivarium の `main@upstream` `dee1ba5e` の上の change。PR aletheia-works/vivarium#557、head `b28d1c89`、1 commit・6 file、署名あり、merge `e4ef0dc4`〈検証済み：GET、2026-10-22〉）
- 不具合の修正の順で、どれも先に試験の失敗を観測してから直した（検証済み）。
  - R-11 (a)：`src/layer1_wasm/_shared/formicarium_terminal.ts` の `loadFormicarium` で、assets.json の entry を解決した URL が `_formicarium/` の下にあることを確かめ、違えば `ASSET_LOAD` で拒否する（`data:text/javascript,…` は path の検査を通るが `_formicarium/` の外になる）。試験：`builds the formicarium URLs …` に data: の entry の拒否と import されないことを足した。直す前は fail。
  - R-11 (b)：同じ file の `boot()` の catch で、作った session を dispose する。試験：`disposes the session when registering the guest fails`（新規）。直す前は fail。`repro.ts` の最後の catch は、pane の `textContent` を入れ替えると端末の要素が外れ、`disconnectedCallback` が `dispose()` を呼ぶので、変えていない（`formicarium_terminal_element.ts` の100–102行を読んで確かめた）。
  - R-11 (c)：`docs/scripts/stage-formicarium-assets.ts` の `checkSite` で、`guests/<role>/accepted.json` があれば `VERIFY_FAILED`。試験：`refuses a local-staging accepted.json in the site`（新規）。直す前は fail。
  - R-12：同じ file の `fetchAsset` で、log と job summary の行の `source` に、取得の最終 URL から query を落とした値を書く（digest の照合は変えない）。試験：redirect の試験に `?sig=…&jwt=…` の行を足した。直す前は fail。実際の pin mode の staging でも、log の URL に `?` が無いことを確かめた。
  - R-10：`.github/workflows/repro-regression.yml` の pin mode の staging の次に「Check the formicarium types against the pinned tarball」を足した。pin の版を `npm pack` で取り、pin の `tarballSha256` と `sha256sum --check --strict` で照合してから、`FORMICARIUM_LOCAL_TARBALL` を渡して `formicariumTypes.test.ts` を動かす。試験：`docs/scripts/__tests__/workflows.test.ts` に step の位置と中身の試験を足した。古い workflow で fail、新しい workflow で pass。同じ command を手元で1回実行し、tarball の SHA256 が一致し（OK）、型の照合が 1 pass・0 fail だった。
- 確認（vivarium、1つずつ、2026-10-22）：`bun test _shared/_test/formicarium_terminal.test.ts` 19 pass、`bun test scripts/__tests__/stageFormicariumAssets.test.ts` 28 pass、`bun test scripts/__tests__/workflows.test.ts` 9 pass、`mise run ci:docs-unit` 208 pass・1 skip（`formicariumTypes`。手元では tarball の変数が無い。CI では上の step で動く）・0 fail、`mise run docs:check` exit 0、`mise run repro:typecheck` exit 0、`mise run actions:check` exit 0、Biome（docs の 2.5.15）で Layer 1 の2 file に指摘なし。U6 の Playwright の spec を、`mise run repro:build` と pin mode の staging の後に `npx playwright test tests/biome-migrate-override-bracket-spacing.spec.ts --workers=1 --retries=0`（Playwright 1.64.1、3ブラウザ）で実行し、9 passed（1.0m）。
- 手元の `src/layer1_wasm/playwright-report`（追跡されない古い report）が i18n の試験に当たったので、formicarium の `.artifacts/u6-recipe-runtime/vivarium-playwright-report-old` に移した（消していない）。
- vivarium の Biome は 2.5.15 のまま（最新は 2.6.2）。U6 の範囲外なので上げていない。

### 証拠の修正（Step 20、formicarium の `.artifacts/u6-recipe-runtime/`、外への書込みなし）
- vivarium の `dcf959a1` の jj workspace（`u6-dcf959a1`、`.artifacts/u6-recipe-runtime/vivarium-dcf959a1`）を作り、`assemble.ts` の `VIVARIUM` と `verdict.ts` の import をそこへ向けた。元の checkout の `.git/HEAD` の代わりに、workspace の `@-` が `SOURCE_COMMIT` であり、working copy に変更が無いことを `jj` で確かめる。
- R-03：その workspace で `bun test --reporter=junit … formicarium_terminal.test.ts`（bun 1.4.3）を実行し、`evidence-c10/host-terminal-unit.log`（18 pass・0 fail・exit=0）と `host-terminal-unit.junit.xml`（18件の試験名）を保存した。terminal-compatibility の3行は、この2 file を source に持ち、facts の `unitTests` に試験名を書く。行の意味は、「ブラウザでの起動・実行・表示（pages の log と CI の29件）」と「単体試験での C08 の API 互換（ReadyDetail・ExitDetail、run の逐次化、非0 exit、disconnect）」の2つ。
- review-03 の新1（coverage-80）：`gh run view 39233229665` の出力（`ci-39233229665/run-view.json`。headSha `dcf959a1…`・push・success）と artifact の記録（`coverage-artifact.json`。id 12177419389、digest `sha256:0275e519…5e7`、workflow_run の id と head_sha）を保存した。artifact の ZIP を読取りで取り、その SHA256 が digest と一致し、中の4 file が保存済みの coverage の4 file と byte で一致した。分母の `u6-coverage-denominator.json` の SHA256 `24a82f28…710c` は、vivarium の `dcf959a1` の `src/layer1_wasm/u6-coverage.json` と一致した。`assemble.ts` は `headSha` を run の記録から読み、これらをすべて照合する。run の記録の commit を変えると exit 1（`coverage-80: run record`・`artifact record`）で何も書かないことを確かめた。
- R-06：C10 の `deployedIdentity` を入れた。中身は、deploy-docs の run 39233229635（headSha `dcf959a1…`・success）と、その commit の github-pages の deployment 7170705016（2026-10-19T09:52:58Z 作成、09:53:33Z に success、`https://aletheia-works.github.io/vivarium/`、log は同じ run）。Pages の artifact は期限切れで、run の artifact の一覧は0件。同じ日の 09:00〜11:00 の github-pages の deployment はこの1件だけなので、W5（09:59〜10:01Z）はこの配布に対して行われた。記録：`deploy-docs-run-view.json`・`pages-deployment.json`・`pages-deployment-statuses.json`・`deploy-docs-artifacts.json`（`outputs` に入れた）。
- review-03 の新3（404）：2026-10-21T20:35:24Z〜27Z に6つの GET（2つの tag の `releases/tags/<tag>`・`git/ref/tags/<tag>`、`releases/416115180`・`releases/416132048`）をもう一度行い、すべて 404 だった。`evidence-c10/old-release-404.log`（SHA256 `0ab76fbd6c0d935a6b31990153255787359067bedfa8d718cd8036c104a98d27`）に保存し、`outputs` に入れた。2026-10-19 の削除の承認と報告は、2件をまとめた1回だった（人間の返事は 2026-10-19T04:47:37Z の「はい、削除しました。」の1件だけ。この session の会話の記録で確かめた）。Step 17 の「1件ずつ」とは違う。
- `assemble.ts` を実行し直した（exit 0）。`acceptance-evidence.json`：SHA256 `8b7575634d3c76e85ea1c0b9af6570a517ce8d86533e7089c5aac713fd225e8a`、checks 19行すべて passed、`outputs` 46件、identitySha256 `26a04230…`（前と同じ）。前の証拠は `acceptance-evidence.before-2026-10-22.json` に残した。`assemble.ts` の SHA256 は `ba74db53d5d9fd316f1719a41b4cb82fb9d05b1edab781eefb1d0a932f29545a`。

### 記録だけのもの
- review-03 の新2：上の「C10 の AcceptanceEvidence」節の表と「16件」に注記を足した。
- R-07（違いがある、検証済み）：U4 の B1 の C06（Release `b1-a3370ca4df1f`、`b1-acceptance.json`）の pack は `a3370ca4df1f…4046`、source は `2e0358a2`。pin（公開した 0.3.0）は pack `29cb0656…398b`、source `0af7b239`（`chore(main): release 0.3.0 (#30)`）。`0af7b239` は `2e0358a2` の祖先で、その間に `runtime/`・`types/` の差は無く（`jj diff --stat` 0 file）、`package.json` は scripts の行だけが違う。B1 の tarball の名前は `0.3.0-b1`。契約の「formicariumSourceCommit/Pack は B1 の C06 と一致」は、文字どおりには満たさない。runtime と型が同じであることは確かめたが、pack の bytes は違う。人間の判断（2026-10-22「このままで良いです。」）：この違いはこのまま受け入れ、pin は公開した 0.3.0 のままにする。（2026-10-22 の訂正：この項の「間に `runtime/`・`types/` の差は無く…`package.json` は scripts の行だけが違う」は、source の差分だけを見た誤りだった。tarball どうしを比べると core も違う。下の「Step 23」の節が正しい。）
- R-09（検証済み、2026-10-21T20:3xZ）：`acceptance/font-probe.mjs`（第一者。Firefox 157.0 の新しい context での初回）で、公開 site の en・ja を開いた。どちらも font face 48件のうち `error` の状態のものは0件、`loaded` は7件だった。ja の初回では font の console error が7件出たが、再読込の後の face は `loaded` か `unloaded` だけだった。console error は、再読込の前に中断された取得と読める（推測。どの取得かは log に出ない）。出力は `acceptance/font-probe-firefox.json`。
- review-03 の新4（`dcf959a1` より後）：vivarium の `dcf959a1..dee1ba5e` は #545〜#556 の12件。U6 の表の `bump.ts`・`cli.ts` の SHA256 は `dee1ba5e` でも同じ。`fixed-guest-bump.yml` は #555（PR の題）・#556（auto-merge を外す step を除いた）で変わった。U6 の表の値は `dcf959a1` の時点の値である。`bump.ts`（`dee1ba5e`）は宣言の `guest.commit` だけを書き換え、`accepted` と pin は変えない（読んで確かめた）。bump の PR が自動で merge されても、配布は `accepted` で行われるので、BR1.5・BR1.6 の「bump は commit だけを動かし、accepted の置き換えは人の PR」は保たれる。bump の PR が merge されるには、main の必須の check（repro-regression の E2E・regression を含む10個）を通る必要がある。recipe.json は bump で JSON 全体が書き直され、1行の配列が複数行になる（#554 で観測）。

## Step 23：review-04 の Minor 4件の修正（2026-10-22、人間の指示「U6 を開き直して、新しい Minor 4件を直してください。」）

### #557 の後（新2、検証済み）
- #557 が変えた6 file の、vivarium の `e4ef0dc4` での SHA256：`src/layer1_wasm/_shared/formicarium_terminal.ts` `7f596c53aab0a8c5f084ac529b1404422b9c3e328c70b9beb5c8feb7290be29e`、`src/layer1_wasm/_shared/_test/formicarium_terminal.test.ts` `8c8486d45e2b915bb180aa750f4ca6a007dc83cfdaff10249ca106b789e1e4c8`、`docs/scripts/stage-formicarium-assets.ts` `677a69d9a1c4e0af733462449b1e48fc7d2c2718c8c5a23e1a9eef6cc7fb6375`、`docs/scripts/__tests__/stageFormicariumAssets.test.ts` `7c62f257ed51ba9060d25a2b6f07812724b9d5809467c7da7214cd2b693d8ed7`、`docs/scripts/__tests__/workflows.test.ts` `dff77e973e18e2691ffdd6b45ad68efb9e99fa53047d64b08626f0c8b6354f9e`、`.github/workflows/repro-regression.yml` `6b72e80ffa74504879a5490d2dc51860d671e43ae8f6b5aadc0fde6a9f6e0906`。上の「Step 19」の表の値は `dcf959a1` の時点の値である。
- `e4ef0dc4` の CI（GitHub の読取り）：repro-regression の run 39673609915 は success。3ブラウザの job で「Check the formicarium types against the pinned tarball」が success（chromium の log：tarball の照合が `OK`、`1 pass`・`0 fail`）。chromium の job で U6 の行 coverage は 83.51%（2097/2511、下限 80%、passed）、Playwright は 29 passed。deploy-docs の run 39673609916 は success、github-pages の deployment 7237000969（2026-10-21T20:50:40Z）。記録：`.artifacts/u6-recipe-runtime/evidence-e4ef0dc4/`（`repro-regression-jobs.json`・`job-chromium.log`・`pages-deployment.json`）。
- C10 の証拠（`evidence-c10/acceptance-evidence.json`）は `dcf959a1` に結び付いたもので、#557 の端末の変更を含む site の W5 ではない。そこで、今の公開 site（`e4ef0dc4` の deploy の後）に対して `acceptance/pages-acceptance.mjs` を3ブラウザで1回ずつ実行した（1 browser ずつ、retry なし）。Chromium 156.0.8078.4・Firefox 157.0・WebKit 27.2 の3つとも `passed: true`、各4行（en・ja × 初回・再訪問）がすべて `reproduced`、pack は `29cb0656…`。出力：`evidence-e4ef0dc4/pages-chromium-2026-10-21T2112Z.json`・`pages-firefox-2026-10-21T2112Z.json`・`pages-webkit-2026-10-21T2113Z.json`。公開 site の `repro/biome/_shared/formicarium_terminal.js`（SHA256 `81072c79cdfd1ec58da240e2009bbc3901ac869e1315d5b213d725a4380a9451`）に、#557 の2つの変更（`is not under _formicarium/`、失敗時の `session.dispose()`）があることを確かめた。これは補足の証拠で、C10 の証拠は置き換えていない。

### R-07 の比較の訂正（新3、検証済み）
- B1 の tarball（Release `b1-a3370ca4df1f` の `aletheia-works-formicarium-0.3.0-b1-a3370ca4df1f.tgz`、SHA256 `a3370ca4…4046`）と、npm の 0.3.0（SHA256 `29cb0656…`。pin と一致）を、file ごとに SHA256 で比べた（`.artifacts/u6-recipe-runtime/b1-compare/b1-vs-pin.json`、SHA256 `ce412b263b68801c5e1f4a667656a1c4b09c4026c59372972f4a95f6a7f83d51`）。34 file のうち30が同じで、違うのは `assets/blink.mjs`・`assets/blink.wasm`・`assets/build-info.json`・`package.json` の4つ。
- 原因：build-info で違うのは `emcc`（B1 は Emscripten 6.0.10、0.3.0 は 6.0.12）と、それによる `assetDigests` だけで、`blinkCommit`・`blinkSourceDirty`・`mode`・`configure`・`link` は同じ。`package.json` は `repository`・`private`・`publishConfig` だけが違い、版はどちらも 0.3.0。
- 前の R-07 の項の「`package.json` の scripts の行だけが違う」は誤りだった（source の差分しか見ていなかった）。人間に訂正を伝え、core の wasm も違うと分かったうえで、違いをこのまま受け入れる判断を得た（2026-10-22「core の wasm も違うことを分かったうえで、R-07 の違いはこのまま受け入れます。証拠にそのことを書いて続けてください。」）。
- `assemble.ts` が、この判断を `acceptance-evidence.json` の追加の field `acceptedDifferences` に書く。違う file の集合が変われば exit 1 になる。

### 新1・新4
- 新1：上の「残した Minor（記録だけ）」の節に、Step 20・21 と #557 で直したという注記を足した。`traceability.json` の FR10・NFR2.2・NFR8.1 は、#557 を既に指している（Step 22）。
- 新4：`assemble.ts` の `outputs` に、`coverage-zip/u6-coverage.zip`（artifact は 2026-11-18 に期限が切れる。ZIP は `.artifacts/` に残す）、`acceptance/font-probe.mjs`・`font-probe-firefox.json`、`b1-compare/b1-vs-pin.json` を入れた。

### 証拠の作り直し
- vivarium の `dcf959a1` の jj workspace は、working-copy commit が消えていた（空の commit として捨てられたと読める）。`jj new dcf959a1` で作り直し、説明を付けて残るようにした。変更は無い（`0 files changed`）。
- `assemble.ts` を実行し直した（exit 0）。出力は、一度 `.next.json` に書いてから置き換える形にした（失敗した実行が `acceptance-evidence.json` を空にしたため）。`acceptance-evidence.json` の SHA256 は `235cd94c9025096bf2859427ba4a0ee189b1d6ba50d6d01e261b88d31e15be21`、checks 19行すべて passed、`outputs` 50件、identitySha256 `26a04230…`（前と同じ）。`assemble.ts` の SHA256 は `5f3b103d9e23cdde972f1f81d80f60fb87bd658f90a27ba5b107c91766f0ca2d`。
