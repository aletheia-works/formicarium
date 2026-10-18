# U3 CI失敗記録と計測処理の修正案（実装未承認）

## 観測結果（検証済み）

- CI: https://github.com/Marukome0743/formicarium/actions/runs/38766787639 、attempt 1、job 116531969277、結論failure。
- 署名付きhead: ccbd932182442945b8e604133eca9fdf671c1429。GitHub verificationはverified=true / reason=valid。
- 入力は22論理行、254668126bytes。256MiB上限を維持し、実配信サイト復元、CIの通常U3単体74件・ブラウザ45件は成功。
- 全受入れ19工程のうち13工程が成功。14番目の計測付きU2/U3 Node試験は115件中113pass・2fail・skip0で停止。
- 失敗25: installed ELF and real U1 archive install via controlled transport and real public guest run、185428.722976ms、TIMEOUT / Install deadline exceeded。
- 失敗27: installed failed reinstall and aborted fetch preserve seed filesystem、185946.093842ms、同じTIMEOUT。
- 両方ともcoverage/runtime/install.jsでvalidateGuestの後のInstallLifetime.yield/checkに到達してinstall期限を超過。元ソースはruntime/install.tsのvalidateGuestと直後のyield。
- CI coverage集計、CIブラウザcoverage、CI正式36試行は未完了。ローカルの成功をCI成功へ置換しない。
- CIの証明書・鍵削除と失敗証拠uploadはsuccess。自動再試行・追加pushは未実施。
- 取得ZIP: .artifacts/migration-install/ci-failed-38766787639-1/artifact.zip、142993bytes、22members、SHA256=a8711351559e6cc040e807cdfbe090c9d9b49669a2988d5e3edcb894f429c0e1。API digest/sizeと一致を確認して展開した。
- 生ログ: 上記members/migration-install/ci-execution-1792080754549/command-14.log。失敗箇所は147行と172行。

## 原因の評価

検証済み: 直接の停止原因はプロジェクトの計測付きinstallにおける180秒期限超過。CI workflowのこの実行経路はNode/Bunとプロジェクトの検証コードで、AI-DLC本体の実行失敗ではない。

推測・性能寄与は未検証: SHAの多数のstatementへ追加されたcoverage getter/setterの反復コスト、特に各incrementでのAtomics.load/storeがCIでの期限超過に寄与している。通常試験は同じCIで成功し、ローカル計測付き試験も成功したため、計測負荷と実行環境差を優先調査する。プロファイル前に唯一の原因とは断定しない。

## 承認対象の修正案

1. scripts/package/coverage.tsのbridgeSourceとtests/package/coverage.test.tsを対象に、各realmのcounterが単一writerであることと、hostが読み取りだけを行うことを確認する。共有計測部品なのでU1/U2への影響も確認する。
2. 単一writerが確認できたcounterでは、初期値をAtomics.loadで取得し、getterはそのrealm内の最新値を参照する案を実装する。setterは非負安全整数を検証し、MAX_INT32へ飽和させた値を従来どおり毎回Atomics.storeで公開してから最新値を更新する。反復ごとのAtomic loadを省き、counts・statement map・realm登録・Atomic書込み・飽和の意味は維持する。単一writerを保証できなければこの案を適用せず、再確認する。
3. 既存の境界・飽和・不正値拒否を維持し、従来方式とのcounter列一致、複数realmの独立性、Worker中断後のhost可視性、未収集ファイルを残した21JS分母と行coverage80%以上を検証する。hit-only化、sampling、SHA省略、試験skipは行わない。
4. ビルド・型検査・対象回帰と計測負荷をmainで逐次確認する。install180秒、非ダウンロード中央値3秒、probe600秒、aube840秒、1worker、retry0、容量上限は変更しない。新source・候補・CI入力を固定し、全回帰・coverage・正式36試行を再検証する。旧sourceの証拠と失敗ZIPは保持する。
5. 成功後に追加の署名付きpushとCI再試行1回の実コマンドを提示して個別承認を待つ。現在の失敗CIから完了確認や最終承認を生成しない。

本書は提案であり、実装コード・承認済み計画本文・品質基準・AI-DLC本体は変更していない。
