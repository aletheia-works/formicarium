# U6 recipe-runtime の技術の選択

## Sources

vivarium の `mise.toml`、`src/layer1_wasm/package.json`、`docs/package.json`、`.claude/rules/recipe-authoring.md`、`AGENTS.md`（ローカル main = `71e0ef92`、2026-10-18 に読取り）。`aidlc/spaces/default/codekb/formicarium/technology-stack.md`。Functional Design の Q4=A・Q5=A、`rules.md`。版の値は読み取った時点のもので、作業の開始時に最新版を確かめ直す（ユーザーの規則：最新のtoolで開発・検証する）。

## Decisions

| 対象 | 選択 | 理由 | 採らなかった案 |
|---|---|---|---|
| recipe の言語と出力 | TypeScript を `tsc` で1対1に出す（vivarium の Layer1 の今の方式。bundler なし） | 既存の recipe と同じ。AGENTS.md の小さい差分 | bundler の導入（Layer1 全体の変更になる） |
| formicarium の取込み | npm の `@aletheia-works/formicarium` の固定版 tarball を pin file（版・tarball の SHA256・source commit・file 一覧と各 SHA256）で固定し、site build で同じ origin へ置く | same-origin の Worker が要る。bare import は Layer1 で解決できない（Q4=A） | CDN（Worker が cross-origin になる）、git の submodule |
| 固定 guest の取得 | site build で、上流 vivarium の Release（tag `guest-<tool>-<accepted.buildKey>`）から取り、同じ origin へ置く | COEP の下での cross-origin 取得を避ける（Q5=A） | ブラウザから Release を直接取得 |
| 分離 | coi-serviceworker@0.1.7（MIT）を固定 digest で recipe の dir と ja の写しに置く | vivarium の今の規則（recipe-authoring.md）。GitHub Pages は COOP/COEP の header を付けられない | header を付けられる hosting への移行（範囲外） |
| 試験 | Playwright（latest。今は `^1.64.1`）の Chromium・Firefox・WebKit、1 worker、retry 0、180秒の timeout、deployed-shape の server（`serve-repro.ts`）。docs と script の単体は bun test（latest） | vivarium の既存の構成。今の設定（CI で retry 1、既定 timeout 90秒、`repro:test` は Chromium だけを入れる）は U6 の試験の分だけ小さく直す | 新しい試験の枠組み |
| coverage の測定 | site build の script は bun test の coverage。ブラウザで動く module は Playwright の Chromium の page 内の coverage を source へ対応させる（方式は未検証）。分母の一覧は U6 の受入の前に file に固定する | NFR2.2。Firefox・WebKit で同じ測定ができない | 全ブラウザでの coverage（測る道具が無い） |
| 分離の file の検査 | coi-serviceworker.js の SHA256 を docs の bun test で照合する（pin file とは別の固定値） | NFR3.5。pending の間も検査する | pin file の中だけに置く（公開前に検査されない） |
| toolchain | mise で node・bun は latest、宣言された task は `mise run` で実行 | ユーザーの規則と vivarium の mise.toml | 版の固定（最新版を使う規則に反する） |
| 判定の補助 | 既存の `_shared/verdict.ts`（setVerdict・setResult、Contract v1）をそのまま使う | runtime に依存しない（調査で確認） | 新しい verdict の仕組み |

## Version check at start

作業の開始時に、node・bun・Playwright・TypeScript・coi-serviceworker・formicarium の最新の公開版を確かめ、古いものがあれば差分を報告する。formicarium は 0.3.0 の公開を待つ（それまで pin file を置かない。NFR3.4）。

## Assumptions & Open Questions

None.
