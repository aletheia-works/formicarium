# installの安全性・寿命設計

## Sources

U3 security-requirements.md（NFR1.1/NFR2.1–2.2/NFR3.1–3.3/NFR4.1–4.2/NFR6.1/NFR7.1/NFR8.1–8.2）、tech-stack-decisions.md、functional-spec.md、C02/C03/C04/C11。以下はドキュメント根拠で、実装・互換性・性能は未検証。

## D1: 不変catalogと解決境界

factoryでU2真正Sessionを確認しcatalogをdeep copy、全field型とUTF-8容量、schema/identifier/必須metadata/entry組/default参照を検査する。metadataはU2 canonical identity規範を共有し、未知fieldもhashへ含める。factory後に元objectが変わっても取得URLや期待digestを変更しない。selectionはexact grammarだけで、HTTP/URL/未知版をcommand入力で渡せない。Nodeのbase originなし相対URLは通信前INVALID_INPUT、browserはdocument originにだけ解決する。公開factoryにbaseURL等を追加しない。

## D2: 有限HTTPS byte stream

取得adapterはNodeのmanual redirectを最大5hop、全hop HTTPS/userinfoなし/loopなしで確認しcredentials omitを維持する。browserでは受入済みredirectなしsame-origin mirror profileを使いredirect:errorで追従せず、Opaqueや実response redirectを受理しない。任意のcross-origin Releaseへの暗黙fallbackは行わない。C04/C11のHTTPS絶対URLを一律同originへ書き換えず、browserで各hop確認を保証できない経路はASSET_LOADとして拒否する。

readerの各chunkでchecked cumulative byte、宣言downloadBytesと実累積・上限128MiB・signal/deadlineを検査する。Content-Lengthは証拠の実数や上限の根拠にしない。fetch120sはDNS/redirect/body完了まで、install180sは予約からcommitまでmonotonic clockで判定。deadline以上で終了を確定しreader.cancel/response abort/redirect継続停止を待つ。ストリーム停止で旧session状態を変更しない。

## D3: 全archive検査とdigest

既存試行のDecompressionStream gzip経路を実assetで確認した設計根拠として使い、製品コードは開発scriptをimportしない。実装候補はhost stream adapter＋逐次gzip出力＋bounded tar scanner、追加依存なしの構成。対応機能欠落はUNSUPPORTED_ENVで、同期全量展開を取消可能と偽称しない。Node/browserで実asset、異常gzip、末尾/truncateを試験してコード計画で確定する。

取得byte copyのdownload digestを照合し、不一致は展開前短絡。tar全体は512byte header/blockを逐次読み、checksum/numeric範囲/body長/padding/end marker/末尾整合を検査する。展開byte累積は全header/padding/metadataを含め256MiB、entry countはmetadataを含め4096、path UTF-8は4096bytes。USTARの通常file/directory/symlink/hardlinkと、実資産に必要なGNU longname/PAX path/linkpath拡張を検査対象とし、未知/unsupported/sparse/device型はINVALID_INPUT。拡張metadataも制限し、raw key重複と不正長/文字を拒否、次entryへの適用範囲を限定する。

各pathをguest POSIX規則で正規化し絶対/NUL/../escape/重複を拒否。directoryは仮想archive構造だけ、host FSへ書かない。linkは全entry図で解決しroot外/loop/不存在参照を拒否。選択entryは最終解決が一意のregular fileでなければ拒否。選択外entryも全て検査し、危険なentryを無視して通さない。hardlink payloadの重複を実byte量として偽装せず、展開bytes/entryと選択ELF実bytesの両上限を適用する。

digest phaseは取得物hashと抽出ELF hashの計算時間を合計して記録する。展開前download hashを計算しても通知phaseを早くdigestへ進めず、extract後にdigest通知を行う。early hashの時間をfetchへ紛れ込ませず非DL集計に含める。U2 validateGuestへC03のexpected全identityを渡し内部所有copyを得る。候補byte bufferの参照を公開しない。

## D4: 操作寿命と原子的登録

OperationLifetimeが予約と外部signalを統合、単調deadline・終端原因・cleanup taskを持つ。全chunk/redirect/検証前/commit前でaliveを確認。CPU scanner/digestの分割境界ではhostのevent loopへyieldし、timer/reset/abortを処理する。U2同期validateGuestは有限sizeの処理なので完了直後にも現在clockとsignalを確認し、処理中をabortできたと主張しない。

C02 commitGuestでtoken/epoch/active一致のみ登録。同一tool置換は1回、候補のみを入れる。終端理由は先着確定でlate callbackが上書きしない。cancel/deadline後は候補破棄、reader・decompression・scannerの終了、listener/timer除去、token一致releaseを全finallyで実行。古いreleaseが新予約を解放しない。reset/disposeはU2のepoch変更と全登録消去を維持し、cleanupを待つ。成功前の一時データをsession FS/cwdへ反映しない。commitが先に完了した場合と取消が先の場合を所有者の原子的判定で区別し、完了後のabortで成功を偽って巻き戻さない。

## D5: 進捗と診断

operationId/sequence/phase/processedBytes/totalBytesだけを通知。phase順fetch→extract（必要時）→digest→validate→register、phase内非減少。totalが不明ならnull、既知0なら0。callback例外は通知障害を内部bounded診断へ記録しPromise/commitを変更しない。秘密・URL userinfo・response全文・guest出力を診断へ流さない。callback再入は同じ予約のBUSYで保護、処理終了/取消後はnotifyできない。UI側はtext-onlyで描画し通知をguest出力や登録のauthorityと扱わない。

## D6: 性能・配布と受入証拠

正式36試行はU1固定のaube/Biome ELF/build-infoとcatalogを使い、同じlog schema・3browser・6回を操作IDで一意化。fetchと非DL5工程の実時間を分離、trial1–5合計median≤3000ms、初回/最大/host負荷を記録。chunk化の十分性は取消と計測で確認、180sのtimeoutで3s目標を代替しない。

U3追加JSを第一者固定coverage inventoryに追加し、Node/worker/process/browser realmsの期待集合も更新、raw countersと同packの分母を確認する。既存probe/aube/native/1GB/waitAsyncとNode/3browser tarballconsumer・型・配布検証を逐次実施。CIは同じsource/packを使用して署名と証拠を照合。U2専用短い照合commandはU3の新成功に付け替えず、新全実行と固定証拠を準備し人間に新commandを提示する。公開やB1統合成立は別のU4/具体承認まで行わない。

## Threat Response and Rollback

不正URL/body=ASSET_LOAD、不正catalog/size/archive/digest=INVALID_INPUT、競合BUSY、取消ABORTED/廃棄DISPOSED、期限TIMEOUT、環境不足UNSUPPORTED_ENV。全失敗で候補を破棄、旧登録/FS/cwd保持（reset/disposeの意図した消去を除く）。新費用/常駐service/認証/DB/永続cache/自動retryなし。jjでU3の対象変更だけ戻し既存公開版保持、license/noticesは配布境界で確認。

## Assumptions & Open Questions

None.

