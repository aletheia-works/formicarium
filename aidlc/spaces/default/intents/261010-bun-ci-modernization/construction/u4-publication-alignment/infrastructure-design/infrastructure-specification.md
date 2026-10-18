# Infrastructure Specification — U4

設計・未検証。NFR Design D1–D5をGitHub Actions/npm既存境界へ対応させる。クラウド資源の新設や外部設定変更は実施しない。

## Deployment

| Facet | Choice | Rationale |
|---|---|---|
| Compute | ubuntu-24.04 hosted runner、verify/publish/release各30分 | 既存上限と逐次公開を維持 |
| Networking | GitHub API・npm registryのHTTPSのみ。読取120秒/request、最大2回、write再送なし | 有限失敗、資格情報の漏出防止 |
| Storage | run/attempt専用一時領域、固定名artifact、保持7日。署名済み入力は既存固定URL/SHA | cacheを権限境界にしない |
| Environments | readonly検証、release保護environmentのpublish/release | npm OIDCとGitHub書込みを分離 |
| IaC | tracked publish.ymlと検証済み固定設定。環境設定は別承認後 | 今回はローカル実装・検証 |
| Sizing | input圧縮256MiB未満/展開512MiB/member8192、npm圧縮32MiB/展開64MiB/member4096 | 既存入力上限と公式npm容量を有限に包含 |

## Infrastructure Services

| Service | Role | Configuration | Notes |
|---|---|---|---|
| GitHub Actions | CI/CD | tagごとconcurrency、cancel=false、全job30分 | tag filter自体は公開許可でない |
| GitHub REST | 独立証拠 | repository/run/attempt/workflow/check producer/job/artifact照合 | API不成立・未設定IDは拒否 |
| GitHub artifact | job間転送 | archive256MiB未満、展開512MiB/member8192、JSON/runner各8MiB | 同run/attempt、API digestと実bytes一致 |
| npm registry | 固定CLI配布・OIDC公開 | npm11.19.0、固定HTTPS URL/SHA512、Node24.21.0 | writerで依存導入なし |
| GitHub Release | prerelease/stable配布 | publish成功後のみcontents write、操作1回 | 結果不明は読取照合 |
| DB/cache/queue/CDN | 不要 | 新設なし、公開jobcache=false | packaging単位 |

npm配布metadataはregistryから観測済み：1943 files、展開12200542 bytes。
URL https://registry.npmjs.org/npm/-/npm-11.19.0.tgz
integrity `sha512-SDd/hHg3KqHE5Ht2NHWxNYNtqCQ2pXAPLl6OtQhPyED5PHsRfrOtO199MZTIG2cQoQ1ZRI9t28shrD+2cr3AAw==`。
tarball実bytesの取得・検証はCode Generationに残る。Bun1.4.2/Biome2.5.15でbundle生成・正規化・再現、bun.lock frozen ignore-scripts。npmはNodeでbin/npm-cli.jsを起動。

## Shared Infrastructure

| Shared Resource | Owner Unit | Consumer Units | Access Boundary |
|---|---|---|---|
| C1 tasks / bun.lock | U1 | U3,U4 | U4 readonly build、writer導入禁止 |
| C2 publication-candidate証拠 | U1 | U4 | 独立API観測と固定inventory/全realm receipts80% |
| GitHub repository | 各担当workflow | U1,U3,U4 | purpose別権限、U3設定不備2件は別途未解消 |

## Transfer and Trust

JSON/API metadata8MiB、page100・最大100page、総timeout120秒、超過/欠落を拒否。artifact ZIPとtar両方でabsolute/parent/duplicate/link/.npmrcを拒否し、安全なregular fileだけを展開。総展開bytes/member上限を展開中に強制する。固定GitHub API入口のartifact redirectは最大1回、HTTPSのGitHub artifact service hostの明示allowlistのみ、Authorizationを転送しない。許可host未確認なら拒否し、実CI前の検証対象に残す。

writerはcontents/actions/checks readを持ち、GitHub run、attempt jobs、workflow path/ID、check producer、artifact ID/digest、tag sourceを再照合。Administration権限・branch protection APIを使用しない。trusted manifestは固定tag source由来の期待bundle/config digestを保持し、artifact内manifestだけを信頼しない。producer/workflow数値IDは実repo観測後に固定、未設定時は拒否。OIDC writeはpublishだけ、contents writeはreleaseだけ。両writerでPR由来コード・依存install/build禁止。

