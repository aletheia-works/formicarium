# Practices Evidence

## Sources Scanned

担当はaidlc-pipeline-deploy-agent。lead-only指示のためsupport contributionなし。ビルド／テスト、外部変更、memory promotion、状態更新は実行していない。

|ID|根拠|観測／適用|
|---|---|---|
|E1|AGENTS.md、memory/team.md、memory/project.md|jj、test-after、品質上限、公開承認、範囲制約は既存承認済み。team.mdの「リモートなし」「lintなし」「private0.0.0」は古い現況であり今回更新する。|
|E2|CodeKB code-structure.md / technology-stack.md / dependencies.mdのBun / CI focused scan|TypeScript authoring、生成JS、npm lock v3、開発ツール、公開executor/coverageの依存境界。古い本文は背景で未再検証。|
|E3|CodeKB code-quality-assessment.md / architecture.md / business-overview.mdの重点調査追記|軽量CI欠如、固定候補入力と公開拒否validator、既存consumer互換性、今回改善の事業範囲。Node完全除去を要求したとの解釈はしない。|
|E4|package.json、.github/workflows/verify.yml、publish.yml|検証済み（読取り）：Biome/typecheck/build/test scripts。verifyはforkのcodex/verify/**専用、npm ci・Node+Bun・360分。publishは固定版タグ、最小job権限と承認bundle。通常PR/main CIとは別。|
|E5|jj log -r 'main \| @' --limit 3 --no-graph --ignore-working-copy|検証済み（出力）：main/v0.1.0-rc.1は12a92eab。作業コピーは82b24c7a。現在の全worktree sourceが公開版同一とは扱わない。|
|E6|今回reverse-engineering/developer-scan.md、terrarium test-lint-check.yml / labeler.yml / lint-autofix-apply.yml、vivarium dependabot.yml|検証済み（読取り）：mise task lint、PR concurrency、SHA固定Action、metadata専用書込み、autofixのartifact/head照合、Bun/Actions更新。参考snapshotであり採用の承認や公式最新仕様の保証ではない。|
|E7|今回の人間の依頼と別開発の回答|通常CI/保守も対象、Bun/bun.lockを使う、兄弟repoと合わせる、既存RC作業とは別intent。再質問不要。|

## Interview Decisions

五分野のうちWay of Working、Walking Skeleton、Testing Posture、Code Styleの基準は既存承認・今回指示で成立。Bun最小経路は既存の段階的接続確認の適用案であり、新たな開発方式の変更を要求しない。

Q1回答C（人間の原文）：上記に加え、CI合格した小さい依存更新の条件付き自動mergeまで。

自動ラベル付け・依存更新PR作成・限定した整形修正push・条件付き依存更新自動mergeを実践案へ統合した。実装対象の判断であり、未信頼PRの実行境界や外部操作の既存承認を解除しない。質問ログ・回答ログは親オーケストレータが記録し、questions.mdの[Answer]: Cを読み取って統合した。

最終統合時のjj読取りrevision：82b24c7a7caa76f6e60f3f4ff63a30080cf6ecac（--ignore-working-copy）。これは読取り時のsnapshot識別であり、未snapshotの調査artifact全体の内容hashを保証しない。

## Uncertainty

- Bun版、node:test/worker_threads/process.execPath/flagsの互換性、lock移行後のoptional依存・integrity・install scripts・生成物同一性は未検証。
- npm OIDC executor、Action版、Dependabot Bunサポートなどの現行公式仕様は設計で一次資料確認する。兄弟repoコメントを仕様の証拠にしない。
- PR/main軽量checksの正確な対象、重い回帰とcoverage実行経路、write権限・token要否は後続設計で確定する。
- 公開RCのterrarium受入れとstable公開はこのstageの完了条件に代替しない。
