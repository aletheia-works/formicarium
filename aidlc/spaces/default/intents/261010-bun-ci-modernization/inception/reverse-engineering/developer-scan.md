# Focused Reverse Engineering — Bun / CI Modernization

## Developer Code Scan Results

### Scan Coverage
- **Analyzed deeply** (configuration/command contracts, not runtime behavior):
  - .github/
  - package.json
  - package-lock.json
  - mise.toml
  - .gitignore
  - blink.lock
  - playwright.config.ts
  - biome.json
  - tsconfig.json
  - tsconfig.tests.json
  - scripts/emit.ts
  - scripts/playwright-build-config.ts
  - scripts/lib/node.sh
  - scripts/package/stage-package.ts
  - scripts/package/verify-package.ts
  - scripts/ci/run.ts
  - scripts/ci/verification.ts
  - scripts/release/workflow.ts
  - scripts/release/publication-cli.ts
  - tests/package/tooling.test.ts
  - tests/package/types.test.ts
  - tests/release/workflow.test.ts
  - tests/package/playwright.config.ts
  - tests/terrarium/playwright.config.ts
  - tests/guest-distribution/playwright.config.ts
  - OUTCOMES.md
  - docs/architecture.md
  - docs/nfr-summary.md
  - docs/results/failures.md
  - docs/decisions/
- **Skimmed only**:
  - runtime/ (prior background only; no implementation reanalysis)
  - scripts/package/coverage.ts and scripts/terrarium/coverage.ts (targeted import/flag/receipt searches)
  - scripts/build-blink-wasm.sh, scripts/build-guests.sh, scripts/native-baseline.sh (targeted build/runtime searches)
  - tests/node/, tests/browser/, tests/package/, tests/terrarium/, tests/release/, tests/guest-distribution/ (inventory plus selected deep files above)
  - tests/ci/verification.test.ts (selected assertions)
- **Left out**:
  - AI-DLC harness installation and runtime directories
  - .vendor/, node_modules/, dist/, target/, .build/, .artifacts/, test-results/, playwright-report/
  - Generated .js/.js.map and core/guest compiled bytes (not enumerated for source analysis)

### Packages Found
- @aletheia-works/formicarium 0.1.0-rc.1 — private root authoring package — TypeScript/ESM — Node/browser public runtime with exports and assets.
- External reference only: terrarium package and vivarium MCP/wasm/docs package manifests use Bun locks; no formicarium package migration has occurred.

### Build System
- **Type**: npm scripts + strict TypeScript compiler + emitted JS placement + Bash/container assets.
- **Config Files**: package.json, lock v3, mise.toml, tsconfig*.json, biome.json, four Playwright configurations.
- **Build Dependencies**: npm install→tsc production/tests→scripts/emit→Node/browser execution. emit.ts:1–3,15–27 uses node:module.stripTypeScriptTypes to preserve classic worker. Package staging requires core provenance; full candidate verification requires SHA-pinned guest/owner inputs.
- Scope expansion required and obtained before reading root playwright.config.ts/biome.json/tsconfig*.json. Earlier .mjs paths are obsolete historical context.

### APIs Discovered
- Package exports: six entries in package.json, types + public/Node/browser and asset subpaths.
- Publication CLI commands: prepare/validate/plan/fetch/gate/publish/release in scripts/release/publication-cli.ts. Context and approvals checked before executor.
- CI manifest/check interfaces: scripts/ci/verification.ts:71–158,196–282; source/file digests, 9 checks, >=80% coverage/skip0, 46 fresh receipts.

### Frameworks & Libraries
- TypeScript 7.0.2, Biome 2.5.15, Playwright 1.63.0, Istanbul coverage 3.2.2/instrument 6.0.3; development-only manifest/lock declarations, not installed-version observation.
- Node >=24 in engines; mise node24. Candidate verify uses Bun1.4.2 already for terrarium collection, but dependency install remains npm ci.
- Root Bun pin/packageManager/bun.lock are absent in scanned configuration.

### Test Coverage
- **Test Directories**: node, browser, package, guest-distribution, terrarium, release, ci.
- **Test Frameworks**: Node node:test + Playwright; external owner Bun lane inside candidate verification.
- **Coverage Config**: Istanbul instrumentation and same-candidate Worker/realm receipt validation exist; scripts/ci/run.ts:283–388 connects U1/U3. npm unit script intentionally skips two name patterns, whereas release assurance requires skip0.
- No test/build execution in this scan. Bun runtime/runner/coverage compatibility remains 未検証.

### Code Quality Indicators
- **Linting**: Biome recommended, formatting/import ordering. strict TS config. Historical claims “no lint/CI/types” are superseded in focused sections.
- **CI/CD**: verify.yml fork-only codex/verify branch, timeout360; publish.yml exact two tags and public repo, verify→publish→release with least job permissions and SHA actions. No routine PR/main workflow.
- **Documentation**: OUTCOMES current-toolchain addendum, architecture, ADR0001–0012, NFR/failures; templates/CODEOWNERS already exist.

### Technical Debt Signals
- CI specialized to immutable candidate inputs, not ordinary PR checkout. New lightweight checks must not silently inherit these required external inputs.
- Node flags/process.execPath/node:module and worker/preload collectors make global Node→Bun text replacement unsafe; package-manager and Node product compatibility boundaries need requirements.
- Publication validator hardcodes exact tags/run commands; scripts/release/workflow.ts:11–33 and tests/release/workflow.test.ts reject altered structure. Any modernization must retain failure-before-executor behavior.
- Existing Dependabot handles npm/cargo only, not Actions; sibling Bun + Actions update patterns provide references.
- Existing verify actions use version tags while publish actions use commit SHAs. Requirements should decide shared policy.
- Container/core/guest build changes are outside this tooling focus; frozen public RC acceptance remains separate.

## Reference Repository Evidence
References were read only and do not widen analyzed paths:
- terrarium/.github/workflows/test-lint-check.yml:3–34 and test-terrarium.yml:3–52: PR/main, contents read, concurrency cancellation, pinned checkout/mise, frozen Bun install→typecheck/test/build.
- terrarium/mise.toml: tools/deps/tasks; packages/terrarium/package.json scripts gen/build/test via Bun with Node/Bun engines. Local manifest uses a file tarball integration dependency; do not copy its path.
- vivarium/mise.toml: Bun deps + local CI/lint task parity; .github/workflows/test-mcp.yml PR frozen install/test.
- terrarium/.github/dependabot.yml:3,18 and vivarium/.github/dependabot.yml: Bun and GitHub Actions ecosystems.
- terrarium/.github/workflows/commitlint.yml, labeler.yml, assign.yml, dependency-review.yml: shared reusable commitlint and metadata-oriented maintenance. Metadata pull_request_target must not execute untrusted head code.
- terrarium/.github/workflows/lint-autofix.yml and lint-autofix-apply.yml: patch artifact then writeback with secret token/stale-head checks; needs separately defined permission/scope, not unconditional adoption.
- terrarium/.github/workflows/dependabot-auto-merge.yml: nonmajor auto-merge depends on repo controls; no requirement or authorization to copy as-is.
- terrarium/.github/workflows/publish-terrarium.yml and vivarium/.github/workflows/publish-mcp.yml: Bun development commands but npm OIDC CLI via bunx. Comments about current OIDC support are document evidence only, not independently verified platform facts.
- Terraform/Pages/reproduction/JSR-specific behavior is not a formicarium requirement.

## Handoff Summary
- **Intent-relevant finding**: Ordinary PR/main CI is missing despite existing Biome/typecheck/test commands (.github/workflows/verify.yml:1–33, package.json scripts). Bun dependency-management alignment is directly achievable as a tooling intent, but full runtime/test migration needs measured compatibility evidence.
- **Risks / follow-up**: Preserve frozen RC and original source; separate Bun tooling from Node product compatibility and npm OIDC executor. Preserve fixed inventory, source/SHA binds, fresh receipts, skip accounting, coverage threshold, probe600s/aube840s/oneworker/no retries/1GB/core boundary/Atomics.waitAsync/JIT deferral (ADR/NFR document evidence). Real Safari remains unverified.
- Candidate: aidlc/spaces/default/intents/261010-bun-ci-modernization/.aidlc-engine/codekb-stage-formicarium/ (9 focused merge artifacts).
- Parent owns codekb publication, pipeline receipt, diary and lifecycle routing. No source edits or external writes.

