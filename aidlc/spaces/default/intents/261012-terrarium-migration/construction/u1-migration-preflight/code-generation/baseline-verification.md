# 実装前の検証

2026-10-12 main sessionで逐次実行。変更前jj working copy ullzlqzr / bdf8f8a1、parent 74dd4477。既存の多数の変更を保持する。

## 検証済み

- `mise run build`、`mise run typecheck`: exit 0。
- `mise run test-light`: exit 0。最終tooling集計234 pass、0 fail。公式Release資産がない供給試験2件のskipは実供給成功と扱わない。
- 初回 `mise run test-consumer`: exit 1、171件中168 pass / 3 fail。manifestと外部consumer環境が不足。ユーザーが入力整備と再実行を承認。
- 現ソースを既存stage-package.jsで `.artifacts/migration-preflight-baseline-package` へstage、npm pack --ignore-scripts、verify-package.jsで24ファイルを検証。tgz SHA256 `742e1c368bd913d786c6baa3c5d1e1e82cbc252e38e0cc78429f9f1098bc30ca`、clean core `a882fb2f3df14115b7e46f6812fb296eef5934d7`。
- 同tgzを `/private/tmp/formicarium-migration-preflight-consumer` へ npm install --ignore-scripts --no-audit --no-fund。consumer試験自身が全installed file digest一致を確認。
- `FORMICARIUM_CANDIDATE=/Users/mutoakio/Documents/formicarium/.artifacts/migration-preflight-baseline-package.manifest.json FORMICARIUM_CONSUMER=/private/tmp/formicarium-migration-preflight-consumer mise run test-consumer`: exit 0、189 pass / 0 fail / 0 skip。
- Node24で `node --test --test-concurrency=1 tests/node/build.test.js tests/node/probe.test.js tests/node/aube-1645.test.js`: exit 0、28 pass / 0 fail / 0 skip。probe全8項目、コアのlock/clean/JIT無効、aubeのnative書き起こし一致を確認。core/guest再buildなし。

## 診断と未検証

最初に同Node回帰を `.build/tests/node/` から実行した際は、相対rootが `.build/` に変わり資産欠損で失敗した。既存emitが生成する本来の `tests/node/*.test.js` へ入口を訂正して上記の成功を観測した。製品不具合の修正はしていない。

- `FORMICARIUM_PORT=8795 node node_modules/@playwright/test/cli.js test tests/browser/probe.spec.ts tests/browser/aube-1645.spec.ts --workers=1 --retries=0 --output .artifacts/migration-preflight-baseline-browser`: exit 0、33 pass、41.1秒。Chromium/Firefox/WebKitでprobe全8項目とaubeのnative一致を確認。実機Safariの検証ではない。

移管用36試行、CI baseline再利用、今回の固定分母coverageは未検証。既存成功を今回の実測証拠として代用しない。
