# 固定guest buildの安全性・再利用の設計

## Sources

- `../nfr-requirements/security-requirements.md`（NFR2.1–NFR8.3）と `../nfr-requirements/tech-stack-decisions.md`
- `../nfr-requirements/reviews/review-01.md`（READY。Minor 3件：上流に `Cargo.lock` が無い場合、脅威にcacheの汚染が無い、同じkeyで後から動いたbuildの結果）
- `reviews/review-01.md`（この stage の1回目のレビュー。READY、Major 2件・Minor 4件。2回目のレビューの前に、人間の依頼で全件を直した）
- `../../../inception/contract-design/contract-summary.md`（C07・C11・C12）
- U1のbaseline（`integration/vivarium/preflight/`、vivarium run 38990951678：sourceは `actions/checkout` でcommitを直接取得、cargoは376個のcrateを取得、compileは40分39秒。取得の大きさは未計測）
- 人間の回答（`nfr-design-questions.md` の Q1–Q6、すべてA）

以下は設計であり、U5の動作はすべて未検証。

## D1：処理の順序と入口

buildのworkflowは、次の順に処理する。どこかで失敗したら、そこで止めて原因を記録する。
1. 宣言を検証する（下記）。
2. 宣言したrepositoryを、blobなしでcloneし、commitがそのrepository自身のrefから辿れることを確かめる（下記）。
3. commitをcheckoutする。checkoutはblobを取得するので、手順2と同じくD3の監視の下で動かす。
4. containerのimageを、builderの設定に固定したdigestでpullする。pullしたimageのdigestが設定と違えば拒否する。そのimageの中で `rustc -vV` と `cargo -V` を実行し、出力を記録する（D2）。
5. sourcePatchesを当てる。
6. `Cargo.lock` と取得元を検査する（D2）。
7. keyを計算する（D2）。
8. Releaseに、そのkeyの公開済みの組があるかを確かめる。あれば取得して検証し、compileせずに終える（D6の再利用）。
9. 無いときだけ、依存を取得し（D3）、buildする（D4）。

宣言とURLの検証は、次のとおりにする（NFR3.1）。
- 宣言（tool・repository・40桁のcommit・fixture）は、builderの設定に固定した許可一覧と照合する。
- 一覧にないrepository、40桁の小文字16進でないcommit、branch名だけの宣言は、取得の前に拒否する。
- repositoryのURLは、`https://github.com/<owner>/<repo>` の形だけを受け付ける。照合の前に、末尾の `.git` と `/` を除き、小文字にそろえる。userinfo・credential・別のhost・port・query・fragmentがあれば拒否する。照合はURLの文字列で行い、redirectは辿らない。
- `reference`（PR・branch）は記録だけに使い、buildの入力にしない。

commitの確認は、次のとおりにする（NFR3.2）。
- 宣言したrepositoryのURLから、そのrepository自身のbranchとtagだけを、blobなしでcloneする（`git clone --filter=blob:none --no-checkout`）。commitをSHAで直接fetchはしない。
- このcloneにcommitが無ければ、そのcommitはrepository自身のrefから辿れない（別のforkだけにある）。その場合はbuildを始めない。
- buildに使うsourceは、このcloneからcheckoutする。U1のbaselineのように `actions/checkout` でcommitを直接取得する方法は、fork networkの別のcommitを取得できてしまうため使わない。
- submoduleは取得しない。`.gitmodules` があり、buildにsubmoduleが必要な場合は、buildが失敗するのに任せずに拒否する。

fixtureはIDとして記録するだけで、builderは中身もverdictも読まない（C07、NFR2.2）。

## D2：keyとbuild-info

取得元の検査は、次のとおりにする。
- 上流に `Cargo.lock` が無い場合は拒否する。lockfileを足すときは、sourcePatchesとしてrepoの中に固定する。そのSHA256はkeyに入る（NFR3.4）。
- `Cargo.lock` の `source` は、crates.ioのregistryと、許可一覧にあるrepositoryのgit依存だけを受け付ける。git依存は、lockに記録されたcommitで固定される。
- `.cargo/config.toml` などによるregistry・sourceの置換、別のregistryがあれば拒否する。`Cargo.toml` の `[patch]` が許可一覧の外を指していても拒否する。

keyは、ELFを決める入力だけを正規化したJSONのSHA256にする（NFR5.2）。入力は次のとおりである。
- tool・repository・commit
- `Cargo.lock` のSHA256。取得とbuildには `--locked` を付ける。
- target
- `rustc -vV` と `cargo -V` の出力
- buildのcommand・引数・feature・環境変数（`CARGO_INCREMENTAL=0` など）
- sourcePatchesのfile名とSHA256
- builder hash。containerの中で動くbuildのscriptのSHA256、containerのimageのdigest、mbxの版からなる。

runnerの上で動く部品（宣言の検証・Releaseへの書込み・bump-upstreamなど）は、ELFに影響しない。そのためkeyに入れず、そのSHA256をbuild-infoの参考欄に記録する。これらを直しても、keyとmbxのcacheは変わらない。

Rust toolchainは、次のとおりにする。
- 上流の `rust-toolchain`（または `rust-toolchain.toml`）が指定する版を使う。指定が無いtoolでは、builderの設定に版を固定する。
- その版を含むcontainerのimageを、digestで固定して使う。build中にrustupで別のtoolchainを取得させない。imageの中の版が指定と違えば拒否する。

build-infoとsourcePatchesは、次のとおりにする。
- build-infoには、C07とC03の必須identity（source URL・commit・target・rustc・sourcePatches・build入力・builder hash）を記録する。
- build-infoは1MiBまで、catalogは4MiBまで、ELFは128MiBまでとする。上限の値は受理し、+1は拒否する。重複keyは拒否し、未知の付加fieldは互換範囲で許容する（NFR3.3、C11）。
- sourcePatchesは、checkoutの後に当てる。適用に失敗したら拒否する。

## D3：取得の上限（Q2=A）

- sourceの上限は2GiBとする。対象は、cloneした作業tree（`.git` を含む）である。
- 依存の上限は4GiBとする。対象は、`cargo fetch --locked` が書く `CARGO_HOME` の `registry` と `git` である。
- containerのimageは、digestで固定し、GitHubのrunnerのdiskに置く。imageの大きさは、取得の後に記録する。上限は置かず、digestの固定で中身を守る（残るリスク：imageが大きすぎる場合はrunnerのdiskで止まる）。
- clone・checkout・`cargo fetch` は、大きさを監視するprocessの下で動かす。監視は対象のdirectoryの大きさを一定の間隔で測り、上限を超えたらprocess groupを終了させ、buildを始めない。監視の間隔の分だけ上限を少し超えることがあり、その分は残るリスクとして扱う。
- 取得が終わったら、実際のbyte数を記録する。最初の正式なCIで実測値を記録し、上限の半分を超えていたら人間に報告する。上限の値を変えるときは、人間の承認を受ける。
- 上の値は、U1で計測していないため、余裕をもった仮の値である（未検証）。
- 試験では、上限の値を注入できるようにする。小さい上限と小さいlocalのrepository・registryを使い、上限の値で受理し、+1で打ち切ることを確かめる。
- 再利用（D1の手順8）では、依存を取得しない。
- Releaseから成果物を取得するとき（再利用）は、C11に従う（NFR4.2）。
  - HTTPSだけを使い、credentialを送らない。
  - redirectは5回までで、各hopを検査する。
  - Content-Lengthを信用せず、streamの累積で上限を見る。
- どの取得も、自動retryと別のURLへのfallbackをしない。

## D4：buildの実行と期限

- buildは、固定したdigestのcontainerの中で行う。jobの権限は `contents: read` だけにする（NFR8.1）。
- 依存を取得した後のbuildは、containerのnetworkを切り、`--offline --locked` で行う。
- 期限は、依存の取得を含めて4時間とする（C11 buildDeadlineMs）。
- 期限切れや取消のときは、process groupを終了させ、stagingを消してから終える。原因を記録し、retryはしない（NFR4.1）。
- 成果物はstagingに作る。ELFとbuild-infoの両方のdigestを検証してから、keyの名前の不変の場所へ原子的に移す。途中で終わったstagingは成果物として扱わない（NFR5.1）。
- 検証した組は、そのrunのActionsのartifactとして残し、Releaseへの書込み（D6）に渡す。

## D5：mbxのcache（Q1=A）

- mbxは、Rustのcompileを速くするためだけに使う（NFR5.4）。
- cacheはGitHub Actionsのcacheに置く。
  - cacheのkeyは `mbx-<target>-<builder hash>-<run id>` とする。
  - 復元のときは `mbx-<target>-<builder hash>-` で前方一致させる。
- 復元（`actions/cache/restore`）は、どのbuildでも行う。
- 保存（`actions/cache/save`）は、`github.ref == 'refs/heads/main'` で、eventが `push` か `workflow_dispatch` の場合だけ行う。PRのbuildや、ほかのbranchで起動したbuildは保存しない。
- 汚染されたcacheから出たELFも、自分自身からdigestを計算するので、digestの検証では汚染を見つけられない。汚染への防御は、cacheの保存を上の条件に限ることである。
- Releaseに保存する初回のbuildも、cacheを復元する。cacheを書けるのは、mainのbuildだけである。mainが改変されれば、builderそのものが改変されたのと同じなので、cacheなしのbuildと毎回照合はしない。これは残るリスクとして扱う。代わりに、復元したかどうかとcacheのkeyを、build-infoの参考欄に記録する。
- Code Generationでは、次の2つを試験する。
  - mbxありとなしで、同じELF digestになること。
  - 壊れたcacheでは、buildが失敗するか同じdigestになること。
- mbxは `RUSTC_WRAPPER` を使うため、sccacheは併用しない。

## D6：直列化とReleaseへの保存（Q3=A、Q4=A）

workflowは2つに分ける。
- buildのworkflowが、D1–D5を行う。
- Releaseへの書込みのworkflowは、buildのrunのartifactをReleaseへ保存する。

直列化は、次のとおりにする（NFR5.1）。
- 2つのworkflowは、それぞれ1つの `concurrency` group にまとめる（`cancel-in-progress: false`）。
- GitHubは、group 1つにつき、実行中1件と待機1件しか持たない。新しい待機は、古い待機を取り消す。要求を黙って失わないよう、各workflowは最初に、同じworkflowの実行中・待機中のrunがほかにあるかをAPIで確かめる。あれば「busy」として失敗し、待機しない。
- 同時に起動した場合だけ、groupによる待機が起きうる。取り消されたrunは失敗として見えるので、起動した人がもう一度起動する。
- 承認を待つのは書込みのworkflowだけである。buildのworkflowのgroupは塞がない。

Releaseへの書込みは、次のとおりにする（NFR8.1、C12）。
- 人が起動する（workflow_dispatch）。入力として、buildのrun id・tool・keyの全64桁・ELFとbuild-infoのSHA256を与える。
- jobは、承認者を必須にしたGitHubのenvironmentで動かす。人間が具体的な対象を承認したときだけ動き、そのjobだけに `contents: write` を与える。承認と書込みは、C12の既存executorの境界に従う。未信頼のPRからは動かさない。
- 書く前に、artifactの3つのdigestと、build-infoの `buildKey` の全64桁が、入力と一致することを確かめる。

Releaseの並べ方は、次のとおりにする（NFR5.3）。
- Releaseはkeyごとに、tag `guest-<tool>-<keyの全64桁>` で作る。そこに、ELF・build-info・catalogの3つを一組で置く。全64桁を使うので、別のkeyとtagが衝突しない。

一組の公開は、次の順で行い、公開するまで一組を見せない。
1. draftのReleaseを作り、3つのassetを置く。
2. 置いた3つを取得し直して、digestを検証する。
3. 3つとも一致してから、publishする。publishしたときに初めてtagができる。
- 途中で失敗したdraftは、公開していないので成果物として扱わない。次の書込みのjobが、同じkeyのdraftを削除してから作り直してよい。
- publishしたReleaseと、そのtag・assetは、削除も上書きもしない（C12）。

同じkeyが既に公開されている場合は、次のとおりにする。
- 書込みのjobは、そのtagのReleaseが公開済みなら、何も置かない。公開済みの3つを取得し、build-infoの `buildKey` の全64桁とdigestを確かめるだけにする。
- 公開済みのReleaseの組が欠けているか、`buildKey` が一致しない場合は、そのkeyを「使えない」と記録して拒否し、人間に報告する。
- 渡されたbuildのrunのELFが、公開済みのdigestと違う場合は、「再現しない」として不合格を記録する。公開済みの良品は残し、新しいbytesは保存しない（NFR5.2の前回のMinor 3）。

承認待ちと再利用の関係は、次のとおりにする。
- buildのworkflowが再利用とみなすのは、公開済みのReleaseだけである。draftや承認待ちのものは数えない。
- 承認を待つ間に同じkeyのbuildを起動すると、そのbuildはcompileする。そのELFは上の規則で、公開済みのものと照合される。
- 同じkeyの2回目の証拠（`compiled=false` と同じdigest、FR7）は、公開した後にbuildのworkflowをもう一度動かして作る。

## D7：bump-upstream（Q5=A）

- 人が手動で起動する（workflow_dispatch）。宣言したrepositoryのbranchは、`git ls-remote` で直接解決する。PRの情報やGitHubの画面の値は使わない。
- 解決したcommitには、D1の確認を通す。その後で、commit・解決した時刻・branch名を記録し、宣言を更新するPRを作る。PRのmergeは人が行う（NFR3.5）。
- PRを作るjobにだけ、必要な書込み権限を与える。buildのjobとは分ける。

## D8：品質・証拠・builderの部品（Q6=A）

builderは、次の部品からなる。
- 宣言の検証（D1）
- sourceの取得と確認（D1）
- 取得元の検査とkeyの計算（D2）
- 取得の監視と計測（D3）
- buildの実行（D4）
- 成果物の検証
- Releaseへの書込み（D6）
- bump-upstream（D7）

部品の書き方と検査は、次のとおりにする。
- runnerの上で動く部品は、BunとTypeScriptで書く。containerの中で動く部分は、mjsかshellでよい。
- 置き場所と、lint・型検査・試験のcommandは、Code Generationの計画の前に、vivariumのセッションで確かめてもらう。
- vivariumの既存の経路で検査し、skipや欠落を成功に置き換えない（NFR2.2）。
- builderのCIの合否は、ELFとbuild-infoの検証で決める。recipeのverdictはrecipeの試験で決め、builderは持たない。

U1のbaselineからの移行と証拠は、次のとおりにする。
- U1のbaselineのworkflow・controller・scriptは、正式な経路へ移す。移した後で、vivariumのPRで整理し、builderを二重に残さない（NFR8.2）。
- U1のbaseline（Biome 2405c762）とfix（JamBalaya56562/biome f79f85d5）の両方を作る。formicariumで、両方の `--version` の成功と、再利用（`compiled=false`）を記録する（NFR8.2、FR9）。
- formicariumの配布JSと既存の試験は、U5では変えない。未変更のaubeは再buildしない（NFR2.1）。

## D9：秘密と費用

- token・秘密は、ログ・build-info・catalogに出さない。`persist-credentials: false` を使い、外部の取得にはcredentialを送らない。
- 上流のlicenseとnoticesは保持する。
- GitHub Actionsのcacheとstorageに新しい費用が出る場合は、事前に相談する（NFR8.3）。

## Threat Response and Rollback

脅威への対策は、次のとおりにする。
- 改変されたsourceは、許可一覧、URLの正規化、repository自身のrefから辿れることの確認、取得元の検査で防ぐ（D1、D2）。
- 改変された成果物は、毎回のdigest検証、`buildKey` の全64桁の照合、draftからのpublish、公開済みのものの上書き禁止で防ぐ（D2、D6）。
- cacheの汚染は、保存をmainのbuildだけに許すことで防ぐ。digestの検証では、汚染は見つけられない（D5）。
- 過大な権限は、buildのjobを `contents: read` にし、書込みを承認後の別のworkflowに分けることで防ぐ（D6、D7）。
- 資源の使い過ぎは、取得の監視と4時間の期限で防ぐ（D3、D4）。

切り戻しは、次のとおりにする。
- vivariumへの変更はPR単位にし、revertで切り戻せるようにする。
- Releaseの公開済みの成果物は消さない。不具合のある成果物は、宣言をそれより前のkeyに戻して参照から外す。

## Assumptions & Open Questions

- source2GiB・依存4GiBの上限は仮の値で、最初の正式なCIで実測する。監視の間隔の分だけ、上限を少し超えることがある。
- GitHub Actionsのcacheについて、PRのscopeではmainのcacheを書き換えられない（GitHubの文書による。未検証）。設計では、PRからの保存自体をしない。
- concurrencyの待機の扱いと、draftのReleaseが公開まで見えないことは、GitHubの文書による（未検証）。
- `GITHUB_TOKEN` で作ったPRでは、ほかのworkflowが自動で動かない。bump-upstreamのPRでCIを動かす方法は、Code Generationで決める。
- vivariumの構成（置き場所とcommand）は、vivariumのセッションの確認を待つ。
