# NFR Design Questions — U4

## Questions

None. NFR11件とC1/C2を満たす、既存公開境界の局所適合を設計する。公開権限のないjobで固定実行資産を作り、書込側で独立照合する方式を採る。

## Ambiguity Analysis

将来版の構文受入れと公開承認を分離する。npm CLIは開発依存ではなく固定公開executorとして供給する。job artifactの自己申告allowやdigestだけを信頼しない。U3の未解決レビュー指摘は別所有のまま記録する。

## Assumptions & Open Questions

None. 実GitHub/OIDC動作は外部検証前に未検証とする。
