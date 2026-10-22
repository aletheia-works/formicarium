**Collaborator:** aidlc-architecture-reviewer-agent

### Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-10-22
**Iteration:** 6
**Verdict Dictated:** no

**Prior findings**

| ID | Now | Severity | Note |
|---|---|---|---|
| R-08 | Fixed | Minor | 直ったまま（review-05 で確認済みの内容は変わっていない）。D7 に必須の check の10個の名前（`gh api repos/aletheia-works/vivarium/rules/branches/main`、2026-10-22）と、bot の PR #554 で10個すべてが報告されたこと（9 pass、Commitlint だけ題の形で fail、#555 で修正）が残っている。Assumptions の注記も App token で作ること、10個の報告に直っている。code-summary の Step 43・44 の1・2項目と一致する。review-05 の新しい Minor のうち check 関連の記述に矛盾は無い。 |
| R-09 | Fixed | Minor | 直った。review-05 の新しい Minor（確かめたことと未検証のことの区別が不徹底）が解消している。D7 の「token と merge の権限」は「確かめたこと」（`GITHUB_TOKEN` は `contents: read`・`actions: read` だけ、App token の `permission-contents: write`・`permission-pull-requests: write`、どちらも `fixed-guest-bump.yml` を読んだ。ruleset の種類6つ。`gh api`、2026-10-22）と、「未検証のこと（次に bump を実際に動かすときに確かめる）」（repository の auto-merge の有効化、`pull_request` が承認の数を求めるか〈求めるなら bot の PR は人の承認まで merge されない〉、private key の置き場所、App が ruleset を迂回できるか〈`bypass_actors` は `null`、`current_user_can_bypass: never`〉、変更後の実 run での自動 merge）に分かれた。Threat Response の bot の資格情報の項も、確かめたこと（`secrets.BOT_PRIVATE_KEY` の受け取り、PR を作る job の中だけの token、ruleset を通ること）と未検証のこと（secret の水準と読める人、迂回）に分かれ、D7 に戻る参照がある。区別の内容は code-summary の Step 43・44・45 と一致する。 |
| R-10 | Fixed | Minor | 直ったまま（変更なし）。元の「（NFR3.5）」の行に帰属が不正確だった旨の注記が付き、`commit` と `accepted` が違う間は Layer 1 が `accepted` の commit・`buildKey`・digest で照合することが、読んだ3 file（vivarium@f4be3299）の名前つきで、実行はしていないと明記されている。Step 43・44 の項目と一致する。 |

**New findings**

| Severity | Location | Finding | Required action |
|---|---|---|---|
| None. | | | |

### Sources

- aidlc/spaces/default/intents/261012-terrarium-migration/construction/u5-fixed-guest-build/nfr-design/security-design.md
- aidlc/spaces/default/intents/261012-terrarium-migration/construction/u5-fixed-guest-build/nfr-design/reviews/review-05.md
- aidlc/spaces/default/intents/261012-terrarium-migration/construction/u5-fixed-guest-build/code-generation/code-summary.md（Step 37 から Step 45 の節）

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u5-fixed-guest-build/nfr-design/security-design.md > D6（Releaseへの保存） | Releaseへの書込みは「tagを作る」「ELF・build-info・catalogの3つを置く」という複数の操作で、原子的ではない。途中で失敗すると、tagと一部のassetだけが残る。D6は「tagが既にあれば上書きせず検証だけ」「tagとassetは削除も上書きもしない（C12）」と定めているので、この半端なReleaseは次回から検証に失敗し続け、削除も補完もできず、そのkeyが永久に使えなくなる。同様に、tag名はkeyの先頭16文字だけなので、先頭が衝突した別keyのtagが「既存」と判定されても扱いが決まっていない。 | 一組を公開するまで見えない手順（例：draft Releaseを作り、3つを置き、digestを検証してからpublishする。draftは公開前なので削除してよいと明記する）を決める。tagが既にあるときは、build-infoのbuildKeyの全64桁を照合し、不一致や欠けた組は「そのkeyは使えない」と記録して拒否する分岐を設計に加える。 | Resolved (reviewer) |
| R-02 | Major | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u5-fixed-guest-build/nfr-design/security-design.md > D6（直列化・書込みjob、Q3=A） | 直列化をworkflow全体の単一 `concurrency` groupで行う設計は、GitHubの仕様（実行中1件と待機1件だけを保持し、新しい待機が古い待機を取り消す）を考慮していない。`cancel-in-progress: false` でも、3件目の起動で2件目が黙って取り消されるので、「すべてのbuildを順に1つずつ」にならず、要求したbuild（例：baselineとfixの両方）が失われる。さらに、承認待ちの書込みjobを同じworkflowの中に置くと、承認が来るまでgroup全体が塞がる。逆に別workflowに分けると、Releaseへの書込み側の直列化が未定義になる。また、承認が非同期なので、承認前に同keyの2回目が始まるとReleaseに成果物がなくcompileが走る。「再利用ではcompileしない」（D6）と「後から動いたbuildのELFが違う場合」の記述（Minor 3の処理）が、どの順序で起きるのか読み取れない。 | 書込みjobがbuildと同じworkflowか別workflowかを決める。待機が取り消されても要求を失わない方法（起動時に結果を確認する、groupを書込み専用に分ける、待機を許さず衝突時は失敗にする等）を1つ選んで書く。承認待ち中に同keyのbuildが始まったときの結果（stagingの成果物を再利用する、またはcompileを許し、digest不一致を不合格にする）を明記する。 | Resolved (reviewer) |
| R-03 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u5-fixed-guest-build/nfr-design/security-design.md > D5（mbxのcache）、Threat Response | 「cacheを正しさの根拠にしない」「digest検証で守る」と書くが、digestは出来上がったELF自身から計算するので、汚染されたcacheが出したELFのdigestも、そのkeyの正本として記録されてしまう。digestの検証は、汚染を後から見つけられない。実際の防御は、保存を信頼したbuildだけに限ることだけである。また、`workflow_dispatch` は書込み権限のある人が任意のbranchから起動できるので、「mainで起動」は `github.ref == refs/heads/main` の確認として具体化する必要がある。 | 文言を「汚染の防御は書込みの制限であり、digestは汚染を検出しない」に直す。保存条件を `github.ref` の確認として書く。Releaseに保存する対象の初回buildだけは、cacheを復元しない（または、cacheなしの結果と照合する）選択肢を検討し、採否を書く。 | Resolved (reviewer) |
| R-04 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u5-fixed-guest-build/nfr-design/security-design.md > D2（builder hash）、D5（cache key） | builder hashに「builderのscriptのSHA256」を含め、それをmbxのcache keyにも使うので、Releaseへの書込みやbump-upstreamなど、ELFに影響しない部品を直すたびに、全guestのkeyが変わり、mbxのcacheも全部失われる。mbxが効くのはkeyが変わったときのcompile（Q1）なので、その利点が builder の編集のたびに消える。 | builder hashを、ELFに影響する入力（container内のscript、image digest、Bun・Node・mbxの版、command・flag）に限る。runnerで動く部品（検証・Release書込み・bump）は別の識別子（ログ・build-infoの参考欄）にするか、含めるなら意図を書く。 | Resolved (reviewer) |
| R-05 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u5-fixed-guest-build/nfr-design/security-design.md > D3（取得の上限） | 上限は取得の「後」に測るので、取得そのものは上限で止まらない。source 2GiB・依存4GiBを超える取得が起きても、実際には4時間の期限かrunnerのdiskの容量でしか止まらず、「有限の上限」（NFR4.2）としては弱い。また、NFR4.2が「NFR Designで試験を定める」と委ねたsourceと依存の上限の試験が、設計に書かれていない（2GiB/4GiBの受理と+1の拒否を、実際にその大きさで作るのは現実的でない）。 | 取得中に大きさを監視して打ち切る方法（例：cloneとfetchを監視付きのprocessで動かし、上限超過でprocess groupを終了）を書くか、後測りであることを残余リスクとして明記する。試験は、上限を注入できる設計にして、小さい値での境界値と+1を確かめることを定める。 | Resolved (reviewer) |
| R-06 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u5-fixed-guest-build/nfr-design/security-design.md > D1・D3・D4（処理の順序と取得元） | 次の点が決まっていない。(1) D1の確認、checkout、sourcePatches、key計算、Releaseの有無の確認、`cargo fetch`、build、の順序（再利用のとき、4GiBの依存を取得せずに済ませるには、keyの計算を取得より前に置く必要がある）。(2) Rust toolchainの取得元（rustupがstatic.rust-lang.orgから取得する場合、D3の上限と完全性の確認の対象外になる）。(3) 許可一覧は宣言のrepositoryにだけ効き、submodule、Cargoのgit依存、`.cargo/config.toml` によるregistry・source置換、`[patch]` といった別の取得元の扱いが無い。(4) `cargo fetch` の後のbuildをofflineにするか。(5) 許可一覧の照合は、https・credentialなし・redirectを辿らない・URLの正規化（`.git`、大文字小文字）で行うか。 | 1つの順序（宣言検証、D1、checkout、patch、key、Release照合、miss時だけfetchとbuild）を書く。toolchainの取得元と扱い、Cargoのgit依存・registry置換・submoduleの許否（許可一覧外は拒否が既定）、buildのoffline化、URLの照合規則を各1行で決める。 | Resolved (reviewer) |
| R-07 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u5-fixed-guest-build/nfr-design/security-design.md > D1 手順4・D2（Rust toolchain） | imageはbuilderの設定のdigestで固定され、手順4でpullされる。一方で、使うtoolchainの版は上流の `rust-toolchain` が決める。設定のimageと上流の指定がずれたときは「imageの中の版が指定と違えば拒否」になるが、その比較をどの手順で行うか（`rustc -vV` の出力と上流の指定の照合）が手順に現れない。拒否の位置は手順6〜7の間と読めるが、明示されていない。 | 手順6の後（またはD2のtoolchainの項）に、`rustc -vV` の版と上流の `rust-toolchain` の指定を照合して拒否する、と1行で加える。 | Accepted risk |
| R-08 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u5-fixed-guest-build/nfr-design/security-design.md > D7 の 2026-10-22 の注記、および Assumptions & Open Questions の「GITHUB_TOKEN で作ったPR」の項 | 注記は「必須の check がすべて通ったら自動で merge する」と書くが、その必須の check が何か（vivarium の main の ruleset が求めるもの）も、bot が作った PR でその check が実際に動くことも、設計に書かれていない。自動 merge は check の実行に完全に依存するようになったのに、Assumptions の「bump-upstream の PR で CI を動かす方法は Code Generation で決める」は古いまま残っている（code-summary の Step 41 で bot の PR に Commitlint が動いたことは分かるが、設計の側は更新されていない）。 | 注記に、自動 merge の条件となる必須 check を ruleset の名前で挙げるか、「ruleset の設定に従う」と明記する。Assumptions の該当項を、bot の PR で check が動くことを前提にした記述に直す。 | New |
| R-09 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u5-fixed-guest-build/nfr-design/security-design.md > Threat Response and Rollback、D7 の注記 | 自動 merge で新しくなった脅威（上流の branch の先端、または bot の資格情報が、人の確認なしに宣言へ入る）と、その戻し方が書かれていない。「過大な権限は…書込みを承認後の別のworkflowに分ける（D6、D7）」の項は、merge の権限を持つ bot の資格情報を考慮していない。D7 の「PRを作るjobにだけ必要な書込み権限」は merge の権限を含むのかも分からない。戻し方も、一般の「PR単位でrevert」と「宣言を前のkeyに戻す」だけで、誤って入った bump を戻す手順（revert の PR を人が作る、bump の workflow を止める）は明示されていない。ただし、動くのは宣言の commit だけ、accepted は不変、build と受け入れは人、D1 の確認は残る、と影響が限られているので、blocking ではない。 | Threat Response に1項目足す：脅威（上流の先端・bot の資格情報による未確認の commit の混入）、残る人の関門（build と受け入れ）、戻し方（bump の PR の revert と workflow の停止）、merge の権限を持つ資格情報の範囲。D7 の書込み権限の記述に merge の権限が含まれるかを明記する。 | New |
| R-10 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u5-fixed-guest-build/nfr-design/security-design.md > D7（元の「PRのmergeは人が行う（NFR3.5）」の行と 2026-10-22 の注記） | 元の行は「PRのmergeは人が行う（NFR3.5）」と NFR3.5 を根拠に引いたまま残り、すぐ下の注記が打ち消す。NFR3.5 自体は merge の方法を決めていないので、元の行の根拠の引き方が誤読を招く。また、宣言の commit だけが先に動き accepted が古いままの間に、下流（inception の FR10「実行前に guest source commit と digest を recipe 固定値へ照合し、不一致なら実行を拒否する」）がその状態をどう扱うかが、U5 の設計に書かれていない。 | 元の行に「（この行は 2026-10-22 の注記で置き換わった）」と印を付けるか、NFR3.5 の引用を外す。commit と accepted が食い違う間の下流の扱いを、書く（U6 の recipe が commit ではなく accepted で照合するなら、その旨を1行）か、U6 に渡す確認事項として Assumptions に残す。 | New |

> R-08 Not re-checked this round

> R-09 Not re-checked this round

> R-10 Not re-checked this round
