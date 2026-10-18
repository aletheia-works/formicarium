## Developer Code Scan Results

### Scan Coverage
- **Analyzed deeply**: ./ (full rescan, Standard). Runtime/public declarations、state/lifecycle/IPC/core/IO、Node/browser legacy/public adapters、integration guest distribution、build/static staging/native baselines、toolchain、CI/release/maintenance boundaries、tests/coverage/oracles、guest probes/diagnostics、fixtures/patches、authored root/config/docsをsystemの責務・依存・API・検証関係として分析した。9artifactのowning inventories参照。全行のセキュリティ監査ではない。
- **Skimmed only**: none outside declared source-system coverage. Historical measurement recordsはdocumentary contextとして読み、現候補の合格と同一視しない。
- **Left out**: .vendor/, node_modules/, dist/, .build/, target/, assets/compiled core, .artifacts/, test-results/, playwright-report/, IDE/tool caches, generated .js/maps; .codex/.claude/.agents installs and aidlc workspace (context/artifact destinations reading excepted)。 sibling repos内部はsnapshot範囲外。

### Packages Found
- @aletheia-works/formicarium — ESM runtime library + development PoC — TypeScript — staticmusl guest execution. package.json private=true / 0.1.0-rc.1。
- formicarium-guests — Rust2021 private package0.1.0 — probe/hello/exit3 native test ELF。
- fixture local packages — authored test data — JSON/text — aube local dependency and pitchfork configuration oracles。
- No root workspace declaration/server framework/database.

### Build System
- **Type**: Bun1.4.2 tasks, Node24.21.0, TS7.0.2 emission; Bash Emscripten/container native builders.
- **Config Files**: package.json, bun.lock, mise.toml, tsconfig.json, tsconfig.tests.json, biome.json, playwright.config.ts, blink.lock, guest/probe/Cargo.toml and Cargo.lock, .github/workflows/.
- **Build Dependencies**: TS→generated JS only. blink.lock→core fetch/configure/make/link→dist/blink→package stage; guest source→musl ELF→distribution stage. pitchfork UI requires existing aube/Node24/patch. native baseline reads registry→session-info and same fixture/guest. Candidate workflow requires digest-bound external archive plus owner modules; not fresh guest builds.

### APIs Discovered
- Public ESM — package.json exports six paths; types/index.d.ts:75 Session seven methods, environment createSession and root byte/errors helpers.
- Internal run IPC — runtime/protocol.ts:11 protocolVersion1; identity/sequence/aggregate/snapshot.
- Internal development CLI/UI — runtime/node/run.ts and web app/session allowlist; static GET/HEAD server.
- Integration resolver — integration/terrarium/guest-distribution/resolver.ts:152 resolveGuest; aube/pitchfork only, verified asset/provenance/fixture, no execution.
- Local producers/automation APIs — stageDistribution, stagePackage, candidate/source/coverage verification, publication and maintenance boundaries; see api-documentation/component-inventory.

### Frameworks & Libraries
- No application backend framework/runtime npm dependency. Dev versions in technology-stack.md: Bun1.4.2, Node24.21.0, TS7.0.2, Biome2.5.15 declaration, Playwright1.63.0, Istanbul, Rust/libc/rayon/tokio, Emscripten.
- Core pin blink.lock:a882fb2f3df14115b7e46f6812fb296eef5934d7; max1GB/interpreter+pthreads. Generated core/vendor left unopened.

### Test Coverage
- **Test Directories**: tests/node, browser, package, guest-distribution, terrarium, release, ci, tooling, safari, shared and authored fixtures.
- **Test Frameworks**: node:test/assert, Playwright, strict TS consumer fixtures, Python unittest, Safari WebDriver script, native container baselines.
- **Coverage Config**: package fixed14/80%, integration fixed3, owner composed24 and realm receipts; scripts/{package,guest-distribution,terrarium}/coverage.ts. Percentages/pass counts not measured this scan.
- Current tests/browser/aube-1645.spec.ts:29 deadline840000; tests/node/probe.test.ts:23 deadline600000; Playwright worker1/retry0; scripts/build-blink-wasm.sh max1GB. Fresh runs未検証.

### Code Quality Indicators
- **Linting**: Biome recommended, strict TS; declared source/task guards.
- **CI/CD**: ordinary quality/trusted-base format; separate heavy manual candidate; legacy fork verify; evidence-bound publish verify/writer; maintenance acquisition/policy/recheck. Local trusted policies writerEnabled=false and null workflow/producer IDs.
- **Documentation**: ADR0001–0012 and known failures/historical observations explicit; README private RC/no-published text stale against supplied public release evidence. Current checkout is not silently relabelled public0.2.1.

### Technical Debt Signals
- runtime/validation.ts:210 validateElf duplicates integration resolver.ts:97 validateGuestElf; FsEntry fixture/state contracts separate.
- runtime/session.ts limited selected tool/cat/rm parser isn't public common command layer; no install/ls/cd dispatch.
- integration manifest.ts:5 onlyaube/pitchfork; resolver fetch redirect:error; fixture/cwd tool-specific assumptions; no Biome/download-decompression progress/install state yet.
- scripts/build-guests.sh defaults and cache refs differ from test/prepared-input versions; builder key not tool/repository/40digit commit/builder hash.
- scripts/ci/run.ts imports owner coverage and materializes terrarium inputs; source/coverage/archive dependency must move with runtime consumer.
- Fixed inventories duplicated package/release/coverage collectors; long core/coverage/evidence modules. Opportunity only, no unsolicited refactor.
- Current core shape preserves hardlink inode across snapshot, unlike historic ADR explanation; preserve source contract.
- Real Safari, Release CORS/phase timings/fixedcommit build reuse未検証; private file-backed MADV_DONTNEED limitationdocumented.

## Handoff Summary
- **Intent-relevant finding**: 公開Session API already has isolated run/filesystem/cleanup primitives (types/index.d.ts:75; runtime/lifecycle.ts), while command parser/guest-distribution are outside package exports. New APIs need export/types/inventory and consumer tests; moving files alone won't implement install. Existing sameorigin Worker and checked-loader ownership must survive browser bundling.
- **Risks / follow-up**: source/public release uncertainty; old archive/owner evidence dependencies; fixed vs latest provenance/version differences; no compiled/core/vendor inspection or test execution; outside formicarium no fullcoverage claim. Preserve phase0/tinyBiome trial gates, regression quality, approval before publication/retirement.
- **Synthesis**: nine candidates at <record>/.aidlc-engine/codekb-stage-formicarium/. Comparison COVERS; timestamp fingerprint minted from ./; final VALID evidence returned separately. Main conductor owns receipt/publication/gate.

