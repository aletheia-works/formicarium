# Bun明示後のCI試行

検証済み: ユーザー承認後、専用bookmark codex/terrarium-migration-u2 を0037d1ec2071cb7be4a2d9820404c7ecf4c9dc3eから268b323d96bfbcd2eb2fe0e03d5941eedc033871へpush。jj git push exit0。GitHub APIで新headの署名 verified=true / reason=valid を確認。

Run 38393506506、attempt1、job115282845549。新pushによる試行1回。追加dispatch/rerunなし。

検証済み: Bun実行ファイル登録、依存install、build、typecheck、CI境界、固定core bundle復元、browser install、独立consumer prepareが成功。

検証済み: GitHub run APIはstatus=completed、conclusion=success、head/branch/workflow/attempt一致。全step成功。Bunの実絶対パス登録により前回tooling11件失敗は解消し、236/236成功。

検証済み: unit177成功/既知skip2、U2 Node43/ブラウザ9、既存consumer189、Node build/probe/aube28、ブラウザprobe/aube33が成功。計測下package Node115、U2 Node43、package browser99、U2 browser9も成功。全16配布JS/1370realms、1199/1334 lines=89.88%、threshold80/passed=true。

検証済み: artifact11814487608、ZIP211815bytes、実download SHA256 a10834eca73b5ca5e904cec4d8c645d62d861f6dd3dc5532905d71f2bf769b83がGitHub API digestと一致。展開されたcandidate、context、ci-job-observations、local-provisional-report、coverage-reportを相互照合。sourceCommit268b323d96bfbcd2eb2fe0e03d5941eedc033871、sourceIdentity93e5957fccb5e862c13f8f1f56a10e97699ee64214004b9ce9a9f7d77f6f17de、manifest SHA a79383c154d16b6f990e007f66c38eda89763961e2fd35fe815b362f40083dcf、pack SHA e68fec9379c70008dd43d4980bd756336b94297c1dd376f0e1aabbc3297a2ae0が一致。ローカルprepare候補とCI packも一致。固定26pack files/16JS。

ci-observed-38393506506.jsonは独立API成功とartifact実byteを結び付けた観測記録。自己申告のci-job-observationsだけからsuccessを確定していない。原ログci-trial-38393506506.logを保存。artifact期限は2026-10-14T12:44:46Z、ローカルZIPと展開資料は.artifacts/migration-session/に保持。

CI内のlocal-provisional-reportは生成時点のacceptancePassed=false/ci=nullを原値保持。独立CI検証成功とは別に、canonical検証コマンド承認・最終レビュー・checkpointを待つためU2完了承認は保留。実SafariとU3/U4/B1は未受入。

Run: https://github.com/Marukome0743/formicarium/actions/runs/38393506506
