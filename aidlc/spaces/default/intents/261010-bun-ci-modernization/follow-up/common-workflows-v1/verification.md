# Common maintenance workflow alignment

## User steering

The user requested standard GitHub Actions YAML matching terrarium/vivarium for common maintenance, rather than a custom TypeScript engine. Repository-specific runtime, distribution and release verification remains appropriate.

## Current state

PR: https://github.com/aletheia-works/formicarium/pull/8
Head: cebf74986afcfe9bff53d41ac06731d029417cb8, signature Verified.
PR #8 was squash merged after explicit user approval as 3b36ce722238a549ff7b0616ef10ee9cee11ae7c. Merge and signature verified through GitHub API/connector.
MAINTENANCE_ENABLED=false was saved and read back. No dependency PR was merged by the old maintenance runner. Last old live run38093612867 prepared successfully after sharding repair but its dependency writer rejected NOT_MERGEABLE. Record these as historical observations, not the intended future maintenance approach.

## Replacement

Same dependabot-auto-merge.yml, assign.yml, dependency-review.yml, commitlint.yml and labeler.yml as terrarium. Same two-stage lint-autofix pattern, adapted to pinned Node24.21.0/Bun1.4.2 and Biome. Apply is limited to same-repository PRs; protected config paths are rejected. Added .github/labeler.yml for this repository's existing scope labels and copied six type labels from terrarium.
Removed .github/maintenance, scripts/maintenance, nine maintenance test sources, maintenance.yml and pr-labels.yml. Removed about10,000lines. AI-DLC's historical approved artifacts remain intact. Bun/lockfile, ordinary CI and repository-specific publication/runtime checks retained.

## 検証済み

- Local mise run check/typecheck/build/test-light passed; remaining tooling96/96, skipped0. Existing light suites retain their existing skips.
- actionlint with installed shellcheck passed all seven added workflows.
- Actual YAML Inspect patch code passed six cases: empty/TS accepted; workflow/dependency/traversal/mode rejected.
- Ordinary PR CI38093928037: quality, commit-format, ci-required succeeded at the head above.
- Shared Commitlint38093928659 succeeded; source pinned to aletheia-works/.github commit4f9b6d6865f083952f13557c91eaf839045e55e1.
- Autofix38093928099 succeeded; downloaded lint-autofix-patch/autofix.patch is0bytes.
- Dependabot-only auto-merge38093928108 correctly skipped this human feature PR.
- Actions allowlist inherited from organization. Repository-level update rejected409; no allowlist was changed. Shared workflow actually executed successfully under the existing policy.

## 未検証

New default-branch assign execution, actual positive Dependabot auto-merge and non-empty formatting push are not yet verified. Main required checks, strict protection and signing remain configured.

## Post-integration verification

Main CI38094079268 succeeded. All seven common workflows are registered active; the old maintenance/pr-labels workflow paths are absent. Obsolete MAINTENANCE_ENABLED variable removed after integration; fixed release/candidate input variables retained.

PR #4 was updated using GitHub CLI standard --rebase for live workflow verification (new head e9deda3ea749e606214d8f0ba90292d15f2f8e8f). Standard labeler38094141639 and Dependency Review38094141656 succeeded. Labels dependencies/type:chore observed. Standard auto-merge38094142769 correctly refused because the manual rebase lost Dependabot's verified commit signature. Log states "Dependabot's commit signature is not verified, refusing to proceed". No bypass/skip-verification option was added. Explicit user permission requested to post @dependabot recreate, so Dependabot itself can restore its signed update and validate auto-merge. No bot comment has been sent yet.

Standard lint-autofix-apply run38094161306 succeeded on the empty patch; it did not push a commit. Main protection readback retains strict=true, signed commits and quality/commit-format/ci-required from App15368.

### Dependabot recreation and automatic merge — 2026-10-11 JST

- User explicitly authorized posting `@dependabot recreate` to PR #4. Posted comment: https://github.com/aletheia-works/formicarium/pull/4#issuecomment-6103224599.
- 検証済み: Dependabot regenerated head `1ae72c45adb57393fdb81abe76542602150f8dc1`; GitHub commit verification reports `verified: true`, `reason: valid`.
- 検証済み: standard auto-merge workflow succeeded and GitHub Actions enabled SQUASH auto-merge at 2026-10-10T23:17:37Z. quality, commit-format, ci-required, shared commitlint, dependency review, labeler, and lint autofix all succeeded.
- 検証済み: PR #4 automatically merged at 2026-10-10T23:18:37Z; merge commit `b7975de975a9136c6c1f552c6454ac6085f52b9d`. Playwright minor update 1.63.0 → 1.64.0 completed through the standard YAML workflow and required checks. Signature verification was not bypassed.
