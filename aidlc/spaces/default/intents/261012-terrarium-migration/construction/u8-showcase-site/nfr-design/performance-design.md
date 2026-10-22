# U8 showcase-site の性能の設計

## Sources

`../nfr-requirements/performance-requirements.md`（NFR6.1–NFR6.5）、`../nfr-requirements/security-requirements.md`（NFR4.1）、`../nfr-requirements/tech-stack-decisions.md`、`../functional-design/functional-spec.md`（W2・W4–W6）、`../../../inception/contract-design/contract-summary.md`（C04・C11、「Transcript の表示と原本」）、`nfr-design-questions.md`（Q1=A）。設計で、U8 の動作・性能は未計測。

## P1：受入の時間の予算（NFR6.1）

| 項目 | 値 |
|---|---|
| Playwright | retries 0、workers 1、1件の timeout 180秒、準備完了の待ち 120秒（page を開いてから） |
| job | ブラウザごとに1つ（accept-chromium・accept-firefox・accept-webkit）、各 timeout-minutes 60 |
| 件（ブラウザごと16件） | 空の端末 6（3ツール × en・ja、1件で1ツール）、個別ページ 6（3ツール × en・ja、分離と再訪問を含む）、状態と keyboard 2（en・ja）、端末の page の後の文書の page 1、敵対的な出力の harness 1 |
| 上限の計算 | 16件 × 180秒 = 48分 < 60分 |

各件で、page を開いてから準備完了まで・install の時間・件の総時間を attachment に記録する。上限を超えたら失敗で、上限を上げない。

## P2：page の取得（NFR6.2・NFR4.1）

page の code の取得は1つの小さな helper（fetch-limited）に集める。

- `fetch(url, { credentials: 'omit', signal })`。signal は「pagehide の取消」と「120秒の deadline」を合わせたもの。
- body は stream で読み、累積の bytes が上限（catalog 4194304、fixture の index 268435456）を超えたら止めて失敗にする。Content-Length は信用しない。
- 非2xx・offline・deadline は種類と URL（query なし）を状態欄に出す。自動の retry はしない。
- guest の取得は公開 API（install）に任せ、`onProgress` の bytes と時間を記録する。

## P3：資源と表示の buffer（NFR6.3）

- 1つの page で端末は1つ。Session は page を離れると dispose する。
- 表示の buffer は TerminalHost の中の bytes と行の数え上げで、1048576 bytes か 10000 行の早い方を超えたら先頭を捨て、xterm を `reset()` してから残りを書き直す。捨てた量は OmittedNotice に出す。
- 切る位置（review-01 R-11）：捨てる必要のある位置より後の、最初の LF の直後で切る（行の途中で切らない。捨てる量は最大で1行分増える）。LF が無いまま上限を超える1行は、UTF-8 の文字境界で切り、その位置が ESC で始まる escape 列（CSI・OSC など）の途中なら、その列の終わり（CSI は終端の文字、OSC は BEL か ST）の後まで進める。`reset()` で色などの状態を戻すので、捨てた部分の状態は残らない。
- 数え上げと切る位置は `buffer.ts` の純粋な関数にして、単体試験で境界値（1048575・1048576・1048577 bytes、9999・10000・10001 行、multi-byte の文字の境界、escape 列の途中）を確かめる。

## P4：site の大きさ（NFR6.4）

- check-site が site の全 file の大きさを合計し、1073741824 bytes 以上なら失敗にする。guest ごとの大きさと合計を job summary に出す。
- guest は site の root の `guests/<tool>/<version>/` に1か所だけ置き、en と ja の page は catalog の解決（site の root を基準）で同じ URL を使う。

## P5：文書の page は読まない（NFR6.5）

- 端末の module は個別ページと /terminal/ の page の script だけが `import()` する。文書の page と /tools/ の bundle には端末の module・xterm・formicarium の loader を入れない（Astro の page ごとの script で分ける）。
- 受入（P1 の「端末の page の後の文書の page」）で、文書の page の取得の一覧に `_formicarium/`・`guests/`・`demo-fixtures/`・`catalog.json` が無いことを確かめる。

## Assumptions & Open Questions

None.
