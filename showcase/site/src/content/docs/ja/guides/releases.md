---
title: 公開と配布
description: formicarium の package の公開と、showcase の日次の配布。
---

## package

release-please が Conventional Commits から release の PR を作ります。必須の
check の後に merge すると `v<version>` の tag と GitHub Release ができ、
`publish.yml` が検証済みの tarball を trusted publishing と provenance で npm に
公開します。既にある版を置き換えることはありません。

## showcase

`showcase-site.yml` は毎日 04:17 UTC に動き、`main` から手動でも起動できます。
配布するのはこの2つの run だけです。

1. `showcase.yml` が `distribute` の mode で、B1 が受け入れた package
   （`showcase/b1-pack.json`）を使って候補を作り、受け入れます。その Release が
   できるまでは配布が失敗し、何も deploy しません。
2. このサイトを候補から1回だけ build し、検査し、header の無い HTTPS で
   Chromium・Firefox・WebKit の受入を行います。
3. C10 の証拠を作ります。必須の行はすべて合格でなければなりません。
4. deploy の job が、より新しい run が deploy していないことを確かめてから、
   受け入れた同じ artifact を GitHub Pages に公開します。
5. deploy した `site-identity.json` を、この run を示すまで読み直します。

PR と push は `main` の最新の候補でサイトを build して受け入れますが、deploy は
しません。どこかが失敗すれば前回のサイトがそのまま残ります。
