# Security Test Instructions

## Commands and Boundaries

全てmain sessionで逐次実行。mise task又はmise管理の実体を使う。未変更guestを再ビルドせず、外部push・設定適用・公開は別承認。各単位の承認済み code-generation-plan.md、unit-test-instructions.md、code-summary.mdを入力とする。

固定actionlint1.7.12とshellcheck0.11.0実体でci.yml、candidate-verify.yml、maintenance.yml、pr-labels.yml、publish.ymlを検査。通常CIはread、write/OIDC jobでinstall/build/PRコードを実行しない。scoped maintenance/publication拒否試験は実tracked設定を使う。

## Required Failure Checks

偽producer、stale head/run/attempt、artifact改変、空/重複/欠落checks、fork、非success、head競合、HTTP不明、未知結果再送を拒否する。保護情報APIのAdministration read権限をprepareへwrite能力を与えず供給する。固定tag bootstrap、manifest/digest、JSON各8MiBを実行前に検査する。

## Current Gaps

U3 tracked正常設定と専用read-only App経路の局所回帰は修正後成功。U4 inputs内JSON個別8MiBと直接CLIのbounded読込も修正後成功。外部App/ID/OIDC/原子的API操作は未検証。SAST/DAST全体成功と主張しない。
