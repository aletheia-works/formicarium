---

title: コアのライセンス
description: paludarium のコアのライセンスと、パッケージに一緒に入れるもの。
---

コアは [paludarium](https://github.com/aletheia-works/paludarium) です。このページは、そのライセンスが formicarium に合う理由と、
一緒に配布する必要があるものを記録します。

| 項目                     | 内容                                                                    |
| ------------------------ | ----------------------------------------------------------------------- |
| コア                     | `@aletheia-works/paludarium-wasm`。`package.json` で版を固定            |
| 出所の記録               | `assets/paludarium/build-info.json`（版と、コアの全ファイルの SHA-256） |
| paludarium のライセンス  | Apache License 2.0（本文は `assets/paludarium/LICENSE`）                |
| wasm に含まれるクレート  | 表示とライセンス本文は `assets/paludarium/THIRD-PARTY-NOTICES.txt`      |
| formicarium のライセンス | Apache License 2.0                                                      |

## 両立

- paludarium と formicarium はどちらも Apache License 2.0 なので、コアのファイルを変更せずにパッケージに入れるには、
  そのライセンスの本文と表示を添えれば足ります。`paludarium.wasm` には、MIT や Apache-2.0 などのライセンスの
  Rust のクレートと Rust の標準ライブラリからビルドしたコードも入っています。paludarium はそれらの表示を
  `THIRD-PARTY-NOTICES.txt` として配布しており、パッケージもそれを含めます。ライセンスの本文を読んだうえでの判断で、法的な助言ではありません。
- paludarium は jart/blink に相当するものを Rust で一から書いたものです。blink の振る舞いと設計を参考にしていますが、
  blink のコードは写していません。そのため、blink の ISC License はパッケージには関係しません。

## 配布に含めるもの

npm のパッケージは、コアのファイルを `@aletheia-works/paludarium-wasm` から変更せずに `assets/paludarium/` に写し、
その `LICENSE` と `THIRD-PARTY-NOTICES.txt` も含めます。`build-info.json` には、固定した版とコアの全ファイルの SHA-256 を記録します。ゲストの ELF、vendor のソース、
開発用の依存は含みません。

以前のコア（Emscripten でビルドした blink の fork）では、blink の ISC License、zlib、Emscripten のライセンス、
musl のライセンスが必要でした。これらはもうパッケージには入れません。
