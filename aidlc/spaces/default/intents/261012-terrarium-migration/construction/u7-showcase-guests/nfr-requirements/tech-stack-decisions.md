# showcase候補供給の技術選択

## Sources

`aidlc/spaces/default/codekb/formicarium/technology-stack.md` の版の宣言は、2026-10-17の人間の方針（自分たちの開発のtoolは最新版。検証対象のbuildはupstreamの設定に従う）で一部が古くなった。現行terrariumの最新版ビルド（`terrarium/integration/latest-tool-builds.md`、`build-latest-guests.yml`、`scripts/latest-guests.mjs`）、`../../../inception/requirements-analysis/requirements.md`（FR13・FR14）、`../../../inception/contract-design/contract-summary.md`（C03・C04・C09・C11）と、人間の回答 Q1–Q5 を根拠にする。以下はドキュメント根拠であり、U7の動作は未検証。

## Decisions

- 置き場所：formicarium repo内の `showcase/`。本体の `runtime/`・`types/` からは参照しない。showcaseは `@aletheia-works/formicarium` の公開exportだけを使う（FR14）。
- 言語と検査：本体と同じTypeScript（strict、ESM）とBiome。showcaseのscriptと試験は本体のlint・型検査に含めるが、本体の配布物（`package.json` の `files`）には含めない。
- ツールの条件：`showcase/tools.json`（仮の名前）に、repository・tagの形・公式資産の名前とarchive entry・source buildの指定を設定dataとして書く。scriptはツール固有の分岐を持たない。
- 最新版の解決：GitHub REST APIの「latest release」（draft・prereleaseを除く）。tagと40桁のcommitを1回だけ解決して固定する（Q2=A）。tokenはworkflowの読取り用（`contents: read`）。
- 公式資産：aubeとBiomeはx86-64 static musl資産を使い、releaseのSHA256とサイズを照合する（Q3=A）。attestationはあれば記録する。
- source build：公式のstatic musl資産がないツール（現行の調査ではpitchfork）だけ。Rustとtargetはupstreamの設定に従い、showcase自身のtool（Node・Bun）は最新版にする。現行terrariumはpitchforkのUIのためにaubeの公式binaryとNodeを使っている。その構成は移管時に確かめる（未検証）。
- 本体：同じcommitから作った `npm pack` のtarballを使い、SHA256を記録する（Q4=A）。配布する候補はC06のpackと一致を必須にする。
- 受入：Nodeは公開の `/node` export、ブラウザはPlaywright（最新版）でChromium・Firefox・WebKitを動かし、公開の `/browser` exportとC05の `createCommandSession` で `install` と `--version` を実行する。
- CI：formicariumのGitHub Actionsに専用のworkflow（仮に `showcase.yml`）を作る。PR（`showcase/` か公開APIの配布物の変更）・mainへのpush・手動実行・U8からの呼出し（`workflow_call`）で動き、権限は `contents: read` だけ（Q1=A）。
- 候補の受渡し：受入した候補をActions artifactに置き、U8は同じworkflowの中で受け取る（Q5=A）。U7は候補を長期保存しない。
- 境界の機械検査：showcaseのimportを静的に調べ、公開export以外（`runtime/` などへの相対import、package内部のpath）を拒否する。本体側のsourceにshowcaseへの参照がないこと、回帰用fixtureのpathをshowcaseが参照しないことも調べる。方法（Biomeの規則か専用scriptか）はNFR Designで決める。

## Alternatives and Risks

- U7自身にも毎日の定期実行を持たせる案（Q1=B）は、U8の日次buildと重なるため採らない。PRでは動かさない案（Q1=C）は、showcaseの変更の検証が遅れるため採らない。
- semverで最大のtagを選ぶ案（Q2=B）は、tagの形がツールごとに違い、規則が増えるため採らない。AとBの一致を求める案（Q2=C）は、upstreamのrelease運用に左右されて失敗が増えるため、今は採らない。
- attestationを必須にする案（Q3=B）は、3ツールで公開状況がそろっていないため、今は採らない。3ツールともsource buildにする案（Q3=C）は、buildの時間と費用が増え、公式資産を使うデモの目的に合わないため採らない。
- 公開済みのnpmの版だけを使う案（Q4=B）は、0.3.0の公開まで受入を完了できないため採らない。
- GitHub Releaseに候補を保存する案（Q5=B・C）は、書込み権限が必要になり、前回の配布物はPages側に残るため、今は採らない。
- リスク：GitHub APIのrate limitや、upstreamのreleaseの形の変化で候補が作れない日がある。そのときは前回の配布物が残る（NFR5.2）。最新releaseで公式資産がなくなる・動的リンクになると、設定の変更とsource buildの追加が必要になる。

## Compatibility and Rollback

現行terrariumの最新版ビルド（`build-latest-guests.yml` と関係script）は、FR16の退役までそのまま維持する。showcaseへの移管は、terrariumの側を壊さずに追加する形で行う。formicariumへの変更はPR単位にし、`showcase/` と専用workflowを外せば切り戻せる境界を保つ。

## Assumptions & Open Questions

- 各ツールの最新releaseの公式資産の有無と形は、実行時点で確かめる（未検証）。
- 境界の機械検査の方法と、`showcase/` のdirectory構成は、NFR DesignとCode Generationで決める。
