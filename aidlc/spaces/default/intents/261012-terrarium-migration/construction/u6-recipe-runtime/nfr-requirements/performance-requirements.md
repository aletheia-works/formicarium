# U6 recipe-runtime の性能要件

## Sources

`nfr-requirements-questions.md`（Q1=A、Q2=A、2026-10-19）、`../functional-design/functional-spec.md`・`rules.md`（BR2.3・BR3.1・BR3.7・BR5.1）、`../../../inception/requirements-analysis/requirements.md`（NFR1・NFR2・NFR6）、`../../../inception/contract-design/contract-summary.md`（C11）、旧 biome-12265 の Playwright 試験（`04a8724^:src/layer1_wasm/tests/biome-12265.spec.ts`：en と ja の各 page で1件、各 `test.setTimeout(180_000)`、判定の表示を `page.goto` の後から `expect(...).toHaveText(..., {timeout: 120_000})` で待つ）、vivarium の `src/layer1_wasm/playwright.config.ts`（`timeout: 90_000`、`retries: process.env["CI"] ? 1 : 0`）、保存済みの Biome の ELF（114,647,744 bytes、約109.34MiB）。review-01（NOT-READY）の R-01・R-05・R-07・R-10 を反映した。設計の要件で、U6 の動作・性能は未計測。

## Requirements

| ID | 分類 | 合格条件 | 検証 |
|---|---|---|---|
| NFR6.1 | 時間 | 回帰試験は、Chromium・Firefox・WebKit と en・ja の page の組それぞれで、1件を 180秒以内に終える。判定（`#verdict` が reproduced 又は unreproduced）は、page の読込み（goto）から 120秒以内に表示される。旧 biome-12265 の試験と同じ数え方（Q2=A）。上限を上げて通さない。 | Playwright を retry 0 で実行し、組ごとの総時間・読込みから各端末の ready まで・ready から判定までの時間を記録する |
| NFR6.2 | 取得 | ブラウザの同じ origin からの ELF・build-info の取得は、C11 の fetchDeadlineMs 120秒を超えたら TIMEOUT でその端末を失敗にする（判定ではない。BR4.5）。回帰試験の合否の時間は NFR6.1 だけで決め、NFR6.2 は個々の取得の上限。取得の bytes と時間、照合・登録（SHA256・validateGuest・登録）の時間を、ブラウザごとに記録する。 | 回帰試験と受入（W5）の記録。取得の上限 +1（遅い応答）で TIMEOUT になる試験 |
| NFR6.3 | 資源 | 1つの page で ELF と wasm を2組動かす。wasm の上限 1GB（既存）を緩めない。端末は baseline、fix の順に起動する（BR3.7）。2端末を同じ page で動かせないブラウザがあれば、その pane を error とし、受入を止めて報告する。逐次の dispose や1端末ずつの page など、別の方式を黙って選ばない。 | 3ブラウザで2端末の起動を観測し、結果を記録する |
| NFR6.4 | 配置 | ELF は site に1か所だけ置き、en と ja の page は同じ ELF を参照する（ja 用に写さない）。site 全体の大きさは GitHub Pages の公開 site の上限（公式情報で確かめる。1GB と見込むが未確認）を超えない。ELF 1つと site 全体の大きさを site build で記録する。Pages の1 file の上限と転送量で足りるかを、Infrastructure Design で公式情報と実際の deploy で確かめ、足りなければ止めて報告する（Q1=A）。 | site build の大きさの記録、Infrastructure Design の確認記録 |
| NFR6.5 | 余裕 | ELF の大きさが C11 の上限 128MiB に近い（今は約109MiB、余裕は約17%）。`accepted` を置き換える PR では、ELF の大きさと site 全体の大きさを確かめ、上限を超える場合は PR を作らずに止めて報告する。上限を緩めない。 | accepted を置き換える PR の確認項目 |

## Test environment

回帰試験と受入は、本番と同じ配置で ELF を返す `docs/scripts/serve-repro.ts`（deployed-shape の server）で行う。Pages からの取得時間は、deploy の後に別に記録する証拠で、回帰試験の合否には使わない。vivarium の Playwright の設定は今 CI で retry 1・既定 timeout 90秒で、`repro:test` は Chromium だけを入れる。U6 の試験は retry 0・180秒の timeout・3ブラウザで実行し、retry で通った結果を U6 の証拠にしない（設定の差は Code Generation で小さく直す。NFR2.1）。

## Applicability

NFR1（install の非DL中央値 3000ms）は U1・U3・U9 の範囲で、U6 は install を使わない（検証済み guest を登録する）ので N/A。ただし照合・登録の時間は NFR6.2 で記録する。訪問者向けの新しい数値目標は置かない（Q2=A）。scalability・reliability・observability の文書は ui の Unit では作らない（stage の produces_kinds）。

## Assumptions & Open Questions

None.
