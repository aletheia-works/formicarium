# U6 recipe-runtime の基盤設計の質問

## 前提（確かめたこと、2026-10-19）

- GitHub Pages の公式の上限（docs.github.com「GitHub Pages limits」）：公開 site は 1GB 以下、deploy は 10分以内、転送量は月 100GB の soft limit。1 file の上限の記載は無い。
- `actions/upload-pages-artifact` の README：artifact の tar は 10GB 未満（公式に支える上限は 1GB）、symlink・hardlink を含まない、file と dir だけ。
- vivarium の直近の deploy-docs（run `39042976438`、`90dd87e3`、2026-10-17）の Pages の artifact は 2,527,123 bytes（圧縮後）。U6 で ELF 2つ（114,647,744 bytes ×2、約219MiB）と formicarium の一組（約1.2MiB）が増えても、1GB には収まる見込み（展開後の今の site の大きさは未計測）。
- 転送量：U6 の page を1回開くと ELF 2つ（約219MiB）を取る。月 100GB の soft limit には、約460回の訪問で届く（推測。cache が効く再訪問は減る）。
- vivarium の main の ruleset の必須 check に `regression (chromium)`・`regression (firefox)`・`regression (webkit)` がある（`gh api repos/aletheia-works/vivarium/rules/branches/main`）。repro-regression の regression job は3ブラウザの matrix で、`contents: read`。

## 質問

### Q1. ELF の転送量（月 100GB の soft limit）

A. 今の設計のまま、page を開くと2つの端末が ELF を取って自動で判定する。転送量は記録し、soft limit の通知が来たら見直す。
B. page を開いただけでは ELF を取らず、訪問者が「再現を実行」の button を押してから取得と判定を始める。回帰試験は button を押して始める。転送量は減るが、page の振る舞いが今の recipe と変わる。
X. Other (please specify)

[Answer]: A

### Q2. 失敗の知らせ方

A. U7 と同じ：GitHub Actions の標準の通知（失敗した run の通知）と job summary に、AssetStager の照合の結果・大きさ・取得の時間を書く。新しい監視の service は使わない。
B. A に加えて、deploy-docs の失敗で issue を自動で作る（issue の書込みの権限が要る）。
X. Other (please specify)

[Answer]: A

## 回答の分析

- 曖昧な回答・矛盾はない。Q1=A は NFR Requirements の Q1=A（ELF をそのまま Pages に置く）と Q2=A（訪問者向けの新しい目標を置かない）と一致する。転送量は job summary に記録する大きさから見積もり、soft limit の通知が来たら見直す（自動で振る舞いを変えない）。
- Q2=A は U7 の Infrastructure Design と同じ方式で、新しい権限を足さない（NFR8.4）。
- NFR Design の review-02 の Minor 3件（`assets.json` の固定の path、小さな module Worker の案の扱い、回帰試験で毎回 AssetStager を動かすこと）は、この stage の `cicd-pipeline.md` と `infrastructure-specification.md` で具体化する。
