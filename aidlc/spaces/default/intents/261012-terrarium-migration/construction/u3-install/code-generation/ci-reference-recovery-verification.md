# U3 CI入力：固定参照による復旧記録

## 状態と証拠の境界

2026-10-16更新。検証済み：main sessionが承認済み修正のbuild/typecheck、acceptance32件、新CI入力prepare/inspect/restore、復元済み実サイトのintegration8件に加え、新候補の非TLS18工程をすべてexit0で実行した。本担当はコード・試験を実行していない。canonical manifestと新regression report・全18raw logをread-onlyで読み、記載のSHA・件数・成功summaryを再確認した。

U3正式受入れは未完了。新source/packの非TLS回帰・coverageと正式36試行は成功した。mainの一時証明書登録・計測・削除wrapperはexit0、削除後の未登録も確認済み。署名付き専用CI、独立最終レビュー、新しい短い完了確認コマンドの承認・実行は残る。U1/U2専用v5の成功や旧候補の36試行を新U3の証拠へ置換しない。実機Safariは未検証。

## 不具合と失敗観測

旧CI入力は実配信サイトを含まず、U2_ACTUAL_SITEなしでは実配信integrationが8件中6pass・2skipでもexit0になった。U3受入入口もexit0だけを使い、このskipを拒否しなかった。mainが実子プロセスの正のpassとskip/TODOを含むTAP/specを確認し、必要な拒否が欠落するREDを観測してから修正した。初回の再帰runner警告だけの観測は意図したREDに数えていない。

その後、固定11ファイル全部を圧縮したarchiveが59173768bytesと判明した。既存217941020bytesと合わせ277114788bytesとなり、256MiB上限268435456bytesを8679332bytes超過。上限を変えずに停止し、人間が既存guestの固定参照を使う改訂計画を承認した。

固定参照案の新REDは、version2 archiveの受入れがunknown destination、参照guestのarchive混入拒否がMissing expected exceptionとなる2件。main観測は30tests・28pass・2fail。これを確認してから10件archive+固定参照1件へ変更した。

## 修正した境界

- scripts/migration-install/ci-inputs.ts：全11ファイルの固定path・bytes・SHAを維持し、10ファイルをversion2 archiveに格納する。残りのguestは既存CI入力の単一固定pathだけから取得する。
- sourceは `dist/guests/aube`、36948544bytes、SHA256=c7d7d13692d01c5f6adc5511c40adc6b3769080b7c433b44c411a3e52ebcd99e。
- destinationはサイト内の `dist/aube/83a42e281acf38e98fbbddf590e77746dcb9dfdb12cce4b27d1eb1926e1e5b5d/guest`。同じdigestの別pathを探索・fallbackしない。sourceはmanifest/blobと復元後regular fileの双方で検証する。
- archive内へ参照guestが混入した場合、未知/欠落/重複path、symlink、header/checksum/padding/endの破損、各上限超過を拒否。全11件のmaterializedサイトにも容量・件数と全SHAを適用する。
- ci.tsとworkflow：必須試験の開始前にサイトを復元し、U2_ACTUAL_SITEをU3専用復元先へ固定する。prepared contextとGITHUB_ENVで別processへ引き継ぐ。
- completion.tsとci.ts：必須テストの正の実試験数、fail/cancel/skip/TODOなしをTAP/spec/Playwrightの生summaryで確認する。保存済みログのhash/exitとsummaryを再検査してからchecksCompletedを作る。build/npm install等の非テストに試験summaryを要求しない。
- 意図的なskip/TODOの子試験はraw logを検査し、親への転送だけを止める。実際の必須試験のskipを削除・隠蔽して合格へ置換しない。

## mainの成功観測

Node実行版のパスは /Users/mutoakio/.local/share/mise/installs/node/24.21.0/bin/node。mainが順番に実行し、次を確認した。

| Command・工程 | 観測結果 |
|---|---|
| mise run build | exit0 |
| mise run typecheck | exit0 |
| node --test --test-concurrency=1 tests/migration-install/acceptance.test.js | 32pass、fail/skip0 |
| node scripts/migration-install/ci-inputs.js prepare-site .artifacts/u2-guest-distribution/site-repair-v1 | version2 archive新規作成成功 |
| 新canonical入力のprepare/inspect/restore | すべてexit0 |
| U2_ACTUAL_SITEを復元先へ設定したtests/guest-distribution/integration.test.js | 8pass、skip0 |

acceptance32件には既存境界、TAP/spec実子プロセスのskip/TODO拒否、Playwright/空summary・改変log拒否、各容量/件数上限と+1、site missing/extra/同サイズ改変/symlink、version2の混入拒否、固定sourceのwrong path/欠落/byte・digest差/重複/fallback拒否と正常copyを含む。

## 新候補の非TLS18工程

- candidate：.artifacts/migration-install/candidate-536a358f-541e-47f7-a288-f944f653c204/package.manifest.json
- context：.artifacts/migration-install/reference-local-context-20261015.json
- source identity：eb50f0266503138e68569f5e6084da8f4c1e6903c063f07a7365606b1f82804e
- pack SHA256：cc89a7dcdd015da80b9c11569a4fef2daa8b3f2131610caa7fa20682c6e995b2（製品pack bytesは従来候補と同一、source identityは修正後）
- report：.artifacts/migration-install/reference-regressions-5908a7fa-fd16-487f-96ce-9592ac915803/regression-report.json
- report SHA256：33d657b8842755c9e48a3df5c61e7f3795a2e0f6102571abf29aa45ffe30485b
- mainの逐次実行時刻：2026-10-15T14:55:35.851Z–16:01:46.411Z（JST 10月15日23:55–10月16日01:01）

| 工程 | raw logの観測 |
|---|---|
| 1–2 build/typecheck | exit0 |
| 3 test-light | 185pass + 237pass |
| 4 acceptance/CI | 42pass |
| 5–6 U2/U3 unit | 44pass / 74pass |
| 7–8 U2/U3 browser | 9pass / 45pass |
| 9 独立consumer | 195pass |
| 10 Node回帰 | 28pass |
| 11 browser回帰 | 33pass |
| 12 coverage準備 | exit0 |
| 13–14 instrumented Node | 115pass / 115pass |
| 15–17 instrumented browser（package/U2/U3） | 99pass / 9pass / 9pass |
| 18 coverage集計 | exit0、passed=true、threshold=80 |

全18工程exit0。Node各summaryのfail/cancel/skip/TODOはすべて0。coverage reportは全21JS、1483realm、1768/1929行=91.65%、skipped=0。regression reportのstatusはlocal-regressions-only、acceptancePassed=false、formal36とsignedCIはpending。この結果から正式36試行やCIの成功を推定しない。

## 同source/packの正式36試行

- report：.artifacts/migration-install/formal36-reference-20261016/measurement-report.json
- report SHA256：68b35055713621e07de6ac57851e1a096ba973ff2a05d0faf776330db9bdd975
- recordedAt：2026-10-15T16:03:26.594Z（JST 10月16日01:03）
- source identity：eb50f0266503138e68569f5e6084da8f4c1e6903c063f07a7365606b1f82804e
- pack SHA256：cc89a7dcdd015da80b9c11569a4fef2daa8b3f2131610caa7fa20682c6e995b2
- thresholdMs=3000、trialCount=36、passed=true。全36trialのexitCode=0/CORS passedと出力digest、report SHA・source/packをread-onlyで確認した。

| 非download中央値(ms) | Chromium | Firefox | WebKit |
|---|---:|---:|---:|
| aube | 785.7300000786781 | 1747.5000000000002 | 752.08 |
| Biome | 1053.6850000023842 | 2661.84 | 1045.94 |

6組すべて3000ms以下。mainはTLS検証を省略せず実行し、run-reference-formal36.shのexit0、Temporary localhost trust/certificate removed、証明書の削除後未登録（find exit44）を確認した。現在有効な登録・待機sessionはない。非TLSregression report内のformal36=pendingは作成時点の値として保持し、この新measurement reportで成功を示す。signedCIと短い正式完了確認は未実施。

## 固定した実入力

| 項目 | 実測・識別子 |
|---|---|
| archive | .artifacts/migration-install/actual-site-v2.tar.gz |
| archive bytes | 36727106 |
| archive SHA256 | 9c0dd08a854487501c5b2dcd2dc9ce5f703bddf993fc0156586776c2cf63307f |
| archive展開byte数（tar） | 76110336 |
| archiveの固定file数 / 参照copy | 10 / 1 |
| 新CI manifest | ci/migration-install/inputs.bundle.json |
| manifest SHA256 | 211041688ff38a16eb449d37263030543a3c7655e23a0dd9ec7e7886b15a0ae6 |
| logical files / source rows | 22 / 330 |
| logical bytes | 254668126 |
| 256MiB上限までの余裕 | 13767330bytes |
| 復元先 | .artifacts/migration-install/actual-site |

既存logical入力の217941020bytesをそのまま残し、新archive36727106bytesを通常のfiles行として加えた。payloadの重複排除や参照を理由に既存logical行を減算していない。合計256MiB、個別128MiB、metadata1MiB、4096entryの定数は不変。mainは復元後全11ファイルのSHAを検証した。

旧canonical CI入力は .artifacts/migration-install/ci-inputs-before-reference-38f7d2ec-924e-4a38-8231-114e9cc714c4 に保存した。旧全11件archive、v5、旧reportsも保持している。

## レビュー対象と残作業

source-manifest.jsonは既存105個別パスを保持し、新blob `ci/migration-install/payload/9c0dd08a854487501c5b2dcd2dc9ce5f703bddf993fc0156586776c2cf63307f.bin` を加え106パス。CI入力はU3 manifest+21blob、既存U2 manifest+18blobの計41個別パス。ディレクトリや.js.mapのclaimはない。mainが新blobのjj file trackを実行しexit0を観測した。

このローカル回帰・正式36試行成功はGitHub CI成功ではない。証明書操作と削除確認は完了。署名付きpushと1回のCI、短い完了確認コマンドは既存の具体承認手順を維持する。AI-DLC本体、U1/U2の記録・封印証拠、公開API、共有SHA最適化、品質基準は変更していない。
