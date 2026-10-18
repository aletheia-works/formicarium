# U3性能基準未達への追加計画案

## 観測結果
実HTTPS36試行は全件、固定資産のdigest・出力・終了コード一致を確認した。正式受入れはBiome/Firefoxの非ダウンロード中央値3435.58msで未達。基準3000msを維持する。対象証明書の終了後削除・未登録は確認済み。

| 対象 | Chromium | Firefox | WebKit |
|---|---:|---:|---:|
| aube | 1548.025ms | 2179.76ms | 1753.48ms |
| Biome | 2428.5ms | 3435.58ms | 2873.32ms |

Biome/Firefoxの工程別中央値はdigest167.60ms、validate2636.46ms、register6.24ms、run613.78ms。hostBenchは約1msで安定。工程ごとの中央値の和と合計の中央値は別値である。

## 最小変更案
runtime/guest-validation.tsのguestSha256は、約66MBのBiomeで約103万の64byteブロックを処理する。その各ブロックの状態読み出しのdestructuringと、状態更新の配列・entries iteratorを、8要素の直接読み出し・直接更新へ置き換える。割当て削減による効果は推測で、性能は再計測するまで未検証。

変更対象はruntime/guest-validation.tsと生成JS、tests/migration-install/hash-regression.test.tsと生成JS、計画・試験手順・CI/完了入口の対象試験追加、source-manifest/追跡資料。公開同期validateGuestの型・動作、64roundとpadding/endianness、ELF全byteのhash、所有copy、metadata/buildKey確認、private GuestHandle brandを維持する。

U2共有C03の変更になるため、現在のU3計画へ明示的に追加して実装前に承認を受ける。U3のsource claimに共有変更も個別列挙し、独立レビューと必要な共有コードの再確認を行う。

## 検証と継続条件
実装後に独立Node cryptoとのSHA照合を追加する。既知vector、空入力、55/56/63/64/65byte境界、複数block、binary、offset付きUint8Arrayを含める。既存C03の異常ELF/digest/metadata/偽造handle拒否・copy保護、U3 install、Nodeと3browserの独立consumerを再確認する。

新source inventory・候補・独立consumerを固定し、同じaube/Biome・3browser各6回の実HTTPS36試行を再実施する。非DLの全工程を計上しmedian≤3000msを確認、終了後に一時証明書を削除する。失敗は確認する。成功後に全21JS coverage80%以上・既存回帰・署名付き同一候補CIの計画を続行する。

## 維持する条件
3000ms、各probe600s/aube840s、worker1/retry0、wasm1GB、native出力一致、全JS/realmのcoverage分母、TLS検証を維持する。AI-DLC本体は変更しない。効果不足なら次の改善案を確認し、追加のアルゴリズム変更を自動で混ぜない。
