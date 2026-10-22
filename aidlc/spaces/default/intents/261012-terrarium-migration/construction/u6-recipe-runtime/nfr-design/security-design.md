# U6 recipe-runtime の安全設計

## Sources

`../nfr-requirements/security-requirements.md`（NFR2.1–NFR8.5）、`../nfr-requirements/tech-stack-decisions.md`、`performance-design.md`（P1–P6）、`../functional-design/functional-spec.md`（W1–W6、失敗と境界の場合）、`../functional-design/rules.md`（BR1.x–BR8.1）、`../../../inception/contract-design/contract-summary.md`（C03・C05・C08・C10・C11）。持ち越しの Minor は Functional Design の review-02（Minor 4：pin file が無い間の検査主体、R-03 の残り：置き場と scope）と NFR Requirements の review-02（R-13：coi-serviceworker の digest の置き場）。vivarium の `scripts/bundle-layer1-pages.sh`、`docs/scripts/serve-repro.ts`・`repro-dev-middleware.ts`・`generate-repro-i18n.ts`・`generate-recipes-index.ts`、`.claude/rules/recipe-authoring.md`（ローカル main = `71e0ef92`、2026-10-19 に読取り）と、formicarium の `runtime/web/api.js`（`createSession` は `options.assets` で Worker の URL を受け取り、Worker を `new Worker(url, { type: 'module' })` で起動する）。設計で、U6 の動作は未検証。

## S1：recipe の宣言の検証（NFR3.1）

- recipe の schema と recipes index の生成（`generate-recipes-index.ts`）で、`guests[]` の role の一意と baseline の存在、`repository` の正規 URL と allowlist、`commit` の40桁、`accepted` の5 field（commit・versionOrName・buildKey・elfSha256・buildInfoSha256）が揃うか無いか、を検査する。一部だけの `accepted` は index 生成の失敗にする。
- `accepted` が無い guest を持つ recipe、又は pin file が無いときの `expected_runtime: formicarium` の recipe は pending とし、index の出力に理由（`accepted-missing` 又は `pin-missing`）を書いて site と回帰試験から外す。
- guest の `repository` を変えたのに `accepted` を残した場合は、S2 の build-info の照合（repository の不一致）で失敗させる。index 生成ではなく AssetStager で見つける理由は、`accepted` の build-info の中身が Release にしか無いため。AssetStager は PR の repro-regression でも動くので、merge の前に見つかる（S2 の「PR での照合」）。

## S2：site build の取込み（NFR3.2・NFR4.1・NFR8.4）

新しい staging の script（AssetStager。bun、`docs/scripts/` の下）を作る。どこでいつ動くかは下の mode の表のとおり。入力と照合を次のとおりにする。

| 入力 | 取得元 | 照合 |
|---|---|---|
| pin file `src/layer1_wasm/formicarium.pin.json` | tree | version・tarball の SHA256・sourceCommit・file 一覧と各 SHA256 の形 |
| formicarium の tarball | npm registry の固定版の tarball の URL（pin の version から作る） | 大きさ 128MiB 以下、SHA256 が pin と一致 |
| tarball の entry | 上の tarball を memory の中で展開 | すべての entry を検査する（選んだ entry 以外も無視しない）。通常の file だけ。`..`・絶対 path・symlink・hardlink・重複・loop を拒否。展開後の合計 256MiB（`maxExpandedBytes`）、entry 数 4096（`maxArchiveEntries`）、path 4096 bytes（`maxPathBytes`）以下（境界値を含めて許し、+1 で失敗。累積は checked integer）。pin の一覧は tarball の全 file を列挙し、一覧に無い entry、一覧にあって tarball に無い file はどちらも失敗。各 SHA256 を照合 |
| ELF・build-info・catalog | `https://github.com/aletheia-works/vivarium/releases/download/guest-<tool>-<accepted.buildKey>/<asset>` | ELF 128MiB・build-info 1MiB・catalog 4MiB 以下。ELF と build-info の SHA256 が `accepted` と一致。build-info の commit・buildKey が `accepted` と、tool・repository が guest と一致 |

- 取得は1件ずつ、AbortSignal.timeout(120秒) で止める（`fetchDeadlineMs`。DNS・redirect・body の完了を含む）。非2xx・offline・429・大きさの超過・不正な body は、URL と原因を付けて失敗にする。自動 retry と別 URL への fallback はしない（C11）。
- 大きさは `Content-Length` を信用せず、stream で読んだ bytes を累積して上限で止める。
- redirect は手動でたどる（`redirect: 'manual'`）。最大5 hop、すべての hop が HTTPS で userinfo が無く、loop しないことを確かめ、最終 URL を記録する。GitHub Release の download は別の host へ redirect されるので、この規則で扱う。
- `credentials: 'omit'` で取得し、token・cookie・`Authorization` を送らない。script は `GITHUB_TOKEN`・`NPM_TOKEN` などの環境変数を読まない（試験で、環境変数を置いても request に付かないことを確かめる）。
- active の recipe のどれか1つでも照合・取得に失敗したら、script は非0で終わり、deploy-docs の build の job が失敗して前回の site が残る。その recipe だけを外して公開を続けることはしない（NFR3.2）。
- 書き出し先は引数で受け取る dir だけ（下の mode の表）。書く前に dir を空にし、前回の残りを使わない。
- tar の読み方（第一者の小さな実装か、保守されている library か）は Code Generation の計画で決める。どちらでも、disk へ直接展開する機能（symlink をたどるもの）は使わず、memory の中で entry を検査してから書く。

### AssetStager の mode と、どこでいつ動くか

| mode | 入力 | 出力先 | 使う所 |
|---|---|---|---|
| `pin` | pin file、npm と Release の公開の URL | `src/layer1_wasm/_formicarium/<version>/` と各 recipe の `guests/<role>/`（gitignore 済み） | deploy-docs（公開）と repro-regression（PR の照合と回帰試験） |
| `local` | ローカルの tarball の path と、ローカルの guest の dir（ELF・build-info・catalog）。期待値は引数の JSON で渡す | 同じ src の下の staging の dir（gitignore 済み） | 0.3.0 の公開前の開発・観測（S8）・回帰試験。main session の手元だけ |

- deploy-docs の step は `pin` mode の固定の command だけを使う。docs の bun test が workflow の file を読み、deploy-docs の command に `local` が無いことを確かめる。
- `local` mode でも照合（tarball の entry、各 SHA256、ELF の digest と build-info の identity）は `pin` mode と同じ code で行う。違うのは入力の取得元だけ。
- staging は `repro:build`（tsc）とは独立している。tsc は formicarium を import しない（下の「型と版」）。そのため、deploy-docs では `repro:i18n` の直後、Rust の残りを消す step の前に AssetStager を置く（Layer 2 の image の公開より前）。step の `env` に `GITHUB_TOKEN` などの secret を渡さない。
- 型と版：page の共有 module は、使う API だけの型を vivarium の中に小さく宣言し、formicarium の module は実行時に URL から `import()` する。AssetStager は staging の dir に `assets.json`（version、module・Worker・wasm の相対 path、各 SHA256）を書き、page はこれを同じ origin から読んで URL を作る。`<version>` はこの file から来る。宣言した型と formicarium の `types/browser.d.ts` が合うことは、`local` mode の試験で tarball の d.ts に対して tsc で確かめる。

### PR での照合（merge の前）

- repro-regression（`pull_request` で動き、`contents: read`）に、`pin` mode の AssetStager を足す。pin file か、`expected_runtime: formicarium` の recipe か、その `accepted` が変わる PR では必ず動き、失敗はその PR の check の失敗になる。そのため、pin・`accepted` の誤りや、repository を変えて `accepted` を残した誤りは、merge の前に見つかる。deploy-docs の失敗は、PR の後に Release や npm の側が変わった場合に限られる。
- この step も token を使わず、`env` に secret を渡さない。fork からの PR でも同じ公開の URL だけを読む。
- repro-regression が branch 保護で必須の check かどうかは、Infrastructure Design で確かめる。必須でない場合は、NFR8.2 の承認の確認項目に「この PR の repro-regression の AssetStager が成功した」ことを入れる。

## S3：ブラウザでの実行前の照合（NFR3.3・NFR4.2）

- 端末は、同じ origin の ELF と build-info を取り直し、formicarium の browser API の C03 の照合（SHA256、build-info の identity、validateGuest）を通ってから登録する。照合しない bytes を実行しない。
- 期待値（`accepted` の digest・commit・buildKey と guest の tool・repository）は、page と同じ dir の recipe.json から読む。期待値と ELF は同じ origin にあるので、この照合は origin の改ざんへの対策ではない。目的は、deploy の途中の不揃い、cache に残った古い file、取得の欠けを実行の前に止めること。origin の改ざんへの対策は S2 の build 時の照合と、main の push だけが公開する仕組み（NFR8.4）である。
- 照合・起動の失敗は判定にせず、`baseline_error`・`fix_error` と page の文に原因を出す（BR4.5）。
- 要素が外れたときの取消は `performance-design.md` の P4。

## S4：coi-serviceworker.js の固定（NFR3.5）

- 固定値の置き場：`docs/scripts/` の下の共有 module（例：`coi-serviceworker-pin.ts`）に、版 `0.1.7` と SHA256 を定数で置く。docs の bun test と AssetStager・site build の検査の両方がこの module を import する（本番の script が test の file を import しない）。
- docs の bun test は tree の `src/layer1_wasm/*/coi-serviceworker.js` をすべて読み、digest を比べる。`expected_runtime: formicarium` の recipe（pending を含む）が1つでもあるのに、その dir に写しが無い場合も失敗にする。今の vivarium の main には追跡された写しが1つも無い（2026-10-19 に確認）ので、formicarium の recipe が入るまではこの test の対象が無い。recipe を足す PR からは必ず検査される。
- 拒否の試験：正しい写しを1 byte 変えた一時の file で digest の比較が失敗すること、写しを消した recipe で失敗すること、を docs の bun test に置く。
- test-docs はすべての PR と main の push で動くので、recipe が pending の間も検査される。
- site build は、ja の dir に写した coi-serviceworker.js も同じ定数で照合する（写しの途中の差し替えを見つける）。
- 版を上げる手順：同じ PR で、すべての写しと定数を一緒に変え、新しい版の npm の tarball の中の file の SHA256 を PR に書く。定数だけ、又は写しだけを変えた PR は test で失敗する。

## S5：pin file が無い間（NFR3.4）

- formicarium 0.3.0 の公開前は pin file を置かない。recipe は pending で、公開 site と回帰試験から外れる。
- その間の確認は、AssetStager の `local` mode（S2 の mode の表）で、ローカルの tarball とローカルの guest を src の下の staging の dir に置いて行う。開発用の server・S8 の観測・回帰試験はこの staging を使う。`docs/doc_build` には書かない。deploy-docs はこの mode を使わない（S2）。
- この間の検査主体：S1（recipe の宣言）は index 生成、S4（coi-serviceworker）は test-docs、S2 の照合の論理は `local` mode の試験。pin を要る照合は、pin file を足す PR の repro-regression が初めて行う（merge の前）。U6 の最終受入（C10 の証拠）は、その後の公開の site build の後。

## S6：tarball の出所（NFR3.6）

pin file を更新する PR の確認項目：npm の registry の provenance（attestation）があれば、その中の source の repository と commit が pin の sourceCommit と一致することを確かめ、使った command と結果を PR に書く。provenance が無い、又は確かめられないときは「未検証」と PR に書く。確認の command（npm CLI の署名の確認など）は、作業時の最新の npm で公式の方法を確かめて Code Generation の計画に書く。

## S7：表示の境界（NFR7.1–NFR7.3）

- guest の出力・metadata・入力は `textContent` か terminal の文字の書込みで表示し、`innerHTML` などで HTML として解釈しない。page の文（原因の表示を含む）も同じ。
- 表示の buffer は 1MiB 又は 10000行を超えたら先頭を捨てる。判定は、表示の buffer ではなく、run の結果の原本の output から読む。
- 状態（読込み中・実行中・空の出力・失敗）は文字で示す。keyboard だけで入力・実行・pane の移動ができる。判定の command 列の間は入力を受け付けない。
- 取得の進捗は、全体の大きさが分からないとき「unknown」、0 byte のとき「0」と分けて表示する。時刻は offset 付きの ISO 8601、期間は ms で記録する。

## S8：分離と置き場の決め方（NFR6.7・NFR6.8）

coi-serviceworker は、自分の dir の下の page だけを制御する（vivarium の recipe-authoring.md）。さらに、Worker の本体の script の取得は、page の取得ではなく Worker の URL で service worker の scope が選ばれる、と読める（Service Workers の仕様の読み。未検証）。そうなら、page の scope の外にある Worker の本体には COOP・COEP の header が付かず、分離された page から Worker を起動できないブラウザがあり得る。

そこで、formicarium の一組の置き場は、次の2候補を3ブラウザ × en・ja で観測して決める。

| 候補 | 置き場 | 長所 | 心配 |
|---|---|---|---|
| 1 | site に1組：`repro/_formicarium/<version>/`（`performance-design.md` の P1） | site が小さい | Worker の本体が、en・ja のどちらの scope にも入らない |
| 2 | page の scope の中：en の recipe の dir と ja の dir の両方に `_formicarium/<version>/` を置き、ja の page は `createSession` の `assets` で ja の dir の Worker の URL を渡す | Worker の本体が page の scope に入る | 一組（今の 0.2.1 で runtime 約0.76MiB と blink.wasm 約0.43MiB）を ja にも写す。`serve-repro.ts` と `bundle-layer1-pages.sh` の「ja は page と service worker だけ」の規則を、この dir だけ広げる |

- 候補2の ja の URL：ja の page は `<base>` が en の dir を指すので、相対 URL や `document.baseURI` では en の dir になる。Worker・wasm の URL は `new URL('./_formicarium/<version>/…', location.href)` のように、`<base>` ではなく page 自身の URL（`location.href`）から作り、`assets` で渡す。`serve-repro.ts` の `servedByPages` と `bundle-layer1-pages.sh` は、ja の側で広げる範囲を各 recipe の dir の `_formicarium/` の下だけに限る。
- 候補に入れない案：page の scope の中に小さな module Worker を置き、そこから一組を import する形は、formicarium の core が子 Worker（`em-pthread`）を一組の置き場の URL から作るので、子 Worker が候補1と同じ問題を持つ。候補1が子 Worker で失敗した場合に効かないので、候補に入れない。blob の Worker と別の hosting も、formicarium・vivarium の構成を変えるので候補に入れない。
- 合格の基準（6組それぞれ）：page の `crossOriginIsolated === true`、Worker と子 Worker（`em-pthread`）の中でも `crossOriginIsolated === true` で `SharedArrayBuffer` が使えること、2端末の ready、判定の表示。これを、service worker の無い初回の訪問（新しい browser context。coi-serviceworker の登録と再読込を含む）と、登録済みの再訪問（同じ context で再読込）の両方で確かめる。
- 決め方：Code Generation の最初の段階で、deployed-shape の server（`serve-repro.ts`。COOP・COEP の header を自分では付けないので、service worker が付けない限り分離されず、偽の合格になりにくい）で候補1を3ブラウザ × en・ja で観測する。6組すべてで上の基準を満たせば候補1にする。1組でも失敗すれば候補2を同じ基準で観測し、すべて通れば候補2にする。両方とも失敗すれば止めて報告し、人間の判断を受ける。この決め方以外の方式を黙って選ばない。
- ELF は、どちらの候補でも en の dir に1か所だけ置く（page が取得する subresource なので、page の scope の中の取得になる）。
- 観測の記録（ブラウザの名前と版、OS、en・ja、候補、結果、console の error）を code-summary に残す。可能なら deploy の後に Pages でも同じ組を確かめる。
- page に CSP は置かない（vivarium は今置いていない）。置く場合は、formicarium の要件（wasm、module の Worker）を満たす設定を同じ観測で確かめる。
- Chromium・Firefox・WebKit は Playwright の latest の同梱の browser で、実機 Safari は別の証拠が無ければ unverified と記録する。

## S9：品質・証拠・外部操作（NFR2.1・NFR2.2・NFR8.1–NFR8.5）

- 回帰：vivarium の既存の Layer1・Layer2 の Playwright、docs の bun test、fixed-guest-builder の試験を U6 の変更の後に通す。U6 の試験の設定は `performance-design.md` の P5。
- coverage：U6 で足す第一者の TS の file の一覧（分母）を、受入の前に file に固定する。bun の script は bun test の coverage、ブラウザの共有 module と repro は Chromium の page の V8 の coverage を source map で TS の行へ対応させる。未実行の file を0%として分母に残す。測定の道具と command は Code Generation の計画で決め、PR の CI で実行する（方式は未検証）。
- 証拠：C10 の AcceptanceEvidence に、pin の sourceCommit と pack の SHA256、baseline と fix の `accepted`、catalog・fixture・command の digest を入れ、必須 check（`reproduction-comparison` など）の欠落・重複・failed・unverified を拒否する。別の候補のログを混ぜない。
- 外部操作：旧題材の Release 2件と tag の削除、bump の dispatch、build・Release の起動、pin file の更新、recipe を active にする PR の merge は、対象を示して人の承認を受けてから、書込み権限のある人が行う。承認と実行を記録する。secret や response の全文をログに出さない。
- notices：site build は、formicarium の LICENSE と THIRD_PARTY_NOTICES.md、coi-serviceworker.js の MIT の注記、Biome の license の出所（build-info から）が site にあることを確かめ、無ければ失敗にする。
- CI の権限：U6 は deploy-docs の job の権限と起動条件（main の push と workflow_dispatch）を変えない。repro-regression は `contents: read` のまま。

## Threat Response and Rollback

| 脅威・失敗 | 対応 |
|---|---|
| npm tarball・Release の asset の改変、別の tag・repository | S2 で site build を失敗させ、前回の site を保つ |
| build の後の site 上の file の差し替え・不揃い | S3 で実行の前に止める |
| coi-serviceworker.js の差し替え（page の全 fetch を書き換えられる） | S4 で PR と site build の両方で digest を照合する |
| guest の出力に HTML の記号 | S7 で文字として表示する |
| 分離の下で Worker が起動しない | S8 の決め方で候補を選ぶ。両方失敗なら止めて報告する |
| 公開後に問題が出た | recipe・pin file・`accepted` を変えた PR を revert し、revert した tree の site build を確かめる（NFR8.5） |

## Assumptions & Open Questions

None.
