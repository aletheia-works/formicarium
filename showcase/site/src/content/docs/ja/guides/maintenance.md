---

title: 保守
description: showcase のサイトの build・監視・切戻し・依存の確認。
---

## build と監視

サイトは、`main` への push がサイトを変えたときと、`main` から
`showcase-site.yml` を手動で実行したときに deploy します。日次の run はありません。
各 run は、最後の deploy からの日数と失敗した job を job summary に書きます。
deploy が古いことは失敗になりません。**Showcase guests** の新しい候補を配布する
ときは、`main` から `showcase-site.yml` を手動で実行します。

## 候補が無いとき

PR は `main` の `showcase.yml` の、最新の成功した push か手動の run の候補を使い
ます。その artifact が無い・期限切れのときは `fetch-candidate` の job が失敗し、
手動の実行を求めます。`main` で **Showcase guests** を起動し、成功を待ってから
PR の run をやり直します。

## 切戻し

- **サイトの変更が原因。** `main` で変更を revert します。revert の push がサイトを
  deploy し直すので、その run の `verify-deployment` の成功を確かめます（その run が
  失敗したら、`main` から `showcase-site.yml` を手動で実行します）。
- **ツールの新しい release が原因。** 失敗した run は deploy しないので、前回の
  サイトが残ります。`showcase/tools.json` のツールの条件を PR で直し（PR でサイトを
  検証します）、merge してから `main` で `showcase-site.yml` を手動で実行します。
  workflow を無効にしてはいけません。その `showcase-site-required` の check は
  `main` の必須の check なので、無効の間はどの PR も merge できなくなります。

`showcase/tools.json`・`showcase/fixtures/`・`showcase/formicarium-release.json` を
変える PR もサイトを検証します。`showcase/formicarium-release.json` の push では
deploy しますが、ほかは deploy しないので、`main` での手動の実行で配布します。

formicarium の安定版が npm に公開されると、`showcase-release-pin.yml` が
その版を `showcase/formicarium-release.json` に固定する PR を作ります（版、npm の
integrity、タグのコミットを、配布と同じ方法で確かめます）。その PR を merge すると、
その版でサイトを配布します。手で固定するときは、版を指定してこの workflow を実行します。

build や受入の失敗では deploy しないので、前回のサイトが残ります。古い run を
もう一度 deploy することはできません。deploy の job は、最新の deploy より古い
run を拒否します。

## 最初の deploy

最初の deploy（run 39422079965）は、`github-pages` の environment の承認者が承認
しました。サイトを確かめた後、`infra/github` の OpenTofu の PR で承認者を外したので、
以後の deploy に承認は要りません。それでも deploy は、`main` への push か `main` での
手動の実行のとき（environment は保護された branch だけを受け付けます）、前の job が
すべて成功したとき、より新しい run がまだ deploy していないときだけ動きます。

## 依存

`showcase/site/bun.lock` を commit し、`bun install --frozen-lockfile
--ignore-scripts` で入れます。依存の更新は PR で行います。dependency review が
`bun.lock` を読めないときは、merge の前に lockfile の差分を人が確かめます。
