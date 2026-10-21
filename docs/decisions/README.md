# 設計上の決定（ADR）

formicarium の PoC（2026-10-03〜10-05）で決めたことを、1 件 1 ファイルで記録する。各ファイルには、
Context（背景）、Decision（決定）、Consequences（結果）、Alternatives Rejected（退けた案）と、根拠となる記録への参照がある。
全体の構成は [`../architecture.md`](../architecture.md)、PoC の結果は [`../../OUTCOMES.md`](../../OUTCOMES.md) を参照。

| 番号                                           | 決定                                                                      | 状態 | 決めた人                   |
| ---------------------------------------------- | ------------------------------------------------------------------------- | ---- | -------------------------- |
| [0001](0001-blink-fork.md)                     | エミュレータのコアに jart/blink の fork を使う                            | 採用 | ユーザー                   |
| [0002](0002-interpreter-only-jit-deferred.md)  | インタプリタのみとし、JIT の開発は後回しにする                            | 採用 | ユーザー                   |
| [0003](0003-core-boundary.md)                  | コアは「wasm 1 つ＋起動用の JS」という境界でだけ扱う                      | 採用 | 計画（ユーザー承認）       |
| [0004](0004-container-build.md)                | blink の wasm ビルドはコンテナで行う                                      | 採用 | 実装中の判断               |
| [0005](0005-memfs-extensions.md)               | ファイルシステムは Emscripten の MEMFS を拡張する                         | 採用 | 実装中の判断（計画の分岐） |
| [0006](0006-emulated-fds-in-core.md)           | eventfd・epoll・socketpair はコアの中でエミュレートする                   | 採用 | 計画（ユーザー承認）       |
| [0007](0007-no-guest-network-in-browser.md)    | ブラウザ版では、ゲストのネットワークを使わない                            | 採用 | 実装中の判断               |
| [0008](0008-fresh-instance-per-step.md)        | 手順ごとに blink の新しいインスタンスを作る                               | 採用 | 実装中の判断               |
| [0009](0009-disable-atomics-waitasync.md)      | ブラウザの実行用 Worker で Atomics.waitAsync を無効にする                 | 採用 | ユーザー                   |
| [0010](0010-wasm-memory-1gb.md)                | wasm メモリの上限を 1 GB にする                                           | 採用 | ユーザー                   |
| [0011](0011-host-baseline-in-measurements.md)  | 計測にホストの速さの基準値を添える                                        | 採用 | ユーザーの依頼、方法は開発 |
| [0012](0012-madvise-dontneed-zero-in-place.md) | madvise(MADV_DONTNEED) では、プライベートな匿名ページをその場でゼロにする | 採用 | ユーザーの依頼、方法は開発 |

新しい決定を足すときは、次の番号のファイルを作り、この表に 1 行足す。決定を覆すときは、元のファイルの状態を
「置き換え（→ 新しい番号）」に変え、新しいファイルに理由を書く。
