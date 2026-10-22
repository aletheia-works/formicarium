# U6 recipe-runtime の CI と公開

## Sources

`infrastructure-design-questions.md`（Q1=A、Q2=A）、`infrastructure-specification.md`、`monitoring-design.md`、`../nfr-design/security-design.md`（S2 の mode の表と「PR での照合」、S4、S5、S8、S9）・`performance-design.md`（P1・P5）、NFR Design の review-02 の Minor（R-08〜R-10）。vivarium の `deploy-docs.yml`・`repro-regression.yml`・`test-docs.yml`・main の ruleset（必須 check に `regression (chromium)`・`regression (firefox)`・`regression (webkit)`）、`src/layer1_wasm/playwright.config.ts`（ローカル main = `71e0ef92`、2026-10-19 に読取り）。設計で、workflow の変更は未実装・未検証。

## Triggers and Modes

| workflow | 起動 | U6 の step | AssetStager の mode |
|---|---|---|---|
| test-docs | pull_request（main）と push | coi-serviceworker の digest の検査、deploy-docs の command に `local` が無いことの検査（S4・S2） | 使わない |
| repro-regression の regression（3ブラウザの matrix） | pull_request・main の push・schedule・workflow_dispatch | active の formicarium の recipe が1つでもあれば、毎回 Playwright の前に AssetStager を動かす（R-10） | `pin` |
| deploy-docs | main の push と workflow_dispatch | `repro:i18n` の直後、Rust の残りを消す step の前に AssetStager | `pin` |
| main session の手元 | 人の指示 | 0.3.0 の公開前の開発・S8 の観測・回帰試験 | `local` |

- active の formicarium の recipe が無い間（pin file か `accepted` が無い）は、AssetStager は何も取らずに「対象なし」と理由を job summary に書いて成功する。pending を合格とは扱わない（recipes index の出力で区別する）。
- regression の matrix の3つの job は、それぞれ自分で AssetStager を動かす。job の間で staging の artifact を渡さない。PR の run の artifact を別の job が信用しないためで、取得の重複（1回の run で ELF 約660MiB）は受け入れる（R-10 の判断）。

## Stages

deploy-docs の build の job（変更後）：

1. checkout、mise の setup、Pages の設定（今のまま）
2. `docs:build`、`repro:build`、`repro:i18n`（今のまま。tsc は formicarium を import しないので staging に依存しない）
3. AssetStager（`pin` mode）：pin file と各 active の recipe の `accepted` で取得・照合し、`src/layer1_wasm/_formicarium/<version>/`、`src/layer1_wasm/_formicarium/assets.json`、各 recipe の `guests/<role>/` に書く。notices（formicarium の LICENSE・THIRD_PARTY_NOTICES.md、coi-serviceworker の MIT の注記、Biome の license の出所）の有無と、staging と今の `docs/doc_build` の大きさの合計（1GB 以下）もここで確かめる（NFR8.3・NFR6.4）。job summary に照合の表を書く
4. Rust の残りの削除、Layer 2 の判定と image の公開（今のまま）
5. `bundle-layer1-pages.sh`（`_formicarium` を project ごとに写さず `repro/_formicarium/` へ1回だけ写すように直す。S8 で候補2になった場合は各 page の dir へ写す）、Layer 2 の bundle
6. 最終の site の大きさの記録と検査。site 全体が 1GB を超えれば失敗
7. upload-pages-artifact と deploy（今のまま）

notices と大きさの主な検査を step 3 に置くのは、step 4 の Layer 2 の image の公開（GHCR）より前に失敗させるため。step 6 だけが失敗した場合は、新しい GHCR の image と前回の site が並ぶ。Layer 2 の image は U6 と独立した recipe のもので、前回の site は前の tag を参照し続けるので、直しの PR の deploy で揃える（image を消す操作はしない）。

repro-regression の regression の job（変更後）：今の「Type-check + build Layer 1」の step の後、Playwright の前に AssetStager（`pin` mode）を置く。U6 の spec は `test.describe.configure({ retries: 0 })` と `test.setTimeout(180_000)` を自分で持ち、CI の `retries: 1` を使わない（P5）。Playwright は各組の attachment に `browser.version()` と OS を書き、job summary にも出す（NFR6.7）。

### job の時間の予算

job の `timeout-minutes: 20` は変えない。

| 部分 | 予算 | 根拠 |
|---|---|---|
| 今の step（checkout から Layer 2 まで） | 約4〜8分 | 観測した run の 3分43秒〜8分01秒 |
| AssetStager | 全体で6分。step の `timeout-minutes: 7` | 取得は7件で、各 120秒の deadline（C11）は変えない。全体の6分を超えたら、AssetStager が自分で TIMEOUT と原因を書いて止まる。job の timeout より先に原因が出る |
| U6 の試験（en・ja の2組） | 最大6分（各 180秒） | NFR6.1 |

最悪の合計は約20分で余裕が無い。Code Generation の最初の CI の run で実際の時間を記録し、job の時間が足りなければ止めて報告する（上限を黙って変えない）。

### coverage の step（NFR2.2）

- `regression (chromium)` の job（main の ruleset の必須 check）の中で、Playwright の後に coverage の step を置く。ruleset は変えない。
- 分母の一覧（U6 で足す第一者の TS の file と、除外の理由）を `src/layer1_wasm/` の下の file に固定する。bun test の coverage（AssetStager など）と、Chromium の V8 の coverage を source map で TS の行へ対応させた結果を合わせ、分母の一覧と照合する。未実行の file は0%として残す。
- 合計の行 coverage が 80% 未満、又は分母の file が report に無いときは step を失敗させる。PR を merge できなくなる。
- 分母の一覧・除外の理由・report・実行した command を artifact に上げる。測定の道具の名前と具体の command は Code Generation の計画で決める（方式は未検証）。

## Gates

| Gate | 誰が見るか | 合格の条件 |
|---|---|---|
| PR の必須 check `regression (chromium/firefox/webkit)` | ruleset | AssetStager の照合と U6 の 6組の試験の合格。pin・`accepted` の誤りは merge の前にここで止まる（NFR Design S2） |
| PR の test-docs | PR の check | coi-serviceworker の digest と、deploy-docs の command の検査 |
| PR の merge | 人 | 外部操作の承認（NFR8.2）：pin file の更新、recipe を active にする PR、`accepted` の置き換え。S6 の provenance の確認を PR に書く。AssetStager・`coi-serviceworker-pin.ts`・workflow を変える PR では、検査の code そのものが変わるので、その差分を人が読んで承認する（同じ PR の check の合格だけで信用しない） |
| deploy-docs | 自動（main の push） | AssetStager と大きさ・notices の検査の合格。失敗なら deploy されず前回の site が残る |
| U6 の受入（C10） | main session と人 | 0.3.0 の公開と pin file の後、3ブラウザ × en・ja の W5 の記録 |

## Deployment Strategy

main の push ごとの全体の置き換え（GitHub Pages の通常の deploy）。段階的な公開は無い。公開の前の確認は、PR の必須 check と人の merge である。

## Rollback

- recipe・pin file・`accepted` を変えた PR を revert し、revert した tree の deploy-docs の成功と site を確かめる（NFR8.5）。
- AssetStager の照合の失敗では deploy されず、前回の site が残る。原因（Release・npm の変化）を job summary で確かめてから、人が直しの PR を作る。
- pin の取得元（npm の版、Release の tag の asset）が消えた・変わった場合も、AssetStager の失敗で deploy されず、前回の site が残る。人が、その recipe の `accepted`（又は pin file）を外して pending にする PR か、新しい build の `accepted` の PR を作る。
- `assets.json` は固定の path なので、deploy の後しばらく Pages の cache に前の内容が残り得る（推測）。その間に版の合わない file を取っても、S3 の照合で実行せずに原因を出す。cache が切れれば直る。
- 旧題材の Release 2件の削除は戻せないので、対象を示して個別の承認を受けてから行う（BR6.3・NFR8.2）。

## Secrets and Permissions

- AssetStager は token を使わない。deploy-docs と repro-regression の AssetStager の step の `env` に `GITHUB_TOKEN`・`NPM_TOKEN` などを渡さない。script もそれらを読まない（S2 の試験）。
- deploy-docs の job の権限（`contents: read`・`pages: write`・`id-token: write`・`packages: write`）と起動条件は変えない。repro-regression は `contents: read` のまま。
- fork からの PR でも、AssetStager は公開の URL だけを読む。`pull_request` の run は読取りだけの token で secret を持たず、fork の PR は deploy しない（今の起動条件）。
- docs の bun test は、deploy-docs と repro-regression の両方の workflow の file を読み、AssetStager の step が `pin` mode だけで、`env` に secret が無いことを確かめる。
- deploy-docs の checkout は今 `persist-credentials` を既定（true）のままにしている。AssetStager は git の設定を読まないが、後の step が git の push を要しないなら `persist-credentials: false` にするかを Code Generation の計画で確かめる（推測。範囲は deploy-docs の checkout の1行に限る）。

## Network failures

- 取得は自動 retry しない（C11）。active の recipe がある間、Release・npm の一時的な障害は、無関係な PR の regression と docs だけの deploy も止める。これは、照合できない入力を公開しないための受け入れたリスクである（NFR3.2）。
- 止まった場合は、原因を job summary で確かめ、人が Actions の「Re-run failed jobs」で再実行する（人の操作で、自動の retry ではない）。

## Test Automation

- bun test（docs）：AssetStager の照合（改変・欠落・別の tag・別の repository・上限 +1・redirect の規則・token を送らないこと）、`local` mode の tarball の d.ts に対する型の照合、coi-serviceworker の digest、deploy-docs の command の検査。
- Playwright（regression）：U6 の page の 3ブラウザ × en・ja、retry 0、180秒。
- coverage（NFR2.2）：分母の一覧を受入の前に file に固定し、bun の coverage と Chromium の V8 の coverage を PR の CI で集める。道具と command は Code Generation の計画で決める。
- S8 の観測は Code Generation の最初に main session が `local` mode と `serve-repro.ts` で行う。候補1・2が両方失敗した場合の予備（page の scope の中の小さな module Worker。NFR Design review-02 の R-09）は、人間の判断を受けてから試す。

## Assumptions & Open Questions

None.
