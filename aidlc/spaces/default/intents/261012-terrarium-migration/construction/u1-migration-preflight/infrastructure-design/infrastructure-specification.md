# 初期試行の実行基盤

## Sources

`../nfr-design/security-design.md` DS1–6、domain/components MigrationAcceptance、契約C01/C11。文書根拠、基盤の動作・権限・費用は未検証。

## Deployment

| Facet | Choice | Rationale |
|---|---|---|
| Compute model | 既存MacのNode/browser逐次試行とvivarium GitHub Actionsの一時Linux musl build | 実guestの36行と固定baseline再利用を観測する。追加AWSなし |
| Networking topology | ローカルsame-origin Worker/wasm配信、HTTPS公開資産/remote sourceへのegress | COI/SAB/CSP条件を実ブラウザで確認。CORS/redirect検査不能なら停止しミラー案を確認 |
| Storage strategy | run固有staging、検証済みkey別ELF/build-info、C01 JSON/log/inventory | 失敗途中と受入済みを分離。atomic受入とdigest照合 |
| Environments | ローカル計測、試行CI。既存公開terrariumは維持 | U1の試行でproduction配信を置換しない |
| IaC approach | 既存repo内workflow/配信設定を最小変更 | OpenTofu/AWS state・DNS・組織ruleset変更はU9対象 |
| Resource sizing | fetch120s/build4h、DL128MiB/展開256MiB/ELF128MiB、wasm1GB、worker1 | C11固定。実ホスト/runner容量と実消費を記録し不足は停止する |

## Infrastructure Services

| Service | Role | Configuration | Notes |
|---|---|---|---|
| 既存ローカル静的server | 静的資産配信 | same-origin、COI/CSPの既存条件を再利用 | 実header/isolation観測が必須 |
| GitHub source/公式Release | 入力取得 | 完全commit/版/URL/digest、credentials omit、全hop検査 | 自動retry/fallbackなし |
| vivarium試行CI/成果物 | 一時compute/storage | 同key single writer、staging、検証後受入 | 具体workflow/保存先/承認を実装計画で特定。未検証権限を仮定しない |
| DB/cache service/queue/search/LB | 適用なし | 新規作成なし | key別artifact再利用は外部cache service追加を要しない |

## Shared Infrastructure

| Shared Resource | Owner Unit | Consumer Units | Access Boundary |
|---|---|---|---|
| C01 evidence | U1 | U2/U4 | schema/identity/全条件合格を照合して読む |
| 既存core/Worker/wasm | 既存formicarium、U2以降が公開境界を所有 | U1および後続 | 公開APIのみ利用、U1から製品への逆依存なし |
| baseline試行artifact | U1試行、汎用成果物管理はU5 | U1/U5 | 完全入力/key/digestを照合し、試行入力を現役依存に残さない |

費用の実見積りは未検証。新規AWS費用は追加しない設計だが、Actions分数・保存容量・transferの既存枠残量と利用量を実行前に確認し、新たな費用が必要なら相談する。重い処理はmain sessionで逐次実行し、計測中はCI buildも同時に走らせない。
