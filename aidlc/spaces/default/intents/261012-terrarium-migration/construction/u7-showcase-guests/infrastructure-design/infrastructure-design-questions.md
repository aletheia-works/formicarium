# U7 u7-showcase-guests Infrastructure Design の質問

根拠：`../nfr-design/security-design.md`（§2・§7・§10 と Assumptions）、`../nfr-design/reviews/review-02.md` の Minor、`../../../inception/contract-design/contract-summary.md`（C06・C09・C12）、formicarium の現状（`.github/CODEOWNERS` は `* @JamBalaya56562` の1行、`upstream`（aletheia-works/formicarium）の ruleset は 2026-10-18 時点で空、Actions の設定は権限がなく読めなかった）。U7 は GitHub Actions だけで動き、クラウドの資源は使わない。

## Q1. [CI/運用] 配布する候補が使う B1 の pack の長期の保存先

NFR Design §7 で、配布する候補（U8 の日次 build）は B1 受入で固定した pack を取得して使うと決めた。いまの B1 の pack（SHA256 `61b209ae…`）は CI artifact（保存7日）にしかない。

A. formicarium の GitHub Release に、B1 受入ごとの資産（例：tag `b1-<packSha256の先頭12桁>` の prerelease）として pack と C06 の受入証拠を保存する。書込みは、人間が具体的な対象を承認したときだけ、別の job（又は人間の手作業）で行う。showcase は Release から取得して `packSha256` を照合する。
B. 0.3.0 を npm に公開するまで配布する候補を作らない。公開後は npm registry の tarball を取得し、`packSha256` を照合する。
C. A で保存し、0.3.0 の公開後は B に切り替える。
X. Other (please specify)

[Answer]: A

## Q2. [セキュリティ] main の保護と、fork の PR の workflow の承認

NFR Design §2 は、CODEOWNERS のレビュー必須と、「fork の PR の workflow の実行に承認を求める」設定を前提にしている。いまの upstream には ruleset がない。どう用意するか。

A. formicarium の repo 内に IaC（OpenTofu、`infra/github/`）を作り、main の ruleset（PR 必須、CODEOWNERS のレビュー、showcase の必須 check）と Actions の設定（fork の PR の workflow は外部の協力者すべてに承認を求める）を定義する。適用は人間の承認後。現行 terrarium の `infra/github/` を参考にする。
B. 設定は人間が GitHub の画面で行い、手順と期待する値を文書にする。showcase の CI は、読める範囲で設定を確かめる。
C. A と同じ内容を、terrarium の既存の `infra/github/`（OpenTofu）に追加して管理する。
X. Other (please specify)

[Answer]: A

## Q3. [CI/運用] 日次の候補の失敗を知る方法

U8 の日次 build から呼ばれた showcase の run が失敗したとき（最新版の解決・取得・受入の失敗など）、前回の配布物は残るが、失敗に気づく仕組みが要る。

A. GitHub Actions の標準の失敗通知（workflow を動かした人への通知）と、job summary への原因の記録だけにする。新しい権限は増やさない。
B. A に加えて、失敗した日に issue を自動で開くか更新する（`issues: write` の別 job を加える）。
C. A に加えて、連続して失敗した日数を job summary に出す（前の run の結果を読む。`actions: read` の範囲）。
X. Other (please specify)

[Answer]: A

## Q4. [セキュリティ] main の ruleset の具体的な値（追加の質問）

Q2=A では「PR 必須、CODEOWNERS のレビュー」とした。しかし `.github/CODEOWNERS` は `* @JamBalaya56562` の1人だけなので、CODEOWNERS のレビューを必須にすると、その人が作った PR は自分で承認できず止まる。既存の `maintenance.yml` の依存更新の自動 merge とも衝突する。また、path で絞った showcase の job を必須 check にすると、showcase に触れない PR で check が待機のまま残る。配布と再利用は main の定義の run だけが作る設計（NFR Design §2）なので、PR の check は配布の安全の根拠ではない。

A. 現行 terrarium と同じ形にする：PR 必須、承認数 0、CODEOWNERS のレビューは必須にしない、管理者 role の bypass、削除・force push の禁止、署名必須。必須 check は既存の本体 CI の check だけにし、showcase の受入は必須 check にしない（U8 の配布の前提として main の run で確かめる）。CODEOWNERS はレビュー依頼の通知に使う。
B. A に加えて、showcase の受入を必須 check にする。paths で絞らずに常に動く gate job を置き、showcase に関係しない PR では「対象外」と理由を記録して成功させる。
C. CODEOWNERS のレビューを必須（承認数 1）にし、管理者と依存更新の自動 merge を bypass にする。
X. Other (please specify)

[Answer]: A
