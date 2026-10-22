# U6 recipe-runtime Functional Design の質問

## 前提（vivariumの読取り調査、2026-10-18、検証済み）

vivarium（ローカル main = 上流 `71e0ef92`、working tree clean）を読むだけで調べた結果、承認済みの要件（FR10–FR12）と契約（C08）が前提にしていた状態と、今のvivariumが違う。

- biome-12265 のrecipeは、上流で直ったため #518（`04a8724`「retire biome-12265, fixed upstream」）で削除済み。aube-1645 も #505 で削除済み。今 terrarium をruntimeに使うrecipeは0件。旧biome-12265の中身（recipe.json、repro.ts 216行、fixture `biome-migrate-prettier`、Playwright spec 88行）は `04a8724^` から復元できる。
- recipeのschema（`docs/site/public/spec/recipe.schema.json`）は `additionalProperties: false` で、`guests` を定義していない。上流のfixed-guest-bump（`tools/fixed-guest-builder/src/bump.ts:68-75`）は recipe.json の `guests[]` を読む前提で、同じtoolのguestを1件しか許さない（biomeのbaselineとfixの2件は扱えない）。
- recipeのruntimeのfield名は `expected_runtime`（値 pyodide / ruby.wasm / docker-snapshot / 旧terrarium）。Contract v1 の `runtime.name` はopaqueで、deprecatedの名前はない。
- terrariumの現役参照は、`src/layer1_wasm/_shared/terrarium_loader.ts`、`docs/scripts/terrarium-proxy.ts`（dev/試験serverの2か所から使用）、`page-templates.ts` の `TERMINAL_RUNTIMES`、`generate-repro-pages.ts`・`generate-repro-i18n.ts`・`bundle-layer1-pages.sh` の coi-serviceworker、`bump-upstream.ts` の terrarium `builds.json` 読取り、試験（`terrariumPins.test.ts`、`reproPreload.test.ts`、Playwright spec 3本の `SUPPORTED_RUNTIMES`）、style.css、文書（recipe-authoring.md、README 2つ、projects.json、Contract v1、schemaの説明）。
- 端末要素のうち、vivariumが使うのは `ready`・`run`・`transcript` だけ。`terrarium-ready/exit/error` のDOM eventとiframeのpostMessage bridgeは、vivariumでは使われていない。
- site・recipeは、まだformicariumにも、fixed-guestのRelease（`guest-biome-<key>`、build-info.json、catalog.json）にも依存していない。Layer1はbundlerなし（`tsc` が1対1で出力）で、他のruntimeはjsdelivr CDNからimportしている。site（GitHub Pages）にはCOOP/COEPのheaderが付けられず、coi-serviceworkerで分離を得ている。
- vivariumのAGENTS.md §3は「後方互換のshimを作らない」「将来への備えを作らない」「小さい差分」を求める。§4.9はspecの任意field追加を同じページのrevision、rename/removeをvN+1とする。
- formicariumの0.3.0（install・command APIを含む版）はまだnpmに公開されていない。公開済みは0.2.1。

このため、下の判断が必要になる。答えによっては、承認済みのContract Design（C08）や要件（FR10–FR12）を直すloopbackが要る。

## 質問

### Q1. biome-12265 が削除済みであることを踏まえた、U6の対象

FR11は「biome-12265 で before の semi/quotes が asNeeded/single、after が always/double となり、3ブラウザで旧verdictと一致する」ことを求める。

A. biome-12265 を、公開recipeではなく、formicarium runtime の回帰試験（vivariumの試験だけで使う固定recipe/fixture）として復元する。固定した2つのcommit（baseline `2405c762`、fix `f79f85d5`）は今も挙動が変わらないので、FR11の比較はそのまま成り立つ。site には載せない（retireの方針を守る）。
B. biome-12265 を公開recipeとして復元する（retire済みのrecipeを戻す。vivariumのretire方針と食い違う）。
C. biome-12265 は扱わず、今まだ直っていない別の不具合で、formicarium runtime の新しいrecipeを作る（対象の調査からやり直す）。
D. terrarium のrecipeが0件なので、U6はterrariumの現役参照の除去（FR12の整理）だけにし、formicarium runtime の導入（FR10・FR11）は、必要なrecipeが出るまで延ばす。
X. Other (please specify)

[Answer]: X. 人間の回答「別の不具合があります。jamのforkのブランチにあるfix/migrate-prettier-override-bracket-spacingです。こちらを題材にしましょう。古い修正済みのものは削除して下さい。もう不要です。」

確認したこと（GitHub API、読取り）：`JamBalaya56562/biome` の branch `fix/migrate-prettier-override-bracket-spacing` の先頭は `25e3e2c2d97c5e1780d10833c9f63fc6dce0f8a9`（2026-10-11、「fix(migrate): carry Prettier's bracketSpacing in overrides」）。biomejs/biome main の `e26a76bd989e57d7c44f38cb89a39637de7fee6a`（2026-10-11、#12240）に1 commitを足したもの。変更は `crates/biome_cli/src/execute/migrate/prettier.rs`（overrideの `bracketSpacing` を Biome の override の `formatter.bracketSpacing` へ移す）、試験 `prettier_migrate_override_bracket_spacing` とsnapshot、changeset。Prettier の `.prettierrc` が `{"overrides":[{"files":["*.js"],"options":{"bracketSpacing":false}}]}`、`biome.json` が `{}` のとき、fix後の `biome migrate prettier --write` は override に `{"includes":["*.js"],"formatter":{"bracketSpacing":false}}` を書く。fix前（`e26a76bd`）は override の `bracketSpacing` が落ちる（推測。fixの差分から読んだ。実行は未確認）。biomejs/biome に対応するissue・PRは、検索では見つからなかった。

### Q2. 同じtoolのguestを2つ持つrecipeの区別

biome-12265 は同じtool（biome）の baseline と fix の2つのguestを使う。上流のfixed-guest-bumpは、recipeの `guests[]` で同じtoolを1件しか許さない。

A. `guests[]` の各要素に、recipe内で一意の `role`（例：`baseline`・`fix`）を必須で加える。fixed-guest-bump は `role` で対象を選ぶように直す（上流vivariumの変更）。
B. `guests[]` は今のまま（同じtoolは1件）にし、fixのguestは別のfield（例：`fix_candidate` に `elfSha256`・`buildInfoSha256` を足す）で表す。
C. baselineとfixを別々のrecipeに分ける（1 recipe = 1 guest）。
X. Other (please specify)

[Answer]: A

### Q3. 旧 `fix_candidate` と terrarium の `builds.json` を読むbumpの扱い

今の `fix_candidate`（repository・branch・commit）と、terrarium の `builds.json` を読んで fix_candidate を進める `bump-upstream.ts` の分岐は、新しい `guests[]` と役割が重なる。

A. terrariumの `builds.json` を読む分岐と `terrariumPins.test.ts` は消す。`fix_candidate` は他のruntime（pyodideなど）でも使うので残し、formicarium runtime のrecipeでは `guests[]` を固定入力の正とする。
B. `fix_candidate` も formicarium runtime では使わず、`guests[]` に一本化する（schemaで両方を持つことを拒否する）。
C. 今回は消さず、残す（AGENTS.md §3 のshim禁止と食い違う）。
X. Other (please specify)

[Answer]: A

### Q4. formicariumのpackageをvivariumへ取り込む方法と版

same-origin Worker が必要なので、formicarium の browser bundle（`runtime/web/*`・`assets/blink.*`）を vivarium の Pages 配下に置く必要がある。Layer1は bundler がない。

A. build時に、npm の `@aletheia-works/formicarium` の固定版（tarballのSHA256を固定）から必要なfileを vivarium の Pages 配下へcopyする（`bundle-layer1-pages.sh` のような既存の方式）。版は 0.3.0 の公開後に固定し、それまでは試験用にローカルtarballを使う。
B. A と同じcopy方式だが、0.3.0の公開を待たず、formicarium の Release（GitHub）にあるtarballを固定digestで使う。
C. jsdelivr などのCDNから読み込む（Workerがcross-originになり、COI下で動かない可能性が高い）。
X. Other (please specify)

[Answer]: A

### Q5. 固定guest（Releaseのasset）の取得元

fixed-guestの成果物は `https://github.com/aletheia-works/vivarium/releases/download/guest-<tool>-<key>/<asset>` にある。COEP require-corp の下では、ブラウザからのcross-origin取得が通らない可能性がある（未検証）。

A. site のbuild時に、recipeの `guests[]` の固定digestで Release から取得・照合し、Pages 配下の同じoriginへcopyする。ブラウザは同じoriginから取得し、実行前にもう一度digest・build-infoを照合する。
B. ブラウザが実行時に Release から直接取得する（COEP/CORSで動くかを先に確かめ、動かなければAへ切り替える）。
X. Other (please specify)

[Answer]: A

### Q6. Contract v1 と schema での runtime 名の扱い

承認済みのC08は「runtime.name=formicarium を受け付け、terrarium を deprecated互換として残す」としていた。今 terrarium を使うrecipeは0件で、AGENTS.md §3 は互換のshimを作らないとしている。

A. `expected_runtime` に `formicarium` を加え（schemaの説明・Contract v1 の表を同じページのrevisionで更新）、`terrarium` は現役の値から外し、歴史の説明としてだけ残す（deprecated互換のadapterは作らない）。C08をこの形に直す。
B. C08のとおり、`terrarium` を deprecated互換の値として受け付け、formicarium の adapter に読み替える。
X. Other (please specify)

[Answer]: A。人間の補足「terrariumは完全削除の予定です。特に使う復活させる必要も、今のところはないし、仮に復活させたとしても今のterarriumが参考になりそうなものにはならないと思っています。だから、削除する報告で、互換のadapterとかも一切不要です。」

### Q7. 端末要素の互換範囲

承認済みのC08は、`ready`・`run`・`transcript` に加えて、`terrarium-ready/exit/error` のDOM event と iframe の postMessage bridge の互換を求めていた。vivariumはeventもbridgeも使っていない。

A. vivariumが使う `ready`・`run`・`transcript` だけを提供し、DOM event と iframe bridge は作らない（使う人がいない。C08をこの形に直す）。
B. C08のとおり、DOM event と iframe bridge も提供する。
X. Other (please specify)

[Answer]: A

### Q8. 「古い修正済みのもの」の削除の対象（Q1の回答の確認）

biome-12265 の固定guest（baseline `2405c762`・fix `f79f85d5`）には、次のものが残っている。

- 上流 aletheia-works/vivarium の Release 2件（tag `guest-biome-15432368…` と `guest-biome-4751f68d…`。ELF・build-info・catalog）。
- vivarium の `tools/fixed-guest-builder/allowlist.json` の `jambalaya56562/biome`（新しい題材も同じforkなので、残す必要がある）。
- formicarium の手元の `.artifacts/migration-guest-build/`（U5の証拠。追跡されない）。U5の記録が、この中のfileとdigestを引用している。
- vivarium の working tree の、gitignoreされた biome-12265 のbuild残骸（`src/layer1_wasm/biome-12265/` の4件）。
- formicarium の記録（U1・U5、要件FR9・FR11、契約C08・C10の biome-12265 の記述）。

A. vivarium の Release 2件とtag、vivarium の build残骸を消す。formicarium の `.artifacts` のU5の証拠と記録は、U5の受入の根拠なので残す。要件・契約の biome-12265 の記述は、新しい題材へ書き換える（loopbackで承認を受ける）。Release の削除は書込み権限のある人が行う。
B. A に加えて、formicarium の `.artifacts/migration-guest-build/` も消す（U5の記録が引用するfileが無くなる）。
C. vivarium の build残骸だけを消し、Release 2件は残す（U5の証拠として残す）。
X. Other (please specify)

[Answer]: A

## 回答の分析で出た追加の質問

### Q9. recipe の名前（slug）

vivarium の規則（`.claude/rules/recipe-authoring.md` 40–47行）では、数値のupstream issueがあれば `<project>-<issue>`。今回の不具合には、biomejs/biome の issue も PR もない。

A. 先に人間が biomejs/biome に issue を立て、`biome-<番号>` にする。
B. issue番号なしの説明的な名前（例 `biome-migrate-override-bracket-spacing`。issue=0 として扱われる）にし、issueが立ったら名前を変える。
X. Other (please specify)

[Answer]: B

### Q10. baseline の commit

A. fix の親の biomejs/biome main `e26a76bd`（#12240、2026-10-11）にする。差はその修正の1 commitだけになる。
B. その時点の最新の biomejs/biome main にする。
X. Other (please specify)

[Answer]: B。人間の補足「ブランチが最新のmainからrebaseしていないから、確かに他の変更が入りますが、まだ修正されていないから大丈夫です。逆に最新のmainの挙動と今回の対象のブランチの変更が全く同じであるなら、すでに解決しているとわかるし、それはそれで意味があります。だから、ここは規則通りにお願いします。」

### Q11. 承認済みの要件・契約への反映

A. `requirements.md` と `contract-summary.md` に、日付付きの改訂節（2026-10-18、人間の決定）を足して直し、U6の設計にも差分を書いて、この工程のレビューと承認で一緒に確かめる。他のUnitの承認は開き直さない。
B. Requirements Analysis（または Contract Design）を開き直す。
X. Other (please specify)

[Answer]: A

## review-01（NOT-READY）の後の追加の質問

### Q12. digest が空になる間の recipe の扱い（R-02）

baseline が main を追うため、bump のたびに「bump を merge → main で build・Release → digest を書く PR」の間、今の上流の bump では recipe の digest が空になる。

A. bump は新しい commit を書き、今の受入済みの commit と digest は残す（`accepted` に分ける）。site は受入済みの guest で動き続け、build・Release の後に人が確かめる PR で置き換える。上流の fixed-guest-bump（U5）の変更が要る。
B. bump は今のまま digest を消す。digest が入るまで、その recipe は site で「準備中」とし、回帰試験でも合格ではなく未検証とする。
C. bump は今のまま digest を消す。digest が入るまで site の build を失敗させる。
X. Other (please specify)

[Answer]: A

## 回答の分析（曖昧さ・矛盾の確認）

- 矛盾の解消：Q1・Q6・Q7・Q8 は承認済みの FR9・FR11・FR12 と C08・C10 の一部を変える。Q11=A により、上流の文書に日付付きの改訂節を足し、この工程のレビューと承認で確かめる。
- Q3=A と Q2=A の関係：formicarium runtime の recipe は `guests[]`（role付き）を固定入力の正とし、`fix_candidate` を宣言しない。`fix_candidate` は他のruntimeのために schema に残る。
- Q10=B と固定入力の関係：baseline は「作成時点の biomejs/biome main を40桁commitへ解決した値」を固定し、上流の fixed-guest-bump が main の先頭の移動を追う（FR8）。branch名だけでbuildしない。
- Q6 の補足（terrarium は完全削除の予定）：vivarium 側の terrarium の現役参照の除去は U6、terrarium repository 自体の退役は U9（FR16）の範囲のまま。
- 残る未確定はない。
