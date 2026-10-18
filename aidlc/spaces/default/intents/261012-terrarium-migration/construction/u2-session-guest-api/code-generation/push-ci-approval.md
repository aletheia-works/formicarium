# U2 push・1回のCI試行の実行内容

ローカル検証済み。外部push・実CI・GitHub Verified表示は未検証であり、未実行。U2受入、公開、tag、Release、PR作成はこの操作に含めない。

## 固定した対象

- fork: Marukome0743/formicarium、bookmark: codex/terrarium-migration-u2。
- ローカルSSH署名済みhead: `af87219fbf434d35a63decca12e6e08a2933194a`。
- 基底main: `567799f5a9e36755c40f7d477a414974362e55e8`。
- source identity: `e5cfa5e156cc8f547ffd16f1a9d0ab045589ea9b9bf0c5e1eda51d110b417d88`、275 source entries（生成JSもSHA照合）。
- 入力manifest SHA256: `e09955cfd656e3d912e4c3c6618b3e539b9f0270cb1764310a88a00d48056523`、18 destinations/17 blobs/83,857,237 bytes。HTTPSから新取得せず、専用branchの `ci/migration-session/inputs.bundle.json` とpayloadを照合する。
- 新local pack SHA256: `e68fec9379c70008dd43d4980bd756336b94297c1dd376f0e1aabbc3297a2ae0`、26files/16JS。CIでは実headを使って新packを生成し、そのpack SHAを改めて観測する。
- mainとの差分182files。U2/U1ソース、必須のビルド・回帰試験・公開/保守の固定依存、CI入口、18固定入力。過去intentやローカルhook支援4ファイルは含めない。差分一覧は同ディレクトリの `push-diff-final.txt`。

## ローカルの実結果

build/typecheck exit0。CI境界とcompletionの14試験pass14/skip0。専用checkoutのtest-light exit0: unit177pass/2known skips（リリース入力待ち）、tooling236pass/skip0。依存補完中のENOENTは診断logとして残し、成功へ置換していない。固定入力から新pack作成、checkout外consumer install、全file SHA照合exit0。local contextはlocal-preparation/acceptancePassed=false、sourceCommitKindはlocal-preparation-base-revision-with-working-source-inventory。以前の全realm89.88%は旧source identityの証拠のまま。本CI入口に対する新全realm CI結果は未検証。

## 実コマンド

ローカル作業ディレクトリ:

```text
/Users/mutoakio/Documents/formicarium/.artifacts/migration-session/ci-checkout
```

署名付き専用bookmarkだけをpush（SSH agentにアクセスするhost権限で実行）:

```sh
/Users/mutoakio/.local/share/mise/installs/jj/0.46.0/jj git push --remote origin --bookmark codex/terrarium-migration-u2
```

このpushが `.github/workflows/migration-session-u2.yml` を1回起動する。追加dispatch/retryをしない。実CI jobはNode24.21.0/Bun1.4.2、ubuntu-24.04、contents:read、1job、最大360分、artifact1日保存、cache/publish権限なし。料金設定・有料runner設定は変更しない。金額は契約依存で未確認。通常CIはmain限定、旧verifyはcodex/verify限定、新専用branchを対象にしない。

workflowの準備と検証argv:

```sh
node scripts/ci/tasks.ts install-frozen --cacheless
node scripts/ci/tasks.ts build
node scripts/ci/tasks.ts typecheck
node --test --test-concurrency=1 tests/migration-session/ci.test.js
node node_modules/@playwright/test/cli.js install --with-deps chromium firefox webkit
node scripts/migration-session/ci.js prepare ci/migration-session/inputs.bundle.json "$RUNNER_TEMP/formicarium-u2-consumer-$GITHUB_RUN_ID-$GITHUB_RUN_ATTEMPT" .artifacts/migration-session/ci-context.json
node scripts/migration-session/ci.js verify .artifacts/migration-session/ci-context.json
```

checkout Actionsは本体とblinkを固定SHAで取得、blink refはa882fb2f3df14115b7e46f6812fb296eef5934d7/fullhistory、再buildなし。verifyは承認済みのcompletion逐次suiteを厳密adapterで実行し、80%と全realm条件を維持する。prepare/verifyは作業領域内npm専用cacheを使用する。実CI contextをローカルで偽装しない。成果artifactにcore/guest巨大入力やnode_modulesを再保存しない。

## 実行後の確認・停止条件

push後にGitHubから実headとVerifiedを確認し、run/head/attempt/conclusionとartifact SHAを独立API観測する。job自身のsuccessだけを最終受入にしない。push/CI失敗・未知状態では再送せず確認する。必要な停止は対象runのcancel、切戻しは専用branch削除のみ（別途確認して実行）。main・既公開版を変更しない。branch削除でpayload参照を外せるがGitHubのGitオブジェクト保持期間は制御しない。
