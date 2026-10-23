---

title: 公開と配布
description: formicarium の package の公開と、showcase の配布。
---

## package

release-please が Conventional Commits から release の PR を作ります。必須の
check の後に merge すると `v<version>` の tag と GitHub Release ができ、
`publish.yml` が検証済みの tarball を trusted publishing と provenance で npm に
公開します。既にある版を置き換えることはありません。チェックの詳細は
[パッケージの公開](/formicarium/ja/development/releases/)にあります。

## showcase

`showcase-site.yml` は、`main` への push がサイト（`showcase/site/**`・
`showcase/scripts/**`・この workflow）を変えたときに動き、`main` から手動でも
起動できます。日次の run は無いので、ゲストの新しい候補は手動の実行で配布します。
配布するのはこの2つの run だけです。
1. `showcase.yml` が `distribute` の mode で、pack の Release の受入済み package
   （`showcase/b1-pack.json`）を使って候補を作り、受け入れます。その Release が
   できるまでは配布が失敗し、何も deploy しません。
2. このサイトを候補から1回だけ build し、検査し、header の無い HTTPS で
   Chromium・Firefox・WebKit の受入を行います。
3. サイトの証拠を作ります。必須の行はすべて合格でなければなりません。
4. deploy の job が、より新しい run が deploy していないことを確かめてから、
   受け入れた同じ artifact を GitHub Pages に公開します。
5. deploy した `site-identity.json` を、この run を示すまで読み直します。

PR と `main` 以外の branch の手動の実行は `main` の最新の候補でサイトを build
して受け入れますが、deploy はしません。どこかが失敗すれば前回のサイトがそのまま残ります。
