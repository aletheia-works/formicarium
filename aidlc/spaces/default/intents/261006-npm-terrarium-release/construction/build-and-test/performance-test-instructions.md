# Performance Test Instructions

## Sources and Targets

security-requirements.md NFR2.1/2.2、security-design.md SD3/SD5、各UnitのTesting Contractを根拠とする。新しいlatency/SLAやhost heap上限を追加しない。

## Checks

wasm1GB上限はtests/node/build.test.js、deadline/CPU abort・timeoutと終了後再runはtests/package/consumer.test.jsとnested-worker.test.js、制御されたcleanup失敗はlifecycle.test.jsで確認する。性能計測にinstrumented coverageの時間を流用しない。probe600秒、aube browser840秒、pitchfork browser600秒/Node120秒、1worker/retry0を維持する。

## Evidence

実行ログと候補identityをtest-results.mdへ結合する。保存済み試験を採用する場合は元コマンド・上限・SHA一致の照合を示し、新測定とは呼ばない。適用targetが未確認ならUnverifiedとし、閾値を緩めない。


## 再開後の検証 — 2026-10-10 v2

正確なmain逐次実行手順はverification/resume-20261010-v2/run.mjsとresults.json。Node実体はmise ls/where nodeで解決した24.21.0。製品/test tsc→emit→runner→Unit証拠照合→U2/U3/U4/CIの限定Node回帰。browserは既存configとv9候補、1worker/retry0、出力.artifacts/build-and-test-resume-20261010-v2/{u2-browser,u3-browser}。旧成功と新実行を合算しない。最新collectorを含む遠隔CIはUnverifiedでありU4へ修復を戻す。閾値・固定分母・既存期限は不変。
