## Review

**Verdict:** NOT-READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-10-12T11:45:24Z
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | aidlc/spaces/default/intents/261012-terrarium-migration/inception/contract-design/contract-summary.md > C03: 公開guest/fixture検証 / GuestHandle | ドキュメント根拠・ソース照合済み。validateGuestは検証したcopyを保持する非公開byteのGuestHandleを返すが、公開Session.runはtypes/index.d.tsのRunOptions.guest: Uint8Arrayだけを受け取り、handleを消費する公開関数はない。唯一のcommitGuestは非公開C02にある。公開API利用者は元byteを再びrunへ渡すほかなく、検証後の変更時に「検証したcopyを実行する」というC03/NFR3の約束をこのAPI経路では満たせない。C04内部の安全な登録経路とは別に、公開検証から実行までの接続が欠ける。 | GuestHandleを公開run又は公開登録関数で消費するshapeと所有権を定義し、元byte変更後も検証済みcopyを実行するconsumer試験を契約に追加する。既存Uint8Array経路を維持する場合は両経路の保証を明記する。 | New |
| R-02 | Major | aidlc/spaces/default/intents/261012-terrarium-migration/inception/contract-design/contract-summary.md > C08: recipe Contract v1と埋込みUI | ドキュメント根拠。規範shapeはRecipeMigrationFieldsの追加部分だけで、既存必須fieldとready/run/transcriptのpayload・送受信方向・順序・失敗時応答を参照できる契約がない。本文は完全schemaの統合をU6変更前へ繰り延べている。外部recipe作者/埋込み利用者は本契約から互換入力とメッセージを作れず、FR10/FR12の維持対象を独立に試験できない。 | 既存Contract v1の版と所有するschemaを特定し、追加fieldを統合した完全schema又は版固定の規範参照を示す。ready/run/transcriptの型・順序・エラー応答とdeprecated aliasの互換fixtureを定義する。 | New |
| R-03 | Major | aidlc/spaces/default/intents/261012-terrarium-migration/inception/contract-design/contract-summary.md > C06: B1成立と正式固定buildの開始 / C10: 最終受入証拠 | ドキュメント根拠。checks.name/environmentとinputDigestsは任意文字列で、必須check ID、各環境の必須組合せ、重複拒否、必須digest keyを定めていない。C10は「双方の必須check」を照合するがその集合がなく、candidateId/catalog/fixture/pack/site inventoryとの対応も任意Recordに委ねる。U2/U4/U6/U8の生成側とU5/U9の受入側が別々の名前・identity keyを選べるため、欠落拒否と別candidate混用拒否を共有schemaから実装できない。 | C06/C10に必須check IDと環境行の集合、重複・欠落の拒否規則を追加する。各証拠の必須identity/digest fieldを名前付きで定義し、C09 candidateIdおよびsource/pack/catalog/fixture/site inventoryとの照合規則を示す。 | New |
| R-04 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/inception/contract-design/contract-summary.md > C05: 公開コマンド / transcript表示 | ドキュメント根拠。本文は「文字列/行数の上限は後述」とするが、C11はcommand入力64KiBだけで出力byte・表示文字数・行数の上限や超過時動作を定義していない。UI実装が無制限の出力保持又は独自の切詰め規則を選ぶ余地がある。 | transcript表示の上限と切詰め/通知動作を定義し、原本byteとの関係を明記する。上限を設けない設計なら該当参照を直し、大量出力の保持方法を記載する。 | New |

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| ステージ定義の確認 | 検証済み: contract-design.mdには独立実行するvalidation toolの指定なし。required-sections/upstream-coverageのsensor宣言あり | 設計レビューのためbuild/testは実施していない。実行・性能・coverageは未検証であり、成果物も未検証と明記している。 |
| 指定上流との境界照合 | ドキュメント根拠: U1–U9のDAG全辺をC01–C10の表で確認。開始条件と製品importの区別、U8の推移API依存、Session単一所有を確認 | 循環する製品依存や上流と矛盾する単位所有は確認されなかった。 |
| 公開型/ソース照合およびrgによる限定検索 | 検証済み: types/index.d.tsのRunOptions.guestはUint8Array。契約のhandle消費は非公開commitGuestのみ。C08は追加shape、C06/C10のcheck名・identity keyは任意文字列 | 上記3件のMajorを裏付ける。エラーcode、root export方針、private RCと公開版の区別は指定ソースと矛盾しない。 |

### Summary

取得上限・有限deadline・原子的登録・取消・単位所有は具体化されている。一方、公開検証から実行への接続、外部Contract v1、受入証拠の必須schemaに3件のMajorが残り、独立実装に必要な契約を補う必要がある。
