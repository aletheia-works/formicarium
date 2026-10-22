# U5 fixed-guest-build 実装計画

## Summary

- 今回の再開（2026-10-19、追加Step 24–31）：Release の起動の入力を減らす（人間の指示）。build の workflow の最後に release を続け、人は build を1回起動して environment `fixed-guest-release` を承認するだけにする。release は build の run ID だけでも起動できる。tool・binary・key・repository・commit・計画とその SHA256 は、build の run と artifact から workflow が割り出し、計画の内容と SHA256 を job summary に出す。2つの release が重なったら順に待ち、待っている run を BUSY と数えない。上流 vivarium の `tools/fixed-guest-builder/` と `.github/workflows/fixed-guest-{build,release}.yml` を変える（vivarium の fork で直接作る）。下の各行は、それより前の要約（履歴）である。
- 前回の再開（2026-10-18、追加Step 18–23）：U5の記録を新しい土台（formicariumのupstream main `2a79860`）に合わせ、review-03のR-10〜R-14を直す。記録を「上流vivariumの本体（builderとworkflow。aletheia-works/vivarium mainのmerge `71e0ef92`）」と「formicarium側の確認（`scripts/migration-guest-build/`、`tests/migration-guest-build/`、`mise-tasks/migration/guest-build-*.sh`、package.jsonの `migration:guest-build:*`）」に分ける（人間の指示）。U5のcodeは変えない。触るのはU5の記録（この計画、`unit-test-instructions.md`、`code-summary.md`、`traceability.json`、`source-manifest.json`）だけ。mainでlint・typecheck・build・test:light・`mise run migration-guest-build-unit` と、保存済みのRelease 2組に対する `verify.ts` の照合を1つずつ実行する。下の各行は、それより前の要約（古い土台の履歴）である。
- Builds: vivariumの固定guestのbuilder。宣言の検証、sourceの取得と確認、key、取得の監視、containerでのbuild、成果物の検証、Releaseへの書込み、bump-upstreamを作り、3つのworkflowで動かす。あわせて、formicariumで成果物を照合する入口を作る。
- Touches: formicariumの `proposals/vivarium/u5/`（vivariumへ反映する案。新しいpackage `tools/fixed-guest-builder/`、workflow 4つ、mise.tomlとdependabotとinfra/githubとAGENTS.mdへの追記の案）、`scripts/migration-guest-build/`、`tests/migration-guest-build/`、`biome.json`（案のdirectoryを検査の対象から外す1行）。formicariumの `mise.toml` と `tsconfig.json` は変えない。vivariumへの反映・PR・merge・CIの起動は、別に承認を受ける。
- Tests: builderの各部品の単体試験（部品ごとに5–8件以上、formicariumの照合を含め計約100件。bun test）と、workflowの静的な試験、formicariumの照合の試験。そのうえで、vivariumのCIでbaselineとfixをbuildし、Releaseへの保存、同じkeyの再利用、mbxありとなしの比較を行う。

## 前提と境界

根拠は承認済みのU5のnfr-requirements（NFR2.1–NFR8.3の16件）、nfr-design（D1–D9）、infrastructure-design（cicd-pipeline.mdの順序1–10）。契約はC07・C11・C12で、要件はFR7・FR8・FR9である。User Storiesは無いので、要件IDと設計IDへ直接対応させる。

vivariumのセッションの調査（aletheia-works/vivarium main cb19abb0、読取りだけ）と、人間の回答（2026-10-17）を前提にする。
- builderのworkflowとReleaseは、上流の aletheia-works/vivarium に置く。Marukome0743の権限はpullだけなので、mainへのmerge・environmentの作成・workflowの起動は、書込み権限のある人が行う。
- mbxのcacheは、GitHub Actionsのcacheに置く（NFR DesignのQ1=Aのまま）。上流のcacheは既に8.51GBを使っているので、大きさと追い出しを監視し、問題があれば止めて報告する。
- runnerの上で動くscriptは、新しいpackage（案B）に置く。置き場所は `tools/fixed-guest-builder/` を提案する（この計画の承認で決める）。専用の package.json・tsconfig・bun.lock を持たせ、mise・dependabot・ci task・Biome・型検査の対象に加える。

vivariumのfileは、formicariumでは `proposals/vivarium/u5/` の下に、vivariumと同じpathの形で作る。ここで試験を通したあと、vivariumのセッションに反映してもらう。formicariumの製品code（runtime/、配布JS、既存の試験）と、U1–U4の封印済みの証拠・承認済みのcommandは変えない。AI-DLC本体は変えない。品質基準は緩めない（install180秒、非download中央値3000ms以下、配布JSのcoverage80%以上、probe600秒、aube840秒、1worker、retry0、容量上限）。未変更のaubeは再buildしない。build・testはmain sessionで1つずつ実行する。各層を実装した後に試験を書いて実行し、失敗したら観測結果と修正案を示して確認を待つ。

## 持ち越した指摘と、調査で分かったことの反映

1. imageの `rustc -vV` の版を、上流の `rust-toolchain` の指定と照合する。D1の手順4で行い、違えば拒否する（NFR Designの2回目のレビューのMinor）。
2. 同じkeyのReleaseが既に公開されているとき、書込みのjobは何も書かずに検証だけを行い、成功として終える（D6に合わせる。Infrastructure Designの2回目のレビューのMinor）。手順の「tagが未公開であること」の確認は、「公開済みなら検証だけに切り替える」に読み替える。
3. environmentの承認の画面にrunの入力が表示されることを、Step 14で実際に確かめる。表示されない場合は、計画のSHA256をrunの名前（`run-name`）に入れる案を示して確認する（Infrastructure Designの2回目のレビューのMinor）。
4. workflowには `if: github.repository == 'aletheia-works/vivarium'` を付け、forkでは動かさない（調査の指摘2）。
5. tagの名前 `guest-<tool>-<keyの全64桁>` は、`v*.*.*`（release-pleaseとpublish-mcp）と `state-backup-` に重ならない。ReleaseはGITHUB_TOKENで作るので、ほかのworkflowは起動しない（調査の指摘3）。
6. 承認のenvironmentは `fixed-guest-release` とし、`infra/github/main.tf` に定義を加える案を作る（承認者を必須にし、deploymentはmainだけ）。適用は書込み権限のある人が行う（調査の指摘4）。
7. bump-upstreamのworkflowは `fixed-guest-bump`、concurrency groupも `fixed-guest-bump` とし、既存の `upstream-bump` と分ける。PRは既存の `./.github/actions/bot-pull-request` とapp tokenで作る。GITHUB_TOKENでは作らない（必須checkが起動しないため。調査の指摘5）。
8. Actionは40文字のSHAで固定し、版のコメントを付ける（AGENTS.md §4.7。調査の指摘7）。
9. runnerのNodeとBunの版は、mise.tomlが `latest` なので日によって変わる。これらはkeyに入れず（D2）、実際の版をbuild-infoの参考欄に記録する（調査の指摘8）。
10. 新しいpackageは、Biome・型検査（tsc --noEmit）・ShellCheckの対象に加える。container内のshellは `tools/fixed-guest-builder/container/` に置き、ShellCheckの対象に含める。mjsは使わず、container内もshellだけにする（調査の指摘9–11）。
11. どの言語のfileにも、AGENTS.md §4.12のコメントの規則を当てる（調査の指摘12）。

## Steps

- [ ] Step 1: 構成とrunnerの確認。開発に使う各toolが最新版かを確かめる（Bun、Node、TypeScript、Biome、mbx、ShellCheck、actionlint、使うActionのcheckout・cache/restore・cache/save・upload-artifact・download-artifact・create-github-app-token）。開始時の版と、古いものがあればその差分を報告する。biome 2405c762 と f79f85d5 の `rust-toolchain` を読み、指定の版のRustのimageのdigestを調べて記録する（U1の1.98.1は履歴として扱う）。標準のUbuntuのrunnerの最新のlabelを確かめる。`proposals/vivarium/u5/tools/fixed-guest-builder/` にpackage.json・tsconfig.json・bunfig.toml・bun.lockを作り、`tests/runner-ready.test.ts` を最初に実行して、bun testが動くことと、そのcommandを `unit-test-instructions.md` に記録する。（NFR2.2）
- [ ] Step 2: 宣言とURLの検証を `src/declaration.ts` に実装する。許可一覧（設定file `allowlist.json`）、URLの正規化（`.git`・末尾の `/`・小文字）、userinfo・host・port・query・fragmentの拒否、40桁の小文字16進のcommit、branch名だけの宣言の拒否、`reference` を入力にしないこと。実装後に `tests/declaration.test.ts` を作って実行する。（NFR3.1、D1）
- [ ] Step 3: sourceの取得と確認を `src/source.ts` に実装する。blobなしclone（repository自身のbranchとtagだけ）、commitがそのcloneにあることの確認、SHAで直接fetchしないこと、checkout、`.gitmodules` の拒否、sourcePatchesの適用。実装後に `tests/source.test.ts` を作って実行する。localのbare repositoryを2つ使い、別のrepositoryにだけあるcommitで始まらないことを確かめる。（NFR3.2、NFR3.4、D1）
- [ ] Step 4: 取得元の検査とkeyを `src/lockfile.ts` と `src/key.ts` に実装する。`Cargo.lock` の必須、`source` の許可（crates.ioと許可一覧のgit依存）、`.cargo/config.toml` の置換と別のregistryの拒否、`[patch]` の許可一覧外の拒否、正規化したJSONのSHA256によるkey（D2の入力だけ。runnerの部品のSHA256は参考欄）。実装後に `tests/lockfile.test.ts` と `tests/key.test.ts` を作って実行する。入力を1つ変えるとkeyが変わること、runnerの部品を変えてもkeyが変わらないことを確かめる。（NFR3.4、NFR5.2、D2）
- [ ] Step 5: 取得の監視と期限を `src/monitor.ts` と `src/deadline.ts` に実装する。directoryの大きさを一定の間隔で測り、上限を超えたらprocess groupを終了させる。期限切れ・取消のときはprocess groupの終了とstagingの除去を待つ。retryはしない。上限と間隔は注入できるようにする。実装後に `tests/monitor.test.ts` と `tests/deadline.test.ts` を作って実行する。小さい上限で、上限の値は受理し、+1で打ち切ることを確かめる。（NFR4.1、NFR4.2、D3、D4）
- [ ] Step 6: containerでのbuildを `src/build.ts` と `container/build.sh` に実装する。imageをdigestでpullして照合、`rustc -vV`・`cargo -V` の記録、`rust-toolchain` との照合（反映事項1）、diskの空き20GiBの事前確認、`cargo fetch --locked` の監視、networkを切った `--offline --locked` のbuild、stagingでの作成と原子的な確定、mbxの `RUSTC_WRAPPER`。docker・mbxのcommandは注入できるようにする。実装後に `tests/build.test.ts` を作って実行する。偽のdockerで、digestの不一致・版の不一致・diskの不足・途中の失敗でstagingが残らないことを確かめる。（NFR4.1、NFR5.1、NFR5.4、D4、D5）
- [ ] Step 7: 成果物の検証と再利用の取得を `src/artifact.ts` と `src/reuse.ts` に実装する。ELF 128MiB・build-info 1MiB・catalog 4MiBの上限（値は受理、+1は拒否）、重複keyの拒否、未知fieldの許容、C07とC03の必須identity。Releaseからの取得はC11（HTTPS、credentialなし、redirectは5回まで各hopを検査、streamの累積で制限、retryなし）。再利用のときは `compiled=false` と同じdigestを記録する。実装後に `tests/artifact.test.ts` と `tests/reuse.test.ts` を作って実行する。fetchを注入し、境界値と+1、redirectの不正、HTTPの失敗、digestの不一致を確かめる。（NFR3.3、NFR4.2、NFR5.2、FR7、FR8）
- [ ] Step 8: Releaseへの書込みとbusyの確認を `src/release.ts` と `src/busy.ts` に実装する。C12の操作計画（`ExternalOperation`）の作成と照合、計画のSHA256と `inputDigests` とartifactの照合、draft → 取得し直してdigestを検証 → publish、途中で失敗したdraftの作り直し、公開済みなら検証だけ（反映事項2）、組の欠けや `buildKey` の不一致は「使えない」、ELFの違いは「再現しない」、公開済みのものを消さない・上書きしないこと。busyは同じworkflowの実行中・待機中のrunをAPIで確かめる。実装後に `tests/release.test.ts` と `tests/busy.test.ts` を作って実行する。偽のGitHub APIを使う。（NFR5.1、NFR5.3、NFR8.1、D6、C12）
- [ ] Step 9: bump-upstreamを `src/bump.ts` に実装する。`git ls-remote` でbranchを直接解決し、D1の確認を通し、commit・時刻・branch名を記録して宣言を更新する。PRの情報は使わない。PRの作成はworkflowで `bot-pull-request` に任せる。実装後に `tests/bump.test.ts` を作って実行する。localのrepositoryで、解決の結果の記録と、PRの情報だけでは更新しないことを確かめる。（NFR3.5、FR8、D7）
- [ ] Step 10: CLIの入口を `src/cli.ts` に実装する（build・release・bumpの3つのsubcommand。workflowから呼ぶ）。秘密を出さないこと、終了codeと原因の記録。実装後に `tests/cli.test.ts` を作って実行する。（NFR8.3、D9）
- [ ] Step 11: workflowと設定。`proposals/vivarium/u5/.github/workflows/` に `fixed-guest-build.yml`・`fixed-guest-release.yml`・`fixed-guest-bump.yml` を作る。どれもmainでのworkflow_dispatchだけで、`github.ref` の確認、repositoryの確認（反映事項4）、Infrastructure Designの権限表、それぞれのconcurrency group（`cancel-in-progress: false`）、SHAで固定したAction、cacheの保存はmainのbuildだけ、`persist-credentials: false`、job timeout（4時間＋後片付け）を入れる。あわせて、mise.toml・dependabot.yml・Biome・ShellCheckへの追記と、`infra/github/main.tf` へのenvironmentの定義を、差分の案として作る。実装後に `tests/workflows.test.ts` を作って実行する（Bun.YAMLで読み、権限・起動条件・SHAの固定・concurrency・ifの条件を確かめる）。actionlintとShellCheckも実行する。（NFR8.1、NFR5.1、D5–D7）
- [ ] Step 12: formicariumの照合の入口を `scripts/migration-guest-build/verify.ts` に作る。Releaseの3つ（または保存したfile）を取得し、digest・build-info・`buildKey`・C07のidentityを照合し、formicariumのNode版の公開APIで `--version` を実行して記録する。再利用の証拠（`compiled=false`、同じdigest）も照合する。実装後に `tests/migration-guest-build/verify.test.ts` を作って実行する。改変・欠落・別のkey・別のrepositoryの成果物を拒否することを確かめる。試験は `node --test --test-concurrency=1 tests/migration-guest-build/verify.test.js` で直接実行する（mise.tomlには宣言しない）。（FR9、NFR8.2、NFR2.1）
- [ ] Step 13: 文書と追跡。packageの `README.md` に、使い方、許可一覧の変え方、上限、承認の流れ、切り戻しを書く。`proposals/vivarium/u5/HANDOFF.md` に、vivariumへ反映するfileの一覧とSHA256、vivariumで実行する検査のcommandを書く。生成したfileは内容を変えずにjjで追跡する。（NFR8.3）
- [ ] Step 14: vivariumへの反映。vivariumのセッションへの依頼文を示す。vivariumのセッションは、forkのbranchにfileを反映し、`mise run lint:all`・型検査・試験を実行して結果を報告する。上流へのPRの作成は、実際の内容を示して別に承認を受ける。mainへのmerge、environmentの作成（`tofu apply` を含む）、Actionsの設定は、書込み権限のある人が行う。その後、environmentの承認の画面の表示を確かめる（反映事項3）。（NFR2.2、NFR8.1）
- [ ] Step 15: vivariumのCIでの受入。起動の前に、実際の入力とActionsの分数・cacheの残りを示して承認を受ける。起動は書込み権限のある人が行う。順に、baseline（Biome 2405c762）のbuild → C12の計画を示して承認 → Releaseへの書込み → 同じkeyの再利用 → fix（JamBalaya56562/biome f79f85d5）で同じ流れ → mbxありとなしで同じELF digestになることの比較、を行う。各runの直後に、REST（run・jobs・artifacts・Release）とartifactのZIPのdigest・sizeを取得して保存する。sourceと依存の大きさ、時間、cacheの大きさを記録し、上限の半分を超えたら報告する。失敗したら基準を変えずに止め、修正案を示す。（FR7–FR9、NFR3.2、NFR4.1、NFR5.1–NFR5.4）
- [ ] Step 16: formicariumでの照合。`scripts/migration-guest-build/verify.ts` で、2つのcommitの成果物の `--version` の成功・digest・build-info・再利用を照合する。U1のbaselineの試行のfile（forkのbranchにだけある）は、正式な経路があることを確かめたうえで、整理の案を示す。（FR9、NFR8.2）
- [ ] Step 17: 独立した最終レビューを行う。その後、U5の成果物・CIの証拠・scriptのSHA256を固定した、読取専用の短い完了確認のcommandを作り、改変した証拠を拒否することを試験する。実際のcommandを示して承認を受け、承認後の正式な確認が成功したら通常の完了へ進む。code-summary.mdとtraceability.jsonはこのStepで仕上げる。（NFR8.2、FR9）

## 2026-10-17の追記：共有fileの変更を戻し、案の置き場所を移す（人間の回答「A」）

Step 12でformicariumの `mise.toml` にtaskを足し、案のpackageをformicariumの型検査から外すために `tsconfig.json` も変えた。この2つはU1–U4のcode-generationのreviewが固定したsourceに含まれるため、U1–U4のreviewの証拠が外れ、engineがU1のcode-generationを開き直した。人間の回答（A）により、次のようにする。

- formicariumの `mise.toml` と `tsconfig.json` は、親のrevisionの内容に戻した（U1・U4のreviewが記録したSHA256と一致することを確かめた）。
- vivariumへの案は、`integration/vivarium/u5/` から `proposals/vivarium/u5/` へ移した。`proposals/` は `tsconfig.json` のincludeに入らない。`biome.json` には、案のdirectory（独自の `biome.json` を持つ）を検査から外す1行（`!!proposals/vivarium/u5`）を残す。`biome.json` はどのUnitのreviewの対象にも入っていない。
- U5のformicariumの試験は、mise.tomlのtaskにせず、直接のcommandで実行する。
- 案の中身（vivariumへ写す51個のfile）は変わらない。vivariumのforkへpushした commit e0475487 は、この移動の影響を受けない。

## 2026-10-17の追記：実装の途中で分かったことと、その扱い

承認済みの設計の範囲で、次のように実装した。どれも基準を緩めていない。

1. formicariumは `buildKey` を固定の式（C03）で再計算する。そのため、key はその式に合わせた。Cargo.lock・cargo・command・環境変数・imageは、builderHashとdependenciesを通して入れる（D2の入力はすべて含む）。U1のbaselineのbuild-infoの `buildKey`（3c4d9fd1…）を再現する試験で確かめた。
2. C03の `buildInfoSha256` は、正規化したJSONに対して計算する。そのため、build-infoは正規化したJSONで書く。builderとformicariumの両方で、正規化していないbuild-infoを拒否する。
3. 本物のbiomeの `Cargo.lock` には、`github.com/react/react` のgit依存（commit固定）がある。そこで許可一覧を、guestを宣言できる `repositories` と、依存として取得してよい `dependencyRepositories` に分け、後者にreact/reactを入れた。依存のcommitがそのrepository自身のrefから辿れるかは確かめていない（残るリスク）。
4. vivariumの共有Action（`bot-pull-request`）は、auto-mergeを必ず有効にする。D7（mergeは人が行う）に合わせ、PRを作った直後にauto-mergeを外す手順を足した。bump-upstreamのPRはapp tokenで作るため、workflowの `GITHUB_TOKEN` は `contents: read`・`actions: read` だけにした（Infrastructure Designの表より狭い）。
5. GitHubは、workflowが参照したenvironmentが無いと、承認者なしで自動的に作る。そこで、Releaseへの書込みは、`fixed-guest-release` のenvironmentに必須の承認者がいない場合、書く前に止める（`checkApprovalGate`）。
6. mbxのcacheのkeyは、builder（`container/build.sh` と `tools.json`）ごとに1つにした。完全に一致するcacheが無いときだけ保存する。上流のcacheは8.51GBを使っているため、runごとのkeyで増やさない。
7. Releaseへの書込みのworkflowは、run nameに計画のSHA256を入れた（持ち越した指摘3への手当て。承認の画面での実際の表示は、Step 14で確かめる）。
8. vivariumのPRでpackageの試験を動かすworkflow（`test-fixed-guest-builder.yml`）を足した。
9. vivariumの規則（AGENTS.md §4.12）に合わせ、コメントは、動作に必要なものと、消すと壊れる理由だけにした。
10. vivariumのセッションの検査で、Bunのcoverageの関数の既定の閾値によって `bun test` が exit 1 になることが分かった。閾値は変えず、試験を足して exit 0 にした（138件、行98.74%、関数はfileごとに91.67%以上）。

## 2026-10-18の追記：最終レビュー（review-01）への対応と、レビューのやり直し（人間の指示）

Step 17の最終レビュー（READY、Major 1・Minor 6）を受けて、人間の指示で次を直した。上流のPR aletheia-works/vivarium#536（merge 71e0ef92）で反映し、案の `proposals/vivarium/u5/` も同じ内容である（52件）。

- Major：build-infoの `reference.mbxCacheRestored` を、どのcontainerも動く前に数えるようにし、workflowが求めたcacheのkeyと一致したkey（`reference.mbxCacheKeys`）を記録する。公開済みの2つのbuild-infoの `mbxCacheRestored` は信用できないことを、code-summaryに記録した。
- Minor（人間の「まとめて直してください」）：
  - 壊れたmbxのcacheの試験
  - 依存のgitのcommitが、そのrepository自身のrefから辿れることの確認
  - tokenを子processに渡さないこと
- build keyを決めるfile（`container/build.sh`・`tools.json`・`src/key.ts`）は変えていない。そのため、Step 15のCIの結果とReleaseは、そのまま証拠として使う。完了確認のcommand（`verify-final-u5.mjs`）は、このことも確かめる。
- 残りのMinor（承認の自己承認・bumpのauto-merge・cacheの容量・containerの権限）は、code-summaryの記録どおり持ち越す。

レビューの後でcodeが変わったため、人間の指示でcode-generationを開き直した。この計画の再承認のあとで、今のcodeに対してレビューを受け直し、完了の手続きを進める。build・試験・CIは、すでに終わったものを使う。

## 追加Step：新しい土台への合わせと、記録の分け直し（2026-10-18、人間の指示）

人間の指示（「upstream/mainの変更に合わせて下さい」）で、U1〜U4・U7のcodeをformicariumのupstream mainへ移した（PR aletheia-works/formicarium#29〜#35）。今のmainは `2a79860` である。U5のformicarium側の確認は、PR #31（`880cfd4`）でmainに入った。
- formicariumのmainでは、生成JSを追跡しない。U5のtaskは `mise-tasks/migration/guest-build-unit.sh`・`guest-build-verify.sh` が、package.jsonの `migration:guest-build:unit`・`migration:guest-build:verify` を呼ぶ。上のStep 12・追記の「mise.tomlには宣言しない」「直接のcommandで実行する」は古い土台の履歴である。
- `proposals/vivarium/u5/` は、formicariumで追跡されておらず、今のworking copyでは空である。U5の本体（`tools/fixed-guest-builder/` とworkflow 4つ）は、上流の aletheia-works/vivarium のmain（PR #531・#533〜#536、merge `71e0ef92`）にある。上のSteps 1–11・13–15と追記の、`proposals/vivarium/u5/` で作る・試験する・実行する記述は、案の置き場所での履歴であり、書き換えない。
- `biome.json` の `!!proposals/vivarium/u5` の1行は、今のmainには無い。`biome.json` はU5の変更ではない。
- intentの検証コマンドは、人間の承認で `mise run typecheck && mise run build && mise run test:light && mise run migration-preflight-unit && mise run migration-preflight-current-unit && mise run migration-guest-build-unit && mise run showcase-unit` に変わった。古い完了確認のcommand（`.artifacts/migration-guest-build/verify-final-u5.mjs` と135件のbinding）は `proposals/vivarium/u5/` の52件を読むので、今のworking copyでは使えない（推測。実行しない）。古い土台の完了確認の履歴として残す。

新しい土台で取り直したレビュー（review-03、NOT-READY、Major 3・Minor 2）を、人間の指示（「U5のコード生成を開き直して、計画を新しい土台に合わせて承認を取り、記録を上流vivariumの本体とformicarium側の確認に分けて直して」）で直す。

証拠の分け方（この再開で決める記録の形）：
- 上流vivariumの本体：上流のmerge `71e0ef92` と、保存済みの記録（`.artifacts/migration-guest-build/upstream-commit-71e0ef92.json`・`upstream-tree-71e0ef92.json`・`upstream-compare-f1bf9058-71e0ef92.json`）、CIのrun（39073445357、39076793651、39077142098、39079897400、39080082205）とRelease 2組（`release-39076401324`・`release-39079705708`）。builderの試験（158件・行98.43%）は上流で行ったもので、formicariumでは再実行しない。
- formicarium側の確認：`scripts/migration-guest-build/verify.ts`・`assets.ts`、`tests/migration-guest-build/verify.test.ts`、task 2件とpackage.jsonの2行。新しい土台で、試験と、保存済みのRelease 2組に対する照合をやり直す。

- [ ] Step 18: 記録を2つに分けて直す（R-10）。`code-summary.md`・`traceability.json` を、上の「証拠の分け方」に合わせて書き直す。`proposals/vivarium/u5/` をformicariumの中にある前提で書いた記述は、案の置き場所での履歴と明記する。`traceability.json` の対象は、上流の本体は上流の場所（`aletheia-works/vivarium@71e0ef92:tools/fixed-guest-builder/...` の形）、formicarium側は追跡されたfileに直し、formicariumで追跡されていないpathを、formicariumのfileとして指さない。`unit-test-instructions.md` は計画作成時に新しい節を足してあるので、変えない。
- [ ] Step 19: 完了確認の記録を直す（R-11）。`code-summary.md` の冒頭と `traceability.json` のNFR8.2の、`verify-final-u5.mjs` と135件のbindingを、古い土台での完了確認の履歴とする。新しい土台では、intentの検証コマンド（`migration-guest-build-unit` を含む）と、Step 22の照合をU5のformicarium側の証拠とする。R-08の古い数値（146件・98.36%・131件・51件・「mergeは未」）を、158件・98.43%・135件・52件・「#536で71e0ef92にmerge済み」に揃える。
- [ ] Step 20: `source-manifest.json` を直す（R-12）。formicarium側のU5のfile（`scripts/migration-guest-build/assets.ts`・`verify.ts`、`tests/migration-guest-build/verify.test.ts`、`mise-tasks/migration/guest-build-unit.sh`・`guest-build-verify.sh`、`package.json`）にする。`biome.json` は外す。`package.json` は共有fileで、U5の内容は `migration:guest-build:*` の2行だけであることを `code-summary.md` に書く。
- [ ] Step 21: Minorを記録する（R-13・R-14）。`assets.ts` の `nodeAssets` が `tests/package/fixtures.ts` の `developmentAssets` と重なり、試験を通らないこと、`checkSet` が `dependencies` の無いbuild-infoで `INVALID_INPUT` でなく `TypeError` になることを、残余リスクとして `code-summary.md` に書く。codeは変えない（直すかどうかは別に決める）。R-03・R-05〜R-07・R-09（上流のfileの指摘）は、上流の残余リスクとして持ち越す。
- [ ] Step 22: mainで1つずつ、`mise run lint:all`、`mise run typecheck`、`mise run build`、`mise run test:light`、`mise run migration-guest-build-unit` を実行し、件数とfail・skip 0を記録する。そのあと、保存済みのRelease 2組（baselineとfix）に対して、`mise run migration-guest-build-verify`（`verify.ts`。引数は保存済みの `baseline-reuse-evidence.json`・`fix-reuse-evidence.json` と同じtool・key・repository・commit・receipt）を、新しい出力pathへ実行する。結果が保存済みの照合と一致することを確かめる（`--version` の成功・digest・build-info・`buildKey`・再利用）。Releaseの再取得・CI・上流への書込みはしない。入力が足りない場合は、その照合を未検証として記録する。
- [ ] Step 23: 独立レビューを受ける。そのあと、intentの検証コマンドでU5のcheckpointを確かめ、通常の単位完了承認を進める。codeの変更はないので、PRは作らない（記録はU1〜U4・U7の記録と一緒に、後でまとめる）。

## 追加Step：Release の起動を build の run から割り出す形にする（2026-10-19、人間の指示）

U6 の Step 17 で、新しい題材の baseline と fix の Release を、今の fixed-guest-release（入力8つ：build_run_id・tool・binary・key・repository・commit・plan・plan_sha256）で起動した。`plan` と `plan_sha256` の入力が入れ替わり、さらに待機中のもう1つの run を busy と数えて、baseline の run 39188699745 は BUSY で失敗した（何も書いていない）。fix の run 39188781155 も入力が入れ替わっている。人間の判断：入力が多く使いづらく、失敗も起きたので、やり方を変える。起動は「build に続け、run ID でも起動」、重なりは「順に待つ」（2026-10-19 の回答）。

方針（C12 の「JSON の操作計画を人が承認する」は保つ）：
- 人が入れるのは build の入力（tool・repository・commit・fixture・mbx。今のまま）だけ。build が成功したら、同じ run の後の job で release の workflow を `workflow_call` で呼ぶ。release の `workflow_dispatch` の入力は `build_run_id` だけにする（今の2つの build のように、後から release するときと、やり直しに使う）。
- release の最初の job（`contents: read`・`actions: read`、environment なし）が、build の run を GitHub の API で確かめ（aletheia-works/vivarium、`fixed-guest-build.yml` の main の workflow_dispatch の成功した run、artifact `fixed-guest-<run_id>` がある）、artifact を取り、receipt・build-info・成果物を照合して、tool・key・repository・commit を割り出す。binary は `tools.json` の tool の設定から決める。今の `verifyArtifactSet` と `makePublishPlan` で計画を作り、計画の JSON と SHA256、対象の tag と各 digest を job summary に出し、計画の file を artifact にする。rollback の文と approvalReference は code に固定する（approvalReference は「environment fixed-guest-release の承認、run <release の run_id>」）。
- 次の job（`environment: fixed-guest-release`、`contents: write`）は、人の承認の後に、前の job の計画の file を取り、job の出力の SHA256 と一致することを確かめてから、今の `release` の処理で公開する。公開済みなら検証だけ、ELF の違いは `NOT_REPRODUCIBLE`（今のまま）。
- busy の確認は、同じ workflow の `in_progress` の run だけを数え、`queued`・`waiting`・`pending` の run は数えない。順番は今の concurrency group（`cancel-in-progress: false`）で守る。同じ key を同時に書かないことは保つ。
- build が同じ key の既存の Release を再利用した（`compiled=false`）ときも release の job は動き、公開済みの Release を検証するだけで終わる。

- [ ] Step 24: 構成と tool の確認。vivarium の `jj git fetch` で `main@upstream` を確かめ、そこから `jj new` して bookmark `fixed-guest-release-from-run` を作る。使う tool（Bun・TypeScript・Biome・actionlint・ShellCheck・使う Action の最新の SHA）の最新版を確かめ、古いものは差分を報告する。`mise run ci:fixed-guest-builder` が今の main で通ることを確かめ、command を code-summary に書く。
- [ ] Step 25: 実装：build の run から計画を作る。`tools/fixed-guest-builder/src/` に、run の確認（GitHub の API、上の条件）・artifact の receipt と build-info の照合・tool・key・repository・commit・binary の割り出し・計画の作成を行う部品（新しい module。CLI の subcommand `prepare --build-run-id <id> --artifacts <dir> --plan-out <file> --summary <file>`）を作る。割り出した値は、receipt・build-info・成果物の digest・`tools.json` の間で一致しなければ失敗にする（片方だけを信じない）。（C12、D6、NFR5.3、NFR8.1）
- [ ] Step 26: Step 25 の後の試験。`tools/fixed-guest-builder/tests/prepare.test.ts`（新しい file）に、正しい run と artifact から計画ができること、run の workflow・branch・event・結論・repository の違い、receipt と build-info の不一致、成果物の digest の不一致、`tools.json` に無い tool、artifact の欠落をそれぞれ拒否すること、summary に計画の SHA256 と各 digest が出ることを確かめる5–8件を書き、実行する。偽の GitHub の API を使う。
- [ ] Step 27: busy の確認の変更と試験。`src/busy.ts` を、`in_progress` の run だけを数えるように直す。先に `tests/busy.test.ts` に、待機中（`queued`・`waiting`・`pending`）の run があっても busy にならないこと、`in_progress` の別の run があれば busy になることを確かめる試験を足し、直す前の失敗を観測してから直し、同じ試験が通ることを確かめる（不具合の修正の順）。（NFR5.1）
- [ ] Step 28: workflow の変更。`fixed-guest-release.yml` を、`workflow_dispatch`（入力は `build_run_id` だけ）と `workflow_call`（入力 `build_run_id`）で起動し、`prepare` の job（`contents: read`・`actions: read`）と `publish` の job（`needs: prepare`、`environment: fixed-guest-release`、`contents: write`・`actions: read`）に分ける。`publish` は計画の SHA256 を `prepare` の出力と照合する。`fixed-guest-build.yml` の最後に、build が成功したときだけ release を `uses:` で呼ぶ job を足す（job ごとに権限を書き、build の job の権限は広げない）。どちらも main の aletheia-works/vivarium だけで動く条件、`persist-credentials: false`、SHA で固定した Action、concurrency を保つ。`tests/workflows.test.ts` を新しい形に合わせて直し、actionlint と ShellCheck とともに実行する。（NFR8.1、D5–D7）
- [ ] Step 29: 文書と回帰。`tools/fixed-guest-builder/README.md` の「Publishing a set」を新しい手順に書き直す（人がすること：build の起動と、summary を読んでの environment の承認。release を後から起動するときは run ID だけ）。vivarium で1つずつ `mise run ci:fixed-guest-builder`、`mise run fixed-guest-builder:check`、actionlint、ShellCheck を実行する。formicarium 側の U5 の照合（`mise run migration-guest-build-unit`）も1つずつ実行し、影響が無いことを確かめる。
- [ ] Step 29a: 不安定な試験の修正（別の PR、2026-10-19 の人間の判断「1」）。vivarium#538 の CI（run 39191078848）で `tests/pipeline.test.ts` の「stops a source above the size limit before building」が5秒の制限で失敗した。#538 はこの試験と `pipeline.ts`・`monitor.ts`・`source.ts`・`build.ts` を変えておらず、手元では10回とも通った。原因の候補（推測）：試験は上限10 bytes・測定の間隔10ms なので、runner が遅いと clone の途中で上限を超えたと判断し、`spawnGroup` の stop が SIGTERM の後に `DEFAULT_KILL_GRACE_MS`（30秒）まで待つ。進め方：
  1. `main@upstream` から別の bookmark `fix/fixed-guest-builder-size-limit-test` を作る（#538 の change とは分ける）。
  2. 先に失敗を再現する。clone の途中で上限を超える経路を、試験の中で必ず通るようにして（例：測定を注入して最初の測定で上限を超えさせる、又は git の偽物で clone を遅くする）、今の code で5秒を超えることを観測する。再現できなければ止めて報告する。
  3. 原因に合わせて最小の修正をする。候補は、`BuildDeps` から監視つきの git に `killGraceMs` を渡せるようにして試験で短くするか、SIGTERM で終わらない process の扱いを直すこと。production の既定の待ち時間（30秒）と、上限を超えたら止めて `LIMIT_EXCEEDED` にする振る舞いは変えない。試験の timeout は延ばさない。
  4. 同じ試験が通ることを確かめ、`mise run ci:fixed-guest-builder` と `mise run fixed-guest-builder:check` を1つずつ実行する。
  5. fork への push と上流への PR は、内容を示して承認を受けてから行う。
- [ ] Step 30: 外部操作（それぞれ実際の内容を示して個別に承認を受ける）。（review-05 の R-01・R-04 により未完了に戻した。release と Release の digest の確認は済んだが、計画の SHA256 の確認が残る。Step 32 で行う。旧い形の fix の run 39188781155 は、取り消されず承認された後に `VERIFY_FAILED` で止まり、何も書かなかった。）fork への push と上流への PR → 書込み権限のある人の merge → 今の2つの build（run 39178190974 と 39178274922。artifact は 2026-10-26 まで）を、新しい fixed-guest-release を run ID だけで起動して release する（起動と environment の承認は書込み権限のある人）。job summary の計画の SHA256 と、できた Release の3つの file の digest を確かめて記録する。待機中の旧い形の fix の run 39188781155 は、承認せず取り消してもらう。
- [ ] Step 31a（review-05 の指摘の修正、2026-10-19 の人間の回答「推奨の範囲で直す」）：下の Step 32–36 を先に行い、その後で Step 31 を行う。
- [ ] Step 32: R-01（Major）の確認：今回の2つの release の run（39191728502・39191750168）の artifact `fixed-guest-plan` を、formicarium の `.artifacts/u5-fixed-guest-build/plans/<run>/` に読取りだけで取り、計画の file の SHA256 が log の `PLAN_SHA256`（baseline `6c338e01…3981`、fix `90a3b5f2…7e58`）と一致すること、計画の `targets` と `inputDigests` ができた Release の3つの file と一致することを確かめて記録する。一致しなければ止めて報告する。
- [ ] Step 33: R-01（Major）の修正：承認の画面に計画の SHA256 が見えるようにする。`fixed-guest-release.yml` の `publish` の job の `name` に `needs.prepare.outputs` の計画の SHA256 を入れ、job summary の値と同じであることを `tests/workflows.test.ts` で確かめる。README の手順に「承認の前に、job の名前と summary の SHA256 が同じことを確かめる」を書く。
- [ ] Step 34: R-08・R-02・R-07 の修正（不具合の修正の順：先に試験の失敗を観測してから直す）。まず GitHub の concurrency の公式の文書で、待ちが1つしか持てず新しい待ちが古い待ちを取り消すかを確かめて記録する。その結果に合わせて：(a) release は workflow の concurrency group で並べず、`publish` の job の中で、ほかの run の `publish` の job（`fixed-guest-release.yml` の run と、`fixed-guest-build.yml` から呼ばれた run の両方）が `in_progress` の間は待つ（run ID の小さい方を先にする。待つ上限は job の timeout の内で、超えたら原因付きで失敗）。(b) build の BUSY の確認は、ほかの run の `build <tool>` の job だけを数え、release の段階を数えない。(c) build の job の concurrency も同じく待ちの取り消しが起き得るなら、同じ形の待ちにするか、取り消しを README に書いて検出できるようにするかを、文書で確かめた上で決めて記録する。`tests/busy.test.ts`・`tests/workflows.test.ts`・必要なら新しい試験で確かめる。
- [ ] Step 35: R-03 の修正：`publish` の時点で、guest の repository が `allowlist.json` に今もあることを確かめ、無ければ書かずに失敗する。`tests/prepare.test.ts` 又は `release.test.ts` に試験を足す。R-06（#539 の原因は推測のまま）は記録だけにする。
- [ ] Step 36: 回帰と外部操作。vivarium で1つずつ `mise run ci:fixed-guest-builder`、`mise run fixed-guest-builder:check`、actionlint、ShellCheck を実行する。fork への push と上流への PR は、内容を示して承認を受けてから行う。merge の後に、release の経路を1回通して（既存の Release の key なら検証だけで終わる）、承認の画面の job の名前と summary の SHA256 が同じことを人に確かめてもらう。R-04・R-05：記録のチェックと traceability の古い数字（NFR2.2 の158件・98.43%、NFR4.1 の #539 の状態）を直す。
- [ ] Step 31: 記録と確認。U5 の code-summary.md・traceability.json・source-manifest.json に今回の変更を書く。独立レビューを受け、intent の検証コマンドで U5 の checkpoint を確かめる。

### 2026-10-21 の Request Changes について

2026-10-21 に、Code Generation の段階を閉じるときの扱いで、人間の選んだ Request Changes が段階の全体に記録された。人間の意図は U2 の一覧の変更だけで、U5 の計画を変える指示ではなかった。この計画の Step と内容は変えない（人間の回答 2026-10-21「A」：計画をそのまま承認し直して Unit ごとに進める）。

## 追加Step：review-07 の新しい Minor の修正（2026-10-21、人間の指示）

人間の指示「先ほどの U5 の Minor 3件を直す Step を足す」「前からの Minor 6件（R-02・R-06・R-09・R-13・R-14・R-16）も対象にして下さい」による。review-07 の新しい Minor 3件は Step 37 で記録の更新により直す。前からの Minor 6件は、formicarium 側の code（R-13・R-14）を Step 38、上流 vivarium 側（R-09）と実 run の確認（R-06）を Step 39、記録だけで済むもの（R-02・R-16）を Step 37 で扱う。基準と製品の振る舞い（拒否の条件を除く）は変えない。

- [ ] Step 37: review-07 の Minor 3件を直す。
  - 指摘1（試験の前提）：`unit-test-instructions.md` と `code-summary.md` の「検証コマンドは `mise run build` を先に実行するので、通常は満たされる」を直す。`mise run build` は tsc と `scripts/emit.ts` だけで、`verify.test.ts` が読む生成物を作らない。`dist/blink/` は `mise run build-blink-wasm`、`dist/guests/`（aube・hello・exit3・probe）は `mise run build-guests` が作ること、両方が先に必要であること、aube はゲストのソースが変わっていなければ再ビルドしないことを書く。
  - 指摘2（今の土台での確認）：`code-summary.md` の Step 22 の節に、その結果が 2026-10-18 の土台 `2a79860` のものだと明記する。今の土台（PR #58 の後の `main@upstream`）で intent の検証コマンドを checkpoint の確認として1回通し、exit と各 task の件数を新しい節に書く。`package.json` の `migration:guest-build:*` の行番号を今の106–107行に直す。`verify.ts` の13行が U1 の `scripts/migration-preflight/unique-json.ts` に依存することを書く。
  - 指摘3（Step 30 の注記）：`code-summary.md` に一文を足す。計画の Step 30 の本文にある「未完了に戻した」は review-05 の時点の経過であり、そのあと人の回答「2は完了にして下さい」で完了にしたので印が `[x]` である、という内容にする。計画の Step 30 の本文は変えない。
  - R-16：指摘2で今の土台の検証コマンドを main session が通した結果を書くので、Step 22 の件数が再実行されていない点はそれで置き換える。
  - R-02：壊れた mbx cache の試験は、container での実際の build が要るので今回は作らない。`code-summary.md` の「未完・未検証」に「壊れた cache で build が失敗するか同じ digest になることは未検証。mbx あり／なしで同じ ELF digest になることは実 CI（39073445357・39080082205）で確認済み」と書き、`traceability.json` の NFR5.4 をこの証拠に合わせる。
  - あわせて `traceability.json` の該当する欄（NFR8.2・NFR5.4、Step 38 で変わる FR9）を、今の土台での確認に合わせる。
- [ ] Step 38: formicarium 側の code の修正（R-14・R-13、不具合の修正の順）。
  - R-14：先に `tests/migration-guest-build/verify.test.ts` に、canonical な形の build-info が `{}`（`dependencies` が無い）や、`dependencies` が配列でない場合に、`INVALID_INPUT` で拒否されることを確かめる試験を足す。直す前に `TypeError` で失敗することを観測する。そのあと `scripts/migration-guest-build/verify.ts` の `checkSet` で、`guestCanonical`・`guestBuildKey` を呼ぶ前に、build-info が object であること、`dependencies` が配列であることを `refuse` で確かめるように直し、同じ試験が通ることを確かめる。
  - R-13：`scripts/migration-guest-build/assets.ts` の `nodeAssets` が作る一時 directory を、`verify.ts` の `main()` の終了時（成功・失敗とも）に消すようにする（`nodeAssets` が directory を返し、`main()` の `finally` で `rm`）。`verify.test.ts` に、保存した set を一時 directory に書き、`node scripts/migration-guest-build/verify.js` を子 process で実行して、証拠の file ができること、必須の引数が無いときに失敗すること、`formicarium-guest-build-` の一時 directory が残らないことを確かめる試験を足す。`tests/package/fixtures.ts` の `developmentAssets` との重複は、試験用と製品用で置き場所を分けたままにし、`code-summary.md` に理由を書く。
  - main session で1つずつ `mise run lint:all`・`mise run typecheck`・`mise run build`・`mise run test:light`・`mise run migration-guest-build-unit` を実行し、件数と fail・skip 0 を記録する。`source-manifest.json` と `code-summary.md` を更新する。差分を示して、formicarium への push と PR の承認を受ける。
- [ ] Step 39: 上流 vivarium 側（R-09）と実 run の確認（R-06）。
  - R-09：vivarium の fork で `main@upstream` から `jj new` し、`tools/fixed-guest-builder/src/process.ts` の `WITHHELD` の近くに、名前による除外の限界（`*_KEY`・`SSH_AUTH_SOCK` などは外れない。新しい秘密を workflow に足すときは、ここに足すか許可リスト方式へ切り替える）を一文のコメントで書く。code の振る舞いは変えない。vivarium で `mise run ci:fixed-guest-builder` を実行する。差分を示して、fork への push と上流への PR の承認を受ける。
  - R-06：`fixed-guest-bump.yml` の実 run は vivarium に PR を作るので、起動の前に実際の入力を示して別に承認を受け、起動は書込み権限のある人が行う。run の後に、できた PR の auto-merge が外れていることを REST の読取りで確かめて記録する。承認が得られない場合は、未検証として `code-summary.md` に残す。
  - 独立レビューを受け、intent の検証コマンドで U5 の checkpoint を確かめる。

## 追加Step：review-08 の Minor と bump の PR の題の修正（2026-10-22、人間の指示）

人間の指示「Minor3件を直して下さい。また、vivariumのPRはconventional commitのCIが失敗しているから、ここを修正して欲しいです」による。

- [ ] Step 40: review-08 の Minor 3件を直す（formicarium）。
  - 指摘1（CLI の試験の後片付け）：`tests/migration-guest-build/verify.test.ts` の CLI の試験に、`nodeAssets` の後で失敗する場合（別の `--key`。`checkSet` が `another key` で拒否する）を足し、失敗の後も一時 directory が残らないことを確かめる。必須の引数が無い場合の後の確認は、`nodeAssets` の前に拒否されて自明なので、拒否の内容だけを確かめる形にする。子 process には `TMPDIR`・`TEMP`・`TMP` を同じ directory で渡す。
  - 指摘2（形の検査の残り、不具合の修正の順）：先に試験を足し、catalog が object でない場合（`null`）、`entries` の要素が object でない場合（`[null]`）、`dependencies` の要素が object でない場合（`[null]`）が、`TypeError` で失敗することを観測する。そのあと `scripts/migration-guest-build/verify.ts` の `checkSet` で、それぞれを `refuse`（`INVALID_INPUT`）にし、同じ試験が通ることを確かめる。拒否の条件のほかの振る舞いは変えない。
  - 指摘3：`code-summary.md` の古い節の「検証コマンドは `mise run build` を先に実行するので、通常は満たされる」に、誤りであり冒頭の「試験の前提」が正しい、と注記する。
  - main session で1つずつ `mise run lint:all`・`mise run typecheck`・`mise run build`・`mise run test:light`・`mise run migration-guest-build-unit` を実行し、件数と fail・skip 0 を記録する。差分を示して、formicarium への push と PR の承認を受ける。
- [ ] Step 41: vivarium の bump の PR の題を conventional commit にする（不具合の修正の順）。
  - bot の PR aletheia-works/vivarium#554 の Commitlint が、commit の題 `fixed-guest: bump baseline in ...` を type・subject が空として拒否した（run 39608896977）。`bot-pull-request` は PR の題をそのまま commit の題に使う。
  - vivarium の `main@upstream` から `jj new` し、先に `tools/fixed-guest-builder/tests/workflows.test.ts` の期待を `chore(layer1): bump the ${{ inputs.role }} guest of ${{ steps.bump.outputs.slug }}`（conventional commit の形、100文字以内）に変えて失敗を観測する。そのあと `.github/workflows/fixed-guest-bump.yml` で bump の step に `slug` の出力を足し、PR の題をその形にする。
  - vivarium で `mise run ci:fixed-guest-builder`・`fixed-guest-builder:check`・`fixed-guest-builder:typecheck`・`actions:check` を1つずつ実行する。差分を示して、fork への push と上流への PR の承認を受ける。#554 は人間が閉じる。
  - 独立レビューを受け、intent の検証コマンドで U5 の checkpoint を確かめる。

## 追加Step：bump の PR を自動で merge する設計への変更（2026-10-22、人間の決定）

人間の指示「個人的にはbumpのPRも自動でマージされる仕組みにして欲しいです。今からそちらに設計変更して下さい」による。D7 の「PRのmergeは人が行う（NFR3.5）」を、「必須の check がすべて通ったら自動で merge する」に変える。要件（FR8・NFR3.5）は merge の方法を決めていないので、要件は変えない。branch の直接の解決、D1 の確認、記録、PR を作る job だけの書込み権限は変えない。bump が動かすのは宣言の `commit` だけで、受け入れ済みの build（`accepted`）は変わらない。新しい commit の build と受け入れは、これまでどおり別に人が行う。

- [ ] Step 42: bump の PR を自動で merge する。
  - 設計の記録：`construction/u5-fixed-guest-build/nfr-design/security-design.md` の D7 に、2026-10-22 の人間の決定で「必須の check がすべて通ったら自動で merge する」に変えたことを、日付つきの注記で足す（元の文は残す）。
  - vivarium（#555 と同じ file に触るので、#555 の branch の上に積み、#555 の merge の後に `main@upstream` へ rebase して PR にする）：先に `tools/fixed-guest-builder/tests/workflows.test.ts` の「open bump PRs with the bot and leave the merge to a person」を、auto-merge を外す step が無く、`bot-pull-request` の後に merge を止める step が無いことを確かめる形に変え、失敗を観測する。そのあと `.github/workflows/fixed-guest-bump.yml` から「Leave the merge to a person」の step と、その前のコメントを外し、PR の本文の「A person merges this pull request.」を、必須の check が通ったら自動で merge されること、新しい key の build は別に行うことに書き換える。`tools/fixed-guest-builder/README.md` の bump の説明（auto-merge を外して人が merge する）を同じように直す。
  - vivarium で1つずつ `mise run ci:fixed-guest-builder`・`fixed-guest-builder:check`・`fixed-guest-builder:typecheck`・`actions:check` を実行する。差分を示して、fork への push と上流への PR の承認を受ける。
  - `code-summary.md`・`traceability.json`（FR8・NFR3.5）に、設計の変更と証拠を書く。R-06（auto-merge が外れること）は、この変更で前提が変わったことを記録する。
  - 独立レビューを受け、intent の検証コマンドで U5 の checkpoint を確かめる。

## 追加Step：review-09 と NFR Design review-03 の Minor の修正（2026-10-22、人間の指示）

人間の指示「U5 の Minor 5件を直す」による。どれも記録と設計の書き足しで、code は変えない。

- [ ] Step 43: Minor 5件を直す。
  - Code Generation の指摘1（記録の追いつき）：`code-summary.md` の Step 40・41・42 の見出しの「push 前」を merge 済みに直し、merge commit（#62 `2faec369`、#555 `f4be3299`、#556 `dee1ba5e`）を見出しの近くに書く。Step 38 の節の R-13 の項目に、Step 40 で CLI の試験を改めたことを注記する。`traceability.json` の FR8 に #556、NFR3.5 に Step 42 の設計変更、FR9・NFR8.2 に Step 40（`migration-guest-build-unit` 12件、形の検査）を足す。`unit-test-instructions.md` の「試験の前提と追加の試験」の節に、Step 40 の試験と12件を足す。「持ち越す上流の残余リスク」の R-06 の記述に、Step 42 で前提が変わったことを注記する。
  - Code Generation の指摘2と NFR Design の指摘1・2（自動 merge の安全の記録）：`nfr-design/security-design.md` に次を足す。
    - D7：必須の check は vivarium の main の ruleset（`required_status_checks`）のものであること。2026-10-22 の読取りでは10個（`Unit (resolveReproFile)`・`Polyglot lint`・`check / Commitlint`・`E2E` 3つ・`regression` 3つ・`Test MCP server`）。bot の PR は `aletheia-works-bot` の App token で作るので CI が動くこと（#554 で動いた）。`fixed-guest-build.yml` は `workflow_dispatch` だけで起動するので、bump の merge で build は始まらないこと。PR を作る job の token の権限（contents・pull-requests の write）が merge を含むかではなく、merge は repository の auto-merge と ruleset が行うこと。
    - Threat Response and Rollback：脅威に「宣言の branch の先端に入った未確認の commit が、必須の check を通って宣言に入る」を足す。D1 の確認（許可一覧・repository 自身の ref からの到達）と、`accepted` の build と受け入れが人の関門として残ることで影響を宣言の `commit` に限ること。切り戻しに「誤って入った bump は、その merge commit を revert する PR で戻す。`accepted` は変わっていないので、配布中の guest は変わらない」を足す。
    - Assumptions：「`GITHUB_TOKEN` で作ったPRでは…Code Generationで決める」に、App token で作るので CI が動くと決まったこと（#554 で確認）を注記する。
  - NFR Design の指摘3：D7 の元の行の「PRのmergeは人が行う（NFR3.5）」に、NFR3.5 は merge の方法を決めておらず、この行は 2026-10-22 の変更で置き換えた旨を注記する（元の文は残す）。`commit` だけが動いて `accepted` が古い間の扱いを D7 に書く：宣言の `commit` と `accepted.commit` が違う間は、FR10 の照合は `accepted` の build（commit と digest）に対して行う。これは実装（vivarium の Layer 1）での扱いを読んで確かめ、確かめられなければ未検証と書く。
  - 独立レビューを Code Generation と NFR Design の両方で受け、intent の検証コマンドで U5 の checkpoint を確かめる。PR は作らない（code の変更が無いため）。

## 追加Step：review-10 と NFR Design review-04 の Minor の修正（2026-10-22、人間の指示）

人間の指示「minorの修正をお願いします」による。どれも記録と設計の書き足しで、code は変えない。

- [ ] Step 44: Minor を直す。
  - token の権限（Code Generation review-10 の指摘2、NFR Design R-09 の残り）：`nfr-design/security-design.md` の D7 で、workflow の `GITHUB_TOKEN` は `contents: read`・`actions: read` だけであり、PR の作成は `actions/create-github-app-token` で作る `aletheia-works-bot` の App token（`permission-contents: write`・`permission-pull-requests: write`、その job の間だけ）で行うことを分けて書く。App が ruleset を迂回できるかは、ruleset の `bypass_actors` が私たちの権限では読めない（`null`、`current_user_can_bypass: never`、2026-10-22 の読取り）ので未検証と書く。Threat Response の脅威に「bot の資格情報（App の private key）が漏れると、その権限の範囲で branch への push と PR の作成ができる」を足し、対策（秘密は repository の secret に置き job の間だけ token にする、署名・必須の check・linear history の ruleset、迂回できるかは未検証）を書く。
  - 必須の check の根拠（NFR Design review-04 の新しい指摘、Code Generation review-10 の指摘3）：10個は `gh api repos/aletheia-works/vivarium/rules/branches/main` の `required_status_checks` で 2026-10-22 に読んだこと、#554（recipe.json だけを変える bot の PR）で10個すべてが報告され、9個が pass、`check / Commitlint` だけが fail だったこと（`gh pr checks 554`）を、`code-summary.md` の新しい「Step 43・44」の節に書く。D7 と Assumptions の注記を、この根拠に合わせて書き直す。
  - `traceability.json` の FR8 の古い「push 前。変更後の実 run は未検証」の文を、merge 済み（#556 `dee1ba5e`）と、変更後の実 run は未検証、に直す（review-10 の指摘1）。
  - NFR8.2 の主張の裏付け（review-10 の指摘4）：Step 40 の後の checkpoint の確認（`bolt checkpoint --action verify` の exit 0）を、日時と土台つきで `code-summary.md` の「Step 43・44」の節に書く。
  - 独立レビューを Code Generation と NFR Design の両方で受け、intent の検証コマンドで U5 の checkpoint を確かめる。PR は作らない。

## 追加Step：review-11 と NFR Design review-05 の Minor の修正（2026-10-22、人間の指示）

人間の指示「はい、U5 の Minor 2件を直してください。U7 の計画は変えないでください」による。記録と設計の書き足しだけで、code は変えない。

- [ ] Step 45: Minor 2件を直す。
  - `traceability.json` の FR8 で、#556 の merge 済みと「変更後の実 run は未検証」が2回ずつ書かれているのを、1文にまとめる（review-11 の指摘1）。
  - `nfr-design/security-design.md` の D7 の「token と merge の権限」と Threat Response の bot の資格情報の項で、確かめたことと未検証のことを分ける（review-11 の指摘2、NFR Design review-05 の新しい指摘）。確かめたこと：`GITHUB_TOKEN` の権限と App token の権限（workflow の file を読んだ）、ruleset の種類と必須の check（`gh api`）、#554 での check の報告、ruleset の `bypass_actors` が読めないこと。未検証のこと：repository の auto-merge が有効か、ruleset の `pull_request` が承認の数を求めるか、App の private key の置き場所、App が ruleset を迂回できるか、変更後の bump の実 run で PR が自動で merge されること。未検証のことは「次に bump を実際に動かすときに確かめる」と1行で書く。
  - 独立レビューを Code Generation と NFR Design の両方で受け、intent の検証コマンドで U5 の checkpoint を確かめる。PR は作らない。

## 追加Step：Build and Test の Loop-back 2（追跡表の target、2026-10-22、人間の決定 A）

Build and Test の `aidlc engine sensor-traceability --stage build-and-test` が Fail した。この道具は `OK` の行の target を「workspace（formicarium）の中の、実在する1つの file の相対 path」としてだけ受け付ける。U5 の `traceability.json` の `OK` 19行のうち18行は、target が vivarium（別のリポジトリ、`aletheia-works/vivarium@<sha>:<path>`）と説明の文なので、道具が読めない（Build and Test の `cross-unit-traceability.md`、`test-results.md` の Loop-Back Log 2）。人間の決定（2026-10-22「A」）：formicarium の照合が確かめる行は `OK` のままにし、vivarium だけが実装する行は `N/A` にして理由を書き、記録に分かる注記を残す。

- [ ] Step 46: `traceability.json` の coverage の19行を、次のとおりに直す。
  - `OK` のまま（formicarium の照合の入口が確かめる行、3行）：`FR9`・`NFR3.3`・`NFR8.2`。target は `scripts/migration-guest-build/verify.ts`（1つの file の相対 path だけ）にする。
  - `N/A` にする（vivarium の builder・workflow だけが実装する行、15行）：`FR7`・`FR8`・`NFR2.2`・`NFR3.1`・`NFR3.2`・`NFR3.4`・`NFR3.5`・`NFR4.1`・`NFR4.2`・`NFR5.1`・`NFR5.2`・`NFR5.3`・`NFR5.4`・`NFR8.1`・`NFR8.3`。target（道具が `N/A` の理由として読む欄）は「formicarium の workspace の外の aletheia-works/vivarium で実装（tools/fixed-guest-builder と .github/workflows/fixed-guest-*.yml）。この workspace の file ではないので、この表では N/A とする。実装と証拠は note のとおり」の形にする。
  - `N/A` にする（U5 が配布 JS を変えない行、1行）：`NFR2.1`。理由は「U5 は配布 JS を変えない（scripts/migration-guest-build/*・tests/migration-guest-build/* は配布の対象外）」。
  - 19行すべてに `note` の欄を足し、今の target の文（vivarium の commit・path・PR・run の記録と、formicarium の関連 file）をそのまま移す。記録の内容は消さない。
  - 表の先頭に `note` の欄（行とは別の、表全体の注記）を足し、「`N/A` の行の多くは、適用されないのではなく別のリポジトリ（aletheia-works/vivarium）で実装した行である。道具が workspace の外の file を読めないため、N/A と理由で表す（人間の決定 2026-10-22 A）」と書く。
  - 製品のコード・試験・基準は変えない。直したあと `aidlc engine sensor-traceability --stage build-and-test` を実行し、U5 の行が未対応に出ないことを確かめる。`code-summary.md` にこの Step の節を足す。（FR7・FR8・FR9、NFR8.2）
- [ ] Step 47: 独立レビューを受け、intent の検証コマンドで U5 の checkpoint を確かめる。

## テスト設計と追跡

部品ごとの試験数（Standard、各5–8件以上）：declaration 8、source 7、lockfile 6、key 6、monitor 6、deadline 5、build 8、artifact 8、reuse 6、release 8、busy 5、bump 6、cli 5、workflows 8、formicariumのverify 7を目安にする（計約100件）。境界値と+1、拒否したときに状態が変わらないこと、途中で失敗したときの後片付けを確かめる。定数を読み返すだけの試験は書かない。builderのpackageの行coverageは80%以上とする（bun test --coverage）。formicariumの既存の試験と配布JSのcoverageは変えずに維持する。

| 要件・設計 | Step |
|---|---|
| FR7（宣言・key・再利用・Release） | 2、4、7、8、15 |
| FR8（build-info・catalog・builderとverdictの分離・bump） | 7、9、10、15 |
| FR9（baselineとfix、remote照合、formicariumでの `--version`） | 3、12、15、16 |
| NFR2.1、NFR2.2 | 1、12、14 |
| NFR3.1–NFR3.5 | 2、3、4、7、9 |
| NFR4.1、NFR4.2 | 5、6、7 |
| NFR5.1–NFR5.4 | 4、6、7、8、11、15 |
| NFR8.1–NFR8.3 | 8、10、11、13、14、16、17 |

実際のbuild・Releaseへの書込み・PR・merge・environmentの作成・CIの起動・新しい費用は、この計画の承認に含めない。それぞれ、実際の対象とcommandを示して別に承認を受ける。

## Testing Contract

```json
{
  "version": 1,
  "methodology": "test-after",
  "source": "team",
  "ordering": "通常の新規実装は各テスト可能な層を実装した後にその層のテストを作成・実行し、不具合修正は再現テストの失敗を先に観測してから修正し同じテストの成功を確認する。（人間の回答 Q3）",
  "scope": "classic",
  "test_strategy": "standard",
  "project_type": "brownfield",
  "applicable_notes": [
    {
      "layer": "org",
      "text": "We treat tests as a first-class deliverable in every Bolt. The specific\nmethodology (TDD, BDD, ATDD, or classic test-after) is affirmed at\npractices-discovery and recorded in `team.md` under this heading with explicit\n`Methodology` and `Ordering` fields; Code Generation resolves those fields\nindependently from coverage, tooling, and scope notes.\n\nWhen no posture has been affirmed, our default per scope is:\n- **Methodology**: test-after\n- **Ordering**: implement each applicable testable layer, then write and run\n  that layer's tests.\n- `mvp`, `enterprise`, `feature`, `infra`, `classic` add an 80% line-coverage\n  floor and CI execution before merge.\n- `bugfix`, `security-patch` add a targeted regression for the specific\n  bug/vulnerability and require the existing suite to remain green.\n- `express` uses the Minimal strategy: requirement-driven unit tests (one per\n  requirement, with a happy-path floor per component); existing tests remain\n  green.\n- `poc`, `refactor`, `workshop` add no extra new-test floor and require the\n  existing suite to remain green.\n\nThe active `Test Strategy` still applies in every scope and determines test\nvolume/types. Scope floors are additive; they never reduce or replace the\nselected strategy.\n\nBuild and Test verifies defined coverage floors and affirmed quality targets;\nthey may not be weakened to make a step pass.\n\nAffirm a stricter posture in `team.md` if the team commits to one."
    },
    {
      "layer": "team",
      "text": "- **Methodology**: test-after\n- **Ordering**: 通常の新規実装は各テスト可能な層を実装した後にその層のテストを作成・実行し、不具合修正は再現テストの失敗を先に観測してから修正し同じテストの成功を確認する。（人間の回答 Q3）\n- node:test と Playwright の既存結合テストを利用する（検証済み：package.json scripts、code-quality-assessment.md）。今回の成功結果・coverage 値は未検証。\n- classic の追加条件は行 coverage 80%以上と統合前 CI 実行（ドキュメント根拠：org.md Testing Posture）。基準を下げて通過させない。\n- coverage の技術提案（未実装・未検証）：第一者が保守する配布 JS 全体（既存 runtime の未変更ファイル、共通処理、公開 API、Node/browser Worker adapter を含む）の一覧を事前に固定し、未実行ファイルも分母に含める。tests、生成 blink JS/wasm、第三者/vendor、ゲスト ELF、.d.ts、デモ・開発専用 scripts は理由を明示して対象外とし、資産・型・回帰検証を別途行う。設計で配布対象を確定し、閾値達成のために除外を変更しない。\n- Worker/ブラウザ内の計測を収集・マージし、対象一覧と照合して欠落を検出する。未収集ファイルを分母から外さず0%または未測定として失敗／未検証を報告する。計測方式は担当者が未importファイル・別process/realmを含む試験を観測して選ぶ。対象一覧、除外理由、行数、レポート、実行コマンドを CI 成果物へ残す。ブランチ coverage の新しい数値条件は追加しない。\n- 既存上限は probe 600秒、aube ブラウザ840秒、1worker、retryなし、probe 8項目全通過、native 出力一致、wasm 1GB。テストは main session が逐次実行する（人間の指示：AGENTS.md）。\n- aube はソースが変わっていなければ再ビルドしない。計測は重い並行処理なしで行う。新しいコア不具合の回帰 probe は native Linux でも確認する。\n- npm tarball の import/Worker/型/wasm・notices・build-info の同梱確認は設計候補（推測・未検証）。ゲストと fixture は terrarium 側の ref 別配布という既存意図を維持する。"
    }
  ],
  "obligations": {
    "strategy": "standard",
    "strategy_volume": [
      "Five to eight tests per component.",
      "Unit tests plus integration tests for key boundaries.",
      "Add E2E, performance, or security tests when requirements demand them."
    ],
    "scope_floor": [
      "Keep the existing test suite green.",
      "This scope adds no extra new-test floor beyond the selected test strategy."
    ],
    "combination_rule": "Apply every selected-strategy obligation and every scope-floor obligation; neither replaces the other, and a targeted scope regression may add the narrowest necessary test type beyond the strategy default."
  },
  "plan_profile": {
    "methodology": "test-after",
    "runner_step": "Verify the existing test runner/configuration and record the exact unit-scoped command.",
    "runner_ready_before_first_test": true,
    "testable_layers": [
      "Data model / database behavior",
      "Repository / data access",
      "Business logic",
      "API / endpoint",
      "Frontend behavior"
    ],
    "steps": [
      "Project structure and production configuration skeleton.",
      "Verify the existing test runner/configuration and record the exact unit-scoped command.",
      "Data model / database behavior - implement.",
      "Data model / database behavior - write and run its tests after implementation.",
      "Repository / data access - implement.",
      "Repository / data access - write and run its tests after implementation.",
      "Business logic - implement.",
      "Business logic - write and run its tests after implementation.",
      "API / endpoint - implement.",
      "API / endpoint - write and run its tests after implementation.",
      "Frontend behavior - implement.",
      "Frontend behavior - write and run its tests after implementation.",
      "Environment/build configuration.",
      "Documentation and traceability."
    ]
  },
  "input_sha256": "sha256:dd7d634a9c475bfe0b7fdd87b1566bd3f238a9b0ead389ae268b08de9bf333f2",
  "contract_sha256": "sha256:ce013e1551c9c06de1a756c04942d606c8dffe82caf0ae8422f95df28968c638"
}
```
