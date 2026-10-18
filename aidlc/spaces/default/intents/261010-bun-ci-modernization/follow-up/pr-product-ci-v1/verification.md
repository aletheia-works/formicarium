# PR product CI and latest Bun tooling

Date: 2026-10-11 JST
PR: https://github.com/aletheia-works/formicarium/pull/11
Head: 0864d3abf118ae0ebfcdcb6a9a6099e8b01d7c99 (GitHub signature verified)
Run: https://github.com/aletheia-works/formicarium/actions/runs/38104695658

## 検証済み: local verification

- Bun 1.4.3 / Node 26.11.1: frozen dependency installation, build, typecheck, lint, light tests succeeded. 91 Bun unit/tooling, 106 Node consumer, 76 Node publication tests pass; 2 existing asset skips. Log: /private/tmp/formicarium-bun-default-final-tests.log.
- Development server runs with Bun, responds HTTP 200, and sends COOP/COEP/CORP headers.
- Bun 1.4.3 runs Playwright 1.64.0 and its development server against newly downloaded Chromium 156.0.8078.4: probe all-items browser test passes (1 passed, zero retries). Log: /private/tmp/formicarium-bun-browser-smoke.log. This is a local smoke check, not full three-browser CI acceptance.
- Linux amd64 probe rebuilt from source; BSF zero/nonzero control observations and PASS bsf-zero confirmed outside wasm. Rebuilt probe on Node wasm: 15 tests pass, zero skips/failures. Log: /private/tmp/formicarium-probe-repair-node.log.
- Official node:current-alpine binary starts inside the Rust Alpine container and reports v26.11.1; no UI Node 24 pin remains.
- actionlint passed for modified workflows. Shell syntax check passed for build-guests.sh. Existing lint warnings and the existing SC2054 linker-flag warning are recorded in the PR.
- PR body template sections and exact pushed head verified through the GitHub connector.

## 検証済み: previous product run and repair

Run 38103370481 at 050f528b114e21e9df47c35629e1bb731be7020f built the wasm core and all guests from source, including unpatched pitchfork. Native reproducible aube and pitchfork baselines matched the committed oracles. Node product tests: 53 pass, 1 failure because the tracked bsf-zero test had no corresponding probe command in main's guest source. This is a failed run, not a full acceptance.

Artifact 11689450056 (compiled products ZIP) SHA256 f1f52d946823850e96e607f9d93156abe8010e4bf36d87114810ca93577895d9 independently matches the GitHub API digest. Its wasm output was used only for local probe repair verification; current PR CI rebuilds its own products.

The repair includes only the missing BSF probe module/dispatch from the local working tree, excluding unrelated madvise changes. CI now verifies the BSF command natively before trusting wasm execution. Test requirements were retained.

## 検証済み: final serial CI

Run 38104695658 at 0864d3abf118ae0ebfcdcb6a9a6099e8b01d7c99 completed successfully. The quality job took 42 seconds; the product job took 1,814 seconds (30m14s). Product Node tests: 54 passed, zero failures/skips. Chromium/Firefox/WebKit: 36 passed, one worker and zero retries. Native BSF and reproducible aube/pitchfork baselines succeeded.

Observed product step timings: wasm 37s, probe 13s, aube 771s, pitchfork 768s, native baselines 6s, Node tests 19s, browser installation 61s and browser tests 71s. Log: /private/tmp/formicarium-serial-ci.log; job/step timestamps: /private/tmp/formicarium-serial-ci-metrics.json. These are individual observed timings, not a controlled performance benchmark.

Artifact 11689812404 ZIP SHA256 5d779a35d0368c926a12cdd4540f566a87449219a2e161617f8287070ba1c284 matches the GitHub API digest. All wasm/guest product members are present; pitchfork.build-info records ui-node=v26.11.1 and contains no patch metadata. Archive: /private/tmp/formicarium-serial-products.zip.

PR #11 was subsequently merged by the user. CI matrix/cache improvements are a separate PR #12 based on main 143a253c8e4d756b6eb13d73f16024a5770a3bf1.

PR #12 head 460a97615177cfa1c50e4b821655a07d86adf5ad contains only ci.yml and README changes. Connector PR creation returned 403; the user explicitly approved GitHub CLI creation. The CLI-created PR is attached to this chat and its required body sections/head SHA were verified through the connector. Earlier runs were superseded by documentation/timeout and isolated Node source-check preparation corrections, not acceptance runs.

## 検証済み: PR #12 matrix and cache execution

Final-head run 38107093510 attempts 1 and 2 both succeeded. Product critical-path duration (earliest build job start through product-tests completion): attempt 1 1,639s (27m19s), attempt 2 119s (1m59s). The previous serial product job took 1,814s (30m14s). These are observed workflow durations, not controlled CPU benchmarks. Attempt 1 rebuilt wasm/aube/pitchfork; probe reused the same-input cache from a superseded attempt, so it was not a fully empty-cache run.

Both attempts executed native BSF, reproducible aube/pitchfork baselines, Node 54 tests (zero failures/skips), and 12 tests per browser (36 total). All quality/commit/product/required checks succeeded. Quality retained 71 Bun unit + 20 Bun tooling + 106 Node consumer + 76 Node publication passes and 2 existing light-test asset skips. Logs and timestamp JSON are /private/tmp/formicarium-matrix-first-ci.log, /private/tmp/formicarium-matrix-first-metrics.json, /private/tmp/formicarium-matrix-warm-ci.log and /private/tmp/formicarium-matrix-warm-metrics.json.

Attempt 2 logs show exact cache hits for wasm, probe, aube and pitchfork. All corresponding build steps were skipped, while native and regression checks still succeeded. Resolved Emscripten/Rust/UI image cache identities matched attempt 1. Most repeated-run savings came from product caching; independent test matrix jobs reduce the regression phase without adding workers/retries inside a job. Compiler or input changes invalidate the matching cache.

Final compiled product artifact 11691321083, name compiled-products-460a97615177cfa1c50e4b821655a07d86adf5ad-38107093510-2, downloaded ZIP SHA256 b2b7a0f5f3a80927e681f2dabc4f214a90c489da73309467161a280425b2887f independently matches the GitHub API digest. Complete wasm/guest products exist; core pin a882fb2f3df14115b7e46f6812fb296eef5934d7 is clean, pitchfork metadata has no patch and records UI Node v26.11.1. Wasm/probe bytes match separately downloaded attempt-1 artifacts. Archive: /private/tmp/formicarium-matrix-warm-products.zip. Attempt-1 compiled artifact was listed by API but unavailable after rerun; no downloaded-digest claim is made for that archive.

Ordinary receipt artifact 11690876456 ZIP SHA256 58cf547fbdf7170c246f761fa7cd735fd492d7d48efc6db5048eb2da09457fbe matches the API digest. Receipt source SHA, run ID 38107093510, attempt 2 and successful quality/product-tests/commit-format outcomes match independent run/job metadata. Bun's nodeCompatibility field is a Bun compatibility value, not the installed Node test runtime version.

The first rerun command was denied because gh was active as Marukome0743. Switching to the previously authorized JamBalaya56562 account allowed rerun. The agent performed no main merge or npm operation. GitHub independently confirms JamBalaya56562 merged PR #12 at 2026-10-11T03:31:07Z, creating main commit c3ea82a4bab15076bb4985369eff7d94e10c5820. Both verified attempts above execute the PR source SHA; the separate main push run is verified below.

## 検証済み: main CI, branch cleanup and fork synchronization

At the user's explicit request, main push run 38108643640 for c3ea82a4bab15076bb4985369eff7d94e10c5820 was observed completed/success with all 11 jobs successful. Native BSF and reproducible aube/pitchfork baselines passed; product Node 54 tests and Chromium/Firefox/WebKit 12 tests each passed (36 browsers total, no product failures/skips). Full logs: /private/tmp/formicarium-main-matrix-ci.log; run/job timestamps: /private/tmp/formicarium-main-matrix-metrics.json. Main performs its initial product builds because PR merge-ref caches cannot be restored by the base branch; this follows GitHub's cache-scope restrictions, https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching.

After success, jj deleted the local and origin bookmarks codex/build/pitchfork-unpatched, codex/ci/pr-product-tests and codex/ci/product-matrix. Connector readback confirms only the two historical CI input branches remain under origin's codex/ prefix. Fork main was fast-forwarded from 84e8995f300d9123dd8fcc2b250b62dd5bc7d8f0 to c3ea82a4bab15076bb4985369eff7d94e10c5820 (three commits). Independent remote ref readback shows upstream and origin main at the identical SHA; the fork's imported commit signature is GitHub Verified. No signing policy was changed. Fixed input branches, including the upstream RC and modernization inputs, were retained.

## 未検証: remaining execution

Current main's refreshed candidate verification remains pending new source-bound inputs. Successful ordinary main CI is distinct from candidate verification and does not imply its completion. npm publication is not authorized by the PR verification approval.

## Publication trust boundary

Automatic approval review rejected changing the fixed trusted publication toolchain identity to a moving latest identity, because that would alter the release-integrity boundary beyond CI modernization. Trusted publication policy/evidence remain unchanged. CI runtime selectors and Bun developer commands were updated without that change.

This is follow-up evidence; completed AI-DLC stage state and generated memory diaries are preserved.
