# U1の受入証拠を最新版の結果から組み立てる案

作成日：2026-10-17。未実施。`u1-latest-toolchain-revalidation-proposal.md`（承認済み）の手順3「組み立てにコードの変更が必要な場合は、その最小変更を先に提示する」に当たる。

## 現状

- 今のcurrent completionは、U1の受入証拠を手作業で作った `verification-input.json` から読む。その中身は、`acceptance-evidence.json`、mirror入力、CIのfirst/reuse receipt、baseline cache、6つの試験記録（`preflight-unit`・`preflight-browser`・`package-consumer`・`node-regression`・`browser-regression`・`coverage`）である。
- 試験の記録（36試行のtrial JSON）からこれらを組み立てるscriptは、repoにない。前回は手作業だった。
- 守るべき制約：「過去の成功結果を新sourceの成功証拠へ読み替えない」。このため、別の時点で実行した試験の記録を後からまとめるのではなく、同じsourceで実行した結果だけを使う。

## 方針（推奨）

current completionに、U1の受入証拠を組み立てる処理を入れる。そして、同じ実行の中で作った・確かめた証拠だけで判定する。これまでの「別の時点の記録（verification-input.json）を読む」形はやめる。

- 6つの試験記録のうち5つ（`preflight-unit`・`package-consumer`・`node-regression`・`browser-regression`・`coverage`）は、current completionの20工程に同じものがすでに含まれている。20工程の実際のログを、そのまま記録に使う。別の時点の記録は使わない。
- `preflight-browser`（36試行）とbaseline CIは、20工程の外で行う。それぞれ、同じsourceで実行した結果をprepareのときに封印して受け取る。
- 照合の中身は変えない（緩めない）。使うのは既存の `assessEvidence`（36行の完全性、固定assetと出力の一致、warm 5回の中央値3000ms以下）と `checkAcceptance`（inventory、baselineの入力・receipt・受入ELF、coverage）。

## 変更（U1のfileだけ）

1. 新規 `scripts/migration-preflight/current-evidence.ts`
   - `assemblePreflightEvidence({ trialsDirectory, inventory, baseline, ciRun })`：36件のtrial JSONから `PreflightEvidence` を組み立てる。
     - `environment`：`node` は実行中のNode（`process.version`）。browserごとの版は、trialに記録された値。各browserで全trialの版が同じであることを確かめる。TLSの指紋・subject・originや、coreの各digestも、全trialで同じであることを確かめる。
     - `sourceCommit`：全trialと、mirror入力の `sourceCommit` が一致すること。
     - `baseline`：vivarium CIのfirst/reuse receiptから作る。buildKey、ELF digestが同じであること、2回目のcompileSkipped=true、version exit 0、`ciRunUrl`。
     - 組み立てた後に `assessEvidence` を通す。
   - 次のどれかに当たれば拒否する：
     - trialの欠落・重複・余分・`.failure.json` が含まれる。
     - JSONに重複keyがある（`parseUniqueJSON` を使う）。
     - browserの版やTLS・coreのidentityが、trialによって違う。
     - Nodeの版が今と違う。
     - baselineのbuilder hashが、今のNodeで再計算すると一致しない（既存の `baselineKey` による）。
2. `scripts/migration-preflight/current-completion.ts`
   - `prepare` の入力を、次のものの封印に変える：candidate、consumer、guest、36試行のattempt directory（trial 36件とPlaywrightの生ログ）、mirror入力・mirror manifest、vivarium CIのartifact directory（actual-inputs、first/reuse receipt、ELF・build-info）、CIのrun REST応答。
   - `historicalVerification` と `historicalFiles` はなくす。
   - `run` と `verify`：20工程の後、上の封印を確かめる。それから証拠を組み立て、`acceptance-evidence.json` として出力directoryへ書く（wx）。そのうえで `checkAcceptance` で照合する。
   - 試験記録の照合では、20工程の中の該当するログ（`migration-preflight-unit`、`test-consumer`、node/browserの回帰、coverage）と、36試行の生ログに、`assertPassingTestOutput`（正の件数、fail/skip/cancel/TODOが0）を適用する。
   - reportには `preflightEvidence` として、組み立てた証拠のpathとSHA、36試行とCI runの識別を入れる。
3. 試験 `tests/migration-preflight/current-evidence.test.ts`（新規）と `tests/migration-preflight/current-completion.test.ts`
   - 新規の試験は、合成した36件のtrialで、正常に組み立てられることと、上の拒否条件のそれぞれを確かめる。
   - 古いNodeで作ったbaselineの入力が拒否されることも確かめる。v24.21.0で作られた実際のactual-inputs.jsonを試験の入力に使う。
   - prepareとverifyの試験は、新しい入力の形に合わせる。既存の改変・欠落・skip・coverage不足の拒否試験は維持する。
   - 先に試験を書いてREDを観測してから実装し、同じ試験のGREENを確かめる。mainで、build、typecheck、`migration-preflight-unit`、`migration-preflight-current-unit` を逐次実行する。
4. 変えないもの
   - 旧verify（`scripts/migration-preflight/verify.ts`）の照合規則。古い記録（docs/results/terrarium-migration-preflight-evidence/、v8）。製品のruntime。
   - 必要なら、`checkAcceptance` などの既存の関数をexportして再利用する。

## 実行の順序（各実行の直前に実コマンドを示して承認を受ける）

1. 上の変更を実装し、RED→GREENと回帰を確かめる。
2. vivarium CI（run 38990951678）が成功し、artifactが保存されたら、REST応答とZIPのdigestを独立に照合する。
3. コードが変わってsourceが新しくなるので、36試行を同じsourceでやり直す（1分程度）。証明書の一時登録と、終了後の削除・未登録の確認を含む。今日の36試行（コード変更前のsource）は履歴として残し、判定には使わない。
4. 新しい候補・consumerでv10の入力を作り、20工程と組み立て・照合を実行する（約25分）。
5. 成功したら、新しい読取り専用の検証コマンドを提示し、承認を受ける。そのあと、記録を更新し、U1・U2を再レビューする。

## 承認をお願いする事項

- 上の「変更」1〜4の実装（新規module 1件と試験1件を含む）。
