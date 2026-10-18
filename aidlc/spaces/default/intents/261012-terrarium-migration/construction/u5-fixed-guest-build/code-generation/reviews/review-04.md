## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-10-18T00:00:00Z
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | proposals/vivarium/u5/tools/fixed-guest-builder/src/pipeline.ts > buildInfo.reference.mbxCacheRestored (L366付近) | `mbxCacheRestored` は compile の後に mbx cache ディレクトリの中身を数えている。mbx が compile 中に書くため、mbx on なら復元の有無にかかわらず常に true になる。D5 は「cacheの汚染への防御は保存をmainに限ることで、残るリスクの代わりに、復元したかどうかとcacheのkeyをbuild-infoの参考欄に記録する」としているが、この記録は誤っており、cacheのkeyはそもそも記録されていない。公開済みの2つのRelease（guest-biome-15432368…、guest-biome-4751f68d…）のbuild-infoにも、この誤った値が不変のまま入っている。code-summary.md はこれをMinorとして扱い、traceability.json の NFR5.4 は OK になっている。 | 復元の状態を compile の前に測る（件数または大きさ）。build-info の参考欄に cache key と復元の有無を記録する。公開済み2件の値は信用できないと code-summary.md に明記し、traceability.json の NFR5.4 の欄にこの制限を書く。 | Resolved (reviewer) |
| R-02 | Minor | proposals/vivarium/u5/tools/fixed-guest-builder/tests/ （build.test.ts・pipeline.test.ts） | D5 が Code Generation で試験するとした2件のうち、「壊れたcacheではbuildが失敗するか同じdigestになる」試験が無い（`corrupt` を含む試験は Release の取得側だけ）。mbx あり／なしで同じ ELF digest になることは実CI（39073445357 と 39080082205）で確かめられているが、壊れたcacheは未検証である。 | 壊れたmbx cacheを使った試験（またはCIの1回）を足すか、未検証として code-summary.md の「未完・未検証」に載せ、traceability.json の NFR5.4 の記述を実際の証拠に合わせる。 | Resolved (reviewer) |
| R-03 | Minor | proposals/vivarium/u5/CONFIG-CHANGES.md > infra/github（`prevent_self_review = false`）、code-summary.md「未完・未検証」の can_admins_bypass | 承認者は起動者本人（JamBalaya56562）で、自己承認を禁じておらず、admin による迂回も既定の true のままである。D6 の「人間が具体的な対象を承認したときだけ動く」は、run name の plan SHA256 を人がチャットの値と見比べることに依存し、機械は照合しない。1人運用では妥当だが、ゲートの強さは名目に近い。 | 1人運用の前提と、SHA256の目視照合が統制であることを HANDOFF.md に明記する。`can_admins_bypass` と `prevent_self_review` の扱いを人間が決めて記録する。 | Unresolved |
| R-04 | Minor | proposals/vivarium/u5/tools/fixed-guest-builder/src/lockfile.ts > allowedGitRepository、code-summary.md「未完・未検証」 | 依存のgit（react/react）の commit が、そのrepository自身のrefから辿れるかを確かめていない。NFR3.2 の確認は宣言したguestのrepositoryにだけ働くため、fork network にだけある commit を Cargo.lock が指しても検出されない。 | 依存のgit commitにも `verifyReachable` 相当の確認を入れるか、残るリスクとして人間が受け入れた記録を残す。 | Resolved (reviewer) |
| R-05 | Minor | proposals/vivarium/u5/tools/fixed-guest-builder/src/process.ts > spawnGroup（`{ ...process.env, ...options.env }`）と src/build.ts の docker run | 外部の git（clone・checkout・ls-remote）が、`GITHUB_TOKEN` と Actions のruntime tokenを含むrunnerの環境をそのまま継承する。gitは使わないが、D9「外部の取得にはcredentialを送らない」を環境の最小化では担保していない。docker run には `--cap-drop` と `no-new-privileges` が無い（compileは `--network none` で緩和される）。 | gitのprocessには最小の環境（PATH・HOME・GIT_*）だけを渡す。docker run に `--cap-drop ALL`、`--security-opt no-new-privileges` を足すことを検討する。 | Unresolved |
| R-06 | Minor | proposals/vivarium/u5/.github/workflows/fixed-guest-bump.yml > Leave the merge to a person、tests/workflows.test.ts | bot-pull-request が auto-merge を有効にしてから外すまでに窓がある。試験は2つのstepの順序だけを見ており、外す動作そのものは確かめていない。本物のbump-upstream の run と PR の作成は未実行である。 | 初回の実run で auto-merge が外れていることを確認して記録する。 | Unresolved |
| R-07 | Minor | code-summary.md「検証の結果」（上流のActionsのcacheが10.21GBで既定の上限10GBを超える） | 上限を超えたため、mbx cacheや他のworkflowのcacheが追い出されうる。NFR8.3 の「新しい費用が出る場合は事前に相談」の対象になる。 | 人間に報告済みであることを記録し、追い出しの影響（mbxが無くても同じELFになる）をREADMEに書く。 | Unresolved |
| R-08 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u5-fixed-guest-build/code-generation/code-summary.md > 検証の結果 / 最終レビューへの対応 / 完了確認の入口 | 修正後の数値と状態が古いまま残っている。builderの試験は「146件・行coverage 98.36%」と書かれているが、現在は158件成功・98.43%である。完了確認のbindingは冒頭と別の箇所で「135件」「案の52件」と「131件」「案の51件」が混在している。Majorの修正は「vivariumへのPRで反映する（mergeは未）」と書かれているが、冒頭ではPR #536がmerge済み（71e0ef92）とされ、矛盾している。 | 158件・98.43%、135件・52件に揃え、「mergeは未」を「#536で71e0ef92にmerge済み」へ直す。 | Resolved (reviewer) |
| R-09 | Minor | proposals/vivarium/u5/tools/fixed-guest-builder/src/process.ts > WITHHELD | 子processから外す環境変数の正規表現は `ACTIONS_*`・`GITHUB_TOKEN`・`GH_TOKEN`・`*_TOKEN`・`*_SECRET`・`*_PASSWORD` に限られる。`*_KEY`（例 `AWS_SECRET_ACCESS_KEY`）や `SSH_AUTH_SOCK` は外れない。現在のrunnerには存在しないので実害は確認できず、将来workflowに足された秘密が子processへ漏れる余地として残る。 | 名前による除外の限界を `process.ts` のコメントか README に一文で書く。許可リスト方式への切替は別の判断にしてよい。 | Unresolved |
| R-10 | Major | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u5-fixed-guest-build/code-generation/code-generation-plan.md > Summary の Touches、前提と境界、Steps 1–17、2026-10-17の追記（L3・L36–L53・L59）、unit-test-instructions.md > 試験の枠組み・U5だけを実行するcommand（L5・L13・L19・L33・L37・L41）、code-summary.md > 実装したもの（L15–L25）、traceability.json の target 欄 | 記録が、builder を formicarium の `proposals/vivarium/u5/` にあるものとして書いている。確認した事実では、そのdirectory は node_modules の空の殻だけで（`find proposals` の結果）、Git でも追跡されていない。このため unit-test-instructions.md の `bun test --cwd proposals/vivarium/u5/tools/fixed-guest-builder ...` と `actionlint`・`shellcheck` の各commandは、今の formicarium では実行できない。traceability.json の NFR と FR の target（`proposals/vivarium/u5/tools/fixed-guest-builder/src/...`）も、formicarium では解決しない。U5 の本体が上流 aletheia-works/vivarium の merge 71e0ef92（PR #531・#533–#536）にあるという事実と、plan の「Touches」が一致していない。 | 計画を開き直し、次のように書き直す。(1) U5 は「上流 vivarium の固定guest builder（`tools/fixed-guest-builder/` とworkflow 4つ。merge 71e0ef92）」と「formicarium側の確認（`scripts/migration-guest-build/*`、`tests/migration-guest-build/verify.test.ts`、`mise-tasks/migration/guest-build-*.sh`、package.json の `migration:guest-build:*`）」の2つに分かれると明示する。(2) builder の試験・actionlint・shellcheck のcommandは、上流の71e0ef92のcheckoutに対するcommandと明記し、formicarium内のpathを使わない。(3) traceability.json の target は、上流の path にリポジトリ名とcommitを付けて書き直す。 | Resolved (reviewer) |
| R-11 | Major | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u5-fixed-guest-build/code-generation/code-summary.md > Status（L5–L11）、traceability.json > NFR8.2（L114）、plan > 持ち越し（2026-10-18の追記） | 「完了確認のcommand」の記録が、今のintentの設定と食い違っている。code-summary は、検証commandを `node .artifacts/migration-guest-build/verify-final-u5.mjs ...binding-71e0ef92.json <sha>`（135件）としている。しかし `aidlc-state.md` L62 の Construction Verification Command は `... mise run migration-guest-build-unit && mise run showcase-unit` で、`verify-final-u5.mjs` を含まない。さらにこの script は `PROPOSAL = 'proposals/vivarium/u5'` を読み、`proposalFiles: 52` を期待する（`verify-final-u5.mjs` L14・L38）ので、proposals が空の今は成功しないと推測される（実行はしていない）。bindingにも `proposals/vivarium/u5` の参照が54件ある。さらに `.artifacts/` はBiomeの対象外で、追跡されているかを確認できなかった。 | 受入の証拠が何に結び付くかを1か所で定義する。(1) 上流 merge 71e0ef92 と、CIのrun（39073445357・39076793651・39077142098・39079897400・39080082205）とRelease2件。(2) formicarium の `scripts/migration-guest-build/verify.ts` の確認（`mise run migration-guest-build-unit`、9件）。(3) `verify-final-u5.mjs` を引き続き使うなら、案の52件ではなく上流のtreeを直接照合するように直すか、使わないと記録して code-summary と NFR8.2 の target から外す。`.artifacts/` の証拠を残すなら、追跡の有無を記録する。 | Resolved (reviewer) |
| R-12 | Major | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u5-fixed-guest-build/code-generation/source-manifest.json > writes | manifest の4件が、今の土台の U5 の追跡fileと一致していない。(a) `biome.json` は U5 のものではない。plan が書く U5 の変更（`!!proposals/vivarium/u5` の1行）は今の `biome.json` に無く（includes に `proposals` は無い）、今の `biome.json` は showcase の overrides など別の作業の変更を含む。(b) U5 の追跡fileである `mise-tasks/migration/guest-build-unit.sh`・`guest-build-verify.sh` が入っていない。これらは検証commandの `mise run migration-guest-build-unit` が実際に動かす。(c) package.json の `migration:guest-build:unit`・`migration:guest-build:verify`（L104–L105）も入っていない。package.json は共有fileなので、行単位で扱いを決める必要がある。 | `biome.json` を manifest から外す。plan の「Touches」と2026-10-17の追記（L59）の `biome.json` の説明も、今は変更が無いと直す。`mise-tasks/migration/guest-build-unit.sh` と `guest-build-verify.sh` を manifest に加える。package.json は共有fileなので、U5の2行を含めるか、記録で「U5の2行だけが対象」と明記する。 | Resolved (reviewer) |
| R-13 | Minor | scripts/migration-guest-build/assets.ts > nodeAssets（L8–L30） | `tests/package/fixtures.ts > developmentAssets` と同じ処理の複製である。`nodeAssets` は `verify.ts > main` だけが呼び、試験は通らない（試験は `developmentAssets` を使う）。`mkdtemp` で作る一時directoryは、どこでも消されない。assets.ts を読んだ限り、コードの誤りは見つからなかった。 | `main()` 経路（`nodeAssets` と引数処理）を覆う試験を1件足すか、「`main()` は試験していない」と code-summary に書く。一時directoryは終了時に消す。 | Unresolved |
| R-14 | Minor | scripts/migration-guest-build/verify.ts > checkSet（L83–L106）、tests/migration-guest-build/verify.test.ts | `info` に `dependencies` が無いJSON（例：`{}`）が渡ると、`guestBuildKey(info)` が `info.dependencies` を展開して `TypeError` を投げ、他の入力不正のような `INVALID_INPUT` の拒否にならない。試験は、この場合を含んでいない。`guest(name)` は `dist/guests/{aube,hello,exit3,probe}`（生成物。追跡されない）を読むが、unit-test-instructions.md に、これらを先にbuildする前提が書かれていない（検証commandは `mise run build` を先に実行するので、通常は満たされる）。 | `refuse` で拒否する入力検査（`schemaVersion`、`dependencies` が配列であること）を `guestBuildKey` の前に置き、試験を1件足す。unit-test-instructions.md に、`dist/guests/` と `dist/blink/` が先に必要だと書く。 | Unresolved |
| R-15 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u5-fixed-guest-build/code-generation/traceability.json > FR9・NFR2.1・NFR8.2 の target、code-summary.md > L5 | これらの欄は「この記録の作成時点では未実行」のまま残っている。一方、同じcode-summary.md のStep 22の節（L48–L56）は、同じ確認がexit 0で実行されたと記録している。「作成時点」と断ってあるので矛盾ではないが、traceabilityだけを読む人は、今も未実行と読む。 | traceability.json の3欄に、Step 22で実行済み（`migration-guest-build-unit` 9件、保存済みRelease 2組の照合）と書き足す。 | New |
| R-16 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u5-fixed-guest-build/code-generation/code-summary.md > Step 22（L48–L56） | Step 22の実行結果のうち、lint・typecheck・build・test:light・`migration-guest-build-unit` の件数は、main sessionの記録であり、この再レビューでは読取りのみの条件のため再実行していない（未検証）。byte一致だけは `cmp` で確認した。 | 追加の行動は不要。人間のcheckpointで、検証コマンドを1回通した結果と一緒に確認する。 | New |

> R-03 Reviewer note: 上流の指摘。自己承認の許可と `can_admins_bypass` の扱いは、code-summary.md「持ち越す上流の残余リスク」に載っているが、人間の判断の記録はまだ無い。formicariumからは直せない。

> R-05 Reviewer note: 上流の指摘。`docker run` の `--cap-drop ALL` と `no-new-privileges` は持ち越しのまま。

> R-06 Reviewer note: 上流の指摘。本物のbump-upstreamのrunは未実行。

> R-07 Reviewer note: 上流の指摘。Actionsのcache超過は持ち越しに載るが、人間への報告済みの記録と追い出しの影響の記載は見当たらない。

> R-08 Reviewer note: 履歴の節の数値が揃った。158件・98.43%（code-summary.md L103）、135件・52件（L64・L127）、「#536で71e0ef92にmerge済み」（L132・L135）。冒頭の「証拠の分け方」とも矛盾しない。

> R-09 Reviewer note: 上流の指摘。`WITHHELD` の名前による除外の限界は、記録には載っていない。

> R-10 Reviewer note: code-summary.md と traceability.json が「上流vivariumの本体（merge 71e0ef92）」と「formicarium側の確認」の2つに分かれた。traceability.json の上流のtargetは `aletheia-works/vivarium@71e0ef92:` 付きで、formicarium側のtargetは追跡されたfile6件だけを指す（`git ls-files --error-unmatch` で6件とも追跡を確認）。`git ls-files proposals` は0件で、formicariumのfileとして `proposals/vivarium/u5/` を指す箇所は履歴の節に限られ、履歴と明記されている。unit-test-instructions.md の冒頭の新しい節は、builderの試験・actionlint・ShellCheckを上流で行ったものと明記する。

> R-11 Reviewer note: 完了確認の記録が分かれた。`verify-final-u5.mjs` と135件のbindingは古い土台の履歴と明記され、新しい土台ではintentの検証コマンド（aidlc-state.md L62と一致）とStep 22の照合を証拠とする。`.artifacts/` が未追跡であることも記録された（確認済み：`.gitignore` 114行に一致、`git ls-files .artifacts` は0件）。上流のtree記録 `upstream-tree-71e0ef92.json` は `sha` が 71e0ef92…、`truncated: false` で、`fixed-guest` を含むblobは52件（src 18件・tests 21件・workflow 4件、ほか8件・container 1件）となり、traceabilityと記録の「52件」に一致する。

> R-12 Reviewer note: manifestは `mise-tasks/migration/guest-build-unit.sh`・`guest-build-verify.sh`、`package.json`、`scripts/migration-guest-build/assets.ts`・`verify.ts`、`tests/migration-guest-build/verify.test.ts` の6件になり、`biome.json` は外れた。6件とも追跡されている。`package.json` の104–105行が `migration:guest-build:unit`・`migration:guest-build:verify` で、U5の内容がその2行だけであることが記録されている（共有fileの扱いが明記された）。

> R-13 Reviewer note: 残余リスクとして記録され、codeは変えていない（`nodeAssets` の複製、`main()` が試験を通らない、一時directoryが消えない）。Step 22の照合が `main()` を実際に1回通ったことは、出力の一致で裏付けられる。直すかどうかは別の判断。

> R-14 Reviewer note: 残余リスクとして記録され、codeは変えていない。`dist/guests/` と `dist/blink/` が先に必要だという前提は unit-test-instructions.md には書かれていない（承認を外さないための判断と記録されている）。検証コマンドが `mise run build` を先に実行するので通常は満たされる。

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| `git ls-files --error-unmatch`（manifestの6件） | 6件とも追跡対象 | R-12の修正を裏付ける。`biome.json` は含まれない。 |
| `git ls-files proposals` | 0件 | `proposals/vivarium/u5/` をformicariumのfileとして指す記述が残っていないことの前提。履歴の節だけに残る。 |
| `cmp baseline-reuse-evidence.json baseline-reuse-evidence-20261018.json` | 一致（差分なし） | Step 22のbaselineの照合の記録と一致する。 |
| `cmp fix-reuse-evidence.json fix-reuse-evidence-20261018.json` | 一致（差分なし） | Step 22のfixの照合の記録と一致する。 |
| `upstream-tree-71e0ef92.json` の読取り | `sha` 71e0ef92…、`truncated: false`、`fixed-guest` を含むblobは52件（src 18・tests 21・workflow 4） | code-summary.md と traceability.json の上流の対象の数に合う。 |
| `git check-ignore -v .artifacts/x`、`git ls-files .artifacts` | `.gitignore` 114行に一致、0件 | `.artifacts/` が未追跡である記録は正しい。 |
| `package.json` の104–105行 | `migration:guest-build:unit`・`migration:guest-build:verify` | manifestの説明と一致する。 |
| `mise run` 系・`node --test`・`bun` | 実行していない（読取りのみの条件） | Step 22の件数は記録の読取りで、未検証。 |

### Summary

R-10〜R-12のMajor 3件は、記録を上流の本体（71e0ef92）とformicarium側の確認に分け、manifestを追跡された6件にし、完了確認の記録を現在のintentの検証コマンドとStep 22に結び付けたことで直った。Step 22の出力2件は保存済みの照合とbyte単位で一致した。残るのはMinorだけで、上流の指摘の持ち越し、R-13・R-14の残余リスク、traceabilityの「未実行」の古い表現である。
