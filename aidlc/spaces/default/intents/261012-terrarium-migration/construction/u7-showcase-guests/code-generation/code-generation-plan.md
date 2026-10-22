# U7 showcase-guests 実装計画

## Summary

- Builds（2026-10-20の再開、Step 14）：`showcase/b1-pack.json` を、U4の正式な受入で作ったB1のpackのRelease `b1-a3370ca4df1f` へ向ける（PR #52でmerge済み）。コードの振る舞いは変えない。
- Touches（Step 14）：`showcase/b1-pack.json`・`showcase/tests/config.test.ts`（commitした値を確かめる試験の期待値）・`showcase/README.md`（B1のRelease の節）。
- Tests（Step 14）：新しい試験は加えない。既存の `showcase-unit`（96件）・lint・typecheck・test-lightで確かめる。
- Builds（Step 15、人間の指示「minorで出た指摘の修正」）：review-03までのMinorの指摘R-01〜R-05を直す。文書の未検証の記述を現状に合わせ、`candidate.ts` の単体試験を足し、U8のworkflowと `trusted-callers.json` の一致を試験にし、候補のartifactの中身を確かめ、今のmainでの結果を取り直す。
- Touches（Step 15）：`showcase/README.md`・`README.md`（showcaseの節）・`showcase/tests/candidate.test.ts`・`showcase/tests/workflow.test.ts` と、U7の記録（`code-summary.md`・`traceability.json`・`source-manifest.json`）。製品のscript（`showcase/scripts/`）の振る舞いは変えない。
- Tests（Step 15）：`candidate.test.ts` に3–5件、`workflow.test.ts` に1件。`showcase-unit`・`showcase-boundary`・`showcase-typecheck`・lint・test-lightを今のmainで1つずつ実行する。
- Builds: `showcase/` に、最新の安定版のaube・pitchfork・Biomeを解決・取得（又はsource build）・検証し、catalogとC09の候補を作る仕組みと、Node・3ブラウザの `--version` 受入、公開importの境界の機械検査を作る。専用workflow `showcase.yml` も作る。repositoryの保護は、upstreamの既存の `infra/github/` が管理しているので、新しくは作らない。
- Touches: 新規は `showcase/`（package.json・tsconfig.json・設定data・demo fixture・scripts・tests・README.md）、`.github/workflows/showcase.yml`、`mise-tasks/showcase/*.sh`。変更は `package.json`（`showcase:*` のscript）、`.gitignore`（showcaseの生成物）、`biome.json`（showcaseの制限import）、`README.md`（showcaseの案内1節）。本体の `runtime/`・`types/`・配布物・既存の試験は変えない。
- Tests: 設定・解決・取得と展開・source buildとbuildKey・再利用・catalogとpack・候補・境界・mode条件の単体試験（各部品5–8件、計約55件、showcaseのscriptの行coverage80%以上）と、境界の違反fixtureの試験。受入はNode・Chromium・Firefox・WebKit×3ツールの12行。push・CI・Release・OpenTofuの適用は別途承認する。

## 前提と境界

根拠は承認済みのU7 nfr-requirements（NFR2.1–NFR8.2の16件、Q1–Q5）、nfr-design（`security-design.md` §1–§11、Q1–Q4）、infrastructure-design（`infrastructure-specification.md`・`cicd-pipeline.md`・`monitoring-design.md`、Q1–Q4）。契約はC03・C04・C05・C06・C07（buildKeyの規則）・C09・C10（U8 profile）・C11、要件はFR13・FR14。User Storiesと機能設計はないため、要件IDと `NFRx.y` へ直接対応させる。移管元は現行terrariumの `web/tools.json`、`scripts/latest-guests.mjs`、`mise-tasks/build/native.sh`、`.github/workflows/build-latest-guests.yml`（読むだけ。terrariumは変えない）。

- showcaseは `@aletheia-works/formicarium` の公開export（root・`/node`・`/browser`）だけを使う。本体の `runtime/` の内部（`install-archive`・`install-transfer` など）はimportしない。そのため、release資産の展開（tar.gzのentry検査）とbuildKeyの正規化JSONは、showcaseの中に小さく実装する。最終の検証は、公開の `validateGuest` と、受入での `createInstaller`／`createCommandSession` が本体の規則でもう一度行う。
- showcaseは独立のpackage（`showcase/package.json`、private）とし、本体のpackは `showcase/node_modules/@aletheia-works/formicarium` に、SHA256を確かめてから展開して使う（lockfileは変えない、生成物はgitignore）。scriptはTypeScriptのまま、Node 26の型の除去で実行する（`erasableSyntaxOnly`、emitしない）。
- source buildのtoolchainは、承認済みのNFR Design §5に従い、upstreamの宣言（`rust-toolchain(.toml)`、`mise.toml`・`.node-version`・`package.json` の `engines`）があればそれ、なければ最新の安定版を使う。現行terrariumは固定のRust（1.99.0）とNode 24.21.0でupstreamの宣言を迂回しているが、それは移さない。cargoは絶対pathで直接呼び、upstreamのcontributor向けwrapperは使わない。
- 品質基準は緩めない：取得120s、source build 180分のjob timeout（C11の4hより短い）、C11の容量上限、本体のprobe600s・aube840s・1worker・retry0・wasm1GB・waitAsync削除。未変更のaubeは再buildしない（aubeは公式資産を使う）。
- 外部への作用（push、CI、GitHub Releaseの `b1-*` の作成、OpenTofuのplan／apply、repositoryの設定の変更）は、このstageでは行わない。実コマンドを提示して、個別に承認を受ける。
- 全build・testはmain sessionで逐次実行する。各層の実装後にテストを書いて実行し、意図しない失敗は観測結果と修正案を示して確認を待つ。

## 後工程扱いにしたレビュー指摘の反映

1. NFR Requirements R-01・R-02（pack の調達元、source buildの出所）：Step 6・Step 5で、NFR Design §5・§7の決定どおり実装する。
2. NFR Design 2回目のMinor：candidateIdからrun固有の記録（`provenance.reusedFromRun`、runのid・attempt）を除く（Step 7）。`distribute` をmainのU8 workflowに限る条件をworkflowの中で確かめる（Step 9・Step 10）。候補artifactの中身とB1 packの取得元（`showcase/b1-pack.json`）を定める（Step 6・Step 7）。
3. Infrastructure Design 2回目のMinor：terrariumの `main.tf` はrulesetの `import` blockを持たず、stateの正本はCI artifactであった。formicariumの `infra/github/` では、rulesetを含む全資源の `import` 手順と、stateを失ったときの手順をREADMEに書く（Step 11）。「最後に配布可能な候補を作ったrunからの日数」は `candidate` jobのjob summaryに書く（`actions: read` はQ4=Aで承認済みの範囲で、`candidate` jobにも加える）（Step 7・Step 10）。前のcommitへの切戻しは、U8から `mode: distribute` で呼ぶ必要があることをREADMEのRollbackに書く（Step 11）。

## upstreamの規約への合わせ（2026-10-18）

Step 1–8・10・11は古い土台の上で実装した。その後、人間の指示（「upstream/mainの変更に合わせて下さい」）で、upstreamのmainの上へ移し、PR aletheia-works/formicarium#31（merge `880cfd4a`）で取り込んだ。そのとき次の点を変えた。

- taskは `mise.toml` ではなく、package.jsonの `showcase:*` のscriptと、それを呼ぶ `mise-tasks/showcase/*.sh`（alias `showcase-*`）に置く。`showcase/tests/runner-ready.test.ts` はpackage.jsonのscriptを読み、Nodeは `showcase/package.json` の `engines`（`>=26.12.0`）と照合する（upstreamの `mise.toml` は `node = "latest"`）。
- `infra/github/` は作らない。mainのrulesetとworkflowの既定の権限は、upstreamの既存の `infra/github/` が管理している（必須checkは `quality`・`commit-format`・`ci-required`・`check / Commitlint`）。
- `showcase/tests/workflow.test.ts` のActionの版の照合は、upstreamの `ci.yml` の引用符つきの `uses:` も読む。
- Step 9の受入は、人間の回答（Q1：CIで受入）どおり、merge後のmainへのpushで動いた `showcase.yml`（run 39113037176、`880cfd4a`）で行った。

## Testing Contract

```json
{
  "version": 1,
  "methodology": "test-after",
  "source": "team",
  "ordering": "通常の新規実装は各テスト可能な層を実装した後にその層のテストを作成・実行し、不具合修正は再現テストの失敗を先に観測してから修正し同じテストの成功を確認する。（人間の回答 Q3）",
  "scope": "classic",
  "test_strategy": "standard",
  "project_type": "brownfield",
  "applicable_notes": [
    {
      "layer": "org",
      "text": "We treat tests as a first-class deliverable in every Bolt. The specific\nmethodology (TDD, BDD, ATDD, or classic test-after) is affirmed at\npractices-discovery and recorded in `team.md` under this heading with explicit\n`Methodology` and `Ordering` fields; Code Generation resolves those fields\nindependently from coverage, tooling, and scope notes.\n\nWhen no posture has been affirmed, our default per scope is:\n- **Methodology**: test-after\n- **Ordering**: implement each applicable testable layer, then write and run\n  that layer's tests.\n- `mvp`, `enterprise`, `feature`, `infra`, `classic` add an 80% line-coverage\n  floor and CI execution before merge.\n- `bugfix`, `security-patch` add a targeted regression for the specific\n  bug/vulnerability and require the existing suite to remain green.\n- `express` uses the Minimal strategy: requirement-driven unit tests (one per\n  requirement, with a happy-path floor per component); existing tests remain\n  green.\n- `poc`, `refactor`, `workshop` add no extra new-test floor and require the\n  existing suite to remain green.\n\nThe active `Test Strategy` still applies in every scope and determines test\nvolume/types. Scope floors are additive; they never reduce or replace the\nselected strategy.\n\nBuild and Test verifies defined coverage floors and affirmed quality targets;\nthey may not be weakened to make a step pass.\n\nAffirm a stricter posture in `team.md` if the team commits to one."
    },
    {
      "layer": "team",
      "text": "- **Methodology**: test-after\n- **Ordering**: 通常の新規実装は各テスト可能な層を実装した後にその層のテストを作成・実行し、不具合修正は再現テストの失敗を先に観測してから修正し同じテストの成功を確認する。（人間の回答 Q3）\n- node:test と Playwright の既存結合テストを利用する（検証済み：package.json scripts、code-quality-assessment.md）。今回の成功結果・coverage 値は未検証。\n- classic の追加条件は行 coverage 80%以上と統合前 CI 実行（ドキュメント根拠：org.md Testing Posture）。基準を下げて通過させない。\n- coverage の技術提案（未実装・未検証）：第一者が保守する配布 JS 全体（既存 runtime の未変更ファイル、共通処理、公開 API、Node/browser Worker adapter を含む）の一覧を事前に固定し、未実行ファイルも分母に含める。tests、生成 blink JS/wasm、第三者/vendor、ゲスト ELF、.d.ts、デモ・開発専用 scripts は理由を明示して対象外とし、資産・型・回帰検証を別途行う。設計で配布対象を確定し、閾値達成のために除外を変更しない。\n- Worker/ブラウザ内の計測を収集・マージし、対象一覧と照合して欠落を検出する。未収集ファイルを分母から外さず0%または未測定として失敗／未検証を報告する。計測方式は担当者が未importファイル・別process/realmを含む試験を観測して選ぶ。対象一覧、除外理由、行数、レポート、実行コマンドを CI 成果物へ残す。ブランチ coverage の新しい数値条件は追加しない。\n- 既存上限は probe 600秒、aube ブラウザ840秒、1worker、retryなし、probe 8項目全通過、native 出力一致、wasm 1GB。テストは main session が逐次実行する（人間の指示：AGENTS.md）。\n- aube はソースが変わっていなければ再ビルドしない。計測は重い並行処理なしで行う。新しいコア不具合の回帰 probe は native Linux でも確認する。\n- npm tarball の import/Worker/型/wasm・notices・build-info の同梱確認は設計候補（推測・未検証）。ゲストと fixture は terrarium 側の ref 別配布という既存意図を維持する。"
    }
  ],
  "obligations": {
    "strategy": "standard",
    "strategy_volume": [
      "Five to eight tests per component.",
      "Unit tests plus integration tests for key boundaries.",
      "Add E2E, performance, or security tests when requirements demand them."
    ],
    "scope_floor": [
      "Keep the existing test suite green.",
      "This scope adds no extra new-test floor beyond the selected test strategy."
    ],
    "combination_rule": "Apply every selected-strategy obligation and every scope-floor obligation; neither replaces the other, and a targeted scope regression may add the narrowest necessary test type beyond the strategy default."
  },
  "plan_profile": {
    "methodology": "test-after",
    "runner_step": "Verify the existing test runner/configuration and record the exact unit-scoped command.",
    "runner_ready_before_first_test": true,
    "testable_layers": [
      "Data model / database behavior",
      "Repository / data access",
      "Business logic",
      "API / endpoint",
      "Frontend behavior"
    ],
    "steps": [
      "Project structure and production configuration skeleton.",
      "Verify the existing test runner/configuration and record the exact unit-scoped command.",
      "Data model / database behavior - implement.",
      "Data model / database behavior - write and run its tests after implementation.",
      "Repository / data access - implement.",
      "Repository / data access - write and run its tests after implementation.",
      "Business logic - implement.",
      "Business logic - write and run its tests after implementation.",
      "API / endpoint - implement.",
      "API / endpoint - write and run its tests after implementation.",
      "Frontend behavior - implement.",
      "Frontend behavior - write and run its tests after implementation.",
      "Environment/build configuration.",
      "Documentation and traceability."
    ]
  },
  "input_sha256": "sha256:dd7d634a9c475bfe0b7fdd87b1566bd3f238a9b0ead389ae268b08de9bf333f2",
  "contract_sha256": "sha256:ce013e1551c9c06de1a756c04942d606c8dffe82caf0ae8422f95df28968c638"
}
```

層の対応：DB・永続repository・独立のUIはないので、それらの層は省略する。「Data model」は設定dataとmanifestのschema（Step 2）、「Repository / data access」はGitHub APIとrelease資産の取得（Step 3・Step 4）、「Business logic」はsource build・buildKey・再利用・catalog・候補（Step 5–Step 7）、「API / endpoint」は公開APIによる受入（Step 9）に当たる。境界の機械検査（Step 8）は横断の検査として扱う。

## Steps

- [ ] Step 1: 構成とrunnerの確認。開発に使う各toolが最新版かを確認する（2026-10-17の値はNode 26.12.0、Bun 1.4.3、@playwright/test 1.64.1、TypeScript 7.0.2、Biome 2.5.15。開始時に新しい版が出ていれば、その版と差分を報告して確認する）。`showcase/package.json`（private、`type: module`、依存は持たず、本体はstageで展開する）、`showcase/tsconfig.json`（strict、`erasableSyntaxOnly`、`noEmit`、`@aletheia-works/formicarium` は `showcase/node_modules` から解決）を作る。`.gitignore` に `/showcase/node_modules/` と `/showcase/.work/`（取得物・stagingの作業場所）を加える。`showcase/tests/runner-ready.test.ts` を作り、Node 26.12.0・ESM・TypeScriptの直接実行・試験の探索範囲・coverageの計測を確かめ、最初に実行して記録する。`mise.toml` に `showcase-unit`・`showcase-boundary`・`showcase-stage`・`showcase-accept-node`・`showcase-accept-browser`・`showcase-typecheck` を個別path指定で宣言する。（NFR2.2）
- [ ] Step 2: 設定dataとschema。`showcase/tools.json`（aube・pitchfork・Biome。repository、tagの規則〈`^v(\d+\.\d+\.\d+)$` と `^@biomejs/biome@(\d+\.\d+\.\d+)$`〉、公式資産の名前〈`aube-{tag}-x86_64-unknown-linux-musl.tar.gz`、`biome-linux-x64-musl`〉、形式〈`tar.gz`／`elf`〉とarchive entry、source buildの指定〈pitchfork：cargoの `--bin pitchfork`、UIのbuild〉）、`showcase/allowed-sources.json`（3つのrepository）、`showcase/trusted-callers.json`（`showcase.yml` とU8のworkflow file名。U8のfileはまだないので名前だけを固定し、U8で作る）、`showcase/b1-pack.json`（B1のRelease tag・pack SHA256・C06の証拠のSHA256。Releaseを作るまでは `null` の値にし、そのときは `distribute` を `b1-pack-unavailable` で失敗させる）を作る。terrariumの3つのdemo fixture（`aube-local-deps`・`pitchfork-basic`・`biome-basic`）を `showcase/fixtures/` へ写す（回帰用のfixtureとは別のdemo fixtureで、U8が使う）。`showcase/scripts/config.ts` に読込みと検証（必須field・型・重複tool・未知のbuild種別・許可一覧との照合）を実装する。実装後に `showcase/tests/config.test.ts` を作成・実行する：正常、必須field欠落、重複tool、未知のbuild種別、許可一覧にないrepository、tagの規則の不正、`b1-pack.json` の `null` と不正なSHA256。（NFR3.1、NFR5.3）
- [ ] Step 3: 最新版の解決を `showcase/scripts/resolve.ts` に実装する。GitHub REST APIの `releases/latest`（draft・prereleaseの拒否）、`git/ref/tags/<tag>` とannotated tagの `git/tags/<sha>` の辿り、40桁の確認、tagの規則の照合、公式資産のAPI digest（`sha256:`）・size・`browser_download_url` の一致。tokenは環境の `GITHUB_TOKEN`（読取り）。許可一覧は `git show origin/main:showcase/allowed-sources.json` で読み、取れなければ失敗にする。出力は `resolutions.json`（tool・tag・commit・解決の時刻・資産の記録）で、1回だけ書く。失敗は原因code（`http-status`・`offline`・`rate-limit`・`bad-body`）で返し、retryしない。実装後に `showcase/tests/resolve.test.ts` を作成・実行する（fetchを差し替える）：lightweight tagとannotated tag、prereleaseの拒否、tagの形の不一致、資産が0件・2件以上、digestがない、rate limit（403/429）の原因code、許可一覧にないrepository。（NFR3.2、NFR4.1）
- [ ] Step 4: 公式資産の取得と展開を `showcase/scripts/acquire.ts` と `showcase/scripts/archive.ts` に実装する。取得はC11の規則（HTTPS、credentialなし、redirectは5hopまで各hopを検査、120sのdeadline、Content-Lengthを信用せずstreamの累積でDL128MiBを制限、`downloadBytes` との一致）。SHA256とサイズをresolutionの値と照合する。tar.gzはC11の規則で全entry（escape・重複・link・loop・展開合計256MiB・4096entry・path4096bytes）を検査し、設定のentryだけを取り出す。ELFは公開の `validateGuest` で検証する前に、build-info（C03の形。source identityは `resolutions.json` から、`rustc` は `null`、`sourcePatches` は空、`provenance.note` に「release tagの識別であり、publisherのbinaryの再現性の証明ではない」）を作る。実装後に `showcase/tests/acquire.test.ts` と `showcase/tests/archive.test.ts` を作成・実行する：上限の値と+1（DL・展開・entry数・path）、`../`・絶対path・symlink・hardlink・重複entry・壊れたheader・truncate、checksum不一致、サイズ不一致、redirectの規則違反、deadline、動的ELF（PT_INTERP）の拒否、正常な展開。（NFR3.3、NFR3.5、NFR4.1）
- [ ] Step 5: source buildとbuildKeyと再利用を `showcase/scripts/build.ts`・`showcase/scripts/build-key.ts`・`showcase/scripts/reuse.ts` と `showcase/builders/cargo.sh` に実装する。sourceは `codeload.github.com/<repo>/tar.gz/<commit>` で取得し（C11の取得の規則と、sourceに見合う有限の上限）、commitが宣言したrepositoryのtagから辿れることを確かめる。toolchainは前提の規則（upstreamの宣言、なければ最新の安定版）で選び、cargoを絶対pathで呼び、`--locked --release --target x86_64-unknown-linux-musl --bin <binary>` でbuildする。`MISE_AUTO_INSTALL=0`、`GITHUB_TOKEN` を環境から外す、独立したprocess groupで動かし、timeout・取消ではprocess groupの終了を待ってstagingを消す。pitchforkのUIは、取得したaubeの公式binaryとupstreamの宣言のNodeでbuildする。build-infoに `rustc -vV`、`Cargo.lock` のSHA256を含むdependencies、sourcePatches（空）、builderHash（`showcase/builders/`・`showcase/scripts/`・設定・toolchainの版のinventoryのdigest）を記録する。buildKeyはC07の正規化JSONの規則で計算する。再利用は、`showcase/trusted-callers.json` のworkflow file、`head_branch` `main`、eventが `push`・`schedule`・`workflow_dispatch`、conclusion `success`、artifact名 `showcase-candidate`、保存期限内のrunを、GitHub REST APIで新しい順に探し、buildKey・ELFのSHA256・source identity・`validateGuest` で照合する。合わなければbuildする。実装後に `showcase/tests/build-key.test.ts`・`showcase/tests/build.test.ts`・`showcase/tests/reuse.test.ts` を作成・実行する：buildKeyの正規化（key順・重複keyの拒否・孤立surrogate・入力1つの変更で別のkey）、toolchainの選び方（宣言あり・なし）、tagから辿れないcommitの拒否、timeoutでのprocess groupの終了とstagingの除去（短い期限の模擬）、再利用元の条件（PRのrun・別workflow・failure・期限切れの除外）、buildKey不一致でのbuild。実際のpitchforkのbuildはLinuxのCIでだけ行い、ローカル（macOS）では実行しない。（NFR3.4、NFR4.1、NFR5.1）
- [ ] Step 6: catalogと本体のpackを `showcase/scripts/catalog.ts`・`showcase/scripts/pack.ts` に実装する。catalogはC04の `GuestCatalog`（`defaults` に解決した版、URLは配布時のsame-originの相対path）で生成し、公開の `createInstaller` に渡して受理を確かめる。packは、`verify` では同じcommitで `npm pack` を作ってSHA256を記録し、`distribute` では `showcase/b1-pack.json` が指すReleaseの資産（pack・C06の証拠）を取得して、C06の `packSha256` と照合する。どちらも `showcase/node_modules/@aletheia-works/formicarium` へ、SHA256の照合後に展開する。実装後に `showcase/tests/catalog.test.ts`・`showcase/tests/pack.test.ts` を作成・実行する：catalogの受理、catalog 4MiBの上限、`verify` のpack、`distribute` で `b1-pack.json` が `null` のときの `b1-pack-unavailable`、SHA256不一致の `b1-pack-mismatch`、C06の証拠のpackSha256との不一致。（NFR3.5、NFR5.3）
- [ ] Step 7: 候補とmanifestを `showcase/scripts/candidate.ts` に実装する。C09の `ShowcaseCandidateManifest` に、付加field `formicariumSourceCommit`・`distributable`、`resolvedTools[].provenance`（資産URL・最終URL・download digest・attestationの有無・`note`・`reusedFromRun`）を加える。candidateIdは、自分自身、logの時刻、run固有の記録（`provenance.reusedFromRun`、runのid・attempt）を除いた入力identityの正規化digestにする。`fixtureInventorySha256` は `showcase/fixtures/` のcanonicalな一覧のdigest。候補の中身は、`manifest.json`・`catalog.json`・guestのELFとbuild-info・受入log・licenseとnotices・`resolutions.json`。job summaryに「最後に `distributable: true` の候補を作ったrunからの日数」を書く関数も、ここに置く。実装後に `showcase/tests/candidate.test.ts` を作成・実行する：同じ入力で同じcandidateId、`reusedFromRun` やrun idだけ違っても同じcandidateId、入力1つ（pack・catalog・fixture・resolvedTools・`distributable`）の変更で別のcandidateId、`verify` は常に `distributable: false`、受入の12行が1行でも欠ければ候補を作らない、日数の計算（前の配布可能なrunがない場合を含む）。（NFR2.2、NFR5.1、NFR5.2、NFR5.3）
- [ ] Step 8: 境界の機械検査を `showcase/scripts/boundary.ts` と、`biome.json` の `showcase/**` への `noRestrictedImports` に実装する。showcaseのimportは `@aletheia-works/formicarium`・`/node`・`/browser` とNodeの組込みだけを許し、本体への相対path・package内部のpathを拒否する。本体の `runtime/`・`types/`・`scripts/` に `showcase/` への参照がないこと、showcaseが `fixtures/`（回帰用）・vivariumのrecipe-owned fixtureを参照しないことを調べる。実装後に `showcase/tests/boundary.test.ts` と、違反fixture（`showcase/tests/boundary-fixtures/` の、内部import・逆依存・fixture共有を1件ずつ入れたもの）を作成・実行する：違反ごとに失敗すること、違反のない現在のtreeで成功すること、Biomeの規則が内部importを拒否すること。（NFR3.6、NFR2.1）
- [ ] Step 9: 公開APIによる受入。`showcase/scripts/accept-node.ts`（公開の `/node` の `createSession` と `createCommandSession` で `install <tool>` と `<tool> --version`。catalogのURLはjob専用のCAで動くlocal HTTPSのserverへ向け、`NODE_EXTRA_CA_CERTS` でそのCAだけを信頼する。CAとkeyは作業場所に作り、終了時に消す）と、`showcase/tests/accept.spec.ts`・`showcase/tests/playwright.config.ts`（Chromium・Firefox・WebKit、workers 1、retries 0、timeout 840s。候補をsame-originで配り、COIと既存のCSP〈blob・wasm〉、Workerを保つ。公開の `/browser` と `createCommandSession` で同じ確認）を作る。12行（3ツール×4環境）それぞれで、stdoutの版が `resolutions.json` のtagと一致すること、取得の時間と `--version` までの時間（ms）、環境（Node・Playwright・browserの観測した版）を受入logに記録する。Safari実機は未検証と記録する。`mode` の受付条件（入力 `mode`、`github.event_name`、`github.ref`、`github.workflow_ref` と `trusted-callers.json`）は `showcase/scripts/mode.ts` に実装し、`showcase/tests/mode.test.ts` で、直接の `workflow_dispatch`・`push`・`pull_request` では `distribute` を拒否し、mainのU8 workflowからの `schedule`・`workflow_dispatch` だけを受け付けることを試験する。実装後に、ローカルで公式資産のaubeとBiomeの受入（Node・3ブラウザ）を実行する。pitchforkはCIでbuildしたものだけで受入する（ローカルでは未検証と記録する）。（NFR2.2、NFR4.2、NFR6.1、NFR8.1）
- [ ] Step 10: workflow `.github/workflows/showcase.yml` を作る。`cicd-pipeline.md` の契機・mode・job（`resolve` 10分、`acquire` 180分、`catalog` 15分、`accept` 60分、`candidate` 10分）・権限（既定 `contents: read`、`acquire`・`catalog`・`candidate` だけ `actions: read`）・concurrency（PRだけcancel-in-progress）・artifact（中間は1日、候補は既定の期限）・出力（`candidate-id`・`distributable`）に従う。`actions/checkout` は `persist-credentials: false`、Actionはcommit SHAで参照する（既存の `.github/workflows/ci.yml` と同じ版）。source buildの工程には `GITHUB_TOKEN` を渡さない。各jobはjob summaryに工程・入力のdigest・結果・原因codeを書き、tokenとresponseの全文は書かない。workflowの静的な検査（権限・契機・SHA参照・`persist-credentials`）を `showcase/tests/workflow.test.ts` で作成・実行する。（NFR4.1、NFR5.1、NFR5.2、NFR8.1、NFR8.2）
- [ ] Step 11: repositoryの保護のOpenTofuと文書（OpenTofuは、upstreamへ合わせたときに取り下げた。上の「upstreamの規約への合わせ」を参照）。`infra/github/`（`versions.tf` は `backend "local"`、`main.tf` にmainのruleset〈PR必須、承認数0、code owner reviewは必須にしない、管理者roleの常時bypass、削除・force pushの禁止、linear history、署名必須、review threadの解決必須、必須checkは `ci-required`〉とActionsの設定〈forkのPRのworkflowは外部の協力者すべてに承認、`GITHUB_TOKEN` の既定権限は読取り〉、全資源の `import` block、`.gitignore` でstateを除外）と `infra/github/README.md`（planとapplyは管理者の人間のfine-grained tokenで手元で行う、importの手順、stateを失ったときの作り直し、providerで扱えない設定の画面の手順と読取りの確認）を作る。適用はしない。`showcase/README.md` に、構成、ツールの追加の手順、`mode`、B1のpackのReleaseの作り方（承認後に人間が作る）、月1回のscheduleの無効化の確認、Rollback（前のcommitへの切戻しはU8から `distribute` で呼ぶ）、Safari実機が未検証であることを書く。本体の `README.md` にshowcaseの案内を1節だけ加える。`tofu fmt -check` と `tofu validate`（providerの取得が要る場合は、その前に確認する）を実行する。（NFR3.1、NFR8.1、NFR8.2）
- [ ] Step 12: ローカルの確認を逐次実行する。`mise run lint:all`（Biome・actionlint・ShellCheck）、`mise run showcase-typecheck`、`mise run showcase-unit`（showcaseのscriptの行coverage80%以上）、`mise run showcase-boundary`、本体の `mise run test:light` と `mise run typecheck`（本体が変わっていないことの確認）。CIの受入（Step 9）の結果と合わせて記録する。B1のpackのRelease作成は、別の承認とする。失敗した場合は、基準を変えずに停止し、修正案を示す。（NFR2.1、NFR2.2）
- [ ] Step 13: 追跡と要約。`code-summary.md`・`traceability.json`・`source-manifest.json` を仕上げる。生成物（`showcase/node_modules/`・`showcase/.work/`）は入れない。（FR13、FR14）
- [ ] Step 14: B1のpackのReleaseを指す（2026-10-20の再開、人間の指示）。U4の正式な受入（`verified-with-ci`・`b1.formal: true`、受入run 39378404328）で作ったprerelease `b1-a3370ca4df1f`（pack `a3370ca4…4046`、C06の証拠 `0c6e547f…7a35`）を、`showcase/b1-pack.json` に書く。`showcase/tests/config.test.ts` の、commitした `b1-pack.json` が `null` であることを確かめていた期待値を、この値に変える（`validateB1Pack` の規則の試験は変えない）。`showcase/README.md` のB1の節を直す。mainで1つずつ、`mise run lint:all`・`mise run showcase-typecheck`・`mise run showcase-unit`・`mise run test:light` を実行し、`validateB1Pack`・`checkEvidence`・本物のReleaseに向けた `packDistribute` が通ることを確かめる。PR #52として人間がmergeした（main `c9b37c4a`）。`source-manifest.json`・`code-summary.md`・`traceability.json` を更新する。（NFR5.3、FR13）
- [ ] Step 15: review-03までのMinorの指摘を直す（2026-10-20、人間の指示「minorで出た指摘の修正」）。基準と製品のscriptの振る舞いは変えない。
  - R-01：`showcase/README.md` の冒頭と「未検証のこと」節、本体の `README.md` のshowcaseの節の「受入・CIは未検証」を、現状に合わせて直す。CIの受入（`showcase.yml` のverifyのrunで12行が通ったこと。最初はrun 39113037176、今のmainの最新のrunの番号も書く）と、本当に未検証の部分（実機Safari、`distribute` の実行〈U8の最初の配布で確かめる〉）だけを書く。
  - R-02：今のmainの `showcase.yml` の成功したrunから候補のartifact（`showcase-candidate`）をGitHub RESTで読取りだけで取得し、`manifest.json`・受入log・licenseとnotices・build-infoがあり、`manifest.json` のcandidateIdとartifactの中身が合うことを確かめて記録する。取得できなければ、`traceability.json` のNFR5.2・NFR8.2に「U7側だけ検証済み、U8の照合は未検証」と注記する。
  - R-03：`showcase/tests/candidate.test.ts` に、`candidate.ts` の未計測の経路（CLIの入口の引数の拒否、manifestの書込みの1回だけの規則、日数のsummaryの書込みなど、読んで確かめた経路）の試験を足し、`candidate.ts` の行coverageを80%以上にする。`accept-node.ts`・`tls.ts` の未計測の経路（job TLS・子process）はCIの受入でだけ守られることを `showcase/README.md` に書く。全体の基準（showcaseのscriptの行80%）は変えない。
  - R-04：`showcase/tests/workflow.test.ts` に、`trusted-callers.json` の `distributeCaller` のfileが実在し、その中のjobが `uses: ./.github/workflows/showcase.yml` を `mode: distribute` で呼ぶことを確かめる試験を1件足す。
  - R-05：今のmainで、`mise run lint:all`・`mise run showcase-typecheck`・`mise run showcase-unit`・`mise run showcase-boundary`・`mise run test:light` を1つずつ実行し、件数・coverage・boundaryの結果を `code-summary.md` に新しく書く。前の値には「U8の取り込み前の結果」と書く。
  - 変更はPRにし、差分を示してpushとPRの承認を受ける。（FR13、NFR2.2、NFR5.2、NFR8.2）

### 2026-10-21 の Request Changes について

2026-10-21 に、Code Generation の段階を閉じるときの扱いで、人間の選んだ Request Changes が段階の全体に記録された。人間の意図は U2 の一覧の変更だけで、U7 の計画を変える指示ではなかった。この計画の Step と内容は変えない（人間の回答 2026-10-21「A」：計画をそのまま承認し直して Unit ごとに進める）。

### 追加Step：review-07 の Minor 6件の修正（2026-10-22、人間の指示「U7 を開き直して Minor 6件を直し…」）

記録の更新と、今の main での確認の取り直しだけで、showcase の code と基準は変えない。

- [ ] Step 16: Minor 6件を直す。
  - R-06：`code-summary.md` の古い記録（記録との差、候補の artifact は未検証、`b1-pack.json` は全 field が `null`）に、それぞれ「その時点の記録で、今は冒頭の再開の節が正しい」と注記する。
  - R-07：計画の Step 9 と Step 11 にある `schedule` の前提に、U8 の変更（#54・#57）で `distribute` は main への `push` と `workflow_dispatch` だけを受け付け、`schedule` は拒否するようになった、と注記する（Step の本文は変えない）。
  - R-08：#54・#57 の変更（`mode.ts`・`trusted-callers.json`・`workflow.test.ts`・`showcase.yml` の受付の条件）を `code-summary.md` に書き、`traceability.json` の NFR8.1 に足す。
  - R-09：`code-summary.md` の「`distribute` の実行は未検証」を、`showcase/README.md` が書く run 39422079965 を GitHub の読取りで確かめて、その結果で直す。
  - review-07 の新1：記録の値（lint の警告数、`showcase-unit` の件数と行 coverage、`test:light` の件数）を、今の main（#60・#63 の後）で取り直す。別の作業場所（`.artifacts/ws-biome`）を今の `main@upstream` に合わせ、1つずつ `mise run lint:all`・`mise run showcase-typecheck`・`mise run showcase-unit`・`mise run showcase-boundary`・`mise run test:light` を実行して書き、前の値に「#60 の前」と注記する。計画が書く `workflow.test.ts` の ci.yml の `uses:` の読み方にも、#60 で一重・二重の引用符の両方を読む形にしたと注記する。
  - review-07 の新2：計画の「現行 terrarium」に、terrarium は #58 で削除済みで、履歴として参照する、と注記する。`showcase/` に terrarium への参照が残るかを grep で確かめて記録する。
  - 独立レビューを受け、intent の検証コマンドで U7 の checkpoint を確かめる。PR は作らない（code を変えないため）。
- Step 16 の注記（2026-10-22、この計画の上の Step への注記。Step の本文は変えない）：
  - Step 9 と Step 11 の `schedule` の前提：U8 の #54（merge `94970a9e`）で、`mode.ts` は `distribute` を main への `push` と `workflow_dispatch` だけで受け付け、`schedule` は拒否する。月1回の schedule の確認は、今は schedule が無いことの確認になる。
  - 「terrarium」（前提、Step 2、Infrastructure Design の Minor など）：terrarium は #58（merge `5735433d`）で削除済みで、ここでは移管元の履歴として参照する。
  - 前提の「`workflow.test.ts` は upstream の `ci.yml` の引用符つきの `uses:` も読む」：#60（merge `66bb684a`、Biome 2.6.2）で `ci.yml` が一重引用符になったので、試験は一重・二重のどちらの引用符も読む形にした。

2026-10-22 にも、U7 の計画の question への回答「2」が U7 の Request Changes として2回記録された。どちらも U5 の Minor を先に直す指示で、U7 の計画を変える指示ではなかった（人間の回答「U7 の計画は変えないでください」）。この計画の Step と内容は変えない。

### 追加Step：Build and Test の Loop-back 2（Node の版の固定と追跡表の target、2026-10-22、人間の指示）

Build and Test で、人間の承認により main で起動した `showcase.yml` の run 39716571748 は成功したが、`showcase.yml` の5か所が `node-version: '26.12.0'` と patch の版まで固定しており、最新の Node 26.12.1 ではなく古い版で動いた。最新の道具を使う決まりに合わず、その run だけが根拠の目標（U7-NFR4.2・NFR8.2 ほか）が Unverified になった。ほかの workflow（`ci.yml` など）は `'latest'`。また、`aidlc engine sensor-traceability --stage build-and-test` で、U7 の `traceability.json` の `NFR8.1` の行の target が、path（`showcase/scripts/mode.ts`）の後に説明の文が続くため、道具に file として読まれなかった（Build and Test の `test-results.md` の Loop-Back Log 2、`cross-unit-traceability.md`）。人間の指示（2026-10-22）：Loop-back 2 として、showcase の Node の版の固定（U7・U8）と追跡表（U5・U7）を直す。

- [ ] Step 17: `.github/workflows/showcase.yml` の `node-version: '26.12.0'` の5か所を、ほかの workflow と同じ `'latest'` にする。ほかの行（Bun の `'1.4.3'` は今の最新と同じ）、試験、基準は変えない。`showcase/tests/workflow.test.ts` は Node の版を確かめていないので変えない（読んで確かめる）。U8 の `showcase-site.yml` の同じ修正（U8 の Step）と1つの PR にまとめ、最新の main の上の change で、1つずつ `mise run lint:all`・`mise run showcase-typecheck`・`mise run showcase-unit`・`mise run showcase-boundary` を実行する。差分を示して push と PR の承認を受ける。merge の後、main の CI の成功を待ってから、人間の承認で `showcase.yml` と `showcase-site.yml` を main で起動し、log の setup-node が最新の Node で動いたことと結果を確かめる。（FR13、NFR4.2、NFR8.2）
- [ ] Step 18: `traceability.json` の `NFR8.1` の行の target を、1つの file の相対 path `showcase/scripts/mode.ts` だけにし、今の target の文（#54・#57、run 39422079965 の記録）を `note` の欄へそのまま移す。ほかの行は変えない。直したあと `aidlc engine sensor-traceability --stage build-and-test` で、U7 の行が読めない target に出ないことを確かめる。`code-summary.md` に Step 17・18 の節を足す。（NFR8.1）
- [ ] Step 19: 独立レビューを受け、intent の検証コマンドで U7 の checkpoint を確かめる。
