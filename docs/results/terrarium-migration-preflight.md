# terrarium 移管 U1 初期試行

受入は未完。公式 guest の HTTPS 同一 origin ミラーでの36試行と、固定 Biome commit の実 CI ビルド・同一 key 再利用は検証済み。最終コードの固定分母 coverage と最終受入資料統合は未完であり、U1 完了とは判定しない。

## 検証済みのブラウザ試行

実測元は `.artifacts/migration-preflight/mirror-browser-attempt-2/trials/`。試行時の source revision は `75e4adf0a51db8fcc1af25676d54fc81fa09efee`。後続コードの revision とは区別する。3ブラウザ × 2ツール × trial 0–5 の36行すべてで CORS 判定と exit code 0 を観測した。main の Playwright 実行は36件成功、39.2秒だった。

保存済みの原36行と official/mirror 入力38ファイルは [証拠 inventory](terrarium-migration-preflight-evidence/inventory.json) に SHA とともに列挙した。main がコピー後の byte 一致を検証済み。初回・中央値・最大・fetch の集計もこの incomplete report に保持する。

| ツール | ブラウザ | 非ダウンロード工程の warm 中央値 ms |
|---|---|---:|
| aube 2.7.0 | Chromium | 493.185 |
| aube 2.7.0 | Firefox | 525.5 |
| aube 2.7.0 | WebKit | 482.66 |
| Biome 2.5.15 | Chromium | 586.625 |
| Biome 2.5.15 | Firefox | 710.3 |
| Biome 2.5.15 | WebKit | 479.74 |

中央値は trial 1–5 の extract/digest/validate/register/run の合計から算出し、すべて3000ms以下。trial 0、最大値、fetch の個別時間、出力 digest、ブラウザ版、TLS 情報は各原 JSON に保持する。測定は非 instrumented の経路で、新 context と新 session を毎試行作成し、fetch と server は no-store とした。

測定ホストは macOS 27.0.1 (26A434)、Apple M1、Node 24.21.0。重い処理は並行実行していない。他アプリの負荷は未測定。WebKit による観測であり、実 Safari の確認は未実施。

## 入力と由来

公式 release の公開 URL と raw digest は元入力・ミラー inventory に保持している。ミラーの fetch 時間は localhost での取得時間であり、上流からのダウンロード時間ではない。

| 入力 | 固定 identity |
|---|---|
| aube | 2.7.0 / `d36fec01764689ef6d99a5e43de98925b571d67f` |
| aube archive SHA256 | `fc2384d58c560415f6afdfdc7c0f2d10b10f464da608bf1d8be5c8936db68666` |
| aube ELF SHA256 | `c7d7d13692d01c5f6adc5511c40adc6b3769080b7c433b44c411a3e52ebcd99e` |
| Biome release | 2.5.15 / `0b4c11f553a7e702f9851af139662e1de45dc131` |
| Biome raw/ELF SHA256 | `42b6fd3662fc1fc3075a370414478aa3ed82fd43d28430bbfb81ebd02cbde656` |
| 別の CI baseline 対象 | biomejs/biome `2405c7620169bd0719166af09a8d89cc76fb37fb` |

release-derived metadata の rustc は null で、上流ビルド入力は未検証と明記した。aube は既存ローカル archive の SHA 一致から再利用、Biome は検査した HTTPS hop による取得。署名 query は保存していない。

実測 origin は `https://localhost:4182`。専用 localhost leaf 証明書を承認済みの手順で一時登録し、試行後に削除・不存在を main で確認済み。TLS 検証の無効化は行っていない。試行時 fingerprint は `8ceefca11574e696f6841f9644a9e88029b8b0b852429f3c3cfb59d30adf139f`。

既存コア byte は変更していない。元 build-info を保持し、実 SHA と既存 package の pins が一致した loader/wasm digest を専用の immutable HTTP 応答だけに補完した。derived metadata SHA は `d150bd44bfe6a79103e5322f36a3f5cef0cbc5bddb4dcaea444848ed4b22f8c5`。元 metadata、loader、wasm の SHA は trial environment に記録する。

## 残る受入条件

CI実装は `integration/vivarium/preflight/` にある。依存修正後のローカル baseline fixture10件、build/typecheck、standalone bundle構文、Actionlintは検証済み。実Dockerコンパイルとremote CI再利用は成功。OS process group取消の実外部CI試行は未検証。

承認済み共通完了検証コマンドはmainでexit0（検証済み）。build/typecheck、単体55件、consumer189件、Node回帰28件、ブラウザ回帰、固定pack coverage Node収集・ブラウザ99件、実証拠照合が成功。固定14JSの行coverageは982行中862行（87.78%）、skipped0、1253realms。保存先はterrarium-migration-preflight-evidence/completion-verification.json。独立レビュー・U1受入前のためstatusはincompleteのまま維持する。

具体案の個別承認後、公開フォークMarukome0743/vivariumの専用branch `codex/terrarium-migration-baseline-u1` に承認済み4ファイルを署名付きpushした。[初回CI](https://github.com/Marukome0743/vivarium/actions/runs/38290361603)はjemallocがmakeを起動できず失敗。依存修正の承認後、公式make4.4.1-r4 APKを実SHA256で固定し、同一containerで署名付きAPKをネット依存取得なしで導入する修正をpushした。commit `b6921789c70cecf45635f1b22524dc8abf8698db` はGitHub Verifiedを確認。[再試行CI](https://github.com/Marukome0743/vivarium/actions/runs/38311656181)は39m21sで成功。実ELF/build-info/両receiptを取得し、同一key・実byte SHA256・初回compileSkipped=false/再利用true・versionExitCode0を照合済み。consumer189件・Node回帰28件・ブラウザ回帰33件も成功。その後、資料統合の共通環境検査でWebKitのtlsIssuer取得結果not-TLSと他ブラウザのissuer文字列が異なるため停止。ユーザー承認後、issuerをブラウザ別に原値保存する集計へ修正し、実36試行と実CI証拠の統合・構造検証は成功した。実TLS1.3・証明書指紋・subjectは一致、TLS検証条件は維持。元trial JSONは変更していない。外部案と実結果はactive intentのcode-generation recordで管理する。

`FORMICARIUM_PREFLIGHT_VERIFICATION=<実 verification-input.json> mise run migration-preflight-verify` は実 C01、入力 inventory、CI first/reuse receipts と受入 byte、必須 suite の観測記録、固定14ファイルの coverage ≥80% をすべて要求する。現時点の不足による非ゼロ終了は受入未完を示す。初回の単位完了確認の実コマンドは人間の承認前であり、まだ確定していない。

以前の official direct-fetch 失敗と mirror 初回の入力欠損失敗は別 attempt に保持している。再測定成功で失敗記録を削除していない。
