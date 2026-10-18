# 会話IDの復旧

## 原因（ソース確認済み）

インストール済み2.11.0の `aidlc-orchestrate.ts` の `engineChildEnv` は、解決済み会話IDを `AIDLC_SESSION_OVERRIDE` として子プロセスへ渡すが、優先する根拠 `AIDLC_SESSION_OVERRIDE_SOURCE` を渡していなかった。子プロセスの祖先照会が別の会話を返すと、`resolveInvokingSessionId` が拒否する。CLIでintentを選び直す操作は、この子プロセス環境の欠落を直さない。

## 使用する修正版

以前の承認済み隔離修正版 `/private/tmp/aidlc-session-fix-verified-v1/build/binaries/native/aidlc` を使用する。ソースの `engineChildEnv` は既存の `hookChildEnv` を使い、解決済みIDとsourceを対で渡す。インストール済みCLI・ハーネス・グローバル設定は変更していない。正式版への反映はこの復旧では未実施。

## 検証済み

- 2026-10-10: Bunで `t312-orchestrate-session-binding.test.ts` と `t-codex-helper-session.test.ts` を実行し、12 pass / 0 fail / 62 assertions。
- 試験用環境から会話変数を除去し、Bun実体をPATHに設定して実行。祖先プロセスの実検査はホスト権限が必要。sandbox内では祖先検査に依存する2試験が失敗したため成功とは扱っていない。
- 同修正版の `engine orchestrate report --stage reverse-engineering --result awaiting-approval` をこの会話から実行し、`Stage "reverse-engineering" is already awaiting approval; gate evidence revalidated.` を観測。
- 通常のインストール済み `aidlc` が直ったとは主張しない。後続の会話内操作は上記修正版を使う。
