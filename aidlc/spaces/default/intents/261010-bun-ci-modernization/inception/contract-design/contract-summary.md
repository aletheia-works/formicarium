# Contract Summary

## Contracts

設計案・未検証。HTTPサービスや公開library APIを新設しない。単位間の既存task呼出しと取得済みデータの契約を定義する。

| # | Provider Unit | Consumer | Mechanism | Owner |
|---|---|---|---|---|
| C1 | U1 u1-bun-quality | U3, U4 | repository task / process | U1 |
| C2 | U1 u1-bun-quality | U3, U4 | sourceに結び付く検証結果の共有schema | U1 |
| C3 | U2 u2-maintenance-policy | U3 | 同期・副作用なしの判定関数 | U2 |

U3→U1はC1/C2、U3→U2はC3、U4→U1はC1/C2で覆う。U2は実CIを呼ばず、入力された証拠を照合する。外部GitHub/npm境界は後述のadapter条件を維持する。

## C1: Development Tasks

```typescript
type TaskName = "install-frozen" | "lint" | "typecheck" | "build"
  | "test-light" | "test-consumer" | "verify-candidate";
interface TaskRequest {
  schemaVersion: 1;
  task: TaskName;
  workspace: string;
  sourceSha: string;
  toolchainRevision: string;
}
interface TaskResult {
  schemaVersion: 1;
  task: TaskName;
  sourceSha: string;
  toolchainRevision: string;
  exitCode: number;
  outcome: "success" | "failure" | "cancelled";
  logPath: string;
}
```

task名は論理契約で、具体mise task/コマンドへの対応表をU1が提供する。この型は新CLI実装を必須にせず、process終了・CI出力へ対応づけてもよい。manifestとlock不一致・資産不足・runtime不足は非成功とし、successは終了0かつ期待source/taskを実行した場合のみ。ユーザー入力をshell文字列へ連結しない。workspaceは承認済み作業場所に限定する。

有限timeoutはtaskごとに明示し、既存probe600秒・aubeブラウザ840秒・1worker・retryなしを維持する。cancelとtimeoutをsuccessにしない。通常CIと公開候補検証は別task。Nodeが必要な経路はtoolchain対応表に残す。task成功は外部公開の許可ではない。

## C2: Verification Evidence

```typescript
interface CheckEvidence {
  name: string;
  sourceSha: string;
  state: "success" | "failure" | "pending" | "skipped" | "cancelled";
  runId: string;
  producerIdentity: string;
}
interface EvidenceEnvelope {
  schemaVersion: 1;
  repository: string;
  sourceSha: string;
  runId: string;
  runAttempt: number;
  workflowIdentity: string;
  purpose: "ordinary-ci" | "publication-candidate";
  checks: CheckEvidence[];
  artifactDigest: string;
  toolchainRevision: string;
  coverage?: {
    inventoryDigest: string;
    coveredLines: number;
    totalLines: number;
    receiptsDigest: string;
  };
}
```

これは取得情報の正規化schemaで、自己申告JSONだけを信頼する契約ではない。U3/U4は信頼したworkflow/check producerとGitHub側のrun・attempt・repository・sourceを独立照合し、artifactをdigestで照合する。同名checkを未信頼producerが作っても必要checkを満たさない。必要check集合は信頼済み設定から取得し、空集合・重複名・欠落・未知producer・非success・head不一致なら拒否する。commit形式検査はU1がchecksへ含める。

U3は現在headの必要checksを消費し、整形push後は新SHAの通常CIを必要とする。U4はpurpose publication-candidate、固定第一者JS inventoryと全receipt、coveredLines/totalLinesによる80%以上を必要とする。totalLinesは正数、coveredLinesは0以上totalLines以下とし、未収集ファイルを分母から除外しない。coverage欄がないordinary-ci証拠を公開証拠に読み替えない。既存公開bundleの実schemaは維持し、この正規化schemaへのadapter対応をU4が検証する。

取得失敗・権限不足・rate limit・消えたrun・source変更は証拠不成立。読取retryは有限かつtimeout内に制限できるが、成功するまで無制限に待たない。外部書込みの盲目的retryはしない。

## C3: Maintenance Decision

```typescript
interface CommonContext {
  repository: string;
  prNumber: number;
  headSha: string;
  currentHeadSha: string;
  sameRepository: boolean;
  prOpen: boolean;
  trustedWorkflow: boolean;
  evidence: EvidenceEnvelope;
}
type MaintenanceRequest = {
  schemaVersion: 1;
  operation: "format-push";
  context: CommonContext;
  changedPaths: string[];
  proposedDiffDigest: string;
  reproducedDiffDigest: string;
  trustedFormatterRevision: string;
  trustedConfigDigest: string;
  reproducible: boolean;
  formattingOnly: boolean;
  emptyDiff: boolean;
} | {
  schemaVersion: 1;
  operation: "dependency-merge";
  context: CommonContext;
  authenticatedUpdateBot: boolean;
  directUpdates: { name: string; from: string; to: string;
    kind: "patch" | "minor" | "major" | "prerelease" | "unknown" }[];
  devDependenciesOnly: boolean;
  mixedOrProtectedChanges: boolean;
  expectedLockDigest: string;
  reproducedLockDigest: string;
  protectedMain: boolean;
  mergeable: boolean;
};
type Decision = {
  schemaVersion: 1;
  decisionId: string;
  operation: MaintenanceRequest["operation"];
  headSha: string;
  evidenceIdentity: string;
  policyRevision: string;
  outcome: "allow" | "reject" | "no-op";
  reasons: string[];
};
declare function evaluateMaintenance(
  request: MaintenanceRequest, trustedPolicy: TrustedPolicy
): Decision;
interface TrustedPolicy {
  revision: string;
  repository: string;
  allowedFormatPaths: string[];
  allowedDevDependencies: string[];
  requiredCheckProducers: { name: string; producerIdentity: string }[];
  formatterRevision: string;
  formatterConfigDigest: string;
}
```

取得・認証・分類・再現はU3の無権限側が行う。上のbooleanやdigestをPR提出artifactの自己申告からそのまま作らず、信頼済み検査から生成する。policyは信頼したbase側の固定revisionから取得し、PRによるallowlist・formatter・必要check改変で許可条件を緩めない。関数にcredential・executor・API clientを渡さない。未知version・欠落必須項目・不正型・不明分類はrejectで、理由を記録する。

format-pushは許可パス、同一repo、open PR、head一致、信頼元・artifact照合、固定formatter/configで完全再現した整形差分に限定する。emptyDiffはno-op、再現不能又は整形以外はreject。formatterの再現にはPR由来script/configを使わない。

dependency-mergeは許可したstable dev依存patch/minorの直接更新ちょうど1件、唯一の直接変更から再現したlockの完全一致、保護main・merge可能・現在headで必要checks全成功を要求する。0件・2件以上・major・prerelease・不明分類・allowlist外・混合/保護対象変更・fork・lock不一致・非成功checksはreject。推移依存更新数は直接1件制限に数えないが、唯一の直接変更に由来しないlock差分は認めない。

## External Operation Adapter and Public Compatibility

U3はDecision allowを受けても、書込み直前にPR・head・必要checks・main保護を再照合し、expected headを外部操作へ渡す。照合後の競合を単なる事前GETで防いだと扱わない。選んだAPI/操作がexpected head条件を原子的に保証できることを後続設計・検証で示し、不可能なら自動操作を拒否して手動へ回す。差分生成や依存導入にwrite credentialを渡さない。

reject/no-opではexecutor0回。allowの場合だけ対象のpush又はmergeを1回要求する。通信失敗で結果不明なら再送せず、対象PR/head/結果を読取照合して成功・失敗・不明を記録する。PR単位concurrencyを設定し、既に適用済みの整形やmergeには空commit・再mergeを作らない。整形後の通常CI起動方法とtoken権限はU3が具体化し検証する。

U4のnpm OIDC公開とGitHub Releaseは既存の承認済みbundle/CLI gateを維持する。今回は実公開を行わず、未承認・不足・改変時に公開executor0回を検証する。Node/browser consumer API・Worker protocolは変更しないため既存仕様と回帰を互換契約の根拠とする。新規外部HTTP APIはない。

## Ownership, Versioning and Failure Tests

C1/C2はU1、C3はU2が所有し、U3/U4はconsumerとして契約試験を持つ。共有schemaのversion1を使う。意味・必須項目の変更はproviderとconsumerの同時承認・更新を要し、未知major versionは拒否する。説明用の任意metadata追加は可能だが、権限判断に未知fieldを使わない。公開APIの互換性を変える変更は今回の対象外。

| 契約 | 正常例 | 必須の拒否・境界試験 |
|---|---|---|
| C1 | cacheなしfrozen導入から対象task成功 | lock不一致、欠落資産、失敗・timeout・cancel |
| C2 | 正しいproducer・run・SHAの全必要checks | 欠落、偽producer、stale SHA、改変artifact、skip/pending/fail、coverage不足・分母欠落 |
| C3 format | 固定formatterによる完全一致 | 非整形、許可外、不一致、fork、古いhead、空差分no-op、二重実行 |
| C3 dependency | 直接dev依存1件stable patch/minor | 0/2件、major/prerelease、混合、無関係lock、不足CI、公開/Action変更 |
| 外部入口 | expected head成立で操作1回 | 判定拒否・競合・権限/通信失敗で追加操作0回、結果不明時再送なし |
| 公開境界 | 既存gateとconsumer確認 | 未承認・証拠不足・改変で公開起動0回 |

## Open Questions

| Contract | Question | Blocks |
|---|---|---|
| C3 外部入口 | expected headを保証する具体APIとtokenを後続設計で検証する。保証不能なら自動操作を拒否する | U3の実運用検証 |
| C1/C2 | 固定tool version、task/check名、必要check producerの具体値を後続設計で定義する | U1/U3/U4の実装 |

これは技術事項の未確定点であり、人間の承認済み方針を再質問する項目ではない。条件を満たすまでは運用済みと記録しない。

## Sources

- ../units-generation/unit-of-work.md：4単位の責任と所有。
- ../units-generation/unit-of-work-dependency.md：3本の依存辺。
- ../domain-design/components.md：entity形状、commit検査担当、判定/操作分離。
- ../requirements-analysis/requirements.md：FR1–FR9、NFR1–NFR5の正常・拒否条件。

契約は設計案で、Bun移行・API条件・workflow動作は未検証。
