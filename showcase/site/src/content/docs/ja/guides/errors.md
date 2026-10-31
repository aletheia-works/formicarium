---

title: エラーコード
description: ExecutionError のコードと、それぞれが出る場面。
---

Session・installer・command session の失敗はすべて `ExecutionError` です。不正な入力では `INVALID_INPUT` の `ExecutionError` を投げ、
ホストやコアの失敗ではそれで reject します。ゲストが終了したときは、終了コードが 0 以外でもエラーではなく、
実行は `exitCode` で resolve します。コードはすべて公開の `ERROR_CODES` にあり、`error.code` は必ずそのどれかです。

`ExecutionError` は次を持ちます。

- `code`：下の表のどれか。
- `stdout` と `stderr`：失敗の前にゲストが書いたバイト（動かなかったときは空）。毎回新しい配列で、共有しません。
- `runId`：失敗したゲストの実行のとき。
- `cause`：Worker の中で失敗したとき。元の cause の連なりの先頭の 4 つを名前で持ち、メッセージはエンジンの
  `RangeError`・WebAssembly のエラー・コアの `PaludariumError` のものだけを持ちます
  （[runtime の構成](/formicarium/ja/development/architecture/)）。path や環境変数の値のような呼び出し元の
  データは Worker の外に出しません。

失敗や取消しになった実行は、Session のファイルと作業ディレクトリを元のままにし、失敗した install は前の登録を残します。

## コード

| コード            | 出る場面                                                                                                                                                                                                                                                                     |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `INVALID_INPUT`   | 引数が規則に合わないとき（option・path・ゲスト・カタログ・command の行の誤り）。何かを始める前に確かめます。install では、大きさ・archive・ELF・digest が合わない取得も断ります。                                                                                            |
| `ASSET_LOAD`      | package の Worker やコアのファイルが無いか、`assets/paludarium/build-info.json` の SHA-256 と合わないとき。install では、HTTP・CORS・redirect・本文・ネットワークの失敗。                                                                                                    |
| `UNSUPPORTED_ENV` | 実行環境に足りないものがあるとき。Node.js が 24 より古い、ブラウザで Worker・`SharedArrayBuffer`・cross-origin isolation が無い、Worker の URL が別の origin、`network.relay` の無い `network`。install では、`crypto.subtle`・`fetch`・`DecompressionStream` の無いホスト。 |
| `CORE_INIT`       | エミュレータのコアが起動できなかったとき。                                                                                                                                                                                                                                   |
| `EXECUTION`       | Worker の中、または Worker と Session の間で実行が失敗したとき。たとえば WebAssembly の trap や、Session が受け取れないメッセージ。                                                                                                                                          |
| `SNAPSHOT`        | 実行の後、Worker がファイルの完全で正しい写しを返さなかったとき。その実行の結果は何も残しません。                                                                                                                                                                            |
| `TIMEOUT`         | 実行が `timeoutMs`（既定は 600000 ms。`stdin` があれば既定の上限は無し）を超えたとき。install では、取得の 120 秒か全体の 180 秒を超えたとき。                                                                                                                               |
| `ABORTED`         | 呼び出し側の `AbortSignal` が、始まる前か途中で abort されたとき。`reset` が取り消したとき。                                                                                                                                                                                 |
| `BUSY`            | 別の実行・install・command が Session を使っているとき。                                                                                                                                                                                                                     |
| `DISPOSED`        | Session が破棄されたとき。                                                                                                                                                                                                                                                   |
| `NOT_FOUND`       | ゲストやツールが登録されていないとき、path が存在しないとき。                                                                                                                                                                                                                |
| `NOT_FILE`        | 通常のファイルでなければならない path がそうでないとき（`readFile`・`cat`・`-r` の無い `cp`）、作業ディレクトリがディレクトリでないとき。                                                                                                                                    |

[install API](/formicarium/ja/guides/install-api/) と [command API](/formicarium/ja/guides/command-api/) は、
これらを確かめる順番と、それぞれの条件を説明しています。
