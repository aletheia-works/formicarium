---

title: install API
description: 固定のカタログからゲストを取得・検証し、登録します。
---

`createInstaller` は、呼び出し元が用意したカタログからゲストを取得・検証し、既存の Session に登録します。
root entry から、関連する型と一緒に公開しています。Session は、同じパッケージの Node.js 用か
ブラウザ用の entry で作ります。公開カタログの自動探索、「最新」の解決、永続的なキャッシュはありません。
登録した名前でゲストを実行するのは [command API](/formicarium/ja/guides/command-api/) です。

## 使用例

```js
import { createSession } from '@aletheia-works/formicarium/node';
import { createInstaller, ExecutionError } from '@aletheia-works/formicarium';

// catalog は、固定の URL・すべての digest・ビルド情報を持つ、呼び出し元が用意した GuestCatalog。
const session = await createSession();
const controller = new AbortController();
try {
  const installer = createInstaller(session, catalog);
  const result = await installer.install('aube@2.7.0', {
    signal: controller.signal,
    onProgress(progress) {
      // UI に出すときは textContent などで表示する。
      console.log(progress.phase, progress.processedBytes, progress.totalBytes);
    },
  });
  console.log(
    result.tool,
    result.versionOrName,
    result.digest,
    result.buildKey,
  );
} catch (error) {
  if (error instanceof ExecutionError) console.error(error.code);
  throw error;
} finally {
  await session.dispose();
}
```

カタログには、呼び出し元が検証した情報を渡してください。URL や digest を例の値で埋めないでください。
ブラウザでは `createSession` を `@aletheia-works/formicarium/browser` から import し、パッケージの README にある
cross-origin isolation・Worker・資産・CSP の要件を満たしてください。

`createInstaller(session, catalog): Installer` は、Session が本物かを確かめ、カタログ全体を検証してコピーします。
処理は同期的で、通信はしません。元のカタログを後から変えても、インストーラには反映しません。
不正な入力では、同期的に `ExecutionError` を投げます。

`installer.install(selection, { signal?, onProgress? }): Promise<InstallResult>` は、1 回の取得・検証・登録です。
`tool` は `defaults` の版を選び、`tool@versionOrName` は完全に一致する entry だけを選びます。
既定の版がない、未知の版、`@` が複数ある、selection に URL を渡す、といった入力は拒否します。
暗黙の版の探索、再試行、代替はしません。

## install で得られるもの

install が成功すると、ゲストはツールの名前で Session に登録され、`reset()` か
`dispose()` まで残ります。[command session](/formicarium/ja/guides/command-api/)
の `install <tool>` は、この install そのものです。登録の後は次のようになります。
- command session で、ツールを名前で実行できます。
- どのゲストの実行からも `/usr/bin/<tool>`（既定の PATH の上）として見えるので、
  ツールから別のツールを起動できます。
- どの出力にも何も書かないので、page は利用者が何か打つ前にツールを導入できます
  （[組込みのガイド](/formicarium/ja/guides/embedding/#最初からツールを入れておく)を参照）。

カタログから来ないゲストの bytes を登録するには、`validateGuest` で確かめてから、
その結果を `registerValidatedGuest(session, tool, guest)` に渡します。登録の
振る舞いは同じです。

`validateGuest(bytes, { elfSha256, buildInfoSha256, identity })` は、static な
x86-64 の ELF そのもの（128 MiB まで）と、それがどうあるべきかを受け取ります。
`elfSha256` は bytes の SHA-256、`identity` はその `GuestBuildInfo`（その中の
`elfSha256` も同じ値）、`buildInfoSha256` は `identity` の正規形（下記）の SHA-256 です。
どれかが合わなければ `INVALID_INPUT` です。返す handle は凍結され、`digest` と
`buildInfo` を見せます。後で受け付けるのは `validateGuest` が作った handle だけです。
`runValidatedGuest(session, guest, options?)` は、その handle を登録せずに 1 回
実行します。options は `guest` を除いた `session.run` のものです。
`registerValidatedGuest` は `{ signal }` も受け取り、予約を取る前か後に signal が
abort していれば `ABORTED` で、何も登録しません。

## カタログ

公開している型は `GuestCatalog`、`CatalogEntry`、`GuestBuildInfo` です。

| `GuestCatalog` の項目 | 内容                                                                                     |
| --------------------- | ---------------------------------------------------------------------------------------- |
| `schemaVersion`       | 数値の `1`                                                                               |
| `catalogId`           | 空でない識別子。UTF-8 で 128 バイトまで                                                  |
| `defaults`            | ツール名から固定の `versionOrName` への対応。どれも entry を指す必要がある               |
| `entries`             | `CatalogEntry` の配列。ツールと版の重複は不可。空の配列は有効だが、何も install できない |

| `CatalogEntry` の項目              | 内容                                                     |
| ---------------------------------- | -------------------------------------------------------- |
| `tool` / `versionOrName`           | metadata と一致する固定の識別子                          |
| `url`                              | credential と fragment のない HTTPS の URL               |
| `format`                           | `elf` か `tar.gz`                                        |
| `archiveEntry`                     | `tar.gz` の中で選ぶ相対 POSIX パス。`elf` では指定しない |
| `downloadSha256` / `downloadBytes` | 取得するバイト全体の SHA-256 と大きさ                    |
| `elfBytes`                         | 取得または展開した ELF の大きさ                          |
| `buildInfo`                        | `GuestBuildInfo` の全体                                  |
| `buildInfoSha256`                  | `buildInfo` の canonical JSON（UTF-8）の SHA-256         |

SHA-256 は小文字の 16 進 64 桁です。そのままの ELF では、`downloadBytes` と `elfBytes`、`downloadSha256` と
`buildInfo.elfSha256` がそれぞれ一致する必要があります。`tar.gz` では、圧縮したバイトと選んだ ELF を別々に指定します。

`GuestBuildInfo` は `schemaVersion`、`tool`、`versionOrName`、`source`（HTTPS のリポジトリと 40 桁の commit）、
`target` = `x86_64-unknown-linux-musl`、`rustc`（文字列か `null`）、`sourcePatches`、`dependencies`、`builderHash`、
`buildKey`、`elfSha256` を持ちます。依存と patch にも固定の識別情報が必要です。`buildKey` と canonical な metadata の
digest は、`validateGuest` と同じ規則で検証します。未知の JSON の項目もコピーし、canonical な識別情報に含めるので、
digest を作るときに削らないでください。

JSON がオブジェクトになった時点で失われた重複キーは、API では取り戻せません。元の JSON を読む側で拒否してください。
孤立したサロゲート、循環、整数でない数値は、canonical な入力として拒否します。

## 通信と上限

Node.js は 24 以降で、絶対の HTTPS の URL を渡します。ブラウザでは、相対 URL を document の origin に対して解決し、
その結果にも HTTPS を求めます。Node.js には暗黙の origin はありません。CORS と CSP の `connect-src` は、
ゲストの配信元に合わせてください。

credential は送りません。Node.js は redirect 先をそれぞれ検査し、5 回まで追います。ブラウザは `redirect: 'error'`
で追わないので、redirect しない URL から配信してください。HTTP のエラー、CORS の失敗、opaque な応答、
途中で切れた body を成功として扱うことはありません。

| 境界                                   | 上限                 |
| -------------------------------------- | -------------------- |
| カタログ / canonical なビルド metadata | 4 MiB / 1 MiB        |
| 取得 / ELF                             | それぞれ 128 MiB     |
| archive の展開全体 / entry の数        | 256 MiB / 4096       |
| archive のパス                         | UTF-8 で 4096 バイト |
| 取得 / install 全体                    | 120 秒 / 180 秒      |

取得したもの全体と ELF について、digest・宣言した大きさ・metadata を照合します。`tar.gz` は
`DecompressionStream` で展開し、すべての entry の境界・パス・重複・リンク・終端を検査してから、選んだ ELF を使います。
ホストのファイルシステムには展開しません。`validateGuest` の本物の handle を持つコピーだけを登録し、
取得したバイトへの参照は返しません。

## 予約、取消、結果

install・実行・登録・ファイル操作は、Session の 1 つだけの予約を共有します。競合した呼び出しは待たずに `BUSY` で拒否します。
同じツールのゲストを置き換えるのは、install が成功したときだけで、置き換えは一度に行います。
取得や検証の失敗、取消では、元のゲスト・ファイル・作業ディレクトリをそのまま残します。
`reset()` と `dispose()` は、これまでどおりすべての登録を消します。

インストーラは `AbortSignal`、`reset`、`dispose`、期限を確かめて後始末をします。同期的な `validateGuest` の検証の途中では
止められないので、検証の直後に取消と時間を確かめます。最初に決まった終わり方を保ち、遅れて届いた応答で登録や通知を
再開することはありません。登録した後の abort で、成功を失敗に戻すこともありません。

`InstallResult` は `operationId`、`tool`、`versionOrName`、ELF の `digest`、`buildKey` を持ちます。
ゲストの handle や出力は含みません。

`Progress` は `operationId`、増えていく `sequence`、`phase`（`fetch`、`tar.gz` のときだけの `extract`、`digest`、
`validate`、`register`）、`processedBytes`、`totalBytes` を持ちます。分からない全体量は `null` で、`0` とは区別します。
callback で例外が起きても install の結果は変わらず、終わった後に通知が届くことはありません。
callback から同じ Session を操作すると `BUSY` になることがあります。

| エラーコード                       | 主な条件                                                                         |
| ---------------------------------- | -------------------------------------------------------------------------------- |
| `INVALID_INPUT`                    | カタログ・selection・大きさ・archive・ELF・digest・metadata の不正、偽の Session |
| `ASSET_LOAD`                       | HTTP・CORS・redirect・body・通信の失敗                                           |
| `UNSUPPORTED_ENV`                  | 必要な環境の機能がない                                                           |
| `BUSY`                             | 同じ Session で別の操作が予約中                                                  |
| `ABORTED` / `DISPOSED` / `TIMEOUT` | 呼び出し元か `reset` による取消、dispose、期限切れ                               |

## テスト

単体テストは `tests/package/install-*.test.ts` にあり、通常の CI（`test:node-unit`）とリリース候補の
パッケージのカバレッジで実行します。macOS の実機の Safari では、CI がカタログのゲストを HTTPS で install します
（`tests/browser/safari-probe.test.ts`）。ELF そのもの、進捗が fetch・extract・digest・validate・register の順に届く `tar.gz`、最初の進捗で中止して
何も登録されない install を確かめます。同じ確認を iOS 26 の Simulator の iOS 版 Safari でも行います（iOS 27 は未実行。Xcode 27 で Simulator.app が Device Hub に置き換わり、safaridriver が iOS Simulator を見つけられないため）。WebKit の結果を Safari の合格とは扱いません。
