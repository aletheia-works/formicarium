---

title: source build
description: showcase が guest を選び、取得し、build する方法。
---

showcase のツールは
[`showcase/tools.json`](https://github.com/aletheia-works/formicarium/blob/main/showcase/tools.json)
で定義します。`showcase.yml` の run は、各ツールの最新の安定版（GitHub の latest release で、tag が
ツールの形に合うもの。source build では一覧の中で最も新しい署名付きの tarball）を1回だけ解決し、その tag と完全な commit を run の最後まで使います。
- **release の資産。** aube・Biome・jj は static な x86-64 musl の binary を公開して
  います。showcase は release の資産を取得し、公開された SHA256 と大きさを確かめ、
  公開の `validateGuest` で ELF を検証します。
- **source build。** pitchfork には musl の資産が無いので、showcase は tag の
  source を Cargo で `x86_64-unknown-linux-musl` 向けに compile します。build の
  工程には network の token を渡しません。
- **署名された GNU の tarball。** nano は GitHub ではなく GNU の tarball で公開されて
  います。showcase は `ftp.gnu.org` の一覧から最も新しい版を選び、`showcase/keys/` に
  置いた作者の鍵で、`gpgv` を使って署名を確かめます。ncurses も同じです。source は、
  nano の Savannah の repository と ncurses の snapshot の repository にある tag の
  commit で識別します。どちらも musl-gcc で static な library と program に build し、
  署名された tarball を、対応する source としてゲストの横の `sources/` に置きます。
- **ほかの server の署名された tarball。** git も同じように、kernel.org の tarball と、
  それぞれの release の server にある zlib・GMP・nettle・GnuTLS・curl から build します。
  GnuTLS と nettle を使うので、link するものはすべて git の GPL-2.0-only と両立します。
  このような package では、`source` に一覧・tarball（`.tar.gz`、または GnuTLS が出す
  `.tar.xz`）・署名（git は圧縮前の tar に、ほかは archive に署名します）と license の
  file を書きます。例外は nettle が使う GMP で、tag の付いた公開 repository が無いので、
  ftp.gnu.org の署名付き tarball だけで識別し、commit は記録しません。nano と同じく、ゲストとすべての library の署名された tarball を
  `sources/` に置きます。同じ build から出る
  `git-remote-https` は独立したゲストで、どの page も git と一緒に何も出さずに導入する
  ので、jj からも git を動かせます。

やり直しても届かない release の server は、`source` が挙げる mirror に替えます（ftp.gnu.org は
mirrors.kernel.org と mirrors.dotsrc.org、GnuTLS は gnupg.org の 2 つの mirror）。その package の
残りのファイルは、答えた mirror から取ります。tarball がどこから来ても、同じ固定した鍵で署名を
確かめます。答え・大きさ・署名の誤りでは mirror に移りません。mirror の一覧が遅れていれば、
その一覧の最も新しい署名付きの版を使います。Savannah の tag の問い合わせも、git.savannah.gnu.org に
届かなければ、その転送先の https.git.savannah.gnu.org に直接問い合わせます。

source の build（pitchfork、nano、`git-remote-https` を含む git）はどれも、以前の信頼できる
main の run に同じ `buildKey` の build があれば、compile せずに再利用します。

その後、run は catalog を書き、Node・Chromium・Firefox・WebKit・macOS の実機の Safari で
公開 API を通して各ツールを導入して `--version` を実行し、30件の確認がすべて通ったときだけ候補を
作ります。このサイトはその候補から作り、`latest` を解決し直しません。

ツールを足すには、`tools.json` の entry、`showcase/fixtures/<名前>/app` の demo の
fixture、カードの文言、formicarium が対応する system call が要ります。受入に
通らないツールは配布しません。
