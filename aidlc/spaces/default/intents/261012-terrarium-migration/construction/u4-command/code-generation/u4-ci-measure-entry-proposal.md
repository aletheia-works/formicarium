# 修正案：U4のCIでmeasure工程が拒否された件（CI run 39025918280）

作成：2026-10-17。状態：人間の承認待ち。承認を受けるまで、どれも実行しない。

## 1. 起きたこと（確認済み）

- 署名付きpush：commit ec8ab359（f1e292c8に署名したもの。親は7c7ceaf4、GitHubの署名はVerified）を、`codex/terrarium-migration-u4` へpushした。
- CI run [39025918280](https://github.com/Marukome0743/formicarium/actions/runs/39025918280)（attempt 1）の結論はfailureだった。実行時間は10:42〜11:10。
  - 正式36試行より前の工程はpassした（Nodeの188件、browserの99・9・9・9件）。coverage-reportも作られた。
  - 次の `measure` 工程が「U2 CI Node entry refused」で拒否された。そのため、正式36試行とB1は、CIでは実行されていない。
- 原因：項目6で、U4の `completion.ts` の `measure` 工程を、新しいU4のCLI `scripts/migration-command/measure.js` に変えた。しかし、U4のCIのcommand対応（`scripts/migration-command/ci.ts` の `mapCommandCICommand`）は、直接起動できるNodeの入口として `scripts/migration-command/coverage.js` しか許していない。それ以外は、U3を経てU2の対応に回され、そこで拒否される。ローカルのcompletionは、この対応を通らない。そのため、ローカルの確認では見つからなかった。
- ローカルで、completionの全22工程をCIの対応に通して確かめた（読取りだけ）。拒否されるのは `measure` だけで、ほかの21工程は通る。
- 保存した証拠（`.artifacts/migration-command/ci-39025918280/`）：
  - REST（run・jobs・commit・artifacts）。
  - artifact（sha256:1120d14b…、379630 bytes）。
  - 失敗したstepのlog。
- このrunは、失敗の記録として残す。成功の証拠としては使わない。

## 2. 直し方（案）：U4のfileだけを変える

1. 先に、再現試験を書いてfailを観測する（`tests/migration-command/acceptance.test.ts`）。
   - 新しい試験：completionの全工程を `mapCommandCICommand` に通すと、すべて受け付けられること。`measure` は `scripts/migration-command/measure.js` のまま、引数もそのままであること。
   - 既存の拒否の試験（未知のtask、checkoutの外へのpath、任意の実行file）は残す。`scripts/migration-command/measure.js` についても、checkoutの外へのpathが拒否されることを加える。
2. `scripts/migration-command/ci.ts` の `mapCommandCICommand` で、直接起動できるNodeの入口に `scripts/migration-command/measure.js` を加える。`coverage.js` と同じく、checkoutの外の絶対pathは拒否する。ほかの入口は増やさない。
3. mainで、`mise run build` のあとに次を1つずつ実行し、fail・skip 0を確かめる：U4のacceptance、`migration-command-unit`、test-light。
4. 変更はU4のfile（`scripts/migration-command/ci.ts`・生成JS、`tests/migration-command/acceptance.test.ts`・生成JS）だけである。U1〜U3がclaimするfileは変えない。U4の計画の項目8として書き、計画の承認を受けてから直す。

## 3. 直したあとの確認（それぞれ、実行の直前に実コマンドを示す）

U4のsourceが変わるので、U4の候補を作り直す。CIの証拠と同じsourceの、ローカルの受入が必要になる。U3の候補にはU4のfileが入っていないので、U3の受入（D2）と、U1のv11はそのまま使える見込みである（推測。作り直したU4の候補で照合して確かめる）。

1. U4の候補と独立consumerを作り直す。
2. 証明書を一時的に登録する（macOSの認証が必要）。
3. U4の受入（D3）をローカルでやり直す。
4. 証明書を削除し、不在を確かめる。
5. U4のCI入力bundleを作り直す（U4の候補とsourceの一覧に結び付くため）。
6. commitを作る。新しい変更は、ec8ab359の子commitにする（pushしたcommitは書き換えない）。
7. bookmarkを動かし、署名付きでpushする。
8. CIをもう1回動かす（2回目）。これは、「追加の署名付きpushとCI再試行1回」の承認にあたる。

失敗したら、基準を変えずに止めて相談する。3回目のCIは、この案に含めない。

## 4. 変えないこと

AI-DLC本体、品質基準（install180秒、非download中央値3000ms、coverage 80%、容量上限、worker 1、retry 0）、U1〜U3のfile、受入れ中の公開RCとそのタグ・固定入力。別のintentの記録は、引き続きローカルのcommitに残し、pushしない。

## 5. 注意

- ローカルのU4の計測では、biome/firefoxの中央値が2838.9msだった。基準まで約160msしかない。CIでは超える可能性がある。超えたら、基準を変えずに止めて相談する。
- ローカルの再確認（D3）とCIは、それぞれ1〜2時間かかる見込みである（過去の実行から）。
