# Bun 移行と CI の整備（2026-10-10〜2026-10-12）

## 目的と範囲

依頼は「publish.yml だけでなく、普段使う便利な workflow も入れてほしい。Node ではなく Bun を使い、package-lock.json ではなく bun.lock で依存を管理したい。vivarium・terrarium のやり方に合わせたい」というもの。

目的は、formicarium の開発と CI を兄弟 repository に揃え、Bun で再現できる依存管理と日常の品質検査を持つこと。あわせて保守の自動化を入れ、今後の RC / stable を検証済みの候補から公開できる状態にする。

範囲に含めたもの：
- 開発依存を Bun と text の `bun.lock` へ移す（`package-lock.json` は削除）。
- mise task と開発コマンドを Bun に揃える。Node 固有の処理は Node のまま明示する。
- PR と main push で lint・型検査・build・軽量テストを行う通常 CI。
- 依存と Actions の更新 PR、PR ラベル、commit 形式検査、整形の自動修正、小さい依存更新の条件付き自動 merge。
- `publish.yml` と公開前検査を Bun の開発基盤へ合わせ、将来の RC / stable タグを検証できるようにする。
- README の手順の更新。

範囲外：stable の実公開、RC の再公開、公開済み `0.1.0-rc.1` の terrarium 受入れ、コアの変更、Node consumer の廃止、Pages / Terraform / JSR、無条件の自動 merge、関係のない全体整形。既存の RC タグ、固定入力、npm dist-tag は変更しない。

## 主な決定

- **Bun は開発依存の管理と開発コマンドに使い、Node の実行境界は残す。** `node:test`、Node 専用 flag、Worker、`process.execPath`、consumer の確認は Node で実行する。一括で Bun に置き換えると、consumer・Worker・coverage の互換性の根拠がなくなるため。公開 API の `engines: node >=24` は維持した。
- **依存の導入は frozen で、導入 script をすべて無効にする。** `trustedDependencies: []` として Bun の既定許可にも頼らない。未知の install script を CI に持ち込まないため。
- **通常 CI と公開候補の検証を分ける。** 通常 CI の成功を公開の許可と扱わない。重い回帰と配布 JS の coverage は候補検証（`candidate-verify.yml`）で行う。軽量の結果で重い回帰を代用しないため。PR ごとに未変更の guest を再ビルドしない既存の方針も守った。
- **保守の自動化は、判定（副作用なし）と操作（push・merge）を分ける設計で作った。** 整形 push と依存 merge は許可条件が違い、誤った許可が外部操作に直結するため。判定には credential や API client を渡さない。のちに、この独自実装は標準の YAML に置き換えた（下記）。
- **保守の自動化の範囲は「整形の自動修正 push と、CI に合格した小さい依存更新の条件付き自動 merge まで」とした**（所有者の回答）。
- **実装の順番は保守の自動化を先、公開 workflow の適合を後にした**（所有者の回答）。
- **独自の TypeScript 保守 runner をやめ、terrarium / vivarium と同じ標準 YAML に置き換えた**（所有者の指示）。共通の保守は兄弟 repository と同じ構成にし、formicarium 固有の runtime・配布・公開の検証だけを独自に残す。PR #8 で約 1 万行を削除した。Renovate も Dependabot に替えた。現在の構成は [README の「保守 workflow」](../../README.md#保守-workflow) にある。
- **整形の適用には既存の secret `TF_TOKEN_GITHUB` を使う**（所有者の指示）。保守用に GitHub App の鍵を別に用意する案はやめた。
- **公開用 toolchain の固定 identity を「最新」に変える案は採らなかった。** 公開の完全性の境界を CI 整備の範囲を超えて変えることになるため。CI の runtime と Bun の開発コマンドだけを最新へ更新した。現在の公開経路は [automated-releases.md](../automated-releases.md) にある。

## 仕様・設計の要点

今も意味のある点だけを書く。現在の手順と workflow の説明は README の「通常CIと候補検証」「PR product tests」「開発タスクとスクリプトの配置」にある。
- **通常 CI（`ci.yml`）の必須 check は `quality`・`commit-format`・`ci-required`。** check 名は固定で、matrix の接尾辞を付けない。path filter を使わないので、docs だけの PR でも必須 check が決まり、永久に pending にならない。`ci-required` は依存 job の failure・skipped・cancelled を失敗にする。
- **権限：** 通常 CI は contents read だけを使い、checkout の credential を保存しない。公開用の secret や OIDC を持たないので、fork の PR も検査できる。
- **commit 形式：** Conventional Commits（`type(scope)!: subject`）。type は feat / fix / docs / style / refactor / perf / test / build / ci / chore / revert。検査コードは信頼済み base 側のもの（`scripts/ci/commit-format.ts`）を使い、PR 側で規則を弱めても判定に使わない。移行前の base（`12a92eab`）の初回だけ、検証済み SHA `7fc23afe` の検査を使う。
- **候補検証（`candidate-verify.yml`、workflow_dispatch、`candidate-required`、360 分）：** Node / browser の consumer、native 出力の一致、probe 8 項目、600 秒 / 840 秒、1 worker、retry なし、wasm 1 GB、固定第一者配布 JS 24 ファイルの行 coverage 80% 以上と全 realm の receipt を確認する。入力 archive の URL と SHA256 は repository 変数 `FORMICARIUM_MODERNIZATION_INPUT_URL` / `FORMICARIUM_MODERNIZATION_INPUT_SHA256` で渡す。旧 RC 用の変数と入力 branch は変えない。
- **CI の分割と cache（PR #12）：** 製品ビルドを wasm・probe・aube/pitchfork の 3 job、回帰を Node と 3 ブラウザの 4 job に分けた。cache は解決したコンパイラ image と入力ごとに持ち、cache hit でも native 検査と回帰は省略しない。main の push では PR の merge ref の cache を復元できないため、最初のビルドを行う（GitHub の cache scope の制約）。
- **pitchfork のパッチ削除（PR #10）：** 上流 v2.30.1 で musl の ioctl の型が直っていたため、パッチとその適用・照合の処理を削除した。ソースに変更が残る build cache は拒否する。
- **probe の BSF 修正（PR #11）：** 追跡していた bsf-zero のテストに、対応する probe のコマンドがなかった。BSF の probe モジュールを足し、CI は wasm を信頼する前に native で BSF を確認する。

## 品質の目標と結果

目標は要件の NFR1〜NFR5（再現性・権限・整合性・品質・運用）と、それを詳しくした 44 項目、JSON 個別上限（8 MiB）、テストの約束事。記録では 46 対象がすべて **Met**。ただし多くは局所 fixture と静的設定による確認で、実際の外部動作を含まない。

| 目標                                                    | 値                                                                                             | 結果                                                                   |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 固定第一者配布 JS の行 coverage（未実行ファイルも分母） | 80% 以上                                                                                       | 24 ファイル、1450/1801 行 = 80.51%、fresh receipt 46 件、skip 0（Met） |
| U1 部分の coverage                                      | —                                                                                              | 862/982 行 = 87.78%                                                    |
| 既存の上限                                              | probe 600 秒、aube ブラウザ 840 秒、1 worker、retry なし、probe 8 項目、native 一致、wasm 1 GB | 維持（Met）                                                            |
| 候補の実 CI（run 38087834465、source `7fc23afe`）       | 9 必須 check が success、skip 0                                                                | 21 分 35 秒で success（Met）                                           |

run 38087834465 の内訳（passed / failed / skipped）：release 35/0/0、Node 回帰 54/0/0、browser 回帰 36/0/0、Node consumer 115/0/0、browser consumer 123/0/0、terrarium Node 統合 30/0/0、terrarium browser 統合 45/0/0。native aube / pitchfork の再現性検査も成功。

ほかの記録：
- `bun.lock` への移行で 84 依存の name/version を維持した。clean かつ cache なしの frozen 導入の成功と、manifest 不一致の拒否を確認した。
- 新しい候補を外部 consumer に独立導入した Node 統合は 189 pass / 0 fail / 0 skip。入力を指定しない初回は 168 pass / 3 fail（資産と環境変数の不足）で、その失敗も記録した。
- PR #3 の候補の実 CI（run 38091354807）も success、16 分 43 秒。coverage は同じく 80.51%。
- 直列だった product job は 30 分 14 秒（PR #11）。matrix 化後（PR #12）は 1 回目 27 分 19 秒、cache が効いた 2 回目 1 分 59 秒。これは観測した所要時間で、統制した性能測定ではない。

## 運用の手順

現在の手順は既存の文書にある。
- 開発タスク、通常 CI、候補検証、変数の設定、失敗時の確認：[README の「ビルド」](../../README.md#ビルド) と「PR product tests」。
- 保守 workflow（Dependabot、自動 merge、整形の自動修正、ラベル）と停止方法：[README の「保守 workflow」](../../README.md#保守-workflow)。
- 公開の経路：[automated-releases.md](../automated-releases.md)。0.1.0 の頃の RC 前提の手順は [release-assurance.md](../release-assurance.md)（履歴）。

記録だけにある注意点：
- Dependabot の PR を手で rebase すると、Dependabot の署名が失われ、自動 merge は「Dependabot's commit signature is not verified」として拒否する。署名の検査は迂回せず、PR に `@dependabot recreate` とコメントして Dependabot に作り直させる（PR #4 で確認）。
- 入力 archive を macOS で作ると AppleDouble（`._manifest.json`）が混ざり、member 検査で拒否される。`COPYFILE_DISABLE=1` で作り直す。

## 成果

- PR #3：Bun 移行・通常 CI・保守と公開の整備。squash merge（`f79df028`）。main CI 38092726329 は 3 必須 check が success。
- PR #6、#7：独自保守 workflow の設定と、artifact の配信 host の扱いの修正（`productionresultssa*.blob.core.windows.net` の番号付き shard だけを許可）。のちに PR #8 で独自保守ごと削除。
- PR #8：標準 YAML の保守 workflow（`dependabot-auto-merge.yml`、`assign.yml`、`dependency-review.yml`、`commitlint.yml`、`labeler.yml`、`lint-autofix.yml` / `lint-autofix-apply.yml`）へ置き換え。squash merge（`3b36ce72`）。不要になった `MAINTENANCE_ENABLED` 変数は削除。
- PR #4：Dependabot による Playwright 1.63.0 → 1.64.0。標準 YAML の自動 merge で統合（`b7975de9`）。
- PR #10：古い pitchfork パッチの削除。
- PR #11：PR ごとに製品をソースからビルドしてテストする CI、Bun 1.4.3 / Node 26.11.1、BSF probe の修正。所有者が merge。
- PR #12：製品ビルドと回帰の matrix 化と cache。所有者が merge（main `c3ea82a4`）。main CI 38108643640 は 11 job すべて success。
- main の保護：`quality`・`commit-format`・`ci-required` を必須（producer App 15368）、strict、署名必須、force push・削除の禁止、squash merge のみ。Dependabot の脆弱性 alert と自動修正を有効にした。

## 残った課題

- 実機の Safari は未検証（WebKit の結果とは区別する）。
- 整形の自動修正が空でない差分を push する場合、Dependabot の自動 merge 以外の正の書込み、新しい `assign.yml` の default branch での実行は未検証。`TF_TOKEN_GITHUB` の Contents / Pull requests の書込み権限も、GET だけの確認で実際には使っていない。
- Node 26 の main（`84e8995f`）での候補検証（run 38099515705）は、terrarium の browser 実行で失敗した。root の Playwright 1.64.0 が、固定入力の Playwright 1.63.0 の実行ファイルを用意しなかったため。PR #11 で修正したが、新しい入力での再実行は記録時点で未実施。現在の main の候補検証も、ソースに結び付いた新しい入力が必要なまま。
- PR #5（`@types/node` の major 更新）は `scripts/terrarium/coverage.ts:475` の TS2322 で quality が失敗し、開いたまま。major 更新は自動 merge の対象外。
- 計測の timing は単一機種のもの。file-backed の `MADV_DONTNEED` の制限は解消していない。

## 元の記録

記録は git の commit `8096c7b4` の `aidlc/spaces/default/intents/261010-bun-ci-modernization/` にある。
