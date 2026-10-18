# Requirements

## Intent Analysis

formicariumの開発・CIをvivarium/terrariumと揃え、Bunで再現可能な依存管理と日常の品質検査を行う。公開専用workflowに加え保守自動化を整備し、今後のstableも検証済み候補からリリースできる状態にする。既に公開したRCの受入れは別作業として継続する。

## Sources

- [desc] Initial description: project-description.jsonのユーザー依頼（通常workflow、Bun、bun.lock、兄弟repoとの整合）。
- [scope] Workflow-selected scope: classic / Standard。
- [Q1] practices-discovery-questions.mdのC：整形修正pushと小さい依存更新の条件付き自動merge。
- [memory:M1] 承認済みteam-practices.md：jj、互換性、品質基準、外部操作の承認条件。
- [E1] developer-scan.mdとCodeKB：既存verifyはfork専用、Biome/TypeScript/テスト・配布gateは既存。
- [E2] business-overview.md：Node/ブラウザからwasmを使う配布製品として、開発toolchain変更後もconsumer互換性を維持する（FR2・FR8）。
- [E3] architecture.md：共通runtime、Node/browser adapter、配布・公開検査の境界を維持する（FR2・FR3・FR8）。
- [E4] code-structure.md：TypeScript authoring、生成JS、mise/scripts/testsの配置に沿って開発・CIコマンドを更新する（FR1・FR2・FR9）。

## Functional Requirements

すべてMust。以下は合格条件であり、実装済み・検証済みではない。

| ID | 要件・合格条件 | 根拠 |
|---|---|---|
| FR1 | 開発依存をBunとテキストbun.lockに移行する。package-lock.jsonを削除し、Bun版の指定、clean checkoutでのfrozen install成功、manifest/lock不一致時の失敗を確認する。初回・cacheなしでも同じ依存版を導入する。 | desc |
| FR2 | 開発コマンドとmise taskをBun導入へ揃える。lint・typecheck・build・対象テストを同じtaskでローカル/CIから実行できる。Node固有APIやflagを使う箇所は実行runtimeを明示して検証し、Node/browser公開consumerの成功を維持する。 | desc,M1,E1 |
| FR3 | 通常PRとmain更新でlint・typecheck・build・軽量テストが走るCIを追加する。各失敗が非成功となり、未信頼forkでも公開secretを必要としない。重い回帰・配布coverageは別の明示経路とし、変更SHAに結び付く統合前の実CIと80%coverage証拠を維持する。 | desc,M1,E1 |
| FR4 | Bun依存とGitHub Actionsの更新PRを生成する構成を追加する。管理対象・周期・groupを明示し、生成lockをfrozen検査する。参照先のfile tarballやサービス固有設定を持ち込まない。 | desc,M1 |
| FR5 | PRラベルとcommit形式検査を導入する。対象パス/タイトルの規則を明記し、無関係な変更・複数カテゴリ・fork PRでも予測可能に判定する。メタデータ処理ではPR本文等をshell命令として実行しない。 | desc,M1,E1 |
| FR6 | 整形の自動修正pushを実装する。読取側で修正差分を作り、書込側は信頼したworkflow・同一repo PR・許可パス・実行SHA/最新head一致・artifact出所を照合する。信頼した固定版の整形ツールと設定で当該headから再現した差分との完全一致を要求する。再現処理は書込みcredentialなしで実行し、PR由来の設定・scriptを信頼しない。許可パス内でも整形以外の差分、再現不一致、分類不能、fork、古いhead、改変artifact、許可外パス、削除PRではpush0回となり、理由を示して手動確認へ回す。適用後に通常CIが対象SHAで実行され、修正不要時や二重実行で空commit/ループを作らない。 | Q1,M1 |
| FR7 | 小さい依存更新の条件付き自動mergeを実装する。認証された更新botのPR、許可したBun開発依存のstable patch/minor更新、直接依存の更新数が1件、必要CIの現在headでの成功、main保護・merge可能状態をすべて要求する。0件・2件以上の直接依存変更、major/pre-release、workflow/公開境界、allowlist外、混合更新、判定不能、skip/pending/fail/stale CI、forkはmerge0回。lock内の推移依存差分は1件制限へ数えないが、唯一の直接依存変更からfrozen lockを再現して完全一致を確認し、無関係な推移依存変更や再現不能は拒否する。1件の正常例と0件・2件の境界拒否を検証する。Action更新PRは生成するが自動merge対象外。自動merge結果をPR/runで追跡できる。 | Q1,M1 |
| FR8 | publish.ymlと公開検査をBun開発基盤へ適合させ、未来のRC/stableタグを検証できる構成にする。npm OIDCに必要なCLIの利用は明示し、候補/source/入力SHA、承認版、coverage、provenance、公開前拒否を維持する。未承認版・証拠不足・改変時は公開executor0回。今回npm公開や既存タグ変更は行わない。 | desc,M1,E1 |
| FR9 | README等の導入・検査・保守・リリース手順を更新する。Bun版、frozen導入、Nodeが必要な経路、必須checks、bot/token・repo設定、拒否時の手動復旧、旧CI入力branchの役割を記述する。設定未適用を運用済みと記録しない。 | desc,M1 |

## Non-Functional Requirements

- NFR1 再現性：Bun版、lock、Action参照を固定。cacheはOS/toolchain/lockに分離し、cacheの有無で検査結果が変わらない。必要資産・設定欠落は具体的な失敗として報告する。
- NFR2 権限：通常CIはcontents read。書込みjobは目的別最小権限で、公開OIDC権限を渡さない。未信頼コード・依存installをwrite権限で実行しない。tokenはsecret管理し出力へ含めない。
- NFR3 整合性：PR/run/SHA/artifactを対応付け、古い結果を新しいheadへ適用しない。PR単位で重複書込みを防ぎ、API失敗・権限不足・rate limit・cancelで成功を偽装しない。side effectの盲目的retryはしない。
- NFR4 品質：第一者配布JS固定一覧の行coverage80%以上、未実行ファイルを分母に保持。probe600秒、aubeブラウザ840秒、1worker、retryなし、probe8項目、native出力一致、wasm1GBを維持。既存回帰とNode/browserconsumerに新規失敗を出さない。
- NFR5 運用：各jobに有限timeoutとPR単位concurrencyを定義する。必要checksの名称とpath filterのskip挙動を明示し、required checkが永久pendingにならない。ローカル検証はmain sessionで逐次実行する。

## Constraints

- ローカルVCSはjj。公開済みRC0.1.0-rc.1、source12a92eab、タグ、固定入力、npm dist-tagを変更しない。
- Node/ブラウザ公開APIとcore境界、Atomics.waitAsync除去を維持。コア/JIT・guest rebuild・API一括改変は対象外。
- 外向きpush、GitHub設定/tokenの適用、publishは対象と具体的結果を提示して既存承認条件を満たす。自動化の方針承認を無限定の設定適用許可と扱わない。

## Assumptions & Open Questions

None. 未確定のBun版・具体check名・secret/token方式・allowlistは実装者が設計で決定し、根拠と拒否試験を示す技術事項。必要GitHub機能が利用できない場合は手動への代替を明示し、機能が動作したとは扱わない。

## Out of Scope

今回のstable実公開、RC再公開、既存RCのterrarium受入れ実施、コア変更、Node consumer廃止、Pages/Terraform/JSR、無条件auto-merge、無関係な全体整形。

## Verification Status

要件の根拠は人間の依頼・承認済み実践とソース観測。Bun移行・新workflowの動作は未検証で、Code GenerationとBuild and Testで実証する。
