# Requirement Unit Map

## Coverage

User Storiesは適用外のため、承認済みFRを直接対応づける。全9件を割り当て、全4単位に対応行がある。

| Upstream ID | Unit ID | Directory | 担当範囲 |
|---|---|---|---|
| FR1 | U1 | u1-bun-quality | Bunとbun.lockのfrozen導入 |
| FR2 | U1 | u1-bun-quality | 開発taskとNode/browser互換 |
| FR3 | U1 | u1-bun-quality | 通常CI、重い回帰・coverage証拠 |
| FR4 | U3 | u3-maintenance-workflows | Bun/Actions更新PR設定 |
| FR5 | U1, U3 | u1-bun-quality, u3-maintenance-workflows | U1はcommit形式検査とchecks、U3はラベルとchecks参照 |
| FR6 | U2, U3 | u2-maintenance-policy, u3-maintenance-workflows | U2は整形差分許可判定、U3は取得・再照合・push入口 |
| FR7 | U2, U3 | u2-maintenance-policy, u3-maintenance-workflows | U2は直接依存1件とlock判定、U3は現在headのCIとmerge入口 |
| FR8 | U4 | u4-publication-alignment | 公開gateとBun接続・拒否回帰 |
| FR9 | U1, U3, U4 | u1-bun-quality, u3-maintenance-workflows, u4-publication-alignment | 開発・品質、保守、公開の手順を担当別に更新 |

NFR1–NFR5は全単位へ適用する。特にU1は再現性・互換品質・checks、U2は拒否と証拠整合、U3は権限・副作用・concurrency、U4は公開権限・証拠・拒否を実現する。cross-cutting条件を単一単位の成功だけで満たしたと扱わない。

## Within-Unit Work

- U1：導入前のbaseline確認、依存とtaskの移行、通常CI接続、consumer・回帰・coverage確認。
- U2：入力と判定契約、共通照合、整形・依存個別判定、正常・境界・拒否試験。
- U3：取得と無権限再現、判定接続、外部操作の条件付き入口、偽executor拒否確認、設定・復旧資料。
- U4：既存gateのbaseline確認、Bun開発入口接続、未来版の検査と改変・不足拒否試験、版別公開資料。

この表は各単位内の作業関係だけを示す。単位間の実装順は指定しない。全体でMethodology: test-afterを維持し、具体試験commandはCode Generationで定義する。

## Sources and Status

../requirements-analysis/requirements.md、../domain-design/components.md、../domain-design/decisions.md、unit-of-work.md、unit-of-work-dependency.md。割当はドキュメント根拠で、実装・試験は未検証。
