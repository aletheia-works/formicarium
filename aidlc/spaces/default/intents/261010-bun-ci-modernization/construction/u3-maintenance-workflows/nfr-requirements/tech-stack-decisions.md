# Tech Stack Decisions — U3

## Decisions
TypeScript ESM、既存Node24.21.0/Bun1.4.2、node:test、BiomeとU1 tasksを再利用する。新公開package・サービス・DBを設けない。Bunで開発依存を固定導入し、GitHub API操作とCI用処理は明示したruntimeで実行する。

更新PRはBunとActionsの両方を扱える設定を選び、PR作成と自動mergeの対象を分離する。具体bot・API・tokenはNFR Designで公式資料と実ソースを検証して決める。参照CodeKBは調査時点の背景資料で、U1完了後の版については現行mise/package/CIを優先する。

## Constraints
write jobでPRの依存導入・script実行をしない。ラベルは固定パス規則とメタデータから計算しshell連結しない。Actionは完全SHA固定、公開OIDCなし。GitHub側書込みは具体対象への承認後に適用する。

## Verification
ドキュメント根拠：U1固定toolchainとC1/C2、U2 C3。U3実workflow・token権限・原子的API・実CIは未検証。技術不足時はfail closedで手動へ回す。
