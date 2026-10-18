# セッション・guest APIのエンティティ

## Sources

inception/domain-design/components.md、units-generation/unit-of-work.md、contract-design/contract-summary.mdのC02/C03/C06/C11が根拠。本資料は設計で、実装結果は未検証。

## Entity Model

```yaml
entities:
  - name: SessionState
    description: ExecutionSessionだけが変更する実行・FS・cwd・登録の集約
    attributes:
      - {name: sessionId, type: Identifier, required: true, unique: true}
      - {name: epoch, type: NonnegativeInteger, required: true, default: 0}
      - {name: lifecycle, type: State, required: true, allowed: [idle, active, resetting, disposing, disposed]}
      - {name: cwd, type: GuestAbsolutePath, required: true}
      - {name: files, type: OwnedFilesystem, required: true}
      - {name: initialState, type: OwnedInitialFilesystemAndCwd, required: true}
      - {name: installedGuests, type: ToolToValidatedGuestMap, required: true}
      - {name: activeOperation, type: ReservationOrNull, required: true}
    constraints: [登録とFS/cwdの副本を他部品へ持たせない, disposedは終端, resetは初期FS/cwdを復元する, cwdはC02 resolvePathで読むだけで変更しない]
    relationships:
      - {target: Reservation, cardinality: zero-or-one, direction: owns}
      - {target: ValidatedGuest, cardinality: zero-or-many, direction: references-private-owned-value}
  - name: Reservation
    description: 一つの操作の排他とcommit権限
    attributes:
      - {name: token, type: OpaqueUnforgeableToken, required: true, unique: true}
      - {name: epoch, type: NonnegativeInteger, required: true}
      - {name: operationId, type: Identifier, required: true, unique: true}
      - {name: kind, type: OperationKind, required: true, allowed: [run, install, fs]}
      - {name: cancellation, type: CancellationState, required: true}
    constraints: [tokenとepochとactive一致がcommitの条件, 旧tokenのreleaseは新予約を解放しない]
    relationships:
      - {target: SessionState, cardinality: exactly-one, direction: belongs-to}
  - name: ValidatedGuest
    description: GuestValidationが作り内部byteを所有する不変値
    attributes:
      - {name: digest, type: Sha256LowerHex64, required: true}
      - {name: buildInfo, type: OwnedGuestBuildInfo, required: true}
      - {name: bytes, type: PrivateOwnedBytes, required: true, max: 134217728}
      - {name: brand, type: PrivatePackageIdentity, required: true}
    constraints: [公開digestとmetadataから偽造できない, callerの元byteとmetadataから独立, byteは公開しない]
    relationships: []
  - name: FixtureSnapshot
    description: caller-owned入力から変換されたguest初期FSの独立値
    attributes:
      - {name: entries, type: OwnedFsEntries, required: true, max: 4096}
      - {name: expandedBytes, type: NonnegativeSafeInteger, required: true, max: 268435456}
    constraints: [guest絶対pathのみ, path4096 UTF-8 bytes以内, modeとinodeIdを保持, file byteをcopy]
    relationships: []
  - name: ApiCandidateEvidence
    description: MigrationAcceptanceが所有する公開候補identityと試験記録
    attributes:
      - {name: evidenceId, type: Identifier, required: true, unique: true}
      - {name: sourceCommit, type: CommitHex40, required: true}
      - {name: packSha256, type: Sha256LowerHex64, required: true}
      - {name: inventorySha256, type: Sha256LowerHex64, required: true}
      - {name: preflightEvidenceId, type: Identifier, required: true}
      - {name: checks, type: UniqueNamedEnvironmentChecks, required: true}
      - {name: scope, type: CandidateScope, required: true, allowed: [u2-provisional, b1-integrated]}
    constraints: [U2単独証拠をB1成立と扱わない, U4統合後は全C06必須checkを同sourceとpackで再生成]
    relationships: []
```

## Ownership Summary

SessionStateとReservationはExecutionSession、ValidatedGuestとFixtureSnapshotはGuestValidation、ApiCandidateEvidenceはMigrationAcceptanceが所有する。tool固有build、取得、catalog選択、verdictはU2状態モデルへ入れない。検証handleは不変で複数sessionへの登録を許すが、各sessionの予約・登録状態は共有しない。
