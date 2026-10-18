# 実行担当と引継ぎ

## Sources

`bolt-plan.md`、`../units-generation/unit-of-work.md`、`../contract-design/contract-summary.md`。チーム形成は今回対象外、ユーザーは本チャットの節目報告を選択済み。

## Allocation

全9 Bolt（単位の設計・実装・検証を完了する作業）の実装担当は `aidlc-developer-agent`（AI）。本セッションが既存の進行設定に従って担当し、別の人間チームや新しいチャットへ割り当てない。複数repoを跨ぐためworkspace rootのみを前提とするteam ownershipは採らない。設計は該当stageの責任者、検証はquality責任者、レビューはstageが指定した独立担当が行う。これらは役割分担で、重い並行実行の許可ではない。

| 範囲 | 実装責任 | 状態/契約所有 |
|---|---|---|
| U1/U9 | aidlc-developer-agent | MigrationAcceptance、初期/最終証拠を分離 |
| U2/U3/U4 | aidlc-developer-agent | Session/検証、install、commandを別モジュールで所有 |
| U5/U6 | aidlc-developer-agent | 固定buildとrecipe/verdict/fixtureを分離 |
| U7/U8 | aidlc-developer-agent | 候補供給とサイト消費、同candidate identity |

## Integration Discipline

各repo変更前にAGENTS/現在source/試験/infra状態を確認し、コード計画にファイル所有と触る範囲を列挙する。他作業の変更を戻さず、変更が競合したら具体差分で調整する。jjの短命bookmark/既存main統合規則を使い、push/公開の具体承認を得る。兄弟repoへ変更できない権限は実作業時に必要な範囲で解決する。ビルドとテストはmain sessionで逐次、個別公開対象と承認照合もmain sessionが確認する。秘密を引継ぎ資料へコピーしない。
