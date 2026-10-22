# U8 showcase-site 実装計画

## Summary

- Builds: `showcase/site/` に Astro と Starlight の en・ja の site（トップ、/tools/ のカード、ツールごとの導入済みの端末、空の端末、guides 6ページ）と、候補の照合・配置・検査・受入・証拠の script、site の変更と手動の実行で build・配布する workflow `showcase-site.yml`（日次の schedule は 2026-10-20 の人間の判断でやめた） を作る。Pages と承認者は OpenTofu で管理する。
- Touches: 新規は `showcase/site/`（package.json・bun.lock・tsconfig・Astro の設定・src・public・scripts・tests）、`.github/workflows/showcase-site.yml`、`mise-tasks/showcase-site/*.sh`。変更は `showcase/scripts/boundary.ts` と `showcase/tests/boundary.test.ts`、`showcase/scripts/mode.ts` と `showcase/tests/mode.test.ts`（Step 23）、`showcase/README.md`・root `README.md`、`.github/workflows/showcase.yml` の paths、root の `biome.json`・`package.json`・`.gitignore`、`infra/github/{main,versions}.tf`・`.terraform.lock.hcl`・`README.md`。本体の `runtime/`・`types/` は変えない。
- Tests: 部品ごとの node:test の単体試験（端末・取得・照合・index・inventory・検査・CSP・notices・証拠・deploy の確認・workflow の試験、計約90件）と、Playwright の受入（3ブラウザ × 16件）、行 coverage 80%（固定の分母）。push・PR・OpenTofu の apply・最初の deploy は個別に承認を受ける。

## 前提と境界

根拠は承認済みの U8 の functional-design（BR1.1–BR7.2、W1–W6。凍結で、置き換えは後の文書の表）、nfr-requirements（`security-requirements.md` の NFR2.1–NFR8.11 と「Functional Design との関係」、`performance-requirements.md` の NFR6.1–NFR6.5、`tech-stack-decisions.md`）、nfr-design（`security-design.md` の S1–S22、`performance-design.md` の P1–P5、`logical-components.md`）、infrastructure-design（`cicd-pipeline.md` の job の表・mode の式・build の12工程・基盤の変更の流れ、`infrastructure-specification.md`、`monitoring-design.md`）。後の文書が前の文書を置き換える（各文書の置き換えの表）。契約は C03・C04・C05・C09・C10（U8 の profile と SiteEvidenceIdentity）・C11、要件は FR15。User Stories は無いので、要件 ID・`BRx.y`・`NFRx.y` に直接対応させる。

- 作業は formicarium の repository（`~/Documents/formicarium`）の、`main@upstream`（今は `0af7b239`、release 0.3.0）から作る新しい bookmark `u8-showcase-site` で行う。aidlc の記録の変更は別の change に置き、application の code の commit に混ぜない。
- 移管元は terrarium（upstream main `2caa5706`）の `docs/`（Astro 7.3.8・Starlight 0.42.6）、`docs/src/pages/demos/{index,[tool]}.astro`、`packages/terrarium/src/terminal.ts`。読むだけで terrarium は変えない。
- push、上流への PR、OpenTofu の PR の merge と apply、token の更新、B1 の pack の Release、最初の deploy の承認、承認者を外す変更は、それぞれ具体の内容を示して個別に承認を受ける。merge・apply・承認は書込みの権限のある人が行う。
- 品質基準と timeout は緩めない（受入は1件 180秒・準備完了まで 120秒・retry 0・1 worker・job 60分、行 coverage 80%、wasm 1GB、既存の probe 600秒・aube 840秒）。build・test は main session で1つずつ実行する。未変更の aube は再 build しない。
- test-after：各層を実装した後に、その層の試験を書いて実行する。不具合の修正は、再現の試験の失敗を先に観測してから直す。

## 持ち越した指摘の反映

各工程のレビューを打ち切った・READY の後に残った指摘を、この計画で扱う（作業の記録の Open questions）。

| 出どころ | 指摘 | 扱う Step |
|---|---|---|
| Functional Design review-02 | R-16（guides の版）・R-19（2段の証拠）・R-20（境界の検査）・R-21〜R-24、fixture の app の外の dir | NFR Requirements で要件化済み。Step 8・12・14・15・17・20 |
| NFR Requirements review-02 | Minor 8件 | NFR Design で設計済み。Step 13・16・17・20 |
| NFR Design review-02 | Major（PR・push の候補）、Minor（build の配置と SKIPPED、needs と if） | Infrastructure Design で設計済み。Step 6・20 |
| NFR Design review-02 | Minor（buffer の長い1行） | Step 10：LF までが 4096 bytes を超えるなら LF を待たずに文字境界と escape 列の終わりで切る |
| Infrastructure Design review-02 | Minor 4件：coverage の needs、置き換えの表の S7・S15、traceability の工程番号、候補が無い場合の試験と main に入れる時期 | Step 20（needs と `if` の式、置き換えは code-summary に記録）、Step 6（候補が無い・期限切れの試験）、Step 23（workflow を main に入れるのは基盤の apply の後） |
| 人が確かめること | `FORMICARIUM_INFRA_APPLY_ENABLED` の値、Actions の artifact の既定の保持期間（main session の account では 403） | Step 22 の前に人が確かめる |

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

## Steps

- [ ] Step 1: 構成と tool の確認。`jj git fetch` の後、`main@upstream` から `jj new` して bookmark `u8-showcase-site` を作る。開発に使う tool の最新版を確かめる（2026-10-19 の値：Node 26.12.0、Bun 1.4.3、astro 7.4.0、@astrojs/starlight 0.42.6、@xterm/xterm 6.0.0、@xterm/addon-fit 0.11.0、@playwright/test 1.64.1、TypeScript 7.0.2、coi-serviceworker 0.1.7、v8-to-istanbul 9.3.0、OpenTofu の integrations/github 6.13.0、actions/deploy-pages 5.0.1、upload-pages-artifact 5.0.0）。古いものがあれば差分を報告する。`showcase/site/` の骨格（package.json〈private、依存は上の最新版〉、tsconfig〈strict〉、`astro.config.mjs`〈site・base `/formicarium`・en を root と ja の i18n・Vite の `build.sourcemap: 'hidden'`〉、空の `src/`・`public/`・`scripts/`・`tests/`）と `bun.lock` を作る。`bun install --frozen-lockfile --ignore-scripts` が通り、build に script が要る依存が無いことを確かめる（あれば止めて報告）。（NFR8.11、tech-stack-decisions）
- [ ] Step 2: 試験の runner の確認と command の記録。`node --test` で showcase/site の単体試験が型の除去で動くこと、`showcase/tests/boundary.test.ts` が今の main で通ること、Playwright（`showcase/site/tests/playwright.config.ts`〈retries 0、workers 1、timeout 180秒、3ブラウザ〉）が空の spec で起動することを確かめ、`unit-test-instructions.md` の command を実際に動かして記録する（この Step で instructions は変えない。違いがあれば止めて報告する）。Biome が `.astro` を扱えるかも確かめて記録する（S1）。（NFR2.1–NFR2.3）
- [ ] Step 3: Data model の実装。`showcase/site/src/model/`：fixture の index（FixtureIndex。path・type・mode・bytes〈base64〉・sha256、4096件・4096 bytes の上限、`..`・絶対・空の segment・NUL の拒否）、site の identity（run_number・sourceCommit・candidateId）、site の inventory（path 順、path・sha256・bytes、正規化 JSON の SHA256）、C10 の U8 の check の記録と AcceptanceEvidence（SiteEvidenceIdentity、必須の行の集合）の型と検証の関数。U7 の `build-key.ts` の canonicalJson・canonicalSha256 を import して正規化を揃える。（BR3.2、NFR3.1、NFR8.1、NFR8.8、S4・S11・S12・S19）
- [ ] Step 4: Data model の試験。`showcase/site/tests/unit/model.test.ts`：index の正常・path の拒否（`..`・絶対・空・NUL）・件数と長さの境界（4096 と +1）・mode の値、identity と inventory の正規化（順序・重複の拒否）、証拠の必須の行の欠落・重複・failed・unverified の拒否。実行する。
- [ ] Step 5: Repository / data access の実装。build 側：`scripts/fetch-verify-candidate.ts`（Actions の API で main の showcase.yml の最新の成功した push・workflow_dispatch の run を探し `showcase-candidate` を取る。無い・期限切れは失敗にして summary の文を出す。distribute の候補は使わない）、`scripts/stage-formicarium.ts`（pack の SHA256 の照合と展開、`.`・`./browser` の export から辿れる module・単一 file の Worker・assets・LICENSE・THIRD_PARTY_NOTICES の一覧）。browser 側：`src/terminal/fetch-limited.ts`（credentials omit、120秒の deadline と pagehide の取消、stream の累積の上限）、`src/terminal/catalog.ts`（取得・SHA256 の照合・site の root を基準の url の解決）、`src/terminal/fixture-index.ts`（取得・照合・inodeId を付けた FsEntry・fixtureToFsEntries）、`src/terminal/formicarium-loader.ts`（埋め込んだ assets の一覧から `_formicarium/` の下に限った動的 import と Assets の4つの URL）。（BR1.1、BR5.1、NFR4.1、NFR3.1、S4・S15、P2）
- [ ] Step 6: Repository / data access の試験。`showcase/site/tests/unit/{fetch-limited,catalog,fixture-index,formicarium-loader,fetch-verify-candidate,stage-formicarium}.test.ts`：fetch を注入して、遅い応答（120秒の超過は偽の時計）、上限 −1・上限・+1、非2xx・offline、取消、SHA256 の不一致、en・ja・深さの違う page の URL から同じ guest の URL になること、`_formicarium/` の外・`..`・別の origin の拒否、候補の run が無い・artifact が期限切れ・distributable が true の run を選ばないこと（Infrastructure Design の残り）、pack の改変の拒否。実行する。
- [ ] Step 7: Business logic の実装（build 側）。`scripts/verify-candidate.ts`（BR1.2 の7項目。U7 の `computeCandidateId`・`fixtureInventorySha256` を import。verify は (1)・(3)・(4)・(5)・(7) と distributable が false、(2)・(6) は log だけ）、`scripts/build-fixture-index.ts`（`showcase/fixtures/<名前>/` の全体、mode の正規化、空の dir・symlink・特殊 file の拒否、`demo-fixtures/<名前>.json`）、`scripts/build-site-identity.ts`、`scripts/inventory.ts`、`scripts/notices.ts`（build の module の一覧から出力に入る package の license、coi-serviceworker、pack と guest の notices）、`scripts/inject-csp.ts`（端末の page の inline script の hash と meta の CSP の指令）、`scripts/check-site.ts`（en・ja の page の組、cross-origin の副資源、CSP、dotfile と upload の設定、1073741824 bytes 未満、coi-serviceworker の SHA256、`.map` が無いこと）。（BR1.2、BR2.2、BR4.3、BR5.3、BR5.4、NFR5.1、NFR6.4、NFR6.7、NFR7.4、NFR8.3、NFR8.8、S5・S9・S11・S14・S19）
- [ ] Step 8: Business logic の試験（build 側）。`showcase/site/tests/unit/{verify-candidate,build-fixture-index,inventory,notices,inject-csp,check-site}.test.ts`：7項目それぞれの不一致、verify の (6) の log、fixture の mode・空の dir・symlink の拒否と aube の `outside/` を含むこと、inventory の順序と identity の file を含むこと、license の無い package での失敗、hash の計算と指令に外部の origin が無いこと、ja が欠けた page・外部の画像・CSP の欠落・dotfile を外す upload・1073741824 bytes・`.map` の残りで失敗。実行する。
- [ ] Step 9: Business logic の実装（配布側）。`scripts/evidence.ts`（check の記録〈identity の digest・元の log の path と SHA256・読んだ事実〉と完全な C10 の JSON、必須の行の表〈security-design の S12〉、`-deployed` の版）、`scripts/deploy-guard.ts`（Actions の API で `deploy` の job が成功した run の最大の run_number、API の失敗も失敗）、`scripts/post-deploy-check.ts`（`site-identity.json?run=` を no-store で 30秒ごと・10分まで）、`scripts/summary.ts`（最後の deploy からの日数、失敗した job、DIST かつ deploy の実績があり2日以上のときだけ失敗）、URL の query を落とす helper。（BR6.2・BR6.3・BR7.2、NFR5.2、NFR8.1、NFR8.6、NFR8.9、NFR8.10、S6・S12・S17・S20・S21）
- [ ] Step 10: Business logic の実装（browser 側）。`src/terminal/buffer.ts`（1048576 bytes か 10000 行、最初の LF の直後で切る、LF までが 4096 bytes を超えるなら文字境界と escape 列の終わりで切る、捨てた量）、`src/terminal/keys.ts`（行の編集、65536 bytes、履歴、Ctrl-C、`\x1b` の列を捨てる、実行中・install 中は捨てる）、`src/terminal/output.ts`（kind ごとに1回だけ書く、UTF-8 の stream decoder）、`src/terminal/status.ts`（状態の文、unknown と 0 の区別、en・ja）。（BR3.4–BR3.6、BR3.8、BR4.1、NFR6.3、NFR7.1–NFR7.3、S10、P3）
- [ ] Step 11: Business logic の試験。`showcase/site/tests/unit/{evidence,deploy-guard,post-deploy-check,summary,buffer,keys,output,status}.test.ts`：証拠の行の欠落・重複と2段の内容、deploy-guard の大きい run_number・最初の deploy・API の失敗、post-deploy の一致・404・不一致の打切り（偽の時計）、summary の失敗の条件（verify は表示だけ、deploy の実績が無いときは表示だけ）、buffer の境界値（1048575・1048576・1048577 bytes、9999・10000・10001 行、multi-byte、escape 列の途中、4096 bytes を超える1行）、打鍵の表のすべての行、kind ごとの出力が1回ずつで guest の result を書かないこと、状態の文。実行する。
- [ ] Step 12: API / endpoint の実装（page と配置）。`src/pages/` の en・ja の route（`/`、`/tools/`、`/tools/[tool]/`、`/terminal/`。ja は `/ja/` の下）、`src/content/docs/` の guides 6ページ（en・ja。getting-started・embedding〈公開 API の組込み、同じ origin の Worker・wasm、COI〉・source-builds・releases・architecture・maintenance〈日次・切戻し・月1回の確認・候補の復旧・lockfile の確認〉）、`src/i18n/`（文言 file と en・ja の key の一致の検査）、カードの元（manifest・`showcase/tools.json`・文言）、`public/coi-config.js`、端末の page の data 属性（catalog・index・assets の SHA256）。guides の npm の導入の手順は build の照会（`npm view … dist.integrity` が pack と一致）のときだけ出す。embedding の code の例は pack の型で `tsc --noEmit` する。（BR2.1–BR2.4、BR4.3、BR5.2、NFR6.5、NFR8.7、S8・S18）
- [ ] Step 13: API / endpoint の試験。`showcase/site/tests/unit/{routes,i18n,cards,guides}.test.ts`：build した出力（試験用の小さな候補の fixture で build）に en・ja の全 page があること、カードが候補の3ツールと一致し文言の欠けで失敗すること、文書の page と /tools/ が端末の module・coi-serviceworker を読まないこと、npm の照会の一致・不一致での guides の切替え、embedding の例の型検査。実行する。
- [ ] Step 14: Frontend behavior の実装。`src/terminal/terminal-host.ts`（xterm と fit addon、screenReaderMode、`attachCustomKeyEventHandler` で Tab を渡さない、状態機械〈isolating・loading・installing・ready・ready_failed_install・running・failed・disposed〉、preinstalled は fixture を置いて `install <tool>` を実行、empty は案内だけ、Ctrl-C の AbortSignal、pagehide の dispose、pageshow の persisted で読み直し、link の addon なし）、`src/terminal/omitted-notice.ts`、端末の page の Astro の component（StatusLine・TerminalHost・OmittedNotice・HintList、容器の幅 100%・最小幅 0）、`data-testid` の付与。（BR3.1–BR3.3、BR3.5、BR3.7、BR4.1、BR4.2、NFR7.2、S10）
- [ ] Step 15: Frontend behavior の試験。単体：`showcase/site/tests/unit/terminal-host.test.ts`（偽の formicarium と xterm で状態の遷移、install の失敗と取消で ready_failed_install、pagehide の dispose、pageshow の読み直し、Tab）。受入：`showcase/site/scripts/serve-pages-like.ts`（header なし・base `/formicarium`・U7 の tls.ts の CA の HTTPS）と `showcase/site/tests/accept/*.spec.ts` の16件（P1：空の端末 6、個別ページ 6〈`ls`・`cat`・`--version` の出力が1回ずつ、aube の link 先の `cat`、分離と再訪問〉、状態と keyboard 2、端末の後の文書の page 1、敵対的な出力の harness 1〈試験だけの page で、site に入れない〉、CSP の違反が0件）。main session が Chromium・Firefox・WebKit を1つずつ実行する。入力の候補は main の CI の showcase.yml の run の artifact（GET だけ）か、無ければ人の判断を受ける。（NFR6.1、NFR6.6、NFR6.7、NFR7.1、NFR7.2）
- [ ] Step 16: coverage の設定。分母の一覧 `showcase/site/coverage-denominator.json`（security-design の S2 の module の名前と除外の理由。名前の変更は対応を code-summary に記録し、file の増減は理由を示して人の承認を受ける）と、`showcase/site/tests/coverage/merge-coverage.ts`（node の lcov と Chromium の V8 を hidden の source map で TS の行へ対応させて合わせ、80% 未満か分母の file の欠落で失敗）。手元で測って結果を記録する。（NFR2.2、S2）
- [ ] Step 17: 境界の検査の変更。`showcase/scripts/boundary.ts` に site の規則（showcase/site の下でだけ astro・@astrojs/starlight・@xterm/xterm・@xterm/addon-fit と `/` の subpath と `astro:`、tests の下でだけ @playwright/test・v8-to-istanbul、`.astro` の frontmatter と `<script>` の走査、`<script src>` は相対だけ、loader の外の literal でない `import(` の拒否、SKIPPED に `showcase/site/dist`・`.astro`・`node_modules`）を足し、`showcase/tests/boundary.test.ts` に site の場合を足す。root の `biome.json` で showcase/site の生成物の dir を外す。U7 の他の script は Step 23 の `showcase/scripts/mode.ts`（と `showcase/tests/mode.test.ts`）を除いて変えない。`node --test showcase/tests/boundary.test.ts` と U7 の showcase の単体試験（`mise run showcase-unit`）を実行して、U7 を壊していないことを確かめる。（NFR2.1、S1）
- [ ] Step 18: build の組立て。`showcase/site/scripts/build-site.ts`（cicd-pipeline の build の12工程の順：候補と pack の取得 → 照合 → pack の展開 → install → 検査と単体試験 → fixture の index → `public/` への配置〈`_formicarium/<version>/`、候補の `site/`、coi-serviceworker.js と coi-config.js〉→ Astro の build → `.map` を抜く → inject-csp・notices・identity → check-site・inventory）と `mise-tasks/showcase-site/*.sh`（build・unit・accept・coverage）、root の `package.json` の script と `.gitignore`（site の生成物）。手元で、main の CI の候補を使って build と check-site を通す。（W1、NFR2.3、S3）
- [ ] Step 19: build の試験。`showcase/site/tests/unit/build-site.test.ts`：工程の順（照合の失敗で後の工程が動かない、inventory は inject-csp の後の bytes）、配置の path、`.map` が site に残らないこと。実行する。
- [ ] Step 20: workflow の作成。`.github/workflows/showcase-site.yml`（cicd-pipeline の job の表：DIST の式、candidate〈contents read・actions read〉・fetch-candidate・verify-pack・build・accept-chromium・accept-firefox・accept-webkit・coverage〈needs は build と accept の3つ〉・evidence・deploy〈github-pages environment、concurrency `showcase-site-pages`、cancel-in-progress false〉・verify-deployment・summary、各 job の `if` を式で書く、timeout、actions は最新版の commit SHA で固定、schedule `17 4 * * *`〈Step 23 で置き換え：schedule はやめ、main への push と main の手動で配布する〉）。`.github/workflows/showcase.yml` の pull_request・push の paths に `!showcase/site/**` を加える。`showcase/site/tests/unit/workflow.test.ts`：event（schedule・main の手動・main 以外の手動・pull_request・push）ごとの動く job と skipped の組、build 以降が skipped にならないこと、deploy の条件と needs の全列挙、pages write と deploy-pages が deploy の job だけ、candidate の権限が showcase.yml の要求を含むこと、verify で summary が日数だけでは失敗しないこと、PR・push の run が showcase.yml を呼ばず deploy を持たないこと。actionlint と workflow の試験を実行する。（NFR2.3、NFR5.2、NFR5.3、NFR8.4、BR6.1、S6・S7・S15）
- [ ] Step 21: 基盤の変更（OpenTofu）。`infra/github/main.tf` に `pages { build_type = "workflow" }`、`ignore_changes` から `pages` を外す、`github_repository_environment "github_pages"`（`github-pages`、`protected_branches = true`、`custom_branch_policies = false`、reviewers に承認者の user の ID、`depends_on`、既にあれば `import`）、`versions.tf` の provider を `~> 6.13`、`tofu init -upgrade` で `.terraform.lock.hcl` を更新、`infra/github/README.md` に token の Pages・Environments の権限と手順を足す。`tofu fmt -check`・`tofu validate` を手元で実行する（plan は CI の terraform-plan で行う）。（NFR8.2、cicd-pipeline の基盤の変更の流れ）
- [ ] Step 22: 外部操作の準備と実行（それぞれ内容を示して個別に承認を受ける）。前提として人が `FORMICARIUM_INFRA_APPLY_ENABLED` の値と artifact の既定の保持期間を確かめる。人が token を更新した後に、fork への push と上流への PR（OpenTofu の変更を含む）を作る。terraform-plan の comment で差分が Pages・environment・provider だけであることを確かめ、人が merge して apply する。site と workflow の PR は、基盤の apply の後に merge する（先に入れると schedule が Pages の無い状態で失敗する）。（NFR8.2、Infrastructure Design の残り）
- [ ] Step 23: 配布の契機の変更（2026-10-20 の人間の判断：site の文書が main で変わったときと手動の実行で配布し、日次の schedule はやめる。pack は B1 の Release `b1-a3370ca4df1f`）。`.github/workflows/showcase-site.yml`：`schedule` を消し、DIST を「main への push（今の push の paths：`showcase/site/**`・`showcase-site.yml`・`showcase/scripts/**`）か main の `workflow_dispatch`」にする（式の文字列を1つにそろえ、DIST の注釈を直す）。PR と main 以外の手動の実行は今のとおり verify。`showcase/scripts/mode.ts`（U7 の file。U8 の判断による変更で、U7 の他の file は変えない）：distribute を受け付ける event を `push` と `workflow_dispatch` にし、`schedule` を拒否する（ref が main・caller が `trusted-callers.json` の `distributeCaller`・repository の条件は変えない）。`showcase/site/scripts/summary.ts`：日次の配布が無くなるので、NFR8.9 の「最後の deploy から2日以上で失敗」（`STALE_DAYS`・`stale-deploy`）を外し、日数は表示だけにする（失敗した job の表示と `--required` は変えない）。新しい候補（showcase.yml の guest の変更）は自動では配布されず、手動の実行で配布することを文書に書く。（BR6.1、NFR5.2、NFR8.1、NFR8.9 の置き換え）
- [ ] Step 24: 配布の契機の試験と文書。`showcase/site/tests/unit/workflow.test.ts`（schedule が無いこと、main への push と main の手動で DIST の job が動き verify の job が skipped、PR・main 以外の手動・push 以外の event では DIST にならないこと、deploy の条件と needs の全列挙）、`showcase/tests/mode.test.ts`（push と workflow_dispatch の main で distribute、schedule・pull_request で拒否）、`showcase/site/tests/unit/summary.test.ts`（古い deploy でも失敗しないこと）を直す。文書：guides の releases・maintenance（en・ja。日次・月1回の schedule の確認の記述を、文書の変更と手動の実行での配布に直す）、`showcase/README.md` の mode と定期実行の節、root `README.md` の該当の記述。`mise run showcase-site-unit`・`mise run showcase-unit`・`node --test showcase/tests/boundary.test.ts`・actionlint・biome を main session で1つずつ実行して記録する。site の build と受入は Step 25 の CI の run で確かめる（手元では変えた file に受入の対象が無いため再実行しない）。その後、内容を示して承認を受けてから fork への push と上流への PR を作る。
- [ ] Step 25: 最初の配布と受入。B1 の pack の Release（`showcase/b1-pack.json` が null のままだと distribute は失敗する。U7 の README の手順で、人が対象を承認した後に作る）を前提として確かめる。main から showcase-site.yml を手動で実行し、最初の deploy を承認者が承認する。verify-deployment の成功と、公開の site を3ブラウザ × en・ja で確かめ、C10 の U8 の証拠（`showcase-site-evidence-<run_id>-deployed`）を取得して SHA256 を記録する。その後、OpenTofu の別の PR で reviewers を外す（内容を示して承認を受けてから）。実機 Safari は別の証拠が無ければ unverified と書く。（FR15、NFR8.1、NFR8.2、W3）
- [ ] Step 26: 文書と追跡。code-summary.md（各 Step の command と結果、選んだ道具と理由、外部操作の承認と実行の記録、置き換えの表〈security-design の S7・S15 を含む〉、未検証のもの）と traceability.json（BR・NFR の各 ID を実装と試験の file へ）を仕上げ、source-manifest.json に U8 が作った・変えた path を書く。（FR15、NFR8.1）
- [ ] Step 27: review-01 の指摘の修正（2026-10-20 の人間の判断：Major・Minor とも全部直す）。workflow と文書：
  - R-08：`.github/workflows/showcase-site.yml` の `deploy` の `needs` に `candidate` を足し、`if` に `needs.candidate.result == 'success'` を足す。`showcase/site/tests/unit/workflow.test.ts` に「DIST で candidate が skipped・failure なら deploy しない」試験を足し、deploy の needs の列挙を直す。
  - R-07：`changes` job の grep に `showcase/tools.json`・`showcase/fixtures/`・`showcase/b1-pack.json` を足す（PR だけ。push の paths には足さず、配布は手動のまま）。`workflow.test.ts` の grep の文字列の試験を直す。
  - R-01：guides の maintenance（en・ja）の切戻し (b) から「workflow を無効にする」を外し、「`showcase/tools.json` の条件を PR で直して merge し、main で `showcase-site.yml` を手動で実行する」に直す。workflow を無効にすると必須の check `showcase-site-required` が報告されず PR が merge できなくなることを書く。R-07 の3つの入力を変える PR は verify を走らせるが、配布は手動の実行で行うことも書く。
  - R-02：guides の maintenance（en・ja）の「最初の deploy」の節を、最初の deploy（run 39422079965）は承認済み、承認者は #55 で外した、以後の deploy は承認なしで、関門は DIST の式・`protected_branches`・deploy-guard・必須の job の成功、に直す。
  - R-03：`showcase/README.md` の「未検証のこと」から distribute の実行を外し、run 39422079965 で distribute の候補と配布が成功したことを「確かめたこと」に足す。candidate job の summary の日数は `showcase/tests/candidate.test.ts` の試験が根拠であることを書く。
  - `mise run showcase-site:unit`・`mise run showcase:unit`・`mise run showcase:boundary`・`mise run lint:all` を main session で1つずつ実行して記録する。内容を示して承認を受けてから fork への push と上流への PR を作る。（BR6.4、NFR5.3、NFR8.4、NFR8.5、S7・S15）
- [ ] Step 28: review-01 の記録の修正。
  - R-04：`traceability.json` の BR3.5（`keys.ts`）・BR3.6（`output.ts`）・BR3.7（`terminal-host.ts`）・BR3.8（`buffer.ts`）・BR5.2（`public/coi-config.js`）の target を直し、BR6.4 の target を `.github/workflows/showcase-site.yml`（根拠は `workflow.test.ts`）にし、承認と承認者の削除は BR6.1・NFR8.2 の detail に移す。実装と照合して他の行のずれも直す。
  - R-05：code-summary の Deviations に「Step 25 の最初の配布は手動ではなく #54 の merge の push で動いた」を足し、「Tests written but not executed」に「`workflow_dispatch`（main と main 以外）は実際の run では未実行。根拠は `workflow.test.ts` の評価だけ」を足す。BR6.1・NFR8.4 の根拠を「単体試験と push の run 39422079965」に限る。人間の承認があれば、Step 27 の merge の後に main で `showcase-site.yml` を手動で1回実行し、結果を記録する。
  - R-06：code-summary の置き換えの表に NFR8.4・NFR8.5・NFR2.3・NFR8.2・BR1.3 を足し、この計画の Step 20 に「schedule は Step 23 で置き換え」の注を付ける。
  - Step 27 の結果（PR・CI・merge の後の run）を code-summary に足す。（FR15、NFR8.1）

### terrarium の削除（PR #58）の後の確認（2026-10-21、人間の判断「はい、開き直して良いです。」で開き直した）

U9 の PR aletheia-works/formicarium#58（merge `5735433d`）が U8 の source-manifest.json に当たる file で変えたのは、`infra/github/README.md`・`infra/github/main.tf`（comment の terrarium の言及）、`showcase/site/tooling/astro-check/package.json`（`description` の文）、`package.json`（`scripts` の glob）だけで、U8 の振る舞いは変えていない（と読んでいる。Step 29 で確かめる）。U8 の Code Generation はレビューの回数を使い切っていたので開き直した。Step 1〜28 は済んだものとして残す。

- [ ] Step 29: #58 の影響を確かめる。上の4つの file の差分を読み、U8 の site・workflow・Pages の OpenTofu の振る舞いを変えていないことを確かめる。main session で1つずつ `mise run showcase-site:unit`、`mise run showcase:boundary`、`mise run lint:all` を実行して記録する。#58 の merge の後の main の run（39435971322・39509852083 は #57 の時点。#58 の後の `showcase-site.yml` の push の run）の結果を読取りで確かめる。影響があれば止めて報告する。（FR15、NFR2.1、NFR8.2）
- [ ] Step 30: U8 の記録に、この確認の節を足す（code-summary.md）。traceability.json・source-manifest.json に、移した file・消した file を指す行があれば直す。（NFR8.1）
- [ ] Step 31: 独立レビューを受ける。そのあと、intent の検証コマンドで U8 の checkpoint を確かめる。

### 2026-10-21 の Request Changes について

2026-10-21 に、Code Generation の段階を閉じるときの扱いで、人間の選んだ Request Changes が段階の全体に記録された。人間の意図は U2 の一覧の変更だけで、U8 の計画を変える指示ではなかった。この計画の Step と内容は変えない（人間の回答 2026-10-21「A」：計画をそのまま承認し直して Unit ごとに進める）。

### 追加Step：Build and Test の Loop-back 2（Node の版の固定、2026-10-22、人間の指示）

Build and Test で、人間の承認により main で起動した `showcase-site.yml` の run 39716574987 は成功した（受入 16 passed × 3ブラウザ、合算の coverage 94.51%、配布と配布後の確認も成功）。しかし `showcase-site.yml` の12か所が `node-version: '26.12.0'` と patch の版まで固定しており、どの job も最新の Node 26.12.1 ではなく v26.12.0 で動いた。最新の道具を使う決まりに合わず、その run だけが根拠の目標（U8-NFR6.1・6.2・6.4・6.5・2.2・6.6・6.7・7.1・7.2・8.11）が Unverified になった（Build and Test の `test-results.md` の Loop-Back Log 2）。ほかの workflow（`ci.yml` など）は `node-version: 'latest'` と `check-latest: true`。人間の指示（2026-10-22）：Loop-back 2 として、showcase の Node の版の固定（U7・U8）を直す。

- [ ] Step 32: `.github/workflows/showcase-site.yml` の `node-version: '26.12.0'` の12か所を、`ci.yml` と U7 の `showcase.yml`（U7 の Step 17）と同じ `node-version: 'latest'` と `check-latest: true` の2行にする（`check-latest` が無いと runner に入っている古い Node を使うことがあるため）。ほかの行、試験、基準は変えない。`showcase/site/tests/unit/workflow.test.ts` が Node の版を確かめていないことを読んで確かめる。U7 の同じ修正と1つの PR にまとめ、最新の main の上の change で、1つずつ `mise run lint:all`・`mise run showcase-site:unit`・`mise run showcase:boundary` と actionlint を実行する。差分を示して push と PR の承認を受ける。merge の後、main の CI の成功を待ってから、人間の承認で `showcase.yml` と `showcase-site.yml` を main で起動し（site の run は再配布する）、log の setup-node が最新の Node で動いたことと結果を確かめる。`code-summary.md` にこの Step の節を足す。（FR15、NFR2.2、NFR6.1、NFR8.11）
- [ ] Step 33: 独立レビューを受け、intent の検証コマンドで U8 の checkpoint を確かめる。

## Step と ID の対応

| ID | Step |
|---|---|
| FR15 | 12、14、18、20、25 |
| BR1.1–BR1.3 | 5、7、20 |
| BR2.1–BR2.4 | 12、13 |
| BR3.1–BR3.8 | 3、10、11、14、15、17 |
| BR4.1–BR4.3 | 7、10、12、14、15 |
| BR5.1–BR5.4 | 5、7、12、18 |
| BR6.1–BR6.4 | 9、20、23、24、27、28 |
| BR7.1–BR7.2 | 9、15、25 |
| NFR2.1–NFR2.3 | 2、16、17、18、20 |
| NFR3.1・NFR4.1 | 3、5、6 |
| NFR5.1–NFR5.3 | 7、9、20、23、24 |
| NFR6.1–NFR6.7 | 7、10、12、15 |
| NFR7.1–NFR7.4 | 7、10、14、15 |
| NFR8.1–NFR8.11 | 1、7、9、12、20、21、22、23、24、25、27、28 |
