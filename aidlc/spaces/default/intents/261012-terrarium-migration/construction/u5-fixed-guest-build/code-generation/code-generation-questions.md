# Code Generation Plan Approval

AI-DLC writes this file when it asks you to approve the plan. To answer here
instead of in chat, write your answer after `[Answer]:` and tell me in chat when you are done.

## Plan Approval

Approve the code plan for u5-fixed-guest-build?

- 今回の再開（2026-10-19、追加Step 24–31）：Release の起動の入力を減らす（人間の指示）。build の workflow の最後に release を続け、人は build を1回起動して environment `fixed-guest-release` を承認するだけにする。release は build の run ID だけでも起動できる。tool・bina...
- 前回の再開（2026-10-18、追加Step 18–23）：U5の記録を新しい土台（formicariumのupstream main `2a79860`）に合わせ、review-03のR-10〜R-14を直す。記録を「上流vivariumの本体（builderとworkflow。aletheia-works/vivarium mainのmerge `71e0ef92`）」と「formic...
- Builds: vivariumの固定guestのbuilder。宣言の検証、sourceの取得と確認、key、取得の監視、containerでのbuild、成果物の検証、Releaseへの書込み、bump-upstreamを作り、3つのworkflowで動かす。あわせて、formicariumで成果物を照合する入口を作る。
- Touches: formicariumの `proposals/vivarium/u5/`（vivariumへ反映する案。新しいpackage `tools/fixed-guest-builder/`、workflow 4つ、mise.tomlとdependabotとinfra/githubとAGENTS.mdへの追記の案）、`scripts/migration-guest-build/`...
- Tests: builderの各部品の単体試験（部品ごとに5–8件以上、formicariumの照合を含め計約100件。bun test）と、workflowの静的な試験、formicariumの照合の試験。そのうえで、vivariumのCIでbaselineとfixをbuildし、Releaseへの保存、同じkeyの再利用、mbxありとなしの比較を行う。

Full plan: aidlc/spaces/default/intents/261012-terrarium-migration/construction/u5-fixed-guest-build/code-generation/code-generation-plan.md
Test instructions: aidlc/spaces/default/intents/261012-terrarium-migration/construction/u5-fixed-guest-build/code-generation/unit-test-instructions.md

[Approval Fingerprint]: sha256:v3:838dac4b8fc44ae726f4c7e4984a5134a23282ac9bd51018b4eb7aff5824dd26
[Planned Source]: 45d8898eab8cc25c17d17292181ebfdbd69748f07dce57ecd6db813a787aea6c

- A. Approve Plan
- B. Request Changes
- C. I'll edit the files

[Answer]: A. Approve Plan
