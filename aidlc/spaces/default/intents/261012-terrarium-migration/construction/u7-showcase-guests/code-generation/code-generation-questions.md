# Code Generation Plan Approval

AI-DLC writes this file when it asks you to approve the plan. To answer here
instead of in chat, write your answer after `[Answer]:` and tell me in chat when you are done.

## Plan Approval

Approve the code plan for u7-showcase-guests?

- Builds（2026-10-20の再開、Step 14）：`showcase/b1-pack.json` を、U4の正式な受入で作ったB1のpackのRelease `b1-a3370ca4df1f` へ向ける（PR #52でmerge済み）。コードの振る舞いは変えない。
- Touches（Step 14）：`showcase/b1-pack.json`・`showcase/tests/config.test.ts`（commitした値を確かめる試験の期待値）・`showcase/README.md`（B1のRelease の節）。
- Tests（Step 14）：新しい試験は加えない。既存の `showcase-unit`（96件）・lint・typecheck・test-lightで確かめる。
- Builds（Step 15、人間の指示「minorで出た指摘の修正」）：review-03までのMinorの指摘R-01〜R-05を直す。文書の未検証の記述を現状に合わせ、`candidate.ts` の単体試験を足し、U8のworkflowと `trusted-callers.json` の一致を試験にし、候補のartifactの中身を確かめ、今のmainでの結果を取り直す。
- Touches（Step 15）：`showcase/README.md`・`README.md`（showcaseの節）・`showcase/tests/candidate.test.ts`・`showcase/tests/workflow.test.ts` と、U7の記録（`code-summary.md`・`traceability.json`・`source-manifest.jso...

Full plan: aidlc/spaces/default/intents/261012-terrarium-migration/construction/u7-showcase-guests/code-generation/code-generation-plan.md
Test instructions: aidlc/spaces/default/intents/261012-terrarium-migration/construction/u7-showcase-guests/code-generation/unit-test-instructions.md

[Approval Fingerprint]: sha256:v3:9ce74c430ffbd77add054fbc490dd818b5cce4772b7087adad1e1ed4d9a0cdd4
[Planned Source]: 45d8898eab8cc25c17d17292181ebfdbd69748f07dce57ecd6db813a787aea6c

- A. Approve Plan
- B. Request Changes
- C. I'll edit the files

[Answer]: A. Approve Plan
