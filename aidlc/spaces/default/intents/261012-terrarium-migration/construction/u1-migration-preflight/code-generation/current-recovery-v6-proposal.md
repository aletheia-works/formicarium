# U1完了確認：v6固定入力による復旧案

## 原因と復旧範囲

検証済み：旧v5の候補sourceIdentityは2d449d46138cb20b7cd76b1657ab936febefea1c0c0b81e9b2983704b8e4c096、現在の候補は8897cea442a680b469c474b0a8164175b5499a48f200cc1bd6eb8f7f4054967c。CI入力復元・必須試験skip拒否・collector修正の13ソースが異なる。現行verifierは古い候補への最新ソースの付替えを正しく拒否した。

製品tarballは両候補ともcc89a7dcdd015da80b9c11569a4fef2daa8b3f2131610caa7fa20682c6e995b2。検証プログラム・AI-DLC本体・品質基準を修正する必要はない。新しい固定入力を追加し、既存の21工程を現在のソースで実行する。

## 準備済み入力

- `.artifacts/migration-preflight/current-recovery-input-20261016-v6.json`
- 入力SHA256：42555df77fbbdd15396bcd47a6992ecd2f0676f40d48ecb56128c56acfa8eda4
- sourceIdentity：8897cea442a680b469c474b0a8164175b5499a48f200cc1bd6eb8f7f4054967c
- currentSourceIdentity：89268a914c68f564727a5fc3d99cb68a45a213011c460d88200bd1be62c96514（394ソース）
- 候補：`.artifacts/migration-install/candidate-814696a5-7374-4064-91a1-d0005dd8b6f2/package.manifest.json`
- 独立consumer：`/private/tmp/formicarium-u3-collector-consumer-20261016`
- 実配信site：`.artifacts/migration-install/actual-site`（11ファイル）

既存prepareCurrentInput/writeCurrentPreparedInputで生成。準備時に候補の現在source/実packと独立consumer、実配信siteを照合した。旧v5入力のSHAと保持する56個別歴史証拠・retained verifier/bindingのSHAも確認。v5と旧reportは変更していない。

## 承認対象の実コマンド

workspace rootでmainがホスト権限により実行する。実ブラウザ起動のためホスト権限を使う。21工程は未実行であり、これは成功報告ではない。

```sh
BUN_EXECUTABLE=/Users/mutoakio/.local/share/mise/installs/bun/1.4.2/bin/bun \
npm_config_cache="$PWD/.artifacts/migration-install/npm-cache" \
/Users/mutoakio/.local/share/mise/installs/node/24.21.0/bin/node scripts/migration-preflight/current-completion.js run .artifacts/migration-preflight/current-recovery-input-20261016-v6.json 42555df77fbbdd15396bcd47a6992ecd2f0676f40d48ecb56128c56acfa8eda4
```

## 維持する確認内容

既存retained履歴証拠のread-only照合、build/typecheck、U1単体・完了確認ツール、軽量試験、U2/U3単体・ブラウザ・独立consumer、既存Node/ブラウザ回帰、全21配布JSの全realm coverage収集と80%以上を、元の21工程の順序で実行する。必須試験のfail/cancel/skip/TODOは0を要求し、実child exitと生ログ・SHAを新規出力先へ記録する。

install180秒、非download中央値3秒、probe600秒、aube840秒、1worker、retry0、wasm1GBと既存容量上限を維持する。今回の21工程に正式36試行は含まれず、過去C01の履歴照合と現在ソースでの回帰・coverageを確認する。U3の正式36/署名CI受入れは別工程として未完了を保つ。

## 成功後

新しいcurrent-local-verification-report.jsonの実path/SHAを使う短いverifyコマンドを提示し、承認を受けてからConstruction Verification Commandへ登録する。U1/U2の現在ソース確認を復旧し、その後に既に改訂済みのU3直接counter生成計画の実装前承認へ進む。新reportもacceptancePassed=false、mergeAllowed=false、laterUnitAcceptance=falseを保ち、U3 CI成功や統合許可には使わない。

追加push・CI再試行・製品コード変更は本コマンドに含めない。失敗時はその箇所を確認して停止する。
