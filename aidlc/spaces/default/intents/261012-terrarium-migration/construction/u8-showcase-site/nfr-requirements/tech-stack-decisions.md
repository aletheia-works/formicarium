# U8 showcase-site の技術の選択

## Sources

`../functional-design/functional-design-questions.md`（Q1–Q7）、`../functional-design/rules.md`、`nfr-requirements-questions.md`（Q1=A、Q2=A）、`aidlc/spaces/default/codekb/formicarium/technology-stack.md`、formicarium の `showcase/`（U7）、terrarium の `docs/package.json`（Astro 7.3.8、Starlight 0.42.6、TypeScript 7.0.2）。npm の最新版は `npm view <package> version` で確かめた（2026-10-19）：astro 7.4.0、@astrojs/starlight 0.42.6（peer は astro ^7.2.10）、@xterm/xterm 6.0.0、@xterm/addon-fit 0.11.0、@playwright/test 1.64.1、typescript 7.0.2、coi-serviceworker 0.1.7、v8-to-istanbul 9.3.0。版は作業の開始時に最新版を確かめ直す（ユーザーの規則：最新の tool で開発・検証する）。

## Decisions

| 対象 | 選択 | 理由 | 採らなかった案 |
|---|---|---|---|
| site の枠組み | Astro と Starlight（最新版。今は 7.4.0 と 0.42.6）、`output: static`、`site: https://aletheia-works.github.io`、`base: /formicarium`、i18n は root が英語・`ja` が日本語 | FR15（Astro/Starlight のカードとデモを移す）、Q1=A、Q2=B。terrarium と同じ枠組みで移しやすい | 別の静的 site の生成器（移す量が増える） |
| 置き場 | `showcase/site/`（独自の package.json と tsconfig） | unit-of-work の U8 の配置。U7 の候補と同じ showcase の中 | formicarium の root の docs（本体と showcase の境界が崩れる） |
| 端末の表示 | @xterm/xterm（最新。今は 6.0.0）と @xterm/addon-fit（今は 0.11.0）、screenReaderMode | Q6=A（terrarium と同じ見た目と操作、色付きの出力） | 文字だけの端末（Q6=B） |
| formicarium の取込み | 同じ run の artifact `showcase-work-resolve` の pack を U7 の pack.ts の手順で確かめて展開し、`_formicarium/<version>/` に bytes のまま置き、page は実行時にその module を import する（site の Vite の bundle に入れない） | same-origin の Worker が要る。pack の bytes と identity（formicariumPackSha256）を保つ | Vite で bundle する（bytes が pack と変わり、identity の照合ができない）、CDN（cross-origin） |
| 分離 | coi-serviceworker 0.1.7（MIT、SHA256 を固定）を site の root に1つ。COEP は require-corp | Pages は header を付けられない。U6 で coepCredentialless を false にしないと WebKit の Worker が分離されなかった | header を付けられる hosting（範囲外） |
| 配布 | GitHub Pages（actions/upload-pages-artifact と actions/deploy-pages の最新版、commit SHA で固定）、`github-pages` environment。最初の deploy だけ承認者、その後は外す（Q2=A） | Q1=A。U7 の trusted-callers.json の `.github/workflows/showcase-site.yml` | terrarium の Pages（Q1=B） |
| 受入 | Playwright（最新。今は 1.64.1）の Chromium・Firefox・WebKit、1 worker、retry 0、1件 180秒、準備完了まで 120秒。header を付けない新しい静的 server と、U7 の tls.ts の job 専用の CA の HTTPS | NFR6.1、BR7.1。U7 の受入 server は COOP・COEP の header を付けるので Pages と同じ形にならない | U7 の accept-server の流用 |
| 単体試験 | node の test（U7 の showcase と同じ `node --test`、型の除去で TS を直接実行） | U7 の showcase と同じ構成 | 新しい試験の枠組み |
| 依存の管理 | bun（formicarium の root の `packageManager: bun@1.4.3` と同じ。最新版を確かめる）。`showcase/site/bun.lock` を commit し、CI は `bun install --frozen-lockfile --ignore-scripts` | NFR8.11。repository の既存の package manager | npm・pnpm（repository に2つ目の lockfile の形が増える） |
| coverage | node の `--experimental-test-coverage` と、Playwright の Chromium の V8 の coverage を source map で TS の行へ対応させる v8-to-istanbul（最新。今は 9.3.0）。分母は file の一覧で固定 | NFR2.2。U6 と同じ方式 | 全ブラウザでの coverage（測る道具が無い） |
| 型 | TypeScript（最新。今は 7.0.2）、strict。Astro の検査（astro check）は、TypeScript 7 に対応しない場合に terrarium と同じく隔離した package で行う（未検証） | 既存の showcase の strict と同じ | 型検査なし |
| toolchain | mise で node は latest、宣言された task は `mise run` で実行 | ユーザーの規則と formicarium の mise.toml | 版の固定 |

## Version check at start

Code Generation の開始時に、astro・@astrojs/starlight・@xterm/xterm・@xterm/addon-fit・@playwright/test・typescript・coi-serviceworker・v8-to-istanbul と、GitHub Actions（upload-pages-artifact・deploy-pages・download-artifact）の最新版を確かめ、古いものがあれば差分を報告する。

## Assumptions & Open Questions

None.
