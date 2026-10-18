# 契約設計の確認

## Sources

`../units-generation/unit-of-work.md`、`unit-of-work-dependency.md`、`../domain-design/components.md`、`../requirements-analysis/requirements.md`。command/install分離、Session単一所有、固定buildとlatest分離、個別公開承認、retry/fallbackなしは既決事項。

## 契約方針

共有ライブラリ境界はTypeScriptの関数/型契約、repo間の成果物は版付きJSON schemaで定義する。新規HTTPサービスやイベント基盤は追加しない。既存APIのエラー分類とNode/browser配置を維持し、新規関数・型は追加として扱う。固定recipeは完全commit/digest照合、latestサイトは受入候補identityの照合を行う。仕様のownerは供給単位、破壊変更は全consumer確認後に版を分ける。

## Q1: installが使うカタログの受渡し

formicariumの共通install APIへ、ツール名・版・URL・digest・既定版をどのように渡しますか？ツール固有のbuild/取得元はvivarium又はshowcaseが所有する前提を維持します。

A. 呼出し元が検証対象catalogを明示的に渡す。vivarium/showcaseが生成したcatalogを同originで配布でき、本体にツール一覧を固定しない（推奨）。
B. 呼出し元はcatalog URLを渡し、install APIがcatalog自体の取得・更新も担当する。catalog取得のdeadline/digestとsnapshot固定を追加で定義する。
X. Other (please specify)

[Answer]: A

## Assumptions & Open Questions

None.

Q1は未回答の選択であり、実装成功の仮定ではない。取得・buildの有限deadlineとサイズ上限、公開関数shapeはこの段階の契約資料で具体値・境界試験まで定義する。CORS/性能・固定build再利用・兄弟repo実体は実装前の証拠取得事項として維持する。
