# ドメイン設計の確認

## 既存の境界

`../requirements-analysis/requirements.md`、`aidlc/spaces/default/codekb/formicarium/architecture.md`、`component-inventory.md`を参照する。汎用実行はformicarium、固定ビルドとrecipe/verdictはvivarium、latestデモはshowcase、退役は両経路移行後という既存の判断を維持する。

## Q1 commandとinstallの論理的境界

公開コマンド層からinstallを呼ぶ導線は共通にする。その内部責任の分け方を確認する。これは別repo/別サービスへの分割や公開APIの確定ではなく、設計上の責任の区切りである。

A. command操作とinstall処理を別の論理部品にする。command側はargv/cwd/builtin/実行の振分け、install側はカタログ選択・取得・検証・進捗・中止・登録を所有する。非同期処理と状態更新を独立して試験できるが、部品間の取消・busy契約が必要になる。推奨。
B. command操作とinstall処理を一つの論理部品にまとめる。状態と取消を一か所にまとめられるが、取得・検証の責任もcommand側に集まり部品が大きくなる。将来は内部から分離できる。
X. Other (please specify)

[Answer]: A. コマンド操作とinstallは別の論理部品に分けて進めて下さい。
