# U5 fixed-guest-build 実装計画

## Summary

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

- [x] Step 1: 構成とrunnerの確認。開発に使う各toolが最新版かを確かめる（Bun、Node、TypeScript、Biome、mbx、ShellCheck、actionlint、使うActionのcheckout・cache/restore・cache/save・upload-artifact・download-artifact・create-github-app-token）。開始時の版と、古いものがあればその差分を報告する。biome 2405c762 と f79f85d5 の `rust-toolchain` を読み、指定の版のRustのimageのdigestを調べて記録する（U1の1.98.1は履歴として扱う）。標準のUbuntuのrunnerの最新のlabelを確かめる。`proposals/vivarium/u5/tools/fixed-guest-builder/` にpackage.json・tsconfig.json・bunfig.toml・bun.lockを作り、`tests/runner-ready.test.ts` を最初に実行して、bun testが動くことと、そのcommandを `unit-test-instructions.md` に記録する。（NFR2.2）
- [x] Step 2: 宣言とURLの検証を `src/declaration.ts` に実装する。許可一覧（設定file `allowlist.json`）、URLの正規化（`.git`・末尾の `/`・小文字）、userinfo・host・port・query・fragmentの拒否、40桁の小文字16進のcommit、branch名だけの宣言の拒否、`reference` を入力にしないこと。実装後に `tests/declaration.test.ts` を作って実行する。（NFR3.1、D1）
- [x] Step 3: sourceの取得と確認を `src/source.ts` に実装する。blobなしclone（repository自身のbranchとtagだけ）、commitがそのcloneにあることの確認、SHAで直接fetchしないこと、checkout、`.gitmodules` の拒否、sourcePatchesの適用。実装後に `tests/source.test.ts` を作って実行する。localのbare repositoryを2つ使い、別のrepositoryにだけあるcommitで始まらないことを確かめる。（NFR3.2、NFR3.4、D1）
- [x] Step 4: 取得元の検査とkeyを `src/lockfile.ts` と `src/key.ts` に実装する。`Cargo.lock` の必須、`source` の許可（crates.ioと許可一覧のgit依存）、`.cargo/config.toml` の置換と別のregistryの拒否、`[patch]` の許可一覧外の拒否、正規化したJSONのSHA256によるkey（D2の入力だけ。runnerの部品のSHA256は参考欄）。実装後に `tests/lockfile.test.ts` と `tests/key.test.ts` を作って実行する。入力を1つ変えるとkeyが変わること、runnerの部品を変えてもkeyが変わらないことを確かめる。（NFR3.4、NFR5.2、D2）
- [x] Step 5: 取得の監視と期限を `src/monitor.ts` と `src/deadline.ts` に実装する。directoryの大きさを一定の間隔で測り、上限を超えたらprocess groupを終了させる。期限切れ・取消のときはprocess groupの終了とstagingの除去を待つ。retryはしない。上限と間隔は注入できるようにする。実装後に `tests/monitor.test.ts` と `tests/deadline.test.ts` を作って実行する。小さい上限で、上限の値は受理し、+1で打ち切ることを確かめる。（NFR4.1、NFR4.2、D3、D4）
- [x] Step 6: containerでのbuildを `src/build.ts` と `container/build.sh` に実装する。imageをdigestでpullして照合、`rustc -vV`・`cargo -V` の記録、`rust-toolchain` との照合（反映事項1）、diskの空き20GiBの事前確認、`cargo fetch --locked` の監視、networkを切った `--offline --locked` のbuild、stagingでの作成と原子的な確定、mbxの `RUSTC_WRAPPER`。docker・mbxのcommandは注入できるようにする。実装後に `tests/build.test.ts` を作って実行する。偽のdockerで、digestの不一致・版の不一致・diskの不足・途中の失敗でstagingが残らないことを確かめる。（NFR4.1、NFR5.1、NFR5.4、D4、D5）
- [x] Step 7: 成果物の検証と再利用の取得を `src/artifact.ts` と `src/reuse.ts` に実装する。ELF 128MiB・build-info 1MiB・catalog 4MiBの上限（値は受理、+1は拒否）、重複keyの拒否、未知fieldの許容、C07とC03の必須identity。Releaseからの取得はC11（HTTPS、credentialなし、redirectは5回まで各hopを検査、streamの累積で制限、retryなし）。再利用のときは `compiled=false` と同じdigestを記録する。実装後に `tests/artifact.test.ts` と `tests/reuse.test.ts` を作って実行する。fetchを注入し、境界値と+1、redirectの不正、HTTPの失敗、digestの不一致を確かめる。（NFR3.3、NFR4.2、NFR5.2、FR7、FR8）
- [x] Step 8: Releaseへの書込みとbusyの確認を `src/release.ts` と `src/busy.ts` に実装する。C12の操作計画（`ExternalOperation`）の作成と照合、計画のSHA256と `inputDigests` とartifactの照合、draft → 取得し直してdigestを検証 → publish、途中で失敗したdraftの作り直し、公開済みなら検証だけ（反映事項2）、組の欠けや `buildKey` の不一致は「使えない」、ELFの違いは「再現しない」、公開済みのものを消さない・上書きしないこと。busyは同じworkflowの実行中・待機中のrunをAPIで確かめる。実装後に `tests/release.test.ts` と `tests/busy.test.ts` を作って実行する。偽のGitHub APIを使う。（NFR5.1、NFR5.3、NFR8.1、D6、C12）
- [x] Step 9: bump-upstreamを `src/bump.ts` に実装する。`git ls-remote` でbranchを直接解決し、D1の確認を通し、commit・時刻・branch名を記録して宣言を更新する。PRの情報は使わない。PRの作成はworkflowで `bot-pull-request` に任せる。実装後に `tests/bump.test.ts` を作って実行する。localのrepositoryで、解決の結果の記録と、PRの情報だけでは更新しないことを確かめる。（NFR3.5、FR8、D7）
- [x] Step 10: CLIの入口を `src/cli.ts` に実装する（build・release・bumpの3つのsubcommand。workflowから呼ぶ）。秘密を出さないこと、終了codeと原因の記録。実装後に `tests/cli.test.ts` を作って実行する。（NFR8.3、D9）
- [x] Step 11: workflowと設定。`proposals/vivarium/u5/.github/workflows/` に `fixed-guest-build.yml`・`fixed-guest-release.yml`・`fixed-guest-bump.yml` を作る。どれもmainでのworkflow_dispatchだけで、`github.ref` の確認、repositoryの確認（反映事項4）、Infrastructure Designの権限表、それぞれのconcurrency group（`cancel-in-progress: false`）、SHAで固定したAction、cacheの保存はmainのbuildだけ、`persist-credentials: false`、job timeout（4時間＋後片付け）を入れる。あわせて、mise.toml・dependabot.yml・Biome・ShellCheckへの追記と、`infra/github/main.tf` へのenvironmentの定義を、差分の案として作る。実装後に `tests/workflows.test.ts` を作って実行する（Bun.YAMLで読み、権限・起動条件・SHAの固定・concurrency・ifの条件を確かめる）。actionlintとShellCheckも実行する。（NFR8.1、NFR5.1、D5–D7）
- [x] Step 12: formicariumの照合の入口を `scripts/migration-guest-build/verify.ts` に作る。Releaseの3つ（または保存したfile）を取得し、digest・build-info・`buildKey`・C07のidentityを照合し、formicariumのNode版の公開APIで `--version` を実行して記録する。再利用の証拠（`compiled=false`、同じdigest）も照合する。実装後に `tests/migration-guest-build/verify.test.ts` を作って実行する。改変・欠落・別のkey・別のrepositoryの成果物を拒否することを確かめる。試験は `node --test --test-concurrency=1 tests/migration-guest-build/verify.test.js` で直接実行する（mise.tomlには宣言しない）。（FR9、NFR8.2、NFR2.1）
- [x] Step 13: 文書と追跡。packageの `README.md` に、使い方、許可一覧の変え方、上限、承認の流れ、切り戻しを書く。`proposals/vivarium/u5/HANDOFF.md` に、vivariumへ反映するfileの一覧とSHA256、vivariumで実行する検査のcommandを書く。生成したfileは内容を変えずにjjで追跡する。（NFR8.3）
- [x] Step 14: vivariumへの反映。vivariumのセッションへの依頼文を示す。vivariumのセッションは、forkのbranchにfileを反映し、`mise run lint:all`・型検査・試験を実行して結果を報告する。上流へのPRの作成は、実際の内容を示して別に承認を受ける。mainへのmerge、environmentの作成（`tofu apply` を含む）、Actionsの設定は、書込み権限のある人が行う。その後、environmentの承認の画面の表示を確かめる（反映事項3）。（NFR2.2、NFR8.1）
- [x] Step 15: vivariumのCIでの受入。起動の前に、実際の入力とActionsの分数・cacheの残りを示して承認を受ける。起動は書込み権限のある人が行う。順に、baseline（Biome 2405c762）のbuild → C12の計画を示して承認 → Releaseへの書込み → 同じkeyの再利用 → fix（JamBalaya56562/biome f79f85d5）で同じ流れ → mbxありとなしで同じELF digestになることの比較、を行う。各runの直後に、REST（run・jobs・artifacts・Release）とartifactのZIPのdigest・sizeを取得して保存する。sourceと依存の大きさ、時間、cacheの大きさを記録し、上限の半分を超えたら報告する。失敗したら基準を変えずに止め、修正案を示す。（FR7–FR9、NFR3.2、NFR4.1、NFR5.1–NFR5.4）
- [x] Step 16: formicariumでの照合。`scripts/migration-guest-build/verify.ts` で、2つのcommitの成果物の `--version` の成功・digest・build-info・再利用を照合する。U1のbaselineの試行のfile（forkのbranchにだけある）は、正式な経路があることを確かめたうえで、整理の案を示す。（FR9、NFR8.2）
- [x] Step 17: 独立した最終レビューを行う。その後、U5の成果物・CIの証拠・scriptのSHA256を固定した、読取専用の短い完了確認のcommandを作り、改変した証拠を拒否することを試験する。実際のcommandを示して承認を受け、承認後の正式な確認が成功したら通常の完了へ進む。code-summary.mdとtraceability.jsonはこのStepで仕上げる。（NFR8.2、FR9）

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
  "ordering": "通常の実装は各テスト可能な層の実装後にテストを作成・実行し、不具合修正は再現テストの失敗を観測して修正後に同じテストの成功を確認する。",
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
      "text": "- **Methodology**: test-after\n- **Ordering**: 通常の実装は各テスト可能な層の実装後にテストを作成・実行し、不具合修正は再現テストの失敗を観測して修正後に同じテストの成功を確認する。\n- ビルドとテストはmain sessionで逐次実行する。Node向けconsumer、Worker、process.execPath、Node専用flagの意味を確認し、Bunへ一括置換しない。Bun実行を採る箇所は実結果で互換性を確認する（未検証）。\n- 既存Biome・TypeScript・Playwright・node:testを証拠として使う。通常PR/main CIは固定候補入力を要求しない軽量経路から整備し、重いnative/ブラウザ回帰・配布coverageは別の明示経路へ対応づける（提案）。軽量CI成功だけで全受入れを通過したと扱わない。\n- 統合前CIと第一者配布JS固定一覧の行coverage80%以上を維持する。未収集ファイルを分母から消さず、Worker/別process/realmも記録し、欠落・skipを成功へ置換しない。\n- probe600秒、aubeブラウザ840秒、1worker、retryなし、probe8項目合格、native出力一致、wasm1GBを維持する。未変更aubeは再ビルドせず、計測時に重い処理を並行しない。新規コア回帰はnative Linuxでも確認する。実機Safariは未検証のまま区別する。"
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
  "input_sha256": "sha256:c174dde61b23d97d1733ad98b91568ee85c7de913db166d498965b6845a4c286",
  "contract_sha256": "sha256:10b6f50c2e853225a46984ab35ccfb615ca938fd59f89dd0c81174ba91834d14"
}
```
