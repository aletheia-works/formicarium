# Cross-Unit Traceability

## Fresh evidence update — 2026-10-10

検証済み：現source12a92eabの実CI成功と、公開候補8334d7f1のfresh固定24coverage80.51%/46receiptを確認した。詳細はverification/publication-boundary-v1/remote-reconciliation.jsonとverification/public-candidate-coverage-v1/result.json。NFR3の実測不足は解消した。一方、保存Unit traceabilityのDeferred/未完了外部ACをこの段階でOKへ書き換えていないため、機械的status/target検査は68/95 PASS・27 FAILのまま。実測の成功と追跡表の未完了statusを区別する。公開RC導入・実OIDC・公開操作は未検証。

## Current Verification — Loop-back 4

検証済み：現requirements/storiesから95 IDsを再列挙し、保存inventoryとID差分0を確認。現在の全Unit traceabilityとtarget実在を再照合して68/95 PASS、27 FAIL。Deferredは合格へ昇格しない。これは追跡表の検査であり、未実行の公開・実導入・fresh coverageの成功を意味しない。詳細 `verification/publication-boundary-v1/cross-unit.json`。下記は以前の対応表を保持する。


## Verification Method

requirements全FR/NFR、stories全3segment ACを列挙。各Unitの同ID OKと実在targetを確認。DeferredはPASSへ昇格しない。詳細verification/resume-20261010-v2/cross-unit.json。

| ID | Verdict | Unit | Target | Recorded Status |
|---|---|---|---|---|
| AC1.1.1 | PASS | u1-runtime-package | tests/package/consumer.test.ts | OK |
| AC1.1.2 | PASS | u1-runtime-package | tests/package/consumer.test.ts | OK |
| AC1.1.3 | PASS | u1-runtime-package | runtime/core.ts | OK |
| AC1.2.1 | PASS | u1-runtime-package | runtime/core.ts | OK |
| AC1.2.2 | PASS | u1-runtime-package | tests/package/consumer.test.ts | OK |
| AC1.2.3 | PASS | u1-runtime-package | runtime/core.ts | OK |
| AC1.3.1 | PASS | u1-runtime-package | tests/package/pack.test.ts | OK |
| AC1.3.2 | PASS | u1-runtime-package | tests/package/pack.test.ts | OK |
| AC1.3.3 | PASS | u1-runtime-package | tests/package/pack.test.ts | OK |
| AC2.1.1 | PASS | u1-runtime-package | runtime/validation.ts | OK |
| AC2.1.2 | PASS | u1-runtime-package | runtime/protocol.ts | OK |
| AC2.1.3 | PASS | u1-runtime-package | runtime/validation.ts | OK |
| AC2.2.1 | PASS | u1-runtime-package | runtime/validation.ts | OK |
| AC2.2.2 | PASS | u1-runtime-package | runtime/core.ts | OK |
| AC2.2.3 | PASS | u1-runtime-package | runtime/worker-execution.ts | OK |
| AC2.3.1 | PASS | u1-runtime-package | runtime/lifecycle.ts | OK |
| AC2.3.2 | PASS | u1-runtime-package | runtime/lifecycle.ts | OK |
| AC2.3.3 | PASS | u1-runtime-package | runtime/lifecycle.ts | OK |
| AC3.1.1 | PASS | u1-runtime-package | runtime/state.ts | OK |
| AC3.1.2 | PASS | u1-runtime-package | tests/package/state.test.ts | OK |
| AC3.1.3 | PASS | u1-runtime-package | runtime/state.ts | OK |
| AC3.2.1 | PASS | u1-runtime-package | runtime/state.ts | OK |
| AC3.2.2 | PASS | u1-runtime-package | runtime/state.ts | OK |
| AC3.2.3 | PASS | u1-runtime-package | tests/package/state.test.ts | OK |
| AC3.2.4 | PASS | u1-runtime-package | runtime/lifecycle.ts | OK |
| AC4.1.1 | PASS | u3-terrarium-integration | tests/terrarium/consumer.spec.ts | OK |
| AC4.1.2 | PASS | u3-terrarium-integration | tests/terrarium/consumer.spec.ts | OK |
| AC4.1.3 | PASS | u3-terrarium-integration | tests/terrarium/consumer.spec.ts | OK |
| AC4.2.1 | PASS | u3-terrarium-integration | scripts/terrarium/acceptance.ts | OK |
| AC4.2.2 | PASS | u3-terrarium-integration | scripts/terrarium/acceptance.ts | OK |
| AC4.2.3 | PASS | u3-terrarium-integration | scripts/terrarium/acceptance.ts | OK |
| AC4.2.4 | PASS | u3-terrarium-integration | scripts/terrarium/acceptance.ts | OK |
| AC4.3.1 | PASS | u2-guest-distribution | tests/guest-distribution/consumer.spec.ts | OK |
| AC4.3.2 | PASS | u2-guest-distribution | tests/guest-distribution/integration.test.ts | OK |
| AC4.3.3 | PASS | u2-guest-distribution | tests/guest-distribution/resolver.test.ts | OK |
| AC5.1.1 | PASS | u4-release-assurance | tests/node/probe.test.ts | OK |
| AC5.1.2 | PASS | u4-release-assurance | tests/node/build.test.ts | OK |
| AC5.1.3 | PASS | u4-release-assurance | scripts/release/collect.ts | OK |
| AC5.2.1 | PASS | u4-release-assurance | scripts/release/evidence.ts | OK |
| AC5.2.2 | PASS | u4-release-assurance | scripts/release/evidence.ts | OK |
| AC5.2.3 | FAIL | u3-terrarium-integration | aidlc/spaces/default/intents/261006-npm-terrarium-release/inception/units-generation/unit-of-work-story-map.md | Deferred |
| AC5.3.1 | PASS | u1-runtime-package | runtime/core.ts | OK |
| AC5.3.2 | PASS | u1-runtime-package | runtime/core.ts | OK |
| AC5.3.3 | PASS | u1-runtime-package | runtime/web/package-worker.ts | OK |
| AC6.1.1 | FAIL | u3-terrarium-integration | aidlc/spaces/default/intents/261006-npm-terrarium-release/inception/units-generation/unit-of-work-story-map.md | Deferred |
| AC6.1.2 | PASS | u4-release-assurance | scripts/release/decision.ts | OK |
| AC6.1.3 | FAIL | u3-terrarium-integration | aidlc/spaces/default/intents/261006-npm-terrarium-release/inception/units-generation/unit-of-work-story-map.md | Deferred |
| AC6.2.1 | FAIL | u3-terrarium-integration | aidlc/spaces/default/intents/261006-npm-terrarium-release/inception/units-generation/unit-of-work-story-map.md | Deferred |
| AC6.2.2 | PASS | u4-release-assurance | scripts/release/decision.ts | OK |
| AC6.2.3 | FAIL | u3-terrarium-integration | aidlc/spaces/default/intents/261006-npm-terrarium-release/inception/units-generation/unit-of-work-story-map.md | Deferred |
| AC6.3.1 | FAIL | u3-terrarium-integration | aidlc/spaces/default/intents/261006-npm-terrarium-release/inception/units-generation/unit-of-work-story-map.md | Deferred |
| AC6.3.2 | PASS | u4-release-assurance | scripts/release/decision.ts | OK |
| AC6.3.3 | PASS | u4-release-assurance | scripts/release/decision.ts | OK |
| AC6.4.1 | FAIL | u3-terrarium-integration | aidlc/spaces/default/intents/261006-npm-terrarium-release/inception/units-generation/unit-of-work-story-map.md | Deferred |
| AC6.4.2 | FAIL | u3-terrarium-integration | aidlc/spaces/default/intents/261006-npm-terrarium-release/inception/units-generation/unit-of-work-story-map.md | Deferred |
| AC6.4.3 | PASS | u4-release-assurance | scripts/release/decision.ts | OK |
| FR1 | PASS | u1-runtime-package | tests/package/pack.test.ts | OK |
| FR1.1 | PASS | u1-runtime-package | tests/package/consumer.test.ts | OK |
| FR1.2 | PASS | u1-runtime-package | tests/package/pack.test.ts | OK |
| FR1.3 | PASS | u1-runtime-package | tests/package/pack.test.ts | OK |
| FR10 | FAIL | u4-release-assurance | scripts/release/decision.ts | Deferred |
| FR10.1 | FAIL | u4-release-assurance | scripts/ci/verification.ts | Deferred |
| FR2 | PASS | u1-runtime-package | tests/package/consumer.test.ts | OK |
| FR2.1 | PASS | u1-runtime-package | tests/package/consumer.spec.ts | OK |
| FR2.2 | PASS | u1-runtime-package | tests/package/validation.test.ts | OK |
| FR3 | FAIL | u1-runtime-package | aidlc/spaces/default/intents/261006-npm-terrarium-release/construction/u1-runtime-package/code-generation/verification/ci-traceability-repair-v1/requirement-mapping.md | Deferred |
| FR3.1 | PASS | u1-runtime-package | tests/package/state.test.ts | OK |
| FR3.2 | PASS | u1-runtime-package | tests/package/consumer.test.ts | OK |
| FR4 | PASS | u1-runtime-package | tests/package/lifecycle.test.ts | OK |
| FR4.1 | PASS | u1-runtime-package | tests/package/consumer.spec.ts | OK |
| FR5 | FAIL | u3-terrarium-integration | aidlc/spaces/default/intents/261006-npm-terrarium-release/construction/u3-terrarium-integration/code-generation/verification/ci-traceability-repair-v1/requirement-mapping.md | Deferred |
| FR5.1 | PASS | u3-terrarium-integration | aidlc/spaces/default/intents/261006-npm-terrarium-release/construction/u3-terrarium-integration/code-generation/verification/ci-traceability-repair-v1/requirement-mapping.md | OK |
| FR5.2 | PASS | u3-terrarium-integration | aidlc/spaces/default/intents/261006-npm-terrarium-release/construction/u3-terrarium-integration/code-generation/verification/ci-traceability-repair-v1/requirement-mapping.md | OK |
| FR5.3 | PASS | u3-terrarium-integration | aidlc/spaces/default/intents/261006-npm-terrarium-release/construction/u3-terrarium-integration/code-generation/verification/ci-traceability-repair-v1/requirement-mapping.md | OK |
| FR5.4 | FAIL | u3-terrarium-integration | aidlc/spaces/default/intents/261006-npm-terrarium-release/construction/u3-terrarium-integration/code-generation/verification/ci-traceability-repair-v1/requirement-mapping.md | Deferred |
| FR6 | FAIL | u2-guest-distribution | scripts/guest-distribution/stage.ts | Deferred |
| FR6.1 | PASS | u2-guest-distribution | integration/terrarium/guest-distribution/manifest.ts | OK |
| FR6.2 | PASS | u2-guest-distribution | tests/guest-distribution/manifest.test.ts | OK |
| FR7 | FAIL | u3-terrarium-integration | aidlc/spaces/default/intents/261006-npm-terrarium-release/construction/u3-terrarium-integration/code-generation/verification/ci-traceability-repair-v1/requirement-mapping.md | Deferred |
| FR7.1 | PASS | u4-release-assurance | scripts/ci/run.ts | OK |
| FR7.2 | PASS | u3-terrarium-integration | aidlc/spaces/default/intents/261006-npm-terrarium-release/construction/u3-terrarium-integration/code-generation/verification/ci-traceability-repair-v1/requirement-mapping.md | OK |
| FR7.3 | FAIL | u3-terrarium-integration | aidlc/spaces/default/intents/261006-npm-terrarium-release/construction/u3-terrarium-integration/code-generation/verification/ci-traceability-repair-v1/requirement-mapping.md | Deferred |
| FR8 | FAIL | u4-release-assurance | scripts/ci/bundle.ts | Deferred |
| FR9 | FAIL | u4-release-assurance | scripts/release/decision.ts | Deferred |
| FR9.1 | FAIL | u4-release-assurance | scripts/release/decision.ts | Deferred |
| FR9.2 | PASS | u4-release-assurance | scripts/release/decision.ts | OK |
| FR9.3 | FAIL | u4-release-assurance | scripts/release/decision.ts | Deferred |
| FR9.4 | FAIL | u4-release-assurance | scripts/release/decision.ts | Deferred |
| NFR1 | FAIL | u2-guest-distribution | tests/guest-distribution/consumer.spec.ts | Deferred |
| NFR2 | FAIL | u1-runtime-package | aidlc/spaces/default/intents/261006-npm-terrarium-release/construction/u1-runtime-package/code-generation/verification/ci-traceability-repair-v1/requirement-mapping.md | Deferred |
| NFR3 | PASS | u4-release-assurance | scripts/ci/verification.ts | OK |
| NFR4 | FAIL | u2-guest-distribution | tests/guest-distribution/fixtures.test.ts | Deferred |
| NFR5 | FAIL | u2-guest-distribution | scripts/guest-distribution/stage.ts | Deferred |
| NFR6 | PASS | u1-runtime-package | runtime/web/package-worker.ts | OK |
| NFR7 | FAIL | u2-guest-distribution | tests/guest-distribution/resolver.test.ts | Deferred |

## Result

FAIL: 95件中69PASS、26未達。ID欠落を埋めたことと要件条件の完了を区別する。
