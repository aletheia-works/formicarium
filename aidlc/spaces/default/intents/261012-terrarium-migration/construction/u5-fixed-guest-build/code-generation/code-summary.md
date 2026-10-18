# U5 fixed-guest-build Code Summary

## 再開：新しい土台（formicariumのupstream main `2a79860`）への合わせ（2026-10-18、Steps 18–21）

review-03のR-10〜R-14と、残っていたR-08を、記録の更新だけで直した。U5のcode（formicariumの `scripts/migration-guest-build/*.ts`・`tests/migration-guest-build/verify.test.ts`・task 2件、上流vivariumのbuilderとworkflow）は変えていない。lint・typecheck・build・test:light・`mise run migration-guest-build-unit`・保存済みのRelease 2組の照合（Step 22）と、レビュー・checkpoint（Step 23）はmain sessionが行う。**この節の作成時点では、新しい土台でのU5の試験と照合はどれも未実行（未検証）である。**

**この節より下（Status、実装したもの、上流への反映、検証の結果、最終レビューへの対応、計画からずれた所、未完・未検証）は、古い土台・案の置き場所での履歴である。** そこに出てくる `proposals/vivarium/u5/`（formicariumの中の案）、`bun test --cwd proposals/...`、`verify-final-u5.mjs` と135件のbinding、`node --test tests/migration-guest-build/verify.test.js` の直接実行は、古い土台のもので、新しい土台の成功証拠へ付け替えない。

### 証拠の分け方（R-10、計画の「証拠の分け方」どおり）

U5は次の2つに分かれる。

**(1) 上流vivariumの本体**（aletheia-works/vivarium、main のmerge `71e0ef9202227626656047746d224278e1e51d5f`、PR #531・#533〜#536）
- 場所：`tools/fixed-guest-builder/`（README・allowlist.json・biome.json・bun.lock・bunfig.toml・package.json・tools.json・tsconfig.json、`container/build.sh`、`src/` 18件、`tests/` 21件（試験17件とfixtures 1件・helpers 3件））と、workflow 4つ（`.github/workflows/fixed-guest-build.yml`・`fixed-guest-release.yml`・`fixed-guest-bump.yml`・`test-fixed-guest-builder.yml`）。計52件のfile。
  - 根拠（検証済み、保存済みの記録の読取り）：`.artifacts/migration-guest-build/upstream-tree-71e0ef92.json` は `sha` が `71e0ef92…`、`truncated: false` で、`fixed-guest` を含むentryが58件（directory 6件を除くとfile 52件）。`upstream-commit-71e0ef92.json` のmessageは「fix(tools): record the mbx cache restore before the build and harden inputs (#536)」。`upstream-compare-f1bf9058-71e0ef92.json` は `ahead 1` で、変わったfileは workflow 1件と `src/cli.ts`・`lockfile.ts`・`pipeline.ts`・`process.ts`・`source.ts`、tests 6件（`fake-docker.sh` を含む）。build keyを決める `container/build.sh`・`tools.json`・`src/key.ts` は含まれない。
- CIのrun（上流のActions）：39073445357（baseline、mbxあり）、39076793651（baselineの再利用）、39077142098（fix、mbxあり）、39079897400（fixの再利用）、39080082205（baseline、mbxなし）と、Release 2組のrun 39076401324・39079705708。保存済みの記録は `.artifacts/migration-guest-build/run-*`・`release-*`。
- builderの試験（`bun test`、158件成功・行coverage 98.43%）・actionlint・ShellCheckは、上流のcheckout（`proposals/vivarium/u5/` にあった案と同じ内容。review-02が今回再実行として観測）で行ったもので、formicariumでは再実行しない。新しい土台のformicariumには、そのsourceは無い（`git ls-files proposals` は0件。`proposals/vivarium/u5/` は追跡されておらず、review-03の `find proposals` ではnode_modulesの空の殻だけ）。上流のfileの中身は、今回は読み直していない（保存済みの記録と既存のreview-01〜03による）。

**(2) formicarium側の確認**（formicariumのmain、PR #31 `880cfd4` で追加）
- `scripts/migration-guest-build/verify.ts`・`assets.ts`、`tests/migration-guest-build/verify.test.ts`、`mise-tasks/migration/guest-build-unit.sh`（alias `migration-guest-build-unit`、`bun run migration:guest-build:unit` を呼ぶ）・`guest-build-verify.sh`（alias `migration-guest-build-verify`、`bun run migration:guest-build:verify` を呼ぶ）、package.json 104–105行の2行。
- 根拠（検証済み）：上の6件は `git ls-files --error-unmatch` で追跡対象（exit 0）。`git log` の最後の変更はどれも `880cfd4`。生成JS（`verify.js` など）は追跡されず、`mise run build` が作る。
- 新しい土台では、intentの検証コマンド（`mise run typecheck && mise run build && mise run test:light && mise run migration-preflight-unit && mise run migration-preflight-current-unit && mise run migration-guest-build-unit && mise run showcase-unit`）と、Step 22の照合（保存済みのRelease 2組に対する `mise run migration-guest-build-verify`）を、U5のformicarium側の証拠とする。どちらもこの節の作成時点では未実行。

### 完了確認の記録（R-11、R-08）

- 古い土台の完了確認のcommand（`.artifacts/migration-guest-build/verify-final-u5.mjs` と、135件をSHA256で固定した `final-u5-binding-71e0ef92.json`）は、**古い土台での完了確認の履歴**とする。新しい土台では使わない。review-03によれば、この script は `proposals/vivarium/u5` の52件を期待するので、`proposals/` が空の今は成功しないと推測される（実行していない、未検証）。
- `.artifacts/` は追跡されていない（検証済み：`git check-ignore -v` で `.gitignore` 114行 `.artifacts/` に一致、`git ls-files .artifacts` は0件）。したがって `.artifacts/migration-guest-build/` の保存済みの記録（upstream-*.json、run-*、release-*、*-reuse-evidence.json、binding）は、この手元にだけある証拠である。cloneし直すと無くなる。
- R-08の古い数値を、下の履歴の節でも揃えた：builderの試験は158件・行98.43%（#536の修正後。修正前の観測は146件・98.36%）、bindingは135件・案は52件（#536より前のbindingは131件・51件）、Majorの修正は「#536で71e0ef92にmerge済み」。

### `source-manifest.json`（R-12）：4件 → 6件

- 外した1件：`biome.json`。U5の変更（`!!proposals/vivarium/u5` の1行）は今の `biome.json` に無い（`grep proposals biome.json` は一致なし）。PR #31での `biome.json` の差分は、showcaseの `overrides`（`noRestrictedImports` など。U7のもの）で、U5の内容ではない（`git show 880cfd4 -- biome.json` を読んで確認）。
- 加えた3件：`mise-tasks/migration/guest-build-unit.sh`・`guest-build-verify.sh`（検証コマンドの `mise run migration-guest-build-unit` が実際に動かす）と `package.json`。
- 残した3件：`scripts/migration-guest-build/assets.ts`・`verify.ts`、`tests/migration-guest-build/verify.test.ts`。
- 6件すべてが追跡対象であることを `git ls-files --error-unmatch` で確かめた（exit 0）。
- `package.json` は共有fileである。U5の内容は104–105行の `migration:guest-build:unit`（`node --test --test-concurrency=1 tests/migration-guest-build/verify.test.js`）と `migration:guest-build:verify`（`node scripts/migration-guest-build/verify.js`）の2行だけである。PR #31の同じ差分にある `showcase:*` の行はU7のもので、U5はclaimしない。

### 残余リスク（R-13・R-14、codeは変えない。直すかどうかは別に決める）

- R-13：`assets.ts` の `nodeAssets`（8–30行）は、`tests/package/fixtures.ts` の `developmentAssets`（151行）と同じ処理の複製である。`nodeAssets` を呼ぶのは `verify.ts` の `main()`（239–240行）だけで、試験は `developmentAssets` を使うので、`nodeAssets` と `main()` の引数処理は試験を通らない。`mkdtemp`（21行）で作る一時directoryは、どこでも消されない。Step 22の `mise run migration-guest-build-verify` がこの経路を実際に1回通る（未実行）。
- R-14：`checkSet`（`verify.ts` 71行〜）は、build-infoの `dependencies` を確かめずに `guestBuildKey(info)`（104行。`runtime/guest-validation.ts` 218行で `[...info.dependencies]`）を呼ぶ。そのため、`buildKey`・`tool`・`source` が期待と一致し、正規化したJSONで、`dependencies` が無い（または配列でない）build-infoは、`INVALID_INPUT` の拒否でなく `TypeError` で止まる。止まること自体は変わらず、成果物を受け入れることはない。コードを読んだ限りの判断で、実行はしていない。review-03の例の `{}` は、97行の `buildKey` の照合で先に `INVALID_INPUT` になると読める（推測、未実行）。
- R-14の後半：`verify.test.ts` は `dist/guests/`（aube・hello・exit3・probe）と `dist/blink/` を読む。これらは生成物で追跡されない。検証コマンドは `mise run build` を先に実行するので、通常は満たされる。`unit-test-instructions.md` には書いていない（承認を外さないため、変えない）。

### 持ち越す上流の残余リスク

R-03（`prevent_self_review=false`・`can_admins_bypass` の既定値。1人運用で、run nameの計画のSHA256の目視照合が統制）、R-05（`docker run` の `--cap-drop ALL`・`no-new-privileges` が無い）、R-06（bumpのauto-mergeが短い間有効。本物のbumpのrunは未実行）、R-07（上流のActionsのcacheが10.21GBで既定の上限10GBを超える）、R-09（`process.ts` の `WITHHELD` は名前の一致による除外で、`*_KEY`・`SSH_AUTH_SOCK` などは外れない）は、上流のfileの指摘で、formicariumからは直せない。上流の残余リスクとして持ち越す。R-01・R-02・R-04は、review-02・03で上流 `71e0ef92` の内容により解決済みとされた。

### Step 22：新しい土台でのformicarium側の確認（2026-10-18、main sessionが1つずつ実行、検証済み）
- `mise run lint:all` exit 0、`mise run typecheck` exit 0、`mise run build` exit 0。
- `mise run test:light` exit 0：bun 71件・37件pass、node 125件中123pass・fail 0・skip 2（既存）、tooling 130件pass。
- `mise run migration-guest-build-unit` exit 0：9件pass、fail・cancel・skip・TODO 0。
- 保存済みのRelease 2組への照合（`mise run migration-guest-build-verify`。`--binary` は `--set` からの相対名）：
  - baseline：`--set .artifacts/migration-guest-build/release-39076401324/downloaded --binary biome --tool biome --key 15432368…6321 --repository https://github.com/biomejs/biome --commit 2405c762…37fb --first-receipt run-39073445357/extracted/receipt.json --reuse-receipt run-39076793651/extracted/receipt.json`。exit 0。出力 `baseline-reuse-evidence-20261018.json` は保存済みの `baseline-reuse-evidence.json` とbyte単位で一致した（`cmp`）。
  - fix：`--set release-39079705708/downloaded --binary biome --tool biome --key 4751f68d…d24d --repository https://github.com/jambalaya56562/biome --commit f79f85d5…b206 --first-receipt run-39077142098/extracted/receipt.json --reuse-receipt run-39079897400/extracted/receipt.json`。exit 0。出力 `fix-reuse-evidence-20261018.json` は保存済みの `fix-reuse-evidence.json` とbyte単位で一致した。
  - どちらも、formicariumのNode版の公開APIで `--version` がexit 0（`Version: 0.0.0`）、ELF・build-info・catalogのdigest、`buildKey`、再利用（`compiled=false`・同じdigest）の照合が通った。Releaseの再取得・CI・上流への書込みはしていない。
- 入力は手元の `.artifacts/`（追跡されない）にある保存済みのfileで、cloneし直すと無くなる（残余リスク）。

---

以下は古い土台・案の置き場所での記録の履歴である。

## Status

Step 1–17は完了した。最終レビュー（review-01）はREADYで、Majorと、Minorのうち3件は、上流のPR（aletheia-works/vivarium#536、merge 71e0ef92）で直した。完了確認のcommandは人間の承認を受けて、当時のintentの検証commandに設定し、正式に実行して成功した（exit 0、135件）。このcommandは新しい土台では使わない（上の「完了確認の記録」）。

```
/Users/mutoakio/.local/share/mise/installs/node/26.12.0/bin/node .artifacts/migration-guest-build/verify-final-u5.mjs .artifacts/migration-guest-build/final-u5-binding-71e0ef92.json 6a5ac9ee2b23575b7a2294017fe0c4b5f70be391b65b64b199ecc548ad078ef3
```

このcommandは、CIのrunが使ったmain（f1bf9058）と今のmain（71e0ef92）の間で、build keyを決めるfile（`container/build.sh`・`tools.json`・`src/key.ts`）が変わっていないことと、上流のmainが案の52件と一致することも確かめた。

## 実装したもの

vivariumの固定guestのbuilderを、新しいpackage `tools/fixed-guest-builder/`（Bun・TypeScript）と、workflow 4つとして作った。当時はformicariumの `proposals/vivarium/u5/` に同じpathの形で置き（案の置き場所での履歴。今のformicariumには無い）、上流の aletheia-works/vivarium へ PR で反映した。以下のpathは、上流の `71e0ef92` の `tools/fixed-guest-builder/` からの相対pathである。

- 宣言の検証（`src/declaration.ts`）：許可一覧、URLの正規化（`.git`・末尾の `/`・小文字、`:443` などの既定のportも拒否）、40桁のcommit、`reference` を入力にしない。依存として取得してよいrepositoryの一覧（`dependencyRepositories`）を、guestを宣言できる一覧と分けた。
- sourceの取得と確認（`src/source.ts`）：blobなしclone、`GIT_NO_LAZY_FETCH=1` でのcommitの存在と、repository自身のbranch・tagからの到達の確認。SHAでの直接fetchはしない。submoduleを拒否する。sourcePatchesはSHA256を確かめてから当てる。
- 取得元の検査とkey（`src/lockfile.ts`、`src/key.ts`）：`Cargo.lock` の必須、取得元の許可、registryの置換の拒否。keyは、formicarium（C03）が再計算する式に合わせ、ほかの入力はbuilderHashとdependenciesを通して入れる。U1のbaselineの `buildKey`（3c4d9fd1…）を再現する試験がある。
- 取得の監視と期限（`src/monitor.ts`、`src/deadline.ts`、`src/process.ts`）：process groupで動かし、上限を超えたら止める。4時間の期限で、後片付けの失敗が元の原因を隠さない。
- containerでのbuild（`src/build.ts`、`container/build.sh`）：digestで固定したimageの照合、`rust-toolchain` との版の照合、diskの空き20GiBの事前確認、networkを切ったofflineのbuild、`RUSTUP_TOOLCHAIN` と `CARGO_TARGET_DIR` の固定、fileの持ち主の復元、消せない場合のcontainerを通した削除、失敗時のbuildの出力の末尾の表示。
- 成果物の検証と再利用（`src/artifact.ts`、`src/http.ts`、`src/reuse.ts`）：重複keyの拒否、上限の境界、正規化したJSONのbuild-info、C11の取得規則、公開済みのReleaseだけを再利用とみなす。
- Releaseへの書込み（`src/release.ts`、`src/github.ts`、`src/busy.ts`）：C12の操作計画とそのSHA256の照合、draft → 取得し直して検証 → publish、公開済みなら検証だけ、再現しないELFの拒否、必須の承認者のいないenvironmentでの書込みの拒否、busyの確認。
- bump-upstream（`src/bump.ts`）：`git ls-remote` でbranchを直接解決し、PRの情報だけでは更新しない。
- CLI（`src/cli.ts`）と workflow（`fixed-guest-build.yml`・`fixed-guest-release.yml`・`fixed-guest-bump.yml`・`test-fixed-guest-builder.yml`）。
- formicariumの照合の入口（formicariumの `scripts/migration-guest-build/verify.ts`、`assets.ts`）：成果物を独立に検証し、formicariumのNodeの公開APIで `--version` を実行する。再利用のreceiptも照合する。

## 上流への反映（すべて人間の承認による）

| PR | 内容 | merge |
|---|---|---|
| aletheia-works/vivarium#531 | builder・workflow・既存の経路への追記 | 90dd87e3 |
| aletheia-works/vivarium#533 | 承認者（JamBalaya56562、ID 88115388）をTerraformに渡す | f23e532a |
| aletheia-works/vivarium#534 | 1回目のbuildの失敗の修正（`RUSTUP_TOOLCHAIN`・後片付け・fileの持ち主） | bad23e67 |
| aletheia-works/vivarium#535 | 2回目のbuildの失敗の修正（`CARGO_TARGET_DIR`・診断） | f1bf9058 |
| aletheia-works/vivarium#536 | 最終レビューのMajor（mbxのcacheの記録）とMinor 3件 | 71e0ef92 |

Terraform Applyで、`fixed-guest-release` のenvironment（必須の承認者JamBalaya56562、mainだけ）ができた。fixのcommit `f79f85d5` は JamBalaya56562/biome のどのrefからも辿れなかったため、人間の承認で tag `vivarium/biome-12265-fix` を作った。

## 検証の結果

formicariumの観測（Bun 1.4.3、Node 26.12.0、TypeScript 7.0.2、Biome 2.5.15、古い土台）：

- builderの `bun test --coverage`：exit 0、158件すべて成功、行coverage 98.43%（#536の修正後の観測、review-02。修正前は146件・98.36%）、関数coverageはfileごとに91.67%以上。
- formicariumの照合の試験（`node --test tests/migration-guest-build/verify.test.js`）：9件すべて成功。
- formicariumの `test:light`：失敗0（194件中2件skipは既存のskipの指定、237件すべて成功）。型検査2つも成功。
- 上流のPRのCIの必須checkは、どれも成功してからmergeした（vivariumのセッションの報告とAPIで確認）。

vivariumのCI（上流main f1bf9058、Node 26.12.0、Bun 1.4.3）：

| run | 内容 | 結果 |
|---|---|---|
| 39043868354 | baselineの1回目 | 失敗（`RUSTUP_TOOLCHAIN` の未指定。原因は後片付けのEACCESに隠れた） |
| 39045653488 | baselineの2回目 | 失敗（mbxがtargetを `/mbx` に移した） |
| 39073445357 | baseline、mbxあり | 成功。key 15432368…、ELF 3d7e7e8c…（114,647,744 bytes）、compile 約36.5分 |
| 39076401324 | baselineのRelease（plan f90a3890…） | 成功。JamBalaya56562が承認 |
| 39076793651 | baselineの再利用 | 成功。`compiled=false`、同じdigest、43秒 |
| 39077142098 | fix、mbxあり | 成功。key 4751f68d…、ELF 882228d7…、compile 約35.5分 |
| 39079705708 | fixのRelease（plan 9a6e9ee8…） | 成功。JamBalaya56562が承認 |
| 39079897400 | fixの再利用 | 成功。`compiled=false`、同じdigest、54秒 |
| 39080082205 | baseline、mbxなし | 成功。key 2a28e252…、ELFはmbxありと同じ 3d7e7e8c… |

- 公開したReleaseは `guest-biome-15432368…` と `guest-biome-4751f68d…`。tokenなしで取得した3つのfileのSHA256は、承認した計画の `inputDigests` と一致した。repositoryのlatestは `v0.4.0` のまま。
- formicariumで、2つのguestの `--version` は exit 0（`Version: 0.0.0`）。
- sourceと依存の大きさ：source 約235–237MB（上限2GiBの約11%）、依存 約611MB（上限4GiBの約14%）。上限の半分を超えたものはない。
- mbxのcacheは280,390,161 bytesで1つ保存された（keyはbuilderごとに1つ）。上流のActionsのcacheは10.21GBで、既定の上限10GBを少し超えている。

完了確認の入口（`.artifacts/migration-guest-build/verify-final-u5.mjs`、古い土台の履歴）：135件のfileをSHA256で固定したbinding（`final-u5-binding-71e0ef92.json`。#536より前の版は131件）に対して、上の9つのrunのREST・artifactのZIP・Release・承認の記録・formicariumの証拠と、上流mainのtreeと案の52件（#536より前は51件）の一致を、読取だけで確かめる。改変を拒否する試験（`verify-final-u5.test.mjs`）は12件すべて成功した。

## 最終レビュー（review-01、READY、Major 1・Minor 6）への対応

- Major（人間の指示で直した）：build-infoの `reference.mbxCacheRestored` は、compileの後に `/mbx` の中身を数えていたため、mbxありでは必ず `true` になっていた。cacheのkeyも記録していなかった。
  - 修正：作業の最初（どのcontainerも動く前）に数えるようにし、workflowが求めたkeyと一致したkey（`reference.mbxCacheKeys`）を記録する。PR #536で上流の71e0ef92にmerge済み。build.shとtools.jsonは変えないので、build keyとmbxのcacheのkeyは変わらない。
  - **公開済みの2つのbuild-infoの `mbxCacheRestored` は信用できない。** baseline（`guest-biome-15432368…`、run 39073445357）は、cacheの復元が「not found」だったのに `true` と記録されている。fix（`guest-biome-4751f68d…`、run 39077142098）は、exact hitで `true` は偶然合っているが、数え方は誤っていた。どちらにも `mbxCacheKeys` は無い。公開済みのReleaseは変えない（C12）。実際の復元の結果は、各runのlogの「Restore the mbx cache」の行で確かめる。
  - この値はkeyにもELFにも入らない参考欄で、ELFの正しさ（digestとsource・keyの照合、mbxありとなしで同じELF）には影響しない。
- Minorは、人間の判断（「まとめて直してください」）で、次の3件を同じvivariumのPR（#536、71e0ef92にmerge済み）で直した。
  - 壊れたmbxのcacheの試験：壊れたcacheでbuildが失敗したとき、artifactが残らず作業directoryも消えることを試験で確かめる。本物のmbxの動きは、CIでは確かめていない。
  - 依存のgit（react/react）のcommitの到達：commitだけのbareのclone（`--filter=tree:0`）で、そのrepository自身のbranch・tagから辿れることを、依存の取得の前に確かめる。本物のreact/reactでは3秒・18MBで、Biomeが固定する `78c2d377` は辿れた。
  - tokenを子processに渡さない：git・docker・containerに渡す環境変数から、`ACTIONS_*`・`GITHUB_TOKEN`・`*_TOKEN` などを外す。
- 次のMinorは持ち越す（上の「持ち越す上流の残余リスク」）。
  - `prevent_self_review=false` と `can_admins_bypass` の既定値：承認者が1人なので、変えるなら2人目の承認者を置くかどうかを人間が決める。
  - bumpのauto-mergeが短い間だけ有効になる：vivariumの共有のActionの動きで、本物のbumpはrecipeにguestを宣言するU6の後でないと試せない。
  - 上流のActionsのcacheが10GBを超えている：repository全体の使い方の話で、NFR8.3により相談する。
  - `docker run` の権限を絞ること（`--cap-drop` など）：buildを壊すおそれがあり、本物のbuildで確かめる必要があるため、別のPRにする。

## 計画からずれた所（承認済みの追記に記録）

- formicariumの `mise.toml`・`tsconfig.json` への変更は、U1–U4のreviewの証拠を外したため元に戻し、案の置き場所を `proposals/vivarium/u5/` に移した（人間の回答A）。新しい土台では、この置き場所と `biome.json` の1行はどちらも無い。
- 実装の途中で分かったこと（keyの式、正規化したbuild-info、依存のrepositoryの一覧、auto-mergeの解除、承認者のいないenvironmentの拒否、cacheのkey、run nameの計画のSHA256、PRの試験のworkflow、コメントの規則、関数coverageの既定の閾値）は、計画の2026-10-17の追記に記録した。

## 未完・未検証

- 成功したときはbuildの出力をCIのlogに出さないため、mbxのcacheの当たり外れの数が分からない（Minor）。Biomeでは、mbxによる時間の短縮は3分ほどだった。
- `can_admins_bypass` は provider の既定値の `true` のまま（人間の判断待ち、任意）。
- Safari実機、本物のbump-upstreamのrun、`fixed-guest-bump` のPRの作成は、まだ動かしていない。
