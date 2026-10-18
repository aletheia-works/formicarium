## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-10-17
**Iteration:** 2
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u5-fixed-guest-build/nfr-design/security-design.md > D6（Releaseへの保存） | Releaseへの書込みは「tagを作る」「ELF・build-info・catalogの3つを置く」という複数の操作で、原子的ではない。途中で失敗すると、tagと一部のassetだけが残る。D6は「tagが既にあれば上書きせず検証だけ」「tagとassetは削除も上書きもしない（C12）」と定めているので、この半端なReleaseは次回から検証に失敗し続け、削除も補完もできず、そのkeyが永久に使えなくなる。同様に、tag名はkeyの先頭16文字だけなので、先頭が衝突した別keyのtagが「既存」と判定されても扱いが決まっていない。 | 一組を公開するまで見えない手順（例：draft Releaseを作り、3つを置き、digestを検証してからpublishする。draftは公開前なので削除してよいと明記する）を決める。tagが既にあるときは、build-infoのbuildKeyの全64桁を照合し、不一致や欠けた組は「そのkeyは使えない」と記録して拒否する分岐を設計に加える。 | Resolved (reviewer) |
| R-02 | Major | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u5-fixed-guest-build/nfr-design/security-design.md > D6（直列化・書込みjob、Q3=A） | 直列化をworkflow全体の単一 `concurrency` groupで行う設計は、GitHubの仕様（実行中1件と待機1件だけを保持し、新しい待機が古い待機を取り消す）を考慮していない。`cancel-in-progress: false` でも、3件目の起動で2件目が黙って取り消されるので、「すべてのbuildを順に1つずつ」にならず、要求したbuild（例：baselineとfixの両方）が失われる。さらに、承認待ちの書込みjobを同じworkflowの中に置くと、承認が来るまでgroup全体が塞がる。逆に別workflowに分けると、Releaseへの書込み側の直列化が未定義になる。また、承認が非同期なので、承認前に同keyの2回目が始まるとReleaseに成果物がなくcompileが走る。「再利用ではcompileしない」（D6）と「後から動いたbuildのELFが違う場合」の記述（Minor 3の処理）が、どの順序で起きるのか読み取れない。 | 書込みjobがbuildと同じworkflowか別workflowかを決める。待機が取り消されても要求を失わない方法（起動時に結果を確認する、groupを書込み専用に分ける、待機を許さず衝突時は失敗にする等）を1つ選んで書く。承認待ち中に同keyのbuildが始まったときの結果（stagingの成果物を再利用する、またはcompileを許し、digest不一致を不合格にする）を明記する。 | Resolved (reviewer) |
| R-03 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u5-fixed-guest-build/nfr-design/security-design.md > D5（mbxのcache）、Threat Response | 「cacheを正しさの根拠にしない」「digest検証で守る」と書くが、digestは出来上がったELF自身から計算するので、汚染されたcacheが出したELFのdigestも、そのkeyの正本として記録されてしまう。digestの検証は、汚染を後から見つけられない。実際の防御は、保存を信頼したbuildだけに限ることだけである。また、`workflow_dispatch` は書込み権限のある人が任意のbranchから起動できるので、「mainで起動」は `github.ref == refs/heads/main` の確認として具体化する必要がある。 | 文言を「汚染の防御は書込みの制限であり、digestは汚染を検出しない」に直す。保存条件を `github.ref` の確認として書く。Releaseに保存する対象の初回buildだけは、cacheを復元しない（または、cacheなしの結果と照合する）選択肢を検討し、採否を書く。 | Resolved (reviewer) |
| R-04 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u5-fixed-guest-build/nfr-design/security-design.md > D2（builder hash）、D5（cache key） | builder hashに「builderのscriptのSHA256」を含め、それをmbxのcache keyにも使うので、Releaseへの書込みやbump-upstreamなど、ELFに影響しない部品を直すたびに、全guestのkeyが変わり、mbxのcacheも全部失われる。mbxが効くのはkeyが変わったときのcompile（Q1）なので、その利点が builder の編集のたびに消える。 | builder hashを、ELFに影響する入力（container内のscript、image digest、Bun・Node・mbxの版、command・flag）に限る。runnerで動く部品（検証・Release書込み・bump）は別の識別子（ログ・build-infoの参考欄）にするか、含めるなら意図を書く。 | Resolved (reviewer) |
| R-05 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u5-fixed-guest-build/nfr-design/security-design.md > D3（取得の上限） | 上限は取得の「後」に測るので、取得そのものは上限で止まらない。source 2GiB・依存4GiBを超える取得が起きても、実際には4時間の期限かrunnerのdiskの容量でしか止まらず、「有限の上限」（NFR4.2）としては弱い。また、NFR4.2が「NFR Designで試験を定める」と委ねたsourceと依存の上限の試験が、設計に書かれていない（2GiB/4GiBの受理と+1の拒否を、実際にその大きさで作るのは現実的でない）。 | 取得中に大きさを監視して打ち切る方法（例：cloneとfetchを監視付きのprocessで動かし、上限超過でprocess groupを終了）を書くか、後測りであることを残余リスクとして明記する。試験は、上限を注入できる設計にして、小さい値での境界値と+1を確かめることを定める。 | Resolved (reviewer) |
| R-06 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u5-fixed-guest-build/nfr-design/security-design.md > D1・D3・D4（処理の順序と取得元） | 次の点が決まっていない。(1) D1の確認、checkout、sourcePatches、key計算、Releaseの有無の確認、`cargo fetch`、build、の順序（再利用のとき、4GiBの依存を取得せずに済ませるには、keyの計算を取得より前に置く必要がある）。(2) Rust toolchainの取得元（rustupがstatic.rust-lang.orgから取得する場合、D3の上限と完全性の確認の対象外になる）。(3) 許可一覧は宣言のrepositoryにだけ効き、submodule、Cargoのgit依存、`.cargo/config.toml` によるregistry・source置換、`[patch]` といった別の取得元の扱いが無い。(4) `cargo fetch` の後のbuildをofflineにするか。(5) 許可一覧の照合は、https・credentialなし・redirectを辿らない・URLの正規化（`.git`、大文字小文字）で行うか。 | 1つの順序（宣言検証、D1、checkout、patch、key、Release照合、miss時だけfetchとbuild）を書く。toolchainの取得元と扱い、Cargoのgit依存・registry置換・submoduleの許否（許可一覧外は拒否が既定）、buildのoffline化、URLの照合規則を各1行で決める。 | Resolved (reviewer) |
| R-07 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u5-fixed-guest-build/nfr-design/security-design.md > D1 手順4・D2（Rust toolchain） | imageはbuilderの設定のdigestで固定され、手順4でpullされる。一方で、使うtoolchainの版は上流の `rust-toolchain` が決める。設定のimageと上流の指定がずれたときは「imageの中の版が指定と違えば拒否」になるが、その比較をどの手順で行うか（`rustc -vV` の出力と上流の指定の照合）が手順に現れない。拒否の位置は手順6〜7の間と読めるが、明示されていない。 | 手順6の後（またはD2のtoolchainの項）に、`rustc -vV` の版と上流の `rust-toolchain` の指定を照合して拒否する、と1行で加える。 | New |

> R-01 Reviewer note: D6が、draft Release、digestの再検証、publish（publishでtag確定）の順に変わった。tagは `guest-<tool>-<keyの全64桁>` で、公開済みで組が欠ける、または `buildKey` が不一致の場合は拒否する。

> R-02 Reviewer note: buildと書込みは別workflowで、それぞれ1つのconcurrency groupにある。開始時のAPI確認で、他の実行中・待機中のrunがあれば「busy」で失敗するので、待機の取消で要求が失われない。承認待ち中の同keyのbuildの扱いも書かれた。

> R-03 Reviewer note: digestは汚染を検出しないと明記された。保存条件は `github.ref == 'refs/heads/main'` かつ eventが `push` か `workflow_dispatch` で、初回buildの復元は残るリスクとして記録された。

> R-04 Reviewer note: builder hashは、containerの中のscript・image digest・mbxの版に限られた。runner上の部品は参考欄に記録する。

> R-05 Reviewer note: clone・checkout・`cargo fetch` は取得中に監視され、上限は試験で注入できる。監視間隔の超過は残るリスクとして書かれた。

> R-06 Reviewer note: D1が、宣言検証からmiss時のfetchとbuildまでの1〜9の順序を定めた。toolchain、registry置換、`[patch]`、submodule、offline build、URL正規化も決まっている。

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| なし（briefに検証ツールの指定なし。読取りのみ） | 未実行 | traceability.jsonのupstream_ids 16件とcoverage 16件は一致し、targetはD1〜D9の実在するセクションを指す。D3の「D1の手順8」は、再利用の手順8と一致する。直前の2件のMinor（checkoutの監視、imageのpull）は、D1の手順3・4とD3で解消した。 |

### Summary

前回のR-01〜R-06はすべて解消し、直前に指摘した2件のMinorも手順3・4とD3の追記で解消している。残るのは、toolchainの版の照合位置が明示されていないMinor 1件だけで、実装の妨げにはならないのでREADYとする。
