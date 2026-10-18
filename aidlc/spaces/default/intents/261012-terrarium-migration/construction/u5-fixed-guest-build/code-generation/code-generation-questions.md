# Code Generation Plan Approval

AI-DLC writes this file when it asks you to approve the plan. To answer here
instead of in chat, write your answer after `[Answer]:` and tell me in chat when you are done.

## Plan Approval

Approve the code plan for u5-fixed-guest-build?

- Builds: vivariumの固定guestのbuilder。宣言の検証、sourceの取得と確認、key、取得の監視、containerでのbuild、成果物の検証、Releaseへの書込み、bump-upstreamを作り、3つのworkflowで動かす。あわせて、formicariumで成果物を照合する入口を作る。
- Touches: formicariumの `proposals/vivarium/u5/`（vivariumへ反映する案。新しいpackage `tools/fixed-guest-builder/`、workflow 4つ、mise.tomlとdependabotとinfra/githubとAGENTS.mdへの追記の案）、`scripts/migration-guest-build/`...
- Tests: builderの各部品の単体試験（部品ごとに5–8件以上、formicariumの照合を含め計約100件。bun test）と、workflowの静的な試験、formicariumの照合の試験。そのうえで、vivariumのCIでbaselineとfixをbuildし、Releaseへの保存、同じkeyの再利用、mbxありとなしの比較を行う。

Full plan: aidlc/spaces/default/intents/261012-terrarium-migration/construction/u5-fixed-guest-build/code-generation/code-generation-plan.md
Test instructions: aidlc/spaces/default/intents/261012-terrarium-migration/construction/u5-fixed-guest-build/code-generation/unit-test-instructions.md

[Approval Fingerprint]: sha256:v3:17f058d5e7b6a37362828134178df78c1bd520d181e55d596b6a361054160d19
[Planned Source]: 76bcc92b5127b8e33536ee0215edb2c23c3a5fc530c665a6ec21c968c734ea0e

- A. Approve Plan
- B. Request Changes
- C. I'll edit the files

[Answer]: A. Approve Plan
