# Security Requirements — U4

## Scope and Sources

設計要求・未検証。対象はFR8、FR9、C1/C2を消費する公開workflow・入力検査・公開手順。公開API/core/guest、U1 task、U2判定、U3保守workflowは変更対象に含まない。packagingのためサービス性能・拡張性・SLA資料は生成せず、有限実行と障害対応を本書に記す。

根拠：inception/requirements-analysis/requirements.md、inception/contract-design/contract-summary.md、inception/units-generation/unit-of-work.md、現行 .github/workflows/publish.yml と scripts/release/publication.ts・publication-cli.ts・workflow.ts。CodeKBのnpm中心の記述は調査時点の背景で、U1実装後のBun基盤を現行根拠とする。

## Detailed Requirements

| ID | 要求・合格条件 | 対応・確認方法 |
|---|---|---|
| NFR1.1 | 開発依存はU1のBun1.4.2、bun.lockとignore-scriptsのfrozen導入を使用し、package-lock/npm ciを復活させない。Node24.21.0とnpm公開CLI11.19.0を用途別に固定する。Actionは確認済みfull SHA、cacheは公開jobで無効。 | FR8/C1。workflow静的検査、固定版とlockの実導入。 |
| NFR1.2 | 公開candidateのsource commit・tarball SHA・入力archive SHA・toolchain/lock・provenance・承認版を照合する。cacheやordinary-ciの成功をcandidate証拠へ読み替えない。 | C2。各identity改変と不足入力の拒否試験。 |
| NFR2.1 | 検証はcontents read、npm公開だけid-token write、Releaseだけcontents writeとする。release environmentを維持し、PR/fork/manual任意入力から公開しない。 | FR8。permission/trigger/env拒否、非公開入口起動0回。 |
| NFR2.2 | 依存導入・コンパイル・候補生成・検査は公開write/OIDC権限のないjobで行う。書込jobは検証済み固定実行資産と候補だけを取得し、PR由来コード・script・configや依存installを実行しない。token/private keyをartifact/logへ含めない。 | NFR2/C1。writer構成の禁止項目とcredential非転送検査。 |
| NFR3.1 | C2のrepo/run/attempt/source/producer/workflowと実artifact bytesを独立観測に結び付ける。必要checksは信頼側の空でない固定集合。欠落・重複・偽producer・stale・skip/pending/fail/cancelは公開executor0回。既存公開bundleのschema/署名を弱めない。 | C2。real adapterへの正常・拒否fixture。 |
| NFR3.2 | 将来RC/stableは厳密なstable又はRC版構文、vタグ一致、RC→next/stable→latest対応に加え、当該repo/source/tarball/版/操作に結び付く承認を要求する。未承認版・不正semver・入力とtagの不一致は起動0回。 | FR8。正しい将来版のfixtureと未承認/不一致table。既存RCは再公開しない。 |
| NFR3.3 | 公開・Release副作用は各操作最大1回。通信結果不明で盲目的再送せず、版・registry/release結果の確認と手動復旧を明記する。publish成功後Release失敗を全体成功と扱わない。 | NFR3。fake executorの呼出回数/引数、失敗・未知結果試験。 |
| NFR4.1 | 第一者配布JS固定inventoryの全分母と全realm receiptsを保ち、行coverage80%以上を要求する。未収集・0分母・改変・ordinary-ci証拠・不足coverageではexecutor0回。 | C2/NFR4。閾値・inventory/receipts拒否試験。 |
| NFR4.2 | 既存probe600秒、aube browser840秒、1worker、retryなし、8項目、native出力一致、wasm1GB、Node/browser consumerを維持する。未変更guestを再buildしない。 | NFR4。既存設定照合と対象回帰。実CI/実機Safari未検証を区別。 |
| NFR5.1 | 各公開workflow jobは有限timeout（現行30分を上限の基準）、タグ単位concurrency cancel-in-progress=false。gate failureは下流publish/Releaseを非実行にする。 | NFR5。workflow依存/timeout/concurrency検査。 |
| NFR5.2 | README公開節にBun/Node/npm役割、必要checks/証拠、版別承認、拒否/不明時の復旧、旧rc1-inputs用途を明記する。既存RC/入力branch/variables/dist-tagは変更しない。外部適用・実CI・公開をローカルfixture成功と分ける。 | FR9/NFR5。資料・証拠対応と実行者mainの観測。 |

## Threats and Failure Boundary

未信頼入力による承認偽造、同名偽check、古いCI証拠、archive改変、分母除外、tagと候補の差替え、write jobへのコード混入、未知結果の再公開を拒否する。既存公開CLIのfail-closedと署名検証を維持し、U1のC2を自己申告booleanだけで通さない。最終検査はmainで逐次実行する。

## Verification Status

要求の根拠は承認済み資料とsource観測。U4動作は未検証。実GitHub CI・OIDC・registry/release操作は今回のローカル検証とは別で、具体的外部承認前に実行しない。U3の設定不一致とprepare権限不足は未解決で、公開境界の修正で解消したとは記録しない。

## Assumptions & Open Questions

None. 具体的実行資産の供給方法とC2観測は次の設計で定義し、実装・試験計画で実行可能性を示す。
