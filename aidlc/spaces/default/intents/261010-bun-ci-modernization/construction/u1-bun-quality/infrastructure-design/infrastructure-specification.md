# Infrastructure Specification

設計案・未検証。U1は開発と読取専用CIを整備する。AWS資源の新設は不要。

## Deployment Architecture

| Facet | Choice | Rationale |
|---|---|---|
| Compute | GitHub hosted ubuntu-24.04 runner、job内逐次実行 | ローカルとCIの固定toolchainで検証 |
| Networking | 依存registry/ActionsのHTTPS、公開待受なし | 依存取得と証拠保存のみ |
| Storage | text bun.lock、run別artifact、任意依存cache | cacheなしでも同じ検証経路 |
| Environments | PR、main、明示candidate検証 | 通常CIと公開権限を分離 |
| IaC | version管理されたworkflow YAMLとmise task | AWS CDK/Terraformは対象外 |
| Sizing | 通常job上限30分、candidate上限360分、browser1worker | 既存probe/aube上限を維持、測定後も品質条件は緩めない |

## Infrastructure Services

| Service | Role | Configuration | Notes |
|---|---|---|---|
| GitHub Actions | 品質検証 | contents read、checkout persist-credentials false、Action commit pin | PRにsecret/OIDC/writeを渡さない |
| Bun / Node | 開発とconsumer | Bun1.4.2、Node24.21.0、manifestとmise整合 | Node consumer境界を保持 |
| Dependency cache | 導入高速化 | OS/Bun/Node/bun.lock digest鍵 | missでfrozen installを継続、成果物の正当性をcacheから推定しない |
| Run artifacts | C2証拠とログ | run/attempt/sourceで命名、14日保持、digest検査 | 公開版の固定入力は変更しない |
| Database / queue / VPC | 不要 | N/A | 常駐サービスを新設しない |

## Shared Resources

| Resource | Owner Unit | Consumers | Access Boundary |
|---|---|---|---|
| toolchain/task定義 C1 | U1 | U3,U4 | 信頼済みrevision、argv実行、非0伝播 |
| 検証証拠 C2 | U1 | U3,U4 | 独立API照合、artifact自己申告だけでは許可しない |
| main保護/必要checks | repository管理者、設定対応はU3 | U3 | 実設定確認前は運用済みと扱わない |
| 既存公開inputs | 既存公開作業 | U4 | RCタグ・入力branch・dist-tagを維持 |

## Sources

../nfr-design/security-design.md のD1–D10、../../../inception/domain-design/components.md、../../../inception/contract-design/contract-summary.md。CIの外部適用とpushは別途承認対象。

