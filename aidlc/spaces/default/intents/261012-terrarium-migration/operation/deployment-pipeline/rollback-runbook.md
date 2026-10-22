# 切戻しの手順（runbook）

人間の回答（`deployment-pipeline-questions.md` の Q3 A、2026-10-22）。元に戻せない操作（npm の unpublish、Release の削除、repository の削除）はしない。どの操作も、実行する前に対象と影響を示して人間の承認を受ける。

## Sources

`deployment-pipeline-questions.md`、`cd-config.md`、`deployment-strategy.md`、team.md「Deployment」（不具合時は追加公開を止め、利用者を既知の版へ誘導する）。

## 0. 公開の承認について（先に読む）

- **release PR を merge することが、npm への公開の承認である。** merge の後、tag の作成と `publish.yml` の公開は人の追加の承認なしに進む。公開したくない版の release PR は merge しない。
- 公開を止めたいのに merge してしまったときは、`publish.yml` の run を GitHub の Actions の画面で cancel する（公開の step の前なら止まる）。止められなかったら、下の「1. npm」の手順で戻す。

## 1. npm（`@aletheia-works/formicarium`）

前提：問題の版を `<bad>`、前の正しい版を `<good>` とする。どちらも人間が自分の環境で、npm の認証のもとで実行する（agent は実行しない）。

1. 追加の公開を止める：開いている release PR を merge しない。`WEEKLY_RELEASE_MERGE_ENABLED` が `false` のままであることを確かめる。
2. `latest` を前の版へ戻す：`npm dist-tag add @aletheia-works/formicarium@<good> latest`
3. 問題の版に理由を付ける：`npm deprecate @aletheia-works/formicarium@<bad> "<理由と、<good> を使う案内>"`
4. 確かめる：`npm view @aletheia-works/formicarium dist-tags` で `latest` が `<good>` であること、`npm view @aletheia-works/formicarium@<bad> deprecated` に理由があること。
5. unpublish はしない（取り消せない。利用者の lockfile を壊す）。
6. 直した版は、通常の経路（PR → main → release PR の merge）で新しい版として出す。

RC（`next`）の場合も同じで、`next` を前の RC か削除せずに別の版へ向ける。

## 2. GitHub Pages（showcase site）

1. 問題を入れた commit を確かめる（`site-identity.json` の source commit、showcase-site の run の summary）。
2. その commit を main で revert する PR を作る（`jj` で revert の change を作り、差分を示して push と PR の承認を受ける）。
3. PR の必須の check（`showcase-site-required` を含む）が通ったら merge する。main への push で `showcase-site.yml` が build・受入・deploy・verify-deployment を行う。
4. 確かめる：verify-deployment が success で、配布された `site-identity.json` の source commit が revert の commit であること。build の summary の site の大きさ・最大の file・deploy の時間が前と同じ範囲であること。
5. 前の artifact を手で再 deploy する方法は使わない（Q3 A。受入を通らない site を出さないため）。

## 3. vivarium の guest（固定 guest の Release）

1. recipe の `recipe.json` の `accepted` を、前の build（buildKey・elfSha256・buildInfoSha256）へ戻す PR を vivarium に作る（差分を示して承認を受ける）。
2. Release（`guest-<tool>-<key>`）は消さない。前の build の Release がそのまま使われる。
3. PR の CI（`regression (chromium|firefox|webkit)` を含む）が通ったら merge する。vivarium の docs の deploy で、戻した ELF の page が配布される。
4. 確かめる：配布された page が前の ELF の SHA256 を参照すること。

## 4. vivarium の docs（GitHub Pages）

1. 問題の commit を vivarium の main で revert する PR を作る。
2. 必須の check が通ったら merge する。`deploy-docs.yml` が build・check-site・deploy を行う。
3. 確かめる：deploy-docs の run が success で、step summary の site の大きさと最大の file が前と同じ範囲であること。

## 5. 記録

切戻しのたびに、何を・なぜ・どの手順で戻したか、確かめた結果（command の出力、run の番号）を、その intent の記録（`operation/` の該当の段階）に残す。
