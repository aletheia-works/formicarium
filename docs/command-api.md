# command API（U4 暫定候補）

1行の文字列を解釈し、既存のsession（U2）とinstall（U3）へ振り分けるlibrary APIです。root entryから `createCommandSession` と関連型（`CommandOptions`・`CommandResult`・`CommandSession`）を公開します。command sessionはcwd・FS・登録guestを複製せず、取得・展開・検証も再実装しません。状態はすべて渡したsessionが持ちます。

この文書の内容は実装と型定義に基づくドキュメント根拠です。U4の試験・coverage・B1統合受入・署名付きCIは、この文書の作成時点で未検証です。実機Safariも未検証で、WebKitの結果を実機Safariの合格とは扱いません。

## 使用例

```js
import { createSession } from '@aletheia-works/formicarium/node';
import { createCommandSession, ExecutionError } from '@aletheia-works/formicarium';

// catalogは呼出し元が用意した、固定URL・全digest・build情報を持つGuestCatalog。
const session = await createSession();
try {
  const shell = createCommandSession(session, { catalog });
  await shell.execute('install aube');
  const result = await shell.execute('aube --version');
  // 原本bytes。表示する場合はUI側で変換し、textContent等で表示する。
  console.log(result.exitCode, new TextDecoder().decode(result.stdout));
} catch (error) {
  if (error instanceof ExecutionError) console.error(error.code);
  throw error;
} finally {
  await session.dispose();
}
```

browserではsessionのimportを `@aletheia-works/formicarium/browser` へ変更し、READMEのCOOP/COEP・Worker/assets・CSP要件も満たします。

`createCommandSession(session, { catalog }): CommandSession` は同期的に、sessionが同じpackage instanceのものか、catalogが [install API](install-api.md) の規則を満たすかを確認します。不正なら `INVALID_INPUT` をthrowし、sessionは変わりません。内部でinstallerを1つだけ作りますが、返すobjectは `execute` だけを持ち、session・installer・内部portを外へ出しません。

`shell.execute(input, { signal?, onProgress?, onOutput? }): Promise<CommandResult>` は1回のcommandです。

## 構文の範囲

- 入力は文字列で、UTF-8で65536 bytesまで受理し、65537 bytes以上は `INVALID_INPUT` です。byte数は `TextEncoder` で変換した後の長さです。
- 孤立surrogate（`String.prototype.isWellFormed()` が `false`）は、U+FFFDへ置き換えずに `INVALID_INPUT` にします。
- LF・CR・NULは、引用の内外にかかわらず `INVALID_INPUT` です。
- 引数の区切りはASCIIのspaceとtabだけです。連続した区切りは1つとして扱い、先頭と末尾は無視します。NBSPや全角空白は引数の一部としてそのまま残します。非ASCIIの文字も正規化しません。
- 引用外の `|` `&` `;` `<` `>` `$` backtick `*` `?` `(` `)` `{` `}` は「shell syntax is unsupported」で拒否します。`[` `]` `~` `#` `!` `=` などはそのまま文字として扱います。
- 単引用の中は、終わりの単引用まですべて文字どおりです。
- 二重引用の中では `\"` と `\\` だけをescapeとして解決し、他の `\x` は2文字のまま残します。`$` やbacktickも展開しません。
- 引用外の `\x` は `x` になります（区切りや記号も文字になります）。
- `''` や `""` は空文字の引数になります。隣り合う引用部分と非引用部分は1つの引数につながります。
- 閉じていない引用は「unterminated quote」、引用外の末尾のbackslashは「trailing backslash」で拒否します。
- spaceとtabだけの入力（空文字を含む）は `kind: 'empty'`・exit 0・空のbytesでresolveし、予約を取りません。

## 振分けと予約名

argv[0]の完全一致で振り分けます。

| argv[0] | 受け付ける形 | 動作 |
|---|---|---|
| `ls` | `ls`、`ls path` | sessionの `listEntries` を1回。`-` で始まる引数と2個以上の引数は拒否 |
| `cat` | `cat path` | fs予約を1回取り、原本bytesをstdoutへ |
| `cd` | `cd path` | fs予約を1回取り、cwdを変更 |
| `rm` | `rm -rf path` | fs予約を1回取り、削除。`rm -r -f`・`rm -fr`・`rm path` などは拒否 |
| `install` | `install selection` | catalogのinstallを1回。URLは受け付けない（選択の規則はinstall API） |
| それ以外 | `tool [args...]` | 登録済みのtoolを実行。未登録なら `NOT_FOUND` |

`ls` `cat` `rm` `cd` `install` は予約名です。同じ名前のguestを登録できます（例えば `install ls@x` は `ls` というtoolを登録します）が、commandからは呼べず、`ls` は引き続きbuiltinとして動きます。`pwd` はbuiltinではなく、登録済みguestがなければ `NOT_FOUND` です。

pathはguestのpathとして扱い、正規化と解決はsessionが行います。command APIはhostのFS・URL・環境変数を参照しません。`/` で始まらない相対pathは、sessionの現在のcwdを基準に絶対pathへ解決します（例えばcwdが `/work` なら `cat a.txt` は `/work/a.txt`、`ls .` は `/work`）。`cat`・`cd`・`rm` はfs予約を取った後に解決し、`ls` は解決したのと同じtickで `listEntries` を呼ぶため、解決に使うcwdと実際に操作するときのcwdは同じです。空のpath、NULを含むpath、`..` を含むpath（相対・絶対とも）は、予約の前に `INVALID_INPUT` で拒否し、FS・cwdを変えません。persistence rootの外のpathやrootそのものの削除は、従来どおりsessionの `INVALID_INPUT` です。

`ls` の表示は、dirを `name/`、symlinkを `name -> target`、fileを `name` とし、この表示文字列全体をUTF-16 code unit順（JavaScriptの既定のsort）で並べます。例えば `a.b` は `a/` より先です。各行の末尾に改行を付け、entryが0件ならstdoutは空のbytesです。

installの成功時のstdoutは `installed <tool>@<versionOrName> (sha256 <digest>)` と改行の1行で、stderrは空です。`installation` にinstall APIと同じ `InstallResult` が入ります。

## 判定の順序

1. `INVALID_INPUT`：optionsの形、入力の型・長さ・文字、Tokenizer、builtinとinstallの形、pathの構文（空・NUL・`..`）、catalogの選択（予約の前に判定）
2. `ABORTED`：予約の前に `signal` がabort済み
3. `DISPOSED`・`BUSY`：予約を取るときの状態（dispose後、または他の操作が予約中）

拒否した入力では、FS・cwd・登録guestを変えません。予約の後の失敗は、sessionとinstallの既存の失敗契約に従います（未登録の `NOT_FOUND` や、install失敗時の旧登録の保持）。

## 取消とtimeout

- `signal` は予約の前に確認し、abort済みなら予約を取らずに `ABORTED` でrejectします。
- `ls` `cat` `cd` `rm` はsessionの中で同期に完了する操作です。開始した後に立ったsignalでは中断せず、完了した結果を返します。
- `install` とguestの実行は、signalをinstallerとsessionの実行へ渡します。取消後の結果はそれぞれの契約（`ABORTED`、旧登録の保持）に従います。command APIは再試行・待ち行列・fallbackを持ちません。
- command APIにtimeoutの指定はありません。guestの実行はsessionの実行の既定値（600000ms）に従い、installは取得120秒・全体180秒の上限に従います。
- guestの正常終了は、exit codeが0以外でも `kind: 'guest'` でresolveします。host/core/timeout/取消の失敗は既存の `ExecutionError` でrejectします。
- 操作の識別は、guestの実行では `runId`、installでは `installation.operationId` を使います。

## 結果bytesとUIへの受渡し

`stdout` と `stderr` は、呼出しごとに新しい `Uint8Array` です。内部bufferやsessionのfileと共有しません。command APIは結果を切り詰めず、文字列へ変換せず、HTMLやcodeとして評価しません。

次の条件は、command APIではなく埋め込むUI（U6・U8）の責任です。UI側の試験で確認します。

- loading・empty・errorの表示の区別
- keyboardでの操作
- 進捗の「不明」（`totalBytes: null`）と「0」の区別
- offset付きの時刻の表示
- bytesから表示への変換、制御文字の扱い、表示上限（1048576 bytes・10000行）

command APIは `Progress` をinstallから変えずに中継し、`OutputChunk` をguestの実行から変えずに中継します。
