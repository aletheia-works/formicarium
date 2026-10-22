# U9 u9-retirement-acceptance のセキュリティと運用の設計

`../nfr-requirements/security-requirements.md` の NFR1.1〜NFR8.11 を、実行の形に落とす。U9 の作業は3つの部分からなる。

- 記録：AI-DLC の記録。U9 の Code Generation の code-summary に書く
- formicarium の1つの PR
- 人間が行う外部の削除

U9 は常駐するサービスも、新しい script も作らない。

人間の回答は `nfr-design-questions.md` の Q1=A・Q2=A・Q3=A（2026-10-21）。U9 の Functional Design は無い。

## 全体の流れ

| 段 | 内容 | 実行する人 | 関係する要件 |
|---|---|---|---|
| D0 | 前の確認：U6・U8 の証拠（S1）、利用の記録（S9）、言及の検索の前の版（S6）、名前の約束の一覧（S4） | 私（読取りだけ） | NFR8.1、NFR8.10、NFR8.6、NFR2.4 |
| D1 | formicarium の言及を消す1つの PR（S2・S3・S4）。fork の bookmark から push し、上流に PR を出し、CI が通ったら人が merge する | 私（PR まで）／人（merge） | NFR2.1–NFR2.4、NFR8.5 |
| D2 | 削除の手順書（S5）を示して、承認を受ける | 私 | NFR8.2、NFR8.4、NFR8.9 |
| D3 | npm の unpublish（S5 の手順 1）。断られたら support に依頼（S5 の手順 1b） | 人 | NFR8.2、NFR8.3 |
| D4 | JSR の削除（S5 の手順 2）。できなければ運営に依頼 | 人 | NFR8.2、NFR8.3 |
| D5 | terrarium の repository の削除（Pages・Release 14件も消える）、fork 2つの削除、手元の clone の削除（S5 の手順 3〜5）。D3・D4 の依頼の返答を待つ間も進めてよい | 人 | NFR8.2、NFR8.7、NFR8.8、NFR8.11 |
| D6 | 後の確認：404 の確認（S7）と、言及の検索の後の版（S6） | 私（読取りだけ） | NFR8.2、NFR8.6 |
| D7 | intent を閉じた後：AI-DLC の記録・memory・codekb・knowledge の言及を消す、別の PR（U9 の外） | 私（PR まで）／人（merge） | NFR8.6 の残してよい path |

各段の日時・command・結果は、U9 の code-summary に順に書く（NFR8.8）。

## S1：削除の前の証拠の確認（NFR8.1、Q2=A）

1. U6：`.artifacts/u6-recipe-runtime/evidence-c10/acceptance-evidence.json` を `shasum -a 256` で計算する。`3939063d978c73e390d2bb0a7a25422e9b46f530313363b77225d08f861f7dba` との一致を確かめる。さらに、`evidenceId` が `u6-recipe-runtime-dcf959a1541a-2026-10-19` であることと、`checks` の全行の `status` が `passed` であることを、node で読んで確かめる。
2. U8：`gh run download 39509852083 --repo aletheia-works/formicarium --name showcase-site-evidence-39509852083-deployed` で取得する。その `evidence.json` の SHA256・evidenceId・行の数と、全行が `passed` であることを記録する。
3. U8 の artifact が期限切れか消えていたとき（Q2=A）：
   - main で `showcase-site.yml` を手動でもう一度実行する。内容を示して人の承認を受けてから、JamBalaya56562 の `gh workflow run` で起動し、終わったら Marukome0743 に戻す。
   - その run の `showcase-site-evidence-<run_id>-deployed` で、2. をやり直す。
4. 1〜3 のどれかで、一致しない・不合格の行がある・取得できない、のどれかになれば、D1 以降に進まず、人に報告する。

## S2：formicarium の1つの PR（NFR2.1、NFR2.2、NFR8.5、Q3=A）

- 対象：`jj file list` のうち `aidlc/` を除く file で、`rg -il terrarium` が一致するもの。2026-10-21 の観測では 82 件ある。中身の分類と変え方は、U9 の Code Generation の計画で file ごとに決める。分類は次の5つ。
  - comment
  - 文書・README
  - 試験の名前と fixture
  - terrarium だけの試験と code（例：`tests/terrarium/`）
  - 名前の約束（S4）
- terrarium だけの試験と code は、対象と一緒に消す。消す試験と対象の対応表を code-summary に書く（NFR2.2）。
- coverage の分母（固定の一覧）の file を増減するときは、理由を示して人の承認を受ける（NFR2.2）。
- 変えるのは言及だけにし、指摘の外の改善や全体の整形は混ぜない（project.md の Forbidden）。
- jj で `main@upstream` の上に1つの change を作り、bookmark を付けて fork に push し、上流に PR を出す。
  - commit は署名する。
  - push・PR は、内容を示して承認を受けてから行う。
  - 履歴は書き換えず、ruleset も変えない（NFR8.5）。
- 手元の確認（main session で1つずつ実行する）：
  - `mise run typecheck`
  - `mise run lint:all`
  - `mise run test:light`
  - 変えた file に関係する単体試験
  - showcase と site の単体試験と境界の試験（showcase の file を変えるとき）
- 重い受入（probe、aube のブラウザ）は手元では実行しない。PR の CI の必須の check で確かめる（NFR2.1）。aube は再 build しない（project.md の Forbidden）。

## S3：pack と受入済みの版（NFR2.3）

- PR の前後で `npm pack --dry-run --json` を実行し、pack に入る file の一覧と、変わった file を記録する。
- 変わった file の差分が、comment・文書・名前（S4）だけで、code の動作を変えないことを差分で確かめて記録する。
- 受入済みの版（B1 の Release `b1-a3370ca4df1f`、npm の公開済みの版）と、その証拠は作り直さない。`showcase/b1-pack.json` は変えない。変わった pack は、次の release の通常の CI と B1 の経路で受け入れる。

## S4：名前の約束（NFR2.4）

- D0 で、型の名前・message の type・DOM の event・環境変数・CLI の option・file の名前・schema の値のうち、terrarium を含むものを一覧にする。各行には、送り手と受け手の file を書く。
- vivarium は言及が0件（2026-10-21）なので、約束の相手が vivarium に残っていないことを `rg` で確かめる。相手が vivarium にあれば、vivarium の PR を同時に出し、両方の CI の成功を待ってから merge する。
- 互換の adapter や、古い名前の受付は作らない（FR12 の改訂）。

## S5：削除の手順書（NFR8.2、NFR8.3、NFR8.4、NFR8.9、NFR8.11）

`.artifacts/u9-retirement/deletion-runbook.md`（追跡しない）に markdown で書き、D2 で内容を示して承認を受ける。手順書の冒頭には次の3点を書く。

- 元に戻せないこと
- formicarium の PR だけは revert で戻せること
- 第三者の複製（他人の fork・clone、npm の mirror・cache、Web の archive）は消えないこと

| 手順 | 対象 | 操作（人が自分の環境で行う） | 確かめ方（私、読取り） |
|---|---|---|---|
| 1 | npm `@aletheia-works/terrarium` の全版 | `npm unpublish @aletheia-works/terrarium --force` | `npm view @aletheia-works/terrarium` が 404 |
| 1b | 1 が断られたとき | npm の support の form で、package の削除を依頼する（deprecate はしない） | 依頼の日時と返答を記録する |
| 2 | JSR `@aletheia-works/terrarium` の全版 | JSR の Web 画面で削除する。できなければ運営に依頼する | `https://jsr.io/@aletheia-works/terrarium/meta.json` が 404 か、版が0件 |
| 3 | `aletheia-works/terrarium`（Pages・Release・その中の OpenTofu の state を含む） | GitHub の Settings の Danger Zone で削除する | `gh repo view aletheia-works/terrarium` が見つからない、`https://aletheia-works.github.io/terrarium/` が 404 |
| 4 | fork `Marukome0743/terrarium`・`JamBalaya56562/terrarium` | 各 account の Settings で削除する | `gh repo view` で見つからない |
| 5 | 手元の clone `~/Documents/terrarium` | Finder か Terminal で消す。formicarium と vivarium の jj の remote・bookmark に terrarium を指すものがあれば外す | `jj git remote list` に terrarium が無い |

- 手順書と記録には、token・認証の値を書かない。認証は人が自分の環境で行う（NFR8.4）。
- 1b や 2 の依頼で運営が削除を断ったときは、結果を人に示して判断を受ける（NFR8.3）。

## S6：言及の検索（NFR8.6、Q1=A）

D0 と D6 で同じ command を使い、結果を code-summary に並べて書く。

- formicarium・vivarium の手元：`jj file list` の全 file に `rg -il terrarium`。個人の `inputs.tar.gz` の参照は `rg -il 'inputs\.tar\.gz'` で探す。
- formicarium・vivarium の upstream の全 branch（Q1=A）：`jj git fetch` の後に、各 remote の branch ごとに `git grep -il terrarium <remote>/<branch>` を実行する。これは読取りだけの inspection で、user の jj の規則に合う。main 以外で一致があれば、branch ごとに一覧にして、消すか残すかを人に聞く。2026-10-21 の観測では、formicarium に `codex/*` の4本と release-please の branch、vivarium に release-please の branch がある。
- 他の aletheia-works の repository：`gh search code --owner aletheia-works terrarium`。見つかった所の一覧として扱い、0件の証明には使わない。
- 人間の fork は削除するので、検索しない（Q1=A）。
- 合格の条件：D6 で、手元の一致が NFR8.6 の残してよい path（`aidlc/spaces/default/` の intents・memory・codekb・knowledge）の外で0件であること。main 以外の branch の一致は、人の判断のとおりに処理されていること。

## S7：後の確認（NFR8.2）

D6 で、S5 の表の「確かめ方」をすべて実行し、command・日時・HTTP の状態・出力を記録する。1つでも残っていれば、残ったものを人に示す。

## S8：OpenTofu と organization（NFR8.7）

- D0 で、次を読取りで確かめる。
  - `gh api orgs/aletheia-works/rulesets`（権限が無ければ、その旨を記録して人に確かめてもらう）
  - formicarium と vivarium の `infra/` にある `rg -i terrarium`
- 参照があれば、S2 の PR か、その repository の OpenTofu の PR で外す。
- terrarium の OpenTofu は destroy しない。repository の削除で state も消える。

## S9：利用の記録（NFR8.10）

D0 と D3 の直前に、次を `curl` で取得し、値と URL と日時を記録する。判断には使わない。

- npm：`https://api.npmjs.org/downloads/point/last-month/@aletheia-works/terrarium` と `last-week`
- JSR：meta
- GitHub の dependents：`https://github.com/aletheia-works/terrarium/network/dependents` の件数。page の読取り。取れなければ取れなかったと記録する

## S10：性能の証拠の一覧（NFR1.1）

U1 の初期の測定と U3 の正式な経路の測定の記録の path と日付を、code-summary に一覧で書く。測り直しはしない。

## 対象外の確認（NFR3〜NFR7）

S3 の差分の確認と、S2 の PR の CI（NFR2.1）で、path の境界・deadline・直列化・COI と Worker と CSP・端末の UI の code が変わっていないことを確かめる。変わっていれば、その部分を S2 から外し、人に報告する。

## Sources

- `aidlc/spaces/default/intents/261012-terrarium-migration/construction/u9-retirement-acceptance/nfr-requirements/security-requirements.md`
- `aidlc/spaces/default/intents/261012-terrarium-migration/construction/u9-retirement-acceptance/nfr-requirements/tech-stack-decisions.md`
- `aidlc/spaces/default/intents/261012-terrarium-migration/construction/u9-retirement-acceptance/nfr-requirements/reviews/review-02.md`
- `aidlc/spaces/default/intents/261012-terrarium-migration/construction/u9-retirement-acceptance/nfr-design/nfr-design-questions.md`
- `aidlc/spaces/default/intents/261012-terrarium-migration/inception/contract-design/contract-summary.md`（C08・C10・C12）
- 2026-10-21 の読取りの観測（`gh api .../branches`、vivarium と formicarium の `rg -il terrarium`）
