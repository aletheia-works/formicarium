---
title: Maintenance
description: Daily build, monitoring, rollback and dependency checks of the showcase site.
---

## Daily build and monitoring

Each run of `showcase-site.yml` writes a job summary with the days since the
last deployment and the jobs that failed. A distribute run fails when an
earlier deployment exists and is two days old or more. Failed scheduled runs
notify the person who last changed the workflow's cron.

Once a month, open Actions and confirm that **Showcase site** is still enabled:
GitHub disables schedules of public repositories without activity.

## When the candidate is missing

Pull requests take the candidate of the newest successful push or manual run
of `showcase.yml` on `main`. If that artifact is missing or expired, the
`fetch-candidate` job fails and asks for a manual run: start **Showcase guests**
on `main`, wait for it to succeed, then re-run the pull request.

## Rollback

- **A change of the site broke it.** Revert the change on `main`, then run
  `showcase-site.yml` by hand on `main` and check that `verify-deployment`
  succeeds. A push alone never deploys.
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
