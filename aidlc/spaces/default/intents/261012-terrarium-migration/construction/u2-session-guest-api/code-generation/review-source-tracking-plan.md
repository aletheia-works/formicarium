# 最終レビューの追跡対象整備

検証済み: CI run38393506506 attempt1成功、全realm coverage89.88%。最終レビュー要求は tests/package/pack.test.js がignore対象のため拒否された。フレームワーク変更なし。

提案: U2 source-manifest内の生成JS 39件を既存byteのままローカルjjで明示追跡する。source mapはbuild出力としてignoreを維持。コード内容・.gitignore・remote branchを変更せず、追加push/CIは不要。レビュー要求を再実行し、成功したら承認済み計画を続行する。失敗時確認のユーザー方針により承認待ち。

対象:

- `runtime/guest-validation.js`
- `runtime/lifecycle.js`
- `runtime/public.js`
- `runtime/session-port.js`
- `runtime/state.js`
- `scripts/migration-session/ci-core.js`
- `scripts/migration-session/ci-inputs.js`
- `scripts/migration-session/ci.js`
- `scripts/migration-session/completion.js`
- `scripts/migration-session/coverage.js`
- `scripts/migration-session/stage.js`
- `scripts/package/coverage.js`
- `scripts/package/stage-package.js`
- `scripts/release/inventory.js`
- `scripts/release/publication-cli.js`
- `scripts/release/publication.js`
- `scripts/terrarium/coverage.js`
- `tests/migration-session/ci.test.js`
- `tests/migration-session/completion.test.js`
- `tests/migration-session/consumer-input.js`
- `tests/migration-session/consumer.spec.js`
- `tests/migration-session/consumer.test.js`
- `tests/migration-session/fixture.test.js`
- `tests/migration-session/fixtures.js`
- `tests/migration-session/guest-validation.test.js`
- `tests/migration-session/playwright.config.js`
- `tests/migration-session/public.test.js`
- `tests/migration-session/reservation.test.js`
- `tests/migration-session/types-invalid.js`
- `tests/migration-session/types-valid.js`
- `tests/package/coverage.test.js`
- `tests/package/lifecycle.test.js`
- `tests/package/pack.test.js`
- `tests/package/public.test.js`
- `tests/release/publication-alignment-fixture.js`
- `tests/terrarium/coverage.test.js`
- `tests/terrarium/current-candidate.test.js`
- `tests/tooling/publication-alignment.test.js`
- `tests/tooling/publication-version.test.js`

実コマンド（main workspace、host権限）:

```sh
/Users/mutoakio/.local/share/mise/installs/jj/0.46.0/jj file track --include-ignored runtime/guest-validation.js runtime/lifecycle.js runtime/public.js runtime/session-port.js runtime/state.js scripts/migration-session/ci-core.js scripts/migration-session/ci-inputs.js scripts/migration-session/ci.js scripts/migration-session/completion.js scripts/migration-session/coverage.js scripts/migration-session/stage.js scripts/package/coverage.js scripts/package/stage-package.js scripts/release/inventory.js scripts/release/publication-cli.js scripts/release/publication.js scripts/terrarium/coverage.js tests/migration-session/ci.test.js tests/migration-session/completion.test.js tests/migration-session/consumer-input.js tests/migration-session/consumer.spec.js tests/migration-session/consumer.test.js tests/migration-session/fixture.test.js tests/migration-session/fixtures.js tests/migration-session/guest-validation.test.js tests/migration-session/playwright.config.js tests/migration-session/public.test.js tests/migration-session/reservation.test.js tests/migration-session/types-invalid.js tests/migration-session/types-valid.js tests/package/coverage.test.js tests/package/lifecycle.test.js tests/package/pack.test.js tests/package/public.test.js tests/release/publication-alignment-fixture.js tests/terrarium/coverage.test.js tests/terrarium/current-candidate.test.js tests/tooling/publication-alignment.test.js tests/tooling/publication-version.test.js
```
