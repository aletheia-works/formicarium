# U5 u5-fixed-guest-build NFR Requirements の質問

根拠：requirements.md の FR7–FR9、NFR3・NFR4・NFR5・NFR8、契約 C07（固定buildとcatalog）・C11（取得・時間・サイズの境界）、unit-of-work の U5、U1 の baseline 試行（`integration/vivarium/preflight/`）。U5 は packaging の Unit なので、この stage で作るのは security-requirements・tech-stack-decisions・traceability である。

## Q1. builder を実行する場所と権限

U1 の baseline 試行は、vivarium の GitHub Actions（`baseline-workflow.yml`）で動いた。U5 の正式な builder をどこで動かすか。

A. vivarium の GitHub Actions。build の job は `contents: read` だけにする。Release への書込みは別の job に分け、人間が具体的な対象を承認したときだけ `contents: write` で動かす。
B. vivarium の GitHub Actions。build と Release への書込みを同じ job で行う（`contents: write`）。
C. formicarium の GitHub Actions に移す。
D. ローカルの main session で build し、成果物だけを upload する。
X. Other (please specify)

[Answer]: A

## Q2. 受け付ける upstream の source

FR7 は、recipe.guests が tool・repository・40桁の commit・fixture を宣言するとしている。どの repository を受け付けるか。

A. 許可した repository の一覧（例：`biomejs/biome`、`JamBalaya56562/biome`、aube と pitchfork の upstream）を設定に固定し、それ以外は拒否する。commit は build の前に remote に存在することを確かめる（FR9）。
B. 任意の GitHub repository を受け付ける。commit の remote 存在だけを確かめる。
C. A に加えて、commit の署名（GitHub の verified）も必須にする。
X. Other (please specify)

[Answer]: A

## Q3. builder の toolchain の版

人間の方針は「自分たちの開発の tool は最新版。検証対象（biome・aube など）の build で使う tool は、その upstream の build 設定に従う」である。U5 の builder ではどうするか。

A. Rust と target は、各 upstream の build 設定（`rust-toolchain` など）に従う。builder 自身の tool（Node、container の基盤 image、make など）は最新版にし、版と digest を builder hash に含める。
B. すべて最新版にそろえる。upstream の設定は使わない。
C. U1 の baseline で使った固定の image（Rust 1.98.1 の image と Alpine make 4.4.1）をそのまま使い続ける。
X. Other (please specify)

[Answer]: A

## Q4. 再利用する成果物を保存する場所

FR7 と C07 は、同じ key の2回目は ELF を再利用し、compile を省略して同じ digest を記録するとしている。成果物（ELF・build-info・catalog）をどこに保存するか。

A. vivarium の GitHub Release に、key ごとに ELF・metadata・catalog を一組として保存する。再利用のときは Release から取得して、両方の digest と source・key を確かめる。
B. GitHub Actions の cache に保存する（期限切れで消えることがある）。
C. A と B の両方。cache は速さのため、Release は正本とする。
X. Other (please specify)

[Answer]: A（人間の追記：Rustのbuildのcache管理に mr-boxington（mbx）の使用も検討する）

## Q5. sourcePatches（upstream の source への patch）の扱い

FR8 は build-info に sourcePatches を記録するとしている。patch をどう扱うか。

A. patch は、formicarium（または vivarium）の repo 内の file として固定する。build-info には、patch の file 名と SHA256 を記録する。patch が変われば別の key にする。
B. patch は使わない。必要なときは upstream の fork に commit してから、その commit を使う。
C. A と B の両方を許す。
X. Other (please specify)

[Answer]: A

## Q6. builder の script の言語と置き場所

A. vivarium 側の builder（workflow と script）は、U1 の baseline と同じく bash と Node 26 の ESM（`.mjs`）にする。formicarium 側で案を `integration/vivarium/` に作り、vivarium のセッションで反映する。
B. vivarium の既存の tooling（Bun と TypeScript など）に合わせる。形は vivarium のセッションで確かめてから決める。
C. formicarium の TypeScript（`scripts/`）で書き、vivarium からは生成した JS を呼ぶ。
X. Other (please specify)

[Answer]: B（人間の追記：基本はBunとTypeScriptの構成にする。TypeScriptがそのまま使えない所は、mjsを使ってよい）
