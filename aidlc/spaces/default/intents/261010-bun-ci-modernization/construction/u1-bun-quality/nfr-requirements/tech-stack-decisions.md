# Tech Stack Decisions — U1

## Selections

| 技術 | 選択 | 根拠と代替案 |
|---|---|---|
| 依存管理 | Bun1.4.2とテキストbun.lock | mise ls及び実体bun --versionで1.4.2を観測。既存候補CIの版とも一致。latest可変参照は再現性のため採らない |
| Node境界 | Node24.21.0を開発・CIの検証版に固定 | mise lsで確認。公開engines>=24は維持。node:test、Node専用flags、workerと生成処理をBunへ一括置換しない |
| authoring | 既存TypeScript・ESM、Biome、Playwright、Istanbulを維持 | manifestとCodeKBの現行観測。移行に無関係なtool刷新はしない |
| CI | GitHub ActionsのPR/main軽量検査と明示した候補回帰 | 公開専用verifyだけでは日常CIにならない。全guest再ビルドを各PRへ追加しない |
| ローカル入口 | mise taskとbun run | 宣言taskをローカル/CIから利用。Node必要な処理はtask内で明示 |

## Validation and Scope

Bunのinstall動作、text lock移行、型検査・生成・test互換は未検証。導入時に既存lockの解決版を保持できるか検証し、意図しない依存更新を混ぜない。差分があれば原因と採否を記録する。Bunの依存lifecycle script許可は実際の依存一覧に基づいて必要最小限にする。

U1は新database・サービス・公開APIを追加しない。技術選択の観測は版の存在のみで、最新公式版・互換性・運用成功を意味しない。RCタグ・固定入力・dist-tagは変更しない。

## Sources

../../../inception/requirements-analysis/requirements.md、../../../inception/contract-design/contract-summary.md、aidlc/spaces/default/codekb/formicarium/technology-stack.md。main sessionのmise ls、Bun実体 --versionは観測済み。生成物・consumerとCIの実行はCode Generation／Build and Testで確認する。
