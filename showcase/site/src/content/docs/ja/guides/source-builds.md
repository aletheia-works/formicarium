---

title: source build
description: showcase が guest を選び、取得し、build する方法。
---

showcase のツールは
[`showcase/tools.json`](https://github.com/aletheia-works/formicarium/blob/main/showcase/tools.json)
で定義します。`showcase.yml` の run は、各ツールの repository の tag の形から最新の
安定版を1回だけ解決し、その tag と完全な commit を run の最後まで使います。
- **release の資産。** aube と Biome は static な x86-64 musl の binary を公開して
  います。showcase は release の資産を取得し、公開された SHA256 と大きさを確かめ、
  公開の `validateGuest` で ELF を検証します。
- **source build。** pitchfork には musl の資産が無いので、showcase は tag の
  source を Cargo で `x86_64-unknown-linux-musl` 向けに compile します。build の
  工程には network の token を渡しません。以前の信頼できる main の run に同じ
  `buildKey` の build があれば、compile せずに再利用します。
- **署名された GNU の tarball。** nano は GitHub ではなく GNU の tarball で公開されて
  います。showcase は `ftp.gnu.org` の一覧から最も新しい版を選び、`showcase/keys/` に
  置いた作者の鍵で、`gpgv` を使って署名を確かめます。ncurses も同じです。source は、
  nano の Savannah の repository と ncurses の snapshot の repository にある tag の
  commit で識別します。どちらも musl-gcc で static な library と program に build し、
  署名された tarball を、対応する source としてゲストの横の `sources/` に置きます。

その後、run は catalog を書き、Node・Chromium・Firefox・WebKit・macOS の実機の Safari で
公開 API を通して各ツールを導入して `--version` を実行し、20件の確認がすべて通ったときだけ候補を
作ります。このサイトはその候補から作り、`latest` を解決し直しません。

ツールを足すには、`tools.json` の entry、`showcase/fixtures/<名前>/app` の demo の
fixture、カードの文言、formicarium が対応する system call が要ります。受入に
通らないツールは配布しません。
