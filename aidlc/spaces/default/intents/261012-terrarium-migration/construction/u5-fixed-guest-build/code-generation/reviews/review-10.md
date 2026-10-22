**Collaborator:** aidlc-architecture-reviewer-agent

### Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-10-22
**Iteration:** 1
**Verdict Dictated:** no

**Prior findings**

| ID | Now | Severity | Note |
|---|---|---|---|
| R-02 | Fixed | Minor | 変化なし。壊れた mbx cache の挙動は本物の mbx では未検証、mbx あり／なしで同じ ELF digest になることは実 CI（39073445357・39080082205）で確認済み、という記録が code-summary の「R-02（記録だけ）」と traceability の NFR5.4 に揃っている。上流の試験本体は読んでいない。 |
| R-06 | Fixed | Minor | 直った。review-09 で残っていた「持ち越す上流の残余リスク」の R-06 に、Step 39 の実 run で外れることを確かめたこと、Step 42 で自動 merge の設計に変えたので前提が無くなったこと、が注記された。Step 42 の節（「前提が無くなった。#554 での確認は変更前の設計の証拠として残す」）と traceability の FR8 とも合う。変更後の実 run で自動 merge されることは、未検証のまま正直に残っている。 |
| R-09 | Fixed | Minor | 変化なし。`WITHHELD` の限界を書くコメントは vivarium#553（merge 23e9f452）で入ったと code-summary と traceability の NFR8.3 が記録している。上流の file は読めないので、記録に基づく判断。 |
| R-10 | Fixed | Minor | 変化なし。上流の本体は `aletheia-works/vivarium` の PR 番号と merge で、formicarium 側は追跡された file で書かれている。Step 40〜42 の節と Step 43 の追記も同じ形を保っている。 |
| R-11 | Fixed | Minor | 変化なし。古い完了確認の command（`verify-final-u5.mjs` と135件の binding）は履歴と明記されたまま。 |
| R-12 | Fixed | Minor | 変化なし。`source-manifest.json` は6件（task 2件・`package.json`・`assets.ts`・`verify.ts`・`verify.test.ts`）で、Step 40 が触る file と同じ path。Step 43 は code を変えないので manifest の変更は要らない。 |
| R-13 | Fixed | Minor | 変化なし。`verify.test.ts` の CLI の試験は、assets を書いた後の拒否（別の `--key`、`another key`）の後も一時 directory が空であることを確かめ、`TMPDIR`・`TEMP`・`TMP` を同じ directory で渡している（試験の本文を読んで確認）。Step 38 の節の R-13 の項目に、Step 40 で改めた旨の注記が足され、review-09 の指摘（古い記述が修正前として読めない）は解消した。 |
| R-14 | Fixed | Minor | 変化なし。build-info・各 dependency・catalog・catalog entry が object であることの検査は、参照より前にある。「形の試験」2件が `INVALID_INPUT` の `code` まで確かめている（試験の本文を読んで確認）。 |
| R-15 | Fixed | Minor | 変化なし。FR9 の欄は Step 22 の実行済みを書き、Step 38・40 の追加（11件、12件）も入った。 |
| R-16 | Fixed | Minor | 変化なし。Step 22 の件数が再実行されていない点は、5735433d での検証コマンド全体の実行で置き換えられたまま。ただし NFR8.2 の最後の1文の裏付けは、新しい指摘 4 で扱う。 |

**New findings**

| Severity | Location | Finding | Required action |
|---|---|---|---|
| Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u5-fixed-guest-build/code-generation/traceability.json > FR8 の target | FR8 の欄に古い文と新しい文が両方残り、矛盾している。前半は「…auto-merge を外す step を除く。push 前。変更後の実 run は未検証」と書き、後半は「PR aletheia-works/vivarium#556（merge dee1ba5e）で…自動で merge する」と書く。#555 の記述も同じ欄に重複している。「push 前」は今は誤り（#556 は merge 済み）。traceability だけを読む人は、まだ push していないと読む。 | 前半の「push 前。」を外して後半に統合する（または前半を削除する）。#555 と #556 の記述を1か所にまとめ、「変更後の実 run は未検証」を1回だけ残す。 |
| Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u5-fixed-guest-build/nfr-design/security-design.md > D7 の「merge の権限」の項、および code-generation-plan.md の前提メモ（2026-10-17 の追記 4） | D7 は「PR を作る job の token の権限は contents・pull-requests の write」と書くが、計画の2026-10-17の追記 4 は、bump の workflow の `GITHUB_TOKEN` は `contents: read`・`actions: read` だけで、PR は `aletheia-works-bot` の App token で作ると記録している。D7 の「token」がどちらを指すのか分からず、書かれた権限は `GITHUB_TOKEN` の記録と食い違う。自動 merge の安全は「merge は repository の auto-merge と ruleset が行う」ことに依るが、その App token の権限の範囲と、App が ruleset を迂回できる（bypass actor）かどうかは、どこにも書かれていない。Step 43 が review-03 の R-09 に求めた「merge の権限を持つ資格情報の範囲」は、この点が未了のまま残っている。 | D7 の該当箇所を直し、PR を作る資格情報が App token であること、その App に与えた権限（確かめた範囲）、ruleset の bypass actor に入っているか（確かめたこと、又は未検証）を一文ずつ書く。`GITHUB_TOKEN` の権限は read だけだと明記する。 |
| Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u5-fixed-guest-build/nfr-design/security-design.md > D7 の「必須の check」「bot の PR で CI が動くこと」、Assumptions & Open Questions の注記 | 2点が根拠なしに書かれている。(1) 「2026-10-22 の読取りでは10個」の読み方（REST の ruleset の GET など）が、code-summary のどの節にも記録されていない。(2) 「bot の PR でほかの workflow も動く（#554 で CI が動いたことを確かめた）」の根拠は、code-summary では Commitlint（run 39608896977）だけである。必須の check 10個のうち E2E 3つ・regression 3つ・`Test MCP server` などが、recipe.json だけを変える bot の PR で実際に報告されるか（path の絞り込みで走らず、必須のまま「待ち」で自動 merge が止まらないか）は確かめていない。止まる場合は安全側（merge されない）だが、「必須の check がすべて通ったら自動で merge する」は成り立たない。変更後の実 run の未検証として扱われているが、設計の側は「確かめた」と読める書き方になっている。 | 10個の読み方（日付、API、結果）を code-summary の Step 42 か Step 43 の節に1行で記録する。D7 と Assumptions の注記を「Commitlint が bot の PR で動いたことは確かめた。ほかの必須の check が bot の bump の PR で報告されることは未検証」に直す。変更後の実 run が通ったら結果を traceability の FR8 に書く。 |
| Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u5-fixed-guest-build/code-generation/traceability.json > NFR8.2 の target の最後の1文 | 「Step 40 の後（2026-10-22、checkpoint の確認）：intent の検証コマンドが exit 0、`migration-guest-build-unit` は12件」と書くが、code-summary の Step 40 の節が記録している実行は、`d9772f84` の上の5つの task（lint:all・typecheck・build・test:light・`migration-guest-build-unit`）だけで、検証コマンド全体を今の土台（2faec369）で通した結果の節が見当たらない。review-09 も、全体の実行は checkpoint の確認として残ると書いていた。裏付けの無い「exit 0」の主張になっている。 | 全体を実行したなら、日付・土台の commit・各 task の件数を code-summary の新しい節に書く。実行していないなら、NFR8.2 の文を「Step 40 の5つの task を `d9772f84` の上で実行済み。検証コマンド全体は checkpoint の確認で行う」に直す。 |

**Validation Tool Results**

| Tool | Result | Interpretation |
|---|---|---|
| shell の検査（lint、typecheck、build、test:light、`migration-guest-build-unit`） | 未実行（この review は shell を使わない指示） | 記録の件数は記録の主張で、再現していない。`tests/migration-guest-build/verify.test.ts` を読み、試験が12件あること（一貫、exit3、ELF 不一致、偽の buildKey、canonical、別の key と repository、catalog 不一致、重複 key と大きさ、build-info の形、catalog の形、CLI、再利用）が、unit-test-instructions と traceability の「12件」と合うことを確かめた。 |
| 上流 vivarium の file、vivarium@f4be3299 の3 file | 未読 | formicarium から読めない。D7 の「`commit` と `accepted` が違う間」の記述は、security-design の「実行はしていない」という記録に基づく判断。 |
| review-09 の Minor 2件（記録の追いつき、自動 merge の安全の記録） | 概ね直った | 見出しの merge 済み表記、Step 38 の R-13 の注記、R-06 の注記、FR9・NFR3.5・NFR8.2・unit-test-instructions の追記、D7 の必須の check・CI・build が始まらないこと・`commit` と `accepted` の扱い、Threat Response の脅威と切り戻し、Assumptions の注記は入っている。残りは新しい指摘 1〜4。 |
| NFR Design review-03 の Minor 3件（R-08・R-09・R-10） | R-08・R-10 は直った。R-09 は一部 | R-08：必須の check の名前（10個）が D7 に入り、Assumptions の注記が直った（根拠の記録は新しい指摘 3）。R-10：元の行に帰属の注記が付き、`commit` と `accepted` の扱いが読んだ file の名前つきで書かれた。R-09：脅威と切り戻し（merge commit の revert）は入ったが、merge の権限を持つ資格情報の範囲は新しい指摘 2 のとおり未了。 |

**Summary**

Step 43 は記録と設計の書き足しだけで、code は変えておらず、前回の Minor 5件の大半を直した。要件（FR8・NFR3.5・FR10）との矛盾は見つからない。残るのは、traceability の FR8 に残った古い「push 前」の文、D7 の token の権限の書き方（`GITHUB_TOKEN` と App token の取り違えの余地と、bypass の有無）、必須の check の根拠の記録、NFR8.2 の裏付けの無い1文の Minor 4件で、どれも実装や配布の安全を壊さない。Critical と Major は無いので READY とする。

### Sources

- aidlc/spaces/default/intents/261012-terrarium-migration/construction/u5-fixed-guest-build/code-generation/code-generation-plan.md
- aidlc/spaces/default/intents/261012-terrarium-migration/construction/u5-fixed-guest-build/code-generation/code-summary.md
- aidlc/spaces/default/intents/261012-terrarium-migration/construction/u5-fixed-guest-build/code-generation/traceability.json
- aidlc/spaces/default/intents/261012-terrarium-migration/construction/u5-fixed-guest-build/code-generation/unit-test-instructions.md
- aidlc/spaces/default/intents/261012-terrarium-migration/construction/u5-fixed-guest-build/code-generation/source-manifest.json
- aidlc/spaces/default/intents/261012-terrarium-migration/construction/u5-fixed-guest-build/code-generation/reviews/review-09.md
- aidlc/spaces/default/intents/261012-terrarium-migration/construction/u5-fixed-guest-build/nfr-design/security-design.md
- aidlc/spaces/default/intents/261012-terrarium-migration/construction/u5-fixed-guest-build/nfr-design/reviews/review-03.md
- aidlc/spaces/default/intents/261012-terrarium-migration/inception/requirements-analysis/requirements.md
- tests/migration-guest-build/verify.test.ts

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
