# terrarium 向け guest 配布候補

`integration/terrarium/guest-distribution/resolver.mjs` の `resolveGuest(input)` が C3 の取得境界である。型は同じディレクトリの `index.d.ts` に定義し、`resolver.d.mts` が実 `.mjs` import に宣言を接続する。実 import の main tsc Red（TS7016/TS2578）後に追加し、main の同じ tsc command で exit 0 を検証済み（実 import と negative checks を含む）。モジュールは terrarium へ渡すソースとしてこの作業領域に置き、formicarium の npm exports/files に追加しない。U3 が既存 terrarium への接続を担当する。

## 選択と安全境界

入力は `{tool:'aube'|'pitchfork',ref?,fixture?,base}`。base は資格情報・query・fragment のない絶対 HTTP(S) 配布ディレクトリ。tools.json と dist/builds.json の登録 key から ref を選び、metadata に記載された URL のみ取得する。省略 ref は既存 terrarium と同じ default-first、次に localeCompare の順で最初の登録 ref を使う。明示した未配布 ref は失敗する。

fixture 未指定は tool の既定、`fixture:''` は空 entries と `/work`。既存 UTF-8 relative file map を `/work` の FsEntry に変換する。明示 byte entry は C1 の既定 persistence roots `/work` と `/root`、path/type/mode/inode/hard-link/symlink 境界を検査してコピーする。cwd と親 directory を seed に補完する。中間 symlink、重複 path、root 外 entry は拒否する。

guest、fixture、build-info の SHA-256、build-info の tool/ref/source URL/ref/commit/time を照合する。ELF64 little-endian x86-64 の program/segment bounds と PT_INTERP 不在を確認する。musl は ELF だけで判断せず、明示した target/libc/linkage provenance を要求する。target は Rust の `x86_64-unknown-linux-musl` または GCC 系の `x86_64-linux-musl`。pitchfork v2.30.1 は上流で musl の型修正済みであり、ローカルパッチを要求しない。

URL は同一 origin と base path の配下に限定し、dot traversal/encoded separator/資格情報/redirect を拒否する。fetch は redirect:error で実行する。404、digest/schema/provenance/ELF 不正は原因と対象を示して reject し、fallback/retry や guest の起動は行わない。エラーに fixture 内容や資格情報を含めない。

## 供給物の作成

`scripts/guest-distribution/stage.mjs <input.json> <new-output-directory>` を main session から実行する。入力は以下の形。

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

## 今回の実資産と検証状態

- 検証済み（main session の出力根拠）：最新確認時の aube は v2.7.0、source commit は `d36fec01764689ef6d99a5e43de98925b571d67f`。公式 musl release archive の digest は GitHub API と一致し、native Linux と installed U1 Worker の `--version` は共に exit 0、stdout `2.7.0 linux-x64 (2026-10-07)`、stderr 空。aube は再 build していない。
- 検証済み（main session の出力根拠）：以前の aube v2.6.1 は source commit `bd94e42f54d3b5e3dd102716b7197f316cb5f4ed`。今回の ref 切替互換性の対照に使う。最新版の確認用 guest と混同しない。
- 検証済み（main session の出力根拠）：公式 pitchfork v2.29.0 GNU binary は native Linux で動くが、PT_INTERP `/lib64/ld-linux-x86-64.so.2` を持ち、C3 の static musl 条件に合わない。
- 検証済み（main）：最新 pitchfork v2.30.0、commit `60e97b1c39183d56e2124f84f9a68ad550fc4011` の承認済み musl patch build は exit 0。39596008 bytes、SHA-256 `67bcb90c31e8525f95f49c9ef5ff9b6526f36e79471f4804bc533b192a772a23`、UI Node v24.18.1。native Linux と installed U1 Worker は共に exit 0、stdout `pitchfork 2.30.0`、stderr 空。

詳細の取得元・digest・検証出力は `.artifacts/u2-release-inputs/latest-verification.json`、実入力は stage-input-latest.json、候補は `.artifacts/u2-guest-distribution/site-v2/`。これらはローカル候補であり実配信済み成果ではない。

## 検証と U3/U4 への引渡し

U3 接続時の root/cwd 境界は未検証。C1 の [公開契約](../aidlc/spaces/default/intents/261006-npm-terrarium-release/inception/contract-design/contract-summary.md) は既定 root `/work` と `/root` を保持し、公開 API `setCwd` で作業 directory を変更する。`selected.cwd` が `/work/app` の場合も、`/work/outside` などの sibling fixture entry を削減しない。既定 `/work` を初期 cwd として `selected.entries` を session の seed に渡し、作成後に `await session.setCwd(selected.cwd)` とする。U3 の実接続テストで `/work/app` と `/work/outside` の両 entry が残り、cwd が `/work/app` になり、guest 実行後も sibling entry を読み取れることを Node と各 browser の公開 API 経由で確認する必要がある。

node:test の manifest/fixtures/resolver/stage/integration を逐次実行し、TypeScript の C3 consumer と独立 ESLint config を検証する。Playwright consumer は一 worker、retry なしで Chromium/Firefox/WebKit を使う。synthetic schema/ELF の二 ref と、実 aube 二 release/最新 pitchfork の供給ケースを区別する。拒否ケースは runtime に渡さず guest 未実行を確認する。redirect は同じ loopback server の配布 base 外にある実在の 200 endpoint へ 302 を返し、target 到達 counter が増えないことも必須にする。到達不能な外部 host の失敗だけを redirect 拒否の根拠にしない。main の最新実資産 Node integration は8 pass/0 fail/0 skip、三 browser は計15 pass（一 worker、retry 0）。

U2 coverage 対象は manifest.mjs / fixtures.mjs / resolver.mjs の固定三ファイル。開発用 producer/collector、型、テスト、guest ELF は理由付きで別検証。`scripts/guest-distribution/coverage.mjs` は別 copy に instrument し、source/instrumented/statement-map hashes と Node の五 test-file process/各 browser の全五 consumer case の receipt を記録する。prepare/report と測定の U2_ACTUAL_SITE は同じ絶対 path を指定し、tools/builds/実資産全ファイルの候補 digest を測定前後に再照合する。未 import は zero map で分母に残し、未収集 realm/case を拒否する。80% 条件を変更しない。

U1 の固定 13 ファイルと結果を保持し、U4 が全 16 第一者配布 JS の coverage と統合前 CI を判定する。U2 は host resolver のみなので Worker 計測は U1 の証拠を別に維持する。実配信、実 terrarium への接続、統合前 CI、署名確認、実機 Safari は未検証。公開・push・npm release の承認を本 Unit の結果から推定しない。

検証済み（main の逐次 correctness 検査）：source.type 保持修正後の producer test は 7 pass/0 fail/0 skip、実 resolver.mjs import の tsc exit 0、独立 ESLint exit 0、coverage collector self-test exit 0。build 中に行った検査の所要時間は性能証拠にしない。最新実資産 integration と coverage measurement も build 完了後に検証済み。

検証済み：U2 coverage は固定3ファイル 201/202 lines（99.5%）、各 module は100%/100%/98.27%。instrumented Node は36 pass、browser は15 pass、5 Node process/15 browser case の成功 receipt を収集。証拠は `.artifacts/u2-coverage-v1/report.json`、sourceIdentity `667f8fb1a5922a539a8272e4072fdb1d953fb570010b16696869db2c052eb1f8`、candidate SHA-256 `7a17aef4fde6c039c890956bf10a3d4a9a0105f5710b5a90e89a9c994cd0c567`。U4 の統合前 CI と実配信は引き続き未検証。
