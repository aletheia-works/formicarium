## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-10-18T01:29:04Z
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u7-showcase-guests/nfr-requirements/security-requirements.md > NFR5.3 | showcaseが使うnpm pack tarballの調達元が決まっていない。「同じcommitから作った」とあるだけで、B1受入が固定したtarballをそのまま取得するのか、U7のCIが再buildするのかが読み取れない。再buildなら、SHA256が一致するにはtarballがバイト単位で再現できることが前提になるが、その合格条件がない。日次buildのcommitがB1受入のcommitより進むと、配布は`packSha256`不一致で常に拒否される。 | tarballの調達元を明記する。B1受入のartifactを取得して`packSha256`を照合するか、再buildするなら再現性の条件を要件にする。日次buildでmainがB1受入commitより進んだ場合の扱い（配布しないことを正常な失敗として記録するか）も書く。 | New |
| R-02 | Major | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u7-showcase-guests/nfr-requirements/security-requirements.md > NFR3.4 および tech-stack-decisions.md > Decisions「source build」 | source buildの出所要件が不足している。patch以外に、Cargo.lockの固定（`--locked`）、rustc版、dependencies、builderHashをbuild-infoに記録する要件がない。C07の`buildKey`にはこれらが入る。Rustは「upstreamの`rust-toolchain`に従う」とあるが、現行terrariumはupstreamのwrapperを避けて自前のRustで作っている（`latest-tool-builds.md`）ため、どちらに従うかが食い違う。pitchforkのUIに使うNode・aubeが「upstreamのbuild設定に従う」対象か「最新版にする」対象かも未確定で、「Node・Bunは最新版」と矛盾しうる。 | NFR3.4に、Cargo.lock固定、rustc版・dependencies・builderHashの記録、取得元と版の固定を追加する。UIのbuildに使うNode・aubeの扱いを、検証対象のbuild設定として確定する。 | New |
| R-03 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u7-showcase-guests/nfr-requirements/security-requirements.md > NFR3.1 | 受理するrepositoryは「設定にある3つ」とされるが、許可リストが検査対象のPRで変更できる設定dataそのものである。fork PRでは、設定とその許可リストを同時に変えて別repositoryのsource buildを起動できる。secretや書込み権限は使えないため影響はCI資源に限られ、候補はmainのレビューを経なければU8に渡らない。 | 許可するrepositoryの一覧を設定とは別に固定するか、PRのCIでsource buildを走らせる条件を制限する。または、設定の変更をレビュー必須としてCODEOWNERS等で守る方針を要件にする。 | New |
| R-04 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u7-showcase-guests/nfr-requirements/security-requirements.md > NFR4.1 | source buildの期限は契約の4hで、現行terrariumのjob timeoutは180分である。PRごとに最大4時間のbuildが走りうるが、費用と並行実行の扱い（NFR8.2の「新規費用は事前に相談」）との対応が書かれていない。 | PRで走らせるときのjob timeoutと、費用の上限・並行実行数の扱いを記録する。 | New |
| R-05 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u7-showcase-guests/nfr-requirements/security-requirements.md > NFR3.3 | C09の`ShowcaseCandidateManifest`は`resolvedTools[].source`と`elfSha256`しか持たない。要件が記録するとした資産URL・最終URL・digest・attestationを、manifestのどこに置くかが書かれていない。 | 追加の記録を、manifestの付加fieldに置くか、acceptanceLogに置いてそのdigestを`acceptanceLogSha256`で参照するかを明記する。 | New |

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| traceability.json の形（verification.md と手で照合） | 形は適合 | `upstream_ids`はNFR1–NFR8の8件、`coverage`も同じ8件。NFR1とNFR7が`N/A`で理由があり、他は`OK`でtargetがある。unit-of-work-story-mapのU7担当（NFR2・3・4・5・6・8）とも整合する。 |
| 契約・出典の照合 | 一致 | NFR3.5の上限値はC11（DL128MiB、展開256MiB、4096entry、4h、120s）と一致する。NFR5.1のcandidateId入力はC09、NFR2.2の12行はC10 U8 profileと一致する。 |
| 移管元（terrarium）の照合 | 一致 | `latest-tool-builds.md`と`build-latest-guests.yml`の`contents: read`・draft/prerelease除外の記述は、各artifactの主張と整合する。 |
| sensors（required-sections・upstream-coverage・linter・type-check） | 未実行 | ワークフローがゲートで実行する。この審査では手で確認した範囲のみ。 |

### Summary

主張は上流の契約と移管元の記録に概ね裏付けられており、traceabilityも完全だが、Majorが2件ある。tarballの調達元と再現性（NFR5.3）、およびsource buildの出所要件（NFR3.4）が不足しており、実装時に判断が割れる。READYの基準（Criticalなし、Major 2件以下）は満たすが、この2件はゲートで修正を検討すべきである。
