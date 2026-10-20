---
title: Maintenance
description: Builds, monitoring, rollback and dependency checks of the showcase site.
---

## Builds and monitoring

The site deploys when a push to `main` changes it, and when `showcase-site.yml`
is run by hand on `main`; there is no daily run. Each run writes a job summary
with the days since the last deployment and the jobs that failed. An old
deployment is not a failure. To deploy a new guest candidate of
**Showcase guests**, run `showcase-site.yml` by hand on `main`.

## When the candidate is missing

Pull requests take the candidate of the newest successful push or manual run
of `showcase.yml` on `main`. If that artifact is missing or expired, the
`fetch-candidate` job fails and asks for a manual run: start **Showcase guests**
on `main`, wait for it to succeed, then re-run the pull request.

## Rollback

- **A change of the site broke it.** Revert the change on `main`. The revert's
  push deploys the site again; check that its `verify-deployment` succeeds (if
  that run fails, run `showcase-site.yml` by hand on `main`).
- **A new tool release broke it.** Disable the workflow in Actions (the previous
  site stays), adjust the tool's conditions in `showcase/tools.json` by pull
  request, enable the workflow again and run it by hand on `main`.

Failed builds and acceptance never deploy, so the previous site stays. An old
run cannot be deployed again: the deploy job refuses a run older than the
newest deployment.

## First deployment

The `github-pages` environment holds a reviewer for the first deployment only.
After the first site has been checked, remove the reviewer by an OpenTofu pull
request in `infra/github`.

## Dependencies

`showcase/site/bun.lock` is committed and installed with
`bun install --frozen-lockfile --ignore-scripts`. Update dependencies by pull
request. If the dependency review does not read `bun.lock`, review the lockfile
diff by hand before merging.
