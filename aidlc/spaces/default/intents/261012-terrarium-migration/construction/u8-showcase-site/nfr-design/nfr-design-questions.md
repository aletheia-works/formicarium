# U8 showcase-site NFR Design の質問

## 前提（2026-10-19）

- 要件 NFR6.7（`../nfr-requirements/security-requirements.md`）：端末の page は CSP で、script・worker・connect を self と blob、wasm を wasm-unsafe-eval に限り、外部の origin を許さない。分離の設定の inline script、Starlight の inline の script・style、xterm が入れる style との両立は NFR Design で決める。
- GitHub Pages は HTTP の header を付けられないので、CSP は page の meta で置く（meta の CSP は frame-ancestors などの一部の指令を持てない。ドキュメント根拠：CSP の仕様）。static site なので、page ごとに変わる nonce は使えない。
- 推測（未検証）：xterm.js の DOM の描画は実行時に `<style>` を入れ、Starlight は theme の切替えの inline script を出す。どちらも既定の CSP（style-src 'self'、script-src 'self'）では止められる恐れがある。

## 質問

## Q1. [開発者] 端末の page の CSP の置き方

A. 端末の page（個別ページと /terminal/）だけに meta の CSP を置く。script は 'self'・'wasm-unsafe-eval'・blob と、build で計算した inline script の hash（分離の設定と Starlight の inline script）だけを許す。style は 'self' と 'unsafe-inline'（xterm が実行時に入れる style のため。style の inline は script の実行にならない）。外部の origin は許さない。文書の page には CSP を置かない（端末を読まず、cross-origin の副資源も無い）。
B. A と同じだが、style も 'unsafe-inline' を許さない。xterm の style を外部の CSS に出し、実行時に入る style が止められて表示が崩れるなら、Code Generation で止めて報告する。
C. CSP を置かない。代わりに、cross-origin の副資源が無いことの build 後の検査と、guest の出力を HTML にしない規則（NFR7.1）で守る。
X. Other (please specify)

[Answer]: A. 端末の page だけに meta の CSP。script は self・wasm-unsafe-eval・blob と inline script の hash、style は self と unsafe-inline（人間の回答、Guide me）
