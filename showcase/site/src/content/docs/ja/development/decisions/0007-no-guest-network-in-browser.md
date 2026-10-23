---

title: '0007. ブラウザでは、ゲストのネットワークを使わない'
description: ゲストに socket を渡さず、native の基準値と比べられるようにする。
---

- 状態：採用（2026-10-04）
- 決めた人：実装中の判断

## 背景

Emscripten は、ゲストの TCP と UDP の socket を WebSocket で中継しようとし、Node.js では `ws` モジュールを求めて
失敗しました。aube は `--version` や `install` のたびに、registry へ更新の確認をしに行きます。
CheerpX の計測も、ネットワークなしで行われていました。

この背景は、Emscripten でビルドした以前の blink のコアについてのものです。コアを paludarium に移してからも決定はそのままで、
formicarium はゲストにネットワークを渡さず、aube も同じ環境変数と native の基準値で動かします。
下の `EAFNOSUPPORT` は blink で確かめた結果です。

## 決定

`socket()` は `EAFNOSUPPORT` を返します。aube は `AUBE_NO_UPDATE_CHECK=1` で実行し（`runtime/registry.ts` の
`GUESTS.aube.env`）、native の基準値も `--network none` のコンテナで作って条件をそろえます。
`socketpair()` は、コアの中でエミュレートした記述子で使えます。

## 結果

- 余計な依存が増えず、native の基準値とそのまま比べられます。
- registry からの取得など、ネットワークを使うゲストは動きません。

## 退けた案

- **Emscripten の WebSocket の中継を使う**：中継用のサーバーと、さらなる依存が要る。
