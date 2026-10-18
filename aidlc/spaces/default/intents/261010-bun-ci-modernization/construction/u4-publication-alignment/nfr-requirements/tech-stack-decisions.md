# Tech Stack Decisions — U4

## Decisions

| 技術 | 判断・根拠 | 適用と限界 |
|---|---|---|
| Bun1.4.2 + bun.lock | U1の固定開発基盤を再利用し、frozen/ignore-scriptsを維持する。 | 開発依存導入・build。U1の所有taskを勝手に変更しない。 |
| TypeScript7.0.2 / Node24.21.0 | 既存strict TS・生成JSとNodeの公開CLI/consumerを維持する。 | runtimeをBunへ一括置換しない。 |
| npm11.19.0 | npm OIDC公開executorとして既存固定版を維持する。開発依存管理には使わない。 | npm公式文書はtrusted publishingにnpm11.5.1以上とNode22.14.0以上を要求する。Bunだけで同等の公開保証があると推定しない。 |
| GitHub Actions / release environment | 現行publish.ymlと版別承認を保持し、read検証→固定資産→目的別writeへ接続する。 | 長期npm tokenを新設しない。外部environment/Trusted Publisher設定変更は今回実施しない。 |
| 既存公開CLI + C2 adapter | schema・署名・候補/承認/provenance/coverage境界を再利用し、U1検証証拠のpurposeと独立identityを照合する。 | ordinary-ciは公開証拠に使わない。新規公開サービス/library APIを増やさない。 |
| node:test / Biome / actionlint | 実公開せず正常引数と拒否時executor0回、workflow構成、生成資産一致を検査する。 | ローカルfakeが実GitHub/OIDC成功を示すとは扱わない。 |

## Sources and Status

ドキュメント根拠：[npm trusted publishing](https://docs.npmjs.com/trusted-publishers/)、[setup-node公開jobのcache注意](https://github.com/actions/setup-node/blob/main/docs/advanced-usage.md)。固定npm11.19.0の選択は現行publish.ymlのsource根拠で、最新版を採用する提案ではない。

U1の版/taskを利用する設計で、U4の実装・OIDC互換性・candidate証拠統合は未検証。新しいnpm依存やサービスを導入する判断はない。
