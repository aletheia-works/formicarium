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
| R-02 | Fixed | Minor | 変化なし。壊れた mbx cache の挙動は本物の mbx では未検証、mbx あり／なしの同一 ELF digest は実 CI（39073445357・39080082205）で確認済み、という記録が code-summary の「R-02（記録だけ）」と traceability の NFR5.4 に揃っている（review-08 と同じ判断）。上流の試験本体は読めていない。 |
| R-06 | Fixed | Minor | Step 42 の設計変更で前提が変わった。元の指摘は「bump の PR の auto-merge が外れることを実 run で確かめる」だったが、今は auto-merge を外す step 自体を除いた。code-summary の Step 42 の節が「前提が無くなった。#554 での確認は変更前の設計の証拠として残す」と書き、実 run 39608682081 と #554 の記録（Step 39 の節、traceability の FR8）は残っている。確認の義務は、設計の変更により不要になった。代わりに「変更後の実 run で PR が実際に自動で merge されること」が未検証として残る（code-summary の Step 42 の最終行）。これは新しい指摘 2 で扱う。code-summary の「持ち越す上流の残余リスク」（R-06 の旧い記述）には、Step 42 の注記が無い。 |
| R-09 | Fixed | Minor | 変化なし。`WITHHELD` の限界を書くコメントは PR vivarium#553（merge 23e9f452）で入ったと code-summary と traceability の NFR8.3 が記録している。上流の file は読めない（記録に基づく判断）。 |
| R-10 | Fixed | Minor | 変化なし。上流の本体と formicarium 側の確認を分ける形が、Step 40〜42 の記録でも保たれている（vivarium の file は `aletheia-works/vivarium` の PR 番号と merge で書かれている）。 |
| R-11 | Fixed | Minor | 変化なし。NFR8.2 は古い完了確認を履歴と明記したまま。 |
| R-12 | Fixed | Minor | 変化なし。`source-manifest.json` の6件（`verify.ts`・`assets.ts`・`verify.test.ts`・task 2件・`package.json`）は、Step 40 が触る file と同じ path で、manifest の変更は要らない。 |
| R-13 | Fixed | Minor | 直った。`main()` は `nodeAssets` の後で `try/finally` により `rm` する。review-08 の新しい Minor 1（試験の強さ）も、CLI の試験が assets を書いた後の拒否（別の `--key`、`another key`）を足し、その後も `temp` が空であることを確かめるようになって解消した。`TMPDIR`・`TEMP`・`TMP` を同じ directory で渡している。必須引数の欠落は assets の前に拒否されるので、拒否の内容（`--out is required`）だけを確かめる形に直っている。`main()` の `rm` を外すと失敗する確認は記録の主張で、この review は再現していない（シェルを使わない指示）。`rm` を成功時だけに置く変更も、失敗時の確認が捕まえる。 |
| R-14 | Fixed | Minor | 直った。review-08 の新しい Minor 2（形の検査の残り）も解消した。`checkSet` の順は、build-info の読込み → `isObject(info)` → `dependencies` が配列 → 各要素が object → catalog の読込み → `isObject(catalog)` → canonical 形の照合 → 期待値の照合 → `guestBuildKey` → `catalog.schemaVersion` / `entries` → `isObject(entry)` → `entry.format`。catalog の検査は `catalog.schemaVersion` の参照より前、entry の検査は `entry.format` の参照より前にある。`guestBuildKey` が触る `info.source.*` は、直前の `info.source?.repository` の一致で object と分かった後にしか呼ばれない。ほかに `TypeError` になる経路は見つからなかった。 |
| R-15 | Fixed | Minor | 変化なし。FR9 の欄は Step 22 の実行済みを書いている。件数の古さは新しい指摘 1 で扱う。 |
| R-16 | Fixed | Minor | 変化なし。Step 22 の件数が再実行されていない点は、5735433d での intent の検証コマンド全体の実行（exit 0、fail・skip 0）で置き換えられたまま。Step 40 では lint:all・typecheck・build・test:light・`migration-guest-build-unit` を d9772f84 の上で実行した（記録の主張）。検証コマンド全体を今の土台（2faec369）で通すのは、checkpoint の確認として残る。 |

**New findings**

| Severity | Location | Finding | Required action |
|---|---|---|---|
| Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u5-fixed-guest-build/code-generation/traceability.json > FR8、FR9、NFR3.5、NFR8.2 と code-summary.md の Step 40・41・42 の節の見出し、unit-test-instructions.md の「試験の前提と追加の試験」 | 記録が merge 後の事実に追いついていない。(1) code-summary の Step 40・41・42 の見出しが「push 前」のままだが、本文では #62（2faec369）・#555（f4be3299）・#556（dee1ba5e）が merge 済みと書いてある。(2) traceability の FR8 は「push 前。変更後の実 run は未検証」と書き、#556 を挙げていない。計画の Step 42 が「traceability.json（FR8・NFR3.5）に、設計の変更と証拠を書く」としているが、NFR3.5 の欄は変わっていない（D7 の変更と、`bump.ts` が merge を決めないことの対応が無い）。(3) FR9 と NFR8.2 は Step 38 の時点の「2件を足した」「11件」のままで、Step 40 で12件になり、形の検査と CLI の失敗後の確認が増えたことが入っていない。unit-test-instructions も「試験を2件足す」のまま。(4) code-summary の R-13 の項目（Step 38 の節）に「必須の引数が無いと失敗し、どちらの後も一時 directory が残らない」「直す前に失敗することは観測していない」とあるが、Step 40 がこの確認を改めている。上の2つの文は、修正前の記録として読む必要がある。 | 見出しを merge 済みの状態に直す。traceability の FR8 に #556 と dee1ba5e を、NFR3.5 に D7 の変更を、FR9・NFR8.2 に12件と Step 40 の内容を書き足す。Step 38 の節の R-13 の項目に「Step 40 で改めた」と注記する。unit-test-instructions に Step 40 の試験を1行足す。 |
| Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u5-fixed-guest-build/nfr-design/security-design.md > D7 の2026-10-22の注記、Threat Response and Rollback、code-summary.md > Step 42 の「影響」 | 自動 merge の影響は書かれている（宣言の branch の先端が、必須の check を通れば人の確認なしに宣言の `commit` に入る。`accepted` は変わらず、新しい commit の build と受け入れは人が行う）。ただし次が残る。(1) 「必須の check」が何か（builder の CI、Commitlint など）と、それが宣言の検証（許可一覧・D1 の到達確認）を含むかが、どこにも書かれていない。auto-merge の有効化は repository の設定と必須の check に依ると書かれ、確かめられていない。(2) 「新しい commit の build は別に人が行う」ことは設計の主張で、宣言の `commit` が動いただけで build や受け入れの job が自動で起動しないことは、確かめた記録が無い。(3) Threat Response は「過大な権限」「改変された source」の対策を D1・D2・D6・D7 に帰しているが、自動 merge が加わったことで、bump が通す commit の許可が D1 の確認と必須の check だけに依ることは、脅威の節に反映されていない。(4) D7 本文の元の1行「PRのmergeは人が行う（NFR3.5）」は残り、NFR3.5 は merge の方法を決めていないので、帰属が元から不正確である。注記が上書きしているので読み違えは小さい。実害は今のところ確認されていない（安全側に倒れる設計ではないが、build の受け入れが人に残る）。 | D7 の注記か Threat Response に、(a) 必須の check の名前（確かめたもの）か、確かめていないこと、(b) 自動 merge された bump を戻す手順（PR の revert。`accepted` と Release は変わらない）、(c) 宣言の `commit` の変更だけでは build が起動しないことの根拠（workflow の trigger の確認）か、未検証であること、を一文ずつ書く。変更後の実 run で自動 merge を確かめたら、結果を traceability の FR8 に書く。 |

**Validation Tool Results**

| Tool | Result | Interpretation |
|---|---|---|
| shell の検査（lint、typecheck、build、test:light、`migration-guest-build-unit`） | 未実行（この review は shell を使わない指示） | 記録の件数（12件 pass など）は記録の主張で、再現していない。`verify.test.ts` を読み、試験が12件あること（一貫、exit3、ELF 不一致、偽の buildKey、canonical、別の key と repository、catalog 不一致、重複 key と大きさ、build-info の形、catalog の形、CLI、再利用）が記録の「12件」と合うことを確かめた。 |
| 上流 vivarium の file（#555・#556 の `fixed-guest-bump.yml`、`workflows.test.ts`、README） | 未読 | formicarium から読めない。Step 41・42 の判断は code-summary の記録（RED の観測、13件 pass、188 pass、`actions:check` など）に基づく。 |
| security-design.md の D7 と requirements | 読了 | D7 の注記は FR8・NFR3.5 と矛盾しない（NFR3.5 は branch の直接の解決、時刻と branch 名の記録、NFR3.2 の確認を求めるが、merge の方法は決めていない）。branch の直接の解決、D1 の確認、記録、書込み権限の分離は変わっていない。 |

**Summary**

Step 40 の code と試験は正しい。形の検査は参照より前に置かれ、CLI の試験は assets を書いた後の拒否を通るので、後片付けの `finally` を固定する意味のある確認になっている。review-08 の Minor 3件は直り、R-06 は Step 42 の設計変更で前提が変わったが、記録に反映されている。設計変更（D7）は要件と矛盾しないが、必須の check の中身と、自動 merge の後の戻し方・build が自動で起動しないことの根拠が記録に無い。Critical と Major は無く、Minor 2件（記録の追いつかなさ、自動 merge の安全上の記録）なので READY とする。

### Sources

- aidlc/spaces/default/intents/261012-terrarium-migration/construction/u5-fixed-guest-build/code-generation/code-generation-plan.md
- aidlc/spaces/default/intents/261012-terrarium-migration/construction/u5-fixed-guest-build/code-generation/code-summary.md
- aidlc/spaces/default/intents/261012-terrarium-migration/construction/u5-fixed-guest-build/code-generation/traceability.json
- aidlc/spaces/default/intents/261012-terrarium-migration/construction/u5-fixed-guest-build/code-generation/unit-test-instructions.md
- aidlc/spaces/default/intents/261012-terrarium-migration/construction/u5-fixed-guest-build/code-generation/source-manifest.json
- aidlc/spaces/default/intents/261012-terrarium-migration/construction/u5-fixed-guest-build/code-generation/reviews/review-08.md
- aidlc/spaces/default/intents/261012-terrarium-migration/construction/u5-fixed-guest-build/nfr-design/security-design.md
- aidlc/spaces/default/intents/261012-terrarium-migration/construction/u5-fixed-guest-build/nfr-requirements/security-requirements.md
- scripts/migration-guest-build/verify.ts
- scripts/migration-guest-build/assets.ts
- tests/migration-guest-build/verify.test.ts
- runtime/guest-validation.ts

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
