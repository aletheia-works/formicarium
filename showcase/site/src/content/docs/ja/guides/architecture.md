---

title: 構成
description: エミュレータ・公開 API・showcase のつながり。
---

```text
showcase の page（Astro と Starlight、xterm.js）
  -> 公開 API：createSession（/browser）、createCommandSession（root）
     -> Session：file・cwd、一度に1つの run
        -> run ごとの Web Worker：WebAssembly に compile した paludarium
           -> static な x86-64 Linux の ELF の guest
```

**エミュレータ。** formicarium は Rust で書いた user mode の x86-64 Linux エミュレータの
paludarium を WebAssembly として動かします。run ごとに新しい Worker を始め、command が書いた
file は Session に残って次の command に渡ります。guest は実行の前に SHA256 と
`build-info.json` で検証します。

**showcase。** `showcase.yml` が guest を解決・取得・build・受入して候補を
作ります。このサイトはその候補を使うだけです。formicarium の pack は
`_formicarium/<version>/` に、guest と catalog はサイトの root に、demo の fixture は
`demo-fixtures/` に、bytes のまま置きます。page が取得する index と catalog は、
page に埋め込んだ SHA256 と照合します。

**分離と CSP。** GitHub Pages は COOP・COEP の header を付けられないので、端末の
page が `coi-serviceworker.js`（scope は `/formicarium/`）を COEP `require-corp`
で登録します。scope がサイト全体なので、どの page も cross-origin の資源を
読み込みません。端末の page の CSP は、同じ origin・`blob:`・WebAssembly の
compile だけを許します。文書の page は端末も service worker も読み込みません。

**表示。** guest の出力は UTF-8 の文字として xterm.js に書き、HTML として解釈
しません。xterm が返す escape 列を command line に入れず、OSC 8 の link も開き
ません。
