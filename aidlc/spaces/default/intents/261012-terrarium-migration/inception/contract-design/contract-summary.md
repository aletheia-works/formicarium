# 移管の契約

## Sources

承認済み `../units-generation/unit-of-work.md`、`unit-of-work-dependency.md`、`../domain-design/components.md`、`../requirements-analysis/requirements.md`、本段階Q1=A。既存公開shapeは `types/index.d.ts`、`runtime/public.ts`、`runtime/errors.ts`、`package.json`を照合した（ドキュメント根拠）。以下は0.3.0候補の設計で、現行実装の保証ではない。動作・性能・CORS・兄弟repoでの互換性は未検証。

## Contracts

| # | Provider Unit | Consumer | Mechanism | Owner |
|---|---|---|---|---|
| C01 | U1 | U2 | JSON開始条件証拠 | U1 |
| C02 | U2 | U3, U4 | 内部TS状態操作port | U2 |
| C03 | U2 | U3, U5, U6, U7, External: npm利用者 | 公開TS guest/fixture API | U2 |
| C04 | U3 | U4, External: Node/browser利用者 | 公開TS install API | U3 |
| C05 | U4 | U6, U7, U8, External:端末利用者 | 公開TS command API | U4 |
| C06 | U2, U4 | U5 | B1受入JSON開始条件 | U2（証拠）、U4（統合） |
| C07 | U5 | U6 | 固定build/catalog JSONとELF | U5 |
| C08 | U6 | External: recipe作者/埋込み利用者 | Contract v1拡張JSONとUI契約 | U6 |
| C09 | U7 | U8 | 同一candidate JSON/assets | U7 |
| C10 | U6, U8 | U9 | 比較・配布受入JSON | U6/U8（生成）、U9（共通schema） |
| C11 | External:資産hosting | U1, U3, U5, U7 | HTTPS byte stream | 各取得側 |
| C12 | U9 | External:既存公開/infra executor | JSON操作計画と人間承認 | U9 |

単位DAGの全辺を表で扱う。U5→U4とU2→U1は製品importではなく開始条件。U8のcommand依存はU7の公開API契約を継承する。内部port C02はnpm exportせず、公開factoryの実装が同package内で利用する。固定builderをブラウザbundleに含めず、本体→showcase逆依存も作らない。

## Common Data Types

以下のTSブロックは仕様の規範shape。`Session`、`FsEntry`、`RunResult`、`OutputChunk`、`ExecutionError`は既存公開型を参照する。readonlyは受渡し時のdeep copy/内部byte所有も要求し、型指定だけで可変入力を信用しない。SHA256は小文字hex64、Commitはhex40、日時はoffset付きISO8601、期間は有限非負ms。identifierは空でなく最大128 UTF-8 bytes、tool/versionOrNameは英数字開始の英数字・ドット・underscore・hyphen、最大128 bytes（toolは64）。`@`は版分割にだけ用いる。

```typescript
type Sha256 = string;
type Commit = string;
interface SourceIdentity { repository: string; commit: Commit; }
interface PatchIdentity { name: string; sha256: Sha256; }
interface DependencyIdentity extends SourceIdentity { tool: string; digest: Sha256; }
interface GuestBuildInfo {
  schemaVersion: 1;
  tool: string;
  versionOrName: string;
  source: SourceIdentity;
  target: 'x86_64-unknown-linux-musl';
  rustc: string | null;
  sourcePatches: readonly PatchIdentity[];
  dependencies: readonly DependencyIdentity[];
  builderHash: Sha256;
  buildKey: Sha256;
  elfSha256: Sha256;
}
interface GuestExpectation {
  elfSha256: Sha256;
  buildInfoSha256: Sha256;
  identity: GuestBuildInfo;
}
interface CatalogEntry {
  tool: string; versionOrName: string;
  url: string;
  format: 'elf' | 'tar.gz';
  archiveEntry?: string;
  downloadSha256: Sha256;
  downloadBytes: number;
  elfBytes: number;
  buildInfo: GuestBuildInfo;
  buildInfoSha256: Sha256;
}
interface GuestCatalog {
  schemaVersion: 1;
  catalogId: string;
  defaults: Readonly<Record<string, string>>;
  entries: readonly CatalogEntry[];
}
interface GuestHandle { readonly digest: Sha256; readonly buildInfo: GuestBuildInfo; }
interface Progress {
  operationId: string;
  sequence: number;
  phase: 'fetch' | 'extract' | 'digest' | 'validate' | 'register';
  processedBytes: number;
  totalBytes: number | null;
}
```

build-infoはinline objectをJSON正規化してdigestを確認する。正規化は再帰的key辞書順、array順維持、UTF-8、空白なし、末尾改行なし、有限安全整数/文字列/boolean/nullのみ、重複key/孤立surrogate拒否。正規化入力にunknown付加fieldも含める。buildKeyはtool/repository/commit/builderHash/target/rustc/sourcePatches/dependenciesを同じ規則で正規化してSHA256とし、生成時刻や出力digestは含めない。dependenciesはtool/repository/commitでsort、同identity重複拒否。builderHashは実行script/config/固定toolchain入力のinventory全体のdigestで、変更に追従する。公式資産にmetadataがなければU7/U1がreleaseのsource identityと出所証拠からこのmetadataを生成する。未知commitを架空値で埋めず、取得/照合できなければ受入失敗。非Rust guestはrustc=null、対応toolchain情報は付加fieldに残す。

## C01: 初期試行の開始条件

```typescript
interface Trial {
  tool: 'aube' | 'biome'; browser: 'chromium' | 'firefox' | 'webkit';
  trial: 0 | 1 | 2 | 3 | 4 | 5;
  version: string; url: string; finalUrl: string; digest: Sha256;
  cors: 'passed' | 'failed'; exitCode: number; stdoutDigest: Sha256;
  phasesMs: { fetch: number; extract: number; digest: number;
    validate: number; register: number; run: number };
}
interface PreflightEvidence {
  schemaVersion: 1; evidenceId: string; sourceCommit: Commit;
  recordedAt: string; environment: Readonly<Record<string, string>>;
  trials: readonly Trial[];
  baseline: { source: SourceIdentity; buildKey: Sha256;
    firstDigest: Sha256; reusedDigest: Sha256; compileSkipped: boolean;
    versionExitCode: number; ciRunUrl: string };
}
```

U2の開始はaube/Biome×3browser×6回の36行が一意に揃い、全CORS/exit合格、trial1–5の非DL5工程合計中央値≤3000ms、初回/最大/fetch別結果、環境/host負荷、remote baseline存在と再利用証拠が揃う場合だけ。失敗/欠落は失敗で、代替案の人間確認まで大規模移管しない。U1は既存APIで測定、将来U3は同じschemaで正式経路を測る。baseline完全commitは要件FR9の値を照合する。

## C02: Session状態の内部port

```typescript
interface Reservation { readonly token: symbol; readonly epoch: number;
  readonly operationId: string; readonly signal: AbortSignal; }
interface SessionPort {
  acquire(kind: 'run' | 'install' | 'fs'): Promise<Reservation>;
  commitGuest(r: Reservation, tool: string, guest: GuestHandle): Promise<void>;
  runInstalled(r: Reservation, tool: string, args: readonly string[],
    options: Omit<RunOptions, 'guest' | 'args'>): Promise<RunResult>;
  builtin(r: Reservation, argv: readonly string[]): Promise<CommandResult>;
  release(r: Reservation): Promise<void>;
  resolvePath(path: string): string;
}
```

予約は待ち行列に入れずactiveがあればBUSY。既存直接Session.run/readFile/remove/listEntries/setCwdと新経路も同一所有者の排他を使用し、二重acquireはしない。C02呼出しは予約済み操作の内部継続で、公開runを再帰呼出ししない。commitGuestは内部所有の検証済みhandleのみ受け付ける。token/epoch/activeが一致する場合だけ置換、取消/旧epochはABORTED、disposedはDISPOSED。失敗commitは旧登録不変。releaseはtoken一致だけでactive解放し、旧予約が新予約を消さない。reset/disposeはepochを増やし、進行中のfetch/Workerを中止してcleanup完了を待ち、guest登録を全消去する。FS/cwdのresetは既存公開Sessionの初期状態復元の意味を維持する。dispose後はresetもDISPOSED。resolvePathは予約を取らず状態を変えない同期の読取りで、相対pathを現在のcwdに付けて既存のpath正規化規則で正規化した絶対pathを返し、空・`..`・NUL・文字列でない値は同期でINVALID_INPUTを投げる。戻り値は呼出し時点のcwdにもとづき、dispose・reset・abortは検査しないため、呼出し側は予約保持中か同じtickのうちに使う（2026-10-17、U2 functional-designの再開で追記）。runの出力/FS commitは既存成功・失敗契約を維持し、導入失敗で既存FS/cwdを変更しない。

## C03: 公開guest/fixture検証

```typescript
declare function validateGuest(bytes: Uint8Array,
  expected: GuestExpectation): GuestHandle;
declare function fixtureToFsEntries(entries: readonly FsEntry[]): readonly FsEntry[];
declare function runValidatedGuest(session: Session, guest: GuestHandle,
  options?: Omit<RunOptions, 'guest'>): Promise<RunResult>;
declare function registerValidatedGuest(session: Session, tool: string,
  guest: GuestHandle, options?: { signal?: AbortSignal }): Promise<void>;
```

root exportへ追加する純粋同期API。SHA256/ELF検証も同期で完了する実装を選び、呼出しの途中で変更されないcopyを最初に作る。handleの実体byteは非公開、外からdigest/buildInfoを偽造したobjectを登録できない内部brandを持つ。実行時までそのcopyを所有する。ELFはlittle-endian ELF64/EM_X86_64、静的、program header範囲とsegment範囲をchecked arithmeticで検証、PT_INTERP拒否。期待metadataのsource/target/patch/dependencies/buildKeyとELF/buildInfo digestの全一致を要求。不正はINVALID_INPUT、環境不足はUNSUPPORTED_ENV。Rust toolchain等の文字列identityはbyte単位で比較し意味解釈しない。

fixture変換はguest absolute pathのみ、hostへ解決しない。重複正規化path、NUL、root脱出、symlink脱出/loopを拒否し、hardlink inodeIdを維持する。file byteはcopy、mode/inodeId必須。session初期entriesへ渡す。取得/登録/verdictは行わず、外部URLを受けない。

### 検証済みhandleの公開消費経路
公開 `runValidatedGuest` はhandleの内部所有byte copyを使用し、Session.runと同じ予約/timeout/cleanup/RunResult契約を提供する。`registerValidatedGuest` は同じ排他でhandleを原子的に登録し、C05のtool実行へ接続する。偽造handle/他package instanceの未認識brandはINVALID_INPUT、dispose/busy/abortはC02と同じ。登録guestはreset/disposeで消去し、登録後の再実行でも検証copyを使用する。既存 `Session.run({guest: Uint8Array})` は保持するがmetadata/digest照合の保証は持たず、入力をcopyする既存実行経路として区別する。公開consumer試験はvalidate→元byte/metadata変更→runValidatedGuestとregister→command runの両方で変更前copyが実行されること、偽造handle拒否を確認する。

## C04: 公開install

```typescript
interface InstallOptions { signal?: AbortSignal; onProgress?: (p: Progress) => void; }
interface InstallResult { operationId: string; tool: string;
  versionOrName: string; digest: Sha256; buildKey: Sha256; }
interface Installer {
  install(selection: string, options?: InstallOptions): Promise<InstallResult>;
}
declare function createInstaller(session: Session, catalog: GuestCatalog): Installer;
```

root export。同package factory由来のSessionのみ対応し、偽造SessionはINVALID_INPUT。factoryはcatalogを検証/copyし固定snapshotとして保持し、catalog自体は取得しない。tool@versionOrNameはexact match、省略時はdefaults[tool]のexact matchだけ。一意でないentry、既定値欠落/不一致はINVALID_INPUT。初期catalogにはレシピが必要とする固定名だけでもよい。latestはU7の解決結果をdefaultsに書くもので本体が随時解決しない。

catalog URLはhostの明示した資産URLだけで、commandから任意URLを注入できない。取得前にU2予約、C11取得→展開→download/ELF/build-info検証→C02原子的登録。download digestは取得物、ELF digestは抽出した選択entryを対象とする。archiveEntryはtar.gzで必須、elfでは禁止。成功再installは置換、失敗/取消/timeoutは旧登録維持。Progress sequenceはoperationごと単調増加、processedBytes非負、totalBytes=nullは不明で0と区別、通知順は工程順。callback例外は通知障害として記録し導入のcommitを変更しない。完了/取消後に通知しない。

## C05: 公開コマンド

```typescript
interface CommandOptions { signal?: AbortSignal;
  onProgress?: (p: Progress) => void; onOutput?: (p: OutputChunk) => void; }
interface CommandResult { kind: 'empty' | 'builtin' | 'install' | 'guest';
  exitCode: number; stdout: Uint8Array; stderr: Uint8Array;
  runId?: string; installation?: InstallResult; }
interface CommandSession { execute(input: string,
  options?: CommandOptions): Promise<CommandResult>; }
declare function createCommandSession(session: Session,
  options: { catalog: GuestCatalog }): CommandSession;
```

root export。内部createInstallerを1つ作るが状態はSessionのみ所有する。空白だけはempty/exit0/empty bytes。parserは単引用/二重引用、空文字引数、空白区切りとescaped quote/backslashを扱う。非引用のshell operator（pipe、&、;、<、>）、変数展開構文$、backtick、未閉引用はINVALID_INPUT。引用内はliteralで展開せず、コマンド置換を実行しない。builtinはls [path]、cat path、rm -rf path、cd pathの指定shapeだけ、余分なflag/引数を拒否。installはselection一つだけ、他は登録tool名のguest run。未登録はNOT_FOUND。不正入力は状態不変。

guest正常終了（非0含む）は結果をresolveし、host/core/timeout/取消は既存ExecutionErrorでreject。transcript表示はbyte→UTF-8表示変換でありbyteが原本。HTML/codeとして評価せず、UIは制御文字を端末表示規則で処理する。文字列/行数の上限は後述。command→installはC04、command→builtin/runはC02で予約を一度取得する。直接APIとの競合もBUSY。

## C06: B1成立と正式固定buildの開始

```typescript
interface ApiAcceptance {
  schemaVersion: 1; evidenceId: string; sourceCommit: Commit;
  packageVersion: '0.3.0'; packSha256: Sha256; inventorySha256: Sha256;
  checks: readonly { name: string; status: 'passed' | 'failed' | 'unverified';
    environment: string; logSha256: Sha256 }[];
  preflightEvidenceId: string;
}
```

U4完了条件はU2/U3/U4統合後のtarball/型/inventoryとNode/3browser consumer、競合/取消/不正入力、既存品質/coverage確認が全てpassedで現在candidate identityと一致すること。status欠落/skip/unverifiedはB1成立にしない。U5はこの証拠を照合後に正式移管を開始、製品コードimportはU2公開APIのみ。公開済み0.2.1とlocal private RCを同一視せず、履歴/pack照合を記録する。0.3.0の実公開とterrarium追従は版/対象/証拠の個別承認後。承認前も検証済みcandidateによるローカル開発は可能で、公開済みと記載しない。

## C07: 固定buildとcatalog

```typescript
interface FixedGuestDeclaration extends SourceIdentity { tool: string;
  fixture: string; reference?: { pr?: string; branch?: string }; }
interface FixedBuildArtifact { schemaVersion: 1; buildKey: Sha256;
  elfSha256: Sha256; buildInfoSha256: Sha256; catalogEntry: CatalogEntry;
  elfPath: string; buildInfoPath: string; compiled: boolean; }
```

referenceは説明専用、作成時にremote照合した40commitを実入力にする。fixtureはrecipe-owned ID、builderは内容/verdictを読まずbuildへ混ぜない。U5は同key一つのwriter、staging生成→両digest検証→不変成果物へ原子的確定。再利用時も両ファイルとsource/key/digestを毎回確認し、不一致は拒否、旧良品を上書きしない。途中終了stagingは成果物と扱わない。同key2回目はcompiled=false/同ELF digestを証拠化。Release保存はELF/metadata/catalogを一組、承認後だけ既存executorを利用。cacheをlatest名で上書きせずkeyで参照し、出所不一致は再利用しない。

## C08: recipe Contract v1と埋込みUI

```typescript
interface RecipeRuntime { name: 'formicarium' | 'terrarium'; }
interface RecipeGuest extends FixedGuestDeclaration {
  versionOrName: string; elfSha256: Sha256; buildInfoSha256: Sha256;
}
interface RecipeMigrationFields { runtime: RecipeRuntime;
  guests: readonly RecipeGuest[]; }
interface ReproductionComparison { recipeId: string;
  fixtureSha256: Sha256; commandSha256: Sha256;
  before: { stdoutSha256: Sha256; configSha256: Sha256; exitCode: number };
  after: { stdoutSha256: Sha256; configSha256: Sha256; exitCode: number };
  verdict: string; }
```

このshapeのruntimeは移管adapter選択部分で、Result v1のruntime.nameは既存どおりopaque string。recipe.jsonの完全な統合schemaは同dirの `recipe-v1-guests.schema.json` を規範とする。元のschema_version/language必須、全既存propertyを保持し、guestsだけoptional追加。移管対象recipeではguestsを必須とする受入profileを適用するが、他recipeに必須昇格しない。Result v1/DOMは版固定の `contract-v1-reference.md` revision3と `verdict-api-reference.ts` を規範参照とする。ready/run/transcriptは下記の端末API契約で、Result/recipeとは別境界。runtime.name=terrariumはdeprecated adapter alias、既存terrariumへのfallbackなし。Result nameの他値は削除/拒否しない。

recipeは起動前にtool/repository/commitと両digestを固定期待値へ照合、別repo同名toolやcatalog defaultを代用しない。fixtureはU6所有、初期FS変換はC03、実行はC05。before/afterの期待設定とverdictはU6だけが所有。biome-12265のfixture/command/stdout/生成設定/exit/verdictを移行前に固定し、同条件の3browserでasNeeded/single→always/doubleと旧verdictを比較する。UIのready/run/transcriptは既存メッセージfixtureをgolden testとして保持し、変更が必要なら破壊変更の承認を受ける。

## C09: showcase候補の供給

```typescript
interface ShowcaseCandidateManifest { schemaVersion: 1; candidateId: Sha256;
  sourceCommit: Commit; formicariumPackSha256: Sha256;
  catalogSha256: Sha256; fixtureInventorySha256: Sha256;
  assets: readonly { path: string; sha256: Sha256; bytes: number }[];
  resolvedTools: readonly { tool: 'aube' | 'pitchfork' | 'biome';
    version: string; source: SourceIdentity; elfSha256: Sha256 }[];
  acceptanceLogSha256: Sha256; }
```

candidateIdは自分自身とlog時刻を除いた入力identityの正規化digest。U7はlatestを一度解決し固定する。公式musl資産がない場合のみ設定で指定したsource build経路を選ぶ（取得失敗時の別URLfallbackではない）。Node/3browser --version、公開import/逆依存/回帰fixture分離のchecksを通した候補だけU8へ供給。U8は同じcatalog/assetを使用し再度latest解決しない。site build後のinventory/digestもC10へ記録し、受入したサイトそのものを配布する。失敗時は前回配布不変。Worker/wasmは同origin、COI/CSP/SharedArrayBufferを検証し、回帰fixtureをcopyして使わない。

## C10: 最終受入証拠

```typescript
interface AcceptanceEvidence { schemaVersion: 1; evidenceId: string;
  unit: 'u6-recipe-runtime' | 'u8-showcase-site'; sourceCommit: Commit;
  recordedAt: string; identity: RecipeEvidenceIdentity | SiteEvidenceIdentity;
  checks: readonly CheckRow[];
  outputs: readonly { path: string; digest: Sha256 }[];
  deployedIdentity?: Sha256; }
```

U9はU6/U8双方の必須checkを現在source/入力と照合し、別candidateのログ混用を拒否。配布した場合はdeployedIdentityがsite/package inventoryに一致することを確認する。共有schemaはU9所有、生成責任は各単位。通常CIだけの成功で全受入を通過したと扱わない。Node/Chromium/Firefox/WebKitはそれぞれ別結果、Safari実機は証拠なしならunverified。coverage固定分母/Worker/process/realm欠落をログで確認しskipを合格に変えない。

## C11: 取得・時間・サイズの境界

```typescript
interface TransferPolicy {
  fetchDeadlineMs: 120000;
  installDeadlineMs: 180000;
  maxDownloadBytes: 134217728;
  maxExpandedBytes: 268435456;
  maxElfBytes: 134217728;
  maxArchiveEntries: 4096;
  maxMetadataBytes: 1048576;
  maxCatalogBytes: 4194304;
  maxCommandBytes: 65536;
  maxPathBytes: 4096;
  buildDeadlineMs: 14400000;
}
```

規範上限はDL128MiB/展開合計256MiB/ELF128MiB、metadata1MiB/catalog4MiB、4096entry/path4096bytes/command64KiB。境界値を含め許容し+1でINVALID_INPUT、count/byte累積はchecked integer。fixtureも同じ展開/path/count上限。ゲストwasm1GBは別の既存上限で緩めない。取得deadline120sはDNS/redirect/body完了を含み、install全体180sは予約からcommitまでのwall time。timeout後response/展開結果のcommitを拒否。CPU処理は取消/サイズを分割境界で確認する設計とし、非DL中央値3000msは別の性能受入で180sに置換しない。build全体は依存取得含め4h、timeout/abortはprocess group終了とstaging排除を待つ。無変更aubeの再buildはしない。

URLはHTTPS絶対URL又は同origin相対URL、credential/userinfo禁止。Node/browser共通でcredentials:omit、明示catalog URLから開始し、redirectは最大5hop、全hop HTTPS・userinfoなし・loop拒否、最終URLを記録する。browserでredirectの各hopを検査できない場合は直接Release成功扱いせず、U1で受入した同originミラーURL（redirectなし）をcatalogに固定する。opaque/CORS不可/HTTP非2xx/offline/429はASSET_LOAD、有限deadlineはTIMEOUT、signal/resetはABORTED。自動retry/fallbackなし。Content-Lengthは信用せずstream累積を制限、宣言downloadBytes/elfBytesも実byte数と一致必須。tar.gzはentry path正規化と全entryのescape/重複/link/loop/展開総量を検査し、選択entryだけ抜いて他を無視しない。guest byteは検証copyで実行する。資産digestとmetadata生成の出所照合はダウンロードchecksumだけで代替しない。

これらは契約上の設計値で十分性は未検証。U1で実サイズ/所要時間を記録し不適合なら契約変更をレビュー・承認してから正式実装へ進む。probe600s/aube840s/worker1/retry0の既存試験上限は一切変更しない。

## C12: 公開・退役操作

```typescript
interface ExternalOperation { schemaVersion: 1; operationId: string;
  action: 'publish' | 'deprecate' | 'deploy' | 'archive' | 'infra-update';
  targets: readonly string[]; inputDigests: Readonly<Record<string, Sha256>>;
  acceptanceEvidenceIds: readonly string[]; rollbackPlanDigest: Sha256;
  approvalReference: string; }
```

schemaは操作計画の照合用で、approvalReferenceを入れるだけで承認にはならない。executorは本人の具体的な対象/版/内容への承認と現行digestの一致を確認する。退役はB4/B6受入、npm/JSR/download/dependents調査、全関連repoの個人archive現役参照検索、案内/README/infra planと切戻しが揃う場合だけ。既存版削除は禁止。現行state/ruleset実体を変更前に調査し、対象違い/未達/未承認なら書込みを開始しない。失敗は証拠に記録し残操作を止め、既存配布物保持。秘密/tokenをoperation/logへ保存しない。

## Ownership and Compatibility

### C08規範参照の固定と端末互換

参照は2026-10-12にローカルvivariumから採取した内容で固定する（公開mainと同じという主張ではない）。元recipe schema SHA256=5855fcdd6d70fae131d51d635457742713cd895f64800f8e4ad072bb8a95f378、Contract v1 revision3=c1680c39efec92e4854a23e5dd2954666e431ba369eb189069a66ddca299943e、terminal loader=1ef28dd635971e527fc64ff009c672e5b69e08642072deffc7ea33f02d41589d、verdict helper=8535cabf2d92c46f726c5fc8b36b4ddc24c82cc3a1d24575d25c36fb4348125f。同dirの完全schema/参照3ファイルはこの契約の一部で、契約summaryと一緒にレビュー・版管理する。元パスはvivarium `docs/site/public/spec/recipe.schema.json`、`docs/site/ja/spec/contract-v1.md`、`src/layer1_wasm/_shared/{terrarium_loader.ts,verdict.ts}`。

```typescript
interface ReadyDetail { tool: string; ref: string; commit: string | null; seconds: number; }
interface ExitDetail { command: string; code: number; output: string; }
interface TerminalCompatibility extends HTMLElement {
  readonly ready: Promise<ReadyDetail>;
  readonly transcript: string;
  run(command: string): Promise<ExitDetail>;
}
type ParentRequest = { type: 'terrarium:run'; command: string };
type ParentNotification =
  | { type: 'terrarium:ready'; tool: string; ref: string; commit: string | null }
  | ({ type: 'terrarium:exit' } & ExitDetail)
  | { type: 'terrarium:error'; message: string };
```

U6はこのinterfaceを互換adapterとして提供し、名称を理由にPromise/propertyを変えない。connected後に初期導入完了→ready resolve。失敗はready reject、ready前runはreadyを待つ。同端末のrunは呼出し順に逐次queueし、異なる端末/直接Session競合はC02のBUSY。各runは非0guest終了でもExitDetail resolve、host/core/取消はrejectとerror通知、disconnect/replaced時は保留runもrejectし古い応答を表示しない。queueはadapter責任で共通C05 APIのBUSY拒否を変更しない。transcriptは初期化後からの表示履歴、run結果outputはそのcommandの出力で、display上限の切詰めは別扱い。

DOM eventは `terrarium-ready` detail=ReadyDetail、`terrarium-exit` detail=ExitDetail、`terrarium-error` detail={message:string}、bubbles/composed=true。iframe bridgeを提供する場合は上記ParentRequest/Notificationを保持し、parent origin/source一致を検証、targetOriginに*を使わない。ready通知→受信run→exit又はerrorの順。run失敗後も次のrunは可能、boot失敗時はerrorでreadyしない。現在vivarium再現は要素APIを使うためiframeは別consumer profileで試験する。新formicarium命名の追加eventはoptionalで旧名削除なし。

Result v1はcontract/bug/runtime/result/timingを必須、runtime.nameはopaque、DOM verdictとglobalのenum一致を維持。evidenceはoptional revision2 surface（各stdout/stderr表示4KiB）。互換fixtureは同一入力で旧名terrarium/新名formicarium→同adapter、guestsなし旧recipe schemaの受理、guestsありschema検証、未知runtime Result受理、ready失敗/run失敗/非0exit/disconnect/queue順序、DOM/global/envelope一致を含む。guestsなしの既存recipeをschemaで拒否しないが移管profileは実行前に明示エラーとしlatestに補完しない。

### C06/C10受入profileの固定

```typescript
type EnvironmentId = 'node' | 'chromium' | 'firefox' | 'webkit' | 'host';
interface CheckRow { name: string; environment: EnvironmentId;
  status: 'passed' | 'failed' | 'unverified'; logSha256: Sha256; }
interface RecipeEvidenceIdentity {
  sourceCommit: Commit; formicariumSourceCommit: Commit; formicariumPackSha256: Sha256;
  catalogSha256: Sha256; fixtureSha256: Sha256; commandSha256: Sha256;
  baselineBuildKey: Sha256; baselineElfSha256: Sha256; baselineBuildInfoSha256: Sha256;
  fixBuildKey: Sha256; fixElfSha256: Sha256; fixBuildInfoSha256: Sha256;
}
interface SiteEvidenceIdentity {
  sourceCommit: Commit; formicariumSourceCommit: Commit; formicariumPackSha256: Sha256;
  candidateId: Sha256; catalogSha256: Sha256; fixtureInventorySha256: Sha256;
  siteInventorySha256: Sha256;
}
```

C06 checks.nameの必須集合とenvironmentは以下で固定する。environmentは抽象IDに加えログに実版/OS/host負荷を記録する。{node,chromium,firefox,webkit}をEとする。

| Profile | Check name | 必須environment |
|---|---|---|
| B1 | guest-validation, fixture-validation, handle-copy, install-lifecycle, command-behavior, package-consumer | Eの全4行ずつ |
| B1 | types, package-inventory, source-baseline, coverage-80, probe-eight, aube-native-match, wasm-memory-cap | host各1行 |
| U6 | recipe-identity, biome-12265-comparison, terminal-compatibility, contract-v1, browser-coi | chromium/firefox/webkit各1行 |
| U6 | fixed-build-reuse, contract-schema, active-reference-cleanup, coverage-80 | host各1行 |
| U8 | tool-aube-version, tool-pitchfork-version, tool-biome-version | Eの全4行ずつ |
| U8 | empty-terminal-install, ui-states-keyboard, browser-coi | chromium/firefox/webkit各1行 |
| U8 | public-import-boundary, fixture-isolation, candidate-identity, previous-site-preserved, site-inventory, coverage-80 | host各1行 |

受入profileごと(name,environment)を一意にして必須集合の欠落/重複/failed/unverifiedを拒否。余分checkは記録できるが必須checkを代替しない。B1のtypes等とprobe/nativeは現行固定asset・試験上限の証拠を引用し、未変更aube再buildなし。checks.logSha256は存在する証拠artifactと一致を確認、架空digest禁止。Safari実機は別optional environment記録でWebKit必須行を置換しない。

C06はsourceCommit（formicarium）、packSha256、inventorySha256、preflightEvidenceIdを名前付き必須とし、inventoryはtarball内全first-party配布JS/types/assets一覧のcanonical JSON digest。U4統合後同じsource/packを全B1 checkの入力として記録する。U5はこの完全集合と現在candidateを照合し開始する。

C10の任意inputDigestsは廃止し、unit=U6なら `identity: RecipeEvidenceIdentity`、unit=U8なら `identity: SiteEvidenceIdentity` を必須とする。sourceCommit=証拠生成repo、formicariumSourceCommit/PackはB1のC06と一致。U6のbaseline/fix key・ELF・metadataはC07とrecipe固定値に一致、fixture/command digestは移行前比較の同じ入力を示す。U8のcandidateId/catalog/fixtureInventory/packはC09と全一致、siteInventoryはbuild後サイトの全asset canonical一覧digestでoutputsに同じinventoryを含める。各checkのlogにもこのidentityのdigestを記録し、別candidate混用を拒否する。optional deployedIdentityは受入siteInventoryと一致し、実配布が行われた場合は必須。U9は両証拠と現在input/C06/C07/C09を照合し、同じdigestのログを持たない行は不合格。非配布candidateの検証を配布済みと扱わない。

### Transcriptの表示と原本

端末transcript/描画bufferはUTF-8 1048576 bytes又は10000行の早く達する方を上限とし、古い先頭を捨て末尾を残す。UTF-8文字境界で切り、捨てたbyte数/行数を表示の別通知「以前の出力を省略」に記録する。通知はguest outputに混入させない。Result evidence stdout/stderrの4KiB切詰めは既存規範を維持。C05 CommandResult/RunResultの原本bytesや各run ExitDetail.outputは表示buffer切詰めの対象にしない。UIは原本全履歴を別arrayに重複保持せず、再現比較はcommandごとの原本からstdout/config digestを算出して証拠artifactへ保存する。巨大原本でmemoryを消費し得る既存runの出力契約は勝手に変更せず、今回の表示上限と区別する。1048575/1048576/1048577 bytes、9999/10000/10001行、multi-byte文字境界、tail更新と原本digest不変をconsumer試験に含む。

U2は共有検証/Session、U3はinstall、U4はparser/command、U5は固定成果物、U6はrecipe/互換、U7はcandidate、U9は証拠/操作schemaのowner。未知付加fieldは受理しidentityに含めるが、必須field不足/重複/未知schemaVersionは拒否。追加optional fieldは旧consumerのfixtureで試験、必須追加・意味変更はschemaVersionを増やし明示adapterを設ける。Contract v1の互換拡張は既存consumerを維持して検証、deprecated名の削除は今回しない。npmは公開基点を照合した0.3.0候補に追加export/型をまとめ、破壊変更は独断で行わない。

失敗は既存ExecutionError.codeで区別し、新コードを黙って追加しない。入力/検証=INVALID_INPUT、取得=ASSET_LOAD、競合=BUSY、廃棄=DISPOSED、取消=ABORTED、deadline=TIMEOUT、未登録/path不存在=NOT_FOUND、core/Worker=既存CORE_INIT/EXECUTION/SNAPSHOT。固定buildや外部操作のscriptは非0終了と原因コードを証拠化。callback/ログへcredentialや取得response全文を出さない。

## Contract Tests and Requirement Coverage

各providerは規範shape/境界fixture、consumerは同じfixtureの拒否/成功試験を持つ。C01=FR1/FR9/NFR1、C02=FR5、C03=FR2、C04=FR4/FR5、C05=FR3、C06=FR6、C07=FR7–9、C08=FR10–12、C09=FR13–15、C10/C12=FR16、C11=NFR3/4。NFR2/6/7/8はSession/browser/UI/配布証拠の全契約へ適用する。

境界試験は上限−1/上限/上限+1、未知field/version、duplicate、非有限数、checksum/identity違い、ELF bounds/動的ELF、archive escape/loop/truncate/bomb、HTTP/CORS/429、timeout/body遅延、abortとreset/dispose直後のlate commit、直接runとのbusy、再install失敗の旧登録保持、build同key競合/途中終了/再利用、異なるcandidateの配布拒否を含む。実処理を伴うNode/3browser consumer、recipe before/after golden、showcase3toolを統合検証する。重い実行はmain session逐次。未検証を合格へ変えない。

## Open Questions

| Contract | Question | Blocks |
|---|---|---|
| None | None | None |

未回答の人間の選択はない。CORSと上限十分性の測定、既存Contract v1の具体的統合、remote存在/公開基点/infra照合は各単位の明示受入作業であり、証拠未取得のまま公開・退役しない。
