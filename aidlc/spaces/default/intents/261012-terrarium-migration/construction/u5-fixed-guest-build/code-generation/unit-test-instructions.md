# U5 fixed-guest-build 単体試験の手順

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
