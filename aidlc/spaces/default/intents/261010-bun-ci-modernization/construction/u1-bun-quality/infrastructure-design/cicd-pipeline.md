# CI/CD Pipeline

設計案・未検証。U1は通常CIと開発taskを提供し、保守書込みはU3、公開適合はU4が所有する。

## Build and Quality Gates

通常workflowは ci.yml。pull_request（全path）とmain pushを起点にする。PRでは検証対象head SHAをcheckoutし、merge先base SHAも記録する。全体path filterを使わずdocs-onlyでも必要checkを確定する。依存導入はBun1.4.2のfrozen install、Node24.21.0を明示する。Bun lifecycleは必要な依存だけallowlist化し、未知install scriptを認めない。

| Job / Check name | Sequence | Timeout | Permissions |
|---|---|---|---|
| quality | frozen導入→lock無変更→Biome→型検査→build→軽量Node tests | 30分 | contents read |
| commit-format | 信頼済みbase規則でPR base..head commitを検査、mainはpush前SHA..head | 10分 | contents read |
| ci-required | always実行しquality/commit-format両方successを検査 | 5分 | contents read |

check名は上表の固定名でmatrix suffixを付けない。commit-formatはConventional Commitsのtype(scope)!: subject形式、typeはfeat/fix/docs/style/refactor/perf/test/build/ci/chore/revert。新規branch/zero before SHAではhead commitを検査する。PR metadataとcommit本文をshellへ展開しない。信頼済みbase側validatorをcredentialなしで実行し、提出者が規則を弱めても今回の判定に使わない。

通常CIは公開用固定bundleを要求しない。Node固有flags/Worker/process.execPathはNodeで実行する。Node/browser consumerと重い回帰は下記明示laneで確認し、軽量成功をその代替にしない。

## Candidate Verification and Evidence

既存verify.ymlの凍結された旧RC入口は保持する。新しいsourceの統合用に、読取専用candidate検証の入口を実装する（candidate-verify.yml、workflow_dispatch、対象SHA固定）。job candidate-requiredは360分上限。必要入力・配布資産の取得元とdigestを明示し、ない場合は失敗する。未変更guestを再ビルドしない。Node/browser consumer、native一致、probe8項目、600秒/840秒、1worker/retry0/wasm1GB、固定第一者JS80%以上と全realm receiptを維持する。

C2 evidenceはrepository/source/run/attempt/workflow/check producer/digest/toolchainを含み、通常はordinary-ci、candidateはpublication-candidate。adapterはGitHub側情報と独立照合する。偽producer、重複/欠落check、stale source、改変artifact、不足receiptを拒否する。candidate-requiredは通常ci-requiredと別で、統合及び依存merge前の全品質条件として対象headで成功が必要。dispatch未実行を成功扱いしない。必要checksのGitHub設定は管理者の承認後に適用・実確認する。

## Concurrency and Failure Handling

通常CIはworkflow名+PR番号又はrefを鍵にし、新headで旧通常runをcancelする。candidateはsource SHAごとに鍵を分け、異なるcandidateを混同しない。各suiteをjob内逐次実行する。ci-requiredは依存jobのfailure/skipped/cancelledを非0にする。cancelでsummary自体が終了しなくてもGitHubのcancelled conclusionを成功へ変換しない。読取retry最大3回/60秒、外部書込みなし。

## Deployment, Secrets and Rollback

通常CIにnpm publish/Release、id-token write、repository write secretは不要。Actionは検証したcommitへ固定、checkout credential保存なし。publish.ymlのnpm OIDC境界はU4で別途検証し、既存RCは変更しない。

不成立時は統合/自動mergeを止め、run logとSHAを確認する。修正は新commitと再検証で行い、必要checkを外して回避しない。workflowの復旧はレビュー済み変更のrevert、新SHAでCIを確認する。ローカルjj操作と外向きpush承認を維持する。

## Downstream Contract Concern

承認済みcontract-design R-01は未解消の懸念としてU2/U3へ引き継ぐ。整形pushと依存mergeの必要checksをこのU1資料だけで同一に確定しない。formatter差分再現はU3専用checkとして設計し、lint失敗の修正経路とmergeの全品質条件をそれぞれ検証する。凍結契約を黙って変更しない。

## Verification Plan and Sources

実装後にworkflow構文、固定Action、権限、timeout、check名、lock mismatch、cacheless install、偽/stale証拠、失敗伝播、Node/browser consumerを検証する。実CIの起動と設定変更は外部承認後。まだworkflow実行結果はない。

../nfr-design/security-design.md、../../../inception/domain-design/components.md、../../../inception/contract-design/contract-summary.md、../nfr-requirements/security-requirements.md。

