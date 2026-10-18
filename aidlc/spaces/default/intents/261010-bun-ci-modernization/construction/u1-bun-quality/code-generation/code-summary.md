# U1 Bun and Quality CI Code Summary

## Implementation

Bun1.4.2・Node24.21.0を固定し、package-lock.jsonをtext bun.lockへ移行。84依存のname/versionを維持した。frozen installはignore-scripts必須でcacheless対応。Node固有runtime・公開APIは維持する。

package.json/mise.toml、scripts/ci/tasks.ts、quality-evidence.ts、commit-format.ts、ordinary-receipt.ts、candidate.ts、install-modernization-inputs.py、ci.yml/candidate-verify.yml、README、tooling3試験を追加・変更。既存run/verificationへ旧入口を保持したvalidator injectionを追加。runner-readyは削除済みnpm lockの検査をBun JSONCへ移した。既存release7ファイルとprobe試験の整形/import順だけを修正し通常CIの既存lint失敗を解消した。source-manifestに生成JSも含める。

通常CIはPR/main、readのみ、固定Action SHA、固定lock cache、有限timeout、同一PR/ref concurrency。ci-requiredはdependency jobの非成功を伝播し、自分の未完了結果を成功証拠へ記録しない。U3がAPIから最終checks/producer/runを取得する。候補入口は旧RCのverify/publish/固定入力を変更せず、別の公開repo・branch dispatchと新入力変数を使う。

Source reviewはauthoritative TS/config/lockをsource-manifestへ列挙し、Git-ignoredの生成JS/.buildはverification/generated-artifacts.jsonへ別記する。初回review要求はignored .buildをsource evidenceに含めたため拒否され、authoritative sourceとcompiled build artifactの対応を訂正した。

## Observed Verification

検証済み：clean/cacheless frozen導入成功、manifest mismatch拒否、lock無変更、84解決版一致。型検査・build・lint・actionlint成功。軽量179件中177pass/既存skip2/新規fail0、tooling20pass/skip0。実Node API/Worker13pass、独立導入した新Bun tarballのNode consumer11pass、Chromium/Firefox/WebKit consumer33pass、1worker/retry0。実SafariではなくWebKitである。

新private candidateは24fileの全inventory/digest照合成功。tarball SHA256 05bd48611997918a90e4fe40ff751dc7fe722f0ab90d3222de0f64826190b0fb。隔離jjのsource aa9c974b7cab564d5a824f3aecedd99428d481c7に188source・1373入力を固定し実preflight成功。入力は検証済み既存core/guest/owner供給をdigest照合して再利用、package tarball/manifest/導入内容は新候補へ置換。重い回帰とcoverageは実行していない。

## Limits and Handoff

未検証：当該sourceの実GitHub CI、固定24第一者JS全realmのcoverage80%、重いnative/browser回帰、初期main trusted-base validator導入。これらは統合前の必須条件であり軽量結果から合格とは扱わない。外部push/変数設定/dispatch/main統合は未実施。外部承認後に新archive URL/SHAと新sourceでcandidate-requiredを実行する。旧RC、tag、dist-tag、rc1-inputs branchは保持。

rootへの選択反映は既存未統合差分を保持し、miseのframework latestも維持した。隔離candidateはpublic main baseのみから作成し、rootの歴史差分を外部公開候補へ含めない。コード計画の意味変更はない。信頼済みbaseにcommit validatorが無い初回CIは安全側で失敗するため、bootstrap導入を外部操作の承認対象として提示する。

契約の受け入れ済み指摘（整形とmergeの必要checks区分）はU2/U3へ引継ぎ、U1で解消済みとは扱わない。Infrastructureの供給契約不足は具体manifest・入力・preflightで下流具体化し、旧traceability形式指摘は旧承認資料を改変せず保持する。
