# U6 recipe-runtime の基盤

## Sources

`infrastructure-design-questions.md`（Q1=A、Q2=A、2026-10-19）、`../nfr-design/performance-design.md`（P1–P6）・`security-design.md`（S1–S9）・`logical-components.md`、NFR Design の review-02 の Minor（R-08〜R-10、diary の Open questions）、`../nfr-requirements/`、`../functional-design/functional-spec.md`、`../../../inception/domain-design/components.md`、`../../../inception/contract-design/contract-summary.md`（C07・C10・C11）。GitHub の公式の資料（「GitHub Pages limits」、`actions/upload-pages-artifact` の README、2026-10-19 に読取り）、vivarium の `deploy-docs.yml`・`repro-regression.yml`・main の ruleset（`gh api repos/aletheia-works/vivarium/rules/branches/main`）・直近の deploy-docs の run `39042976438`（Pages の artifact 2,527,123 bytes）。クラウドの資源は作らない。設計で、U6 の deploy は未実施。

## Deployment

| Facet | Choice | Rationale |
|---|---|---|
| 実行の形 | 静的な site（GitHub Pages）と訪問者のブラウザ。server の処理は無い | vivarium の今の構成。formicarium は page の Worker で動く |
| 配信 | GitHub Pages（`https://aletheia-works.github.io/vivarium/`）。COOP・COEP は coi-serviceworker が付ける | Pages は header を設定できない（NFR Design S8） |
| 置き場 | `repro/_formicarium/<version>/` に formicarium の一組（S8 の候補1。観測で候補2：各 page の dir の `_formicarium/<version>/` に変わり得る）。`repro/biome/migrate-override-bracket-spacing/guests/<role>/` に ELF・build-info・catalog | ELF は1か所（NFR6.4）。ja は `<base>` で同じ ELF を参照する |
| 版の指し先 | `repro/_formicarium/assets.json`（版を含まない固定の path。候補2では各 page の dir の `_formicarium/assets.json`）に version と各 file の相対 path・SHA256 を置く | NFR Design review-02 の R-08：版を知る前に読める path が要る |
| 環境 | 公開（main の push と workflow_dispatch の deploy-docs）、PR の照合と回帰試験（repro-regression）、手元（main session の `local` mode と `serve-repro.ts`） | staging や常時稼働の環境は持たない（team の Deployment の方針） |
| IaC | 新しく無い。vivarium の tree の file の変更だけ（下の「vivarium の変更の一覧」）。ruleset は変えない | U6 は repository の設定を変えない |
| 大きさ | ELF 114,647,744 bytes ×2（約219MiB）、formicarium の一組 約1.2MiB（0.2.1 の値。0.3.0 で確かめる）、今の site は Pages の artifact で 2.5MB（圧縮後） | 公開 site 1GB 以下の上限に収まる見込み。site build で実際の大きさを記録する |

## vivarium の変更の一覧

| file | 変更 | 確かめ方 |
|---|---|---|
| `.gitignore` | `src/layer1_wasm/_formicarium/` と `src/layer1_wasm/*/guests/` を足す（今の main `71e0ef92` では、どちらも ignore されていない） | docs の bun test が `git check-ignore` で両方の path が ignore されることを確かめる。jj も `.gitignore` に従うので、`local` mode の staging（ELF 約219MiB）が commit に入らない |
| `scripts/bundle-layer1-pages.sh` | `_formicarium` を project ごとに写さず `repro/_formicarium/` へ1回だけ写す（候補2なら各 page の dir と ja の dir へ写す） | site build の後の配置の試験 |
| `docs/scripts/repro-dev-middleware.ts` | 候補1では変えない（`repro/_formicarium/...` と recipe の `guests/` は今の `resolveReproFile` の規則で src の下へ対応する） | 既存の `resolveReproFile.test.ts` に U6 の path を足す |
| `docs/scripts/serve-repro.ts` | 候補1では変えない。候補2では ja の側で `_formicarium/` の下だけを返すように広げる | 候補2のときだけ、ja の他の path が 404 のままの試験 |
| `docs/scripts/` の新しい file | AssetStager、`coi-serviceworker-pin.ts`、その試験 | docs の bun test |
| `.github/workflows/deploy-docs.yml`・`repro-regression.yml` | AssetStager の step、coverage の step（`cicd-pipeline.md`） | docs の bun test が workflow の file を読んで、step の順・mode・`env` を確かめる |
| `src/layer1_wasm/playwright.config.ts` | 全体の設定は変えない。U6 の spec が retry 0・180秒を自分で持つ | U6 の spec |

## Infrastructure Services

| Service | Role | Configuration | Notes |
|---|---|---|---|
| GitHub Pages | cdn | 公開 site 1GB 以下、deploy 10分以内、転送量 月100GB（soft） | 公式の資料。1 file の上限の記載は無い。artifact の tar は 10GB 未満（公式に支えるのは 1GB）で、symlink・hardlink を含まない |
| npm registry | 取得元（固定版の tarball） | pin の version の tarball の URL だけ。credentials を送らない | 0.3.0 の公開の後に使う。それまでは `local` mode |
| GitHub Release（上流 vivarium） | 取得元（固定 guest） | tag `guest-biome-<accepted.buildKey>` の ELF・build-info・catalog。redirect は最大5 hop、HTTPS だけ | U5 の経路が所有する（C07） |
| GitHub Actions | CI と deploy | deploy-docs（`pages: write` など今のまま）、repro-regression（`contents: read`） | 権限を広げない（NFR8.4） |

## Shared Infrastructure

| Shared Resource | Owner Unit | Consumer Units | Access Boundary |
|---|---|---|---|
| vivarium の GitHub Pages の site | vivarium（docs） | U6、他の recipe と docs | U6 は `repro/_formicarium/` と自分の recipe の dir に書く。他の dir を変えない |
| 上流 vivarium の Release（`guest-*`） | U5 | U6 | U6 は読むだけ。作成・削除は人の承認の後に書込み権限のある人が行う（NFR8.2） |
| deploy-docs の build の job | vivarium | U6（AssetStager の step） | step の `env` に secret を渡さない。job の権限は変えない |

## Capacity and Cost

- 大きさと時間（未計測）：ELF を足した後の展開後の site の大きさと deploy の時間は、まだ測っていない（直近の deploy の job は 2.5MB で約11秒）。Code Generation で、`local` mode の staging を含む `docs/doc_build` の大きさを測り、1GB を超えるなら止めて報告する。deploy の時間は最初の公開の deploy で記録し、10分に近ければ止めて報告する。
- 転送量（Q1=A）：1回の訪問で ELF 2つ（約219MiB）。月 100GB の soft limit には約460回の訪問で届く（推測。cache の効く再訪問は減る）。Pages には訪問数や転送量の計測が無いので、これは大きさからの見積もりで、測定ではない。page の振る舞いは変えず、soft limit の通知が来たら見直す。
- CI：repro-regression の3ブラウザの job は、それぞれ AssetStager で ELF 2つを Release から取る（1回の run で約660MiB）。job の間で artifact を渡さない（`cicd-pipeline.md`）。
- 新しい費用は無い見込み（GitHub の無料の範囲。新しい費用が要る場合は事前に相談する。NFR8.2）。

## Assumptions & Open Questions

None.
