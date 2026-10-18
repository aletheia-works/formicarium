## Review

**Verdict:** NOT-READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-10-18T01:34:54Z
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u7-showcase-guests/nfr-design/security-design.md > §2 設定と許可一覧、Threats and Mitigations 1行目 | 「forkのPRが設定と一覧を同時に変えても別repositoryのsource buildは始まらない」と書いているが、その拒否を実行するworkflow・検査script・境界検査(§9)・再利用判定(§5)はすべてPRのcheckoutにあり、pull_requestではPR側のworkflow定義が使われる。CODEOWNERSの対象は許可一覧fileだけなので、forkのPRが検査自体を外せば拒否は働かない。Q2=Aの前提(mainの一覧で拒否)が実際には成り立たない。 | 検査を行うworkflow、検査script、tools.jsonのschema、境界検査の設定もCODEOWNERSとmainの保護の対象に加える。または、拒否をPRの変更を受けないmainのworkflow・scriptで実行する(未信頼コードをwrite権限で動かさない)構成を設計し、残るリスク(PR側がCI資源を使うこと)を明記する。 | New |
| R-02 | Major | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u7-showcase-guests/nfr-design/security-design.md > §5 再利用、§11 権限、Assumptions & Open Questions 2項目、traceability.json > NFR8.1 | 人間が承認したNFR8.1・Q1の「jobの権限は contents: read だけ」に `actions: read` を設計者の解釈で加え、traceabilityでNFR8.1を「OK」にしている。さらに再利用元の選び方が未定義で、「mainの直近の受入run」をどう特定するか(branch・event・workflow pathの確認、PR/forkのrunのartifactを除外する規則)がなく、ELFとbuild-infoのdigestは同じartifact内の値同士の照合にすぎない。PR run由来のartifactを取り込めば、未信頼の成果物がcandidateに入る。 | actions: readの追加を人間の判断事項として扱い(NFR8.1の改訂又は再利用の取りやめ)、承認されるまでNFR8.1を充足と記録しない。再利用を残す場合は、元runのhead branch=main、event=push、workflow pathの一致、成功conclusion、保存期限内を確認する規則と、検証に使う独立した期待値(buildKey由来の値)を定義する。 | New |
| R-03 | Major | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u7-showcase-guests/nfr-design/security-design.md > §7 本体のpack、§8 受入、§10 manifest | 配布する候補で、12行の受入(§8)がB1のpackと同じ本体で実行されるのかが書かれていない(PR/mainでは同じcommitのpackを作る)。manifestのsourceCommitとB1のsourceCommitの関係(mainがB1より進んだ場合)も未定義で、C10 U8 profileはB1との一致を求める。`distributable: false` はC09のmanifest最上位の付加fieldだが、契約が許す未知fieldは `resolvedTools` の要素側であり、candidateIdに含むかも未定。「配布候補を作れない」ことがworkflowの成功・失敗のどちらになるかも決まっていないため、U8の起動条件(NFR5.2)を実装者が推測することになる。 | 配布候補では取得したB1のpackを受入の入力にすること、sourceCommitの意味、`distributable` の置き場所とcandidateIdへの算入、配布不可のときのworkflow結果とU8への信号(U8は配布を始めない)を明記する。 | New |
| R-04 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u7-showcase-guests/nfr-design/security-design.md > §4 公式資産の取得と出所 | NFR3.3が求める「記録したcommitはrelease tagの識別であり、publisherのbinary再現性の証明ではない」という明記がない。tagがannotatedの場合のcommit解決(tag objectの辿り)も §3 にない。 | 上記の注意書きをmanifestの出所の説明に加え、annotated tagのcommit解決規則を §3 に書く。 | New |
| R-05 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u7-showcase-guests/nfr-design/security-design.md > §5 時間、§1 | NFR4.1の「期限切れ・取消ではprocess groupの終了とstagingの除去を待ってから終える」に対する設計がなく、traceabilityのNFR4.1の対象にも出てこない。HTTP/CORS/offline/429の原因記録も §3 のrate limit以外は書かれていない。 | 取消・timeout時の後始末(process group、staging)と、取得失敗の原因分類を設計に追加する。 | New |
| R-06 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u7-showcase-guests/nfr-design/security-design.md > §1 全体の流れ、§11 | workflowの契機(PRのpaths、mainのpush、手動実行、U8からの`workflow_call`)と、job分割・工程間の受渡しが書かれていない(NFR8.1の検証対象)。また、upstreamのbuild scriptを動かすjobにcheckoutのtoken(persist-credentials)を残さない旨がない。 | 契機とjob分割、各jobの権限、source build jobでtokenを持たせない設定を明記する。 | New |
| R-07 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u7-showcase-guests/nfr-design/traceability.json > NFR2.1・NFR2.2 | NFR2.1の対象に挙げた「§1 本体の重い試験を複製しない」は §1 に書かれておらず、aubeを再buildしないこと、品質上限の維持も設計に現れない。NFR2.2の前半(showcaseのscript・試験を既存のBiome・strict TypeScript経路で検査し、skipを成功にしない)も設計文書にない。 | 該当する記述を設計に追加するか、traceabilityの対象を実際の記述箇所に合わせて修正する。 | New |

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| traceability(手作業) | requirementsのNFR2.1・2.2・3.1–3.6・4.1・4.2・5.1–5.3・6.1・8.1・8.2の16件が `upstream_ids` と `coverage` に全て存在 | 形式は揃っている。ただしNFR2.1・NFR2.2・NFR4.1・NFR8.1の「OK」は上の指摘のとおり内容が不十分 |
| 外部根拠の照合 | U4 code-summaryのB1 packのSHA256 `61b209ae…`、artifact 7日は一致。terrariumの `build-latest-guests.yml` は `contents: read`、180分、PRのみcancel-in-progressで、設計の記述と一致(`actions: read` は元にない) | 引用は正確。`actions: read` は移管元にない設計者の追加 |
| sensors(required-sections等) | 未実行(workflowの担当) | 判断の対象外 |

### Summary

3件のMajorがあるため NOT-READY。拒否の仕組みがPR側のコードで回避できること、承認済みの権限範囲を設計で広げ再利用元の信頼確認が未定義であること、配布候補のpackと受入・manifestの関係が曖昧なことを直せば、残りは軽微な補足で足りる。
