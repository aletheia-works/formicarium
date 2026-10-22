# U8 showcase-site の論理の部品

## Sources

`security-design.md`・`performance-design.md`（同じ dir）、`../nfr-requirements/security-requirements.md`、`../functional-design/functional-spec.md`（W1–W6）、`../../../inception/contract-design/contract-summary.md`（C09・C10）。設計で、実装は未作成。

## Components

| 部品 | 置き場 | 責任 | NFR |
|---|---|---|---|
| CandidateFetcher | `showcase/site/scripts/fetch-verify-candidate` | PR・push のとき、main の showcase.yml の最新の成功した run の候補を取る | NFR8.4 |
| CandidateVerifier | `showcase/site/scripts/verify-candidate` | BR1.2 の7項目の照合（U7 の関数を使う） | NFR5.1 |
| FormicariumStager | `showcase/site/scripts/stage-formicarium` | pack の照合・展開（型の解決にも使う）と `_formicarium/<version>/` への配置 | NFR5.1 |
| FixtureIndexer | `showcase/site/scripts/build-fixture-index` | demo の fixture の index（mode の正規化） | NFR7.4 |
| AstroSite | `showcase/site/src/`（pages・content・i18n） | en・ja の page、カード、guides | FR15 |
| CspInjector | `showcase/site/scripts/inject-csp` | 端末の page の inline script の hash と meta の CSP | NFR6.7 |
| NoticesBuilder | `showcase/site/scripts/notices` | 出力に入る package の notices | NFR8.3 |
| SiteIdentity | `showcase/site/scripts/build-site-identity` | `site-identity.json` | NFR8.8 |
| SiteChecker | `showcase/site/scripts/check-site` | en・ja、副資源、CSP、dotfile、大きさ、coi-serviceworker | NFR6.4・NFR6.6・NFR6.7 |
| InventoryBuilder | `showcase/site/scripts/inventory` | site の inventory（build・受入・deploy の前の3回） | NFR8.8 |
| TerminalHost ほか | `showcase/site/src/terminal/` | 端末・出力・buffer・打鍵・状態・取得・loader | NFR4.1・NFR7.1–NFR7.3 |
| PagesLikeServer | `showcase/site/scripts/serve-pages-like` | header なし・HTTPS の受入の server（U7 の tls.ts を使う） | NFR6.1 |
| AcceptanceSuite | `showcase/site/tests/` | 3ブラウザ × 16件、敵対的な出力の harness | NFR6.1・NFR7.1 |
| CoverageMerger | `showcase/site/tests/coverage/merge-coverage` | lcov と V8 の coverage を source map で合わせ、分母と照合する（試験の道具） | NFR2.2 |
| EvidenceAssembler | `showcase/site/scripts/evidence` | check の記録と C10 の JSON（2段） | NFR8.1 |
| DeployGuard | `showcase/site/scripts/deploy-guard` | 古い run の拒否 | NFR5.2 |
| PostDeployVerifier | `showcase/site/scripts/post-deploy-check` | deploy の後の identity の確認 | NFR8.10 |
| RunSummary | `showcase/site/scripts/summary` | 最後に deploy した run からの日数と失敗した job | NFR8.9 |
| Workflow | `.github/workflows/showcase-site.yml` | job：candidate か fetch-candidate → build → accept-{chromium,firefox,webkit} → coverage → evidence → deploy → verify-deployment、summary | NFR2.3・NFR5.3・NFR8.4 |
| BoundaryRules | `showcase/scripts/boundary.ts`、`showcase/tests/boundary.test.ts`、root の `biome.json`、`.github/workflows/showcase.yml` の paths（U7・root の file への追加。security-design の S1 の表） | site の import の規則と、site だけの変更で U7 の工程を動かさないこと | NFR2.1 |

## Isolation and Integration

- 失敗の領域：candidate（又は fetch-candidate）・build・accept・coverage・evidence のどれが失敗しても deploy は動かない（NFR5.3）。verify-deployment の失敗は配布済みの site を戻さず、通知だけ（NFR8.10）。
- 権限の分離：pages write は deploy の job だけ（security-design の S15）。
- 本体との境界：site は formicarium の公開 export と pack の bytes だけを使い、本体の code を変えない。U7・root の file で変えるのは security-design の S1 の表の4つだけ。`showcase/trusted-callers.json` は今の値のまま使う。
- U7 の CI との分離：PR・push では showcase.yml を呼ばず（concurrency の group の衝突と重い工程の重複を避ける）、showcase.yml の paths から showcase/site を外す。
- 訪問者の page：端末の page だけが formicarium・guest・service worker を読む（P5）。

## Infrastructure Handoff

Infrastructure Design で決めること：Pages の有効化（`build_type: workflow`）と `github-pages` environment の承認者の設定（formicarium の `infra/github` か repository の設定）、Pages の1 file の上限と転送量の公式情報での確認、schedule の時刻、artifact の保持の設定、job の runner、監視（job summary と通知）。

## Assumptions & Open Questions

None.
