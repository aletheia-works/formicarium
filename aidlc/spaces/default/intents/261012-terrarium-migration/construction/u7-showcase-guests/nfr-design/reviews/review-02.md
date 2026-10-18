## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-10-18T01:41:06Z
**Iteration:** 2
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u7-showcase-guests/nfr-design/security-design.md > §2 設定と許可一覧、Threats and Mitigations 1行目 | 「forkのPRが設定と一覧を同時に変えても別repositoryのsource buildは始まらない」と書いているが、その拒否を実行するworkflow・検査script・境界検査(§9)・再利用判定(§5)はすべてPRのcheckoutにあり、pull_requestではPR側のworkflow定義が使われる。CODEOWNERSの対象は許可一覧fileだけなので、forkのPRが検査自体を外せば拒否は働かない。Q2=Aの前提(mainの一覧で拒否)が実際には成り立たない。 | 検査を行うworkflow、検査script、tools.jsonのschema、境界検査の設定もCODEOWNERSとmainの保護の対象に加える。または、拒否をPRの変更を受けないmainのworkflow・scriptで実行する(未信頼コードをwrite権限で動かさない)構成を設計し、残るリスク(PR側がCI資源を使うこと)を明記する。 | Resolved (reviewer) |
| R-02 | Major | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u7-showcase-guests/nfr-design/security-design.md > §5 再利用、§11 権限、Assumptions & Open Questions 2項目、traceability.json > NFR8.1 | 人間が承認したNFR8.1・Q1の「jobの権限は contents: read だけ」に `actions: read` を設計者の解釈で加え、traceabilityでNFR8.1を「OK」にしている。さらに再利用元の選び方が未定義で、「mainの直近の受入run」をどう特定するか(branch・event・workflow pathの確認、PR/forkのrunのartifactを除外する規則)がなく、ELFとbuild-infoのdigestは同じartifact内の値同士の照合にすぎない。PR run由来のartifactを取り込めば、未信頼の成果物がcandidateに入る。 | actions: readの追加を人間の判断事項として扱い(NFR8.1の改訂又は再利用の取りやめ)、承認されるまでNFR8.1を充足と記録しない。再利用を残す場合は、元runのhead branch=main、event=push、workflow pathの一致、成功conclusion、保存期限内を確認する規則と、検証に使う独立した期待値(buildKey由来の値)を定義する。 | Resolved (reviewer) |
| R-03 | Major | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u7-showcase-guests/nfr-design/security-design.md > §7 本体のpack、§8 受入、§10 manifest | 配布する候補で、12行の受入(§8)がB1のpackと同じ本体で実行されるのかが書かれていない(PR/mainでは同じcommitのpackを作る)。manifestのsourceCommitとB1のsourceCommitの関係(mainがB1より進んだ場合)も未定義で、C10 U8 profileはB1との一致を求める。`distributable: false` はC09のmanifest最上位の付加fieldだが、契約が許す未知fieldは `resolvedTools` の要素側であり、candidateIdに含むかも未定。「配布候補を作れない」ことがworkflowの成功・失敗のどちらになるかも決まっていないため、U8の起動条件(NFR5.2)を実装者が推測することになる。 | 配布候補では取得したB1のpackを受入の入力にすること、sourceCommitの意味、`distributable` の置き場所とcandidateIdへの算入、配布不可のときのworkflow結果とU8への信号(U8は配布を始めない)を明記する。 | Resolved (reviewer) |
| R-04 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u7-showcase-guests/nfr-design/security-design.md > §4 公式資産の取得と出所 | NFR3.3が求める「記録したcommitはrelease tagの識別であり、publisherのbinary再現性の証明ではない」という明記がない。tagがannotatedの場合のcommit解決(tag objectの辿り)も §3 にない。 | 上記の注意書きをmanifestの出所の説明に加え、annotated tagのcommit解決規則を §3 に書く。 | Resolved (reviewer) |
| R-05 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u7-showcase-guests/nfr-design/security-design.md > §5 時間、§1 | NFR4.1の「期限切れ・取消ではprocess groupの終了とstagingの除去を待ってから終える」に対する設計がなく、traceabilityのNFR4.1の対象にも出てこない。HTTP/CORS/offline/429の原因記録も §3 のrate limit以外は書かれていない。 | 取消・timeout時の後始末(process group、staging)と、取得失敗の原因分類を設計に追加する。 | Resolved (reviewer) |
| R-06 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u7-showcase-guests/nfr-design/security-design.md > §1 全体の流れ、§11 | workflowの契機(PRのpaths、mainのpush、手動実行、U8からの`workflow_call`)と、job分割・工程間の受渡しが書かれていない(NFR8.1の検証対象)。また、upstreamのbuild scriptを動かすjobにcheckoutのtoken(persist-credentials)を残さない旨がない。 | 契機とjob分割、各jobの権限、source build jobでtokenを持たせない設定を明記する。 | Resolved (reviewer) |
| R-07 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u7-showcase-guests/nfr-design/traceability.json > NFR2.1・NFR2.2 | NFR2.1の対象に挙げた「§1 本体の重い試験を複製しない」は §1 に書かれておらず、aubeを再buildしないこと、品質上限の維持も設計に現れない。NFR2.2の前半(showcaseのscript・試験を既存のBiome・strict TypeScript経路で検査し、skipを成功にしない)も設計文書にない。 | 該当する記述を設計に追加するか、traceabilityの対象を実際の記述箇所に合わせて修正する。 | Resolved (reviewer) |
| R-08 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u7-showcase-guests/nfr-design/security-design.md > §5 再利用、§10 candidateId | `provenance.reusedFromRun` に元のrunのidを書き、`resolvedTools` の要素に含めたままcandidateIdの計算に入れる。同じツール・同じcommitでも、再利用したrunが違う、又はsource buildした場合でcandidateIdが変わり、「同じ入力なら同じcandidateId」（NFR5.1）の試験が成り立たなくなる。 | candidateIdに含める出所のfield（資産digest・commit・buildKey・elfSha256）と、含めない観測用のfield（`reusedFromRun`・URL・時刻）を分けて書く。 | New |
| R-09 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u7-showcase-guests/nfr-design/security-design.md > §2 CODEOWNERS、§7 `mode: distribute`、Assumptions & Open Questions | CODEOWNERSのレビュー必須は、`main` の保護で「code ownerのレビュー必須」が有効なときだけ効くが、前提に挙がっていない。また、`distribute` が `main` の定義でだけ動くとあるが、workflow内でそれを確かめる条件（`github.ref` が `refs/heads/main`、eventが許された値、呼出し元の確認）が書かれていない。 | 前提として「`main` の保護でcode ownerのレビューが必須」をInfrastructure Designへ送る。`resolve` で `distribute` の許可条件（ref・event）を検査し、満たさなければ失敗にすると §7 に書く。 | New |
| R-10 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u7-showcase-guests/nfr-design/security-design.md > §5 再利用元の取り出し、§10 候補のartifact | 再利用は「runのartifactからELFとbuild-infoを取り出す」とあるが、そのartifactがどの工程のものか（`candidate` のartifactにELFとbuild-infoが入るのか）が書かれていない。B1のpackを取得するrunの選び方（C06の証拠にあるrun idを使うのか）も未定。 | 候補のartifactの中身（ELF・build-info・catalog・manifest・pack参照）を§10に列挙し、B1のpackの取得元の指定方法を§7に1行で加える。traceability NFR2.1の対象から§9を外し、NFR3.6との対応に移す。 | New |

> R-01 Reviewer note: §2で、forkのPRは検査自体を外せることを認め、PRのrunの成果物を信頼しない設計に改めている。配布する候補と再利用元は、`main` の定義で動くrunだけが作る（§2・§5・§7）。CODEOWNERSの対象も、workflow・`showcase/scripts/**`・設定のschema・境界検査の設定まで広げた。残るリスク（CI資源の消費）は明記し、承認の設定はInfrastructure Designへ送っている。

> R-02 Reviewer note: `actions: read` は人間がQ4=Aで決めたと明記した（Sources・§1・traceability NFR8.1）。再利用元は、同じworkflow file・head branchが `main`・event・conclusionが `success`・保存期限内に限る。照合は、`resolutions.json`・設定・builderHashから自分で計算したbuildKeyとの一致、`elfSha256`、source identity、`validateGuest` で行う。信頼の根拠が `main` のrunの完全性である点は残るが、Q4=Aの範囲内である。

> R-03 Reviewer note: §7で、`mode: distribute` はB1のpackを取得して `packSha256` と照合し、12行の受入もそのpackで動かすと定めた。`sourceCommit` と `formicariumSourceCommit` の意味、`distributable` の置き場所とcandidateIdへの算入、配布不可のときの失敗原因（`b1-pack-unavailable`／`b1-pack-mismatch`）、U8への信号（§10）も記述されている。

> R-04 Reviewer note: §4に `provenance.note` を毎回入れる規則を、§3にannotated tagのcommit解決規則を追加した。

> R-05 Reviewer note: §5にprocess group終了・終了待ち・staging除去を、§4に取得失敗の原因分類を追加した。

> R-06 Reviewer note: §1に契機、5つのjobの表（権限・受け取る物・渡す物）、`persist-credentials: false`、source buildの工程にtokenを渡さない旨を追加した。

> R-07 Reviewer note: NFR2.1・NFR2.2の対象が§1・§8の記述に対応した。NFR2.1の対象に挙げた§9は、実際にはNFR3.6の内容である（新しい指摘に含める）。

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| traceability.json（手動確認） | NFR2.1–NFR8.2の16件がすべて `OK`。`upstream_ids` は security-requirements.md の16件と一致 | 欠落・余剰なし。NFR2.1の対象に§9が混じっている点だけ指摘した。 |
| 契約との照合（C06・C09・C11） | `formicariumSourceCommit`・`distributable` などの付加fieldは「未知の付加fieldは受理してidentityに含める」で許されている。C11のdeadline・redirect 5hop・上限の記述は§4と一致 | 契約との矛盾なし。 |
| sensors（required-sections・linter・type-check） | 実行していない（ワークフロー側の担当）。`## Sources`・`## Assumptions & Open Questions` の見出しは存在する | 未検証。 |

### Summary

前回の3件のMajor（検査自体をPRが外せること、`actions: read` と再利用の規則、配布する候補のpack・manifest・U8への信号）はいずれも設計で解消され、Minorの4件も反映された。新しく見つかったのはMinor 3件（candidateIdの安定性、CODEOWNERSとdistributeの条件の前提、候補artifactの中身）のみで、実装前に確定できる。開発者が設計から推測なしで実装できる水準なので、READYとする。
