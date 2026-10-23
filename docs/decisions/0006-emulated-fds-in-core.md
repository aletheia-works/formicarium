# 0006. eventfd・epoll・socketpair はコアの中でエミュレートする

- 状態：採用（2026-10-04）
- 決めた人：コード生成の計画（要件のレビュー R-07：実装場所はコア側）

## Context（背景）

tokio は eventfd2 と edge-triggered の epoll を、`UnixStream::pair` は socketpair を使う（FR3、FR4.2）。
wasm にはホストの epoll がなく、Emscripten の socket は WebSocket での中継を前提にしている。

## Decision（決定）

eventfd、epoll（level／edge-triggered、`EPOLLONESHOT`）、socketpair、pipe を、blink の中のファイル記述子として
エミュレートする（fork の `blink/emufd.c`）。futex には `FUTEX_WAIT_BITSET` と `FUTEX_WAKE_BITSET` を追加する。

## Consequences（結果）

- ホストの機能に頼らないので、Node.js とブラウザで同じ動きになる。
- 待ちと通知の正しさは blink の側の責任になる。Loop-back 1 で futex の期限の不具合を直した（L-1）。

## Alternatives Rejected（退けた案）

- **ホストの epoll や socket に渡す**：wasm にはない。
- **formicarium の JS の側で実装する**：コアの置き換え（[0003](0003-core-boundary.md)）のたびに作り直すことになる。

## 参照

commit `8096c7b4` の `aidlc/spaces/default/intents/261003-blink-wasm-poc/construction/code-generation/code-generation-plan.md`（Step 5）
