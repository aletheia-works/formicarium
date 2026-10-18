# U1 Source Manifest 補足

これは人間向けの収集対象一覧。独立レビューの正式な変更対象はsource-manifest.jsonが列挙し、レビュー要求時にその全byteをAI-DLCが束縛する。実packの14JS SHAはcoverage-report.jsonに、実試行・CIの原SHAはacceptance-assembly.jsonに保存済み。

engine 用 source-manifest.json は strict path claim schema だけで記載した。SHA/revision はこの別記録で扱い、strict JSON に付加しない。traceability.json の OK は既存実装/試験ファイルへの対応を示し、未実行の検証や U1 受入成功を意味しない。U1 は packaging のため functional design の AC/BR 展開は省略され、割当 FR1/FR9 と security-requirements の詳細 NFR 全11件を列挙する。

レビュー要求でscripts/testsのdirectory claimは、既存ignore規則に該当するemit済みJSを含むため拒否された。正式claimをversion-controlledのTS/d.tsへ明示展開した。ローカル生成JSは実build/typecheck/試験で検証済みで、生成物を配布sourceと誤認してignore規則を変更しない。integrationの生成controller.mjsはversion-controlled claimに含む。

## 収集対象

- scripts/migration-preflight/{assets,baseline,completion,evidence,prepare-mirror,runner,verify}.ts と既存 emit で生成した対応 .js。
- tests/migration-preflight/{assets,baseline,completion,evidence,prepare-mirror,runner,verify}.test.ts と対応 .js。
- tests/migration-preflight/{consumer.spec,serve,playwright.config}.ts、生成済み consumer.spec.js/serve.js、browser-modules.d.ts。
- integration/vivarium/preflight/build-baseline.sh、baseline-workflow.yml、生成物 baseline-controller.mjs。
- mise.toml の新 task 差分。
- docs/results/terrarium-migration-preflight.md、.json、terrarium-migration-preflight-evidence/ 以下の保存証拠全ファイル。
- この code-summary/traceability/source-manifest と main 管理の code-generation 観測記録。実行用 assembly/preserve helper は .artifacts 内の機械ローカル補助として区別して記録する。
- 共通live verification wrapper/taskと追加3境界試験は上記completion source/生成物に含まれ、ユーザー承認後の実コマンドexit0をcompletion-verification.mdへ記録した。

## 固定時の確認

現在の jj revision を main が観測し、第三者変更を混ぜず本 U1 の変更ファイルを全列挙する。生成 JS と bundle を省略しない。実36行は trialSourceCommit75e4adf0a51db8fcc1af25676d54fc81fa09efee、CI controller proof は b6921789c70cecf45635f1b22524dc8abf8698db を維持し、最新 docs revision に置換しない。実coverage候補 SHA と source digest inventory は別に束縛する。
