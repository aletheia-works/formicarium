---

title: '0013. 対話的なゲストの実行'
description: 実行中のゲストに stdin を流し、端末を見せる。既定の timeout は持たない。
---

- 状態：採用（2026-10-26）
- 決めた人：メンテナ（showcase の端末で nano を動かすため）

## 背景

コマンドの合間にファイルを編集するには、nano のような全画面のエディタが要ります。これまでの実行は、ゲストの stdin を
すぐに閉じ、端末も見せなかったので、一括で動くプログラムしか動かせませんでした。paludarium は、ゲストの stdin の
stream と端末の大きさ（`tty: { columns, rows }`）を受け付けます。これを渡すとゲストからは端末に見え（`isatty`・`TCGETS`・
`TIOCGWINSZ`）、コアには行の区切りの処理がないので、キーは送ったバイトのまま届きます。raw mode への切り替え（`TCSETS`）は
`ENOTTY` で失敗しますが、nano はそれでも動きます。paludarium 0.4.0 は stdin を `poll` と `select` で常に読めると
報告していたので、キーが届いている間 nano は画面を描き直せませんでした。0.5.0 は、入力があるときか終わりに達したときだけ
読めると報告します。コアに残る制限は 1 つで、ゲストが始まった後に端末の大きさは変えられません。

## 決定

- `RunOptions` と `CommandOptions` に、省略できる `stdin: ReadableStream<Uint8Array>` と `terminal: { columns, rows }`
  （1〜65535）を足します。どちらもなければ、実行は今までどおりです。command API は、ゲストの実行にだけ渡します。
- Session は、実行の間 `stdin` を読み、1 回 64 KiB までの `input` メッセージで実行の Worker に送り、最後に `input-end`
  を送ります。stream がエラーになったときも同じく入力を終えます。`Uint8Array` でない chunk は、実行を `INVALID_INPUT`
  で終えます。実行が終わると stream を cancel します。コアが始まる前に届いた入力は、Worker がためておきます。
  Worker との通信の版は 2 にします。
- `stdin` を渡した実行には、既定の timeout がありません。対話的なゲストは使う人を待つからです。`timeoutMs` と
  `signal` は今までどおり効きます。ほかの実行の既定は 600000 ms のままです。
- 実行ごとに新しいコアを使い、成功したときだけファイルを取り込むのは変わりません
  （[0008](/formicarium/ja/development/decisions/0008-fresh-instance-per-step/)）。エディタで保存したファイルは、
  ほかのコマンドの出力と同じように残ります。

## 結果

- showcase の端末は、キーをゲストに渡し、ゲストを自分の操作で止められます。Ctrl-C はエディタのものだからです。
- 端末の大きさは、1 回の実行の間は変わりません。
- nano には、stdin の読める状態を正しく報告する paludarium 0.5.0 以降が要ります。ランタイムそのものは `ttyecho`
  ゲストで確かめます。

## 退けた案

- **writer を返す callback**：`ReadableStream` は Node.js 24 とブラウザの標準で、`pipeTo` と組み合わせられ、
  終わりと cancel が決まっています。
- **対話的な実行も既定 600000 ms のままにする**：編集はもっと長く続くことがあり、止めるには呼ぶ側の `signal` があります。
