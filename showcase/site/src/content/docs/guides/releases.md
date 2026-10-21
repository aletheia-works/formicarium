---

title: Releases
description: formicarium package releases and the showcase deployment.
---

## The package

release-please prepares a release PR from Conventional Commits. Merging it
after the required checks creates the `v<version>` tag and GitHub Release, and
`publish.yml` publishes the verified tarball to npm with trusted publishing and
provenance. An existing version is never replaced.

## The showcase

`showcase-site.yml` runs when a push to `main` changes the site
(`showcase/site/**`, `showcase/scripts/**` or the workflow itself) and can be
started by hand on `main`. There is no daily run, so a new guest candidate is
deployed by a manual run. Only these two runs distribute:
1. `showcase.yml` builds and accepts a candidate in `distribute` mode, with the
   package that B1 accepted (`showcase/b1-pack.json`). Until that Release
   exists, distribution fails and nothing is deployed.
2. This site is built once from the candidate, checked, and accepted in
   Chromium, Firefox and WebKit over HTTPS without server headers.
3. The C10 evidence is assembled; every required row must have passed.
4. The deploy job publishes the same accepted artifact to GitHub Pages, after a
   check that no newer run has already deployed.
5. The deployed `site-identity.json` is read back until it names this run.

Pull requests and manual runs of another branch build and accept the site with
the newest candidate of `main` but never deploy. Any failure leaves the previous site in place.
