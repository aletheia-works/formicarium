# Contributing to formicarium

Please discuss large changes in an issue before implementation. Keep each PR
focused on one problem and include reproducible evidence for correctness claims.
AI-assisted contributions follow the same standard; identify the tool and model
used, and verify the output before submitting it.

## Getting started

Use [README.md](README.md) for setup, builds, and test commands. Read
[the runtime architecture](https://aletheia-works.github.io/formicarium/development/architecture/) and [the architecture decisions](https://aletheia-works.github.io/formicarium/development/decisions/)
before changing runtime behavior.
[AGENTS.md](AGENTS.md) contains repository development rules.

This repository uses Jujutsu (`jj`), including for fork synchronization:

```sh
jj git fetch --all-remotes
jj new main@upstream
```

Here `origin` is your fork and `upstream` is `aletheia-works/formicarium`.
In PowerShell quote revision expressions containing `@`, such as `jj log -r '@'`.
Resolve mise-managed executables from their installation directories rather than
using `mise exec` or shims; declared tasks still use `mise run <task>`.

Author runtime modules, scripts, tests, and supported configuration files in
TypeScript. Use Biome for linting, formatting, and import organization. Run
`npm run build` before executing generated `.js` files, and use `npm run check`
and `npm run typecheck` before submitting changes. Do not edit generated `.js`
files. TypeScript uses strict NodeNext resolution and checked indexed access.

## Verification

Run checks appropriate to the affected files and record exact commands, results,
and any unverified behavior in the PR. README.md lists the runtime suites and
their build prerequisites. Run suites one at a time, and never benchmark under
concurrent load. Preserve timeout, worker, retry, output, and memory limits.
For documentation or GitHub configuration changes, check syntax, referenced
paths, and the final diff; a full emulator rebuild is unnecessary.

Core-specific changes belong in paludarium
(https://github.com/aletheia-works/paludarium); formicarium pins its npm
package and keeps every core detail behind `runtime/core.ts` (ADR 0003).

## Pull requests

Use Conventional Commits for commit messages and PR titles, for example
`docs: clarify contribution guidelines` or `chore: add repository metadata`.
Link the relevant issue, explain the change, and highlight review risks.
Do not rewrite shared history. Sign off commits created through GitHub's web UI.
Do not apply workflow labels by judgment; organization labels are mechanical.

Contributions use [Apache-2.0](LICENSE). Third-party notices are maintained in
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and [the core license](https://aletheia-works.github.io/formicarium/development/licenses/).
Follow the [Code of Conduct](CODE_OF_CONDUCT.md) and use the private channel in
[SECURITY.md](SECURITY.md) for vulnerabilities.
