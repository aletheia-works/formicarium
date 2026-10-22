# U9 u9-retirement-acceptance のセキュリティと運用の要件

U9 は、この intent の最後の工程である。移した先の2経路（U6 の固定の再現、U8 の showcase の site）の受入の証拠を確かめ、そのうえで terrarium に関係するものを削除する。U9 が変えるものは次の3つである。

- 外部の削除：terrarium の repository・Pages・npm・JSR・fork
- formicarium と vivarium の中の terrarium の言及の削除
- その削除が pack の内容を変えることへの対応（NFR2.3）

根拠：

- 要件：`../../../inception/requirements-analysis/requirements.md` の FR16・NFR1・NFR2・NFR8
- unit-of-work の U9、契約 C10・C12（`../../../inception/contract-design/contract-summary.md`）
- 人間の回答：`nfr-requirements-questions.md` の方針と Q1〜Q6

U9 の Functional Design は無い。

## 置き換え（2026-10-21 の人間の方針）

| 元の定め | U9 での置き換え | 根拠 |
|---|---|---|
| FR16・C12：利用調査・移行の案内の後、個別の承認を受けて、最終版・deprecation・案内の Pages・README・archive・OpenTofu の整理を行う。既存の npm・JSR の版は削除しない | terrarium の repository・Pages・npm と JSR の全版・その OpenTofu の state・人間の fork を削除する。deprecation・最終版・案内の Pages・archive は行わない | 人間の方針「基本的にはterrarium関連は全削除します。特にdeprecatedとかにすらしません。過去の履歴すら無くす勢いで削除します。」 |
| FR16・C12：下流の依存が残っていれば退役しない。download・dependents を調査する | 削除の条件は、U6・U8 の受入の証拠だけにする。download と dependents は NFR8.10 で記録するが、判断には使わない | Q1=A |
| FR16・unit-of-work の U9：移行の案内 | 行わない。案内の Pages も README も作らない | 人間の方針（deprecated にすらしない） |
| unit-of-work の U9・C10：U6・U8 の必須の check を現在の source・入力と照合し、別の候補の log の混用を拒否する（identity の照合） | 照合の script は作らない。U6・U8 の証拠の file・ID・SHA256 と、全行が passed であることを、読取りで一覧にするだけにする（NFR8.1）。各証拠の生成時の照合は、U6・U8 の記録に残っている | Q1 の補足「既に全行合格の認識だから、もう削除してもいいと思っています。」 |
| unit-of-work の U9：未達・未承認なら退役を拒否する条件の試験 | 試験の code は作らない。NFR8.1 の一覧に不合格か欠落があれば削除を始めない、という手順上の拒否にする | 同上 |
| C12：JSON の操作計画（ExternalOperation）と人間の承認 | JSON の schema は作らない。各削除について、対象・手順・元に戻せないことを markdown の手順書に書き、人間の承認を chat で受ける（NFR8.2） | 同上。削除は人間が実行するので、照合用の executor が無い |
| 制約：古い測定記録や歴史の文書を機械的に削除しない。U6 の改訂：terrarium の歴史の説明は残す | formicarium と vivarium の中の terrarium への言及は、移行の記録を含めて消す（NFR8.6）。ただし次の2点は守る。(1) git の履歴は書き換えない（Q4=A）。(2) AI-DLC の記録・memory・codekb・audit の言及は、この intent を閉じた後に別の PR で消す（Q5=A と、この review での人間の回答） | 確認の質問への回答 B、Q4=A、Q5=A |
| NFR8：terrarium は FR16 まで維持する | 変えない。削除は U9 の手順の中だけで行う | — |

## 要件

| ID | 種類 | 要件 | 合格の条件 |
|---|---|---|---|
| NFR1.1 | 性能の証拠 | U9 は性能を測らない。U1 の初期の測定と U3 の正式な経路の測定の記録の場所を、U9 の記録に一覧で載せる | 一覧の各行に、記録の path と測定の日付がある |
| NFR2.1 | 品質の維持 | formicarium と vivarium から terrarium の言及を消す変更でも、既存の試験と品質の基準を下げない。probe 600秒・aube のブラウザ 840秒・1 worker・retry なし・8項目の合格・native の出力の一致・wasm 1GB・Worker の `delete Atomics.waitAsync`・第一者の配布 JS の行 coverage 80% を守る | 各 PR の CI の必須の check がすべて成功し、手元の単体試験・lint・型検査が通る |
| NFR2.2 | 試験の削除 | terrarium だけを対象にした試験（例：`tests/terrarium/`）は、対象の code と一緒にだけ消す。coverage の分母の file を増減するときは、理由を示して人の承認を受ける | 消す試験と、その対象の code の対応表が code-summary にある。分母の変更には人の承認の記録がある |
| NFR2.3 | pack と受入済みの版 | formicarium の npm の pack に入る file（`README.md`、`runtime/command-parse.js` などの comment）にも terrarium の言及がある（2026-10-21 の `grep`）。言及を消すと次の pack の digest が変わる。受入済みの版（B1 の Release `b1-a3370ca4df1f`、npm の公開済みの版）と、その証拠の identity は、作った時点の pack に結び付いたまま有効とし、作り直さない。変えた後の pack は、次の release で通常の CI と受入（U4 の B1 と同じ経路）を通す | 変更の PR で、pack に入る file のうち変わったものの一覧と、変更が comment・文書だけで code の動作を変えないことが記録にある。`showcase/b1-pack.json` は変えない |
| NFR2.4 | 名前が契約になっている所 | 型の名前・message の type・DOM の event の名前など、terrarium の名前が送り手と受け手の約束になっている所（例：C08 の `terrarium:run`・`terrarium-ready`）は、全部の送り手と受け手を同じ PR の組で変える。互換の adapter は作らない（FR12 の改訂） | 変える前に、この種類の名前の一覧が記録にある。変えた後、vivarium と formicarium の CI がどちらも成功する |
| NFR8.1 | 削除の条件 | 削除は、U6 と U8 の受入の証拠が揃ってから始める。人間は 2026-10-21 に「既に全行合格の認識」と判断した。U9 の Code Generation の最初に、次の2つを読取りだけで確かめて記録する。(a) U6：`.artifacts/u6-recipe-runtime/evidence-c10/acceptance-evidence.json`（evidenceId `u6-recipe-runtime-dcf959a1541a-2026-10-19`、SHA256 `3939063d978c73e390d2bb0a7a25422e9b46f530313363b77225d08f861f7dba`、19行。2026-10-21 に SHA256 と全行 passed を確かめた）。(b) U8：`showcase-site.yml` run 39509852083 の artifact `showcase-site-evidence-39509852083-deployed` の `evidence.json` | 2つの証拠の場所・ID・SHA256 と、行がすべて passed であることが U9 の記録にある。見つからないか、不合格の行があれば削除を始めず、人に報告する |
| NFR8.2 | 元に戻せない操作 | 次の削除は人間が実行する：repository の削除・npm の unpublish・JSR の版の削除・fork の削除・手元の clone の削除。私は対象の一覧と手順（command か Web 画面の操作）を markdown の手順書に書き、内容を示して承認を受ける。実行の後に、読取りだけで結果を確かめて記録する | 実行の後、次がすべて確かめられ、記録にある。<br>・`gh repo view aletheia-works/terrarium` が見つからない<br>・`npm view @aletheia-works/terrarium` が 404<br>・JSR の package の meta が 404 か版が0件<br>・`https://aletheia-works.github.io/terrarium/` が 404<br>・NFR8.11 の fork が見つからない |
| NFR8.3 | 削除が断られたとき | npm が規則で unpublish を断ったときは、npm の support に削除を依頼する。規則は、公開から72時間を過ぎた package を、npm 上の依存が無い・直近1週間の download が300件未満・持ち主が1人のときだけ unpublish できる、というもの（推測・未検証）。JSR で利用者が削除できないときは、JSR の運営に依頼する。どちらも deprecated にはしない。依頼の返答を待つ間も、repository の削除（NFR8.8 の (4)）は進めてよい。npm と JSR の削除は repository に依存しないため。運営が削除を断ったときは、結果を人間に示して判断を受ける | 依頼の有無・日時・返答と、人間の判断が記録にある。手順書に deprecate の command が無い |
| NFR8.4 | 秘密 | npm・JSR・GitHub の token や認証の情報を、chat・file・log・PR に出さない。認証は人間が自分の環境で行う | 手順書と記録に token の値が無い |
| NFR8.5 | 履歴 | formicarium と vivarium では、terrarium の言及を消す commit を新しく足す。過去の commit の履歴は書き換えない。ruleset（force push の禁止・署名・必須の check）は外さない | 各 PR が通常の commit で、`infra/github` の差分に ruleset の変更が無い |
| NFR8.6 | 言及の検索 | 削除の前と後に、言及の残りを検索して一覧にする。<br>・formicarium と vivarium：手元の checkout の全 file（追跡されている file）を `jj file list` と `rg -i terrarium` で検索する<br>・他の aletheia-works の repository：`gh search code --owner aletheia-works terrarium` で検索する<br>・検索は個人の `inputs.tar.gz` への参照も対象にする<br>`gh search code` は index の遅れ・fork・既定の branch 以外を見ないので、0件の証明にはならない。結果は「見つかった所」の一覧として扱う。残してよい path は次の一覧だけで、この intent を閉じた後に別の PR で消す：`aidlc/spaces/default/intents/` の下の記録（`261012-terrarium-migration/`・`261006-npm-terrarium-release/` などの intent の dir と `intents.json`・`audit/`）、`aidlc/spaces/default/memory/`（`team.md`・`project.md`）、`aidlc/spaces/default/codekb/`、`aidlc/spaces/default/knowledge/` | 後の検索で、formicarium と vivarium の手元の検索の一致が、上の残してよい path の外で0件である。`gh search code` の結果と command が記録にある |
| NFR8.7 | OpenTofu と organization | terrarium の OpenTofu は destroy しない。repository の削除で、その中の state と管理していた設定も一緒に消える。organization の ruleset や、他の repository の OpenTofu が terrarium を参照していれば、外す PR を出す | organization の ruleset と他の repository の `infra/` に terrarium の参照が無いことが、読取りの結果とともに記録にある |
| NFR8.8 | 順序 | 依存を先に消してから、外部を削除する。<br>(1) formicarium と vivarium の言及を消す PR を merge し、CI が通る<br>(2) npm の unpublish<br>(3) JSR の削除<br>(4) terrarium の repository の削除（Pages と Release の資産14件も消える）と、fork の削除<br>(5) 読取りの確認と検索（NFR8.6）<br>NFR8.3 の依頼の返答を待つ間は、(4) と (5) を先に進めてよい | 記録に各段の日時と結果が順に並んでいる |
| NFR8.9 | 切戻しと限界 | 削除は元に戻せない。人間はこれを承知のうえで「履歴すら無くす」方針を出した（2026-10-21）。backup は取らない。formicarium と vivarium の PR は revert で戻せる。第三者の複製（他人の fork・clone、npm の mirror・cache、Web の archive）は、この削除では消えない | 手順書に「元に戻せない」こと、PR だけは revert で戻せること、第三者の複製は消えないことが書いてある |
| NFR8.10 | 利用の記録 | 削除の直前に、npm の直近30日と直近1週間の download（`api.npmjs.org/downloads/point/...`）、JSR の版の一覧、GitHub の dependents の画面の件数を、読取りで記録する。判断には使わない（Q1=A） | 値・取得の日時・取得元の URL が U9 の記録にある |
| NFR8.11 | 人間の fork と手元の clone | 人間の fork（2026-10-21 の `gh repo list --fork` で `Marukome0743/terrarium`・`JamBalaya56562/terrarium` を観測）と、手元の clone（`~/Documents/terrarium`）も削除の対象にする。formicarium と vivarium の手元の jj の remote・bookmark に terrarium を指すものがあれば外す | NFR8.2 の手順書に fork と clone の行があり、実行の後に `gh repo view` で fork が見つからない |

NFR3（path の境界・archive の検証）、NFR4（fetch と build の deadline）、NFR5（build と publish の直列化）、NFR6（COI・Worker・CSP）、NFR7（端末の UI）は、U9 では対象外とする。U9 の変更は、comment・文書・名前（NFR2.4）・terrarium だけの試験と code（NFR2.2）に限り、これらの動作を変えないためである。動作を変えていないことは、NFR2.1 の CI と NFR2.3 の記録で確かめる。

## Sources

- `aidlc/spaces/default/intents/261012-terrarium-migration/inception/requirements-analysis/requirements.md`（FR16、NFR1–NFR8、制約、2026-10-18 の改訂）
- `aidlc/spaces/default/intents/261012-terrarium-migration/inception/units-generation/unit-of-work.md`（U9）
- `aidlc/spaces/default/intents/261012-terrarium-migration/inception/units-generation/unit-of-work-story-map.md`（FR16・NFR1・NFR2・NFR8 の U9）
- `aidlc/spaces/default/intents/261012-terrarium-migration/inception/contract-design/contract-summary.md`（C08・C10・C12）
- `aidlc/spaces/default/intents/261012-terrarium-migration/construction/u6-recipe-runtime/code-generation/code-summary.md`（C10 の証拠）
- `aidlc/spaces/default/intents/261012-terrarium-migration/construction/u9-retirement-acceptance/nfr-requirements/nfr-requirements-questions.md`（人間の方針と Q1〜Q6 の回答）
- `aidlc/spaces/default/intents/261012-terrarium-migration/construction/u9-retirement-acceptance/nfr-requirements/reviews/review-01.md`（指摘）
- 2026-10-21 の読取りの観測：npm の download の API、JSR の meta、`gh repo view`、`gh repo list --fork`、`gh api repos/aletheia-works/terrarium/releases`（14件）、formicarium の pack に入る file への `grep -i terrarium`、U6 の証拠の `shasum`
