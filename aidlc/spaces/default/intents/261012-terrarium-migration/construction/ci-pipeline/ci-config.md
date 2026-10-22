# CI の構成

人間の回答（`ci-pipeline-questions.md`、2026-10-22）：Q1 A、Q2 A、Q3 A、Q4 A、Q5 A。

## Sources

- formicarium の upstream main `f7b70cac` の `.github/workflows/`（`ci.yml`・`migration-acceptance.yml`・`showcase.yml`・`showcase-site.yml`）、`infra/github/main.tf` 60行（main の ruleset の必須の check）。
- vivarium の upstream main `acb2218e` の `.github/workflows/repro-regression.yml`・`fixed-guest-bump.yml`・`.github/actions/bot-pull-request/action.yml`、ruleset 23666241 の必須の check（GitHub REST の読取り）。
- `../build-and-test/build-and-test-summary.md`（CI の義務の7件）、`../build-and-test/test-results.md`。

## 道具と branch（Q4 A、今のまま）

- GitHub Actions（formicarium と vivarium）。新しい道具・runner・置き場は足さない。
- trunk-based：短命の作業 branch → PR → main へ squash merge。main は ruleset で守る。
- 成果物の置き場：npm（`@aletheia-works/formicarium`、Trusted Publishing、`publish.yml`）、GitHub Release（formicarium の pack、vivarium の guest `guest-<tool>-<key>`）、GitHub Pages（showcase site）、Actions の artifact（期限付き）。

## formicarium の workflow

| workflow | 契機 | 内容 | 必須の check |
|---|---|---|---|
| `ci.yml` | `pull_request`、main への `push`、`workflow_dispatch`、`workflow_call` | `quality`：lint・typecheck・build・test-light（Node・Bun `latest`、最新の Playwright・Biome・TypeScript）。`product-build`：probe・wasm・guests。`product-regression`：node・chromium・firefox・webkit（1 worker、retry なし）。`product-tests`・`candidate-scope`・`release-candidate`・`ci-required` | `quality`・`commit-format`・`ci-required` |
| `showcase.yml` | 関係する path の `pull_request`・main への `push`、`workflow_dispatch`、`workflow_call` | U7 の guest の resolve・acquire・catalog・accept（showcase の単体 80%、Node の受入、3ブラウザの受入）・candidate | （`showcase-site.yml` から呼ばれる） |
| `showcase-site.yml` | 関係する path の `pull_request`・main への `push`、`workflow_dispatch` | U8 の site の build・3ブラウザの受入・合算の coverage・evidence、main では deploy と verify-deployment | `showcase-site-required` |
| `migration-acceptance.yml` | `workflow_dispatch` だけ（Q2 A） | main の CI の候補と guest の artifact で、U2〜U4 の consumer の試験・ブラウザの受入・U4 の completion（`local-provisional`） | なし（人間が main の CI の成功の後に起動する） |
| `commitlint.yml` ほか | PR | conventional commit | `check / Commitlint` |

2026-10-22 の変更：`showcase.yml`・`showcase-site.yml` の Node を `latest`・`check-latest: true` にした（PR #66、Build and Test の Loop-back 2）。

## この段階の変更（Q1 A）

`ci.yml` の `product-regression` の node の suite（`matrix.suite == 'node'`）の、Node の製品の回帰の試験の後に1つの step を足す。

```yaml
      - name: 'Run the migration preflight and fixed guest build unit tests'
        run: |-
          bun run migration:preflight:unit
          bun run migration:preflight:current-unit
          bun run migration:guest-build:unit
        if: "matrix.suite == 'node'"
```

- この suite は、同じ commit と run の `product-build` の成果物（`dist/blink`・`dist/guests`）を取り、`bun run build` を済ませているので、`migration:guest-build:unit` の前提（`dist/guests/aube` など）がそろう。
- `ci-required` は `product-tests` を通して `product-regression` の成功を要るので、必須の check の名前と ruleset は変えない（`infra/github` の適用は要らない）。
- 3つの試験は、intent の検証コマンドのうち PR の CI で動いていなかったもの（U1 の preflight 57件・preflight-current 21件、U5 の guest-build 12件。Build and Test の手元の実行で pass）。
- 手元の確認（`f7b70cac` の上の change、Node v26.12.1、1つずつ）：actionlint 1.7.12 exit 0、`mise run lint:all` exit 0、`mise run build` exit 0、`mise run test:light` exit 0（fail 0）。
- PR aletheia-works/formicarium#67（`ci/migration-unit-tests`、head `8d221484`、1 commit・1 file、署名あり）、merge `2c00ca1a`（2026-10-22）。PR の CI（run 39734731092）の `Product (node)` で、3つの試験が 57・21・12 件すべて pass、fail 0（検証済み、GitHub の log の読取り）。

## vivarium の workflow（Q3 A、読取りで確かめた）

- `repro-regression.yml`（`pull_request`・main）：`regression (chromium|firefox|webkit)` は必須の check。chromium の job の「U6 line coverage (bun + Chromium V8, fixed denominator)」が、床 80% を下回ると失敗する（`src/layer1_wasm/scripts/u6-coverage.ts` 250行）。main `acb2218e` の run 39730248956：passed、行 83.51%（2511行中 2097）。
- `fixed-guest-bump.yml`：bot の PR を `.github/actions/bot-pull-request` で開き、その action が `gh pr merge --auto --squash` を実行する（署名の無い head なら auto-merge を付けない）。PR aletheia-works/vivarium#556 の後に、実際の bump の PR はまだ作られていない（最後の run は 39608682081、2026-10-21、PR #554 は閉じた）。実際の auto-merge は未検証。

## 変えないもの

- 必須の check の一覧、ruleset、OpenTofu（`infra/github`）。
- `migration-acceptance.yml` の契機（Q2 A）。
- 基準・timeout・retry・worker の数。
