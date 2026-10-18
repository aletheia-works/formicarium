# U2 Planning Dispatch

Conversation language: Japanese

Lead: aidlc-developer-agent. Stage: code-generation, unit u2-maintenance-policy. PLAN ONLY. You own ONLY construction/u2-maintenance-policy/code-generation/code-generation-plan.md and unit-test-instructions.md under aidlc/spaces/default/intents/261010-bun-ci-modernization. No application changes, no build/test, no VCS changes before human Plan Approval. You are not alone; preserve all others' work. Main session owns builds/tests and lifecycle; do not next/report/park/state route or ask approval yourself.

Read .codex/aidlc-common/stages/construction/code-generation.md and your required knowledge. Read current U2 functional-design/{entities.md,rules.md,functional-spec.md}, nfr-requirements/{security-requirements.md,tech-stack-decisions.md}, nfr-design/{security-design.md,logical-components.md}, infrastructure-design/cicd-pipeline.md. Shared inception/contracts: contract-design/contract-summary.md (C1/C2/C3), units-generation/unit-of-work.md (U2 pure MaintenancePolicy), requirements-analysis/requirements.md (FR6/FR7,NFR1–5). Paths relative to same intent.

Use root U1 foundation; possible isolated development workspace /private/tmp/formicarium-bun-ci-u1 later, main publicbase12a92eab. Source paths proposed scripts/maintenance/{policy.ts,input.ts,evidence.ts}, tests/tooling/maintenance-*.test.ts; inspect actual root TS/build/task structure read-only. Existing U1 source files frozen by completed review, changes to its test-light integration need explicit plan and accounting; avoid editing U1 owned files if existing glob already includes new tests. No workflow/API/client/credentials/newdependency. Tests 5–8 per logical layer or complete refusal table, meaningful contract fixtures not empty stubs. FR6/FR7 full failure boundaries and raw parse result/independent evidence adapter integration mandatory. Accepted common required-check limitation persists; don't silently split sets.

Ceremony: {sensors:on,learnings:on,summary_confirmation:off,plan_approval:on,collaborators:off}; protocol_modules reviewer,ensemble,construction,learnings; gatefalse; autonomous routinecompletion but planapproval human. Diary engine-owned memory.md never handedit. Write summary3lines Builds/Touches/Tests, numbered checkbox steps with FR/NFR mapping, runner-readiness first, then each layer implementation→test (test-after). Include exact scoped generated-JS Node test command, expected80% fixeddistribution coverage remains separatewholeacceptance, mocked immutablefixture guidance. Rendered Testing Contract block below must be copied verbatim in plan. Return paths and short readiness summary, do not implement.

Write and edit files yourself with your file tools, never through the shell (no heredoc, no `echo`, `printf`, or `python3` writing a file, no `sed -i`, no `mkdir`; the file-write tool creates any missing folder). A command the person asks for, or one the plan names (a package install, a build, a scaffolder, a migration, a formatter, a code generator, even a `mkdir`), still runs as written. Read, list, and search (your own knowledge files included) with your file tools where you have them; where the shell is your only way to read, use one plain read command (no `cd` before it, no pipe or second command after it). Run every AI-DLC command exactly as written, as a command of its own (no `cd` before it, no pipe or second command after it), keeping its path as written (never a full path): a shell line can stop and ask the person to approve it.

## Delivered Testing Contract

## Testing Contract

```json
{
  "version": 1,
  "methodology": "test-after",
  "source": "team",
  "ordering": "通常の実装は各テスト可能な層の実装後にテストを作成・実行し、不具合修正は再現テストの失敗を観測して修正後に同じテストの成功を確認する。",
  "scope": "classic",
  "test_strategy": "standard",
  "project_type": "brownfield",
  "applicable_notes": [
    {
      "layer": "org",
      "text": "We treat tests as a first-class deliverable in every Bolt. The specific\nmethodology (TDD, BDD, ATDD, or classic test-after) is affirmed at\npractices-discovery and recorded in `team.md` under this heading with explicit\n`Methodology` and `Ordering` fields; Code Generation resolves those fields\nindependently from coverage, tooling, and scope notes.\n\nWhen no posture has been affirmed, our default per scope is:\n- **Methodology**: test-after\n- **Ordering**: implement each applicable testable layer, then write and run\n  that layer's tests.\n- `mvp`, `enterprise`, `feature`, `infra`, `classic` add an 80% line-coverage\n  floor and CI execution before merge.\n- `bugfix`, `security-patch` add a targeted regression for the specific\n  bug/vulnerability and require the existing suite to remain green.\n- `express` uses the Minimal strategy: requirement-driven unit tests (one per\n  requirement, with a happy-path floor per component); existing tests remain\n  green.\n- `poc`, `refactor`, `workshop` add no extra new-test floor and require the\n  existing suite to remain green.\n\nThe active `Test Strategy` still applies in every scope and determines test\nvolume/types. Scope floors are additive; they never reduce or replace the\nselected strategy.\n\nBuild and Test verifies defined coverage floors and affirmed quality targets;\nthey may not be weakened to make a step pass.\n\nAffirm a stricter posture in `team.md` if the team commits to one."
    },
    {
      "layer": "team",
      "text": "- **Methodology**: test-after\n- **Ordering**: 通常の実装は各テスト可能な層の実装後にテストを作成・実行し、不具合修正は再現テストの失敗を観測して修正後に同じテストの成功を確認する。\n- ビルドとテストはmain sessionで逐次実行する。Node向けconsumer、Worker、process.execPath、Node専用flagの意味を確認し、Bunへ一括置換しない。Bun実行を採る箇所は実結果で互換性を確認する（未検証）。\n- 既存Biome・TypeScript・Playwright・node:testを証拠として使う。通常PR/main CIは固定候補入力を要求しない軽量経路から整備し、重いnative/ブラウザ回帰・配布coverageは別の明示経路へ対応づける（提案）。軽量CI成功だけで全受入れを通過したと扱わない。\n- 統合前CIと第一者配布JS固定一覧の行coverage80%以上を維持する。未収集ファイルを分母から消さず、Worker/別process/realmも記録し、欠落・skipを成功へ置換しない。\n- probe600秒、aubeブラウザ840秒、1worker、retryなし、probe8項目合格、native出力一致、wasm1GBを維持する。未変更aubeは再ビルドせず、計測時に重い処理を並行しない。新規コア回帰はnative Linuxでも確認する。実機Safariは未検証のまま区別する。"
    }
  ],
  "obligations": {
    "strategy": "standard",
    "strategy_volume": [
      "Five to eight tests per component.",
      "Unit tests plus integration tests for key boundaries.",
      "Add E2E, performance, or security tests when requirements demand them."
    ],
    "scope_floor": [
      "Keep the existing test suite green.",
      "This scope adds no extra new-test floor beyond the selected test strategy."
    ],
    "combination_rule": "Apply every selected-strategy obligation and every scope-floor obligation; neither replaces the other, and a targeted scope regression may add the narrowest necessary test type beyond the strategy default."
  },
  "plan_profile": {
    "methodology": "test-after",
    "runner_step": "Verify the existing test runner/configuration and record the exact unit-scoped command.",
    "runner_ready_before_first_test": true,
    "testable_layers": [
      "Data model / database behavior",
      "Repository / data access",
      "Business logic",
      "API / endpoint",
      "Frontend behavior"
    ],
    "steps": [
      "Project structure and production configuration skeleton.",
      "Verify the existing test runner/configuration and record the exact unit-scoped command.",
      "Data model / database behavior - implement.",
      "Data model / database behavior - write and run its tests after implementation.",
      "Repository / data access - implement.",
      "Repository / data access - write and run its tests after implementation.",
      "Business logic - implement.",
      "Business logic - write and run its tests after implementation.",
      "API / endpoint - implement.",
      "API / endpoint - write and run its tests after implementation.",
      "Frontend behavior - implement.",
      "Frontend behavior - write and run its tests after implementation.",
      "Environment/build configuration.",
      "Documentation and traceability."
    ]
  },
  "input_sha256": "sha256:c174dde61b23d97d1733ad98b91568ee85c7de913db166d498965b6845a4c286",
  "contract_sha256": "sha256:10b6f50c2e853225a46984ab35ccfb615ca938fd59f89dd0c81174ba91834d14"
}
```


## Verbatim Steering Bundle

### aidlc/spaces/default/memory/org.md

# Org-Level Rules

> Framework defaults. Read with `team.md` and `project.md` from the active
> space. The resolver loads every applicable layer; narrower layers add
> specialisation and must not contradict broader policy.


### aidlc/spaces/default/memory/org.md

## Way of Working

We use **trunk-based development**. All work merges to `main` via
short-lived feature branches (typically resolved within 1-2 days).
Long-lived branches accumulate merge debt; we avoid them.

For Construction worktrees, the worktree base branch is `main` and the
merge target is `main`.

If our project requires multiple environments (staging, production), we
still keep one trunk and gate releases via tags or environment-specific
deployment configs — not via long-lived release branches.

We **squash-merge** Bolt branches into `main`. Each Bolt becomes one
commit on the trunk, named by the Bolt slug, with the full Bolt commit
history preserved on the source branch until the worktree is discarded.

Squash gives us a clean linear `main` history that maps 1:1 to
delivery-planning's Bolt sequence. We accept the trade-off of losing
intermediate commits on `main` because the audit log preserves the full
event sequence anyway.


### aidlc/spaces/default/memory/org.md

## Walking Skeleton

When practices are scope-dependent, select the walking skeleton only when the
active scope declares `skeleton: on`. In checkpoint-enabled solo work with a
non-empty Unit DAG, the first Unit is the smallest working integrated slice.
Run it through all applicable per-unit stages, including Code Generation, before
later Units even if stage-major was selected. Verify it with the intent's recorded,
human-authorized Construction Verification Command, which must demonstrate the
project's real end-to-end result, then require the human's skeleton checkpoint
approval. A first design-stage review does not demonstrate a working skeleton.

For `skeleton: off`, skip the skeleton ceremony: no bootstrap checkpoint; offer
the explicit Construction choice at entry. For skeleton-on, offer it after the verified,
human-approved skeleton. Follow `construction_policy.offer_autonomy`; never
repeat a recorded choice. **Continue automatically** records `autonomous`;
**Review each checkpoint** records `gated`. On-demand requests can grant or
revoke autonomy during Construction. Ordinary completion approvals follow that
choice; Plan Approval, summary confirmation, verification command selection,
and failures remain human stops.

Existing workflows without `Construction Checkpoints` retain their legacy
first-stage and late stage approvals. Team-owned Unit gates retain their own
policy; no Unit DAG means no skeleton checkpoint ceremony.


### aidlc/spaces/default/memory/org.md

## Testing Posture

We treat tests as a first-class deliverable in every Bolt. The specific
methodology (TDD, BDD, ATDD, or classic test-after) is affirmed at
practices-discovery and recorded in `team.md` under this heading with explicit
`Methodology` and `Ordering` fields; Code Generation resolves those fields
independently from coverage, tooling, and scope notes.

When no posture has been affirmed, our default per scope is:
- **Methodology**: test-after
- **Ordering**: implement each applicable testable layer, then write and run
  that layer's tests.
- `mvp`, `enterprise`, `feature`, `infra`, `classic` add an 80% line-coverage
  floor and CI execution before merge.
- `bugfix`, `security-patch` add a targeted regression for the specific
  bug/vulnerability and require the existing suite to remain green.
- `express` uses the Minimal strategy: requirement-driven unit tests (one per
  requirement, with a happy-path floor per component); existing tests remain
  green.
- `poc`, `refactor`, `workshop` add no extra new-test floor and require the
  existing suite to remain green.

The active `Test Strategy` still applies in every scope and determines test
volume/types. Scope floors are additive; they never reduce or replace the
selected strategy.

Build and Test verifies defined coverage floors and affirmed quality targets;
they may not be weakened to make a step pass.

Affirm a stricter posture in `team.md` if the team commits to one.


### aidlc/spaces/default/memory/org.md

## Guard Policy

<!-- Mode: strict, relaxed, or off. Strict here holds for every intent in this space and cannot be changed from chat. A section under the retired Change Control heading, written by an earlier release, is still read. -->


### aidlc/spaces/default/memory/org.md

## Deployment

We **deploy on merge** to staging environments. Production deploys gate
on a separate manual approval — typically tech lead + product owner
sign-off in CodePipeline or a CD platform's environment protection.

Teams that have invested in test coverage and observability sometimes
graduate to continuous deployment to production (every commit
auto-deploys); that's a team decision, not a framework default.


### aidlc/spaces/default/memory/org.md

## Code Style

We defer to project-level configurations:
- Formatter: Prettier (JS/TS), Black (Python), `gofmt` (Go), or
  language-default. Configured in repo root (`.prettierrc`,
  `pyproject.toml`, etc.).
- Linter: ESLint, Ruff, golangci-lint, etc. Run in CI before merge;
  failure blocks the PR.
- Naming conventions: language idiomatic (camelCase for JS/TS,
  snake_case for Python, etc.). No project-wide rename rules unless
  team affirms one.

When the framework makes a code-style suggestion, agents read the
project's linter config first; the agent's suggestion only fires if the
linter doesn't already cover it.


### aidlc/spaces/default/memory/org.md

## Forbidden

<!-- Things agents must never do -->
<!-- Example: Do not ask questions about topics already decided in previous stages -->


### aidlc/spaces/default/memory/org.md

## Mandated

- **Conversation language — resolution**: Every artifact a person reads or reviews is written in the workflow's established conversation language. The orchestrator resolves that language from the human's substantive prose and MUST state it as a `Conversation language: <language>` line in every delegated brief, because a delegated agent or reviewer never sees the conversation and some stages hand it nothing else (a greenfield run of a stage whose `consumes` are all `conditional_on: brownfield` reaches its lead with no upstream artifact at all). Delegated agents and reviewers resolve the language in this order and stop at the first source that answers: (1) the `Conversation language:` line in your brief — AUTHORITATIVE for delegated work, because the orchestrator regenerates it on every dispatch from the live conversation and it is therefore never staler than a persisted rule; (2) an explicit conversation-language rule in `aidlc/spaces/<active-space>/memory/project.md` — the FALLBACK for a brief that states no language, and the ONLY file a language switch is ever persisted to, so `project.md` ALWAYS outranks a conversation-language rule in `team.md`, which can only ever be a team default and NEVER the record of a switch (cross-file position is NOT recency: the runtime rule chain concatenates `org → team → project → phase`, so `team.md` reaches you before `project.md` in every bundle no matter which was written last, and the winner is this stated precedence rather than the later position); within `project.md`, when it carries more than one conversation-language rule the LAST one under `## Corrections` is the current one (this tie-break governs conversation-language rules ONLY and leaves the additive rule model untouched; the learnings write path appends and never replaces, so a superseded language rule can still be on disk); (3) the verbatim initial description decoded from `<record>/project-description.json`, falling back to `## Project Information` → `**Project**` in legacy records, when it carries a real language signal (not the `[Project description]` placeholder, not a bare identifier or path); (4) any artifact or draft you were handed — the directive's `consumes[]` contracts, the artifact you were dispatched to review, or the lead draft you were dispatched against. Every source is readable on every harness: the rule bundle carries (2) through the dispatch-rules hook on Claude, Codex, and opencode and through always-included agent resources or workspace steering on Kiro, and neither `aidlc-state.md` nor the handed artifacts fall inside the per-unit reviewer read-scope bound.
- **Conversation language — stability**: The established conversation language holds for the whole session, and inside that session for every stage, dispatch, reviewer pass and approval gate of the workflow — nothing but a session boundary ends it. A turn that carries no language signal never changes it — `Approve`, `Looks correct`, an option letter or number, pasted code, a quoted error or stack trace, a bare file path or identifier. Only an explicit human request to switch languages changes it, and that switch takes effect IMMEDIATELY: everything written from that point follows the new language, and the orchestrator states the new language in the `Conversation language:` line of every subsequent delegated brief. Persistence is a separate, later step and never the activation step: the §13 learnings ritual is the ONLY sanctioned write path for persisting a conversation-language switch into `aidlc/spaces/<active-space>/memory/` and it is human-gated, so NEVER edit a memory file directly to record a switch — a direct write skips the tool's audit event, its duplicate key, and its admission conflict-check, and "do not wait for persistence" is never licence to bypass that gate (this bounds the persistence of a language switch and forbids a direct agent edit; it does not govern the deterministic memory writers a stage invokes by contract, such as `aidlc-state.ts practices-promote`, which own the stamped `## Mandated` / `## Forbidden` rules and the five replaced `team.md` sections rather than the `## Corrections` language record). When `directive.ceremony.learnings` is `off`, no language-switch persistence happens and no direct memory edits replace the ritual; the current session still uses the new language. When the enabled `learnings` protocol module offers it, the switch is recorded as a single-line rule under `## Corrections` in `project.md` and NEVER in `team.md`, so the cross-file precedence in (2) never has to arbitrate one switch against another; when the human declines, it is simply not persisted, and the `Conversation language:` line the orchestrator states in every brief carries it for the rest of the session. A session boundary is where that carrier ends, and a workflow outlives it: the resume context the engine injects at session start carries scope, phase, stage, status, agent and next action but NO language, so on the FIRST turn of a new session the orchestrator MUST re-resolve the language before it dispatches anything — the persisted rule from (2), else the human-readable artifacts this workflow has already produced, which record the language the human was last served in, else the verbatim initial description from (3) — and when every one of those is silent it ASKS the human rather than defaulting to English. Re-resolving is not a switch: it is never announced as one and never persisted as one. An unpersisted switch therefore does not outlive its session, which is exactly what persistence buys — a human who wants a switch to survive a resume accepts the ritual, and a human who declines is served correctly for the rest of the session and re-resolved from disk in the next one. A persisted rule NEVER outranks the brief, and never outranks a later explicit human request to switch: it is the fallback for a brief that states no language, and because the learnings write path appends rather than replaces, a superseded language rule can outlive the switch — the LAST conversation-language rule under `## Corrections` is the current one.
- **Conversation language — what to localize**: Write in the resolved conversation language every artifact a person reads or reviews — requirements, user stories, plans, specs, reviews, questions, discovered practices, affirmed team and project rules, evidence, decision rationale, and any other explanatory prose — and the agent's own human-facing conversational output in every turn, for the orchestrator and delegated agents alike: conversational chat messages, status updates, progress reports, and transitional narration between tool calls. Structured-question `prompt`, `header`, `options[].description`, and free-text follow-ups are human-facing prose and follow the same rule; only `options[].label` literals the protocol spells verbatim are preserved tokens. This includes the descriptive text of a rule shaped as `ALWAYS …` / `NEVER …`, where the leading marker is a fixed token but the sentence it introduces is not. A Markdown artifact is not English merely because a tool parses part of it: localize the prose that surrounds a preserved token. Verbatim human input echoed into an artifact is always kept exactly as the human wrote it.
- **Conversation language — preserved tokens**: Any literal a stage file or the stage protocol spells in backticks and tells you to write exactly is a fixed token — keep it English, character for character, and localize only the prose around it. This covers option labels and sentinel VALUES, not just syntax: `[Answer]:` tags with their option letters, the mandatory final option `X. Other (please specify)`, the assumption-confirmation options `A. Accept assumptions` / `B. Convert to follow-up questions` (the engine compares the filled answer against the literal), the `None.` / `None` sentinels under `## Assumptions & Open Questions` and `## Positions`, the `AGREE:` / `OBJECT:` position prefixes, and the `**Collaborator:** <agent-slug>` first line the engine matches exactly before it accepts a stage. Glossing such a literal when you PRESENT it to the human is fine; what you WRITE into an artifact is the literal itself. Also preserved: the source-register tags `[desc]`, `[scope]`, `[assumption]`, `[Q<n>]`, `[memory:M<n>]` with their literal prefixes (`Initial description:`, `Workflow-selected scope:`); the H2 headings the claim-sources sensor matches verbatim (`## Sources`, `## Assumptions & Open Questions`, `## Assumption Confirmation`, `## Review`) plus any other H2 taken from a stage template, which the `required-sections` sensor matches verbatim whenever a template is supplied (the framework ships none, so a team's `aidlc/spaces/<active-space>/memory/templates/` is what arms that check); the reviewer verdicts `READY` and `NOT-READY`; YAML keys and enum values inside fenced blocks (`units`, `name`, `kind`, `depends_on`, `service | spec | ui | packaging | library`); the field labels, status values, and checkbox states of `aidlc-state.md` and the audit shards; the verbatim initial description decoded from `<record>/project-description.json` (the `**Project**` state field is only its safe single-line preview); stable IDs (`FR-1`, `ENT-001`, `BR1.1`); enum and classification values; code and identifiers; file paths; mermaid keywords; and cross-references.


### aidlc/spaces/default/memory/org.md

## Corrections

<!-- Self-learning loop appends here. -->
<!-- Use team.md to record team-wide additions and project.md for
     project-specific specialisation. The loader resolves org → team →
     project at session start and retains every applicable rule. -->

### aidlc/spaces/default/memory/team.md

# Team-Level Rules

> This team's affirmed practices and corrections. Loaded after `org.md` as
> strict-additive guidance; contradictions with broader policy are rejected.
> Populated by the practices-discovery affirmation gate. Edit at the gate,
> not directly.


### aidlc/spaces/default/memory/team.md

## Way of Working

- 私たちはローカルの履歴、bookmark、fetch、pushにjjを使い、mainを統合先とする。短命の作業bookmarkをレビュー後に統合し、判断の記録を残す。mise管理の実体を解決し、宣言taskはmise runを使う。
- Bun移行と通常CI・保守workflowの整備は、既存のnpm/terrarium公開作業とは別intentで進める。受入れ中の公開RC、そのタグ、固定入力を変更しない（人間の回答）。
- 公開先mainは12a92eabであり、以前の「リモート未作成」は過去の状態として扱う。現在の作業コピーを公開済みsourceと同一と推定しない。


### aidlc/spaces/default/memory/team.md

## Walking Skeleton

- 既存のNode/ブラウザ公開API・Worker・wasm配置を基盤に、Bunで依存を固定導入し、型検査・ビルド・軽量テストまで動く最小経路を最初に確認する（提案・未検証）。
- Bunによる開発手順の変更だけでNode利用者への互換性を保証したと扱わない。npm tarballのNode/ブラウザconsumer確認と配布資産確認を維持する。全面的なruntime置換は既存指示から導かない。


### aidlc/spaces/default/memory/team.md

## Testing Posture

- **Methodology**: test-after
- **Ordering**: 通常の実装は各テスト可能な層の実装後にテストを作成・実行し、不具合修正は再現テストの失敗を観測して修正後に同じテストの成功を確認する。
- ビルドとテストはmain sessionで逐次実行する。Node向けconsumer、Worker、process.execPath、Node専用flagの意味を確認し、Bunへ一括置換しない。Bun実行を採る箇所は実結果で互換性を確認する（未検証）。
- 既存Biome・TypeScript・Playwright・node:testを証拠として使う。通常PR/main CIは固定候補入力を要求しない軽量経路から整備し、重いnative/ブラウザ回帰・配布coverageは別の明示経路へ対応づける（提案）。軽量CI成功だけで全受入れを通過したと扱わない。
- 統合前CIと第一者配布JS固定一覧の行coverage80%以上を維持する。未収集ファイルを分母から消さず、Worker/別process/realmも記録し、欠落・skipを成功へ置換しない。
- probe600秒、aubeブラウザ840秒、1worker、retryなし、probe8項目合格、native出力一致、wasm1GBを維持する。未変更aubeは再ビルドせず、計測時に重い処理を並行しない。新規コア回帰はnative Linuxでも確認する。実機Safariは未検証のまま区別する。


### aidlc/spaces/default/memory/team.md

## Guard Policy

<!-- Affirmed by the team. Mode: strict, relaxed, or off. Strict here holds for every intent and cannot be changed from chat. A section under the retired Change Control heading, written by an earlier release, is still read. -->


### aidlc/spaces/default/memory/team.md

## Deployment

- 私たちはBunとbun.lockを開発依存管理の基準へ移行する（人間の指示）。導入版、frozen導入、install scriptの許可、cache鍵とCI/ローカルのtask対応は設計・実行で確認する。現状はpackage-lock.jsonとnpm ciであり、移行成功は未検証。
- publish.ymlに加え、通常CIと保守workflowを整備する。兄弟repoのlint/typecheck/test/build、Actions/Bun依存更新、PR情報整理の構成を参考にし、Terraform/Pages/JSR等の対象外機能はコピーしない。
- @aletheia-works/formicariumのnpm公開とGitHub Releaseは版ごとの人間の承認後に行う。Bun開発導入とnpm OIDC公開executorの採否は独立に検証し、改変・不足証拠を公開開始前に拒否する既存境界を維持する。
- RCはnext、stableはlatestを計画の基本とする。既存RCのlatest維持は当該公開への人間の個別決定であり、今回変更しない。不具合時は追加公開を止め既知の版へ誘導する。
- workflowの最小権限、信頼したAction参照、未信頼PRからの公開拒否、source/pack SHA・固定入力・provenance・noticesの対応を確認する。通常CIに公開権限を渡さない。
- 私たちは自動ラベル付け・依存更新PR作成、条件を限定した整形修正push、CI合格した小さい依存更新の条件付き自動mergeを設計・実装対象とする（人間のQ1回答C）。自動mergeは対象・除外・main保護・必要checksを明示する。整形pushは対象ファイル、fork、権限、実行済みheadと現在headの照合を定義し、未信頼コードをwrite権限で実行しない。具体条件と拒否試験は後続設計・検証で確定する。設定の外部適用・必要token・push・公開は既存の承認条件に従う。


### aidlc/spaces/default/memory/team.md

## Code Style

- 現行authoringはTypeScript、ESMと生成JSの配置である。既存Biomeとstrict TypeScriptを基準に変更範囲へ適用し、全体整形・改名を混ぜない。
- camelCase、定数UPPER_SNAKE_CASE、クラスPascalCase、目的コメント、共通処理/Node/browser境界を維持する。コア固有知識はruntime/core.tsの現行対応箇所に閉じ、ブラウザWorkerのdelete Atomics.waitAsyncを維持する。
- 入力不正、通常のゲスト終了、host/core失敗を区別する既存契約を守る。技術導入だけを理由にエラー契約を一括変更しない。
- 入力境界・パス・隔離ヘッダ、依存取得元と機密検出を変更範囲に対応づける。lintやPlaywrightだけでSAST/DAST全体の成功と扱わない。

### aidlc/spaces/default/memory/team.md

## Forbidden

<!-- Team-specific forbidden patterns -->


### aidlc/spaces/default/memory/team.md

## Mandated

<!-- Team-specific mandates -->


### aidlc/spaces/default/memory/team.md

## Corrections

<!-- Self-learning loop appends here. -->

### aidlc/spaces/default/memory/project.md

# Project-Level Rules

> Project-specific specialisation and corrections. Loaded after `org.md` and
> `team.md` as strict-additive guidance; contradictions with broader policy
> are rejected. Populated by practices-discovery and the self-learning loop.
>
> Use sparingly: most teams don't need a project layer. Reach for it
> only when this specific project needs stable, durable guidance beyond the
> team practice (for example, package-specific release checks or an additional
> regression suite for a legacy component).


### aidlc/spaces/default/memory/project.md

## Way of Working

<!-- Project-specific specialisation. Example: -->
<!-- This monorepo requires package-scoped branch names and a package owner -->
<!-- review in addition to the team's normal merge policy. -->


### aidlc/spaces/default/memory/project.md

## Walking Skeleton

<!-- Project-specific specialisation. Example: -->
<!-- The walking skeleton must exercise the legacy service adapter as well -->
<!-- as the new service boundary. -->


### aidlc/spaces/default/memory/project.md

## Testing Posture

<!-- Project-specific specialisation. -->


### aidlc/spaces/default/memory/project.md

## Guard Policy

<!-- Project-specific. Mode: strict, relaxed, or off. Strict here holds for every intent and cannot be changed from chat. A section under the retired Change Control heading, written by an earlier release, is still read. -->


### aidlc/spaces/default/memory/project.md

## Deployment

<!-- Project-specific specialisation. -->


### aidlc/spaces/default/memory/project.md

## Code Style

<!-- Project-specific specialisation. -->


### aidlc/spaces/default/memory/project.md

## Tech Stack

<!-- Technology choices locked for this project. -->


### aidlc/spaces/default/memory/project.md

## Decided

<!-- Decisions made in earlier stages that should not be re-asked. -->
<!-- Format: DECIDED: [decision] (Stage [slug], [date]) -->


### aidlc/spaces/default/memory/project.md

## Scope Overrides

<!-- Custom scope rules for this project. -->


### aidlc/spaces/default/memory/project.md

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

- 新規の人間指定禁止事項はない。既存のjj、品質上限、外部公開承認、変更範囲、JIT延期、実行ポリシー等の禁止事項を維持する。 (affirmed 2026-10-10)


### aidlc/spaces/default/memory/project.md

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

- ALWAYS 今回の改善にはpublish.yml以外の通常CI・保守workflowを含め、vivarium/terrariumの構成を参考にformicariumに適合させる。（今回の人間の指示） (affirmed 2026-10-10)

- ALWAYS 今回の開発依存管理をBunとbun.lockへ移行する。（今回の人間の指示。具体版・実行互換性は後続検証） (affirmed 2026-10-10)

- ALWAYS この改善を、terrariumで受入れ中のRC公開作業とは別の開発として進める。（人間の回答） (affirmed 2026-10-10)

- ALWAYS 保守workflowには自動ラベル付け・依存更新PR作成・条件を限定した整形修正push・CI合格した小さい依存更新の条件付き自動mergeを設計・実装対象として含める。（人間のQ1回答C。外部適用は既存承認条件に従う） (affirmed 2026-10-10)


### aidlc/spaces/default/memory/project.md

## Corrections

<!-- Project-specific corrections from human feedback. -->
<!-- Format: NEVER/ALWAYS [behavior] (learned [date]) -->
- Q5 の「blink は使わない」は Rust 版 blink を別リポジトリで作る構想の話で、この PoC は既存の blink（fork）で進めると Q7 で確定した。formicarium の PoC は jart/blink の fork を使い、Rust 版 blink は別リポジトリで並行開発して将来コアを置き換える構想である。 (learned 2026-10-03) <!-- cid:261003-blink-wasm-poc:requirements-analysis:932db38f30e1b889404fbec314fbcb0d4ea9f773eb23050b6898f72ad4d9e10c -->
- Build and Test では、ゲストのソースが変わっていなければ aube を再ビルドせず、コード生成で作った dist/guests を使う（aube v2.6.1 のビルドは 1 時間以上かかるため）。probe は変更があれば再ビルドする。 (learned 2026-10-05) <!-- cid:261003-blink-wasm-poc:build-and-test:0757b59635388c1df6be41ad35d29ae823731e286ec78def71bc455ac175ee7b -->
- Minimal 戦略でも、Build and Test では結合・性能・セキュリティの手順書をすべて作る。この PoC のテストは実質的に結合テストで、性能計測（FR6）と取得元の安全確認（マルウェアが混入した fork の回避）は記録しておく価値があるため。 (learned 2026-10-05) <!-- cid:261003-blink-wasm-poc:build-and-test:33b0dc6992ff1de8e63c907eabcf30d1fc74f0d5903a661bad62b6c63fa8159f -->
- pitchfork v2.29.0 は musl 向けにそのままではコンパイルできない（src/supervisor/lifecycle.rs:1219 の libc::ioctl の request が c_ulong、musl は c_int）。型だけを直す 1 行のパッチ patches/pitchfork-2.29.0-musl-ioctl.patch を当てる（人間の判断で「ソースは変更しない」をこの 1 行だけ緩めた。terrarium も同じ行を直している）。 (learned 2026-10-06) <!-- cid:261005-pitchfork-on-blink:code-generation:445d6697ac6ca85a44a701d00d1d38795feaae00e4c4f648f2b84d267a3b9cb7 -->
- wslc が E_FAIL で動かないときは FORMICARIUM_CONTAINER=docker で Docker に切り替える。基準値とパス調査は同じ busybox イメージ・ネットワークなしで行い、作り直した aube の基準値に差分がないことで条件が同じことを確かめる。 (learned 2026-10-06) <!-- cid:261005-pitchfork-on-blink:code-generation:e4b5559e791fff374c02391497100e18107e7180982c91fa7d015a67d912dd4a -->

### aidlc/spaces/default/memory/phases/construction.md

# Construction Phase Guardrails

These rules apply to every stage whose `phase: construction` declaration
imports them as the matching phase rule.


### aidlc/spaces/default/memory/phases/construction.md

## Code Completeness

- Generate complete, runnable files — no partial implementations, no placeholder stubs unless explicitly marked TODO with a rationale
- Every generated module must be independently executable or clearly document its dependencies
- Do not leave unresolved import errors, missing type definitions, or broken references


### aidlc/spaces/default/memory/phases/construction.md

## Error Handling

- Always include error handling at integration boundaries (API calls, database operations, file I/O, external services)
- Errors must be surfaced to the caller or logged — silent failures are not acceptable
- Distinguish between recoverable errors (retry/fallback) and fatal errors (fail fast)


### aidlc/spaces/default/memory/phases/construction.md

## Testing Standards

- Test files must cover the happy path and at least two error/edge cases
- Tests must be runnable without manual setup beyond documented prerequisites
- Do not generate tests that always pass regardless of implementation (e.g., `assert True`)


### aidlc/spaces/default/memory/phases/construction.md

## Security

- Never hardcode credentials, API keys, or secrets — use environment variables or a secrets manager
- Validate and sanitize all inputs at system boundaries
- Flag any code that bypasses authentication or authorization checks


### aidlc/spaces/default/memory/phases/construction.md

## Corrections

