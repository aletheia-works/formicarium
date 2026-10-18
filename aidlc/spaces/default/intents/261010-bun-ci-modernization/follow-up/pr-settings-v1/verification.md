# PR and repository settings verification

Date: 2026-10-11 (Asia/Tokyo)

PR: https://github.com/aletheia-works/formicarium/pull/3
Source: `0b7da72c895eb9a3b15b11a97986e6037817bdfa`

## 検証済み

- `TF_TOKEN_GITHUB` repository secret exists; only name/update metadata was inspected. No secret values were displayed.
- Ordinary CI 38091143399: quality, commit-format, ci-required all succeeded at the current source SHA.
- Ordinary artifact 11683124105 SHA256 `1deb1a60f1adcf3a91c612f4384b95a9d40fcf2863ef559157691d79c74e23fb` matches GitHub API digest. Single-member receipt independently checked against source/run/workflow/job conclusions.
- Observed artifact redirect host: `productionresultssa10.blob.core.windows.net`. This observation does not authorize every storage host.
- Credential-only CI 38091152527: five GET requests returned HTTP 200 (repository, main protection, workflow list, artifact list, current source check-runs). No write requests were made.
- Main protection requires quality/commit-format/ci-required from producer App 15368, strict current-base checks, admin enforcement, resolved conversations, no force push or deletion; signed commits required. Reviews require zero human approvals, preserving the approved conditional dependency automation.
- Squash merge only; auto-merge capability and merged-branch deletion enabled. PR #3 was squash merged after explicit user approval on 2026-10-11.
- Labels ci/runtime/tests/tooling exist. Dependabot vulnerability alerts and automated security fixes enabled and read back.
- Dependabot replaces Renovate. Actual Bot ID 49699333 and ordinary workflow ID 380853002 were independently observed.
- Existing authentication convention `TF_TOKEN_GITHUB` replaces separate App keys by the user's instruction. The prepare parent has a write-capable credential; child environments still exclude credentials. Local 234 tooling tests passed after authentication changes; the subsequent updated wiring refusal test passed all 10 tests. actionlint and lint passed.

## Fresh candidate verification

Run: https://github.com/aletheia-works/formicarium/actions/runs/38091354807
Input commit: `0ef760c9289f214b434eacc852955a8f32ef8629` (signature Verified)
Archive SHA256: `36d6cedd20eb363aeeb7b3ac6689351a3dc43740e1a4626c1e0c5ebaf74590bf`
Package SHA256: `254e229f0fcc63beacc532516a1ccb7cc9d5abfb237220f0add0124b152e28d2`
Archive: 104593514 bytes, 1374 regular members (1373 payload files), 222 source pins. All paths/bytes/digests verified before push; no known credential patterns detected. Existing guest/native fixtures retained; package and README were staged from current source, not relabeled from the old candidate.

Status: 検証済み — completed/success at the current source SHA, 16m43s. All nine required checks passed, skipped=0: release 35, Node/browser regression 54/36, native aube/pitchfork reproducibility each 1, consumer Node/browser 115/123, terrarium Node/browser 30/45.

Fixed 24-file coverage: 1450/1801 (80.51%); 46 fresh execution receipts. U1 coverage 862/982 (87.78%), skipped=0. Acceptance context and input manifest digest match; 20 command records and stdout/stderr hashes independently checked.

Artifact 11684357993: 68329116 bytes, SHA256 `16d0baf7b1ab344282e4883d30790285f47f0538ace219a062d945f853dbd66d`; API digest matched and 1610 regular ZIP files matched the independently downloaded extraction. Earlier 7fc23afe evidence is retained as historical evidence.

## 未検証 / prerequisites

- Actual Contents / Pull requests write permissions of the registered token have not been exercised by the GET-only probe.
- Maintenance is registered on main as workflow 380872201; run 38092793735 and its record check independently confirmed GitHub Actions producer 15368. Configuration follow-up PR #6 passed CI 38092909803 and was squash merged as 4feb0cf97cee8262f2b5577bf027b1272a95f1e7 (verified signature). Repository variable MAINTENANCE_ENABLED=true was saved and read back. Main CI 38092997431 succeeded after activation.
- Publication writer remains disabled; no tag, npm publication or release operation was performed.
- PR verification is complete; ready-for-review status, full template body and current head SHA were read back through the GitHub connector. Main integration was approved and PR #3 merged as f79df02890b2cfcdcd646e09fd766f0a9379b8ce (verified signature). Main CI 38092726329 passed all three required checks.

AI-DLC's completed stage records are preserved; this is follow-up evidence, not a rewritten stage outcome.

## Maintenance registration follow-up

PR #6: https://github.com/aletheia-works/formicarium/pull/6
Head 1e6625772431cfbe7f1555136c91165019ef0dc9, signature verified. Only policy, configuration tests and README changed. Local check/typecheck/build/test-light passed; tooling 234/234, skipped 0.
Main artifact 11684950653 independently returned exact redirect host productionresultssa19.blob.core.windows.net (HTTP 302); this and the previously observed host10 are explicitly registered. Other hosts continue to refuse.

## Current observed state

Main: 4feb0cf97cee8262f2b5577bf027b1272a95f1e7. Both PR #3 and settings PR #6 merged; signatures verified through API. Main required checks, signed commits, strict checks and admin enforcement remain enabled.
Dependabot PR #4 is an allowed minor Playwright update with CI success, but actual automated merge has not been observed. PR #5 is a Node types major update and its quality check fails TS2322 in scripts/terrarium/coverage.ts:475; it remains open, and major upgrades are outside the automation policy. Neither dependency change was manually merged.
Closed/fork PR #6 ordinary CI attempt 2 was rerun solely to trigger the enabled maintenance refusal boundary; final result will be recorded below.

Enabled maintenance refusal run 38093071384: prepare rejected AMBIGUOUS_PR because the rerun ordinary CI had no unique associated open PR. Record output explicitly reports prepare=failure, format-write=skipped, dependency-merge=skipped; both writer jobs have zero steps. This is an observed negative test, not a successful positive write permission test.

## Actual artifact sharding failure and repair

Playwright PR #4 ordinary CI attempt 2 succeeded. Enabled maintenance run 38093220357 refused REDIRECT_REJECTED and both writers were skipped. Independent GET of artifact 11684359357 returned HTTP302 to productionresultssa2.blob.core.windows.net; prior artifacts used shards 10 and 19. Exact two-host registration was insufficient. MAINTENANCE_ENABLED was set false while repairing.
PR #7: https://github.com/aletheia-works/formicarium/pull/7, signed head 0256047d9bab548a9b23234e3b56454b9e3c5d0f. Implements only the GitHub-published productionresultssa*.blob.core.windows.net namespace with numeric shard matching, no arbitrary wildcards. HTTPS/no credentials/no nondefault port/no fragment/no follow-on redirect remain enforced. Local check/typecheck/build/test-light succeeded; tooling246/246, skipped0. PR CI 38093436300 passed. PR #7 squash merged as 1abbf5404ac28e2918fa315c64ebb6984c7f95e0, signature verified. MAINTENANCE_ENABLED=true restored and read back.
Source: https://github.blog/changelog/2023-01-31-github-actions-job-summary-updates/ and https://docs.github.com/en/actions/reference/runners/github-hosted-runners .

PR #4 ordinary CI attempt3 and current main CI38093534278 are being observed after the sharding repair. No dependency update has been manually merged or pushed.
