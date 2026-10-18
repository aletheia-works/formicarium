# pitchfork v2.30.1 Verification

## Target and Provenance

検証済み：2026-10-08、公式GitHub latest releaseはv2.30.1。公式tag objectのcommitは1054549e85470b08d9507e2c82c850959a4b3914で、dist/guests/pitchfork.build-infoとcommitファイルに一致。guest ELF SHA256はf30395a418e526e939350cc87e03d43c92d1aa0a0b0b104130761a8b8daa841e。既存musl型パッチは変更していない。

証拠はverification/{build-identity-v2301,native-pitchfork-v2301,node-pitchfork-v2301,browser-pitchfork-v2301}/に保存。各invocation.json/result.jsonはcommand/時刻/guestとbuild-infoの実行前後SHA、stdout/stderr原SHAを保存する。pitchfork-v2301-identities.jsonは実行後に取得したcore/fixture/旧・新baselineのSHAであり、fixtureを実行前に測定したという主張ではない。wrapperの初期fixture pathは不存在を記録していたため、後取得と区別して補った。

## Observed Results

- 正式TypeScript build/main・tests・emitはexit0。生成JS直接変更なし。
- build.test.jsは9pass/0fail。v2.30.1と独立した公式commit、static ELF、patch/UI provenanceを確認。
- Linux nativeは同一ELFをネットワークなしbusyboxコンテナで2回実行し、書き起こしが一致。初回取得image digestはsha256:fd7dc98638c8e305f4dc34e979f1c0fdfdcaeb0fbf8fcff77ae834b6da3d7e6e。
- native基準は実出力から生成し、先頭はpitchfork 2.30.1。旧2.29.0基準はarchive/pitchfork-basic-v2.29.0.native.txtに保存。版番号だけを置換していない。
- session.test.js/pitchfork-basic.test.jsは11pass/0fail。native stdout/exit一致、daemons add/remove、catによる変更確認、settings set→getの継続が成功。
- Chromium/Firefox/WebKitは3pass/0fail。各engineでnative書き起こし一致と状態継続が成功。1worker/retries0、既存timeoutを維持。

## Scope and Limits

この結果はformicariumの既存PoC実行入口でのv2.30.1検証。U1候補tgzのSHAは各観測で記録したが、root PoC試験をtarball consumer経由の最新版検証へ再ラベルしない。正式owner U3のpitchfork v2.30.0測定・consumerは別版の履歴。v2.30.1の実terrarium入口、公開済みRCの受入れ、遠隔CI、実機Safari、公開権限/Trusted Publisher実設定は未検証。これらの不足がある間はstable公開を許可しない。
