# AI-DLC doctor設定修復

## 実施と観測

ユーザーのdoctor修復依頼により、U1の検証コマンド承認を保留したまま実施した。aidlc config --dry-run --verbose --harness codex --yes --force はcreate15/update167/merge2/preserve198/remove0/conflict0。旧hooks.json・AGENTS.md・.gitignoreを/private/tmp/formicarium-aidlc-config-repair-20261009へ退避後、正式なaidlc config --harness codex --yes --forceを実行しexit0。project 2.10.0から選択済みengineと同じ2.11.0へ更新。作業中intentを保持したとの公式出力を確認。生成ファイルの手修正や旧独自Pythonラッパーの復元、パッチ適用はしていない。

検証済み：aidlc config runtime --harness codex --check、aidlc config trust --harness codex --checkともclean。公式Stop登録はaidlc engine adapter codex continue-workflow。aidlc engine runtime compileは現intent runtime-graph.jsonを再生成。aidlc doctor --verboseは0 problems/3 warnings、framework integrity12 checks合格、runtime locks none leaked。native trust/runtime版差/ローカルhooks差分/runtime graph staleは解消。

## 残る注意と範囲

- reviewer-scope.dropsの2026-10-08の2行は当時dispatch recordがなかったことを示す。今回のU1正式レビューではレビュー前にrecordを作成、終了後削除する正規手順を実施済み。新しい同失敗は観測されていない。旧ログは保持し、doctorの24時間期限で自然に解消するものとして扱う。
- plan-approval-guard.dropsの2026-10-08の1行はaudit lock取得失敗。現在doctorはleaked locksなしで、今回の承認・review・Unit receiptsは正常記録済み。当時の競合原因は未検証であり恒久解消とは断定しない。旧ログは削除しない。
- continue-workflow heartbeatは27時間以上の未発火履歴。登録修復済みだが、通常の応答終了時に実際に発火するかは未検証。疑似Stop入力や保護機能の迂回で警告を消さない。必要ならCodex再起動後に公式Trust all手順を使い再確認する。
- aidlc記録の未コミット注意は作業コピーに記録があることを示し、設定不良ではない。jj statusはhost権限で確認済み、既存guest-pc.jsonl 1205848bytesの1MiB新規snapshot上限注意も保持。無関係な全作業のcommit/push、証拠削除、ignore追加、設定上限変更は実施していない。

## U1への影響

公式configは.gitignoreのAI-DLC管理ブロックを更新した（コメント整理、aidlc.settings.local.jsonの無視追加等）。製品・guest・coreを編集していないが.gitignoreはU1 source-manifestの対象である。読取り専用のcheckpoint statusでready=false、current artifact/source-bound terminal review evidence is requiredと確認。公式のrecovery review iteration2のコマンドが提示された。U1再開時はこの差分を正規の再確認へ含めてから検証コマンドを再提示する。U1承認・チェックポイント実行・工程進行・外部公開は行っていない。
