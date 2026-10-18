# 固定guest buildのCIの経路

## Sources

`../nfr-design/security-design.md`（D1–D9）、契約C07・C11・C12、FR7–FR9、U1のbaseline（`integration/vivarium/preflight/`）。文書の根拠であり、実装・外部のCIの操作・計測は未検証。

## Pipeline and Gates

| 順序 | 作業 | 完了の証拠・停止の条件 |
|---|---|---|
| 1 | vivariumの構成の確認 | vivariumのセッションに、置き場所・lint・型検査・試験のcommandを確かめてもらう。結果を受けてから、Code Generationの計画を示して承認を受ける |
| 2 | builderの部品を作る（D8） | 固定したfixtureで、宣言・URL・commit・取得元・key・上限・期限・digest・Releaseの各規則の正常と拒否の試験。上限は注入した小さい値で、境界値と+1を確かめる。imageの `rustc -vV` の版が上流の `rust-toolchain` の指定と違えば拒否することも試験する。bump-upstreamは、localのrepositoryで `git ls-remote` によるbranchの解決と、PRの情報だけでは宣言を更新しないことを試験する（NFR3.5） |
| 3 | vivariumのPRで、lint・型検査・試験 | vivariumの既存の経路で成功。skipや欠落を成功に置き換えない |
| 3a | vivariumのPRをmainへmerge | mergeは人が承認して行う。起動・mainだけのcacheの保存・environmentは、mainのworkflowを前提にする。environmentとcacheの設定を、対象を示して承認を受けてから人が適用する |
| 4 | baseline（Biome 2405c762）のbuild | 承認を受けてから、mainで起動する。D1の順序で処理し、4時間以内に検証を通った組ができる。大きさと時間を記録する |
| 5 | Releaseへの書込み | C12の操作計画を作り、そのSHA256と対象を示して承認を受ける（下記）。draft → 検証 → publish |
| 6 | 同じkeyの再利用 | buildのworkflowをもう一度起動し、`compiled=false` と同じdigestを記録する |
| 7 | fix（JamBalaya56562/biome f79f85d5）で4–6を繰り返す | 2つ目のcommitでも同じ条件を満たす |
| 8 | formicariumでの照合 | 2つの成果物を取得し、`--version` の成功、digest、build-info、再利用を照合する |
| 9 | U1のbaselineの整理 | 正式な経路へ移した後で、vivariumのPRで整理する。builderが二重に残っていないことを確かめる |
| 10 | U5の検証コマンドとcheckpoint | 実際のcommandを示して承認を受け、そのcommandで実際の証拠を検証する |

## Isolation and Artifact Management

workflowは、build・Releaseへの書込み・bump-upstreamの3つに分ける。それぞれ1つのconcurrency groupにまとめ、最初にbusyの確認をする（D6）。buildの成果物は、Actionsのartifactとして書込みのworkflowに渡す。Releaseの公開済みの組が正本である。Actionsのartifactの保持期限に、受入の証拠を任せない。mbxのcacheは速さのためだけに使い、保存はmainのbuildだけにする（D5）。

builderの3つのworkflowは、すべて人が起動する（workflow_dispatch）。scheduleやpushでは起動しない。そのため、失敗は起動した人が必ず見る。起動した結果は、このチャットで報告する。workflowは最初に `github.ref == 'refs/heads/main'` を確かめ、main以外で起動したら失敗する。

## Release write approval (C12)

Releaseへの書込みは、C12の `ExternalOperation` で計画して承認を受ける。
1. formicariumの側で、buildのrunのartifactを照合したあとで、操作計画のJSONを作る。中身は次のとおりである。
   - `action: 'publish'`
   - `targets`：tagと3つのasset名
   - `inputDigests`：ELF・build-info・catalogのSHA256と、`buildKey`
   - `acceptanceEvidenceIds`：buildのrun id
   - `rollbackPlanDigest`：切り戻しの手順（宣言を前のkeyに戻す。削除はしない）のSHA256
   - `approvalReference`：このチャットでの承認の記録
2. 計画のSHA256と対象を、このチャットで示して承認を受ける。`approvalReference` を入れただけでは承認にならない（C12）。
3. 書込みのworkflowを、計画のJSONとそのSHA256を入力にして起動する。入力は64KiBまでとする。
4. jobは、入力のSHA256が計画と一致すること、`inputDigests` がartifactの現在のdigestと一致すること、tagがまだ公開されていないことを確かめる。一致しなければ、何も書かずに失敗する。
5. environmentの承認の画面には、runの入力（計画のSHA256）が出る。人は、チャットで承認したSHA256と同じときだけ承認する。environmentはdigestを持たないので、照合は手順4のjobが行う。
6. 結果（公開したtagとassetのURL、digest）を、計画のIDと一緒に記録する。

## Permissions and Rollback

| workflow | 権限 | 理由 |
|---|---|---|
| build | `contents: read`、`actions: read` | busyの確認で、同じworkflowのrunを一覧する。cacheの保存と復元は、Actionsのruntimeのtokenで行い、追加の権限は要らない（GitHubの文書による、未検証） |
| Releaseへの書込み | `contents: write`、`actions: read` | Releaseの作成と、別のrunのartifactの取得。承認者を必須にし、deploymentをmain branchだけに限ったenvironmentの中で動かす |
| bump-upstream | `contents: write`、`pull-requests: write`、`actions: read` | 宣言を更新するbranchのpushとPRの作成、busyの確認 |

- 書かれていない権限は、すべて `none` にする。
- 未信頼のPRのcodeを、書込み権限で動かさない。
- 使うActionは、commitのSHAで固定する。

vivariumの変更はPR単位にし、revertで切り戻す。Releaseの公開済みの成果物は消さない。不具合のある成果物は、宣言を前のkeyに戻して参照から外す。途中で失敗したdraftとstagingは、成果物として扱わない。environmentの設定などの外部の変更は、具体的な操作と戻し方を計画で示し、承認を受けてから行う。
