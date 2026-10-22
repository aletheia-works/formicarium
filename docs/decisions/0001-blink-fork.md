# 0001. エミュレータのコアに jart/blink の fork を使う

- 状態：採用（2026-10-03）
- 決めた人：ユーザー（要件分析の Q5〜Q8）

## Context（背景）

ブラウザで x86-64 Linux のバイナリを動かすには、ユーザーモードのエミュレータが要る。ユーザーは当初、更新の止まった blink は使わず、
Rust で作り直すと答えた（Q5）。その後、Rust 版は別リポジトリ（paludarium）で並行して作り、この PoC は既存の blink で
実現性を確かめる、と整理した（Q6、Q7）。blink への変更の管理方法も決める必要があった（Q8）。

## Decision（決定）

jart/blink を `aletheia-works/blink` に fork し、`formicarium-wasm` ブランチで変更を管理する。formicarium は
`blink.lock` で fork のコミットを固定して参照する。fork 元は jart/blink に限る。

## Consequences（結果）

- 変更の履歴が fork の側にまとまり、upstream との差分を `git diff <upstream_commit> <commit>` で一覧できる。
- formicarium のテストは、`blink.lock` のコミットと取得物の一致を確かめる（`tests/node/build.test.mjs`）。
- fork を直すたびに、push と `blink.lock` の更新が要る（README の「fork を直すとき」）。
- 将来は paludarium に置き換える前提なので、この fork への大きな投資（JIT など）は避ける（→ [0002](0002-interpreter-only-jit-deferred.md)）。

## Alternatives Rejected（退けた案）

- **最初から Rust で作り直す**：PoC の前に大きな実装が要る。並行開発（paludarium）に回した。
- **formicarium にパッチ列を置き、ビルド時に upstream に当てる**：パッチの管理が煩雑になる（Q8 の A）。
- **blink のソースを formicarium に取り込んで直接変更する**：upstream との差分が追いにくい（Q8 の C）。
- **ほかの fork（webix、portabox、lanmower/blink）**：マルウェア混入の履歴がある。

## 参照

commit `8096c7b4` の `aidlc/spaces/default/intents/261003-blink-wasm-poc/inception/requirements-analysis/requirements-analysis-questions.md`（Q5〜Q8）、
commit `8096c7b4` の `aidlc/spaces/default/memory/project.md`、`blink.lock`
