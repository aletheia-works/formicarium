# installのルール

## Sources

承認済みFR4/FR5/FR6とC02/C03/C04/C11。User Stories未生成のため要件IDを直接対応させる。以下はドキュメント根拠、実行は未検証。

## Rules

```yaml
rules:
  - id: BR3.1
    statement: "factoryはC04に従い同packageのSessionとcatalog全体を検証/copyする"
    category: validation
    applies_to: InstallCoordinator
    trigger: "factory"
    logic: "IF 不正Session/schema/必須field/重複/既定参照/サイズなら取得前拒否 THEN 規範条件のみ継続する"
    violation: "INVALID_INPUT、session不変"
    source: "FR4 NFR3"
  - id: BR3.2
    statement: "selectionはtool又はtool@versionOrNameのexact matchだけ"
    category: validation
    applies_to: InstallCoordinator
    trigger: "install入力"
    logic: "IF 未知/空/任意URL/複数@/不正identifier/一意でない選択を拒否、省略版はdefaultsだけ THEN 規範条件のみ継続する"
    violation: "INVALID_INPUT、通信なし"
    source: "FR4"
  - id: BR3.3
    statement: "全installは通信前にU2共通予約を一度取得する"
    category: constraint
    applies_to: InstallCoordinator
    trigger: "予約"
    logic: "IF activeならBUSY、disposedならDISPOSED、事前abortならABORTED、commandも同じ予約 THEN 規範条件のみ継続する"
    violation: "拒否時状態不変"
    source: "FR5"
  - id: BR3.4
    statement: "取得はC11のHTTPS、credential omit、有限deadlineとbyte累積を強制する"
    category: policy
    applies_to: InstallCoordinator
    trigger: "fetch"
    logic: "IF 最大5redirect全hop検査、loop/HTTP/userinfo拒否、検査不能browserは受入済みredirectなし同originミラーのみ THEN 規範条件のみ継続する"
    violation: "HTTP/CORS/offline/429/不正body=ASSET_LOAD、timeout=TIMEOUT、retry/fallbackなし"
    source: "FR4 NFR4 NFR8"
  - id: BR3.5
    statement: "tar.gzは全entryを検査し一意選択ELFのみ候補へ渡す"
    category: validation
    applies_to: InstallCoordinator
    trigger: "展開"
    logic: "IF 展開256MiB/4096entry/path4096bytes、escape/duplicate/link escape/loop/truncate/bomb拒否、選択外entryも検査 THEN 規範条件のみ継続する"
    violation: "不正archive/上限=INVALID_INPUT、旧登録不変"
    source: "FR4 NFR3"
  - id: BR3.6
    statement: "取得digestと抽出ELFのdigest/実byte数を別々に照合しC03でguestを検証する"
    category: validation
    applies_to: InstallCoordinator
    trigger: "digest/validate"
    logic: "IF metadata canonical規範と全identityを確認、検証copyと内部brandを維持 THEN 規範条件のみ継続する"
    violation: "不一致=INVALID_INPUT、実行/登録しない"
    source: "FR4 NFR3"
  - id: BR3.7
    statement: "成功候補のみ同token/epochで原子的登録する"
    category: constraint
    applies_to: InstallCoordinator
    trigger: "register"
    logic: "IF C02 commitGuestで同tool置換、失敗/abort/timeout/reset/dispose/旧epochは候補を破棄 THEN 規範条件のみ継続する"
    violation: "旧登録維持、reset/disposeはU2規範どおり全登録消去"
    source: "FR5"
  - id: BR3.8
    statement: "取消/deadline/cleanupは全工程に適用する"
    category: policy
    applies_to: InstallCoordinator
    trigger: "操作寿命"
    logic: "IF fetch120000ms、予約からcommit全体180000ms、単調clock、現在時刻がdeadline以上でtimeout、chunk境界で取消確認、reader/展開を停止し全finallyでrelease THEN 規範条件のみ継続する"
    violation: "TIMEOUT又はABORTED/DISPOSED、遅いresponseのcommitなし"
    source: "FR5 NFR4"
  - id: BR3.9
    statement: "進捗はoperationId/sequenceと工程・処理量を通知する"
    category: policy
    applies_to: InstallCoordinator
    trigger: "各工程"
    logic: "IF fetch→extract（ELFなら省略）→digest→validate→register、unknownと0を区別、callback例外を通知障害として扱い結果を変更せず、終了後停止 THEN 規範条件のみ継続する"
    violation: "通知へ秘密/body全文を出さない、HTMLとして実行しない"
    source: "FR4 NFR7 NFR8"
  - id: BR3.10
    statement: "正式install経路の受入結果は同じ入力identityと全環境を記録する"
    category: calculation
    applies_to: InstallCoordinator
    trigger: "単位受入"
    logic: "IF aube/Biome×3browser×初回+5回、非DL5工程合計median≤3000ms、fetch別/最大/初回/host負荷、Node/3browser consumer、固定分母coverage80%以上 THEN 規範条件のみ継続する"
    violation: "不足/skip/閾値未達は失敗、U4後B1成立や公開済みと扱わない"
    source: "FR1 FR6 NFR1 NFR2"
```

## Summary

| Rule | 意味 |
|---|---|
| BR3.1 | factoryはC04に従い同packageのSessionとcatalog全体を検証/copyする |
| BR3.2 | selectionはtool又はtool@versionOrNameのexact matchだけ |
| BR3.3 | 全installは通信前にU2共通予約を一度取得する |
| BR3.4 | 取得はC11のHTTPS、credential omit、有限deadlineとbyte累積を強制する |
| BR3.5 | tar.gzは全entryを検査し一意選択ELFのみ候補へ渡す |
| BR3.6 | 取得digestと抽出ELFのdigest/実byte数を別々に照合しC03でguestを検証する |
| BR3.7 | 成功候補のみ同token/epochで原子的登録する |
| BR3.8 | 取消/deadline/cleanupは全工程に適用する |
| BR3.9 | 進捗はoperationId/sequenceと工程・処理量を通知する |
| BR3.10 | 正式install経路の受入結果は同じ入力identityと全環境を記録する |

