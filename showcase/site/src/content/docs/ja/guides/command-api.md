---

title: command API
description: 1 行の command を、Session の builtin・install・ゲストへ振り分けます。
---

`createCommandSession` は 1 行の文字列を解釈し、既存の Session とそのインストーラへ振り分けます。
root entry から、`CommandOptions`・`CommandResult`・`CommandSession` と一緒に公開しています。
command session は作業ディレクトリ・ファイル・登録したゲストをコピーせず、取得・展開・検証も作り直しません。
状態はすべて、渡した Session が持ちます。

## 使用例

```js
import { createSession } from '@aletheia-works/formicarium/node';
import {
  createCommandSession,
  ExecutionError,
} from '@aletheia-works/formicarium';

// catalog は、固定の URL・すべての digest・ビルド情報を持つ、呼び出し元が用意した GuestCatalog。
const session = await createSession();
try {
  const shell = createCommandSession(session, { catalog });
  await shell.execute('install aube');
  const result = await shell.execute('aube --version');
  // 元のバイト。表示するときは UI の側で変換し、textContent などで表示する。
  console.log(result.exitCode, new TextDecoder().decode(result.stdout));
} catch (error) {
  if (error instanceof ExecutionError) console.error(error.code);
  throw error;
} finally {
  await session.dispose();
}
```

ブラウザでは `createSession` を `@aletheia-works/formicarium/browser` から import し、パッケージの README にある
cross-origin isolation・Worker・資産・CSP の要件を満たしてください。

`createCommandSession(session, { catalog }): CommandSession` は、Session が同じパッケージのものか、
カタログが [install API](/formicarium/ja/guides/install-api/) の規則を満たすかを同期的に確かめます。
満たさなければ `INVALID_INPUT` を投げ、Session は変えません。内部でインストーラを 1 つだけ作りますが、
返すオブジェクトは `execute` だけを持ち、Session・インストーラ・内部の port を外に出しません。

`shell.execute(input, { signal?, onProgress?, onOutput?, stdin?, terminal?, network? }): Promise<CommandResult>` は 1 回の command です。
`stdin`（`ReadableStream<Uint8Array>`）と `terminal`（`{ columns, rows }`、1〜65535）は、Session の `run` と同じく
ゲストの実行にだけ渡します（[ADR 0013](/formicarium/ja/development/decisions/0013-interactive-guest-runs/)）。
ゲストは stream を stdin として読み、その大きさの端末を見ます。端末を付けた実行には `TERM=xterm-256color` も渡します。
表示する端末は xterm 互換で、`TERM` がないと curses のゲストは知らない端末だとみなすことがあるからです。builtin と `install` は読みません。ロックされていない
`ReadableStream` でない `stdin` や、形の違う `terminal` は、予約の前に `INVALID_INPUT` です。

`network`（`{ allow, relay? }`）も、Session の `run` と同じくゲストの実行にだけ渡します（[ADR 0014](/formicarium/ja/development/decisions/0014-guest-tcp-clients-in-nodejs/)）。
Node.js では、ゲストは一覧にある行き先へ TCP でつなげるので、`jj`・`git`・`git-remote-https` を導入し、ゲストに CA 証明書があれば、
`{ allow: ['github.com:443'] }` で `jj git clone https://github.com/...` が動きます。引き継がれるのは作業ディレクトリと home ディレクトリだけなので、
証明書は home ディレクトリに置き、`~/.gitconfig` の `http.sslCAInfo` で指定します。ブラウザの Session では、ゲストの代わりに接続する
WebSocket の relay を `relay` に渡す必要があり（[ADR 0015](/formicarium/ja/development/decisions/0015-guest-network-in-browser-through-a-relay/)）、
なければ `UNSUPPORTED_ENV` で断ります。形の違う一覧や relay は、予約の前に `INVALID_INPUT` です。`install` はホストで取得するので、これを使いません。

## 構文

- 入力は文字列で、UTF-8 で 65536 バイトまで受け付けます（`TextEncoder` で変換した後の長さ）。65537 バイト以上は
  `INVALID_INPUT` です。
- 孤立したサロゲート（`String.prototype.isWellFormed()` が `false`）は、U+FFFD に置き換えずに `INVALID_INPUT` にします。
- LF・CR・NUL は、引用の内外にかかわらず `INVALID_INPUT` です。
- 引数の区切りは ASCII の space と tab だけです。続いた区切りは 1 つとして扱い、先頭と末尾は無視します。
  NBSP や全角の空白などの ASCII 以外の文字は、正規化せずに引数の一部として残します。
- 引用の外の `|` `&` `;` `<` `>` `$` backtick `*` `?` `(` `)` `{` `}` は、「shell syntax is unsupported」で拒否します。
  `[` `]` `~` `#` `!` `=` などは文字のまま扱います。
- 単引用の中は、閉じる単引用まですべて文字どおりです。
- 二重引用の中では `\"` と `\\` だけを escape として解決し、ほかの `\x` は 2 文字のまま残します。`$` や backtick も
  展開しません。
- 引用の外の `\x` は `x` になります（区切りや記号も文字になります）。
- `''` や `""` は空の引数です。隣り合う引用の部分と引用でない部分は、1 つの引数につながります。
- 閉じていない引用（「unterminated quote」）と、引用の外の末尾の backslash（「trailing backslash」）は拒否します。
- space と tab だけの入力（空の文字列を含む）は、`kind: 'empty'`・終了コード 0・空のバイトで resolve し、予約を取りません。

## 振り分けと予約名

`argv[0]` の完全一致で振り分けます。

| `argv[0]` | 受け付ける形                  | 動作                                                                                |
| --------- | ----------------------------- | ----------------------------------------------------------------------------------- |
| `ls`      | `ls`、`ls path`               | Session の `listEntries` を 1 回。`-` で始まる引数と、2 つ以上の引数は拒否          |
| `cat`     | `cat path`                    | ファイル操作の予約を 1 回取り、元のバイトを stdout へ                               |
| `cd`      | `cd path`                     | ファイル操作の予約を 1 回取り、作業ディレクトリを変える                             |
| `rm`      | `rm -rf path`                 | ファイル操作の予約を 1 回取り、削除する。`rm -r -f`・`rm -fr`・`rm path` などは拒否 |
| `cp`      | `cp src dst`、`cp -r src dst` | ファイル操作の予約を 1 回取り、複製する。ほかの flag・`--`・3 つ以上のパスは拒否    |
| `mv`      | `mv src dst`                  | ファイル操作の予約を 1 回取り、移動する。flag・`--`・3 つ以上のパスは拒否           |
| `install` | `install selection`           | カタログからの install を 1 回。URL は受け付けない（選び方は install API のとおり） |
| それ以外  | `tool [args...]`              | 登録したツールを実行する。登録していなければ `NOT_FOUND`                            |

ディレクトリでないパス（file など）の `ls` は何も出さずに 0 で終わり、`cd` は
`NOT_FILE` で失敗します。

`ls`・`cat`・`rm`・`cd`・`cp`・`mv`・`install` は予約名です。同じ名前のゲストを登録することはできますが（たとえば `install ls@x` は
`ls` というツールを登録します）、command からは呼べず、`ls` は引き続き builtin として動きます。`pwd` は builtin ではなく、
同じ名前のゲストを登録していなければ `NOT_FOUND` です。

Session の実行は、command からでも `Session.run` からでも、登録したゲストをそれぞれ `/usr/bin/<tool>` のファイルとして
見つけます。`/usr/bin` はゲストの既定の `PATH` にあるので、ゲストは別のゲストを名前で起動できます（たとえば jj は nano を
エディタとして開きます）。これらのファイルは実行のたびに置き直し、Session のファイルではありません。`ls` や snapshot には
現れず、実行がそこに書いたものは捨てます。そのため、`/usr/bin` の中やその上の `cwd`・`home` は `INVALID_INPUT` です。
command が登録したゲストを実行するときは `/usr/bin/<tool>` から起動するので、別のゲストから起動したときと同じく、
`argv[0]` はその path です。`Session.run` に渡したゲストは `/guest/program` から起動します。

パスはゲストのパスとして扱い、正規化と解決は Session が行います。command API はホストのファイルシステム・URL・
環境変数を読みません。`/` で始まらないパスは、Session の今の作業ディレクトリを基準に解決します
（作業ディレクトリが `/work` なら、`cat a.txt` は `/work/a.txt`、`ls .` は `/work`）。`cat`・`cd`・`rm`・`cp`・`mv` は
ファイル操作の予約を取った後に解決し、`ls` は解決したのと同じ tick で `listEntries` を呼ぶので、
解決に使った作業ディレクトリと、実際に操作するときの作業ディレクトリは同じです。空のパス、NUL を含むパス、
`..` という区切りを含むパス（相対・絶対とも。`a..b` は名前です）は、予約の前に `INVALID_INPUT` で拒否し、何も変えません。
引き継ぐ場所の外のパスや、その場所自体の削除は、これまでどおり Session の `INVALID_INPUT` です。

`cp` と `mv` は、できるところは POSIX に合わせています。
- `dst` が既にあるディレクトリなら、その中へ元の名前で置きます。そうでなければ `dst` に置き、その親は既にある
  ディレクトリでなければなりません（ない場合は `NOT_FOUND`）。symlink はたどりません。ディレクトリを指す symlink を
  `dst` にすると既にある symlink として扱い、`mv` は置き換え、`cp` は拒否します。
- `cp` は通常のファイルを 1 つ複製します（ディレクトリと symlink は `NOT_FILE`）。`cp -r` はディレクトリの木も複製し、
  symlink は同じ target の symlink として複製します。複製は `cp -p` なしと同じく新しい inode と元の mode を持つので、複製した木の中の hard link は別々のファイルになります。
  既にあるファイルへの複製はそのファイルの mode と inode を保つので、その hard link にも新しい中身が見えます。
- `mv` は entry を下の木ごと名前を変え、inode を保ちます。ファイルと symlink は、既にあるファイルや symlink を置き換えます。
  作業ディレクトリが移したディレクトリの中にあれば、作業ディレクトリも一緒に移ります。
- 次の場合は `INVALID_INPUT` で、何も変えません。ディレクトリを上書きする、またはディレクトリで上書きする場合、
  entry を自分自身の中へ置く場合、元と先が同じファイルの場合、引き継ぐ場所自体を移す場合、
  移した先で symlink の target が引き継ぐ場所の外になる場合です。
- `-` で始まるパスは flag として拒否します。`./-x` と書いてください。

`ls` の表示は、ディレクトリを `name/`、symlink を `name -> target`、ファイルを `name` とし、表示する文字列全体を
UTF-16 のコード単位の順（JavaScript の既定の sort。`a.b` は `a/` より先）に並べます。各行の末尾に改行を付け、
entry が 0 件なら stdout は空のバイトです。

install が成功したときの stdout は `installed <tool>@<versionOrName> (sha256 <digest>)` と改行の 1 行で、stderr は空です。
`installation` には、install API と同じ `InstallResult` が入ります。

## 判定の順序

1. `INVALID_INPUT`：options の形、入力の型・長さ・文字、tokenizer、builtin と `install` の形、パスの構文
   （空・NUL・`..`）、カタログからの選択。すべて予約の前に判定します。
2. `ABORTED`：予約の前に `signal` が abort 済み。
3. `DISPOSED`・`BUSY`：予約を取るときの状態（`dispose` の後、または別の操作が予約中）。

拒否した入力では、ファイル・作業ディレクトリ・登録したゲストを変えません。予約の後の失敗は、Session と
インストーラの既存の決まりに従います（登録していないツールの `NOT_FOUND`、install に失敗したときの元の登録の保持）。

## 取消と timeout

- `signal` は予約の前に確かめ、abort 済みなら予約を取らずに `ABORTED` で reject します。
- `ls`・`cat`・`cd`・`rm`・`cp`・`mv` は Session の中で同期的に終わる操作です。始まった後に立った signal では止めず、終わった結果を返します。
- `install` とゲストの実行は、signal をインストーラと Session の実行へ渡します。取消の後の結果は、それぞれの決まり
  （`ABORTED`、元の登録の保持）に従います。command API には再試行・待ち行列・代替はありません。
- timeout の指定はありません。ゲストの実行は Session の既定値（600000 ms。`stdin` があるときは、対話的なゲストは使う人を待つので、なし）に、install は取得 120 秒・全体 180 秒の上限に従います。
- ゲストが正常に終われば、終了コードが 0 以外でも `kind: 'guest'` で resolve します。ホスト・コア・timeout・取消の失敗は
  `ExecutionError` で reject します。
- ゲストの実行は `runId`、install は `installation.operationId` で識別します。

## 結果のバイトと UI

`stdout` と `stderr` は、呼び出しのたびに新しい `Uint8Array` で、内部のバッファや Session のファイルとは共有しません。
command API は結果を切り詰めず、文字列に変換せず、HTML やコードとして評価しません。

次のことは command API ではなく、埋め込む UI の責任で、UI の側のテストで確かめます。
- 読み込み中・空・エラーの表示の区別
- キーボードでの操作
- 進捗の「不明」（`totalBytes: null`）と「0」の区別
- offset 付きの時刻の表示
- バイトから表示への変換、制御文字の扱い、表示の上限（1048576 バイト・10000 行）

command API は、install の `Progress` とゲストの実行の `OutputChunk` を、そのまま中継します。

## テスト

単体テストは `tests/package/command-*.test.ts` にあり、通常の CI（`test:node-unit`）とリリース候補の
パッケージのカバレッジで実行します。macOS の実機の Safari では、CI が command のセッションで `install <tool>`、
install したツール、`ls`・`cat`・`cd`・`rm -rf` を実行します（`tests/browser/safari-probe.test.ts`）。
同じ確認を iOS 26 の Simulator の iOS 版 Safari でも行います（iOS 27 は未実行。Xcode 27 で Simulator.app が Device Hub に置き換わり、safaridriver が iOS Simulator を見つけられないため）。WebKit の結果を Safari の合格とは扱いません。
