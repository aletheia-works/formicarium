## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-10-18T00:00:00Z
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | proposals/vivarium/u5/tools/fixed-guest-builder/src/pipeline.ts > buildInfo.reference.mbxCacheRestored (L366付近) | `mbxCacheRestored` は compile の後に mbx cache ディレクトリの中身を数えている。mbx が compile 中に書くため、mbx on なら復元の有無にかかわらず常に true になる。D5 は「cacheの汚染への防御は保存をmainに限ることで、残るリスクの代わりに、復元したかどうかとcacheのkeyをbuild-infoの参考欄に記録する」としているが、この記録は誤っており、cacheのkeyはそもそも記録されていない。公開済みの2つのRelease（guest-biome-15432368…、guest-biome-4751f68d…）のbuild-infoにも、この誤った値が不変のまま入っている。code-summary.md はこれをMinorとして扱い、traceability.json の NFR5.4 は OK になっている。 | 復元の状態を compile の前に測る（件数または大きさ）。build-info の参考欄に cache key と復元の有無を記録する。公開済み2件の値は信用できないと code-summary.md に明記し、traceability.json の NFR5.4 の欄にこの制限を書く。 | New |
| R-02 | Minor | proposals/vivarium/u5/tools/fixed-guest-builder/tests/ （build.test.ts・pipeline.test.ts） | D5 が Code Generation で試験するとした2件のうち、「壊れたcacheではbuildが失敗するか同じdigestになる」試験が無い（`corrupt` を含む試験は Release の取得側だけ）。mbx あり／なしで同じ ELF digest になることは実CI（39073445357 と 39080082205）で確かめられているが、壊れたcacheは未検証である。 | 壊れたmbx cacheを使った試験（またはCIの1回）を足すか、未検証として code-summary.md の「未完・未検証」に載せ、traceability.json の NFR5.4 の記述を実際の証拠に合わせる。 | New |
| R-03 | Minor | proposals/vivarium/u5/CONFIG-CHANGES.md > infra/github（`prevent_self_review = false`）、code-summary.md「未完・未検証」の can_admins_bypass | 承認者は起動者本人（JamBalaya56562）で、自己承認を禁じておらず、admin による迂回も既定の true のままである。D6 の「人間が具体的な対象を承認したときだけ動く」は、run name の plan SHA256 を人がチャットの値と見比べることに依存し、機械は照合しない。1人運用では妥当だが、ゲートの強さは名目に近い。 | 1人運用の前提と、SHA256の目視照合が統制であることを HANDOFF.md に明記する。`can_admins_bypass` と `prevent_self_review` の扱いを人間が決めて記録する。 | New |
| R-04 | Minor | proposals/vivarium/u5/tools/fixed-guest-builder/src/lockfile.ts > allowedGitRepository、code-summary.md「未完・未検証」 | 依存のgit（react/react）の commit が、そのrepository自身のrefから辿れるかを確かめていない。NFR3.2 の確認は宣言したguestのrepositoryにだけ働くため、fork network にだけある commit を Cargo.lock が指しても検出されない。 | 依存のgit commitにも `verifyReachable` 相当の確認を入れるか、残るリスクとして人間が受け入れた記録を残す。 | New |
| R-05 | Minor | proposals/vivarium/u5/tools/fixed-guest-builder/src/process.ts > spawnGroup（`{ ...process.env, ...options.env }`）と src/build.ts の docker run | 外部の git（clone・checkout・ls-remote）が、`GITHUB_TOKEN` と Actions のruntime tokenを含むrunnerの環境をそのまま継承する。gitは使わないが、D9「外部の取得にはcredentialを送らない」を環境の最小化では担保していない。docker run には `--cap-drop` と `no-new-privileges` が無い（compileは `--network none` で緩和される）。 | gitのprocessには最小の環境（PATH・HOME・GIT_*）だけを渡す。docker run に `--cap-drop ALL`、`--security-opt no-new-privileges` を足すことを検討する。 | New |
| R-06 | Minor | proposals/vivarium/u5/.github/workflows/fixed-guest-bump.yml > Leave the merge to a person、tests/workflows.test.ts | bot-pull-request が auto-merge を有効にしてから外すまでに窓がある。試験は2つのstepの順序だけを見ており、外す動作そのものは確かめていない。本物のbump-upstream の run と PR の作成は未実行である。 | 初回の実run で auto-merge が外れていることを確認して記録する。 | New |
| R-07 | Minor | code-summary.md「検証の結果」（上流のActionsのcacheが10.21GBで既定の上限10GBを超える） | 上限を超えたため、mbx cacheや他のworkflowのcacheが追い出されうる。NFR8.3 の「新しい費用が出る場合は事前に相談」の対象になる。 | 人間に報告済みであることを記録し、追い出しの影響（mbxが無くても同じELFになる）をREADMEに書く。 | New |
| R-08 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u5-fixed-guest-build/code-generation/code-summary.md > 検証の結果 / 最終レビューへの対応 / 完了確認の入口 | 修正後の数値と状態が古いまま残っている。builderの試験は「146件・行coverage 98.36%」と書かれているが、現在は158件成功・98.43%である。完了確認のbindingは冒頭と別の箇所で「135件」「案の52件」と「131件」「案の51件」が混在している。Majorの修正は「vivariumへのPRで反映する（mergeは未）」と書かれているが、冒頭ではPR #536がmerge済み（71e0ef92）とされ、矛盾している。 | 158件・98.43%、135件・52件に揃え、「mergeは未」を「#536で71e0ef92にmerge済み」へ直す。 | New |
| R-09 | Minor | proposals/vivarium/u5/tools/fixed-guest-builder/src/process.ts > WITHHELD | 子processから外す環境変数の正規表現は `ACTIONS_*`・`GITHUB_TOKEN`・`GH_TOKEN`・`*_TOKEN`・`*_SECRET`・`*_PASSWORD` に限られる。`*_KEY`（例 `AWS_SECRET_ACCESS_KEY`）や `SSH_AUTH_SOCK` は外れない。現在のrunnerには存在しないので実害は確認できず、将来workflowに足された秘密が子processへ漏れる余地として残る。 | 名前による除外の限界を `process.ts` のコメントか README に一文で書く。許可リスト方式への切替は別の判断にしてよい。 | New |

> R-01 Not re-checked this round

> R-02 Not re-checked this round

> R-03 Not re-checked this round

> R-04 Not re-checked this round

> R-05 Not re-checked this round

> R-06 Not re-checked this round

> R-07 Not re-checked this round

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| `bun test`（proposals/vivarium/u5/tools/fixed-guest-builder、今回再実行） | 158 pass、0 fail、17 files | 主セッションの観測と一致する。修正後に退行はない。 |
| `node --test tests/migration-guest-build/verify.test.ts` | 9 pass、0 fail | formicarium側の照合の試験に退行はない。 |
| `upstream-compare-f1bf9058-71e0ef92.json` の変更file一覧 | `container/build.sh`・`tools.json`・`src/key.ts` を含まない（変更は workflow、cli、lockfile、pipeline、process、source と試験のみ） | CIのrun（f1bf9058）の結果は71e0ef92にもそのまま当てはまる。keyは変わらない。 |
| 公開済み build-info の確認 | 2つとも `reference.mbxCacheRestored=true`、`mbxCacheKeys` なし。baselineのrun 39073445357のlogは「Cache not found for input keys」、fixのrun 39077142098は「Cache hit」・「Cache restored successfully」 | code-summaryの記述どおり。baselineの `true` は誤り、fixの `true` は偶然合っただけである。 |

**Majorの修正の確認**

- `src/pipeline.ts`：`mbxCacheRestored` を `withDeadline` の先頭、`checkDiskFree`・source取得・container起動より前に数えている。`mbxCacheKeys` は `request.mbxCache === null` のとき `null` で、その他は `{requested, matched}` を build-info の `reference` に入れている。`reference` はkeyに入らない欄である。
- `src/cli.ts` が `MBX_CACHE_REQUESTED_KEY` と `MBX_CACHE_MATCHED_KEY` を読み、`fixed-guest-build.yml` が `steps.mbx-cache.outputs.cache-primary-key` と `cache-matched-key` を渡している。
- `tests/pipeline.test.ts` の「mbx cache record」2件が、空のcache（build中にcacheへ書込みあり）で false と `matched: null`、事前に復元済みで true と `matched: 'mbx-key'` を確かめている。元の欠陥（compile後に数える）を再現できる試験になっている。

**Minor 3件の修正の確認**

- 壊れたmbxのcache：`tests/pipeline.test.ts` で、`FAKE_BUILD_CODE=101` のとき `EXTERNAL`、出力directoryが空、作業directoryが消えることを確かめている。ただしfake dockerによる試験で、本物のmbxの動きではない。code-summaryがこの限界を書いている。
- 依存gitのcommitの到達：`verifyDependencyReachable`（`--bare --filter=tree:0`、`GIT_NO_LAZY_FETCH`、`refs/heads` と `refs/tags` に対する `--contains`）が、`dependency-sources` として `fetchDependencies` と `cargo fetch` の前に動く。到達する場合は成功、到達しない場合は `SOURCE_UNREACHABLE` で、ログに `cargo fetch` が無いことを確かめる試験がある。再利用で早期returnする経路ではcloneしない。
- tokenを子processに渡さない：`spawnGroup` が `inheritedEnvironment()` を使い、`options.env` による明示指定だけを上書きとして通す。`tests/process.test.ts` が、継承されないこと、明示指定は通ることを確かめている。busyの確認などのGitHub API呼出しは親process側の `GITHUB_TOKEN` を使うので、影響しない。

### Summary

Major（mbxCacheRestored をcompileの後に数えていた欠陥）と Minor 3件は、コードと試験の両方で直っている。keyを決めるfileは変わっておらず、158件の試験とformicarium側の9件が通るので、退行は見つからない。公開済み2つのbuild-infoの `mbxCacheRestored` が信用できないという記録は、各runのlogと一致して正確である。残るのは、code-summaryの数値と状態が修正前のまま残っていること（Minor）と、環境変数の除外が名前の一致に頼っていること（Minor）だけで、ブロックするものではない。
