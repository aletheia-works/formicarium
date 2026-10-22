# U6 recipe-runtime 実装計画

## Summary

- Builds: vivarium の最初の formicarium runtime の recipe（`biome-migrate-override-bracket-spacing`）、site build で npm の固定版と固定 guest を照合して置く AssetStager、2端末の共有 module、CI の照合と coverage の step、上流の bump の role 対応、terrarium の現役参照の除去。
- Touches: vivarium の fork（`~/Documents/vivarium`、新しい bookmark）の `src/layer1_wasm/`、`docs/scripts/`、`scripts/bundle-layer1-pages.sh`、`tools/fixed-guest-builder/`、`.github/workflows/`、`.gitignore`、schema・Contract v1・文書。formicarium は U6 の記録だけ。
- Tests: 部品ごとに5–8件の bun test（約70件）と、Playwright の U6 の spec（3ブラウザ × en・ja、retry 0、180秒）、workflow の静的な試験、行 coverage 80% の測定。

## 前提と境界

根拠は承認済みの U6 の functional-design（BR1.1–BR8.1、W1–W6）、nfr-requirements（NFR2.1–NFR8.5）、nfr-design（P1–P6、S1–S9）、infrastructure-design（vivarium の変更の一覧、cicd-pipeline の Stages・Gates・job の時間の予算・coverage の step）。契約は C03・C05・C07・C08・C10・C11、要件は FR10–FR12（2026-10-18 の改訂節を含む）。User Stories は無いので、要件 ID と設計 ID へ直接対応させる。

人間の決定（2026-10-19）：vivarium の変更は vivarium の fork（`~/Documents/vivarium`、`origin` = Marukome0743/vivarium、`upstream` = aletheia-works/vivarium）で直接行う。formicarium には U6 の記録だけを置き、formicarium の製品 code・既存の試験・U1–U5 と U7 の証拠は変えない。

- vivarium の作業は `main@upstream` から作る bookmark `u6-formicarium-recipe` で行う。upstream への PR の作成、push、merge、workflow の起動、Release の作成と削除は、実際の内容を示して個別に承認を受ける。merge・workflow の起動・Release の操作は書込み権限のある人が行う（NFR8.2）。
- 品質基準とtimeoutは緩めない（回帰試験の組ごと180秒・goto から判定まで120秒・retry 0、C11 の取得120秒と各上限、wasm 1GB、行 coverage 80%、regression の job 20分、formicarium の probe 600秒・aube 840秒・1 worker）。未変更の aube は再 build しない。build・test は main session で1つずつ実行する。
- test-after：各層を実装した後に、その層の試験を書いて実行する。失敗したら観測結果と修正案を示して確認を待つ。不具合の修正は、再現の試験の失敗を先に観測してから直す。
- formicarium 0.3.0 の公開前は pin file を置かず、recipe は pending のまま merge できる。それまでの試験は AssetStager の `local` mode で行う。U6 の最終受入は 0.3.0 の公開と pin file の後（NFR3.4）。

## 持ち越した指摘の反映

1. NFR Requirements の review-02：NFR6.1 の数え方（人間の確認済み）、coi-serviceworker の digest の置き場（S4 の共有 module）、NFR6.6 の欠番。Step 5・Step 13 で反映する。
2. NFR Design の review-02：`assets.json` は版を含まない固定の path（`_formicarium/assets.json`）に置く（R-08）。小さな module Worker の案は、候補1・2が両方失敗したときの予備で、人間の判断を受けてから試す（R-09）。active の formicarium の recipe があれば、regression の毎回の run で Playwright の前に AssetStager を動かす（R-10）。
3. Infrastructure Design の review-02：AssetStager の全体6分は C11 に無い運用上の上限（厳しくする向き）として code と文書に書き、計測で見直すときは人の承認を受ける（R-09）。job の時間の予算に coverage の step を入れ、coverage の artifact の保持期間を決める（R-10）。
4. Functional Design の review-02：一部だけの `accepted` は検証失敗（Step 4）。W1 step 4 の build は人の dispatch と承認（Step 16）。照合は guest の tool・repository と `accepted` の commit・buildKey で行う（Step 5・Step 7）。「main で直っている」は `accepted` の baseline の commit の話と記録する（Step 9・Step 17）。

## Step 3 の結果と計画への反映（2026-10-19、人間の回答）

Step 3 の観測では、候補1は3ブラウザとも Worker が起動せず、候補2は Chromium・Firefox で合格したが WebKit 27.2 で基準を満たさなかった。追加の調査で、coi-serviceworker の `coepCredentialless` を false に固定し（`window.coi = { coepCredentialless: () => false }`、coi-serviceworker の file は変えず digest も固定のまま）、package の Worker を import の無い1つの file にすると、3ブラウザ × en・ja × 初回・再訪問のすべてで基準を満たした（U6 の code-summary の Step 3）。人間の回答で、1つの file の Worker は formicarium の package に入れ（U2 の6回目の再開で実装、review READY、checkpoint 承認済み。配布物の `runtime/web/package-worker.bundle.js`、SHA256 `8cc5f468…ee98`）、新しい pack で24組の観測をやり直して合格した（U2 Step 29）。これにより：

- 置き場は候補2とする（S8 の決め方どおり）。Step 11 は候補2の分岐（各 page の dir と ja の dir へ `_formicarium/` を写し、`serve-repro.ts` の `servedByPages` を ja の `_formicarium/` の下だけに広げる）で行う。`assets.json` は各 page の dir の `_formicarium/assets.json`（版を含まない固定の path）に置く。
- Step 13 の recipe の page は、coi-serviceworker を読む前に `window.coi = { coepCredentialless: () => false }` を置く（en と ja の両方。`generate-repro-i18n.ts` の写しでも保つ）。この設定を外した page が WebKit で基準を満たさないことは観測済みで、試験（Step 14）でこの設定があることを確かめる。CORP の無い cross-origin の取得はできなくなる（今の recipe は同じ origin だけ）ことを README と文書に書く。
- formicarium の Worker は配布物の既定の Worker（1つの file）を使い、`createSession` に別の Worker を渡さない。ja の page は `assets` で ja の dir の `_formicarium/` の Worker・wasm の URL（`location.href` から作る）を渡す。
- `local` mode の入力の tarball は、U2 の変更の後に作った `.artifacts/u6-recipe-runtime/private-bundle.tgz`（SHA256 `72172c28…be1b`）を使う。0.3.0 の公開の後は、その版の tarball に1つの file の Worker が入っていることを AssetStager の一覧の照合で確かめる。

## Testing Contract

```json
{
  "version": 1,
  "methodology": "test-after",
  "source": "team",
  "ordering": "通常の新規実装は各テスト可能な層を実装した後にその層のテストを作成・実行し、不具合修正は再現テストの失敗を先に観測してから修正し同じテストの成功を確認する。（人間の回答 Q3）",
  "scope": "classic",
  "test_strategy": "standard",
  "project_type": "brownfield",
  "applicable_notes": [
    {
      "layer": "org",
      "text": "We treat tests as a first-class deliverable in every Bolt. The specific\nmethodology (TDD, BDD, ATDD, or classic test-after) is affirmed at\npractices-discovery and recorded in `team.md` under this heading with explicit\n`Methodology` and `Ordering` fields; Code Generation resolves those fields\nindependently from coverage, tooling, and scope notes.\n\nWhen no posture has been affirmed, our default per scope is:\n- **Methodology**: test-after\n- **Ordering**: implement each applicable testable layer, then write and run\n  that layer's tests.\n- `mvp`, `enterprise`, `feature`, `infra`, `classic` add an 80% line-coverage\n  floor and CI execution before merge.\n- `bugfix`, `security-patch` add a targeted regression for the specific\n  bug/vulnerability and require the existing suite to remain green.\n- `express` uses the Minimal strategy: requirement-driven unit tests (one per\n  requirement, with a happy-path floor per component); existing tests remain\n  green.\n- `poc`, `refactor`, `workshop` add no extra new-test floor and require the\n  existing suite to remain green.\n\nThe active `Test Strategy` still applies in every scope and determines test\nvolume/types. Scope floors are additive; they never reduce or replace the\nselected strategy.\n\nBuild and Test verifies defined coverage floors and affirmed quality targets;\nthey may not be weakened to make a step pass.\n\nAffirm a stricter posture in `team.md` if the team commits to one."
    },
    {
      "layer": "team",
      "text": "- **Methodology**: test-after\n- **Ordering**: 通常の新規実装は各テスト可能な層を実装した後にその層のテストを作成・実行し、不具合修正は再現テストの失敗を先に観測してから修正し同じテストの成功を確認する。（人間の回答 Q3）\n- node:test と Playwright の既存結合テストを利用する（検証済み：package.json scripts、code-quality-assessment.md）。今回の成功結果・coverage 値は未検証。\n- classic の追加条件は行 coverage 80%以上と統合前 CI 実行（ドキュメント根拠：org.md Testing Posture）。基準を下げて通過させない。\n- coverage の技術提案（未実装・未検証）：第一者が保守する配布 JS 全体（既存 runtime の未変更ファイル、共通処理、公開 API、Node/browser Worker adapter を含む）の一覧を事前に固定し、未実行ファイルも分母に含める。tests、生成 blink JS/wasm、第三者/vendor、ゲスト ELF、.d.ts、デモ・開発専用 scripts は理由を明示して対象外とし、資産・型・回帰検証を別途行う。設計で配布対象を確定し、閾値達成のために除外を変更しない。\n- Worker/ブラウザ内の計測を収集・マージし、対象一覧と照合して欠落を検出する。未収集ファイルを分母から外さず0%または未測定として失敗／未検証を報告する。計測方式は担当者が未importファイル・別process/realmを含む試験を観測して選ぶ。対象一覧、除外理由、行数、レポート、実行コマンドを CI 成果物へ残す。ブランチ coverage の新しい数値条件は追加しない。\n- 既存上限は probe 600秒、aube ブラウザ840秒、1worker、retryなし、probe 8項目全通過、native 出力一致、wasm 1GB。テストは main session が逐次実行する（人間の指示：AGENTS.md）。\n- aube はソースが変わっていなければ再ビルドしない。計測は重い並行処理なしで行う。新しいコア不具合の回帰 probe は native Linux でも確認する。\n- npm tarball の import/Worker/型/wasm・notices・build-info の同梱確認は設計候補（推測・未検証）。ゲストと fixture は terrarium 側の ref 別配布という既存意図を維持する。"
    }
  ],
  "obligations": {
    "strategy": "standard",
    "strategy_volume": [
      "Five to eight tests per component.",
      "Unit tests plus integration tests for key boundaries.",
      "Add E2E, performance, or security tests when requirements demand them."
    ],
    "scope_floor": [
      "Keep the existing test suite green.",
      "This scope adds no extra new-test floor beyond the selected test strategy."
    ],
    "combination_rule": "Apply every selected-strategy obligation and every scope-floor obligation; neither replaces the other, and a targeted scope regression may add the narrowest necessary test type beyond the strategy default."
  },
  "plan_profile": {
    "methodology": "test-after",
    "runner_step": "Verify the existing test runner/configuration and record the exact unit-scoped command.",
    "runner_ready_before_first_test": true,
    "testable_layers": [
      "Data model / database behavior",
      "Repository / data access",
      "Business logic",
      "API / endpoint",
      "Frontend behavior"
    ],
    "steps": [
      "Project structure and production configuration skeleton.",
      "Verify the existing test runner/configuration and record the exact unit-scoped command.",
      "Data model / database behavior - implement.",
      "Data model / database behavior - write and run its tests after implementation.",
      "Repository / data access - implement.",
      "Repository / data access - write and run its tests after implementation.",
      "Business logic - implement.",
      "Business logic - write and run its tests after implementation.",
      "API / endpoint - implement.",
      "API / endpoint - write and run its tests after implementation.",
      "Frontend behavior - implement.",
      "Frontend behavior - write and run its tests after implementation.",
      "Environment/build configuration.",
      "Documentation and traceability."
    ]
  },
  "input_sha256": "sha256:dd7d634a9c475bfe0b7fdd87b1566bd3f238a9b0ead389ae268b08de9bf333f2",
  "contract_sha256": "sha256:ce013e1551c9c06de1a756c04942d606c8dffe82caf0ae8422f95df28968c638"
}
```

層の対応：Data model = recipe の schema と宣言の検証、Repository / data access = AssetStager（npm・Release の取得と照合、staging）、Business logic = 判定（override の bracketSpacing、digest の正規化）と bump の role、API / endpoint = 開発用 server と site の配置（bundle・serve-repro・middleware）、Frontend behavior = 2端末の共有 module と recipe の page。

## Steps

- [x] Step 1: 構成と toolの確認。`jj git fetch` で vivarium の `main@upstream` を確かめ、そこから `jj new` して bookmark `u6-formicarium-recipe` を作る。使う tool の最新版を確かめる（Bun、Node、TypeScript、Playwright と同梱の3ブラウザ、Biome、actionlint、ShellCheck、coi-serviceworker、formicarium の npm の最新版）。古いものがあれば差分を報告する。formicarium の main から配布候補の tarball を作る既存の手順を確かめ、`local` mode の入力として作る（作り方の command を記録する）。（NFR2.1、tech-stack-decisions の Version check）
- [x] Step 2: 試験の runner の確認と command の記録。vivarium の docs の bun test、`tools/fixed-guest-builder` の bun test、`src/layer1_wasm` の Playwright（`--project` で1ブラウザ）が今の main で動くことを、既存の試験を1つずつ実行して確かめ、U6 用の command を `unit-test-instructions.md` に記録する（この Step で instructions は変えない。違いがあれば止めて報告する）。
- [x] Step 3: S8 の置き場の観測（NFR6.8、NFR Design S8）。`local` mode の代わりに手で、formicarium の tarball の一組と旧題材の保存済みの Biome の ELF（U5 の証拠。置き場と Worker の起動の確認だけに使う）を gitignore の下へ置き、最小の確認用の page で、候補1（`repro/_formicarium/<version>/`）を `serve-repro.ts` で3ブラウザ × en・ja、初回と再訪問で観測する。基準は page・Worker・子 Worker（`em-pthread`）の `crossOriginIsolated === true` と `SharedArrayBuffer`、2端末の ready。1組でも失敗すれば候補2を同じ基準で観測する。両方失敗なら止めて報告する（予備の案は人間の判断の後）。結果（ブラウザの版・OS・候補・結果・console の error）を code-summary に記録し、確認用の page は commit しない。
- [x] Step 4: Data model の実装。`docs/site/public/spec/recipe.schema.json` に `guests`（role・tool・repository・commit・reference・fixture・`accepted` の5 field）を任意 field として加え、`generate-recipes-index.ts` に宣言の検証（BR1.1–BR1.4、BR1.8：guests の必須、role の一意と baseline の存在、正規 URL と allowlist、40桁、一部だけの `accepted` の拒否、formicarium の recipe の `fix_candidate` の拒否）と active・pending の判定（BR1.7、理由 `accepted-missing`・`pin-missing`）を入れる。（FR10、FR12、NFR3.1、S1）
- [x] Step 5: Data model の試験。`docs/scripts/__tests__/recipesIndex.test.ts` に U6 の場合を足す（role の重複、baseline の欠落、不正な URL、allowlist 外、40桁でない commit、一部だけの `accepted`、`fix_candidate`、pending の理由、他の runtime の recipe が従来どおり通ること）。実行する。
- [x] Step 6: Repository / data access の実装。`docs/scripts/coi-serviceworker-pin.ts`（版 0.1.7 と SHA256）と AssetStager（`docs/scripts/stage-formicarium-assets.ts`）を作る。`pin` と `local` の mode、pin file `src/layer1_wasm/formicarium.pin.json` の検証、npm と Release の取得（`credentials: 'omit'`、手動の redirect 最大5 hop・HTTPS・userinfo なし・loop 拒否・最終 URL の記録、AbortSignal.timeout 120秒、stream の累積で上限、retry なし）、全体6分の運用上の上限、tarball の memory の中の展開と全 entry の検査（C11 の 256MiB・4096 entry・4096 bytes、通常の file だけ、一覧との完全一致、各 SHA256）、build-info の identity の照合、notices の確認、staging と `docs/doc_build` の大きさの確認、`_formicarium/assets.json` の出力、job summary の表。tar の読み方は、disk へ直接展開しない第一者の小さな実装か保守されている library のどちらかを、Step 1 の確認の結果で選んで code-summary に理由を書く。環境変数の token を読まない。（NFR3.2、NFR3.4、NFR3.5、NFR4.1、NFR6.4、NFR6.5、NFR8.3、NFR8.4、S2、S4、S5）
- [x] Step 7: Repository / data access の試験。`docs/scripts/__tests__/stageFormicariumAssets.test.ts` と `coiServiceWorkerPin.test.ts` を作る。fetch を注入して、tarball の改変、entry の `..`・絶対 path・symlink・hardlink・重複・一覧に無い entry・一覧にあって無い file、上限の境界値と +1、redirect の6 hop・HTTP への redirect・userinfo・loop、非2xx・429・offline・deadline、別の tag・別の repository（`accepted` を残した repository の変更）、notices の欠落、環境変数に token を置いても request に付かないこと、`local` mode の書込み先、coi-serviceworker の1 byte の変更と写しの欠落（pending の recipe を含む）を確かめる。実行する。
- [x] Step 8: Business logic の実装。recipe の判定の部品（`src/layer1_wasm/biome-migrate-override-bracket-spacing/` の repro の中で、ANSI の除去、JSON の解析、`*.js` の override の `formatter.bracketSpacing` 又は `javascript.formatter.bracketSpacing` の読取り、baseline だけの verdict、失敗は `baseline_error`・`fix_error`、Result v1 の extras）と、fixture・command の digest の正規化（BR5.3）。判定の部品は DOM に依存しない module にして単体で試験できるようにする。（FR11、BR4.1–BR4.6、BR5.3）
- [x] Step 9: Business logic の試験。判定の部品の bun test（reproduced、2か所それぞれの corrected、override が無い、JSON の解析失敗、migrate の非0、事前確認の不一致、baseline が corrected のときの記録、digest が同じ入力で同じになること）。実行する。
- [x] Step 10: 上流の bump の role 対応の実装と試験。`tools/fixed-guest-builder/src/bump.ts` と `.github/workflows/fixed-guest-bump.yml` を、role で guest を選び、`commit` だけを動かし（`accepted` を消さない）、branch 名 `fixed-guest-bump/<slug>-<role>` と title に role を含めるように直す。baseline は biomejs/biome の `main`、fix は fork の branch を直接解決する。build の role 対応は U5 の dispatch の入力（tool・repository・commit・fixture）のままで変えない。`tools/fixed-guest-builder/tests/bump.test.ts` に role の場合を足して実行する。（BR1.2、BR1.4、BR1.5、W2）
- [x] Step 11: API / endpoint の実装。`.gitignore` に `src/layer1_wasm/_formicarium/` と `src/layer1_wasm/*/guests/` を足す。`scripts/bundle-layer1-pages.sh` で `_formicarium` を project ごとに写さず `repro/_formicarium/` へ1回だけ写す（Step 3 で候補2になった場合は各 page の dir と ja の dir へ写し、`serve-repro.ts` の `servedByPages` を ja の `_formicarium/` の下だけに広げる）。`repro-dev-middleware.ts` は候補1では変えない。（P1、S8、infrastructure-specification の変更の一覧）
- [x] Step 12: API / endpoint の試験。`resolveReproFile.test.ts` に `_formicarium` と `guests/` の path を足し、`git check-ignore` で2つの path が ignore されることの試験と、bundle の後の配置の試験（一時の dir で、`_formicarium` が1組だけで ELF が en の dir に1か所だけ。候補2なら ja の他の path が 404 のまま）を足す。実行する。
- [x] Step 13: Frontend behavior の実装。共有 module `src/layer1_wasm/_shared/formicarium_terminal.ts`（使う API だけの型の宣言、`_formicarium/assets.json` から URL を作って実行時に `import()`、分離の確認と15秒、ELF・build-info の取得と C03 の照合と登録、fixture の FsEntry、command session、run の逐次化と判定の列の間の入力の無効化、ready・run・transcript、表示の buffer 1MiB・10000行、textContent だけの表示、状態の文字表示と keyboard、取得の進捗の unknown と 0、要素が外れたときの abort と dispose、P2 の印の記録）。recipe の dir（recipe.json・README.md・page・repro.ts・i18n の en・ja・`fixture/`・coi-serviceworker.js v0.1.7）を vivarium の recipe の規則と `page.terminal.template.html` で作る。baseline の `commit` は作成の時点の biomejs/biome main を40桁へ解決した値、fix は `25e3e2c2d97c5e1780d10833c9f63fc6dce0f8a9`。`accepted` はまだ書かない（pending）。（FR10、FR11、BR3.1–BR3.7、BR7.1–BR7.2、NFR3.3、NFR4.2、NFR7.1–NFR7.3、S3、S7）
- [x] Step 14: Frontend behavior の試験。共有 module の bun test（偽の formicarium の API と fetch を注入して、照合の不一致で登録しないこと、run の順、入力の無効化、buffer の境界 1048575・1048576・1048577 bytes と 9999・10000・10001 行、HTML の記号の表示、進捗の unknown と 0、取得中に要素を外したときの abort と古い応答の破棄）。Playwright の U6 の spec（`src/layer1_wasm/tests/` の新しい file。`test.describe.configure({ retries: 0 })`、`test.setTimeout(180_000)`、goto から判定まで 120秒、en・ja、各組の時間・P2 の印・`browser.version()`・OS を attachment に）を作る。`local` mode の staging で、main session が Chromium・Firefox・WebKit を1つずつ実行する。この時点の ELF は旧題材の stand-in なので判定は合否に使わず、起動・照合・表示・失敗の扱い（ELF を差し替えた page で実行されず原因が出ること）を確かめる。新しい題材の判定は Step 17 で確かめる。（NFR2.1、NFR6.1–NFR6.3、NFR6.7、NFR6.8）
- [x] Step 15: 環境と CI の設定。`deploy-docs.yml` の `repro:i18n` の直後に AssetStager の step（`pin` mode、`timeout-minutes: 7`、`env` に secret なし）と、最後の site の大きさの検査を足す。`repro-regression.yml` の regression の job の Playwright の前に AssetStager を、`regression (chromium)` の Playwright の後に coverage の step（分母の file との照合、80% 未満と欠落で失敗、artifact の保持期間の指定）を足す。job の `timeout-minutes: 20` は変えず、coverage を含む時間の予算を code-summary に書く。deploy-docs の checkout の `persist-credentials` は、後の step が git の push を要しないことを確かめたうえで `false` にするかを判断し、理由を書く。docs の bun test に workflow の試験（step の順、mode が `pin` だけ、`env` に secret が無い、権限と起動条件が変わっていない、`local` が使われていない）を足し、actionlint・ShellCheck とともに実行する。分母の一覧（U6 で足す第一者の TS と除外の理由）を `src/layer1_wasm/` の下の file に固定し、bun の coverage と Chromium の V8 の coverage を source map で TS の行へ対応させる道具と command を選んで記録する。（NFR2.2、NFR8.4、cicd-pipeline）
- [x] Step 16: terrarium の現役参照の除去と文書（BR6.1、BR6.2）。BR6.1 の一覧のとおり、`_shared/terrarium_loader.ts`、`docs/scripts/terrarium-proxy.ts` とその利用、`page-templates.ts` の runtime 集合、generate-repro-pages・generate-repro-i18n・bundle-layer1-pages.sh の terrarium 用の分岐（coi-serviceworker の写しの仕組みは名前を切り離して残す）、`bump-upstream.ts` の builds.json の分岐、`terrariumPins.test.ts`、`reproPreload.test.ts` の terrarium 部分、Playwright spec 3本の `SUPPORTED_RUNTIMES`、`style.css` の要素名、`.claude/rules/recipe-authoring.md`・`src/layer1_wasm/README.md`・`_shared/README.md`・`docs/site/_data/projects.json` の説明を直す。schema と Contract v1（en・ja）は同じページの revision で formicarium を加え terrarium を現役の値から外す。最後に `terrarium` を検索し、残りが歴史の説明だけであることを記録する。旧題材の build の残骸（`src/layer1_wasm/biome-12265/` の未追跡の file）は、対象の一覧を示して承認を受けてから消す。lint・型検査・docs の bun test・builder の試験・Playwright の既存の spec を1つずつ実行する。（FR12）
- [x] Step 17: 外部操作と新しい題材の受入の準備。それぞれ実際の内容を示して個別に承認を受ける：fork への push と upstream への PR（pending の recipe と仕組み一式）→ 書込み権限のある人の merge → baseline と fix の fixed-guest-build の dispatch と fixed-guest-release の承認（U5 の経路）→ build-info を確かめて `accepted` を書く PR（BR1.6）→ 旧題材の Release 2件と tag の削除（BR6.3、新しい `accepted.buildKey` と違うことを確かめ、1件ずつ承認）。新しい ELF を `local` mode で置き、Step 14 の spec で3ブラウザ × en・ja の判定（baseline=reproduced、fix=corrected）を確かめる。baseline が corrected なら「`accepted` の baseline の commit では直っている」と記録して止め、人間の判断を受ける。（FR10、FR11、NFR8.2、BR6.3、W1、W6）
- [x] Step 18: formicarium 0.3.0 の公開の後。pin file を足す PR（npm の provenance の確認と結果を PR に書く。確かめられなければ未検証と書く）を承認を受けて作る。merge の後の deploy-docs の job summary（照合・大きさ・時間）と Pages の site を確かめ、展開後の site の大きさと deploy の時間を記録する。main session が W5（3ブラウザ × en・ja、1 worker、retry 0）を実行し、C10 の AcceptanceEvidence（unit=u6-recipe-runtime、`reproduction-comparison` など）を作る。実機 Safari は別の証拠が無ければ unverified と書く。（NFR3.4、NFR3.6、NFR6.4、NFR8.1、W5）
- [x] Step 18a: 公開 site の fixture の欠落の修正（2026-10-19、人間の回答「AとCをお願い致します」）。Step 18 の W5 の公開 site での受入で、`fixture/.prettierrc` が Pages で 404 になり、端末が作られず停止した（Chromium、en・ja、初回・再訪問。page の分離は正常）。原因：deploy-docs の `actions/upload-pages-artifact` は既定（`include-hidden-files: false`）で `.` で始まる file を artifact から外す（action.yml による）。`check-site` は upload の前の dir を見るので、この除外を見つけられない。なお `.prettierrc` は `biome migrate prettier` に読ませる入力で、prettier 自体は使わない。進め方：
  1. vivarium の `main@upstream` から bookmark `fix/pages-include-hidden-files` を作る。
  2. 先に試験の失敗を観測する：workflow の試験（`docs/scripts/__tests__/workflows.test.ts`）に、site に置く dotfile がある場合に deploy-docs の upload が `include-hidden-files: true` を持つことを確かめる試験を足し、直す前の失敗を観測する。`check-site` に、`docs/doc_build` の中の dotfile の一覧を出し、upload の設定でそれが外れる場合は失敗にする検査を足し、その試験の失敗も観測する（C）。
  3. 直す：deploy-docs の `upload-pages-artifact` の step に `include-hidden-files: true` を足す（A）。`.git`・`.github` は action が常に外すことを、action.yml で確かめて記録する。site に今ある dotfile の一覧を記録する。
  4. `mise run ci:docs-unit`、`mise run docs:check`、actionlint を1つずつ実行する。
  5. fork への push と上流への PR は、内容を示して人間の承認を受けてから行う。merge と deploy の後に、Step 18 の W5（公開 site、3ブラウザ × en・ja × 初回・再訪問）と C10 の証拠をやり直す。
- [x] Step 19: 文書と追跡。code-summary.md（Step 3 の観測、各 Step の command と結果、選んだ道具と理由、時間の予算、外部操作の承認と実行の記録、未検証のもの）と traceability.json を仕上げる。vivarium の変更の file の一覧と各 SHA256、vivarium の bookmark の commit を記録する。（FR10–FR12、NFR8.1）

### 2026-10-21 の Request Changes について

2026-10-21 に、Code Generation の段階を閉じるときの扱いで、人間の選んだ Request Changes が段階の全体に記録された。人間の意図は U2 の一覧の変更だけで、U6 の計画を変える指示ではなかった。この計画の Step と内容は変えない（人間の回答 2026-10-21「A」：計画をそのまま承認し直して Unit ごとに進める）。

### 追加Step：review-03 の Minor 11件の修正（2026-10-22、人間の指示「minor11件の対応をお願いします。全て修正しましょう。」）

基準と時間の上限は変えない。vivarium の変更は fork の `main@upstream` から `jj new` し、差分を示して push と PR の承認を受ける。merge は書込み権限のある人が行う。新しいコア不具合ではないので native の回帰 probe は対象外。

- [x] Step 20: 証拠と記録の修正（formicarium の `.artifacts/` と U6 の記録。外部への書込みなし）。
  - R-03：terminal-compatibility の3行に、bun の単体試験（`formicarium_terminal.test.ts`）の試験名と pass 数の log を附属の output として足し、行の意味を「ブラウザでの起動・実行・表示」と「単体試験での API 互換」に分けて code-summary に書く。
  - review-03 の新1（coverage-80 の `headSha`）：`gh run view 39233229665 --json headSha,databaseId` の出力を元の log として保存し、`assemble.ts` が `headSha` をその log から読むようにする。分母の `u6-coverage-denominator.json` の SHA256 を vivarium の `dcf959a1` の `src/layer1_wasm/u6-coverage.json` と照合し、coverage の artifact の id と digest を取得した file と突き合わせる。`assemble.ts` を実行し直し、出力の SHA256 を記録する。
  - review-03 の新3（404 の生の出力）：旧 Release・tag の6つの GET を今もう一度読取りで行い、status と時刻を `evidence-c10/` の log に保存して SHA256 を記録する。2026-10-19 の承認が1件ずつか一括かを、その session の記録から確かめて code-summary に1文で書く（確かめられなければ不明と書く）。
  - review-03 の新2（古い記述）：code-summary の「C10 の AcceptanceEvidence」節の表と「16件」を、check-logs の記録と `outputs` の今の件数に合わせて直す。
  - R-07：U4 の C06 の証拠の `packSha256`・`sourceCommit` と、pin の値（0.3.0 の tarball）を比べた結果を code-summary に記録する。違えば差の説明を書く。
  - R-09：Firefox の初回で font が最終的に表示されるかを、公開 site で1回確かめて記録する（3ブラウザの Playwright を1worker・retryなしで、Firefox の en・ja の初回だけ）。確かめられなければ原因を「推測」のまま残す。
  - review-03 の新4（`dcf959a1` より後）：code-summary に「`dcf959a1` より後の変更」の節を足し、vivarium の #553・#555・#556 が U6 の file（`bump.ts`・`cli.ts`・`fixed-guest-bump.yml`・recipe.json の commit）と BR1.5・BR1.6・NFR8.2 に与える影響を、vivarium の今の main の file を読んで書く。U6 の表の SHA256 は `dcf959a1` の時点の値と注記する。accepted と pin の変更が bump の自動 merge の対象外であること（bump は commit だけを動かす）を `bump.ts` で確かめて記録する。
- [x] Step 21: vivarium の修正（PR）。どれも不具合の修正の順（先に試験の失敗を観測し、直して同じ試験が通ることを確かめる）。
  - R-11 (a)：`formicarium_terminal.ts` の `relativeEntry` の解決後の URL の origin が root と同じことを確かめ、違えば拒否する。
  - R-11 (b)：boot が session の作成の後で失敗したときと、`repro.ts` の最後の catch で、session（terminal）を dispose する。
  - R-11 (c)：`stage-formicarium-assets.ts` の check-site で、公開 site に `guests/*/accepted.json` があれば失敗にする。
  - R-12：AssetStager が log と job summary に出す取得の最終 URL から query を落とす（scheme・host・path だけを出す）。digest の照合は変えない。
  - R-10：`repro-regression.yml` の CI の job で、pin mode の AssetStager が取得した tarball を `FORMICARIUM_LOCAL_TARBALL` に渡し、`formicariumTypes.test.ts` を skip せずに動かす。
  - R-06：C10 の証拠を作る `assemble.ts`（formicarium の `.artifacts/`）に、配布済みの site の識別を `deployedIdentity`（deploy-docs の run id と Pages の artifact の id・digest）として足し、契約の「実配布が行われた場合は必須」に合わせる。code-summary の「U6 の identity に定めが無い」の記述を直す。
  - vivarium で1つずつ、`mise run ci:docs-unit`・`mise run docs:check`・関係する bun の試験・actionlint を実行する。U6 の Playwright の spec（3ブラウザ × en・ja、1worker、retryなし、180秒）を手元で1回実行する。
- [x] Step 23: review-04 の Minor 4件を直す（2026-10-22、人間の指示「U6 を開き直して、新しい Minor 4件を直してください。」）。vivarium と formicarium の code は変えない。
  - 新1：`code-summary.md` の「残した Minor」の節（R-03〜R-12 を未対応として書く）に、Step 20・21 で直したという注記を足す。`traceability.json` の関係する行に #557 を足す。
  - 新2：`code-summary.md` に「#557 の後」の節を足す。#557 が変えた6 file の `e4ef0dc4` での SHA256 を書き、`e4ef0dc4` の repro-regression（型の照合の step の結果と coverage の割合）と deploy-docs の run を GitHub の読取りで確かめて書く。C10 の証拠は `dcf959a1` に結び付いたもので、#557 の端末の変更を含む site では W5 をやり直していないことを書いたうえで、`acceptance/pages-acceptance.mjs` で今の公開 site に対して W5 を3ブラウザで1回ずつやり直し（1worker、retryなし）、結果を補足の証拠として保存する（C10 の証拠は置き換えない）。
  - 新3：R-07 で人間が受け入れた差を、`assemble.ts` で `acceptance-evidence.json` の追加の field（`acceptedDifferences`）に書く。B1 の tarball（Release `b1-a3370ca4df1f` の asset）を読取りで取り、pin の `files` の各 file（`assets/` の wasm・loader・build-info と notices を含む）と SHA256 で比べて、どの file が違うかを記録する。
  - 新4：coverage の ZIP（`coverage-zip/u6-coverage.zip`）と font-probe の2 file（`acceptance/font-probe.mjs`・`font-probe-firefox.json`）を、`assemble.ts` の `outputs` に入れる。artifact は 2026-11-18 に期限が切れるので、ZIP は `.artifacts/` に残す。
  - `assemble.ts` を実行し直し、出力の SHA256 を記録する。独立レビューを受け、intent の検証コマンドで U6 の checkpoint を確かめる。PR は作らない。
- [x] Step 22: 記録と確認。code-summary・traceability.json・source-manifest.json に Step 20・21 を書く。独立レビューを受け、intent の検証コマンドで U6 の checkpoint を確かめる。

## Story-to-step traceability

| 要件・設計 | Step |
|---|---|
| FR10（formicarium runtime の recipe、取込み、照合） | 4–7、11–15、17、18 |
| FR11（before・after の比較の証拠） | 8、9、14、17、18 |
| FR12（terrarium の現役参照の除去、schema・Contract v1） | 4、16 |
| NFR2.1・NFR2.2（回帰、coverage） | 2、14、15 |
| NFR3.x・NFR4.x（固定入力、取込み、取得の上限、取消） | 4–7、13、14 |
| NFR6.x（時間、取得、資源、配置、互換、分離） | 3、6、11–15、18 |
| NFR7.x（表示、操作、進捗） | 13、14 |
| NFR8.x（証拠、外部操作、notices、CI の権限、切戻し） | 6、15、17、18、19 |

## Assumptions & Open Questions

None.
