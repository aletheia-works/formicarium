# 実行計画の確認

## Sources

`../requirements-analysis/requirements.md`、`../domain-design/components.md`、`../units-generation/unit-of-work.md` / `unit-of-work-dependency.md` / `unit-of-work-story-map.md`、`../contract-design/contract-summary.md`。9単位と契約は承認済み。初期試行とB1受入の開始条件、個別外部操作承認、main sessionの逐次検証を維持する。

## Q1: 共通APIの受入後に優先する経路

U1の初期試行→U2のSession/guest API→U3のinstall→U4のcommand/B1統合受入までは共通です。その後、依存関係が許す二つの経路のどちらを先に完結させますか？一回の設計・実装・検証を区切るBoltは、原則1単位とし動く成果を確認します。

A. 固定build→vivarium再現/互換→latestデモ→サイトを逐次進める。既存の再現互換と固定成果物の再利用というリスクを先に確認する（推奨、U5→U6→U7→U8）。
B. latestデモ→サイト→固定build→vivarium再現/互換を逐次進める。利用者向けデモの移管を先に確認する（U7→U8→U5→U6）。
X. Other (please specify)

[Answer]: A

どちらもU9の退役準備は両経路の受入後です。期限/予算の追加条件は既にないと回答済み。重いbuild/試験/計測を並行しない。個別公開承認をこの順番選択で代替しません。

## Q2: 共通検証コマンドの確定時点

既存taskには、今回の初期試行・固定build・再現・サイトを一括して検証する入口がまだありません。実装で入口を整備し、初回の単位完了確認前に、実行可能な共通検証コマンドを提示して承認を受ける進め方でよいですか？

A. 入口整備後、初回完了確認前に実コマンドを確認して確定する（推奨）。
B. 今使うコマンドを指定する。
X. Other (please specify)

[Answer]: A

## Assumptions & Open Questions

None.

Q2=A: 入口を整備した後、初回の単位完了確認前に実コマンドを提示し、人間の承認を受けてから確定する。

未検証のCORS/時間・容量、source存在、build再利用、外部権限は各単位の作業・停止条件として計画へ含める。全単位の検証コマンドは既存taskと今回新規試行の対応を調査し、別途実行前に確認する。
