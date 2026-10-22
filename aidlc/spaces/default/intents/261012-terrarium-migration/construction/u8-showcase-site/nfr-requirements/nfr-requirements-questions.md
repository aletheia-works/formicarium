# U8 showcase-site NFR Requirements の質問

## 前提（2026-10-19）

- 承認済みの Functional Design（`../functional-design/`）と、残った指摘（review-02 の R-16・R-19〜R-24 と、fixture の app/ の外の dir。作業の記録の Open questions）を、この工程以降で扱う。
- 既存の上限（probe 600秒、aube ブラウザ 840秒、1 worker、retry 0、wasm 1GB）と、U6 の受入の数え方（1件 180秒、page を開いてから判定まで 120秒）は記録済み。
- terrarium の Pages は毎日 03:17 UTC に build し、guest の受入が成功したときだけ deploy している（読取り）。U8 の Functional Design は、最初の deploy を `github-pages` environment の承認者で止め、その後を自動にするかは人間が決めるとした（BR6.1）。

## 質問

## Q1. [品質] site の受入の時間の上限

U8 の受入（BR7.1）は、Chromium・Firefox・WebKit × en・ja で、空の端末から3ツールを install し、個別ページを導入済みで始める。guest の取得（1つ数十 MB）を含むので、1件の時間の数え方を決める。上限を上げて通すことはしない。

A. U6 と同じ数え方：1件 180秒、page を開いてから準備完了（個別ページは install の完了）まで 120秒、retry 0、1 worker。空の端末の試験は tool ごとに1件に分ける（1件で install するのは1ツール）。
B. 空の端末の試験だけ、3ツールを1件で続けて install し、その1件を 540秒（3 × 180秒）にする。他は A と同じ。
X. Other (please specify)

[Answer]: A. U6 と同じ数え方（1件 180秒、準備完了まで 120秒、retry 0、1 worker、空の端末は tool ごとに1件）（人間の回答、Guide me）

## Q2. [運用] 配布の承認の続け方

FR15 は「日次 build と受入の後の Pages の配布」を求める。最初の deploy は承認者で止める（Functional Design の BR6.1）。その後の日次の配布をどうするか。

A. 最初の deploy だけ人間が承認する。その後は承認者を外し、受入に合格した候補を日次で自動に配布する（外す設定の変更は、内容を示して承認を受けてから）。
B. 毎回の deploy を人間が承認する（日次の build は自動、deploy は承認待ちで止まる）。
C. 最初から承認なしで自動に配布する。
X. Other (please specify)

[Answer]: A. 最初の deploy だけ人間が承認し、その後は日次で自動に配布する（人間の回答、Guide me）
