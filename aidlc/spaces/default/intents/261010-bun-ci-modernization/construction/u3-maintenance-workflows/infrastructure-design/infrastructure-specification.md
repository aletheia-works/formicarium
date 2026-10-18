# Infrastructure Specification — U3

## Deployment
| Facet | Choice | Rationale |
|---|---|---|
| Compute | GitHub hosted ubuntu-24.04 disposable runner | 既存CIに整合、常設serviceなし |
| Network | GitHub APIとreadonly再現のnpm registryだけ | write jobはGitHub APIのみ、redirect先を制限 |
| Storage | 上限付き一時dataとActions artifact | DB/長期credential保存なし |
| Environments | readonly preparation、label、format-write、dependency-merge | 再現環境にwrite secretを渡さない |
| IaC | workflow/config/保守手順のversion control | AWS CDK/Terraformなし、外部設定は別承認 |
| Sizing | prepare30分/label5分/write10分、8MiB上限、500files | 有限資源、runaway取得を拒否 |

## Infrastructure Services
| Service | Role | Configuration | Notes |
|---|---|---|---|
| Actions runner | Compute | jobごと独立、完全SHAのActions、固定toolchain | PRコードはreadonlyのみ |
| Actions artifact | Temporary storage | 保守証拠7日保存、上限付きdownload/member展開 | 改変・期限切れは拒否 |
| GitHub API | Read/write gateway | read10秒/2retry/60秒、write10秒/1回 | expected head条件、bypass無し |
| GitHub App | Scoped identity | formatとmerge目的を分離、対象repo限定 | private keyはwrite入口secret |
| Renovate App | Update PR generation | bun/github-actions週次、単一Bun依存、Actions別group、自身automerge無し | install未適用 |
| Database/cache/queue/CDN/DNS | N/A | 新設しない | U3はrepo保守packaging |

## Shared Infrastructure
| Shared Resource | Owner Unit | Consumer Units | Access Boundary |
|---|---|---|---|
| ci.ymlとordinary receipt | U1 | U3/U4 | U3はAPIとactual bytesを独立照合 |
| C2 schema・C3判定 | U1/U2 | U3 | credential/executorをpure libraryへ渡さない |
| README | 節ごとのU1/U3/U4 | 開発者 | U3は保守手順節のみ |
| 公開RC・旧固定入力 | 既存公開intent | 別terrarium受入れ | U3は変更しない |

## Verification
ドキュメント根拠の配置。実runner/secret/App/保護/権限/実CIは未検証。
