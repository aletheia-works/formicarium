# U5 u5-fixed-guest-build NFR Design の質問

## Sources

- `../nfr-requirements/security-requirements.md`（NFR2.1–NFR8.3）と `../nfr-requirements/tech-stack-decisions.md`
- `../../../inception/contract-design/contract-summary.md`（C07・C11・C12）
- U1のbaseline CI（vivarium run 38990951678、`.artifacts/migration-preflight/baseline-node26-38990951678/`）：sourceは `actions/checkout` で取得し、cargoは376個のcrateを取得し、compileは40分39秒だった。sourceと依存の取得の大きさは記録していない（未計測）。

U5はpackagingのUnitなので、この stage で作るのは security-design と traceability だけである。

## Q1. mr-boxington（mbx）の採否

mbxは、最終のlinkをcacheせず、Rustの版が変わるとcacheの大半が無効になる（公式の文書による。動作は未検証）。U5では、同じkeyの2回目はReleaseのELFを再利用し、compileをしない。mbxが効くのは、keyが変わったとき（commitの更新など）のcompileである。

A. 採用する。GitHub Actionsのcacheに保存する。読込みはどのbuildでも行い、書込みは信頼したbranch（mainへのpushと、mainからのworkflow_dispatch）だけにする。cacheのkeyには、builder hash（mbxの版を含む）とtargetを入れる。mbxありとなしで同じELF digestになることを、Code Generationで確かめる。
B. 今は採用しない。keyが変わるたびに、cacheなしでcompileする（U1では約41分）。必要になったら、別の変更として採用を検討する。
C. 採用するが、cacheはjobの中だけで使い、jobをまたいで保存しない。
X. Other (please specify)

[Answer]: A

## Q2. sourceと依存の取得の上限

U1では大きさを計測していないため、実測にもとづく値はない。どう決めるか。

A. 今の時点で、余裕をもった有限の上限を決める。source（checkoutした作業tree）2GiB、cargoの依存の取得（`CARGO_HOME` の registry と git）4GiB。取得のあとで実際の大きさを測って記録し、上限を超えたらbuildを始めない。最初の正式なCIで実測値を記録し、上限の半分を超えた場合は報告する。値を変えるときは、人間の承認を受ける。
B. Code Generationの最初に、記録だけを行う試行のCIを1回動かし、その実測値をもとに上限を決めて、人間の承認を受けてから正式な経路へ進む。
C. 個別の上限は置かず、4時間のbuildの期限とrunnerのdiskの容量だけで制限する。
X. Other (please specify)

[Answer]: A

## Q3. 複数のCIにまたがる直列化の単位

keyはjobの中で計算するため、workflowの `concurrency` の時点ではまだ分からない。どの単位で直列化するか。

A. builderのworkflow全体を1つのgroupにまとめ、すべてのbuildを順に1つずつ行う（`cancel-in-progress: false`）。Releaseへの書込みのjobは、書く前に同じkeyの成果物が既にないかを確かめ、あれば上書きせずに検証だけを行う。
B. groupを、宣言のtoolとcommitで分ける。同じtool・commitのbuildだけを直列化し、別のguestは並行して動かす。Releaseへの書込みでの確認はAと同じ。
X. Other (please specify)

[Answer]: A

## Q4. Releaseでの成果物の並べ方

A. keyごとに1つのtag（例：`guest-<tool>-<keyの先頭16文字>`）を作り、そのReleaseにELF・build-info・catalogの3つを置く。既存のtagとassetは消さない・上書きしない（C12）。
B. 1つの固定のRelease（例：`fixed-guests`）に、key名を付けたassetを追加していく。
X. Other (please specify)

[Answer]: A

## Q5. bump-upstream（upstreamの新しいcommitへの更新）の起動のしかた

A. 人が手動で起動する（workflow_dispatch）。宣言したrepositoryのbranchを直接解決し、NFR3.2の確認を通したら、宣言を更新するPRを作る。PRのmergeは人が行う。
B. Aに加えて、定期実行（例：週1回）でもPRを作る。
X. Other (please specify)

[Answer]: A

## Q6. vivariumの既存の構成（BunとTypeScript）の確かめ方

A. NFR Designでは、builderの部品の役割と境界だけを決める。具体的な置き場所・lint・型検査・試験のcommandは、Code Generationの計画の前に、vivariumのセッションに確かめてもらう（そのための依頼文を用意する）。
B. NFR Designを止めて、今すぐvivariumのセッションに確かめてもらい、その結果を反映してから設計を終える。
X. Other (please specify)

[Answer]: A

## Assumptions & Open Questions

- mbxの動作、sourceと依存の大きさ、vivariumの構成は、まだ確かめていない。
