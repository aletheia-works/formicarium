# Integration Test Instructions

## Inputs and Local Commands

全てmain sessionで逐次実行。mise task又はmise管理の実体を使う。未変更guestを再ビルドせず、外部push・設定適用・公開は別承認。各単位の承認済み code-generation-plan.md、unit-test-instructions.md、code-summary.mdを入力とする。

各単位のunit-test-instructions.mdのscoped commandsを使い、同一commandは一回に限定しlayer/finalの重複集計をしない。U1 C2→U2 C3→U3実API形、U1 candidate→U4 signed report/bundle/bootstrapの結合を検査する。

`node --test --test-concurrency=1 .build/tests/tooling/*.test.js` は承認済みtest-light内部の234件。rootのtests/release六ファイルは61件、U4新六ファイルは39top/76件。包含関係のある件数を加算しない。

## Actual Policy Reproduction

tracked .github/maintenance/policy.jsonから外部IDだけを妥当fixture値へ置換してvalidateAcquisitionPolicyをassert.doesNotThrowで呼ぶ。完全workflowPathを保護設定へ追加した修正後の正常試験と、未知ID/保護情報不足でexecutor0を確認する。旧INVALID_POLICYはLoop-back 1の履歴であり、現行の正常結果ではない。

## Fresh Node Consumer

mainで現在のemitをstage-package.jsにより新規 `.artifacts/modernization-current-v1/package` へstageし、npm11.19.0のpack --ignore-scriptsとverify-package.jsで固定24ファイルとtarball SHAを検証する。npm cacheは `/private/tmp/formicarium-modernization-npm-cache-v1` を使い、開発依存のbun.lockを変更しない。外部の新規consumer `/private/tmp/formicarium-modernization-consumer-v1` へ当該tgzをinstall --ignore-scripts --no-audit --no-fundする。

`FORMICARIUM_CANDIDATE=/Users/mutoakio/Documents/formicarium/.artifacts/modernization-current-v1/package.manifest.json FORMICARIUM_CONSUMER=/private/tmp/formicarium-modernization-consumer-v1 mise run test-consumer`

入力未指定の初回失敗と、入力を準備した再実行を区別して記録する。旧RC tarballや旧coverage結果で代用しない。

## Real CI and Candidate

新しい全単位sourceから隔離candidateを作り、固定入力archive・source SHA・tarball/24第一者JS全realmを照合してcandidate-requiredを実行する。古いaa9c974b候補・旧RC入力を統合候補の証拠にしない。具体push/variables/dispatchはreviewable candidateを用意して別承認。今回の早期失敗では未実行。
