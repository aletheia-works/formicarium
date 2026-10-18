# Security Requirements — U3

## Scope
ドキュメント根拠の設計要件。FR4–FR7と保守手順FR9を対象とする。実workflow・外部操作は未検証。U1 C1/C2、U2 C3を利用し、U3は取得・認証・分類・再現・外部操作の真正性を所有する。

## Requirements
| ID | 条件と合格判定 |
|---|---|
| NFR1.1 | Bun1.4.2、Node24.21.0、信頼baseのformatter/config・policyとActionの完全SHAを固定する。PRによる設定差替えを拒否する。cache有無で判定を変えない。 |
| NFR1.2 | 整形差分と唯一の直接dev依存更新からのlockをwrite credentialなしで再現し完全一致を要求する。未知分類・再現不能は操作0回。 |
| NFR2.1 | 情報取得・再現jobはcontents read、公開OIDCなし。write jobは固定信頼ソースだけを実行しPR checkout/script/install/configを実行しない。 |
| NFR2.2 | push用とmerge用の入口・最小権限を分け、tokenをsecretから取得する。token値はartifact/log/理由に含めない。ラベル処理はメタデータだけを扱う。 |
| NFR2.3 | 更新botの認証済みidentityを検証する。Actions更新はPR生成のみ。直接dev依存stable patch/minorちょうど1件とallowlistを満たす場合だけmerge候補とする。 |
| NFR3.1 | GitHub取得のrepo/PR/run/attempt/SHA/producerとartifactを独立照合する。共通必要checksはquality・commit-format・ci-required、現在headで全successを要求し、skipをsuccessへ変換しない。 |
| NFR3.2 | 書込み直前にopen/sameRepo/head/checks/main保護を再取得し、外部操作のexpected headを原子的に保証する。事前GETのみは不合格。保証不能・競合は操作0回で手動へ回す。 |
| NFR3.3 | reject/no-opはexecutor0回、allowは目的の操作を最大1回。通信結果不明は盲目的再送をせず読取で結果を照合する。重複イベントは空commit・再mergeを作らない。 |
| NFR4.1 | 新しい境界の正常・拒否・競合・権限不足・通信不明を偽adapterで検証し既存試験を維持する。偽試験と実GitHub CI/操作を区別する。配布JS80%coverageと重い回帰は統合前に既存経路で確認し、軽量試験で代用しない。 |
| NFR5.1 | 全jobに有限timeout、write入口はPR単位concurrencyでcancel-in-progress false。読取retry最大2回・各要求10秒・全取得60秒、side effect再試行なし。失敗/cancelを成功にしない。 |
| NFR5.2 | 証拠JSON・差分の各非圧縮byte上限8MiBをstream読取段階で適用し、全量copy/hash前に超過拒否する。archiveはmember数・パス・symlink・展開byteも検査する。U2のbyte上限未定義をconsumerで補う。 |
| NFR5.3 | 必須checkはpath-filterなしのU1 CIに結び付ける。運用記録にPR/head/run/Decision ID/policy/操作目的/結果を残し、拒否・不明時は手動復旧へ誘導する。秘密やPR本文を記録・shell評価しない。 |

## Category Assessment
Security、reproducibility、consistency、operabilityを上表で定量化した。packagingのためservice SLA・autoscaling・常設monitoringは対象外。既存guest timeout、1worker、retryなし、wasm1GB、consumer互換性は維持する。保守の有限timeoutはguest計測上限を変更しない。

## Threat and Failure Boundaries
fork、改変artifact、偽producer、古いhead、PR由来設定、不関連lock変更、write権限での未信頼実行を拒否する。producer名だけでは真正性を認めない。APIの原子的条件とCI再起動token方式はNFR Designで公式資料を確認する。

## Assumptions & Open Questions
None. 実環境のbot/token/保護設定は適用前に検証し、未設定を運用済みと報告しない。

## Sources
inception/requirements-analysis/requirements.md NFR1–5、FR4–7/9。inception/contract-design/contract-summary.md C1–3と外部入口。.github/workflows/ci.ymlの現行check名。U2独立レビューのbyte上限指摘をU3取得境界へ引き継ぐ。
