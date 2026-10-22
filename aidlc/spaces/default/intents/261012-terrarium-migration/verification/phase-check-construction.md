# FAIL: Construction から Operation への確認

2026-10-22、CI Pipeline の Step 5。人間の回答（`construction/ci-pipeline/ci-pipeline-questions.md` の Q5 A）：Fail のまま記録し、持ち主の段階（U1・U3・U9 の Code Generation）に戻って、各行の状態を直すか、直せない理由を決める。

## Inputs

- `construction/build-and-test/cross-unit-traceability.md`（訂正と再実行の節を含む）と、`aidlc engine sensor-traceability --stage build-and-test` の3回目の出力（`.artifacts/build-and-test/sensor-traceability-3.txt`）。
- 9 Unit の `construction/<unit>/code-generation/traceability.json` を全件読んだ（どれも存在する）。
- `construction/build-and-test/build-and-test-summary.md`（Met 146、Not Met 7、Unverified 10、N/A 7。人間の判断で Accept failure、承認済み）。
- `construction/ci-pipeline/ci-config.md`・`quality-gates.md`。

## Coverage

| 確認 | 結果 | 根拠 |
|---|---|---|
| 全 Unit の build と試験 | PASS | 9 Unit の Code Generation は承認済み、checkpoint は確かめて承認済み。Build and Test で build と最新の道具での全 command が成功（`test-results.md`） |
| 各 Unit の追跡表に未解決の所見が無い | **FAIL** | U1：`OK` 11・**`GAP` 2**（NFR3.2、NFR4.1）。U3：`OK` 19・**`GAP` 7**（FR1、FR6、BR3.10、NFR1.1、NFR2.1、NFR2.2、NFR8.1。正式受入が `local-provisional` のまま）。U9：`OK` 16・**`Deferred` 1**（NFR8.2）。ほかの Unit は `OK` か理由つきの `N/A`（U5 は人間の決定 A：vivarium で実装した行） |
| Unit をまたぐ FR・NFR・AC の門 | **FAIL** | `sensor-traceability` は `pass: false`、未対応：NFR1、NFR2、NFR3、NFR4、NFR8（上の GAP・Deferred の行が原因）。読めない target は0件 |
| CI の門が Build and Test の build・試験の command を強制する | PASS（PR の CI での実行は未検証） | `quality-gates.md` の対応表。足りなかった U1 の preflight・preflight-current と U5 の guest-build の単体は、`ci-required` に入れる変更を PR にする。U2〜U4 の consumer は merge の後の手動の受入（人間の回答 Q2 A）。U1 の preflight のブラウザは CI なし（証明書の一時登録が要る） |

## Verdict

**FAIL**。Construction → Operation の移行を止める。持ち主の段階に戻る：

- U1 の Code Generation：`NFR3.2`・`NFR4.1` の `GAP`。
- U3 の Code Generation：`FR1`・`FR6`・`BR3.10`・`NFR1.1`・`NFR2.1`・`NFR2.2`・`NFR8.1` の `GAP`。
- U9 の Code Generation：`NFR8.2` の `Deferred`。

各行は、今の証拠（Build and Test の実行と CI の run）で直せるものは直し、直せないものは理由を決めて記録する。基準を緩めて通さない。Build and Test が Not Met・Unverified とした行（U1-NFR1.2、U5-NFR8.3、U9 の5件、TC-1、U5-NFR2.2、U4-NFR8.1b、U5-D7-AUTO、後の段階が持つ8件）は、人間が Accept failure と後で扱う所見に決めたもので、ここでは記録だけをする。

これはドキュメントと証拠の整合の確認で、配布・運用の確認ではない。

## 戻りの後の再確認（2026-10-22、CI Pipeline の2回目）

人間の判断で U1・U3・U9 の Code Generation に戻って直し、Build and Test をやり直した（Accept failure、承認済み）。

| 確認 | 結果 | 根拠 |
|---|---|---|
| 全 Unit の build と試験 | PASS | 9 Unit の Code Generation は承認済み、checkpoint は確かめて承認済み。最新の main `e0842371` で lint・検証コマンド・main の CI が成功（`construction/build-and-test/test-results.md`） |
| 各 Unit の追跡表に未解決の所見が無い | **FAIL（1行）** | U1 の `NFR3.2`・`NFR4.1` は `OK`（PR #68）、U3 の7行は `OK`（正式な完了確認 `verified-with-ci`）。残るのは U9 の `NFR8.2` の `Deferred` だけ（JSR の版が残る。人間が失敗のままと承知して記録した） |
| Unit をまたぐ FR・NFR・AC の門 | **FAIL（1件）** | `sensor-traceability` は `pass: false`、未対応は `NFR8`（U9 の `NFR8.2`）だけ（`.artifacts/build-and-test/sensor-traceability-6.txt`） |
| CI の門が Build and Test の command を強制する | PASS | PR #67（merge `2c00ca1a`）で U1 の preflight・preflight-current と U5 の guest-build の単体を `ci-required` に入れ、PR の CI で 57・21・12 件 pass（`construction/ci-pipeline/quality-gates.md`） |

**Verdict：FAIL（未解決は U9 の `NFR8.2` の1行）。** 持ち主の段階（U9）には戻り、直せない理由（JSR は利用者が削除できない）を記録した。この1行を残したまま Operation へ進むかどうかは、人間の判断を求める。

**人間の判断（2026-10-22）**：「U9 の NFR8.2 は失敗のまま記録して、Operation へ進んでください。」この FAIL（U9 の `NFR8.2` の1行）を残したまま、Construction から Operation へ進む。基準は変えていない。JSR の運営への削除の依頼はしていない。

