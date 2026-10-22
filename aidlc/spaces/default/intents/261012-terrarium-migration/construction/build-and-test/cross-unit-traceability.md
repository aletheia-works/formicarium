# Cross-Unit Traceability

`aidlc engine sensor-traceability --stage build-and-test` の結果（2026-10-22、出力の写し：`.artifacts/build-and-test/sensor-traceability.txt`）。

## 判定

**Fail**（`"pass": false`）。未対応と判定された ID：`FR7`、`FR8`、`NFR1`、`NFR2`、`NFR3`、`NFR4`、`NFR5`、`NFR8`。

原因は、実装が無いことではなく、追跡表の書き方が確認の道具の前提と合わないこと（検証済み：`.claude/tools/aidlc-sensor-traceability.ts` の `codeTargetProblem` は、`OK` の行の target を「workspace の中の、実在する1つの file の相対 path」としてだけ受け付ける）。

- U5 `u5-fixed-guest-build` の `OK` 19行のうち18行は、target が `aletheia-works/vivarium@<sha>:<path>` の形や説明の文である（未対応の行の表のとおり）。U5 の実装は vivarium のリポジトリ（formicarium の workspace の外）にあるので、道具は file として解決できない。U5 の実装と試験の証拠は、U5 の `code-summary.md` と vivarium の PR・CI の run に記録されている（ドキュメント根拠。この段階では vivarium の試験を再実行していない）。

- U7 `u7-showcase-guests` の `NFR8.1` の1行は、target が `showcase/scripts/mode.ts` のあとに説明の文（「。2026-10-22：U8 の #54 …」）を続けている。`showcase/scripts/mode.ts` 自体は存在するが、文ごと path として読まれて失敗した。

## 未対応の行

| Unit | ID | 道具が読んだ target（先頭） | 所有 |
|---|---|---|---|
| u5-fixed-guest-build | FR7 | aletheia-works/vivarium@71e0ef92:tools/fixed-guest-builder/src/declaration.ts, src/key.ts, src/reuse.ts, src/r… | code-generation（u5-fixed-guest-build） |
| u5-fixed-guest-build | FR8 | aletheia-works/vivarium@71e0ef92:tools/fixed-guest-builder/src/artifact.ts (build-info, catalog), src/bump.ts,… | code-generation（u5-fixed-guest-build） |
| u5-fixed-guest-build | NFR2.1 | formicarium: U5 は配布JSを変えない（scripts/migration-guest-build/*、tests/migration-guest-build/* は配布対象外）。新しい土台での `mise… | code-generation（u5-fixed-guest-build） |
| u5-fixed-guest-build | NFR2.2 | aletheia-works/vivarium@71e0ef92:.github/workflows/test-fixed-guest-builder.yml; aletheia-works/vivarium@71e0e… | code-generation（u5-fixed-guest-build） |
| u5-fixed-guest-build | NFR3.1 | aletheia-works/vivarium@71e0ef92:tools/fixed-guest-builder/src/declaration.ts; aletheia-works/vivarium@71e0ef9… | code-generation（u5-fixed-guest-build） |
| u5-fixed-guest-build | NFR3.2 | aletheia-works/vivarium@71e0ef92:tools/fixed-guest-builder/src/source.ts (verifyReachable, GIT_NO_LAZY_FETCH),… | code-generation（u5-fixed-guest-build） |
| u5-fixed-guest-build | NFR3.3 | aletheia-works/vivarium@71e0ef92:tools/fixed-guest-builder/src/artifact.ts (parseUniqueJson, limits, canonical… | code-generation（u5-fixed-guest-build） |
| u5-fixed-guest-build | NFR3.4 | aletheia-works/vivarium@71e0ef92:tools/fixed-guest-builder/src/source.ts (applyPatches), src/key.ts (sourcePat… | code-generation（u5-fixed-guest-build） |
| u5-fixed-guest-build | NFR3.5 | aletheia-works/vivarium@71e0ef92:tools/fixed-guest-builder/src/bump.ts (git ls-remote); aletheia-works/vivariu… | code-generation（u5-fixed-guest-build） |
| u5-fixed-guest-build | NFR4.1 | aletheia-works/vivarium@71e0ef92:tools/fixed-guest-builder/src/deadline.ts, src/process.ts; aletheia-works/viv… | code-generation（u5-fixed-guest-build） |
| u5-fixed-guest-build | NFR4.2 | aletheia-works/vivarium@71e0ef92:tools/fixed-guest-builder/src/monitor.ts, src/http.ts; aletheia-works/vivariu… | code-generation（u5-fixed-guest-build） |
| u5-fixed-guest-build | NFR5.1 | aletheia-works/vivarium@71e0ef92:tools/fixed-guest-builder/src/busy.ts, src/build.ts (finalizeArtifacts); alet… | code-generation（u5-fixed-guest-build） |
| u5-fixed-guest-build | NFR5.2 | aletheia-works/vivarium@71e0ef92:tools/fixed-guest-builder/src/key.ts, src/reuse.ts, src/release.ts (NOT_REPRO… | code-generation（u5-fixed-guest-build） |
| u5-fixed-guest-build | NFR5.3 | aletheia-works/vivarium@71e0ef92:tools/fixed-guest-builder/src/release.ts; upstream Releases guest-biome-15432… | code-generation（u5-fixed-guest-build） |
| u5-fixed-guest-build | NFR5.4 | aletheia-works/vivarium@71e0ef92:tools/fixed-guest-builder/src/build.ts, src/pipeline.ts (mbx; mbxCacheRestore… | code-generation（u5-fixed-guest-build） |
| u5-fixed-guest-build | NFR8.1 | aletheia-works/vivarium@71e0ef92:.github/workflows/fixed-guest-*.yml (permissions); aletheia-works/vivarium@71… | code-generation（u5-fixed-guest-build） |
| u5-fixed-guest-build | NFR8.2 | 新しい土台：intent の検証コマンド（`mise run migration-guest-build-unit` を含む）と Step 22 の照合（formicarium: scripts/migration-gu… | code-generation（u5-fixed-guest-build） |
| u5-fixed-guest-build | NFR8.3 | aletheia-works/vivarium@71e0ef92:tools/fixed-guest-builder/src/cli.ts (secret redaction), src/process.ts (toke… | code-generation（u5-fixed-guest-build） |
| u7-showcase-guests | NFR8.1 | showcase/scripts/mode.ts。2026-10-22：U8 の #54（merge 94970a9e）で mode.ts が distribute を main への push と workflow_d… | code-generation（u7-showcase-guests） |

## Unit ごとの追跡表

| Unit | 上流の ID の数 | 行の状態 | 道具の判定 |
|---|---|---|---|
| u1-migration-preflight | 13 | OK 11, GAP 2 | 問題なし |
| u2-session-guest-api | 27 | OK 35 | 問題なし |
| u3-install | 26 | GAP 7, OK 19 | 問題なし |
| u4-command | 34 | OK 34 | 問題なし |
| u5-fixed-guest-build | 19 | OK 19 | 未対応 18 行 |
| u6-recipe-runtime | 64 | OK 63, N/A 1 | 問題なし |
| u7-showcase-guests | 18 | OK 18 | 未対応 1 行 |
| u8-showcase-site | 59 | OK 59 | 問題なし |
| u9-retirement-acceptance | 17 | OK 16, Deferred 1 | 問題なし |

## 承認の場で示すこと

- 未対応の ID は Build and Test の所見として承認の場で示す（stage の Step 10）。
- 直し方の候補（どれも未実施）：(1) U5 と U7 の Code Generation を開き直し、`traceability.json` の target を道具が読める形に直す（U7 は path だけにして説明を別にする。U5 は workspace の外の file を指せないので、formicarium の中の対応する file にするか、状態の付け方を人間と決める）。(2) U5 は別のリポジトリの実装である、と記録したうえでこのまま受け入れる。基準を緩めて通すことはしない。

## 訂正と再実行（2026-10-22、Loop-back 2 の U5 の修正の後）

**訂正**：上の節は、道具の出力の `reason`（読めない target）だけを書き、`coverage` の `not_built` を見落としていた。最初の実行（`.artifacts/build-and-test/sensor-traceability.txt`）でも、U1 の `GAP` 2行・U3 の `GAP` 7行・U9 の `Deferred` 1行が未対応の原因に含まれていた。

**再実行**（`.artifacts/build-and-test/sensor-traceability-2.txt`）：U5 の `traceability.json` を人間の決定 A のとおりに直した後。判定は **Fail** のまま。未対応の ID：`NFR1`、`NFR2`、`NFR3`、`NFR4`、`NFR8`。U5 の行は未対応に出なくなった（`NFR4` などの `not_applicable` に U5 の理由が出る）。

| 未対応の ID | 原因の行（`not_built`） |
|---|---|
| `NFR1` | `u3-install: NFR1.1` |
| `NFR2` | `u3-install: NFR2.1`、`u3-install: NFR2.2` |
| `NFR3` | `u1-migration-preflight: NFR3.2` |
| `NFR4` | `u1-migration-preflight: NFR4.1` |
| `NFR8` | `u3-install: NFR8.1`、`u7-showcase-guests: NFR8.1`、`u9-retirement-acceptance: NFR8.2` |

- 読めない target は U7 の `NFR8.1` の1行だけ（U7 の Code Generation で直す予定）。
- そのほかは、各 Unit が Code Generation で意図して付けた状態：U1 の `NFR3.2`・`NFR4.1`（`GAP`）、U3 の `FR1`・`FR6`・`BR3.10`・`NFR1.1`・`NFR2.1`・`NFR2.2`・`NFR8.1`（`GAP`。正式受入が `local-provisional` のままである行）、U9 の `NFR8.2`（`Deferred`）。今回の Loop-back 2 の範囲ではない。承認の場で、人間の判断を求める所見として示す。

## CI Pipeline の境界の確認の後の再実行（2026-10-22）

U1・U3・U9 の Code Generation に戻って直した後（`.artifacts/build-and-test/sensor-traceability-6.txt`）：判定は **Fail**、未対応は `NFR8` の `u9-retirement-acceptance: NFR8.2`（`Deferred`、JSR の版が残る。人間が失敗のままと承知して記録した）だけ。U1 の `NFR3.2`・`NFR4.1`、U3 の7行は `OK` になり、未対応に出ない。Operation へ進むかどうかは、CI Pipeline の境界の確認で人間に諮る。

