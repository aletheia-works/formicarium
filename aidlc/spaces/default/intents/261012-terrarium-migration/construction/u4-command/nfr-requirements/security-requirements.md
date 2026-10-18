# commandの品質・安全要件

## Sources

根拠は `../functional-design/functional-spec.md`、`../functional-design/rules.md`（BR4.1–BR4.17）、`../../../inception/requirements-analysis/requirements.md`（NFR1–NFR8）、`../../../inception/contract-design/contract-summary.md`（C02/C04/C05/C11、Transcript）、`aidlc/spaces/default/codekb/formicarium/technology-stack.md`（ただしtoolchainの版は2026-10-17の更新後の値を使う）。加えて、機能設計レビュー（READY、Minor 6件）のうち品質に関わる3件を、人間の判断（後工程で扱う）に従ってここで要件化する。以下はドキュメント根拠で、U4の動作・性能・sensorの成功は未検証。

## Requirements

| ID | 分類 | 合格条件 | 検証 |
|---|---|---|---|
| NFR2.1 | 品質 | probe≤600s/8項目、aube browser≤840s、worker1/retry0/native一致/wasm1GB/WorkerのwaitAsync削除を維持する。 | 既存回帰、同じ候補のconsumerとCI、未変更aubeは再buildしない |
| NFR2.2 | 品質 | U4で追加する配布JSを第一者配布JSの固定分母に加え、全realmのline coverage≥80%。Worker・別process・realmの欠落やskipは拒否する。 | 同じsource/pack、raw計測と全inventory、CIログとの照合 |
| NFR3.1 | 入力 | 入力はUTF-8で65536 bytesまで受理し、65537 bytesはINVALID_INPUT（C11 maxCommandBytes）。文字列以外、LF/CR/NUL、引用外のshell記号、未閉引用、末尾backslashは予約前に拒否し、状態を変えない。 | 65535/65536/65537 bytes、multi-byte境界、各記号と各拒否形の試験 |
| NFR3.2 | 境界 | pathはguest pathとしてU2へ渡し、U4はhostのFS・URL・環境変数へアクセスしない。commandから取得先URLを注入できない（installの選択はC04がexact matchで検証）。 | `install https://...`、`cat /etc/passwd`（guest path扱い）、host側副作用がないことの試験 |
| NFR3.3 | 所有 | 結果のstdout/stderrは呼出しごとの新しいbytes。guest runはU2の検証済みcopyだけを実行する（C03）。 | 結果bytesの変更が次の呼出しへ影響しないこと、register後の元bytes変更が実行に影響しないことの試験 |
| NFR4.1 | 取消 | options.signalが予約の前に既にabort済みなら、予約を取らずABORTED。同期のbuiltin（ls/cat/rm/cd）は開始後に中断しない。installとguest runはsignalをC04/Session.runへ渡し、取消の結果はそれぞれの契約に従う。U4は独自の再試行・待ち行列・fallbackを持たない。 | 事前abort×各経路、install中abort（旧登録保持）、run中abort、reset/dispose直後のlate結果を拒否 |
| NFR4.2 | 時間 | guest runへtimeoutMsを渡さず、既存Session.runの既定値（600000ms、runtime/validation.ts）に従う。installの取得120s・全体180sはC04/C11のまま変えない。 | 既定timeoutの適用、U4がtimeoutを上書きしないことの試験 |
| NFR5.1 | 排他 | builtin・install・guest runはU2の予約を1度だけ取得し、直接APIや他のCommandSessionとの競合はBUSY。拒否・失敗では FS・cwd・登録を変えない。 | 同一Sessionでの直接run/listEntries/installとの競合、連続操作（cd→ls→cat→rm→ls）の状態維持 |
| NFR6.1 | 互換 | Node>=24（開発・CIはNode 26.12.0）と、Chromium/Firefox/WebKit（Playwright 1.64.1）で同じ公開 `createCommandSession` を受入する。COI/SAB/Worker/waitAsyncと既存CSPを維持する。Safari実機は別証拠があるまで未検証。 | 独立tarballのNode/3browser consumer試験 |
| NFR7.1 | 表示 | 非ASCII・NBSP・全角空白・引用・空文字引数を変形せず保持する。結果bytesをHTML/codeとして評価しない。lsの表示はterrarium互換で、表示文字列（`name/`、`name -> target`）全体のUTF-16 code unit順に並べる。表示上限（1048576 bytes/10000行）はUI側で、原本は切り詰めない。 | 機能設計W2の例表、lsの並べ替え（`a/` と `a.b` を含む）、原本digest不変 |
| NFR7.2 | 予約名 | ls/cat/rm/cd/installはcommandの予約名で、同名で登録されたguestはcommandからは呼べない。U4は登録を拒否・変更しない（登録はU2/C04の範囲）。 | 同名guestを登録した状態での振分け試験と、その仕様の文書化 |
| NFR8.1 | 証拠 | source/pack/guest digestと受入結果を同じ候補へ対応付ける。U4の完了にはU2/U3/U4のB1統合受入（C06）を含み、U3までの証拠をU4の証拠へ読み替えない。 | 別候補・架空digest・skip・欠落を成功に置換しない |
| NFR8.2 | 運用 | 新規費用・認証・公開・外部write権限を導入しない。秘密やresponse全文をログへ出さない。license/noticesを保持する。 | 依存と配布の点検、jjでの切戻し手順 |

## Threats and Boundaries

commandの入力は端末利用者やrecipe作者が書く文字列で、信頼しない。shellの意味を持つ記号は、展開せず、受理もしない（拒否する）。これにより、globやコマンド置換を実行したと利用者が誤解することを防ぐ。引用内の `$` やbacktickはliteralとして渡し、何も評価しない。

U4は状態を持たない。cwd・FS・登録guestの所有者はU2、取得・検証はU3だけで、U4はそれらを再実装しない（unit-of-workの制約）。そのため、U4の欠陥でhostの資源へ触れる経路は作らない。予約は必ず1回で、直接APIと同じ排他を使う。

## Applicability

NFR1（install非DL中央値3000ms）は、U3の正式install経路の性能受入で、U4はinstallをC04へ委ねるだけなので新しい性能目標を持たない（N/A）。ただし、command経由の結果が直接installと同じであることはNFR5.1/NFR8.1の受入で確認する。NFR5の同build-key永続cache・publish直列化はU5/U7/U8の範囲で、U4の排他はNFR5.1として扱う。libraryなので、service availability、tenant認証、DB、backup、監視dashboardは追加しない。法的適合の新しい主張はしない。

## Assumptions & Open Questions

None.
