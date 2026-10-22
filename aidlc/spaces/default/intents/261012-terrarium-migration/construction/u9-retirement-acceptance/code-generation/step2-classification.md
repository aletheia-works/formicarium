# U9 Step 1 の結果と Step 2（分類）の質問と回答

（2026-10-21 に `code-generation-questions.md` に書いた内容を、この file に移した。`code-generation-questions.md` は AI-DLC の Plan Approval の記録の file で、上書きしてはいけなかったため。）

## Step 1 の結果（2026-10-21、読取りだけ）

- U6 の証拠：`.artifacts/u6-recipe-runtime/evidence-c10/acceptance-evidence.json`
  - SHA256 `3939063d978c73e390d2bb0a7a25422e9b46f530313363b77225d08f861f7dba`（記録と一致）
  - evidenceId `u6-recipe-runtime-dcf959a1541a-2026-10-19`、19行すべて passed
- U8 の証拠：run 39509852083 の artifact `showcase-site-evidence-39509852083-deployed` の `evidence.json`
  - SHA256 `11e9192b843573311c0b6ec1522593a03d007f742ce658f854860a6b32eefba3`
  - evidenceId `835c5175…2f59`、sourceCommit `c8497135`、27行すべて passed
- 利用の記録（2026-10-21T00:24:23Z）
  - npm：直近30日 469件、直近1週間（2026-10-12〜18）154件
  - JSR の版：`0.1.0`・`0.2.0`・`0.3.0`
  - GitHub の dependents の件数：page から読めなかった（未検証）
- organization の ruleset：`gh api orgs/aletheia-works/rulesets` は `admin:org` の権限が無く 404 だった。人間が画面で確かめ、「organizationのrulesetの件は対象にしていないです。」と回答した（2026-10-21）。
- branch の検索（`git grep -il terrarium`。`aidlc/` を除く file の数）

  | repository | branch | file の数 |
  |---|---|---|
  | formicarium | upstream の `main` | 82 |
  | formicarium | release-please の branch | 82 |
  | formicarium | `codex/release/rc1-inputs` | 29 |
  | formicarium | `codex/verify/0.2.0-inputs` | 49 |
  | formicarium | `codex/inputs/*` の2本 | 0 |
  | vivarium | upstream の `main` | 4（`CHANGELOG.md`、`docs/site/{en,ja}/spec/contract-v1.md`、`docs/site/public/spec/recipe.schema.json`） |
  | vivarium | release-please の branch | 4 |

- `gh search code --owner aletheia-works terrarium` は0件だった。formicarium の main に一致があるので、index の取りこぼしで、証明にはならない。
- `aidlc/active-memory/` は追跡されている7 file で、`aidlc/spaces/default/memory/` と中身が違う（写しではない）。D7 で memory と同じ扱いにする。
- 言及の一覧：`.artifacts/u9-retirement/mentions.txt`（374行、82 file）

## 分類で分かったこと

82 file の多くは、comment や文書の言及ではなかった。formicarium の仕組みが terrarium に結び付いている所がある。

1. **release の判定**：`scripts/release/decision.ts` は、RC・stable の判定で `terrarium-node`・`terrarium-chromium`・`terrarium-firefox`・`terrarium-webkit` の consumer の受入を必須にしている。`scripts/release/{evidence,types,collect}.ts`、`tests/release/*`、`docs/release-assurance.md` も同じ。
2. **formicarium 自身の code で、名前に terrarium があるもの**：
   - `integration/terrarium/guest-distribution/`：guest の配布の resolver・manifest・fixture で、`scripts/guest-distribution/` と `scripts/release/inventory.ts` が使う
   - `scripts/terrarium/coverage.ts`・`evidence.ts` の共通の関数：`scripts/ci/run.ts`・`scripts/release/collect.ts` が使う
   - 環境変数：`TERRARIUM_BUN`・`TERRARIUM_SITE_DIR`・`__TERRARIUM_VERSION__`
3. **terrarium だけの受入**：`scripts/terrarium/{acceptance,prepare,current-candidate}.ts`、`tests/terrarium/`、`docs/terrarium-integration.md`、`package.json` の `test:integration` の一部、`.github/workflows/ci.yml` の paths。
4. **この移行の受入の道具と証拠**：
   - `scripts/migration-*`、`tests/migration-*`、`ci/migration-*`
   - `docs/results/terrarium-migration-preflight*`：hash 付きの証拠
   - `ci/migration-session/inputs.bundle.json` と `payload/*.bin`：hash で固定した入力
   - `.github/workflows/migration-acceptance.yml`
   - AI-DLC の checkpoint の確認コマンドが使う mise の task（`migration-preflight-unit` など）
5. **comment と文書**：`README.md`、`AGENTS.md`、`CHANGELOG.md`、`docs/*.md`、`runtime/session.ts`・`runtime/command-parse.ts`（pack に入る）、showcase の fixture と試験の comment、`mise-tasks/build/guests.sh`、`infra/github/` の comment。

## 回答（2026-10-21、人間：「全部Aでいいです。」）

| 質問 | 回答 |
|---|---|
| Q1. release の判定の terrarium の consumer の受入 | A：RC・stable の判定から `terrarium-*` の consumer の受入を外す。代わりは足さない |
| Q2. formicarium 自身の code で、名前に terrarium があるもの | A：名前を変えて残す。共通の関数は移す。terrarium だけの受入は消す |
| Q3. この移行の受入の道具と証拠 | A：この PR では残し、intent を閉じた後の D7 の PR で、AI-DLC の記録と一緒に消す |
| Q4. `CHANGELOG.md` の過去の項目 | A：文を書き換えて terrarium を消す（commit の link はそのまま） |
| Q5. vivarium の4件 | A：vivarium にも、4件の言及を消す PR を出す |
| Q6. formicarium の `codex/*` の branch の一致 | A：`codex/release/rc1-inputs` と `codex/verify/0.2.0-inputs` を、人間が GitHub の画面で削除する |
