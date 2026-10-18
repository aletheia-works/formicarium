# U3 Main Verification — 2026-10-08

## Input and repository identity

検証済み: human `Approve Plan` was recorded with native `PLAN_APPROVAL_RECORDED`; U3 native `UNIT_STARTED` at 2026-10-08T09:01:30Z. Testing contract hash ce013e1551c9c06de1a756c04942d606c8dffe82caf0ae8422f95df28968c638 is unchanged. No guard was lowered, no Stop registration restored, and no external publication performed.

Host `jj status` observed clean terrarium before changes, working change 8912213a, parent `0aa94fde1e33230efb96e8763f0fa811ce1cdd80` (main). The older 60dd0dc plan baseline is historical; it is not the current baseline. Main uses jj, direct mise-managed executables and declared mise tasks, with tests serially. Bun 1.4.2 was confirmed by `mise ls`. Node 24 is used in formicarium; terrarium task environment includes its managed Node 26.9.0.

New local inputs `.artifacts/u3-inputs-repair-v1` are built from unchanged U1 v8 tgz/manifest, U2 `site-repair-v1` and officially emitted U2 resolver JS. `verification/prepare-current-inputs.mjs` checks tgz digest, copies all 16 input files and records `current-input-descriptor.json`. Original sibling descriptor, including old distributed archive provenance, is preserved at `previous-input-descriptor.json`; it is not reused as new provenance. Local tools defaults remain explicit validation defaults, not a recovered original catalogue.

Native sibling `prepare-formicarium.mjs --from <new input> --output /Users/mutoakio/Documents/terrarium/.vendor/formicarium-inputs-repair-v1` succeeded, validating all 16 files. Normal Bun install updated the ordinary local tarball dependency; subsequent `bun install --frozen-lockfile` succeeded. Bun lockfileVersion remains 1. Installed tgz SHA256 is `ebe7e5cf6efcd26914e9016ebbd31df1d59812f5cfcfc71b874672c01109dc35`. Normalized descriptor SHA256 is `396cd5552bf09beea42e0769701e0be43faf566a7bf6f91092d19d420c41a855`. No installed/generated product files were directly repaired: source edits are emitted or formally staged.

## Observed Red and Green

- Runner readiness: direct Bun `test tests/catalog.test.ts` from terrarium package: 12 pass, 0 fail.
- Before correction, formal formicarium builds (`tsc -p tsconfig.json`, `tsc -p tsconfig.tests.json`, `.build/scripts/emit.js`) succeeded, then Node U3 tests: 18 pass, 1 fail; actual package file count 24 differed from old assertion 23. Assertion was corrected to the fixed `PACKAGE_FILES.length`.
- Actual `stageFormicarium` with U1 v8 installed package/manifest, repaired U2 guest site and emitted resolver failed before writes: `invalid package identity`, stage-formicarium.mjs:56. Source producer still expected old runtime13 `.mjs`. After source inventory/URLs were updated to runtime14 `.js` (including contracts), native `stage-formicarium.mjs --check` succeeded with exact installed bytes. Generated blink.mjs remains unchanged.
- Sibling formal `mise run terrarium:formicarium-unit`: Red 26 pass, 1 fail (catalog expected worker `.mjs`, actual `.js`); matching test expectation corrected; Green 27 pass, 0 fail, 149 assertions.
- Sibling formal `mise run terrarium:formicarium-build`: exit 0, package typechecks and assembly; exact package24/resolver3 assets and all aube2.6.1/2.7.0 plus pitchfork2.30.0 refs were staged. Site: `.vendor/site-formicarium`.
- Full sibling `mise run terrarium:formicarium-e2e`, workers1/retries0, three browsers: Red 35 pass, 10 fail in 3.2min. Four accepted iframe cases reached real guest-marker creation but old `.mjs` request monitoring counted zero. Six pitchfork/switch expectations still required2.30.1 but fixed input is2.30.0. Source test corrections preserve titles, case counts, marker/nonexecution oracles, timeouts and isolation requirements. Red traces/screenshots retained at `.artifacts/u3-browser-red-repair-v1`.
- Collector regression Red: coverage test 8 pass, 1 fail; actual originalGeneration was hardcoded u1-coverage-v9 instead of bound report directory u1-coverage-v11. Corrected collector records validated absolute original report path and its generation directory, maintaining immutable digest/pack/source/realm checks.
- Following fixes, formal three build steps succeeded; Node U3 tests 19 pass, 0 fail; Biome nine specified U3 TS files succeeded after formatting one new assertion. No thresholds changed.
- Bridge consumer Red (Chromium pitchfork only): `no build "v2.30.1" ... published: v2.30.0`. Fixed pinned ref/output to2.30.0. Full bridge consumer Green: 6 pass in36.1s across Chromium/Firefox/WebKit, workers1/retries0, actual installed package and uninstrumented staged site.
- Additional identity Red: `prepareIntegration` supplied current observed jj parent0aa94fde... but returned hardcoded60dd0dc...; assertion failed. Repair/Green pending at this entry's writing.

## Current measurement generation

Input: `verification/current-coverage-input.json`; fresh output `.artifacts/u3-coverage-repair-v2` (exclusive creation). Native collector prepare succeeded; fixed inventory24 retains U1 fourteen/U2 three/U3 seven without shrinking. Generation `e0ed4541-cb8a-46de-815c-d4ffca9a837a`, sourceIdentity `26cc8d1960fb1bd60147cea98e9ecbad68bf114088d30f9fc7796a8230360c24`, candidate SHA256 `711ea20e91ca7cb2e5aa9b91b5dbd3d2e2dbfbfb4aeda40702197449a72f0d4d`.

U1 immutable component import uses `.artifacts/u1-coverage-v11/coverage-report.json`: verified same tgz SHA256, threshold80, passedtrue, 14 files, 1253 original realm names. It is explicitly an imported prior component measurement, not a fresh U1 run. Source and statement maps were validated by prepare.

Native measured Node collector command used fresh output + direct Bun + FORMICARIUM_INPUTS_ROOT; 27 pass, 0 fail, fresh observed exit0 and attempt ccbc1b28-db63-4465-9ef4-e6e8477ff538. Instrumented Bun browser bundle generated successfully (19modules). Full45 measured browser run and final threshold report are pending at this entry's writing; no coverage success is asserted yet.

## Limits

未検証: real GitHub Pages, published RC acceptance, real Safari and combined preintegration CI (U4 ownership). The final native review/source registration and Unit completion have not been observed. Existing repository-boundary recovery record remains historical evidence of external terrarium admission refusal; no registry has been edited or alias invented.

## Final observed verification

The first measurement launch used formicarium's own Playwright installation while measured tests imported sibling terrarium's installation: no test ran, and Playwright rejected two test registrations (`did not expect test() to be called here`). Main corrected only the launch CLI to sibling `packages/terrarium/node_modules/@playwright/test/cli.js`, matching the measurement workspace's dependency symlink. No result from the failed launch was adopted and no assertion/configuration was changed to make it pass.

Correct same-dependency full browser measurement: **45 pass, 0 fail, 1.3min**, Chromium/Firefox/WebKit, workers1/retries0. Native `scripts/terrarium/coverage.js report .artifacts/u3-coverage-repair-v2` exited0: **1451/1801 lines, 80.56%, passedtrue**, fixed24. Current source/candidate checks and all expected fresh receipts passed. The immutable component import explicitly records actual `u1-coverage-v11` path and SHA, preserving original1253 realm names.

Baseline repair: required explicit40hex provenance input now keeps observed current jj parent. Two additional regression cases cover preservation and missing/short/malformed SHA rejection. Formal three build steps succeeded; Node21/21 passed. Biome nine specified TS files passed after format-only corrections. Sibling Biome eight changed source/test/JSON paths also passed. These formatting edits do not change any measured distribution module.

`scripts/terrarium/prepare.js verification/current-integration-input.json` exited0, writing `.artifacts/u3-identity-repair-v1/identity.json`: baseline `0aa94fde1e33230efb96e8763f0fa811ce1cdd80`, sourceIdentity `37917c6317b37cf4bbece486f5ae1ddfa95233eea4cc17d50e21827719bf99c5`, candidate `711ea20e91ca7cb2e5aa9b91b5dbd3d2e2dbfbfb4aeda40702197449a72f0d4d`, tgz `ebe7e5cf6efcd26914e9016ebbd31df1d59812f5cfcfc71b874672c01109dc35`. The source identity uses the documented four integration sources, whereas the coverage identity uses the fixed24 measured sources; these distinct identities are not interchangeable.

Native required-sections plan passed with6 H2 headings. Native U3 traceability passed with zero gaps/orphans/invalid targets/invalid entries. Native top-help query was unavailable (`launcher pin policy drift for route top-help`); no launcher/framework files were inspected or altered, and documented sensor commands remained usable.
