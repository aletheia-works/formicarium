# U9 u9-retirement-acceptance の技術の選択

U9 は新しい依存を足さない。削除・確認・検索に使うのは、既にある道具だけである。

| 用途 | 選択 | 理由 | 他の候補と退けた理由 |
|---|---|---|---|
| formicarium・vivarium の変更 | jj（colocated）、fork からの PR、署名つきの commit | 利用者の規則（jj を使う、署名を外さない）と、formicarium の ruleset に合う | git の直接操作：利用者の規則で、書込みには使わない |
| 言及の検索（NFR8.6） | formicarium と vivarium は手元の checkout で `jj file list` と `rg -i terrarium`。他の repository は `gh search code --owner aletheia-works` | 手元の検索は追跡されている全 file を確実に見られる。`gh search code` は index の遅れ・fork・既定の branch 以外を見ないので、見つかった所の一覧として使い、0件の証明には使わない | GitHub の Web の検索：記録に command と結果を残しにくい |
| 証拠の一覧（NFR8.1） | `shasum -a 256`、`gh run download`・`gh api`（読取りだけ）と、記録の file の読取り | U4・U8 の証拠の取得と同じ道具で、SHA256 を記録できる | 新しい照合の script と C12 の JSON の操作計画：人間が「既に全行合格」と判断し、削除は人間が実行するので、証拠の一覧と markdown の手順書で足りる（Q1 の補足、置き換えの表） |
| fork と手元の clone（NFR8.11） | 人間が GitHub の Web 画面で fork を削除し、手元の clone は Finder か Terminal で消す。私は `gh repo list --fork` と `gh repo view` で確かめる | 削除は元に戻せないので、人間が行う | — |
| npm の削除（NFR8.2・NFR8.3） | 人間が自分の環境で `npm unpublish @aletheia-works/terrarium --force` を実行する。断られたら npm の support の form | token を人間の環境の外に出さない。Trusted Publishing は unpublish を行えない | `npm deprecate`：方針で使わない |
| JSR の削除 | 人間が JSR の Web 画面で行う。できなければ JSR の運営に依頼する | JSR の CLI に版の削除が無いかもしれない（未検証） | — |
| repository の削除 | 人間が GitHub の Web 画面（Settings の Danger Zone）で行う | 削除は元に戻せないので、人間が確かめながら行う | `gh repo delete`：元に戻せない操作を私が実行することになるので使わない |
| 削除の後の確認 | `gh repo view`、`npm view`、`curl`（JSR の meta と Pages の URL） | 読取りだけで 404 を確かめられる | — |
| OpenTofu（NFR8.7） | terrarium の state は destroy しない。他の repository と organization の設定は読取りで確かめ、参照があれば OpenTofu の PR で外す | repository の削除で state も消え、二重の操作を避けられる | `tofu destroy`：Q6=A で行わない |

版について：使う道具は、作業の始めにその時点の最新版を確かめる（利用者の規則）。U9 の NFR では版を固定しない。

## Sources

- `aidlc/spaces/default/intents/261012-terrarium-migration/construction/u9-retirement-acceptance/nfr-requirements/nfr-requirements-questions.md`
- `aidlc/spaces/default/intents/261012-terrarium-migration/construction/u9-retirement-acceptance/nfr-requirements/security-requirements.md`
- `aidlc/spaces/default/codekb/formicarium/technology-stack.md`
