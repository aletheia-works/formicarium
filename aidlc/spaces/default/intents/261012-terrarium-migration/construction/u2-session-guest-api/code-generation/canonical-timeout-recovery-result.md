# 検証済み: 30分上限からの運用復旧

AI-DLC本体、承認済みアプリケーションsource、品質基準は変更していない。

## 観測した実行

承認済みの元コマンド（SHA256 6c4f0a410bb70369dc1f40f1d4d2ed213701e0ad6474aa321ebf5095441c7dbc）をmain sessionで直接実行し、全14工程がexitCode 0で終了。開始 2026-10-13T18:51:16Z、終了確認 2026-10-13T19:25:45Z。各工程の制限は維持。計測ブラウザは配布99件、U2 9件とも成功。

completion-report: /Users/mutoakio/Documents/formicarium/.artifacts/migration-session/completion-628a2334-009d-4685-9d50-1a08cb96f12c/completion-report.json
report SHA256: 2077503099d1fcd7f70038af37b03b42b5ca26f731d07f06d324a7e50f48038a
execution-binding SHA256: c028637617e4eb1f8813ddd6908a3ebfa8a47f18c2f986187d960d8b81517c67
verifier SHA256: 65859991aa70708821fe64a3f484c6b6b6ce1a3d96f67f252a94db5a591e4623

## 照合結果

現在のsource277件、配布26件、JS16件、raw1370 realms、署名付きCI headと証拠を照合。coverageは1201/1336行=89.89%、閾値80%、除外行0。

実行: RECOVERY_EXECUTION_BINDING=.artifacts/migration-session/recovery-execution-binding.json /Users/mutoakio/.local/share/mise/installs/node/24.21.0/bin/node --test .artifacts/migration-session/verify-completed-result.test.mjs
結果: 25 passed, 0 failed, 0 skipped。実結果受理、必須工程欠落、非0exit、source/pack/CI差分、raw証拠seal差分、report/script改変、coverage不足の拒否を確認。

新しい短いコマンドを直接試行しexit0（tool wall time 0.126秒）。証拠・source・consumer・CI・raw coverageを読むだけで、proof/stateを変更しない。

## 次の確認

2026-10-13T19:29:36.675Z–19:29:37.127Z、承認済み新コマンドで公式checkpoint verifyを実施。exit_code=0、evidence_unchanged=true、verified=true、proof id=71ba4bdc-06e8-4cd0-bfe0-29c065a4d0c1。自動完了方針に従いU2 approved=trueを記録し、U3 functional-designへ続行した。新コマンドはこのU2結果専用で、後続Unitへの再利用は現在sourceの差分を拒否するため、必要時に新結果と承認で更新する。

/Users/mutoakio/.local/share/mise/installs/node/24.21.0/bin/node .artifacts/migration-session/verify-completed-result.mjs .artifacts/migration-session/recovery-execution-binding.json c028637617e4eb1f8813ddd6908a3ebfa8a47f18c2f986187d960d8b81517c67 2077503099d1fcd7f70038af37b03b42b5ca26f731d07f06d324a7e50f48038a 65859991aa70708821fe64a3f484c6b6b6ce1a3d96f67f252a94db5a591e4623

