# Main Owner Verification



検証済み：mainの正式TypeScript product/test build、emit、11ファイルBiome checkはexit0。scoped Node testsは28成功（既存21+新規7ケース群）、失敗0/skip0。ログ・時刻・argv・cwd・SHAは `verification/current-main-checks.json`。

検証済み：実owner入力のacceptance実行exit0、`.artifacts/u3-owner-acceptance-v1/acceptance.json`。現BT siteに対する3browser consumerは6成功。fresh coverage Node30成功/155assertions、3browser45成功、1worker/retries0。固定24sourceの1451/1801行、80.56%、skip0、passed=true。`.artifacts/u3-coverage-owner-v1/report.json` にgeneration/source/candidate identityを結合した。同packのU1 v11証拠は明示importであり今回再実行ではない。

## Provenance and Corrections

owner source inventoryは `b70c328cf9d309a18a6dc06eccde0817b0c3a78bf6f7b513ea4cb159beee2f99`。coverage sourceは `26cc8d1960fb1bd60147cea98e9ecbad68bf114088d30f9fc7796a8230360c24`、新candidateは `45e230fb6541e26683b313b9d5e28101296d0f80aa434f49d561123fcb0c120e`、generationは `08c74c3b-bafa-43cf-a251-15bd5c212633`。旧candidateの結果を再ラベルしていない。ownerの136unit/45専用browser/34legacy+既存2skipは原ログ照合済み歴史的外部結果。

main Redではinventory順序比較とcommand cwd検査が実ownerを拒否したため、順序をcanonical比較し、正規owner rootとpackages/terrariumだけを許可した。fixture tmpdirのmacOS aliasによる4失敗はfixture realpathで修正し、原因別否定検査を維持した。最終7ケース群/実owner受入れはGreen。

## Requirements and Limits

US4.1 AC4.1.1–3、US4.2 AC4.2.1–4を `traceability.json` / `traceability.md` にowner正式成果と現在ローカル検証へ対応付けた。C1–C3/U1/U2 sourceは凍結維持、guest再buildなし。実装詳細と履歴は `docs/terrarium-integration.md` 9節。

未検証：遠隔CI、公開RC、実Pages/service-worker、実Safari、remote供給URL到達性。U4の全体release判定・公開・PRは未実施。正式U3レビューとUnit完了は本summaryによって代行しない。
