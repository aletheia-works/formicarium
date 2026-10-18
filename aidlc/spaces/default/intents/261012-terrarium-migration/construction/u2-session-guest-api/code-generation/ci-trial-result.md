# 専用branch push・CI第1試行

## 観測結果（検証済み）

人のApproveを記録後、専用jj checkoutで承認された `jj git push --remote origin --bookmark codex/terrarium-migration-u2` をhost権限で1回実行、exit0。GitHub APIでcommit `af87219fbf434d35a63decca12e6e08a2933194a` のverification.verified=true/reason=validを確認。connector fetch_commitでも同headを確認した（verification fieldがないため、その確認だけread-only gh apiを使用）。

run [38389571348](https://github.com/Marukome0743/formicarium/actions/runs/38389571348)、attempt1、event push、branch codex/terrarium-migration-u2、workflow .github/workflows/migration-session-u2.yml、head一致、最終conclusion=failure。connector jobs/logsとread-only APIで独立観測。手動dispatch/rerunや追加pushは実行していない。

## 失敗箇所

本体checkoutはsuccess、blink専用checkoutがfailure。2026-10-13T11:21:43.7273023Zから取得ログに `fatal: remote error: upload-pack: not our ref a882fb2f3df14115b7e46f6812fb296eef5934d7`。actions/checkout内部が同SHAを計3回取得し、同じエラーでexit128。1workflow/1attemptの範囲であり追加CI再試行ではない。

配信元aletheia-works/blinkのbranch/tag取得自体は成功、指定objectの存在検査・直接取得に失敗した。ローカル `.vendor/blink` のoriginは同URL、HEAD object a882fb2f3df14115b7e46f6812fb296eef5934d7は現存し、subjectはReport guest exit once after pthread runtime shutdown、detached HEAD。remote側から当該objectが取得できないことは検証済みだが、force-push等の履歴変更原因は未確認。

Node/Bun setup、build、typecheck、CI境界、ブラウザinstall、prepare/verifyはすべてskipped。artifact保存も成果がまだ存在せずfailureとなった（二次症状）。CI試験・coverage・U2受入は未検証。以前のlocal成功はCI成功へ置換しない。AI-DLCやコアの機能不具合とは判定しない。

## 次の案と承認境界

固定SHA・既存byteを維持し、ローカルに残る同commitと必要なupstream objectを、credential/configを含まないGit object bundleとしてSHA256固定入力に追加する案。ローカルでfresh取得・HEAD一致・upstream diff・既存28回帰の必要条件を確認する。CIで固定bundleを検査して同SHAのソースを復元し、コア再buildは行わない。入力schema/専用workflowの変更を具体化し、ローカル検証成功後に新head・入力SHA・追加push/1回再試行の実コマンドを提示する。lockや既存quality条件を緩めない。Retry/Skip/Abortを記録して確認待ち。
