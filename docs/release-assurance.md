> Historical 0.1.0 release evidence. Normal stable publication now follows docs/automated-releases.md; mandatory RC adoption and candidate-bound manual publication inputs described below are not the current stable workflow.

# Release assurance

## 公開専用候補と実workflowの準備（2026-10-10）

人間がGitHub公開先を`aletheia-works/formicarium`と確定した。準備したtupleはrepository=`aletheia-works/formicarium`、workflow=`publish.yml`、environment=`release`。npm scope owner/2FA enforcementは実画面で確認済みだが、対象package/Trusted Publisher設定はまだない。ブラウザのログインはCLIの認証ではなく、mainの`npm whoami`はENEEDAUTHだった。公開・初回認証の成功とは扱わない。

`publication.ts`は旧v9のmanifestとtgzを検査し、未使用ディレクトリへ公開専用候補を作る。元の24ファイル集合、JS/型/wasm/notice bytesを保持し、package.jsonだけprivate=false、実repository URL、public registry/accessと版を変更する。旧v9のmanifest、archive、U1–U3は変更しない。新候補は新SHAでpack/consumer/coverageへ結合する。以下はmainが直接mise Node/npm実体へ置換し、具体的identity JSONを用いて順に実行するローカル準備である。

```sh
node scripts/release/publication-cli.js prepare .artifacts/u1-package-v9.manifest.json .artifacts/u1-v9/aletheia-works-formicarium-0.1.0-rc.1.tgz .artifacts/publication-rc-v1 <identity.json>
npm pack .artifacts/publication-rc-v1 --ignore-scripts --pack-destination <new-output-directory>
node scripts/release/publication-cli.js validate .artifacts/publication-rc-v1.publication.json <identity.json> <new-exact.tgz>
node scripts/release/publication-cli.js plan <evidence-root> <request.json>
```

identityの必須項目はrepository/workflow/environment/sourceCommit/version/tag/distTag。RCはversion=0.1.0-rc.1/tag=v0.1.0-rc.1/distTag=next、stableは0.1.0/v0.1.0/latest。sourceCommitは実承認対象のcommitを指定し、候補のprepare/validate成功は操作承認ではない。validateは元manifestを書換えず、実tgz SHAを持つ新結果を返す。`plan`はroot内の証拠を原SHAで読むだけで、公開しない。

公開workflowは他のrepositoryと同じYAML形式で、`v*` tagのpushと公開repositoryだけを入口にする。実行時に厳密なstable/RC版、tag、source SHAを照合する。verifyは読取権限だけで、Bunによる入力取得と既存の承認・候補CI・全realm coverage・stable受入れ検査を実行し、検証済みcandidate.tgzだけを標準artifactへ保存する。後続jobは同じrunのartifactをダウンロードし、verifyのSHA256出力と照合してからYAMLに明記した公開コマンドを実行する。publishだけid-token:write、Releaseだけcontents:writeを与え、environmentはreleaseを維持する。長期npm tokenは渡さず、bunxで最新npm CLIを起動してOIDC/provenance付きで同一tgzを公開する。生成runner、独自manifest、npm CLI archiveの固定供給は廃止した。

検証設定は`scripts/release/publication-policy.json`に置く。writerEnabled=falseや独立確認していないproducer/workflow IDは拒否する。公開用artifactは検査成功時だけ作成され、Release用の操作承認がない場合はRelease jobを起動しない。失敗・不明な外部操作結果の自動再送は行わない。

入力bundleの取得URLとSHA256はGitHubの`FORMICARIUM_RELEASE_INPUT_URL`/`FORMICARIUM_RELEASE_INPUT_SHA256`へ、具体的外部操作の承認後に設定する。bundleは`request.json`、`publication.json`、`candidate.tgz`とroot相対の証拠を含む。publication.jsonのtarball.pathはcandidate.tgz。requestはcandidate/index/evidenceIds/approvals/identity/publisherを指定する。固定24のうちpack外のU2/U3 source bytesは`sources/<fixed-inventory-path>`へ同梱し、各SHAを照合する。bundle取得は全体SHAを検査し、path逸脱/リンク/重複/.npmrcを拒否する。検証候補v9の古い証拠を新公開候補の成功へ付け替えない。

publisher観測artifactはkind=npm-settings-observation、package、repository/workflow/environment、allowedAction=publish、observedAt、simulated=falseを持ち、実画面/API観測からmainが作る。request内の同tuple/日時/SHAと原bytesを照合する。fixtureの同形JSONはローカルoracleであり実設定の証明ではない。保存された設定観測はnpm認証成功を保証せず、初回OIDC公開のrun/log/provenance/registry読み戻しで実認証を確認する。GitHub Releaseにもcreate-github-releaseの独立した具体的操作承認が必要。

## 初回packageのbootstrapと公開順序

ドキュメント根拠：[npm trust](https://docs.npmjs.com/cli/v11/commands/npm-trust/)は存在するpackageと2FAを要件とする。[staged publishing](https://docs.npmjs.com/staged-publishing/)は新packageにも使えるが、公に見える0.0.0-stage placeholderを作る。stagingも外部公開操作であり、read-only確認や無承認のbootstrapとして実行しない。npm CLI>=11.15.0/Node>=22.14.0が必要。mainで観測したnpm11.19.0は版条件を満たすが、CLI認証は別途必要である。

具体的手順は、公開専用候補のローカル検証と差分準備→人間が送信する版/候補SHA/公開placeholder/送信先を承認→ユーザーが対話CLIで初回認証→承認した候補をstaged送信→対象packageの実Trusted Publisherをpublish.yml/releaseへ登録→実設定読戻し→承認済みタグからOIDCでRC公開→registry tgz/integrity/nextとRelease asset読み戻し→stable候補の差分と全NFR/採用証拠を検証→具体的stable公開承認である。staged承認でRCを公開する経路を選ぶ場合は、OIDC経路の認証成功と区別して記録し、FR10の実認証を模擬成功で満たさない。未選択のbootstrap経路や不足設定はgateをblockedに保つ。

認証情報/tokenをチャット・artifactへ取り込まない。repo/push/入力供給/設定変更/bootstrap/RC・stable公開/Releaseは、それぞれ具体的対象が準備できてから必要な最終承認を得る。新Trusted Publisherは初回成功まで2日で期限が来るため、実行準備が整ってから登録し読み戻す。[npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers/)。RCの公開前条件へ「既に公開されたRCの導入成功」を置かず、実RC受入れはstableの前提として確認する。

## 現在の状態と版の境界（2026-10-10）

検証済み：現在のローカルv9 tarballは`dfcc3e6384b5ed14ddefbccd4806b9f1be2d858129e74216f116668142571f6d`、coreは`a882fb2f3df14115b7e46f6812fb296eef5934d7`でdirty=false。mainによる現在の回帰はbuild/runner/probe Node39、aube Node4、session/pitchfork Node11、probe/aube 3browser33、pitchfork 3browser3、pack/types9、collector指定4files41件が成功した。134ファイルの実行前後identityは不変。旧coreのaube timeoutは履歴として保持し、現在の成功に付け替えない。

U3の現在のローカルv9接続はpitchfork v2.30.1でbridge6・owner-copy45が成功している。正式ownerの旧承認はv2.30.0のまま。U3 v3 coverageは固定24、1450/1801行=80.51%、skip0。U4でseal1705files、source/site/tgz、46receipts、U1同packの1253realm import、元レポートbytesと再集計を読み取り再照合した履歴importであり、新しいU4測定ではない。U1の実機Safari5ケースは成功済みだが、U3候補の実機Safariは未検証。Trusted Publisher実設定、公開済みRCの実受入れ、npm公開は未実施で公開判定はblockedを維持する。

検証済み（保存済みmain観測）：[遠隔CI run38011644576](https://github.com/Marukome0743/formicarium/actions/runs/38011644576)はsource `c75bc285f0320e2f3cb234569fa9cc4bc4588a9d`で全必須9check、436試験とnative2件が成功し、fail0/skip0、acceptance=true。fresh固定24 coverageは1450/1801行=80.51%、46receipt。同packとexecutionIdentityへの結合、原ログ・ZIP・抽出物のSHA照合はAI-DLCの記録（`aidlc/`）に保存している。これはそのsourceの成功記録であり、今回のcollector修正を遠隔で再実行した結果ではない。工程承認、Trusted Publisher、公開済みRC導入、実公開は別の未完条件である。

検証済み：C6の4新規否定回帰はRed後に修正し、整形後正式build/emitとrelease26件が成功。現在U3v3の原report/inventoryをread-onlyでvalidateEvidenceへ渡す正常受入れも確認した。固定24のうち23measured、npm.ts未実行0を分母に保持する。実envelope保存と公開判定は行っていない（evidenceSaved=false）。sourceCommitは観測jj baseで、working-treeの第一者SHAを別に結合し、公開可能commitとは主張しない。

## 2026-10-08時点の履歴

2026-10-08のU4では公開候補の証拠保存とRC/stable判定を実装している。package.jsonは`private: true`、npm公開は未実施。実機Safari、遠隔CI、registry権限・Trusted Publisher実設定は未検証である。ローカル実装の完了は公開可能性を保証しない。

検証済み（main観測）：pitchfork v2.30.1、公式commit `1054549e85470b08d9507e2c82c850959a4b3914` はbuild検査9件、同一ELFのnative2回一致、Node11件、3browserの3件が成功しnative出力と一致した。これはformicariumの既存PoC入口での検証である。正式owner U3のconsumer/coverageはpitchfork v2.30.0の履歴である。既存muslパッチの歴史的filenameと内容を保持する。版・guest ELF・core・fixture・候補・commandが異なる証拠を付け替えない。

## 証拠APIと不変保存

`scripts/release/types.ts`が候補、check、coverage、RC採用、操作承認、判定の型を定義する。`CandidateIdentity`はcandidateId、version、sourceCommit、tarball SHA、dirty=falseのcore identity、固定24配布JSのSHAと除外理由を持つ。`CheckEvidence`は同候補/tgzへの結合、command/environment、終了分類、stdout/stderr artifactとSHA、guest/build、browser、未検証事項を保持する。

`validateEvidence(root, evidence)`は固定集合、重複ID、候補不一致、log/artifact改変、passedと終了結果の矛盾を拒否する。artifactはroot相対の通常ファイルだけを読み、path逸脱とsymlinkを拒否する。coverageは同候補、固定24分母、report artifactのSHA、executionIdentity、reportとの行数一致を検査する。型の情報だけで供給元や公開履歴の真正性が自動確定するわけではないため、mainが元観測とidentityを照合する。

`saveEvidence(root, evidence)`は検査後`envelopes/<evidenceId>.json`と`indexes/<evidenceId>.json`をexclusiveに作成する。各indexはevidenceId→artifact/SHAの1件を保存し、既存IDを上書きしない。`resolveEvidence(root, index, id)`は集合内の一意ID、原bytes SHA、envelope IDと内容を再検査する。複数indexを使う場合はentriesを集約した`EvidenceIndex`を渡す。再実行は新IDで保存し、旧失敗・過去観測を保持する。

coverageの独立`binding`はgeneration/sourceIdentity/candidateSha256（site）/executionIdentityを固定し、tarball identityを別に照合する。`inventoryArtifact`のSHAもcheckに保存し、24sourceのSHA、Node1と3browser×15の正規receipt46件、同packのU1正規realm1253件を検査する。realmは正規の完全一致だけを認め、文字列部分一致や一つのfileへの偽のglobal tokenで代替しない。各fileに全browserを新たに義務づける仕様ではない。

## RCとstableの判定

`decideRelease({root,index,candidate,evidenceIds,approvals,target,channel})`はdigestを確認して判定するAPIであり、公開コマンドを実行しない。`missing`が空なら`allowed: true, outcome: not-run`、不足・破損なら`blocked`を返す。

| 条件 | RC | stable |
| --- | --- | --- |
| version/tag/dist-tag | 0.1.0-rc.1 / v0.1.0-rc.1 / next | 0.1.0 / v0.1.0 / latest |
| 直接証拠 | 同RC候補のenvelope | 同stable候補のenvelope |
| 基本check | pack、assets、types、consumer-node/3browser、public-source、supply-chain、trusted-publisher | 同じ基本check |
| 追加check | 公開済みRC受入れを公開前に要求しない | native-baseline、probe/aube/pitchfork各Node/3browser、integration-ci、stable-pack/types/consumer-node/3browser/diff |
| coverage | Unitの品質条件は維持 | 固定24、80%以上、収集状態とNode/3browser realmが必要 |
| 採用履歴 | 不要 | explicit rcAdoptionが必要 |

stableの`rcAdoption`はRC envelope ID/SHA、別RCのcandidate/version/tgz、公開packageのversion/tgz/registryIntegrity、stable identity、差分artifact/SHAと事前固定された検査IDを結ぶ。RCをstableの直接証拠へ混入できない。RC側に採用の循環を持たせず、差分の候補結合を照合する。不成立を旧RC結果の再ラベルで補わない。

公開操作の承認は`publish-rc`または`publish-stable`、target、candidateId、version、sourceCommit、人間入力・日時が一致する必要がある。Plan Approval、模擬fixture承認、判定APIのallowedは実操作の承認に変換しない。公開repo作成・pushも別操作として承認が必要。未実施の必須check、未検証のTrusted Publisher、実RC採用不足、coverage不足、失敗・timeout・abort・別候補はblocked理由として残す。

## 観測collectorの利用

`collectCommand({checkId,executable,args,cwd,timeoutMs,environment,candidate,out,signal?})`をmainが逐次呼ぶ。executable/cwdは絶対path、argvはshell=falseで起動する。UUIDごとの新規ディレクトリにstdout/stderrとSHA、開始/終了時刻、cwd、結果を保存する。exit0かつ通常exitだけをpassedにし、init-failure、非0、timeout、abortedを区別する。collectorはguest identityを推定して埋めないため、呼出し側で実観測を結合する。`environment`は記録用説明であり環境変数を設定する引数ではない。機密のないargv/logだけを収集する。

`unexecuted(checkId,candidate,reason)`はnot-run/unverifiedを返す。`observeArtifact(filename,expectedSHA)`は原bytesのSHAとsizeを照合する。既存結果の採用時はcommand/log原SHA、候補と取得時観測を保存し、fresh実行と区別する。source/historyの完全scanやLICENSE/notices/取得元の確認成功は、このAPIの存在だけでは主張しない。

timeout/実行中abortはPOSIXでは独立process group、Windowsではtaskkill /T /Fで子孫を停止する。標準出力の終了待ちは250msで打ち切り、取得済みログを保存する。明示的にprocess groupを離脱した孫までの終了は保証しないが、出力pipeによる無期限待ちは防ぐ。検証済み：macOSの継承pipeを持つ有限孫fixtureでtimeout/abortの子孫終了、期限付近のsettle、failed分類とログSHAを確認した。Windows経路は未検証。

## Coverage sealと再実行

順序はprepare→正式bundle→seal→measure→report。prepareのinputには未使用out、site、terrarium、packageRoot、tarball、u1Reportの実pathを指定する。固定24はU1の14、U2の3、U3の7。80%や除外を閾値達成のために変更しない。U1は同pack/source/maps/全realmの明示importとして原generationを保持する。

```sh
node scripts/terrarium/coverage.js prepare <input.json>
bun build <out>/terrarium/packages/terrarium/src/index.ts --outfile <out>/site/web/terrarium.mjs --format esm --target browser --define '__TERRARIUM_VERSION__="u3-coverage"'
node scripts/terrarium/coverage.js seal <out>
node scripts/terrarium/coverage.js node <out> <absolute-Bun>
```

上記node/bunはmainがmise管理の実体へ置換する。sealはsite、測定workspace、test/config/preload/verifierのpath/kind/size/SHAと依存treeを固定し、generation/source/candidateへ結合したexecutionIdentityを保存する。Node開始/終了、browser開始/終了、reportで再照合しreceiptへ同identityを結ぶ。未seal、二重seal、古receipt、追加・欠落・kind変更・escaping link・bytes driftを拒否する。依存node_modulesへの許容linkもcanonical targetと実bytesを検査し、任意の外部依存linkを許可しない。seal後のbundleやtest編集には新outと再測定が必要。

browserは`<out>/terrarium/packages/terrarium`をcwdとして、固定owner入力の`FORMICARIUM_INPUTS_ROOT`、直接Bunの`TERRARIUM_BUN`、absolute測定siteの`TERRARIUM_SITE_DIR`、browser cacheを指定する。

```sh
node /Users/mutoakio/Documents/terrarium/packages/terrarium/node_modules/@playwright/test/cli.js test --config playwright.formicarium.config.ts e2e/formicarium-terminal.spec.ts e2e/formicarium-iframe.spec.ts --workers=1 --retries=0
node scripts/terrarium/coverage.js report <out>
```

reportはformicarium rootから実行する。固定15 browser cases×3engineとNode測定を要求する。旧out/receiptを変更せず、失敗時も保存して別generationへ進む。

正式buildは直接Nodeで`node_modules/typescript/bin/tsc -p tsconfig.json`、同`-p tsconfig.tests.json`、`.build/scripts/emit.js`を順に実行する。生成JSは直接編集しない。主要な再検査は次のexact filesをmainで逐次実行する。

```sh
node --test --test-concurrency=1 tests/release/evidence.test.js tests/release/decision.test.js tests/release/collect.test.js
node --test --test-concurrency=1 tests/terrarium/coverage.test.js
node --test --test-concurrency=1 tests/node/build.test.js
node --test --test-concurrency=1 tests/node/session.test.js tests/node/pitchfork-basic.test.js
node node_modules/@playwright/test/cli.js test tests/browser/pitchfork-basic.spec.ts --workers=1 --retries=0
```

native baselineは`FORMICARIUM_CONTAINER=docker FORMICARIUM_NODE=<absolute-Node> bash scripts/native-baseline.sh pitchfork-basic --check-reproducible`で同v2.30.1 ELFをネットワークなしLinuxで2回実行した結果から生成する。版文字列の置換で代替しない。上限probe600秒、aube browser840秒、pitchfork Node120秒/browser600秒、1worker/retries0、wasm1GB、native一致を保持する。

## Trusted Publishingと未確認事項

ドキュメント根拠（2026-10-10 main再確認、U4 verification/trusted-publishing-docs-recheck.md）：npm Trusted Publishingはnpm CLI≥11.5.1、Node≥22.14.0、GitHub-hosted runnerのOIDCを要件とする。npm側のowner/repo/workflow filenameと任意environmentが実workflow identityに一致する必要がある。direct publishとdist-tagの許可は別設定として確認する。実npm設定・OIDC・registryは未検証。[npm公式仕様](https://docs.npmjs.com/trusted-publishers/)。

公開jobだけに`id-token: write`と必要最小の`contents: read`を与え、長期npm tokenを作らない。setup-nodeの公開例はNode24と`package-manager-cache: false`を示す。[setup-node advanced usage](https://github.com/actions/setup-node/blob/main/docs/advanced-usage.md#publishing-to-npm-with-trusted-publisher-oidc)。公開先とregistry設定は[GitHubのNode.js package公開手順](https://docs.github.com/en/actions/tutorials/publish-packages/publish-nodejs-packages)も照合する。

このworkspaceでnpm側設定、実公開jobのOIDC権限・identity、registry照合、公開済みRC受入れを実確認したという主張はない。検証専用遠隔CIの成功は上記runの保存証拠に限定する。後続工程で設定と観測証拠を取得するまでtrusted-publisher等を未検証として扱い、公開判定をblockedに保つ。
