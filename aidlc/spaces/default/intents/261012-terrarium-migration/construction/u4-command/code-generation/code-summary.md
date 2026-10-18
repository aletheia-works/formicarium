# U4 command Code Summary

## Status

U4（C05の公開command API）の実装、ローカルの正式受入、署名付きCIの照合が、最終的なsourceで成功した。独立した最終レビューと、新しい読取り専用の検証コマンドの承認・設定、U4のcheckpointは、まだ済んでいない。実機のSafariは未検証。

- source：sourceIdentity `cb49d17b41f70d7ac5b962fcbba0328b6481d17ae4d65a07d3eda6e68074b53b`（372 file）、pack `61b209ae1c98690f4f69eeca25c06f6485d05420c339283416e0aff91ea9cb98`（33 file、第一者配布JS 23件）。
- 署名付きhead：`9722db3e254dd73604f42ed4d85cbc53edf35404`（親 `ec8ab359…`、その親 `7c7ceaf4…`。GitHubのverificationはverified・valid）。branch `codex/terrarium-migration-u4`。

## 実装したもの

- `runtime/command-parse.ts`：InputGuard・Tokenizer・ListingFormatter（D1／W2、BR4.2–BR4.7、BR4.11）。孤立surrogateは `isWellFormed()`、byte数は `TextEncoder` の長さ。lsはUTF-16 code unit順。
- `runtime/command.ts`：CommandDispatcher・BuiltinAdapter・InstallAdapter・GuestRunAdapter・ResultBuilder（BR4.1、BR4.8–BR4.17）。判定順は INVALID_INPUT → ABORTED → DISPOSED／BUSY。予約名は `ls` `cat` `rm` `cd` `install`。guest runはtimeoutMsを渡さない。
- 公開API：`runtime/public.ts` の `createCommandSession`、`types/index.d.ts` の `CommandOptions`・`CommandResult`・`CommandSession`。内部portは非公開。
- 配布：第一者配布JSを21件から23件に（`runtime/command.js`・`runtime/command-parse.js`）。
- 受入入口：`scripts/migration-command/{stage,coverage,completion,ci,ci-inputs,b1,measure}.ts` と `.github/workflows/migration-command-u4.yml`（contents read、専用branch、直列、360分、job専用CA、artifact 7日）。
- 文書：`docs/command-api.md`、README.mdのAPI一覧。

## 追加Stepで直したもの（人間の承認による）

1. `scripts/terrarium/coverage.ts` を `mode:'strip'` に（Node 26）。
2. tsconfig.jsonにU4のbrowser型宣言を追加。
3. U2の内部SessionPortに `resolvePath` を追加（U2がBR2.12として引き受け、C02に追記）。
4. 23件に合わせて、U1〜U3の試験・入口の期待値を更新（各Unitがやり直しで引き受け）。
5. blink.log：`runtime/core.ts` の `blinkCore.argv` が先頭で `-L /dev/null` を渡す。回帰試験は `tests/migration-command/public.test.ts`（計画では新しいfileの予定だったが、`mise.toml` を変えるとU1〜U3がやり直しになるため既存のU4のfileに置いた）。`tests/package/core.test.ts` の期待値を更新。
6. U4の薄いmeasure CLI（`scripts/migration-command/measure.ts`）。U3の受入入口からU4への依存をなくし、U4の `stage.ts` の重複定義を削除。
7. 公開用inventory（`scripts/release/inventory.ts`）を23件・33fileに。公開runnerを固定のBun 1.4.3・Biome 2.5.15で作り直した。公開の境界（U4/B1の証拠なしでは23件のpackを公開しない）は維持。
8. U4のCIのcommand対応に `scripts/migration-command/measure.js` を追加し、全工程をCIの対応に通す試験を追加。

ほかに、最後のまとめた確認の中で、`tests/terrarium/current-candidate.test.ts` の期待値（31→33）、U4のNode realmの期待値（U3＋3 worker）、共有の `scripts/package/coverage.ts` のsuiteの許可リスト（`command` を追加）を、人間の指示で直した。どれも先にREDを確かめてから直した。

## 検証の結果（mainの観測、Node v26.12.0）

- ローカルの正式受入（候補 candidate-dd7a49a3、completion-210dad10）：22工程pass、coverage 92.16%（2055行中1894行、23 file、skip 0）、正式36試行pass（最大の中央値 biome/firefox 2559.2ms）、B1の31 checkがpass（ローカルなので `formal:false`）。
- 署名付きCI：1回目（run 39025918280）は `measure` 工程がCIのcommand対応で拒否されてfailure（項目8で修正）。2回目（run 39029827794、attempt 1）はsuccess。job `verify` の全stepがsuccess。artifact sha256:42a8372d…（473608 bytes）。CIの22工程pass、coverage 92.16%、正式36試行pass（Linux HeadlessChrome 156など。最大の中央値 biome/firefox 1785.8ms）、B1の31 checkがpass（sourceCommitは署名付きhead）。sourceとpackはローカルの受入と一致。
- 読取り専用の検証の案（`.artifacts/migration-command/verify-final-u4.mjs`、binding `final-u4-binding-39029827794.json`、binding SHA256 c4c7407b3fe5d7e45ebd251419e48cabb48f7bf8cb3339327244243f7e14e9c3）：開発中の試走でpass（約46秒）。改変の拒否の試験（`verify-final-u4.test.mjs`）は10件pass。この検証コマンドは、人間の承認を受けてから設定する。
- 既存の回帰：test-light（package 194・tooling 237件）、U4のunit 96件、browser 9件、Nodeのcoverage 188件。どれもfail・skip 0。

## 最終レビュー（review-01、NOT-READY）への対応

- Major（検証コマンドがU3のものより弱い）：検証コマンドを直した。U1の固定資産とU4のCI入力manifest（SHA256 48fdb7f5…、CIが使ったものと一致）からformal catalogを作り直し、各試行の `raw.input` とcatalogSha256を照合する。TLSのissuer・subject・protocolとhost benchmarkを照合する。B1のbrowser行は、ログに `[chromium] ›`・`[firefox] ›`・`[webkit] ›` の結果行があることを確かめる。B1の `sourceCommit`（CIは署名付きhead、ローカルはbase revision）と `preflightEvidenceId`（`readPreflightEvidenceId` で読み直した値）は、検証対象の外の値と照合する。署名前のcommit `f5340c80…` と署名付きhead `9722db3e…` のtree（`d7a2b4ef…`）と親を、ローカルのgitで照合する。証明書の削除の受領記録（`.artifacts/migration-command/trust-cleanup-final-u4.json`）を封印し、検証のたびにkeychainに無いことも読取りで確かめる。
- Minor（試験が名前の理由で失敗するとは限らない）：80%・中央値・B1の各試験を、名前の理由で拒否されることを確かめる形に直した。B1では、sourceCommitの違いと、browserのproject結果行の欠落も拒否することを加えた。改変の拒否の試験は10件pass。
- Minor（計画の項目5の記述）：計画に実施時の変更を追記した。
- Minor（README.mdの87行目、docs/command-api.mdの5行目の「未検証」の記述が、署名付きCI成功後の状態と食い違う）：直していない。README.mdはpackに入るので、直すとsourceとpackのidentityが変わり、最後のまとめた確認とCIをやり直すことになる。次にsourceを変えるときに直す。
- Minor（空入力と取消済みsignalの組み合わせ）：設計の判断も試験もない。製品コードの変更になるので、今回は直さず、持ち越す。

## 未完・未検証

- 独立した最終レビュー、新しい検証コマンドの承認と設定、U4のcheckpoint。
- 実機のSafari（WebKitの結果を実機の合格としない）。
- U5〜U9は未着手。U5はU4の完了を開始条件とする。
- publication（npm公開）は、この計画に含めない。
