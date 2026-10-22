**Collaborator:** aidlc-architecture-reviewer-agent

### Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-10-22
**Iteration:** 1

**Prior findings**

| ID | Now | Severity | Note |
| --- | --- | --- | --- |
| R-01 | Fixed | Major | main `6b5bac1f` の maintenance.md（en・ja）の切戻し (b) は、`showcase/tools.json` を PR で直して merge し、main で `showcase-site.yml` を手動で実行する手順になっている。「workflow を無効にする」は無く、無効にすると必須の check `showcase-site-required` が報告されず PR が merge できなくなると明記している。`infra/github/main.tf` の ruleset の `required_checks` に `showcase-site-required` が今も入っており、記述と整合する。 |
| R-02 | Fixed | Minor | 「最初の deploy」の節（en・ja）は、最初の deploy（run 39422079965）は承認済み、承認者は OpenTofu の PR で外した、以後は承認なし、関門は push か main の手動・前の job の成功・deploy-guard と書いている。`main.tf` の environment（reviewers なし、`protected_branches = true`）と一致する。 |
| R-03 | Fixed | Minor | `showcase/README.md` の「未検証のこと」から distribute の実行が外れ、run 39422079965 の成功が「確かめたこと」にある。candidate job の summary の日数は `showcase/tests/candidate.test.ts` が根拠で、run の summary の値は未確認と明記している。 |
| R-04 | Fixed | Minor | `traceability.json` の BR3.5（`keys.ts`）・BR3.6（`output.ts`）・BR3.7（`terminal-host.ts`）・BR3.8（`buffer.ts`）・BR5.2（`public/coi-config.js`）・BR6.4（`.github/workflows/showcase-site.yml`、根拠は `workflow.test.ts`）が計画の Step 10・14 と一致している。承認と承認者の削除は BR6.1・NFR8.2 の detail にある。 |
| R-05 | Fixed | Minor | code-summary の Deviations に Step 25 の最初の配布が push で動いたと書かれ、「Tests written but not executed」に main 以外の `workflow_dispatch` が実 run で未実行と書かれている。BR6.1・NFR8.4 の根拠は単体試験と push の run、main の手動の run 39509852083 に限られている。 |
| R-06 | Fixed | Minor | code-summary の置き換えの表に NFR8.4・NFR8.5 (a)(b)・NFR2.3・NFR8.2・BR1.3 と計画の Step 20 の行がある。計画の Step 20 には「Step 23 で置き換え」の注がある。 |
| R-07 | Fixed | Minor | 現在の `showcase-site.yml` の `changes` job の grep に `showcase/fixtures/`・`showcase/tools\.json`・`showcase/b1-pack\.json` が入り、`on.push.paths` には足されていない。`workflow.test.ts` の triggers の試験が同じ文字列を検査する。maintenance.md（en・ja）に、その PR は verify するが push では deploy せず手動で配布すると書かれている。 |
| R-08 | Fixed | Minor | `deploy` の `needs` に `candidate` があり、`if` に `needs.candidate.result == 'success'` がある。`workflow.test.ts` に「DIST で candidate が skipped・failure・cancelled なら deploy しない」試験（push と workflow_dispatch の両方）があり、deploy の needs の列挙も直っている。 |

**New findings**

| Severity | Location | Finding | Required action |
| --- | --- | --- | --- |
| Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u8-showcase-site/code-generation/code-summary.md > terrarium の削除（PR #58）の後の確認 | この節の確認（`showcase-site:unit` 185 pass、`showcase:boundary`、`lint:all`、run 39532777387）は main `5735433d` の時点のものである。その後 main には、Biome 2.6.2 と Markdown・YAML の整形（#60）、dependabot の Actions の更新（#61）、CHANGELOG.md の廃止（#63）が入った。#60 は U8 の file を実際に変えている。`workflow.test.ts` の `needsOf` が複数行の `needs:` を読めるようになったこと、`showcase-site.yml` と maintenance.md（en・ja、frontmatter の `---` の次が空行になった）が整形されたことである。code-summary にはこの4件の影響も、`6b5bac1f` での試験の結果も無い。レビュー担当は shell を実行しないため、現在の main で試験が通ることはこの review では確かめていない。Step 2 の「Biome 2.5.15 は `.astro` を扱わない」判断が 2.6.2 でも成り立つかも未確認である。 | code-summary の最新の節に #60・#61・#63 の影響を足す。内容は、U8 の file の差分（`workflow.test.ts` の `needsOf`、`showcase-site.yml`、maintenance.md）、`6b5bac1f` での `mise run showcase-site:unit`・`showcase:boundary`・`lint:all` の結果、#60 の後の main の `showcase-site.yml` の run の結果とする。実行できていなければ「未検証」と書く。 |

### Sources

- `aidlc/spaces/default/intents/261012-terrarium-migration/construction/u8-showcase-site/code-generation/code-generation-plan.md`（Step 1〜31、持ち越した指摘、2026-10-21 の Request Changes の注）
- `aidlc/spaces/default/intents/261012-terrarium-migration/construction/u8-showcase-site/code-generation/code-summary.md`
- `aidlc/spaces/default/intents/261012-terrarium-migration/construction/u8-showcase-site/code-generation/unit-test-instructions.md`
- `aidlc/spaces/default/intents/261012-terrarium-migration/construction/u8-showcase-site/code-generation/traceability.json`
- `aidlc/spaces/default/intents/261012-terrarium-migration/construction/u8-showcase-site/code-generation/source-manifest.json`
- `aidlc/spaces/default/intents/261012-terrarium-migration/construction/u8-showcase-site/code-generation/reviews/review-03.md`（R-01〜R-08 の内容。review-04 は存在しない）
- `.artifacts/ws-biome/showcase/site/src/content/docs/guides/maintenance.md`
- `.artifacts/ws-biome/showcase/site/src/content/docs/ja/guides/maintenance.md`
- `.artifacts/ws-biome/.github/workflows/showcase-site.yml`
- `.artifacts/ws-biome/infra/github/main.tf`
- `.artifacts/ws-biome/showcase/site/tests/unit/workflow.test.ts`
- `.artifacts/ws-biome/showcase/README.md`
- 検証していないもの：shell を実行していないため、`6b5bac1f` での試験・lint・CI の結果、および #58・#60・#61・#63 の差分そのもの。

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | showcase/site/src/content/docs/guides/maintenance.md > Rollback > "A new tool release broke it" | 切戻し手順(b)が「Actions で workflow を無効にし、PR で `showcase/tools.json` を直す」と書いている。`infra/github/main.tf` の ruleset は `showcase-site-required` を必須の check にし、bypass も無いので、workflow を無効にすると全 PR でこの check が報告されず、直す PR 自体が merge できなくなる。さらに日次の schedule をやめた今、無効にして止める自動の配布は無い(配布は site の push と手動だけ)。この手順は NFR8.5 の旧文(日次の配布を止める)のままで、Step 24 の書き換えから漏れている。NFR8.5 は traceability で OK、code-summary で「実行は未検証」とされており、誤りに気づく検証が無い。ja 版は読んでいない(同じ記述と推測)。 | (b)から「workflow を無効にする」を外し、tools.json の条件を PR で直して merge した後、main で `showcase-site.yml` を手動で実行する手順に直す(en・ja)。workflow を止めたい場合は、ruleset の必須 check が報告されなくなることを書く。直した手順を traceability の NFR8.5 の detail に反映する。 | New |
| R-02 | Minor | showcase/site/src/content/docs/guides/maintenance.md > First deployment | 「`github-pages` environment は最初の deploy のための reviewer を持つ。確認後に OpenTofu の PR で外す」と書いているが、reviewer は #55 で外れ済み(`infra/github/main.tf` の environment に reviewers は無い)。公開した site(94970a9e)の文書のままだと、承認の関門が今もある、あるいはこれから外すと読める。現在の配布は承認なしで、関門は DIST の式、`protected_branches`、deploy-guard だけである。 | この節を現状(最初の deploy は承認済み、reviewer は #55 で外した、以後の deploy は承認なし)に書き直す。次の配布の前に直す。 | New |
| R-03 | Minor | showcase/README.md > 未検証のこと | 「`distribute` の実行(U8 の最初の配布で確かめる)」を未検証に残しているが、run 39422079965 で distribute が実行され全 job が success になっている。「各 run の `candidate` job の summary に最後に配布可能な候補を作った run からの日数が出る」(配布の契機の節)も、この review では出どころを確かめられていない。 | 未検証の項目を run 39422079965 の結果に合わせて更新する。candidate job の summary の記述は実在を確かめるか、無ければ削る。 | New |
| R-04 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u8-showcase-site/code-generation/traceability.json > coverage の BR3.5・BR3.6・BR3.7・BR3.8・BR5.2・BR6.4 | target が一つずつずれている。BR3.5(Ctrl-C)→`output.ts`、BR3.6(kind ごとに1回だけ出力)→`buffer.ts`、BR3.7(pagehide で dispose)→`omitted-notice.ts`、BR3.8(buffer の上限)→`status.ts`。計画の Step 10・14 では Ctrl-C は `keys.ts`と`terminal-host.ts`、出力は`output.ts`、dispose は`terminal-host.ts`、buffer は`buffer.ts`である。BR5.2(coi-serviceworker)→`formicarium-loader.ts`も`public/coi-config.js`と対応しない。BR6.4(deploy の job だけに権限)の根拠が code-summary では「最初の deploy の承認と #55 の Apply」になっているが、BR6.4 の違反時は「workflow の試験で失敗」(`workflow.test.ts` の pages write 限定の試験)であり、承認は BR6.1 と NFR8.2 の根拠である。 | 各 ID の target を計画と実装に合う file に直し、BR6.4 の target と根拠を `.github/workflows/showcase-site.yml` と `workflow.test.ts` にする。承認と reviewer の削除は BR6.1・NFR8.2 の根拠に回す。 | New |
| R-05 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u8-showcase-site/code-generation/code-summary.md > 未検証 / Deviations from the plan | 最初の配布は main への push(94970a9e)で起きた。計画の Step 25 は「main から showcase-site.yml を手動で実行」と書いており、`workflow_dispatch` の main での実行は実際の run で一度も確かめていない(非 main の手動が verify で deploy しないことも実 run では未確認で、`workflow.test.ts` の自作の `if:` 評価器だけが根拠)。この食い違いが「Tests written but not executed」にも「Deviations」にも無い。traceability の BR6.1・NFR8.4 は「検証済み」とされている。 | `workflow_dispatch`(main と非 main)を実 run では未実行と書く。Step 25 の実行が push だったことを Deviations に足し、BR6.1・NFR8.4 の根拠を「単体試験と push の run 39422079965」と限定して書く。可能なら main で一度手動の実行をして記録する。 | New |
| R-06 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u8-showcase-site/code-generation/code-summary.md > 置き換えの表 | 表は BR6.1・S15、S7、NFR8.9、`mode.ts`、必須の check だけを置き換える。しかし凍結された NFR8.4(「main の schedule と workflow_dispatch だけが distribute、push は verify」)、NFR8.5(a)(「push では配布しない」)・(b)(「日次の配布を止める」)、NFR2.3(「schedule・手動で distribute」)、NFR8.2(「日次で自動に配布」)、BR1.3 の mode の文は、現在の挙動(push も distribute、schedule なし)と矛盾したままなのに、置き換えを示していない。計画の Step 20 も「schedule `17 4 * * *`」を指示したままで、Step 23 が置き換えたことが Step 20 に書かれていない。 | 置き換えの表に NFR8.4・NFR8.5・NFR2.3・NFR8.2・BR1.3 を足す。計画の Step 20 には「Step 23 で置き換え」の注を付ける。 | New |
| R-07 | Minor | .github/workflows/showcase-site.yml > jobs.changes の grep、`on.push.paths` | PR 側の判定(`changes` の grep)と push の paths は `showcase/site/`・`showcase/scripts/`・workflow 自身だけである。site の build が読む `showcase/tools.json`(カードの元、BR2.3)、`showcase/fixtures/**`(BR3.2)、`showcase/b1-pack.json`(distribute の pack)を変える PR は `site=false` になり、`showcase-site-required` は「関係なし」で通る。壊れても次の site の push か手動の実行まで分からず、日次の schedule(と NFR8.9 の検知)をやめた今は他の検知も無い。結果として別の変更の push で deploy が失敗する。 | PR の `changes` の判定にこの3つの入力を足して verify を走らせる(push の paths には足さず、配布は手動のままにしてよい)。足さないなら、この盲点を maintenance の guide に書く。 | New |
| R-08 | Minor | .github/workflows/showcase-site.yml > jobs.deploy の `needs` と `if` | reviewer の承認が無くなった今、deploy の関門は DIST の式、`protected_branches`、deploy-guard である。deploy は `candidate` を `needs` に持たず `if` でも見ていないので、「build が成功なら candidate が成功(distribute)」を build の `if` を通した間接の含意に頼っている。`fetch-candidate`・`verify-pack` の `if` が将来変わると、verify の build が main の push で deploy される余地がある。`workflow.test.ts` にこの組合せ(DIST で candidate が success でない)の試験が無い。 | deploy の `needs` に `candidate` を足し、`if` に `needs.candidate.result == 'success'` を足す。`workflow.test.ts` に DIST かつ candidate が skipped/failure なら deploy しない試験を足す。 | New |

> R-01 Not re-checked this round

> R-02 Not re-checked this round

> R-03 Not re-checked this round

> R-04 Not re-checked this round

> R-05 Not re-checked this round

> R-06 Not re-checked this round

> R-07 Not re-checked this round

> R-08 Not re-checked this round
