# U4 command Code Summary

## 4回目の再開：新しい土台（upstreamのmain `2a79860`）への合わせ（2026-10-18、Steps 11–16）

review-04のR-09〜R-12を、記録の更新と古い生成物の削除だけで直した。U4の製品コード（`runtime/command*.ts` ほか）と受入の入口のコード（`scripts/migration-command/*.ts`）は変えていない。lint・build・試験・候補作成・完了確認（Step 15）とレビュー・checkpoint（Step 16）はmain sessionが行う。この節の作成時点では、新しい土台でのU4の試験・coverage・36試行・B1の事前確認はどれも未実行（未検証）である。R-05〜R-08（Minor）は今回の範囲外として残す。

**この節より下（Status、実装したもの、追加Stepで直したもの、検証の結果、最終レビューへの対応、未完・未検証）は、古い土台の履歴である。** そこに出てくる `scripts/migration-command/ci.ts`・`ci-inputs.ts`・`mapCommandCICommand`、`.github/workflows/migration-command-u4.yml`、`.github/publication/` の公開runnerの作り直し、生成JSのjj追跡、sourceIdentity `cb49d17b…`（372 file）、pack `61b209ae…`、署名付きhead `9722db3e…`、branch `codex/terrarium-migration-u4`、CI run 39025918280・39029827794、ローカル22工程・B1 31 check・正式36試行・coverage 92.16%、検証コマンドの案 `verify-final-u4.mjs` は、古いsourceに結び付いたもので、新しい土台の成功証拠へ付け替えない。

### 新しい土台の状態（fileで確かめたこと、検証済み）（R-09）
- `git ls-files`：`scripts/migration-command` は `b1.ts`・`completion.ts`・`coverage.ts`・`measure.ts`・`stage.ts` の5件。`tests/migration-command` は12件（`.ts` と `browser-modules.d.ts`）。`ci.ts`・`ci-inputs.ts`・`.github/workflows/migration-command-u4.yml` はない（PR #32で退役）。追跡される `.js` はない（`.gitignore` 9行 `/scripts/**/*.js`、12行 `**/*.js.map`）。生成JSは `mise run build` が作る。
- task：`mise-tasks/migration/command-{unit,browser,stage,completion}.sh` が `bun run migration:command:*` を呼ぶ。実体はpackage.jsonの `migration:command:unit`（6個の個別試験：runner-ready・parse・dispatch・public・consumer・acceptance）、`migration:command:browser`（`consumer.spec.ts` を `--workers=1 --retries=0`）、`migration:command:stage`、`migration:command:completion`。
- 配布：`scripts/package/stage-package.ts` の `FIRST_PARTY_JS` は23件（`runtime/command-parse.js`・`command.js` を含む）、`PACKAGE_FILES` は33件。`tests/package/pack.test.ts` 36–37行が23・33を確かめる。
- `completion.ts`：`requireInstallActualSite(root)`（291行・339行）、`FORMICARIUM_COMMAND_LOCAL_ONLY`（304行）、CI証拠の照合 `checkCommandCIEvidence`（262–280行、`recordKind: 'observed-ci-summary'`）、reportの `status`（384行）・`acceptancePassed: !localOnly && ci !== null`（396行）・blockers（398行）・`b1.formal`（403行付近）。
- `traceability.json`：FR6の対象は `scripts/migration-command/b1.ts`（関連に `completion.ts`・`scripts/migration-install/actual-site.ts`）、NFR8.1は退役した `ci.ts` から `scripts/migration-command/completion.ts` へ、NFR8.2は退役したworkflowから `tests/package/pack.test.ts`（license/noticesの同梱）へ直した。FR6とNFR8.1は、正式受入が今は成立しないのでGAPにした（下の受入の方法）。ほかの対象（runtime 2件、`types/index.d.ts`、`docs/command-api.md`、`scripts/migration-command/{b1,completion,coverage}.ts`、`tests/migration-command/*` 4件、`tests/package/pack.test.ts`、`scripts/migration-install/actual-site.ts`）は、すべて `git ls-files --error-unmatch` で追跡されている（exit 0）。

### 受入の方法（人間が決めた、2026-10-18。U3と同じ）と必須入力（R-10）
古い土台での受入（ローカル22工程、署名付きCI run 39029827794、B1 31 check）は、古いsourceの履歴として残す。新しい土台では、手元のactual-siteと `FORMICARIUM_COMMAND_LOCAL_ONLY=1` で暫定の完了確認だけを行う。その結果は `status: 'local-provisional'`・`acceptancePassed: false`・`b1.formal: false` であり、U4の正式受入でもB1の正式な行でもない。
- (a) actual-site：`completion.ts` は最初に `requireInstallActualSite`（`scripts/migration-install/actual-site.ts` 164–172行）を呼ぶ。これは `U2_ACTUAL_SITE` が `.artifacts/migration-install/actual-site` と一致することを求め、固定11ファイルを検査するだけである。手元には検査済みのcopy（U3の確認で使ったもの）だけがあり、clean checkoutから作る手段（旧 `scripts/migration-install/ci-inputs.ts`・`ci.ts`）は追跡コードにない。したがって、このファイル群は手作業で用意する前提である。ローカル専用モードでも、これがなければcompletionは最初に止まる。
- (b) CI証拠：非localの完了（`verified-with-ci`）は `FORMICARIUM_COMMAND_CI_EVIDENCE` の `recordKind: 'observed-ci-summary'` を求める。追跡コードで `observed-ci-summary` を扱うのは、`scripts/migration-command/completion.ts`・`scripts/migration-install/completion.ts`・`scripts/migration-session/completion.ts` の検査側と、`tests/migration-command/acceptance.test.ts` の試験用の値だけで、書く側（旧 `scripts/migration-command/ci.ts` とworkflow）はない。CI証拠がないとblockersは `['new U4 signed CI not independently verified']` になる。したがって、新しい土台では `verified-with-ci` の完了とB1の正式な行は今は成立しない。
- (c) この2つ（actual-siteの作り方と、CI証拠の作り手または非local受入の要件）は、U1〜U4のまとめた最終確認とterrariumの受入で決める。基準は緩めない。それまでU4は正式受入未了である。

### `source-manifest.json`（R-11）：47件 → 48件
追加した4件：`mise-tasks/migration/command-browser.sh`・`command-completion.sh`・`command-stage.sh`・`command-unit.sh`（PR #29でU4のtaskとして追加されたもの）。48件すべてが `git ls-files --error-unmatch` で追跡対象であることを確かめた（exit 0）。

外した3件と理由（fileとPR #29（`f5bc078`）のdiffを読んで、U4が書いた内容が残っていないことを確かめた）：
- `mise.toml`：U4のtaskはない（`[tools]` だけ。U4のtaskは `mise-tasks/` にある）。PR #29で変わっておらず、最後の変更はmainのPR #24。
- `tests/tooling/publication-alignment.test.ts`：PR #29で変わっておらず（最後はmainのPR #27）、項目7で書いた23件・33fileの期待値は残っていない。
- `scripts/terrarium/coverage.ts`：項目1の `mode: 'strip'`（521行）は、PR #29より前のmainに既にあった（`f5bc078~1` の475行）。PR #29の差分は `HISTORICAL_U1_JS`・`CURRENT_U1_REALMS` などU1の世代の判定で、U4の内容ではない（U1・U2のmanifestがこのfileをclaimしている）。

外さずに残した共有fileと理由（U4が書いた内容が今のfileに残っていることを確かめた）：
- `bun.lock`：Step 1の `@types/node` `^26.6.5`（12行、PR #29で `^26.6.4` から）。U3も同じ行を引き受けてclaimしている。
- `scripts/release/inventory.ts`：項目7の `runtime/command-parse.js`・`runtime/command.js`（35–36行）。
- `tests/package/core.test.ts`：項目5の `'-L', '/dev/null'`（81–82行）。
- `tests/package/coverage.test.ts`：`command`・`command-parse` と23件（832・841–842・1017・1138行）。項目4。
- `tests/package/pack.test.ts`：23件・33件（36–37行）。項目4。
- `tests/package/public.test.ts`：`createCommandSession`（9行）。項目4。
- `tests/terrarium/coverage.test.ts`：`command-parse`・`command` と23件（426–433行）。項目4。
- `tests/migration-install/consumer.spec.ts`・`consumer.test.ts`・`hash-regression.spec.ts`：`u3-install` と `u4-command` の両方を受け付ける（9・13・6行）。項目4。U3もclaimしている。
- `tests/migration-install/lifecycle.test.ts`：模擬portの `resolvePath()`（44行）。項目3。U3もclaimしている。
- `tests/migration-preflight/current-completion.test.ts`：23件と `runtime/command.js`（288–289行）。項目4。
- `tests/migration-session/reservation.test.ts`：`resolvePath` の回帰（228行以降）。項目3。U2もclaimしている。
- `tsconfig.json`：`tests/migration-command/browser-modules.d.ts`（27行）。項目2。
- `tsconfig.tests.json`：`tests/migration-command/types-invalid.ts` の除外（8行）。Step 4。

manifestに加えなかったもの（参考）：`scripts/package/coverage.ts` 383行の許可リストの `command`（古い土台の最後の確認で人間の指示により直したもの）は残っているが、U1〜U3のmanifestが既にclaimしており、この計画のStep 13の対象に入っていないので加えていない。`tests/terrarium/current-candidate.test.ts` の31→33の変更は、mainのPR #34で `PACKAGE_FILES` との照合に置き換わり、U4の内容は残っていない。

### 古い生成物の削除（R-12の一部）と残余リスク（R-12）
- gitignoreされた古い生成物8件を `rm` で消した：`scripts/migration-command/ci.js`・`ci.js.map`・`ci-inputs.js`・`ci-inputs.js.map`（`git check-ignore -v` で `.gitignore` 9行・12行に一致）と、`.build/scripts/migration-command/` の同じ4件（`.gitignore` 5行 `/.build/` に一致）。どれも追跡されておらず（`git ls-files --error-unmatch` は不一致）、対応する `.ts` はない。消したあと、`scripts/migration-command`・`tests/migration-command`・`.build/scripts/migration-command`・`.build/tests/migration-command` のすべての `.js` に、追跡される同名の `.ts` があることを確かめた。`ci*` は0件。
- 残余リスク（R-12）：`commandSourceInventory`（`scripts/migration-command/stage.ts` 47行）と `sessionSourceInventory`（`scripts/migration-session/stage.ts` 62行）は、正規表現 `/\.(?:ts|js|json)$/` でdirectoryを走査し、追跡の有無を見ない。生成 `.js` も拾うので、`sourceFiles`・`sourceIdentity` は追跡sourceだけのmanifestとも、clone直後の状態とも一致せず、build前後でも変わる。消した `ci.js`・`ci-inputs.js` は、残っていればU4のsourceIdentityに入っていた。コードは変えていない。直すと U2の `stage.ts` が変わり、U1〜U3の承認に影響するので、直すかどうかはU1〜U4の最終確認で決める。
- 残余リスク：`completion.ts` 349行の固定値 `coverageReport.files.length !== 23` は、いまの値（23）では正しいが、配布一覧が変わると黙って合わなくなる。直すかどうかはU1〜U4の最終確認で決める。

### Step 15：新しい土台での確認（2026-10-18、main sessionが1つずつ実行、検証済み）
- `mise run lint:all` exit 0（エラーなし。警告48件・情報47件は既存）。`mise run typecheck` exit 0。`mise run build` exit 0（build後も `scripts/migration-command`・`scripts/migration-install`・`.build/scripts/migration-command` に `ci*` は0件）。
- `mise run test:light` exit 0：bun 71件・37件pass、node 125件中123pass・fail 0・skip 2（既存）、tooling 130件pass。
- 候補：`FORMICARIUM_SESSION_SOURCE=2a79860351b7bdeabff8b3424393694943a6a6bb mise run migration-command-stage` exit 0。`.artifacts/migration-command/candidate-d77d6fc3-f79e-4534-bf44-e369865f4981/package.manifest.json`（sourceIdentity `50ce5bc2…d209`、pack SHA256 `430189e8…6625`。packの中身はU3の新しい候補と同じ）。独立consumerは `/private/tmp/formicarium-u4-consumer-20261018`。固定guestは `.artifacts/u2-release-inputs/aube-v2.7.0/aube`。
- `mise run migration-command-unit` exit 0：91件pass、fail・cancel・skip・TODO 0。
- `mise run migration-command-browser` exit 0：9件pass（Chromium・Firefox・WebKit、1worker・retry0）。
- 暫定の完了確認：`.artifacts/migration-command/tls-20261018/run-local-provisional-completion.sh` を人間がターミナルで実行した（ログインkeychainへの一時的な信頼の登録は人間が承認。U3と同じ有効期限1日のlocalhost証明書、SHA256 `c2afea8e…5795`）。`dist/guests/pitchfork` はU3の確認で今のmainの手順で作り直したもの。
  - 全22工程exit 0（出力 `.artifacts/migration-command/completion-81bcc843-3352-489b-aeda-aaea62db0c19`）。`local-provisional-report.json`：`status: 'local-provisional'`、`localPassed: true`、`acceptancePassed: false`、`b1.formal: false`、blockerは `new U4 signed CI not independently verified`、実機Safariは未検証。
  - coverage：23JS、1613 realm、行2055中1894（92.16%）、基準80% passed。
  - 36試行：passed、基準3000ms。非download中央値の最大はBiome/Firefoxの2793.58ms（余裕約7%。aube/Firefox 2010.80ms、ほかは1100ms以下）。ローカル1回の値で、余裕は小さい（U3のR-06と同じ種類の残余リスク）。
  - B1の事前確認：`b1-acceptance.json` の31 checkがすべてpassed。ローカルの行であり、B1の正式な行ではない。
  - 終了後、証明書はkeychainにない（`security find-certificate` exit 44）。
- これはU4の暫定の確認であり、正式受入でもB1の正式な行でもない。正式受入（actual-siteの作り方とCI証拠）は、U1〜U4のまとめた最終確認とterrariumの受入で決める。

## Status

U4（C05の公開command API）の実装、ローカルの正式受入、署名付きCIの照合が、最終的なsourceで成功した。独立した最終レビューと、新しい読取り専用の検証コマンドの承認・設定、U4のcheckpointは、まだ済んでいない。実機のSafariは未検証。

- source：sourceIdentity `cb49d17b41f70d7ac5b962fcbba0328b6481d17ae4d65a07d3eda6e68074b53b`（372 file）、pack `61b209ae1c98690f4f69eeca25c06f6485d05420c339283416e0aff91ea9cb98`（33 file、第一者配布JS 23件）。
- 署名付きhead：`9722db3e254dd73604f42ed4d85cbc53edf35404`（親 `ec8ab359…`、その親 `7c7ceaf4…`。GitHubのverificationはverified・valid）。branch `codex/terrarium-migration-u4`。

## 実装したもの

- `runtime/command-parse.ts`：InputGuard・Tokenizer・ListingFormatter（D1／W2、BR4.2–BR4.7、BR4.11）。孤立surrogateは `isWellFormed()`、byte数は `TextEncoder` の長さ。lsはUTF-16 code unit順。
- `runtime/command.ts`：CommandDispatcher・BuiltinAdapter・InstallAdapter・GuestRunAdapter・ResultBuilder（BR4.1、BR4.8–BR4.17）。判定順は INVALID_INPUT → ABORTED → DISPOSED／BUSY。予約名は `ls` `cat` `rm` `cd` `install`。guest runはtimeoutMsを渡さない。
- 公開API：`runtime/public.ts` の `createCommandSession`、`types/index.d.ts` の `CommandOptions`・`CommandResult`・`CommandSession`。内部portは非公開。
- 配布：第一者配布JSを21件から23件に（`runtime/command.js`・`runtime/command-parse.js`）。
- 受入入口：`scripts/migration-command/{stage,coverage,completion,ci,ci-inputs,b1,measure}.ts` と `.github/workflows/migration-command-u4.yml`（contents read、専用branch、直列、360分、job専用CA、artifact 7日）。
- 文書：`docs/command-api.md`、README.mdのAPI一覧。

## 追加Stepで直したもの（人間の承認による）

1. `scripts/terrarium/coverage.ts` を `mode:'strip'` に（Node 26）。
2. tsconfig.jsonにU4のbrowser型宣言を追加。
3. U2の内部SessionPortに `resolvePath` を追加（U2がBR2.12として引き受け、C02に追記）。
4. 23件に合わせて、U1〜U3の試験・入口の期待値を更新（各Unitがやり直しで引き受け）。
5. blink.log：`runtime/core.ts` の `blinkCore.argv` が先頭で `-L /dev/null` を渡す。回帰試験は `tests/migration-command/public.test.ts`（計画では新しいfileの予定だったが、`mise.toml` を変えるとU1〜U3がやり直しになるため既存のU4のfileに置いた）。`tests/package/core.test.ts` の期待値を更新。
6. U4の薄いmeasure CLI（`scripts/migration-command/measure.ts`）。U3の受入入口からU4への依存をなくし、U4の `stage.ts` の重複定義を削除。
7. 公開用inventory（`scripts/release/inventory.ts`）を23件・33fileに。公開runnerを固定のBun 1.4.3・Biome 2.5.15で作り直した。公開の境界（U4/B1の証拠なしでは23件のpackを公開しない）は維持。
8. U4のCIのcommand対応に `scripts/migration-command/measure.js` を追加し、全工程をCIの対応に通す試験を追加。

ほかに、最後のまとめた確認の中で、`tests/terrarium/current-candidate.test.ts` の期待値（31→33）、U4のNode realmの期待値（U3＋3 worker）、共有の `scripts/package/coverage.ts` のsuiteの許可リスト（`command` を追加）を、人間の指示で直した。どれも先にREDを確かめてから直した。

## 検証の結果（mainの観測、Node v26.12.0）

- ローカルの正式受入（候補 candidate-dd7a49a3、completion-210dad10）：22工程pass、coverage 92.16%（2055行中1894行、23 file、skip 0）、正式36試行pass（最大の中央値 biome/firefox 2559.2ms）、B1の31 checkがpass（ローカルなので `formal:false`）。
- 署名付きCI：1回目（run 39025918280）は `measure` 工程がCIのcommand対応で拒否されてfailure（項目8で修正）。2回目（run 39029827794、attempt 1）はsuccess。job `verify` の全stepがsuccess。artifact sha256:42a8372d…（473608 bytes）。CIの22工程pass、coverage 92.16%、正式36試行pass（Linux HeadlessChrome 156など。最大の中央値 biome/firefox 1785.8ms）、B1の31 checkがpass（sourceCommitは署名付きhead）。sourceとpackはローカルの受入と一致。
- 読取り専用の検証の案（`.artifacts/migration-command/verify-final-u4.mjs`、binding `final-u4-binding-39029827794.json`、binding SHA256 c4c7407b3fe5d7e45ebd251419e48cabb48f7bf8cb3339327244243f7e14e9c3）：開発中の試走でpass（約46秒）。改変の拒否の試験（`verify-final-u4.test.mjs`）は10件pass。この検証コマンドは、人間の承認を受けてから設定する。
- 既存の回帰：test-light（package 194・tooling 237件）、U4のunit 96件、browser 9件、Nodeのcoverage 188件。どれもfail・skip 0。

## 最終レビュー（review-01、NOT-READY）への対応

- Major（検証コマンドがU3のものより弱い）：検証コマンドを直した。U1の固定資産とU4のCI入力manifest（SHA256 48fdb7f5…、CIが使ったものと一致）からformal catalogを作り直し、各試行の `raw.input` とcatalogSha256を照合する。TLSのissuer・subject・protocolとhost benchmarkを照合する。B1のbrowser行は、ログに `[chromium] ›`・`[firefox] ›`・`[webkit] ›` の結果行があることを確かめる。B1の `sourceCommit`（CIは署名付きhead、ローカルはbase revision）と `preflightEvidenceId`（`readPreflightEvidenceId` で読み直した値）は、検証対象の外の値と照合する。署名前のcommit `f5340c80…` と署名付きhead `9722db3e…` のtree（`d7a2b4ef…`）と親を、ローカルのgitで照合する。証明書の削除の受領記録（`.artifacts/migration-command/trust-cleanup-final-u4.json`）を封印し、検証のたびにkeychainに無いことも読取りで確かめる。
- Minor（試験が名前の理由で失敗するとは限らない）：80%・中央値・B1の各試験を、名前の理由で拒否されることを確かめる形に直した。B1では、sourceCommitの違いと、browserのproject結果行の欠落も拒否することを加えた。改変の拒否の試験は10件pass。
- Minor（計画の項目5の記述）：計画に実施時の変更を追記した。
- Minor（README.mdの87行目、docs/command-api.mdの5行目の「未検証」の記述が、署名付きCI成功後の状態と食い違う）：直していない。README.mdはpackに入るので、直すとsourceとpackのidentityが変わり、最後のまとめた確認とCIをやり直すことになる。次にsourceを変えるときに直す。
- Minor（空入力と取消済みsignalの組み合わせ）：設計の判断も試験もない。製品コードの変更になるので、今回は直さず、持ち越す。

## 未完・未検証

- 独立した最終レビュー、新しい検証コマンドの承認と設定、U4のcheckpoint。
- 実機のSafari（WebKitの結果を実機の合格としない）。
- U5〜U9は未着手。U5はU4の完了を開始条件とする。
- publication（npm公開）は、この計画に含めない。
