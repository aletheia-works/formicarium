# 固定guest buildの基盤の確認

## Sources

`../nfr-design/security-design.md`（D1–D9、人間の回答Q1–Q6はすべてA）、契約C07・C11・C12、`../nfr-requirements/tech-stack-decisions.md`。

## Assumptions & Open Questions

None.

新しい方針の選択はない。実行場所（vivariumのGitHub Actions）、cache（mbxとGitHub Actionsのcache）、保存先（vivariumのGitHub Release）、直列化、承認の形は、NFR RequirementsとNFR Designで決まっている。次のものは、Code Generationの計画の前に調べて、実際の値を示して確かめる。
- runnerのlabelと最新のimage
- environmentと承認者の設定
- Actionsの分数・cache・storageの残り枠
- vivariumの構成

設定の外部への適用と新しい費用は、対象を示して承認を受ける。成功や費用ゼロは仮定しない。
