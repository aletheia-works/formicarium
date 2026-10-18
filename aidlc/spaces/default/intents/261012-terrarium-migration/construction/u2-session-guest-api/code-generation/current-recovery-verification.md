# U2 現在証拠の照合（2026-10-16）

## 2回目の再開での位置づけ（2026-10-17）

下のv10の照合は、U4の作業を戻す前のsourceに結び付いている。その後、U4の作業を戻したことと、AI-DLCの更新で、U2がclaimする共有fileが変わった。変わったのは `package.json`・`runtime/public.ts`・`types/index.d.ts`・配布一覧（23件）・`README.md`・`mise.toml` で、どれも追加のみである。U2の製品コードは変わっていない（code-summary.mdのStep 14を参照）。

その後の3回目の再開で、U4の追加Step項目3により、U2の製品コード（`runtime/session-port.ts`・`runtime/lifecycle.ts` の `resolvePath`）が変わった（code-summary.mdのStep 16・Step 18を参照）。上の「製品コードは変わっていない」は、その変更より前の記述である。

そのため、v10を、今のsourceの成功証拠としては扱わない。U4を含む最終的なsourceでのU2の確認は、U4の作業の後に、U1〜U4のまとめた確認の中で行う。

## 現在の照合：v10（2026-10-17、最新toolchain）

方針（人間の指示、2026-10-17）：古い版のtoolで作った記録は履歴であり、今のtoolchainの根拠にしない。最新版（Node 26.12.0、Bun 1.4.3、Playwright 1.64.1）で実行した成否だけで確かめる。全20工程はmainが実行した結果であり、本記録での新しい実行ではない。

| 対象 | パス又は値 |
|---|---|
| 入力 | `.artifacts/migration-preflight/current-recovery-input-20261017-v10.json` |
| 入力SHA256 | `56c78183f6b1af91f9e1de7a1179c6d9ba416ff2be584834d4f5931a050d6fb9`（reportの `preparedInput.sha256` と一致） |
| report | `.artifacts/migration-preflight/current-completion-7de2263f-2f39-4236-8895-82b7f32b55a8/current-local-verification-report.json` |
| report SHA256 | `e7760ddbe0e943d0830e8a7093c30a5898cfc86f8d49ed5d94f7e55dab197a01`（承認済み検証コマンドの引数と一致。ファイルのSHA256はmainの検証コマンドが照合した） |
| main実行期間 | `2026-10-17T02:15:47.174Z`–`02:34:25.193Z`（report全体の `startedAt`/`finishedAt`） |
| 実行Node | `preflightEvidenceNode` `v26.12.0`、各node工程の実体 `/Users/mutoakio/.local/share/mise/installs/node/26.12.0/bin/node` |
| 判定 | `exitCode` 0、`signal` null、`currentSourceVerified` true |

reportの `commands` は20件で、すべて `exitCode` 0だった。

| 工程 | 内容 | 開始–終了（2026-10-17、UTC） |
|---|---|---|
| 1–2 | build、typecheck | 02:15:48.007–02:15:54.745 |
| 3–4 | U1 unit、current-completion/current-evidence | 02:15:55.815–02:16:00.978 |
| 5–6 | test-light、acceptance/CI境界 | 02:16:01.817–02:16:37.908 |
| 7 | U2 `migration-session-unit` | 02:16:38.640–02:16:42.151 |
| 8 | `migration-install-unit` | 02:16:42.848–02:16:48.250 |
| 9 | U2 `migration-session-browser` | 02:16:48.949–02:17:01.945 |
| 10 | `migration-install-browser` | 02:17:02.737–02:17:41.398 |
| 11 | `test-consumer` | 02:17:42.396–02:18:02.819 |
| 12–13 | Node core回帰、ブラウザprobe/aube（workers=1、retries=0） | 02:18:03.667–02:18:57.575 |
| 14 | coverage prepare | 02:18:58.624–02:18:59.691 |
| 15 | 計測package Node | 02:19:00.394–02:19:07.314 |
| 16 | 計測U2/U3 Node（tests/migration-session/のguest-validation・fixture・reservation・public・consumerを含む） | 02:19:08.007–02:22:06.634 |
| 17 | 計測packageブラウザ（workers=1、retries=0） | 02:22:07.410–02:29:48.571 |
| 18 | 計測U2ブラウザ（tests/migration-session、workers=1、retries=0） | 02:29:49.690–02:30:56.613 |
| 19 | 計測installブラウザ（workers=1、retries=0） | 02:30:57.498–02:33:44.850 |
| 20 | coverage report | 02:33:45.644–02:33:57.987 |

coverage（同じdirectoryの `coverage/coverage-report.json`）：1768/1929行＝91.65%、skipped 0、threshold 80、passed true、配布JS 21件（`digests`）、realm 1495件（`realmNames`）。

承認済みの検証コマンドは `aidlc/spaces/default/intents/261012-terrarium-migration/verification/verification-command-u1u2-v10.txt` である。内容はNode 26.12.0の `scripts/migration-preflight/current-completion.js verify` で、v10入力・report・上記2つのSHA256を指定する。mainが実行し、`verified:true` を観測した（mainの観測であり、本記録での実行ではない）。

U2の製品コードは変えていない。コードの変更はU1のfileだけである。v8とv10のcoverage reportで、全21配布JS（U2のruntime/guest-validation.js・session-port.js・state.js・lifecycle.js・public.jsを含む）の `sourceSha256` が同じであることを読取りで確認した。pack SHA256はv8 `cc89a7dc…95b2`、v10 `1a8cd787…2e95` で異なる（配布JSは同じなので、それ以外の同梱fileの差と推測する。個別fileの差は本記録では照合しておらず、未検証）。

境界：`acceptancePassed=false`、`mergeAllowed=false`、`laterUnitAcceptance=false`（mainがv10 reportのtop-level fieldを読み取って確認した）。現在sourceの署名付きCIとmergeは未受入れ（reportの `pending` に `current same-source signed CI before merge` がある）。実機Safariは未検証（reportの `realSafari` は `未検証`）。

以下のv8・v4〜v7の記述は、古いtoolchain（Node 24.21.0）での履歴であり、今の判定には使わない。

## 範囲と状態

検証済み：承認済み再開計画Step9/10として、既存C02/C03実装・v8固定入力・結果・原ログを読取り照合した。全21工程はmainが先に実行した結果であり、本U2記録整合での新規実行ではない。アプリケーションコード、U1成果物・完了承認、封印証拠は変更していない。正式U2 checkpointは本記録時点で未実行。

主担当が承認済みの同じ短時間verifyを再実行しexit0、verified=true、verificationScope=current-local-completed-U1-U2、currentSourceVerified=trueを観測した。raw全realmの再計算と現在source/候補/installed bytes/配信元の結合確認は、この主担当のverifier実行結果に基づく。自身による試験再実行とは記載しない。

## 固定入力と結果

| 対象 | パス又は値 |
|---|---|
| 入力 | `.artifacts/migration-preflight/current-recovery-input-20261016-v8.json` |
| 入力SHA256 | `25d44cb9c6def3cdc65317d76add2ecb90b5010fc05f4e097f982cdf98655bd0` |
| 結果 | `.artifacts/migration-preflight/current-completion-8c15f728-80d1-40e4-90e6-cea86c413cb8/current-local-verification-report.json` |
| 結果SHA256 | `fe0d5a01fe5e193258f10371d9cd7c3a446b8b820f3005dabcaeca0300b63079` |
| main実行期間 | `2026-10-16T10:18:42.073Z`–`10:42:13.335Z`（JST 19:18–19:42） |
| sourceIdentity | `d7a94b49ce7bc48c9b7374e32c6ee8db55724835a897701af1bd35b40f663537` |
| currentSourceIdentity | `f145ef3baaf07f9542a8e683c18a6bab2a7981500bfcc01f46214c2117f2fe78` |
| pack SHA256 | `cc89a7dcdd015da80b9c11569a4fef2daa8b3f2131610caa7fa20682c6e995b2` |
| coverage SHA256 | `bf28ac1c02585eafa9aeb8aaa2c9bd93c8442695109d3ab33878ffd2b9b01831` |

読取り照合では入力・結果SHAが上記と一致。394 currentSource、435 evidenceFiles、actualSite全file rowsの実SHA不一致0。候補は `.artifacts/migration-install/candidate-619c9bf3-d619-4611-8202-7821bd820070/package.manifest.json`（SHA256 `d2ff3632e306701ace0092682979757e0502b0441ae13dc45d069374146d2a00`）。31 pack filesと21 first-party JSを確認した。sourceCommit `c30e2a9b90eabaa35a2fd9ee51d313209ce9290e` はbase-revision-with-working-source-inventoryであり、現在source全体を収録したcommitという主張ではない。

独立consumerは `/private/tmp/formicarium-u1-recovery-v8-consumer-20261016`。installed packageの31ファイル全てが候補filesのSHAと一致した。guestは `.artifacts/u2-release-inputs/aube-v2.7.0/aube`（SHA256 `c7d7d13692d01c5f6adc5511c40adc6b3769080b7c433b44c411a3e52ebcd99e`）。actualSiteは入力に固定された一覧を実SHA照合し、配信元の追加/削除も主担当verifyが確認する。

## 既存の実観測ログ

結果のcommandsが参照する同出力ディレクトリのcommand-N.logを照合した。全21子コマンドexit0、親結果exitCode0/signal=null。

| 工程/原ログ | 観測 |
|---|---|
| 1 | 保持した歴史的U2証拠の検証 |
| 2–3 | build/typecheck成功 |
| 4–5 | U1単体55、current-entry19成功 |
| 6–7 | 軽量193/tooling237、acceptance/CI境界43成功 |
| 8 | U2 Node44成功 |
| 9 | install Node74成功 |
| 10 | U2 Chromium/Firefox/WebKit計9成功（13.7秒） |
| 11 | installブラウザ45成功（consumer9＋SHA vector回帰36、正式HTTPS36試行とは別） |
| 12–14 | 独立consumer204、Node core28、ブラウザcore33成功 |
| 15–17 | coverage準備、計測package Node115、計測U2/U3 Node115成功 |
| 18–20 | 計測packageブラウザ99、U2ブラウザ9、installブラウザ9成功 |
| 21 | coverage report成功 |

coverage/coverage-report.jsonは1768/1929行（91.65%）、21JS、1495 realm names、Playwright Node12件、threshold80、passed=true、skipped0。原ログを含む封印rowsの実SHA一致を確認した。全realm rawカウントからの再計算は主担当による同一短時間verifyで成功しており、aggregate.passedだけを根拠に完了させない。容量・負数・欠落・重複・skip拒否を弱めていない。

## 実装・追跡と書込み一覧

ドキュメント根拠と実装読取り：C03はruntime/guest-validation.tsの私有WeakMap、検証copy、同期SHA256/ELF、fixture正規化/有限link解決とruntime/public.tsの公開消費経路に対応する。C02はruntime/state.tsのtoken/epoch/active検査と所有release、runtime/lifecycle.tsの共通予約・reset/dispose cleanup、非公開runtime/session-port.tsに対応する。現在の共有SHA256改善と生記録照合は既存実装として検証対象に含み、本U2再開で変更しない。

traceability.jsonはFR2/5/6、BR2.1–11、U2詳細NFRの26対応先全てが存在。OKは実装/試験ファイル対応であり最終受入れではない。source-manifest.jsonの91個別パスは全件存在し重複なし。新たなアプリケーション書込みがないため、主張を削除・追加・directory/glob/ignored scratchへ変更せず保持した。

今回編集するsummary/本資料と、既存traceability/manifestはv8入力・結果の封印対象に含まれないことを確認した。計画本文・Testing Contract・試験指示は変更せず、Step9/10 checkboxのみ完了へ更新する。

## 履歴と未完了条件

旧v4/v5/v6/v7の固定入力・結果・raw証拠は履歴として保持し、v8へ再ラベルしない。旧v4は1755/1916行（91.59%）、旧v5は1768/1929行（91.65%）・1483 realmsであり、同じ率やpack digestでもsourceや全realm集合の一致を省略しない。

旧16JS/26pack・1370 realms・1201/1336行（89.89%）の署名付きCI run38438640770/head `d9beae83ba98e5bffdd6ae3653e40da4f47612c1` はその旧source/packの履歴。現在sourceのCI成功ではない。旧U1の36試行・固定Biome CI、README更新前候補に対するU3 formal36-sha-20261015-v2の成功も当時の証拠として保持し、現在候補の正式HTTPS36試行へ付替えない。

現在結果はcurrentSourceVerified=true、acceptancePassed=false、mergeAllowed=false、laterUnitAcceptance=false。現在同一sourceの統合前署名付きCI、U3現在候補の正式36試行（非DL中央値≤3000ms）、U3専用署名付きCIは未完了。固定report.pendingのU3 implementation-plan approvalは生証拠中の過去文言として保持する一方、共有SHA256改善は承認済み計画で実装済みと区別する。U3のCI実配信入力の修正・再検証は後続の承認済み作業であり本記録整合に混ぜない。

U4統合C06/B1、U5正式着手、公開を許可する証拠ではなく、実機Safariは未検証。180秒期限、非download中央値3秒、coverage80%、容量上限、probe600秒/aubeブラウザ840秒、1worker/retry0、wasm1GBを維持する。

正式完了確認には主担当が既存verification-command.txtを使う。その前後空白を除いたコマンド文字列SHA256 `10098116c484c2f62527bd65045c06cab2b0a5433e1c312fb7ff6c3322623bef` は読取り照合で一致し変更していない。不一致や失敗、新入力/コマンドが必要なら停止して確認する。
