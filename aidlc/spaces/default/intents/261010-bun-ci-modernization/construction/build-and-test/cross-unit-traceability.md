# Cross-Unit Traceability

## Inventory and Result

main Node24.21.0 read-onlyでrequirements FR1–9/NFR1–5と4unit code-generation/traceability.jsonのstatus OK及び実ファイル存在を再照合しexit 0。FR9件PASS、親NFR5件PASS。U3修正前の親NFR GAPは解消した。User Stories assessmentはSkip、stories.mdはないため三段ACを捏造しない。ドキュメント対応の検査であり動作・実coverage合格ではない。最初の全ID走査はrecord相対のverification/local-observations.mdをworkspace相対と解釈してENOENTだったため採用せず、本検査の対象14IDに限定して実在を再検証した。

## Coverage

| ID | Owning Unit | Existing Target | Verdict |
|---|---|---|---|
| FR1 | U1 | bun.lock | PASS |
| FR2 | U1 | scripts/ci/tasks.ts | PASS |
| FR3 | U1 | .github/workflows/ci.yml | PASS |
| FR4 | U3 | .github/workflows/pr-labels.yml | PASS |
| FR5 | U1/U3 | scripts/ci/commit-format.ts | PASS |
| FR6 | U2/U3 | scripts/maintenance/policy.ts | PASS |
| FR7 | U2/U3 | scripts/maintenance/operations.ts | PASS |
| FR8 | U4 | .github/workflows/publish.yml | PASS |
| FR9 | U1/U3/U4 | README.md | PASS |
| NFR1 | U3 | scripts/maintenance/bundle.ts | PASS |
| NFR2 | U3 | .github/workflows/maintenance.yml | PASS |
| NFR3 | U3 | scripts/maintenance/operations.ts | PASS |
| NFR4 | U3 | tests/tooling/maintenance-integration.test.ts | PASS |
| NFR5 | U3 | scripts/maintenance/receipt.ts | PASS |
