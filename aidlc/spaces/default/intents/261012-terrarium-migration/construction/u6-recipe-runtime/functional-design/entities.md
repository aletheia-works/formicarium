# U6 recipe-runtime のentity

## Sources

- `functional-design-questions.md`（Q1–Q11、人間の回答 2026-10-18）
- `../../../inception/units-generation/unit-of-work.md`（U6）、`../../../inception/requirements-analysis/requirements.md`（FR10–FR12、2026-10-18の改訂節を含む）
- `../../../inception/contract-design/contract-summary.md`（C03・C05・C07・C08・C10・C11、2026-10-18の改訂節を含む）、`recipe-v1-guests.schema.json`
- vivarium の読取り調査（ローカル main = `71e0ef92`、2026-10-18）：`docs/site/public/spec/recipe.schema.json`、`src/layer1_wasm/_shared/verdict.ts`、`tools/fixed-guest-builder/src/{declaration,bump,reuse,artifact}.ts`、旧 biome-12265（`04a8724^`）
- 新しい題材：`JamBalaya56562/biome` の `fix/migrate-prettier-override-bracket-spacing`（`25e3e2c2d97c5e1780d10833c9f63fc6dce0f8a9`）。GitHub APIで読取り

この資料は設計で、vivariumの実装・動作の主張ではない。挙動（baselineで `bracketSpacing` が落ちること）はfixの差分から読んだ推測で、未実行。

## Entity model

```yaml
entities:
  - name: Recipe
    description: >-
      vivariumの1件の再現。`src/layer1_wasm/<slug>/recipe.json` が正。U6の題材は
      slug `biome-migrate-override-bracket-spacing`（issue番号なし、Q9=B）。
    attributes:
      - { name: slug, type: string, required: true, unique: true,
          constraints: "kebab-case。数値のupstream issueが立ったら `biome-<番号>` へ改名する" }
      - { name: schema_version, type: integer, required: true, allowed: [1] }
      - { name: language, type: string, required: true, default: shell }
      - { name: symptom, type: string, required: false, default: migration-option-dropped }
      - { name: severity, type: string, required: false, default: bug }
      - { name: tags, type: "list<string>", required: false }
      - { name: expected_verdict, type: enum, required: false, allowed: [reproduced, unreproduced], default: reproduced }
      - { name: expected_runtime, type: string, required: true,
          constraints: "schemaでは minLength 1 の文字列（enumは無い）。受理する値は試験側の SUPPORTED_RUNTIMES と schema の説明文の一覧で決まる。U6の題材は formicarium。terrarium はどちらからも外す" }
      - { name: guests, type: "list<RecipeGuest>", required: "expected_runtime=formicarium のとき必須",
          constraints: "roleがrecipe内で一意。baselineを1件、fixを0〜1件" }
      - { name: fix_candidate, type: object, required: false,
          constraints: "formicarium runtime のrecipeでは宣言しない（guests[]が固定入力の正）" }
      - { name: state, type: enum, required: "導出値（recipe.json には書かない）", allowed: [active, pending],
          constraints: "全guestに accepted があり、formicarium の pin file があれば active。そうでなければ pending（BR1.7）" }
    relationships:
      - { to: RecipeGuest, cardinality: "1..2", direction: owns }
      - { to: Fixture, cardinality: "1", direction: references }
      - { to: CommandScript, cardinality: "1", direction: owns }

  - name: RecipeGuest
    description: >-
      recipeが使う固定guestの1件。上流の `FixedGuestDeclaration`（tool/repository/commit/fixture/reference）
      に、recipe内の役割と、受入済みの成果物のdigestを足したもの（C07・C08）。
    attributes:
      - { name: role, type: enum, required: true, allowed: [baseline, fix], unique: "recipe内" }
      - { name: tool, type: string, required: true, constraints: "英数字開始、最大64 bytes（C03共通型）" }
      - { name: repository, type: string, required: true,
          constraints: "https://github.com/<owner>/<repo> の小文字正規形。上流builderのallowlistに載ること" }
      - { name: commit, type: string, required: true,
          constraints: "小文字hex40。buildの入力（上流builderが読む値）。bump が動かす。branch名だけの宣言は不可" }
      - { name: fixture, type: string, required: true, constraints: "recipeが所有するfixtureのID" }
      - { name: reference, type: object, required: false,
          constraints: "branch/pr は説明専用。baselineは branch=main、fixは branch=fix/migrate-prettier-override-bracket-spacing。ReadyDetail.ref の表示に使う" }
      - { name: accepted, type: object, required: "active の recipe では必須",
          constraints: "受入済みの成果物 {commit, versionOrName, buildKey, elfSha256, buildInfoSha256}。5つが揃うか、無いかのどちらか。site と実行はこれだけを使う。置き換えは人の PR だけ（BR1.4・BR1.6）。digest は小文字hex64" }
    relationships:
      - { to: FixedBuildArtifact, cardinality: "1", direction: "references（U5所有、C07）" }

  - name: Fixture
    description: >-
      guestを実行する前のsessionの初期FS。recipeが所有し（C08）、C03でFsEntryへ変換する。
    attributes:
      - { name: id, type: string, required: true, default: biome-migrate-prettier-override }
      - { name: location, type: string, required: true,
          default: "src/layer1_wasm/<slug>/fixture/（recipe の dir の中）" }
      - { name: files, type: "map<path, bytes>", required: true,
          constraints: "`.prettierrc` = {\"overrides\":[{\"files\":[\"*.js\"],\"options\":{\"bracketSpacing\":false}}]}、`biome.json` = {}。C11のpath/count/byte上限" }
      - { name: cwd, type: string, required: true, default: /work/app }
      - { name: sha256, type: string, required: true, constraints: "BR5.3 の正規化した digest（C08 fixtureSha256）" }

  - name: CommandScript
    description: 各sessionで同じ順に実行するcommand列（C05の1行ずつ）。
    attributes:
      - { name: commands, type: "list<string>", required: true,
          default: ["cat .prettierrc", "cat biome.json", "biome migrate prettier --write", "cat biome.json"] }
      - { name: sha256, type: string, required: true, constraints: "BR5.3 の正規化した digest（C08 commandSha256）" }

  - name: FormicariumBundle
    description: >-
      site配下に置くformicariumのbrowser用file一式（Q4=A）。vivarium の pin file に書いた npm の固定版tarballから取り出す。
    attributes:
      - { name: pinFile, type: string, required: true,
          default: "src/layer1_wasm/_shared/formicarium.pin.json（名前は code generation で確定）",
          constraints: "無い間は formicarium の recipe は pending（BR1.7）。更新は人が確認するPR" }
      - { name: packageVersion, type: string, required: true, constraints: "公開済みの固定版。0.3.0の公開前は pin を置かず、ローカルtarballで試験だけ" }
      - { name: tarballSha256, type: string, required: true }
      - { name: sourceCommit, type: string, required: true, constraints: "その版の tag の commit（40桁）。C10 の formicariumSourceCommit" }
      - { name: files, type: "list<{path, sha256}>", required: true,
          constraints: "runtime/public.js・runtime/web/*・assets/blink.*・LICENSE・THIRD_PARTY_NOTICES.md など、browserで使う配布fileと notices だけ。path の ../・絶対path・symlink・重複は拒否（BR2.1）" }
      - { name: coiServiceWorkerSha256, type: string, required: true, constraints: "coi-serviceworker@0.1.7 の file の digest（BR2.4）" }

  - name: StagedGuestAsset
    description: >-
      site build時に上流Releaseから取り、同じoriginへ置いたguestの成果物（Q5=A）。
    attributes:
      - { name: role, type: enum, required: true, allowed: [baseline, fix] }
      - { name: releaseTag, type: string, required: true,
          constraints: "guest-<tool>-<accepted.buildKey>。recipe の accepted.buildKey から作り、builder の key 計算はやり直さない" }
      - { name: elfPath, type: string, required: true }
      - { name: buildInfoPath, type: string, required: true }
      - { name: catalogPath, type: string, required: true, constraints: "Release の catalog.json。端末の command session の catalog に使う" }
      - { name: elfSha256, type: string, required: true, constraints: "accepted.elfSha256と一致" }
      - { name: buildInfoSha256, type: string, required: true, constraints: "accepted.buildInfoSha256と一致" }
      - { name: catalogSha256, type: string, required: true }

  - name: TerminalPane
    description: >-
      1つのguestを動かす端末要素（baselineとfixで2つ）。vivariumが使う ready/run/transcript だけを提供（Q7=A）。
    attributes:
      - { name: role, type: enum, required: true, allowed: [baseline, fix] }
      - { name: state, type: enum, required: true,
          allowed: [connecting, booting, ready, running, failed, disconnected] }
      - { name: ready, type: "Promise<ReadyDetail>", required: true,
          constraints: "ReadyDetail = {tool, ref, commit, seconds}。ref は guest の reference.branch（表示用）、commitは検証済みbuild-infoの40桁" }
      - { name: inputEnabled, type: boolean, required: true, default: false,
          constraints: "判定の command 列が終わるまで false（BR3.4）" }
      - { name: transcript, type: string, required: true, constraints: "表示buffer。1MiB又は10000行で先頭を捨てる（C08）" }
    relationships:
      - { to: RecipeGuest, cardinality: "1", direction: runs }

  - name: ReproductionSession
    description: 1つのTerminalPaneで command列を実行した結果。
    attributes:
      - { name: role, type: enum, required: true, allowed: [baseline, fix] }
      - { name: ref, type: string, required: true, constraints: "ReadyDetail.ref と同じ" }
      - { name: commit, type: string, required: true, constraints: "accepted.commit（検証済み build-info の値）" }
      - { name: commands, type: "list<{command, code, output}>", required: true }
      - { name: configuration, type: object, required: false, constraints: "migrate後の biome.json をANSI除去・JSON解析したもの" }
      - { name: overrideBracketSpacing, type: "boolean | null", required: true,
          constraints: "includes=[\"*.js\"] のoverrideの formatter.bracketSpacing、無ければ javascript.formatter.bracketSpacing。どちらも無ければnull（BR4.3）" }
      - { name: reproduced, type: boolean, required: true }
      - { name: corrected, type: boolean, required: true }

  - name: ReproductionResult
    description: >-
      Result v1 envelope（`VivariumResultV1`）と DOM/global verdict。
    attributes:
      - { name: contract, type: string, required: true, allowed: [v1] }
      - { name: bug, type: object, required: true, constraints: "{project: biome, issue: 0, upstream_url}。issueが立てば番号" }
      - { name: runtime, type: object, required: true,
          constraints: "{name: formicarium, version: <packageVersion>, extras: {fixture_sha256, baseline_commit, baseline_build_key, fix_commit, fix_build_key, pack_sha256}}" }
      - { name: result, type: object, required: true, constraints: "{baseline, fix_candidate, baseline_error, fix_error}" }
      - { name: verdict, type: enum, required: true, allowed: [pending, reproduced, unreproduced] }
      - { name: timing, type: object, required: true }

  - name: ReproductionComparison
    description: >-
      3ブラウザで同じ入力を比べた証拠（C08 ReproductionComparison）。C10のRecipeEvidenceIdentityへ結び付ける。
    attributes:
      - { name: recipeId, type: string, required: true }
      - { name: fixtureSha256, type: string, required: true }
      - { name: commandSha256, type: string, required: true }
      - { name: before, type: "{stdoutSha256, configSha256, exitCode}", required: true }
      - { name: after, type: "{stdoutSha256, configSha256, exitCode}", required: true }
      - { name: verdict, type: string, required: true }
      - { name: browser, type: enum, required: true, allowed: [chromium, firefox, webkit] }
```

## Summary

- `Recipe` と `RecipeGuest` が固定入力の正で、baselineとfixを `role` で区別する（Q2=A）。baselineは作成時点の biomejs/biome main を40桁へ解決した値で、上流の fixed-guest-bump が main の移動を追う（Q10=B）。fixは fork branch の先頭（今は `25e3e2c2`）。
- guest の `commit` は build の入力、`accepted` は受入済みの成果物（commit・buildKey・digest）で、site は `accepted` だけを動かす。bump は `commit` だけを動かすので、新しい build と人の PR が済むまで、前の受入済みの guest で動き続ける（Q12=A）。全guestに `accepted` があり pin file があれば active、無ければ pending で、pending の recipe は他を止めずに site から外れる。
- `Fixture` と `CommandScript` はrecipeが所有し、formicarium の公開API（C03のFsEntry変換、C05のcommand）へ渡す。
- `FormicariumBundle` と `StagedGuestAsset` は、site build時に同じoriginへ置くもの（Q4=A、Q5=A）。ブラウザは実行前にもう一度照合する。
- `TerminalPane` は ready/run/transcript だけ（Q7=A）。`ReproductionSession`・`ReproductionResult`・`ReproductionComparison` は判定と証拠。
