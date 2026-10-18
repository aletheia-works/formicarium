# U1を最新toolchainだけで確かめ直す修正案（案A）

作成日：2026-10-17。未実施。人間の方針：古い版（Node 24.21.0など）で作った記録や成功結果は、今のtoolchainの根拠にならない。古い版を一時的に使って過去の記録を通すのではなく、最新版（Node 26.12.0、Bun 1.4.3、Playwright 1.64.1）で実行した成否だけで確かめる。baselineも最新版で作り直す（人間の回答A）。

## 現在わかっていること

- v9bでは、current completionの20工程（retained-evidence以外）がNode 26.12.0ですべてexit0だった。全21配布JSの行coverageは1768/1929行＝91.65%、skip0。生counterの独立照合も通った。ただし成功reportは作られていない。最後の歴史baseline照合で失敗したため（下記）。
- 失敗の原因：biome baselineのbuilder hashは、実行中のNodeの版（`process.version`）を含む（scripts/migration-preflight/baseline.ts:146）。歴史baselineはNode 24.21.0のvivarium CIで作られた（integration/vivarium/preflight/baseline-workflow.ymlの `node-version: '24.21.0'`）。そのため、Node 26では一致しない。
- 同じ理由で、第1工程（U2完了時の封印済みverifierを、記録したNode 24.21.0で動かす工程）も、古い版の記録の確認にすぎない。
- U1の完了の照合（verification-input.json）には、ほかにも古いtoolchainで作った記録が入っている。36試行（aube/Biome×3browser×6回）の記録、mirror入力、first/reuse receiptである。

## 方針

古い記録（v8、Node 24の証拠、docs/results/terrarium-migration-preflight-evidence/）は消さずに履歴として残す。今回の判定には使わない。U1の成果を、最新版で新しく作った証拠だけで確かめる。

1. **baseline**：vivarium CIのNodeを26.12.0へ上げ、biome baselineを作り直す（初回buildと、同じkeyでの再利用）。
2. **36試行**：Playwright 1.64.1（最新版）の3browserで、ローカルでやり直す。
3. **current completion**：古い記録を確かめる工程を外す。上の新しい証拠と20工程の結果で判定する。

baselineのbuild対象（biomejs/biome `2405c7620169bd0719166af09a8d89cc76fb37fb`）と、そのsourceが指定するRust（rust-toolchain.toml、固定image `docker.io/library/rust@sha256:6d9066cf…`）は、guestのbuild入力なので変えない。これは開発toolではなく、固定buildの対象を決める入力だからである。Actionsは、2026-10-17の確認でcheckout v7.0.1、setup-node v7.1.0、upload-artifact v7.0.2が最新だった。

## 手順

### 1. ローカルのコード変更（U1のfileだけ）

- scripts/migration-preflight/current-completion.ts
  - retained-evidence工程（古いU2 verifierをNode 24で動かす工程）を外し、20工程にする。前回入れた `retainedVerifierNode` と、その2件の試験は取り消す。
  - 歴史baselineの照合を、新しい最新版の証拠（下記2・3で作るverification-input）に対する照合へ置き換える。照合の中身（checkAcceptance、readAccepted、1MiB上限・重複key拒否、builderHashの再計算）は緩めない。builderHashは、今までどおり実行中のNode（26.12.0）で計算する。
  - prepareの引数から、retained（古いverifier・binding・report）を外す。historicalは新しいverification-inputを指す。
- integration/vivarium/preflight/baseline-workflow.yml：`node-version` を `'26.12.0'` にする。controller（baseline-controller.mjs）は、R-01の修正を含む現在のものを使う。
- 試験（tests/migration-preflight/current-completion.test.ts ほか）
  - 先に「20工程に古い版のNodeを使う工程がないこと」「prepareがretainedを要求しないこと」「古いNodeで作ったbaseline証拠を拒否すること」を確かめる試験を書く。修正前に失敗することを観測してから修正し、同じ試験で成功を確認する。
  - 既存の拒否試験（改変・欠落・skip・coverage不足など）は維持する。
- mainが逐次実行する：build、typecheck、`mise run migration-preflight-unit`、`mise run migration-preflight-current-unit`。

### 2. vivarium CIでbaselineを作り直す（外部操作。実行前に実コマンドを提示して承認を受ける）

- 対象は公開フォーク `Marukome0743/vivarium`。前回と同じ4ファイル（controller、build-baseline.sh、workflow、self-test workflowの差替え）だけを、新しい専用bookmark（`codex/terrarium-migration-baseline-u1-node26` を予定）へ署名付きpushする。
- 既存workflow（ID `381088086`）を、その専用refで1回手動実行する。
- 初回buildの後に同じkeyで2回目を実行し、compileSkipped=true・ELFのdigestが同じ・versionのexit0を確認する。
- run完了の直後に、artifact（保持1日）・first/reuse receipt・actual inputs・ELF・build-info・ログを取得し、digestを照合する。新しい保存先（`docs/results/terrarium-migration-preflight-evidence-node26/` を予定）へ保存する。古い証拠のdirectoryは上書きしない。
- 見込み：前回の実績ではbuildに数時間（job上限250分）かかる。standard runnerで、公開repoは無料。失敗・権限拒否なら停止して報告する。PR・merge・upstreamの変更はしない。

### 3. 36試行を最新版でやり直す（証明書の一時登録は実行前に承認を受ける）

- Playwright 1.64.1・Node 26.12.0で、既存のU1手順（mirrorの準備、`mise run migration-preflight-browser`）により、aube/Biome×Chromium/Firefox/WebKit×6回の36行を記録する。
- localhost証明書は、期限と指紋を確認してから一時登録する。終了後は信頼設定と証明書を削除し、未登録を確認する。
- 計測中は重い処理を並行しない。vivarium CIはremoteで動くため、ローカルの計測とは重ならない。ただし、ローカルのbuild・試験とは同時に行わない。
- 既存のU1 completion（scripts/migration-preflight/completion.ts）で、上記2と3の新しい証拠から、新しいverification-inputを組み立てる。組み立てにコードの変更が必要な場合は、その最小変更を先に提示する。

### 4. current completionを最新版で実行する（実行前に実コマンドを提示）

- 新しい候補・独立consumer・固定入力（v10）で、20工程と新しい証拠の照合を実行する。品質基準は変えない：全配布JSの行coverage80%以上、skip0、probe600秒、aube840秒、1worker、retry0。
- 成功したら、新しい読取り専用の検証コマンドを提示し、承認を受ける。

### 5. 記録の更新と再レビュー

- U1とU2の記録（code-summary.md、unit-test-instructions.mdなど）で、v8・Node 24の証拠を「古いtoolchainでの履歴で、判定には使わない」と明記する。現在の主張は最新版の証拠だけに結び付ける。
- U1を再レビューし、続いてU2を再レビューする。その後、段階Bとして、U4の修正版計画の承認へ戻る。

## 承認をお願いする事項

1. 手順1のローカルのコード変更（U1のfileとvivarium workflowの版）。
2. 手順2・3・4の進め方（vivarium CIでのbaselineの作り直し、36試行のやり直し、v10での判定）。

署名付きpush・workflowの手動実行・証明書の一時登録・各実行コマンド・新しい検証コマンドは、それぞれ実行の直前に実コマンドを示して、改めて承認を受ける。
