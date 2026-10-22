# Repository development rules

- Use Jujutsu (`jj`) for repository operations. Quote `@` in PowerShell (`jj log -r '@'`). Fetch with `jj git fetch --all-remotes` when needed.
- Resolve mise-managed executable paths under `~/AppData/Local/mise/installs/<tool>/*/` (directly or in `bin/`), without hardcoding versions. Do not use `mise exec` or shims. Use `mise run <task>` for declared tasks. Check `mise ls` before declaring a tool unavailable.
- Prefer wslc for simple container work; fall back to Docker Desktop for complex or unsupported operations. Never benchmark under concurrent background load.
- Correctness claims require observed commands/output, named test results, or specific log lines. Label claims 検証済み / ドキュメント根拠 / 推測; explicitly mark unverified claims 未検証.
- For review feedback, turn the claim into a falsifiable sentence and verify it before replying. Replies must be at most five lines. Obtain the user's approval before posting a rebuttal; agreeing and fixing needs no extra approval.
- Keep fixes within the requested scope. If verification cannot be run, mark it 未検証 and provide concrete verification commands.

## Team practices

These were affirmed by the user; the background of each piece of work is in `docs/history/`.
- **Branches**: `main` is the integration branch. Work on short-lived bookmarks and merge them after review, keeping one change per piece of work so its history and reasoning stay together.
- **Tests**: write tests after implementing each testable layer. For a bug fix, first watch a reproduction test fail, then fix it and see the same test pass. Keep line coverage at 80% or more on the first-party distributed JS and run CI before merging; count files that were never executed in the denominator, list every exclusion with its reason, and never move an exclusion to reach the threshold.
- **Guests**: do not rebuild aube when its source has not changed; reuse `dist/guests` (an aube build takes over an hour). Rebuild the probe whenever it changes.
- **Releases**: publish `@aletheia-works/formicarium` to npm and GitHub Releases only after the user approves the version, starting from the version tag. RCs go to the `next` dist-tag and stable versions to `latest`. If a release is defective, stop further publishing and point users to the last good version. Never create repositories, push or publish without the user's approval.
- **Code style**: follow the existing ESM, camelCase, UPPER_SNAKE_CASE constants, PascalCase classes, purpose comments, and the split between Node, browser and shared code. Do not promote every internal export to the public API. Invalid input throws; a normal guest exit is an `exitCode`; a host or core failure throws with its cause.
- **Scope**: do not mix unrelated improvements, renames or whole-file reformatting into a fix.

## Project state (2026-10-05)

- The blink-on-wasm proof of concept is complete (`docs/history/261003-blink-wasm-poc.md`). Before changing anything, read `OUTCOMES.md` (handover), `docs/architecture.md`, `docs/decisions/` (ADRs 0001–0012), `docs/nfr-summary.md`, and `docs/results/failures.md` (open items, fixed defects, investigations).
- The emulator core is the `aletheia-works/blink` fork (`formicarium-wasm` branch) pinned in `blink.lock`. It will be replaced by paludarium (a Rust blink, separate repository); keep core-specific knowledge in `runtime/core.mjs` only (ADR 0003).
- JIT work is deferred and must not be proposed for the C fork unless the user reopens it (ADR 0002, `docs/results/jit-decision.md`).
- Open items: real Safari on macOS is unverified (WebKit stands in), timings were taken on one laptop with the page in front only, and a private file-backed page does not revert to file contents on `MADV_DONTNEED`.

## Working notes for agents

- Run builds and tests from the main session, one at a time, and report a refused command instead of working around it.
- In Git Bash, `/work`-style guest paths given to `runtime/node/run.mjs --copy-in` are rewritten to Windows paths; prefix the command with `MSYS_NO_PATHCONV=1`. A syscall trace on Node.js needs both `--core-flag -s --core-flag -e`; in the browser add `&core-flag=-s` to the URL.
- PowerShell refuses `-File` scripts under this machine's execution policy. Pass the script with `-Command` instead; never change the policy.
- wslc fails on this machine (ERROR_SHARING_VIOLATION); `scripts/lib/container.sh` falls back to Docker on its own.
- The fork copy `.vendor/blink-src` is jj-colocated. Run `jj new` before editing so changes never land in an already pushed commit, build it with `BLINK_SRC=.vendor/blink-src bash scripts/build-blink-wasm.sh`, and keep a copy of each diff in `patches/`. Publishing means pushing `formicarium-wasm`, updating `blink.lock`, and rebuilding cleanly so `blinkSourceDirty` is false. Pushing is outward-facing: get the user's approval first. HTTPS credentials and SSH keys are not available to non-interactive shells here; pass gh as a one-off credential helper through `GIT_CONFIG_COUNT`/`GIT_CONFIG_KEY_n`/`GIT_CONFIG_VALUE_n` (`credential.helper` set to `!'<gh.exe>' auth git-credential`) without editing any config file.
- formicarium itself has no remote yet, and the user chose not to create one; do not push it. Work is committed with jj on the `blink-wasm-poc` bookmark.

## Tests and measurements

- Node.js: `node --test tests/node/build.test.mjs tests/node/runner.test.mjs tests/node/probe.test.mjs tests/node/aube-1645.test.mjs tests/node/measure.test.mjs` (41 tests on 2026-10-05). Browsers: `npx playwright test tests/browser/probe.spec.mjs tests/browser/aube-1645.spec.mjs` (33 tests; add `--repeat-each=3` for NFR1). Run suites one at a time.
- pitchfork (`docs/history/261005-pitchfork-on-blink.md`): build with `bash scripts/build-guests.sh pitchfork` (never rebuild aube for it; about 35 minutes cold). The release build first builds the web UI with `dist/guests/aube` on node 24, and applies the one-line musl type patch `patches/pitchfork-2.29.0-musl-ioctl.patch` (the only change to pitchfork's source, approved by the user); `dist/guests/pitchfork.build-info` records the patch sha256 and UI node version. If wslc fails with `E_FAIL`, set `FORMICARIUM_CONTAINER=docker`. Make the baseline with `bash scripts/native-baseline.sh pitchfork-basic --check-reproducible`, then run `node --test tests/node/session.test.mjs`, `node --test tests/node/pitchfork-basic.test.mjs` and `npx playwright test tests/browser/pitchfork-basic.spec.mjs`. `bash scripts/pitchfork-probe-paths.sh` lists, natively, the paths each pitchfork command writes. Guests, guest env and sessions live only in `runtime/registry.mjs`; `scripts/session-info.mjs` hands one session to the shell scripts.
- Never relax the quality limits: 600 s per probe run, 840 s per aube #1645 run in the browser, one worker, no retries, all 8 probe items passing, aube output identical to the native baseline, and the 1 GB wasm memory cap pinned by `tests/node/build.test.mjs`.
- Probe regression items run only when named: `futex-deadline`, `page-fault-race`, `madvise-dontneed`. Add a new one the same way when a core defect is found, and confirm it passes natively in a Linux container before trusting it.
- Measure with `node scripts/measure-aube.mjs --trials 10` with nothing else heavy running. The same host computation varies up to 2.4x on this laptop, so the script records `hostBenchMs` per trial; check it before attributing a slowdown to code. Compare variants by alternating them (ABBA) and use a rank test rather than eyeballing three runs.
- The browser run worker deletes `Atomics.waitAsync` before loading the core (ADR 0009); keep that line, since WebKit otherwise stalls.
