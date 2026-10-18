# 最後のまとめた確認：実コマンド一覧（承認待ち）

作成：2026-10-17。状態：人間の承認待ち。承認を受けるまで、どれも実行しない。

前提：U1・U2・U3はcheckpoint承認済み。U4はStep 1〜7が済み、項目5・6もmainで確かめた。sourceはこの時点で最終とする（このあとsourceを変えたら、候補を作り直す）。全工程をmainが1つずつ順に実行し、計測中はほかの重い処理をしない。基準（install180秒、非download中央値3000ms、coverage 80%、probe600秒、aube840秒、worker 1、retry 0、wasm1GB）は変えない。

共通の環境（各コマンドの先頭に付ける）：

```bash
export PATH=/Users/mutoakio/.local/share/mise/installs/node/26.12.0/bin:$PATH
```

## A. 事前確認（読取りだけ）

A1. build・typecheckと、証明書の期限と未登録を確かめる。

```bash
mise run build && mise run typecheck
openssl x509 -in .artifacts/migration-preflight/mirror-tls-20261017/localhost-cert.pem -noout -enddate -fingerprint -sha256
/usr/bin/security find-certificate -a -Z /Users/mutoakio/Library/Keychains/login.keychain-db | grep -ci E4431672603F0EF18EF573C500D33BCBCA70F2044D6ACB1E3B28821D9ED00FED
```

期待：build・typecheckがexit 0、期限が `Oct 19 01:17:43 2026 GMT`、指紋が `E4:43:…:0F:ED`、未登録（0）。

## B. 最終sourceの候補と独立consumer

B1. U3の候補と、U4の候補を新しく作る（既存の候補は上書きしない）。

```bash
FORMICARIUM_SESSION_SOURCE=7c7ceaf47504ec7c3c915ac8f463b11032480d48 mise run migration-install-stage
FORMICARIUM_SESSION_SOURCE=7c7ceaf47504ec7c3c915ac8f463b11032480d48 mise run migration-command-stage
```

出力された2つの `package.manifest.json` のpathを、以下で `<U3_CAND>`・`<U4_CAND>` と書く（候補のdirectoryは `<U3_DIR>`・`<U4_DIR>`）。

B2. 新しい独立consumerを2つ作る（既存のdirectoryがあれば止まる）。

```bash
C=/private/tmp/formicarium-final-u3-consumer-20261017; [ -e $C ] && exit 1; mkdir $C && cd $C && node /Users/mutoakio/.local/share/mise/installs/node/26.12.0/lib/node_modules/npm/bin/npm-cli.js install --ignore-scripts --no-audit --no-fund <U3_DIR>/package/aletheia-works-formicarium-0.3.0.tgz
C=/private/tmp/formicarium-final-u4-consumer-20261017; [ -e $C ] && exit 1; mkdir $C && cd $C && node /Users/mutoakio/.local/share/mise/installs/node/26.12.0/lib/node_modules/npm/bin/npm-cli.js install --ignore-scripts --no-audit --no-fund <U4_DIR>/package/aletheia-works-formicarium-0.3.0.tgz
```

## C. 証明書の一時登録（macOSの認証が必要。人間がその場にいるときに行う）

C1. 登録して、登録されたことを確かめる。

```bash
/usr/bin/security add-trusted-cert -r trustRoot -p ssl -k /Users/mutoakio/Library/Keychains/login.keychain-db /Users/mutoakio/Documents/formicarium/.artifacts/migration-preflight/mirror-tls-20261017/localhost-cert.pem
/usr/bin/security find-certificate -a -Z /Users/mutoakio/Library/Keychains/login.keychain-db | grep -ci E4431672603F0EF18EF573C500D33BCBCA70F2044D6ACB1E3B28821D9ED00FED
```

## D. 計測（証明書を登録している間に、1つずつ行う）

D1. U1の36試行（最新のNode・Playwrightの版を、試行の記録に残す）。

```bash
FORMICARIUM_PREFLIGHT_ORIGIN=https://localhost:4182 FORMICARIUM_PREFLIGHT_ATTEMPT=.artifacts/migration-preflight/mirror-browser-final-20261017 FORMICARIUM_PREFLIGHT_INPUT=.artifacts/migration-preflight/mirror-assets-node26-20261017b/mirror-input.json FORMICARIUM_PREFLIGHT_MIRROR_MANIFEST=.artifacts/migration-preflight/mirror-assets-node26-20261017b/mirror-manifest.json FORMICARIUM_PREFLIGHT_TLS_CERT=.artifacts/migration-preflight/mirror-tls-20261017/localhost-cert.pem FORMICARIUM_PREFLIGHT_TLS_KEY=.artifacts/migration-preflight/mirror-tls-20261017/localhost-key.pem FORMICARIUM_PREFLIGHT_TLS_FINGERPRINT=e4431672603f0ef18ef573c500d33bcbca70f2044d6acb1e3b28821d9ed00fed NODE_EXTRA_CA_CERTS=.artifacts/migration-preflight/mirror-tls-20261017/localhost-cert.pem mise run migration-preflight-browser > .artifacts/migration-preflight/mirror-browser-final-20261017.log 2>&1; echo "exit=$?"
```

D2. U3の受入（18工程と正式36試行。ローカル限定）。

```bash
FORMICARIUM_CANDIDATE=<U3_CAND> FORMICARIUM_CONSUMER=/private/tmp/formicarium-final-u3-consumer-20261017 FORMICARIUM_SESSION_GUEST=$PWD/.artifacts/u2-release-inputs/aube-v2.7.0/aube U2_ACTUAL_SITE=$PWD/.artifacts/migration-install/actual-site FORMICARIUM_INSTALL_LOCAL_ONLY=1 FORMICARIUM_INSTALL_TLS_CERT=$PWD/.artifacts/migration-preflight/mirror-tls-20261017/localhost-cert.pem FORMICARIUM_INSTALL_TLS_KEY=$PWD/.artifacts/migration-preflight/mirror-tls-20261017/localhost-key.pem FORMICARIUM_INSTALL_TLS_SHA256=e4431672603f0ef18ef573c500d33bcbca70f2044d6acb1e3b28821d9ed00fed mise run migration-install-completion > .artifacts/migration-install/final-20261017.console.log 2>&1; echo "exit=$?"
```

D3. U4の受入（U3の工程にU4の試験とcoverageを加えたものと、U4の候補での正式36試行。ローカル限定）。

```bash
FORMICARIUM_CANDIDATE=<U4_CAND> FORMICARIUM_CONSUMER=/private/tmp/formicarium-final-u4-consumer-20261017 FORMICARIUM_SESSION_GUEST=$PWD/.artifacts/u2-release-inputs/aube-v2.7.0/aube U2_ACTUAL_SITE=$PWD/.artifacts/migration-install/actual-site FORMICARIUM_COMMAND_LOCAL_ONLY=1 FORMICARIUM_INSTALL_TLS_CERT=$PWD/.artifacts/migration-preflight/mirror-tls-20261017/localhost-cert.pem FORMICARIUM_INSTALL_TLS_KEY=$PWD/.artifacts/migration-preflight/mirror-tls-20261017/localhost-key.pem FORMICARIUM_INSTALL_TLS_SHA256=e4431672603f0ef18ef573c500d33bcbca70f2044d6acb1e3b28821d9ed00fed mise run migration-command-completion > .artifacts/migration-command/final-20261017.console.log 2>&1; echo "exit=$?"
```

## E. 証明書の削除と、不在の確認（Dの成否にかかわらず必ず行う）

```bash
/usr/bin/security delete-certificate -t -Z E4431672603F0EF18EF573C500D33BCBCA70F2044D6ACB1E3B28821D9ED00FED /Users/mutoakio/Library/Keychains/login.keychain-db; echo "delete exit=$?"
/usr/bin/security find-certificate -a -Z /Users/mutoakio/Library/Keychains/login.keychain-db 2>/dev/null | grep -ci E4431672603F0EF18EF573C500D33BCBCA70F2044D6ACB1E3B28821D9ED00FED
/usr/bin/security dump-trust-settings 2>&1 | grep -ci "formicarium-preflight-localhost"
```

期待：両方とも0。

## F. U1のcurrent completion（v11。証明書は使わない）

F1. 固定入力を作る（U3の候補と独立consumerを使う。U3の候補も最終sourceの23件の配布JSを持つ。current completionはU3の `checkInstallCandidate` で候補を照合するので、U4の候補は受け付けない）。

```bash
U2_ACTUAL_SITE=$PWD/.artifacts/migration-install/actual-site node scripts/migration-preflight/current-completion.js prepare .artifacts/migration-preflight/current-recovery-input-20261017-v11.json <U3_CAND> /private/tmp/formicarium-final-u3-consumer-20261017 $PWD/.artifacts/u2-release-inputs/aube-v2.7.0/aube .artifacts/migration-preflight/mirror-browser-final-20261017 .artifacts/migration-preflight/mirror-browser-final-20261017.log .artifacts/migration-preflight/mirror-assets-node26-20261017b/mirror-input.json .artifacts/migration-preflight/baseline-node26-38990951678/extracted .artifacts/migration-preflight/baseline-node26-38990951678/run.json
shasum -a 256 .artifacts/migration-preflight/current-recovery-input-20261017-v11.json
```

F2. 20工程の実行と、受入証拠の組み立て・照合（`<V11_SHA>` はF1のSHA256）。

```bash
U2_ACTUAL_SITE=$PWD/.artifacts/migration-install/actual-site node scripts/migration-preflight/current-completion.js run .artifacts/migration-preflight/current-recovery-input-20261017-v11.json <V11_SHA> > .artifacts/migration-preflight/v11-run-20261017.log 2>&1; echo "exit=$?"
```

F3. 短いverify（`<REPORT>`・`<REPORT_SHA>` はF2の出力）。

```bash
node scripts/migration-preflight/current-completion.js verify .artifacts/migration-preflight/current-recovery-input-20261017-v11.json <V11_SHA> <REPORT> <REPORT_SHA>
```

## G. この一覧の承認に含めないもの（あとで実コマンドを示して、別に承認を受ける）

- U4の署名付きjj pushと、CI 1回（U4 Step 9）。CI後の独立照合と、B1の確定。
- U1〜U4を覆う、新しい読取り専用の検証コマンドの設定と、U4のcheckpoint（U4 Step 10）。
- publication-alignmentの既知の2件のfail（21JS/31files前提）の扱い。今回は成功へ書き換えず、未解決として報告する。

## 確かめていないこと・注意

- D1のmirror入力（`mirror-assets-node26-20261017b`、sourceCommit 7c7ceaf4）は、guestとcoreの配布資産の固定値で、今回のsourceの変更（U2〜U4のscriptと試験、`runtime/core.ts`）の影響を受けないと見込んでいる（推測）。組み立て（F1）で不一致が出たら、止めて報告する。
- D2・D3は、それぞれ1時間以上かかる見込み（過去の実行からの推測）。証明書の登録は、D1〜D3の間ずっと続く。
- 失敗したら、基準を変えずにそこで止め、出力を示して相談する。再実行は、相談してから行う。
- 実機のSafariは未検証のまま。
