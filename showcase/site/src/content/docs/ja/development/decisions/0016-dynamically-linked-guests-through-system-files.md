---

title: '0016. Session のシステムファイルで、動的リンクのゲストを動かす'
description: Session は、動的リンカのような、root の外に置くシステムファイルを受け取る。これで Session.run が動的リンクのゲストを起動できる。導入するゲストは static のまま。
---

- 状態：採用（2026-11-12）
- 決めた人：メンテナー。ふつうの動的リンクの Linux のプログラムを、static な実行ファイルに作り直さずに動かせるようにするため

## 背景

最初の npm の版（2026-10-08、blink のコア）から、ランタイムは PT_INTERP のプログラムヘッダで動的リンカを指定する ELF を
すべて断ってきました（`dynamic ELF interpreter is unsupported`）。理由を書いた記録はありません。以前のコアはそのようなプログラムを
起動できず、ドキュメントも formicarium を static な実行ファイルだけを動かすものとして説明していました。

paludarium 0.12.0 は、Linux と同じく、プログラムを PT_INTERP の動的リンカから起動します（paludarium #320）。glibc が動くように、
CPUID で AMD を名乗ります（#322）。paludarium 0.14.0 では、`dlopen` と libm を使う動的リンクの musl のプログラムと glibc 2.41 のプログラム、
それに Debian の `ls` と `sort` が、動的リンカとライブラリをゲストのファイルシステムに置くと Node.js で動きました。

formicarium で止めていたのは 2 つです。PT_INTERP を断る検査と、Session の `entries` を `cwd` か `home`（永続化の root）の中に
限っていることです。動的リンカは `/lib/ld-musl-x86_64.so.1` や `/lib64/ld-linux-x86-64.so.2` のような決まったパスで探されます。
導入したゲストには、すでに root の外の置き場所があります。実行のたびに `/usr/bin` に置き直し、スナップショットには含めません。

## 決定

- `SessionOptions` は `systemEntries` を受け取ります。`entries` と同じ形（ディレクトリ、ファイル、symlink）のエントリで、
  実行のたびに root の外に置きます。Session は一度だけ確かめて写します。Session が終わるまで、`reset()` の後も渡されたとおりに残り、
  スナップショットには含めず、`readFile`・`listEntries`・`remove` からは見えません。ゲストが変えても、その実行の間だけです。
  CommandSession は、導入したゲストも含め、すべてのゲストの実行に元の Session のシステムファイルを使います。
- システムのエントリは、`cwd`、`home`、`/guest`、`/dev`、`/proc`、`/tmp`、`/usr/bin` の中に置けません。
  それらを中に持てるのはディレクトリだけです。これで、`/usr/bin` を導入したゲストのものにしたまま、`/usr/lib` を渡せます。
  symlink の先は、`cwd` と `home` の中にも、その上のディレクトリ（`/` など）にも向けられません。これで、この層と Session 自身のファイルが混ざりません。`/bin -> usr/bin` のように、
  `/usr/bin` には向けられます。上限は 4096 エントリと、ファイルの中身で 256 MiB です。足りない親ディレクトリは補います。
  違反は `INVALID_INPUT` です。
- `Session.run` は、PT_INTERP のヘッダを持つゲストを受け取ります。ヘッダは、NUL で終わる 4096 バイト以下の絶対パス 1 つでなければなりません。
  Session は実行の前に、そのパスを、実行で置くファイル（システムのエントリ、Session のエントリ、導入したゲスト）の中で symlink も含めてたどります。
  動的リンカがファイルとして見つからなければ、実行は `INVALID_INPUT`（`ELF interpreter <path> is not in the session`）で失敗し、
  Worker は起動しません。
- 導入するゲストは static のままです。カタログのビルド情報は static な musl の target を指定するので、`validateGuest` は
  これまでどおり PT_INTERP のヘッダを断ります。
- probe のビルドに、`hello` と同じ出力をする libc だけの C のプログラム `hello-dynamic` と、それが使う musl の動的リンカを加えます。
  Node.js の回帰テスト（`tests/node/dynamic-guests.test.ts`）、Chromium・Firefox・WebKit のブラウザの probe と、実機の Safari の probe で、
  動的リンカを `systemEntries` に置いて実行します。

## 結果

- 呼び出し側は、動的リンカと共有ライブラリを渡せば、動的リンクのプログラムを動かせます。たとえば、そのプログラムをビルドした
  ディストリビューションのものです。formicarium はどちらも同梱しないので、パッケージの大きさとライセンスは変わりません。
- 同じ層には、ゲストが home の外の決まったパスで探すほかのファイルも置けます。たとえば
  [0014](/formicarium/ja/development/decisions/0014-guest-tcp-clients-in-nodejs/) の TLS のための、`/etc/ssl/certs` の CA 証明書です。
  showcase の端末の page は、こうして CA の一覧をそこに置きます。
- 実行のたびに、Session のファイルと同じく、システムファイルを Worker に送ります。ライブラリが多いと、そのぶん実行の開始が遅くなります。
- ほかのプログラムを起動する（`execve`）プログラムでは、その動的リンカはコアが探します。Session が確かめるのは、起動するゲストだけです。

## 退けた案

- **formicarium に動的リンカや C のライブラリを同梱する**：glibc は LGPL なので義務が増えます。どちらでも、多くが static なゲストを
  動かすすべての呼び出し側で、パッケージが大きくなります。
- **ライブラリを含めて導入するゲスト**：カタログと導入の形式が、ELF 1 つから、それぞれに digest を持つ複数のファイルに変わります。
  同じ層の上に、後から足せます。
- **`entries` を root の外にも置けるようにする**：Session のファイルと、呼び出し側が残すつもりのないファイルが混ざり、
  スナップショット、`reset()`、ファイルの API でそれらを区別しなければならなくなります。
- **事前の確認をせずに PT_INTERP をコアに渡す**：コアは `invalid-program` で失敗し、`EXECUTION` として返るので、
  どのファイルが足りないのかがわかりません。
