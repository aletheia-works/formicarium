# U6 recipe-runtime の画面部品

## Sources

`functional-spec.md`、`rules.md`、vivarium の `src/layer1_wasm/_shared/page.terminal.template.html`（2端末の template）、`_shared/verdict.ts`、`_shared/terrarium_loader.ts`（置き換える対象）、旧 biome-12265 の `repro.ts`（`04a8724^`）。設計で、実装の主張ではない。

## 部品の構成

```text
RecipePage（page.terminal.template.html。en と ja）
├── VerdictBadge        #verdict（pending / reproduced / unreproduced、verdict.ts の setVerdict）
├── RecipeMeta          #meta（recipe の固定入力：tool・repository・commit の短縮・ref）
├── BaselinePane        #output-baseline（slot baseline-heading）
│   └── FormicariumTerminal（role=baseline）
├── FixPane             #output-fix[data-fix-status=ok|error]（slot fix-heading）
│   └── FormicariumTerminal（role=fix）
└── Drawer              slot drawer-body（説明）、runtime-label（"formicarium <版>"）
```

`repro.ts`（recipe ごと）が、2つの FormicariumTerminal を作り、W4 の手順を動かして verdict と Result v1 を set する。

## FormicariumTerminal（terrarium_loader を置き換える共有部品）

置き場所は `src/layer1_wasm/_shared/`（新しい file。名前は code generation で決める）。terrarium_loader と同じく、page から使う関数1つと、端末の要素1つを提供する。

| 項目 | 内容 |
|---|---|
| 入力（属性・引数） | role、guest（RecipeGuest の tool・repository・commit・versionOrName・elfSha256・buildInfoSha256）、同じ origin の ELF・build-info の path、fixture（files と cwd）、formicarium の module の base path |
| 公開する property | `ready: Promise<ReadyDetail>`、`transcript: string`、`run(command): Promise<ExitDetail>` だけ（BR3.6） |
| 内部の状態 | connecting / booting / ready / running / failed / disconnected（`functional-spec.md` の state machine） |
| 表示 | 入力行と出力を文字として表示する。guest の出力や metadata を HTML として解釈しない（BR7.1）。表示 buffer は 1MiB 又は 10000行（BR3.5） |
| 状態の文字表示 | loading（起動中）、error（原因の文字）、空の出力を区別する。色だけで状態を示さない（BR7.2） |
| keyboard | 端末に focus して入力・Enter で run、Tab で次の部品へ移れる（BR7.2）。非ASCII・空白・引用の入力はそのまま保つ（BR7.1） |
| 起動の失敗 | ready を reject し、pane に原因の文字を出す（BR3.1・BR3.2） |

terrarium_loader から引き継ぐもの：`crossOriginIsolated` の確認と、coi-serviceworker による再読込の待機（最大15秒）。引き継がないもの：terrarium の module URL、`tool`/`ref` 名による build の選択、`/terrarium/web/` の base。

## 相互作用の流れ

1. page 読込み → VerdictBadge は pending（LOADING…）。
2. 2つの端末の ready → VerdictBadge は pending（RUNNING…）。
3. 各端末で command 列を実行 → 出力が端末に出る。
4. baseline の結果 → VerdictBadge が reproduced / unreproduced。
5. fix の結果 → FixPane の `data-fix-status` が ok / error。
6. 失敗 → 該当の pane に原因、VerdictBadge は unreproduced と原因（BR4.5）。

訪問者は、判定の後に各端末へ command を入力して試せる（vivarium の2端末 template の規則）。判定の command 列が終わるまでは入力を受け付けない（BR3.4）。その入力は判定に使わない。

端末は baseline、fix の順に起動する（BR3.7）。要素が外れたら session を dispose する。

## license と notices

formicarium の LICENSE と THIRD_PARTY_NOTICES.md は bundle の置き場に一緒に置き、recipe page の drawer から辿れるようにする。coi-serviceworker.js は file 先頭の MIT の注記を残す。Biome の ELF は、RecipeMeta に repository と commit を示し、その license へ辿れるようにする（BR8.1）。

## 入力の検証

端末の入力は formicarium の command API（C05）の規則に従う（空入力は何もしない、64KiB の上限、shell の構文は拒否）。U6 では独自の検証を足さない。

## 外部とのつながり

- formicarium の browser 用 module（同じ origin の固定版。BR2.1）
- 同じ origin の guest の ELF・build-info（BR2.2）
- `verdict.ts` の `setVerdict`・`setResult`（Contract v1。今のまま使う）

## U8 との分担

loading/empty/error の区別、keyboard、出力の escape は NFR7 の共通の条件で、U6 は vivarium の recipe page で満たす。showcase の UI は U8 が持つ。部品は共有しない（showcase は formicarium の公開 API だけを使う）。
