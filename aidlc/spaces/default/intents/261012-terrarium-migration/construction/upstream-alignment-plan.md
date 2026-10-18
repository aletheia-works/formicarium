# upstream/mainへの移し直しの対応表

## Sources

- upstream/main：`aletheia-works/formicarium` の `4e3482bb`（#28、2026-10-12）。2026-10-18に `jj git fetch` で取得した（検証済み）。
- 移管の作業：`74dd4477`（土台）〜`9722db3e`（U4の最後）のU2〜U4の7 commit。`93dc2a8e`（LOCAL ONLY）は対象外。U5・U7はchange `mtmplvwk`（WIP、pushしない）にある。
- upstreamの規約は、作業コピーをupstream/mainにした状態で読んで調べた（ドキュメント根拠。build・試験はまだ実行していない）。
- 分類：`74dd4477..9722db3e` で変わった435file（`aidlc/` を除く）を、upstream/mainの同じpathと比べた。upstreamに無い新規332、内容が違う65、同じ37、upstreamで移動された1。

人間の指示（2026-10-18）：upstream/mainの規約（folderの配置など）に合わせ、これまでの実装も古い書き方ならupstreamに合わせて直す。PRは1つにまとめ、B1の正式な受入はmergeの前にやり直す。

## 規約の違いと直し方

| 項目 | 移管の作業での書き方（古い） | upstream/mainの規約 | 直し方 |
|---|---|---|---|
| 生成JS | 一部の生成JS（`runtime/guest-validation.js` など）を「レビューの証拠」として追跡し、`.gitignore` で例外にしていた | 生成JSは追跡しない。tscが `.build/` に出し、`scripts/emit.ts` が横に写す | 生成JSと `.js.map` は持ってこない。`.gitignore` の例外も持ってこない |
| task | `mise.toml` の `[tasks]` に `migration-*` を並べていた。toolの版を固定（node 26.12.0、bun 1.4.3） | `mise.toml` は `[tools]` だけで、版は `latest`。taskは `mise-tasks/<group>/<verb>.sh`（`#MISE description`、mode 755、`exec bun run ...`） | `mise-tasks/migration/<unit>-<verb>.sh` のfile taskにする。toolの版の固定は持ってこない（最新版を使う方針とも合う） |
| 試験の登録 | `mise.toml` のtaskで、file pathを直接 `node --test` に並べていた | `package.json` のscript（`test:unit` は bun test、`test:node-unit` は `node --test --test-concurrency=1`、`test:integration` など）に明示して並べる | 単体はbun test、Worker・consumer・実guestはnode:testのscriptに足す。重い受入はscriptに入れず、file taskから呼ぶ |
| shell | `scripts/build-guests.sh` を変更 | `mise-tasks/build/guests.sh` に移動済み | 変更をmise-tasks側へ移す（中身が必要な変更かを確かめる） |
| browserのapp | `runtime/web/` | demoのappは `web/`、`runtime/web/` はpackageのAPIとworkerだけ | 移管の作業が `runtime/web/` のappを触っていれば `web/` へ |
| import | `.js` 拡張子（同じ） | `.js` 拡張子 | そのまま |
| 配布物の一覧 | 23件（`package.json` の files、`scripts/release/inventory.ts`、`stage-package.ts`、`coverage-inventory.json`） | 14件のruntime JS。同じ一覧が3か所に固定され、coverageの門は「fixed24」（24 file）で、CIと試験がその数を検査 | U2〜U4の9 moduleを3か所とpackage.jsonに足し、fixed24の数（`release-candidate.yml`、`scripts/ci/verification.ts`、`scripts/terrarium/coverage.ts`、試験）を新しい数に揃える |
| 版 | `0.1.0-rc.1`（private）、B1の候補は `0.3.0` | `0.2.1`（release-pleaseで管理）。`feat` のcommitで次は0.3.0になる見込み（未検証） | package.jsonの版は手で変えない。B1の候補の版はrelease-pleaseの計算と照合する |
| 受入のworkflow | `migration-session-u2.yml`・`migration-install-u3.yml`・`migration-command-u4.yml`（Node・Bunの版を固定） | dispatchだけの検証workflow（`verify.yml`・`candidate-verify.yml`）、toolは最新版、SHAと版のcomment、`persist-credentials: false`、timeout、repositoryのguard | 規約に合わせて書き直す（版の固定をやめ、styleを合わせる）。必須checkの名前は変えない |
| CIの入力 | `ci/migration-*`（manifestとpayload） | `install-inputs.py` の規則（`manifest.json` と `payload/` だけ、digestで固定、固定commitの `raw.githubusercontent.com/aletheia-works/formicarium/<sha>/` のURL） | 規則に合うかを確かめ、合わなければ合わせる |
| 候補のsource inventory | （考慮なし） | `scripts/ci/candidate.ts` がmise-tasks・runtime・web・scripts・tests・integration・patches・guestを数える。fileが増えると固定入力のmanifestの作り直しが要る | 移した後に作り直す（READMEの手順） |
| label | `pr-labels.yml`・`maintenance.yml`・`.github/maintenance/`・`scripts/maintenance/`・`renovate.json` | labeler・dependabot・自動mergeは別の形で実装済み。READMEは独自のmaintenance runnerを持たないと明記 | 持ってこない（261010の古い形で、upstreamで置き換え済み） |
| 公開の仕組み | `.github/publication/`、`scripts/release/bootstrap.ts`・`bundle.ts`、関係の試験 | release-pleaseと `publish.yml` で実装済み。`scripts/release/*` は過去の証拠の道具 | 持ってこない。U4が変えた `scripts/release/inventory.ts` は、配布物の一覧の更新だけを足す |
| GitHubの設定 | （U7で新しい `infra/github/` を作った） | `infra/github/` があり、mainの保護は `github_branch_protection_v3`（必須checkは `quality`・`commit-format`・`ci-required`・`check / Commitlint`）。Actionsの権限とforkのPRの承認は管理外 | U7では新しく作らない。必要なら既存のmoduleへの追加として別に提案する |
| AI-DLCの道具 | `scripts/aidlc-stop-guard.py`、`patches/aidlc-2.10.0-*`、`.aidlc-source-paths.json` | 無い | 持ってこない（AI-DLCの古い版の回避策で、製品の変更ではない）。必要なら別に相談する |
| commit | 自由な英文 | Conventional Commits（`feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert`）。PRの題も同じ | commitの説明を規約の形にする |

## 持ってくるもの

- runtime：`guest-validation`・`session-port`・`install-catalog`・`install-transfer`・`install-archive`・`install-lifecycle`・`install`・`command-parse`・`command` の `.ts`（9 module）と、`core`・`lifecycle`・`public`・`state` への変更、`types/index.d.ts` の追加。upstreamの同じfileの変更と手で合わせる。
- 試験：`tests/migration-preflight`・`migration-session`・`migration-install`・`migration-command`（`.ts` だけ）と、`tests/package` などの既存の試験への変更（upstreamの版に足す形で）。
- 受入の入口：`scripts/migration-*`（`.ts` だけ）、`ci/migration-*`（規則を確かめて）、受入のworkflow（規約に合わせて書き直す）。
- 文書：`docs/install-api.md`・`docs/command-api.md`・`docs/terrarium-migration-plan-summary.md`・`docs/results/` の移管の結果、`README.md` のAPIの節（upstreamの版に足す）。
- guestとpatch：`guest/probe/src/madvise_purge_reuse.rs`・`guest/diagnostics/aube-purge/`・`patches/blink-*.patch`（blinkの修正の記録。中身を確かめてから）。`integration/vivarium/preflight/`（U1）。
- AI-DLCの記録：`aidlc/spaces/default/intents/261012-terrarium-migration/`（この移し直しの記録を含む）。

## 進め方

1. 上の「持ってくるもの」を、Unitの単位のcommit（Conventional Commits）で、最新の `main@upstream` の上に移す。共有のfileはupstreamの版を正とし、必要な変更だけを足す。
2. 新しい土台で、`mise run lint:all`・`typecheck`・`build`・`test:light`・移管の単体とbrowserの試験を逐次実行する。
3. B1の正式な受入（全realmのcoverage、正式36試行、署名付きCI）をやり直す。古い土台の証拠（pack `61b209ae…` など）は過去の記録として扱う。
4. pushとPRの実コマンドを示して承認を受ける。
5. merge後に、U5とU7を同じ規約で移す。U7はtask・試験の登録・workflowのstyleを合わせ、新しい `infra/github/` は作らない。

## 移し直しの結果（2026-10-18、ローカル）

`main@upstream`（`4e3482bb`）の上の3 commit（`feat(runtime)`・`test(migration)`・`docs(aidlc)`）にした。どれもローカルだけで、pushしていない。

対応表から変えた点：
- `scripts/release/inventory.ts` は、過去の0.1.0の証拠の照合用の14件を `HISTORICAL_FIRST_PARTY_JS` として残し、`FILES`（過去の24件）はそれから作る。`FIRST_PARTY_JS`・`PACKAGE_FILES` は今のpackage（runtimeの23件）にした。前者だけを変えると過去の証拠の試験が85件、後者だけだとpackageの照合の試験が37件落ちたため。`scripts/terrarium/coverage.ts` の `HISTORICAL_U1_JS` と同じ考え方。
- release候補のcoverageの門（fixed24）は、`HISTORICAL_U1_JS` から数を作るので変えていない。CIで確かめる（未検証）。
- 受入のtool版の固定（Node 26.12.0・Bun 1.4.3）は、受入の証拠をtoolchainに結びつけるために残した（どちらも最新版）。`@playwright/test` を1.64.1、`@types/node` を^26.6.5（どちらも最新版）に上げた。
- U4の受入のworkflowとbranchの確認を、新しいbranch `codex/terrarium-migration-b1` に向けた。U2・U3の受入のworkflowは、`stage.ts` がsourceの一覧に含めるので残した（もう起動しない。merge後の片づけの候補）。
- U2の `stage.ts` のsourceの一覧から、持ってこなかった `.github/publication/` の4fileを外した。
- Biomeの規則に合わせて、移管のfileの整形とimport順を直し、3か所に理由つきの無視のcommentか書き換えを入れた（動きは変えていない）。
- `README.md` に、U2〜U4のAPIの節を、今の状態に合わせて足し直した。

実行した確認（検証済み、main sessionで1つずつ）：

| 確認 | 結果 |
|---|---|
| `mise run install:frozen`（upstreamの `bun.lock`） | exit 0 |
| `mise run typecheck` | exit 0 |
| `mise run build`（`.build/` を消してから） | exit 0 |
| `mise run test:light` | bun test 71件・37件pass、node 123件中121件pass・skip 2、tooling 130件pass。skip 2件はupstreamのままでも出るguest配布の既存の試験 |
| `mise run lint:all` | exit 0（Biomeのerror 0、warning 48、info 54） |
| U4の候補（`migration-command-stage`） | `.artifacts/migration-command/candidate-a7e27b2d-c44e-4054-a132-f55e08195928`、33file、`aletheia-works-formicarium-0.3.0.tgz` |
| 独立consumer | `/private/tmp/formicarium-b1-consumer-20261018` |
| U1の単体（`migration-preflight-unit`・`migration-preflight-current-unit`） | 57件・21件pass |
| U2の単体・browser | 46件pass、9件pass |
| U3の単体・browser | 74件pass、45件pass |
| U4の単体・browser | 96件pass、9件pass（Chromium 156.0.8078.4、Firefox 157.0、WebKit 27.2） |

まだしていないこと：
- B1の正式な受入（全realmのcoverage、正式36試行、署名付きCI）。ローカルの正式な受入には、macOSに専用CAを信頼させる操作が要る（人間が行う）。
- U1のbrowserの計測（mirrorのTLSと証明書の登録が要る）。
- upstreamの通常CI（`quality`・`product-*`・`release-candidate`）での確認。実機Safariは未検証。

## Assumptions & Open Questions

- 移した後の衝突の量と、試験がそのまま通るかは未検証。
- `fixed24` を新しい数に変えることは、upstreamのrelease-candidateの門を変えることになる。数を変える理由（配布JSが増える）は明確だが、レビューで確認を受ける。
- blinkのpatch 2件が、upstreamのblink.lockの固定と合うかは未確認。
