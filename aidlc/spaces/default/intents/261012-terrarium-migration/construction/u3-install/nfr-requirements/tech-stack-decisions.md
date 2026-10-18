# installの技術選択

## Sources

technology-stack.mdの宣言、現行Node24/TypeScript strict ESM/Bun frozen/Playwright/Istanbul、C03/C04/C11とU3機能設計。宣言値はinstalled/配布互換の成功証拠ではない。

## Decisions

- 既存TypeScript/ESM配布とNode>=24/browser公開entryを使い、installを独立論理moduleにする。parser/builtinはU4、状態とguest検証はU2を再利用する。
- catalogはfactory callerからcopyして取得しない。固定snapshotで、外部latest解決/cache/builderを本体へ混ぜない。
- hostのHTTPS streamとgzip展開・tar検査を環境adapterで扱う。具体実装・依存追加の有無はNFR Design/コード計画で実assetと対応環境に照合して確定する。未確認ライブラリやbrowser APIの対応を保証としない。
- Nodeにorigin入力を追加せず、基準originのない相対URLを取得前INVALID_INPUTにする。browserは現在document originのみで相対を解決し、受入済みredirectなし同originミラーを固定する。URL受理の安全profileを環境ごと明示し、黙った推定・redirect fallbackをしない。
- 単調時計のdeadlineと操作signalを同じ寿命に置く。async cleanup/release、原子的commitの責任はU2、byte/reader/展開のcleanupはU3。progress callback例外は通知障害として扱う。
- main sessionで逐次、Node/3browser・tarballconsumer・rawcoverage/既存回帰/同候補CIを行う。U2固定成功の短い照合コマンドはU3改変後の証拠として再利用せず、新結果を用意し必要なコマンド承認を得る。

## Alternatives and Risks

catalog自動取得/最新解決は固定再現を壊すため採用しない。専用backend/永続cache/再試行は契約外。全archive検査と同期guest検証にはCPUコストがあるため正式36試行と取消境界で十分性を確認し、閾値を緩めない。browserのmulti-hop検査制約は受入済みsame-origin mirrorの配布構成で解消し、環境差を隠さない。

## Compatibility and Rollback

追加公開API/typesと生成JS/配布一覧をコード計画へ対応づける。新規依存を採る場合はlicense/noticesとbrowser footprintを確認し計画の明示承認で導入する。既存Session.runや公開0.2.1を変更済み/新公開済みと扱わない。jjでU3限定変更を戻し、旧登録・既存公開版は保持する。

## Assumptions & Open Questions

None.

