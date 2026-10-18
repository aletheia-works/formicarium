# U2 技術選択

## 決定
ドキュメント根拠：既存TypeScript strict/ESM、Node/ブラウザWorker、既存wasm coreを維持する。Bunは依存管理・既存declared task用途で、Node consumerやWorkerを置換しない。新規依存・DB・認証・サービス・費用は導入しない。

| 対象 | 選択と理由 | 検証 |
|---|---|---|
| 公開API/型 | 既存TypeScriptとroot export、同期validateGuest/fixtureToFsEntries、非同期run/register | 型consumerとpack exports |
| SHA256/ELF | Node専用importに依存しない同期の共通実装。既存共通実装が要件を満たせば再利用し重複を避ける | 既知digest vector、境界ELF、3ブラウザ |
| 所有権 | private brand/WeakMap等でpackage-local handle、byte/metadataを防御copy | forged/別instance/後続mutation |
| 排他/取消 | ExecutionSessionが予約tokenとepochを所有し、既存Worker cleanupへ統合 | 決定的競合・旧release |
| 試験 | 既存node:test、Playwright、TypeScript、Biome、Istanbul。main session逐次実行 | 未検証。具体コマンドはCode Generation計画で確定 |

## 版と根拠の扱い
technology-stack.mdは調査時の宣言であり、現在の公開版やインストール版の証拠ではない。FR6の公開基準は既承認0.2.1、統合候補0.3.0で、private0.1.0-rc.1という旧調査値を基準にしない。固定tool版・pack/source/inventoryは実装計画と実行結果で照合する。

## 対象外
U3取得/展開、U4コマンド、ビルダー、端末、デモ、退役、実公開の実装は本単位へ混ぜない。アプリのruntimeをBunへ全面移行しない。
