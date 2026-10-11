# Automated releases

Release automation follows vivarium and terrarium: release-please updates a
release PR from Conventional Commits. A merged release PR creates a tag and
GitHub Release. The tag triggers the existing verified npm OIDC publication.
Release-please owns the changelog and release notes; publish.yml attaches the
verified tarball to an existing release, retaining manual RC release support.

The node release strategy uses package.json as the version source, matching
vivarium. The manifest tracks the version recorded by release-please; a GitHub Release
does not prove that this version has reached npm. Release-please
updates package.json and creates the matching v<version> tag and GitHub Release.
No version.txt is used. The root package remains private.

## Enablement

Release PR generation is enabled in the current infrastructure defaults; weekly
release merging remains disabled. Apply the infra/github plan only after
reviewing the new labels and variables. Supply the existing organisation
aletheia-works-bot credentials BOT_CLIENT_ID (variable) and BOT_PRIVATE_KEY
(secret); do not put credentials in source control. The App needs Contents,
Issues and Pull requests write on this repository. Its token lets generated
PRs and tag pushes trigger other Actions workflows.

RELEASE_AUTOMATION_ENABLED enables release PR generation and tag creation.
WEEKLY_RELEASE_MERGE_ENABLED separately enables Monday 00:23 UTC / 09:23 JST
auto-merge. The job selects exactly one non-draft, same-repository release PR
from app/aletheia-works-bot and matches its current head. Required checks and
branch protection remain authoritative. Keep weekly merging disabled until
candidate preparation and terrarium acceptance are ready for the next version.

## Candidate preparation and acceptance

The existing release gate remains mandatory: candidate-bound human approval,
native/Node/browser regression, fixed-inventory coverage >=80%, published RC
terrarium acceptance and stable/RC diff checks. Release-please cannot produce
these external acceptance results or authorize publication.

The release PR runs the ordinary CI plus `release-candidate.yml`. The same CI
run builds the locked core, stages the current package.json version, packs a
public candidate without publishing it, and measures regression and fixed-24
coverage against that exact tarball. The candidate, its SHA-bound manifest,
logs, receipts and coverage are retained together as a run/attempt/head-bound
Actions artifact. No version-specific input branch push or candidate input
variable update is required.

Candidate infrastructure changes also run this job so changes to the preparation
or workflow are tested before merging. Other PRs skip the expensive candidate
measurement. `ci-required` requires successful scope detection and, whenever
selected, a successful candidate job; failure, cancellation or unexpected skip
cannot satisfy the aggregate check.

The external aube/pitchfork and terrarium consumer fixtures remain a reviewed,
SHA-pinned input. Their historical source identity is retained in preparation.json;
old test results are not imported. The package runtime, public manifest and core
assets come from the current PR build. The independent product matrix also builds
and tests current Linux guests. Frozen consumer measurement is not formal
acceptance in the current terrarium repository.

The publication gate remains separate. `publish.yml` and `release-preflight.yml`
still consume reviewed publication inputs and independently verified candidate CI
references. This PR check does not fabricate RC adoption, human approval, or make
its artifact automatically trusted by the publication policy. Keep weekly merging
disabled until the new candidate's RC acceptance and final reviewed publication
inputs are ready. A changed main/tag SHA needs an updated binding and verification;
PR evidence must not be silently relabelled to the merged commit.

The current npm command does not retry publication of an existing version.
Inspect the registry before recovering a failed run. No existing tag or release
asset is overwritten. Stable publishes latest; RC publishes next.

## State handoff and release preflight

After merging the common seed update and this caller, dispatch
`terraform-seed.yml` on main once with the existing local terraform.tfstate
encoded as base64 and the decoded file's SHA256. This follows vivarium's
existing-state upload approach through the common seed workflow. The common
workflow checks the digest and nonempty v4 state, refuses an existing CI state
pointer, uploads `terraform-state`, and records LATEST_APPLY_RUN_ID. It does
not run OpenTofu or modify infrastructure. Never pass credential-bearing state
through workflow inputs: base64 is not encryption. Keep the local backup until
the uploaded state is downloaded and compared. Seeding does not change release automation enablement.

Dispatch `release-preflight.yml` on main after updating the reviewed release
input URL/SHA. It uses the actual evidence gate, including independent API
provenance checks, coverage and stable RC adoption. The input source must match
the dispatched main SHA and its version must match package.json. The preflight
has no publishing permissions and cannot export a publication package.
A successful preflight is a readiness check, not a publication or tagging
approval. Candidate input generation and terrarium acceptance remain external;
these workflows do not fabricate approvals or reuse old version evidence.

## Common PR workflows

`claude-review.yml` follows terrarium's author-scoped review workflow and uses the
shared `CLAUDE_CODE_OAUTH_TOKEN` secret. It reads the PR tree without running PR
scripts; checkout credentials are not persisted. New `pull_request_target`
workflows become active only after reaching the default branch. The organisation
secret's sharing cannot be confirmed with the current CLI permissions.

`test-lint-check.yml` follows the common mise task approach. `mise run lint:all`
checks Biome, GitHub Actions YAML (actionlint), and maintained shell entry points
(ShellCheck warning/error severity). Tools use latest versions; no formatter push
or additional App permissions are introduced.

## Recovering a merged release before npm readiness

A release PR merge creates a GitHub tag and Release immediately. It does not
supply the reviewed npm publication inputs. If those inputs still describe an
older tag/source, publish.yml deliberately fails before the npm writer runs.
Root package.json being private does not disable publication: the verified
staged package is public. Never replace an existing tag or bypass the context,
coverage, approval or terrarium acceptance gates to recover this situation.

CI supports workflow_dispatch on upstream main to generate a fresh source-bound
candidate after a merge. Leave candidate-version empty for the stable version,
or request an RC of that exact package.json base, for example 0.2.0-rc.1.
The RC override changes only the staged public package version. It does not
change main's package.json, publish anything, or create a tag/Release. The same
wasm build, regression and coverage jobs run, and artifacts bind to the actual
main SHA/run/attempt. Fork, non-main and other-version dispatches are refused.

Recovery order:

1. Merge the reviewed candidate dispatch change, then dispatch CI on main with
   candidate-version=0.2.0-rc.1; independently reconcile its completed evidence.
2. Prepare RC publication inputs for that exact source, version and tarball,
   observe npm Trusted Publisher settings, and obtain candidate-bound publication
   approval. The PR candidate artifact is not automatically admitted by the
   current candidate-verify producer policy; run/reconcile the reviewed producer
   or explicitly review a policy migration before publication.
3. Publish the approved RC to next through the existing gated OIDC workflow.
   Verify npm's version, integrity and provenance before terrarium installs it.
4. Obtain terrarium acceptance of the published RC. Prepare and verify the
   stable candidate and stable/RC diff, and collect its publication approval.
5. Update reviewed publication inputs for the immutable existing v0.2.0 source,
   then retry the tag publication only when all gates are ready. Preflight must
   run at the exact stable source/package version; if current main has moved,
   do not relabel evidence or remove the exact-source restriction. Prepare a
   separately reviewed recovery path if main cannot satisfy it.

The 0.2.0 PR artifact based on 9d8ec46c is a pre-merge candidate, not evidence
for the later main/tag 5ae3be2b. Historical fixture provenance is retained, and
terrarium must independently exercise current guests including Biome.
