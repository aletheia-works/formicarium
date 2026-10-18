# 固定Biome CI試行1

2026-10-13、ユーザーが専用ブランチpushとCI試行を承認。実CIは失敗（baseline job 9m8s）。

- Repository：Marukome0743/vivarium（公開フォーク）
- Base：694026b28b949eb2972c8b42b95b1e291ae2ab0e
- Branch：codex/terrarium-migration-baseline-u1
- Signed commit：68953171ad53f3b112dfafe5907929421026b8eb
- GitHub commit verification：verified=true、reason=valid（REST HTTP200）。GitHub connectorでもcommit/diffを読み確認。
- 差分：承認済み4ファイルのみ。専用jj workspaceはformicarium/.artifacts/vivarium-baseline-u1。元のvivarium workspace/main/upstream変更なし。
- Actionlint1.7.12 workflow検査exit0、ShellCheck0.11.0 build-baseline.sh検査exit0。
- jj git push --remote origin --bookmark codex/terrarium-migration-baseline-u1：exit0、sign-on-push=trueを維持。
- controller SHA256：581071ad54af94289aaf378f7c0a77b28cfa375babf476ccf226f9981ca5116a
- Workflow ID：381088086、workflow_dispatch、専用branch refで1回起動。connectorにdispatch操作がないため既存mise-managed gh2.102.0のworkflow runを使用（exit0）。
- CI URL：https://github.com/Marukome0743/vivarium/actions/runs/38290361603
- Run headSha：68953171ad53f3b112dfafe5907929421026b8eb、一致確認。初回観測status=queued。

検証済み：固定ソースcheckout、実rustc/cargo入力生成、依存取得は成功。tikv-jemalloc-sys のbuild.rsがmakeを起動する箇所で「No such file or directory (os error 2)」。固定Rust Alpineビルダーのmake不足が直接原因と推測される。後続の「No such container」は自動削除後のcleanupであり、先行失敗の原因ではない。

成果取得は検証済み：artifact 11766426585（1031bytes、ZIP digest b1c638546b85d9987a12e5d86ed164a2152200459345b2d6c580e3c416c5b340）。connectorで取得し、ローカル保存はgh run download exit0。保存先 docs/results/terrarium-migration-preflight-evidence/ci-attempt-1/actual-inputs.json と failure-log-excerpt.txt。実rustc=1.98.1 (48a229cea 2026-09-01)、cargo=1.98.1 (797e8a9bc 2026-08-05)、builderHash=850c7f12ca27421ce7525ff601d5772bb620e1845b96bb1330ac18588a586311。

初回ELF・first/reuse receiptは未生成。同一キー再利用は未検証、U1未完。再試行案：makeを備える固定ビルダーへ変更し、パッケージの版・digestとビルダー変更をbuildKeyに含める。事前にmake存在を検査し、同一専用ブランチへ署名push後1回再試行する。Biome固定commit、Cargo.lock、Rust版、musl target、品質基準は維持する。失敗時の確認方針に従い修正・push・再試行は人間の回答待ち。
