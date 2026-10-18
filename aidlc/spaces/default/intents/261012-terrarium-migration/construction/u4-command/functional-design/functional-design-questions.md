# U4 command 機能設計の確認

## 確定済みの入力

承認済みC02/C05/C11、FR3/FR5/NFR7とU4の責任境界は確定済み。空白だけの入力は empty・exit 0。単引用・二重引用・空文字引数を扱う。引用外の `|` `&` `;` `<` `>` `$` backtick と未閉引用は INVALID_INPUT。引用内は展開しない。builtinは `ls [path]`・`cat path`・`rm -rf path`・`cd path` の形だけで、余分なflagや引数は拒否する。`install` は選択1つだけ。それ以外は登録tool名としてguest runし、未登録は NOT_FOUND。不正入力では状態を変えない。入力上限は64KiB（UTF-8）。

既存の実装と比べて、次の点は契約で決まっていない（ドキュメント根拠）。
- 現行U2の内部port（`runtime/lifecycle.ts` の builtin）：ls は名前を改行区切りで出し、空でも改行1つを出す。並べ替えはしない。
- terrariumの現行 `commandArgs`（`../terrarium/packages/terrarium/src/formicarium-session.ts`）：引用外の `* ? ( ) { }` とbackslashを shell syntax として拒否する。二重引用内の `$`、backtick、backslashも拒否する。ls は並べ替えたうえでdirに `/`、symlinkに `-> target` を付ける。`pwd` を持つ。誤りはexit 1や127とメッセージで返す。

## Questions

### Q1. 引用外のglob・grouping記号
契約が拒否を定めているのは `| & ; < > $ backtick` だけです。terrariumは加えて `* ? ( ) { }` も拒否しています。U6はterrarium互換の端末adapterを作り、U8は空端末から利用します。

A. terrariumと同じく `* ? ( ) { }` も INVALID_INPUT にする。`[ ] ~ # ! =` などはliteralとして扱う（推奨：既存consumerの入力をそのまま拒否でき、globを実行しない）
B. A に加えて `[ ] ~ #` も拒否し、shellで意味を持ち得る記号を広く拒否する
C. 契約の列挙だけを拒否し、`*` などはliteralとして渡す
X. Other (please specify)

[Answer]: A

### Q2. backslashと二重引用内の `$`・backtick
C05は「escaped quote/backslashを扱う」「引用内はliteralで展開しない」と定めています。一方でterrariumは、backslashと二重引用内の `$`・backtick を拒否しています。

A. POSIXの部分集合にする。引用外の `\x` は x、二重引用内は `\"` と `\\` だけをescapeとして扱い、他の `\x` は2文字のまま残す。単引用内はすべてliteral。末尾のbackslashは INVALID_INPUT。二重引用内の `$`・backtick は展開せずliteralとする（推奨：C05の文言どおり）
B. A のescape規則にし、二重引用内の `$`・backtick だけはterrarium互換で INVALID_INPUT にする
C. terrarium互換にする。backslashは引用外・二重引用内とも INVALID_INPUT、二重引用内の `$`・backtick も拒否する（C05の「backslashを扱う」と食い違うため、契約改訂が必要）
X. Other (please specify)

[Answer]: A

### Q3. 区切り文字と改行
契約は「空白区切り」とだけ定めています。

A. 区切りはASCIIのspaceとtabだけ。改行（LF/CR）とNULは INVALID_INPUT。それ以外の文字（NBSP・全角空白などUnicodeの空白を含む）は引数の一部として保持する（推奨：1行1コマンドを守り、非ASCIIを変形しない）
B. 区切りはspace・tabに加えてUnicodeの空白も含める。改行は INVALID_INPUT
C. 改行も区切りとして扱う（1回の入力で複数行を1コマンドとして読む）
X. Other (please specify)

[Answer]: A

### Q4. ls の表示と pwd
transcriptの整形はU4の責任です（unit-of-work）。ls の結果bytesは、U2の内部port builtinが作ります。

A. 原本bytesはU2 builtinのまま変えない。U4はterrarium互換の表示規則（名前で並べ替え、dirに `/`、symlinkに `-> target`、空なら何も出さない）でlsの stdout を作る。`pwd` はC05に無いので追加しない（未登録toolとして NOT_FOUND）
B. A に加えて `pwd`（引数なし、cwdと改行を出す）をbuiltinとして追加する（C05の改訂が必要）
C. U2 builtinの出力（並べ替えなし、名前だけ、空でも改行1つ）をそのまま使い、表示の互換はU6のadapterに任せる
X. Other (please specify)

[Answer]: A

## Assumptions & Open Questions

上の4問以外の新しい人間の選択はない。誤りの通知（INVALID_INPUT・NOT_FOUND・BUSY をExecutionErrorでreject）、guest結果のresolve、64KiB上限、install/runの予約と競合はC05/C02/C11で確定している。terrarium互換のexit 1・127とメッセージへの変換はU6のadapter（C08）の責任とする（ドキュメント根拠：C05とC08の互換説明）。
