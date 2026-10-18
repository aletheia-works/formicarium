# 移管のドメイン設計判断

## 根拠

`../requirements-analysis/requirements.md`、現状調査の`aidlc/spaces/default/codekb/formicarium/architecture.md`と`component-inventory.md`、`domain-design-questions.md`Q1を参照する。以下はこのintent内のADR番号で、既存docs/decisionsの番号を置換しない。配置・tech stack・完全schemaは後続の設計対象。

## ADR-001: commandとinstallを分離する

**Context** — FR3–5は共通端末操作と非同期取得を要求し、取得失敗やresetの競合でも状態を守る必要がある。

**Decision** — Q1=Aに従いCommandSessionとInstallCoordinatorを分ける。前者は解釈・振分け、後者はcatalog選択・取得・展開・検証調整・進捗・取消を担う。

**Consequences** — 取得失敗を独立試験できる。予約/epoch/abortを部品間で扱う契約が必要。公開導線は共通で、別サービス化は意味しない。

**Alternatives Rejected** — 一体化は状態管理が局所的になるが責任が肥大する。CommandSessionにfetchだけを直結し検証を別にする案でも、取得の寿命と入力解釈が混ざるため採用しない。

**Security and Compliance** — 任意URL/シェル構文を各担当で拒否し、host取得とguest networkを区別する。既存license/配布制約は維持。

## ADR-002: sessionを唯一の状態所有者にする

**Context** — FR5/NFR3/NFR5はabort・reset・古いresponse・同時操作で部分登録や状態喪失を防ぐ。既存Sessionは実行transactionとcleanupを所有する。

**Decision** — ExecutionSessionがFS/cwd/導入guest/activeOperation/epochを所有し、InstallCoordinatorは予約した検証候補をcommitする。進捗は通知のみ。GuestValidationは状態を持たず検証したcopyを返す。

**Consequences** — 直接APIでも排他と取消が共通になる。予約tokenとepochの確認が必要。既存run/cleanupの所有権を変えず登録境界を追加する。

**Alternatives Rejected** — installが独自registryを所有するとresetが2状態に跨がる。command façadeだけが排他すると直接呼出しで迂回できる。双方とも不採用。

**Security and Compliance** — 検証後に変更されたbyteを実行しない。取消済み候補はcommitせず、hostパスへ逸脱させない。

## ADR-003: 固定build・recipe・latestデモの所有を分ける

**Context** — FR7–15は固定再現性とlatest更新を要求し、verdictとfixtureの責任も異なる。

**Decision** — FixedGuestBuilderが固定入力と成果物、RecipeRunnerがrecipe/fixture/verdict、Showcaseがlatest設定/builder/fixture/site候補を所有する。いずれもformicariumの公開境界を利用し、逆依存を作らない。

**Consequences** — 更新頻度と受入責任を分離できる。共通catalog/build-infoの契約は必要。recipeのFixedGuestBuilder利用はビルド時のみで、ブラウザがbuilderをbundleしない。

**Alternatives Rejected** — 全builderを本体へ集約すると汎用APIにtool条件が入り、latestと固定入力が混ざる。全機能をvivariumへ置くとデモにrecipe責任が広がるため不採用。

**Security and Compliance** — source/digest/patch出所を確認してから受入、配布license/noticesを保持する。Release/Pagesは外部依存で論理componentではない。

## ADR-004: 移管の証拠照合を製品本体から分離する

**Context** — FR1/FR6/FR16は計測、公開基点照合、consumer受入、参照検索、退役準備のコードを必要とする。

**Decision** — MigrationAcceptanceがこれらのscriptと証拠を所有し、既存の公開/infra executorを承認済み入力で利用する。部品を呼ぶ方向は受入側→製品側のみ。

**Consequences** — 本体に移行時の運用条件を持ち込まない。最初の試行と最後の退役が同じ証拠対応を利用できる。担当とexecutor契約は後続で確定する。

**Alternatives Rejected** — 手順文書だけで済ませる案は機械的な条件照合を満たさない。新しい常駐の承認サービスを作る案は範囲を増やすため不採用。

**Security and Compliance** — 承認不足・未検証・両移行未達を成功扱いせず、外部操作を具体的な人間承認に結び付ける。新費用は事前相談する。
