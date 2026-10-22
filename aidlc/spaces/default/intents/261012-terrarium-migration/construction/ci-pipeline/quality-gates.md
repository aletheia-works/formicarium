# 品質の門

## Sources

`ci-config.md`、`../build-and-test/build-and-test-summary.md`（CI の義務の7件と、Build and Test が記録した build・試験の command）、`../build-and-test/test-results.md`。

## merge の前の門（formicarium の main の ruleset）

| 必須の check | 確かめること |
|---|---|
| `quality` | lint（Biome）、typecheck、build、test-light（bun・tooling・node・release の単体） |
| `ci-required` | `quality`・`commit-format`・`product-tests`（probe・wasm・guests の build、node と3ブラウザの製品の回帰、**この段階で足す U1 の preflight・preflight-current と U5 の guest-build の単体**）・`candidate-scope`・必要なときの `release-candidate` |
| `commit-format`・`check / Commitlint` | conventional commit |
| `showcase-site-required` | site の build・3ブラウザの受入・合算の coverage 80%（showcase の path が変わったとき） |

どの門も、Node・Bun・Playwright・Biome・TypeScript は最新を使う。ブラウザの試験は1 worker・retry なし。基準・timeout は緩めない。

## merge の後の確認（人間が起動）

- `migration-acceptance.yml`：main の CI の成功の後に、人間の承認で起動する（Q2 A）。U2〜U4 の consumer の試験、3ブラウザの受入、U4 の completion。結果は `local-provisional`（`b1.formal: false`）。

## vivarium の門

- `regression (chromium)`：U6 の第一者 TS の行 coverage 80%（床を下回ると失敗）。
- bump の PR：必須の check が通ったら auto-merge（squash）。

## Build and Test の command との対応

| Build and Test の command | CI の門 |
|---|---|
| `mise run lint:all`・`typecheck`・`build`・`test:light` | `quality` |
| `migration-preflight-unit`・`migration-preflight-current-unit`・`migration-guest-build-unit` | `ci-required`（`product-regression` の node、この段階で足す） |
| `showcase-unit`・`showcase-typecheck`・`showcase-boundary` | `showcase.yml`（`showcase-site-required` の中） |
| `showcase-site:unit`・site の受入・coverage | `showcase-site-required` |
| U2〜U4 の consumer・受入・completion | `migration-acceptance.yml`（merge の後、手動） |
| U1 の preflight のブラウザの36試行 | CI なし（証明書の一時登録が要る。手元で人間と行う） |
| vivarium の builder・docs・U6 の Playwright と coverage | vivarium の PR の CI |

## CI の義務の7件（Build and Test の Owning Stage が ci-pipeline）

| Target ID | 判定 | 根拠 |
|---|---|---|
| CI-1 | Met | 上の対応表。足りなかった3つの単体は PR #67（merge `2c00ca1a`）で `ci-required` に入れ、PR の CI run 39734731092 で 57・21・12 件 pass。U2〜U4 の consumer は Q2 A で merge の後の手動の受入 |
| U4-NFR8.1b | Met（source は `6a90a45b`） | 2026-10-22、U3 の Code Generation の Step 27〜28：run 39709015067 の観測（`observed-ci-summary.json` SHA256 `25700e77…`、commitVerified true）と正式な完了確認（`.artifacts/ws-u3-formal/.artifacts/migration-command/completion-934d4082-…/completion-report.json` SHA256 `b8adea15…`）で `verified-with-ci`・`acceptancePassed: true`・`b1.formal: true`、B1 31行 passed。候補と source は main `6a90a45b` のもの。その後の main（#66・#67・#68）で同じ候補になるかは確かめていない |
| U5-D7-AUTO | Unverified | 仕組みはある（`gh pr merge --auto --squash`）。#556 の後の実際の bump の PR が無い |
| U6-NFR2.2 | Met | vivarium の `regression (chromium)`、run 39730248956 で 83.51%（床 80%） |
| U7-NFR2.2b | Met | Showcase guests run 39724950076（Node v26.12.1）：Node の受入3行と、ブラウザの受入9行（3ツール × 3ブラウザ）の計12行が passed |
| U7-NFR6.1 | Met | 同じ run で、Node と3ブラウザの4環境 × 3ツールの `--version` が passed |
| U8-NFR2.3 | Met | `showcase-site.yml` の `build` の job は PR と push の両方の契機で動き、push の run 39724950133 で success |
