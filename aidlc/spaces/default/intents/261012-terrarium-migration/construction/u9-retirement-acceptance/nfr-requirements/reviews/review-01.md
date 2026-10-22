**Collaborator:** aidlc-architecture-reviewer-agent

### Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-10-21
**Iteration:** 1

**Prior findings**

| ID | Now | Severity | Note |
| --- | --- | --- | --- |
| None. | | | |

**New findings**

| Severity | Location | Finding | Required action |
| --- | --- | --- | --- |
| Major | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u9-retirement-acceptance/nfr-requirements/security-requirements.md > NFR8.6 の合格の条件 | 「残ってよいのは intent の AI-DLC の記録の dir だけ」としているが、formicarium の `aidlc/spaces/default/memory/team.md`・`project.md`（例：「terrarium 側の ref 別配布」「pitchfork … terrarium も同じ行を直している」）、codekb、他の intent の記録、audit にも terrarium の言及がある。後の検索で「例外以外 0 件」は、Q5=A のままでは成り立たない。`gh search code` は index の遅れ・fork・既定 branch 以外・private を取りこぼすので、0 件の証明にも足りない。 | 例外の範囲を、残す path の明示的な一覧にする（intent の dir、memory、codekb、audit、他の intent の記録のどれを残し、いつ・誰が消すか）。または memory と codekb の言及も U9 で消す対象にする（memory は learnings の経路で人が承認する）。検索は各 repository の全 branch の checkout への `rg`（大文字小文字を区別しない）を主にし、`gh search code` は補助と書く。検索対象に fork・workflow の `uses:`・lockfile・Pages・Release の URL を含めることも書く。 |
| Major | 同 > 置き換え（2026-10-21 の人間の方針）の表、NFR8.1 | unit-of-work の U9（「U6/U8 受入証拠と source/pack/guest/deployed identity の照合」「未達/未承認なら退役を拒否する条件試験」「利用調査・移行案内」）と契約 C10（U9 は両証拠と現在の input を照合し、同じ digest の log を持たない行は不合格）・C12（JSON の操作計画と人間の承認）が、置き換えの表に出てこない。NFR8.1 は「行がすべて passed」の読取りの一覧だけで、identity の照合も、拒否の条件試験も、C12 の操作計画の形式も要件にない。Q1 の補足は削除を始めてよいという判断であり、これらを捨てるという記録にはなっていない。 | 置き換えの表に行を足し、(a) identity 照合を「証拠の SHA256 と passed の記録だけにする」と明示して unit-of-work・C10 から外す、または (b) 現在の formicarium・vivarium の commit と pack に対する identity の一致を NFR8.1 の合格の条件に入れる。「条件試験」と利用調査・移行案内を外すことも同じ表に書く。C12 の操作計画（対象の一覧・承認の記録）を NFR8.2 で採用するかを書く。 |
| Minor | 同 > NFR8.8 の順序、NFR8.3 | npm が unpublish を断り、support の返答待ちになる場合（直近 30 日 469 件の download があるので十分ありうる）、手順 (4) の repository の削除を待つか進めるかが書かれていない。JSR で削除ができず運営も断った場合（yank しかできない場合など）の合格の条件もない。 | 手順 (4) を npm・JSR の完了後に始めるか、返答待ちのまま進めてよいかを書く。JSR が削除を断った場合は、人間が結果を判断する（deprecate は行わない）と書く。 |
| Minor | 同 > NFR8.9、置き換えの表 | 「過去の履歴すら無くす」の効果の限界が書かれていない。fork・clone・npm の mirror・cache・Wayback は repository の削除では消えない。また利用者の fork（`Marukome0743/terrarium` など）、ローカルの clone・remote・jj の bookmark・`gh` の設定は検索と削除の対象に入っていない。 | NFR8.9 に、削除が第三者の複製を消さないことを書く。人間の fork と手元の clone・remote の扱い（削除する、または残す）を一覧に入れる。 |
| Minor | 同 > 冒頭、NFR2.1、Q5 | 「U9 は runtime・型・公開 API を変えない」としながら、Q5=A は製品の code・試験・文書から terrarium の名前と互換の部分を消す。npm の pack に入る file（README・文書・schema の値）が変わると pack の digest が変わり、U6・U8 の受入済み identity（`formicariumPackSha256` など）と合わなくなる。NFR3〜7 を N/A とする理由（変更しない）の前提もこの点に依存する。 | 言及の削除が pack の内容と schema の値を変えるか否かを調べて書く。変える場合は、受入済みの版との対応をどう扱うか（再 release、または証拠との対応の更新）を書く。変えない場合はその確認の方法を書く。 |
| Minor | 同 > NFR8.1、traceability.json | U6 の証拠は「記録の dir」としか書かれておらず、ID・path・SHA256 を特定できない。traceability.json の `upstream_ids` に FR16 が無い（置き換えの中心なのに）。利用調査（download・dependents）を「記録だけにする」としたが、記録する要件の行が無い。 | U6 の証拠は、具体的な file か run の ID で特定する。`upstream_ids` に FR16 を足す。download・dependents の記録の場所を要件の行にする。 |

### Sources

- aidlc/spaces/default/intents/261012-terrarium-migration/construction/u9-retirement-acceptance/nfr-requirements/security-requirements.md
- aidlc/spaces/default/intents/261012-terrarium-migration/construction/u9-retirement-acceptance/nfr-requirements/tech-stack-decisions.md
- aidlc/spaces/default/intents/261012-terrarium-migration/construction/u9-retirement-acceptance/nfr-requirements/traceability.json
- aidlc/spaces/default/intents/261012-terrarium-migration/construction/u9-retirement-acceptance/nfr-requirements/nfr-requirements-questions.md
- aidlc/spaces/default/intents/261012-terrarium-migration/inception/requirements-analysis/requirements.md（FR16、NFR8、制約）
- aidlc/spaces/default/intents/261012-terrarium-migration/inception/units-generation/unit-of-work.md（U9）
- aidlc/spaces/default/intents/261012-terrarium-migration/inception/contract-design/contract-summary.md（C10、C12）
- aidlc/active-memory/team.md、project.md（ディスパッチに含まれる規則。terrarium の言及の確認）

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| - | - | - | No findings | No action required | Resolved |
