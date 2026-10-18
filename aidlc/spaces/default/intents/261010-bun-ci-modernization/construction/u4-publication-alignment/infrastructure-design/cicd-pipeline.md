# CI/CD Pipeline — U4

設計・未検証。既存公開CLIの署名・candidate/provenance gateを保持し、通常CIとは独立したpublication-candidate C2を消費する。

## Stage → Gate

| Stage | Permissions | Gate | Output |
|---|---|---|---|
| verify/prepare | contents/actions/checks read | repo/tag/source・固定Bun/lock・既存署名入力・C2独立観測・80%全receipt | 再現bundle/config、固定npm資産、candidate digest |
| publish | contents/actions/checks read、id-token write、release environment | 成功verifyの同run/attempt/producer/実artifact＋trusted tag manifest再照合、既存gate再実行 | npm操作最大1、stable latest / RC next |
| release | contents write、actions/checks read、release environment | publish成功、同出所再照合、既存承認gate | GitHub Release最大1、RC prerelease |

## Sequential Flow

1. 正しいrepoのtag pushを取得。strict stable major.minor.patch、RC -rc.正整数とv+version一致を検査。他形式拒否。既存RCを再実行しない。
2. readonly jobで固定Node/Bun、bun.lock frozen ignore-scripts、U1 build。固定Bun bundleを固定Biomeで正規化しtemp再生成全bytes一致。公式npm固定URL/SHA512を検証取得、ライフサイクルなし。
3. 入力URL/SHA、署名、版/repo/source/tarball/channel/environment/操作別承認を検査。C2 adapterはrun/attempt/workflow/checks/producer/実bytesを独立API照合し固定第一者inventoryと全realm receipt80%を要求。空/重複/不足/偽/stale/非success/ordinary-ci拒否。
4. 上限付きarchiveに実行資産を保存。writerは固定tag sourceの期待manifestとGitHub API digest/成功verify job/同run attemptを再検証し、署名済み公開入力も再gate。検証前に取得assetを実行しない。
5. publishはNode/npm固定CLIだけを使用し、固定argvで最大1回。依存導入・build・PR checkoutなし。失敗ならreleaseを起動しない。
6. releaseは同資産の再gate後、版対応Releaseを最大1回。正常系でも操作ごとの既存承認が必要。今回の実装承認から外部公開承認を推定しない。

## Test Automation

mainから逐次5tasks、対象release/C2/version/取得境界/実workflow構造/Node builtin起動/bundle再現試験。正常fixtureは実tracked設定を必ず読み、writerなしで正しい候補を許可することを確認。拒否はfake executor0回、正常argv最大1回。改変/不足coverage/空checks/古いattempt/偽producer/unsafe archives/limits/未承認/不明結果再送なしをTesting Contractへ固定する。actionlintとNode/browser consumer互換確認を維持。既存probe600秒/aube840秒/1worker/no retry/8項目/native一致/1GiB capを緩めない。実CI/OIDC/公開候補全realm80%はローカル成功と別記録。

## Promotion, Secrets and Rollback

canary/blue-greenはpackage公開に適用なし。RC next→将来stable latestはそれぞれ独立のcandidate/署名承認/タグで実行する。旧RCやrc1-inputsブランチを変えない。npm長期tokenを新設せず、Trusted Publisherの既存repo/publish.yml/release対応を前提として再確認する。GitHub tokenは用途最小権限、cache=false。

公開結果unknownは再送禁止。registry版/tarball integrity/provenance/dist-tagsとGitHub tag/assetsを読取照合し、部分成功を記録して人間が復旧操作を承認する。自動unpublish/tag変更/旧版上書きはしない。readonly HTTP retryは最大2回かつ120秒内、write retry0回。source rollbackだけで公開済みpackageを戻せたとは扱わない。

## External Readiness

producer/workflow ID、artifact redirect許可host、environment保護とOIDC、実CIの同attempt artifact取得は未検証。値未設定はfail closed。push/外部設定/公開は別承認。U3レビューMajor2件は別単位に残る。本資料は保守自動化の稼働を証明しない。

