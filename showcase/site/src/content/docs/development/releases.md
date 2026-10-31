---

title: Package releases
description: How a formicarium version goes from a release PR to npm.
---

Releases are automated as in vivarium. release-please prepares a release PR from
Conventional Commits. Merging it after the required checks is the approval of
that version: it creates the matching `v<version>` tag and GitHub Release, and
`publish.yml` publishes the verified package to npm with trusted publishing
(OIDC). As in vivarium and paludarium,
there are no prerelease versions: every version is stable and goes to npm's
`latest` dist-tag. The CI job named release candidate checks the tarball that
will be published; it is not a prerelease.

## Version and triggers

`package.json` and the release-please manifest carry the same version, and so do
the stable tag and the GitHub Release. The development package at the
repository root stays private; the staged distribution is public.

A commit that touches only the showcase (`showcase/`, `mise-tasks/showcase/` and
`mise-tasks/showcase-site/`) does not count toward the next version: the site
deploys on its own, and the npm package would not change. release-please skips
it through `exclude-paths`, which matches directories only, so a commit that
also changes a `showcase*.yml` workflow still counts.

The `RELEASE_AUTOMATION_ENABLED` variable controls release-please.
`release-merge.yml` turns on auto-merge for the pending release PR every
Monday at 00:23 UTC, but only while the variable
`WEEKLY_RELEASE_MERGE_ENABLED` is also `true`; it is `false`, so release PRs
are merged by hand. The organisation's bot (`BOT_CLIENT_ID`,
`BOT_PRIVATE_KEY`) creates the tag so that it can trigger Actions. npm trusts
exactly the repository `aletheia-works/formicarium`, the workflow
`publish.yml` and the environment `release`.

## Checks before publishing

The release PR runs every CI group: lint, types and light tests, the native
baselines, the Node.js, Chromium, Firefox and WebKit regressions, real Safari
on macOS and in an iOS Simulator, and the
release candidate, which packs the exact tarball and requires at least 80% line
coverage of the 23 distributed JavaScript files. The candidate is packed once;
Node.js and each browser then check those bytes in parallel jobs, each with one
worker and no retries, and a last job merges their checks and coverage. It
counts a part only if it measured the same inputs and instrumentation.

`publish.yml` reads the GitHub API itself. It requires exactly one merged
release-please PR from `aletheia-works-bot` in the same repository, its exact
merge commit on `main`, and successful CI for its head. Manual tags, forks,
failed or stale CI and prerelease tags such as `v0.2.0-rc.1` are refused.

After that, the tag's source runs the reusable `ci.yml` again with the same
build, regression and coverage. The tagged commit differs from the PR head, so
the PR's results are never reused. The package comes from this run's wasm
build, source, version and attempt, and `ci-required` must pass before anything
is written. After a rerun of only the failed jobs, the candidate merges the
parts that passed in earlier attempts with the rerun ones. GitHub lists the
carried-over jobs under the new attempt, so publication accepts that
candidate. Every part checked the same candidate bytes: they are made only by
`prepare`, and a rerun of `prepare` reruns every part.

## Publishing

The run exports the candidate's digest and artifact name. The npm step receives
only that tarball, checks its SHA-256 and runs
`bunx npm@latest publish --provenance --access public --tag latest`. There is
no npm token fallback.

The registry is queried first. A missing version is published; an existing
version is skipped only when its downloaded bytes have the same SHA-256.
Different bytes or a registry error stop the release. The verified tarball is
attached to the release-please GitHub Release without replacing existing assets
or notes. An unknown publication result is never resent blindly.

A defective release is fixed in the next patch release; publishing stops and
users are pointed to the last good version.

## Tests

The workflow's shell steps are tested with fake GitHub and registry responses
and fake writers: release, head and source identity, failed CI, version drift,
modified tarballs, coverage refusal and recovery of the same version. CI on the
release PR, and on a PR that changes the candidate's own code, runs the real
candidate preparation, regression and coverage; npm
OIDC and tag authorization need a real release tag.

`scripts/release/` also keeps tools that check the stored 0.1.0 evidence. They
cannot publish (`writerEnabled` is `false`) and play no part in the release
above.
