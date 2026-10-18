# レビュー修正後のCI試行

## 実行結果（検証済み）

ユーザー承認後、専用bookmark codex/terrarium-migration-u2を修正commitへ移し、jj git push --remote origin --bookmark codex/terrarium-migration-u2をhost権限で1回実行。署名付与によりcommitが3664a88cからd9beae83ba98e5bffdd6ae3653e40da4f47612c1へ変わった。GitHub APIのverification.verified=true、reason=validを観測。

[run38438640770](https://github.com/Marukome0743/formicarium/actions/runs/38438640770)、attempt1、job115439127501。自動push triggerを1回だけ実行。追加push・手動rerunなし。

CI最終conclusion successをGitHub APIで観測。全回帰・coverage工程も成功。artifact11836212352、ZIP SHA 4a63b7d55bd3ff16f00ae098abbde60a851d83b6c755710272613da134b695c9一致。現在の277 sourceFiles全件、CI実head、manifest、packと独立local候補のSHAが一致した。全16files/1370realms、1201/1336lines＝89.89%、80%閾値維持。独立line-map再計算も一致した。

## 照合予定の実値

- sourceIdentity: e8a6105297897a01bf1d1b636d81b1c3c2078ef5d40cb78b3982b736e139725f。
- pack SHA256: c2d801b1f0abb8bac8aa619778844b8979a6c7ed9d69267fc58b4607c180a245。
- input manifest SHA256: d4152f484bf1cd1b32f11e0cb00bddb490cd8ada57801db15bf1b8f030a60a4f。
- 署名後headから新規local-preparationを実施し、上記source/pack/input SHAが先の検証済みlocal候補と一致。
- context: .artifacts/migration-session/ci-checkout/.artifacts/migration-session/ci-context-review-repair-signed.json。

待機processはgh run watchのexec session81616、ログ.artifacts/migration-session/review-repair-ci-watch.log。これは監視だけでrerunを行わない。CI成功後に独立照合script .artifacts/migration-session/verify-repair-ci-evidence.mjsを実行し、結果を保存してから再レビューする。

新sourceのCI/全回帰/coverageは検証済み。独立summary .artifacts/migration-session/ci-observed-38438640770.jsonのSHAは3b0d190609a1322a2c1d6b7bf41656ea7c981aaa9132284ee6ab59b53607d8d3。U2完了は再レビュー・canonical完了command承認後に確認する。旧CI成功は新候補へ流用していない。
