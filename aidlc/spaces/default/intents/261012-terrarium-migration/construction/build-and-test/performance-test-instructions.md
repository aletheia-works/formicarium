# Performance Test Instructions

intent `261012-terrarium-migration` の性能の確認の手順。Test Strategy は Standard だが、project の決まり（Minimal 戦略でも結合・性能・セキュリティの手順書をすべて作る）により作る。品質担当が読取りだけで書いた。

## 方針

- 性能の目標は、すべて人間が固定した上限と NFR の値である。**上限や timeout を緩めて通さない。**
- 計測は main session で1つずつ、重い並行負荷の無い状態で行う。CI の build や別の Playwright を同時に走らせない。
- 時間は monotonic clock で測り、環境（OS・CPU・browser の版・Node/Bun/Playwright の版・sourceCommit・host の負荷・cache の条件）を記録する。unknown を0で代用しない。
- 古い版の道具・古い土台の計測は履歴で、今の根拠にしない。
- 負荷試験（k6 など）や auto-scaling の試験は行わない。常時稼働のサービスが無いため（team.md Deployment）。

## 目標と確かめ方

| Target ID | 目標 | 確かめる command | 備考 |
|---|---|---|---|
| FIX-01・FIX-02 | probe の1回が600秒以内、8項目すべて合格 | `bun run test:probe`（`node --test tests/node/probe.test.js`）と `test:browser` の probe | 今の main の CI（`ci-39706177745.log`）で Node 5.6秒・8項目合格。手元での再計測は任意 |
| FIX-03 | aube のブラウザの1回が840秒以内 | `bun run --bun test:browser -- --project <browser> --workers=1 --retries=0` | CI で 6.4〜8.1秒。既存の `dist/guests/aube` を使い、作り直さない |
| INC-NFR1・U1-NFR1.1 | aube/Biome × 3ブラウザで、非DL5工程の合計の trial1–5 の中央値 ≤3000ms。trial0・最大・fetch は別に記録。失敗した試行を除外しない | `mise run migration-preflight-browser`（36行）、集計の検査は `mise run migration-preflight-unit`（3000 の境界・超過・欠落・重複） | 重い・ブラウザ。性能の試行では coverage の計測をしない |
| INC-NFR1・U3-NFR1.1 | 正式 install 経路の36試行で同じ条件 | 今の main の CI の completion（run 39709015067）が formal36 を実行し `measurement-report.json` を出した（MA:4840）。値は log に無いので artifact `migration-acceptance-completion-39709015067-1` を `gh run download` で取り、`measurement/measurement-report.json` を読む | 手元で測り直すなら `FORMICARIUM_INSTALL_LOCAL_ONLY=1 mise run migration-install-completion`（重い・証明書の一時登録は人間）。結果は `local-provisional` |
| U6-NFR6.1〜6.3 | 3ブラウザ × en・ja の各件 ≤180秒、goto から判定の表示まで ≤120秒、取得は120秒で TIMEOUT、1 page で2組、wasm 1GB | vivarium の `src/layer1_wasm` で Playwright を1ブラウザずつ（`--workers=1`、retry 0）、`verdict.test.ts`・`formicarium_terminal.test.ts` | 重い・ブラウザ |
| U8-NFR6.1〜6.5 | 各件 ≤180秒、準備完了まで ≤120秒、ブラウザごと16件、job 60分、取得 120秒・180秒、buffer 1048576 bytes か10000行、site 全体 <1073741824 bytes、文書の page は guest を取らない | `mise run showcase-site:unit`（fetch-limited・buffer・check-site）と `mise run showcase-site-accept -- --project=<browser>` | 重い・ブラウザ。候補は main の CI の `showcase-candidate` |
| U7-NFR4.2 | 受入の log に各ツールの取得時間と `--version` までの時間（ms）・環境・版 | `mise run showcase-accept-node`（network） | 3000ms の目標は U1・U3 の範囲 |
| U6-NFR6.4・U8-NFR6.4b | Pages の1 file・全体の上限と転送量 | 実際の deploy と公式情報 | Deployment Pipeline が持つ（手元では確かめない） |

## 実行の順

1. `node --version`・`bun --version`・`node node_modules/@playwright/test/cli.js --version` と OS・CPU・負荷（`uptime`）を記録する。
2. `mise run migration-preflight-unit`（集計器の境界の試験。VC-1 に含まれる）。
3. `mise run migration-preflight-browser`（36行）。終わったら証拠の JSON の環境の欄を読む（U1-NFR1.2）。
4. `gh run download 39709015067 -R aletheia-works/formicarium -n migration-acceptance-completion-39709015067-1 -D .artifacts/build-and-test/ci-39709015067`（network の読取り。artifact の保持は7日で、2026-10-29 ごろに消える見込み）。`measurement-report.json` の6組それぞれの中央値・trial0・最大・fetch を記録する。
5. showcase site の受入を1ブラウザずつ（`mise run showcase-site-accept -- --project=…`）。
6. vivarium の Playwright を1ブラウザずつ。

## 判定の規則

- 中央値は trial1–5 の5件から計算する。3000ms ちょうどは合格、3000.001ms は不合格（集計器の試験「median accepts3000 and rejects3000.001…」が今の main の CI で pass）。
- 試行の欠落・重複・失敗・skip は不合格（集計器が拒否する）。
- 1件でも上限を超えたら `Not Met`。上限を上げて再実行しない。原因の調査と修正の候補を影響の見積もり付きで記録する。

## performance-validation との関係

`aidlc-state.md` に後の `performance-validation`（EXECUTE、`[ ]`）がある。上の目標はどれも手元で測れるので、この段階で確かめる。配布した site の Pages の制限（U6-NFR6.4・U8-NFR6.4b）だけは Deployment Pipeline が持つ。
