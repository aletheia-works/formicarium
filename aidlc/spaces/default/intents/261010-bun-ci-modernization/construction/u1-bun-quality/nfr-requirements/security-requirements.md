# Security and Quality Requirements — U1

## Requirements

U1はpackaging単位で、サービス用のSLA・scalability資料は適用外。再現性・権限・証拠・品質・実行制御を以下に集約する。すべて設計上の合格条件で、動作は未検証。

| ID | 合格条件 | 確認 |
|---|---|---|
| NFR1.1 | Bun版とlockを固定し、clean/cacheなしのfrozen導入とcacheありで同じ依存版を導入する。manifest/lock不一致は失敗 | clean install、lock改変の負例 |
| NFR1.2 | Action参照をcommit固定。cache keyはOS・Bun/Node版・lock digestを含む。cache欠落でも同じ検査が成立 | workflow検査、cacheなし実行 |
| NFR2.1 | 通常CIはcontents read、公開secret・OIDC・write tokenなしでfork PRを検査。checkoutのcredential永続化を無効にする | workflow権限検査、fork経路 |
| NFR2.2 | 依存install scriptを明示した許可に限定し、CIへ持ち込まれるPRのコードをwrite権限で実行しない。秘密をlog/artifactへ保存しない | install設定・権限検査 |
| NFR3.1 | source/run/attempt/workflow/check producerとartifact digestを結び付ける。現在headと異なる証拠、偽producer、重複・不足checksを受入れ証拠として拒否 | C2正常と改変・stale負例 |
| NFR3.2 | fail/pending/skip/cancel/timeoutをsuccessへ変換しない。API失敗と結果不明を記録し、side effectをretryしない | 非成功状態のfixture |
| NFR4.1 | 固定第一者配布JS一覧のline coverage80%以上。未収集fileも分母に保持し、Worker/別process/realmのreceipt欠落は失敗 | 既存coverage集計と欠落負例 |
| NFR4.2 | Node/browser consumerと既存回帰を維持。probe600秒、aubeブラウザ840秒、1worker、retryなし、probe8項目、native一致、wasm1GBを維持 | named consumer/回帰testsと設定検査 |
| NFR5.1 | 通常CIの各jobは有限timeout、PR単位concurrency。required checksはpath filterで永久pendingにしない | workflow条件・check名検査 |
| NFR5.2 | ビルド・試験はmain sessionで逐次実行。通常CIと重い候補回帰を区別して実行結果を記録 | command/outputの証拠 |

## Trust and Failure Boundary

PRタイトル・commit messageをshell命令として評価しない。信頼済みworkflow/base側でメタデータ検査のルールを提供し、PRによる設定変更で今回の判定を緩めない。通常CIが全体受入れ証拠を持たない場合は合格範囲を限定する。統合前の実CIとcoverageを省略しない。U3の整形/mergeごとの必要checksは受け入れ済み契約懸念であり、U1の全品質checksとは別に後続設計で具体化する。

## Sources

../../../inception/requirements-analysis/requirements.mdのNFR1–NFR5、../../../inception/contract-design/contract-summary.mdのC1/C2、aidlc/spaces/default/codekb/formicarium/technology-stack.mdのBun / CI focused scan。functional-designはpackagingで適用外のため欠落資料を捏造しない。
