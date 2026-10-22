# U5 fixed-guest-build 単体試験の手順

## Release を build の run から割り出す形の確認（2026-10-19、追加Step 24–31）

vivarium の fork（`~/Documents/vivarium`、bookmark `fixed-guest-release-from-run`）の repository の root で、1つずつ実行する。mise の shim と `mise exec` は使わず、宣言された task は `mise run`、それ以外は tool の実体の path で呼ぶ。

```bash
bun test tools/fixed-guest-builder/tests/prepare.test.ts
```

```bash
bun test tools/fixed-guest-builder/tests/busy.test.ts
```

```bash
bun test tools/fixed-guest-builder/tests/workflows.test.ts tools/fixed-guest-builder/tests/release.test.ts tools/fixed-guest-builder/tests/cli.test.ts
```

```bash
mise run ci:fixed-guest-builder
```

- Step 27 は不具合の修正なので、`busy.test.ts` の新しい試験の失敗を直す前に観測し、直した後に同じ command で通ることを確かめる。
- `prepare.test.ts` は5–8件。偽の GitHub の API と、試験の中で作る一時の artifact を使い、網の外へ出ない。
- package の行 coverage は今の基準（`ci:fixed-guest-builder` の閾値）を下げない。actionlint と ShellCheck は実体の binary で実行する。
- formicarium 側は、formicarium の root で `mise run migration-guest-build-unit` を1回実行する（U5 の照合に影響が無いことの確認）。
- Step 29a（不安定な試験の修正、bookmark `fix/fixed-guest-builder-size-limit-test`）：再現の試験を足した後、直す前に `bun test tools/fixed-guest-builder/tests/pipeline.test.ts` で失敗を観測し、直した後に同じ command で通ることを確かめる。続けて `mise run ci:fixed-guest-builder`、`mise run fixed-guest-builder:check` を1つずつ実行する。試験の timeout は延ばさない。
- file の名前は計画の名前で、vivarium の既存の名付けに合わせて変えた場合は code-summary に実際の command を書く（この file は変えない）。

## review-05 の指摘の修正の確認（2026-10-19、追加Step 31a–36）

vivarium の fork の新しい bookmark `fix/fixed-guest-release-approval`（`main@upstream` から）で、repository の root で1つずつ実行する。shim と `mise exec` は使わない。

```bash
bun test tools/fixed-guest-builder/tests/busy.test.ts tools/fixed-guest-builder/tests/workflows.test.ts
```

```bash
bun test tools/fixed-guest-builder/tests/prepare.test.ts tools/fixed-guest-builder/tests/release.test.ts
```

```bash
mise run ci:fixed-guest-builder
```

- Step 34 は不具合の修正なので、新しい試験の失敗を直す前に観測し、直した後に同じ command で通ることを確かめる。
- Step 32 の計画の artifact の照合は formicarium の `.artifacts/u5-fixed-guest-build/plans/` で行い、`shasum -a 256` の結果を記録する。
- coverage と時間の上限は下げない。actionlint と ShellCheck は実体の binary で実行する。

## 新しい土台（formicariumのupstream main）での確認（2026-10-18、追加Step 18–23）

新しい試験は加えない。U5のcodeは変えない。U5の本体（builderとworkflow）は上流の aletheia-works/vivarium のmain（merge `71e0ef92`）にあり、その試験（`bun test`、158件・行98.43%）・actionlint・ShellCheckは上流で行った。formicariumの `proposals/vivarium/u5/` は追跡されておらず空なので、下の各節の `proposals/vivarium/u5/...` を使うcommandは、案の置き場所での履歴であり、新しい土台では実行しない。生成JSは追跡されず、`mise run build` が作る。U5のformicarium側のtaskは `mise-tasks/migration/guest-build-*.sh` が `bun run migration:guest-build:*` を呼ぶ。

mainで1つずつ実行する。
1. `mise run lint:all`
2. `mise run typecheck`
3. `mise run build`
4. `mise run test:light`
5. `mise run migration-guest-build-unit`（`tests/migration-guest-build/verify.test.js`。件数とfail・cancel・skip・TODO 0を記録する）
6. 保存済みのRelease 2組に対して `mise run migration-guest-build-verify -- --set <release dir> --binary <guest> --tool <tool> --key <buildKey> --repository <repository> --commit <commit> --first-receipt <file> --reuse-receipt <file> --out <新しいpath>`。引数は保存済みの `.artifacts/migration-guest-build/baseline-reuse-evidence.json`・`fix-reuse-evidence.json` と同じ値を使い、出力が保存済みの照合と一致すること（`--version` の成功・digest・build-info・`buildKey`・再利用）を確かめる。Releaseの再取得・CI・上流への書込みはしない。入力が足りない場合は未検証として記録する。

## 試験の前提と追加の試験（2026-10-21、追加Step 37・38）

- `tests/migration-guest-build/verify.test.js` は、追跡されない生成物 `dist/blink/`（`blink.mjs`・`blink.wasm`・`build-info.json`）と `dist/guests/`（aube・hello・exit3・probe）を読む。`mise run build` はこれらを作らない（tsc と `scripts/emit.ts` だけ）。きれいな checkout では、先に `mise run build-blink-wasm` と `mise run build-guests` を実行する。aube はゲストのソースが変わっていなければ再ビルドしない。
- Step 38 で試験を2件足す。build-info が object でない場合と `dependencies` が配列でない場合に `INVALID_INPUT` で拒否すること（不具合の修正の順：先に失敗を観測する）と、`verify.js` を子 process で実行して証拠の file ができ、必須の引数が無いと失敗し、どちらの後も一時 directory が残らないこと。
- 上の手順の 1〜5 を、今の土台で1つずつ実行する。6（保存済みの Release への照合）は今回は実行しない。
- 2026-10-22（追加Step 40）：形の試験に、`dependencies` に object でない要素がある build-info、`null` の catalog、`entries: [null]` の catalog を足す（不具合の修正の順）。CLI の試験に、assets を書いた後の拒否（別の `--key`）の後も一時 directory が残らないことを足し、子 process に `TMPDIR`・`TEMP`・`TMP` を渡す。`tests/migration-guest-build/verify.test.js` は12件になる。

---

以下は古い土台・案の置き場所での手順の履歴である。

## 試験の枠組み

- builderのpackage（`proposals/vivarium/u5/tools/fixed-guest-builder/`）は、`bun test` で試験する。Bunは最新版を使い、実際の版を記録する。設定はpackageの `bunfig.toml` に置き、探索範囲を `tests/` に限る。
- formicariumの照合の入口（`scripts/migration-guest-build/verify.ts`）は、既存の構成と同じく、buildしたJSを `node --test` で試験する。

## U5だけを実行するcommand

最初の試験の前に、次のcommandが動くことをStep 1で確かめる。

```bash
bun test --cwd proposals/vivarium/u5/tools/fixed-guest-builder tests/runner-ready.test.ts
```

builderの全試験（このUnitのfileだけ）：

```bash
bun test --cwd proposals/vivarium/u5/tools/fixed-guest-builder --coverage tests/
```

formicariumの照合の試験（buildしたJSを直接実行する。mise.tomlには宣言しない）：

```bash
node --test --test-concurrency=1 tests/migration-guest-build/verify.test.js
```

project全体の `bun test` や `npm test` は使わない。

workflowの静的な検査（Step 11）：

```bash
bun test --cwd proposals/vivarium/u5/tools/fixed-guest-builder tests/workflows.test.ts
```

```bash
actionlint proposals/vivarium/u5/.github/workflows/fixed-guest-build.yml proposals/vivarium/u5/.github/workflows/fixed-guest-release.yml proposals/vivarium/u5/.github/workflows/fixed-guest-bump.yml
```

```bash
shellcheck proposals/vivarium/u5/tools/fixed-guest-builder/container/build.sh
```

## coverageの目標

builderのpackageの行coverageは80%以上とする（`bun test --coverage`）。合否は出力の数字ではなく、commandのexit codeで判定する（Bunは関数coverageにも既定の閾値をかける）。試験されていないfileを分母から外さない。formicariumの第一者配布JSのcoverage80%以上は、既存の経路のまま維持する（U5は配布JSを変えない）。

## mockとstubの扱い

外部とのやり取りは、注入できる形にして、試験では偽物を使う。
- git：一時directoryのlocalのbare repositoryを使う。別のrepositoryにだけあるcommitを作り、fork networkの場合を模す。
- docker・mbx・`rustc`：偽のcommandを注入する。
- fetch・GitHub API：関数を注入する。

本物のRustのbuildとGitHubへの書込みは、単体試験では行わない。それらはStep 15で、承認を受けてからvivariumのCIで行う。

## 試験のdata

固定したfixtureは `tests/fixtures/` に置く。中身は、小さいELFの代わりのbytes、build-infoとcatalogのJSON（境界値と+1の大きさを含む）、Cargo.lockとconfig.tomlの例である。大きいfixtureは試験の中で作り、repositoryに入れない。上限は注入した小さい値で、境界値と+1を確かめる。
