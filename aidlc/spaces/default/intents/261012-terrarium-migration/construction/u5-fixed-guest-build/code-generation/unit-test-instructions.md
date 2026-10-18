# U5 fixed-guest-build 単体試験の手順

## 新しい土台（formicariumのupstream main）での確認（2026-10-18、追加Step 18–23）

新しい試験は加えない。U5のcodeは変えない。U5の本体（builderとworkflow）は上流の aletheia-works/vivarium のmain（merge `71e0ef92`）にあり、その試験（`bun test`、158件・行98.43%）・actionlint・ShellCheckは上流で行った。formicariumの `proposals/vivarium/u5/` は追跡されておらず空なので、下の各節の `proposals/vivarium/u5/...` を使うcommandは、案の置き場所での履歴であり、新しい土台では実行しない。生成JSは追跡されず、`mise run build` が作る。U5のformicarium側のtaskは `mise-tasks/migration/guest-build-*.sh` が `bun run migration:guest-build:*` を呼ぶ。

mainで1つずつ実行する。
1. `mise run lint:all`
2. `mise run typecheck`
3. `mise run build`
4. `mise run test:light`
5. `mise run migration-guest-build-unit`（`tests/migration-guest-build/verify.test.js`。件数とfail・cancel・skip・TODO 0を記録する）
6. 保存済みのRelease 2組に対して `mise run migration-guest-build-verify -- --set <release dir> --binary <guest> --tool <tool> --key <buildKey> --repository <repository> --commit <commit> --first-receipt <file> --reuse-receipt <file> --out <新しいpath>`。引数は保存済みの `.artifacts/migration-guest-build/baseline-reuse-evidence.json`・`fix-reuse-evidence.json` と同じ値を使い、出力が保存済みの照合と一致すること（`--version` の成功・digest・build-info・`buildKey`・再利用）を確かめる。Releaseの再取得・CI・上流への書込みはしない。入力が足りない場合は未検証として記録する。

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
