# Repository development rules

- Use Jujutsu (`jj`) for repository operations. Quote `@` in PowerShell (`jj log -r '@'`). Fetch with `jj git fetch --all-remotes` when needed.
- Resolve mise-managed executable paths under `~/AppData/Local/mise/installs/<tool>/*/` on Windows or `~/.local/share/mise/installs/<tool>/*/` on macOS (directly or in `bin/`), without hardcoding versions. Do not use `mise exec` or shims. Use `mise run <task>` for declared tasks. Check `mise ls` before declaring a tool unavailable.
- Prefer wslc for simple container work; fall back to Docker Desktop for complex or unsupported operations. Never benchmark under concurrent background load.
- Correctness claims require observed commands/output, named test results, or specific log lines. Label claims 検証済み / ドキュメント根拠 / 推測; explicitly mark unverified claims 未検証.
- For review feedback, turn the claim into a falsifiable sentence and verify it before replying. Replies must be at most five lines. Obtain the user's approval before posting a rebuttal; agreeing and fixing needs no extra approval.
- Keep fixes within the requested scope. If verification cannot be run, mark it 未検証 and provide concrete verification commands.

## Team practices

These were affirmed by the user; the background of each piece of work is in its PR and commit history.
- **Branches**: `main` is the integration branch. Work on short-lived bookmarks and merge them after review, keeping one change per piece of work so its history and reasoning stay together.
- **Tests**: write tests after implementing each testable layer. For a bug fix, first watch a reproduction test fail, then fix it and see the same test pass. Keep line coverage at 80% or more on the first-party distributed JS and run CI before merging; count files that were never executed in the denominator, list every exclusion with its reason, and never move an exclusion to reach the threshold.
- **Guests**: do not rebuild aube when its source has not changed; reuse `dist/guests` (an aube build takes over an hour). Rebuild the probe whenever it changes.
- **Releases**: publish `@aletheia-works/formicarium` to npm and GitHub Releases only after the user approves the version, starting from the version tag. RCs go to the `next` dist-tag and stable versions to `latest`. If a release is defective, stop further publishing and point users to the last good version. Never create repositories, push or publish without the user's approval.
- **Code style**: follow the existing ESM, camelCase, UPPER_SNAKE_CASE constants, PascalCase classes, purpose comments, and the split between Node, browser and shared code. Do not promote every internal export to the public API. Invalid input throws; a normal guest exit is an `exitCode`; a host or core failure throws with its cause.
- **Scope**: do not mix unrelated improvements, renames or whole-file reformatting into a fix.

## Project state (2026-10-23)

- The blink-on-wasm proof of concept is complete, and the core has moved to paludarium. Before changing anything, read the site's Development section (`showcase/site/src/content/docs/development/`, in English and under `ja/` in Japanese; English is the primary language), including its decisions. Past records (the PoC handover, history, results and research) were removed; they stay in git history.
- The terrarium migration is finished and its migration-only tooling is removed. AI-DLC is no longer used; its records stay in git at commit `8096c7b4`, and names say what they cover rather than which unit introduced them.
- The emulator core is paludarium, the npm package `@aletheia-works/paludarium-wasm`, pinned as an exact devDependency (0.4.0; this is paludarium's version, not formicarium's). `bun run build` copies its files to `dist/paludarium/` with a `build-info.json` of their SHA-256 digests, and the package ships them in `assets/paludarium/`. Keep core-specific knowledge in `runtime/core.ts` only (ADR 0003). The blink fork, its build files, patches and decisions were removed; they stay in git history.
- JIT work is deferred and must not be proposed unless the user reopens it (ADR 0002).
- Open items: only the browser probe, the install and command API checks and the showcase acceptance run in real Safari on macOS (the other browser suites use WebKit, and iOS Safari is untested), timings were taken on one laptop with the page in front only, and a private file-backed page does not revert to file contents on `MADV_DONTNEED`.

## Working notes for agents

- Run builds and tests from the main session, one at a time, and report a refused command instead of working around it.
- In Git Bash, `/work`-style guest paths given to `runtime/node/run.js --copy-in` are rewritten to Windows paths; prefix the command with `MSYS_NO_PATHCONV=1`.
- PowerShell refuses `-File` scripts under this machine's execution policy. Pass the script with `-Command` instead; never change the policy.
- wslc fails on this machine (ERROR_SHARING_VIOLATION); `scripts/lib/container.sh` falls back to Docker on its own.
- HTTPS credentials and SSH keys are not available to non-interactive shells on the Windows machine; to push, pass gh as a one-off credential helper through `GIT_CONFIG_COUNT`/`GIT_CONFIG_KEY_n`/`GIT_CONFIG_VALUE_n` (`credential.helper` set to `!'<gh.exe>' auth git-credential`) without editing any config file. Pushing is outward-facing: get the user's approval first.
- formicarium is developed from a fork: `origin` is `Marukome0743/formicarium` and `upstream` is `aletheia-works/formicarium`. Push one short-lived bookmark per change to `origin` and open the PR against `upstream` `main`. `main` takes signed commits, the required checks and squash merges only, and commitlint checks the squash title `<PR title> (#N)` at 100 characters.

## Tests and measurements

- Sources are TypeScript; `bun run build` emits the `.js` files next to them, and the commands below run that output. `bun run test:light` is the test step of the CI quality job.
- Node.js regression: `node --test --test-concurrency=1 tests/node/build.test.js tests/node/runner.test.js tests/node/probe.test.js tests/node/session.test.js tests/node/aube-1645.test.js tests/node/pitchfork-basic.test.js`, the same list as CI's node suite; `tests/node/measure.test.js` checks the timing record format and runs on its own (`bun run test:measure`). Browsers: `bun run test:browser` (probe, aube #1645 and pitchfork-basic in Chromium, Firefox and WebKit; `bun run test:browser -- --repeat-each=3` for the repeatability check). Run suites one at a time.
- pitchfork: build with `mise run build-guests pitchfork` (never rebuild aube for it; about 35 minutes cold). The release build first builds the web UI with `dist/guests/aube` on the latest Node image, and `dist/guests/pitchfork.build-info` records the UI node version; pitchfork's source is not patched. If wslc fails with `E_FAIL`, set `FORMICARIUM_CONTAINER=docker`. Make the baseline with `mise run native-baseline pitchfork-basic --check-reproducible`, then run `node --test tests/node/session.test.js`, `node --test tests/node/pitchfork-basic.test.js` and `bun node_modules/@playwright/test/cli.js test tests/browser/pitchfork-basic.spec.ts`. `mise run pitchfork-probe-paths` lists, natively, the paths each pitchfork command writes. Guests, guest env and sessions live only in `runtime/registry.ts`; `scripts/session-info.ts` hands one session to the shell scripts.
- Never relax the quality limits: 600 s per probe run, 840 s per aube #1645 run in the browser, one worker, no retries, all 8 probe items passing, aube output identical to the native baseline, and the 1 GB wasm memory cap pinned by `tests/node/build.test.ts`.
- Probe regression items run only when named: `futex-deadline`, `page-fault-race`, `madvise-dontneed`. Add a new one the same way when a core defect is found, and confirm it passes natively in a Linux container before trusting it.
- Measure with `node scripts/measure-aube.js --trials 10` with nothing else heavy running. The same host computation varies up to 2.4x on this laptop, so the script records `hostBenchMs` per trial; check it before attributing a slowdown to code. Compare variants by alternating them (ABBA) and use a rank test rather than eyeballing three runs.
