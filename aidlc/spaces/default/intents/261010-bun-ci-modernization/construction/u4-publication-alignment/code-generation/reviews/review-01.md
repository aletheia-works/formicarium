## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-10-10T16:22:34Z
**Iteration:** 1

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Minor | scripts/release/bootstrap.ts > verifyTransfer inputMembers / scripts/release/publication-cli.ts > gatePublication / scripts/release/evidence.ts > artifactBytes | 設計で定めたJSON/metadataの8MiB上限はAPI応答・candidate report・policy等には適用されるが、inputs.tgz内のrequest.json、publication.json、証拠envelope・inventory等には適用されない。unpackTarは総展開512MiBだけを検査し、artifactBytesはサイズ制限なしでreadFileを返すため、8MiBを超えるJSONも書込jobで読込・解析する経路が残る。固定入力SHAと総展開上限で影響は限定されるが、個別上限の保証は不完全。 | 公開入力内のJSON/manifest/metadataを8MiB以下へ制限し、展開後のrunner起動前と直接CLIのJSON読込前に拒否する。8MiB境界と超過を試験し、超過時runner/公開executorが0回であることを確認する。tarball・ログ等に必要な別上限は区別する。 | New |

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| source-manifest・traceabilityのRuby読取検査 | PASS：所有宣言30パスが存在、FR8/FR9と詳細NFR11件の13 targetが存在しID集合が一致 | 検証済み。source/config/workflow/READMEの所有と参照に欠落なし。 |
| 生成物のRuby SHA256/size検査 | PASS：generated-artifactsのtracked4件とrunner-manifestの期待ファイルが実bytesに一致 | 検証済み。再生成の実行自体はmainの観測を参照し、レビューでは再実行していない。 |
| 実装・共有C2・candidate workflowの静的照合 | PASS：candidate-requiredの独立producer/run/attemptと9必須検査のacceptance形式を照合、署名入力内reportとの実bytes一致、固定inventory/receipt/80%を保持 | ドキュメント・source根拠。APIの成功fixtureだけを実GitHubでの動作証拠に読み替えていない。 |
| main sessionのlocal-observations | 新規U4 50 pass/0 fail/0 skip、既存release61 pass、5 tasks全exit0、tooling206 pass、既存light177 pass/2 skip、固定npm integrity/実Node CLI版・bundle再現・actionlint/shellcheck成功の記録 | 実行者と対象が明記された既存観測を参照。レビュー自身のbuild/testは未実施。 |

### Summary

1件のMinorを報告する。先行設計で不足していた信頼開始点は、固定tag SHA checkoutのtracked Node builtin bootstrapと同checkoutのpolicy/manifestへ具体化されている。転送bootstrapの混入を拒否し、runnerのhash/bytes、固定npm integrity、安全archive、input SHA、独立API観測を確認する前に転送runnerを起動しない。writerのinstall/buildは除去され、既存署名入力gate、source/provenance/版別承認、strict stable/RCと対応channel、stableの同基底RC受入れ、操作最大1回・unknown再送なしが保持されている。

外部IDsがnull、writerEnabled=falseであるため現設定は拒否する。実GitHub CI/OIDC/npm公開/Releaseと、今回の実candidateに結び付く回帰・全realm80%は未検証であり、ローカル試験成功から公開可能とは結論しない。U3の既存Major2件は別所有のままで、この実装の解消事項として扱わない。
