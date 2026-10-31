# showcase

最新の安定版の aube・pitchfork・Biome・nano・jj・git を、formicarium の**公開 export だけ**で
受入し、showcase の候補（`ShowcaseCandidateManifest`、catalog、guest）を作る。
配布（Pages）は showcase site（`site/`、`showcase-site.yml`）が、この候補を受け取って
行う。showcase は候補を長期保存しない。

単体試験・境界の検査・`verify` の受入（3 ツール × Node・Chromium・Firefox・WebKit の
12 行）は CI で通っている（最初は run 39113037176、2026-10-20 の main `c9b37c4a` では
run 39412286499）。macOS の実機 Safari の 3 行も受入に加え（`accept-safari` job）、
15 行がそろわないと候補を作らない（15 行がそろった最初の main の run は 40151083995、
`82a01c27`、Safari 26.6.2）。WebKit の結果を Safari の代わりにはしない。
nano を加えて 4 ツール、jj を加えて 5 ツール、git を加えて 6 ツールになったので、今は 30 行
（6 ツール × 5 環境）がそろうまで候補を作らない。git と同じ build の git-remote-https は
companion なので、受入の行を持たない。

## 構成

```text
showcase/
├── package.json              # private。依存は持たず、本体は stage した pack を使う
├── tsconfig.json             # strict、erasableSyntaxOnly、noEmit（型検査だけ）
├── tools.json                # ツールの条件（repository・tag の形・資産・source build）
├── allowed-sources.json      # 受け付ける repository（main の定義だけを使う）
├── trusted-callers.json      # distribute を受け付ける showcase-site workflow と再利用元の workflow
├── formicarium-release.json  # distribute が使う npm の版（版・integrity・タグのコミット）
├── fixtures/                 # demo fixture（showcase site が使う。回帰用の fixtures/ とは別）
├── builders/cargo.sh         # cargo を絶対 path で呼ぶ builder
├── builders/autotools.sh     # GNU の tarball を musl-gcc で configure・make する builder
├── keys/                     # GNU の tarball の署名を確かめる、作者の公開鍵（package ごと）
├── scripts/                  # 解決・取得・build・再利用・catalog・pack・候補・受入・境界
└── tests/                    # node:test の単体試験、Playwright の受入、違反 fixture
```

script は TypeScript のまま Node の型の除去で動く（emit しない）。import は
`@aletheia-works/formicarium`・`/node`・`/browser` と Node の組込み（試験では
`@playwright/test` も）だけで、本体の内部・本体から showcase への依存・回帰用
fixture の共有は `scripts/boundary.ts` と Biome の `noRestrictedImports` で拒否する。

生成物は `showcase/.work/`（取得物・staging・site・受入 log・候補）と
`showcase/node_modules/`（SHA256 を確かめてから展開した本体の pack）に置き、
どちらも commit しない。

## 流れ

| 工程         | script                                                                     | 内容                                                                                                                                                         |
| ------------ | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| mode         | `scripts/mode.ts`                                                          | `verify`（既定）か `distribute`。`distribute` は main の showcase-site workflow（main への `push`・`workflow_dispatch`）からの呼出しだけ                     |
| 解決         | `scripts/resolve.ts`                                                       | `releases/latest`（draft・prerelease を除く）、annotated tag を辿った 40 桁の commit、資産の digest・size・URL、license。`resolutions.json` に 1 回だけ書く  |
| pack         | `scripts/pack.ts`                                                          | `verify`：同じ commit を本体の stager と `npm pack` で包む。`distribute`：`formicarium-release.json` の版を npm から取得し、integrity とタグのコミットを照合 |
| 取得         | `scripts/acquire.ts`                                                       | TransferPolicy の規則（HTTPS、credential なし、redirect 5 hop、120 s、128 MiB）で取得し、SHA256・size を照合、tar.gz を検査、公開 `validateGuest` で検証     |
| source build | `scripts/build.ts`、`builders/cargo.sh`、`builders/autotools.sh`           | `prepare`：tag と commit の一致、codeload の source、toolchain の選択、buildKey。`compile`：token なしの独立した process group で build                      |
| 再利用       | `scripts/reuse.ts`                                                         | main の信頼した workflow の成功 run の `showcase-candidate` から、buildKey・ELF・build-info を照合して再利用                                                 |
| catalog      | `scripts/catalog.ts`                                                       | `GuestCatalog`（same-origin の相対 URL）。公開 `createInstaller` で受理を確かめる                                                                            |
| 受入         | `scripts/accept-node.ts`、`tests/accept.spec.ts`、`tests/accept-safari.ts` | `install <tool>` と `<tool> --version`。6 ツール × Node・Chromium・Firefox・WebKit・実機 Safari の 30 行                                                     |
| 候補         | `scripts/candidate.ts`                                                     | 30 行がすべて合格したときだけ manifest を作る。`verify` は常に `distributable: false`                                                                        |

Node の受入では、git が job CA の HTTPS に `ls-remote` もする。`--version` は TLS と GMP の
code を通らないので、emulator が実行できない命令を含む guest（runner の CPU 向けの GMP）を
ここで捕まえる。

toolchain は upstream の宣言（`rust-toolchain.toml`・`rust-toolchain`、UI の
Node は `.node-version`・`mise.toml`・`.tool-versions` の正確な版）に従い、
なければ最新の安定版（Rust は `stable`、Node は実行中の Node）を使う。
upstream の contributor 向け wrapper は使わない。

## ローカルでの実行

すべて main session で 1 つずつ実行する。

```bash
SHOWCASE_SOURCE_COMMIT=<40 桁の commit> mise run showcase-stage
mise run showcase-typecheck
mise run showcase-unit
mise run showcase-boundary
```

受入はネットワークを使う。`resolve.ts` は `origin/main` の `allowed-sources.json`
を読むので、その file が main に入るまでは解決できない。

```bash
GITHUB_TOKEN=<読取りの token> node showcase/scripts/resolve.ts
node showcase/scripts/acquire.ts
node showcase/scripts/catalog.ts
mise run showcase-accept-node
mise run showcase-accept-browser   # SHOWCASE_TLS_* と、job CA を信頼した browser が要る
mise run showcase-accept-safari    # macOS。SHOWCASE_TLS_*、keychain で job CA を信頼した Safari、port 4444 の safaridriver が要る
```

`showcase-accept-node` は job 専用の CA を `showcase/.work/tls/` に作り、
`NODE_EXTRA_CA_CERTS` で子 process だけに信頼させ、終了時に消す。browser の
受入は TLS の検証を緩めない（`ignoreHTTPSErrors: false`、Safari では
`acceptInsecureCerts` を使わない）ため、CA を信頼した環境（CI の手順）でだけ動く。
Safari の job は macOS の System keychain に job CA を信頼させ、leaf が localhost で
信頼されることを確かめてから受入し、終了時に job CA を keychain から消す（管理者の
信頼設定の項目は、使い捨ての runner に残ることがある）。pitchfork は CI の Linux で build したものだけで
受入し、ローカル（macOS）では build しない。

## ツールの追加

1. upstream が公式の x86-64 static musl 資産を出しているかを確かめる。
2. `allowed-sources.json` に repository を加える PR を出し、main に入れる
   （許可一覧は main の定義だけが効く）。
3. `tools.json` に条件を加える。公式資産があれば `release-asset`
   （`asset` の名前、`format`、tar.gz なら `archiveEntry`）、なければ
   `source-build`（`builder: "cargo"`、`binary`）。GitHub ではなく GNU の tarball で
   公開されるものは `gnu-source`（`builder: "autotools"`、`package`、`tag`、`signers`、
   `spdx`、`configure`、`binary`、`output`、`libraries`）。script に分岐は書かない。
   ftp.gnu.org 以外の server で署名付きの tarball を出す package（git・curl・GnuTLS・
   zlib）や、license の file が `COPYING` でない package（GMP・nettle）は、ツールにも
   library にも `source` を書く：`listing`（tarball の file への link がある page。
   相対・絶対 path・絶対 URL のどれでもよく、署名は一覧に無くてよいが取得は必須）、
   `tarball`（`.../<package>-{version}.tar.gz` か `.tar.xz`。`.tar.xz` は system の
   `xz -dc` で展開し、出力の大きさと時間を `.tar.gz` と同じ上限で打ち切る）、
   `signature`（`{tarball}.asc` か完全な URL）、署名が圧縮前の tar に対するものなら
   `signedData: "tar"`、`license`（tarball の root からの path）。URL は https で、
   `{version}`・`{major}`・`{minor}`・`{patch}` だけを使える。`source` が無ければ
   今までどおり GNU の既定（ftp.gnu.org の一覧、`.sig`、`COPYING`）になる。
   license の file は `licenses/<package>-<file 名>` に置く。`spdx` は
   `LGPL-3.0-or-later OR GPL-2.0-or-later` のような `OR`・`AND` の式でもよい。
   tag が release の日付を含むとき（nettle の `nettle_{version}_release_{date}`）は
   `{date}` を1つ書く。GitHub の repository の tag から、8 桁の数字でその形に合う
   ただ1つの tag を選ぶ（0 個や2個以上なら止める）。
   例外として、tag の付いた公開 repository の無い library（GMP）は `repository` と `tag` を
   両方とも省き、ftp.gnu.org の署名付き tarball だけで識別する（commit は記録せず、build-info の
   dependencies ではなく builderHash と provenance の `signedOnly` に tarball の SHA256 を入れる）。program の
   `make` には `NAME=value` の make 変数を書ける（`{prefix}` を置き換える。
   `MAKEFLAGS` や `SHELL` のような make 自身を動かす変数は拒む）。同じ build から出る
   ほかの program は `companions`（`binary` と `output`）に書く。git の
   `git-remote-https` のように、それぞれ自分の名前の validated guest と catalog の
   entry（`companionOf` でツールを指す）になり、ツールを導入すると端末の page が
   何も出さずに一緒に導入する。`--version` の受入とツールの page は持たない。
   全画面で動くツールには `interactive: true` を足す。端末の page がキー入力と
   端末の大きさをそのツールに渡し、「停止」ボタンを出す。
   どの page でも使えるようにするツールには `everyPage: true` を足す。端末の page は、
   開いたときに公開の `createInstaller` でそのツールを導入し、端末には何も出さない。
   最初から入っているように見え、ほかのツールからも起動できる。失敗したときだけ、
   ツールの名前を付けて端末に出す。
   network を使うツールには `network: true` を足す（git と jj）。端末の page は、そのツールの
   実行の前にだけ relay の token 関数（`site/src/terminal/relay.ts`）から token を取り、
   `network: { allow: ['github.com:443'], relay }` を渡す。ほかのツールには network を渡さない。
   TLS の検証に使う CA の一覧は、resolve が `https://curl.se/ca/cacert.pem` を公開の
   `cacert.pem.sha256` と照合して取り（MPL-2.0、resolutions の `caBundle`）、候補が
   `site/ca/cacert.pem` に置き（manifest の `caBundle`、NOTICES）、端末の page が session を
   始めるときに SHA-256 を確かめて `/root/.config/ssl/cacert.pem` に書く。homeFiles はその path を使えない。
   ツールが設定ファイルを home から読むなら、`homeFiles` に home からの相対 path と
   中身（4096 bytes まで）を書く。端末の page は、どのツールの page でもそれを
   `/root` の下に置く（例：jj の pager を止める `.config/jj/config.toml`）。
4. `fixtures/` に demo fixture を加える。
5. `gnu-source` では、`ftp.gnu.org` の一覧の最も新しい版の `.sig` を
   `keys/<package>.gpg` で `gpgv` が確かめ、`signers` の主鍵の署名だけを受け入れる。
   鍵は作者が公開しているものを書き出し、fingerprint を確かめてから置く。nano の鍵は
   GNU の keyring から、ncurses の鍵は GNU の keyring の写しが期限切れなので作者の
   サイトの最新のものから取った（どちらも 2029 年に期限が切れるので、その前に入れ替える）。
   ツール自身の SPDX が GPL・LGPL のとき、ゲストの横の `sources/<tool>/` に、ツールと
   すべての library の tarball と署名を置き、対応する source とする（nano は ncurses も、
   git は curl・GnuTLS・nettle・GMP・zlib も置く）。
   `source` を持つ package では一覧から最も新しい版を選び、その署名の file を取って
   同じように確かめる。署名に複数の署名が入っているとき（GnuTLS は 2 つの鍵で署名する）は、
   すべてが良い署名で、すべての主鍵が `signers` にあるときだけ受け入れる。
   git（Junio C Hamano）・curl（Daniel Stenberg）・zlib（Mark Adler）の鍵は、公開されて
   いるものを最小に書き出して置いた。GnuTLS の 2 つの鍵（Zoltan Fridrich と
   Alexander Sosedkin）は gnutls.org の `gnutls-release-keyring.gpg` から、nettle の
   Niels Möller の鍵は、GNU の keyring の写しが 2023 年に期限切れなので、同じ
   fingerprint の keys.openpgp.org のものから取った（2030 年に期限が切れる）。
   git は GPL-2.0-only なので、TLS は GPLv2 と両立する GnuTLS（LGPL-2.1-or-later）と
   nettle（LGPL-3.0-or-later OR GPL-2.0-or-later）と GMP（同じ二重 license、`COPYINGv2`）で
   作る。GMP の鍵は nettle と同じ Niels Möller の鍵である。
   GnuTLS の libtasn1 と libunistring は同梱のものを使う。
   release の server（ftp.gnu.org、Savannah、kernel.org など）は CI の runner からの接続を
   ときどき落とすので、その取得と
   `git ls-remote` の通信の失敗だけは 10 秒・30 秒あけて 2 回までやり直す（GitHub API と、
   状態・大きさ・署名の誤りはやり直さない）。`git ls-remote` は取得と同じく 1 回ごとに 120 秒で打ち切る
   （git には期限がなく、TLS の握手で止まると job の時間を使い切る）。どの server も止まったまま
   答えなければ、やり直しと mirror の分だけ時間がかかり、resolve の job の 10 分で切れることがある。
   やり直しても届かない tarball の server は、`source` の `mirrors`（ftp.gnu.org の既定は
   mirrors.kernel.org と mirrors.dotsrc.org）を順に使い、その package の残りの取得もそこから
   始める。署名の照合は同じなので、どの server の tarball も固定した鍵で確かめる。状態・大きさ・
   一覧・署名の誤りでは mirror に移らない。mirror の一覧が遅れていれば、その一覧の最も新しい
   署名付きの版を使い、record にはその mirror の URL が残る。Savannah の `git ls-remote` は、
   git.savannah.gnu.org に届かなければ、その転送先の https.git.savannah.gnu.org に直接問い合わせる。

## mode と showcase site

`showcase.yml` は `pull_request`・`push`（main）・`workflow_dispatch`・
`workflow_call` で動く。main への push と PR のゲストの job は、`showcase/`（`showcase/site/` を
除く）・`runtime/`・`types/`・`package.json`・この workflow を変えたときだけ動く（PR では
`changes` job が決め、ほかの PR でも必須の check は報告する）。手動の実行と showcase site
からの呼び出しは常に build する。直接の実行には `mode` の入力がなく、常に `verify` になる。
`distribute` は、`trusted-callers.json` の `distributeCaller` が main への
`push` か main の `workflow_dispatch` で呼んだときだけ受け付ける（`schedule` は
拒否する。showcase site は日次の実行をやめた）。showcase site は `candidate`
job が成功し、出力 `distributable` が `true` のときだけ配布を始める。

PR の showcase site は、ふだんは main の `showcase.yml` が最後に作った verify の候補で
サイトを確かめる。PR が `tools.json` か `fixtures/` を変えると、その候補は PR の
fixture と合わない。そのため、その PR では `pr-candidate` job が `showcase.yml` を
`mode: verify` で呼び、その PR 自身の候補からサイトを作る（配布はしない）。このとき
PR 自身の `showcase.yml` の run と合わせて受入を 2 回動かす。呼ばれた run は呼び出し元の
workflow の名前で concurrency の group を分けるので、互いを取り消さない。

## npm で公開された版

`distribute` は `formicarium-release.json` が指す npm の版
（`@aletheia-works/formicarium`）を使う。取得した tarball の sha512 が固定した
`integrity` と npm の `dist.integrity` に一致し、tarball が `registry.npmjs.org` にあり、
tag `v<version>` のコミットが `sourceCommit` に一致したときだけ使う。版が `null` のときは、
`distribute` は `release-unavailable` で失敗する。
1. 安定版の publish（`publish.yml`）が成功すると、`showcase-release-pin.yml` が
   `scripts/pin-release.ts` でその版を確かめ（`distribute` と同じ取得と照合）、
   `formicarium-release.json` を書き換える PR を bot で作る。版は安定版だけである（RC は出さない）。
2. その PR を main に入れると、`showcase-site.yml` がその版で受け入れてから配布する。
3. 手で固定するときは `node showcase/scripts/pin-release.ts <version>` か、版を指定した
   `showcase-release-pin.yml` の手動の実行。

## 配布の契機

showcase site は日次の実行をやめ、main への push が `showcase/site/`・`showcase/scripts/`・
`showcase/tests/webdriver.ts`・`showcase/formicarium-release.json`・`showcase-site.yml` を
変えたときと、main からの手動の実行で配布する。ゲストの新しい候補（新しい release の取込み）は自動では配布されないので、
人間が main から showcase-site の workflow を手動で実行する。各 run の `candidate` job の
summary には「最後に配布可能な候補を作った run からの日数」が出る。`showcase-site.yml` の
`summary` job は、最後に deploy した run からの日数と、失敗した job を書く。

## 切り戻し（Rollback）

- showcase の変更：PR を revert する。
- 前の候補に戻す：候補は長期保存せず、配布（`mode: distribute`）は main の head からしか
  動かないので、戻したい変更を main で revert し、showcase-site を動かし直す
  （`showcase.yml` を直接動かすと `verify` になり、配布できる候補にならない）。
- formicarium の版：`formicarium-release.json` を前の版に戻す PR（`pin-release.ts` で作り直す）。
- repository の設定：`infra/github/README.md` の手順。

## 未検証のこと

- iOS の Safari（showcase の受入。ブラウザの probe と install・command の確認は iOS 26 の Simulator で動かしている。iOS 27 は safaridriver が接続できず未実行）。
- `accept-safari` job が keychain に job CA を信頼させる手順は、GitHub の macOS runner でだけ
  動かす。手元の Mac の信頼設定は変えないので、ローカルで Safari の受入を動かすには、
  その Mac で job CA を信頼させる必要がある。
- 単体試験は showcase の script 全体の行 coverage 80% 以上を満たすが、`accept-node.ts`
  （子 process での受入）と `tls.ts`（job 専用の CA）の多くの経路は単体試験では通らず、
  CI の受入 job でだけ守られる。受入が壊れたときは、ここが局所的な回帰の検出の弱い所である。

確かめたこと：2026-10-20 の main `c9b37c4a` の候補 artifact（run 39412286499）で、
`manifest.json` の 13 個の資産の SHA256 と大きさ、受入 log と catalog の SHA256、
candidateId の再計算がすべて一致し、3 ツールの build-info、`NOTICES.md` と 5 個の
license があった。

`distribute` の実行：2026-10-20 の main `94970a9e` の push で、
`showcase-site.yml` の run 39422079965 が `showcase.yml` を `mode: distribute` で呼び、
当時の `b1-pack.json` の Release の pack（`a3370ca4…`。今は npm の版に置き換えた）で候補を作り、その候補で site の
配布まで成功した。「配布の契機」の節の candidate job の summary の日数は、
`showcase/tests/candidate.test.ts` の `days since the last distributable run, and the
job summary line` が根拠である（run の summary の値は確かめていない）。
