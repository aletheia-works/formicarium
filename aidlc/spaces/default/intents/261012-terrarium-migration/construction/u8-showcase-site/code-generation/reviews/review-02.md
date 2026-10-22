**Collaborator:** aidlc-architecture-reviewer-agent

### Review

**Verdict:** READY

**Reviewer:** aidlc-architecture-reviewer-agent

**Date:** 2026-10-21

**Iteration:** 1

**Verdict Dictated:** no

review-01 の 8 件はすべて直っている。新しい指摘は Minor 2 件だけで、どちらもブロックしない。

**Prior findings**

| ID | Now | Severity | Note |
| --- | --- | --- | --- |
| R-01 | Fixed | Major | en・ja の maintenance の切戻し (b) から「workflow を無効にする」が消え、「`showcase/tools.json` を PR で直して merge し、main で `showcase-site.yml` を手動で実行する」になった。無効にすると必須の check `showcase-site-required` が報告されず PR が merge できないことと、tools.json・fixtures・b1-pack.json を変える PR は verify だけで配布は手動であることも書かれている。code-summary の置き換えの表に NFR8.5 (b) の行がある。実際の切戻しの実行は未検証で、これは code-summary に明記されている。 |
| R-02 | Fixed | Minor | en・ja の「最初の deploy」の節は、最初の deploy（run 39422079965）は承認済み、承認者は OpenTofu の PR で外した、以後は承認なし、と書き直された。関門は push か main の手動であること（protected branches）、前の job の成功、deploy-guard の 3 つで、現行の workflow と一致する。 |
| R-03 | Fixed | Minor | `showcase/README.md` の「未検証のこと」から distribute の実行が消え、「確かめたこと」に run 39422079965 の結果が入った。candidate job の summary の日数は `candidate.test.ts` が根拠で、run の値は未確認と正直に書いてある。 |
| R-04 | Fixed | Minor | `traceability.json` の BR3.5〜BR3.8、BR5.2、BR6.4 の target が実装ファイルに直った（`keys.ts`・`output.ts`・`terminal-host.ts`・`buffer.ts`・`public/coi-config.js`・`showcase-site.yml`）。承認と承認者の削除は BR6.1・NFR8.2 の detail に移っている。ただし BR1.3 の target に残りのずれがある（新しい指摘を参照）。 |
| R-05 | Fixed | Minor | Deviations に「Step 25 の最初の配布は手動ではなく #54 の merge の push で動いた」が入った。「Tests written but not executed」には、main 以外の手動は実際の run では未実行で、根拠は `workflow.test.ts` の評価だけ、と書かれている。main の手動は run 39509852083 を実行して記録し、BR6.1・NFR8.4 の detail も実態に合っている。 |
| R-06 | Fixed | Minor | 置き換えの表に NFR8.4・NFR8.5 (a)(b)・NFR2.3・NFR8.2・BR1.3 が入り、計画の Step 20 の schedule にも「Step 23 で置き換え」の行がある。計画の Step 20 本文にも Step 23 で置き換える旨が書かれている。 |
| R-07 | Fixed | Minor | `changes` job の grep に `showcase/fixtures/`・`showcase/tools\.json$`・`showcase/b1-pack\.json$` が入り、PR だけ verify を走らせる理由と、配布は手動である旨のコメントも付いた。`workflow.test.ts` の triggers の試験が同じ文字列を検証している。push の paths は意図どおり増やしていない。 |
| R-08 | Fixed | Minor | `deploy` の `needs` に `candidate` が入り、`if` にも `needs.candidate.result == 'success'` が入った。`workflow.test.ts` の「a distribute run whose candidate did not succeed never deploys」が、push と workflow_dispatch の両方で candidate が skipped・failure・cancelled のとき deploy が動かないことを確かめている。needs の全列挙の試験も直っている。 |

**New findings**

| Severity | Location | Finding | Required action |
| --- | --- | --- | --- |
| Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u8-showcase-site/code-generation/traceability.json > coverage BR1.3 | BR1.3（mode の規則）の target が `showcase/site/scripts/verify-candidate.ts` のままである。code-summary の置き換えの表は BR1.3 の実装を `mode.ts` としている。R-04 の「他の行のずれも直す」が、この行には及んでいない。 | BR1.3 の target を `showcase/scripts/mode.ts`（根拠は `showcase/tests/mode.test.ts`）に直す。 |
| Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u8-showcase-site/code-generation/code-summary.md > Status | 冒頭が「Step 1–26 はすべて完了」のままで、Step 27・28 と PR #57 は末尾の節にしか出てこない。冒頭だけ読む人には、開き直しの修正が入ったことが見えない。 | 冒頭を Step 1–28 に直し、#57 `c8497135` を PR の一覧に足す。 |

### Sources

- aidlc/spaces/default/intents/261012-terrarium-migration/construction/u8-showcase-site/code-generation/code-generation-plan.md
- aidlc/spaces/default/intents/261012-terrarium-migration/construction/u8-showcase-site/code-generation/code-summary.md
- aidlc/spaces/default/intents/261012-terrarium-migration/construction/u8-showcase-site/code-generation/traceability.json
- .github/workflows/showcase-site.yml
- showcase/site/tests/unit/workflow.test.ts
- showcase/site/src/content/docs/guides/maintenance.md
- showcase/site/src/content/docs/ja/guides/maintenance.md
- showcase/README.md
- 報告として受けたもの（再実行していない）：PR #57 の check、手元の試験結果、run 39435971322・39509852083

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
