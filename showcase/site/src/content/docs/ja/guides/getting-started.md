---

title: はじめに
description: formicarium の showcase の端末の使い方と制限。
---

[ツール](/formicarium/ja/tools/)の page でツールを選びます。ツールの page は端末を
開き、小さな試しの project を `/work/app` に置き、prompt が出る前にツールを導入
します。端末の上の状態欄が、いま何をしているか（分離の準備・読込み・導入中・
準備完了・実行中・エラー）を文字で示します。

[空の端末](/formicarium/ja/terminal/)は nano と git だけを導入した状態で始まります。
`install aube`・`install pitchfork`・`install biome`・`install nano`・`install jj`・`install git` を打ってから、たとえば
`biome --version` を実行します。

## command

- `ls [path]`・`cat path`・`cd path`・`rm -rf path`・`cp [-r] src dst`・`mv src dst` は組込みです。
- `clear` は page の中で端末と scrollback を消します。command は実行しません。
- `install <tool>` は showcase の catalog のツールを導入します。導入できるのは
  ツールの page にある受入済みの版だけです。
- それ以外の最初の語は、その名前の導入済みのツールを実行します。
- catalog がすべての page に入れると決めたツール（nano）は、どの端末の page でも
  開いたときに端末に何も出さずに導入するので、最初から入っていて、ほかのツール
  からも開けます。`-m` を付けない
  `jj describe` は、nano を開いて説明を編集させます。
- git と jj は github.com から clone できます：
  `git clone https://github.com/<owner>/<repo>` か
  `jj git clone https://github.com/<owner>/<repo>`。[network](#network) を見てください。

shell はありません。pipe・redirect・`$` の展開・glob は `INVALID_INPUT` で拒否
されます。1行は 65536 bytes までです。↑・↓ でこの page の中の履歴を辿り、
Ctrl-L で入力中の行を残したまま画面を消し、Ctrl-C で実行中の command や導入を
取り消します（下の対話的なツールは除きます）。Tab と Shift+Tab は端末の外へ focus を移します。

catalog で対話的と決めたツールは、動いている間キーボードを受け取ります。
Enter や Ctrl-C を含むすべてのキーがツールに渡り、ツールからは、起動したときの
page の端末の大きさの端末に見えます（後で大きさが変わっても追わない）。端末の下の「停止」ボタンで実行を終わらせます
（`ABORTED`）。

## network

network を使えるのは git と jj だけで、行き先は `github.com:443` だけです。ブラウザの page には
TCP のソケットがないので、接続は Aletheia Works が AWS で動かす relay（AWS Lambda MicroVMs の上の
WebSocket の relay）を通ります。最初の git か jj の command の前に、page は relay の token 関数に
15 分使える token を求め、切れる 1 分前まで使い回します。token 関数は `Origin` がこのサイトの要求にだけ
答え、relay 自身も github.com:443 にだけ接続します。TLS はゲストの中で動くので、relay に見えるのは
暗号化された bytes だけです。ゲストは github.com の証明書を、curl が取り出した Mozilla の CA 証明書で
確かめます。page は session を始めるときに、それを `/root/.config/ssl/cacert.pem` に置きます。relay に
届かないときは、そう示してから network なしで実行します。手元の作業（`jj log`、`git status`）は
続けられ、clone と fetch は失敗します。もう一度打つと再試行します。page には
認証情報がないので、`git push` と `jj git push` はできません。

## 制限

- 何も保存しません。再読み込みや page の移動で session を捨てます。
- ほかのツールは network に接続できず、package の lifecycle の script は動きません。
- とても長い出力は画面の上で切り詰めます（1 MiB か 10000 行）。端末の下の
  通知が、省略した量を示します。

## ブラウザの条件

端末には secure context、`SharedArrayBuffer`、クロスオリジン分離が必要です。
GitHub Pages は COOP・COEP の header を送れないので、service worker
（`coi-serviceworker.js`）がそれを付け、端末の page を1回だけ読み直します。
ブラウザが service worker を止めている場合は、このサイトで許可して再読み込み
してください。文書の page とツールの一覧の page は、端末も guest も読み込み
ません。
