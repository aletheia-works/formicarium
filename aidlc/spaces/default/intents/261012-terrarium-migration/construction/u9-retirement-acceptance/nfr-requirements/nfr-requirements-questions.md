# U9 u9-retirement-acceptance の NFR Requirements の質問

U9 は、この intent の最後の工程である。移した先の2経路（U6 の固定の再現と U8 の showcase の site）の受入の証拠を照合し、その後に terrarium を片付ける（unit-of-work の U9、FR16、NFR1・NFR2・NFR8）。U9 の Functional Design は無いので、要件・契約・unit-of-work と、2026-10-21 の読取りの観測から質問を作った。

## 人間の方針（2026-10-21）

- 「基本的にはterrarium関連は全削除します。特にdeprecatedとかにすらしません。過去の履歴すら無くす勢いで削除します。」
- 確認の質問「formicarium の中に残る terrarium の記述も消すか」への回答：B（formicarium と vivarium の中の terrarium への言及も、移行の記録を含めてすべて消す）。
- このため、FR16 の「既存の npm・JSR の版を削除しない」「deprecation・archive で退役する」と、制約の「歴史の文書を機械的に削除しない」、U6 の改訂の「terrarium の歴史の説明は残す」は、U9 では「全削除」に置き換える（置き換えは U9 の NFR の文書に記録する）。
- 削除の操作（repository・package・state の削除）は元に戻せないので、人間が実行する。私は手順と対象の一覧を用意し、実行の後に読取りで確かめて記録する。

## 観測（2026-10-21、読取りだけ）

- npm `@aletheia-works/terrarium`：latest は `0.3.0`。直近30日（2026-09-19〜10-18）の download は 469 件。CI・bot の割合は分からない。
- JSR `@aletheia-works/terrarium`：`0.1.0`・`0.2.0`・`0.3.0` の3版。
- GitHub `aletheia-works/terrarium`：archive されていない。Pages は `https://aletheia-works.github.io/terrarium/`。`infra/github` に OpenTofu がある。
- npm の unpublish の規則（推測・未検証）：公開から72時間を過ぎた package は、npm 上の依存が無い・直近1週間の download が300件未満・持ち主が1人、のすべてを満たすときだけ unpublish できる。
- JSR で公開済みの版を利用者が削除できるかは未検証。

## Q1. 削除を始める条件

A. U6 と U8 の両経路の照合（source・pack・guest・deployed の identity）が全行合格になったら削除を始める。npm・JSR の download と GitHub の dependents は記録だけにする（推奨：FR16 の「両経路の受入の後」を守り、利用の数は判断に使わない）
B. A に加えて、aletheia-works の外の GitHub の dependents が0件であることも条件にする
C. 照合を待たずに、すぐ削除を始める
X. Other (please specify)

[Answer]: A（人間の補足 2026-10-21：「Q1に関しては既に全行合格の認識だから、もう削除してもいいと思っています。」）

## Q2. npm の unpublish が規則で断られたとき

A. npm の support に削除を依頼する。deprecated にはしない（推奨：方針の「deprecated にすらしない」に合う）
B. 削除できない版だけ deprecated にする
C. 削除できない版はそのまま残す
X. Other (please specify)

[Answer]: A

## Q3. JSR の版を自分で削除できないとき

A. JSR の運営に削除を依頼する（推奨）
B. 削除できない版はそのまま残す
X. Other (please specify)

[Answer]: A

## Q4. formicarium と vivarium の git の履歴

formicarium の main は ruleset で force push と履歴の書き換えを禁じている（`non_fast_forward`）。

A. formicarium と vivarium は、terrarium への言及を消す commit を新しく足す。過去の commit の履歴は書き換えない（推奨：ruleset を外さずに済み、他の clone と食い違わない）
B. ruleset を一時的に外して、formicarium と vivarium の履歴から terrarium を消すように書き換える
X. Other (please specify)

[Answer]: A

## Q5. formicarium の中の「移行の記録」の扱い

この intent の AI-DLC の記録は `aidlc/spaces/default/intents/261012-terrarium-migration/` にあり、名前にも中身にも terrarium がある。製品の code（`tests/terrarium/`、`scripts/migration-*` など）や文書にも terrarium の名前がある。

A. 製品の code・試験・文書・README から、terrarium の名前と互換の部分を消す。AI-DLC の記録は、この intent を閉じた後に、記録の dir ごと消す PR を別に出す（推奨：intent の途中で記録を消すと、残りの工程が動かない）
B. 製品の code と文書に加えて、AI-DLC の記録の中の terrarium の記述も、この U9 の中で書き換える
X. Other (please specify)

[Answer]: A

## Q6. terrarium の OpenTofu の state と organization の設定

A. terrarium の repository を削除すれば、その repository の中の OpenTofu の state と管理していた設定も一緒に消えるので、destroy はしない。organization の ruleset や他の repository の OpenTofu が terrarium を参照していれば、外す PR を出す（推奨：repository の削除で足り、二重の操作を避ける）
B. repository を削除する前に、terrarium の OpenTofu で `tofu destroy` を実行して記録を残す
X. Other (please specify)

[Answer]: A
