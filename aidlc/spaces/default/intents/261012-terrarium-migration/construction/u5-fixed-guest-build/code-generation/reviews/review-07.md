**Collaborator:** aidlc-architecture-reviewer-agent

### Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-10-21
**Iteration:** 1
**Verdict Dictated:** no

**Prior findings**

| ID | Now | Severity | Note |
|---|---|---|---|
| R-02 | Partially fixed | Minor | 壊れた mbx cache の試験は上流 #536 で足された（code-summary「最終レビューへの対応」：artifact が残らず作業 directory が消えることを確かめる）。ただし偽の mbx での試験で、本物の mbx の動きは CI で未確認と code-summary に書かれている。traceability の NFR5.4 の欄には、この未確認の制限が書かれていない（mbxCacheRestored の制限だけ）。上流の試験本体は今回読めていない（未検証）。 |
| R-06 | Still applies | Minor | bump の auto-merge を外す動作は、実 run で未確認のまま（code-summary「持ち越す上流の残余リスク」と「未完・未検証」に、本物の bump-upstream の run は未実行と記載）。記録は隠していない。U5 のこの再承認で変わった点は無い。 |
| R-09 | Still applies | Minor | `process.ts` の WITHHELD が名前の一致による除外で、`*_KEY` や `SSH_AUTH_SOCK` は外れない、という限界は code-summary に持ち越しとして書かれている。必要な対応は上流の `process.ts` のコメントか README への一文で、記録は formicarium 側にしか無い。上流の file は今回読んでいない（未検証）。 |
| R-10 | Fixed | Minor | code-summary と traceability が、上流 vivarium の本体（`aletheia-works/vivarium@<commit>:tools/fixed-guest-builder/...`）と formicarium 側の確認の2つに分かれている。`proposals/vivarium/u5/` を使う記述は「案の置き場所での履歴」と明記済み。plan の Summary の Touches（L8）は履歴の行のままだが、L5–L6 の断り書きと「新しい土台」の節（L94 以降）で補われている。 |
| R-11 | Fixed | Minor | 古い完了確認（`verify-final-u5.mjs` と135件の binding）は履歴と明記され（code-summary L253–254、traceability NFR8.2）、今の証拠は intent の検証コマンド（`aidlc-state.md` L62、`migration-guest-build-unit` を含む）と Step 22 の照合として定義されている。`.artifacts/` が追跡されないことも記録済み。 |
| R-12 | Fixed | Minor | `source-manifest.json` の writes は6件（`mise-tasks/migration/guest-build-unit.sh`・`guest-build-verify.sh`、`package.json`、`scripts/migration-guest-build/assets.ts`・`verify.ts`、`tests/migration-guest-build/verify.test.ts`）で、`biome.json` は外れている。6件とも今のワークスペースに実在することを読んで確かめた。package.json の U5 の内容が2行だけであることは code-summary L263 に書かれている（行番号の古さは新規の指摘を参照）。 |
| R-13 | Partially fixed | Minor | 重複（`nodeAssets` と `developmentAssets`）、`main()` の経路が試験を通らないこと、`mkdtemp` の一時 directory が消されないことは、残余リスクとして code-summary に記録済み（L267）。コードは変えていない（`assets.ts` L21 の `mkdtemp` は今も削除されない）。`main()` 経路は Step 22 で1回だけ手動で通っている。 |
| R-14 | Still applies | Minor | `checkSet`（`verify.ts` L104）は `dependencies` の無い build-info で `guestBuildKey` を呼び、`INVALID_INPUT` でなく TypeError になり得る。記録（code-summary L268）はあるがコードも試験も変わっていない。`dist/guests/` の前提は unit-test-instructions に書かれていない。さらに code-summary L269 の「`mise run build` を先に実行するので通常は満たされる」は、`package.json` の build（tsc と `scripts/emit.ts`）が `dist/guests/` を作らないことと合わない。新規の指摘を参照。 |
| R-15 | Fixed | Minor | traceability の FR9・NFR2.1・NFR8.2 の target は、Step 22 で実行済み（結果は code-summary の Step 22 の節）と書き換えられている。 |
| R-16 | Still applies | Minor | Step 22 の件数（test:light、`migration-guest-build-unit` の9件、保存済み Release 2組の `cmp` 一致）は main session の記録で、この review も shell を使わないため再実行していない（未検証）。さらに記録は2026-10-18の土台（`2a79860`）のもので、その後に main が動いている（新規の指摘を参照）。人間のチェックポイントで、検証コマンドを1回通した結果と一緒に確認する。 |

**New findings**

| Severity | Location | Finding | Required action |
|---|---|---|---|
| Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u5-fixed-guest-build/code-generation/code-summary.md > 再開：新しい土台（2026-10-18）> 残余リスク R-14の後半（L269） | 「検証コマンドは `mise run build` を先に実行するので、通常は満たされる」と書かれているが、`package.json` の `build` は tsc 2回と `scripts/emit.ts` で、`emit.ts` は `.build` を runtime・web・scripts・integration・tests へ写して Worker bundle を作るだけである。`dist/guests/{aube,hello,exit3,probe}` も `dist/blink/` も作らない。`verify.test.ts` は両方を読む（L75 と `developmentAssets`）。きれいな checkout では、これらは別の手順で先に置かれていないと U5 の単体試験が通らない。 | `dist/guests/` と `dist/blink/` を作る実際の手順（task 名）を確かめて code-summary に書き直すか、前提が別の手順にあることを明記する。unit-test-instructions は変えなくてよいが、記録の主張は実際の手順に合わせる。 |
| Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u5-fixed-guest-build/code-generation/code-summary.md > Step 22（L275–L283）と 残余リスク R-13・R-14 の package.json の行番号（L125・L263） | U5 の formicarium 側の確認結果は2026-10-18の土台 `2a79860` のものである。その後に `package.json`（`files` への1行などで、`migration:guest-build:*` は今 L106–L107。記録は L104–L105 と L105・L106 の2通り）と、PR #58（merge 5735433d：terrarium 関連の削除と `integration/terrarium/guest-distribution` から `integration/guest-distribution` への移動）で土台が動いた。U5 の6つの file は `integration/terrarium/...` を参照しておらず、依存先（`runtime/guest-validation.ts`、`runtime/public`、`runtime/node/api`、`scripts/migration-preflight/unique-json.ts`、`tests/package/fixtures.ts`）は今のワークスペースで実在する。ただし `verify.ts` L13 は U1 の `scripts/migration-preflight/unique-json` に依存し、この依存は plan・code-summary・source-manifest のどこにも書かれていない。ワークスペースの状態が #58 の merge と一致するかは、shell を使わないこの review では確かめられない（未検証）。 | 人間のチェックポイントで intent の検証コマンドを今の base に対して1回通し、結果を記録する。行番号は「`migration:guest-build:unit`・`migration:guest-build:verify` の2行」と名前で書く。U1 の `unique-json.ts` への依存を code-summary に一文で足す。 |
| Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u5-fixed-guest-build/code-generation/code-generation-plan.md > Step 30（L138）と Step 31a（L139） | Step 30 の注記は「review-05 の R-01・R-04 により未完了に戻した」と書いたまま `[x]` になっている。人間の決定（summary の確認を計画 file の SHA256 の一致で代える）は code-summary L6 にあり、plan には無い。今回は plan の Step と内容を変えない決定なので、plan は直せない。 | plan は変えず、code-summary の冒頭の「人の確認」節に、Step 30 の `[x]` が人間の回答（2026-10-19）による完了であることと、plan の「未完了に戻した」が履歴であることを一文で足す。 |

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| shell の検査（lint、typecheck、build、test:light、`migration-guest-build-unit`、actionlint、ShellCheck） | 未実行（この review は shell を禁止されている） | 記録の件数（9件、Step 22 など）は記録の主張であり、この review では再現していない。U5 の formicarium 側の6つの file を読み、import の解決先が実在することだけを確かめた |
| 上流 vivarium の file（`tools/fixed-guest-builder/` と workflow） | 未読 | 上流の指摘（R-02・R-06・R-09）の状態は formicarium 側の記録からの判断で、上流の file で確かめていない |

### Summary

U5 の code は変わらず、記録の分け直し（R-10〜R-12・R-15）は解決している。残る open は Minor だけで、上流の持ち越し（R-06・R-09）、残余リスクとして記録済みの R-13・R-14、再実行していない Step 22（R-16）である。Critical と Major は無いので READY とするが、`mise run build` が `dist/guests/` を作るという記録の主張は実際の `build` と合わず、#58 後の base での検証コマンドの1回の実行が、チェックポイントで必要である。

### Sources

- aidlc/spaces/default/intents/261012-terrarium-migration/construction/u5-fixed-guest-build/code-generation/code-generation-plan.md
- aidlc/spaces/default/intents/261012-terrarium-migration/construction/u5-fixed-guest-build/code-generation/code-summary.md
- aidlc/spaces/default/intents/261012-terrarium-migration/construction/u5-fixed-guest-build/code-generation/traceability.json
- aidlc/spaces/default/intents/261012-terrarium-migration/construction/u5-fixed-guest-build/code-generation/source-manifest.json
- aidlc/spaces/default/intents/261012-terrarium-migration/construction/u5-fixed-guest-build/code-generation/unit-test-instructions.md
- aidlc/spaces/default/intents/261012-terrarium-migration/construction/u5-fixed-guest-build/code-generation/reviews/review-01.md
- aidlc/spaces/default/intents/261012-terrarium-migration/construction/u5-fixed-guest-build/code-generation/reviews/review-06.md
- aidlc/spaces/default/intents/261012-terrarium-migration/aidlc-state.md
- scripts/migration-guest-build/verify.ts
- scripts/migration-guest-build/assets.ts
- tests/migration-guest-build/verify.test.ts
- mise-tasks/migration/guest-build-unit.sh
- mise-tasks/migration/guest-build-verify.sh
- package.json
- mise.toml
- scripts/emit.ts
- scripts/migration-preflight/unique-json.ts
- runtime/guest-validation.ts
- tests/package/fixtures.ts

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | proposals/vivarium/u5/tools/fixed-guest-builder/src/pipeline.ts > buildInfo.reference.mbxCacheRestored (L366付近) | `mbxCacheRestored` は compile の後に mbx cache ディレクトリの中身を数えている。mbx が compile 中に書くため、mbx on なら復元の有無にかかわらず常に true になる。D5 は「cacheの汚染への防御は保存をmainに限ることで、残るリスクの代わりに、復元したかどうかとcacheのkeyをbuild-infoの参考欄に記録する」としているが、この記録は誤っており、cacheのkeyはそもそも記録されていない。公開済みの2つのRelease（guest-biome-15432368…、guest-biome-4751f68d…）のbuild-infoにも、この誤った値が不変のまま入っている。code-summary.md はこれをMinorとして扱い、traceability.json の NFR5.4 は OK になっている。 | 復元の状態を compile の前に測る（件数または大きさ）。build-info の参考欄に cache key と復元の有無を記録する。公開済み2件の値は信用できないと code-summary.md に明記し、traceability.json の NFR5.4 の欄にこの制限を書く。 | Resolved (reviewer) |
| R-02 | Minor | proposals/vivarium/u5/tools/fixed-guest-builder/tests/ （build.test.ts・pipeline.test.ts） | D5 が Code Generation で試験するとした2件のうち、「壊れたcacheではbuildが失敗するか同じdigestになる」試験が無い（`corrupt` を含む試験は Release の取得側だけ）。mbx あり／なしで同じ ELF digest になることは実CI（39073445357 と 39080082205）で確かめられているが、壊れたcacheは未検証である。 | 壊れたmbx cacheを使った試験（またはCIの1回）を足すか、未検証として code-summary.md の「未完・未検証」に載せ、traceability.json の NFR5.4 の記述を実際の証拠に合わせる。 | Unresolved |
| R-03 | Minor | proposals/vivarium/u5/CONFIG-CHANGES.md > infra/github（`prevent_self_review = false`）、code-summary.md「未完・未検証」の can_admins_bypass | 承認者は起動者本人（JamBalaya56562）で、自己承認を禁じておらず、admin による迂回も既定の true のままである。D6 の「人間が具体的な対象を承認したときだけ動く」は、run name の plan SHA256 を人がチャットの値と見比べることに依存し、機械は照合しない。1人運用では妥当だが、ゲートの強さは名目に近い。 | 1人運用の前提と、SHA256の目視照合が統制であることを HANDOFF.md に明記する。`can_admins_bypass` と `prevent_self_review` の扱いを人間が決めて記録する。 | Resolved (reviewer) |
| R-04 | Minor | proposals/vivarium/u5/tools/fixed-guest-builder/src/lockfile.ts > allowedGitRepository、code-summary.md「未完・未検証」 | 依存のgit（react/react）の commit が、そのrepository自身のrefから辿れるかを確かめていない。NFR3.2 の確認は宣言したguestのrepositoryにだけ働くため、fork network にだけある commit を Cargo.lock が指しても検出されない。 | 依存のgit commitにも `verifyReachable` 相当の確認を入れるか、残るリスクとして人間が受け入れた記録を残す。 | Resolved (reviewer) |
| R-05 | Minor | proposals/vivarium/u5/tools/fixed-guest-builder/src/process.ts > spawnGroup（`{ ...process.env, ...options.env }`）と src/build.ts の docker run | 外部の git（clone・checkout・ls-remote）が、`GITHUB_TOKEN` と Actions のruntime tokenを含むrunnerの環境をそのまま継承する。gitは使わないが、D9「外部の取得にはcredentialを送らない」を環境の最小化では担保していない。docker run には `--cap-drop` と `no-new-privileges` が無い（compileは `--network none` で緩和される）。 | gitのprocessには最小の環境（PATH・HOME・GIT_*）だけを渡す。docker run に `--cap-drop ALL`、`--security-opt no-new-privileges` を足すことを検討する。 | Resolved (reviewer) |
| R-06 | Minor | proposals/vivarium/u5/.github/workflows/fixed-guest-bump.yml > Leave the merge to a person、tests/workflows.test.ts | bot-pull-request が auto-merge を有効にしてから外すまでに窓がある。試験は2つのstepの順序だけを見ており、外す動作そのものは確かめていない。本物のbump-upstream の run と PR の作成は未実行である。 | 初回の実run で auto-merge が外れていることを確認して記録する。 | Unresolved |
| R-07 | Minor | code-summary.md「検証の結果」（上流のActionsのcacheが10.21GBで既定の上限10GBを超える） | 上限を超えたため、mbx cacheや他のworkflowのcacheが追い出されうる。NFR8.3 の「新しい費用が出る場合は事前に相談」の対象になる。 | 人間に報告済みであることを記録し、追い出しの影響（mbxが無くても同じELFになる）をREADMEに書く。 | Resolved (reviewer) |
| R-08 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u5-fixed-guest-build/code-generation/code-summary.md > 検証の結果 / 最終レビューへの対応 / 完了確認の入口 | 修正後の数値と状態が古いまま残っている。builderの試験は「146件・行coverage 98.36%」と書かれているが、現在は158件成功・98.43%である。完了確認のbindingは冒頭と別の箇所で「135件」「案の52件」と「131件」「案の51件」が混在している。Majorの修正は「vivariumへのPRで反映する（mergeは未）」と書かれているが、冒頭ではPR #536がmerge済み（71e0ef92）とされ、矛盾している。 | 158件・98.43%、135件・52件に揃え、「mergeは未」を「#536で71e0ef92にmerge済み」へ直す。 | Resolved (reviewer) |
| R-09 | Minor | proposals/vivarium/u5/tools/fixed-guest-builder/src/process.ts > WITHHELD | 子processから外す環境変数の正規表現は `ACTIONS_*`・`GITHUB_TOKEN`・`GH_TOKEN`・`*_TOKEN`・`*_SECRET`・`*_PASSWORD` に限られる。`*_KEY`（例 `AWS_SECRET_ACCESS_KEY`）や `SSH_AUTH_SOCK` は外れない。現在のrunnerには存在しないので実害は確認できず、将来workflowに足された秘密が子processへ漏れる余地として残る。 | 名前による除外の限界を `process.ts` のコメントか README に一文で書く。許可リスト方式への切替は別の判断にしてよい。 | Unresolved |
| R-10 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u5-fixed-guest-build/code-generation/code-generation-plan.md > Summary の Touches、前提と境界、Steps 1–17、2026-10-17の追記（L3・L36–L53・L59）、unit-test-instructions.md > 試験の枠組み・U5だけを実行するcommand（L5・L13・L19・L33・L37・L41）、code-summary.md > 実装したもの（L15–L25）、traceability.json の target 欄 | 記録が、builder を formicarium の `proposals/vivarium/u5/` にあるものとして書いている。確認した事実では、そのdirectory は node_modules の空の殻だけで（`find proposals` の結果）、Git でも追跡されていない。このため unit-test-instructions.md の `bun test --cwd proposals/vivarium/u5/tools/fixed-guest-builder ...` と `actionlint`・`shellcheck` の各commandは、今の formicarium では実行できない。traceability.json の NFR と FR の target（`proposals/vivarium/u5/tools/fixed-guest-builder/src/...`）も、formicarium では解決しない。U5 の本体が上流 aletheia-works/vivarium の merge 71e0ef92（PR #531・#533–#536）にあるという事実と、plan の「Touches」が一致していない。 | 計画を開き直し、次のように書き直す。(1) U5 は「上流 vivarium の固定guest builder（`tools/fixed-guest-builder/` とworkflow 4つ。merge 71e0ef92）」と「formicarium側の確認（`scripts/migration-guest-build/*`、`tests/migration-guest-build/verify.test.ts`、`mise-tasks/migration/guest-build-*.sh`、package.json の `migration:guest-build:*`）」の2つに分かれると明示する。(2) builder の試験・actionlint・shellcheck のcommandは、上流の71e0ef92のcheckoutに対するcommandと明記し、formicarium内のpathを使わない。(3) traceability.json の target は、上流の path にリポジトリ名とcommitを付けて書き直す。 | Unresolved |
| R-11 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u5-fixed-guest-build/code-generation/code-summary.md > Status（L5–L11）、traceability.json > NFR8.2（L114）、plan > 持ち越し（2026-10-18の追記） | 「完了確認のcommand」の記録が、今のintentの設定と食い違っている。code-summary は、検証commandを `node .artifacts/migration-guest-build/verify-final-u5.mjs ...binding-71e0ef92.json <sha>`（135件）としている。しかし `aidlc-state.md` L62 の Construction Verification Command は `... mise run migration-guest-build-unit && mise run showcase-unit` で、`verify-final-u5.mjs` を含まない。さらにこの script は `PROPOSAL = 'proposals/vivarium/u5'` を読み、`proposalFiles: 52` を期待する（`verify-final-u5.mjs` L14・L38）ので、proposals が空の今は成功しないと推測される（実行はしていない）。bindingにも `proposals/vivarium/u5` の参照が54件ある。さらに `.artifacts/` はBiomeの対象外で、追跡されているかを確認できなかった。 | 受入の証拠が何に結び付くかを1か所で定義する。(1) 上流 merge 71e0ef92 と、CIのrun（39073445357・39076793651・39077142098・39079897400・39080082205）とRelease2件。(2) formicarium の `scripts/migration-guest-build/verify.ts` の確認（`mise run migration-guest-build-unit`、9件）。(3) `verify-final-u5.mjs` を引き続き使うなら、案の52件ではなく上流のtreeを直接照合するように直すか、使わないと記録して code-summary と NFR8.2 の target から外す。`.artifacts/` の証拠を残すなら、追跡の有無を記録する。 | Unresolved |
| R-12 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u5-fixed-guest-build/code-generation/source-manifest.json > writes | manifest の4件が、今の土台の U5 の追跡fileと一致していない。(a) `biome.json` は U5 のものではない。plan が書く U5 の変更（`!!proposals/vivarium/u5` の1行）は今の `biome.json` に無く（includes に `proposals` は無い）、今の `biome.json` は showcase の overrides など別の作業の変更を含む。(b) U5 の追跡fileである `mise-tasks/migration/guest-build-unit.sh`・`guest-build-verify.sh` が入っていない。これらは検証commandの `mise run migration-guest-build-unit` が実際に動かす。(c) package.json の `migration:guest-build:unit`・`migration:guest-build:verify`（L104–L105）も入っていない。package.json は共有fileなので、行単位で扱いを決める必要がある。 | `biome.json` を manifest から外す。plan の「Touches」と2026-10-17の追記（L59）の `biome.json` の説明も、今は変更が無いと直す。`mise-tasks/migration/guest-build-unit.sh` と `guest-build-verify.sh` を manifest に加える。package.json は共有fileなので、U5の2行を含めるか、記録で「U5の2行だけが対象」と明記する。 | Unresolved |
| R-13 | Minor | scripts/migration-guest-build/assets.ts > nodeAssets（L8–L30） | `tests/package/fixtures.ts > developmentAssets` と同じ処理の複製である。`nodeAssets` は `verify.ts > main` だけが呼び、試験は通らない（試験は `developmentAssets` を使う）。`mkdtemp` で作る一時directoryは、どこでも消されない。assets.ts を読んだ限り、コードの誤りは見つからなかった。 | `main()` 経路（`nodeAssets` と引数処理）を覆う試験を1件足すか、「`main()` は試験していない」と code-summary に書く。一時directoryは終了時に消す。 | Unresolved |
| R-14 | Minor | scripts/migration-guest-build/verify.ts > checkSet（L83–L106）、tests/migration-guest-build/verify.test.ts | `info` に `dependencies` が無いJSON（例：`{}`）が渡ると、`guestBuildKey(info)` が `info.dependencies` を展開して `TypeError` を投げ、他の入力不正のような `INVALID_INPUT` の拒否にならない。試験は、この場合を含んでいない。`guest(name)` は `dist/guests/{aube,hello,exit3,probe}`（生成物。追跡されない）を読むが、unit-test-instructions.md に、これらを先にbuildする前提が書かれていない（検証commandは `mise run build` を先に実行するので、通常は満たされる）。 | `refuse` で拒否する入力検査（`schemaVersion`、`dependencies` が配列であること）を `guestBuildKey` の前に置き、試験を1件足す。unit-test-instructions.md に、`dist/guests/` と `dist/blink/` が先に必要だと書く。 | Unresolved |
| R-15 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u5-fixed-guest-build/code-generation/traceability.json > FR9・NFR2.1・NFR8.2 の target、code-summary.md > L5 | これらの欄は「この記録の作成時点では未実行」のまま残っている。一方、同じcode-summary.md のStep 22の節（L48–L56）は、同じ確認がexit 0で実行されたと記録している。「作成時点」と断ってあるので矛盾ではないが、traceabilityだけを読む人は、今も未実行と読む。 | traceability.json の3欄に、Step 22で実行済み（`migration-guest-build-unit` 9件、保存済みRelease 2組の照合）と書き足す。 | New |
| R-16 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u5-fixed-guest-build/code-generation/code-summary.md > Step 22（L48–L56） | Step 22の実行結果のうち、lint・typecheck・build・test:light・`migration-guest-build-unit` の件数は、main sessionの記録であり、この再レビューでは読取りのみの条件のため再実行していない（未検証）。byte一致だけは `cmp` で確認した。 | 追加の行動は不要。人間のcheckpointで、検証コマンドを1回通した結果と一緒に確認する。 | New |

> R-02 Not re-checked this round

> R-06 Not re-checked this round

> R-09 Not re-checked this round

> R-10 Not re-checked this round

> R-11 Not re-checked this round

> R-12 Not re-checked this round

> R-13 Not re-checked this round

> R-14 Not re-checked this round

> R-15 Not re-checked this round

> R-16 Not re-checked this round
