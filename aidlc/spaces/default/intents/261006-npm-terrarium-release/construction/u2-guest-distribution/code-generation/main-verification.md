# U2 修正の main session 検証

## 承認と前提

2026-10-08、session `01a11a7d-8872-75b2-a756-163fa84584f3`。更新計画の人間回答 `Approve Plan` を正規の answer に記録し、`PLAN_APPROVAL_RECORDED` と `testing-posture begin` の generation を観測した。TypeScript の正式build 3段階と manifest baseline 7 pass は検証済み。

## 修正前の失敗

Node実体 `/Users/mutoakio/.local/share/mise/installs/node/24/bin/node` を使用。各commandを main が逐次実行。

- 検証済み：`node scripts/guest-distribution/coverage.js self-test` exit 1、`Missing expected exception: stale generation in node-host must be refused`。測定identityを変更しても採用される。
- 検証済み：正式build3段階exit0の後、`node --test tests/guest-distribution/stage.test.js` は7 pass/4 fail（新規親groupと3 subtests）。保持guestのENOENT、既存root必須とdigest改変の拒否欠如を観測。
- 検証済み：`U2_ACTUAL_SITE=<site-v2絶対path> node --test tests/guest-distribution/integration.test.js` は5 pass/3 fail。新規synthetic保持refの `build-info: HTTP 404` が対象欠陥のRed。実資産2caseは既存site-v2のtools.json欠落による `tools: HTTP 404` で、修正対象のRedとは区別する。
- 初回 tests compileのTS2339は試験側の型準備不備。修正後compile成功。compile失敗後の古いemitによるstage7pass/integration結果は修正の証拠に採用しない。

## 候補の前提

site-v2にtools.jsonおよび元stage-input/latest-verification JSONが存在しないことを観測。guest/全fixture/build-infoとdist/builds.jsonは残っている。`verification/prepare-u2-repair-candidate.mjs` が全3buildの全資産digestを元manifestと照合して成功し、producer入力JSONを生成した。toolsのdefault/fixture/cwdは明示したローカル検証用値であり、失われたcatalogueの復元や実配信の証拠とは扱わない。新候補を正規stage処理から生成し、旧候補は書換えない。ゲスト再build/取得は行わない。

## 修正後

検証済み：同じcollector self-testはexit0、producerは11pass/0fail。正式build3段階とconsumer tscはexit0。Biome対象10ファイルexit0（変更4ファイルを整形後）。新規site-repair-v1を正規producerが11filesとして生成した。全5Node fileは40pass/0fail/0skip、実aube二ref/pitchforkのHTTP取得も成功。非計測browserは正式ホスト権限で3browser15pass（10.2s）、1worker/retry0。

初回browserはsandboxのMach port permission deniedで起動不能となり15failed。auto-reviewを通したホスト権限で同じ試験が成功。保護設定/ブラウザー設定/品質基準を下げていない。

初回coverage-v1は共通helper tests/shared/assertions.js欠落で33pass/1fail。collectorコピーとself-testを修正、正式build後新規coverage-repair-v2をprepareし、Node40pass/0failとbrowser15pass（10.9s）を再収集した。計測browserのフルpath filterがNo tests foundを返したため、--listで同じconfigの15caseを確認し、filterなしで同じ15caseを実行した。v1は採用しない。

report exit0：固定3files 249/254行=98.03%、passed:true。generation=e8232136-10f5-406a-9b67-464e0a65cba0、sourceIdentity=7453f02908538a6726f5527deaeb805a45fa1e4d7cf6ff4e89abf7ccb1f6de54、candidateSHA256=cecdee3b22326cfad71641616d0031e1f39d121a12160fb55fba53048869f9d7、全20receipt照合。正本は.artifacts/u2-coverage-repair-v2/report.json。

構造sensor plan pass、traceabilityは他UnitのAC25件不足だけ（U2 gaps/orphans/invalid entries/targets空）。レビュー/Unit checkpointはこの時点で未完。

## Retry：旧形式refだけを保持する場合

検証済み：review-02が残件を指摘し、mainの隔離再現でexistingRoot省略でもlegacy.old.wasmのmetadataを残したcandidateが生成され、該当assetはENOENTだった。人間のRetry回答をQUESTION_ANSWEREDへ記録し、UNIT_RESUMED後に同一の承認済み計画内で修正した。

回帰追加後の正式build3段階exit0→同じproducer commandは10pass/2fail（parent+legacy-only subtest、Missing expected rejection）。root必須検査をschema判定の前へ移動し、既存test fixtureも実際のlegacy資産とrootを供給する形にした。旧assertionとroot省略の拒否条件を維持。mainの同じcommandで12pass/0fail、全5Node file41pass/0fail/0skip。正式build/consumer型/Biome対象10files/collector self-testもexit0。

新規coverage-repair-v3で全Node41pass、3browser15pass（11.4s、1worker/retry0）を再収集。report exit0、249/254行98.03%、20receipt、generation=976e4419-c417-45ce-a819-46a1ab6c148c、sourceIdentity=7453f02908538a6726f5527deaeb805a45fa1e4d7cf6ff4e89abf7ccb1f6de54、candidateSHA256=cecdee3b22326cfad71641616d0031e1f39d121a12160fb55fba53048869f9d7。配布3JSとcandidateは不変で、新しい測定結果を別generationへ結合した。現在の測定正本は.artifacts/u2-coverage-repair-v3/report.json。code-summaryのv2/40件は前回の履歴として維持し、凍結済み成果物は変更しない。

REVIEW_REQUESTED iteration2は正規toolからrecovery:stale-receiptとして受理。最終レビュー・Unit checkpointは未完。
