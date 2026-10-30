---

title: '0015. ブラウザでは、WebSocket の relay を通してゲストがネットワークを使える'
description: ブラウザでの実行では、呼び出し側が指定した WebSocket の relay を通して、ゲストが TCP でつなげる。
---

- 状態：採用（2026-10-30）
- 決めた人：メンテナー。`jj git clone` のようなゲストが、ブラウザでも取得できるようにするため
- 一部を置き換えた決定：[0014](/formicarium/ja/development/decisions/0014-guest-tcp-clients-in-nodejs/)（ブラウザで `network` を断る部分）

## 背景

[0014](/formicarium/ja/development/decisions/0014-guest-tcp-clients-in-nodejs/) では、Node.js のゲストを TCP の client にし、
ページには TCP のソケットがないので、ブラウザでは `network` を断りました。paludarium 0.8.0 は `network.relay` を加えました。
コアは、ゲストの接続と名前の解決をひとつずつ WebSocket の relay に送り、relay が代わりに解決して接続します。
relay は `@aletheia-works/paludarium-wasm/relay` です。relay は自分の許可一覧で確かめ、解決したアドレスに署名し、
送信が TCP の相手より先に進みすぎないように抑えます。relay がなければ、コアはブラウザでの `network` をこれまでどおり断ります。

## 決定

- `NetworkOptions` は、省略できる `relay: { url, protocols? }` を受け取ります。Session は、`url` がフラグメントのない
  2048 文字以下の `ws:` か `wss:` の URL であること、`protocols` が `new WebSocket(url, protocols)` の受け取る形の、
  4096 文字以下の重複しない HTTP の token 8 個以下であることを確かめます（`INVALID_INPUT`）。どちらも写してコアに渡します。
- `network` と `relay` を付けたブラウザでの実行は Worker を立てます。`relay` がなければ、これまでどおり Worker を立てる前に
  `UNSUPPORTED_ENV` で失敗します。
- Node.js は、コアと同じく、relay を渡されればそれを使い、なければ自分で接続します。
- command API は、`relay` を `network` のほかの部分と一緒に、ゲストの実行にだけ渡します。
- relay とそのホストは呼び出し側のものです。formicarium は relay を起動しません。AWS の module（`infra/aws`）が
  Lambda MicroVMs で relay を動かす予定で、その認証は `protocols` に入れます。
- Node.js の回帰テストとブラウザのテストは、probe の `tcp-echo` を手元の relay を通して動かします。両方が許可した行き先と、
  実行は許可したが relay は許可しない行き先（`ENETUNREACH`）です。

## 結果

- ブラウザでは、ゲストは実行と relay の両方が許可した行き先にだけつながります。relay のホストを何に使わせるかは relay が決めます。
- ブラウザでの実行の接続は relay のホストを通り、そのホストには TCP の中身が見えます。TLS はゲストの中で動くので、
  HTTPS なら relay に見えるのは暗号文です。
- ページには、つなげる relay が必要です。GitHub Pages だけでは relay を置けません。
- showcase のサイトは、Aletheia Works が AWS で動かす relay（`infra/aws`）を使い、その端末で
  `https://github.com/...` の `git clone` と `jj git clone` ができます。`network` を受け取るのは、
  `tools.json` が `network` と決めたツール（git と jj）だけで、`allow: ['github.com:443']` を付けます。
  relay も同じ行き先だけを許します。page は最初のその実行の前に、サイトの `Origin` にだけ答える relay の
  Lambda の function URL から 15 分の token を取り、切れる 1 分前まで使い回します。token が取れなければ、
  そう示してから network なしで実行するので、手元の git と jj の作業は続けられます。端末の page の CSP が `connect-src` に足すのは、その関数の origin と
  `wss://*.lambda-microvm.ap-northeast-1.on.aws` だけです。git と curl は、showcase が公開された
  SHA-256 と照合して取得した、curl が取り出した Mozilla の CA の一覧（MPL-2.0）で証明書を確かめます。
  page は session を始めるときに、それを `/root/.config/ssl/cacert.pem` に置きます。

## 採らなかった案

- **Session や assets に relay の URL を持たせる**：Lambda MicroVM の token のように数分で切れるものがあるので、実行ごとに受け取ります。
- **formicarium から relay を起動する**：relay にはページの外のホストが要り、許可一覧と上限はその持ち主が決めます。
