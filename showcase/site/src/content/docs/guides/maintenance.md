---

title: Maintenance
description: Builds, monitoring, rollback and dependency checks of the showcase site.
---

## Builds and monitoring

The site deploys when a push to `main` changes it, and when `showcase-site.yml`
is run by hand on `main`; the site has no daily run. Each run writes a job
summary with the days since the last deployment and the jobs that failed. An old
deployment is not a failure.

`showcase-watch.yml` compares the latest tool versions with the deployed site
every day. When they differ it starts `showcase-site.yml` on `main`, so a new
tool version deploys without a manual run. A run stopped only because no runner
picked up a job is started again the next day. When a job of the run fails, the
check opens the issue **Showcase: new guest versions did not deploy** and starts
no run for those versions while it is open. It starts one again when a newer
version appears, and closes the issue once the site has the versions. After
fixing the cause, run `showcase-site.yml` by hand on `main`.

## When the candidate is missing

A pull request that changes the guests (`showcase/tools.json` or
`showcase/fixtures/`) builds and accepts its own candidate. Any other pull
request takes the candidate of the newest successful push or manual run of
`showcase.yml` on `main`. If that artifact is missing or expired, the
`fetch-candidate` job fails and asks for a manual run: start **Showcase guests**
on `main`, wait for it to succeed, then re-run the pull request.

## Rollback

- **A change of the site broke it.** Revert the change on `main`. The revert's
  push deploys the site again; check that its `verify-deployment` succeeds (if
  that run fails, run `showcase-site.yml` by hand on `main`).
- **A new tool release broke it.** The previous site stays, since a failed run
  never deploys. Adjust the tool's conditions in `showcase/tools.json` by pull
  request (the pull request verifies the site), merge it, then run
  `showcase-site.yml` by hand on `main`. Do not disable the workflow: its
  `showcase-site-required` check is required on `main`, so no pull request
  could merge while it is disabled.

A pull request that changes `showcase/tools.json`, `showcase/fixtures/` or
`showcase/formicarium-release.json` verifies the site too. A push of
`showcase/formicarium-release.json` deploys; the others do not, so deploy them
with a manual run on `main`.

When a stable formicarium release is published to npm,
`showcase-release-pin.yml` opens a pull request that pins it in
`showcase/formicarium-release.json` (the version, npm's integrity and the
commit of its tag, checked the way distribution checks them) and turns on its
auto-merge. Once the required checks pass, the pull request merges and the site
deploys with the release. To pin a release by hand, run the workflow with its
version; that pull request auto-merges too.

Failed builds and acceptance never deploy, so the previous site stays. An old
run cannot be deployed again: the deploy job refuses a run older than the
newest deployment.

## First deployment

The first deployment (run 39422079965) was approved by a reviewer of the
`github-pages` environment. After the site was checked, the reviewer was
removed by an OpenTofu pull request in `infra/github`, so later deployments
need no approval. A deployment still runs only for a push or a manual run on
`main` (the environment accepts protected branches only), only after every
earlier job succeeded, and only when no newer run has already deployed.

## Dependencies

`showcase/site/bun.lock` is committed and installed with
`bun install --frozen-lockfile --ignore-scripts`. Update dependencies by pull
request. If the dependency review does not read `bun.lock`, review the lockfile
diff by hand before merging.
