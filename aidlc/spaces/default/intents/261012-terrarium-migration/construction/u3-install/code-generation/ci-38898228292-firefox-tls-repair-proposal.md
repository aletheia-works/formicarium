# CI 38898228292：Firefox TLS失敗の原因と修正案

状態：原因を再現済み。修正は未実装で、計画改訂の承認待ち。install180秒、非download中央値3000ms、全21JS・全realm coverage80%以上、全容量上限、1worker/retry0を維持する。TLS検証は省略せず、`ignoreHTTPSErrors` は `false` のまま。AI-DLC本体、製品runtime/SHA/APIは変更しない。

## 検証済みの観測

- commit 5cc071ce（GitHub Verified）のCI run 38898228292 attempt1 は工程1–18が全exit0。CI上でも21JS 1768/1929=91.65%、1495realmで、各suiteの台帳4行と4組のbegin/endをZIPで確認した。
- 第19工程の正式36試行は、Chromium 12trialが成功した後、Firefoxの最初の `page.goto https://localhost:4182/` が `SSL_ERROR_UNKNOWN` で失敗した。CIの計測工程到達は今回が初めて。
- ローカルmacOSの正式36試行は同じsource ec7fc54a…/pack cc89で合格した（keychainへのtrustRoot一時登録をFirefoxの `security.enterprise_roots.enabled` が参照する）。

## 再現（mcr.microsoft.com/playwright:v1.63.0-noble、arm64、Docker）

スクリプトは `.artifacts/migration-install/firefox-tls-repro/` に保存した。

| 条件 | Firefox | Chromium | WebKit |
|---|---|---|---|
| A: workflowと同じ（自己署名leafをシステムCAと `~/.pki/nssdb` 'P,,'へ登録、enterprise_roots） | SSL_ERROR_UNKNOWN | ok | ok |
| B: A + Firefox policy `Certificates.Install`（leaf） | SSL_ERROR_UNKNOWN | ok | ok |
| C1: job CA+leaf、CAをシステム/nssdb、policy `Certificates.Install`（CA） | SEC_ERROR_UNKNOWN_ISSUER | ok | ok |
| C2/C3: policy `SecurityDevices` p11-kit-trust（leaf／CA） | SSL_ERROR_UNKNOWN／SEC_ERROR_UNKNOWN_ISSUER | ok | ok |
| D: 自己署名leafを専用profile cert9.dbへ 'P,,' | SSL_ERROR_UNKNOWN | — | — |
| E: job CA（CA:TRUE,pathlen0）で署名したleaf、CAを専用profileへ 'C,,'、`launchPersistentContext` | ok | — | — |
| F: Eのprofileで起動したFirefoxの `browser()` から試行ごとの `newContext({ignoreHTTPSErrors:false})` ×2 | ok, ok | — | — |

診断目的だけで `ignoreHTTPSErrors:true` を試すと接続できた。このため、失敗はTLS信頼の問題である（検証済み）。PlaywrightのFirefoxは、システムCA・`~/.pki/nssdb`・enterprise policyのいずれも参照せず、自己署名end-entityを 'P,,' で登録しても受理しなかった（観測の範囲で）。x86_64のCI runnerでの同一挙動は未検証（arm64で再現）。

## 修正案（承認後に実装）

変更は次の個別pathに限定する：`.github/workflows/migration-install-u3.yml`、`scripts/migration-install/measure.ts` とmain生成の `measure.js`、`tests/migration-install/acceptance.test.ts` とmain生成の `.js`。新module・依存は追加しない。

1. workflowの証明書作成を、job専用CA（CA:TRUE、pathlen0、keyCertSign、nameConstraints permitted DNS:localhost、1日）と、それで署名したleaf（SAN DNS:localhost、CA:FALSE、serverAuth、1日）に分ける。CAはシステムCAと `~/.pki/nssdb`（'C,,'）へ登録する。leafの指紋を従来どおり `FORMICARIUM_INSTALL_TLS_SHA256` としてserverとpinに使う。
2. workflowで、空のjob専用Firefox profileを作り、certutilでCAを 'C,,' 登録して、`FORMICARIUM_INSTALL_FIREFOX_PROFILE` に絶対pathを設定する。cleanup stepで、システムCA・nssdb・profile・秘密鍵を削除し、不在を確認する。
3. measure.tsは、`FORMICARIUM_INSTALL_FIREFOX_PROFILE` が設定されたときだけ、Firefoxを `launchPersistentContext(profile)` で起動し、その `browser()` から従来どおり試行ごとに `newContext({ignoreHTTPSErrors:false})` を作る。profileは絶対path・実directory・非symlinkで、cert9.dbを持つことを確認し、満たさなければ計測前に拒否する。未設定時（ローカルmacOS）は現行のlaunchのまま。Chromium/WebKit、試行数、URL、pin、phase計測、3000ms判定は変更しない。
4. acceptance試験へ、profile指定の有無で起動方式が切り替わること、不正profile（相対path・不在・symlink・cert9.dbなし）の拒否、`ignoreHTTPSErrors:false` の維持を、ブラウザを起動しない単位で追加する。不具合修正の順序に従い、mainがREDを観測してから実装し、同じ試験をGREENにする。
5. 実装後、mainがbuild/typecheck/対象回帰を行い、修正版workflowと同じ手順をDocker上のPlaywright noble imageで実行して、Firefox/Chromium/WebKitのTLS接続を確認する（nameConstraints付きCAを含む）。その後、新source/CI入力/候補/consumerで全18工程と、ローカル正式36試行（既存keychain方式、証明書の期限確認と削除/未登録確認）をやり直す。
6. その後、追加の署名付きpushとCI 1回の実コマンドを提示して、別途承認を待つ。新CI・独立ZIP照合・再レビュー・正式完了確認の前にU3完了とはしない。

## 採らなかった案

- `ignoreHTTPSErrors:true`、Firefoxの証明書検証無効化：TLS検証の省略になるため不可。
- Firefoxのenterprise policy（Certificates.Install、SecurityDevices）：再現で効かなかった。
- 自己署名leafを専用profileへ 'P,,' 登録：再現で効かなかった。
- 試行ごとの `launchPersistentContext`：起動方式が試行ごとに変わり測定条件の差が大きくなるため、F案（1プロセス・試行ごとの新規context）を採る。
