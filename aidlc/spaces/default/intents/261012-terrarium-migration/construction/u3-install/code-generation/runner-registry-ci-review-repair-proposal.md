# U3 runner記録とCI添付：レビュー対応案

状態：具体化済み・実装未着手。正式計画の改訂と実装前承認を経て実施する。180秒期限、非download中央値3000ms、全21配布JS・全realm coverage80%以上、全容量上限、1worker/retry0を維持する。AI-DLC本体と製品runtime/SHA/APIは変更しない。

## 検証済み

全18工程はexit0。source b608b2f3c969cf1e85c5f98245d45acaf0af53dae575167b64e7b4e624e75932、pack cc89a7dcdd015da80b9c11569a4fef2daa8b3f2131610caa7fa20682c6e995b2、21JS・1768/1929行=91.65%、1495realm。Playwrightは各suite4process・計12processのbegin/endが存在し、現在の証拠は正常。

独立レビュー：construction/u3-install/code-generation/reviews/review-02.md。既存の実配信入力・skip拒否指摘は修正済み。新たに下記2件のMajorを確認。正式36試行・新CI・U3正式完了は未完了。

## 修正1：process一式の欠落を検出する

現在のvalidatorは各suiteに1組以上あるbegin/endの対応だけを見る。mainの読取専用確認では、ファイルを変更せずreaddir結果からpackage:32536のbegin/end両方を仮想的に除外すると、12→11realmを正常として受け入れた。

生成bootstrapが各processの製品import前に、既存の個別begin/endとは独立したsuite起動台帳へgeneration/suite/pid/ppidを記録する。並行processでも1記録の書込みを分割しない追記方式とし、同generationの全起動pid集合と全begin/endを厳密照合する。片側だけでなく両ファイルが欠落しても拒否する。台帳・個別記録の重複、未知identity、改変、未登録counter、異常終了も拒否する。台帳欠落や空集合を正常へfallbackさせない。

変更は承認済みscripts/package/coverage.tsと既存2試験ファイルの範囲内。生成物は新coverage出力内のみ。実Node子processを複数起動する回帰で、1processの両receipt除去・片側除去・重複・未知pid/生成idを拒否し、正常全processの生カウントを保持することを確認する。既存成功証拠は変更しない。

## 修正2：CIの独立再検証に必要な生記録を保存する

.github/workflows/migration-install-u3.ymlのartifact upload pathsに、新generation・起動台帳・全begin/endを追加する。現在の5TS承認範囲に、このworkflow1個別pathを明示追加する。既存添付の削除、権限拡大、CI回数増加はしない。

追加対象は以下の範囲。台帳の具体ファイル名は正式計画へ固定する。

```
.artifacts/migration-install/completion-*/coverage/coverage-playwright-generation.json
.artifacts/migration-install/completion-*/coverage/coverage-playwright-node/**/*.json
.artifacts/migration-install/completion-*/coverage/coverage-playwright-node/**/*.jsonl
```

新CI ZIPの独立検証で、generation・起動台帳・全begin/endと同一source/pack/runを再照合する。過去のpending verifier/bindingや旧成功・失敗ZIPを付け替えない。

## 検証と承認順

1. 人間が本修正案の正式計画反映を選択した後、計画・手順書を改訂し、実装前承認を得る。
2. mainで実Nodeの両receipt欠落を拒否すべきREDを観測し、台帳照合を実装して同じ試験をGREENにする。workflow添付も実生成pathとの対応を確認する。
3. build/typecheck・対象回帰・3suite入口確認後、新source/固定候補・入力で全18工程、全21JS・全realmを逐次検証する。
4. 正式36試行のlocalhost証明書登録はmacOS認証が必要になり得る。利用者不在時の条件付き承認を認証の代行やpush承認へ読み替えない。PCで認証できる時に、更新した候補に対する実コマンドを提示して承認後に実施し、終了後は信頼設定と証明書を削除して未登録を確認する。
5. ローカル受入れ後に追加署名付きpush・CI1回の具体コマンドを提示する。新CI・独立ZIP照合・再レビュー・正式完了確認の前にU3完了としない。
