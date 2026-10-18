# showcase候補供給の安全・品質の設計

## Sources

根拠は次のとおり。
- `../nfr-requirements/security-requirements.md`（NFR2.1–NFR8.2）と `../nfr-requirements/tech-stack-decisions.md`
- `../../../inception/contract-design/contract-summary.md`（C03・C04・C05・C06・C07・C09・C10・C11。未知の付加fieldは受理してidentityに含めるという共通の規則を含む）
- `../../../inception/domain-design/components.md`（Showcaseの部品）
- U4の受入記録にあるB1のpack（SHA256 `61b209ae1c98690f4f69eeca25c06f6485d05420c339283416e0aff91ea9cb98`、CI artifactの保存は7日）
- 現行terrariumの最新版ビルド（`terrarium/integration/latest-tool-builds.md`、`build-latest-guests.yml`）
- 人間の回答（`nfr-design-questions.md` の Q1–Q4、すべてA）。Q4で、NFR8.1の「`contents: read` だけ」に、再利用のための `actions: read` を加えることを人間が決めた。U5で人間が決めたtoolchainの方針

U7はpackagingのUnitで、この文書は設計の方針であり実装ではない。動作は未検証。

## Design

### 1. 契機・job・工程

workflowは1つ（仮に `showcase.yml`）で、次の契機で動く。
- `pull_request`：`showcase/**`、`.github/workflows/showcase.yml`、公開APIの配布物（`runtime/**`、`types/**`、`package.json`）の変更。
- `push`（`main`）：同じpaths。
- `workflow_dispatch`：手動。
- `workflow_call`：U8の日次build（`main` のworkflowから呼ぶ）。入力 `mode` は `verify`（既定）か `distribute`。

showcaseのCIは、本体の重い試験（probe、aube browser回帰、本体coverage）を動かさない。本体の品質の上限（probe≤600s・8項目、aube browser≤840s、worker1・retry0、native出力一致、wasm1GB、WorkerのwaitAsync削除、第一者配布JSの行coverage≥80%）は本体のCIのままで、showcaseの変更でこれらの値・試験・設定を変えない。aubeはsource buildせず（公式資産を使う）、本体のaubeのguestも再buildしない（NFR2.1）。showcaseのscriptと試験は、本体と同じBiome・strict TypeScriptの検査に含め、skipや欠落を成功にしない（NFR2.2）。

jobと受渡しは次のとおり。各jobは前のjobのartifactのdigestを入力として記録する。

| job | 内容 | 権限 | 受け取る | 渡す |
|---|---|---|---|---|
| `resolve` | 設定と許可一覧の検査、最新版の解決 | `contents: read` | なし | `resolutions.json` |
| `acquire` | 公式資産の取得、又はsource build（再利用を含む） | `contents: read`、`actions: read` | `resolutions.json` | ELF・build-info・出所の記録 |
| `catalog` | 検証とcatalogの生成、本体のpackの用意 | `contents: read`、`actions: read` | 上の2つ | catalog・pack |
| `accept` | Node・3ブラウザの受入、境界の検査 | `contents: read` | 上の全部 | 受入log |
| `candidate` | manifestの作成とupload、U8への信号 | `contents: read` | 上の全部 | 候補のartifactとjobの出力 |

どのjobも書込み権限とsecretを持たない。`actions/checkout` は `persist-credentials: false` にし、upstreamのbuild scriptを動かす `acquire` のsource buildの工程では、`GITHUB_TOKEN` を環境に渡さない（解決は `resolve` で済ませる）。Actionはcommit SHAで参照する（NFR8.1）。

### 2. 設定・許可一覧と、PRで変えられる部分（NFR3.1・Q2=A）

- `showcase/tools.json`（仮）にツールの条件を書く：tool名、repository、tagの形の規則、公式資産の名前とarchive entry、source buildの指定。scriptはツール固有の分岐を持たない。設定は必須field・型・tool名の重複・未知のbuild種別を検証する。
- 許可するrepositoryの一覧は別のfile（仮に `showcase/allowed-sources.json`）に固定する。`CODEOWNERS` でレビュー必須にする対象は、一覧だけでなく、`.github/workflows/showcase.yml`、`showcase/scripts/**`、設定のschema、境界の検査の設定も含める。
- `resolve` は、`main` にある一覧を `git show origin/main:showcase/allowed-sources.json` で読み、`tools.json` のrepositoryがそれにない場合は拒否する。
- この拒否が守れる範囲を明記する。`pull_request` ではPR側のworkflowとscriptが動くので、forkのPRは検査そのものを外せる。そのため、PRのrunの結果は信頼しない：
  - 配布する候補と、再利用の元になる成果物は、`main` の定義で動くrun（`push`・`workflow_call`・`workflow_dispatch` on `main`）だけが作る（§5・§7）。PRのrunの成果物は、どのrunからも再利用しない。
  - PRのrunでforkが使えるのは、読取り専用のtokenとCIの資源だけである（書込み権限・secretなし、jobのtimeout 180分）。残るリスクはCIの資源の消費で、これは「forkのPRのworkflowの実行に承認を求める」repositoryの設定で抑える。この設定の変更はrepositoryへの外部の適用なので、既存の承認の条件に従い、Infrastructure Designで扱う。

### 3. 最新版の解決（NFR3.2）

- GitHub REST APIの `releases/latest`（draft・prereleaseを除く）でtagを得る。tagのcommitは `git/ref/tags/<tag>` で得て、objectが `tag`（annotated tag）なら `git/tags/<sha>` を辿ってcommitまで解決する。40桁でなければ失敗にする。
- 1つのrunで1回だけ解決し、結果（tool、tag、commit、解決の時刻）を `resolutions.json` に固定する。以降のjobはこのfileだけを読む。
- tagは `tools.json` の規則と照合する。

### 4. 取得と出所（NFR3.3・NFR3.5・NFR4.1）

- 取得はC11の規則に従う：HTTPS、credentialなし、redirectは5hopまで各hopを検査、120sのdeadline、Content-Lengthを信用せずstreamの累積で上限を確かめる。
- 失敗は原因で分ける：HTTP非2xx、offline・DNS失敗、429・rate limit、redirectの規則違反、上限超過、不正なbody、deadline。原因と対象のURL（credentialなし）をlogに記録し、retryと別のURLへのfallbackはしない。
- releaseが公開するSHA256（checksum file、又はrelease APIの資産digest）とサイズを照合する。どちらも得られなければ失敗にする。attestationがあれば記録する。
- tar.gzはC11の規則で全entryを検査し、設定のentryだけを取り出す。ELFとbuild-infoはC03の `validateGuest` で検証し、以降は検証済みのcopyだけを使う。
- 公式資産にbuild-infoがない場合は、`resolutions.json` のsource identityと資産の記録からbuild-infoを作る。commitが解決できていなければ作らずに失敗にする。
- 出所の記録には「このcommitはrelease tagの識別であり、publisherのbinaryの再現性の証明ではない」という説明を、manifestの `provenance.note` として毎回入れる。

### 5. source buildと再利用（NFR3.4・NFR4.1・Q3=A・Q4=A）

- 対象は、`tools.json` でsource buildを指定したツールだけ（現行の調査ではpitchfork）。公式資産の取得に失敗したときの代わりには使わない。
- commitは `resolutions.json` の値に固定し、build前にそのcommitが宣言したrepositoryのtagから辿れることを確かめる。
- toolchain：Rustとtargetは、upstreamの宣言（`rust-toolchain(.toml)` など）があればそれに従い、なければ最新の安定版を使う。UIのbuildに使うNode・aubeも同じ規則で、upstreamの宣言（`mise.toml`・`.node-version`・`package.json` の `engines` など）に従い、なければ最新の安定版にする（U5の方針）。upstreamのcontributor向けwrapperは使わず、cargoを直接呼ぶ。toolの自動導入は止める（`MISE_AUTO_INSTALL=0` など）。
- 出所の記録：`Cargo.lock` を使い `--locked` で取得する。build-infoに、`rustc -vV` の結果、`Cargo.lock` のSHA256を含むdependencies、sourcePatches（現行の調査では空）、builderHash（showcaseのbuild script・設定・toolchainの版のinventoryのdigest）を記録する。buildKeyはC07と同じ規則で計算する。
- 時間と後始末：jobのtimeoutは180分（C11の4時間より短いので180分で切る）。同じPRの古い実行は取り消す（`cancel-in-progress` はPRだけ）。buildは独立したprocess groupで動かし、timeout・取消のsignalを受けたら、process groupを終了させ、終了を待ってからstagingのdirectoryを消して終える。stagingのものはuploadしない。
- 再利用（Q4=A）：まず `resolutions.json`・設定・builderHashからbuildKeyを計算する。再利用元は、次をすべて満たすrunだけにする：同じworkflow file（`.github/workflows/showcase.yml`）、head branchが `main`、eventが `push`・`schedule`・`workflow_call`・`workflow_dispatch` のいずれか（`pull_request` は除く）、conclusionが `success`、artifactが保存期限内。その中で最新のrunのartifactからELFとbuild-infoを取り出し、次を照合する：build-infoのbuildKeyが自分で計算したbuildKeyと一致、ELFのSHA256がbuild-infoの `elfSha256` と一致、build-infoのsource（repository・commit）が `resolutions.json` と一致、C03の `validateGuest` が通る。どれかが合わない・取得できない場合はsource buildを動かす。再利用したことと元のrunのidを `provenance.reusedFromRun` に記録する。

### 6. catalogの生成（NFR3.5）

- C04の `GuestCatalog` の形で生成し、`defaults` に解決した版を書く。生成後に公開APIの `createInstaller` に渡して受理されることを確かめる。

### 7. 本体のpackと、配布する候補（NFR5.3・Q1=A）

- `mode: verify`（PR・push・手動・U8の検証）：同じcommitから `npm pack` でtarballを作り、そのSHA256を `formicariumPackSha256` にする。
- `mode: distribute`（U8の日次build、`main` の定義でだけ動く）：B1受入で固定したpack（現在のB1はSHA256 `61b209ae…`）を取得し、C06の `packSha256` と照合する。一致したpackで、§8の受入の12行をすべて動かす（同じcommitで作ったpackは使わない）。
- manifestの意味：`sourceCommit` はshowcaseのrunのformicariumのcommit（showcaseのcodeと設定の版）。付加field `formicariumSourceCommit` にpackの元のcommitを書く。`mode: distribute` ではC06の `sourceCommit` と同じ値、`mode: verify` では `sourceCommit` と同じ値になる。`main` がB1の commitより進んでいても、本体はB1のpackで固定される。
- 付加field `distributable`（`true`／`false`）をmanifestの最上位に置く。契約の共通の規則（未知の付加fieldは受理してidentityに含める）により、candidateIdの計算に含める。`mode: verify` は常に `false`、`mode: distribute` で全工程が成功したときだけ `true`。
- B1のpackは今はCI artifact（保存7日）にしかない。長く使える保存先（承認後のRelease資産、又は0.3.0の公開）はInfrastructure Designで決め、人間の承認後に作る。`mode: distribute` でB1のpackを取得できない・一致しないときは、そのrunを失敗にし、原因（`b1-pack-unavailable` か `b1-pack-mismatch`）を記録する。

### 8. 受入（NFR2.2・NFR4.2・NFR6.1）

- Nodeは公開の `/node` export、browserはPlaywrightでChromium・Firefox・WebKitを使い、公開の `/browser` exportとC05の `createCommandSession` で `install <tool>` と `<tool> --version` を実行する。
- 3ツール×4環境の12行を記録し、各行で、stdoutの版が `resolutions.json` のtagと一致することを確かめる。1行でも失敗・欠落・未実行があれば候補を作らない。各行に、取得の時間と `--version` までの時間（ms）、環境（Node・Playwright・browserの版）を記録する。
- browserはCOI・同origin・既存のCSP・Workerの `delete Atomics.waitAsync` のまま動かす。Safari実機は未検証と記録する。

### 9. 境界の機械検査（NFR3.6）

- showcaseの全sourceのimportを静的に調べ、`@aletheia-works/formicarium`、`/node`、`/browser` 以外の本体への参照（`runtime/`・`types/` への相対path、package内部のpath）を拒否する。
- 本体のsource（`runtime/`・`types/`・`scripts/`）に `showcase/` への参照がないことを調べる。
- showcaseが回帰用のfixture（`fixtures/`、vivariumのrecipe-owned fixture）を参照しないことを調べる。
- Biomeの `noRestrictedImports` などで書けるものはBiomeに、書けないもの（逆依存・fixture参照）は専用scriptにする。違反fixtureを1件ずつ入れて失敗することを試験する。

### 10. 候補・manifestとU8への信号（NFR5.1・NFR5.2）

- C09の `ShowcaseCandidateManifest` に、上の付加field（`formicariumSourceCommit`、`distributable`）と、`resolvedTools` の各要素の `provenance`（資産URL・最終URL・download digest・attestationの有無・`note`・`reusedFromRun`）を加える。
- candidateIdは、C09の規則（自分自身とlogの時刻を除いた正規化digest、付加fieldを含む）で計算する。
- 候補は、全工程が成功した後にだけActions artifactとしてuploadする。途中で終わったrunはuploadしない。同時実行はPRごと・呼出しごとのconcurrencyで分ける。
- U8への信号：`candidate` jobの出力 `candidate-id` と `distributable` を返す。U8は、このjobが成功し、かつ `distributable` が `true` のときだけ配布を始める。それ以外（失敗、`false`）では配布を始めず、前回の配布物が残る。

### 11. 秘密とlog（NFR8.2）

- logには、tokenやresponseの全文を出さない。licenseとnoticesを候補に含め、配布物と対応づける。

## Threats and Mitigations

| 脅威 | 対策 | 要件 |
|---|---|---|
| forkのPRが一覧や検査を書き換えて別のsourceをbuildする | PRのrunの成果物を信頼しない（配布と再利用は `main` の定義のrunだけ）、CODEOWNERS、読取り専用・secretなし・180分、forkのworkflowの承認の設定 | NFR3.1・NFR8.1 |
| 改変された公式資産 | release公開のSHA256とサイズ、ELF・build-infoの検証、検証済みcopyだけを使用 | NFR3.3・NFR3.5 |
| 別のforkのcommitや途中の版をbuildする | annotated tagを含むcommitの解決、tagから辿れることの確認、1回だけの解決 | NFR3.2・NFR3.4 |
| PRのrunの成果物を再利用する | 再利用元をmainの定義の成功runに限定、自分で計算したbuildKeyとの照合 | NFR3.4・NFR5.1 |
| 本体の取り違え | 配布候補はB1のpackで受入し、C06のpackSha256と照合 | NFR5.3 |
| PRでの過大な資源の使用 | 180分のtimeout、古い実行の取消、変更がなければ再利用 | NFR4.1 |
| upstreamのbuild scriptによるtokenの使用 | `persist-credentials: false`、source buildの工程にtokenを渡さない | NFR8.1 |

## Applicability

U7はpackagingのUnitなので、性能・拡張性・信頼性・観測性・logical-componentsの文書は作らない（stageのproduces_kinds）。時間の記録（NFR4.2）は受入logの項目として§8で扱う。

## Assumptions & Open Questions

- B1のpackの長期の保存先と、forkのPRのworkflowの実行に承認を求めるrepositoryの設定は、Infrastructure Designで扱い、外部への適用は人間の承認が必要になる。
- 各ツールの最新releaseの公式資産の形と、pitchforkのupstreamのtoolchainの宣言は、Code Generationの開始時に確かめる（未検証）。
