# 同一origin HTTPSミラーの具体構成

## 対象と境界

`https://localhost:4182/` にページ・Worker/core・公式aube/Biomeの固定byteを載せる。listenは127.0.0.1のみ。外部公開・外部CI起動・新費用はなし。原GitHub URLと実mirror URL、完全commit、download/ELF digestを別記。元のCORS失敗attemptを保持する。browserはredirect:error、credentials omit、cache=no-store、fresh session/context、worker1/retry0で36試行。C01の中央値3000ms以下を維持する。

準備用取得は各HTTPS redirect hopを検査し、上限5・loop拒否・userinfoなし・120s deadline・128MiB限度を維持。SHA照合済みbyteだけを個別allowlistで配信する。URLの任意proxyやworkspaceの任意配信は作らない。COOP/COEP/CORP/CSPを維持する。

## 準備済み証明書（検証済み）

- `.artifacts/migration-preflight/mirror-tls/localhost-cert.pem`: 自己署名サーバー証明書。SANはDNS:localhostのみ、CA:FALSE、用途serverAuth。CAとして他の証明書を発行するものではない。
- SHA256 fingerprint: `8CEEFCA11574E696F6841F9644A9E88029B8B0B852429F3C3CFB59D30ADF139F`。実ファイルのOpenSSL出力で確認。以前記載した95160...は実証明書と不一致だった。
- 有効期間: 2026-10-12T13:10:42Z〜2026-10-14T13:10:42Z。
- 秘密鍵は同dirのlocalhost-key.pem、権限0600、証拠や配信対象に含めない。
- OpenSSL4.0.3で生成し、`openssl verify -CAfile <cert> -verify_hostname localhost <cert>` がexit0/OK。生成と署名・hostnameの静的検査のみで、実browserのTLS信頼は未検証。

## 試行のための信頼登録案（未実施）

macOSユーザーのlogin keychainにこのサーバー証明書だけを登録し、SSL policy限定のユーザー信頼を付ける。接続先hostnameはSAN=localhostの通常検証で限定する。admin/system storeは変更しない。証明書検証・hostname検証を無効化するflag、ignoreHTTPSErrors、allowedErrorは使用しない。FirefoxはOSのユーザー信頼root参照を有効にして検証する。Nodeのserver readinessにはNODE_EXTRA_CA_CERTSで同証明書を追加する。

文書根拠: [MozillaのEnterpriseRoots.cpp](https://raw.githubusercontent.com/mozilla/gecko-dev/master/security/manager/ssl/EnterpriseRoots.cpp)はmacOSのpolicyString付きtrustを非対応として拒否するため、`-s localhost`を付けない。[Chromiumのroot store FAQ](https://chromium.googlesource.com/chromium/src/+/main/net/data/ssl/chrome_root_store/faq.md)はmacOS default keychainでSSL trustを参照すると説明する。実ブラウザでの信頼評価は未検証。

具体登録:

```sh
/usr/bin/security add-trusted-cert -r trustRoot -p ssl -k /Users/mutoakio/Library/Keychains/login.keychain-db /Users/mutoakio/Documents/formicarium/.artifacts/migration-preflight/mirror-tls/localhost-cert.pem
```

36試行の成功・失敗にかかわらずserver終了後に、同じ指紋の証明書とユーザー信頼設定を削除する。他の証明書や信頼設定は対象にしない。

```sh
/usr/bin/security delete-certificate -t -Z 8CEEFCA11574E696F6841F9644A9E88029B8B0B852429F3C3CFB59D30ADF139F /Users/mutoakio/Library/Keychains/login.keychain-db
```

再試行の境界: このホスト信頼設定の変更はmirror-option.mdの別途確認対象であり、具体承認を得るまで実施しない。ローカルコード・byte・証明書準備を完成してから確認する。登録が拒否された場合は原因を示し、TLS検証を無効化して続行しない。

## 残る受入れ

今回のHTTPSミラー試行が成功しても、remote固定Biome baselineの同key再利用、coverage80%、実検証コマンドの承認、独立コードレビューを完了するまでU1未完。GitHub直取得のCORS成功とは記録しない。
