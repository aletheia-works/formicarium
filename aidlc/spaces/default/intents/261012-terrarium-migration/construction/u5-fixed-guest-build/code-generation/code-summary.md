# U5 fixed-guest-build Code Summary

## Status

Step 1–17は完了した。最終レビュー（review-01）はREADYで、Majorと、Minorのうち3件は、上流のPR（aletheia-works/vivarium#536、merge 71e0ef92）で直した。完了確認のcommandは人間の承認を受けて、intentの検証commandに設定し、正式に実行して成功した（exit 0、135件）。

```
/Users/mutoakio/.local/share/mise/installs/node/26.12.0/bin/node .artifacts/migration-guest-build/verify-final-u5.mjs .artifacts/migration-guest-build/final-u5-binding-71e0ef92.json 6a5ac9ee2b23575b7a2294017fe0c4b5f70be391b65b64b199ecc548ad078ef3
```

このcommandは、CIのrunが使ったmain（f1bf9058）と今のmain（71e0ef92）の間で、build keyを決めるfile（`container/build.sh`・`tools.json`・`src/key.ts`）が変わっていないことと、今のmainが案の52件と一致することも確かめる。

## 実装したもの

vivariumの固定guestのbuilderを、新しいpackage `tools/fixed-guest-builder/`（Bun・TypeScript）と、workflow 4つとして作った。formicariumでは `proposals/vivarium/u5/` に同じpathの形で置き、上流の aletheia-works/vivarium へ PR で反映した。

- 宣言の検証（`src/declaration.ts`）：許可一覧、URLの正規化（`.git`・末尾の `/`・小文字、`:443` などの既定のportも拒否）、40桁のcommit、`reference` を入力にしない。依存として取得してよいrepositoryの一覧（`dependencyRepositories`）を、guestを宣言できる一覧と分けた。
- sourceの取得と確認（`src/source.ts`）：blobなしclone、`GIT_NO_LAZY_FETCH=1` でのcommitの存在と、repository自身のbranch・tagからの到達の確認。SHAでの直接fetchはしない。submoduleを拒否する。sourcePatchesはSHA256を確かめてから当てる。
- 取得元の検査とkey（`src/lockfile.ts`、`src/key.ts`）：`Cargo.lock` の必須、取得元の許可、registryの置換の拒否。keyは、formicarium（C03）が再計算する式に合わせ、ほかの入力はbuilderHashとdependenciesを通して入れる。U1のbaselineの `buildKey`（3c4d9fd1…）を再現する試験がある。
- 取得の監視と期限（`src/monitor.ts`、`src/deadline.ts`、`src/process.ts`）：process groupで動かし、上限を超えたら止める。4時間の期限で、後片付けの失敗が元の原因を隠さない。
- containerでのbuild（`src/build.ts`、`container/build.sh`）：digestで固定したimageの照合、`rust-toolchain` との版の照合、diskの空き20GiBの事前確認、networkを切ったofflineのbuild、`RUSTUP_TOOLCHAIN` と `CARGO_TARGET_DIR` の固定、fileの持ち主の復元、消せない場合のcontainerを通した削除、失敗時のbuildの出力の末尾の表示。
- 成果物の検証と再利用（`src/artifact.ts`、`src/http.ts`、`src/reuse.ts`）：重複keyの拒否、上限の境界、正規化したJSONのbuild-info、C11の取得規則、公開済みのReleaseだけを再利用とみなす。
- Releaseへの書込み（`src/release.ts`、`src/github.ts`、`src/busy.ts`）：C12の操作計画とそのSHA256の照合、draft → 取得し直して検証 → publish、公開済みなら検証だけ、再現しないELFの拒否、必須の承認者のいないenvironmentでの書込みの拒否、busyの確認。
- bump-upstream（`src/bump.ts`）：`git ls-remote` でbranchを直接解決し、PRの情報だけでは更新しない。
- CLI（`src/cli.ts`）と workflow（`fixed-guest-build.yml`・`fixed-guest-release.yml`・`fixed-guest-bump.yml`・`test-fixed-guest-builder.yml`）。
- formicariumの照合の入口（`scripts/migration-guest-build/verify.ts`、`assets.ts`）：成果物を独立に検証し、formicariumのNodeの公開APIで `--version` を実行する。再利用のreceiptも照合する。

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

formicariumの観測（Bun 1.4.3、Node 26.12.0、TypeScript 7.0.2、Biome 2.5.15）：

- builderの `bun test --coverage`：exit 0、146件すべて成功、行coverage 98.36%、関数coverageはfileごとに91.67%以上。
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

完了確認の入口（`.artifacts/migration-guest-build/verify-final-u5.mjs`）：131件のfileをSHA256で固定したbindingに対して、上の9つのrunのREST・artifactのZIP・Release・承認の記録・formicariumの証拠と、上流mainのtreeと案の51件の一致を、読取だけで確かめる。改変を拒否する試験（`verify-final-u5.test.mjs`）は12件すべて成功した。

## 最終レビュー（review-01、READY、Major 1・Minor 6）への対応

- Major（人間の指示で今直す）：build-infoの `reference.mbxCacheRestored` は、compileの後に `/mbx` の中身を数えていたため、mbxありでは必ず `true` になっていた。cacheのkeyも記録していなかった。
  - 修正：作業の最初（どのcontainerも動く前）に数えるようにし、workflowが求めたkeyと一致したkey（`reference.mbxCacheKeys`）を記録する。vivariumへのPRで反映する（mergeは未）。build.shとtools.jsonは変えないので、build keyとmbxのcacheのkeyは変わらない。
  - **公開済みの2つのbuild-infoの `mbxCacheRestored` は信用できない。** baseline（`guest-biome-15432368…`、run 39073445357）は、cacheの復元が「not found」だったのに `true` と記録されている。fix（`guest-biome-4751f68d…`、run 39077142098）は、exact hitで `true` は偶然合っているが、数え方は誤っていた。どちらにも `mbxCacheKeys` は無い。公開済みのReleaseは変えない（C12）。実際の復元の結果は、各runのlogの「Restore the mbx cache」の行で確かめる。
  - この値はkeyにもELFにも入らない参考欄で、ELFの正しさ（digestとsource・keyの照合、mbxありとなしで同じELF）には影響しない。
- Minorは、人間の判断（「まとめて直してください」）で、次の3件を同じvivariumのPRで直す。
  - 壊れたmbxのcacheの試験：壊れたcacheでbuildが失敗したとき、artifactが残らず作業directoryも消えることを試験で確かめる。本物のmbxの動きは、CIでは確かめていない。
  - 依存のgit（react/react）のcommitの到達：commitだけのbareのclone（`--filter=tree:0`）で、そのrepository自身のbranch・tagから辿れることを、依存の取得の前に確かめる。本物のreact/reactでは3秒・18MBで、Biomeが固定する `78c2d377` は辿れた。
  - tokenを子processに渡さない：git・docker・containerに渡す環境変数から、`ACTIONS_*`・`GITHUB_TOKEN`・`*_TOKEN` などを外す。
- 次のMinorは持ち越す。
  - `prevent_self_review=false` と `can_admins_bypass` の既定値：承認者が1人なので、変えるなら2人目の承認者を置くかどうかを人間が決める。
  - bumpのauto-mergeが短い間だけ有効になる：vivariumの共有のActionの動きで、本物のbumpはrecipeにguestを宣言するU6の後でないと試せない。
  - 上流のActionsのcacheが10GBを超えている：repository全体の使い方の話で、NFR8.3により相談する。
  - `docker run` の権限を絞ること（`--cap-drop` など）：buildを壊すおそれがあり、本物のbuildで確かめる必要があるため、別のPRにする。

## 計画からずれた所（承認済みの追記に記録）

- formicariumの `mise.toml`・`tsconfig.json` への変更は、U1–U4のreviewの証拠を外したため元に戻し、案の置き場所を `proposals/vivarium/u5/` に移した（人間の回答A）。
- 実装の途中で分かったこと（keyの式、正規化したbuild-info、依存のrepositoryの一覧、auto-mergeの解除、承認者のいないenvironmentの拒否、cacheのkey、run nameの計画のSHA256、PRの試験のworkflow、コメントの規則、関数coverageの既定の閾値）は、計画の2026-10-17の追記に記録した。

## 未完・未検証

- 成功したときはbuildの出力をCIのlogに出さないため、mbxのcacheの当たり外れの数が分からない（Minor）。Biomeでは、mbxによる時間の短縮は3分ほどだった。
- `can_admins_bypass` は provider の既定値の `true` のまま（人間の判断待ち、任意）。
- Safari実機、本物のbump-upstreamのrun、`fixed-guest-bump` のPRの作成は、まだ動かしていない。
