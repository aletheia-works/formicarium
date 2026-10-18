# U2 試験指示

## Runnerと設定
既存node:test、Playwright、strict TypeScriptを使用する。mise実体のNodeを解決し、宣言taskはmise run。新しいtests/migration-session/playwright.config.tsはChromium/Firefox/WebKit、workers=1、retries=0、既存COI静的serverと同じWorker環境を使う。試験ファイルはTypeScriptから既存buildでJS生成する。

## 単位内コマンド
準備（mainのみ）：mise run build、mise run typecheck。runner確認は解決したNode実体で node --test --test-concurrency=1 tests/package/runner-ready.test.js。
U2 unit taskの正確な内容：
```text
node --test --test-concurrency=1 tests/migration-session/guest-validation.test.js tests/migration-session/fixture.test.js tests/migration-session/reservation.test.js tests/migration-session/public.test.js tests/migration-session/consumer.test.js
```
宣言taskを整えた後は mise run migration-session-unit。
U2 browser taskの正確な内容：
```text
node node_modules/@playwright/test/cli.js test --config tests/migration-session/playwright.config.ts tests/migration-session/consumer.spec.ts
```
宣言taskを整えた後は mise run migration-session-browser。
段階3ではguest-validation.test.jsとfixture.test.js、段階5ではreservation.test.js、段階7ではpublic.test.jsとconsumer.test.jsの正確なfile subsetを同じnode:test runnerで実行する。いずれもbare全体npm testを使わない。

## ケースとデータ
各論理部品5–8件以上を下限とし、契約の境界件数を省かない。SHA vector・合成ELF header/segment、合法/不正metadata、上限/+1、Unicode/path/symlink/hardlink fixtureを使う。reservationは制御spawn/cleanupで遅延競合を再現しsleep依存を避ける。pack consumerは実guest/wasmと新候補を使用し、mockだけで実実行成功を主張しない。型fixtureは同unit types-valid/types-invalidを専用tsconfigで検査する。

## 品質と完了証拠
第一者配布JS固定inventory全ファイル、全realmを集約しline coverage≥80%。既存回帰はU2 completion側で1回ずつ逐次実行し、Unit test指示へ全体suiteのbare commandを混ぜない。timeout 600秒probe/840秒browser aube、probe8、native一致、wasm1GB、1worker/retry0を維持する。
同一source/pack/inventoryのU2暫定証拠を保存する。旧16JS/26pack・署名付きCIは履歴として保持し、現在21JS/31packのCI成功とは扱わない。U3 installは既存コードがあるが正式受入れ未完了、U4 commandは今後の作業として区別する。B1完全受入れへ昇格しない。実機Safari、現在sourceの未実施CIは未検証と記載する。

## U4の作業を戻した後の確認（2026-10-17、2回目の再開、追加Step 14–15）
新しい試験は追加しない。U2の製品コードは変わっていないため、今回は記録の更新と独立レビューを行う。checkpointの確認には、intentに記録された検証コマンド（人間が承認したU1の試験を今のsourceで実行するコマンド）を使い、mainが実行する。最終的なsource（U4を含む）でのU2の単体・browser・consumer・coverageの確認は、U4の作業がすべて終わった後に、U1〜U4のまとめた確認の中で行う。

## 最新toolchainでの確認（2026-10-17の再開、追加Step 12–13）
古い版のtoolで作った記録は、今の根拠にしない（人間の方針）。下の「今回の再開で行う確認」は、Node 24.21.0の時点の履歴として残す。今回は新しい試験を追加せず、mainが実行済みの結果を照合する。照合する対象は次のとおり。
- v10入力 `.artifacts/migration-preflight/current-recovery-input-20261017-v10.json`（SHA256 56c78183f6b1af91f9e1de7a1179c6d9ba416ff2be584834d4f5931a050d6fb9）
- report `.artifacts/migration-preflight/current-completion-7de2263f-2f39-4236-8895-82b7f32b55a8/current-local-verification-report.json`（SHA256 e7760ddbe0e943d0830e8a7093c30a5898cfc86f8d49ed5d94f7e55dab197a01）
- 20工程すべてのexit0。U2の単体・browser・consumerを含む。
- 全21配布JSの1768/1929行（91.65%）、skip0、1495 realm。

正式な確認は、人間が承認した読取り専用のコマンド `verification/verification-command-u1u2-v10.txt` で行う。mainが実行し、`verified:true` になることを確かめる。そのあと、intentに記録された検証コマンドでcheckpointを確認する。どちらもmainが一つずつ実行する。不一致・失敗・コード修正の必要が出たら停止し、修正案を確認する。

## 今回の再開で行う確認
v8固定入力 `.artifacts/migration-preflight/current-recovery-input-20261016-v8.json` のSHA256 25d44cb9c6def3cdc65317d76add2ecb90b5010fc05f4e097f982cdf98655bd0、結果 `.artifacts/migration-preflight/current-completion-8c15f728-80d1-40e4-90e6-cea86c413cb8/current-local-verification-report.json` のSHA256 fe0d5a01fe5e193258f10371d9cd7c3a446b8b820f3005dabcaeca0300b63079を照合する。2026-10-16T10:18:42.073Z–10:42:13.335Zの既存21工程exit0、U2/U3計測付きNode115件・U2の3ブラウザ9件、全配布21JS・1495realm（Playwright Node12件を含む）の1768/1929行（91.65%）、skipなしを原ログと対応づける。394 currentSource、435 evidenceFiles、独立consumer31ファイルのSHA一致と全生カウントの再計算を確認する。これは既に実行した結果の照合であり、本U2再開での全21工程の新規実行とは記載しない。旧v4/v5/v6/v7は履歴として保持し、U1の成果・完了承認とv8証拠を変更しない。
正式完了確認はレコード直下verification-command.txtに設定済みの、承認済みcurrent-completion.js verify（command SHA256 10098116c484c2f62527bd65045c06cab2b0a5433e1c312fb7ff6c3322623bef）をmainで実行する。固定入力・結果のハッシュ、現在source、全realm raw coverage、封印証拠の一致を要求する。コマンドを変更せず、全21工程を自動再実行しない。不一致・失敗・コード修正の必要が生じたら停止し、修正案と必要な再検証を確認する。AI-DLC本体・180秒期限・全品質条件を維持する。U3性能改善・36試行・専用CIは今回の確認に含めない。
