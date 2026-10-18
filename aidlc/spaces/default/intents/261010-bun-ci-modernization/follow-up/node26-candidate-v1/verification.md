# Node 26 main candidate verification

Date: 2026-10-11 JST
Source: 84e8995f300d9123dd8fcc2b250b62dd5bc7d8f0 (main)
Runtime: Node 26.11.1 / Bun 1.4.2
Input commit: 674a7f0a1b1736a2df61a994ab2dac29dddb8ace (GitHub signature verified)
Archive SHA256: 0b074f0ebc170fbabed0fbe1d8bfad9628247a4131f78223db8c343412c38730
Package SHA256: 9490bbd1e09bb4dfd39157060b26ea0382cf4d061287fc0f871f6ec6a969790e
Run: https://github.com/aletheia-works/formicarium/actions/runs/38099515705

## 検証済み: preparation

- Generated package from Node 26 main after frozen Bun install/build. npm pack was local only, ignore-scripts enabled. Fixed package inventory and every file digest verified.
- Rebuilt source inventory: 202 pins; payload: 1373 files; archive: 104588868 bytes. All 1374 regular archive members, paths, sizes and SHA256 independently verified.
- 1319 retained payload inputs independently match previously reviewed archive/payload hashes. Core/guest provenance and native baseline retained; package/site copies, manifests and resolver modules regenerated.
- validateCandidateInputs accepted the complete new manifest against exact main source/context before transfer.
- Remote fixed-commit raw URL downloaded and archive SHA256 matched. Repository modernization URL/SHA256 variables updated and read back. Release input variables unchanged.
- Candidate workflow dispatched on main and API head SHA matches source. Final runtime/coverage outcome pending; old success is not reused.

This is follow-up evidence; completed AI-DLC stage records are preserved.

Negative freshness check: old 0b7da72c source-bound inputs were rejected when validated against current 84e8995f main. New inputs were independently accepted before transfer. The live GitHub run successfully installed the new pinned input and entered the sequential verification step; final outcome remains pending.

## Candidate execution failure (2026-10-11)

検証済み: run 38099515705 tested source 84e8995f300d9123dd8fcc2b250b62dd5bc7d8f0 and failed in frozen terrarium browser execution. Root Playwright 1.64.0 browser installation did not supply snapshot Playwright 1.63.0 executables (for example webkit-2359/pw_run.sh). Artifact 11687476884 ZIP SHA256 32b7dd951e12bbd16f2aa5f0f157a9641eb2e73b7d6c0823f24eb9177b6c4a87 matches API digest. Named receipts show release 35, Node regression 54, browser regression 36, U1 Node 115, U1 browser 123, U3 Node 30 passing without skips, and native aube/pitchfork successful. U3 browser and final candidate acceptance failed; full candidate success is not established. Main subsequently advanced to aef8139f (unpatched pitchfork), so this old run does not validate that newer source. PR #11 now provisions the current root Playwright into the disposable terrarium coverage workspace before sealing coverage, preserving the reviewed input snapshot bytes. This follows the user request for latest tooling; actual candidate retry remains pending.
