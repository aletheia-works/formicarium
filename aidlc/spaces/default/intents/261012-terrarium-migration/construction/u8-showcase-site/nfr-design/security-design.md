# U8 showcase-site の品質・安全の設計

## Sources

`../nfr-requirements/security-requirements.md`（NFR2.1–NFR8.11 と「Functional Design との関係」の表）、`../nfr-requirements/performance-requirements.md`、`../nfr-requirements/tech-stack-decisions.md`、`../functional-design/functional-spec.md`、`../../../inception/contract-design/contract-summary.md`（C03・C04・C05・C09・C10・C11）、`../../../inception/requirements-analysis/requirements.md`（NFR6 の「既存CSP blob/wasm要件を維持」）、`nfr-design-questions.md`（Q1=A）。NFR Requirements の review-02（READY、Minor 8件）と、この stage の review-01（NOT-READY、Major 2・Minor 9）を反映した。formicarium の `showcase/scripts/boundary.ts`・`mode.ts`・`candidate.ts`・`accept-server.ts`（`pagePolicy` は `script-src 'self' blob: 'wasm-unsafe-eval'` と `worker-src 'self' blob:`）、`.github/workflows/showcase.yml`（`pull_request`・`push` の paths に `showcase/**`、concurrency の group は `showcase-${{ github.event_name }}-${{ github.event.pull_request.number || github.run_id }}`、PR では cancel-in-progress）・`dependency-review.yml`、root の `biome.json`・`package.json` を読んだ（2026-10-19）。設計で、U8 の動作は未検証。

## Functional Design との関係（追加）

`security-requirements.md` の「Functional Design との関係」の表に、次の2つを加える。

| Functional Design の箇所 | 置き換える節 | 内容 |
|---|---|---|
| BR7.2 の coverage-80（「bun・node の coverage」） | S2 | node の coverage と Chromium の V8 だけ（bun の test は使わない） |
| BR6.1（承認者を外して日次の自動にするかは後で人間が決める） | S13 | 最初の deploy だけ承認し、その後は承認者を外す（NFR Requirements の Q2=A） |
| W1 手順1（PR・push も showcase.yml を呼ぶ） | S15 | PR・push は showcase.yml を呼ばず、main の最新の成功した run の候補を使う |

## S1：境界の検査（NFR2.1）

U7 と root の file で U8 が変える箇所（これだけ）：

| file | 変更 |
|---|---|
| `showcase/scripts/boundary.ts` | 下の site の規則 |
| `showcase/tests/boundary.test.ts` | site の場合の試験 |
| `biome.json`（root） | `showcase/site/.astro`・`showcase/site/dist`・`showcase/site/node_modules` を対象から外す |
| `.github/workflows/showcase.yml` | `pull_request`・`push` の paths に `!showcase/site/**` を加える（site だけの変更で U7 の重い工程を動かさない。review-01 R-01） |

`showcase/trusted-callers.json` は今の値（`.github/workflows/showcase-site.yml`）のまま使い、変えない。

site の規則（boundary.ts）：

- 許す specifier：showcase/site の下では、`astro`・`@astrojs/starlight`・`@xterm/xterm`・`@xterm/addon-fit` のどれかと完全に一致するか、その名前に `/` を続けた subpath（例 `astro/config`、`@astrojs/starlight/components/...`）、または `astro:` で始まるもの。showcase/site/tests の下では、加えて `@playwright/test`・`v8-to-istanbul`（と、その `/` の subpath）。formicarium の公開 export（既存の PUBLIC_ENTRIES）は今のまま。
- `.astro` の走査：file の先頭の `---` と次の `---` の間（frontmatter）と、`<script>` から `</script>` までを source として、既存の importSpecifiers で読む。`<script src="...">` の src は相対の同じ origin の path だけを許す。
- literal でない動的 import：`import(` の後に引用符で始まらない引数がある箇所を、`showcase/site/src/terminal/formicarium-loader.ts` の他では違反にする。comment や文字列の中の誤検出は違反のまま（安全側）にし、例外は loader の1か所だけ。
- 本体の内部の import・本体から showcase への依存・回帰用の fixture の共有の拒否はそのまま保つ。site の code は `fixtures/` で始まる文字列の literal を書かず、site の fixture の index の path は `demo-fixtures/`。
- 実行時の formicarium の import は loader だけで、url は build で埋め込んだ assets の一覧（path と SHA256）から作り、site の root の下の `_formicarium/` に限る（その外・`..`・別の origin は拒否）。
- boundary.ts は U7 の showcase.yml の境界の job と、U8 の showcase-site.yml の build の job の両方で動かす。
- Biome：root の showcase の規則（noRestrictedImports、`**/types/**` の制限を含む）は showcase/site にも掛かる。site は formicarium の型を `@aletheia-works/formicarium` の type import で使う。Biome が `.astro` を扱える範囲は Code Generation の開始時に確かめ、扱えなければ `.astro` は boundary.ts の検査だけにする。

## S2：coverage（NFR2.2）

- 分母（ここで固定。Code Generation で名前を変えるときは対応を記録し、file を足す・減らすときは理由を示して人間の承認を受ける）：
  - browser の module（`showcase/site/src/terminal/`）：terminal-host、output、buffer、keys、status、fetch-limited、fixture-index、catalog、formicarium-loader、omitted-notice。
  - 文言：`showcase/site/src/i18n/` の文言の検査。
  - script（`showcase/site/scripts/`）：verify-candidate、fetch-verify-candidate（PR・push の候補の取得）、stage-formicarium、build-fixture-index、build-site-identity、inject-csp、inventory、check-site、notices、evidence、deploy-guard、post-deploy-check、serve-pages-like、summary。
  - 除外（理由付き）：`.astro` の file（markup と module の呼出しだけ）、Starlight と Astro の設定、生成物、xterm、formicarium の pack、第三者の code、試験の file と試験の道具（`showcase/site/tests/` の下の coverage の合算の script を含む）。
- 測り方：script と DOM に依存しない module は node の `--experimental-test-coverage`（lcov）。browser の module は accept-chromium の job で Playwright の Chromium の V8 の coverage を集める。
- source map（review-01 R-03）：build は Vite の `build.sourcemap: 'hidden'` で `.map` を作り（bundle に参照の comment を入れない）、build の job が `.map` を site から抜いて別の artifact `showcase-site-sourcemaps`（保持 1 日）に入れる。site の inventory と Pages の artifact には `.map` を入れない。
- 合算：coverage の job（accept-chromium の後）が `showcase/site/tests/coverage/merge-coverage.ts`（試験の道具。v8-to-istanbul をここだけで使う）で、lcov と V8 の coverage を source map で TS の行へ対応させて合わせる。80% 未満か、分母の file が report に無ければ失敗。

## S3：site の検査の実行（NFR2.3）

build の job の工程の順（review-01 R-09）：

1. checkout、mise の tool の準備。
2. 候補の取得（S15）と verify-candidate（S5）。
3. stage-formicarium：pack を照合して `showcase/site/node_modules/@aletheia-works/formicarium` に展開する（U7 の pack.ts の install と同じ手順。型の解決にも使う）。`_formicarium/<version>/` に置く file の一覧を作る。
4. `bun install --frozen-lockfile --ignore-scripts`（site の依存。formicarium は lockfile に入れず、3 の展開を使う）。
5. Biome、boundary.ts、tsc、astro check、node の単体試験（lcov を出す）。
6. build-fixture-index、Astro の build（hidden の source map）、`.map` を抜く。
7. inject-csp：端末の page の inline script の hash を計算して meta の CSP に入れる（HTML を書き換える）。
8. notices、build-site-identity（`site-identity.json`）。
9. check-site（en・ja、副資源、CSP、dotfile、大きさ、coi-serviceworker）。
10. inventory（7〜8 の後の最終の bytes で計算する）。
11. upload-pages-artifact（`retention-days: 7`、dotfile を含む）、`showcase-site-sourcemaps`、inventory と lcov の artifact。

本体の `ci-required` は変えない。

## S4：page の取得物の検証（NFR3.1・NFR4.1）

- catalog と fixture の index の SHA256 は build で page に埋め込み（端末の page の data 属性）、取得した bytes と照合する。違えば使わない。
- fixture の index：path は `/work` の下の相対 path、`..`・絶対 path・空の segment・NUL を拒否、entry は 4096 件まで、path は 4096 bytes まで。type は dir か file。file の bytes は base64 で、decode した bytes の SHA256 を entry の値と照合する。
- 取得の上限は performance-design の P2。

## S5：候補の照合（NFR5.1）

verify-candidate が BR1.2 の7項目を順に照合し、項目・path・期待値・実際の値を log に出す。candidateId と fixture の inventory は U7 の `computeCandidateId`・`fixtureInventorySha256` を import して計算する（定義を複製しない）。

## S6：直列と古い run の拒否（NFR5.2）

- deploy の job（`deploy`）は concurrency の group `showcase-site-pages`、`cancel-in-progress: false`。
- deploy の後の確認は別の job（`verify-deployment`）。古い run の拒否で数える「deploy が成功した run」は `deploy` の job が成功した run で、`verify-deployment` の結果によらない。
- deploy-guard は、承認の後・deploy-pages の直前の step で、Actions の API でこの workflow の run のうち `deploy` の job が成功したものの最大の run_number を求め、自分より大きければ失敗する。API の失敗も失敗。

## S7：前回の保持（NFR5.3）

workflow の YAML を読む単体試験で確かめる：`deploy` の `needs` が build・accept の3つ・coverage・evidence のすべてで、`if` が distribute と成功だけであること。`pages: write`・`id-token: write` と `actions/deploy-pages` が `deploy` の job の他に無いこと。concurrency の設定と deploy-guard の step があること。PR・push の run が showcase.yml を呼ばず deploy の job を持たない形であること。

## S8：分離（NFR6.6）

- coi-serviceworker 0.1.7 の写しを site の root に1つ置き、SHA256 を check-site で照合する。
- 分離の設定（coepCredentialless を使わない）は外部の file `coi-config.js` に書き、端末の page の head で coi-serviceworker.js の前に読む（inline script にしない）。
- 受入で page・Worker・子 Worker の crossOriginIsolated と SharedArrayBuffer を初回・再訪問で観測する。

## S9：CSP（NFR6.7、Q1=A）

- 端末の page（個別ページと /terminal/、en・ja）の head の最初に meta の CSP を置く。文書の page には置かない。
- 指令：`default-src 'none'`、`script-src 'self' 'wasm-unsafe-eval' blob: 'sha256-…'`、`worker-src 'self' blob:`、`connect-src 'self'`、`style-src 'self' 'unsafe-inline'`、`img-src 'self' data:`、`font-src 'self'`、`base-uri 'none'`、`form-action 'none'`。
- `blob:` を許す理由（review-01 R-10）：要件の NFR6 は「既存 CSP の blob/wasm の要件を維持」とし、U7 の受入の page の方針（accept-server.ts の pagePolicy）も script と worker に blob を許して formicarium を動かしている。blob を外せるかは確かめていない（未検証）ので、外さない。
- hash は S3 の 7 で、出力した HTML の inline script の中身から計算して入れる。check-site は、端末の page のすべての inline script の hash が meta にあり、外部の origin が指令に無いことを確かめる。
- 受入で、3ブラウザとも CSP の違反（`securitypolicyviolation`）を記録し、1件でもあれば失敗にする。違反が出たら、指令を緩めて通さず、原因を示して設計の変更として人間の判断を受ける。
- meta の CSP の制約：frame-ancestors を置けないので、他の site が端末の page を frame に入れられる。site には login・利用者の data・状態を変える操作が無く、frame からの操作で害が出る対象が無いので、この危険は残す（記録する）。COEP require-corp の下では、他の site の frame に入れた page の副資源の読込みも制限される（推測）。

## S10：表示と操作（NFR7.1–NFR7.3）

- 出力（NFR7.1）：output の module が結果の kind ごとに書き分ける（guest は onOutput、builtin・install は result、empty は無し）。xterm の link の addon は入れない（OSC 8 を開かない）。状態欄・OmittedNotice・カードは textContent と Astro の escape だけで書く。
- 打鍵（NFR7.2）：keys の module が、入力中は xterm の onData から行を作り、`\x1b` で始まる列（問合せへの応答を含む）を捨てる。行の UTF-8 の bytes が 65536 を超える打鍵・貼付けは受け付けず、状態欄に文字で知らせる。実行中・install 中は Ctrl-C だけを取消にして他を捨てる。xterm の `attachCustomKeyEventHandler` で Tab と Shift+Tab を端末に渡さず、browser の focus の移動に使う。`screenReaderMode` を有効にする。端末の容器は幅 100%・最小幅 0 で、390px 幅で横に scroll しないことを受入で確かめる。
- 状態（NFR7.2）：status の module が状態（isolating・loading・installing・ready・ready_failed_install・running・failed）と空の出力を文字の文にする（frontend-components の表）。
- 進捗（NFR7.3）：install の `onProgress` の `totalBytes` が null のときは「全体の大きさは不明」と processedBytes を、0 のときは「0 bytes」を出し、区別する。受入の記録の時刻は offset 付きの ISO 8601、期間は ms。
- 敵対的な出力の harness（試験だけの page、site に入れない）が、HTML・ANSI の問合せ・OSC 8・巨大な1行を output の経路と状態欄に流し、DOM に要素が増えないこと・応答が入力にならないことを確かめる。

## S11：fixture（NFR7.4）

build-fixture-index が showcase/fixtures/<名前>/ の全体を読み、mode を正規化し（dir 0755、file 0644、実行権限なら 0755）、空の dir・symlink・特殊 file で失敗する。出力は `demo-fixtures/<名前>.json`。page は `/work` の下に置き、cwd を `/work/app` にする。

## S12：証拠（NFR8.1）

- evidence の job（coverage の後・deploy の前）：必須の行の check の記録と完全な C10 の JSON（deployedIdentity なし）を作り、`showcase-site-evidence-<run_id>`（保持 90 日）に上げる。
- `deploy` の job の step の順（review-01 R-02）：deploy-guard → inventory の再計算 → deploy-pages → （deploy-pages が成功したときだけ）site-inventory・previous-site-preserved の記録を作り直し、deployedIdentity を入れた完全な C10 の JSON を `showcase-site-evidence-<run_id>-deployed`（保持 90 日）に上げる。deploy-pages が失敗した run には `-deployed` が無い。verify-deployment の失敗は `-deployed` を消さない（配布はされたので）。U9 はそれを、配布済みだが deploy の後の確認が失敗した run として、verify-deployment の結果と合わせて扱う（U9 への申し送り。作業の記録）。
- 必須の行と、元になる job・log（review-01 R-07）：

| 行 | environment | job | 元の log |
|---|---|---|---|
| tool-aube-version・tool-pitchfork-version・tool-biome-version | node・chromium・firefox・webkit | evidence | 候補の `acceptance-log.json`（U7）の該当の行 |
| empty-terminal-install | chromium・firefox・webkit | accept-<browser> | Playwright の結果（空の端末の6件） |
| ui-states-keyboard | chromium・firefox・webkit | accept-<browser> | Playwright の結果（状態と keyboard の2件、敵対的な出力の1件） |
| browser-coi | chromium・firefox・webkit | accept-<browser> | Playwright の結果（個別ページの6件の分離・再訪問、文書の page の1件） |
| public-import-boundary | host | build | boundary.ts の出力 |
| fixture-isolation | host | build | build-fixture-index と verify-candidate の (7) の log |
| candidate-identity | host | build | verify-candidate の log |
| previous-site-preserved | host | build（workflow の試験）、deploy（deploy-guard） | workflow の YAML の試験の結果、deploy-guard の log |
| site-inventory | host | build・accept・deploy | 3回の inventory の計算の log |
| coverage-80 | host | coverage | 合算の report |

- 組み立ての照合は U6 と同じ形（行の欠落・重複・failed・unverified で失敗し、何も上げない）。

## S13：外部操作と承認（NFR8.2）

- 最初の deploy は `github-pages` environment の承認者で止め、承認の後は承認者を外す（Q2=A。外す設定の変更は内容を示して承認を受けてから）。
- Pages の artifact は `retention-days: 7`。承認が7日を過ぎたら deploy は失敗し、main から手動で実行し直す。
- build の job の summary に run_number・candidateId・siteInventorySha256・3ツールの版を出す（承認の画面から辿れる）。

## S14：notices（NFR8.3）

- 範囲：site の build の出力に code が入る package だけ。Astro（Vite）の build の module の一覧（node_modules の下の path）から package を求め、その package の license の file の本文を THIRD_PARTY_NOTICES に入れる。加えて coi-serviceworker、formicarium の pack の notices、候補の guest の notices。
- 出力に入る package に license の file が無ければ build を失敗にする。

## S15：job・権限・mode（NFR8.4）

| job | 動く run | 権限 | timeout | 説明 |
|---|---|---|---|---|
| candidate | schedule・workflow_dispatch（main） | U7 の定義のとおり | U7 のとおり | showcase.yml を mode=distribute で呼ぶ。呼ばれた run の event は schedule か workflow_dispatch で、U7 の concurrency の group は run ごとに分かれ PR の run と衝突しない |
| fetch-candidate | PR・push・main 以外の手動 | contents read・actions read | 10 分 | showcase.yml を呼ばず、main の showcase.yml の最新の成功した run（push か workflow_dispatch、main の定義）の `showcase-candidate` と `showcase-work-resolve` を取る。無い・期限切れなら失敗し、main で showcase.yml を動かすよう summary に出す。この候補は distributable が false で、配布しない |
| build | すべて | contents read | 30 分 | S3 |
| accept-chromium・accept-firefox・accept-webkit | すべて | contents read | 60 分 | performance-design の P1 |
| coverage | すべて | contents read | 15 分 | S2 |
| evidence | すべて | contents read | 10 分 | S12 |
| deploy | schedule・workflow_dispatch（main）で、上がすべて成功 | contents read・pages write・id-token write・actions read | 15 分 | S6・S12。`github-pages` environment |
| verify-deployment | deploy の成功の後 | contents read | 15 分 | S21。page の URL は deploy の job の出力（deploy-pages の `page_url`）で受け取る |
| summary | すべて（`if: always()`） | contents read・actions read | 5 分 | S20 |

- mode は showcase-site.yml が決める：`github.event_name` が schedule か workflow_dispatch で、`github.ref` が refs/heads/main のときだけ distribute（candidate の job で showcase.yml を呼ぶ）、他は verify（fetch-candidate）。U7 の mode.ts はこの入力を検証するだけ。
- showcase-site.yml の concurrency：PR の run は `showcase-site-pr-<番号>` で古い run を取り消す。他の run は run ごとに独立。deploy の job だけ S6 の group。
- script を動かす job（deploy・verify-deployment・summary を含む）は checkout するので contents read を持つ。fork の PR からは配布しない（deploy の job を持たない）。

## S16：切戻し（NFR8.5）

maintenance の guide に手順を書く：(a) U8 の変更の revert を main に merge → main から showcase-site.yml を手動で実行 → verify-deployment の成功と site の表示を確かめる。(b) Actions の画面で workflow を無効にする → U7 の tools.json の条件を PR で直す → 有効に戻し、main から手動で実行して verify-deployment の成功を確かめる。

## S17：秘密（NFR8.6）

U8 の log・summary の URL は query を落とす helper を通す。token を使う script は fetch-candidate・deploy-guard・summary だけで、値を出さない。

## S18：文書（NFR8.7）

build で `npm view @aletheia-works/formicarium@<pack の版> dist.integrity` を読取りで照会し、pack の integrity と一致したときだけ guides に npm の導入の手順を出す（Astro の build の入力の変数で切り替える）。一致しない・照会できないときは「この版は npm に未公開」を出す。embedding の例は pack の型で `tsc --noEmit` する。

## S19：identity の file（NFR8.8）

build-site-identity が `site-identity.json`（run_number・sourceCommit・candidateId）を site の root に置く。inventory はこの file を含めて計算する。

## S20：失敗の検知（NFR8.9）

S15 の summary の job が、最後に deploy した run からの日数（Actions の API で `deploy` の job が成功した最新の run）と、失敗した job の名前を job summary に出す。月1回の確認の手順は maintenance の guide に書く。

## S21：deploy の後の確認（NFR8.10）

verify-deployment が deploy の job の出力の page の URL に `site-identity.json?run=<run_id>` を `cache: 'no-store'` で読み、30秒ごと・10分まで確かめる。合わなければ job を失敗にして通知する。

## S22：依存（NFR8.11）

`showcase/site/bun.lock` を commit し、`bun install --frozen-lockfile --ignore-scripts`。dependency-review が bun.lock を読めるかは未検証で、Code Generation の最初の PR で確かめる。読めなければ、PR で lockfile の差分を人間が確かめる手順を maintenance の guide に書き、その旨を報告する。

## Threat Response and Rollback

| 脅威 | 応答 |
|---|---|
| 候補・site の差し替え | S5、S12、S19（inventory の3回の照合） |
| 古い候補の上書き | S6 |
| 依存の差し替え | S22 |
| page での任意の code の実行 | S9、S10 |
| 権限の悪用 | S15 |
| 他の site の frame への埋込み | S9 の残す危険（login・利用者の data・状態を変える操作が無い） |

切戻しは S16。

## Assumptions & Open Questions

None.
