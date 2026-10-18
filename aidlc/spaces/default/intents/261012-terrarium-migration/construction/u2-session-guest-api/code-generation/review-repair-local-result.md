# U2レビュー修正のローカル結果

## 検証済み

fixtureToFsEntriesはsymlink自身のtarget解決中のみリンクをactiveとし、解決後にcaller suffixを別途解決する。有限な同じリンクの2回/3回再利用を許可し、自己参照・相互参照・parent-component loop・root escape・非directory parent拒否は維持。

- 修正前: Node24 --test --test-name-pattern='finite symlink reuse' tests/migration-session/fixture.test.tsは1失敗、INVALID_INPUT fixture symlink loop。
- 修正後: mise run build / typecheck exit0。fixture試験9件、全成功。
- 現在sourceから専用CI checkoutのinputs.bundle.json sourceFiles277件を正式inventory関数で再生成。資産19件・core bundle・source検査の境界を緩和しない。
- ci.js prepare-localは26-file packを作成しcheckout外consumerへinstall、全配布SHA一致。local-preparationとして記録し、CI acceptanceではない。
- 正式checkSessionCandidateとconsumerInputでmain source・pack・実guest・独立consumerの整合成功。
- CI入口試験10件、U2 Node44件、Chromium/Firefox/WebKitのU2 browser9件すべて成功。最初のbrowser試行はsandbox Mach port権限で起動前に9失敗。ログを保持し、同じ候補でhost権限再試行、9成功20.9秒。projectのworkers1/retries0を変更していない。

sourceIdentity: e8a6105297897a01bf1d1b636d81b1c3c2078ef5d40cb78b3982b736e139725f。
pack SHA256: c2d801b1f0abb8bac8aa619778844b8979a6c7ed9d69267fc58b4607c180a245。

ログ: .artifacts/migration-session/review-repair-local-verification.log / review-repair-browser-verification.log。前者の途中失敗を成功へ書換えていない。CI入口の件数は今回10件（途中のチャットで14件と述べたのは誤り）。

## push予定の具体的差分

専用jj checkoutのローカルcommit3664a88cb2ddd55b4f286a50dc4f7ed3cfa928fa、parent268b323d。

追跡差分4ファイル: runtime/guest-validation.ts、tests/migration-session/fixture.test.ts、mise.toml、ci/migration-session/inputs.bundle.json。生成JS2件も内容を同期済みだが、CIでは正式buildで再生成するため既存checkoutのignore規則を変更せずpush対象には加えない。mainのレビューmanifest91件は維持。AI-DLC本体は変更なし。

## 次の承認対象

専用checkout /Users/mutoakio/Documents/formicarium/.artifacts/migration-session/ci-checkout で以下を実行:

```sh
/Users/mutoakio/.local/share/mise/installs/jj/0.46.0/jj bookmark set codex/terrarium-migration-u2 -r 3664a88cb2ddd55b4f286a50dc4f7ed3cfa928fa
/Users/mutoakio/.local/share/mise/installs/jj/0.46.0/jj git push --remote origin --bookmark codex/terrarium-migration-u2
```

pushはhost権限で署名を維持し、GitHubの実head/Verifiedと自動起動するmigration-session-u2.ymlの1 runを確認する。手動再実行はしない。

## 未完了

新sourceの全consumer/probe/aube回帰・全realm coverage80%以上・統合CIは次のCI試行で確認する。旧CI89.88%を新候補の結果として扱わない。最新candidateのsourceCommitはlocal-preparation base + working inventoryであり、CIでは実push headから新規candidateを生成する。修正後再レビューとcanonical完了command承認も保留、U2完了未確定。
