# セッション・guest APIの機能仕様

## Sources and Boundary

承認済み要件FR2/FR5/FR6、C02/C03/C06/C11、componentsとunit-of-workを具体化する。U1の開始証拠・独立レビュー・共通検証は成功し単位checkpointが承認済み。U2では取得/install/parser/build/verdictを実装せず、Session状態と純粋guest/fixture検証を提供する。本資料は設計（ドキュメント根拠）、製品動作は未検証。

## Workflows

### WF2.1 検証と実行・登録

1. callerのbyteとmetadataを独立copyし、BR2.1/9の全検証を同期実施する。
2. 全一致した場合だけprivate byteと内部brandを持つhandleを返す。公開digest/buildInfoは表示用で実行権限ではない。
3. runValidatedGuestは正当なsession/handleを確認し、Sessionと同じ排他を一度取得する。
4. private byteを既存Worker実行へ渡す。元入力・公開metadataが変更されても実行byteは変わらない。
5. 結果とFS commitは既存runの成功/失敗契約に従い、cleanup完了後に自分の予約を解放する。
6. registerValidatedGuestは同じ予約とsignalでBR2.5の原子的置換を行い解放する。取得やFS書込みを伴わず、旧登録を失敗時に保持する。

### WF2.2 内部installと直接APIの競合

1. U3がC02 acquire(install)でtoken/epochを受け取る。
2. U3は取得候補を別途検証する。直接run/FS/登録又は他installが来たらBUSY、待機させない。
3. U3は公開登録APIを再帰呼出しせず、予約済みcommitGuestを使う。
4. current token/epoch/signal一致なら登録置換、不一致又は取消ならABORTED、廃棄ならDISPOSED。
5. releaseは自分のtokenだけを解放する。遅延releaseで新予約を解放しない。

### WF2.3 reset/dispose

1. epochを進め、操作を取消状態へ移し、登録guestを消去する。
2. 進行中の取得/Workerに取消を通知する。古い応答のFS/guest commitを拒否する。
3. 操作が所有する資源のcleanup完了を待つ。reset中の新操作はBUSY、dispose開始後はDISPOSED。
4. resetは既存Sessionの初期FS/cwdを復元してidleへ戻る。disposeはdisposed終端へ移る。
5. resetの重複要求は同じcleanup完了を待ち、disposeが重なればdisposedを優先して復活させない。disposeの再要求は既存disposeの冪等な完了を待つ。dispose後resetはDISPOSED。

### WF2.4 fixture変換

1. guest absolute pathを正規化し、host pathへ解決しない。
2. 全entryの必須mode/inodeId、重複path、NUL、root脱出、symlink escape/loop、hardlink参照を検査する。
3. entry数、全fileの展開合計、path UTF-8長はC11の含む上限を適用する。上限+1を拒否する。
4. 正当なinode関係を保ちfile bytesを独立copyしたFsEntry一覧を返す。入力/sessionへの副作用なし。

### WF2.5 公開候補と後続受入

1. 公開0.2.1の履歴/source/packとprivate RCを照合し差異を記録する。
2. 既存公開Sessionを維持しrootへC03の追加型/関数を用意する。Node/browserで同じ公開仕様を提供する。
3. U2暫定candidateの全first-party JS/types/assets inventory・pack/source digestを固定する。
4. Node/Chromium/Firefox/WebKitのguest-validation/fixture-validation/handle-copyとpackage consumer、自分の状態取消を検証する。固定coverage分母と既存品質を維持する。
5. U3/U4統合前のinstall-lifecycle/command-behavior全checkを成功としない。U4で同source/packの全C06 checkを再生成する。
6. 公開操作は別途具体承認後。実装候補を公開済み又はB1最終受入済みと表示しない。

### WF2.6 path解決（C02 resolvePath）

1. U4のcommandなど同package内の呼出し側が、guest pathをC02 `resolvePath` へ渡す。
2. 空でない文字列なら、相対pathを現在のcwdに付け、既存のpath正規化規則で正規化した絶対pathを返す。空・`..`・NUL・文字列でない値は同期で `INVALID_INPUT` を投げる（BR2.12）。
3. 予約を取らず、cwd・FS・登録を変えない。dispose・reset・abortは検査しない。
4. 呼出し側は、予約を保持している間か同じtickのうちに値を使い、解決後の絶対pathを既存の操作（listEntries、C02 builtin）へ渡す。それらの操作が従来どおり予約・BUSY・ABORTED・DISPOSEDを判定する。

## State Machine

| 現状態 | 入力 | 次状態/結果 | 不変条件 |
|---|---|---|---|
| idle | 正当な予約 | active | 一つのtokenのみ |
| active | 他の操作 | BUSY、active維持 | 旧FS/cwd/登録保持 |
| active | current成功commit | active（commit後） | 検証copyのみ原子的更新 |
| active | 旧token/epoch又は取消commit | ABORTED | 登録/FS不変 |
| active | current releaseとcleanup完了 | idle | 旧releaseは無効果 |
| idle/active | reset | resetting→idle | epoch増加、登録消去、cleanup待ち、初期FS/cwd |
| resetting | 通常操作 | BUSY | cleanup中に新予約なし |
| idle/active/resetting | dispose | disposing→disposed | epoch増加、cancel、cleanup、復活なし |
| disposing/disposed | 通常操作/reset | DISPOSED | 終端 |

validateGuestとfixtureToFsEntriesはSessionを持たない純粋API。UNSUPPORTED_ENVは既存環境の不足、入力拒否はINVALID_INPUT。存在しない登録/pathはNOT_FOUND、Worker/coreは既存error分類。新error codeを追加しない。

## Derived Entity View and Rule Summary

図の代替テキスト：SessionStateは0又は1のReservationを所有し、toolごとにValidatedGuestを参照する。GuestValidationはValidatedGuestとFixtureSnapshotを生成する。MigrationAcceptanceのApiCandidateEvidenceはこれらの試験をdigestで参照し状態を所有しない。authoritativeな属性と関係はentities.mdのYAML、規則はrules.mdのYAML。図は省略し重複したsource-of-truthを作らない。

| 規則 | 行動 |
|---|---|
| BR2.1/2/9 | 検証copy・brand・canonical/容量検査 |
| BR2.3 | fixture/path/inode境界 |
| BR2.4–7 | 一予約・原子的登録・epoch取消・cleanup |
| BR2.8 | 既存run/Worker/結果互換 |
| BR2.10/11 | U2候補とU4最終B1の分離・公開前承認 |
| BR2.12 | C02のpath解決（cwdの読取りだけ） |

## Acceptance and Corners

FR2：digest/metadata/ELF bounds/PT_INTERP/違うtarget/patch/dependency/buildKey、偽造handleと他package brand、元byte/metadata変更、空fixture/奇異path/正規化重複/link loop/hardlink identity、各上限−1/上限/+1をNode/3browserで検証。canonical unknown付加fieldもidentityへ含める。raw JSON duplicateは入力をobject化する境界の責任で、復元できない情報を検証済みと呼ばない。

FR5：直接run/FS/registerとC02 installの交差、二重acquireなし、旧release、reset/dispose/abort直後のlate commit、cleanup後即再実行、成功再登録/失敗旧登録保持を検証。session間でFS/cwd/登録は独立。無期限の操作queueや別状態ownerを作らない。resolvePathは相対・`.`・絶対pathの解決、cd・reset後の解決、空・`..`・NUL・文字列でない値の拒否、状態不変、予約を取らないことを検証する。

FR6：公開基点照合、追加types/exports、source/pack/inventory一致、consumer全環境、配布asset同一性を検証。U2暫定とU4統合後のC06を区別する。実機Safariは未検証のまま。HTTP・archive取得・進捗UIはU3、shell/parser/transcriptはU4、toolbuild/verdictはU5/U6、tenant/auth/金額/個人情報保持は対象外。

## Assumptions & Open Questions

None.
