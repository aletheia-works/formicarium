# U8 showcase-site Infrastructure Design の質問

## 前提（2026-10-19）

- NFR Design の review-02（NOT-READY で打ち切り）の残りの Major：PR・push のとき、main の showcase.yml の最新の成功した run から pack を取る方式は、pack が `showcase-work-resolve`（保持 1 日）にしか無いので成り立たない。人間の回答で、この工程以降で扱う（作業の記録の Open questions に直し方の案）。
- formicarium の `infra/github`（OpenTofu）は repository・branch の保護・label・Actions の変数を管理し、`github_repository` の `pages` は `ignore_changes` で管理していない。token の権限に Pages・Environments は含めていない（`infra/github/README.md`。読取り）。
- terrarium の Pages は毎日 03:17 UTC に build している（読取り）。U6 では、約 112 MB の ELF を含む site を vivarium の Pages に deploy して配れた（検証済み：U6 の受入）。

## 質問

## Q1. [開発者] PR・push のときの site の検証（NFR Design から持ち越した Major）

A. PR・push では、guest・catalog・manifest を main の showcase.yml の最新の成功した run の `showcase-candidate` から取り、formicarium の pack は PR 自身の commit から U7 の pack.ts の verify の手順で作る。照合の (6)（pack の SHA256）は verify のときだけ「同じ commit の pack」と比べ、manifest の値との違いは log に出す。verify は配布しない。
B. PR・push では site の受入（ブラウザの試験）をせず、Biome・型検査・単体試験・build だけを行う。受入は日次の distribute の run だけで行う。
C. PR・push でも showcase.yml を呼ぶが、U7 の concurrency の group と衝突しないよう showcase.yml の concurrency を変える（U7 の file の変更が増え、PR ごとに U7 の重い工程が動く）。
X. Other (please specify)

[Answer]: A. pack は PR 自身の commit から作り、照合の (6) は verify のときだけ同じ commit の pack と比べる（人間の回答、Guide me）

## Q2. [運用] Pages と承認者の設定の管理

Pages の有効化（build の種類を workflow）と `github-pages` environment の承認者（最初の deploy だけ。その後に外す）をどう管理するか。どちらも、具体の内容を示して承認を受けてから行う。

A. repository の設定の画面で人が設定し、手順と設定の値を `infra/github/README.md` に記録する。OpenTofu の `ignore_changes = [pages]` はそのまま。
B. OpenTofu で管理する（`pages` を管理に入れ、environment の resource を足す）。token に Pages・Environments の書込みの権限を足す必要がある。
X. Other (please specify)

[Answer]: B. OpenTofu で管理する（人間の回答、Guide me）

## Q3. [運用] 日次の build の時刻

A. 04:17 UTC（13:17 JST）。terrarium の 03:17 UTC と1時間ずらし、毎時0分の混雑も避ける。
B. 03:17 UTC（terrarium と同じ）。
X. Other (please specify)

[Answer]: A. 04:17 UTC（人間の回答、Guide me）
