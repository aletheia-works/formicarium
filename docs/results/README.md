# 計測結果：aube の 4 コマンド（FR6）

このファイルは `scripts/measure-aube.mjs` が `docs/results/aube-timings.json` から生成する。手で編集しない。
- 生成日時：2026-10-05T06:29:02.392Z
- コア：blink（commit 7e1d74390765d787000dd54b4258782e0d51bcfe、emcc (Emscripten gcc/clang-like replacement + linker emulating GNU ld) 6.0.10 (d6c521a7f05449857c76bd99e396895583cf2083)）
- aube：2.6.1 linux-x64 (2026-10-04)（commit bd94e42f54d3b5e3dd102716b7197f316cb5f4ed、x86-64 static-musl）
- ホスト：Windows_NT 10.0.26300 x64、Intel(R) Core(TM) i7-8650U CPU @ 1.90GHz x8、Node.js 24.21.0
- 値は秒。「中央値（最小–最大）」。各値は、コアの起動（wasm の読み込みと初期化）を含む、そのコマンド 1 回の実時間。
- 「ホスト基準」は、各試行の前後に測ったホストの 1 スレッドの固定計算の時間（ms）。値が大きいほど、その試行の間ホストが遅かった。

| 環境                      | 版            | OS                        | ページ             | 試行 | --version         | 初回 install    | frozen install  | list              | ホスト基準      |
| ------------------------- | ------------- | ------------------------- | ------------------ | ---- | ----------------- | --------------- | --------------- | ----------------- | --------------- |
| Node.js Worker            | 24.21.0       | Windows_NT 10.0.26300 x64 | n/a                | 10   | 0.60（0.55–1.3）  | 7.4（5.5–15.4） | 6.4（5.4–10.1） | 0.63（0.57–1.5）  | 758（242–1300） |
| chromium                  | 153.0.8010.12 | Windows_NT 10.0.26300 x64 | visible (headless) | 10   | 0.52（0.49–0.59） | 5.7（5.5–5.9）  | 5.3（5.1–5.5）  | 0.50（0.47–0.59） | 745（678–903）  |
| firefox                   | 155.0         | Windows_NT 10.0.26300 x64 | visible (headless) | 10   | 0.77（0.36–0.86） | 6.2（6.1–8.6）  | 5.8（5.6–7.7）  | 0.57（0.52–0.63） | 803（665–939）  |
| webkit                    | 26.6          | Windows_NT 10.0.26300 x64 | visible (headless) | 10   | 0.97（0.65–1.8）  | 9.2（7.8–12.7） | 8.1（7.7–26.9） | 1.2（0.80–1.8）   | 837（671–1073） |
| CheerpX 1.3.9（背景資料） | 1.3.9         | —                         | hidden             | 4    | 0.3–0.7           | 1.8–5.7         | 1.3–3.6         | 0.17–0.65         | —               |

## 比べるときの差異

- CheerpX の install は node --version の起動（0.5–1.3 s）を含む
- CheerpX はネットワークなし（registry の名前解決が即座に失敗する）
- CheerpX の aube は i586 glibc ビルド、formicarium は x86-64 static-musl ビルド
- formicarium の値は、コマンドごとに blink を起動し直す（ファイルシステムの中身は JS 側で引き継ぐ）。CheerpX は 1 つの VM の中で続けて実行する。
- ネットワークの扱い（registry への接続の試み）が両者の時間にどう効いているかは、まだ確かめていない（未検証）。
- CheerpX の値の出典：[`docs/research/cheerpx-oss.md`](../research/cheerpx-oss.md)（CheerpX 1.3.9, WebVM Debian image, localhost, page hidden, 4 page loads）。
- JIT を後回しにするかどうかの閾値は、この結果を見てユーザーが決める（意図書「Success Metrics」）。
