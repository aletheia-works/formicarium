# CI 38784488074：失敗結果と次の計画案（未承認）

## 検証済み

- 承認済みの追加署名付きpush1回を実行。head c30e2a9b90eabaa35a2fd9ee51d313209ce9290e はGitHub verified=true / reason=valid。署名前fb1a65d526f7d014ccf72555d257a27d20ad22e2とtree 5cf3a2327c348bcb9c738e347fd8f63c84bd1a55 が一致。
- https://github.com/Marukome0743/formicarium/actions/runs/38784488074 、attempt1、job116592855385 は39m4sでfailure。再push・manual rerunなし。
- 固定入力・コア復元、ビルド・型検査、独立consumer、通常回帰は成功。受入れ19工程の13工程が成功し、14番目の合同計測付きNode試験で停止。
- 合同Node115件：114pass / 1fail / cancelled0 / skipped0 / todo0。前回失敗したtest25（実ELF・archive install＋guest run）は成功し、試験全体719975.642834ms。複数installと実行を含む値であり、install期限を延長した値ではない。
- 唯一の失敗test27 `installed failed reinstall and aborted fetch preserve seed filesystem` は180681.584382ms、TIMEOUT / Install deadline exceeded。consumer.test.js149行の最初のinstallで、同期validateGuestの後のInstallLifetime.yield/checkにより期限超過を検出した。失敗再install・preabortの後続検証には未到達。
- CI browser coverage・coverage最終集計・CI正式36試行は未到達。ローカル全18工程・coverage91.65%・正式36成功は保持するが、CI成功へ置換しない。
- CIの専用証明書・秘密鍵削除とartifact uploadはsuccess。
- 保存ZIP `.artifacts/migration-install/ci-failed-38784488074-1/artifact.zip` は143386bytes / 22members、SHA256=74b190b75dd24923d094583fe19587cd1e25904fb4f0e885cbc6caa93dbc396d。独立APIのsize/digestと一致。生job.logも同ディレクトリへ保存。
- このCI経路にAI-DLC実行はなく、直接原因はプロジェクトの計測付きinstall期限超過。AI-DLC本体は変更しない。

## CPU診断（検証済み・合格証拠とは別）

同じ新collectorと実ELF36948544bytesを使い、計測付きguestSha256単独をmainでCPU profileした。旧preloadのexit writerは使わず、メモリ内の新realmへ収集し、保持済み証拠は変更していない。結果126673.701459ms、独立Node cryptoとSHA256一致。

`.artifacts/migration-install/collector-profile-20261016/CPU.20261016.035954.9615.0.001.cpuprofile` の自己サンプル時間はguestSha256 53.50%、rotate 35.90%、counter setter 5.33%、getter0.63%。これは単独1試行の診断であり、統制した性能比較やCI改善率を示さない。インライン化・プロパティアクセス等の負荷は呼出元へ計上され得るため、53.50%/35.90%を純SHA算術の時間と断定しない。

推測：反復Atomic loadだけの削減では不十分だった。生成された `cov().s[id]++` の反復プロパティアクセスとgetter/setter呼出しを含む計測経路が、なおSHAループに大きな負荷を加えている。直接記録方式が期限超過を解消するかは未検証。

## 次の計画案

1. 共有collectorと計測コード生成部に限定し、statement incrementをrealm専用の直接記録関数へ結ぶ案を具体化する。製品tarball・SHA算法・install180秒期限は変更しない。
2. 現在と同じ全statementの全hit、各更新のAtomics.store、MAX_INT32飽和、registration、host可視性を維持する。Istanbulのstatement mapとfunction/branch計測も省略しない。更新式の返値・例外・実行順序を変えないことをAST単位で確認し、対応できない生成形は黙って計測を落とさず拒否する。sampling・hit-only・batch書込みは不可。
3. 旧方式と新方式の実instrumented fixtureを比較し、全counter列・全Atomic書込み列・返値・例外・分岐/関数counts・realm独立性・Worker終了後可視性の一致を検証する。未実行21JSを分母から外さない。
4. 実装前に正式計画と試験手順を改訂して確認する。承認後にRED→GREEN、ビルド・型検査・対象回帰、新source/candidate/consumer/固定入力、全18工程・全21JS coverage80%以上・正式36試行を逐次検証する。性能比較を行う場合はABBAと順位検定を使い、CI結果の代わりにはしない。
5. install180秒、非download中央値3秒、probe600秒、aube840秒、1worker、retry0、容量上限を維持する。成功後だけ追加の署名付きpushとCI1回の実コマンドを提示し承認を待つ。旧新の失敗証拠・成功証拠・pending verifierは保持し、失敗runからU3完了を作らない。

本案は未実装。現在の承認済み計画本文・試験手順・製品コード・品質基準は変更していない。
