# 作業単位の分割案

## Sources

- 承認済み `../domain-design/components.md`、`decisions.md`、`../requirements-analysis/requirements.md`。
- domain-design Q1=A：コマンド操作とinstallは別の論理部品。

## 分割方針

既存repoの配置を維持する。formicariumは共有ライブラリと同repo内showcase、vivariumは固定buildと再現UIを持つ。新しい常駐サービスは作らない。論理部品と作業単位は同一ではなく、同じ配布物の部品も個別に検証する。別単位だから別npm packageになるという意味ではない。

| ID / Directory | Kind | 境界・成果 | 直接依存 |
|---|---|---|---|
| U1 / u1-migration-preflight | packaging | MigrationAcceptanceの初期証拠：既存APIでaube/Biome取得・実行・工程測定、vivariumでBiome baseline 1件のbuild/再利用試行。旧入力は試行限定 | なし |
| U2 / u2-session-guest-api | library | ExecutionSessionとGuestValidation。共通busy/token/epoch、検証・fixture変換、公開types/consumer/0.3.0候補準備 | U1 |
| U3 / u3-install | library | InstallCoordinator。catalog選択、有限取得・展開、進捗・取消、原子的登録 | U2 |
| U4 / u4-command | library | CommandSession。argv/builtin/run/install振分け。状態所有はU2、導入はU3 | U2, U3 |
| U5 / u5-fixed-guest-build | packaging | FixedGuestBuilder。vivarium固定commit/key/build-info/catalog、再利用、baseline/fixの正式経路。B1統合受入後に開始 | U2, U4 |
| U6 / u6-recipe-runtime | ui | RecipeRunner。vivarium UI/fixture/verdictとContract v1互換・schema・文書・旧依存整理 | U2, U4, U5 |
| U7 / u7-showcase-guests | packaging | Showcaseのlatest解決/build/catalog・3ツール受入・公開import境界・専用CI | U2, U4 |
| U8 / u8-showcase-site | ui | ShowcaseのAstro/Starlight UI、空端末/install、日次候補受入とPages配布準備 | U7 |
| U9 / u9-retirement-acceptance | packaging | MigrationAcceptanceの最終照合・利用調査・案内・切戻し/退役準備。具体承認後だけ既存executorで外部操作 | U6, U8 |

U1は既存実行経路で動く最小の統合試行で、U2以降の新APIを先取りしない。計測未達/CORS不可なら代替案の確認まで大規模移管を止める。試行用builderを正式builderとして二重維持せずU5に引き継ぐ。U1の小規模試行はFR9の前半だけで、fixと本番経路の受入はU5に残る。

MigrationAcceptanceの所有は工程で分割する：初期計測=U1、公開candidate/consumer証拠=U2、両経路の最終照合/退役=U9。同一スクリプトや証拠schemaを複製しない。Showcaseはguest候補の供給=U7、サイト消費=U8に分け、単一のcandidate identityを引き継ぐ。詳細ファイル所有は各repo変更前の調査とコード計画で確定する。

依存辺は消費側→供給側。U2→U1は製品importではなく、大規模移管の開始条件。U5→U4はU2/U3/U4のB1統合受入と最終API候補のconsumer再検証を正式移管の前提とする条件。U5とU7は相互依存しないが、性能計測とビルド/試験はmain sessionで逐次実行する。開発並行性・経済的な着手順・Bolt分割はDelivery Planningで決定する。

公開APIのshape、deadline/サイズ上限、catalog/schema/候補identityとrepo間の受渡し契約はContract Designで確定する。publish/Pages/archive/infra操作は分割案の承認だけで実行せず、具体的な対象と証拠を揃え個別承認を受ける。実装、性能、外部操作は未検証。

## Assumptions & Open Questions

None.

既存決定を再質問せず、分割粒度とkindは以下の計画承認で確認する。各repo変更前の調査・remote identity照合は要件の作業として残る。

## Q1: 分割案の承認

上記9単位とkind、依存関係、既存repo内の共有/埋込み配置で詳細な作業単位資料を作成してよいですか？

A. Approve Plan
B. Revise Plan
X. Other (please specify)

[Answer]: A
