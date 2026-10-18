# 順番とリスクの判断

## Sources

`delivery-planning-questions.md` Q1=A、`../requirements-analysis/requirements.md`、`../domain-design/components.md`、`../units-generation/unit-of-work-dependency.md` / `unit-of-work-story-map.md`、`../contract-design/contract-summary.md`。

## Sequencing Rationale

リスクを先に検証する順番を採る。Bolt（1単位を設計・実装・検証まで完了する作業）はU1→U2→U3→U4→U5→U6→U7→U8→U9。数値の価値/工数scoreを推測で作らず、ユーザーが選択した固定再現優先の判断を根拠とする。最初に取得/CORS/性能と小build再利用を観測し、大規模移管の不成立リスクを早く判断する。B1成立後、固定builderとrecipeの旧verdict一致を証明してからlatestサイトへ投資する。

## Dependency Check

全Unitは直前までに直接依存を満たす。U5→U4のB1受入条件を含む。U6はU2/U4/U5、U7はU2/U4、U8はU7、U9はU6/U8の成立後。トポロジカル順序からの逸脱なし。U5/U7の並行開発は可能でも今回は逐次とし、性能計測のホスト負荷と複数repoの証拠混用を避ける。実際の順序はUnit DAG/iteration設定に従い、計画文書だけで実行順を変更しない。

## Risks and Responses

| リスク | 観測点 | 対応/停止 |
|---|---|---|
| Release CORS/redirect・容量・性能 | U1/C01/C11 | 代替取得配置を具体化して確認、3秒基準/既存品質を緩めない |
| snapshot/busy/late responseで状態破損 | U2–U4/C02–C05 | 直接APIを含む競合・取消・copy consumerを必須化 |
| 固定commit欠落/再利用不成立 | U1/U5/C07 | remote出所と両digestを照合、不一致再利用禁止 |
| schema/端末互換・verdict変化 | U6/C08/C10 | 版固定参照/golden比較、失敗なら移管完了にしない |
| latestと固定fixture混在 | U7/U8/C09 | 設定/fixture/import境界の機械検査、同candidate配布 |
| 公開基点差/権限/承認不足 | U4/U9/C06/C12 | source/pack照合、具体外部操作承認前に書込まない |
| 工数未確定 | U1/U5 | 実測後見積り更新、固定期限なし、新費用事前相談 |

Critical pathの期間計算は所要時間未測定のため未検証。構造上U1–U4が共通の前提、最終U9には固定再現とサイトの両経路が必要。工程中の不合格はその単位の修正を完了してから先へ進める。
