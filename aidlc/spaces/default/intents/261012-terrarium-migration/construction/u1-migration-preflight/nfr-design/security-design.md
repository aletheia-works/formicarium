# 初期試行の安全性と証拠収集の設計

## Sources

`../nfr-requirements/security-requirements.md`の12派生要件、`../nfr-requirements/tech-stack-decisions.md`、`../../../inception/contract-design/contract-summary.md` C01/C11とdomain/components。packaging単位に適用する設計を本資料に集約する。文書根拠、実装・実測は未検証。

## Design

### DS1: 計測と合格集計

既存公開APIで取得→展開→digest→ELF/build-info検証→登録→--versionを逐次行う。fetch開始前にmonotonic clockを採り、各境界の差をC01 phasesMsへ記録。extractなしの裸ELFでもextract=0を明示し、未計測を0へ変換しない。組合せごとtrial0とtrial1–5を記録し、総36行のtool/browser/trial重複・欠落、非有限/負の時間、CORS失敗、非zero exitを拒否する。5工程合計を組合せごと昇順にし中央値で判定、trial0/最大/fetchを別集計する。失敗行の削除・retryでの入替は禁止。

実際のcache条件、各trialのsession初期化方法、取得version/URL/digest、host負荷、CPU/OS/Node/browser/wasm版を実装計画と証拠に固定する。single workerで他の重いbuildを止めて計測する。fixtureによる集計器試験では36行成功、1行欠落、重複、閾値3000/3000超、NaN、failed CORSを確認する。これがNFR1.1/NFR1.2の設計で、SaaS監視やサービスp99は設けない。

### DS2: 取得・archive・ELFの境界

入力URLをHTTPS/userinfoなしに検査しcredentials omitで取得。deadline120sにDNS/redirect/bodyを含め、streamの実byte累積をchecked integerで数える。5hopまで各hopを検査しloop拒否。browserで各hopを観測できなければ成功判定を止め、同originでredirectなしのミラー案を具体化して確認する。CORS不能・opaque・非2xx・offline・429は原因付き終了でretry/fallbackなし。

tar.gz全entryを正規化・検査し、absolute/../、link escape/loop、重複、truncationを拒否。DL128MiB、展開256MiB、ELF128MiB、metadata1MiB、4096entry、path4096byteの境界と+1を試験する。展開/検証はサイズとsignalを分割境界で確認。SHA256・静的LE x86-64 ELF64・program-header bounds/PT_INTERP・source/commit/target/patch identityの検査を終えたcopyを既存APIに渡す。未知metadata付加fieldを理由に拒否せず、必須欠落/duplicate/identity不一致は拒否する。NFR3.1/NFR3.2/NFR4.1/NFR4.2に対応。

### DS3: baseline CI試行と再利用

biomejs/biomeのFR9完全commitをremoteで照合してから最小CI試行を行う。recipeの固定値と照合する。全入力を契約のcanonical keyで固定し、同keyで第2回を実行。ELF digest/build-info/key照合に成功した場合だけcompileを省略し、そのログとCI run URLをC01へ保存する。cache欠損/改変は再利用合格にしない。汎用builderはU5へ残す。

同keyは単一writer、job固有stagingからmetadataとELFの両方を検証してatomicに受入。4hのbuild deadline/abortは子process groupを終了させstagingを破棄、既存受入物を保持する。未変更aubeは再buildしない。NFR5.1/NFR4.1に対応。外部CI書込み・公開は対象/commit/権限を示した承認後。取得を検証したことはsource権限や公開承認の代替にならない。

### DS4: 既存実行環境と品質

same-origin Worker/wasm資産を既存配信に載せ、各browserでCOI/SAB/Worker起動とCSP条件を確認し記録する。Workerのdelete Atomics.waitAsyncとwasm1GBを維持。既存probe/aube/consumerを変更影響に対応付け、指定上限・worker1・retry0・native完全一致と固定分母coverage80%を確認する。Node consumerをBunに置換しない。実機Safariは未検証。NFR2.1/NFR6.1に対応。

### DS5: 観測と証拠の受入

証拠はC01 schemaと付帯環境・入力inventory・ログを持つ。stdoutはbyteのdigestを記録し、表示はtextのみ。timestampはoffset付き、工程時間は有限非負ms。未取得値を0/成功で埋めない。schema/version/identity/36行/median/build再利用の全条件ANDを満たしたものだけ受入。内部エラーは原因・工程・codeを証拠層に記録し、既存公開error契約をU1で改変しない。秘密を含むheader/token/URL userinfoを保存しない。NFR7.1/NFR8.1に対応。

### DS6: 停止と切戻し

C01欠落/CORS不可/時間超過/remote未確認/再利用失敗ではU2開始を拒否し、代替案の人間確認を待つ。閾値を上げない。試行は本体共通APIやterrarium稼働物を先に置換しない。新費用は事前相談、license/noticesを維持、CI最小権限・未信頼PR公開禁止を検査する。

PR単位で変更前revision、対象ファイル、試行資産/keyと生成証拠を記録し、失敗時はjjでそのPRの変更だけを戻して既存配信/受入資産を保持する。他者変更を巻き戻さない。CI/Releaseへの書込みがある場合は具体操作計画に取消・残存資産・復帰対象を示す。既存npm/JSR版を削除せずterrariumを維持する。NFR8.1と上流NFR8の切戻しに対応。

## Verification Handoff

実装計画で対象ファイル・依存所有者・実コマンド・適用回帰を具体化する。共通検証コマンドは入口整備後、初回単位完了確認前に人間へ提示して承認後に確定する。計測器/検査器fixtureの成功だけで実ブラウザ36行やremote CI再利用を代替しない。実行結果が不足した場合は未検証として停止する。
