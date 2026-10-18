# 承認済み共通コマンドの実検証

## コマンドと観測

記録種別：observed-command-summary。main sessionで必要ホスト権限を使い、承認された次のコマンドを変更せず実行した。

`FORMICARIUM_PREFLIGHT_VERIFICATION=docs/results/terrarium-migration-preflight-evidence/verification-input.json FORMICARIUM_CANDIDATE=.artifacts/migration-preflight-baseline-package.manifest.json FORMICARIUM_CONSUMER=/private/tmp/formicarium-migration-preflight-consumer mise run migration-preflight-completion`

検証済み：exit0。build/typecheck成功、単体55pass/0fail/0skip（540.525166ms）、consumer189pass/0fail/0skip（16229.15325ms）、Node回帰28pass/0fail/0skip（10133.42875ms）。既存ブラウザ回帰33件の子プロセス成功後、固定packのcoverage Node収集・3ブラウザ99件が成功（99pass、8.9m、worker1/retry0）。coverage reportは982行中862行、87.78%、skipped0、1253realms、passed=true。

実証拠照合verifyFileまで成功した最終入力：`.artifacts/migration-preflight/completion-coverage-9e86fe76-cdcc-4289-bbe2-fea7e13cc466/verification-input.json`。同じディレクトリのcoverage-report.jsonを照合し、candidate SHA256は742e1c368bd913d786c6baa3c5d1e1e82cbc252e38e0cc78429f9f1098bc30caと一致。完了lockはfinallyで解放した。

## 境界

性能36行と実CI first/reuse proofは元証拠を再照合した。性能試行やCIの再起動は行っていない。証明書再登録なし。原試行source75e4adf0a51db8fcc1af25676d54fc81fa09efee、CI source b6921789c70cecf45635f1b22524dc8abf8698dbを保持する。実Safari・他アプリ負荷・実CI process group取消は未検証。独立レビューとU1受入はこれから行う。
