# 固定コアGitオブジェクトのCI入力への移管

## 修正範囲

人がCI第1試行の失敗後にRetryを承認した補修。blink.lockとコアbyte・SHA・品質条件を維持する。取得先の広告refに依存するblink用actions/checkoutを、Git bundleのSHA256検証と空ディレクトリへの復元へ置き換える。メインのcheckoutは従来どおり固定Action SHA。Git bundle形式の作成・検証・復元にはGitが必要であり、これ以外のrepository操作にはjjを使う。

入力manifestのexact destinationへ `.artifacts/migration-session/blink-source.bundle` を追加し19件にする。既存bounded regular-file/dedup blob・全SHA検証を再利用し、credential/config/working copyをtransportに含めない。新ci-core入口は入力照合後にGit objectsだけを空のstaging repoへ復元し、固定HEAD/upstream object/差分/clean statusを検証して `.vendor/blink` へ設置する。既存vendorがあれば上書きしない。失敗時は自分のstagingだけを削除する。Git remote networkを使用しない。prepare入口も復元したコアを照合する。

## 観測済み入力と検証予定

mainで `git -C .vendor/blink merge-base --is-ancestor f006a4fc6f9b8de9272504fdff0dbbe5ce5dc580 a882fb2f3df14115b7e46f6812fb296eef5934d7` exit0。`git bundle create --version=2 ... HEAD` とverifyが成功し、headerはv2/1ref HEAD a882fb2f3df14115b7e46f6812fb296eef5934d7、complete history、前提objectなし。bundleは8,776,305bytes、SHA256939466d397658897730cf84d64581605b3aa27671da577626a72f50a71e5be04。

mainで負例試験、build/typecheck、空CI専用checkoutの実restoreを検証する。実HEAD/upstream diffと既存Node build/probe/aubeの28試験を同じ入力で逐次実行する。復元・入力・manifest/source inventoryが一致した新packを作り、独立consumerの全SHAを確認する。旧CI結果や古いcoverageは新CI成功としない。

成功したら署名済み新head、入力SHA、前pushとの差分、追加pushの実コマンドとCIの新restore/prepare/verify argvを提示して承認を待つ。追加push・CI再試行はこのRetryだけでは実行しない。
