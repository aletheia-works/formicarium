# U4 Unit Test Instructions

## Runner and Build

mainがmise管理のNode24/Bun実体を解決する。既観測Nodeは /Users/mutoakio/.local/share/mise/installs/node/24/bin/node、Bunは /Users/mutoakio/.local/share/mise/installs/bun/1.4.2/bin/bun。版番号を前提にせずmain実行時に実体/versionを確認する。正式buildは直接Nodeで node_modules/typescript/bin/tsc -p tsconfig.json、同 -p tsconfig.tests.json、.build/scripts/emit.js の順。生成.jsを直接編集しない。

## Scoped Tests

runner readinessとR-01 Red/Green：直接Node --test --test-concurrency=1 tests/terrarium/coverage.test.js。

U4新規層：直接Node --test --test-concurrency=1 tests/release/evidence.test.js tests/release/decision.test.js tests/release/collect.test.js。新規ファイルは承認後の実装対象で、現在存在すると主張しない。

変更したcollector回帰：直接Node --test --test-concurrency=1 tests/terrarium/adapter.test.js tests/terrarium/assets.test.js tests/terrarium/coverage.test.js tests/terrarium/acceptance.test.js。

package同一性と型：直接Node --test --test-concurrency=1 tests/package/pack.test.js tests/package/types.test.js（FORMICARIUM_CONSUMER=/private/tmp/formicarium-u1-consumer-v8、FORMICARIUM_CANDIDATE=.artifacts/u1-package-v8.manifest.json）。

## Fresh Coverage Commands

mainが実owner inputを照合しrecord/verification/coverage-input.jsonにout=.artifacts/u4-coverage-v1、site=/Users/mutoakio/Documents/terrarium/.vendor/site-formicarium-integration-2-bt、terrarium=/Users/mutoakio/Documents/terrarium、packageRootの実installed @aletheia-works/formicarium、U1 v8 tgzとU1 v11 reportの絶対path/SHAを記録する。直接Node scripts/terrarium/coverage.js prepare <input-json>。

直接Bun build .artifacts/u4-coverage-v1/terrarium/packages/terrarium/src/index.ts --outfile .artifacts/u4-coverage-v1/site/web/terrarium.mjs --format esm --target browser --define '__TERRARIUM_VERSION__="u3-coverage"'。承認後に追加する直接Node scripts/terrarium/coverage.js seal .artifacts/u4-coverage-v1 が実行copyを固定する。

FORMICARIUM_INPUTS_ROOT=/Users/mutoakio/Documents/terrarium/.vendor/formicarium-inputs-integration-2 を指定し、直接Node scripts/terrarium/coverage.js node .artifacts/u4-coverage-v1 <absolute-Bun>。browserは生成workspaceをcwdとして同input、TERRARIUM_BUN、TERRARIUM_SITE_DIRのabsolute instrumented site、PLAYWRIGHT_BROWSERS_PATH=/private/tmp/formicarium-playwright を指定する。直接Node /Users/mutoakio/Documents/terrarium/packages/terrarium/node_modules/@playwright/test/cli.js test --config playwright.formicarium.config.ts e2e/formicarium-terminal.spec.ts e2e/formicarium-iframe.spec.ts --workers=1 --retries=0。生成測定copyだけへ書き、外部ownerはread-only。最後に直接Node scripts/terrarium/coverage.js report .artifacts/u4-coverage-v1。

consumer6：TERRARIUM_ROOTとTERRARIUM_SITEを同owner root/BT site、browser cacheを指定し、直接Node node_modules/@playwright/test/cli.js test --config tests/terrarium/playwright.config.ts tests/terrarium/consumer.spec.ts --workers=1 --retries=0。

## Regression and Native Baseline

Nodeを逐次、exact filesで実行：直接Node --test tests/node/build.test.js tests/node/runner.test.js tests/node/probe.test.js、直接Node --test tests/node/aube-1645.test.js、直接Node --test tests/node/session.test.js tests/node/pitchfork-basic.test.js。

browserを逐次：直接Node node_modules/@playwright/test/cli.js test tests/browser/probe.spec.ts tests/browser/aube-1645.spec.ts tests/browser/pitchfork-basic.spec.ts --workers=1 --retries=0。指定回帰futex-deadline/page-fault-race/madvise-dontneedの実在するselection方法はrunner準備で確認し、その正確なargvをrecordへ保存する。baselineは bash scripts/native-baseline.sh pitchfork-basic --check-reproducible と既存aube/probe baselineの実bytes/取得元を照合し、必要なら既存対応commandを実行する。変更のないguestは再buildしない。

## Fixtures and Oracles

Standard：coverage修正5–8群、evidence7群、decision8群、collector7群。新規outとtmp fixtureでのみ改変を作り、元source/candidateを固定した測定copy/bundleの改変を検出する。旧receipt・旧out・正式owner証拠は不変。模擬承認と模擬公開済みRCを実承認・実公開に再ラベルしない。negative testは原因別エラーをassertし成功outputが残らないことを確認する。

## Coverage and Unverified Conditions

固定24ファイル、80%行coverage、未import分母維持、Node/Worker/3browser全realmとfresh executionIdentityを必須にする。U1同pack証拠は明示import。旧U3 80.56%は新sealの代替にしない。統合前CI/実RC受入れ/公開権限はローカル試験で代替しない。
