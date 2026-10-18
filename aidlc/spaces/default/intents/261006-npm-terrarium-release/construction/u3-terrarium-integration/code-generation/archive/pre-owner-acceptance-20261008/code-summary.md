# U3 Code Summary — draft

## 実装

terrarium の aube/pitchfork を通常 dependency の同一 U1 tarballと公開 C1 Sessionへ接続した。legacy Session/Tool は保持する。C3 は既存 Choice と tool/ref/commit を照合し、全 ref 資産と固定23 package fileを digestで配置する。nested cwd は /work に全 entries を置いてから public setCwd で選択する。C4 は queue、UTF-8 stream、event、switch/disconnect と keyboard/focus を保持し、C5 は exact parent/source/origin、隔離とcredentialless対応を guest起動前に検査する。

## 過去のmain観測（今回の合格へ流用しない）

- public adapter/catalog/assets: 26 pass、142 expects。tests/tsconfig 型検査 exit0。
- quote 隣接互換: Red 10 pass/1 fail → 同じ suite Green 11 pass/0 fail。
- C4: 30 pass（10 scenario × 3 browser）。C5: 配信 fixture修正後15 pass、22.3秒。
- bridge consumer: cwd解決 Red → 同じ6 cases Green、12.2秒。
- latest pitchfork2.30.1 build成功、native/U1 Worker version一致。aube2.7.0 は公式musl再利用。
検証済み：fresh generation `47181b67-22c6-4eff-9993-4488e2c103ed` の Node26 cases、browser45 cases は全成功。
固定23 files は1567 lines中1283 covered、skipped0、81.87%で80% floorを満たした。
source identityは `10e59a2ce434302860783e7d0436efda25e21ab2d5a22354d0a06f6f9c23b9f6`、
candidateは `3e3401c5a93bca5c7635d2ba0761bd72125b3421319c6ce054b178e011602983`。
Node receiptはmain親processの実exit0観測から確定し、attemptは
`1284a873-3a20-42d6-88dc-b9d51a1275b5`。今世代46 receiptsと既存U1 immutable component importを区別する。
collectorのmissing raw/旧attempt/nonzero等の負例は9 pass。
結果は `.artifacts/u3-coverage-v1/{inventory,report,coverage-final}.json`。統合前CIは未検証。


## 現在の再開と検証状態

現候補はU1 v8 pack（配布runtime14/全24 files）とU2のsite-repair-v1（aube2.7.0/2.6.1、pitchfork2.30.0）。U2はreview-03 READY・完了承認済み。過去のpitchfork2.30.1とfixed23の結果は異なる入力の観測として保持する。

main観測済み：catalog runner12 pass、formicarium正式build3 steps exit0。Node U3は19件中18 pass/1 fail（旧23file assertion、現24files）。同じ配布在庫への参照をPACKAGE_FILES.lengthへ修正した。sibling正式stageは現packでinvalid package identityのRedを観測し、runtime14/JS inventory・resolver/Worker URL・試験fixtureをmainがsource patchで更新した。新入力16fileを正式prepareへ渡し、固定descriptorの全size/digestを照合した。descriptor identityは `396cd5552bf09beea42e0769701e0be43faf566a7bf6f91092d19d420c41a855`、通常dependencyの更新・frozen install・stage --checkはexit0、lockfileVersion1を保持した。

検証済み（main最終観測）：旧Worker URL監視と旧pitchfork版期待のRed後に試験oracleを修正し、fresh測定Node27 pass/0 fail、三browser45 pass/0 fail（1.3分）、非instrumented bridge6 pass（36.1秒）。formal build3 steps exit0、formicarium U3 Node21 pass/0 fail（baseline検証2件を含む）、Biome U3 TS9filesとsibling8filesは成功。閾値・非実行marker oracle・試験title/件数を維持した。

fresh `.artifacts/u3-coverage-repair-v2/report.json` はexit0、固定24 files、1451/1801 lines、skipped0、80.56%、passedtrue。generationは `e0ed4541-cb8a-46de-815c-d4ffca9a837a`、sourceIdentityは `26cc8d1960fb1bd60147cea98e9ecbad68bf114088d30f9fc7796a8230360c24`、candidateは `711ea20e91ca7cb2e5aa9b91b5dbd3d2e2dbfbfb4aeda40702197449a72f0d4d`。U1 v11の1253元realmはsame-pack/source/maps検証済みimmutable importとして明示し、今回の新規U1実行とは扱わない。

prepareIntegrationのhardcoded baseline Red後、明示40hexのmain観測SHAを必須として保持するよう修正した。Greenは現在parent `0aa94fde1e33230efb96e8763f0fa811ce1cdd80`、同じcandidate/tarballに結合し、`.artifacts/u3-identity-repair-v1/identity.json` へ記録した。基準差分は `verification/terrarium-working.diff`、詳細command/resultはmain-verification.mdへ引き渡す。native review/source admissionとStep11の完了手続は未実施。全体coverage/CIの判定はU4所有。

## 保持する限界

local host の CORP/COOP/COEP 条件での成功を実 GitHub Pages成功とは扱わない。実 Pages headers/configuration、service-worker公開経路、公開RC受入れ、実 Safari、統合前CIは未検証。現固定24分母と80% floorを維持する。外部repoの正規 recorded identity は mainのnative診断待ちであり、この草稿は source-manifest を代替しない。
