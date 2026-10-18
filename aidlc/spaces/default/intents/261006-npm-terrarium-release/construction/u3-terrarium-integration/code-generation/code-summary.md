# U3 Code Summary — Formal Owner Acceptance

## Current Traceability Recovery — 2026-10-10, Steps13–17

承認済み計画に従い製品・source-manifest14件・旧owner/候補/検証結果を保持し、要件対応記録とread-only helperを追加した。既存25ID（U3 AC7/U4 Deferred18）を保持し、FR5/5.1–5.4・FR7/7.1–7.3・NFR1/2/3/4/5/7の15IDを補完、全40件。FR5.1/5.2/5.3/FR7.2はU3の証拠へ対応、全体要件・公開RC・実配信・遠隔CIの残条件はDeferredとしてU4/Build and Testへ引き継ぐ。全条件と名前付きoracleは `verification/ci-traceability-repair-v1/requirement-mapping.md`。

検証済み（main観測）：新helper `verification/ci-traceability-repair-v1/reconcile.mjs` exit0、固定24・保存raw46receiptの全file別counter/source/maps・candidate exact inventory・execution seal・immutableU1v14import・保存48Node/bridge6結果構造・owner12refs/audit exact保存受入れが一致。1450/1801行80.51%・skip0、世代6e347c83-aca9-48b2-90bf-e0ce5ad9bb7d、execution2942cf1d2190942b222f57a24bde0be33015ef8c85bd0abb8bdb31509de30180。main-reconciliation.jsonのreadArtifactsに原bytes SHA/sizeを保存した。保存48/6やcopied45を今回の新規実行へ足さない。

検証済み（今回main実行）：直接node24の `node --test tests/terrarium/coverage.test.js` は16pass/0fail/0skip、946.342916ms。結果・名前付きcaseは `verification/ci-traceability-repair-v1/main-tests.json`。runnerはworkers1/retries0/fullyParallelfalse、Chromium/Firefox/WebKit、840秒。許可条件・品質上限は保持。

R-02の計画不一致は承認済みStep16の代替出力先 `.artifacts/u1-coverage-v<未使用整数>` により整合した。ソースのabsolute/coverage-report.json/整数basenameと同pack/14source/maps/1253realm/80%/SHA条件は変更なし。main helperが原v14 import正常、旧不適合basename拒否、整数basename正常をメモリ内で確認した。新出力を作成せず、代替collectorのend-to-end測定は未検証。下記旧節の「未修正」は当時の履歴として保持する。

owner正式承認は旧v8/pitchfork2.30.0、現在ローカルはv9/pitchfork2.30.1。実Safari（今回U3候補）、遠隔CI、公開RC/実Pages/service-worker/remote供給URL、FR7/native/probeのrelease全体集合は未検証。Step17正式レビュー・Unit完了・チェックポイントはmainのengine手続がこれから行う。StopフックはCode Generation全体完了まで無効。

## Official Restart — 2026-10-10, Current Attempt

検証済み：正式な再開始後、mainが5 scoped Node filesを逐次実行し48成功/失敗0/skip0（4174.611709ms）、現v9-v2候補のbridgeを三browserで6成功（12.5秒、1worker/retry0、pitchfork v2.30.1）、8TS Biome check exit0（39ms、修正なし）を観測した。今回のcommandと結果は`verification/official-restart-20261010-v2/main-results.json`へ新規保存した。旧verificationと実装修正は保持し、application source、承認済み計画・検証手順の本文は変更していない。

検証済み：mainのread-only reconcileはexit0。固定24、保存46receipt、1450/1801行、80.51%、skip0、generation `6e347c83-aca9-48b2-90bf-e0ce5ad9bb7d`、execution `2942cf1d2190942b222f57a24bde0be33015ef8c85bd0abb8bdb31509de30180`が一致した。owner pin12参照、audit snapshot111851bytesと現113715bytesが保存受入れと一致する。今回の新測定・再pack・guest再build・外部owner新承認を意味しない。v9/pitchfork2.30.1ローカル成功とowner旧v8/pitchfork2.30.0承認を区別する。

既知Minor R-02：計画のfallback out `u1-coverage-u3-current-v1`と`componentImport`の`u1-coverage-v[0-9]+`条件の不一致は未修正。現v14 strict import成功には影響していないが、fallback経路の成立は未検証であり再レビューへ引き継ぐ。実Safari（このU3候補）、remote CI、公開RC、実Pages/service-worker、remote供給URLは未検証。正式レビュー・Unit完了・全体完了はmainのengine手続で判定し、Stopフックは無効のまま保持する。

## Official Code Generation Recovery — 2026-10-10

承認済み計画の既存Steps8–11実装・候補・失敗世代を保持して、正式再レビューへ渡す。今回のapplication source変更・再build・guest再buildはない。source-manifestの14ローカルwrite claims、traceabilityのU3担当7ACとU4担当Deferredは保持する。Step12の正式review/Unit完了はmainのengine手続で判定し、この追記で承認を代行しない。

検証済み（今回main実行）：5 scoped Node filesは48成功/失敗0/skip0、4.313秒。現`u3-current-v9-v2/site`を配信し、pitchfork refをv2.30.1へ明示したbridgeはChromium/Firefox/WebKitで6成功、13.4秒、1worker/retry0。8TSのBiome checkはexit0、修正なし。正確なcommandと結果は`verification/official-recovery-20261010-v1/main-results.json`。

検証済み（保存証拠と現bytesのread-only照合）：v9 staged24file、同pack U1v14の14source/maps/tgzと1253realm strict import、pitchfork2.30.1 commit/build-info/ELF/build logのprovenanceが一致。固定24の現source、candidateの正確なinventory、execution seal、immutable U1 report、46receiptを照合して保存counterを再集約し、1450/1801行、80.51%、skip0が保存reportと一致した。これは新coverage測定ではなく、既存v3世代`6e347c83-aca9-48b2-90bf-e0ce5ad9bb7d`の同一性確認である。copied owner terminal/iframe45caseとcoverage browser45caseの過去成功を今回のfresh6件へ合算しない。

検証済み：外部ownerのaudit以外12原参照はpin SHAと一致し、固定audit snapshot111851bytesを変えず、現113715bytesの原bytes SHAは保存v3 acceptanceと一致した。既に検査済みの1864bytes/13許可event以降の変更はない。owner承認の対象は旧v8/pitchfork2.30.0であり、今回v9/v2.30.1の新owner承認とは呼ばない。`verification/official-recovery-20261010-v1/reconcile.mjs`は原証拠へ書かず、`reconciliation.json`にmainのexit0観測を保存した。最初の補助scriptの相対owner参照解決失敗は補助script修正履歴として残し、product Redやcoverage失敗として扱わない。

未検証：このU3候補の実Safari、remote CI、公開RC、実Pages/service-worker、remote供給URL到達性。外部owner source/receipt、旧候補・測定、U1/U2 frozen source、core/guestは維持し、公開・push・PR・U4 release判断は行っていない。

## Current Repair and Candidate Validation — 2026-10-10

以下の旧owner-v1の数値は歴史的観測。今回の正式owner受入れv3と現候補v2を別々に記録する。現在write claimsは14ローカルTS/docs。外部ownerはread-only、U1/U2 frozen、guest/core再buildなし。

検証済み（main観測）：audit元snapshotのSHA/111851bytesを変更せず、現audit113715bytesの完全prefixと1864bytes/13許可eventを検査し、`.artifacts/u3-owner-acceptance-v3/acceptance.json`へ保存した。未知event/state/revocation/旧領域改変を拒否し、取得中driftの決定的回帰も通過した。この受入れはownerのU1v8/pitchfork2.30.0の過去承認・実行であり、新候補の承認ではない。

現候補は`.artifacts/u3-current-v9-v2`。v9 tgz SHA `dfcc3e6384b5ed14ddefbccd4806b9f1be2d858129e74216f116668142571f6d`、clean core `a882fb2f3df14115b7e46f6812fb296eef5934d7`、aube2.7.0/pitchfork2.30.1を消費する。正式U2 producerで元10資産のsize/SHAを維持し、固定toolsからpitchfork.defaultのみ変更した新11資産・入力16を生成する。owner source78とは別の固定gen-css.ts/CSS/LICENSEも記録する。mainの通常npm install、宣言済みgen、Bun bundle後、正式owner assembleCandidateへ明示local sourceRoot/inputs/destination/bundle callbackを渡して完全なhost/root入口/LICENSEを組み立てた。外部ownerの既定buildは実行しない。

検証済み：main最終scoped48件全成功/fail0/skip0（scoped-node-final-v3.log）、8TS Biome check exit0。v2 assembly completed_ready、bridge6件全成功12.7秒、copied owner terminal/iframe45件全成功1.0分。新候補の版oracleはコピーの3箇所だけ変更し、owner source/旧candidateは保存。bridge/45caseの配信rootは`site`（hostが`/web/terrarium.mjs`をimport）、bundle出力は`site/web`。先のsite/web配信の中断とv1のiframe入口欠落失敗は保存し、成功として合算しない。

collector v2 sealは外部member symlinkで正式拒否した。新collectorは依存をdereferenceしてowned bytesへコピーし、cycle/special/source前後/コピーidentityを検査する。seal/verifierの拒否を緩めていない。mainのcoverage回帰16件全成功、fresh v3 prepare/bundle/seal成功、Node30件/155assertions成功、browser45件全成功1.3分。report exit0、固定24の1450/1801 lines、80.51%、skipped0、passed=true。U2/U3はfresh実測、U1v14は明示importである。

fresh v3 generation `6e347c83-aca9-48b2-90bf-e0ce5ad9bb7d`、source `ba1deaee3e5ff17b94931e5f2abcfa18ab66ea6dc321fac06ce25b78da2c5d49`、candidate `2b62bb57a2c757a30ffa88609ebc605191b438510e98796b6d93df9570208e26`、execution `2942cf1d2190942b222f57a24bde0be33015ef8c85bd0abb8bdb31509de30180`。同pack U1v14の14source/maps/tgz/1253realmはstrict importをmain確認済みであり、今回U1を再実行したと呼ばない。根拠は`verification/audit-current-candidate-v1/`のinputs/commands/logs/raw identities。旧固定24の80.56%を新候補へ流用しない。

このU3候補の実Safari、遠隔CI、公開RC、実Pages/service-worker、remote供給URL到達性は未検証。U1の別候補Safari結果やownerの過去承認を今回へ移さない。review/Unit完了/公開判断はmainの正式手続で判定する。

## Historical Owner-v1 Behavior and Ownership

terrariumのC4/C5実装を正式owner intent `261008-formicarium-integration-2` の承認済みConstruction成果としてread-onlyで受け入れる。formicariumは `scripts/terrarium/acceptance.ts` のvalidatorとローカルconsumer・coverage検証を所有する。外部source/receiptを書き換えず、旧25 external claimsと旧計画・summaryは `archive/pre-owner-acceptance-20261008/` に保持した。現在source manifestは12ローカルapplication-source claimsである。生成.jsを含む20件の検証生成物参照は verification/generated-evidence-references.json に分離し、変更前32件の一覧は archive/source-manifest-with-generated-evidence.json に保存した。

## Validation Contract

正式READY receiptのrequest/source/artifact、独立review本文、matching auditのcode-generation/build-and-test承認・完了を照合する。78source、16input、両candidate inventory、15distinct成功commandとlog原bytesを期待SHAに結合する。path traversal、symlink ancestor、集合の欠落・追加・重複、kind/size/bytes drift、未成立承認を拒否する。完了前に出力せず、未使用outへ29原参照とacceptance.jsonを排他的に保存する。歴史的外部実行を新しいローカル実行とは扱わない。

## Historical Owner-v1 Observed Verification

検証済み：mainの正式TypeScript product/test build、emit、11ファイルBiome checkはexit0。scoped Node testsは28成功（既存21+新規7ケース群）、失敗0/skip0。ログ・時刻・argv・cwd・SHAは `verification/current-main-checks.json`。

検証済み：実owner入力のacceptance実行exit0、`.artifacts/u3-owner-acceptance-v1/acceptance.json`。現BT siteに対する3browser consumerは6成功。fresh coverage Node30成功/155assertions、3browser45成功、1worker/retries0。固定24sourceの1451/1801行、80.56%、skip0、passed=true。`.artifacts/u3-coverage-owner-v1/report.json` にgeneration/source/candidate identityを結合した。同packのU1 v11証拠は明示importであり今回再実行ではない。

## Historical Owner-v1 Provenance and Corrections

owner source inventoryは `b70c328cf9d309a18a6dc06eccde0817b0c3a78bf6f7b513ea4cb159beee2f99`。coverage sourceは `26cc8d1960fb1bd60147cea98e9ecbad68bf114088d30f9fc7796a8230360c24`、新candidateは `45e230fb6541e26683b313b9d5e28101296d0f80aa434f49d561123fcb0c120e`、generationは `08c74c3b-bafa-43cf-a251-15bd5c212633`。旧candidateの結果を再ラベルしていない。ownerの136unit/45専用browser/34legacy+既存2skipは原ログ照合済み歴史的外部結果。

main Redではinventory順序比較とcommand cwd検査が実ownerを拒否したため、順序をcanonical比較し、正規owner rootとpackages/terrariumだけを許可した。fixture tmpdirのmacOS aliasによる4失敗はfixture realpathで修正し、原因別否定検査を維持した。最終7ケース群/実owner受入れはGreen。

## Requirements and Limits

US4.1 AC4.1.1–3、US4.2 AC4.2.1–4を `traceability.json` / `traceability.md` にowner正式成果と現在ローカル検証へ対応付けた。C1–C3/U1/U2 sourceは凍結維持、guest再buildなし。実装詳細と履歴は `docs/terrarium-integration.md` 9節。

未検証：遠隔CI、公開RC、実Pages/service-worker、実Safari、remote供給URL到達性。U4の全体release判定・公開・PRは未実施。正式U3レビューとUnit完了は本summaryによって代行しない。
