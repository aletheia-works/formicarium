# installのデータモデル

## Sources

承認済み inception/domain-design/components.md、units-generation/unit-of-work.md、contract-design/contract-summary.md C02/C03/C04/C11、requirements-analysis/requirements.md FR4/FR5/FR6/NFR1–4/7/8。設計のドキュメント根拠。動作・性能は未検証。

## Entities

```yaml
entities:
  - name: CatalogSnapshot
    description: 呼出し元が渡し、factoryで検証とcopyを完了した不変catalog
    attributes:
      - {name: schemaVersion, type: integer, required: true, allowed_values: [1]}
      - {name: catalogId, type: identifier, required: true, constraints: '空でなくUTF-8最大128bytes'}
      - {name: defaults, type: map, required: true, constraints: 'toolから既存の一意versionOrNameへのexact参照'}
      - {name: entries, type: list, required: true, constraints: 'C04/C11の必須fieldとidentity、最大catalog4MiB'}
    constraints: ['tool/versionOrName組のduplicate拒否', '未知付加fieldはcanonical identityに保持', '元objectの後続変更を観測しない']
    relationships:
      - {target: CatalogSelection, cardinality: 'one-to-many', direction: '選択元'}
  - name: CatalogSelection
    description: 一意に選ばれたentryの不変value、追加のlatest解決をしない
    attributes:
      - {name: tool, type: identifier, required: true, constraints: 'C04の英数字開始、最大64bytes'}
      - {name: versionOrName, type: identifier, required: true, constraints: 'C04の英数字開始、最大128bytes'}
      - {name: url, type: asset-location, required: true, constraints: 'HTTPS絶対又は同origin相対、credentialなし'}
      - {name: format, type: enumeration, required: true, allowed_values: [elf, tar.gz]}
      - {name: archiveEntry, type: guest-path, required: false, constraints: 'tar.gz時のみ必須、elf時禁止、正規化した一意entry'}
      - {name: downloadSha256, type: sha256, required: true, constraints: '取得byteの小文字hex64'}
      - {name: downloadBytes, type: integer, required: true, min: 0, max: 134217728}
      - {name: elfBytes, type: integer, required: true, min: 0, max: 134217728}
      - {name: buildInfo, type: GuestBuildInfo, required: true, references: 'C03/C04'}
      - {name: buildInfoSha256, type: sha256, required: true, constraints: 'metadata canonical JSONのdigest、最大1MiB'}
    constraints: ['実byte数と宣言byte数は完全一致', 'source/buildKey/target/patch/dependenciesはC03と同一規範']
  - name: InstallOperation
    description: 処理中の候補と予約への参照のみ。登録状態のownerではない
    attributes:
      - {name: operationId, type: identifier, required: true, unique: true}
      - {name: reservation, type: opaque-reference, required: true, references: 'U2 C02 token/epoch/signal'}
      - {name: selection, type: CatalogSelection, required: true}
      - {name: state, type: enumeration, required: true, allowed_values: [reserved, fetching, extracting, digesting, validating, registering, committed, failed, cancelled, timed-out]}
      - {name: startedAtMonotonic, type: milliseconds, required: true, min: 0}
      - {name: phaseTimes, type: map, required: true, constraints: '有限非負ms、fetchと非DLを別記録'}
    constraints: ['一操作一予約、全経路でcleanup/release', '処理中byte/candidateはsession FS/cwdへ書かない', '成功候補だけ原子的commit']
    relationships:
      - {target: CatalogSelection, cardinality: 'many-to-one', direction: '不変参照'}
      - {target: SessionState, cardinality: 'many-to-one', direction: 'C02を通じて参照、owner U2'}
      - {target: InstallProgress, cardinality: 'one-to-many', direction: '通知を生成'}
  - name: InstallProgress
    description: 通知用value、受信側は登録状態を所有しない
    attributes:
      - {name: operationId, type: identifier, required: true}
      - {name: sequence, type: integer, required: true, min: 0, constraints: 'operation内で厳密単調増加'}
      - {name: phase, type: enumeration, required: true, allowed_values: [fetch, extract, digest, validate, register]}
      - {name: processedBytes, type: integer, required: true, min: 0}
      - {name: totalBytes, type: nullable-integer, required: true, min: 0, constraints: 'nullはunknown、0と異なる'}
    constraints: ['phase順序を維持、phase内processedBytes非減少', 'callback例外は導入結果を変更しない', '完了/取消後通知なし']
```

## Summary

InstallCoordinatorはCatalogSnapshot/CatalogSelectionと一時InstallOperationを所有。SessionState・登録guestはU2、検証byte/brandはGuestValidationが所有。InstalledGuestの副本、永続cache、catalog自動取得、UIは作らない。

