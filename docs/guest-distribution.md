# guest 配布候補

`integration/guest-distribution/resolver.ts` の `resolveGuest(input)` が C3 の取得境界である。現在は TypeScript を編集し、正式 build で配布用 `.js` を生成する。公開型は同じディレクトリの `index.d.ts` と `resolver.d.ts` が接続する。モジュールはこの作業領域に置き、formicarium の npm exports/files に追加しない。

## 選択と安全境界

入力は `{tool:'aube'|'pitchfork',ref?,fixture?,base}`。base は資格情報・query・fragment のない絶対 HTTP(S) 配布ディレクトリ。tools.json と dist/builds.json の登録 key から ref を選び、metadata に記載された URL のみ取得する。省略 ref は default-first、次に localeCompare の順で最初の登録 ref を使う。明示した未配布 ref は失敗する。

fixture 未指定は tool の既定、`fixture:''` は空 entries と `/work`。既存 UTF-8 relative file map を `/work` の FsEntry に変換する。明示 byte entry は C1 の既定 persistence roots `/work` と `/root`、path/type/mode/inode/hard-link/symlink 境界を検査してコピーする。cwd と親 directory を seed に補完する。中間 symlink、重複 path、root 外 entry は拒否する。

guest、fixture、build-info の SHA-256、build-info の tool/ref/source URL/ref/commit/time を照合する。ELF64 little-endian x86-64 の program/segment bounds と PT_INTERP 不在を確認する。musl は ELF だけで判断せず、明示した target/libc/linkage provenance を要求する。target は Rust の `x86_64-unknown-linux-musl` または GCC 系の `x86_64-linux-musl`。pitchfork v2.30.1 は上流で musl の型修正済みであり、ローカルパッチを要求しない。

URL は同一 origin と base path の配下に限定し、dot traversal/encoded separator/資格情報/redirect を拒否する。fetch は redirect:error で実行する。404、digest/schema/provenance/ELF 不正は原因と対象を示して reject し、fallback/retry や guest の起動は行わない。エラーに fixture 内容や資格情報を含めない。

## 供給物の作成

正式 build 後、`scripts/guest-distribution/stage.js <input.json> <new-output-directory>` を main session から実行する。編集元は `stage.ts`。入力は以下の形。

```json
{
  "tools": { "aube": { "default": "main", "fixture": "seed", "cwd": "/work/app" } },
  "manifest": { "builds": {} },
  "builds": [{
    "tool": "aube", "ref": "registered-ref",
    "guestPath": "verified-guest",
    "buildInfoPath": "verified-provenance.json",
    "fixturePaths": { "seed": "fixture.json" }
  }]
}
```

build-info は `schemaVersion:1`、tool/ref、source `{url,ref,commit}`、built_at、target、libc:'musl'、linkage:'static' を持つ JSON。patch_sha256 は過去のビルドに残る履歴情報であり、現在の配布検証の必須項目ではない。既存 legacy build-info を使う場合も、確認した値からこの JSON を作り、元の証拠への参照を追加する。commit や target を推測で補完しない。公開 release の import では built_at が配布 import 時刻なら timestampMeaning を付け、未知の publisher compiler 時刻と混同しない。

producer は実 bytes から digest を計算し、ref の SHA-256 を directory key として tool ごとに配置する。branch の slash を供給 path に転用しない。既存 tools、builds wrapper、対象外 legacy metadata と対象 build の追加 fields を保持する。全入力検査後に private temporary directory から候補を配置する。既存の非空候補 directory は置換しない。build/download/publish は producer の機能に含まない。

保持する ref がある場合は `existingRoot` に従来の供給 directory を指定する。通常ファイルを候補へ保持し、symlink と特殊ファイルを拒否する。保持する schemaVersion:1 ref の guest・fixture・build-info は root 内の相対 path、digest、ELF と provenance を検査する。legacy metadata と通常資産も保持する。検証済み（2026-10-08 main）：保持refの全資産とlegacy bytes、old/new refのHTTP解決、欠落・digest改変・root外path・symlink拒否を追加回帰で確認した。

## 今回の実資産と検証状態

- 検証済み（main session の出力根拠）：最新確認時の aube は v2.7.0、source commit は `d36fec01764689ef6d99a5e43de98925b571d67f`。公式 musl release archive の digest は GitHub API と一致し、native Linux と installed U1 Worker の `--version` は共に exit 0、stdout `2.7.0 linux-x64 (2026-10-07)`、stderr 空。aube は再 build していない。
- 検証済み（main session の出力根拠）：以前の aube v2.6.1 は source commit `bd94e42f54d3b5e3dd102716b7197f316cb5f4ed`。今回の ref 切替互換性の対照に使う。最新版の確認用 guest と混同しない。
- 検証済み（main session の出力根拠）：公式 pitchfork v2.29.0 GNU binary は native Linux で動くが、PT_INTERP `/lib64/ld-linux-x86-64.so.2` を持ち、C3 の static musl 条件に合わない。
- 検証済み（main）：最新 pitchfork v2.30.0、commit `60e97b1c39183d56e2124f84f9a68ad550fc4011` の承認済み musl patch build は exit 0。39596008 bytes、SHA-256 `67bcb90c31e8525f95f49c9ef5ff9b6526f36e79471f4804bc533b192a772a23`、UI Node v24.18.1。native Linux と installed U1 Worker は共に exit 0、stdout `pitchfork 2.30.0`、stderr 空。

詳細の取得元・digest・検証出力は `.artifacts/u2-release-inputs/latest-verification.json`、実入力は stage-input-latest.json、候補は `.artifacts/u2-guest-distribution/site-v2/`。これらはローカル候補であり実配信済み成果ではない。

## 検証と U3/U4 への引渡し

C1 の公開契約（AI-DLC の記録）は既定 root `/work` と `/root` を保持し、公開 API `setCwd` で作業 directory を変更する。`selected.cwd` が `/work/app` の場合も、`/work/outside` などの sibling fixture entry を削減しない。既定 `/work` を初期 cwd として `selected.entries` を session の seed に渡し、作成後に `await session.setCwd(selected.cwd)` とする。

node:test の manifest/fixtures/resolver/stage/integration を逐次実行し、TypeScript の C3 consumer とBiome check を検証する。Playwright consumer は一 worker、retry なしで Chromium/Firefox/WebKit を使う。synthetic schema/ELF の二 ref と、実 aube 二 release/最新 pitchfork の供給ケースを区別する。拒否ケースは runtime に渡さず guest 未実行を確認する。redirect は同じ loopback server の配布 base 外にある実在の 200 endpoint へ 302 を返し、target 到達 counter が増えないことも必須にする。到達不能な外部 host の失敗だけを redirect 拒否の根拠にしない。main の最新実資産 Node integration は8 pass/0 fail/0 skip、三 browser は計15 pass（一 worker、retry 0）。

U2 coverage 対象は manifest.js / fixtures.js / resolver.js の固定三ファイル。開発用 producer/collector、型、テスト、guest ELF は理由付きで別検証。`scripts/guest-distribution/coverage.js` は別 copy に instrument し、source/instrumented/statement-map hashes と Node の五 test-file process/各 browser の全五 consumer case の receipt を記録する。prepare/report と測定の U2_ACTUAL_SITE は同じ絶対 path を指定し、tools/builds/実資産全ファイルの候補 digest を測定前後に再照合する。未 import は zero map で分母に残し、未収集 realm/case を拒否する。80% 条件を変更しない。

U1 の固定 14 ファイルと結果を保持し、U4 が全 17 第一者配布 JS の coverage と統合前 CI を判定する。U2 は host resolver のみなので Worker 計測は U1 の証拠を別に維持する。実配信、統合前 CI、署名確認、実機 Safari は未検証。公開・push・npm release の承認を本 Unit の結果から推定しない。

過去の観測記録（移行前）：source.type保持修正後producer7pass、旧resolver.mjs consumer/ESLint/collectorはexit0。これらを現在のTypeScript/Biomeまたは修正後測定の成功根拠へ流用しない。

過去の観測記録（移行前）：固定3ファイル201/202行=99.5%、Node36pass/browser15pass。旧証拠とidentityは当時の候補だけに対応する。現在の正本は次節の新測定で、U4の統合前CIと実配信は引き続き未検証。

## 2026-10-08 修正後のローカル検証

検証済み（main）：正式build/consumer型/Biome/collector self-test成功。全Node40件と3browser15件成功（1worker/retry0）。新規coverage-repair-v2の計測Node40件/browser15件も成功し、固定3配布JSは249/254行=98.03%で80%を通過。正本は `.artifacts/u2-coverage-repair-v2/report.json`、generation `e8232136-10f5-406a-9b67-464e0a65cba0`、sourceIdentity `7453f02908538a6726f5527deaeb805a45fa1e4d7cf6ff4e89abf7ccb1f6de54`、candidateSHA256 `cecdee3b22326cfad71641616d0031e1f39d121a12160fb55fba53048869f9d7`。全20receiptを結合・照合した。

旧site-v2ではtools.jsonと入力/検証JSONが現環境に欠落していたため、残存3buildの全資産digestを旧manifestと照合し、正規producerで新規 `.artifacts/u2-guest-distribution/site-repair-v1` を生成した（11files）。toolsのdefault/fixture/cwdは明示したローカル検証用値であり、旧catalogueの完全復元・外部配信とは扱わない。guest再build/取得なし。最初の計測v1はhelper欠落で失敗しており不採用。旧directoryを上書きせず、collectorの共通helper同梱修正後にv2へ全測定を収集した。

現在の正式 build は `tsc -p tsconfig.json`、`tsc -p tsconfig.tests.json`、`node .build/scripts/emit.js` の順。Node は生成された `*.test.js`、Playwright は `playwright.config.ts` と `consumer.spec.ts` を使用する。整形・静的検査は Biome。coverage prepare は未使用の output directory のみ作成し、各 receipt を generation/sourceIdentity/candidateSha256 に束縛する。再開前の測定値は過去の観測であり、今回の R01/R02 修正の成功根拠には用いない。

## 2026-10-09 Step12 引渡し資料の整合

保存証拠の最終修正後結果はcoverage-repair-v3である。legacyだけを保持する入力もexistingRoot必須とし、root省略拒否/出力未生成と実legacy bytes保持を回帰で確認した。mainのproducer Red10pass/2fail→Green12pass/0fail、全Node41pass、三browser15pass、collector self-test/正式build/consumer型/Biome成功をmain-verification.mdとreview-03.mdが記録する。reviewはR-01/R-02 Resolved・READY。v2/40件の上記記録は履歴として保持する。

最終測定正本は `.artifacts/u2-coverage-repair-v3/report.json`、generation `976e4419-c417-45ce-a819-46a1ab6c148c`、sourceIdentity `7453f02908538a6726f5527deaeb805a45fa1e4d7cf6ff4e89abf7ccb1f6de54`、candidateSHA256 `cecdee3b22326cfad71641616d0031e1f39d121a12160fb55fba53048869f9d7`。固定3JS・249/254行98.03%・20receiptで80%を維持。再開時は保存結果と現在bytesを照合し、異なるsource/candidateへ成功値を再ラベルしない。

この供給候補はaube2.6.1/2.7.0、pitchfork2.30.0のローカル候補であり、現U1のpitchfork2.30.1実行受入れとは異なる。U1の現Safari5caseもこのU2供給候補の実行証拠へ転用しない。上記の「最新」は当時の観測に限る。失われたsite-v2入力記録を最新正本として要求せず、site-repair-v1と対応v3を引渡しに使う。U3/U4の後続実装結果は各所有Unitの証拠を参照し、ここで代行承認しない。実配信/公開RC/remote CIは未検証、guest再build/候補再構築/外部公開は今回行わない。

検証済み（今回mainの保存証拠照合）：3配布JS digest、候補11file size/SHA、宣言18pathと11traceability targetが一致・実在。現stage/coverage/5Node testのTS/JSは最終v3測定copyと一致する。古いreviewed-source TSVのstage2fileとの差はlegacy-only修正で、v3がその修正を測定済み。browserのcompiled copy差分はcollector hookと.js選択/outputDirだけであり、現製品へ古い結果を再ラベルしていない。今回suiteを再実行せず、同一性確認から既存成功証拠を引き渡す。
