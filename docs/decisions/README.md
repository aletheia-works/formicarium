# 設計上の決定（ADR）

今の blink のコアに固有の決定を、コアを paludarium に移すまでここに置く。それ以外の決定とランタイムの構成は、
サイトの開発の節（[Architecture decisions](https://aletheia-works.github.io/formicarium/development/decisions/)、[Runtime architecture](https://aletheia-works.github.io/formicarium/development/architecture/)）にある。

| 番号                                           | 決定                                                                      | 状態 | 決めた人                   |
| ---------------------------------------------- | ------------------------------------------------------------------------- | ---- | -------------------------- |
| [0001](0001-blink-fork.md)                     | エミュレータのコアに jart/blink の fork を使う                            | 採用 | ユーザー                   |
| [0004](0004-container-build.md)                | blink の wasm ビルドはコンテナで行う                                      | 採用 | 実装中の判断               |
| [0005](0005-memfs-extensions.md)               | ファイルシステムは Emscripten の MEMFS を拡張する                         | 採用 | 実装中の判断（計画の分岐） |
| [0006](0006-emulated-fds-in-core.md)           | eventfd・epoll・socketpair はコアの中でエミュレートする                   | 採用 | 計画（ユーザー承認）       |
| [0009](0009-disable-atomics-waitasync.md)      | ブラウザの実行用 Worker で Atomics.waitAsync を無効にする                 | 採用 | ユーザー                   |
| [0010](0010-wasm-memory-1gb.md)                | wasm メモリの上限を 1 GB にする                                           | 採用 | ユーザー                   |
| [0012](0012-madvise-dontneed-zero-in-place.md) | madvise(MADV_DONTNEED) では、プライベートな匿名ページをその場でゼロにする | 採用 | ユーザーの依頼、方法は開発 |

新しい決定は、サイトの開発の節に足す（`showcase/site/src/content/docs/development/decisions/` と、その `ja/` 版）。
