**Collaborator:** aidlc-architecture-reviewer-agent

### Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-10-21
**Iteration:** 1

PR #58 が U4 に与えた影響を、現在の file で確かめた。U4 の振る舞いは変わっておらず、Critical・Major は無い。

**Prior findings**

| ID | Now | Severity | Note |
| --- | --- | --- | --- |
| R-05 | Still applies | Minor | README.md と docs/command-api.md の「未検証」の文は、今回の再開でも直していない。製品の振る舞いに影響しない。公開に向けた次の変更で直すと決めて記録するまで残る。 |
| R-06 | Still applies | Minor | code-generation-plan.md の Summary 12行目は、まだ項目5の回帰試験を新しい file `tests/migration-command/blink-log.test.ts` と書いている。source-manifest.json にその file は無く、実際の置き場所は `public.test.ts`。 |
| R-07 | Still applies | Minor | `runtime/command.ts` の execute は、`argv.length === 0` なら `route`／`preabort` の前に `empty` で返る。取消済みの signal が付いていても成功する。計画の判定順（INVALID_INPUT → ABORTED → DISPOSED/BUSY）の例外が記録されていない。 |
| R-08 | Still applies | Minor | 今回の再開で記録は変えていない。trust 削除の受領記録が、wrapper 実行の証拠ではなく観測の申告である点は同じ。 |
| R-12 | Still applies | Minor | `commandSourceInventory`／`sessionSourceInventory` の収集条件は今回触れていない。U2 の file を変えるので、人間の判断が要る点も同じ。 |
| R-13 | Still applies | Minor | traceability.json の NFR8.2 の note は「試験は未実行」のまま。FR6 の note も「Steps 22–26 は未実行」、NFR8.1 の note も「Steps 23–25 で、未検証」のままで、Step 22〜26 が済んだ今は古い。範囲は NFR8.2 だけでなく FR6・NFR8.1 にも及ぶ。 |
| R-14 | Still applies | Minor | code-summary.md の「Status」「検証の結果」の見出しは、旧い土台の履歴であることを示していない。新しい 6回目の節が先頭にあるので、読み違える余地は前より小さい。 |
| R-15 | Still applies | Minor | source-manifest.json に `scripts/package/coverage.ts` は無いまま。`bun.lock` など同じ理由の共有 file は残っており、基準が揃っていない。 |
| R-16 | Still applies | Minor | measurement-report の `unit: u3-install` についての1行の説明は、まだ書かれていない。 |
| R-17 | Still applies | Minor | traceability.json の NFR8.2 の note は「contents read」とだけ書き、workflow が持つ `actions: read` に触れていない。書込み権限が無いという結論は変わらない。 |
| R-18 | Still applies | Minor | CI の36試行の余裕（約2%）は、今回の再開でも変わらない。基準は緩めていない。 |
| R-19 | Still applies | Minor | docs/command-api.md に、mainのCI成功後に受入を実行する手順と失敗時の見え方を書くことは、今回の再開の範囲に入っていない。 |

**New findings**

| Severity | Location | Finding | Required action |
| --- | --- | --- | --- |
| Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u4-command/code-generation/code-summary.md > 「6回目の再開」Step 28 の試験の結果 | `migration:command-unit` の 106/107 の失敗1件（`consumer.test.js`）は、stage した候補の環境変数が無いと最初の確認で必ず失敗する、と書かれている。未検証と明記されているので虚偽ではないが、この再開では U4 の consumer 経路（独立 consumer からの `createCommandSession`）を新しい土台で通していない。#58 の差分は comment・scripts の glob・文書・guest の配布 path だけなので、影響は小さい。 | 次に候補を stage する機会（公開に向けた作業など）に、`consumer.test.js` を環境変数付きで流し、結果をこの節に1行足す。それまで「未検証」の表記を保つ。 |

### 影響の確認（現在の file、検証済み）

- `runtime/command-parse.ts`：`guardCommandInput` と `tokenizeCommand` に terrarium への言及は無く、コードは #58 の前の仕様どおり（`MAX_COMMAND_BYTES` 65536、孤立 surrogate の拒否、改行・NUL の拒否）。
- `runtime/command.ts`：`createCommandSession` の execute は、選択肢の検査、入力の検査とトークン化、`route`、install／guest／builtin への振分けのまま。C03 の command の経路に変更は無い。
- `package.json`：`exports`・`files` は変わっていない。`test:integration`・`test:node-unit` の glob は、現存する `tests/terrarium/coverage.test.js`・`tests/guest-distribution/*.test.js` を指す。`migration:command:unit`・`browser`・`stage`・`completion`・`observe` も残っている。
- `scripts/release/inventory.ts`：`U2_FILES` が `integration/guest-distribution/` を指す。U4 の `FIRST_PARTY_JS`（23件）に `runtime/command-parse.js`・`command.js` が残っている。`U3_FILES` の `terrarium/packages/...` は、historical な inventory で U4 の対象外。
- `source-manifest.json`：記録の path は `tests/terrarium/coverage.test.ts` を含めて現存する。#58 で移した file・消した file を指す行は無い。`traceability.json` の target も現存する。
- Step 28〜29 の記録（code-generation-plan.md、code-summary.md）は、実際の file と一致する。Step 30（独立レビューと checkpoint）は未完で、計画でも未チェックになっている。

### 注記

- 検証の結果（typecheck、build、test:light、migration:command-unit）は、依頼に書かれた main session の観測をそのまま使った。私はコマンドを実行していない。なお Bash の呼び出しを数回試みたが、no-op（`true`）で、workspace に変更は無い。

### Summary

#58 は U4 の manifest にある4 file のコメント・scripts の glob・文書・guest の配布 path を変えただけで、U4 の振る舞いと公開 API は変わっていない。記録も現存する file だけを指している。未解決は既存の Minor 12件と新しい Minor 1件で、どれも製品の振る舞いを妨げない。

### Sources

- aidlc/spaces/default/intents/261012-terrarium-migration/construction/u4-command/code-generation/code-generation-plan.md（Summary、Step 17〜30、Testing Contract）
- aidlc/spaces/default/intents/261012-terrarium-migration/construction/u4-command/code-generation/code-summary.md（「6回目の再開」、「5回目の再開」、「4回目の再開」）
- aidlc/spaces/default/intents/261012-terrarium-migration/construction/u4-command/code-generation/traceability.json
- aidlc/spaces/default/intents/261012-terrarium-migration/construction/u4-command/code-generation/source-manifest.json
- .artifacts/u9-retirement/u4-review-context.md
- runtime/command.ts、runtime/command-parse.ts、package.json、scripts/release/inventory.ts
- main session の観測（2026-10-21、依頼文に記載）

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | .artifacts/migration-command/verify-final-u4.mjs > verifyMeasurement と verifyFinalU4 の `equal(ciMeasurement.catalogSha256, local.measurement.catalogSha256)` | U3の検証コマンドは、U1のmirror-inputから再構成した期待catalogと `report.catalogSha256` を照合し、各試行の `raw.input` も期待entryと比較していた。U4の検証コマンドはこの照合を落としている。CIとローカルのcatalog SHAを互いに比べるだけで、どちらも固定資産から独立に固定されていない。`trial.digest` も `raw.input.buildInfo.elfSha256`（同じ生記録の値）と比べるだけである。stdoutのdigestは固定値と比べているが、測ったaube・biomeの実体が、U1で受入れたものかは確かめていない。 | U3と同じく、`docs/results/terrarium-migration-preflight-evidence/mirror-input.json` から期待catalogとそのSHAを再構成して、`report.catalogSha256` と各 `raw.input` を照合する。そのうえでCIとローカルの一致も確かめる。 | Resolved (reviewer) |
| R-02 | Major | .artifacts/migration-command/verify-final-u4.mjs > verifyB1 | B1の行をrawログに結び付けるとき、`[chromium] ›` `[firefox] ›` `[webkit] ›` の結果行の確認を再実行していない。組立側（scripts/migration-command/b1.ts の assembleB1）は確認するが、検証コマンドは `source.marker` のある行（hostとnodeの標準出力）しか確認しない。session-browser・install-browser・command-browserの3つのbrowser行は、1つのログのhashに3つのprojectが同じように結び付くだけである。そのため、webkitの結果行を欠くログでも、hashが合えば通る。今回のログに3 projectの行があることは確かめた（ローカルのcommand-8・9・10に各3件以上）が、それは検証コマンドの働きではない。 | 検証コマンドの `verifyB1` で、browserの各行について、そのprojectの `[project] ›` の結果行がログに含まれることを確かめる。欠落した行を拒否する試験を足す。 | Resolved (reviewer) |
| R-03 | Major | .artifacts/migration-command/verify-final-u4.mjs > verifyMeasurement、verifyFinalU4（push／exportの受領記録）、verifyLocal | U3の検証コマンドにあった次の検査がU4にはない。(1) TLSの `issuer`・`subject`・`tlsIssuer`・`tlsSubject`・`tlsProtocol` が `browserSecurityDetails` と一致すること。(2) `hostBefore`・`hostAfter` のbenchmark受領記録。(3) ローカルの証明書trust削除の証拠（`trustRemoved`・`certificateAbsent`・`findCertificate` の終了コード）。(4) export／pushの受領記録（`treeUnchangedBySigning`・ビルド終了コード・source一覧とmanifestの一致）。さらに、U4では次の値が自己参照になっている。`ci.tree` はbindingが自分で作った値と、commit APIを比べるだけで、U3のように `EXPECTED` に固定されていない。ローカルのB1の `sourceCommit` と `preflightEvidenceId` は、検証対象のB1／報告書自身の値を期待値として渡している（`validateB1(b1, { sourceCommit: b1.sourceCommit ... })`）。 | U3より緩めた検査を、U4で落とす理由を記録して承認を得るか、U3と同じ強さに戻す。少なくとも、TLSの3項目とhost benchmark、`ci.tree` の `EXPECTED` への固定、B1の `sourceCommit`（ローカルは `localBase`）と `preflightEvidenceId` を、U1の受入記録の値と照合する。 | Resolved (reviewer) |
| R-04 | Minor | .artifacts/migration-command/verify-final-u4.test.mjs > coverage under 80% / failed B1 row / median over 3000 ms | 拒否の試験が、名前の理由で失敗しているとは限らない。(a) coverageの試験は、`report.lines.pct` と `covered` だけを書き換えて、メッセージを確かめない。検証は先に `equal(report.lines, 再計算した lines)` で失敗するため、80%の判定（`pct >= 80`）には届かない。(b) failed B1の試験は、`assert.rejects` にメッセージの条件がない。(c) medianの試験の正規表現 `/median\|3000\|threshold\|formal/` には `formal` が含まれ、`recomputed formal36 groups` の不一致（groupsを再計算できなかった場合）でも通ってしまう。 | 各試験で、メッセージ（`line coverage 80%`、`check not passed`、`non-download median`）を正規表現で固定する。80%の試験は、再計算が合う生counterを作って、判定そのものに届かせる。 | Resolved (reviewer) |
| R-05 | Minor | README.md > 87行目、docs/command-api.md > 5行目 | 「試験・coverage・B1統合受入・署名付きCIは未検証」という文が、署名付きCI（run 39029827794）まで成功した今の状態と食い違う。「この追加時点で」と日付を限っているが、読者には現状に見える。README.mdは配布packに入るため、直すとsource identityとpackが変わる。 | 直すか、次の公開に向けた変更で一緒に直すと決めて記録する。決めるまでは、未検証の範囲が実機Safariと公開経路だけであることを、code-summary.mdの記述どおりに維持する。 | Unresolved |
| R-06 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u4-command/code-generation/code-generation-plan.md > Summary と項目5 | 項目5の回帰試験の置き場所が、計画では新しいfile `tests/migration-command/blink-log.test.ts` と書かれたままだが、実際は `tests/migration-command/public.test.ts` にある（code-summary.md が記す変更）。source-manifest.json にも blink-log.test.ts はない。計画の本文と実装の記録が一致しない。 | 計画の項目5の本文を、実際の置き場所（public.test.ts）に合わせて直す。 | Unresolved |
| R-07 | Minor | runtime/command.ts > createCommandSession の execute と tests/migration-command/dispatch.test.ts | 空の入力（`''` など）は、取消済みのsignalが付いていても `empty` で成功する。NFR4.1 の「予約の前にabort済みならABORTED」とBR4.3の「予約を取らない」のどちらを優先するかが、設計で決まっていない。この組み合わせの試験もない。 | 設計の判断を functional-spec か rules に1行で記録して、試験を1件足す。 | Unresolved |
| R-08 | Minor | .artifacts/migration-command/trust-cleanup-final-u4.json と .artifacts/migration-command/verify-final-u4.mjs > verifyTrustCleanup | trust削除の受領記録は、削除をmain sessionが観測したという自由記述（`deleteObserved`）と終了コード0の自己申告で、U3の受領記録のように検証用wrapperが実行して残した記録ではない。検証時の新しいkeychain確認は、その時点・その機械で証明書がないことしか示さない。別の機械で検証すれば、削除していなくても必ず通る。 | 記録が観測の申告であり、wrapper実行の証拠ではないことを code-summary.md か受入記録に1行で書く。次のUnitでは、削除をwrapperで実行して受領記録を作る。 | Unresolved |
| R-09 | Major | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u4-command/code-generation/code-generation-plan.md > 6行目 Touches、Step 6（43行目）、Step 8（45行目）、130〜131行目の項目 / code-summary.md > 16行目・28行目・35行目 / traceability.json > 204行目・209行目 | 記録が、新しい土台で削除済みのものを前提にしている。`scripts/migration-command/ci.ts`・`ci-inputs.ts`、`.github/workflows/migration-command-u4.yml`、`mapCommandCICommand` を「作った」「署名付きCIで検証した」と書いている。これらは追跡されておらず、manifest（47件）にもない。traceability.json は ci.ts と workflow を target にしたままで、manifest と食い違う。code-summary.md の source identity（372 file）・pack `61b209ae…`・署名付きhead `9722db3e…`・CI run 39029827794 も、旧い土台の値である。新しい土台（main 2a79860、生成 `.js` と `.github/publication/` は追跡しない、FIRST_PARTY_JS 23件、PACKAGE_FILES 33件）の source には対応しない。 | plan・code-summary・unit-test-instructions・traceability を、新しい土台の source に合わせて書き直す。削除済みのファイルを target から外し、旧い土台の識別子と署名付きCIの結果は「旧い土台での履歴であり、現在の証拠ではない」と明記する。 | Resolved (reviewer) |
| R-10 | Major | scripts/migration-command/completion.ts > runCommandCompletion（291行目 `requireInstallActualSite(root)`、304〜317行目）、scripts/migration-install/actual-site.ts > requireInstallActualSite（164〜172行目） | U3 で人間が決めた論点と同じ形で、U4 の正式受入が追跡コードだけでは通らない。(1) `requireInstallActualSite` は `U2_ACTUAL_SITE` が `.artifacts/migration-install/actual-site` と一致し、その中身が `INSTALL_ACTUAL_SITE_FILES` の固定inventoryに合うことを要求する。この場所を作る処理は、削除済みの `migration-install/ci-inputs.ts` と `ci.ts` にあった。(2) `FORMICARIUM_COMMAND_CI_EVIDENCE`（`recordKind: 'observed-ci-summary'`）を作る処理は、削除済みの `migration-command/ci.ts` にあった。この記録がないと `acceptancePassed` は常に false で、blockers は `['new U4 signed CI not independently verified']` になる（398〜403行目）。(1) の入力もなければ、ローカル専用モードでも completion は最初の行で落ちる。 | U3 と同じ決定を U4 の記録に適用する。ローカル暫定（`acceptancePassed=false`）として扱い、actual-site の用意方法と、正式受入は U1〜U4 のまとめた最終確認と terrarium の受入に回す、と plan・code-summary・unit-test-instructions に書く。追跡コードに actual-site の作り手を足さない場合は、その手順を手作業の前提として明記する。 | Resolved (reviewer) |
| R-11 | Major | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u4-command/code-generation/source-manifest.json > writes | U4 のために追跡されている `mise-tasks/migration/command-browser.sh`・`command-completion.sh`・`command-stage.sh`・`command-unit.sh` の4件が manifest にない。package.json の `migration:command:*` 4 scripts（100〜103行目）を呼ぶ task で、unit-test-instructions.md の46行目と実行手順が `mise run migration-command-*` として使う。manifest が47件で、U4 の実行入口の4件を含まない。 | 4件を manifest に加える。同時に、manifest の47件のうち U4 のものではない共有ファイル（`tests/package/*`、`tests/terrarium/coverage.test.ts`、`tests/tooling/publication-alignment.test.ts`、`scripts/release/inventory.ts`、`scripts/terrarium/coverage.ts`、`tests/migration-install/*`、`tests/migration-preflight/current-completion.test.ts`、`tests/migration-session/reservation.test.ts`）が、U4 の変更として必要かを plan の項目と対応付けて確認する（今回は変更差分を読んでいないので、未確認）。 | Resolved (reviewer) |
| R-12 | Minor | scripts/migration-command/stage.ts > commandSourceInventory（47行目）、scripts/migration-session/stage.ts > sessionSourceInventory（62行目） | source 一覧の収集が `/.(?:ts\|js\|json)$/` で、ビルド後の生成 `.js` も拾う。新しい土台では生成 `.js` を追跡しないので、`sourceFiles`・`sourceIdentity` が、manifest（追跡する source だけ）とも、clone 直後の状態とも一致しない。ビルド前後でも値が変わる。 | 生成 `.js` を一覧に含めるのが意図なら、manifest との関係を unit-test-instructions に書く。含めないなら、収集の対象から外す。後者は U2 の `stage.ts` を変えるので、U1〜U3 の承認に影響する。判断を人間に示す。 | Unresolved |
| R-13 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u4-command/code-generation/traceability.json > NFR8.2 の note | 「新しい土台での試験の成功はStep 15で確かめる（この記録の作成時点では未検証）」が、Step 15 が済んだ今は古い。code-summary.md 5行目の「この節の作成時点では…どれも未実行（未検証）」も同様。 | 両方に「Step 15 で lint・typecheck・build・test:light・unit 91・browser 9 が exit 0（ローカルの暫定）」と一言足して、未検証の語を現状に合わせる。 | Unresolved |
| R-14 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u4-command/code-generation/code-summary.md > 「Status」節（68〜71行目）と「検証の結果」節 | 見出しの下に古い土台の「成功した」（署名付きCI成功、sourceIdentity `cb49d17b…`）が残る。3〜7行目で履歴と明記されているが、節の見出しだけを読むと現状に見える。 | 「Status」と「検証の結果」の見出しに「（旧い土台の履歴）」を足す。 | Unresolved |
| R-15 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u4-command/code-generation/source-manifest.json > writes と code-summary.md 45行目 | `scripts/package/coverage.ts`（383行の許可リストの `command`）はU4が人間の指示で変えたが manifest にない。理由は「U1〜U3が既にclaimしている」だが、同じ理由の `bun.lock`・`tests/migration-install/*` は manifest に残しており、基準が揃っていない。 | 共有fileを残す基準を1つにし（U4が書いた内容が今も残るなら加える）、coverage.ts も同じ扱いにするか、外す理由を書く。 | Unresolved |
| R-16 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u4-command/code-generation/code-summary.md > Step 15 の36試行 | 非download中央値の最大が 2793.58ms（基準3000msの余裕約7%、Biome/Firefox）で、ローカル1回の値。余裕が小さいことは書かれているが、報告の `unit` は `u3-install`（measurement-report.json）で、U4の候補を測った記録であることは candidateSha256 でしか分からない。 | 記録に「measurement-report の `unit` が `u3-install` なのはU3の計測関数の固定値で、`candidateSha256` が U4 の候補と一致する」と1行書く（一致は確認済み: `430189e8…6625`）。 | Unresolved |
| R-17 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u4-command/code-generation/traceability.json > NFR8.2 の note、code-summary.md > 「部品の中身」のworkflow（68行目） | 受入workflowは、Step 27で job に `actions: read` と `GH_TOKEN: ${{ github.token }}` の工程が足された。しかし、NFR8.2 の note と code-summary.md 68行目は「権限は全体とjobで `contents: read`」「contents readだけ」と書いたままで、実際の `.github/workflows/migration-acceptance.yml` 20〜22行と食い違う。「新しい外部write権限を導入しない」という結論自体は、書込み権限がないので成り立つ。 | NFR8.2 の note と68行目の権限の記述に `actions: read`（mainのCI runとartifactの読取り専用）を足し、「書込み権限なし」を明記する。 | New |
| R-18 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u4-command/code-generation/code-summary.md > Step 23–24 の36試行（32行目）と NFR の余裕 | CIの受入runの36試行で、最も遅いBiome/Firefoxの中央値が 2938.28ms（基準3000msに対し余裕約2%）だった。手元の正式確認は 2484.14ms。基準は緩めておらず、passedだが、CIのrunnerの揺れで次のrunでは基準を超えうる。B1の正式な行は観測した1回のrunに結び付いているので、現行のReleaseの有効性には影響しない。 | 受入を再実行する場合は、この余裕が小さいことを判断材料として記録する。基準の変更はしない。 | New |
| R-19 | Minor | .github/workflows/migration-acceptance.yml > 60〜63行目、scripts/migration-command/acceptance-inputs.ts > `main-ci-pitchfork` | 受入runのpitchforkは、同じcommitのmainのCIのartifactから取る。mainのCIが先に成功していることが、人間の運用だけに頼る前提になっている（コメントに書いてあるのみ）。CIが未完でもworkflowは起動でき、`main-ci-pitchfork` が「ちょうど1つのsuccess run」を求めて早く失敗する設計なので、誤った成功になる経路はない。失敗の理由が運用手順に出る点だけが弱い。 | docs/command-api.md の「正式受入の手順」に、mainのCI成功後に実行することと、失敗時の見え方を1行で書く。 | New |

> R-05 Not re-checked this round

> R-06 Not re-checked this round

> R-07 Not re-checked this round

> R-08 Not re-checked this round

> R-12 Not re-checked this round

> R-13 Not re-checked this round

> R-14 Not re-checked this round

> R-15 Not re-checked this round

> R-16 Not re-checked this round

> R-17 Not re-checked this round

> R-18 Not re-checked this round

> R-19 Not re-checked this round
