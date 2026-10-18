# Requirements Analysis Questions

## 既存回答

- Bunとbun.lockへの移行、publish以外の通常CI・保守workflow導入：初期依頼で確定。
- RC受入れとは別開発：人間の回答で確定。
- 整形pushとCI合格した小さい依存更新の条件付き自動merge：practices Q1 Cで確定。
- jj、既存品質基準、Node/ブラウザconsumer互換性、公開の個別承認：承認済み実践から継承。

## Sources

- business-overview.md：Node/browser consumerという製品の利用経路を維持する。
- architecture.md：共通runtime、adapter、公開検査の境界を維持する。
- code-structure.md：TypeScriptと生成JS、既存script/task配置へ適合する。
- team-practices.md：Bun移行、通常CI、条件付き自動修正push・依存更新mergeという承認済み方針。

## 追加質問の判断

追加の人間判断が必要な質問はない。具体版、対象条件、チェック名、cache、token方式は設計で実証する。自動mergeはstable patch/minorの直接依存1件へ限定し、0件・2件以上・pre-release・major・workflow・公開境界・未確認更新は手動とする。整形pushは信頼したツール・設定から再現できる差分との完全一致を要求する。これらは指摘の修正依頼に基づく具体的な要件案で、要件承認時に変更できる。
