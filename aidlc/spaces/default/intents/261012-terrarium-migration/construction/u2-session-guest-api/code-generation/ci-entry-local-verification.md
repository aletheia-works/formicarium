# CI入口のローカル検証（2026-10-13）

検証済み: main の `mise run build` / `mise run typecheck` はexit0。`node --test --test-concurrency=1 tests/migration-session/ci.test.js` は8/8、skip0、125.456042ms。独立jj checkout `.artifacts/migration-session/ci-checkout` は remote main `567799f5a9e36755c40f7d477a414974362e55e8` の新規変更として準備した。

検証済み: checkoutでBun1.4.2の `install --frozen-lockfile --ignore-scripts` は57packages、exit0。checkoutのmise実行は信頼設定保存がsandbox外で拒否されたため、CIと同じ `node scripts/ci/tasks.ts build` / `typecheck` へ変更し両者exit0。後者はNode/Bunのmise実パスをPATH先頭へ指定した。checkoutで `node --test --test-concurrency=1 tests/migration-session/ci.test.js tests/migration-session/completion.test.js` は14/14、skip0、271.949417ms。

検証済み: 実入力18件は17SHA256blobへ重複排除、83,857,237bytes。mirror metadataの転送コピーだけ `mirror.entries[].file` を公開originalUrlへ置換し、元記録・assets/provenanceは変更していない。build後のsource inventoryは274件。元のfull completionの89.88%は旧source identityの実証として保持し、新CI入口の完了証拠へ置換しない。

失敗（検証済み）: checkoutで次の実準備を実行しexit1。

```text
/Users/mutoakio/.local/share/mise/installs/node/24/bin/node scripts/migration-session/ci.js prepare-local ci/migration-session/inputs.bundle.json /private/tmp/formicarium-u2-ci-local-consumer-20261013-01 .artifacts/migration-session/ci-context-local.json
```

`npm pack --ignore-scripts` が既定 `/Users/mutoakio/.npm/_cacache/tmp/…` への書込みで `EPERM`。npmの「root-owned」という診断文だけで所有者問題とは断定しない。sandboxでは既定キャッシュは書込み範囲外である。実consumerとcontext出力が残っていないことを確認した。生成途中のcandidateは診断用であり成功扱いしない。

未検証: 実入力からのpack/独立consumer準備成功、実CI、署名push、U2受入。push/CIは実行していない。再試行案は `npm_config_cache` をcheckout内の `.artifacts/migration-session/npm-cache` へ限定し、local candidateのsourceCommitKindをlocal準備に整合し、再build/typecheck・境界試験・prepare-localを行うこと。失敗時確認の指定に従い、Retry/Skip/Abortを記録して確認待ちとした。

## 専用キャッシュ指定後の再試行

人のRetryを記録後、CI prepare/verify双方でnpm_config_cacheをcheckout内の `.artifacts/migration-session/npm-cache` へ固定した。local用sourceCommitKindは `local-preparation-base-revision-with-working-source-inventory`、実CIの表記は別のまま。

検証済み: main build exit0、checkout build/typecheck exit0、CI境界＋completion試験14/14・skip0・349.779375ms。実入力prepare-local exit0、26files/16JSの新pack作成とcheckout外 `/private/tmp/formicarium-u2-ci-local-consumer-20261013-02` へのinstall・全file SHA照合成功。contextはlocal-preparation、acceptancePassed=false、基底head567799f5a9e36755c40f7d477a414974362e55e8。input manifest SHA aa0fdee449abafc9d4aec4f1097a9bdf5173f006a1256c2e07302bc01acca4e8、source identity4ab8e22819046094d5f204a7d5eeb3ad43856bc2046ff1d2f7b6bf3e2b033375、pack SHAe68fec9379c70008dd43d4980bd756336b94297c1dd376f0e1aabbc3297a2ae0。

追加検証の失敗（検証済み）: checkoutで `node scripts/ci/tasks.ts test-light` を実行しexit1。publication-version等の固定fixtureが `.github/publication/trusted-policy.json` をreadFileしENOENT。この固定ファイルはmainに存在するがCI準備helperがbootstrap/runner/runner-manifestの3件しかコピーしていなかった。依存列挙の漏れであり公開policy拒否ではない。作業領域内キャッシュを用いており前回cache問題は再現していない。軽量回帰の全成功・実CIは未検証。

固定依存ファイルを元の内容で補完し、回帰・source inventory・prepare-localを再検証する案をRetry/Skip/Abortで記録した。公開policyを変更・緩和しない。署名push/CI試行は未実行。

## 依存補完後の成功（最新）

人のRetry後、trusted-policy.jsonを元byteで補完し、stage source inventoryへ追加した。試験の依存読取りも確認し、同じコピー漏れがあった `.github/maintenance/{policy.json,label-rules.json,runner.mjs}`、maintenance/pr-labels workflow、renovate.jsonを元byteで補完。guest.rsも固定fixtureとして保持した。公開・保守policyは緩和していない。依存補完中の診断ENOENTはtest-light-retry.logに保存し、その後のtest-light-fixed-dependencies.logを新成功証拠とした。

検証済み: 最終main/checkout build exit0、checkout typecheck exit0。test-light exit0、unit179件中177pass/2known release-input skips（3182.558125ms）、tooling236pass/skip0（29429.846125ms）。先行CI境界+completion14pass/skip0も維持。CIから未参照のローカル支援4fileはpush対象から除外し、182fileの差分一覧をpush-diff-final.txtへ保存。

ローカルSSH署名済みheadはaf87219fbf434d35a63decca12e6e08a2933194a（GitHub Verifiedは未検証）。新しいprepare-localを同headで実行しexit0。checkout外consumer `/private/tmp/formicarium-u2-ci-local-consumer-20261013-04` にinstall・26files/16JS全SHA照合成功。source identity e5cfa5e156cc8f547ffd16f1a9d0ab045589ea9b9bf0c5e1eda51d110b417d88、275source entries。input manifest SHA e09955cfd656e3d912e4c3c6618b3e539b9f0270cb1764310a88a00d48056523。pack SHA e68fec9379c70008dd43d4980bd756336b94297c1dd376f0e1aabbc3297a2ae0。記録はlocal-preparation、acceptancePassed=false、local-preparation-base-revision-with-working-source-inventory。署名済みheadへの専用bookmarkはローカルのみ設定した。

実CI/外部push/U2受入は未検証。push-ci-approval.mdで固定した署名pushと1回CI試行の具体承認を記録し、承認待ち。
