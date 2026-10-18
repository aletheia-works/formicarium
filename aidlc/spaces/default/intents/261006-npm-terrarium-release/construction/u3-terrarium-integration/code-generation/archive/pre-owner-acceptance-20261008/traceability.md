# U3 Traceability — current local candidate

## Assigned stories and current evidence

| Contract/story | Implementation | Main verification |
|---|---|---|
| US4.1 AC4.1.1/3, C1/C4 | terrarium formicarium-session.ts public command/FS adapter; terminal.ts | current sibling unit27 pass; formal typecheck/build exit0 |
| US4.1 AC4.1.1/2, C3 | terrarium catalog selection; stage-formicarium.mjs; assemble-pages.sh; local consumer.spec.ts | same pack24/runtime14 and all pinned refs staged; bridge6 pass; C4 cases included in measured45 |
| US4.2 AC4.2.1–4, C5 | terrarium web/terminal.mjs and e2e/formicarium-iframe.spec.ts; local coverage.ts requires their bound receipts | all C5 cases included in measured45 pass, exact-origin/source/command and guest marker/nonexecution oracle maintained |
| Pack adoption | terrarium package.json/packages/terrarium/bun.lock; same-origin .js Worker/resolver URLs | U1 tgz SHA ebe7e5cf6efcd26914e9016ebbd31df1d59812f5cfcfc71b874672c01109dc35; frozen install lock1; fresh inputs16 verified |
| Coverage/evidence | scripts/terrarium/{prepare,evidence,coverage}.ts and tests/terrarium/*.test.ts | Node local21 pass; measuredNode27 pass; measuredbrowser45 pass; fixed24 80.56% (1451/1801); immutable U1v11 import1253realms; CI pending |

## Identity and limits

Candidate versions are aube2.7.0/2.6.1 and pitchfork2.30.0. Parent0aa94fde1e33230efb96e8763f0fa811ce1cdd80 is explicitly recorded; historical60dd0dc/2.30.1/fixed23 observations remain distinct. Main-verification.md and fresh coverage-repair-v2/report.json carry commands, generation and source/candidate identities. U4-assigned AC5/6 remain explicitly deferred in traceability.json.

Actual source-manifest binding is pending native external-repository identity validation. No invented repo:path identifiers are recorded here.
