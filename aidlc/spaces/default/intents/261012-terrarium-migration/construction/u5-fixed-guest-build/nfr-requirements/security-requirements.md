# 固定guest buildの品質・安全要件

## Sources

根拠は次のとおり。
- `../../../inception/requirements-analysis/requirements.md`（FR7–FR9、NFR1–NFR8）
- `../../../inception/units-generation/unit-of-work.md`（U5）と `unit-of-work-story-map.md`（U5が担うNFRは NFR2・NFR3・NFR4・NFR5・NFR8）
- `../../../inception/contract-design/contract-summary.md`（C07 固定buildとcatalog、C11 取得・時間・サイズの境界、C12 公開・退役操作）
- `aidlc/spaces/default/codekb/formicarium/technology-stack.md`（toolchainの版は、2026-10-17の更新後の値を使う）
- U1のbaselineの試行（`integration/vivarium/preflight/` の workflow・controller・build script と、CI run 38990951678 の証拠）
- 人間の回答（`nfr-requirements-questions.md` の Q1–Q6）

U5はpackagingのUnitで、機能設計の文書はない。以下はドキュメント根拠であり、U5の動作・性能は未検証。

## Requirements

| ID | 分類 | 合格条件 | 検証 |
|---|---|---|---|
| NFR2.1 | 品質 | 既存の品質の上限（probe≤600s・8項目、aube browser≤840s、worker1・retry0、native出力一致、wasm1GB、WorkerのwaitAsync削除）と、第一者配布JSの行coverage≥80%を維持する。U5の変更で、formicariumの配布JSや既存の試験を緩めない。未変更のaubeは再buildしない。 | formicariumの既存回帰、U5の変更範囲の点検 |
| NFR2.2 | 品質 | U5で書くbuilderのscriptと試験は、vivariumの既存の lint・型検査・試験の経路で検査し、skipや欠落を成功に置き換えない。builderのCIの合否（ELF・build-infoの検証）と、recipeのverdictの合否（recipeの試験）を分ける（FR8）。 | vivariumのCIのログ、builderにverdictを持たせないことの試験 |
| NFR3.1 | 入力 | recipe.guestsの宣言は、tool・repository・40桁のcommit・fixtureを必須とする。repositoryは、設定に固定した許可一覧（例：`biomejs/biome`、`JamBalaya56562/biome`、aubeとpitchforkのupstream）にあるものだけを受け付け、それ以外は拒否する（Q2=A）。PRやbranchは作成時にcommitへ解決する参考情報で、buildの入力にしない（FR7・C07）。 | 一覧にないrepository、40桁でないcommit、branch名だけの宣言の拒否試験 |
| NFR3.2 | 入力 | buildの前に、宣言した完全なcommitがremoteにあることを確かめる（FR9）。GitHubのfork networkでは、別のforkのcommitも同じrepositoryの名前で取得できてしまう。そのため、commitが宣言したrepository自身のbranchかtagから辿れることも確かめる。辿れないcommitではbuildを始めない。 | 存在しないcommit・短縮commit・別のforkだけにあるcommitでbuildが始まらないことの試験 |
| NFR3.5 | 入力 | bump-upstream（upstreamの新しいcommitへの更新）は、宣言したrepositoryのbranchを直接解決してcommitを得る（FR8）。PRの情報やGitHubの画面の値は使わない。解決したcommitと、その時刻・branch名を記録し、NFR3.2の確認を通してから宣言を更新する。 | branchの解決結果の記録、PR情報だけでは更新しないことの試験 |
| NFR3.3 | 境界 | build-infoとcatalogは、C07とC03の必須identity（source URL・commit・target・rustc・sourcePatches・build入力・builder hash）を検証する。未知の付加fieldは互換範囲で許容し、重複keyは拒否する。metadataは1MiB、catalogは4MiB、ELFは128MiBまで（C11）。上限の値は受理し、+1は拒否する。 | 境界値と+1、重複key、必須field欠落の試験 |
| NFR3.4 | 所有 | sourcePatchesは、repoの中のfileとして固定する。build-infoにはpatchのfile名とSHA256を記録する。patchが変われば別のkeyにする（Q5=A）。 | patchの変更でkeyが変わること、記録したSHA256と実fileの照合 |
| NFR4.1 | 時間 | build全体（依存の取得を含む）の期限は4時間（C11 buildDeadlineMs 14400000）。期限切れ・取消のときは、process groupの終了とstagingの除去を待ってから終える。原因を記録し、自動retryや別のURLへのfallbackはしない。 | 期限・取消の試験（短い期限での模擬と、CIのtimeout設定） |
| NFR4.2 | 取得 | Releaseから成果物を取得するとき（再利用）は、C11の配布物の上限（ELF 128MiB、metadata 1MiB、catalog 4MiB）と取得の規則（HTTPS、credentialなし、redirectの検査、Content-Lengthを信用せずstreamの累積で制限）に従う。upstreamのsourceとRustの依存の取得は、C11のinstall用の上限（DL 128MiB、展開256MiB）をそのまま当てない。U1のbaselineで実際の大きさを測り、その値をもとにした有限の上限をNFR Designで決める（未検証）。どの取得も、4時間のbuildの期限の中で終わる。 | Releaseからの取得の境界値と+1、不正なURL・HTTP失敗の拒否試験。sourceと依存の上限はNFR Designで試験を定める |
| NFR5.1 | 排他 | 同じkeyのbuildと保存は直列化する（同じkeyに書くのは1つだけ）。直列化は、1回のCIの中だけでなく、複数のCIの実行にまたがって効かせる（例：workflowのconcurrencyをkeyで分け、実行中の処理を取り消さない）。Releaseに同じkeyの成果物が既にあれば、上書きせずに検証だけを行う。stagingで作り、ELFとbuild-infoの両方のdigestを検証してから、不変の成果物へ原子的に確定する。途中で終わったstagingは成果物として扱わない（C07）。 | 同じkeyの同時実行、途中終了、古い応答で受入済みの成果物が壊れないことの試験 |
| NFR5.2 | 再利用 | keyは、ELFを決める入力をすべて含める。tool・repository・commit、依存の固定（`Cargo.lock` のSHA256と `--locked` での取得）、target、解決したrustcの版（`rustc -vV` の結果）、buildのcommand・flag・feature、sourcePatchesのSHA256、builder hash（builderのtoolの版とcontainer imageのdigest）である。同じkeyの2回目は、ELFを再利用してcompileを省略し、同じdigestと `compiled=false` を記録する（FR7）。再利用のたびに、両方のfileとsource・key・digestを確かめ、不一致は拒否し、前の良品を上書きしない。再利用で使うのは、検証を通ったbytesのcopyだけにする。入力が1つでも変われば別のkeyにする。 | 同じkeyの2回目のcompile省略と同digest、key変更、欠損・不一致の拒否試験 |
| NFR5.3 | 保存 | 成果物（ELF・build-info・catalog）は、vivariumのGitHub Releaseに、keyごとに一組として保存する。これを正本とする（Q4=A）。latestの名前で上書きせず、keyで参照する。 | Releaseの成果物の一覧とdigestの照合、上書きがないことの確認 |
| NFR5.4 | 高速化 | Rustのcompileの中間結果のcacheとして、mr-boxington（`mbx`）の使用を検討する（Q4への人間の追記）。cacheは高速化のためだけに使い、ELFの正しさの根拠にしない。成果物の受入は、常にELF・build-infoのdigestとsource・keyの検証で行う。採用する場合は、mbxの版をbuilder hashに含める。cacheの汚染を防ぐため、cacheへの書込みは信頼したbranchのbuildだけに許し、PRのbuildは読むだけにする。cacheのkeyにはbuilder hashを含める。採否と、CIでのcacheの保存方法（GitHub Actionsのcacheなど）は、NFR Designで決める（未検証）。 | 採用する場合：mbxありとなしで同じELF digestになること、cacheが壊れていてもbuildの結果が変わらないことの試験 |
| NFR8.1 | 権限 | builderはvivariumのGitHub Actionsで動かす。buildのjobは `contents: read` だけにする。Releaseへの書込みは別のjobに分け、人間が具体的な対象（版・key・file）を承認したときだけ `contents: write` で動かす（Q1=A、C12）。未信頼のPRからは書き込まない。 | workflowの権限の点検、未信頼PRで書込みのjobが動かないことの確認 |
| NFR8.2 | 証拠 | 固定build-infoに source URL・commit・target・rustc・sourcePatches・build入力を記録し、pitchfork UIのaubeも固定する（FR8）。U1のbaselineの試行を正式な経路へ引き継ぎ、builderを二重に残さない。U1のbaseline（Biome 2405c762）とfix（JamBalaya56562/biome f79f85d5）の両方で、formicariumでの `--version` の成功と再利用を記録する（FR9）。 | 2つのcommitの成果物と証拠、二重のbuilderが残っていないことの確認 |
| NFR8.3 | 運用 | 秘密やtokenをログ・build-info・catalogに出さない。license・noticesを保持する。新規費用は事前に相談する。変更はPR単位で切り戻せるようにする。 | ログとmetadataの点検、切戻し手順の文書 |

## Threats and Boundaries

builderが扱う主な脅威は、次の3つである。
- 改変されたsource：許可していないrepositoryや、存在しないcommitから作ること。
- 改変された成果物：cacheやReleaseにある、ELFとmetadataが合わない組を受け入れること。
- 過大な権限：buildの途中で、Releaseへの書込み権限を使えること。

対策として、repositoryの許可一覧とcommitのremote照合を入口に置く。成果物は、毎回digestで検証してから使う。書込み権限は、承認後の別のjobだけに持たせる。builderは、recipeの内容やverdictを読まない（C07）。cache（Releaseの再利用、mbxの中間結果）は、検証を通った場合だけ使い、正しさの根拠にしない。

## Applicability

U5はpackagingのUnitなので、性能・拡張性・信頼性・観測性の文書は作らない（stageのproduces_kinds）。性能の目標（NFR1）はinstall経路のもので、U5の対象外とする。build時間の期限（4時間）と再利用は、NFR4.1・NFR5.2で扱う。NFR6・NFR7はブラウザとUIの要件で、U5の対象外とする。

## Assumptions & Open Questions

- vivariumの既存のtooling（BunとTypeScriptの構成、lint・型検査・試験の経路）は、まだ確かめていない（Q6=B）。NFR DesignかCode Generationの前に、vivariumのセッションで確かめてもらう。TypeScriptがそのまま使えない所は、mjsを使ってよい（人間の追記）。
- mr-boxington（mbx）の採否と、CIでのcacheの保存方法は、NFR Designで決める。
