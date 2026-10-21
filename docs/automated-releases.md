# Automated releases

Normal releases follow vivarium: release-please prepares a release
PR; successful CI and a merge create a matching GitHub tag/Release; publish.yml
publishes the verified package to npm with OIDC. RC publication is not a
prerequisite for normal stable releases.

## Version and triggers

package.json and the release-please manifest use the same version. A stable
v<version> tag and GitHub Release use that version too. The root development
package stays private; the staged distribution is public. No version.txt or
version-specific release input URL is required.

RELEASE_AUTOMATION_ENABLED controls release-please. Weekly release merging remains
disabled; main branch protection and ci-required remain mandatory. Existing
organisation BOT_CLIENT_ID/BOT_PRIVATE_KEY let the bot's tag trigger Actions.
The existing npm Trusted Publisher tuple remains repository
aletheia-works/formicarium, workflow publish.yml, environment release.

## Required checks and publication

The release PR runs ordinary CI, native/Node/Chromium/Firefox/WebKit regression
and exact-tarball fixed-24 coverage >=80%. publish.yml independently reads GitHub
API results to require exactly one merged same-repository release-please PR from
aletheia-works-bot, its exact merge SHA/main target, and successful CI for its
actual head. Manual tags, forks, failed/stale CI and RC tags are refused.

After authorization, the tag's source runs the reusable ci.yml with the same
build and candidate regression/coverage pipeline. This fresh measurement is
necessary because a merged/tagged commit has a different SHA from the PR head;
PR evidence is never relabelled. The package comes from this run's wasm build,
source, version and run attempt. ci-required must pass before the writer runs.

Successful measurement exports the candidate digest and same-run artifact name.
The npm writer receives only that tarball, checks its SHA256, and uses
bunx npm@latest publish --provenance --access public --tag latest. Bun runs the
ordinary tasks; Node is used for Node compatibility, coverage instrumentation and
npm trusted publishing. No npm token fallback is used.

Before publishing, the registry is queried. A missing version may be published;
an existing version is skipped only when its downloaded bytes have the same
SHA256. Different bytes or registry errors fail closed. The verified tarball is
attached to the release-please Release without replacing existing assets or notes.
No retries blindly resend an unknown publication result.

The reviewed external guest/consumer fixtures retain their historical provenance;
fresh frozen-fixture tests do not claim latest consumer acceptance. Problems are
corrected in the next patch release, rather than making a public RC mandatory
each time.

## Local verification and deployment boundary

Workflow shell steps are tested with fake GitHub/registry responses and fake
external writers. Tests cover exact release/head/source identity, failed CI,
version drift, modified tarballs, coverage refusal and same-version recovery.
PR CI exercises the actual candidate preparation, regression and coverage. It
cannot exercise npm OIDC or tag authorization without a real release tag.

This change does not republish the older v0.2.0 tag, alter an existing tag, or
publish from a PR. The next release containing these workflows uses the new
route after its release PR passes CI and is merged. Older tags contain older
workflow code; they are not silently migrated. Deliberate RC trials remain a
separate reviewed process rather than an automatic stable-path bypass.

## Historical tooling

scripts/release's evidence collectors and legacy RC/stable decision tests remain
available to inspect historical 0.1.0 evidence. Their writerEnabled flag is false,
and the old release-preflight workflow is removed. Those manual input/approval/RC
adoption contracts do not authorize or block the YAML-owned normal stable path.
The 0.1.0 release-assurance document describes that older process only.

Infrastructure state remains managed by the existing common OpenTofu seed/apply
workflows; this release change does not modify infrastructure or credentials.
