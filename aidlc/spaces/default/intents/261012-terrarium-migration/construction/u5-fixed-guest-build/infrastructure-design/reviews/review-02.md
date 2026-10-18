## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-10-17
**Iteration:** 2
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u5-fixed-guest-build/infrastructure-design/cicd-pipeline.md > Permissions and Rollback / Pipeline 順序5、infrastructure-specification.md > Environments | Releaseへの書込みの承認が、契約C12（ExternalOperationの操作計画、inputDigests、rollbackPlanDigest、approvalReference、本人の具体的な対象・版・内容への承認と現行digestの一致確認）とどう対応するか書かれていない。承認者を必須にしたGitHub environmentの承認は、対象のdigestを含まない承認ボタンであり、workflow_dispatchの入力（run id・key・digest）が、チャットで人間が承認した対象と同じだという照合の手順が無い。 | 書込みworkflowが、C12の操作計画（またはその同等の記録）を受け取り、承認した対象とdispatch入力のkey・3つのdigestが一致することを書込み前に確かめる、と明記する。rollbackPlanDigestの扱い（公開済みを消さず宣言を前のkeyに戻す手順）も、操作計画にどう入れるかを書く。environmentの承認とチャットの承認のどちらが正かも決める。 | Resolved (reviewer) |
| R-02 | Major | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u5-fixed-guest-build/infrastructure-design/cicd-pipeline.md > Permissions and Rollback（buildのworkflowは `contents: read` だけ）、infrastructure-specification.md > Environments | buildのworkflowを `contents: read` だけにするという記述が、NFR設計D6の要件と食い違う。buildの最初に行う同じworkflowのrunの実行中・待機中の確認（busy検査）はAPIでrun一覧を読むため `actions: read` が要り、権限を明示したworkflowでは他の権限は付かない。また書込みworkflowが別のrunのartifactを取得するにも `actions: read` が要る。この2つの読取り権限が、どの権限一覧にも書かれていない。 | busy検査を行うjobと、別runのartifactを取得するjobに必要な最小の追加権限（`actions: read` など）を権限一覧に書き、`contents: read` だけという断定を直す。vivariumがpublicかprivateかを確かめ、結果に応じた権限を記録する。 | Resolved (reviewer) |
| R-03 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u5-fixed-guest-build/infrastructure-design/cicd-pipeline.md > Pipeline 順序3〜5 / infrastructure-specification.md > Environments | 順序3のPRのlint・試験と順序4の初回buildの間に、vivariumのmainへ取り込む手順が無い。workflow_dispatchの起動、mainのbuildだけに許すcacheの保存（D5）、environmentは、いずれもmain上のworkflowが前提になる。また、environmentを使えるbranchをmainに限る設定が書かれておらず、mainでないbranchのworkflowが承認後に `contents: write` で動く余地が残る。 | 順序3と4の間に、vivariumのmainへ取り込む手順と、その外部変更の承認を加える。environmentの設定に、deployment branchをmainに限ることを含める。 | Resolved (reviewer) |
| R-04 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u5-fixed-guest-build/infrastructure-design/cicd-pipeline.md > Pipeline 順序2 / monitoring-design.md > Metrics & KPIs | NFR設計から引き継いだMinor（`rustc -vV` と `rust-toolchain` の指定の比較がD1の番号付きの手順に無い）が、インフラ設計の側でも拾われていない。順序2の試験の一覧にも、監視の指標（imageのdigestだけ）にも、toolchainの版の不一致の拒否が入っていない。 | 順序2の試験に「imageの中のrustcが指定と違えば拒否」を加え、`rustc -vV` の記録と一致の確認を指標に入れる。 | Resolved (reviewer) |
| R-05 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u5-fixed-guest-build/infrastructure-design/traceability.json（NFR3.5）/ cicd-pipeline.md > Pipeline | NFR3.5（bump-upstream）の対応先がenvironmentの記述だけで、検証の工程が無い。`git ls-remote` による直接解決、PR情報を使わないこと、D1の確認を通してから宣言を更新することを確かめる試験が、順序2の試験にも順序4〜10にも入っていない。 | 順序2にbump-upstreamの解決・記録・拒否の試験を加え、traceabilityの対応先をその工程にする。 | Resolved (reviewer) |
| R-06 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u5-fixed-guest-build/infrastructure-design/infrastructure-specification.md > 末尾（費用）/ Resource sizing | 費用の記述が「未検証」だけで、見積りが無い。U1で約41分と分かっているので、baselineとfixのbuildと再利用の再起動で、標準のrunnerの分数がおよそどれだけ要るかは示せる。また、runnerのdiskの空きが足りないときの扱い（記録するだけで、止める条件が無い）も定まっていない。 | 分数のおおよその見積り（標準runnerで追加の費用が出ない前提を含め、確認する項目として）を書き、disk不足のときは取得の前に止める条件を加える。 | Resolved (reviewer) |
| R-07 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u5-fixed-guest-build/infrastructure-design/monitoring-design.md > Alerts | 通知の経路が「このチャット」だけで、CIがチャットの外で（定刻や他の人の起動で）失敗したときに誰が気づくかが無い。 | 手動起動のworkflowだけを前提とする、と明記する。または、失敗したrunをActionsの画面で確認する手順を加える。 | Resolved (reviewer) |
| R-08 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u5-fixed-guest-build/infrastructure-design/cicd-pipeline.md > Release write approval (C12) 手順4 | 手順4は「tagがまだ公開されていないこと」を確かめ、違えば失敗するとしている。しかしNFR設計D6は、同じkeyが公開済みのときは何も置かず公開済みの組を検証するだけとしており、失敗にするのか検証だけで成功にするのかが食い違う | 公開済みのときは、D6に従い書込みなしで公開済みの組を検証する分岐であることを書く（再現しないときは不合格を記録する） | New |
| R-09 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u5-fixed-guest-build/infrastructure-design/cicd-pipeline.md > Release write approval (C12) 手順5 | environmentの承認画面に入力のSHA256が出るという前提は、GitHubの動作として未検証である | Code Generationで画面の表示を確かめる項目に加える。出ない場合は、承認前に別の方法で入力を示す | New |

> R-01 Reviewer note: cicd-pipeline.mdの「Release write approval (C12)」で、ExternalOperationの計画、チャットでの計画SHA256の承認、jobでの入力SHA256・inputDigests・tag未公開の再確認が定まった

> R-02 Reviewer note: 権限表に `actions: read` が加わり、書かれていない権限はnoneと明記された

> R-03 Reviewer note: 順序3aでmainへのmergeと、environment・cacheの設定の承認が加わり、environmentはmainだけに限られた

> R-04 Reviewer note: 順序2の試験とmonitoringの指標に、rustcの版の不一致の拒否が入った

> R-05 Reviewer note: 順序2にbump-upstreamの試験が入り、traceabilityの対応先も更新された

> R-06 Reviewer note: 費用の見込み（約3〜4時間）と20GiBのdisk事前確認が加わった（どちらも仮の値で未検証と明記されている）

> R-07 Reviewer note: すべての起動を手動のworkflow_dispatchとし、失敗は起動した人が見ると明記された

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| traceability.jsonの照合（手作業） | NFR 16件すべてに対応先があり、NFR3.5とNFR8.1も更新された | IDはsecurity-requirements.mdと一致する |
| 検証ツール（validate-*） | 実行していない | 設計レベルのレビューで、動作は未検証 |

### Summary

1回目のMajor 2件とMinor 5件はすべて直っており、CriticalとMajorは残っていない。残るMinor 2件（公開済みのkeyの扱いの分岐、承認画面の表示の確認）はCode Generationで扱えるため、READYとする。
