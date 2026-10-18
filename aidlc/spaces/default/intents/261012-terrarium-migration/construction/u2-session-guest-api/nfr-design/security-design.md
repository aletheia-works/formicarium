# U2 安全性設計

ドキュメント根拠：U2 security-requirements.md、functional-spec.md、C02/C03/C06/C11。以下は設計であり実装・検証は未検証。

## 入力・所有権境界
**NFR3.1** — GuestValidation入口で長さ上限を先に確認しUint8Arrayを私有copyする。同じcopyのfull SHA256、ELF magic/class/endian/machine、header/table安全範囲、各segmentのfile範囲とmemory範囲、PT_INTERP不在を同期確認する。巨大なtable countでもループ前に実bytes範囲を検証し、乗算/加算は安全整数を検証する。期待build-info identityとcanonical digestを一致させて初めてhandleを生成する。

**NFR3.2** — module-private WeakMapを唯一のhandle正当性・byte取得元とする。公開digest/buildInfoは凍結した防御copyで、内部metadataと別所有。forged object・別package instanceは失敗する。同じ正当handleを複数sessionで使う場合も登録用byteをsession側へcopyし、guest stateを共有しない。

**NFR3.3** — fixtureのentry/path/mode/type/inodeIdを全件検証してから変換する。guest絶対pathを正規化し重複を検出、symlink解決は訪問集合でloop/guest root逸脱を検出する。inodeIdでhardlink群の型/内容/mode整合を検証し、copy後も同一inodeの意味を保持する。部分的fixtureをsessionへ反映しない。

**NFR3.4** — raw入力のbyte/count、UTF8 path、metadataのcanonical UTF8 byte数、fixture展開合計をC11上限で検証する。+1/overflowはINVALID_INPUT。大小数の丸めで上限を回避しない。copyの前後で同じ所有byteを検証し、後から元入力を再参照しない。

**NFR3.5** — canonical化はrecursive key sort、array順保持、未知field保持、finite safe integerと合法Unicodeを要求する。raw JSONがある入口はunique keyをparse前に検出する（escaped aliasもdecode後一致）。既存object APIの前に存在したraw重複は復元不能であり、復元を保証しない。取得JSON入口はU3、U2が新たに所有するraw入口があれば同じ制限を適用する。

## session予約と状態保持
**NFR4.1** — ExecutionSession private stateにlifecycle、epoch、activeReservationを置く。acquireは非同期処理開始前に同期で1つを確保し、run/install/fs全入口へ同じ判断を適用する。token identityとepochを両方検証する。resetはepochを進めactive取消・Worker cleanup待機後にinitial FS/cwdへ戻し登録を消す。disposeは同じ取消処理を共有し終端状態へ移す。重複resetは同じcleanupを待ち、disposeはresetの復帰を抑止する。

**NFR4.2** — commitはtoken/epoch/active/signalの全条件を同期再確認して一度だけ反映する。処理用のFS/cwd/guest変更は私有作業状態に留め、失敗で元状態を変更しない。finallyのreleaseは現在tokenと一致した場合だけ解放する。旧releaseが新予約を解除しない。内部runInstalled/builtin継続は同じ予約を使い公開APIを再acquireしない。raw Session.runの既存結果/エラーは維持し、取消ABORTED・dispose開始後DISPOSEDを境界で統一する。

## 実行環境と配布証拠
**NFR6.1** — Node/browser adaptersと既存Worker起動・same-origin URL、COI/SAB、CSP条件を維持する。Node専用importは共通validationへ入れない。browser WorkerのwaitAsync削除を保持。実機Safari成功をWebKit成功から推定しない。

**NFR2.1** — core/build memory cap、timeout、worker/retryの既存設定を変更せず、同一packでprobe/aube回帰する。guest source未変更のaubeを再buildしない。

**NFR2.2** — 新しい配布JSを固定inventoryへ追加し、未収集を0として分母へ含める。Node/ブラウザ/Worker等のrealm証拠を合算し≥80%。具体コマンドと一覧は実装計画で提示し承認を受ける。

**NFR8.1** — pack後のconsumerにexports/types/guest/fixture/copy/session競合を試験し、source/pack/inventory SHAをbindする。U2暫定証拠をB1完全受入れにしない。U4でinstall/command含むC06全環境チェックを完成する。

**NFR8.2** — エラーはcodeと安全な説明を返しguest bytes/秘密URL/host私有pathを漏らさない。pack inventoryでnotices保持を確認する。既存CIの最小権限と未信頼PRからの公開拒否を維持し、通常テストへpublish tokenを渡さない。公開・新規費用は版ごとの承認を要する。切戻しはU2のsource変更をjjで戻し同じpack/回帰をやり直し、terrariumはFR16まで維持する。

## 失敗領域と試験
不正入力はWorker起動前に拒否する。session失敗はそのsessionへ限定、shared immutable handleを汚染しない。テストは正常系に加えtable overflow/末尾不正entry/最大+1/metadata mutation/偽handle/旧commit/旧release/reset-dispose競合を決定的に再現する。HTTP、archive、非同期解凍のyield/cancelはU3の責務で、U2設計へ実装を混ぜない。
