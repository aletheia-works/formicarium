# U9 u9-retirement-acceptance の NFR Design の質問

NFR Requirements（`../nfr-requirements/security-requirements.md`、review-02 は READY）を設計にする。review-02 の Minor 2件（全 branch と fork の検索が無い、U8 の証拠の artifact が期限切れのときの代わりが無い）もここで扱う。

観測（2026-10-21、読取りだけ）：

- vivarium：追跡されている file に terrarium の言及は0件（`rg -il terrarium`）。upstream の branch は `main` と `release-please--branches--main--components--vivarium`。
- formicarium：AI-DLC の記録（`aidlc/`）の外で、terrarium の言及がある file は 82 件（`jj file list` と `rg -il`）。
- formicarium の upstream の branch：`main`、`release-please--branches--main--components--formicarium`、`codex/inputs/stable-0.1.0-approved-v1`、`codex/inputs/stable-0.1.0-v1`、`codex/release/rc1-inputs`、`codex/verify/0.2.0-inputs`。`codex/*` の4本は、formicarium の過去の release の入力（tgz など）を置いた branch で、terrarium の branch ではない。中に terrarium の言及があるかは、まだ調べていない。
- U8 の証拠：`showcase-site.yml` run 39509852083（2026-10-20）の artifact。保持期間は 90 日と推測している（未確認）。

## Q1. 言及の検索の範囲（branch と fork）

A. formicarium と vivarium の upstream の全 branch を、読取りだけで検索する（`git grep -i terrarium <各 remote の branch>`）。main 以外で一致があれば、branch ごとに一覧にして、消すか残すかを人に聞く。人間の fork は削除の対象（NFR8.11）なので、検索しない（推奨）
B. main だけを検索する。他の branch は検索しない
X. Other (please specify)

[Answer]: A

## Q2. U8 の証拠の artifact が期限切れのとき

A. main で `showcase-site.yml` を手動でもう一度実行し、その run の新しい証拠を使う（手動の実行は、前回と同じく人間の承認を受けて JamBalaya56562 で起動する）（推奨）
B. 期限切れなら削除を始めずに、人に報告する
X. Other (please specify)

[Answer]: A

## Q3. formicarium の言及を消す PR の分け方

A. formicarium は1つの PR（82 file 前後。code・試験・文書・README をまとめる）にする。名前が送り手と受け手の約束になっている所（NFR2.4）も同じ PR で変える（推奨：途中の状態が main に入らない）
B. 製品の code と試験の PR と、文書と README の PR の2つに分ける
X. Other (please specify)

[Answer]: A
