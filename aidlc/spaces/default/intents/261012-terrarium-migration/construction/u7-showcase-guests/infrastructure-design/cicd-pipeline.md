# showcase候補供給のCI

## Sources

`../nfr-design/security-design.md`（§1–§11）、`../nfr-design/reviews/review-02.md` のMinor（`provenance.reusedFromRun` がcandidateIdに入る件、mainの保護の前提とdistributeをmainの定義に限る確認、候補artifactの中身とB1 packの取得元の指定）、`../nfr-requirements/security-requirements.md`、`../../../inception/contract-design/contract-summary.md`（C06・C09・C10・C11）、`infrastructure-specification.md`、`monitoring-design.md`、formicariumの `.github/workflows/ci.yml`・`maintenance.yml`・`CODEOWNERS`、現行terrariumの `infra/github/`、人間の回答 Q1–Q4（すべてA）。以下は設計で、workflowはまだない（未検証）。

## Triggers and Modes

| 契機 | paths | mode | 候補 | 再利用元になれるか |
|---|---|---|---|---|
| `pull_request` | `showcase/**`、`.github/workflows/showcase.yml`、`runtime/**`、`types/**`、`package.json` | `verify` だけ | `distributable: false` | なれない |
| `push`（main） | 同じ | `verify` だけ | `distributable: false` | なれる |
| `workflow_dispatch`（`showcase.yml` を直接） | なし | `verify` だけ（入力に `mode` を持たない） | `distributable: false` | なれる |
| `workflow_call`（U8の日次build。U8自身は `schedule` か `workflow_dispatch` で動く） | なし | U8が `verify` か `distribute` を渡す | `distribute` で全工程が成功したときだけ `distributable: true` | なれる |

`workflow_call` で呼ばれたworkflowの `github` contextは呼出し元のものになる（`github.event_name` は呼出し元のevent、`github.workflow_ref` は呼出し元のworkflow）。そのため、`mode: distribute` は、次をすべて満たすときだけ受け付け、満たさなければ `resolve` で失敗させる。
- 入力 `mode` が `distribute`（`workflow_call` の入力。`workflow_dispatch` と `push`・`pull_request` には `mode` の入力がないので、直接の実行では `distribute` にならない）。
- `github.event_name` が `schedule` か `workflow_dispatch`。
- `github.ref` が `refs/heads/main`。
- `github.workflow_ref` が、mainのU8のworkflow（`<owner>/<repo>/.github/workflows/<U8のfile>@refs/heads/main`）と一致する。U8のfile名は `showcase/trusted-callers.json`（仮）に固定し、CODEOWNERSの対象にする。

これにより、PRのrunと、`showcase.yml` の直接の実行は、配布する候補を作れない。

concurrency：`showcase-${{ github.event_name }}-${{ PRの番号 || run_id }}`。`cancel-in-progress` はPRだけ。

## Stages

1. **resolve**（`contents: read`、10分）
   - `actions/checkout`（`persist-credentials: false`）。`origin/main` の `showcase/allowed-sources.json` と `showcase/b1-pack.json` を読む。
   - `tools.json` の検証と許可一覧の照合、`releases/latest` とannotated tagを含むcommitの解決、`mode` の条件の確認。
   - 出力：`resolutions.json`（中間artifact）。
2. **acquire**（`contents: read`、`actions: read`、180分）
   - 公式資産：C11の規則で取得、release公開のSHA256とサイズ、tar.gzの検査、`validateGuest`。
   - source build：buildKeyを計算し、再利用元のartifactを探して照合する。U8から呼ばれたrunのartifactは呼出し元（U8）のrunに属するので、再利用元のrunは次の条件で探す：runのworkflow fileが `showcase/trusted-callers.json` の一覧（`.github/workflows/showcase.yml` とU8のworkflow）にある、`head_branch` が `main`、eventが `push`・`schedule`・`workflow_dispatch`（`pull_request` は除く）、conclusionが `success`、artifactの名前が `showcase-candidate`、保存期限内。条件を満たす最新のrunのartifactを使い、内容（自分で計算したbuildKey、ELFのSHA256、source identity、`validateGuest`）で照合する。合わなければ、tokenを環境に渡さず独立したprocess groupでbuildし、timeout・取消ではprocess groupの終了を待ってstagingを消す。
   - 出力：ELF・build-info・`provenance`（中間artifact）。
3. **catalog**（`contents: read`、`actions: read`、15分）
   - `GuestCatalog` を作り、`createInstaller` で受理を確かめる。
   - 本体のpack：`verify` は同じcommitで `npm pack`。`distribute` は `b1-pack.json` が指すReleaseの資産を取得し、C06の受入証拠と `packSha256` を照合する（Q1=A）。取得できない・一致しなければ `b1-pack-unavailable`／`b1-pack-mismatch` で失敗。
4. **accept**（`contents: read`、60分）
   - Node（公開の `/node`）と、PlaywrightのChromium・Firefox・WebKit（公開の `/browser`、`createCommandSession`）で `install` と `--version`。12行を記録し、1行でも欠ければ失敗。
   - 境界の機械検査（Biomeの規則と専用script、違反fixtureの試験を含む）。
   - showcaseのscriptと試験のlint・型検査・単体試験。
5. **candidate**（`contents: read`、10分）
   - manifestを作る。candidateIdは、C09の規則に従い、自分自身とlogの時刻に加えて、runごとに変わる記録（`provenance.reusedFromRun`、runのid・attempt）を除いた入力identityから計算する。これらは受入logに残し、`acceptanceLogSha256` で参照する（レビュー2回目のMinorへの対応）。
   - 候補のartifact `showcase-candidate` をupload し、出力 `candidate-id`・`distributable` を返す。

## Gates

| Stage | Gate | 失敗したとき |
|---|---|---|
| resolve | 設定・許可一覧・tagの形・`mode` の条件 | 候補なし、原因codeを記録 |
| acquire | checksum・サイズ・ELF・build-info・buildKey | 同上 |
| catalog | `createInstaller` の受理、pack SHA256 | 同上 |
| accept | 12行すべてpass、境界の検査、lint・型・単体試験 | 同上 |
| candidate | manifestとcandidateIdの計算、upload | 同上 |
| U8（呼出し元） | `candidate` が成功し `distributable == true` | U8は配布を始めない。前回の配布物が残る |

## Deployment Strategy

U7は配布しない。配布はU8が、受入した候補だけを使って行い（C09・C10）、失敗したときは前回のサイトが残る（recreateではなく、成功したときだけ切り替える形）。

## Rollback

- showcaseの変更：PRをrevertする。候補は長期保存しないので、前の候補への切戻しは、前のcommitでworkflowを動かし直して行う。
- B1のpack：`b1-pack.json` を前のtagに戻すPRで切り戻す。Releaseの資産は削除しない。
- repositoryの設定：OpenTofuで前の状態のplanを作り、人間の承認後に適用する。

## Secrets and Permissions

- secretは使わない。tokenはworkflowの `GITHUB_TOKEN`（読取り）だけ。
- 権限：既定 `contents: read`。`acquire`・`catalog` だけ `actions: read`（他のrunのartifactの読取り）。書込みの権限はどのjobにもない。
- `persist-credentials: false`。upstreamのbuild scriptを動かす工程には `GITHUB_TOKEN` を渡さない。
- Actionはcommit SHAで参照し、Dependabotで更新する（formicariumの既存の `.github/dependabot.yml` に合わせる）。
- B1のpackのReleaseへの書込みと、`infra/github/` の適用は、このworkflowの外で、人間の承認後に行う。

## Repository Protection（Q2=A）

formicariumに `infra/github/`（OpenTofu）を作り、次を定義する。適用は人間の承認後。
- mainのruleset（Q4=A、現行terrariumの `infra/github/main.tf` と同じ形）：PR必須、承認数0、CODEOWNERSのレビューは必須にしない、管理者role（`RepositoryRole` の admin）の常時bypass、削除・force pushの禁止、linear history、署名必須、review threadの解決必須。必須checkは既存の本体CIの集約job `ci-required`（`.github/workflows/ci.yml`）だけにする。showcaseの受入は必須checkにしない（pathsで絞ったjobを必須にすると、showcaseに触れないPRで待機のまま残るため）。
- NFR Design §2 は「CODEOWNERSでレビュー必須」としていたが、CODEOWNERSが1人だけで自分のPRを承認できないため、人間がQ4=Aで「CODEOWNERSのレビューは必須にしない」に改めた。§2 の守りの中心（PRのrunの成果物を信頼しない）は変わらない。
- この形では、mainへのmergeは書込み権限を持つ人だけができ、forkのPRは自分ではmergeできない。配布と再利用はmainの定義のrunだけが作るので（NFR Design §2）、PRのcheckは配布の安全の根拠にしない。showcaseの受入は、U8が配布する前のmainのrunで確かめる。
- 既存の `maintenance.yml` の `dependency-merge`（CI合格した小さい依存更新の条件付き自動merge）は、このrulesetと衝突しない（承認数0、必須checkは `ci-required`）。
- CODEOWNERSは全pathが `* @JamBalaya56562` のままで、レビュー依頼の通知に使う。`showcase/allowed-sources.json`・`b1-pack.json`・`trusted-callers.json`・`.github/workflows/showcase.yml`・`infra/github/**` の変更は、PRの説明で明示し、人間がmerge前に確かめる（Code Generationで、PRの自動ラベル付けの対象に加える）。
- Actions：forkのPRのworkflowは外部の協力者すべてに承認を求める、`GITHUB_TOKEN` の既定権限は読取り。providerで扱えない設定は、画面の手順と、読取りで確かめる手順を文書にする。
- state：現行terrariumと同じ `backend "local"` にし、stateはrepoにcommitしない（`.gitignore`）。全資源を `import` block で取り込む形にするので、stateを失っても空のstateから `import` で作り直せる（terrariumの `infra/github/README.md` と同じ手順）。stateのbackupの自動化（terrariumの `terraform-state-backup.yml`）は、今回は作らず、planとapplyは人間の手元で行う。
- planとapplyに要るtokenは、formicariumのadministrationの書込み権限を持つ人間のtoken（fine-grained、対象repoだけ）で、CIには置かない。
- 既存の設定は、適用の前にimportしてplanの差分を人間が確かめる。

## Test Automation

| 試験 | 場所 | 確かめること |
|---|---|---|
| 単体 | `showcase/tests/` | 設定の検証、許可一覧の拒否、tagの形、annotated tag、checksum不一致、上限の値と+1、buildKey、candidateIdの安定性（同じ入力で同じ、run idだけ違っても同じ）、`mode` の条件 |
| 境界の検査 | `showcase/tests/boundary/` | 内部import・逆依存・fixture共有の違反fixtureで失敗すること |
| 受入 | workflowの `accept` | 3ツール×4環境の12行 |
| 本体の既存の試験 | 本体のCI | 変更しない。showcaseのCIからは動かさない |
