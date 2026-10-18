# Build Instructions

## Sources

各Unitの現在のcode-generation-plan.md、unit-test-instructions.md、code-summary.md、package.json、tsconfig.json、tsconfig.tests.jsonを根拠とする。過去の候補と失敗記録は保持する。

## Environment and Dependencies

workspaceは `/Users/mutoakio/Documents/formicarium`。main sessionのみ逐次実行する。既存node_modulesを使い、依存再インストール・更新は行わない。Node/Bunのmise管理実体と実版を確認し、Node binを子processのPATHへ追加する。shim/mise execを使わない。

## Build Commands

package.jsonの正式buildと同じ3段階を一回ずつ実行し、各exit0を確認して次へ進む。

```sh
/Users/mutoakio/.local/share/mise/installs/node/24/bin/node node_modules/typescript/bin/tsc -p tsconfig.json
/Users/mutoakio/.local/share/mise/installs/node/24/bin/node node_modules/typescript/bin/tsc -p tsconfig.tests.json
/Users/mutoakio/.local/share/mise/installs/node/24/bin/node .build/scripts/emit.js
```

生成JSの手編集、core/guest再ビルド、repack/install、既存coverage rawの上書きはしない。before/afterの生成物SHAを記録し、変更があれば保存証拠との同一性を再評価する。noEmit成功と正式build成功を区別する。

## Verification and Troubleshooting

ログは本stageのverification/run-20261010-v1へ保存する。型エラーやemit失敗はその出力を根拠に診断し、生成JSを直接修正しない。製品・試験ソースの修正が必要なら正式なloop-backで対象Unitを再開する。遠隔CI・公開権限不足をローカル成功に置き換えない。


## 再開後の検証 — 2026-10-10 v2

正確なmain逐次実行手順はverification/resume-20261010-v2/run.mjsとresults.json。Node実体はmise ls/where nodeで解決した24.21.0。製品/test tsc→emit→runner→Unit証拠照合→U2/U3/U4/CIの限定Node回帰。browserは既存configとv9候補、1worker/retry0、出力.artifacts/build-and-test-resume-20261010-v2/{u2-browser,u3-browser}。旧成功と新実行を合算しない。最新collectorを含む遠隔CIはUnverifiedでありU4へ修復を戻す。閾値・固定分母・既存期限は不変。
