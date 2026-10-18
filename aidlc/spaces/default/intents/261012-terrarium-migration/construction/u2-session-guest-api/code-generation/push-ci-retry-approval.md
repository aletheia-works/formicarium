# 固定コアbundle対応：追加push・CI再試行の具体承認

## 検証済みの変更

専用branch codex/terrarium-migration-u2 の前head af87219fbf434d35a63decca12e6e08a2933194aに対する8file追加差分。ローカルSSH署名済み新headは **0037d1ec2071cb7be4a2d9820404c7ecf4c9dc3e**。まだ追加push/CI再試行をしていない。GitHubで新headのVerifiedはpush後に独立確認する。

1. 専用workflowのblink remote checkoutを削除し `node scripts/migration-session/ci-core.js ci/migration-session/inputs.bundle.json` に置換。
2. Git bundleの19番目のexact入力、新SHA blob、ci-core復元入口、prepareの固定core確認、2追加境界試験。
3. 既存Node build回帰で必要なpitchfork固定パッチを元byteで補完。コア/guestを再buildせず、blink.lock・a882/f006・品質閾値・固定試験を維持する。

Git bundleはv2、1ref a882fb2f3df14115b7e46f6812fb296eef5934d7 HEAD、complete history、前提objectなし。8,776,305bytes、SHA256 **939466d397658897730cf84d64581605b3aa27671da577626a72f50a71e5be04**。source/config/hooks/credentialを丸ごとコピーせず、Git object形式だけを復元。ローカルに現存するコミットと、必要なupstream f006a4fc6f9b8de9272504fdff0dbbe5ce5dc580を含む。ネットワークGit禁止、既存vendor上書き拒否、失敗時自分のstagingだけを削除。

入力全体:19 destinations/18 SHA blobs/92,633,542bytes。manifest SHA **4368adad907dc9413d2f0176167604394765ae25dd9f323854113ea71226fe3a**。source identity **6fa1faaabeed2e59755e298b59b36ca6195d4a571944c37dbecac75f816195d7**、277 entries。新local pack SHA **e68fec9379c70008dd43d4980bd756336b94297c1dd376f0e1aabbc3297a2ae0**、26files/16JS。CIは実headと新source inventoryで新packを作り、その実SHAを観測する。

## 実測

- main build exit0。専用checkout build/typecheck exit0。
- CI境界10/10、skip0、118.933541ms。core検査のmock Git試験を実復元の証拠とはしていない。
- 別の空ディレクトリへのraw bundle cloneと固定HEAD checkout、upstream差分・clean statusを確認。
- 新CI復元入口をvendorのない専用checkoutで実行、exit0。receiptのHEAD/upstream/bundle/manifest SHA一致、network=false、importedConfig/Hooks=false。core-restore.jsonの実時刻2026-10-13T11:30:28.805Z。
- 既存Node build/probe/aube28試験は、固定patch欠落を補完後28/28、skip0、11152.558583ms。初回27pass/1ENOENTの診断はcore-bundle-node28.logとして保持し、新成功はcore-bundle-node28-fixed.log。
- 同じ署名済み新headでprepare-local exit0。新pack、checkout外 `/private/tmp/formicarium-u2-ci-bundle-consumer-20261013-01` install、全26file SHA照合成功。context local-preparation、acceptancePassed=false、sourceCommitKind local-preparation-base-revision-with-working-source-inventory。

前のlight unit177pass/2known skip・tooling236passは従来の検証結果として保持。前の全realm89.88%も旧sourceの実測のまま。今回の実CI/全realm結果は未検証、U2受入は未完。

## 追加push・1回再試行の実コマンド

作業ディレクトリ `/Users/mutoakio/Documents/formicarium/.artifacts/migration-session/ci-checkout`、既存SSH agentへアクセスするhost権限で:

```sh
/Users/mutoakio/.local/share/mise/installs/jj/0.46.0/jj git push --remote origin --bookmark codex/terrarium-migration-u2
```

新pushで新headのworkflowを1回起動する。旧失敗run38389571348をrerunしない。追加dispatchや自動再試行をしない。

CIの実argv（toolchain準備・10境界試験の後）:

```sh
node scripts/migration-session/ci-core.js ci/migration-session/inputs.bundle.json
node node_modules/@playwright/test/cli.js install --with-deps chromium firefox webkit
node scripts/migration-session/ci.js prepare ci/migration-session/inputs.bundle.json "$RUNNER_TEMP/formicarium-u2-consumer-$GITHUB_RUN_ID-$GITHUB_RUN_ATTEMPT" .artifacts/migration-session/ci-context.json
node scripts/migration-session/ci.js verify .artifacts/migration-session/ci-context.json
```

verifyは承認済みcompletionの逐次suiteと全realm/80%条件を維持。fork専用branch・contents:read・ubuntu24.04・Node24.21.0/Bun1.4.2・1job最大360分・artifact1日保存のまま。結果artifactに巨大bundle/core/guestは含めない。費用設定や有料runnerを変更しない。

push後に実headとVerified、run/head/attempt/conclusion、artifact SHAを独立API確認する。失敗・未知状態は確認して止める。切戻しはrun cancel/専用branch削除（別途確認）。main・既公開版・lock変更・公開/tag/Release/PR作成は含めない。
