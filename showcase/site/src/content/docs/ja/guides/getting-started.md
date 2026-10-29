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

shell はありません。pipe・redirect・`$` の展開・glob は `INVALID_INPUT` で拒否
されます。1行は 65536 bytes までです。↑・↓ でこの page の中の履歴を辿り、
Ctrl-L で入力中の行を残したまま画面を消し、Ctrl-C で実行中の command や導入を
取り消します（下の対話的なツールは除きます）。Tab と Shift+Tab は端末の外へ focus を移します。

catalog で対話的と決めたツールは、動いている間キーボードを受け取ります。
Enter や Ctrl-C を含むすべてのキーがツールに渡り、ツールからは、起動したときの
page の端末の大きさの端末に見えます（後で大きさが変わっても追わない）。端末の下の「停止」ボタンで実行を終わらせます
（`ABORTED`）。

## 制限

- 何も保存しません。再読み込みや page の移動で session を捨てます。
- guest は network に接続できず、package の lifecycle の script は動きません。
- とても長い出力は画面の上で切り詰めます（1 MiB か 10000 行）。端末の下の
  通知が、省略した量を示します。

## ブラウザの条件

端末には secure context、`SharedArrayBuffer`、クロスオリジン分離が必要です。
GitHub Pages は COOP・COEP の header を送れないので、service worker
（`coi-serviceworker.js`）がそれを付け、端末の page を1回だけ読み直します。
ブラウザが service worker を止めている場合は、このサイトで許可して再読み込み
してください。文書の page とツールの一覧の page は、端末も guest も読み込み
ません。
