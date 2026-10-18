# Entities — U2

## Source of Truth

```yaml
entities:
  - name: MaintenanceDecision
    description: MaintenancePolicyが所有する不変の判定結果。書込み許可の再利用可能なtokenではない。
    attributes:
      - {name: schemaVersion, type: integer, required: true, allowed_values: [1]}
      - {name: decisionId, type: opaque-string, required: true, unique: true, constraints: 同一正規化入力とpolicyから同じ識別子を導く}
      - {name: operation, type: enumeration, required: true, allowed_values: [format-push, dependency-merge]}
      - {name: repository, type: repository-identity, required: true, constraints: trusted policyと完全一致}
      - {name: headSha, type: commit-identity, required: true, constraints: 完全な40文字lowercase hex}
      - {name: evidenceIdentity, type: opaque-string, required: true, references: VerificationEvidence, constraints: repository/source/run/attempt/workflow/digestを含む識別子}
      - {name: policyRevision, type: opaque-string, required: true}
      - {name: outcome, type: enumeration, required: true, allowed_values: [allow, reject, no-op]}
      - {name: reasons, type: reason-list, required: true, constraints: rejectは1件以上。固定順で重複なし。secretと任意PR本文を含めない}
    constraints:
      - 永続DBを持たず判定ごとに作成する
      - 不正入力でもrejectを返し許可を生成しない
      - decisionIdの一意性は異なる正規化入力に対する衝突耐性であり同一入力の再評価は同じ結果
    relationships:
      - {entity: VerificationEvidence, cardinality: many-to-one, direction: MaintenanceDecision-to-VerificationEvidence, ownership: QualityVerificationの外部参照}
value_objects:
  - {name: MaintenanceRequest, description: C3の取得済み共通contextとoperation別証拠。外部取得を行わない}
  - {name: TrustedPolicy, description: C3の信頼済みbase設定。PR由来policyは使用しない}
  - {name: IndependentObservation, description: C2の独立照合済み観測。自己申告artifactとは別入力}
```

## Summary

所有entityはMaintenanceDecisionだけ。VerificationEvidenceはU1所有、MaintenanceAttemptはU3所有であり、新しい所有entityとして複製しない。request/policy/observationは不変の値。取得元が偽情報を渡した場合の検出責任はU3の信頼境界であり、純粋判定だけで認証を達成したとは主張しない。
