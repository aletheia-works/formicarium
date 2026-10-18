# Security Design — U4

## Context

設計案・未検証。PublicationBoundaryの既存署名/候補/gate/executorを維持し、U1の固定Bun・C2へ適合する。packaging単位なのでlogical-components/service SLA資料を増やさない。根拠は同単位NFR Requirements11件とC1/C2、現行publication-cli.ts/publication.ts/workflow.ts。

## D1: 信頼した検証jobと固定実行資産

verify/prepareは正しい公開repoのtag pushだけで開始し、contents/actions/checks readだけを持つ。固定Node/Bun、bun.lock frozen ignore-scripts、U1のbuildと公開gateを使う。開発依存のnpm ciを廃止する。npm11.19.0公開CLIの配布資産はこの無権限jobで固定registry URL・公開integrityを照合して取得し、Node用bundleと一緒に供給する。公開writerでnpm install/global install・Bun install・tsc・PR checkoutはしない。

検証した同tag sourceから、既存公開CLIを含むNode builtin依存の実行bundleと固定設定/入力manifestを作る。固定Bun生成後に信頼した固定Biomeで正規化し、同条件temp再生成との全bytes一致を検査する。U1/U2/U3は変更せず、U4の生成入口とtracked実行bundleを所有する。Nodeだけで起動できることを試験する。

npm CLIはnpm公式tarballのintegrityと版を信頼側設定に固定し、ライフサイクルを実行せず検証済み資産として転送する。writerはその既知のbin/npm-cli.jsをNodeで起動する。Bunへ公開executorを置換したとは扱わない。

対応：NFR1.1、NFR2.2。

## D2: ジョブ間の出所・bytesとC2の独立照合

verify後のwriterは同workflow/repo/tag/source/run/attemptの成功verify jobとproducerをGitHub APIから読み、期待artifactを独立照合する。artifactの出所と内容を両方検証し、PR作成artifact/外部run/古いattemptや同名producerを拒否する。bundle/設定digestはtag sourceの信頼した固定manifestへ照合し、artifact内の自己申告だけでは承認しない。

既存署名済み公開入力とcandidate tarballを再gateし、U1 publication-candidate C2 evidenceは独立観測したcheck inventory/run/attempt/workflow/toolchain/実artifact bytesに照合する。C2 evidence adapterは既存candidate/provenance/署名証拠を消費し、既存schemaを削除・改称しない。ordinary-ci用途、空/重複/欠落/未知producer/非successは即拒否。

入力archiveは既存256 MiB未満上限をstream取得中に強制し、metadata/manifestは8 MiB以内、artifact転送も有限timeout。固定URL/HTTPS、credential転送なし、許可外redirectなし。regular fileと安全pathだけを受け、symlink/parent/absolute/duplicate/.npmrcを拒否し、shellへ任意文字列を渡さない。展開member数/展開総bytesにも有限上限を定め、署名/実digestを照合してから実行資産を使用する。具体上限とfixtureはInfrastructure/Code Planで固定する。

対応：NFR1.2、NFR3.1、NFR4.1。

## D3: 将来版と版別承認

version/tag/dist-tagを単一の厳密判定へ集約する。stableは非負整数major.minor.patch（余分な先頭0なし）、RCはその版に `-rc.<正整数>` を付けた形式だけ。build metadata、他prerelease、range、不正文字、v重複を拒否する。tagは正確にv+version、stableはlatest、RCはnext。npm manifestとpublication request/候補のversionも完全一致。

triggerのtag filterを将来形式へ適合させても、それは許可を意味しない。gateはrepo・source・tarball SHA・版・tag・channel・environment・操作ごとの既存署名付き承認に完全一致する場合だけ通す。tag sourceの期待SHAとC2 sourceも一致させる。既存RC0.1.0-rc.1のfixtureを互換性確認に使っても、タグpush・再公開・dist-tag変更はしない。

対応：NFR3.2。

## D4: 最小権限・副作用1回と段階的失敗

publishだけrelease environment/id-token write、releaseだけrelease environment/contents write。両writerはsource固定のcheckout又は検証済み実行資産を取得し、依存導入/buildを禁止する。npm tokenは追加しない。setup-nodeのpackage-manager-cache=falseで公開job cacheを使わず、OIDC/secretはartifact/logへ出さない。

verify非successなら両writer非実行、publish非successならRelease非実行。既存gateは各writerの直前にも実行する。executorを注入する試験境界で正常publish/Releaseの固定引数と最大1回、各拒否で0回を確認する。write timeout/通信結果不明では再送しない。npm側の版とtarball integrity/provenance、GitHubのtagとassetを読取確認してから、必要なら人間がReleaseのみ等の復旧を判断する。公開成功と全工程成功を分ける。

対応：NFR2.1、NFR3.3、NFR5.1。

## D5: 品質証拠・有限実行・運用記録

固定第一者JS inventoryと全realm receiptsを既存candidate検証から継承し、80%境界を維持する。totalLines正数、coveredLines範囲内、分母全体/receipt digestを独立一致させる。missing/skipを成功へ変換しない。既存probe/aube/timeouts/oneworker/native/wasm/consumer設定を変更しない。ローカル検証はmainのみ逐次。

jobは現行30分上限を維持、tag単位concurrency cancel-in-progress=false。read retryだけ有限、writeはretryなし。記録は固定reasonとrepo/tag/source/run/attempt/tarball/入力digest・outcomeに限定し、tokenや任意PR本文を含めない。README公開節でBun/Node/npm用途、版別承認、必要checks・coverage、旧rc1-inputs維持、拒否/不明時の手順と未適用設定を明記する。

対応：NFR4.2、NFR5.2。U3Major2件は同レビューに残し、U4修正で保守運用が可能になったとは記録しない。

## Verification and Alternatives

実公開なしのfake executorと実gate/C2 adapter、改変archive/identity/coverage/承認、Node無依存起動、bundle再現、workflow静的検査をCode Planに含める。実GitHub CI/OIDC/registry操作と当該candidate80%全realmは別の検証証拠が必要。

writerで依存導入/buildする現行方式はNFR2.2を満たさないため採らない。Bunだけの公開、ordinary-ciでcoverage代用、artifact自己申告allow、無条件tag公開も採らない。既存公開CLIの入力署名・tarball/provenance検査は再利用する。

## Assumptions & Open Questions

None. artifact supplyの具体設定・サイズ上限・job/check producer IDは次のInfrastructure Designで定義し、未設定は拒否として記録する。
