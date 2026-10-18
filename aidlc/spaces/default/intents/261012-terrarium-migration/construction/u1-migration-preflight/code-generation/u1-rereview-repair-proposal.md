# U1再レビューNOT-READYへの修正案

## 状況

U1 code-generationの再レビュー（iteration 2、人間の依頼、2026-10-16T21:35:16Z）はNOT-READYだった。指摘は次の4件のMajorと2件のMinor。

- 新Major1：U3でscripts/package/coverage.tsの `readPlaywrightNodeRealms` が `launches.jsonl` の起動台帳を必須にした。v8の封印済みraw証拠には台帳がないため、現在のU1 verify（scripts/migration-preflight/current-coverage.ts）ではv8を再照合できない。
- 新Major2：U1がclaimする7件（mise.toml、.github/publication/runner-manifest.json・runner.mjs、scripts/package/coverage.ts/.js、tests/package/coverage.test.ts/.js）がv8封印と異なる。そのため、code-summaryの「現在sourceで確認済み」とunit-test-instructionsの読取り確認手順は、現在のsourceでは成り立たない。
- 既存R-01（Major）：scripts/migration-preflight/baseline.tsの `readAccepted` が、cacheのbuild-info.jsonを容量上限なしで読み、`JSON.parse` で重複keyを黙って潰す。
- 既存R-05（Major）：前提（v8封印＝現在source）が再び崩れた。
- 既存R-02・R-04（Minor）：tar検査の取消の分割点がない。正式verifyが未実行。

なお、このiteration 2のverdictは記録できていない。レビュー中にworkspace sourceが変わったとengineが判定したためである（原因はreviewerのread-only `jj` 実行によるworking-copy snapshotの更新と推測。未検証）。

mainの照合（2026-10-17、各unitの最新reviewed-source.tsvと現在fileのSHA256）では、U1と同じくU2とU3もclaimしたfileが変わっていた。

- U2：16件。U3のtoolchain更新とcoverage collectorの変更（commit済み）と、U4の未commit変更による。
- U3：9件。すべてU4の未commit変更（README.md、bun.lock、mise.toml、package.json、runtime/public.ts、coverage-inventory.json、stage-package.ts、tsconfig.tests.json、types/index.d.ts）による。

## 今すぐ21工程を回せない理由

working copyには、U4のSteps 1–7の未完の変更が入っている。その中で `mise run build` は2件の型エラーで失敗している（U4計画の追加Stepで対応予定）。配布JSも23件になっている。この状態ではU1の21工程はbuildの段階で止まる。また、engineはU1をREADYにするまでU4へ戻らない。

## 提案：2段階で進める

### 段階A：U4の変更を一時的に外し、U1/U2を現在のcommit済みsourceで回復する

1. U4の変更を保持したまま外す（jjのローカル操作だけで、外部操作はない）。
   - `jj new` で、現在のworking copy（U4の変更と、他のAI-DLC記録の変更を含む）を1つのchange（以下U4-WIP）として確定する。
   - 新しいworking copyで、U4が作成・変更したpathだけを `jj restore --from 7c7ceaf4 <path...>` で7c7ceaf4（U3受入済み＋toolchain更新）の内容に戻す。他の記録の変更は戻さない。対象pathの一覧は、開発担当の報告（新規17件、変更8件、bun.lock）と一致させる。
   - `bun install --frozen-lockfile` で、node_modulesをbun.lock（@types/node 24系）に揃える。@types/node 26への更新は、段階BでU4-WIPを戻すときに再び適用する（最新版の方針を取り下げるものではない）。
   - 外した後に、U3のclaim 9件が最新reviewed-sourceと一致することをmainで確認する。
2. R-01を修正する（U1のfileだけ）。
   - scripts/migration-preflight/baseline.tsの `readAccepted` が、build-info.jsonを1MiB上限つきで読み、重複key（escaped aliasを含む）を拒否するようにする。既存のscripts/migration-preflight/verify.tsの `parseUniqueJSON` を、循環importにならない形で再利用する（verify.tsがbaseline.tsをimportしているため、関数を小さな共有moduleへ移す。新しい依存は追加しない）。
   - 生成controller integration/vivarium/preflight/baseline-controller.mjsを、既存の生成手順で作り直す。
   - tests/migration-preflight/baseline.test.tsに、最後の値が正しい重複key、escaped alias、1MiB+1を、cacheのreuseで拒否する試験を追加する。不具合の再現試験がfailすることをmainで観測してから修正し、同じ試験でpassを確認する。既存のreceiptとraw SHAの照合は変えない。
   - R-02（Minor）は今回は直さず、Unresolvedのまま次のU1修正機会へ残す（判断はレビューに委ねる）。
3. mainが逐次実行する：`mise run build`、`mise run typecheck`、`mise run migration-preflight-unit`、`mise run migration-preflight-current-unit`。
4. v9の固定入力を作り、21工程をやり直す。
   - 新しい候補を `mise run migration-install-stage` で作る（出力は新しいUUIDのdirectory）。独立consumerを新しい空directoryへ導入する。
   - `node scripts/migration-preflight/current-completion.js prepare .artifacts/migration-preflight/current-recovery-input-20261017-v9.json <候補manifest> <consumer> .artifacts/u2-release-inputs/aube-v2.7.0/aube docs/results/terrarium-migration-preflight-evidence/verification-input.json .artifacts/migration-session/recovery-execution-binding.json .artifacts/migration-session/verify-completed-result.mjs 2077503099d1fcd7f70038af37b03b42b5ca26f731d07f06d324a7e50f48038a`。guest・歴史・retainedの3値はv8と同じで、変えない。
   - `node scripts/migration-preflight/current-completion.js run <v9入力> <v9入力SHA256>` で21工程を実行する（v8の実績は約24分）。
   - 現在のcollectorが起動台帳（launches.jsonl）を出すので、新しいraw証拠は台帳つきになる。readerは緩めない。
   - 品質基準は変えない：全21配布JS・全realmの行coverage80%以上、skip0、probe600秒、aube840秒、1worker、retry0。
   - 実行は人間の承認後に行い、`run` の実コマンドとv9入力のSHA256を提示する。
5. 文書を更新する。
   - U1のcode-summary.mdとunit-test-instructions.mdで、v8を「当時のsource（394件）の封印済み履歴」と明記する。現在の主張はv9だけに結び付ける。
   - v8は、現在のcoverage readerでは再照合できない（台帳導入前の形式）ことも明記する。v8の入力・report・生記録は変更しない。
   - U2の記録（construction/u2-session-guest-api/code-generation/のcode-summary.md、unit-test-instructions.md、current-recovery-verification.md）にも、同じ区別を反映する。v8・v9はU1とU2の両方を対象にした共通の確認である。
6. 新しい検証コマンドを提示し、承認を受ける。
   - v9の短い読取り専用の確認：`/Users/mutoakio/.local/share/mise/installs/node/26.12.0/bin/node scripts/migration-preflight/current-completion.js verify .artifacts/migration-preflight/current-recovery-input-20261017-v9.json <v9入力SHA256> <v9 report> <v9 report SHA256>`。
   - 承認後に、`aidlc/spaces/default/intents/261012-terrarium-migration/verification/verification-command-u1u2-v9.txt` へ保存する。
   - intentのConstruction Verification Command（現在はU3のtoolchain verifier）を変えるかは、engineがU1のcheckpointで求めた場合にだけ、その時点で改めて承認を受ける。
7. U1を再レビューする（iteration 2を再requestし、reviewerにread-onlyの `jj` を使わないよう指示する）。READYならU1を完了する。続いて、engineの指示どおりU2を再レビューする。U3は段階Aでは変わらないので、engineが求めた場合だけ再レビューする。

### 段階B：U4へ戻り、変更が終わった後で、U1–U3をまとめてもう一度確認する

1. U4-WIPの変更を、段階Aの後のworking copyへ `jj restore --from <U4-WIP> <U4のpath...>` で戻す。`bun install` で@types/node 26.6.5に戻す。
2. engineの指示どおり、U4の修正版計画（追加Stepを含む）の承認へ戻る。追加Stepの4項目（Node 26の `mode:'strip'`、tsconfigの型宣言、U2内部portの相対path解決、配布JS 23件による既存試験・U3入口の最小更新）を行う。そのうえで、U4のSteps 1–7の試験をmainで逐次実行する。
3. 追加Stepは、U1（tests/migration-preflight/current-completion.test.ts）、U2（runtime/session-port.ts、runtime/lifecycle.ts、tests/migration-session/reservation.test.ts、tests/package/*）、U3（tests/migration-install/*、scripts/migration-install/completion.ts・measure.ts）がclaimするfileを変える。また、mise.toml・package.json・stage-package.ts・coverage-inventory.json・public.ts・index.d.tsは、U1–U3のどれかがclaimしている。そのため、U4の変更後に、U1–U3は**必ず再び無効になる**。
4. そこで、U4の共有fileの変更をすべて終えてから、1回だけまとめて確認する。
   - U1の21工程をv10として現在のsource（23配布JS）で再実行する。
   - U4のcompletion（U3の工程とU4の工程とB1を含む）を実行する。
   - U1–U3の再レビュー、U4の正式受入れ（Step 8以降）を行う。
   - 途中で共有fileを再び変えた場合は、再確認が必要になる。それを避けるため、U4の共有fileの変更は1回にまとめる。

## 承認をお願いする事項

1. 段階Aの手順1（jjでU4の変更を一時的に外す。`bun install --frozen-lockfile` で@types/nodeを一時的に24系へ戻す）。
2. 段階Aの手順2のR-01修正（U1のfileに限る。新module 1件を含む）。R-02は持ち越す。
3. 段階Aの手順4の21工程の実行（v9）。実コマンドとSHA256は、準備後に提示する。
4. 段階Aの手順5の文書更新（U1とU2の記録）。
5. 段階Bの進め方（U4の共有file変更をまとめた後で、U1–U3を1回で再確認する）。

新しい検証コマンド（段階Aの手順6）、段階Bのv10・U4受入・push・CIは、それぞれの時点で実コマンドを示して改めて承認を受ける。
