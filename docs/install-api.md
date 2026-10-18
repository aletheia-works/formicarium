# install API（U3 暫定候補）

呼出し元の固定カタログからゲストを取得・検証し、既存sessionへ登録するlibrary APIです。root entryから `createInstaller` と関連型を公開します。sessionは同じpackage instanceのNode又はbrowser entryで作成します。公開カタログの自動探索・latest解決・永続cacheはありません。登録名によるcommand実行は後続のU4です。

## 使用例

```js
import { createSession } from '@aletheia-works/formicarium/node';
import { createInstaller, ExecutionError } from '@aletheia-works/formicarium';

// catalogは呼出し元が別途用意した、固定URL・全digest・build情報を持つGuestCatalog。
const session = await createSession();
const controller = new AbortController();
try {
  const installer = createInstaller(session, catalog);
  const result = await installer.install('aube@2.7.0', {
    signal: controller.signal,
    onProgress(progress) {
      // UIへ出す場合はtextContent等で表示する。
      console.log(progress.phase, progress.processedBytes, progress.totalBytes);
    },
  });
  console.log(result.tool, result.versionOrName, result.digest, result.buildKey);
} catch (error) {
  if (error instanceof ExecutionError) console.error(error.code);
  throw error;
} finally {
  await session.dispose();
}
```

`catalog`は上記例への入力です。配信元URLやdigestを例示値で埋めず、呼出し元の検証済み情報を渡して下さい。browserではsessionのimportを `@aletheia-works/formicarium/browser` へ変更し、READMEのCOOP/COEP・Worker/assets・CSP要件も満たします。

`createInstaller(session, catalog): Installer` は同期的にsessionの真正性とカタログ全体を検証してcopyします。この時点では通信しません。元catalogの後続変更はinstallerへ反映しません。不正入力は同期的に `ExecutionError` をthrowします。

`installer.install(selection, { signal?, onProgress? }): Promise<InstallResult>` は一回の取得・検証・登録です。`tool`はdefaultsの版を選び、`tool@versionOrName`は完全一致するentryだけを選びます。未定義の既定版、未知の版、複数の `@`、URLをselectionとして渡す入力は拒否します。暗黙の版探索やretry/fallbackはしません。

## カタログの形

公開型はpackageの `GuestCatalog`、`CatalogEntry`、`GuestBuildInfo` を参照して下さい。

| GuestCatalogのfield | 内容 |
|---|---|
| schemaVersion | 数値の1 |
| catalogId | 空でない識別文字列、UTF-8最大128bytes |
| defaults | tool名から固定versionOrNameへの参照。各参照先entryが必要 |
| entries | CatalogEntryの配列。tool/versionOrNameの重複は不可。空配列は有効だがinstallは解決不可 |

| CatalogEntryのfield | 内容 |
|---|---|
| tool / versionOrName | metadataと一致する固定識別子 |
| url | credential・fragmentのないHTTPS URL |
| format | `elf` 又は `tar.gz` |
| archiveEntry | tar.gzの選択先。相対POSIX path。elfでは指定しない |
| downloadSha256 / downloadBytes | 配信byte全体のSHA256と実byte数 |
| elfBytes | 取得又は抽出したELFの実byte数 |
| buildInfo | GuestBuildInfo全体 |
| buildInfoSha256 | buildInfoのcanonical JSON UTF-8 byteのSHA256 |

SHA256は小文字16進64桁です。raw ELFはdownloadBytesとelfBytes、downloadSha256とbuildInfo.elfSha256がそれぞれ一致する必要があります。tar.gzは圧縮byteと選択ELFのidentityを別々に指定します。

GuestBuildInfoはschemaVersion、tool、versionOrName、sourceのHTTPS repository/full40桁commit、target=`x86_64-unknown-linux-musl`、rustc（文字列又はnull）、sourcePatches、dependencies、builderHash、buildKey、elfSha256を持ちます。依存とpatchにも固定identityが必要です。buildKeyとcanonical metadata digestはC03と同じ規則で検証します。未知のJSON fieldもcopy・canonical identityへ保持するため、digestを作る際に削除しないで下さい。

APIは既にobject化されたJSONから失われた重複keyを復元できません。raw JSONを読む呼出し元で重複keyを拒否して下さい。lone surrogate、循環、非整数値等はcanonical入力として拒否します。

## 取得環境と上限

Nodeは24以上で、絶対HTTPS URLを渡します。browserの相対URLはdocument originにだけ解決し、その結果にもHTTPSを要求します。Nodeに暗黙のoriginはありません。browserではCORSとCSPのconnect-srcを配信元に合わせて下さい。

credentialsはomit。Nodeは各redirect先を検査し最大5hop、browserはredirect:errorで追従しません。browser向けのassetにはredirectしないURLを指定します。HTTP、CORS不可、opaque、不正status、中断したbodyを成功へ置換しません。

| 境界 | 上限 |
|---|---|
| catalog / canonical build metadata | 4MiB / 1MiB |
| download / ELF | 各128MiB |
| archive展開全体 / entry数 | 256MiB / 4096 |
| archive path | UTF-8で4096bytes |
| fetch / install全体 | 120秒 / 180秒 |

取得物全体とELFのdigest・宣言byte数・metadataを照合します。tar.gzはDecompressionStreamを利用し、全entryの境界・path・重複・リンクと終端を検査してから選択ELFを採用します。ホストFSへ展開しません。真正なC03 handle付きcopyだけをsessionへ登録し、取得byteの参照は返しません。

## 排他、取消と結果

install・run・登録・FS操作は同sessionの共通予約を使い、競合は待たず `BUSY` で拒否します。成功時だけ同toolのguestを原子的に置き換えます。取得・検証の失敗やcaller取消で旧guestとFS/cwdを部分更新しません。`reset()`/`dispose()`自身が持つ全登録消去の意味は維持します。

AbortSignal、reset、dispose、deadlineを確認して後始末します。同期C03検証中の即時中断を保証せず、完了直後にも取消・時間を確認します。最初に確定した終端理由を保持し、遅い応答から登録や通知を再開しません。commit後のabortで成功を失敗へ巻き戻しません。

InstallResultは `operationId`、`tool`、`versionOrName`、ELFの `digest`、`buildKey` です。GuestHandleや実行出力を含みません。

ProgressはoperationId、増加するsequence、phase（fetch→extract〔tar.gzのみ〕→digest→validate→register）、processedBytes、totalBytesを持ちます。未知のtotalBytesはnullで、0と区別します。通知callbackの例外はinstallのcommit結果を変えず、終了後には通知しません。callbackから同sessionの操作へ再入するとBUSYになり得ます。

| エラーcode | 主な条件 |
|---|---|
| INVALID_INPUT | catalog/selection/size/archive/ELF/digest/metadata不正、偽造session |
| ASSET_LOAD | HTTP/CORS/redirect/body/通信の失敗 |
| UNSUPPORTED_ENV | 必要な環境機能の欠落 |
| BUSY | 同sessionで他の操作が予約中 |
| ABORTED / DISPOSED / TIMEOUT | caller/resetによる取消、dispose、deadline |

## 検証の範囲

検証済み：ローカルU3候補のNode単体74件、Chromium/Firefox/WebKitのconsumer・独立SHA照合45件。README更新前の候補ではaube/Biome×3browserの36試行も成功しました。この文書とREADMEの追加後はpack/source identityが変わるため、新候補を準備して性能・coverage・CIを対応付け直します。

正式U3受入れ、同候補の全配布JS coverage80%以上、既存回帰、署名付き専用CI、最終レビュー・完了確認は未完了です。実機Safariは未検証。暫定候補の成功をnpm公開、terrarium退役又は後続U4の完成とは扱いません。
