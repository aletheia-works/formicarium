# U6 recipe-runtime の性能設計

## Sources

`../nfr-requirements/performance-requirements.md`（NFR6.1–NFR6.5）、`../nfr-requirements/security-requirements.md`（NFR2.1・NFR4.1・NFR4.2）、`../nfr-requirements/nfr-requirements-questions.md`（Q1=A、Q2=A、2026-10-19 の確認「旧specと同じ数え方でよいです。」）、`../functional-design/functional-spec.md`（W3・W4・W5、TerminalPane の状態）、`../../../inception/contract-design/contract-summary.md`（C03・C11）。vivarium の `scripts/bundle-layer1-pages.sh`、`docs/scripts/repro-dev-middleware.ts`・`serve-repro.ts`・`generate-recipes-index.ts`、`src/layer1_wasm/playwright.config.ts`（ローカル main = `71e0ef92`、2026-10-19 に読取り）。設計で、U6 の性能は未計測。

## P1：資産の置き場と1か所の原則（NFR6.4）

vivarium の今の配置では、en の page は `repro/<project>/<issuePath>/` に recipe の dir を丸ごと写し、ja の page は `ja/repro/<project>/<issuePath>/` に index.html と coi-serviceworker.js だけを置いて、`<base>` で en の dir を参照する（`bundle-layer1-pages.sh`、`serve-repro.ts` の `servedByPages`）。この形に合わせて、次の置き場にする。

| 資産 | site 上の path | 元（site build が staging する所） |
|---|---|---|
| formicarium の一覧の file（module・Worker・blink.wasm・build-info・notices）と `assets.json` | `repro/_formicarium/<version>/`（site に1組。`security-design.md` の S8 の候補1で、観測の結果で候補2に変わり得る） | `src/layer1_wasm/_formicarium/<version>/`（git に入れない） |
| baseline・fix の ELF・build-info・catalog | `repro/biome/migrate-override-bracket-spacing/guests/<role>/` | `src/layer1_wasm/biome-migrate-override-bracket-spacing/guests/<role>/`（git に入れない） |

- ELF は en の dir に1か所だけ置く。ja の page は `<base>` で同じ ELF を参照し、写しを作らない。
- formicarium の file は project ごとに写さず、site に1組だけ置く。今の `bundle-layer1-pages.sh` は `src/layer1_wasm/_*/` をすべての Layer1 project の下へ写すので、`_formicarium` だけはこの写しから外し、`repro/_formicarium/` へ1回だけ写すように小さく直す。そうしないと、formicarium を使わない project（cpython・numpy など）にも blink.wasm が写って site が大きくなる。
- staging は AssetStager が行う。公開と PR では `pin` mode、0.3.0 の公開前の手元では `local` mode で、どちらも同じ src の下へ書く（`security-design.md` の S2 の mode の表）。
- 開発用の server は、`repro/_formicarium/...` を `src/layer1_wasm/_formicarium/...` へ、recipe の path を recipe の dir へ、今の `resolveReproFile` の規則のまま対応させる。staging の先を src の下にすることで、回帰試験の server と Pages が同じ形になる（NFR6.8 の deployed-shape）。
- `.gitignore` に `src/layer1_wasm/_formicarium/` と `src/layer1_wasm/*/guests/` を足し、staging した file を commit しない。
- site build は、ELF 1つの大きさ、formicarium の一組の大きさ、site 全体（`docs/doc_build`）の大きさを記録する。Pages の上限との比較は Infrastructure Design で公式情報と実際の deploy で確かめる（Q1=A）。

## P2：時間の予算（NFR6.1・NFR6.2）

回帰試験の合否は NFR6.1 だけで決める：ブラウザ × en・ja の組ごとに1件で、`test.setTimeout(180_000)`、判定（`#verdict` が reproduced 又は unreproduced）を `page.goto` の後から 120秒以内に待つ。2026-10-19 に人間が確かめた旧 spec と同じ数え方。

page の中の各段階に個別の予算は置かず、goto から 120秒の中に含める。ただし原因が分かるように、次の時刻を Result v1 envelope とは別の記録（試験の attachment）に ms で残す。

| 印 | 時点 |
|---|---|
| `isolated` | `crossOriginIsolated` が true になった（coi-serviceworker の再読込の後） |
| `fetch.<role>` | ELF・build-info の取得の開始と終了、bytes |
| `verify.<role>` | SHA256・validateGuest・登録の開始と終了 |
| `ready.<role>` | 端末の ready |
| `verdict` | 判定の表示 |

個々の取得は、C11 の fetchDeadlineMs 120秒で AbortSignal.timeout をかけ、超えたら TIMEOUT でその端末を error にする（判定ではない）。取得の deadline は回帰試験の 120秒と別の上限で、合否は NFR6.1 で決まる。

## P3：取得と照合の流れ（NFR6.2・NFR6.3）

- 端末は baseline、fix の順に起動する。baseline の ready（又は失敗）の後に fix の起動を始める。2つの ELF を同時に取得しないので、ピークのメモリは ELF の bytes 1つ分と、照合中の copy 1つ分に抑えられる見込み（推測。3ブラウザで観測する）。
- ELF は `fetch` の応答を ArrayBuffer にしてから C03 の照合に渡す。照合の前に bytes を実行に使わない。取得の大きさは C11 の 128MiB を上限とし、`Content-Length` が上限を超えるか、読んだ bytes が上限を超えたら、読むのを止めて失敗にする。
- 取得の bytes と時間、照合・登録の時間をブラウザごとに記録する（P2 の印）。
- 2つの端末を同じ page で動かせないブラウザがあれば、後の pane を error にして受入を止め、報告する。逐次の dispose や1端末ずつの page に黙って切り替えない（NFR6.3）。
- wasm の上限 1GB（formicarium の既存）は変えない。

## P4：取消と解放（NFR4.2）

端末の要素が外れたら、その端末の AbortController を abort して取得を止め、session を dispose する。取り消した後に届いた応答は、端末の世代番号を比べて捨て、表示も登録もしない。dispose で Worker と wasm を解放する。

## P5：試験の設定（NFR2.1）

vivarium の今の `playwright.config.ts` は CI で retry 1、既定 timeout 90秒で、`repro:test` は Chromium だけを入れる。U6 の試験は、この設定を全体では変えずに、U6 の spec の中で `test.setTimeout(180_000)` と `test.describe.configure({ retries: 0 })` を置き、Firefox・WebKit の project を U6 の spec だけに足す。CI では Playwright の3ブラウザを入れる。retry で通った結果を U6 の証拠にしない。具体の差分は Code Generation の計画で示す。

## P6：大きさの余裕（NFR6.5）

`accepted` を置き換える PR の確認項目に、新しい ELF の bytes と C11 の上限 128MiB との差、site 全体の大きさを書く。上限を超えるなら PR を作らずに止めて報告する。site build も同じ上限で取得を止める（P3）。

## Assumptions & Open Questions

None.
