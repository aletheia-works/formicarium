# showcase候補供給の品質・安全要件

## Sources

根拠は次のとおり。
- `../../../inception/requirements-analysis/requirements.md`（FR13・FR14、NFR1–NFR8）
- `../../../inception/units-generation/unit-of-work.md`（U7）と `unit-of-work-story-map.md`（U7が担うNFRは NFR2・NFR3・NFR4・NFR5・NFR6・NFR8）
- `../../../inception/contract-design/contract-summary.md`（C03 公開guest検証、C05 公開コマンド、C06 B1受入、C09 showcase候補の供給、C10 最終受入証拠のU8 profile、C11 取得・時間・サイズの境界）
- `aidlc/spaces/default/codekb/formicarium/technology-stack.md`（版の宣言。2026-10-17の人間の方針で一部が古い）
- 現行terrariumの最新版ビルド（`terrarium/integration/latest-tool-builds.md`、`terrarium/.github/workflows/build-latest-guests.yml`、`terrarium/scripts/latest-guests.mjs`）。移管元として読んだ（ドキュメント根拠）
- 人間の回答（`nfr-requirements-questions.md` の Q1–Q5、すべてA）と、U5で人間が決めた方針（自分たちのtoolは最新版、検証対象のsource buildはupstreamのbuild設定に従う）

U7はpackagingのUnitで、機能設計の文書はない。以下はドキュメント根拠であり、U7の動作・性能・CORSは未検証。

## Requirements

| ID | 分類 | 合格条件 | 検証 |
|---|---|---|---|
| NFR2.1 | 品質 | 既存の品質の上限（probe≤600s・8項目、aube browser≤840s、worker1・retry0、native出力一致、wasm1GB、WorkerのwaitAsync削除）と、第一者配布JSの行coverage≥80%を維持する。U7の変更で本体の配布JSや既存の試験を緩めない。重い本体CIをshowcaseのCIへ複製しない（FR14）。未変更のaubeは再buildしない。 | 本体の既存回帰、U7の変更範囲の点検、showcaseのworkflowに本体の重い試験がないことの点検 |
| NFR2.2 | 品質 | showcaseのscriptと試験は、formicariumの既存のlint（Biome）・型検査（strict TypeScript）・試験の経路で検査し、skipや欠落を成功に置き換えない。3ツールのNode/Chromium/Firefox/WebKitの `--version` は、ツール×環境の12行をそれぞれ別の結果として記録し、どれかの欠落・失敗・未実行があれば候補を作らない（C10 U8 profileの `tool-*-version`）。 | 12行の結果の記録、1行の欠落や失敗で候補が作られないことの試験 |
| NFR3.1 | 入力 | ツールの条件（upstream repository、tag の形、公式資産の名前とarchive内のentry、source buildの指定）は設定data（例：`showcase/tools.json`）で表し、scriptにツール固有の分岐を書かない（FR13）。repositoryは設定にある3つ（aube・pitchfork・Biomeのupstream）だけを受け付ける。設定は必須field・型・重複toolを検証し、不正なら候補を作らない。 | 設定の必須field欠落・重複tool・未知repositoryの拒否試験 |
| NFR3.2 | 入力 | 「最新の安定版」は、各upstreamのGitHub「latest release」（draft・prereleaseを除く）で決める。tagと40桁のcommitを1回の実行で一度だけ解決し、その値を候補に固定する（Q2=A、C09）。tagの形は設定の規則と照合し、合わなければ失敗させる。解決後の取得・build・受入は、その固定値だけを使い、途中で解決し直さない。 | latest releaseのない場合・tagの形の不一致の失敗試験、解決を1回だけ行うことの点検 |
| NFR3.3 | 出所 | 公式のx86-64 static musl資産を使うツール（aube・Biome）は、releaseが公開するSHA256（checksum file又はrelease APIのdigest）とサイズの一致、ELF・build-infoの検証（C03 `validateGuest`）を必須にする。資産URL・最終URL・digest・tag・commitを記録する。publisherのattestationは、あれば記録するが必須にしない（Q3=A）。記録したcommitはrelease tagの識別であり、publisherのbinaryの再現性の証明ではないと明記する。公式資産にbuild-infoがない場合は、C03・C09の規則でreleaseのsource identityと出所の記録からbuild-infoを作る。commitを取得・照合できなければ架空の値で埋めず、受入失敗にする。 | checksum不一致・サイズ不一致・動的ELF・commit解決失敗での拒否試験、記録の点検 |
| NFR3.4 | 出所 | 公式のstatic musl資産がないツール（現行の調査ではpitchfork）だけ、設定で指定したsource buildを使う。これは取得失敗のときの別URLへのfallbackではない（C09）。sourceは解決したcommitで固定し、そのcommitが宣言したrepositoryのtagから辿れることを確かめる。RustとtargetはupstreamのBuild設定（`rust-toolchain` など）に従い、showcase自身のtool（Node・Bun など）は最新版にする（U5と同じ方針）。patchを使う場合はrepo内のfileとして固定し、file名とSHA256をbuild-infoに記録する。現行の調査ではpatchは不要で、`sourcePatches` は空になる見込み（未検証）。 | 公式資産のあるツールでsource buildが選ばれないこと、tagから辿れないcommitでbuildが始まらないことの試験 |
| NFR3.5 | 境界 | 取得と展開はC11の上限に従う（DL128MiB、展開合計256MiB、ELF128MiB、4096entry、path4096bytes、metadata1MiB、catalog4MiB）。上限の値は受理し、+1は拒否する。tar.gzは全entryのescape・重複・link・loop・展開総量を検査し、選択entryだけを抜いて他を無視しない。実行と配布には、検証を通ったbytesのcopyだけを使う（C03）。catalogはC04の `GuestCatalog` の形で生成し、生成後に公開APIの `createInstaller` で検証してから候補に入れる。 | 境界値と+1、archive escape・破損の拒否試験、生成catalogを公開APIが受理することの試験 |
| NFR3.6 | 境界 | showcaseは公開API（`@aletheia-works/formicarium` のroot・`/node`・`/browser` のexport）だけをimportする。runtime内部の相対import、本体からshowcaseへの依存、回帰用guest・fixture（`fixtures/` やvivariumのrecipe-owned fixture）の共有を、機械検査で拒否する（FR14）。検査はshowcaseのCIで毎回動かし、違反があれば候補を作らない。 | 内部import・逆依存・fixture共有を1件ずつ入れた違反fixtureで検査が失敗することの試験 |
| NFR4.1 | 時間 | 取得はC11の有限deadlineに従う（1件の取得120s、DNS・redirect・body完了を含む）。source buildはC11のbuild全体4h以内とし、CIのjobにもtimeoutを設定する。期限切れ・取消では、process groupの終了とstagingの除去を待ってから終える。HTTP・CORS・offline・429・不正bodyは原因付きで失敗させ、自動retryや別URLへのfallbackはしない。GitHub APIの解決もworkflowのtokenで行い、rate limitなどの失敗は原因を記録して失敗させる。 | 期限・取消の模擬試験、HTTP失敗と429の原因記録、retryしないことの点検 |
| NFR4.2 | 時間 | 3ツールの取得・展開・検証・登録の性能目標（NFR1の3000ms中央値）はinstall経路の受入（U1・U3）で扱い、U7では記録だけを行う。U7の受入logには、各ツールの取得時間と `--version` までの時間をmsで記録する（環境・版を含む）。 | 受入logの時間の記録の点検 |
| NFR5.1 | 候補 | candidateIdは、自分自身とlogの時刻を除いた入力identity（sourceCommit・formicariumPackSha256・catalogSha256・fixtureInventorySha256・assets・resolvedTools）の正規化digestにする（C09）。同じworkflowの同時実行は、PRごと・呼出しごとのconcurrencyで分け、古い実行の結果が新しい候補を上書きしないようにする。候補は全checkの合格後にだけ確定し、途中で終わった実行のstagingを候補として扱わない。 | 同じ入力で同じcandidateId、入力1つの変更で別のcandidateId、途中終了で候補が残らないことの試験 |
| NFR5.2 | 候補 | 受入した候補は、そのCI runのActions artifactに置き、U8は同じworkflowの中（呼出し元）でそれを受け取る（Q5=A）。U8へは同じcatalog・assetを渡し、U8は最新版を解決し直さない。U7の候補が失敗したときは、U8は配布を始めず、前回の配布物（Pages側）がそのまま残る。U7は候補を長期保存しない。 | 候補失敗で配布jobが動かないこと、U8が受け取ったcatalog・assetのdigestがU7のmanifestと一致することの試験 |
| NFR5.3 | 本体 | showcaseが使う本体は、同じcommitから作った `npm pack` のtarballとし、そのSHA256を `formicariumPackSha256` に記録する（Q4=A）。PRとmainの検証では、同じcommitで作ったtarballを使う。配布する候補（U8の日次build）では、tarballのSHA256がB1受入（C06）の `packSha256` と一致することを必須にし、一致しなければ配布しない（C10 U8 profileの `candidate-identity`）。0.3.0の公開前に、公開済みと記録しない。 | pack SHA256の記録、C06と一致しない候補の配布拒否試験 |
| NFR6.1 | 環境 | Node、Chromium、Firefox、WebKitの4環境で、3ツールの `--version` が選んだ版と一致することを確かめる（FR13）。browserでは、guestを同origin・COI（SharedArrayBuffer）・既存のCSP（blob・wasm）・Workerの `delete Atomics.waitAsync` を保ったまま動かす。実機Safariは別の証拠がなければ未検証と書き、WebKitの結果で置き換えない。Node・Playwrightの版を受入logに記録する。 | 4環境の結果、COI・Worker配置の確認、Safariを未検証と記録することの点検 |
| NFR8.1 | 権限 | showcaseのCIは、`showcase/` か公開APIの配布物が変わるPR、mainへのpush、手動実行、U8の日次buildからの呼出しで動かす。jobの権限は `contents: read` だけにし、最新releaseの解決にはworkflowの読取り用tokenを使う。候補の保存や配布への書込みの権限はこのCIに持たせない（Q1=A）。未信頼のforkのPRでも書込み権限やsecretを使わない。Actionの参照は信頼したものに限る。 | workflowの権限・契機・Action参照の点検、forkのPRで書込みが起きないことの確認 |
| NFR8.2 | 運用 | 秘密やtokenをログ・catalog・manifest・受入logに出さない。取得したresponseの全文をlogに出さない。公式資産とsource buildのlicense・noticesを候補に含め、配布物と対応づける。新規費用は事前に相談する。変更はPR単位で切り戻せるようにし、terrariumの現行の最新版ビルドはFR16まで維持する（壊さない）。 | ログとmetadataの点検、noticesの照合、切戻し手順の文書 |

## Threats and Boundaries

showcaseの候補供給が扱う主な脅威は、次の4つである。
- 改変された資産：checksumやサイズが合わない公式資産、別のforkのcommitから作ったsource buildを受け入れること。
- 版の取り違え：解決した版と実際に受入した版が違うこと、途中で最新版を解決し直してU8へ別の版を渡すこと。
- 境界の崩れ：showcaseがruntime内部へ依存する、本体がshowcaseへ依存する、回帰用のfixtureをデモと共有すること。
- 過大な権限：PRのCIで書込み権限やsecretを使えること。

対策として、repositoryを設定の3つに限り、版の解決を1回に固定する。資産はchecksum・サイズ・ELF・build-infoで毎回検証し、検証したcopyだけを使う。境界は機械検査で毎回確かめる。CIの権限は読取りだけにし、保存と配布の書込みはU8と承認後の既存executorに残す。

## Applicability

U7はpackagingのUnitなので、性能・拡張性・信頼性・観測性の文書は作らない（stageのproduces_kinds）。性能の目標（NFR1）はinstall経路のもので、U7では時間の記録だけを行う（NFR4.2）。NFR7（端末・install UIの状態表示とescape）はU8のUIの要件で、U7の対象外とする。

## Assumptions & Open Questions

- 各ツールの公式資産の有無（aube・Biomeはstatic musl資産あり、pitchforkはglibcの動的な資産だけ）は、現行terrariumの2026-10-10の記録による。U7の実行時点の最新releaseで確かめる（未検証）。
- Biomeの公式musl ELFが、この実行環境の最新releaseでもstaticであるかは、U1の記録をもとにCode Generationで確かめる（未検証）。
- showcaseのdirectoryの構成（`showcase/{tools.json,builders,scripts,fixtures,tests}`）は移管計画の案であり、NFR DesignとCode Generationで確定する。
