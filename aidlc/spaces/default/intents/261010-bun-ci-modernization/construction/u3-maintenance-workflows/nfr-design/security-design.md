# Security Design — U3

## Scope and Trust Boundaries
ドキュメント根拠の設計。U3はpackagingでFD/logical-componentsは適用外。U1 CI/receipt、U2 input・C2 adapter・2引数C3を再利用する。実CI・API操作は未検証。MaintenanceAttemptはPR/head/run/Decision ID/operation/status/resultingShaを持ち、PR本文・credentialを持たない。

## D1 Fixed Tools and Reproduction — NFR1.1, NFR1.2
信頼したdefault branchの固定SHAを開始時に採り、そのSHAのworkflow・policy・formatter configとNode24.21.0/Bun1.4.2/Biome2.5.15を使用する。Actionは完全SHA固定。PR headが信頼baseのCI定義・判定設定・公開境界を改変した場合は自動操作を拒否する。

整形用読取jobは信頼baseの依存のみignore-scripts/frozen導入し、PRデータを隔離した一時場所へコピーする。PR script/config/pluginを実行しない。Biome formatのみを固定configで実行し、lint fix・import整理は使用しない。許可TSファイルはruntime/scripts/tests配下とindex.ts、workflow/lock/package/公開境界を除外する。UTF8 regular fileだけ、削除/rename/symlink/binary/未知分類は拒否する。差分の全パス・元head内容・再現済み置換bytesの完全一致を確認し、単なるpath allowlistでは認めない。

依存用読取jobは信頼base manifest/lockを種にし、GitHubで観測したPRから既存dev依存の唯一のversion変更だけを適用する。PRのscript/設定/registry変更を持ち込まない。Bun1.4.2でignore-scripts lock生成→frozen導入し、生成lockとPRの全bytesが一致することを要求する。package.jsonはその1字段以外変更なし。更新元/先はlockで解決した厳密stable版も照合し、range・未知版は自動merge対象外にできる。allowlistは現行dev依存名の明示一覧、0/2件・major/pre・追加削除・mixed変更は拒否。推移差分を件数に数えず再現一致で限定する。

## D2 Privilege Isolation — NFR2.1, NFR2.2, NFR2.3
メタデータ用label workflowはpull_request_targetで信頼baseソースだけを扱いPR checkout/installなし、contents read/pull-requests write。固定パス規則で複数カテゴリを付与し、無関連は変更しない。タイトル/本文をshellへ展開しない。

更新PRはRenovateのbun/github-actions managerを採用し週次・単一依存PR、Actionsは別group、Renovate自身のautomergeとlock-only maintenanceをdisabledとする。Renovate Appの導入は別承認で、bot loginだけでなくconfigured immutable actor ID/typeとPRの独立取得により認証する。BunのdevDependency分類はbot metadataに頼らずmanifest差分から計算する。

format-writeとdependency-mergeは別入口。信頼base checkoutのみ、依存導入・build・PRコード実行なし。読取側の未信頼出力を再検証し、認証情報は最後の固定API adapterにのみ渡す。formatはContents writeと読取Actions/Checks/PR、mergeはContents writeと読取Actions/Checks/PR/保護情報、labelとはtoken目的を分ける。公開OIDCとworkflow編集権限、管理設定変更、保護bypassを与えない。必要保護情報の読取権限が不足なら拒否する。

CI再起動を確実にするためformat用はGitHub App installation tokenを使用する。App ID/private keyはsecret、固定SHAのtoken Actionを使い対象repoと権限を限定する。GITHUB_TOKENでpushイベントのCI起動を推定しない。token Actionの参照SHAと実App権限は実装時確認する。PR由来再現jobにApp private key/tokenを渡さない。

## D3 Independent C2 and Atomic Operations — NFR3.1, NFR3.2, NFR3.3
workflow_run(CI completed)から信頼baseの保守workflowを起動し、対象runのworkflow ID/path/hash、repo、head、attempt、event、producer App ID、check suite/job identityをGitHub APIで取得する。PRはイベントの自己申告番号だけに依存せずrun/headから独立照合する。偽同名check・別workflow・PRで改変したCI定義を拒否する。

U1 receipt.jsonはquality/commit-formatの観測結果だけを持つ。U3はAPIから全3job quality/commit-format/ci-requiredの最終successを要求し、その独立観測からC2正規化envelopeと同じ3check inventoryを構築する。receiptの2jobはそのAPI結果との一致を必要とし、ci-requiredをreceipt自己申告として捏造しない。実archive bytesのdigest、run/attempt/expectedToolchain/lockと信頼toolchainを照合する。必要producer集合はbase policyから取得し、PRで縮小できない。U2 adapter成功時だけC3へ進む。

write直前にPRがopen/sameRepo、headがDecisionと同じ、全3必要check成功、必要main保護が有効か再取得する。固定API variables/bodyにexpected headを渡す。formatはGraphQL createCommitOnBranch expectedHeadOidと検証済みfileChanges additionsのみ、固定のConventional Commit headlineを用いる。mergeはREST PUT /repos/{owner}/{repo}/pulls/{number}/merge、sha=Decision.headSha、merge_method=squashを用いる。merge queue/stacked PR/保護対応が保証できない環境は自動mergeを拒否し手動へ回す。

同一headの二重formatではAPIのhead条件が競合を拒否する。既にmerged/差分なしの場合はno-op。write APIは最大1回、GraphQL HTTP200にerrorsがあれば成功にしない。通信timeout等で不明なら同APIを再送せず、PR/head/commit parent/対象tree/merged状態を有限readで照合しsuccess/failure/unknownを記録する。clientMutationIdは識別であってidempotency保証と扱わない。

## D4 Verification — NFR4.1
入力取得・分類再現・C2/C3・操作直前再照合・具体HTTP body/GraphQL variablesの境界をfixture/fake transportで試験する。競合head、改変、producer不一致、fork、0/2依存、Action/publication変更、false success、権限不足、rate-limit、cancel、結果不明・再送0回を含む。偽試験は実原子的操作成功の証拠ではない。main sessionがserialでbuild/testsを実行し、統合前に当該SHAの実CIと固定配布JS80%coverageを別途検証する。

## D5 Bounds and Operations — NFR5.1, NFR5.2, NFR5.3
準備jobは30分、label5分、write/merge10分。write目的を分けてもPR単位の共通concurrency group、cancel-in-progress false。read request10秒、取得全体60秒、retry最大2回。write request10秒で1回、結果照合readは有限、unknownは手動へ回す。全job finite timeout。

archive download compressed8MiB、member最大16、許可filenameのみ、非圧縮aggregate8MiB、個別JSON/diff各8MiB、PR source対象最大500/合計8MiB。streamごとに受信累積を数え上限+1で中止し、Content-Length自己申告だけで許可しない。symlink/absolute/parent/duplicate/member曖昧を拒否し、全量copy/hash/JSON parse前に制限する。U2単独artifactBytes上限未定義の指摘はこのconsumer境界で補い、U2のレビュー済みコードは変更しない。

ci.ymlはpath filterなしのrequired aggregatorを維持する。保守workflowはブロック必須checkとして追加せずskipを成功証拠に読み替えない。理由は固定code、PR/head/run/attempt/policy/Decision/resultingShaで関連付け、秘密と任意API本文を出力しない。設定未適用・拒否・unknownと運用済みを区別する。

## Sources and Verification Status
2026-10-10公式資料を参照したドキュメント根拠：
- [GraphQL commits](https://docs.github.com/en/graphql/reference/commits)：branch commitとexpectedHeadOid。
- [REST pull requests](https://docs.github.com/en/rest/pulls/pulls)：merge sha条件、不一致409、Contents write。queue対応しない同期入口を採用しqueue環境は拒否。
- [Workflow triggering](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow)：App tokenによるイベント起動。
- [Renovate Bun](https://docs.renovatebot.com/modules/manager/bun/)：bun.lockの更新管理。実lock生成はCode Generationで検証する。
- U1 scripts/ci/ordinary-receipt.tsと.github/workflows/ci.yml、U2 C2/C3：現行integration。

原子的head条件は公式契約に基づく設計で、実環境競合試験は未検証。App/保護/token/定期更新/実CIの外部適用も未検証。
