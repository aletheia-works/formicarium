<!-- AI-DLC keeps this copy in step with aidlc/spaces/default/memory/project.md. Edit that file; this copy is replaced. -->
# Project-Level Rules

> Project-specific specialisation and corrections. Loaded after `org.md` and
> `team.md` as strict-additive guidance; contradictions with broader policy
> are rejected. Populated by practices-discovery and the self-learning loop.
>
> Use sparingly: most teams don't need a project layer. Reach for it
> only when this specific project needs stable, durable guidance beyond the
> team practice (for example, package-specific release checks or an additional
> regression suite for a legacy component).

## Way of Working

<!-- Project-specific specialisation. Example: -->
<!-- This monorepo requires package-scoped branch names and a package owner -->
<!-- review in addition to the team's normal merge policy. -->

## Walking Skeleton

<!-- Project-specific specialisation. Example: -->
<!-- The walking skeleton must exercise the legacy service adapter as well -->
<!-- as the new service boundary. -->

## Testing Posture

<!-- Project-specific specialisation. -->

## Guard Policy

<!-- Project-specific. Mode: strict, relaxed, or off. Strict here holds for every intent and cannot be changed from chat. A section under the retired Change Control heading, written by an earlier release, is still read. -->

## Deployment

<!-- Project-specific specialisation. -->

## Code Style

<!-- Project-specific specialisation. -->

## Tech Stack

<!-- Technology choices locked for this project. -->

## Decided

<!-- Decisions made in earlier stages that should not be re-asked. -->
<!-- Format: DECIDED: [decision] (Stage [slug], [date]) -->

## Scope Overrides

<!-- Custom scope rules for this project. -->

## Forbidden

<!-- Populated by practices-discovery affirmation gate. -->
<!-- Format: NEVER [behavior] (affirmed [date]) -->
<!-- Example: NEVER throw exceptions across service layer boundaries (affirmed 2026-05-17) -->

- NEVER git/sl/mise exec または mise shim をリポジトリ作業・直接ツール実行の代わりに使用する。（人間の指示） (affirmed 2026-10-06)

- NEVER ゲストのソースが変わっていない aube を Build and Test のために再ビルドする。（既存承認済み project.md Corrections） (affirmed 2026-10-06)

- NEVER 品質基準やタイムアウトを緩めて検証を通過させる。（人間の指示） (affirmed 2026-10-06)

- NEVER C fork の JIT 作業を、人間が再開を指示していない状態で提案する。（人間の指示・ADR 0002） (affirmed 2026-10-06)

- NEVER 公開リポジトリ作成・push・publish を現時点で実施する。公開対象確認と必要な人間の承認前に外部公開しない。（人間の既存指示。公開予定そのものの禁止ではない） (affirmed 2026-10-06)

- NEVER 指摘外の改善や全体整形を同じ修正へ追加する。（人間の指示） (affirmed 2026-10-06)

- NEVER PowerShell の実行ポリシーを変更してスクリプトを実行する。（人間の指示） (affirmed 2026-10-06)

## Mandated

<!-- Populated by practices-discovery affirmation gate. -->
<!-- Format: ALWAYS [behavior] (affirmed [date]) -->
<!-- Example: ALWAYS use Result<T,E> for fallible operations in service layer (affirmed 2026-05-17) -->

- ALWAYS リポジトリ操作には jj を使い、PowerShell の @ はクォートする。（人間の指示：AGENTS.md） (affirmed 2026-10-06)

- ALWAYS mise 管理ツールは版番号を固定せず実体を解決し、宣言された task は mise run で実行する。（人間の指示） (affirmed 2026-10-06)

- ALWAYS 正しさの主張にコマンド出力・テスト名・具体的なログを添え、検証済み／ドキュメント根拠／推測を区別する。実行できていないものには未検証と書く。（人間の指示） (affirmed 2026-10-06)

- ALWAYS ビルドとテストは main session で一つずつ実行し、性能測定は重い並行負荷のない状態で行う。（人間の指示） (affirmed 2026-10-06)

- ALWAYS probe 600秒、aube ブラウザ840秒、1worker、retryなし、8項目合格、native 出力一致、wasm 1GB とブラウザ Worker の delete Atomics.waitAsync を維持する。（人間の指示） (affirmed 2026-10-06)

- ALWAYS コア固有の知識は runtime/core.mjs に限定する。（人間の指示・ADR 0003） (affirmed 2026-10-06)

- ALWAYS 変更の範囲を指摘された範囲に限定する。（人間の指示） (affirmed 2026-10-06)

- ALWAYS レビューへの返信は5行以内とし、反論は投稿前に人間の確認を得る。（人間の指示） (affirmed 2026-10-06)

- ALWAYS fork を編集する前に jj new を行い、パッチの写しを patches/ に残す。（人間の指示） (affirmed 2026-10-06)

## Corrections

<!-- Project-specific corrections from human feedback. -->
<!-- Format: NEVER/ALWAYS [behavior] (learned [date]) -->
- Q5 の「blink は使わない」は Rust 版 blink を別リポジトリで作る構想の話で、この PoC は既存の blink（fork）で進めると Q7 で確定した。formicarium の PoC は jart/blink の fork を使い、Rust 版 blink は別リポジトリで並行開発して将来コアを置き換える構想である。 (learned 2026-10-03) <!-- cid:261003-blink-wasm-poc:requirements-analysis:932db38f30e1b889404fbec314fbcb0d4ea9f773eb23050b6898f72ad4d9e10c -->
- Build and Test では、ゲストのソースが変わっていなければ aube を再ビルドせず、コード生成で作った dist/guests を使う（aube v2.6.1 のビルドは 1 時間以上かかるため）。probe は変更があれば再ビルドする。 (learned 2026-10-05) <!-- cid:261003-blink-wasm-poc:build-and-test:0757b59635388c1df6be41ad35d29ae823731e286ec78def71bc455ac175ee7b -->
- Minimal 戦略でも、Build and Test では結合・性能・セキュリティの手順書をすべて作る。この PoC のテストは実質的に結合テストで、性能計測（FR6）と取得元の安全確認（マルウェアが混入した fork の回避）は記録しておく価値があるため。 (learned 2026-10-05) <!-- cid:261003-blink-wasm-poc:build-and-test:33b0dc6992ff1de8e63c907eabcf30d1fc74f0d5903a661bad62b6c63fa8159f -->
- pitchfork v2.29.0 は musl 向けにそのままではコンパイルできない（src/supervisor/lifecycle.rs:1219 の libc::ioctl の request が c_ulong、musl は c_int）。型だけを直す 1 行のパッチ patches/pitchfork-2.29.0-musl-ioctl.patch を当てる（人間の判断で「ソースは変更しない」をこの 1 行だけ緩めた。terrarium も同じ行を直している）。 (learned 2026-10-06) <!-- cid:261005-pitchfork-on-blink:code-generation:445d6697ac6ca85a44a701d00d1d38795feaae00e4c4f648f2b84d267a3b9cb7 -->
- wslc が E_FAIL で動かないときは FORMICARIUM_CONTAINER=docker で Docker に切り替える。基準値とパス調査は同じ busybox イメージ・ネットワークなしで行い、作り直した aube の基準値に差分がないことで条件が同じことを確かめる。 (learned 2026-10-06) <!-- cid:261005-pitchfork-on-blink:code-generation:e4b5559e791fff374c02391497100e18107e7180982c91fa7d015a67d912dd4a -->
