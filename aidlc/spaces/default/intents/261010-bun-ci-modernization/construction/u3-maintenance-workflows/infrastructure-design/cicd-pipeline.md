# CI/CD Pipeline — U3

## Pipeline and Gates
| Stage | Trigger / source | Permissions and timeout | Gate / result |
|---|---|---|---|
| U1通常CI | pull_request/main、現在head | contents read、既存30/10/5分 | quality/commit-format/ci-requiredすべてsuccess |
| PR labels | pull_request_target metadata、trusted base | contents read / PR write、5分 | 固定パス規則、fork可、PRコード実行無し |
| Update PRs | Renovate App週次 | App独立、bunとActions管理 | Bun単一更新、Actions別group、自身automerge false |
| Maintenance preparation | workflow_run CI completed、trusted default source | contents/actions/checks/PR read、30分 | C2照合・再現・C3判定、byte上限 |
| Format write | prepare成功、sameRepo open PR | 固定trusted runner、repo限定App、10分 | 再照合・expectedHeadOidで単一commit |
| Dependency merge | prepare成功、真正bot候補 | 固定trusted runner、repo限定App、10分 | 再照合・sha付きsquash、main保護 |
| Record / reconcile | 各入口always | 最小read | 拒否0回、成功/失敗/不明の区別 |

## Executable Supply
write jobではinstall/buildをしない。開発時にBun1.4.2でU3 trusted entryとU1/U2の必要pure codeをNode向け単一bundleへ生成し、専用 .github/maintenance/runner.mjs をversion controlする。authoring TSをsource-manifestに記録し、tracked bundleも実write対象として明記、ignored生成JSで代用しない。readonly CIで固定Bunによる再生成bytes/hashがtracked bundleと一致することを試験する。bundleは信頼default branch SHAからcheckoutし、PRからのbundle・hash自己申告を実行しない。workflow側でtrusted source SHAを固定し、確認不能なら拒否する。生成手順/更新理由はCode Generation planへ記載する。

## Data Flow
イベントからrunを特定→GitHub run/job/check/PR/保護/actorを有限read→U1 receipt実bytesを検査→独立3checkへC2正規化→無権限再現→U2 C3→上限付き結果artifact。write入口はartifactを命令にせずinputとして検査し、run・head・base policy・producer・再現jobの真正性とdigestを独立取得する。prepare側のPR self-reported booleansは使わない。

共通必要checksを整形/依存で維持する。lint失敗時の自動整形は拒否となる既存受入れ済み契約を保守手順へ記載する。writerは外部操作前にchecks等を再照合し、artifactにallowがあっても直接実行しない。

## Concurrency and Failure
format/merge共通のmaintenance-repo-PR group、cancel-in-progress false。read上限とretry、write1回をsecurity-design D5に合わせる。fork/closed/stale/unknown/deletedbranchはreject0回。複数PR対応はそれぞれの入口runに分離し、番号/head特定不能は書込まない。既存merged/整形不要はno-op。通信不明後は有限readで確認し、同副作用を再送しない。

## Promotion, Rollback and Secrets
今回のローカル設計/コード生成は外部設定適用を含まない。mainへの統合前に今回SHAの実CIと配布JS固定80%coverageを取得し、設定・App/token・保護・自動操作の実確認に具体承認を得る。設定未適用はREADMEで明記する。保守を止める場合は設定でwriterを無効化し必要ならApp権限を取消す。source復旧はレビューした新PRで行い、blind force push/remergeをしない。既存RC、publish.yml、npm dist-tagは変更しない。

秘密はformat/mergeの目的別App ID/private-key secret、readonlyに渡さない。labelはGITHUB_TOKENのPR write、公開OIDC無し。App tokenの実権限・保護bypass不可・CI起動を適用時に確認する。新stable公開はU4と別版承認の対象。

## Sources and Status
security-design D1–D5、components MaintenanceOperations、C1/C2/C3契約。ドキュメント根拠。実workflow・bot・App・CI・atomic競合は未検証。
