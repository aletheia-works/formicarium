# 0007. ブラウザ版では、ゲストのネットワークを使わない

- 状態：採用（2026-10-04）
- 決めた人：コード生成（実装中の判断）

## Context（背景）

Emscripten は、ゲストの TCP/UDP ソケットを WebSocket で中継しようとし、Node.js では `ws` モジュールを要求して失敗した（F-5）。
aube は `--version` や `install` のたびに registry へ更新の確認をしに行く。CheerpX の計測も、ネットワークなしで行われている。

## Decision（決定）

`socket()` は `EAFNOSUPPORT` を返す。aube は `AUBE_NO_UPDATE_CHECK=1` で実行し、native の基準値も
`--network none` のコンテナで作って条件をそろえる。`socketpair()` は [0006](0006-emulated-fds-in-core.md) のエミュレートで使える。

## Consequences（結果）

- 余計な依存が増えず、native の基準値と同じ条件で比べられる。
- ネットワークを使うゲスト（registry からの取得など）は、ブラウザ版では動かない。

## Alternatives Rejected（退けた案）

- **Emscripten の WebSocket 中継を使う**：中継用のサーバーと依存が要り、PoC の範囲を超える。

## 参照

`runtime/web/sessions.mjs`（`GUEST_ENV`）
