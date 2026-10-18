# U1 Traceability — draft

Status: NOT READY。最終証拠の固定・独立レビュー前。

| 要件 | 実装/試験 | 観測/残り |
|---|---|---|
| FR1 / NFR1.1 | evidence.ts、runner.ts、consumer.spec.ts | 実36行と六中央値≤3000ms、trial/environment byte保存済み |
| FR9 / NFR5.1 | baseline.ts、build-baseline.sh、baseline-workflow.yml、baseline.test.ts | 固定commit実CI first/reuse成功。受入ELFとmetadataは取得済み |
| C01 / NFR7.1 | evidence.ts、verify.ts、completion.ts、各test.ts | 構造、36一意、跨browser入力/output、実receipt/key、非zero欠落。live 共通入口は作成済み/未検証/未承認 |
| C11 / NFR3.1–4.2 | assets.ts、prepare-mirror.ts、assets/prepare-mirror tests | bounded hop/size/digest、全archive entry/ELF、official入力に紐づく HTTPS mirror。CI make signed APK exact byte pin |
| NFR6.1 | runner.ts、server、Playwright config、consumer.spec.ts | fresh context/session、worker1/retry0、COI/CSP/no-store、cancel/cleanup fixtures |
| NFR2 / NFR8 | main baseline記録、固定package coverage collector | baseline回帰成功、最終browser33件成功41.4秒。固定14JS line≥80%はmain実行中で未確定 |
| 証拠保持/再現性 | docs/results report、原36JSON、official/mirror inventories、CI receipts | source75e4…とCI b692…を別保持、失敗attempt保持。最終 source-manifest 未固定 |

Fixture の成功は real guest/CI 成功を代替しない。性能試行は instrumentation を入れず、coverage は別 copy を既存固定分母で検証する。前回失敗は修正承認後に再実行し、失敗記録を保持した。
