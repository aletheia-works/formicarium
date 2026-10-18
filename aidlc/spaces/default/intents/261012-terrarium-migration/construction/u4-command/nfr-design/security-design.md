# commandの安全性・寿命設計

## Sources

根拠は `../nfr-requirements/security-requirements.md`（NFR2.1–2.2、NFR3.1–3.3、NFR4.1–4.2、NFR5.1、NFR6.1、NFR7.1–7.2、NFR8.1–8.2）、`../nfr-requirements/tech-stack-decisions.md`、`../functional-design/functional-spec.md`（W1–W6、状態機械）、`../../../inception/contract-design/contract-summary.md`（C02/C03/C04/C05/C11、Transcript）。機能設計とNFR要件のレビューで後工程扱いにしたMinor指摘は、人間の判断に従い、ここで設計として確定する。以下はドキュメント根拠で、実装・互換性・性能は未検証。

## D1：入力の検証境界

executeは最初に、入力が文字列であることと、UTF-8での長さを確認する。長さは `TextEncoder` で変換した後のbyte数で数え、65536 bytesまで受理、65537 bytesでINVALID_INPUTとする。孤立surrogateを含む文字列はUTF-8へ正しく変換できないため、変換前に検出してINVALID_INPUTにする（置換文字U+FFFDへ黙って変えない）。LF・CR・NULもこの段階で拒否する。ここまでとTokenizer・形の検証（D2）は、予約の前に終える。拒否した入力では、Session・Installer・登録のどれにも触れない（NFR3.1、NFR5.1）。

## D2：Tokenizerと振分け

Tokenizerは機能設計W2の5状態機械で、依存は追加しない。引用外の `| & ; < > $` backtick `* ? ( ) { }` は拒否する。単引用内はliteral。二重引用内は `\"` と `\\` だけをescapeとして扱う。引用外の `\x` は x。`$` やbacktickは展開しない。結果のTokenは、非ASCII・NBSP・全角空白をそのまま保持する（NFR7.1）。

振分けは argv[0] の完全一致で行う。`ls` `cat` `rm` `cd` `install` は予約名で、同名で登録されたguestは command からは呼べない。U4は登録を拒否・変更しない。この仕様は公開型のJSDocとdocsに明記する（NFR7.2）。pathとselectionはTokenのまま、U2とC04へ渡す。U4はhostのFS・URL・環境変数を参照しない（NFR3.2）。

## D3：予約・取消・timeout

各経路が取得する予約は1回だけで、直接APIと同じU2の排他を使う（NFR5.1）。
- cat/rm/cd：C02 `acquire('fs')` → `builtin` → `release`（finallyで必ず解放）
- ls：公開 `listEntries` を1回（内部でfs予約を1回）
- install：内部Installerの `install`（C04がinstall予約を1回）
- guest run：`acquire('run')` → `runInstalled` → `release`（finally）

取消（NFR4.1）：
- 予約の前に `options.signal.aborted` を確認する。abort済みなら、予約を取らずにABORTEDでrejectする。
- builtin（ls/cat/rm/cd）は、U2が同期に完了させる操作である。開始後はsignalで中断せず、完了した結果を返す。開始後に立ったsignalは結果に影響しない（この挙動を型のJSDocに明記する）。
- installとguest runはsignalをC04・Session.runへ渡す。取消後の結果は、それぞれの契約（旧登録保持、ABORTED）に従う。U4は再試行・待ち行列・fallbackを持たない。

timeout（NFR4.2）：guest runの `runInstalled` には `{signal, onOutput}` だけを渡し、timeoutMsは渡さない。既存Session.runの既定値600000ms（`runtime/validation.ts`）が適用される。installの取得120s・全体180sはC04/C11のまま。CommandOptionsにtimeoutは追加しない（C05のshapeを変えない）。

識別子：CommandRequestのcommandIdは任意とする（予約をU4が直接持つのはcat/rm/cd/guest runだけのため）。結果側では、guest runならRunResultのrunId、installならinstallation.operationIdで操作を識別する。CommandResultのshape（C05）は変えない。

## D4：結果と表示の境界

stdout/stderrは呼出しごとに新しい `Uint8Array` を作って返し、内部bufferの参照を渡さない（NFR3.3）。guest runの結果はRunResultからcopyする。U2の検証済みcopyだけを実行する（C03）ので、登録後に元bytesを変更しても実行は変わらない。

lsの表示（NFR7.1）：listEntriesの結果から、dirは `name/`、symlinkは `name -> target`、fileは `name` の表示文字列を作る。その表示文字列全体をUTF-16 code unit順（JSの既定sort）で並べる。これはterrariumの `.sort()` と同じ順になる。例：`a/` と `a.b` では `a.b` が先（`.`=0x2E が `/`=0x2F より小さい）。各行の末尾に改行を付け、0件なら空bytesとする。

installの成功表示は `installed <tool>@<versionOrName> (sha256 <digest>)` と改行の1行で、stderrは空。

UI条件の受渡し（NFR7）：loading/empty/errorの区別、keyboard操作、進捗unknown（totalBytes=null）と0の区別、offset付き時刻、表示上限（1048576 bytes/10000行）はU6/U8の責任である。U4はProgressをC04から変えずに中継し、結果bytesを切り詰めず、HTML/codeとして評価しない。この受渡しを公開型のJSDocとdocsに明記し、U6/U8のconsumer試験で確認する。

## D5：品質と受入証拠

U4で追加する配布JSを第一者配布JSの固定inventoryと、coverageの全realm期待集合に加え、Node・Worker・process・browserの生counterで80%以上を確認する（NFR2.2）。既存のprobe 8項目・aube native一致・wasm 1GB・waitAsync削除は維持し、未変更aubeは再buildしない（NFR2.1）。

consumer試験は独立tarballで、Node（開発・CIはNode 26.12.0）とChromium/Firefox/WebKit（Playwright 1.64.1）を対象にする（NFR6.1）。browserのbuild番号は文書に固定せず、試験の実行時に観測した値を証拠に記録する。Safari実機は未検証として区別する。

U4の完了にはB1統合受入（C06：U2/U3/U4の全checkを同じsource/packで）を含む。U3までの証拠やU3の完了確認コマンドを、U4の証拠へ読み替えない（NFR8.1）。新しい完了確認コマンドは別途作成し、人間の承認を得る。

## Threat Response and Rollback

不正入力・形・長さはINVALID_INPUT、未登録toolはNOT_FOUND、競合はBUSY、取消はABORTED、廃棄はDISPOSED。guestのhost/core/timeoutは既存ExecutionError。どの拒否・失敗でも、U4自身は状態を持たないため、FS・cwd・登録はU2/U3の失敗契約どおり保持される。新規費用・常駐service・認証・永続storage・自動再試行は導入しない（NFR8.2）。jjでU4に限った変更を戻せるようにし、既存の公開版は保持する。

## Assumptions & Open Questions

None.
