# U8 showcase-site の品質・安全要件

## Sources

`nfr-requirements-questions.md`（Q1=A、Q2=A、2026-10-19）、`../functional-design/functional-spec.md`・`rules.md`（BR1.1–BR7.2）・`functional-design-questions.md`（Q1–Q7）、`../../../inception/requirements-analysis/requirements.md`（NFR1–NFR8）、`../../../inception/contract-design/contract-summary.md`（C03・C04・C05・C09・C10 の U8 の profile と SiteEvidenceIdentity・C11）、`aidlc/spaces/default/codekb/formicarium/technology-stack.md`。Functional Design の review-02（NOT-READY で打ち切り）の残りの指摘 R-16・R-19〜R-24 と、main session が見つけた fixture の点を、人間の回答「B でお願いします。残りの指摘は記録して、NFR Requirements 以降で扱ってください。」によりこの文書で扱う（各行の末尾に指摘の ID）。この stage の review-01（NOT-READY、R-01〜R-14）を反映した。

読み取った事実（2026-10-19、検証済み）：formicarium の `showcase/`（U7）、`.github/workflows/showcase.yml`（job の timeout は 10・180・15・60・10 分、受入の job は 60 分。work の artifact は `retention-days: 1`、`showcase-candidate` は保持期間の指定なし）、`.github/workflows/dependency-review.yml`（`pull_request_target`）、root の `package.json`（`packageManager: bun@1.4.3`）と `bun.lock`、`actions/upload-pages-artifact`（`fc324d35…`、v5.0.0）の `action.yml`（`retention-days` の既定は `"1"`）。設計の要件で、U8 の動作は未検証。

## Functional Design との関係

この文書の行は、承認済みの Functional Design の次の箇所を置き換える（Code Generation はこの文書の行に従う）。Functional Design の文書は凍結のまま直さない。

| Functional Design の箇所 | 置き換える行 | 内容 |
|---|---|---|
| BR6.2（古い run の拒否を配布先の identity の file で行う） | NFR5.2 | GitHub Actions の API で行う |
| W1 手順5・BR6.3（identity の file に inventory の SHA256 を書き、inventory から除く。deploy の後に siteInventorySha256 を確かめる） | NFR8.8・NFR8.10 | identity の file は run_number・sourceCommit・candidateId だけで inventory に含める。deploy の後に確かめるのはこの3つ |
| BR7.2（証拠は1つの artifact） | NFR8.1 | 2段の証拠 |
| functional-spec の「依存と所有」（U8 は U7 の script を変えない） | NFR2.1 | U7 の境界の検査に site の規則を足す |
| BR3.2（fixture は app だけ） | NFR7.4 | fixtures/<名前>/ の全体 |
| BR2.4（「npm に公開済みの版」） | NFR8.7 | 候補の pack の版と、npm の公開の確認 |
| BR7.2 の previous-site-preserved の確かめ方 | NFR5.3 | workflow の試験だけを必須の行の根拠にする |
| BR7.1 の受入の件の割当て | NFR6.1（performance-requirements）・NFR2.3 | 件の数と job の timeout |

## Requirements

| ID | 分類 | 合格条件 | 検証 |
|---|---|---|---|
| NFR2.1 | 品質・境界 | formicarium の既存の試験（本体の CI、U7 の showcase の CI）を U8 の変更の後も通す。skip や欠落を合格にしない。U7 の境界の検査（`showcase/scripts/boundary.ts`、Biome の noRestrictedImports、tsc の範囲）は showcase/ 全体を見るので、U8 は次の site の規則を足す（R-20、review-01 R-04）：(1) showcase/site の下でだけ astro・@astrojs/starlight・@xterm/xterm・@xterm/addon-fit と Astro の `astro:` の virtual module の import を許し、showcase/site/tests の下でだけ @playwright/test と v8-to-istanbul を許す。(2) 走査の対象の拡張子に `.astro` を加える（`.astro` の frontmatter と script の import も検査する）。(3) site の生成物の dir（dist・.astro・node_modules）を対象外にする。(4) site の code は `fixtures/` で始まる文字列の literal を書かず、site に置く fixture の index の path は `demo-fixtures/` とする（fixture-share の規則にかからない名前）。(5) 本体の内部の import・本体から showcase への依存・回帰用の fixture の共有の拒否はそのまま保つ。`showcase/tests/boundary.test.ts` に site の場合（許す import、`.astro` の import、拒む本体の内部の import）を足す。U7 の他の script・工程は変えない。既存の上限（probe 600秒、aube 840秒、1 worker、retry 0、native 一致、wasm 1GB）は変えない。 | U7 の showcase.yml の境界の job（site を含めて走査）、boundary.test.ts、本体の CI |
| NFR2.2 | coverage | showcase/site の第一者の `.ts` の module（端末の部品、状態の表示、文言の検査、fixture の index と catalog の取得、build・検査・受入の script）の行 coverage を 80% 以上。分母の file の一覧は NFR Design で固定し（Code Generation の前）、固定した後の変更は理由を示して人間の承認を受ける（review-01 R-07）。`.astro` の file は markup と module の呼出しだけを持ち、処理は `.ts` に置く（理由付きで分母から除く）。Starlight の設定・生成物・xterm・formicarium の pack・第三者の code も理由付きで除く。未実行の file を0%として残す。node の `--experimental-test-coverage` と、Playwright の Chromium の V8 の coverage（v8-to-istanbul で TS の行へ対応させる）を合わせる。Firefox・WebKit は coverage を測らず、動作の受入だけ。 | 分母の一覧・測定の command・report を証拠（coverage-80 の行）に残す |
| NFR2.3 | site の検査の実行 | site の Biome・型検査（tsc と astro check）・単体試験・coverage・build 後の検査は、showcase-site.yml の build の job が PR・push（verify）と schedule・手動（distribute）のすべてで実行する。本体の required の check（`ci-required`）は変えない。 | workflow の試験と run の記録 |
| NFR3.1 | 取得物の検証 | page が取得する catalog と fixture の index を、build で埋め込んだ SHA256 と照合してから使う。fixture の index の path は `/work` の下の相対 path で、`..`・絶対 path・空の segment・NUL を拒否し、entry は 4096 件まで、path は 4096 bytes まで（C11）。catalog は公開の `createCommandSession` の検証（不正な catalog は INVALID_INPUT）に任せる。 | 単体試験（改変した index・catalog、境界の値と +1） |
| NFR4.1 | page の取得の上限 | page の code が行う catalog・fixture の index の取得は、C11 の fetchDeadlineMs 120秒で止め、大きさは catalog 4194304 bytes（maxCatalogBytes）、fixture の index は 268435456 bytes（maxExpandedBytes）を stream の累積で止める。`credentials: 'omit'`、自動 retry なし、pagehide で取り消す。HTTP の非2xx・offline・deadline は原因を状態欄に示す。`_formicarium/` の module はブラウザの import で読むので大きさを止められないが、build で pack の bytes と照合した同じ origin の file だけを置く（review-01 R-03）。guest の取得の上限は公開 API（C04）が持つ。 | 単体試験（遅い応答、上限 −1・上限・+1、非2xx、取消） |
| NFR5.1 | 候補 | site は U7 の受入済みの候補だけを入力にし、latest を解決し直さない。BR1.2 の7項目を照合し、どれかが違えば build を失敗にする。 | site build の照合の log（candidate-identity の行） |
| NFR5.2 | 直列 | deploy は1つの concurrency の group で直列にし、走っている run を取り消さない（GitHub は group の待ちを1つだけ残し、より新しい run の待ちが古い待ちを置き換える。新しい方が残るので受け入れる）。古い run の拒否は、配布先の file ではなく GitHub Actions の API（この workflow で deploy の job が成功した run の最大の run_number）で、deploy の直前（承認の後）に行う。自分より大きい run_number があれば deploy しない。最初の deploy（成功した run が無い）は許す。API の失敗は deploy しない（fail closed）（R-21）。 | workflow の試験と、deploy の job の log |
| NFR5.3 | 前回の保持 | 失敗・verify の run は deploy の job を動かさず、配布先を変えない。必須の行 previous-site-preserved の根拠は、この run の workflow の定義の試験（deploy の job が前の job すべての成功と distribute のときだけ動くこと、pages write と deploy-pages の step が deploy の job の他に無いこと、concurrency と NFR5.2 の確認があること）とする。実際に skip が起きた観測は、別の受入の記録（verify の run の記録）として残し、必須の行の根拠にしない（review-01 R-08）。 | workflow の試験（workflow の YAML を読む単体試験） |
| NFR6.6 | 分離 | 端末の page は coi-serviceworker（0.1.7、SHA256 を固定）で分離を得て、COEP は require-corp（coepCredentialless を使わない）。page・Worker・子 Worker の crossOriginIsolated と SharedArrayBuffer を3ブラウザ × en・ja × 初回・再訪問で観測する。site のどの page も cross-origin の副資源を読まない（scope が /formicarium/ 全体になるため。BR4.3）。 | 受入（browser-coi の行）と build 後の検査 |
| NFR6.7 | CSP | 端末の page は CSP で、script・worker・connect を self と blob（必要な範囲）、wasm を wasm-unsafe-eval に限り、外部の origin を許さない。分離の設定の inline script、Starlight の inline の script・style、xterm が入れる style と両立させる方法（外部 file、hash、style-src の扱い）は NFR Design で決め、3ブラウザで端末が表示されることで確かめる。 | build 後の検査（外部の origin が無い）と受入 |
| NFR7.1 | 表示 | guest の出力・metadata・入力を文字として表示し、HTML・code として解釈しない。出力は結果の kind ごとに1回だけ書く（guest は onOutput、builtin と install は result）。xterm の問合せへの応答の escape 列を入力に入れない。OSC 8 の link を開かない。 | 試験だけの harness の page で、HTML（`<script>`・`<img onerror>`）、ANSI の問合せ、OSC 8、巨大な1行を流す受入（ui-states-keyboard の行） |
| NFR7.2 | 操作 | 状態（分離の準備・読込み・install 中・準備完了・実行中・失敗・空の出力）を文字で示し、色だけに頼らない。keyboard だけで使え、Tab を端末に取られない。実行中・install 中の打鍵は捨て、Ctrl-C で取り消す。1行は 65536 bytes まで。390px 幅で横に scroll しない。 | 受入（ui-states-keyboard の行）と単体試験 |
| NFR7.3 | 進捗 | install の進捗は、全体の大きさが分からないとき（unknown）と、まだ0 byte のとき（0）を区別する。時刻は offset 付き、期間は ms で記録する。 | 単体試験と受入の記録 |
| NFR7.4 | fixture | demo の fixture は showcase/fixtures/<名前>/ の全体を /work の下に置く（app/ の外の dir も含める。aube-local-deps は link:../outside/linked を参照する）。mode は dir 0755・file 0644（実行権限なら 0755）に正規化し、空の dir・symlink・特殊 file は build を失敗にする。U7 の fixtureInventorySha256 は mode と空の dir を含まないので、fixture の index は site の inventory で identity に結び付ける（R-23、main session の指摘）。 | build の試験と、aube の個別ページで link 先の package.json を `cat` で読める受入 |
| NFR8.1 | 証拠 | C10 の U8 の証拠は2段で作る（R-19、review-01 R-10）。(1) 受入の後・deploy の前の evidence の job：必須の行をすべて持つ完全な C10 の JSON（deployedIdentity なし）を作り、artifact `showcase-site-evidence-<run_id>` に上げる。deployedIdentity が無いので、この証拠は「配布済み」を意味しない。(2) deploy の job：(1) の全行を引き継ぎ、site-inventory の行に deploy の直前の inventory の再計算を、previous-site-preserved の行に deploy の直前の NFR5.2 の確認を加えて記録を作り直し（log の SHA256 が変わる）、deployedIdentity（deploy した artifact の inventory の SHA256 を代入した値で、配布先の全 bytes の観測ではないと明記）を入れた完全な C10 の JSON を、artifact `showcase-site-evidence-<run_id>-deployed` に上げる（Actions の artifact は上げた後に変えられないため別の名前）。U9 は `-deployed` があればそれを、無ければ (1) を非配布の候補の証拠として取る。保持は 90 日。この取り方は U9 の Functional Design への申し送りとして作業の記録に残す。 | U9 の照合。必須の行の欠落・重複・failed・unverified があれば deploy しない |
| NFR8.2 | 外部操作 | Pages の有効化、`github-pages` environment の設定、B1 の pack の Release、最初の deploy の承認、その後に承認者を外す変更は、それぞれ具体の内容を示して人間の承認を受けてから行う。最初の deploy だけ人間が承認し、その後は承認者を外して日次で自動に配布する（Q2=A）。承認の依頼の画面から辿れる job summary に、run_number・candidateId・siteInventorySha256 と、候補の3ツールの版を出す。Pages の artifact の保持は 7 日に指定し（既定は 1 日）、承認が 7 日を過ぎて artifact が無くなったら deploy は失敗し、main から手動で実行し直して新しい候補を作る（review-01 R-11）。 | 承認の記録、environment の設定の確認、workflow の試験 |
| NFR8.3 | notices | site の THIRD_PARTY_NOTICES に、guest と formicarium の notices（候補と pack の file）、coi-serviceworker の MIT の注記、site の production の依存（showcase/site/package.json の dependencies と、bun.lock から辿れるその推移の依存）の各 package の license の file の本文を含める。一覧は lockfile から機械的に作り、license の file の無い package があれば build を失敗にする（review-01 R-12）。 | build 後の検査（一覧と notices の照合） |
| NFR8.4 | CI の権限 | build・受入・evidence の job は contents read（と showcase.yml の呼出しに要る U7 の権限）だけで、token を site に書かない。pages write・id-token write は deploy の job だけ。NFR5.2 の確認は actions read。mode は showcase-site.yml が決める：main の schedule と workflow_dispatch だけが distribute、他（PR・push・main 以外の手動）は verify。U7 の mode.ts はこの入力を検証するだけ（R-22）。fork の PR からは配布しない。 | workflow の試験 |
| NFR8.5 | 切戻し | (a) U8 の変更が原因：U8 の変更の PR を revert して main に merge し、その後に main から showcase-site.yml を手動で実行する（push では配布しない。手動の実行は main の定義でだけ distribute になる）。(b) 新しいツールの release が原因：code の revert では直らない。まず Actions の画面で showcase-site.yml を無効にして日次の配布を止め（前回の site のまま）、ツールの条件の変更（U7 の tools.json の範囲）を PR で行ってから有効に戻す。(c) site build・受入の失敗では、配布されず前回の site が保たれる（NFR5.3）。前の run の Pages の artifact を再び deploy する手段は作らない（NFR5.2 で古い run は拒否される）（review-01 R-02）。 | 切戻しの手順の文書（maintenance の guide）と workflow の試験 |
| NFR8.6 | 秘密 | log・job summary・証拠・site に token・credential を出さない。U8 の新しい log と job summary は、URL の query を落とした形だけを書く（review-01 R-12）。 | log の検査（単体試験） |
| NFR8.7 | 文書 | guides が書く API は、候補が使う pack（distribute は B1 の pack、verify は同じ commit の pack）に実在するものだけにし、その pack の版を「候補の版」として明記する。npm の導入の手順と npm の page への案内は、build で npm の registry を読取りで照会し、同じ版が同じ integrity で公開されていると確かめられたときだけ書く。確かめられないときは書かず、「この版は npm に未公開」と書く。embedding の code の例をその pack の型で型検査する（R-16、review-01 R-05）。 | build の照会の log と型検査、レビューの項目 |
| NFR8.8 | identity の file | site に置く identity の file（`site-identity.json`）には run_number・sourceCommit・candidateId だけを書き（inventory の SHA256 は書かない）、inventory に含める。受入から deploy までの間の改変は inventory の再計算で見つける（R-24）。 | build・受入・deploy の前の inventory の一致 |
| NFR8.9 | 失敗の検知 | 日次の run の失敗（候補・build・受入・deploy のどれか）は、GitHub Actions の標準の通知（schedule の run は、その workflow の cron を最後に変えた人へ）で知らせる。各 run の job summary に、最後に deploy した run からの日数と、失敗した job の名前を出す。public repository では活動が無いと schedule が自動で無効になるので、月に1回、人間が workflow が有効であることを確かめる（U7 の README の「定期実行の確認」と同じ）（review-01 R-01）。 | job summary の試験と、運用の手順の文書 |
| NFR8.10 | deploy の後の確認 | deploy の後に、deploy-pages の出力の page の URL の `site-identity.json` を、`cache: 'no-store'` と run の ID の query を付けて取得し、run_number・sourceCommit・candidateId が自分と一致することを確かめる。404・通信の失敗・不一致は 30 秒ごとに確かめ直し、10 分で打ち切る。打ち切ったら job を失敗にして通知する（deploy 済みの site を自動で戻さない）（review-01 R-06）。 | deploy の job の log |
| NFR8.11 | 依存 | showcase/site の依存は `showcase/site/bun.lock` を commit し、CI は `bun install --frozen-lockfile --ignore-scripts` で入れ、依存の install の script を動かさない（bun には既定で script を許す package の一覧があるので、trustedDependencies に頼らず `--ignore-scripts` を明示する。build に script が要る依存が見つかったら、その依存と理由を示して人間の判断を受ける）。依存の更新は PR で行い、既存の dependency-review の workflow（`pull_request_target`）で確かめる。最新版への追従は更新の PR で行い、日次の build は lockfile の版だけを使う（review-01 R-13）。 | CI の install の command と workflow の試験 |

## Threat considerations

- 候補・site の差し替え：受入した artifact と配布する artifact を同じにし（BR6.3）、inventory を build・受入・deploy の前の3回計算して照合する（NFR8.8）。
- 古い候補による上書き：NFR5.2（承認の後にも確認する）。
- 依存の差し替え：lockfile と frozen の install、install の script を動かさない、依存の更新は PR と dependency-review（NFR8.11）。
- 上流のツールの release の侵害：U8 は latest を解決し直さず、U7 の許可の一覧・資産の digest・provenance の照合を通った候補だけを使う（NFR5.1）。
- 訪問者の page での任意の code の実行：guest の出力を HTML にしない（NFR7.1）、CSP（NFR6.7）、cross-origin の副資源なし（NFR6.6）。
- 権限の悪用：deploy の job だけに pages write（NFR8.4）、fork の PR から配布しない。

## Applicability

NFR1 は U1・U3・U9 の範囲（性能要件の Applicability）。NFR3 と NFR4 のうち、guest の取得・archive の検査・schema の検証は U8 が使う公開 API（U2〜U4）と U7 が持ち、U8 は page の code が行う取得と検証だけを持つ（NFR3.1・NFR4.1）。

## Assumptions & Open Questions

None.
