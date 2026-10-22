# U6 recipe-runtime の性能・安全設計の確認

## Questions

人間に新しく選んでもらう事項はない。置き場（ELF を site に置く）と性能の上限は NFR Requirements の Q1=A・Q2=A と、2026-10-19 の確認（旧 spec と同じ数え方）で決まっている。照合の失敗で deploy 全体を止めること、pending の扱い、外部操作の承認は NFR3.2・NFR3.4・NFR8.2 で決まっている。

ここで具体化するのは、前の工程から持ち越した Minor の設計である。

- formicarium の module・Worker・wasm と ELF の site 上の置き場と、coi-serviceworker の scope の関係（Functional Design の R-03 の残り、NFR6.8）。
- coi-serviceworker.js の digest の固定値の置き場と更新の手順（NFR Requirements の review-02 R-13）。
- pin file が無い間の検査主体（Functional Design の review-02 Minor 4）。

置き場は vivarium の今の配置（`scripts/bundle-layer1-pages.sh`、`docs/scripts/repro-dev-middleware.ts`、`serve-repro.ts`、ローカル main = `71e0ef92`、2026-10-19 に fetch して変更なしを確認）に合わせて設計する。3ブラウザの観測で動かない場合は、別の方式を黙って選ばず、止めて報告する。

## Assumptions & Open Questions

None.
