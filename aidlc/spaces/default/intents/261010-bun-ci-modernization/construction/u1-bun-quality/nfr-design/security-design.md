# Security Design — U1

## Design Solutions

設計案、動作は未検証。packaging単位に必要な再現性・権限・証拠・品質・実行制御を具体化する。

| Requirement | Design ID | Solution | 内容 |
|---|---|---|---|
| NFR1.1 | D1 | 固定toolchainとlock | mise Bun1.4.2/Node24.21.0、packageManagerとtext bun.lockを整合。既存lockから解決版を保持して移行し、frozen installで変更を拒否。clean/cacheなし及びlock不一致の負例を確認する。 |
| NFR1.2 | D2 | cacheとAction固定 | Actionは検証したcommit参照。cacheはOS/Bun/Node/lock digestをkeyにする。成功の必須成果物はcacheから推定せず再検証し、cache missでも導入と検査を行う。 |
| NFR2.1 | D3 | 無権限のPR検査 | pull_requestとmain pushを入口としcontents readのみ。OIDC/write secretなし、persist-credentials false。forkの未信頼コードを実行するjobに書込み権限を渡さない。 |
| NFR2.2 | D4 | 依存とメタデータ隔離 | Bun lifecycle許可を明示した必要依存だけに限定。PR metadataは構造化入力として渡しshell展開しない。commit検査の規則は信頼済みbase側から固定し、PRによる規則弱化を今回検査に使わない。 |
| NFR3.1 | D5 | 証拠の独立照合 | source/run/attempt/producer/digestを取得情報と照合するC2 adapter。自己申告artifactだけで承認しない。重複check、不足、偽producer、stale結果を拒否する。 |
| NFR3.2 | D6 | 非成功の伝播 | taskは失敗時非0、cancel/timeoutを別状態で記録。まとめjobは依存jobの全結果を確認しskipを成功に変換しない。有限の読取retryのみ許容、書込みはない。 |
| NFR4.1 | D7 | 固定coverage経路 | 既存candidate collectorと固定第一者JS inventoryを再利用。realm別receiptを保持し欠落は拒否。ordinary-ciの軽量結果とpublication-candidateの回帰/80%証拠を別purposeとして区別する。 |
| NFR4.2 | D8 | 互換性と既存上限 | 開発コマンドをbun runに揃えてもNode固有処理はNodeで実行する。Node/browser consumer、Worker及び既存wasm/timeout/native一致を回帰確認。未変更guestは再ビルドしない。 |
| NFR5.1 | D9 | 有限jobと必要checks | PR番号、main用refをconcurrency keyとして重複を制御。通常CIに全体path filterを置かず常に終わる必要checkを提供。具体check名とjob timeoutはInfrastructure Designで固定する。 |
| NFR5.2 | D10 | 逐次検証と観測記録 | main sessionでbaseline→変更後の対象検査を逐次実行。実CIはsource SHAへ結びつけ、未実行は未検証と記録。必要資産なしのskipで完了しない。 |

## Failure Domains and Alternatives

通常CIは外部書込みを持たず、導入・生成・検査のいずれかが失敗すれば必要checkを非成功にする。公開候補検証の不足を通常CI成功で埋めない。formatterとmerge入口の操作別checksはU3の契約懸念として引き継ぎ、U1の全品質checkを自動pushへ一律要求する設計はここで決定しない。

一括Node→Bun置換は既存flags/worker/coverage境界の不確実性が大きいため採らない。開発入口と依存管理をBunにし、Node consumerの実行を明示する。cacheだけを再現性の根拠とする案はcache miss時に成立しないため採らない。各PRでguest全再ビルドする案は既存実践と実行コストに合わない。

## Verification and Sources

各D1–D10を正例・負例及び既存named testsへ対応づけてCode Generationでcommandを固定する。ビルド・試験はまだ実施していない。

../nfr-requirements/security-requirements.md、../nfr-requirements/tech-stack-decisions.md、../../../inception/contract-design/contract-summary.md。schema/権限と実装の不一致があれば完成としない。
