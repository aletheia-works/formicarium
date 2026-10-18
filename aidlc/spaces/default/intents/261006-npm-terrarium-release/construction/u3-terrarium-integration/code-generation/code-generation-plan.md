# Code Generation Plan — U3 Owner Result Acceptance

## Summary

Builds: 既存U3成果を保持した要件対応の補完、保存証拠の再照合、代替coverage出力先の計画整合。
Touches: U3の計画・試験指示・要件対応・完了資料と新規verification。製品・外部owner・既存候補・証拠は保持する。
Tests: 保存Node48件・bridge6件・固定24JS coverageの同一性照合、代替入力条件の確認、正式レビューとチェックポイント検証。

## Current Recovery Plan — 2026-10-10, Steps13–17

今回のRequest Changesに対する実行対象はStep13–17のみ。下記Step1–12、旧Current Repairとその出力先は過去の実装・測定履歴として保持し、再実装・再生成する指示ではない。今回の計画承認後に着手する。

- [x] Step 13 — mainでrunner/configurationと保存済み証拠を読み取り確認する。`verification/official-restart-20261010-v2/main-results.json`、既存reconciliation、`.artifacts/u3-current-v9-v2`、`verification/audit-current-candidate-v1/coverage-report-v3.json`と対応する元測定を照合する。固定24JS、46receipt、1450/1801行80.51%・skip0、v9 tarball/core/aube/pitchfork2.30.1、owner原参照と保存auditの同一性を実ファイルから確認し、新規verificationへSHA/size付き記録を保存する。未知のaudit追記を推測で許可しない。
- [x] Step 14 — 既存traceabilityの全IDとU4所有Deferredを保持し、U3担当7ACの全条件を名前付き試験・ownerの正式証拠・現在ローカル候補へ対応付ける。FR5/5.1/5.2/5.3/5.4、FR7/7.1/7.2/7.3と関連NFR1/2/3/4/5/7を原文に照らして追加対応する。全体・公開RC・遠隔CI等の残条件はDeferred/GAPと理由・担当を記録し、既存targetの実在だけでOKにしない。owner旧v8/pitchfork2.30.0承認とローカルv9/pitchfork2.30.1の証拠を混同しない。
- [x] Step 15 — `code-summary.md`、`traceability.json`と新規`verification/ci-traceability-repair-v1/requirement-mapping.md`へ反映する。読み取り専用`reconcile.mjs`を同verification配下へ作成しmainが実行する。raw receipt・coverage集約・source/maps・candidate/execution seal・保存結果48/6を照合する。既存source-manifest14件と製品・core・guest・外部owner・旧receipt・失敗世代を保持する。
- [x] Step 16 — 既知Minor R-02の代替出力先不一致を確認し、今回の代替計画を実装が許可する新規`.artifacts/u1-coverage-v<未使用の整数>`へ整合させる。旧`u1-coverage-u3-current-v1`は履歴であり今回の実行先にしない。既存componentImportのパス条件、same-pack/14source/maps/1253realm/80%/SHA検査は維持する。既存の名前付き否定・正常試験を照合し、必要な条件確認だけmainでUnit限定に実行する。現v14 importが一致する間は新規U1測定を行わない。代替経路の実測は実施しない限り未検証と明記する。製品修正が必要と判明した場合は具体的な再現と変更範囲を示して計画改訂へ戻る。
- [ ] Step 17 — main照合結果を完了資料へ反映して独立した正式レビュー、Unit完了、承認済みコマンドによるチェックポイント検証へ進む。固定24全体のcoverage/遠隔CI、公開RC・実配信・全体受入れの残条件をU4/Build and Testへ引き継ぐ。Code Generation全体の完了確認までStopフックを無効のまま維持する。

本計画は重い再build・再prepare・再測定・再pack・外部owner書込み・新承認・公開操作を既定実行に含めない。既存identity不一致は未完了として報告し、期待SHA・state・receiptを手編集して解消しない。Testing Contractと品質基準を保持する。

## Sources and Historical Record

現在directiveはcode-generation / u3-terrarium-integration。主担当はUS4.1/US4.2、C4/C5の既存terrarium接続と受入れ。inception/requirements-analysis/requirements.md、contract-design/contract-summary.md、units-generation/unit-of-work.mdとunit-of-work-story-map.mdを消費する。C1/C2/C3とU1/U2の凍結済み実装・レビューは変更しない。

以前の計画Step1–11、質問・承認、manifestの外部write claims、summaryとtraceabilityは `archive/pre-owner-acceptance-20261008/` に原bytes7件を保存した。旧21 Node/6 bridge/固定24 coverage80.56%は過去の特定source/candidateの観測である。terrarium未登録による旧review拒否と、旧source-manifestが主張した外部変更を取り消した歴史へ書き換えない。本計画は新しい所有境界での再承認を必要とする。

## Ownership and Scope

terrariumのapplicationは正式な所有intent `261008-formicarium-integration-2` で修正・レビューされた成果としてread-onlyで消費する。U3はformicariumローカルの受入れvalidator、consumer検証、candidate-bound証拠、C4/C5対応表を所有する。既存外部claimsを消すだけでreview admissionを通さず、計画承認後の実装と証拠に基づいて現在のsource-manifestを構成する。歴史的外部claimsはarchiveで引き続き参照可能にする。

新規編集対象は `scripts/terrarium/acceptance.ts`、`tests/terrarium/acceptance.test.ts`、必要な既存 `scripts/terrarium/{prepare,evidence,coverage}.ts` と `tests/terrarium/{adapter,assets,coverage}.test.ts`、`consumer.spec.ts`、`serve.ts`、`playwright.config.ts`、`docs/terrarium-integration.md`。正式buildによる対応.jsを含む。既存identity/digest helperはevidence.tsを再利用する。外部repo・旧入力・旧候補・旧receiptは編集しない。collector適合修正は具体的なmain Redがある場合だけ行う。

## Owner Inputs and Identity

正式owner recordは `/Users/mutoakio/Documents/terrarium/aidlc/spaces/default/intents/261008-formicarium-integration-2`。正式receipt `.aidlc-engine/reviews/code-generation/stage/826a9a551ecd3d72/1.json`、request_id `review:00ea057e81e3a59480e2c2297b99eeb6`、source_fingerprint `5fba77e90f0bbc0c52724e6ed63ddb68c813654bc98800c74bc1ccb9734ab53a`、独立review本文、matching code-generation/build-and-test auditのGATE_APPROVED/STAGE_COMPLETEDを消費する。verification/owner-planning-readonly.jsonの原bytes SHA・正確なsource/evidence参照一覧・request/intent/承認完了identityを期待値へpinする。受入れ前に期待原bytesを保存・比較し、単なるREADY文字列を信頼しない。validatorは外部receipt/auditを発行・変更しない。

BT verificationのsource-start/endは78source、集合digest `b70c328cf9d309a18a6dc06eccde0817b0c3a78bf6f7b513ea4cb159beee2f99`。checks.jsonの15distinct command/exit0/log SHA、input-identity-reference.jsonの全16固定path/size/SHA、最新formicarium/legacy candidate start/endのkind/file/link/directory inventoryを実bytesと照合する。入力rootは `.vendor/formicarium-inputs-integration-2`、formicarium siteは `.vendor/site-formicarium-integration-2-bt`、legacy siteは `.vendor/site-legacy-integration-2-bt`（すべてterrarium root相対）。同一入力descriptor396cd555…a855、U1 v8 tgz ebe7e5cf…9dc35、aube2.7.0/2.6.1とpitchfork2.30.0を固定し、公式最新版とは断定しない。

## Acceptance Behavior and Tests

受入れmanifestはowner intent/root、正式review/audit参照、source/input/candidate/checks/log参照と期待identity、取得時刻、ローカルoutを明示する。missing/tamper/source drift/candidate drift/未成立承認/失敗commandを原因別に拒否する。検査完了前に受入れ成功を出力せず、outは未使用 `.artifacts/u3-owner-acceptance-v1` に限定する。元ログとsourceをcopyして架空の実行成功を作らず、外部証拠の観測と今回ローカル実行を別項目にする。

Standardの5–8 meaningful casesとしてacceptance.test.tsに7ケース群を計画する：正常owner受入れ、source78のdigest/集合drift、16input欠落/改変、両candidateのkind/link/bytes drift、15commandのnonzero/重複/欠落、log SHA不一致、READY/request/gate/intent不一致または欠落。C4/C5の実装はownerのterminal/iframe sourceと専用45browser結果へ結び、ローカルvalidatorとbridge試験はその入力を実際に消費する。ownerの136unit・45専用・34legacy/2既存skipをローカル新規試験件数へ合算しない。

## Ordered Steps — Historical Implementation

Step1–6の実装・保存検証は既存summary/current-main-checks/owner-v1の観測履歴。下記checkboxは以前の本文のまま保持し、今回再実行対象や新候補成功を意味しない。Step7の現在完了はaudit不一致により停止。今回のpending修復対象は後述Step8–12のみ。

- [ ] Step 1 — US4.1/US4.2の入力とrunner準備。mainが正式owner READY/段階承認とsource78/checks15/log/input16/最新2candidateの不変照合を記録する。受入れ入力JSON、coverage入力JSON、直接Node/Bunの実体とscoped commandを確定する。既存runnerを正式build後のU3 Node試験で確認し、検証不能を成功扱いしない。
- [ ] Step 2 — C4/C5/C6のローカル受入れvalidatorをacceptance.tsへ実装する。evidence.tsのidentity helperを再利用し、期待集合・path/kind/link/size/digestと正式owner参照を検査する。missing/tamper/drift/未成立承認をfail closedにし、新規outに検証済み参照・取得時identity・制限を記録する。外部sourceやreceiptへ書かない。
- [ ] Step 3 — Step2後にacceptance.test.tsの上記7ケース群を作り、mainが正式buildと同じscoped試験を実行する。owner参照が一致する正常系と各不一致の失敗を実証する。既存不具合の修正が必要ならmainで再現Redを観測してから同じ試験Greenへ進む。
- [ ] Step 4 — US4.1/US4.2の現在入力consumerをmainで検証する。既存ローカル21testsに新規受入れ試験を追加して逐次実行し、現在BT siteを明示したbridge6casesを三browserで実行する。既存C4/C5境界・fixture/cwd/ref・marker非実行oracle・同origin Worker条件を保持する。owner正式136unit/専用45/legacy34+2skipは外部観測として取り込み、今回再実行と呼ばない。
- [ ] Step 5 — C6/NFR3のfresh coverageを固定24（U1十四/U2三/U3七）でmain測定する。未使用 `.artifacts/u3-coverage-owner-v1` に現source/candidate/generationを結合し、fresh Node/三browserを収集する。同packのU1 v11 componentはsource/maps/realm/tgz一致を検査して明示importする。旧U3 source26cc…/candidate711e…の80.56%を現候補へ再ラベルせず、必要なcollector適合だけmain Red→修正→Greenとする。
- [ ] Step 6 — 新しいローカルwrite manifest、docs、summary、traceabilityを作る。US4.1 AC4.1.1–3/US4.2 AC4.2.1–4をowner実装/正式結果/ローカル検証へ対応させ、owner refsとraw digestを保存する。旧external claimsを保存したarchiveへの参照、candidate差分とcoverage適用限界、生成.jsを含む全ローカルwriteを明示する。native sensors、独立U3正式reviewをmainへ渡す。
- [ ] Step 7 — mainが正式review受理・登録とnative Unit完了手続きを行う。未登録外部repoを今回write claimへ戻さず、外部成果は識別されたowner入力として評価する。source admission/review拒否があれば未完了として正式修復へ返し、claim除去だけやreceipt偽装で進めない。公開・外部投稿・U4判定を代行しない。

## Coverage and Quality Constraints

Testing Contractはtest-after/Standard。新規層実装後に対応試験、不具合は再現Red→修正Green。第一者配布JS全体80% floor、未import0、未収集realm失敗、fresh generation/source/candidate binding、旧receipt拒否、統合前CI必須を維持する。U1十四+U2三の基礎17にU3七を加えた固定24を縮小しない。transaction/assembly等のowner開発専用scriptsは別owner回帰検証を消費し、配布分母の閾値逃れへ利用しない。

mainだけがbuild/test/repo操作を逐次実行。probe600秒/aube browser840秒/pitchfork browser600秒Node120秒/1worker/retry0/wasm1GBを保持する。U1/U2 frozen source、guest再build、外部source書込、既存input/site overwrite、framework/state/receipt手編集は対象外。

## Limits and Completion

owner新修正はtransaction保全・履歴namespace保護・legacy tools.jsonのsymlink書込み拒否・明示供給URL契約・正式CodeKB反映を含む。その正式レビューを消費しU3側で再実装しない。78source/15logs/16inputs/最新候補の現bytes照合が成立しない限り正式受入れとは呼ばない。

遠隔CI、公開RC、実Pages/service-worker、実Safari、公開操作、remote供給URLの到達性とU4の全体release判断は未検証・別所有。新計画の承認前にはStep2以降を実装しない。currentmanifest変更は再Approvalとローカル実装後に限り、履歴・旧claimsはarchiveへ保持する。

## Current Repair — Steps8–12 Await Fresh Plan Approval

今回の実行対象は以下Steps8–12。上のSteps1–7/旧owner受入れと測定は特定候補の履歴として保持し、再実行指定ではない。検証済み：mainの新outへのowner受入れ再確認はaudit原bytes SHA不一致でexit1。保存auditとの差分は104行のHuman Turn/Guardrail Loaded/Health Check/Session Resume追記で、既存承認行の削除・変更はdiffにない。現validatorの厳格拒否は維持し、期待SHAを単に更新しない。今回まだ実装修正・現候補検証は未実施。

### Exact Scope and Evidence Boundaries

修正はscripts/terrarium/acceptance.tsとtests/terrarium/acceptance.test.ts、現候補をローカルだけで構成する新scripts/terrarium/current-candidate.tsとtests/terrarium/current-candidate.test.ts、必要なprepare.tsの明示packageRoot入力、consumer.spec.tsの明示選択入力、coverage.tsのコピー専用pitchfork oracle対応と対応coverage.test.ts、docs/記録に限定する。既存evidence helperを使う。外部terrarium、U1/U2 frozen、guest/core、既存候補/input/receipt、frameworkは変更しない。

ownerの正式承認対象はU1v8/旧core4b5c…/pitchfork2.30.0。新しいformicariumローカル候補はU1v9 tarball SHA dfcc3e6384b5ed14ddefbccd4806b9f1be2d858129e74216f116668142571f6d、core a882fb2f3df14115b7e46f6812fb296eef5934d7、aube2.7.0、pitchfork2.30.1/公式commit1054549e85470b08d9507e2c82c850959a4b3914を使用する。v14 coverage-report.jsonをsame-pack明示importする。ownerが新候補を承認したとは主張しない。旧U3固定24の80.56%を新候補へ流用しない。

v14のcomponentImport互換性は事前確認する。tarball/14source/statement-map/予定1253realmが完全一致しない場合、importチェックを緩めず、mainが凍結U1ソース・記録を変更せず新.artifacts/u1-coverage-u3-current-v1で既存U1 collector prepare/固定12Node/全6compiled browser/reportを逐次再測定する。新結果を明示入力にする前に同一pack/maps/realmを再検査し、失敗で停止する。旧v14を書換えない。

### Bounded Audit Append Contract

inputへauditSnapshotのローカル絶対path/固定SHA/bytesを明示し、現在references.auditの旧SHAを維持する。保存snapshotはregular nonsymlink/canonical pathで上限1MiB、旧pin SHAとbyte lengthを照合。現owner auditはstatして最大2MiB、追加は最大256KiB/256event、UTF8 strict decode/NUL拒否、snapshot全bytesが現audit先頭と一致する場合だけ追加を検査する。snapshotと現auditの両原bytes、各SHA/size、追加SHA/event一覧を別々に保存。receipt/review/source/input/candidate/logのpin検証は従来どおり厳格である。

旧snapshot内の正式READY登録/request/source/artifact/receipt digestとGATE_APPROVED/STAGE_COMPLETEDを従来の固定identityで照合。追加部分は完結したMarkdown event blockのみ（見出し/一意bold field/空行/---境界、ISO timestampの非減少・required fields・未知field/重複field/自由文/NUL拒否）。allowlistはHUMAN_TURN(Timestamp/Event/Session)、GUARDRAIL_LOADED(Timestamp/Event/Scope=all/Path=.codex/aidlc-rules//Rule count非負整数)、HEALTH_CHECKED(Timestamp/Event/Request=/aidlc --doctor/Details=整数passed,整数failed)、SESSION_RESUMED(Timestamp/Event/Source=resume/Session)だけ。UUID session、正確な見出しとの対応を確認する。これらは承認の更新や品質成功を意味しない。未知event、revocation、gate/review/stage/plan/sourceのtransition、旧領域改変/削除、途中block、oversizeを必ず拒否。検査中のaudit更新は再照合で拒否し、暗黙retryしない。

### Ordered Repair and Current Validation

- [ ] Step 8 — mainが固定owner13refs/78source/16input/候補69+22/checks15と各log、現local source、v9全24file/tgz/core/guest/v14を読取り確認して新verification/audit-current-candidate-v1へ保存する。今回のmain確認は13refs中12一致/audit不一致であり、全raw logの現在一致はこのStepで確認する。acceptance.test.tsに同bytessnapshot＋許可追記正常、旧prefix改変/短縮、unknown/state/revocation、duplicate/missing/invalid field、未完block/UTF8/size/event上限、受入れ中drift、snapshot pin差替え拒否を追加。mainが正式buildして意図した許可追記拒否Redを観測する。現在audit拒否の既存ログも保持する。
- [ ] Step 9 — approved bounded audit契約だけacceptance.tsへ実装、main正式buildと同じ回帰Green、既存7ケース群保持。mainが新verification/owner-audit-append-input-v3.jsonから.artifacts/u3-owner-acceptance-v3へ実ownerを検査。snapshot/現audit/追加と正式承認identityを記録。旧v1成功/今回v2拒否は保持、owner結果の過去受入れを新候補成功へ結合しない。
- [ ] Step 10 — current-candidate.tsを実装後、5–8 meaningfulケースでv9/tgz/24files・guest/provenance/ref・不足/改変/extra/path/symlink/既存out拒否と外部書込みなしを試験する。mainが新.artifacts/u3-current-v9-v1にowner source/host/config/scriptsの読取りcopyと原SHA一覧を作り、空consumerへ唯一v9を通常npm install --ignore-scripts --no-audit --no-fundで導入。新local guest-siteは既存U2 producerで検証済みaube2.7.0/pitchfork2.30.1 bytes/fixture/build-infoから生成（mainが原build-infoと正規C3 metadata対応を記録、commit推測なし）。外部stageFormicariumの正式関数をread-only importし、明示packageRoot/packageManifest/guestSite/resolverRoot/webRootで新local site/webへstage、Bunでcopied src/index.tsをbundleする。owner136/45/34+2skipを新検証件数へ合算しない。外部dependencyは読取り参照としてidentityを記録、install先/生成先はlocal新dirのみ。
- [ ] Step 11 — mainが新候補のconsumer6件を三browserで実行。consumerのpitchfork ref/versionは明示v2.30.1固定oracle、aubeは2.7.0固定。copied owner terminal/iframe専用45caseも現pack/guest候補で実行しC4/C5/current source互換性を検証する。copied terminal specの既存v2.30.0期待3箇所だけ2.30.1へ明示変更し、title/件数/その他assertを維持、変更一覧SHAを保存（新候補テストoracleでowner sourceを書換えない）。fresh.artifacts/u3-coverage-current-v9-v1へ固定24＝14+3+7をprepare。packageRoot/tgz/v14、local terrarium source/siteに結合しbundle→seal→Node→三browser45→report。U1 importはv14の14source/map/tgz/1253realm/80%をstrict検査、U3/U2 countersはfresh実測、未import0/欠落失敗/skip0/80%以上を要求する。必要collector対応はmainの意図したRed→最小修正→新dirGreenのみ。旧repair/owner世代を補完・再ラベルしない。失敗時正式停止し追加retry/期限延長なし。
- [ ] Step 12 — docs/summary/source-manifest/traceabilityと全commands/raw/digest/beforeafterを現在local owner受入れ・新候補検証へ別々に結合。歴史archive/旧失敗とremoteCI/RC/Pages/serviceworker/このU3候補の実Safari未検証を維持。mainがnative sensors/正式review/Unit手続を行う。review前に全write凍結。外部owner新承認、公開/push/PR/deploy/U4release判断はしない。


## Testing Contract

```json
{
  "version": 1,
  "methodology": "test-after",
  "source": "team",
  "ordering": "通常の新規実装は各テスト可能な層を実装した後にその層のテストを作成・実行し、不具合修正は再現テストの失敗を先に観測してから修正し同じテストの成功を確認する。（人間の回答 Q3）",
  "scope": "classic",
  "test_strategy": "standard",
  "project_type": "brownfield",
  "applicable_notes": [
    {
      "layer": "org",
      "text": "We treat tests as a first-class deliverable in every Bolt. The specific\nmethodology (TDD, BDD, ATDD, or classic test-after) is affirmed at\npractices-discovery and recorded in `team.md` under this heading with explicit\n`Methodology` and `Ordering` fields; Code Generation resolves those fields\nindependently from coverage, tooling, and scope notes.\n\nWhen no posture has been affirmed, our default per scope is:\n- **Methodology**: test-after\n- **Ordering**: implement each applicable testable layer, then write and run\n  that layer's tests.\n- `mvp`, `enterprise`, `feature`, `infra`, `classic` add an 80% line-coverage\n  floor and CI execution before merge.\n- `bugfix`, `security-patch` add a targeted regression for the specific\n  bug/vulnerability and require the existing suite to remain green.\n- `express` uses the Minimal strategy: requirement-driven unit tests (one per\n  requirement, with a happy-path floor per component); existing tests remain\n  green.\n- `poc`, `refactor`, `workshop` add no extra new-test floor and require the\n  existing suite to remain green.\n\nThe active `Test Strategy` still applies in every scope and determines test\nvolume/types. Scope floors are additive; they never reduce or replace the\nselected strategy.\n\nBuild and Test verifies defined coverage floors and affirmed quality targets;\nthey may not be weakened to make a step pass.\n\nAffirm a stricter posture in `team.md` if the team commits to one."
    },
    {
      "layer": "team",
      "text": "- **Methodology**: test-after\n- **Ordering**: 通常の新規実装は各テスト可能な層を実装した後にその層のテストを作成・実行し、不具合修正は再現テストの失敗を先に観測してから修正し同じテストの成功を確認する。（人間の回答 Q3）\n- node:test と Playwright の既存結合テストを利用する（検証済み：package.json scripts、code-quality-assessment.md）。今回の成功結果・coverage 値は未検証。\n- classic の追加条件は行 coverage 80%以上と統合前 CI 実行（ドキュメント根拠：org.md Testing Posture）。基準を下げて通過させない。\n- coverage の技術提案（未実装・未検証）：第一者が保守する配布 JS 全体（既存 runtime の未変更ファイル、共通処理、公開 API、Node/browser Worker adapter を含む）の一覧を事前に固定し、未実行ファイルも分母に含める。tests、生成 blink JS/wasm、第三者/vendor、ゲスト ELF、.d.ts、デモ・開発専用 scripts は理由を明示して対象外とし、資産・型・回帰検証を別途行う。設計で配布対象を確定し、閾値達成のために除外を変更しない。\n- Worker/ブラウザ内の計測を収集・マージし、対象一覧と照合して欠落を検出する。未収集ファイルを分母から外さず0%または未測定として失敗／未検証を報告する。計測方式は担当者が未importファイル・別process/realmを含む試験を観測して選ぶ。対象一覧、除外理由、行数、レポート、実行コマンドを CI 成果物へ残す。ブランチ coverage の新しい数値条件は追加しない。\n- 既存上限は probe 600秒、aube ブラウザ840秒、1worker、retryなし、probe 8項目全通過、native 出力一致、wasm 1GB。テストは main session が逐次実行する（人間の指示：AGENTS.md）。\n- aube はソースが変わっていなければ再ビルドしない。計測は重い並行処理なしで行う。新しいコア不具合の回帰 probe は native Linux でも確認する。\n- npm tarball の import/Worker/型/wasm・notices・build-info の同梱確認は設計候補（推測・未検証）。ゲストと fixture は terrarium 側の ref 別配布という既存意図を維持する。"
    }
  ],
  "obligations": {
    "strategy": "standard",
    "strategy_volume": [
      "Five to eight tests per component.",
      "Unit tests plus integration tests for key boundaries.",
      "Add E2E, performance, or security tests when requirements demand them."
    ],
    "scope_floor": [
      "Keep the existing test suite green.",
      "This scope adds no extra new-test floor beyond the selected test strategy."
    ],
    "combination_rule": "Apply every selected-strategy obligation and every scope-floor obligation; neither replaces the other, and a targeted scope regression may add the narrowest necessary test type beyond the strategy default."
  },
  "plan_profile": {
    "methodology": "test-after",
    "runner_step": "Verify the existing test runner/configuration and record the exact unit-scoped command.",
    "runner_ready_before_first_test": true,
    "testable_layers": [
      "Data model / database behavior",
      "Repository / data access",
      "Business logic",
      "API / endpoint",
      "Frontend behavior"
    ],
    "steps": [
      "Project structure and production configuration skeleton.",
      "Verify the existing test runner/configuration and record the exact unit-scoped command.",
      "Data model / database behavior - implement.",
      "Data model / database behavior - write and run its tests after implementation.",
      "Repository / data access - implement.",
      "Repository / data access - write and run its tests after implementation.",
      "Business logic - implement.",
      "Business logic - write and run its tests after implementation.",
      "API / endpoint - implement.",
      "API / endpoint - write and run its tests after implementation.",
      "Frontend behavior - implement.",
      "Frontend behavior - write and run its tests after implementation.",
      "Environment/build configuration.",
      "Documentation and traceability."
    ]
  },
  "input_sha256": "sha256:dd7d634a9c475bfe0b7fdd87b1566bd3f238a9b0ead389ae268b08de9bf333f2",
  "contract_sha256": "sha256:ce013e1551c9c06de1a756c04942d606c8dffe82caf0ae8422f95df28968c638"
}
```
