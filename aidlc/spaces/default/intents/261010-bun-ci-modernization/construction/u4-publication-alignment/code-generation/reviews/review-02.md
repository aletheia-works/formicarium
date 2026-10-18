## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-10-10T21:03:22Z
**Iteration:** 1

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Minor | scripts/release/bootstrap.ts > verifyTransfer inputMembers / scripts/release/publication-cli.ts > gatePublication / scripts/release/evidence.ts > artifactBytes | 設計で定めたJSON/metadataの8MiB上限はAPI応答・candidate report・policy等には適用されるが、inputs.tgz内のrequest.json、publication.json、証拠envelope・inventory等には適用されない。unpackTarは総展開512MiBだけを検査し、artifactBytesはサイズ制限なしでreadFileを返すため、8MiBを超えるJSONも書込jobで読込・解析する経路が残る。固定入力SHAと総展開上限で影響は限定されるが、個別上限の保証は不完全。 | 公開入力内のJSON/manifest/metadataを8MiB以下へ制限し、展開後のrunner起動前と直接CLIのJSON読込前に拒否する。8MiB境界と超過を試験し、超過時runner/公開executorが0回であることを確認する。tarball・ログ等に必要な別上限は区別する。 | Resolved (reviewer) |

> R-01 Reviewer note: TARのJSON宣言サイズとZIPの宣言・実展開サイズを個別8MiBへ制限し、bootstrapの入力展開検査はrunner起動に先行する。直接CLI、証拠envelope、coverage report/inventory、publisher観測、policy/manifest等の解析前にbounded readerを接続した。拡張子によらないJSON用途にも明示上限を渡し、実読込が上限+1へ達した時点で拒否・closeする。上限丁度の正常経路と超過時runner/executor 0回の試験、およびmainのRed→Green観測を確認した。

> R-01 Earlier decision: Accepted risk

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| 読取専用JSON・存在・SHA256/サイズ照合 | source-manifestの30pathが実在。generated-artifactsの100件すべて実bytesのhash/サイズ一致。runner-manifestの2件も一致。traceabilityの13 IDに対応先あり。 | sourceとtracked bundle、ignored生成JS/mapsの記録が現在の実ファイルに対応する。再生成そのものはmainの観測記録を参照した。 |
| 静的境界確認 | readBoundedFileは64KiB以下の読込を行い、残容量+1を検出してparse前に拒否しfinallyでclose。TAR/ZIP検査、bootstrap、直接CLIの接続を確認。 | statや申告サイズだけに依存しない。既存の入力digest、署名、独立API出所、版別承認の検査を維持する。 |
| 試験内容・main観測照合 | U4 39トップレベル/76 actual pass、既存release 61 pass。5tasks exit0、tooling 234 pass、legacy 177 pass/既存skip2、actionlint exit0。 | 当レビューは再実行せず、local-observationsの実行結果と試験のassertionを照合した。境界丁度の成功、+1の拒否、虚偽ZIPサイズ、読込増加、起動0回を確認できる。 |

### Summary

今回の個別JSON容量修正に追加の具体的指摘はない。ローカル実装と記録は整合しており、R-01の不足は修正された。実GitHub CI・OIDC公開・公開候補の重い回帰と全realm coverage80%は未検証であり、ローカル成功で代替していない。外部ID未設定とwriter無効を保持する。
