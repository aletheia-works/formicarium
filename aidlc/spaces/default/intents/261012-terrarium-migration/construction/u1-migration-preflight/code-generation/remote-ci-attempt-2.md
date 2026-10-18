# 固定Biome CI試行2（成功・U1受入前）

ユーザー承認：ビルダー依存を修正し、専用ブランチへpushしてCI再試行。成功後は承認済み計画を続行。log answer は QUESTION_ANSWERED。

## 一次観測した依存

2026-10-13、Node24.21.0 fetchで公式 https://dl-cdn.alpinelinux.org/alpine/v3.24/main/x86_64/APKINDEX.tar.gz を取得、gzip展開したindexのmake entryを確認（HTTP200）。版4.4.1-r4、x86_64、116285bytes、source commit9368161bd37f74fb11747ba79197f8480aaca7dc、依存so:libc.musl-x86_64.so.1。

公式APK https://dl-cdn.alpinelinux.org/alpine/v3.24/main/x86_64/make-4.4.1-r4.apk は HTTP200、実116285bytes、実SHA256 a916626a876f64c6b6fb32a6bf0fa93351d09fae0aa7684135642390da647e60（検証済み）。

修正：固定版APKをサイズ・SHA256検証し、同一ビルドcontainer内でapk --no-networkによりインストール、GNU Make4.4.1確認後に固定cargo build。未固定依存のネット取得や署名検証の回避は行わない。APK/source commitをdependencies、実装をbuilderInventoryに含め、builderHashと再利用キーへ束縛する。固定Rust image/版、Biome commit、Cargo.lock、musl targetは維持。

検証済み：build/typecheck exit0、migration-preflight-unit 52pass/0fail/0skip（539.4ms）、公式APKを実controller取得関数で検証116285bytes、Node bundle構文exit0、Actionlint1.7.12 exit0。Biome checkはimports修正後exit0（shell文字列のplaceholder警告と既存useTemplate情報のみ）。Bun1.4.2 bundle1module18.90KB。

専用jj workspaceの差分3ファイルのみ（controller/proposal workflow/branch-only dispatch workflow）。署名push exit0、commit b6921789c70cecf45635f1b22524dc8abf8698db、GitHub REST verified=true/reason=valid。controller SHA256 910a820b869a9ce39fbbebe2e1c41e07d0df779ace2018b04499cf79bccaff9f、workflow SHA256 01ecf45e69d5dec7ebb56d386416acadb99a957cff08facaff862a9f5f62ae73。

再試行は1回起動（gh workflow run exit0）：https://github.com/Marukome0743/vivarium/actions/runs/38311656181。実CI成功、baseline job115018582825は39m21s、release compile実ログ38m48s。artifact11775934204は35811986bytes、ZIP SHA256 f80c8496510cd587079f3e0c0a15e412fdaba2b9915ed14ca285a109bf0fd117。connectorで取得、gh run download exit0で .artifacts/migration-preflight/ci-attempt-2 に保存。

検証済み：baselineKey再計算とreadAcceptedによる実byte照合exit0。key6e5ad9483e52dc1b99e01bd492671d9ce160a99e01e48a36adbd748cd6f6322d、ELF SHA256256fe184205f99a4652691f18098b0e2ceff0e676083baf7077dca68ce3b77c9、build-info SHA25621171712fdf324eb3739dbc579c7d6cb7a3d8ff05bd5e68f8c0868ff22886ee0。first.compileSkipped=false、reuse=true、双方versionExitCode0、同一sourceCommit/runURL/digests。固定Biomeビルド・再利用は実CIで検証済み。

続行したStep9：consumer189pass/0fail/0skip（16.70s）、Node build/probe/aube回帰28pass/0fail/0skip（7.08s、native出力一致）。ソース観測fb601c57b0c94c27789a630bef4b692285578988。

受入資料統合の停止：assemble-acceptance-evidence.mjs exit1「common environment differs: tlsIssuer」。元trial0のChromium/Firefoxはissuer=formicarium-preflight-localhost-20261012、WebKitはnot-TLS（consumer.spec.tsのsecurityDetails()?.issuer欠落時の記録値）。3者ともTLS1.3・同一certificateFingerprint・同一subjectを保持。Playwright ignoreHTTPSErrors=false、専用CAの実Node配信検証と各試行の指紋検査も保持。TLS検証失敗と判定する根拠はない。集計がブラウザAPIのissuer取得結果まで共通値としたことが原因（コード/元JSON根拠）。

修正案：issuerをbrowserVersion/userAgent同様にbrowserごとのfieldとして原値保存。必須共通fingerprint/origin/core digestとTLS検証条件、元36行は変更しない。統合再実行後、成功すれば残りのbrowser回帰・coverageへ進む。失敗時確認方針に従い回答待ち。U1全体は未完。

その後のユーザー承認に基づき集計を修正。main の統合処理exit0、原36行を維持した実CI証拠のbyteコピー一致、assessEvidence exit0を観測した。発行者原値はChromium/Firefox=formicarium-preflight-localhost-20261012、WebKit=not-TLSとしてブラウザ別に保存済み。既存ブラウザ回帰も33pass/0fail/0skip。固定分母coverageと初回共通完了検証コマンドの承認・独立レビューが残る。
