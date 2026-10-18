# terrarium廃止・機能移管の要件

## 目的と根拠

承認済みintent-statementの6目標とscope-documentのS0–S7を、検証可能な条件にする。参照：`../../ideation/intent-capture/intent-statement.md`、`../../ideation/scope-definition/scope-document.md`、`aidlc/spaces/default/codekb/formicarium/business-overview.md`、`architecture.md`、`code-structure.md`。追加資料は`docs/terrarium-migration-plan-summary.md`、feasibility-assessment/constraint-register、現状調査のapi-documentation/dependencies。初期依頼はproject-descriptionのdirectionsに従い、documentは計画資料として分析した。

これは要件の定義（ドキュメント根拠）で、実装・動作・公開成功の主張ではない。全機能要件はMust。安定版デモと固定commit再現を分離し、共通実行機能へ重複を集約する。各IDは後続の設計・テストで維持する。

## 機能要件

| ID | 要求と合格条件 | 範囲/根拠 |
|---|---|---|
| FR1 | 大規模移管前にaube公式musl tar.gzとBiome musl ELFをChromium/Firefox/WebKitで取得・実行し、version/URL/digest、最終URL、CORS、fetch/展開/SHA256/ELF・build-info/登録/--versionの工程時間とstdout/exitをdocs/resultsへ記録する。CORS不可・NFR1未達は代替案を具体化し確認するまで大規模移管を開始しない | S0/B0、feasibility |
| FR2 | formicarium公開guest APIでSHA256、静的little-endian x86-64 ELF64、program-header境界、PT_INTERP拒否、build-infoのsource/commit/target/patch identityを検証できる。不正digest/動的ELF/不正bounds/不一致metadataは実行・登録前に拒否する。fixtureを公開FsEntryへ変換し、移植した既存unitとNode/3ブラウザconsumer試験が通る | S1/B1、既存resolverとruntime重複 |
| FR3 | 共通コマンド層は引用/空白を含むargv分割、ls/cat/rm -rf/cdと登録guestの実行を提供する。空入力は状態を変えない。未閉引用、不正引数、未登録command、パイプ/変数展開/リダイレクトは原因を示して拒否する。cwd・ファイル状態を次の操作へ維持し、host領域へアクセスしない | S1/B1、計画 |
| FR4 | install <tool>[@<version又は名前>]はhost JSでカタログ内の一意の版を選び、取得・必要な展開・FR2検証後にセッションへ登録する。省略版の選択規則はカタログで明示し固定ref再現をlatestへ置換しない。任意URL・未知tool/version・曖昧な重複を拒否する。進捗は工程/処理量を通知し、取得/検証失敗は原因を残す。自動retry/別URLfallbackなし。失敗時に登録を部分更新しない | S1/B1、計画 |
| FR5 | reset/disposeで導入guestと関連session状態を消去する。install中のreset/dispose/abortは保留処理を中止し、遅延responseが新状態へ登録されない。実行とinstallの重複、同sessionの同時installはbusyとして明示拒否し既存状態を維持する。再installは検証成功後に置換し失敗時は旧登録を保持する | S1/B1、既存所有権とcorner sweep |
| FR6 | 公開基点を履歴/sourceと照合し、公開状況の古い文書を訂正する。0.3.0候補の公開API/types/配布inventoryとconsumer証拠を揃え、個別承認後公開しterrariumを追従させる。個人inputs.tar.gz依存を公開npm APIへ置換し既存consumer/配布チェックを通す。候補CIのowner入力依存も変更後の検証所有者へ対応付ける | S1/B1、現状manifest/CI |
| FR7 | vivarium recipe.guestsはtool/repository/40桁commit/fixtureを宣言する。PR/branchは作成時にcommitへ解決する参考情報。builder keyはtool/repository/commit/builder hashを含み、同入力2回目はELFを再利用しコンパイル省略と同digestを記録する。GitHub Releaseで成果物・metadataを保持し、欠損/不一致を成功扱いしない | S2/B2、intent Q4 |
| FR8 | 固定build-infoにsource URL/commit/target/rustc/sourcePatchesとbuild入力を記録し、pitchfork UIのaubeも固定する。共通install catalogを出力する。builder CIの合否はELF/build-info検証、recipe verdictの合否はrecipeテストに分離する。bump-upstreamはbranch commitを直接確認する | S2/B2、計画 |
| FR9 | 最初にBiome baseline biomejs/biome@2405c7620169bd0719166af09a8d89cc76fb37fbの1件をvivarium CIでbuildしformicariumで--version成功・再利用を記録する。完全commitのremote存在を事前照合する。その後fix JamBalaya56562/biome@f79f85d58ae499647c127f1e90a4931e3dbbb206も同様に検証する。試行時だけ旧入力を一時利用できる | S0/S2、現行repro/recipe |
| FR10 | vivariumはformicarium/browserをbundleしWorker/資産を同origin配布する。xterm ready/run/transcript互換と共通コマンドを維持し、biome-migrate-prettier fixtureをrecipe側で所有する。実行前にguest source commitとdigestをrecipe固定値へ照合する。不一致時は実行/verdict算出を拒否する | S3/B3 |
| FR11 | biome-12265でbeforeのsemi/quotesがasNeeded/single、afterがalways/doubleとなり、3ブラウザでreproducedかつ旧verdictと一致する。移行前のfixture、command、stdout/生成設定/exit/verdictを固定した比較証拠を作成し同条件で比較する。builderには期待verdictを持たせない | S3/B3、計画・既存recipe |
| FR12 | Contract v1はruntime.name=formicariumを受け付けterrariumをdeprecated互換として残す。guests schema、en/ja文書、template、説明、consumer試験を更新し、旧loader/proxy/middleware/builds.json依存と旧専用試験を整理する。互換の説明と歴史記録以外の現役terrarium依存参照を除去する | S4/B4、intent Q4 |
| FR13 | formicarium/showcaseがlatest stable aube/pitchfork/Biomeの解決・取得・検証・catalog生成を所有し、公式musl資産がない場合のsource buildを提供する。ツール条件は設定で表現する。回帰guest/fixtureは固定のまま分離し、Node/3ブラウザで各--versionが選択版に一致する | S5/B5 |
| FR14 | showcaseは公開APIだけをimportしruntime内部import、本体→showcase依存、回帰fixture共有を機械検査で拒否する。専用CIは受入済み/構築済み本体資産を利用し重い本体CIと分離する | S5/B5 |
| FR15 | Astro/Starlightのカード/デモをshowcase/siteへ移し、トップはエミュレータ説明、一覧は/tools/、空端末からinstallして3ツールを実行できる。個別ページは事前導入を許す。日次buildと受入後のPages deployを提供し、失敗候補を配布せず前回サイトを維持する | S6/B6 |
| FR16 | B4/B6受入後、npm/JSR download・GitHub dependents等の利用調査と移行案内を提示し、個別承認後に最終版/deprecation、案内Pages、README、archive、OpenTofu state/組織ruleset整理を実行する。既存npm/JSR版を削除せず、全関連repoの個人inputs.tar.gz参照解消を検索で確認する | S7/B7 |

## 非機能要件

| ID | 検証可能な条件 | 根拠 |
|---|---|---|
| NFR1 | aube/Biome×3ブラウザで非DL工程（展開、SHA256、ELF/build-info、登録、--version）の合計の連続5回中央値が3000ms以下。初回と最大値も報告、fetchは別計測。monotonic clock使用、環境/版/ホスト負荷記録、重い並行処理なし。超過はFR1の見直し条件で、閾値を緩めて通さない | 今回Q1=A |
| NFR2 | probe1run≤600s・全8項目、aube browser1run≤840s、1worker/retry0、native基準出力完全一致、wasm上限1GB、WorkerのwaitAsync削除を維持。統合前CIと第一者配布JS固定一覧line coverage≥80%。skip/欠落を成功に置換しない | constraint-register、team Testing Posture |
| NFR3 | host/guestパス境界を維持。archiveの../・absolute・symlink escape/loop、重複entry、破損/truncated input、展開上限超過を拒否して登録を変更しない。catalog/metadataはschemaと必須identity検証、未知付加fieldは互換範囲で許容し曖昧duplicateを拒否。取得物が検証後に変更されても実行には検証したbyte copyだけを使用 | 既存API所有権、corner sweep |
| NFR4 | fetch/buildには有限deadlineとcancel経路を設け、HTTP/CORS/offline/429/不正bodyを原因付きで終了する。自動retry/別URLfallbackは行わずlocal操作を維持。deadline・サイズ上限の具体値は契約設計で明示し境界試験を定義してから実装する | 計画、corner sweep |
| NFR5 | 同一keyのbuild/publish重複を直列化し、途中終了や古いresponseで受入済み成果物を破壊しない。metadataとELFの対応を検証し、cacheは出所/digestが一致した場合だけ再利用。変更source/builderは別keyとして扱う | S2/S6、corner sweep |
| NFR6 | same-origin Worker、SharedArrayBuffer/COI、既存CSP blob/wasm要件を維持し、browser bundleを3ブラウザで受入する。実機Safariは別証拠がなければ未検証と表示する。Node/browser対応版を文書と試験環境に記録する | scope、ADR/現状調査 |
| NFR7 | 端末・install UIはloading/empty/errorを区別し、キーボード操作、文字による状態表示、非ASCII/空白/引用を含む入力を保持する。guest出力やmetadataをHTML/codeとして実行しない。進捗unknownと0を区別、時刻はoffset付き、期間はmsで記録する | デモ/端末移管、corner sweep |
| NFR8 | source/pack/guest digestと受入済み版を配布証拠へ対応付ける。新規費用は事前相談し、秘密をログに出さない。ライセンス/notices、CI最小権限・未信頼PRからの公開拒否を維持する。PR単位の切戻し手順を定義し、terrariumはFR16まで維持する | constraint-register、既存公開境界 |

## 利用シナリオと失敗条件

- 空端末→install→--version→builtin操作→reset。成功は検証済みguestだけが実行され、reset後は未登録となる。失敗/abort/重複実行は旧状態を保持する（FR3–5）。
- 固定recipe→remote commit照合→build→digest/build-info検証→再利用→before/after比較。別repoの同名tool、key変更、欠損成果物、古いresponseを混同しない（FR7–11、NFR5）。
- latest候補→3ツール受入→配布。候補失敗や中断は前回サイトを維持し、配布物が試験した物と一致する（FR13–15、NFR8）。
- 移管の両経路成功→利用調査/案内→個別承認→退役。未承認又は下流依存残存の場合は退役しない（FR16）。

## 制約・対象外

依存はvivarium→formicarium、本体→showcaseは禁止。jjとmise、main sessionの直列検証、未変更aube再build禁止を維持する。固定期限/追加予算/追加規制要件なし。最終判断はユーザー、このチャットの節目で報告する。

JIT・コア置換・動的リンク・guest network/shell/package manager・任意URL install・showcase独立化・デモ追加・別intentの一般CI改善・既存版削除は対象外。新規SaaSのtenant/auth/個人データ保持、金額計算、AI生成機能は本製品にないためcorner対象外。古い測定記録や無関係な歴史文書を機械的に削除しない。

## 仮定と後続確認

実装成功の仮定は置かない。既存private RC checkoutを公開0.2.1と同一と扱わずFR6で照合する。sibling内部は今回のfull調査範囲外なので、各repo変更前に実体・必要なAGENTS・試験・infra状態を確認する。

sourceのremote存在、比較証拠、計測、固定build再利用、公開権限/容量は未検証であり、該当FRの証拠取得作業として残る。fetch/buildのdeadline・サイズ上限と公開関数shapeは契約設計の具体化事項で、未決のまま実装しない。主たる範囲・性能基準に未回答のユーザー質問はない。

## 範囲と成功目標の対応

| 範囲 | 要件 |
|---|---|
| S0/B0 | FR1/FR9/NFR1 |
| S1/B1 | FR2–FR6、NFR2–NFR4 |
| S2/B2 | FR7–FR9、NFR5 |
| S3/B3 | FR10/FR11、NFR6/NFR7 |
| S4/B4 | FR12 |
| S5/B5 | FR13/FR14 |
| S6/B6 | FR15/NFR7/NFR8 |
| S7/B7 | FR16/NFR8 |

再現互換=FR7–12、デモ移管=FR13–15、固定再利用=FR7–9、外部入力解消=FR6/FR12/FR16、退役=FR16、品質維持=NFR2/NFR6/NFR8。順序はB0通過後にB1、B1後B2/B5、B2→B3→B4、B5→B6、B4/B6→B7を守る。
