# terrarium からの移行：各部分の設計・検証・運用（〜2026-10-22）

terrarium の機能を formicarium と vivarium へ移し、terrarium を退役させた作業の、各部分（U1〜U9）の設計の要点、品質の目標と結果、配布と運用、残った課題をまとめる。計画の全体は、git の commit `c8ddd83c` の `docs/terrarium-migration-plan-summary.md` にある。数値はすべて記録にあるもので、記録の日付は 2026-10-22（最後の確認の日）。

## 各部分の設計の要点

共通の方針：TypeScript strict・ESM を続け、新しい DB・backend・常駐のサービス・AWS は使わない。基盤は GitHub Actions・GitHub Release・GitHub Pages・npm だけ。取得の失敗は有限の時間で終わらせ、別の URL への切替や retry はしない。開発の道具は最新版を使う（Node 26.12.1・Bun 1.4.3・Playwright 1.64.1・Biome 2.6.2・TypeScript 7.0.2 で確認）。

### U1 初期試行（preflight）

- 何か：aube の公式 musl tar.gz と Biome の musl binary を、3ブラウザ（Chromium・Firefox・WebKit）× 2ツール × trial 0〜5 の36行で、取得 → 展開 → SHA256 → ELF 検証 → 登録 → 実行まで測る。vivarium の CI で Biome の baseline を1件ビルドし、同じ key の2回目でコンパイルを省けることも確かめる。
- 主な決定：取得（fetch）と非ダウンロードの5工程を分け、単調時計で測る。上限は取得 120秒・build 4時間、DL 128MiB・展開 256MiB・ELF 128MiB、wasm 1GB、1 worker。HTTPS の同一 origin ミラーで COI・SAB・CSP を保つ。redirect は5 hop まで各 hop を検査する。
- 修正（PR #68）：`extractTar` が 64 entry ごとに取消を確かめるようにし、trial の記録に OS・CPU・負荷・試験の source commit を足した。
- 試行の記録は、git の commit `c8ddd83c` の `docs/results/terrarium-migration-preflight.md` と `docs/results/terrarium-migration-preflight-evidence/` にある（ただし内容は修正の前の時点）。

### U2 session・guest API

- 何か：公開の guest 検証 API。`validateGuest`・`fixtureToFsEntries`（同期）、`runValidatedGuest`・`registerValidatedGuest`（非同期）を root export に足した。既存の `Session` の API は変えない。
- 主な決定：入力の bytes と metadata を防御的に写し、検証が全部通ったときだけ非公開の brand 付き handle を返す（偽造・別 instance の handle は権限を持たない）。session の予約は1つで queue を持たず、競合は `BUSY`。reset・dispose は epoch を進め、古い応答の commit を拒否する。内部の port（C02：acquire・commitGuest・runInstalled・builtin・release）を U3・U4 が共有し、状態を複製しない。
- ブラウザの bundle の Worker では `Atomics.waitAsync` を消したまま保つ。

### U3 install

- 何か：呼出し元の固定カタログから guest を取得・展開・検証して session に登録する `createInstaller`。API は [install-api.md](../install-api.md)。
- 主な決定：カタログは deep copy した snapshot で、latest の解決・永続 cache・builder を持たない。取得は 120000ms・180000ms の期限、5 hop、retry なし。download と ELF の digest を照合し、brand 付きの写しだけを登録する。Node では基準 origin の無い相対 URL を `INVALID_INPUT` にする。Progress は順序を持ち、unknown と0を区別する。

### U4 command

- 何か：1行の文字列を解釈し、U2・U3 へ振り分ける `createCommandSession` と `execute`。API は [command-api.md](../command-api.md)。
- 主な決定：Tokenizer は依存を足さず5状態の状態機械で自前に書く（shell-quote などは採らない）。パイプ・変数展開・リダイレクトは拒否する。builtin は `ls`・`cat`・`rm`・`cd`、`install`、それ以外は guest の実行。入力は 65536 bytes まで、65537 と LF・CR・NUL を拒否。予約名は guest から呼べない。guest の実行は既定の timeout 600000ms。
- U2〜U4 をまとめた配布候補（B1）の pack は prerelease `b1-a3370ca4df1f` に置いた。

### U5 固定 guest の build（vivarium）

- 何か：vivarium の recipe が宣言した tool・repository・40桁 commit から、native の builder で静的 ELF を作り、vivarium の GitHub Release に保存・再利用する。
- 主な決定：key は tool・repository・commit・builder hash などから作り、Release の tag は `guest-<tool>-<key の64桁>`。1つの Release に `biome`・`build-info.json`・`catalog.json` の一組だけを置き、上書き・削除しない。build の job は `contents: read` だけで、Release への書込みは承認者付きの environment `fixed-guest-release` の別の job。Rust と target は upstream の設定に従い、builder 自身の道具は最新版にする。mbx（Rust の build cache）の有無で同じ digest になること、cache の保存は main だけ。build-info に source・target・rustc・sourcePatches・依存・builder を記録する。
- bump の PR は、必須の check が通ったら自動で merge する設計に変えた（vivarium #556）。

### U6 recipe の実行（vivarium）

- 何か：vivarium の再現 recipe を formicarium の runtime で動かす最初の recipe。題材は `JamBalaya56562/biome` の branch `fix/migrate-prettier-override-bracket-spacing`（baseline と fix を1ページの2つの端末で比べる）。当初の題材 biome-12265 は vivarium で既に消えていたので、人間の判断で変えた。
- 主な決定：formicarium は npm の固定版（0.3.0）の tarball を pin file（`src/layer1_wasm/formicarium.pin.json`、版・SHA256・source commit・file 一覧）で固定し、site の build で同じ origin に置く。固定 guest も build 時に Release から取って同じ origin に置き、ブラウザで取り直して照合してから登録する。分離は coi-serviceworker 0.1.7（SHA256 固定、`coepCredentialless` は false）。terrarium の互換 adapter は作らない（ready・run・transcript だけ）。recipe は build 入力の `commit` と受入済みの `accepted`（commit・buildKey・digest）を分ける。

### U7 showcase の候補（formicarium の `showcase/`）

- 何か：aube・pitchfork・Biome の最新安定版を解決・取得・検証してカタログにし、配布の候補（Actions artifact）を作る。
- 主な決定：latest release を GitHub REST で1回だけ解決し、tag と40桁 commit を固定する。aube・Biome は公式の static musl 資産の SHA256・サイズを照合し、公式資産の無い pitchfork だけ source build。ツール固有の条件は `showcase/tools.json` の設定 data に置く。showcase は公開 export だけを import し、本体から showcase への参照も禁止（`showcase:boundary` で機械検査）。権限は `contents: read`。候補は Node と3ブラウザ × 3ツールの12行がすべて合格したときだけ作る。

### U8 showcase site

- 何か：Astro と Starlight の静的 site（`showcase/site/`）を `https://aletheia-works.github.io/formicarium/` に配る。トップはエミュレータの説明、`/tools/` に3ツールのカード、`/tools/<tool>/` は導入済みの端末、`/terminal/` は空の端末、guides 6ページ。英語と日本語。
- 主な決定：端末は @xterm/xterm。formicarium の pack は Vite で bundle せず bytes のまま `_formicarium/<version>/` に置く（pack の identity を保つため）。coi-serviceworker で COOP・COEP を page 側で付ける。site 全体は 1073741824 bytes 未満。受入は Playwright の3ブラウザ × 16件、1 worker、retry なし、1件 180秒・準備 120秒。配布の後に `site-identity.json`（run number・source commit・candidate）が main と一致することを確かめる。Pages と environment は OpenTofu（`infra/github`）で管理。
- 変更：当初は日次の schedule で配る設計だったが、#54 で main への push と手動の実行だけにした。最初の deploy の承認者は #55 で外した。

### U9 退役

- 何か：terrarium への参照を formicarium と vivarium から消し、terrarium の repository・fork・npm package を消す。
- 主な決定：削除は元に戻せないので、手順書を作って人間が行う。npm は unpublish（deprecate は使わない）。OpenTofu の terrarium の state は destroy しない（repository の削除で消える）。release の判定から terrarium の consumer の受入を外し、代わりは足さない。名前に terrarium がある formicarium 自身の code は名前を変えて残す（例：`integration/terrarium/guest-distribution/` → `integration/guest-distribution/`、`docs/guest-distribution.md`。どちらも commit `300969f5` まで存在）。公開の名前は変えない。

## 品質の目標と結果

判定は Build and Test の時点（2026-10-22）。全170件で Met 147・Not Met 6・Unverified 10・N/A 7（N/A は CI で確かめる行で、CI の確認では U5-D7-AUTO を除き Met）。後の確認へ回した8件は、その後の運用の確認で答えた（右端の列）。基準・timeout を緩めた確認は無い。

| 部分     | 目標                                                                               | 結果                                                                                                                       | 判定                   |
| -------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| 共通     | probe の1回 ≤600秒、8項目すべて合格                                                | Node の probe 5643.7ms、ブラウザ 1.3〜1.9秒、8項目 pass                                                                    | Met                    |
| 共通     | aube のブラウザの1回 ≤840秒、native と完全一致                                     | 6.4/8.1/7.0秒、出力一致                                                                                                    | Met                    |
| 共通     | 全 Playwright config が1 worker・retry なし、wasm 上限 1GB                         | すべて `workers: 1`・`retries: 0`、1GB を assert                                                                           | Met                    |
| 共通     | 変わっていない aube を作り直さない                                                 | 実行の前後で SHA256 が同じ                                                                                                 | Met                    |
| U1〜U4   | 第一者の配布 JS 23件の全 realm で行 coverage ≥80%（固定分母）                      | 92.16%（1894/2055）                                                                                                        | Met                    |
| U1・U3   | 非ダウンロード工程の中央値 ≤3000ms（3ブラウザ × 2ツール）                          | U1：457.3〜674.1ms（PR #68 の後）。U3 の正式 install：最大 2595.0ms（手元）・2587.3ms（CI）、どちらも biome/Firefox        | Met                    |
| U1       | 計測の環境（OS・CPU・負荷・source commit）を記録                                   | 最初は欠けて Not Met。PR #68 で足して36試行をやり直した                                                                    | Met                    |
| U2       | bundle の Worker で `Atomics.waitAsync === undefined`                              | 3ブラウザで undefined                                                                                                      | Met                    |
| U2       | 3ブラウザ × en・ja × 初回・再訪問で COI・SAB                                       | 12訪問すべて true、24端末が ready                                                                                          | Met                    |
| U3・U4   | 今の source で正式な完了確認（`verified-with-ci`・`b1.formal: true`）              | 成功。ただし source は `6a90a45b` で、その後の main で同じ候補かは未確認                                                   | N/A（CI の確認で Met） |
| U5       | builder の lint・型・試験、coverage を下げない                                     | 188 pass・0 fail・98.49%。ただし vivarium の Biome が 2.5.15（最新 2.6.2 でない）。記録の後、vivarium #563 で 2.6.2 に更新 | Unverified             |
| U5       | build-info に source・commit・target・rustc・sourcePatches を記録                  | 2つの Release で全欄あり、SHA256 が recipe と一致                                                                          | Met                    |
| U5       | 秘密を出さない、license・notices を保持                                            | 秘密の pattern は無い。Release の asset は3つだけで license・notices が無く、builder に扱う code も無い                    | **Not Met**            |
| U5       | bump の PR が自動で merge される                                                   | 仕組みはあるが、#556 の後に実際の bump の PR が無い                                                                        | Unverified             |
| U6       | 3ブラウザ × en・ja の各件 ≤180秒、retry 0                                          | 最長 10.6秒（firefox en）                                                                                                  | Met                    |
| U6       | 今の `accepted` の ELF ≤128MiB                                                     | 112,564,936・112,500,608 bytes                                                                                             | Met                    |
| U6       | 第一者 TS の行 coverage ≥80%                                                       | 83.51%（vivarium の regression (chromium)）                                                                                | N/A（CI の確認で Met） |
| U6       | site 全体が Pages の上限以下                                                       | 延期 → 運用で 235,607,368 bytes（上限 1GB）                                                                                | Unverified → Met       |
| U6       | 公開 site で W5（3ブラウザ × en・ja × 初回・再訪問）                               | 延期 → 運用で12行すべて `reproduced`                                                                                       | Unverified → Met       |
| U7       | `showcase/scripts/**` の行 coverage ≥80%                                           | 88.60%                                                                                                                     | Met                    |
| U7       | 実際の12行（Node 3行・ブラウザ 9行）がすべて合格、4環境で3ツールの `--version`     | すべて passed                                                                                                              | N/A（CI の確認で Met） |
| U8       | 受入16件 × 3ブラウザ、各 ≤180秒・準備 ≤120秒                                       | すべて passed（6.1分・2.8分・3.2分）                                                                                       | Met                    |
| U8       | `showcase/site` の第一者 `.ts` の行 coverage ≥80%（node と Chromium の V8 の合算） | 94.51%（5151/5450）。単体だけでは 73.78%                                                                                   | Met                    |
| U8       | site 全体 <1073741824 bytes                                                        | 運用で 148,507,859 bytes、最大の file 83,524,512 bytes                                                                     | Met                    |
| U8       | 配布した run の証拠が全行 passed、`site-identity.json` が一致                      | 延期 → 運用で 27 checks passed、main の最新と一致                                                                          | Unverified → Met       |
| U8       | 失敗の通知と summary                                                               | 延期 → 今の形で満たすと記録。通知が実際に届くかは未検証                                                                    | Unverified             |
| U9       | 消した試験と code の対応表、分母を変えない                                         | 対応表あり、分母（release の固定24件）は不変                                                                               | Met                    |
| U9       | 一覧の各行に記録の path と測定の日付                                               | 測定の日付が無い                                                                                                           | **Not Met**            |
| U9       | repository・fork が無い、npm 404、JSR が404か版0件、Pages 404                      | JSR は削除できず archive、meta は 200 で3つの版が残る。人間が失敗のままと承知                                              | **Not Met**            |
| U9       | 残してよい path の外で terrarium の言及0件                                         | `aidlc/` の外に34 file（32 file は後の作業、2 file は CI の制約）                                                          | **Not Met**            |
| U9       | 各段の日時と結果が順に並ぶ                                                         | 確認の時刻だけで実行の時刻が無く、実際の順も手順書と違う                                                                   | **Not Met**            |
| U9       | download・JSR の版・dependents の値と取得元                                        | 取得元の URL が無く、dependents は読めなかった                                                                             | **Not Met**            |
| 試験の量 | 部品ごとに5〜8件以上（TC-1）                                                       | log が部品ごとの件数を出さず判定できない。5件未満の file もある                                                            | Unverified             |

途中の失敗と直し方：
- `runner-ready` の試験が Node の patch 版を `26.12.0` に固定していて、26.12.1 の CI で失敗した。major の版だけを確かめる形に直した（PR #65）。
- `showcase.yml`・`showcase-site.yml` が `node-version: '26.12.0'` に固定していた。`latest`・`check-latest: true` に直し（PR #66）、最新の Node で受入をやり直した。
- U1 の取消と計測の環境の記録を PR #68 で直した。
- 実機の Safari はどの部分でも未検証（WebKit は Playwright の同梱版で、その成功を実機 Safari の合格とは扱わない）。

## 配布と運用

段階の切替（blue/green・canary）や feature flag は使わない。staging のサービスも無い。公開の前の確認は PR の必須の check と、merge の後に人が起動する `migration-acceptance.yml`（U2〜U4 の consumer・3ブラウザ・completion）で行う。

| 配布先                            | 経路                                                                                                                                     | 承認の点                                                | 配布の後の確認                    |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | --------------------------------- |
| npm `@aletheia-works/formicarium` | main → release-please の release PR → 人が merge → `v*` tag → `publish.yml`（Trusted Publishing、`--provenance`、environment `release`） | release PR の merge が公開の承認                        | registry の integrity の照合      |
| showcase site（GitHub Pages）     | main への push → `showcase-site.yml`（候補・build・3ブラウザの受入・coverage・証拠 → deploy → verify-deployment）                        | main への merge                                         | `site-identity.json` の一致       |
| vivarium の guest の Release      | `fixed-guest-build.yml` → `fixed-guest-release.yml`                                                                                      | environment `fixed-guest-release` の required reviewers | builder の `verifyArtifactSet`    |
| vivarium の docs（Pages）         | main への push → `deploy-docs.yml`（build・staging・check-site の後に deploy）                                                           | main への merge                                         | なし（check-site は deploy の前） |
- npm の公開の仕組みと必須の check は [automated-releases.md](../automated-releases.md)、初期の公開の経緯は [release-assurance.md](../release-assurance.md) にある。毎週の自動の merge（`WEEKLY_RELEASE_MERGE_ENABLED`）は false のまま。true にすると承認の点が無くなる。
- 必須の check（formicarium の ruleset `main`）：`quality`・`commit-format`・`ci-required`・`check / Commitlint`・`showcase-site-required`。U1 の preflight・preflight-current と U5 の guest-build の単体は PR #67 で `ci-required` に入れた。U1 の36試行は証明書の一時登録が要るので CI では行わない。
- 記録（PR #69・vivarium #562）：build ごとに site 全体の bytes と最大の file を記録し、formicarium は deploy の時間も step summary に書く。Pages の上限（公開する site 1GB、deploy 10分）に近づかないかを見る。1 file の上限は公式の文書に無いので足さない。
- 観測：dashboard・数値の SLO・自動の異常検知・独自の通知は置かない。GitHub Actions の標準の通知（run を起こした人へ）、showcase site の summary（最後に deploy した run からの日数、失敗した job）、site の大きさ・最大の file・deploy の時間、`site-identity.json` と main の一致、`npm view ... dist-tags` を見る。設計では「最後の deploy から2日以上で失敗にする」としていたが、今の code は日数を出すだけで失敗にしない（今の形で良いと記録した）。
- 切戻し（元に戻せない操作はしない。どれも実行の前に人間の承認）：
  - npm：開いている release PR を merge しない → `npm dist-tag add @aletheia-works/formicarium@<good> latest` → `npm deprecate` で理由を付ける → `npm view` で確かめる。unpublish はしない。直した版は通常の経路で新しい版として出す。merge してしまったら `publish.yml` の run を cancel する。
  - showcase site・vivarium の docs：問題の commit を revert する PR を merge し、通常の経路で配り直す。前の artifact を手で再 deploy はしない（受入を通らない site を出さないため）。
  - vivarium の guest：recipe の `accepted` を前の build へ戻す PR を出す。Release は消さない。
- 2026-10-22 の状態：showcase site は main の最新 `1bdd984a`（run 39761271174、deploy 約13.3秒）、vivarium の docs は `8a2649ef`（run 39760158634）。npm は `latest: 0.3.0`・`next: 0.1.0-rc.1`。

性能の確認（2026-10-22、運用での測定）：U3 の正式 install の中央値は biome/Firefox が 2587〜2595ms で、基準 3000ms の約86%。余裕が小さいが基準は変えない。超えたら止めて負荷を確かめ、測り直す。vivarium の公開 page の受入は最も遅い Firefox の en の初回で 34.5秒（上限 120秒）。server が無いので負荷の試験は対象外。

## 成果

formicarium の PR（記録にあるもの）：

| PR                      | 内容                                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------- |
| #29                     | U1〜U4 の移管の変更（`f5bc078c`）                                                           |
| #30                     | release 0.3.0                                                                               |
| #31                     | U7 の showcase の候補（`880cfd4a`）                                                         |
| #32                     | 移行用の古い workflow の退役                                                                |
| #40・#43〜#46・#48・#49 | U8 の Pages と environment、site と workflow、受入の修正、必須の check、ruleset への移行    |
| #50〜#52                | U4 の受入と B1 の pack（`showcase/b1-pack.json`）                                           |
| #54・#55・#57           | 配布の契機を push と手動に変更、承認者を外す、deploy を候補の成功に結び付ける（`c8497135`） |
| #58                     | terrarium の削除（`5735433d`、61 file）                                                     |
| #59・#60・#62           | guest-build の検証の修正、Biome 2.6.2 への更新                                              |
| #65・#66                | Node の版の固定を外す（`6a90a45b`・`f7b70cac`）                                             |
| #67                     | 足りなかった単体を `ci-required` に入れる（`2c00ca1a`）                                     |
| #68                     | U1 の取消と計測の記録（`e0842371`）                                                         |
| #69                     | site の最大の file と deploy の時間の記録（`1bdd984a`）                                     |

vivarium の PR：#531・#533〜#536・#538〜#540・#553〜#556（U5 の builder と Release の経路、bump）、#537・#541・#542・#544・#557（U6 の recipe・pin・active 化）、#548（U9 の Contract と schema）、#562（docs の最大の file の記録）。

版：npm は `latest: 0.3.0`・`next: 0.1.0-rc.1`。0.4.0 の release PR #64 は open（未公開）。terrarium の npm package は unpublish、JSR は archive（0.1.0・0.2.0・0.3.0 が残る）、repository・fork 2つ・Pages は削除済み。

## 記録の後に変わったこと（2026-10-22）

- **U5-NFR2.2**：vivarium の Biome を 2.6.2 に更新した（vivarium #563、`248e5ea6`）。Biome 2.6 の Markdown の整形は rumdl の MD032 とぶつかるので、Biome 側の Markdown の整形は止めている。
- **npm の Trusted Publishing**：0.3.0 の provenance は `refs/tags/v0.3.0` の `.github/workflows/publish.yml`（run 39202961190）を指し、repository にも environment `release` にも npm の token が無い。OIDC の Trusted Publishing で公開できていたことを確かめた（検証済み）。`publish.yml` はその後変わっていない。
- **`production` environment**：OpenTofu の apply が org の共通の workflow の既定で使っていただけだったので、呼出し側で空にしてから削除した（formicarium #72、vivarium #564）。
- **OpenTofu の state**：`aletheia-works/.github` v1.1.0 から、state は暗号化した artifact だけで持ち、Release への backup をやめた。公開されていた `state-backup-*` の Release とタグは削除した。

## 残った課題

- **U5-NFR8.3**：vivarium の guest の Release に license・notices が無い。直すには vivarium の builder と Release の作り方を変える。
- **U5-D7-AUTO**：bump の PR の自動 merge が、実際の bump の PR でまだ確かめられていない。
- **TC-1**：部品ごとの試験の件数が判定できない。部品の一覧と試験の対応表を作って数える必要がある。
- **U9 の Not Met 5件**：NFR1.1・8.8・8.10 は記録の欠け（npm の値と dependents は package を消したので取り直せない）。NFR8.2（JSR が archive のまま）は人間が失敗のままと承知した。NFR8.6 の34 file のうち32 file は、移行の道具・固定の証拠と一緒に後で消す作業に回した（2 file は showcase の demo の fixture で、CI の制約で残した）。
- release の coverage の固定24件には terrarium の source 7件が入ったまま。formicarium 自身の配布 JS に寄せる作業が残る。
- U3・U4 の正式な完了確認の source は `6a90a45b`。その後の main（#66・#67・#68）で同じ候補になるかは確かめていない。
- **npm 0.4.0**：release PR #64 は open。merge（＝公開の承認）は人間が判断する。
- vivarium の bot の secret（`BOT_PRIVATE_KEY`・`BOT_CLIENT_ID`）の置き場所は未検証。
- OpenTofu の管理外の label が3つある。OpenTofu の plan そのものは実行していない。
- 標準の通知が実際に届くことは未検証。
- biome/Firefox の U3 の中央値は基準の約86%で余裕が小さい。
- **実機の Safari は未検証。**

## 元の記録

元の記録は git の commit `8096c7b4` の `aidlc/spaces/default/intents/261012-terrarium-migration/` にある。
