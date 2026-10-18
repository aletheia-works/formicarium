# 移管の作業単位

## Sources

承認済み `units-generation-questions.md` Q1=A、`../domain-design/components.md` / `decisions.md`、`../requirements-analysis/requirements.md`。9単位は実装・検証の責任境界であり、着手順/Bolt/期間はDelivery Planningで決める。本資料はドキュメント根拠。動作・性能・公開は未検証。

## Unit Definitions

| Unit ID | Directory | Kind | Complexity | 配置 | Deployment model |
|---|---|---|---|---|---|
| U1 | u1-migration-preflight | packaging | M | formicarium/vivarium | standalone（既存CI/task成果物） |
| U2 | u2-session-guest-api | library | L | formicarium | shared（同一formicarium配布） |
| U3 | u3-install | library | L | formicarium | shared（同一formicarium配布） |
| U4 | u4-command | library | M | formicarium | shared（同一formicarium配布） |
| U5 | u5-fixed-guest-build | packaging | L | vivarium | standalone（既存CI/task成果物） |
| U6 | u6-recipe-runtime | ui | L | vivarium | embedded（vivariumサイト） |
| U7 | u7-showcase-guests | packaging | L | formicarium/showcase | standalone（既存CI/task成果物） |
| U8 | u8-showcase-site | ui | M | formicarium/showcase/site | embedded（showcaseサイト） |
| U9 | u9-retirement-acceptance | packaging | L | 関連repo/既存infra | standalone（既存CI/task成果物） |

### U1: u1-migration-preflight

- 所有：MigrationAcceptance（初期証拠）。
- 成果と境界：既存APIで公式aube/Biomeの取得・展開・検証・登録・--versionを3ブラウザで測定。baselineのremote commit照合、vivarium CIで1件build・再利用の試行。
- 単位の合格証拠：aube/Biome×3ブラウザの初回・連続5回・最大値、fetch別時間、非DL合計中央値≤3000ms、stdout/exitと取得identityを記録。baseline同keyの2回目はコンパイル省略・同digest。
- 制約：試行限定の旧入力を許す。CORS不可/性能未達は代替案の確認まで大規模移管を止める。新install APIに依存しない。

### U2: u2-session-guest-api

- 所有：ExecutionSession / GuestValidation / MigrationAcceptance（公開候補）。
- 成果と境界：唯一のFS/cwd/登録状態、busy/token/epochと取消・原子的commit、公開guest検証/fixture変換、types/配布inventory/公開基点照合とconsumer候補準備。
- 単位の合格証拠：不正digest/ELF/bounds/metadata/fixture拒否、検証したbyte copyの使用、競合・reset/dispose・古い応答の単体/consumer試験。Node/3ブラウザconsumerと既存配布チェック。
- 制約：U1の開始条件を満たす。tool/verdictを状態管理へ混ぜない。0.3.0の最終candidateはU3/U4統合後に再生成・再検証し、未承認公開はしない。

### U3: u3-install

- 所有：InstallCoordinator。
- 成果と境界：一意catalog選択、host取得/展開/検証、工程・処理量進捗、abort、成功時のみU2へ登録する。
- 単位の合格証拠：未知/曖昧tool/版、任意URL、archive escape/破損/上限、取得失敗を拒否。再install失敗は旧登録保持。reset/dispose/abortと遅延response、直接runとの競合を統合検証。
- 制約：自動retry/別URLfallbackなし。deadline/サイズ境界はContract Designで確定。状態所有はU2のみ。

### U4: u4-command

- 所有：CommandSession。
- 成果と境界：argv分割、ls/cat/rm -rf/cd、guest runとinstall振分け、transcript整形。
- 単位の合格証拠：空入力、空白/引用/非ASCII、未閉引用・shell構文・不正引数・未登録command、連続操作のcwd/FS維持、install/run競合を試験。
- 制約：導入処理を複製しない。U2/U3と同じ配布物に含めるが別モジュール・検証境界を保つ。

U4の完了には、U2/U3/U4のB1統合受入と最終API候補のconsumer再検証を含む。この条件の成立後にU5の正式固定build移管を開始する。U1の小規模baseline試行は例外として既存経路で行う。

### U5: u5-fixed-guest-build

- 所有：FixedGuestBuilder。
- 成果と境界：固定source/dependencies/builder hashのkey、同key直列化、ELF/build-infoの原子的保存・再利用、共通catalog、bump-upstream。
- 単位の合格証拠：baselineとfixの完全commit存在・--version成功、key変更・欠損・不一致拒否、再実行コンパイル省略/同digest。pitchfork UI aube固定とsourcePatches等の出所証拠。
- 制約：U1試行を正式経路へ引継ぎ、二重builderを残さない。builderにverdictを置かず公開guest APIを利用。Release書込みは具体承認後。

### U6: u6-recipe-runtime

- 所有：RecipeRunner。
- 成果と境界：固定recipe/fixture、公開browser bundleとsame-origin Worker、xterm互換、before/after/verdict、Contract v1/schema/template/en-jaと旧依存整理。
- 単位の合格証拠：移行前比較証拠を固定し、biome-12265のasNeeded/single→always/doubleと旧verdict一致を3ブラウザで確認。commit/digest不一致拒否、ready/run/transcript互換、deprecated名consumer試験。
- 制約：builderはビルド時のみ。runtime内部/個人archive/旧loader等の現役依存を除去し、歴史/互換説明は保持。実機Safariは別証拠なしなら未検証。

### U7: u7-showcase-guests

- 所有：Showcase（候補供給）。
- 成果と境界：latest stable aube/pitchfork/Biome設定・解決・取得/source build・検証/catalog、専用受入CI、候補identity。
- 単位の合格証拠：Node/3ブラウザの各--version一致。公開importのみ、本体→showcase依存/回帰fixture共有拒否を機械検査。受入済み本体資産利用、候補失敗は前回を保持。
- 制約：固定再現から独立。ツール条件は設定。重い本体CIは複製しない。U8へ同じcandidate/digestを渡す。

### U8: u8-showcase-site

- 所有：Showcase（サイト消費）。
- 成果と境界：Astro/Starlightカード、トップ説明、/tools/、空端末install、個別ページ、日次候補受入とPages配布準備。
- 単位の合格証拠：3ツール導入/run、loading/empty/error・keyboard・出力escape、COI/Worker配置、日次失敗の前回サイト保持。配布候補identityと実際の受入版一致。
- 制約：U7のcatalogと公開command APIを利用。latest再解決しない。実配布は具体承認後の既存executor。

### U9: u9-retirement-acceptance

- 所有：MigrationAcceptance（最終照合）。
- 成果と境界：両経路受入照合、全repo参照検索、利用調査・移行案内、最終版/deprecation/README/Pages/archive/OpenTofu/ruleset準備と切戻し。
- 単位の合格証拠：U6/U8受入証拠とsource/pack/guest/deployed identity照合。個人inputs.tar.gz現役参照なし、npm/JSR/dependents調査。未達/未承認なら退役を拒否する条件試験。
- 制約：既存npm/JSR版を削除しない。各外部操作は具体対象と証拠の個別承認後。新規常駐承認サービスなし。

## Component Ownership

8部品を重複実装せず全て割り当てる。ExecutionSession/GuestValidation=U2、InstallCoordinator=U3、CommandSession=U4、FixedGuestBuilder=U5、RecipeRunner=U6。ShowcaseはU7の候補供給とU8のサイト消費に分け、candidate identityを共有契約で受け渡す。MigrationAcceptanceはU1の初期証拠、U2の公開候補検証、U9の最終照合を持つ。同一script/schemaの責任を複数単位へ複製しない。詳細ファイルの所有は各repoの現状確認とコード計画で確定する。

## Shared Constraints

jjとmise実体/宣言taskを使用、変更前baseline・変更後検証をmain sessionで逐次実行する。計測に重い並行負荷を入れない。未変更aubeは再buildしない。probe600s/8項目、aube browser840s、worker1/retry0、native完全一致、wasm1GB、WorkerのwaitAsync削除と第一者配布JS固定分母coverage80%以上を維持する。skip/証拠欠落を成功扱いしない。新費用は事前相談、source/pack/guest identity・license/notices・CI最小権限と未信頼PR拒否を維持する。

kindは設計成果の適用範囲を決める分類で、schema/API/UI/運用の必要検証を免除しない。U6はuiでもContractとfixture/verdict、U8はuiでも配布境界を含む。公開shape・schema・有限deadline/サイズ上限・失敗動作・候補受渡しはContract Designで確定し、具体値未決で実装を開始しない。sibling repoは変更前にAGENTS/ソース/試験/infraを調査する。
