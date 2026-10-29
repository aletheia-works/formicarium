---

title: '0014. Node.js では、ゲストが TCP の client になれる'
description: Node.js での実行では、許可した TCP の行き先にゲストがつなげる。指定しなければ、これまでどおりネットワークはない。
---

- 状態：採用（2026-10-29）。ブラウザで `network` を断る部分は [0015](/formicarium/ja/development/decisions/0015-guest-network-in-browser-through-a-relay/) で置き換え（2026-10-30）
- 決めた人：メンテナー。`jj git clone` のようなゲストが、リモートのリポジトリから取得できるようにするため
- 置き換えた決定：[0007](/formicarium/ja/development/decisions/0007-no-guest-network-in-browser/)

## 背景

[0007](/formicarium/ja/development/decisions/0007-no-guest-network-in-browser/) では、以前のコアが socket を
WebSocket で中継することしかできなかったため、ゲストに socket を渡しませんでした。そのため、`jj git clone`
（jj が `git` を起動し、`git` が `git-remote-https` を起動します）のように取得するツールは動きませんでした。
paludarium 0.6.0 は、Node.js で TCP の client を使えるようにしました。実行の選択肢 `network: { allow }` を渡すと、
ゲストは一覧にある行き先へ IPv4 か IPv6 でつなげます。名前は、組み込みの DNS の代わりが一覧にあるものだけを解決し、
DNS リバインディングを防ぐため、名前で届くのはグローバルなアドレスだけです（`localhost` はループバックにも届きます）。
ほかの行き先は `ENETUNREACH` で失敗し、選択肢がなければ、これまでどおり `socket()` は `EAFNOSUPPORT` を返します。
ブラウザのページには TCP の socket がないので、コアはブラウザではこの選択肢を断ります。

## 決定

- `RunOptions` は、省略できる `network: { allow: string[] }` を受け取ります。行き先は 256 個までで、
  host 名、`*.` とそのサブドメイン、IPv4 のアドレス、角かっこで囲んだ IPv6 のアドレスのどれかを、port（1〜65535）の有無を問わず書けます。
  角かっこのない IPv6 のアドレスは、すべての port を表します。
  Session は、コアが断る空のラベル、port 0、角かっこで囲んだ IPv4 も含めて形を確かめ（`INVALID_INPUT`）、
  一覧を写してコアに渡します。残りはコアが確かめます。
- `network` がなければ、実行はこれまでと同じです。ゲストにネットワークはなく、aube は `AUBE_NO_UPDATE_CHECK=1` のままで、
  native の基準値も `--network none` で作ります。
- `network` を付けたブラウザでの実行は、Worker を立てる前に `UNSUPPORTED_ENV` で失敗します。
- 開発用に、`runtime/node/run.js --allow-net <行き先>`（複数可）で同じ一覧を渡せます。
- probe に、名前を指定したときだけ動く項目 `tcp-echo <address:port>` を足します。Node.js の回帰テストは、
  手元の echo サーバーを相手に、許可した場合、許可していない場合、ネットワークなしの場合を確かめます。

## 結果

- Node.js では、呼び出し側が名前を挙げた行き先から、ホスト自身のネットワークでゲストが取得できます。TLS はゲストの中で行うので、
  ゲストには自分の CA 証明書（たとえば `/etc/ssl/certs/ca-certificates.crt`）が要ります。
- ネットワークを使う実行は、相手が変わりうるので、native の基準値とは比べません。
- ゲストは接続を待ち受けられず、名前の問い合わせ以外の UDP は使えません。
- command API は、`stdin` や `terminal` と同じく、`network` をゲストの実行にだけ渡します。

## 退けた案

- **すべての行き先を開ける**：ゲストは信頼できないコードなので、Deno の `--allow-net` と同じく、
  呼び出し側がつないでよい先を名前で挙げるべきです。
- **今すぐブラウザ用の WebSocket の中継を作る**：GitHub Pages の外にサーバーが要り、費用と悪用への対策も必要です。
  コアはホストのネットワークを差し替えられる形にしているので、後で同じ選択肢の裏に足せます。
