# Code Generation Plan Approval

AI-DLC writes this file when it asks you to approve the plan. To answer here
instead of in chat, write your answer after `[Answer]:` and tell me in chat when you are done.

## Plan Approval

Approve the code plan for u7-showcase-guests?

- Builds: `showcase/` に、最新の安定版のaube・pitchfork・Biomeを解決・取得（又はsource build）・検証し、catalogとC09の候補を作る仕組みと、Node・3ブラウザの `--version` 受入、公開importの境界の機械検査を作る。専用workflow `showcase.yml` と、repositoryの保護のOpenTofu（`...
- Touches: 新規は `showcase/`（package.json・tsconfig.json・設定data・demo fixture・scripts・tests・README.md）、`.github/workflows/showcase.yml`、`infra/github/`。変更は `mise.toml`（showcaseのtask）、`.gitignore`（showcas...
- Tests: 設定・解決・取得と展開・source buildとbuildKey・再利用・catalogとpack・候補・境界・mode条件の単体試験（各部品5–8件、計約55件、showcaseのscriptの行coverage80%以上）と、境界の違反fixtureの試験。受入はNode・Chromium・Firefox・WebKit×3ツールの12行。push・CI・Release・O...

Full plan: aidlc/spaces/default/intents/261012-terrarium-migration/construction/u7-showcase-guests/code-generation/code-generation-plan.md
Test instructions: aidlc/spaces/default/intents/261012-terrarium-migration/construction/u7-showcase-guests/code-generation/unit-test-instructions.md

[Approval Fingerprint]: sha256:v3:1118cf1f06e0eb23441e73d9379ed23dd24417859fd1f8f6b38f6f011aae5fd0
[Planned Source]: 76bcc92b5127b8e33536ee0215edb2c23c3a5fc530c665a6ec21c968c734ea0e

- A. Approve Plan
- B. Request Changes
- C. I'll edit the files

[Answer]: A. Approve Plan
