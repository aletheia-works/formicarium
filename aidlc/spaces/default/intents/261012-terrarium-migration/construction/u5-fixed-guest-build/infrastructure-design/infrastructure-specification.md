# 固定guest buildの実行基盤

## Sources

`../nfr-design/security-design.md`（D1–D9）、`../nfr-requirements/security-requirements.md`、契約C07・C11・C12、U1のbaseline（vivarium run 38990951678）。文書の根拠であり、基盤の動作・権限・費用は未検証。

## Deployment

| Facet | Choice | Rationale |
|---|---|---|
| Compute model | vivariumのGitHub Actionsの、GitHubが用意するLinuxのrunner。buildは、digestで固定したRustのcontainerの中で行う | U1のbaselineで約41分で完了した。AWSは追加しない |
| Runner | GitHubが用意する標準のUbuntuのrunner。labelは、Code Generationの開始時点で最新のものを確かめて決め、build-infoの参考欄に記録する | 最新のtoolを使う方針。larger runnerは費用が出るので使わない |
| Networking topology | 取得はHTTPSだけ（github.com、crates.io、container registry、GitHub Release）。依存の取得の後のbuildは、containerのnetworkを切る | D3・D4。credentialを送らない |
| Storage strategy | run固有のstaging → 検証してからkeyの名前の場所へ → ActionsのartifactからReleaseへ（draft → 検証 → publish） | D4・D6。途中で終わったものと受入済みのものを分ける |
| Environments | buildのworkflow（`contents: read`、`actions: read`）、Releaseへの書込みのworkflow（承認者を必須にし、mainだけに限ったenvironment、`contents: write`、`actions: read`）、bump-upstreamのworkflow（`contents: write`、`pull-requests: write`、`actions: read`）。どれもmainで人が起動する | D6・D7。権限を分ける。詳細は `cicd-pipeline.md` のPermissions and Rollback |
| IaC approach | vivariumのrepoの中のworkflowとscriptを、PR単位で追加・変更する。environmentと承認者の設定は、対象を示して承認を受けてから人が適用する | OpenTofuの状態、DNS、組織のrulesetは変えない |
| Resource sizing | build 4時間（job timeoutは4時間に後片付けの分を足す）、source 2GiB、依存 4GiB、ELF 128MiB、build-info 1MiB、catalog 4MiB。jobの最初にrunnerのdiskの空きを測り、20GiB未満ならbuildを始めない | C11とD3。20GiBは、source・依存・buildの中間fileの仮の見込みである（未検証）。実際の空きと使った量を記録し、足りなければ報告する |

## Infrastructure Services

| Service | Role | Configuration | Notes |
|---|---|---|---|
| GitHubのrepository（宣言したupstream） | sourceの取得 | blobなしclone、repository自身のrefだけ、`persist-credentials: false` | D1。SHAでの直接fetchはしない |
| crates.io | 依存の取得 | `cargo fetch --locked`、大きさを監視 | D2・D3。registryの置換は拒否 |
| container registry | build環境 | digestで固定したRustのimage | D2・D4。digestが違えば拒否 |
| GitHub Actionsのcache | mbxのcache | key `mbx-<target>-<builder hash>-<run id>`、保存はmainのbuildだけ | D5。容量の上限と退避はGitHubの規則に従う（未検証） |
| GitHub Actionsのartifact | buildとReleaseへの書込みの受渡し | 検証した3つのfileとdigest | 保持期限に受入の証拠を任せない |
| GitHub Release（vivarium） | 成果物の正本 | tag `guest-<tool>-<keyの全64桁>`、3つのasset、公開後は削除も上書きもしない | D6・C12 |
| DB・queue・search・LB | 適用しない | 新しく作らない | |

## Shared Infrastructure

| Shared Resource | Owner Unit | Consumer Units | Access Boundary |
|---|---|---|---|
| 固定buildの成果物（Release） | U5 | U6（recipe）、U7（showcase候補） | C07。keyとdigestとsourceを照合して読む。latestの名前では読まない |
| catalog | U5 | U6、U7 | C07・C11。4MiBまで、明示したURLだけ |
| U1のbaselineの試行（workflow・controller・script） | U1の試行、正式な経路への移行はU5 | U5 | 移した後で整理し、二重に残さない。U1の証拠は壊さない |
| vivariumのrepositoryとCI | vivarium | U5、U6、U7 | 変更はvivariumのセッションで反映する。既存のworkflowの権限は変えない |

費用の見込みは次のとおりで、未検証である。
- U1のbaselineのbuildは約41分だった。U5の受入では、cacheなしのbuildが2回（baselineとfix）で約90分、再利用のrunが2回で数分ずつと見込む。mbxありとなしの比較の試験で、さらに約90分を見込む。合計で、標準のrunnerで約3〜4時間である。
- vivariumが公開repositoryなら、標準のrunnerの分数は無料である（GitHubの文書による。未検証）。
- cacheとReleaseのstorageは、ELF 1つあたり数十MiBと見込む。

新しいAWSの費用は出さない設計である。GitHub Actionsの分数・cache・storageの残り枠と使う量は、実行の前に確かめ、新しい費用が出るときは相談する。
