# 移管の実行計画

## Sources

`../requirements-analysis/requirements.md`、`../domain-design/components.md`、`../units-generation/unit-of-work.md` / `unit-of-work-dependency.md` / `unit-of-work-story-map.md`、`../contract-design/contract-summary.md`とその固定参照、`delivery-planning-questions.md` Q1=A。本資料はドキュメント根拠で、実装・性能・公開は未検証。

## Execution Sequence

Bolt（1単位の設計・実装・検証を区切り、動く結果で完了を確認する作業）を9回に分ける。各単位の適用設計・コード計画・実装・検証を逐次完了する。記録済みのunit-major/serialを維持する。skeleton:offのため独立したwalking-skeleton承認儀式は追加しないが、U1では実guestの統合試行を必須とする。計画上の順番は以下、実際の処理は承認済みUnit DAGと進行設定に従う。経済的な順番だけでDAGを上書きしない。

| Bolt | Unit / directory | 完了条件・証拠 | 確認する仮説 / デモ |
|---|---|---|---|
| 01-preflight | U1 / u1-migration-preflight | C01の36測定行、全CORS/exit合格、非DL中央値≤3000ms、baseline remote存在/CI build/同key再利用 | 既存APIでaube/Biomeを取得して--versionまで動き、固定buildの再利用が成立する |
| 02-public-guest | U2 / u2-session-guest-api | C02/C03状態/検証/copy試験、公開types/inventory/Node3browser consumer、公開基点照合 | 元byte変更後も検証copyが実行され、stateの唯一所有が成立する |
| 03-install | U3 / u3-install | C04取得/進捗/取消/不正archive/busy/再installと正式経路測定 | 失敗/取消は旧登録を保持し、late responseで新状態が壊れない |
| 04-command-b1 | U4 / u4-command | C05 parser/builtin/run、C06 B1必須全行/最終pack/coverage、個人入力依存解消のAPI経路 | 空端末install→--version→FS操作→resetが動く。正式移管開始条件が揃う |
| 05-fixed-build | U5 / u5-fixed-guest-build | C06成立後、C07 baseline/fixのremote identity・build-info・ELF・同key再利用、pitchfork依存固定 | 固定sourceから出所付き成果物を生成し、2回目のコンパイルを省略できる |
| 06-recipe-contract | U6 / u6-recipe-runtime | C08完全schema/旧名互換/端末互換、C10 U6全行、3browser before/after旧verdict一致、旧現役依存除去 | biome-12265の設定変化と再現結果を移管後も維持できる |
| 07-showcase-guests | U7 / u7-showcase-guests | C09 latest3tool Node3browser --version、公開import境界/fixture分離/専用CI | 固定回帰と独立して最新安定版候補を供給できる |
| 08-showcase-site | U8 / u8-showcase-site | C10 U8全行、空端末/keyboard/UI、日次失敗時前回保持、site inventory | /tools/から3toolを導入・実行し、同じ受入candidateでサイトを構築できる |
| 09-retirement | U9 / u9-retirement-acceptance | C10双方成立、利用調査/参照検索/移行案内/切戻し/infra実体照合、C12具体承認 | 未達/未承認の退役を拒否し、移管完了の証拠で対象操作を判断できる |

## Milestones and Stop Conditions

- U1不合格なら代替案を具体化して人間確認まで大規模移管を止める。契約時間・容量不適合は黙って上限を上げず契約変更を確認する。
- U4ではU2/U3/U4をまとめた最終API候補を再検証する。U2だけの合格でB1完了としない。0.3.0公開とterrarium追従は具体版/対象/証拠の個別承認後。公開待ちなら検証済みcandidateで開発を進め、公開済みと扱わない。
- U5→U6を完了後にU7→U8へ進む。2経路とも必須、デモ成功で固定再現を代替しない。U9の外部archive/deprecation/infra書込みは両経路受入と個別承認後だけ。
- 各単位で変更前baseline、変更後の既存品質/対象試験、固定分母coverage80%以上を確認。probe600s/8項目、aube840s、worker1/retry0、native一致、wasm1GB、waitAsync削除、未変更aube再build禁止を維持する。

## Verification and Reporting

ビルド/試験/計測はmain sessionで一つずつ。新機能は実装層ごとtest-after、不具合は再現失敗を観測→修正→同試験成功。節目で本チャットに結果と次の停止条件を報告する。既存taskには今回のU1測定/U5再利用/U6比較/U8受入全体を一つで確認する入口がまだない。各単位のコード計画で具体コマンド・不足fixture・既存CIとの対応を揃え、全単位に再利用する検証コマンドは人間が実コマンドを承認するまで未設定。未設定は検証済みを意味しない。初回の完了確認より前に選択を必ず確認する。

期間と外部承認所要時間は未測定。日数の保証を置かずU1/U5実測後に見積りを更新する。既存公開物は承認まで維持し、失敗時は残操作を止める。
