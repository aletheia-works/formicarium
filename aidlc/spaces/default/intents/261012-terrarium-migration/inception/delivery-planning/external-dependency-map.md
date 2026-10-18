# 外部依存と承認の対応

## Sources

`bolt-plan.md`、`../requirements-analysis/requirements.md`、`../units-generation/unit-of-work.md`、`../contract-design/contract-summary.md` C01/C06–C12。外部サービスの現状、所要時間、容量/権限は必要段階で観測し、成功を仮定しない。

## External Dependencies

| 外部項目 | 消費Bolt | 所有者/確認担当 | リードタイム | 遅延/失敗時 |
|---|---|---|---|---|
| 公式musl assets/CORS/redirect | 01/03/07 | upstream hosting、取得側U1/U3/U7 | 未測定、fetch120s/install180s | 原因記録、retry/fallbackなし、初期取得配置の代替案を確認 |
| baseline/fix remote commit・toolchain/依存 | 01/05 | upstream、builder U5 | 未測定、build4h | 存在/出所照合不能ならbuild受入なし |
| CI実行/Release保存・容量 | 01/05 | vivarium既存executor、確認は本セッション | 未測定 | ローカル候補証拠とCI/公開証拠を区別、公開操作は具体承認 |
| npm0.3.0候補/terrarium追従 | 04/06 | formicarium/terrarium既存executor、ユーザー承認 | 承認所要時間未定 | 検証済candidateで作業可、公開済みと扱わない |
| vivarium schema/UI/旧比較fixture | 06 | U6/既存repo | 変更前照合、未測定 | 固定参照との違いを確認、無断破壊変更なし |
| Pages/日次CI/COI | 08 | showcase既存executor、ユーザー承認 | 未測定 | 候補失敗は前回サイト保持、配布identity確認 |
| download/dependents調査・案内・最終公開 | 09 | U9/ユーザー/既存executor | 未測定 | 調査不足/下流参照残存なら退役なし |
| OpenTofu state/組織ruleset/archive | 09 | 既存infra管理者/ユーザー | 未測定 | 実体とplan/切戻し/具体承認が揃うまで書込まない |

## Approval Boundaries

計画承認と実装開始は外部push/publish/deploy/archive/infra変更の承認を兼ねない。C12の対象・版・digest・受入証拠・切戻しをまとめ個別承認を得る。既存npm/JSR版は削除しない。新費用は事前相談。外部秘密やcredential取得を自動化せず既存executor境界を維持する。期限/追加予算/新規規制の追加条件はない（既回答）。
