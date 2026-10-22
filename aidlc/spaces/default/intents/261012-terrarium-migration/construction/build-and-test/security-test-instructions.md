# Security Test Instructions

intent `261012-terrarium-migration` のセキュリティの確認の手順。project の決まりにより、Standard 戦略でも作る。品質担当が読取りだけで書いた。

## 範囲と、行わないこと

- 確かめるのは、各 Unit の NFR3（path の境界・archive・ELF・catalog の検証）、NFR4（有限の deadline・取消・retry なし）、NFR6（COI・same-origin Worker・CSP）、NFR8（identity の対応・秘密・notices・CI の最小権限）。
- **この repository には SAST・DAST・依存の脆弱性 scan の道具は導入されていない**（`mise-tasks/` と `package.json` の scripts に無い）。ここでは既存の試験と lint だけを確かめる。lint や Playwright の成功を SAST/DAST 全体の成功とは扱わない（team.md Code Style）。
- 常時稼働のサービスが無いので、常時稼働のサービス用の scan 基盤へ範囲を広げない。

## framework と道具

| 道具 | 使い方 | 版 |
|---|---|---|
| `node:test`・`bun test` | 入力の境界の試験（下の表） | latest |
| Playwright | COI・Worker・CSP・`Atomics.waitAsync` の受入 | latest、1 worker、retry 0 |
| actionlint・ShellCheck | `mise run lint:all` の中（workflow と shell の静的検査） | mise の実体 |
| `npm audit signatures` | U6 で npm の provenance を確かめた方法（U6 の code-summary「2. provenance」） | 最新の npm |

## 実行する command（1つずつ）

1. `mise run lint:all`：Biome・actionlint・ShellCheck（`--severity=warning`）。エラー0 が合格。既存の警告48・info 47 は数だけを記録する。CI の quality の job は Biome だけなので、actionlint・ShellCheck は**手元でしか**確かめられない。
2. intent の検証コマンド（VC-1）：`migration-preflight-unit`（archive・ELF・URL・redirect・上限 +1）、`showcase-unit`（config・resolve・acquire・archive・catalog・boundary・workflow）を含む。
3. `mise run showcase-boundary` と `mise run showcase-site:unit`（inject-csp・check-site・notices・workflow・summary・evidence）。
4. showcase site の受入（`mise run showcase-site-accept -- --project=<browser>`）：COEP require-corp、page・Worker・子 Worker の分離、CSP 違反0件、OSC 8 を開かない。違反があっても CSP の指令を緩めない。
5. vivarium：`mise run ci:fixed-guest-builder`（allowlist・40桁の commit・build-info・Release の権限）、`mise run ci:docs-unit`（coiServiceWorkerPin・stageFormicariumAssets・workflows）。
6. 秘密の混入の確認（読取り）：手順書・記録・log に token の値が無いこと。例：
   ```bash
   rg -n -e 'ghp_[A-Za-z0-9]{20,}' -e 'github_pat_[A-Za-z0-9_]{20,}' -e 'npm_[A-Za-z0-9]{30,}' .artifacts/build-and-test/logs aidlc/spaces/default/intents/261012-terrarium-migration .artifacts/u9-retirement/deletion-runbook.md
   ```
   pattern は**提案（未検証）**。一致したら値を表示せずに file と行だけを記録する。`github_pat_xxxx` のような例の文字列は除外の理由を書く。

## 今の main の CI で確かめられたもの（2026-10-22、`6a90a45b`、Node 26.12.1）

| 種類 | 試験（名前） | 証拠 |
|---|---|---|
| ELF・metadata の検証 | 「ELF architecture, dynamic interpreter, table overflow and load memory overflow reject」「full ELF and metadata digests reject tamper and unknown fields affect identity」 | `migration-acceptance-39709015067.log`（U2 55 pass） |
| path の境界 | 「relative, NUL, root escape, duplicate normalized and non-directory root reject」「every link rejects missing target, root escape and direct or mutual cycles」 | 同（U2・U3） |
| 上限 +1 | 「ELF exact byte limit accepts and plus one refuses before digest」「metadata counts toward 4096 entry bound including extension headers」「InputGuard refuses 65537 bytes and huge strings」 | 同（U2・U3・U4） |
| URL・redirect | 「HTTP, credentials, redirect loops and sixth redirect reject with ASSET_LOAD」「URL rejects origin-less relative, HTTP, credentials, fragments and alternate schemes」 | 同（U3） |
| workflow の最小権限 | 「the workflow is manual only, main of the upstream repository only, read-only and secret-free」「every action is pinned to a commit SHA and no checkout keeps credentials」 | 同（U4 の acceptance-ci） |
| Worker と waitAsync | 3ブラウザで `mainBundleWaitAsync:"undefined"`・`childURLsEqualDefault:true` | 同（MA:2597・2602・2607） |
| 取得元の固定 | 「取得物（.vendor/blink）の HEAD は blink.lock のコミットと一致し…」「fork に存在しないコミットを指すロックではエラーで止まる」 | `ci-39706177745.log`（Product node） |
| 公開経路 | 「fork context cannot reach publication」「new YAML refuses bypassed authorization, cross-run packages and token fallback」 | `ci-39706177745.log`（quality、release 124 pass） |

## CI でしか確かめられないもの

- workflow の実際の権限（`GITHUB_TOKEN Permissions`）は run の log でだけ見える。今回：ci.yml は `Contents: read`・`Metadata: read`、migration-acceptance.yml は `Actions: read`・`Contents: read`・`Metadata: read`。
- vivarium の Release の書込みが承認者付きの environment の別 job だけで行われること（U5-NFR8.1）の実 run、bump の自動 merge（U5-D7-AUTO）は ci-pipeline。

## 提案（未実装・未検証）

- 公開候補の source/pack の機密検出、依存の確認、`blink.lock` の取得元と commit、`dirty=false` の build-info、LICENSE/notices の同梱の確認を公開経路に入れる案（team.md Deployment の技術提案）。JS の devDependencies の照会だけで wasm 側を安全と扱わない。実装と検証は後の段階で行う。

## 判定の規則

- 拒否の試験が1件でも失敗・skip なら `Not Met`。
- 秘密の値が1件でも出たら `Not Met`。値は記録しない。
- CSP・COEP・権限を緩めて通さない。
