# U2 検証・配布経路

## 範囲と基盤
ドキュメント根拠：U2 security-design/logical-components、承認済みFR2/FR5/FR6、C02/C03/C06/C11。新規cloud基盤なし。実装・実行結果は未検証。既存Bun固定依存、TypeScript、Biome、Node、Playwright、Istanbulとpack consumerの経路を拡張する。

| 段階 | 入力・観測 | 通過条件 |
|---|---|---|
| 1 build/type/lint | mise declared task、固定依存/source | strict型・対象lint成功、Node/browser専用境界保持 |
| 2 U2試験 | NodeとChromium/Firefox/WebKit、session/guest/fixture | 不正ELF/metadata/fixture、copy、busy/cancel/reset/dispose/旧tokenの全要求成功 |
| 3 同一pack consumer | 新pack/source/inventory、型/exports/Node/browser assets | 試験したpack SHA一致、public/rootとinternal非公開、notices保持 |
| 4 既存回帰 | probe/aube native/wasm cap | NFR2.1のtimeout・worker・retry・出力・memory条件維持 |
| 5 coverage | 新配布JS含む固定inventory、全realm | ≥80%、未収集/skipを成功へ変換しない |
| 6 暫定証拠保存 | checks・sourceCommit・packSHA・inventorySHA・preflightId | U2 provisionalと明示。U4完全C06までB1受入れ/U5開始に使用しない |

## CIとローカルの対応
ビルド/テストはmain sessionで逐次、CIも重い試験を並列計測しない。既存CIの同じ固定tool・build/type/test/pack処理を利用し、新API試験と固定配布inventoryを追加する。統合前にCI成功を観測し、ローカル成功からCI成功を推定しない。実装計画で変更task・workflow・具体コマンドを確認し、必要なpush/CI試行は既承認範囲を越える前に確認する。U1完了証拠をU2候補の証拠に流用しない。

## 権限・秘密・公開
通常検証はcontents readの最小権限、公開token/id-token writeなし。未信頼PRのコードをwrite/publish権限で実行しない。workflow Action参照の既存固定方針を維持。source/pack証拠・noticesを含めても秘密や私有host pathは含めない。実npm公開/GitHub Releaseは版ごとの人間承認に従い、この単位の完了と分離する。

## 切戻し・環境
U2のsource変更をjjで戻し、同じ固定依存からbuild/packと回帰をやり直す。既公開版を上書きしない。terrariumはFR16まで維持する。Node対応版と3ブラウザ版は試験結果に記録し、実機Safari未検証を明記する。same-origin WorkerとCOI/CSP設定は既存静的test serverを維持し、新ホストや常設monitorを作らない。

## NFR対応
NFR2.1→段階4、NFR2.2→段階5、NFR6.1→段階2/3と既存test server、NFR8.1→段階3/6、NFR8.2→権限・秘密・公開/切戻し。その他NFR3.1–3.5/NFR4.1–4.2はライブラリ実装・試験に属し、新規infra構成を必要としない。
