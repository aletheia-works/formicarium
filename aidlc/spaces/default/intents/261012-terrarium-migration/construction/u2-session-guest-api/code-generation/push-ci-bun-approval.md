# Bun実行ファイルの明示：ローカル検証と追加push承認

検証済み: setup-bun直後にcommand -v bunで実絶対パスを取得し、絶対パス・実行可能・改行なし・実version 1.4.2を検査してGITHUB_ENVへBUN_EXECUTABLEを登録するworkflow stepを追加。変更はworkflowとsourceFiles SHA更新の2ファイル、10追加/1削除。固定core SHA、toolchain、試験・coverage条件は維持。

検証済み: workflowのrun本文をそのまま抽出しbash -euo pipefailで実行、exit0。実パス /Users/mutoakio/.local/share/mise/installs/bun/1.4.2/bin/bun、version1.4.2、環境ファイル登録を確認。

検証済み: 固定Node24.21.0/Bun1.4.2とBUN_EXECUTABLE指定で、専用checkoutの node scripts/ci/tasks.ts test-light がexit0。今回CIで失敗した11件を含むtooling236件がpass236/fail0/skip0、31607.134209ms。既知release入力skipを含むunit部分も成功。CI境界は10/10、skip0、107.8735ms。

検証済み: 署名済み新head 268b323d96bfbcd2eb2fe0e03d5941eedc033871 のprepare-localがexit0。独立consumer /private/tmp/formicarium-u2-ci-bun-consumer-20261013-01 へ26ファイルpackをinstallしSHA照合成功。manifest SHA a79383c154d16b6f990e007f66c38eda89763961e2fd35fe815b362f40083dcf、sourceIdentity 93e5957fccb5e862c13f8f1f56a10e97699ee64214004b9ce9a9f7d77f6f17de。context local-preparation、acceptancePassed=false。新CI/全realm完了は未検証。

専用bookmark codex/terrarium-migration-u2 を新headへ設定済み。remoteは前head0037d1ecのまま。追加push未実施。GitHub Verifiedはpush後に確認。

## 承認対象の実コマンド

作業ディレクトリ /Users/mutoakio/Documents/formicarium/.artifacts/migration-session/ci-checkout、既存SSH agentへアクセスするhost権限で実行:

```sh
/Users/mutoakio/.local/share/mise/installs/jj/0.46.0/jj git push --remote origin --bookmark codex/terrarium-migration-u2
```

このpushで新headの専用workflowを1回起動する。旧runのrerunや追加dispatchは行わない。

CIのrun本文は次の通り（固定toolchain setup後）:

```bash
bun_executable="$(command -v bun)"
[[ "$bun_executable" = /* && -x "$bun_executable" && "$bun_executable" != *$'\n'* && "$bun_executable" != *$'\r'* ]]
bun_version="$("$bun_executable" --version)"
[[ "$bun_version" = '1.4.2' ]]
printf 'BUN_EXECUTABLE=%s\n' "$bun_executable" >> "$GITHUB_ENV"
printf 'Verified Bun executable: %s\nVersion: %s\n' "$bun_executable" "$bun_version"
node scripts/ci/tasks.ts install-frozen --cacheless
node scripts/ci/tasks.ts build
node scripts/ci/tasks.ts typecheck
node --test --test-concurrency=1 tests/migration-session/ci.test.js
node scripts/migration-session/ci-core.js ci/migration-session/inputs.bundle.json
node node_modules/@playwright/test/cli.js install --with-deps chromium firefox webkit
node scripts/migration-session/ci.js prepare ci/migration-session/inputs.bundle.json "$RUNNER_TEMP/formicarium-u2-consumer-$GITHUB_RUN_ID-$GITHUB_RUN_ATTEMPT" .artifacts/migration-session/ci-context.json
node scripts/migration-session/ci.js verify .artifacts/migration-session/ci-context.json
```

Bun登録と各nodeコマンドはworkflowでは別step、GITHUB_ENVで後続stepへ渡す。既存の逐次試験と全16配布JS coverage80%以上条件を維持。fork専用branch、contents:read、1job最大360分、artifact1日保持。push後は実head・署名・run/attempt/conclusion・artifactを独立確認する。失敗時は確認。成功後は承認済み計画を続行する。
