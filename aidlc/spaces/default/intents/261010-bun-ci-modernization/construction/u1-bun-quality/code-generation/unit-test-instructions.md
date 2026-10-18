# U1 Unit Test Instructions

## Runner and Commands

Bun1.4.2で依存導入し、Node24.21.0でnode:test consumerを実行する。mise taskは実装時にinstall-frozen/build/typecheck/checkへ対応づける。全てmain session逐次。

runner準備：bun install --frozen-lockfile、bun run build。

単位限定試験：
```sh
node --test --test-concurrency=1 .build/tests/tooling/bun-tasks.test.js .build/tests/tooling/quality-evidence.test.js .build/tests/tooling/candidate-inputs.test.js
```

生成先は既存tsconfig.tests.jsonに合わせ上記パスへ出力する。必要ならconfigのincludeを追加する。Nodeはmise管理実体を解決して使う。BunからNode固有flagを渡すことはしない。CI構文はactionlint .github/workflows/ci.yml .github/workflows/candidate-verify.yml。

## Cases and Test Data

DevelopmentTasks7件、QualityVerification7件。candidate供給は正常、missing、tampered、stale source、unknown member、symlinkの追加境界試験。固定小fixtureと一時directoryを使い、fake GitHub情報/producerとfake executorで許可判断を確認する。通常CIは公開権限なし。実CIの代わりとしてfake結果を報告しない。

## Consumer, Regression and Coverage

既存Node/browser consumerの単位担当testファイルを既存scripts/ci/run.tsの明示inventoryで実行する。新candidateでは既存9 required checksと固定第一者JS collectorを再利用する。command inventoryとfixture供給はStep8–9で検査し記録する。probe600秒/aube840秒、1worker/retry0、8probe、native一致、wasm1GB。coverage80%以上、未収集分母維持、全Worker/process/realm receipt必須。通常14件だけで全coverage成功とはしない。公開RCの旧証拠を新SHAの実CI証拠へ転用しない。

## Failure Handling

失敗・timeout・cancel・skip・入力不足は非成功。単位完了の検証commandは最初のcheckpointで承認を得る。ここにはproject-wide npm test/bun testを指定しない。実CIや外部資産転送の未承認時はローカル検証を行い、外部検証を未検証として保持する。
