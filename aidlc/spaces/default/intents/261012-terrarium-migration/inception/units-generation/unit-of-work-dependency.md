# 作業単位の依存関係

## Dependency DAG

辺は消費側→供給側。コード依存、成果物の受渡し、受入開始条件を区別する。番号は安定IDで経済的な優先順位ではない。

```yaml
units:
  - name: u1-migration-preflight
    kind: packaging
    depends_on: []
  - name: u2-session-guest-api
    kind: library
    depends_on: [u1-migration-preflight]
  - name: u3-install
    kind: library
    depends_on: [u2-session-guest-api]
  - name: u4-command
    kind: library
    depends_on: [u2-session-guest-api, u3-install]
  - name: u5-fixed-guest-build
    kind: packaging
    depends_on: [u2-session-guest-api, u4-command]
  - name: u6-recipe-runtime
    kind: ui
    depends_on: [u2-session-guest-api, u4-command, u5-fixed-guest-build]
  - name: u7-showcase-guests
    kind: packaging
    depends_on: [u2-session-guest-api, u4-command]
  - name: u8-showcase-site
    kind: ui
    depends_on: [u7-showcase-guests]
  - name: u9-retirement-acceptance
    kind: packaging
    depends_on: [u6-recipe-runtime, u8-showcase-site]
```

## Integration Points

| 消費側 | 供給側 | 接点/成立条件 |
|---|---|---|
| U2 | U1 | 大規模移管の開始条件。計測合格とbaseline試行証拠。製品importなし |
| U3 | U2 | 公開検証/予約token/epoch/原子的登録・取消 |
| U4 | U2, U3 | FS/cwd/run APIとinstall選択/進捗/取消 |
| U5 | U2, U4 | 公開guest検証と成果物identity。U2/U3/U4を統合したB1受入後に正式移管を開始。U1試行は正式経路へ引継ぎ |
| U6 | U2, U4, U5 | browser/fixture API、コマンド、固定ELF/build-info/catalog。builder呼出しはビルド時のみ |
| U7 | U2, U4 | 公開APIで候補検証/端末受入。U4経由でU3も利用 |
| U8 | U7 | 同一candidate/catalog/digestと受入済み本体資産。端末はU7と同じ公開API依存を継承 |
| U9 | U6, U8 | 再現/サイト両経路の証拠。API公開証拠と固定build証拠は推移依存から収集 |

U5→U4は正式固定build移管の開始条件で、builderの製品importを増やす辺ではない。U4完了はU2/U3/U4のB1統合受入と最終API候補のconsumer再検証の成立を含む。U1のbaseline試行は正式移管とは区別する。U5の正式受入にはU1試行との照合も含み、U2→U1で推移的に成立。U9→製品への受入呼出しは証拠照合script内だけで、本体がU9をimportする逆依存はない。

## Integrated Slice

U1は唯一の依存なし単位で、既存API/Worker/coreで実guestの取得から--versionまで動き、Biome baselineの固定build/再利用試行も既存経路で確認する。新しいU2–U8の実装を必要としない。初回と連続5回の非DL工程、CORS/最終URL/取得identityを実測する。失敗は代替案の確認まで次の大規模移管を止める。Delivery Planningでデモと実行検証コマンドを確認し、設計資料だけで動く統合試行が完了したと扱わない。

## Parallel Development Opportunities

相互依存のない集合は{U5,U7}、{U6,U7}、{U6,U8}。それぞれの祖先の契約/成果物が揃えば独立に開発できる。U3/U5は並行対象としない。複数の有効なトポロジカル順序があるが、一つを推奨しない。共有配布のファイル所有はコード計画で分け、ビルド/試験/計測はmain sessionで逐次実行する。経済的な順番・critical path・Boltと並行実行の採否はDelivery Planningで決める。

## Text Fallback

U2→U1、U3→U2、U4→U2/U3、U5→U2/U4、U6→U2/U4/U5、U7→U2/U4、U8→U7、U9→U6/U8。外部公開/退役は別の具体承認を条件とする。
