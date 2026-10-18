# commandのルール

## Sources

根拠は承認済みFR3/FR5/NFR3/NFR7、C02/C04/C05/C11、本stageのQ1–Q4=Aである。User Storiesは未生成のため要件IDに直接対応させる。terrariumの現行 `commandArgs` と `#builtin`（`../terrarium/packages/terrarium/src/formicarium-session.ts`）は互換の参照で、規範はC05とQ1–Q4である。以下はドキュメント根拠で、実行は未検証。

## Rules

```yaml
rules:
  - id: BR4.1
    statement: "factoryは同packageのSessionとcatalogをC04どおりに受け取り、内部Installerを1つだけ作る"
    category: validation
    applies_to: CommandSession
    trigger: "createCommandSession"
    logic: "IF 偽造Session、catalog不正（C04の検証に失敗） THEN INVALID_INPUTで生成しない。ELSE Installerを1つ作り、Session/Installerを外へ出さない"
    violation: "INVALID_INPUT、session不変"
    source: "FR3 FR4"
  - id: BR4.2
    statement: "入力は文字列で、UTF-8で65536 bytes以下"
    category: validation
    applies_to: CommandRequest
    trigger: "execute開始"
    logic: "IF 文字列でない、または65537 bytes以上 THEN 拒否。65536 bytesは受理"
    violation: "INVALID_INPUT、予約を取らず状態不変"
    source: "FR3 NFR3"
  - id: BR4.3
    statement: "空白だけの入力はemptyとして何もしない"
    category: policy
    applies_to: CommandRequest
    trigger: "Tokenizerの結果が0件"
    logic: "IF space/tabだけ（空文字を含む） THEN 予約を取らず kind=empty、exitCode 0、空のstdout/stderrでresolve"
    violation: "なし（状態を変えない）"
    source: "FR3"
  - id: BR4.4
    statement: "区切りはASCIIのspaceとtabだけで、改行とNULは拒否する"
    category: validation
    applies_to: Token
    trigger: "Tokenizer"
    logic: "IF LF・CR・NULを含む THEN 拒否。ELSE space/tabの連続を1つの区切りとし、NBSPや全角空白などは引数の一部として保持する"
    violation: "INVALID_INPUT、状態不変"
    source: "FR3 NFR7（Q3=A）"
  - id: BR4.5
    statement: "引用外のshell記号は拒否する"
    category: validation
    applies_to: Token
    trigger: "Tokenizer（引用外の文字）"
    logic: "IF 引用外に | & ; < > $ backtick * ? ( ) { } のいずれかがある THEN 拒否。[ ] ~ # ! = などはliteral"
    violation: "INVALID_INPUT（message: shell syntax is unsupported）、状態不変"
    source: "FR3（Q1=A）"
  - id: BR4.6
    statement: "引用とescapeはPOSIXの部分集合で解釈し、何も展開しない"
    category: calculation
    applies_to: Token
    trigger: "Tokenizer"
    logic: "単引用内は終端の単引用まですべてliteral。二重引用内は \\\" と \\\\ だけをescapeとして解決し、他の \\x は2文字のまま残す。$ と backtick はliteral。引用外の \\x は x。隣接する引用部分と非引用部分は1つのTokenに連結する。'' や \"\" は空文字のToken"
    violation: "なし（解釈規則）"
    source: "FR3 NFR7（Q2=A、C05）"
  - id: BR4.7
    statement: "未閉の引用と末尾のbackslashは拒否する"
    category: validation
    applies_to: Token
    trigger: "Tokenizer終了時"
    logic: "IF 引用が閉じていない、または引用外で入力末尾がbackslash THEN 拒否"
    violation: "INVALID_INPUT（message: unterminated quote / trailing backslash）、状態不変"
    source: "FR3（Q2=A）"
  - id: BR4.8
    statement: "argv[0]で振り分ける：builtin（ls/cat/rm/cd）、install、それ以外は登録toolのguest run"
    category: policy
    applies_to: CommandRequest
    trigger: "Tokenizer成功後"
    logic: "IF argv[0]がls/cat/rm/cd THEN builtin。IF install THEN install。ELSE guest run（argv[0]=tool名、残りを引数）。pwdはbuiltinに含めない"
    violation: "なし（振分け規則）"
    source: "FR3（Q4=A、C05）"
  - id: BR4.9
    statement: "builtinは指定の形だけを受け付ける"
    category: validation
    applies_to: CommandRequest
    trigger: "builtin振分け"
    logic: "IF ls が引数2個以上、cat が引数1個以外、cd が引数1個以外、rm が [-rf, path] 以外（-r -f の分割や他flagを含む） THEN 拒否。'-' で始まるlsの引数もflagとして拒否"
    violation: "INVALID_INPUT、予約前に拒否して状態不変"
    source: "FR3（C05）"
  - id: BR4.10
    statement: "builtin・install・guest runはそれぞれU2の予約を1度だけ取り、直接APIと排他する"
    category: constraint
    applies_to: CommandSession
    trigger: "振分け後の実行"
    logic: "cat/rm/cd は C02 acquire('fs')→builtin→release。ls は公開 listEntries（内部で fs 予約を1回）。install は内部Installerのinstall（C04がinstall予約を1回）。guest run は acquire('run')→runInstalled→release。IF activeな予約がある THEN BUSY"
    violation: "BUSY/DISPOSED/ABORTEDをExecutionErrorでreject、既存状態不変"
    source: "FR5（C02/C05）"
  - id: BR4.11
    statement: "lsの表示はterrarium互換で、原本entryはU2が返したものを使う"
    category: calculation
    applies_to: ListingLine
    trigger: "ls成功"
    logic: "listEntriesの結果を名前のUTF-16 code unit順で並べ、dirは name/、symlinkは name -> target、fileは nameとし、各行の末尾に改行。entryが0件ならstdoutは空"
    violation: "なし（表示規則）。listEntriesの失敗コードはそのままreject"
    source: "FR3 NFR7（Q4=A）"
  - id: BR4.12
    statement: "installは選択1つだけをInstallerへ渡し、進捗とsignalをそのまま中継する"
    category: validation
    applies_to: CommandRequest
    trigger: "install振分け"
    logic: "IF 引数が1個でない THEN INVALID_INPUT。ELSE installer.install(selection, {signal, onProgress})。URLや任意の取得先は受け付けない（選択の検証はC04）。成功時 kind=install、exitCode 0、stdoutは `installed <tool>@<versionOrName> (sha256 <digest>)` と改行の1行、stderrは空、installationにInstallResult"
    violation: "C04のエラーをそのままreject、旧登録は保持（C04）"
    source: "FR3 FR4 FR5"
  - id: BR4.13
    statement: "未登録のtoolはNOT_FOUNDで拒否する"
    category: validation
    applies_to: CommandRequest
    trigger: "guest run振分け"
    logic: "IF argv[0]が登録guestにない（U2 runInstalledがNOT_FOUND） THEN NOT_FOUND。予約はreleaseする"
    violation: "NOT_FOUND、状態不変"
    source: "FR3"
  - id: BR4.14
    statement: "guestの正常終了は非0でもresolveし、host/core/timeout/取消はrejectする"
    category: policy
    applies_to: CommandResult
    trigger: "guest run完了"
    logic: "IF RunResultが返る THEN kind=guest、exitCode/stdout/stderr/runIdをRunResultからcopyしてresolve。IF ExecutionError THEN そのままreject。onOutputはRunOptionsへ中継する"
    violation: "既存ExecutionError"
    source: "FR3 FR5"
  - id: BR4.15
    statement: "拒否した入力ではFS・cwd・登録を変えない"
    category: constraint
    applies_to: CommandSession
    trigger: "INVALID_INPUT/NOT_FOUND/BUSY"
    logic: "Tokenizerと形の検証は予約の前に行い、予約後の失敗はU2の失敗契約（変更なし）に従う"
    violation: "なし（不変条件）"
    source: "FR3 FR5"
  - id: BR4.16
    statement: "pathはguestのpathとしてU2に渡し、host pathへ解決しない"
    category: constraint
    applies_to: CommandRequest
    trigger: "builtinのpath引数"
    logic: "pathの正規化とcwd基準の解決はU2の状態操作が行う。U4はhostのFSやURLへアクセスしない"
    violation: "U2のINVALID_INPUT/NOT_FOUNDをそのままreject"
    source: "FR3 NFR3"
  - id: BR4.17
    statement: "結果bytesは原本で、U4はHTMLやcodeとして評価しない"
    category: policy
    applies_to: CommandResult
    trigger: "結果を返すとき"
    logic: "stdout/stderrは呼出しごとの新しいUint8Array。文字列への変換と表示上限（1048576 bytes/10000行）はUI側の責任で、原本は切り詰めない"
    violation: "なし（出力規則）"
    source: "NFR7（C05、Transcript）"
```

## Summary

| ID | 種別 | 要点 | 違反時 |
|---|---|---|---|
| BR4.1 | validation | factoryは同package Session/catalogだけ、Installerは1つ | INVALID_INPUT |
| BR4.2 | validation | 入力はUTF-8で65536 bytes以下 | INVALID_INPUT |
| BR4.3 | policy | 空白だけはempty・exit 0、予約なし | 状態不変 |
| BR4.4 | validation | 区切りはspace/tabだけ、LF/CR/NUL拒否 | INVALID_INPUT |
| BR4.5 | validation | 引用外の `\| & ; < > $` backtick `* ? ( ) { }` を拒否 | INVALID_INPUT |
| BR4.6 | calculation | 単引用literal、二重引用は `\"` `\\` だけescape、展開なし | — |
| BR4.7 | validation | 未閉引用・末尾backslashを拒否 | INVALID_INPUT |
| BR4.8 | policy | builtin/install/guest runに振分け、pwdなし | — |
| BR4.9 | validation | builtinの形だけ受理 | INVALID_INPUT |
| BR4.10 | constraint | 予約は各1度、直接APIと排他 | BUSY/DISPOSED/ABORTED |
| BR4.11 | calculation | lsはterrarium互換の並べ替え・記号 | — |
| BR4.12 | validation | installは選択1つ、進捗/signal中継 | C04のエラー |
| BR4.13 | validation | 未登録toolはNOT_FOUND | NOT_FOUND |
| BR4.14 | policy | guest非0終了はresolve、host/core/取消はreject | ExecutionError |
| BR4.15 | constraint | 拒否時は状態不変 | — |
| BR4.16 | constraint | pathはguest pathとしてU2へ | U2のエラー |
| BR4.17 | policy | 結果bytesは原本、評価しない | — |
