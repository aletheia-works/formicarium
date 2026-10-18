# Functional Design Questions — U2

## Context and Ambiguity Analysis

追加質問は0件。判定を共有してpush/merge入口を分ける回答、直接dev依存更新1件、整形差分の完全再現、拒否時の副作用0回は承認済み要件で確定している。allowlist・入力上限・reasonコードは技術設計で定義する。ユーザーの新しい回答を作成しない。

契約レビューで受け入れ済みの必要checks共通集合に関する指摘は残る。U2は契約の共通集合を緩めず、整形前のlint失敗でも拒否する安全側の動作を設計する。整形専用check集合へ変更したとは扱わず、U3の統合時にこの運用制約を明示する。

## Corner Sweep

入力の欠落・不正型・重複・未知版は拒否。空整形差分だけは全共通検査成功後にno-op。0/1/2直接依存変更、version分類、パス表記・root逸脱、古いhead、偽producer、部分成功を設計へ反映する。ネットワーク、保存、credential、書込み競合はU3所有でありU2には導入しない。
