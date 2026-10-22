# U8 showcase-site Functional Design の質問

## 前提（読取り調査、2026-10-19）

- 要件 FR15：Astro/Starlight のカードとデモを `showcase/site` へ移す。トップはエミュレータの説明、一覧は `/tools/`、空の端末から install して3ツールを実行できる。個別ページは事前導入を許す。日次 build と受入の後の Pages の配布を行い、失敗した候補は配布せず前回のサイトを保つ（`../../../inception/requirements-analysis/requirements.md`）。
- U7 が渡すもの（検証済み、formicarium の `showcase/` と U7 の記録の読取り）：候補の Actions artifact `showcase-candidate`（`manifest.json`、`site/catalog.json`、`site/guests/<tool>/<version>/` の ELF と build-info、受入 log、license と notices）。`showcase.yml` の `workflow_call` の出力 `candidate-id` と `distributable`。`distribute` を受け付ける呼出し元は `.github/workflows/showcase-site.yml`（`showcase/trusted-callers.json`）で、U8 はこの workflow を作る。U8 は latest を解決し直さない（C09）。
- terrarium の今のサイト（検証済み、terrarium の upstream main `2caa5706` の読取り）：Astro 7.3.8 と Starlight 0.42.6、`base: /terrarium`、英語だけ。トップ（hero と短い説明）、`/demos/`（`web/tools.json` から作るカード）、`/demos/<tool>/`（事前導入した project の個別端末）、`/web/`（tool を選べる端末）、guides 6ページ（getting-started・embedding・source-builds・releases・architecture・maintenance）。端末は `<terrarium-terminal>`（xterm.js 6 と fit addon）。Pages は `pages.yml` が毎日 03:17 UTC と手動で build し、guest の受入が成功したときだけ deploy する。
- formicarium にはまだ GitHub Pages が無い（`gh api repos/aletheia-works/formicarium/pages` が 404）。Pages は HTTP の header を付けられないので、U7 の受入 server が header で付けている COOP・COEP・CSP は、site では coi-serviceworker と meta の CSP で置き換える必要がある（推測。U6 の vivarium と同じ方式）。
- 範囲外（要件の「対象外」）：デモの追加、showcase の独立化。

## 質問

## Q1. [プロダクト] サイトを配布する場所

formicarium にはまだ Pages が無いため、新しいサイトの URL を決める必要がある。Pages の有効化は repository の設定の変更なので、具体の内容を示して承認を受けてから行う（後の工程）。

A. formicarium の GitHub Pages を新しく使う（`https://aletheia-works.github.io/formicarium/`、Astro の `base: /formicarium`）。terrarium の Pages は退役（U9）まで今のまま残り、U9 で新しい URL への案内に変える。
B. 退役までは terrarium の Pages の URL（`/terrarium/`）を使い続け、formicarium の repository から terrarium の Pages へ配布する。
C. 独自の domain を使う（DNS の設定と費用の相談が要る）。
X. Other (please specify)

[Answer]: A. formicarium の GitHub Pages を新しく使う（人間の回答、Guide me）

## Q2. [プロダクト] サイトの言語

terrarium のサイトは英語だけ。vivarium は英語と日本語の両方を持つ。

A. 英語だけ（terrarium と同じ）。
B. 英語と日本語（ページと端末の案内文を2言語で持つ。翻訳の維持が増える）。
X. Other (please specify)

[Answer]: B. 英語と日本語（人間の回答、Guide me）

## Q3. [プロダクト] 移すページの範囲

terrarium には、デモの他に guides が6ページある。そのうち embedding・source-builds・releases・architecture・maintenance は terrarium の package・CI の説明で、移管後は formicarium の README・docs や U7 の `showcase/README.md` と重なる。

A. デモだけを移す：トップ（formicarium のエミュレータの説明）・`/tools/`（カード一覧）・ツールごとの個別ページ・空の端末のページ。guides は移さず、トップから formicarium の README と npm の package へリンクする。
B. A に加えて、getting-started を formicarium の公開 API（`createSession`・`createCommandSession`）の使い方として書き直して載せる。
C. A に加えて、guides を全部、formicarium 向けに書き直して載せる。
X. Other (please specify)

[Answer]: C. A に加えて、guides を全部、formicarium 向けに書き直して載せる（人間の回答、Guide me）

## Q4. [プロダクト] 空の端末を置くページ

要件は「空の端末から install して3ツールを実行できる」こと。terrarium では `/web/` が tool を選べる端末だった。

A. 空の端末を専用のページ（例 `/terminal/`）に置き、トップと `/tools/` からリンクする。wasm と guest の読込みは、端末のページを開いたときだけ起きる。
B. `/tools/` のカード一覧の下に空の端末を置く（一覧を開くと端末も読み込まれる）。
C. トップに空の端末を置く。
X. Other (please specify)

[Answer]: A. 空の端末を専用のページに置く（人間の回答、Guide me）

## Q5. [プロダクト] ツールの個別ページの始まり方

要件は「個別ページは事前導入を許す」。terrarium の個別ページは、開くとツールが導入済みで、demo の project（fixture）が置かれた状態から始まる。

A. 開くと自動でそのツールを install し、demo の fixture（U7 の `showcase/fixtures/<tool の fixture>`）を置いた状態で始める（terrarium と同じ）。進み具合と失敗は文字で示す。
B. 開くと fixture だけを置き、`install <tool>` は利用者が打つ（案内文で示す）。
X. Other (please specify)

[Answer]: A. 開くと自動でそのツールを install し、demo の fixture を置いた状態で始める（人間の回答、Guide me）

## Q6. [開発者] 端末の表示の部品

terrarium の端末は xterm.js（ANSI の色・カーソル・幅の自動調整）を使う。U6 の vivarium の端末は xterm を使わず、文字だけ（`textContent`）で表示する。どちらでも、guest の出力を HTML として解釈しない。

A. xterm.js（最新の安定版）を使う。terrarium と同じ見た目と操作で、Biome の色付きの出力もそのまま表示できる。showcase/site の依存に xterm が加わる。
B. 文字だけの簡単な端末にする（U6 と同じ方式。ANSI の制御は除いて表示する）。依存は増えないが、色とカーソルの操作は無い。
X. Other (please specify)

[Answer]: A. xterm.js（最新の安定版）を使う（人間の回答、Guide me）

## Q7. [プロダクト] embedding の guide の中身（Q3 の追いの質問）

Q3 で guides を全部 formicarium 向けに書き直すことになった。terrarium の embedding の guide は、`<terrarium-terminal>` 要素（npm・JSR の `@aletheia-works/terrarium`）と iframe での埋込みの説明である。formicarium には端末の要素が無く、公開しているのは `createSession`・`createCommandSession` などの API だけである。

A. formicarium の公開 API（`@aletheia-works/formicarium/browser` の `createSession` と `createCommandSession`）を自分のページに組み込む手順として書き直す。同じ origin の Worker・wasm の置き方と、COI の付け方を含める。端末の要素と iframe は扱わない。
B. showcase/site の端末の部品を新しい npm package として公開し、要素で埋め込めるようにする（新しい公開物で、範囲が広がる）。
X. Other (please specify)

[Answer]: A. formicarium の公開 API を自分のページに組み込む手順として書き直す（人間の回答、Guide me）
