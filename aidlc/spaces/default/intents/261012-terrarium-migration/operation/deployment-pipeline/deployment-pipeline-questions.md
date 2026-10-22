# Deployment Pipeline の確認

## Sources

- `../../construction/ci-pipeline/ci-config.md`・`quality-gates.md`、`../../construction/*/infrastructure-design/`（U5・U7・U8 の cicd-pipeline と infrastructure-specification）。
- formicarium の upstream main `e0842371` の `.github/workflows/`（`release.yml`・`release-merge.yml`・`release-candidate.yml`・`publish.yml`・`showcase-site.yml`）、`.github/release-please-config.json`・`release-please-manifest.json`（0.3.0）。
- GitHub REST の読取り（2026-10-22）：formicarium の environment は `github-pages`（branch policy）・`production`・`release`（どちらも保護の規則なし）。vivarium は `fixed-guest-release`（required reviewers と branch policy）・`github-pages`・`production`。npm の dist-tags は `latest: 0.3.0`・`next: 0.1.0-rc.1`。
- `../../construction/build-and-test/build-and-test-summary.md` で後の段階（deployment-pipeline）に回した4件：U6-NFR6.4（Pages の上限と実際の site build の記録）、U6-NFR8.5（revert による切戻しの手順）、U8-NFR6.4b（Pages の1 file の上限と転送量）、U8-NFR8.5（切戻しの手順）。
- team.md「Deployment」：ユーザーが対象版を承認した後、版タグから公開を始める。RC は npm `next`、stable は `latest`。不具合時は追加公開を止め、利用者を既知の版へ誘導する。staging サービスや常時稼働サーバーを前提にしない。

## 今の配布の仕組み（観測した事実）

- **npm**：main への push で release-please が release PR を作る・更新する（`release.yml`、`vars.RELEASE_AUTOMATION_ENABLED`）。`release-merge.yml` が毎週月曜 00:23 UTC に、その release PR へ auto-merge（squash）を付ける。merge で `v*` の tag ができ、`publish.yml` が「merge 済みの release PR と CI の成功」を確かめてから、environment `release` で Trusted Publishing（`--provenance`）により公開する。**`release` environment には required reviewers が無い**ので、tag ができると人の承認なしに公開まで進む。
- **GitHub Pages（showcase site）**：main への push で `showcase-site.yml` が build・3ブラウザの受入・coverage・evidence の後に deploy し、verify-deployment で配布後の一致を確かめる。site 全体の大きさは 1 GiB 未満を確かめる（`showcase/site/scripts/check-site.ts` 17行）。1 file の上限の確認は無い。
- **vivarium**：docs（Pages）は `deploy-docs.yml`。guest の Release は `fixed-guest-release` environment の承認の後に作る。

## 訂正（2026-10-22、回答の後に確かめた）

上の「今の配布の仕組み」の「`release-merge.yml` が毎週…auto-merge を付ける」と、Q1 の「今は release PR の auto-merge（毎週）から公開まで人の承認なしに進む」は誤りだった。repository の variable `WEEKLY_RELEASE_MERGE_ENABLED` は `false`（`infra/github/release.tf` の既定も `false`）で、`release-merge.yml` の job は動かない（`if:` が `vars.WEEKLY_RELEASE_MERGE_ENABLED == 'true'` を要る）。release PR は人が merge し（例：#41）、その merge で tag ができ、`publish.yml` が公開する。つまり release PR の merge が、今の人の承認の点である。Q1 の A は、その上に公開の直前の2つ目の承認を足すことになる。Q1 は人間に確かめ直す。

## Q1: npm の公開の承認

team.md は「ユーザーが対象版を承認した後に公開」と書くが、今は release PR の auto-merge（毎週）から公開まで人の承認なしに進みます。どうしますか？

A. `release` environment に required reviewers（人）を付け、公開の job の前で人が承認する。release PR の auto-merge はそのままにし、tag までは自動、npm への公開だけを人が止められるようにする（推奨。設定は `infra/github` の OpenTofu で行い、適用は差分を示して承認を受ける）。
B. 今のまま自動で公開する。team.md の「Deployment」の書き方を今の運用に合わせて直す（learnings の手続きで）。
X. Other (please specify)

[Answer]: A（2026-10-22 に撤回）→ 訂正の後の回答：「Keep the release PR merge as the approval. Make clear in the runbook that merge means approval to publish.」（B と同じく `release` environment は変えず、release PR の merge を公開の承認とし、runbook にそう明記する。team.md の「Deployment」は今の運用と合っているので直さない）

## Q2: 環境の昇格

staging のサービスはありません。npm の公開の前の確認をどうしますか？

A. 今のまま：PR の CI（`ci-required`）・release candidate の検証・merge の後の手動の受入（`migration-acceptance.yml`）を通った commit だけを release PR にのせ、RC（`next`）は必要なときだけ使う（推奨）。
B. stable の前に必ず RC（`x.y.z-rc.N` を `next` に公開）を出し、受入を確かめてから stable（`latest`）にする。
X. Other (please specify)

[Answer]: A

## Q3: 切戻しの手順（U6-NFR8.5・U8-NFR8.5）

切戻しの手順を、どう定めますか？

A. 配布先ごとに runbook に書く（推奨）。npm：unpublish はせず、`npm dist-tag add @aletheia-works/formicarium@<前の版> latest` で `latest` を戻し、問題の版に `npm deprecate` で理由を付ける（どちらも人間が実行）。Pages：問題の commit を main で revert する PR を作り、`showcase-site.yml` の deploy と verify-deployment で戻ったことを確かめる。vivarium の guest：recipe の `accepted` を前の build へ戻す PR（Release は消さない）。
B. Pages の前の artifact を手動で再 deploy する手順にする（revert しない）。
X. Other (please specify)

[Answer]: A

## 訂正2（2026-10-22、回答の後に公式の文書で確かめた）

GitHub の公式の文書「GitHub Pages limits」（https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits 、2026-10-22 に読んだ）：公開する site は 1 GB まで。1 file の上限は**書かれていない**。転送量は月 100 GB の soft limit。deploy は10分を超えると timeout。build は1時間に10回の soft limit で、独自の GitHub Actions の workflow で build と公開をする場合はかからない。Q4 の「1 file 100 MB」は git の repository の上限との取り違えだった。Q4 は人間に確かめ直す。

## Q4: Pages の上限（U6-NFR6.4・U8-NFR6.4b）

GitHub Pages の公表の上限（site 1 GB、1 file 100 MB、転送量の目安）に対して、何を確かめますか？

A. formicarium の `check-site.ts` に「1 file 100 MiB 未満」の確認を足し、site の build ごとに最大の file の大きさと全体の大きさを evidence に残す。vivarium の docs も、build の後に同じ2つの値を記録する。転送量は監視しない（推奨。code の変更なので、PR で差分を示して承認を受ける）。
B. code は変えず、今の site の大きさと最大の file を一度だけ測って記録する。
X. Other (please specify)

[Answer]: A

## Q5: feature flag

feature flag の仕組みを入れますか？

A. 入れない。library と静的な site なので、版と revert で切り替える（推奨）。
B. 入れる（具体的に書いてください）。
X. Other (please specify)

[Answer]: A

## Assumptions & Open Questions

None.

どの選択肢も、push・PR・設定の適用（OpenTofu）・公開の前に、差分と対象を示して人間の承認を受ける。新しい費用は前に相談する。
