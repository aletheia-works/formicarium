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
| R-02 | Fixed | Minor | 計画の Step 37 が決めた「記録だけ」の形で直っている。code-summary の「R-02（記録だけ）」と traceability の NFR5.4 が、壊れた mbx cache の挙動は本物の mbx で未検証であること、上流 #536 の試験は build 失敗時に artifact と作業 directory が残らないことだけを確かめること、mbx あり／なしの同一 ELF digest は実 CI（39073445357・39080082205）で確認済みであることを揃えて書いている。上流の試験本体は読めていない（未検証）。 |
| R-06 | Fixed | Minor | 実 run 39608682081 と bot の PR vivarium#554 の auto-merge 解除を、code-summary の「Step 39」の節と traceability の FR8 が検証済み（jobs の GET、GraphQL の `autoMergeRequest: null`、`AutoMergeDisabledEvent`）として記録している。`AutoMergeEnabledEvent` が出ず、有効だった長さは未確認と正直に書かれている。この review は上流を読めないので、記録の主張に基づく判断（未再現）。bump の差分が JSON の書式を崩す点は未対応として記録され、別に決める扱い。 |
| R-09 | Fixed | Minor | `process.ts` の `WITHHELD` の上に名前による除外の限界を書くコメントを足した、と code-summary と traceability の NFR8.3 が PR vivarium#553（merge 23e9f452）で記録している。振る舞いは変えていない。上流の file は読めない（記録に基づく判断、未再現）。 |
| R-10 | Fixed | Minor | review-07 で解決済み。今回の記録の追加も上流の本体（`aletheia-works/vivarium@<commit>:...`）と formicarium 側の確認を分ける形を保っている。 |
| R-11 | Fixed | Minor | review-07 で解決済み。今の土台での確認として、intent の検証コマンドの各 task を 5735433d で実行した結果が追記され、NFR8.2 も古い完了確認を履歴と明記したままである。 |
| R-12 | Fixed | Minor | review-07 で解決済み。`source-manifest.json` は6件のままで、`verify.ts`・`assets.ts`・`verify.test.ts` は Step 38 でも同じ path であり、manifest の変更は要らない。 |
| R-13 | Fixed | Minor | `nodeAssets` が `{ directory, assets }` を返し、`main()` が `try/finally` で `rm` する。`nodeAssets` 内の書込み失敗でも自分で消す。`verifyWith` はセッションの `dispose` を `finally` に持ち、`main()` の `rm` はその後に走るので、Worker が一時 file を持ったままの削除にならない。重複の理由（製品の script が試験の fixture を import しない）も記録済み。後片付けの試験の強さは新しい指摘 1 を参照。 |
| R-14 | Fixed | Minor | `checkSet` が build-info を読んだ直後（canonical 形の照合と `guestBuildKey` より前）に object と `dependencies` の配列を `refuse`（`INVALID_INPUT`）で確かめる。試験は `null`・`dependencies` なし・`dependencies` が文字列の3通りを `code` まで確かめる。直す前の失敗は観測済み（10件中 pass 9・fail 1、`error.code` が `undefined`）。`dist/blink/` と `dist/guests/` の前提は unit-test-instructions と code-summary に書かれた。同じ種類の穴が残る箇所は新しい指摘 2 を参照。 |
| R-15 | Fixed | Minor | review-07 で解決済み。FR9 の欄は Step 38 の内容も反映している。 |
| R-16 | Fixed | Minor | Step 22 の件数が再実行されていない点は、今の土台 5735433d で main session が intent の検証コマンドの各 task を1つずつ実行した結果（exit 0、typecheck・build・test:light・preflight 57件・preflight-current 21件・guest-build 11件・showcase 100件、fail・skip 0）に置き換えられた。この review はこれらを再実行していない（記録の主張）。#59 の rebase の後（#60・#61 の上）に再実行されたのは lint:all・build・`migration-guest-build-unit` で、検証コマンド全体ではない。チェックポイントでの確認が残る。 |

**New findings**

| Severity | Location | Finding | Required action |
|---|---|---|---|
| Minor | tests/migration-guest-build/verify.test.ts > "the command line verifies a saved set and leaves no temporary directory" | この試験で後片付けを実際に確かめているのは、成功した実行の後の `readdir(temp)` だけである。必須引数の欠落（`--out`）は `nodeAssets` を呼ぶ前に `refuse` されるので、その後の `readdir(temp)` は、一時 directory を作る前に失敗する以上、`finally` が無くても必ず空になる。code-summary の「`createSession` や照合が失敗しても消す」という主張を固定する試験は無い。`main()` の `try/finally` が効く経路は、`nodeAssets` の後で失敗する場合（例：`--key` が違う、`--set` に file が無い）で、どの試験も通らない。また `TMPDIR` を子 process に渡す方法は `os.tmpdir()` が `TMPDIR` を見る POSIX の挙動に依存する。Windows では `TEMP` と `TMP` が見られるので、`temp` は使われず、最初の `readdir` も常に空になって通る（この team は Windows と PowerShell でも作業する）。 | `nodeAssets` の後に失敗する実行（例：誤った `--key`）を1件、同じ試験に足して、失敗した後も `temp` が空であることを確かめる。`TMPDIR` に加えて `TEMP` と `TMP` も渡す。code-summary の R-13 の記述は、確かめているのが成功時と失敗時のどちらかを正確に書く。 |
| Minor | scripts/migration-guest-build/verify.ts > checkSet（catalog の読込みの直後、`entries[0]` の参照、`dependencies` の要素） | R-14 と同じ種類の穴が残っている。catalog の JSON が `null`（または `entries: [null]`）だと `catalog.schemaVersion` や `entry.format` が `TypeError` になり、`INVALID_INPUT` の拒否にならない。`dependencies: [null]` は配列の検査を通り、`guestBuildKey` の並べ替え（`a.tool`）で `TypeError` になる。成果物を受け入れることはなく、止まるだけなので、安全側の失敗である。 | catalog が object であることと、`entries[0]` が object であること、`dependencies` の各要素が object であることも、`refuse` で確かめる。試験を1件足す。または直さない判断を残余リスクとして code-summary に書く。 |
| Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u5-fixed-guest-build/code-generation/code-summary.md > 「残余リスク」の R-14の後半（旧記録の1文） | 古い記録の「検証コマンドは `mise run build` を先に実行するので、通常は満たされる」が、そのまま残っている。冒頭の「試験の前提」の節が誤りだったと明記し、旧い節も「2026-10-21：R-13・R-14 は直した」と断っているので、読み違える恐れは小さい。 | 対応は要らない。旧い記録に直接の訂正を入れたい場合だけ、その1文に「誤り。上の『試験の前提』を参照」を足す。 |

**Validation Tool Results**

| Tool | Result | Interpretation |
|---|---|---|
| shell の検査（lint、typecheck、build、test:light、`migration-guest-build-unit`） | 未実行（この review は shell を使わない指示） | 記録の件数（11件など）は記録の主張で、再現していない。`verify.ts`・`assets.ts`・`verify.test.ts` を読み、`verify.test.ts` の11件（旧9件に Step 38 の2件）と記録の件数の食い違いが無いことを確かめた。`package.json` の U5 の2行は106–107行にあることを読んで確かめた。 |
| 上流 vivarium の file（`process.ts`、PR #553、run 39608682081、PR #554） | 未読 | R-02・R-06・R-09 の判断は code-summary と traceability の記録に基づく。 |

**Summary**

Step 38 の code は正しい。形の検査は `guestBuildKey` より前に置かれ、`main()` は成功・失敗とも一時 directory を消し、`verifyWith` の分割で振る舞いは変わっていない。review-07 の新しい Minor 3件と前からの Minor 6件は、記録の上では直った。残るのは Minor だけ（後片付けの試験の強さ、catalog などの形の検査の穴、旧記録の1文）で、Critical と Major は無いので READY とする。

### Sources

- aidlc/spaces/default/intents/261012-terrarium-migration/construction/u5-fixed-guest-build/code-generation/code-generation-plan.md
- aidlc/spaces/default/intents/261012-terrarium-migration/construction/u5-fixed-guest-build/code-generation/code-summary.md
- aidlc/spaces/default/intents/261012-terrarium-migration/construction/u5-fixed-guest-build/code-generation/unit-test-instructions.md
- aidlc/spaces/default/intents/261012-terrarium-migration/construction/u5-fixed-guest-build/code-generation/traceability.json
- aidlc/spaces/default/intents/261012-terrarium-migration/construction/u5-fixed-guest-build/code-generation/source-manifest.json
- aidlc/spaces/default/intents/261012-terrarium-migration/construction/u5-fixed-guest-build/code-generation/reviews/review-07.md
- scripts/migration-guest-build/verify.ts
- scripts/migration-guest-build/assets.ts
- tests/migration-guest-build/verify.test.ts
- runtime/guest-validation.ts
- package.json

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
