# U3 installの機能仕様

## Sources

inception/units-generation/unit-of-work.mdとunit-of-work-story-map.md、requirements-analysis/requirements.md、domain-design/components.md、contract-design/contract-summary.md C02/C03/C04/C11。要件はFR4主担当、FR1/FR5/FR6共同担当。設計はドキュメント根拠、U3の動作・性能は未検証。承認済みU2を前提とし、本資料はB1や公開完了の証拠ではない。

## Public Boundary

createInstaller(session,catalog)がcatalogを検証/copyし不変snapshotとして保持する。Installer.install(selection,{signal,onProgress})の返値はC04のInstallResult（operationId/tool/versionOrName/digest/buildKey）。factory自身は通信しない。公開shapeは承認済みC04のまま、URL/metadata/assetはcallerのcatalogだけから取得する。コマンドの解析はU4、byte検証はU2、登録状態はU2が唯一のowner。

## Workflows

### 正常導入・再導入

1. factoryで同packageの真正Session、schemaVersion=1、catalog全体・全entry・defaultsの一意参照・C11のserialized容量・field型を確認しdeep copy。未知付加fieldは正規化identityに含める。JSON object入力では既に失われた重複keyは復元できないため、raw JSONをobject化するcaller境界でduplicate key/孤立surrogateを拒否する。array内の重複tool/versionはfactoryが拒否する。
2. selectionをtool又はtool@versionOrNameとしてexact解決。省略版はdefaults[tool]のみ。固定recipe名をlatestへ置換しない。空catalogは有効な空snapshotで、installはunknownとして拒否。存在するdefaultsが不存在entryを指すcatalogは不正。
3. U2 C02からkind=installの予約を一度取得。既存run/FS/installとの競合は待たずBUSY。同じ予約を内部継続へ渡し、公開登録APIの再acquireを呼ばない。
4. hostで明示URLを取得。HTTPS絶対又は同origin相対、userinfoなし、credentials omit。Nodeは各redirectを検査し最大5hop。ブラウザで全hopを保証できない資産は、U1受入済みのredirectなし同originミラーをcatalogに固定し、別URLを自動探索しない。返されたredirect/opaque/CORS不可/非2xxを拒否する。Content-Lengthは進捗の参考に留め実byteを累積し、downloadBytesと完全一致を確認。
5. 取得物全体のdownloadSha256を照合。elfならそのbyteを候補としextractなし。tar.gzなら全entryを正規化し、全entryの境界/重複/links/loopを検査した後archiveEntryの一意ELFを得る。展開処理はguest FSへ書かず一時byteで完結する。gzip解凍とtar解析の全体完了を確認し、途中entryだけ成功扱いしない。
6. ELF実byte数とelfSha256、metadata canonical digest/source/buildKey等をC03 validateGuestへ渡して確認。検証したcopy/brandのGuestHandleのみ継続する。取得byteや元catalogを変更してもその後の実行を変えない。
7. register工程で現行token/epoch/abort/deadlineを再確認しC02 commitGuest。成功再installは同toolのみ原子的置換。commitとreset/disposeの順序はU2の所有者が直列化し、先に取消された操作が後から復活しない。
8. 成功結果をresolve。失敗は既存ExecutionErrorでrejectし、取得reader/展開task/一時候補とlistener/timerをcleanup後、token一致でrelease。reset/disposeはこのcleanupを待つ。どの経路もsession FS/cwdの部分更新をしない。

### 取消・遅延応答

事前abortは通信前ABORTED。予約後はsignalとU2 reservation.signalを統合し、resetでABORTED、disposeでDISPOSED、有限deadlineでTIMEOUTを確定する。最初に確定した終端理由を維持し遅いreader/展開結果/callbackから上書きしない。取消確定後には通知とcommitを止め、cleanup完了後に終了する。失敗前の旧guestは保持する。ただしreset/dispose自体が明示的に全登録を消去する意味は維持する。

## State Machine

reserved→fetching→extracting（tar.gzのみ）→digesting→validating→registering→committed。digest工程で取得物digestと抽出ELF digestを扱い、取得物checksum失敗は展開前に短絡できる。各非終端状態からfailed/cancelled/timed-outへ遷移可能。終端状態から継続・再通知・再登録しない。再実行は新operationId/予約で開始する。

## Limits and Errors

| 境界 | 上限/失敗 |
|---|---|
| catalog / metadata | 4MiB / 1MiB、canonical UTF-8 byte数、超過INVALID_INPUT |
| download / ELF | 各128MiB、宣言実数一致、+1はINVALID_INPUT |
| 展開合計 / entry / path | 256MiB / 4096件 / 4096 UTF-8 bytes、境界値許容 |
| fetch / install | 120000ms / 180000ms、単調時計・wall time、deadline以上TIMEOUT |
| URL/取得 | HTTP/CORS/opaque/429/offline/body不正=ASSET_LOAD、自動retryなし |
| 解決/検証 | unknown/ambiguous/digest/metadata/ELF/archive不正=INVALID_INPUT |
| 競合/取消/寿命 | BUSY / ABORTED / DISPOSED、旧予約は新予約を解放しない |
| 環境不足 | 必要機能なしUNSUPPORTED_ENV、成功を捏造しない |

count/byte/offsetはchecked arithmetic、finite safe integer、負値/NaN/Infinity拒否。リンクはarchive root内へ全体解決し、循環と脱出を拒否する。正規化重複entry/選択先不存在/非file/破損header/未対応entry種は拒否し、host pathへ解決しない。未知tar metadata等の形式の具体対応は実asset照合を伴うコード計画で明示する。

## Progress and Measurement

operationごとsequenceを厳密増加させphase順を維持。処理量は工程内で非減少、totalBytes=nullはunknown、0と区別。fetch/extract/digest/validate/registerの処理量を通知し、非byte操作でも実処理対象byte数を使い架空の完了量を作らない。再入callbackが別操作を呼ぶと同じ予約境界でBUSY。callback例外は通知障害として内部診断し導入のcommitやPromise結果を変更せず、秘密/response全文は記録しない。完了/取消後通知しない。UIはconsumer側でテキスト表示しHTML/code評価しない。

正式経路でaube/Biome×Chromium/Firefox/WebKit×初回+連続5回の36試行を記録する。U1と同じ入力identity/phase schemaで、fetchを分離、extract/SHA256/ELF・build-info/register/--version合計のtrial1–5中央値≤3000ms、初回/最大/各工程とhost負荷を残す。install上限180sは性能閾値の代替でない。--versionはinstall結果後にU2の検証byteを使用し、既存probe/aube上限を維持する。

## Derived Model and Rules

データモデルの規範はentities.mdのYAML、ルールの規範はrules.mdのYAML。図のテキスト代替としてCatalogSnapshot(1)→CatalogSelection(n)、CatalogSelection(1)→InstallOperation(n)、InstallOperation(1)→InstallProgress(n)。InstallOperationは外部owner U2のSessionStateへ参照するだけ。図は追加しない。

| ルール群 | 導出された意味 |
|---|---|
| BR3.1–3.2 | catalog snapshotと一意選択 |
| BR3.3/3.7/3.8 | 共通予約、原子的登録、取消とcleanup |
| BR3.4–3.6 | 取得・全archive・digest・公開検証 |
| BR3.9–3.10 | 進捗と正式経路受入 |

## Acceptance Scenarios

- Node/3browserのelfとtar.gz成功、default/exact固定名、原byte/catalog変更後の検証copy実行。
- 空/未知/任意URL/複数@/duplicate catalog/default欠落、偽造Session、未知schema、unknown追加fieldを受理しidentity保持。
- 上限−1/上限/+1、宣言size不一致、HTTP/CORS/offline/429/redirect/loop/body中断、archive escape/duplicate/link loop/truncate/bomb/選択外の悪性entry。
- 同sessionのinstall×install/install×run/install×FS、callback再入、再install失敗旧登録保持、reset/dispose/abort/timeout後遅延取得・展開・commit拒否、新epochが旧releaseで消されないこと。
- callback例外・unknown total・phase順/sequence・取消後通知なし、UTF-8/path境界、原本byteが通知/UIで変更されないこと。
- 同source/packの公開consumer、types/全配布inventory/第一者JS全realm80%/CI/既存回帰、正式経路36試行。U3単位成功だけではU4 commandやB1統合成功を主張しない。

## Corner Sweep and Scope

本体はcaller所有の単一sessionのlibrary。catalog/文字/数/時間/ネットワーク/一時byte/競合のcornerを上記規則へ展開した。永続cache、host file保存、マルチテナント認証、費用発生、UIデザイン、公開/退役、固定buildは対象外。未知外部形式の対応は実assetで検査し、未対応を黙って成功扱いしない。

## Assumptions & Open Questions

None.

