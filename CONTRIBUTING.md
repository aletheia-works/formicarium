# Contributing to formicarium

Please discuss large changes in an issue before implementation. Keep each PR
focused on one problem and include reproducible evidence for correctness claims.
AI-assisted contributions follow the same standard; identify the tool and model
used, and verify the output before submitting it.

Read [the runtime architecture](https://aletheia-works.github.io/formicarium/development/architecture/)
and [the architecture decisions](https://aletheia-works.github.io/formicarium/development/decisions/)
before changing runtime behavior. [AGENTS.md](AGENTS.md) contains the repository
development rules.

## Tools

| Tool                  | Used for                                                  | How to get it                                                                                      |
| --------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Bun (latest)          | Installing the locked dependencies, builds and most tasks | `mise install` (`mise.toml`)                                                                       |
| Node.js (latest)      | Node tests, the Node runner and measurements              | `mise install`. The published package supports Node.js 24 or later                                 |
| Docker (or wslc)      | Building the Linux guests and the native baselines        | Docker Desktop. On Windows wslc is tried first; set `FORMICARIUM_CONTAINER=docker` to force Docker |
| Playwright's browsers | Browser tests                                             | `bun node_modules/@playwright/test/cli.js install chromium firefox webkit`                         |

Resolve mise-managed executables from their installation directories rather
than through `mise exec` or shims; run declared tasks with `mise run <task>`
(`mise tasks ls` lists them). On Windows, mise tools are not on the PATH of
non-interactive shells.

This repository uses Jujutsu (`jj`), including for fork synchronization:

```sh
jj git fetch --all-remotes
jj new main@upstream
```

Here `origin` is your fork and `upstream` is `aletheia-works/formicarium`.
In PowerShell quote revision expressions containing `@`, such as `jj log -r '@'`.

## Build

```sh
mise run install-frozen   # the locked dependencies from bun.lock; install scripts stay disabled
mise run build            # type-check, emit .js next to the sources, copy the core to dist/paludarium/
mise run check            # Biome: lint, format and import order (bun run check:fix applies safe fixes)
mise run typecheck        # strict type check of the runtime and the tests
mise run test-light       # unit and tooling tests, the same as the CI quality job
```

Runtime modules, scripts, tests and supported configuration files are
TypeScript; do not edit the generated `.js` files. The emulator core is the
`@aletheia-works/paludarium-wasm` package pinned in `package.json`; the build
copies its files to `dist/paludarium/` with the SHA-256 of each file.
Core-specific changes belong in
[paludarium](https://github.com/aletheia-works/paludarium), and only
`runtime/core.ts` may know about the core (ADR 0003).

## Guests and native baselines

The regression tests run static x86-64 musl guests from `dist/guests/`, built
in containers:

```sh
mise run build-guests probe       # probe, hello, exit3, ttyecho and spawn (about a minute)
mise run build-guests aube        # aube (over an hour; rebuild only when its inputs change)
mise run build-guests pitchfork   # pitchfork, with its web UI built by dist/guests/aube (about 35 minutes cold)
mise run build-guests nano        # nano with ncurses (about 11 minutes under amd64 emulation on an arm64 Mac)
mise run native-baseline aube-1645 --check-reproducible
mise run native-baseline pitchfork-basic --check-reproducible
```

CI builds aube v2.7.0 and pitchfork v2.30.1 (`AUBE_REF`, `PITCHFORK_REF`),
and nano 9.3 with ncurses 6.6 (`NANO_VERSION`, `NCURSES_VERSION`). The nano and
ncurses tarballs are checked against SHA-256 digests in the build script,
taken from tarballs whose signatures were checked with the GNU keyring; a
different version needs its digest too (`NANO_SHA256`, `NCURSES_SHA256`).
ncurses is built with the xterm-256color definition compiled in, so nano needs
no terminfo files, only `TERM=xterm-256color`. Upstream sources are not
patched. The native baselines in `fixtures/baseline/` are the expected
transcripts; the emulator must produce the same output. Guests, their
environment and the session scripts are listed only in `runtime/registry.ts`.
To add a guest, add it there and add its build target, fixtures, baseline and
tests. `mise run pitchfork-probe-paths` shows,
natively, which paths each pitchfork command writes.

## Tests

```sh
# Node.js regressions (the same list as CI's Node suite)
node --test --test-concurrency=1 tests/node/build.test.js tests/node/runner.test.js tests/node/probe.test.js tests/node/session.test.js tests/node/interactive.test.js tests/node/installed-guests.test.js tests/node/aube-1645.test.js tests/node/pitchfork-basic.test.js
# Browser regressions: probe, the interactive runs of ttyecho and nano, aube #1645 and pitchfork-basic in Chromium, Firefox and WebKit
bun run test:browser
bun run test:browser -- --repeat-each=3   # repeatability
mise run test-consumer                    # the packed package in a separate consumer (prepare its assets first)
```

Run suites one at a time. Keep the quality limits: one worker, no retries, 600 s
per probe run, 840 s per aube #1645 run in the browser, all 8 probe items
passing, transcripts identical to the native baselines, and the 1 GB wasm memory
cap pinned by `tests/node/build.test.ts`. The probe also has regression items
that run only when named: `futex-deadline`, `page-fault-race` and
`madvise-dontneed`.

`web/index.html` (served by `bun scripts/serve.js --port 8787`, which adds the
COOP/COEP headers) runs a guest or a session script through the package's
browser API, for example `?guest=probe` or `?session=aube-1645`;
`node runtime/node/run.js <guest> [args...]` does the same on Node.js. Session
scripts (`fixtures/sessions/*.txt`) accept a guest command, `rm -rf <path>` and
`cat <path>`, split arguments like `sh -c`, and refuse other shell syntax.

CI runs the probe page and the install and command API checks in real
Safari on macOS (`tests/browser/safari-probe.test.ts` through
safaridriver), and so do the showcase acceptance
(`showcase/tests/accept-safari.ts`) and the site acceptance (the `safari`
project of `showcase/site/tests/playwright.config.ts`); the other browser suites use
Playwright's WebKit in its place. The probe page and the install and command
API checks also run in Safari on iOS, on an iPhone in the newest iOS 26 Simulator
(`FORMICARIUM_SAFARI_PLATFORM=ios`). iOS 27 is not run: Xcode 27 replaced
Simulator.app with Device Hub, and safaridriver then finds no iOS Simulator. A real iPhone is not tested. On Windows, the POSIX
permission checks are skipped; run them on Linux.

## Measurements

```sh
node scripts/measure-aube.js --trials 10
```

Measure with nothing else heavy running. Each trial also records a fixed host
computation (`hostBenchMs`), because the same host varies by up to 2.4x; check
it before attributing a slowdown to code, and compare variants by alternating
them (ABBA).

## CI

`ci.yml` maps the changed files of a pull request to job groups with
`scripts/ci-changes.py`: quality (lint, types, build, light tests), product
(guest builds, native baselines, and the Node, Chromium, Firefox and WebKit
regressions) and candidate (the release candidate with package coverage).
`ci-required` passes only when every needed job passed and every other job was
skipped. Product jobs keep their diagnostics, including each browser's own log
and, after a failure, the kernel log. The release process is described in
[Package releases](https://aletheia-works.github.io/formicarium/development/releases/).

## Verification

Run checks appropriate to the affected files and record exact commands, results,
and any unverified behavior in the PR. Never benchmark under concurrent load.
For documentation or GitHub configuration changes, check syntax, referenced
paths, and the final diff.

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
