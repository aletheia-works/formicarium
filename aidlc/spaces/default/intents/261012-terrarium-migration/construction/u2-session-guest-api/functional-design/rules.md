# セッション・guest APIの規則

## Rule Model

```yaml
rules:
  - id: BR2.1
    statement: guest byteとmetadataを独立copyして全期待identityを同期検証する
    category: validation
    applies_to: ValidatedGuest
    trigger: validateGuest
    logic: IF digest・ELF64・little-endian・x86-64・静的・全header/segment範囲・metadata期待値の全てが一致 THEN branded handleを返す
    violation: INVALID_INPUT、handle生成なし
    source: FR2/NFR3/C03/C11
  - id: BR2.2
    statement: 外部objectからhandleの実行権限を作れない
    category: authorization
    applies_to: ValidatedGuest
    trigger: runValidatedGuest/registerValidatedGuest/commitGuest
    logic: IF 同packageで認識する内部brandがありprivate byteを所有 THEN そのbyteのみを使う
    violation: INVALID_INPUT、実行・登録なし
    source: FR2/NFR3/C03
  - id: BR2.3
    statement: fixtureはguest path境界とFS identityを保持する独立copy
    category: validation
    applies_to: FixtureSnapshot
    trigger: fixtureToFsEntries
    logic: IF 必須mode/inodeIdと有限上限が満たされ、正規化path重複・NUL・root脱出・link脱出/loopがない THEN hardlink identityを保持してcopyする
    violation: INVALID_INPUT、元入力とsession不変
    source: FR2/NFR3/C03/C11
  - id: BR2.4
    statement: 全状態操作は一つの予約を使い同時操作を待ち行列へ入れない
    category: constraint
    applies_to: SessionState/Reservation
    trigger: direct APIまたはC02操作
    logic: IF idle THEN 予約、IF activeまたはresetting THEN BUSY、IF disposing/disposed THEN DISPOSED。内部継続は予約済みportを使い二重acquireしない
    violation: 既存登録・FS/cwdを変更しない
    source: FR5/C02
  - id: BR2.5
    statement: guest置換は現在の予約とepochと取消状態が一致した成功候補だけ
    category: constraint
    applies_to: installedGuests
    trigger: commitGuest
    logic: IF active token・epoch一致かつ取消なし THEN 一操作でtool登録を置換。旧token/epoch/取消はABORTED、廃棄はDISPOSED
    violation: 旧登録・FS/cwdを保持
    source: FR5/NFR3/C02
  - id: BR2.6
    statement: reset/disposeはepochを進め取消とcleanupを待つ
    category: policy
    applies_to: SessionState
    trigger: reset/dispose
    logic: IF reset THEN 登録を全消去し進行中操作を取消、cleanup後に初期FS/cwdへ戻す。IF dispose THEN 登録消去とcleanup後disposed。古い応答はcommitしない
    violation: dispose後resetもDISPOSED、遅延成功で復活しない
    source: FR5/C02
  - id: BR2.7
    statement: 解放はtoken所有者だけが行う
    category: constraint
    applies_to: Reservation
    trigger: releaseまたはcleanup
    logic: IF token一致 THEN 自分の予約を解放、IF 不一致 THEN 新予約を触らない。成功/失敗どちらもcleanup完了を待つ
    violation: 旧releaseによる新active解放なし
    source: FR5/C02
  - id: BR2.8
    statement: 公開既存runと検証済みrunの意味を分け互換性を維持する
    category: policy
    applies_to: SessionState
    trigger: run
    logic: IF 既存raw byte run THEN 既存copy/RunResult契約、IF validated run THEN private検証copyと同一予約/Worker/timeout/FS commit契約。正常guestの非0終了も既存結果としhost失敗は既存error
    violation: 新error codeやmetadata保証を既存runへ黙って追加しない
    source: FR2/FR5/NFR2/NFR6/C03
  - id: BR2.9
    statement: canonical metadataと入力容量の検証責任を境界で明示する
    category: validation
    applies_to: ValidatedGuest/FixtureSnapshot
    trigger: metadata/fixture入力
    logic: IF 正規化対象値が有限安全整数・文字列・boolean・nullでunknown付加field含め一致し孤立surrogateがない THEN 受理。raw JSON入口の所有者は重複keyをparse前に拒否、U2はobject化で失われたraw情報を復元したと主張しない
    violation: INVALID_INPUT、metadata1MiB/ELF128MiB/fixture256MiB/4096entry/path4096bytesの上限+1拒否
    source: FR2/NFR3/C03/C11
  - id: BR2.10
    statement: U2単独候補とB1最終受入を区別する
    category: policy
    applies_to: ApiCandidateEvidence
    trigger: candidate検証
    logic: IF U2完了 THEN 自分のAPI/types/inventory/consumerと公開基点照合を記録、IF U4統合後 THEN 同source/packと全C06集合を再検証してB1を成立させる
    violation: 欠落/重複/failed/unverifiedを最終成功へ補わない
    source: FR6/NFR8/C06
  - id: BR2.11
    statement: 型と配布入口は承認済み既存APIに追加し検証した資産を受け渡す
    category: policy
    applies_to: ApiCandidateEvidence
    trigger: package候補
    logic: IF source・pack・全JS/types/assets inventoryとNode/3browser consumer証拠が一致 THEN 候補と表示。実公開は具体版と対象の承認後のみ
    violation: private RCと公開0.2.1の同一視なし、未承認公開なし
    source: FR6/NFR2/NFR6/NFR8/C06
  - id: BR2.12
    statement: C02のresolvePathは現在のcwdを読むだけでguest pathを解決する
    category: validation
    applies_to: SessionState
    trigger: C02 resolvePath
    logic: IF 空でない文字列 THEN 相対pathは現在のcwdに付け、絶対pathはそのまま、既存のpath正規化規則で正規化して返す。予約を取らず、状態を変えない。戻り値は呼出し時点のcwdにもとづき、dispose・reset・abortは検査しない。呼出し側は予約を保持している間か、同じtickのうちに値を使う
    violation: 空・`..`・NUL・文字列でない値は同期でINVALID_INPUT。状態・予約は不変
    source: FR5/C02
```

## Rule Summary

BR2.1–3/9がguest・fixture入力検証、BR2.4–8が排他・commit・取消・既存run互換、BR2.10–11が候補供給と後続B1受入、BR2.12がC02のpath解決を担当する。C11の取得・展開と取消yieldはU3/U5等の取得側責任でありU2の同期純粋検証へ非同期shapeを独断追加しない。
