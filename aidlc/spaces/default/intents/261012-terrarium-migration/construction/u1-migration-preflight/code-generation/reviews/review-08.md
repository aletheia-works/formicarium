## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-10-17T02:42:13Z
**Iteration:** 2
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | scripts/migration-preflight/baseline.ts > readAccepted, lines 293–294; integration/vivarium/preflight/baseline-controller.mjs > readAccepted | cacheのbuild-info.jsonは容量確認なく全量を読みJSON.parseで処理する。重複fieldで最後の値を正しい値にしたmetadataは、重複を失ったobjectとしてidentity/canonical照合を通り、runBaselineのreuse経路はcompileSkipped=trueを返し得る。共通型の正規化規則は重複key拒否、C11はmetadata1MiB、U1 NFR3.2/DS2はduplicate拒否を要求する。この命題はreadAccepted/reuse境界に限定する。後から既存cacheを改変した場合、最終verifyFileのfirst/reuse receiptとraw buildInfoSha256照合は通常その改変を拒否するため、最終受入まで通るとは主張しない。 | cached build-infoにも1MiB上限と重複keyを保持して拒否するJSON読取りを適用し、CLI入力と生成controllerへ反映する。最後の値が正しい重複key、escaped alias、上限+1をreuse拒否する試験を追加し、既存receiptとのraw SHA照合は維持する。 | Resolved (reviewer) |
| R-02 | Minor | scripts/migration-preflight/assets.ts > extractTar, lines 295–391 / acquireAsset extract phase | 全entry検査・link検査は同期ループで、signal/deadlineを受け取らず、event loopへ制御を返す分割点もない。C11とDS2が求めるCPU処理の分割境界での取消確認がこの区間にはない。取得・gzip stream・後続digestには取消経路があるが、tar検査中に届く取消の処理はその区間が終了するまで遅れる。実上限入力の遅延時間は未検証であり、今回の性能試行失敗とは扱わない。 | 全entry・link検査に適切な分割点でyieldとsignal/deadline確認を設け、途中取消で後続の登録へ進まない境界試験をmain sessionで実行する。 | Unresolved |
| R-03 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u1-migration-preflight/code-generation/unit-test-instructions.md > Unit-Scoped Commands | 今回の回復レビューではbrowser/verifyと記録済み完了確認コマンドを再実行していない。記録済みコマンドはU2の固定結果・旧source inventoryを読むため、現在の候補全体に対する成功証拠としては未検証。過去の36試行・CI・coverageの履歴と、現在のソースを用いた受入を区別する必要がある。 | 現在の候補と入力に対応する検証入口・証拠をmain sessionで照合する。過去の成功結果を新しい候補の完了証拠に置き換えず、未再実行範囲を明記する。 | Resolved (reviewer) |
| R-04 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u1-migration-preflight/code-generation/unit-test-instructions.md > Unit-Scoped Commands / 完了確認の復旧手順 | このレビューでmise run migration-preflight-unit/browser/verifyおよび記録済み復旧コマンドの独立再実行は未検証。dispatchがbuild/test実行を禁止し、main sessionでの逐次実行を指定しているため実行しなかった。mainのv4ログと固定結果は読取り確認したが、レビュー自身の試験成功や新しい正式checkpoint確認とは区別する必要がある。 | 正式checkpointでは、現在の入力・結果SHAへ固定した実コマンドと未完のCI/U3範囲を提示し、所定の承認後にmain sessionで確認する。今回のlocal成功を統合前CIやU3性能受入へ置き換えない。 | Resolved (reviewer) |
| R-05 | Major | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u1-migration-preflight/code-generation/current-recovery-verification.md > 実行と固定証拠・受入状態とレビュー残件; code-summary.md > 現在コードの完了確認の復旧 | v4の390 current source封印を現ファイルとSHA256照合すると15件が異なる。runtime/guest-validation.ts/js、mise.toml、README.md、installのCI・completion・試験入力等を含む。v4自体の入力SHA 4ea97606…と結果SHA a3a9a207…は保存されているが、その時点の成功は現在sourceの完了確認を証明しない。「現在コード」とする引継ぎは現状と一致せず、短いverifyもassertCurrentIdentityの一致条件を満たさない。直近のU3 local18工程はU1単体/current-completionを含まず、U1の21工程と同一の検証集合でもない。 | v4を実行時点の履歴として保持し、現在sourceからの差分と再利用できる証拠を明記する。現在の正式完了確認には、新source/pack/必須工程に結び付いた証拠と承認済みの検証入口を用意しmainで確認する。U3の承認済みSHA改善を取り消したり、旧証拠のSHA・成功属性を書き換えたりしない。 | Resolved (reviewer) |
| R-06 | Major | scripts/migration-preflight/current-evidence.ts > environmentOf（node: process.version を返却オブジェクトに付与）; scripts/migration-preflight/current-completion.ts > assertCurrentToolchainEvidence | 受入証拠の environment.node は 36 試行の記録から読んだ値ではなく、組立て時に実行中の process.version を書き込んだ値である（acceptance-evidence.json の試行 environment 側には node キーが存在しない）。そのため assertCurrentToolchainEvidence の「evidence.environment.node === process.version」は常に真で何も検査しない。code-summary の「今のNodeで作った証拠だけを受け付ける」は、36 試行については成立しない（試行を古い Node や古い Playwright で作っても通る）。baseline 側は builderHash が Node 版を含むため実質的に束縛されている。 | 36 試行を実行した Node と Playwright の版を試行 record または browserLog から実測値として取り込み、現在の toolchain と一致しなければ拒否する。それまでは code-summary の記述を「baseline は Node 26 に束縛、試行の Node/Playwright は main の実行記録に基づく（コードでは未検査）」に直す。 | New |
| R-07 | Minor | scripts/migration-preflight/current-completion.ts > assertPreflight; current-evidence.ts > readTrials | browserLog は「36 passed」の文字列とテスト要約しか確認されず、log と trials ディレクトリ（36 ファイル）の対応が結び付けられていない。別実行の log と trial JSON を組み合わせても封印・検証を通る。 | log に出る試行識別子または各 trial の実行 ID を trial record と突き合わせる。 | New |
| R-08 | Minor | scripts/migration-preflight/baseline.ts > readAccepted | 1 MiB 上限は readFile で全量を読んだ後に判定している。巨大な build-info.json でもメモリに載る。 | stat で事前にサイズを確認するか、上限付きで読む。 | New |
| R-09 | Minor | scripts/migration-preflight/current-completion.ts > report の pending 固定文言 | pending に U3 の完了済み項目が残り、読む人に誤解を与える。code-summary は認識済みだが report 自体は直っていない。 | 次回の script 修正で pending を実状態に合わせる。 | New |

> R-01 Reviewer note: baseline.ts の readAccepted が build-info.json の 1 MiB 上限を持ち、parseUniqueJSON（unique-json.ts）で重複 key を拒否するようになった。ただし上限判定は readFile で全量を読んだ後なので、読込み前の size 制限ではない（New findings の Minor 参照）。

> R-02 Reviewer note: assets.ts の extractTar の取消分割は未対応のまま。code-summary も未解消と明記しており記録は正直。

> R-04 Reviewer note: 人間が承認した verification-command-u1u2-v10.txt を main が実行し verified:true を返した、と記録されている。verifyCurrentCompletion は入力・report・全 raw 証拠・20 工程・coverage・組立て証拠を再導出する実装を静的に確認した。私は試験を実行していない。

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| current-evidence.ts / current-completion.ts / unique-json.ts / baseline.ts の静的読取り | 実施 | R-01 修正、20 工程化、証拠組立て、verify の再導出を確認。node 検査が自己参照である点を検出。 |
| acceptance-evidence.json（v10）の読取り | 実施 | environment.node = v26.12.0 は組立て時の値。trial 側の environment に node キーなし。baseline.buildKey/CI run URL は一貫。 |
| ビルド・試験・VCS コマンド | 未実行（main-only 指定） | main の記録（U1 unit 56/56、current＋evidence 25/25、v10 verified:true）は私が再現したものではない。 |

### Summary

R-01、R-04、R-05 は最新 toolchain での新しい v10 証拠と新しい封印で実質的に解消された。Critical はなく Major は 1 件（Node 検査の自己参照）のみで基準内のため READY とするが、Node 検査の実測化または記述の訂正は修正しておくべきである。
