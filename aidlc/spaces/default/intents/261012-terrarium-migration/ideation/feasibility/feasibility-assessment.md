# Feasibility Assessment

## Decision

条件付きで実行可能（推測）。既存のエミュレータ、guest検証、terrariumのビルダー、vivariumの再現ページを移管する構成は成立する。ただしブラウザ直接取得・導入時間と固定commitビルドの試行は未検証であり、実装着手前のフェーズ0を通過条件とする。本書は実現性の整理で、フェーズ0完了や公開の承認を意味しない。

## Inputs and Evidence

- 承認済み `../intent-capture/intent-statement.md` Q1–Q6、`docs/terrarium-migration-plan-summary.md` の全フェーズを対象にした。
- feasibility Q1=A：固定期限・追加予算なし、既存環境を利用、新費用は事前相談。Q2=A：追加の規制・組織・データ所在地要件なし。既存ライセンス・品質・配布制約は維持。
- 検証済み（ソース確認）：`integration/terrarium/guest-distribution/resolver.ts` にdigest照合、ELF64/x86-64/segment境界/PT_INTERP拒否、build-info検証がある。現在のfetchはredirect:errorであり、Releaseのリダイレクト対応にそのまま流用できない。
- 検証済み（ソース確認）：隣接terrariumの `.github/workflows/build-latest-guests.yml` にlatestと固定refの取得・build・stage・Node・3ブラウザ受入がある。固定refジョブはcommitをキーに含めるが、成果物の恒久保存・ビルダーハッシュを含む再利用の証明は別途必要。個人 `inputs.tar.gz` 依存が実在する。
- 検証済み（ソース確認）：vivariumの `src/layer1_wasm/biome-12265/repro.ts` はbaseline `2405c7620169bd0719166af09a8d89cc76fb37fb`、fix `f79f85d58ae499647c127f1e90a4931e3dbbb206` を固定。recipeはexpected_runtime=terrarium、fix repository=JamBalaya56562/biome。baseline repositoryは現行READMEにbiomejs/biomeと記されるので、試行時はリポジトリとcommitの存在を照合する。
- ドキュメント根拠：OUTCOMES、architecture、ADR0001–0012、nfr-summary、failuresに既存の実行・性能・メモリ制約と既知未解決事項がある。これらの過去の試験結果を今回の回帰試験の合格とは扱わない。
- 検証済み（ローカルファイル）：package.jsonはprivate=true、0.1.0-rc.1。公開済み0.2.1との一致はこのcheckoutでは未検証。公開API移管前に履歴・公開版との整合を調べる。

## Technical Viability

| 領域 | 判断 | 成立条件 |
|---|---|---|
| 公開guest API・コマンド・install | 既存検証を移管可能（推測） | 本体APIへ分離、カタログ限定、digest/ELF/build-info、reset/dispose、拒否系試験 |
| latest showcase | 既存latest workflowを分離可能（推測） | 3ツール、専用CI、公開APIのみ、内部import/逆依存/fixture共有を機械検査 |
| vivarium固定ビルド | 既存ref builderを移管可能（推測） | repo+40桁commit+builder hash、pitchforkのaube UIも固定、Release保存と2回目再利用の実証 |
| 再現UI・Contract | 既存ページを置換可能（推測） | same-origin Worker、COI/CSP、ready/run/transcript、deprecated互換、旧verdictと一致 |
| 退役 | 移管後に可能（推測） | 利用者・依存先調査、最終版案内、配布物保持、OpenTofu state/ruleset整理、個別公開承認 |

AWS利用を新規前提にしない。確認した配布・CIはGitHub Actions/Pages/Releaseを中心とする。アカウント権限、CI残高、infra stateの実在・保管場所は未検証で、運用前に確認する。追加要件がないことをライセンス確認不要とは解釈しない。

## Validation Plan and Stop Conditions

1. フェーズ0：公式aube musl tar.gzとBiome musl binaryを固定version/URL/digestで取得し、Chromium/Firefox/WebKitでリダイレクト込みCORS、fetch・展開・SHA256・ELF・--versionを個別計測。重い処理は並行しない。結果・環境・失敗原因をdocs/resultsへ記録。これは未実施。
2. CORS不可なら同origin Pagesミラーを選ぶ。非ダウンロード工程が数秒を超える場合は工程別原因を確認し、install設計見直し又は事前導入へ戻す。曖昧な閾値は要件段階で数値確定する。
3. 小さな試行：baseline1件をvivarium CIでビルドしformicariumで--version。完全commit・repository・target・builder hash・digest・build-infoを記録し、同じ入力の2回目でコンパイル省略と同一digestを確認。CIへの変更・公開は具体的差分と承認を経る。未実施。
4. 上記が通るまで大規模移管を開始しない。通過後0→1→2→3→4と1→5→6、4/6→7の順で独立PRに分ける。
5. probe600秒・aube browser840秒・worker1・retry0・8項目・native完全一致・wasm1GBを維持。Safari実機はWebKitで代替確認済みとしない。失敗は解消又は設計を戻す。

## Recommendation

Scope Definitionへ進み、フェーズ0・baseline試行を最初の独立作業として明示する。条件未達時の代替経路を維持し、terrariumはフェーズ7まで稼働させる。実現性の最終証拠は上記試行で補う。
