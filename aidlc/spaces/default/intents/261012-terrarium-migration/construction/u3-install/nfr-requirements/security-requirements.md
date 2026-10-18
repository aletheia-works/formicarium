# installの品質・安全要件

## Sources

機能設計functional-spec.md/rules.md、承認済みC02/C03/C04/C11、inception NFR1–4/6–8、現状technology-stack.md。ドキュメント根拠。U3の動作・性能・sensor成功は未検証。

## Requirements

| ID | 分類 | 合格条件 | 検証 |
|---|---|---|---|
| NFR1.1 | 性能 | aube/Biome×3browser×初回+5回、U1固定入力の正式install→U2 --version。非DL5工程合計のtrial1–5中央値≤3000ms、初回/最大/fetch別記録。 | monotonic clock、host負荷記録、重い並行処理なし、36行一意の証拠 |
| NFR2.1 | 品質 | probe≤600s/8項目、aube browser≤840s、worker1/retry0/native一致/wasm1GB/waitAsync削除を維持。 | 既存回帰、同候補consumer/CI、未変更aube再buildなし |
| NFR2.2 | 品質 | U3追加JSを含む第一者配布JS固定分母でcoverage≥80%。worker/process/realm欠落・skip拒否。 | 同source/pack、raw計測と全inventory、CIログ照合 |
| NFR3.1 | 入力 | catalog全体copy/全entry・default一意、schema/identifier/URL/宣言byte/metadata/identityを検証。 | 空/duplicate/default不正/未知field/version/元object変更/偽造Session拒否 |
| NFR3.2 | 資産 | DL/ELF128MiB、展開合計256MiB、4096entry/path4096bytes、metadata1MiB/catalog4MiB。checked integer、境界含む。 | −1/境界/+1、実byte不一致、overflow、全entryのescape/duplicate/link loop/truncate/bomb拒否 |
| NFR3.3 | 所有 | download digestと抽出ELF digest、全metadata identityを照合しU2 brand付きcopyのみ登録/実行。 | 偽造handle/不正ELF/digest/metadata拒否、後続byte変更不変 |
| NFR4.1 | 取得 | fetch120000ms、予約からcommitまで180000ms、clockがdeadline以上でTIMEOUT。HTTPS/credential omit/最大5hop全hop検査。 | 遅延body/redirect/opaque/CORS/HTTP/offline/429/中断、retry/fallbackなし |
| NFR4.2 | 寿命 | reset/dispose/abortでreader/展開task/候補を中止しcleanup完了を待つ。旧epochのcommit/通知/releaseは新操作を変更しない。 | 同session競合、late response、失敗旧登録保持、reset/disposeの全登録消去 |
| NFR6.1 | 互換 | Node>=24、Chromium/Firefox/WebKitで同公開installを受入。COI/SAB/Worker/waitAsyncと既存CSPを維持。Safari実機は別証拠まで未検証。 | 対応機能欠落はUNSUPPORTED_ENV。Nodeのbase originなし相対URLは取得前INVALID_INPUT、callerはHTTPS絶対URLを渡す |
| NFR7.1 | 通知 | Progress operation/sequence/phaseと非負byteを保持、unknown=nullと0を区別。callback例外でcommit結果を変えず、終了後通知なし。 | 各phase/再入/例外/取消後通知、consumerでtext表示しHTML実行なし |
| NFR8.1 | 証拠 | source/pack/catalog/guest/metadata/buildKey/最終URL/実環境を同じ操作と受入結果へ対応付ける。 | 別candidate/架空digest/skip/欠落を成功に置換しない、U4後B1と区別 |
| NFR8.2 | 運用 | 本単位で新費用/認証/公開/退役/外部write権限を導入しない。秘密/body全文をログへ出さずlicense/notices保持。 | 依存/配布点検とjj切戻し手順、新規費用・外部操作は具体承認後のみ |

## Threats and Boundaries

callerのcatalogは信頼済みと推定せず全体検証する。HTTPSだけでも資産・metadataの出所を保証しないため全digest/identityを別途照合。browserは検査不能redirectを受理せずU1受入ミラーのredirectなしprofileを使う。Nodeに暗黙のhost基準originは存在しないので相対URLを勝手にlocalhostへ補完しない。公開shapeはC04のまま、base origin引数を追加しない。

archiveはselected entryだけでなく全内容を検査する。ホストFSへ展開せずmemoryの一時候補、登録はU2 token/epoch ownerへ委任。cancel/deadline確認のない長い同期処理を取消可能と主張せず、chunk境界の観測で遅いcommitを防ぐ。サイズと時間だけでbrowserのresponsive性を証明せず実測する。

## Applicability

NFR5の同build-key永続cache/publish直列化はU5/U7/U8で、本単位は非永続install。NFR5はN/Aだが原子的置換・排他はNFR4.2で適用。libraryなのでservice availability/tenant認証/DB/backup/自動監視dashboardは追加しない。性能・信頼性・通知条件はこの必須資料に保持する。法的適合の新規主張は行わない。

## Assumptions & Open Questions

None.

