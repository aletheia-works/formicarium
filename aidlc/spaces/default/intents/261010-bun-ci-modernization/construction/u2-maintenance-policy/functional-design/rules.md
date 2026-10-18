# Rules — U2

## Source of Truth

```yaml
rules:
  - id: BR2.1
    statement: 入力とpolicyを厳格に検証する
    category: validation
    applies_to: all requests
    trigger: evaluation begins
    logic: IF版・必須型・識別子・集合の一意性・上限が不成立 THEN reject。未知の権限判断fieldを使用しない
    violation: invalid-input又はinvalid-policy
    source: [FR6, FR7, NFR1, NFR3]
  - id: BR2.2
    statement: 信頼元と最新headを照合する
    category: authorization
    applies_to: all requests
    trigger: common validation
    logic: IF repository不一致・fork・closed PR・head不一致・未信頼workflow THEN reject
    violation: untrusted-context又はstale-head
    source: [FR6, FR7, NFR2, NFR3]
  - id: BR2.3
    statement: 独立観測と証拠の完全な対応を要求する
    category: validation
    applies_to: all requests
    trigger: evidence validation
    logic: IF source/run/attempt/workflow/artifact digest又はproducerの照合不成立・観測欠落 THEN reject。空又は重複のrequired checksもreject。共通required checksすべてが現在headでsuccessの場合だけ進む
    violation: invalid-evidence又はrequired-checks-not-successful
    source: [FR6, FR7, NFR3, NFR4, NFR5]
  - id: BR2.4
    statement: 整形差分は信頼した完全再現だけを許可する
    category: authorization
    applies_to: format-push
    trigger: format evaluation
    logic: IF固定formatter/config不一致・未再現・非整形・提案と再現のdigest不一致・許可外path・分類不能 THEN reject。全検査成立かつ非空差分ならallow
    violation: format-not-reproduced又はprotected-path
    source: [FR6, NFR1, NFR2]
  - id: BR2.5
    statement: 空差分は検査を免除せずno-opにする
    category: policy
    applies_to: format-push
    trigger: format evaluation after all validation
    logic: IF共通検査と整形再現が成功し提案・再現とも空 THEN no-op。空申告と差分digest又はpathの矛盾はreject
    violation: invalid-empty-diff
    source: [FR6, NFR3]
  - id: BR2.6
    statement: 許可された直接dev依存更新1件だけを認める
    category: constraint
    applies_to: dependency-merge
    trigger: dependency evaluation
    logic: IF認証bot不成立・直接変更数が1でない・dev以外・allowlist外・削除/追加・major/prerelease/unknown・同版/降版・分類とversion不整合 THEN reject。stable patch/minor昇版だけ進む
    violation: unsupported-dependency-update
    source: [FR7, NFR2]
  - id: BR2.7
    statement: lock再現と保護mainを要求する
    category: authorization
    applies_to: dependency-merge
    trigger: dependency evaluation
    logic: IF混合変更・Action/公開境界変更・唯一の直接更新によるlock再現の欠落/不一致・main未保護・merge不能 THEN reject。推移依存件数は直接更新件数に数えないが再現一致を免除しない
    violation: lock-not-reproduced又はmerge-not-permitted
    source: [FR7, NFR1, NFR3, NFR4]
  - id: BR2.8
    statement: 判定は決定的で副作用を持たない
    category: policy
    applies_to: all requests
    trigger: decision returned
    logic: IF入力が同じ THEN同じoutcome/識別子/固定順reasons。credential・時刻取得・乱数・process・network・executorを使わない。allowでもU3の操作直前再照合を省略しない
    violation: 副作用能力を公開しない。reject/no-opは外部操作の許可にならない
    source: [FR6, FR7, NFR2, NFR3, NFR5]
```

## Rules Summary

| ID | 役割 |
|---|---|
| BR2.1 | schema・上限・曖昧入力の拒否 |
| BR2.2 | repository・PR・workflow・head |
| BR2.3 | 独立証拠と全共通checks |
| BR2.4 | 整形差分の完全再現 |
| BR2.5 | 空差分と重複適用 |
| BR2.6 | 認証botと直接dev更新1件 |
| BR2.7 | lockと保護main |
| BR2.8 | 決定性と副作用分離 |
