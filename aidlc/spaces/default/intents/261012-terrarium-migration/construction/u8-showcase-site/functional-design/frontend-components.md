# U8 showcase-site の画面の部品

## Sources

`functional-spec.md`・`rules.md`・`entities.md`（同じ dir）、`functional-design-questions.md`（Q2・Q4–Q7）、`../../../inception/units-generation/unit-of-work.md`（U8）、`../../../inception/requirements-analysis/requirements.md`（FR15・NFR6・NFR7）、`../../../inception/domain-design/components.md`（Showcase）、`../../../inception/contract-design/contract-summary.md`（C05・C11）、terrarium の `docs/src/pages/demos/{index,[tool]}.astro` と `packages/terrarium/src/terminal.ts`（読取り）。この資料は設計で、実装の主張ではない。

## 部品の階層

```text
Starlight の layout（en・ja、言語の切替え、検索）
+-- TopPage（/）
|     hero、短い説明、/tools/・/terminal/・guides への link
+-- ToolsPage（/tools/）
|     ToolCard x 3
+-- ToolPage（/tools/<tool>/）
|     StatusLine
|     TerminalHost（mode=preinstalled, tool）
|     OmittedNotice
|     HintList
+-- TerminalPage（/terminal/）
|     StatusLine
|     TerminalHost（mode=empty）
|     OmittedNotice
|     HintList（3ツールの install）
+-- Guide pages（Starlight の Markdown、6ページ）
```

端末の部品（TerminalHost・StatusLine・HintList）は、ToolPage と TerminalPage だけが読む。文書の page と ToolsPage は端末の部品・formicarium・coi-serviceworker を読まない（BR4.3）。

## ToolCard

| props | 型 | 出どころ |
|---|---|---|
| tool | `aube \| pitchfork \| biome` | manifest.resolvedTools |
| version | string | manifest.resolvedTools |
| label・summary | 現在の言語の文字列 | site の文言 file |
| href | string | 英語は `<base>/tools/<tool>/`、日本語は `<base>/ja/tools/<tool>/`（BR2.2） |

- 全体を1つの link にする（`<a>`）。focus のときに枠を示す（`:focus-visible`）。
- 版は文字で出す（例「Biome 2.x.y」）。色だけで状態を示さない。

## TerminalHost

| props | 型 | 説明 |
|---|---|---|
| mode | `empty \| preinstalled` | W4・W5 |
| tool | string（preinstalled のとき） | install する tool |
| fixture | string（preinstalled のとき） | `showcase/fixtures/<fixture>/app` |
| assets | 同じ origin の URL | `_formicarium/<version>/` の module と公開の Assets の4つの URL（loader・wasm・Worker・build-info）、catalog と fixture の index の URL と各 SHA256 |
| siteRoot | URL | catalog の entry の url を解決する基準（BR5.1） |
| strings | 現在の言語の文言 | prompt の前の案内、状態の文 |

内部の状態は `functional-spec.md` の TerminalSession の状態機械に従う。

- 表示：xterm.js（最新の安定版）と fit addon。容器の大きさに合わせる。`screenReaderMode` を有効にする（BR4.2）。
- 表示の buffer（BR3.8）：書いた bytes と行を数え、UTF-8 で 1048576 bytes か 10000 行の早く達する方を超えたら、先頭を UTF-8 の文字境界で捨てて残りで表示を作り直す。捨てた bytes 数と行数は OmittedNotice に出し、端末の中には書かない。CommandResult の原本の bytes は切り詰めない。
- prompt：`<cwd>$ `（cwd は Session の cwd）。
- 打鍵（BR3.4・BR3.5・BR4.2）：

| key | 入力中（ready・ready_failed_install） | 実行中・install 中（running・installing） |
|---|---|---|
| 文字 | 行に足す（65536 bytes まで） | 捨てる |
| Enter | 行を確定して実行。空行は何もしない | 捨てる |
| Backspace | 1文字を消す | 捨てる |
| ↑・↓ | page の中の履歴を辿る | 捨てる |
| Ctrl-C | 行を捨てて新しい prompt | AbortSignal で取り消す |
| Tab・Shift+Tab | 端末に渡さず、page の focus を移す | 同じ |
| その他の escape 列（←→ など、xterm の問合せへの応答を含む） | 無視する（行に入れない） | 捨てる |

isolating・loading・failed の間は、端末は打鍵を受け付けない。

- 貼付け：xterm の paste を1行ずつ扱い、改行は Enter と同じにしない（1つ目の行だけを入力に入れ、残りは捨てて文字で知らせる）。誤って複数の command を流さないため。
- 出力（BR3.6）：結果の kind ごとに1回だけ書く。guest は `onOutput` の chunk だけ（`result.stdout`・`stderr` は書かない）、builtin（ls・cat など）と install は `result.stdout`・`stderr`、empty は何も書かない。bytes は UTF-8 の stream decoder で decode する。結果の exit code は、0 でないときだけ1行で示す。OSC 8 の link は開かない。
- エラー：`ExecutionError` は `<code>: <message>` を1行で書く。message は文字として書き、ANSI の制御を足さない。
- dispose：どの状態でも `pagehide` で signal を abort し、CommandSession・Session・xterm を破棄する。`pageshow` の persisted のときは page を読み直す（BR3.7）。

## OmittedNotice

- 端末の外（端末の直下）の段落。BR3.8 で先頭を捨てたときだけ出し、「以前の出力を省略しました（<bytes> bytes、<lines> 行）」を `textContent` で書く。guest の出力には混ぜない。

## StatusLine

- `role="status"`、`aria-live="polite"` の段落。中身は `textContent` だけで書く。
- 表示する状態（BR4.1）：

| 状態 | 文（en の例） |
|---|---|
| isolating | Preparing cross-origin isolation… |
| isolating の失敗 | Cross-origin isolation is unavailable. Allow service workers for this site and reload. |
| loading | Loading formicarium… |
| installing | Installing <tool> <version>: <phase> <processed>/<total> bytes（total が分からないときは <processed> bytes, total unknown） |
| ready（preinstalled） | Ready: <tool> <version> |
| ready（empty） | Ready. No tool is installed yet. |
| running | Running… |
| 空の出力 | (no output) |
| failed | <code>: <message> |

ja は同じ内容を日本語で持つ。tool の名前・版・code・command は翻訳しない。

## HintList

- 案内の command の一覧（`<code>`）。preinstalled は文言 file の hints（例 `<tool> --version`、`ls`、`cat <file>`）、empty は `install aube`・`install pitchfork`・`install biome`。
- 押しても実行しない（説明だけ）。打つのは利用者。

## 言語（Q2=B）

- Starlight の i18n：既定の言語は英語（root）、日本語は `ja`。Astro の page（tools・tool・terminal）も `src/pages/[...lang]/` の形で両方を作る。
- 文言 file は en と ja の key が同じであることを build で確かめる（BR2.2）。
- 端末の中の guest の出力・prompt・command は言語によらず同じ。

## 画面幅と操作

- 390px 幅で横に scroll しない（terrarium の docs の試験と同じ条件）。端末の高さは 32rem を目安にし、狭い画面では縮める。
- 端末の page は keyboard だけで、link → 端末 → 次の link と移れる（Tab を端末に取られない）。
