<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs. Add observations at the review step, not by editing here directly.

## Interpretations
- 2026-10-16T20:04:22Z [unit u4-command] — C05が定めていないshell記号・escape・区切り・lsの表示を人間に確認し、Q1–Q4はすべてAになった。terrarium互換で `* ? ( ) { }` も拒否する。escapeはPOSIXの部分集合とし、二重引用内の `$` とbacktickはliteral。区切りはspace/tabだけで、LF/CR/NULは拒否する。lsはU4がterrarium互換の表示にする。pwdは追加しない。
- 2026-10-13T19:34:08Z [unit u3-install] — C02/C03/C04/C11の承認済み選択を再質問せず、catalog snapshot、共通予約と原子的登録、全entry検査、取消後cleanupを仕様化した。U3の正式36試行はU1と同じ入力identityで行い、U4後B1と区別する。
- 2026-10-12T23:12:06Z [unit u2-session-guest-api] — 承認済みC02/C03/C06/C11から判断できる境界は再質問せず仕様化した。raw JSONの重複keyはobject化する取得境界が拒否し、純粋同期APIは失われた情報を復元したと主張しない。U2暫定候補とU4統合後B1証拠を分離する。
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->

## Deviations
2026-10-17T05:10:00Z — [unit u2-session-guest-api] review-08 R-08により再開。人間が承認した修正案（u2-resolvepath-contract-proposal.md 案A）に従い、contract-designへ戻らず、C02の`resolvePath`追記をU2 functional-designの変更として行った（BR2.12、WF2.6、traceability、contract-summary.mdのC02 interfaceと本文）。既存の5 methodとBUSY・ABORTED・DISPOSEDの規則は変えていない。
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->

## Tradeoffs
- 2026-10-16T20:04:22Z [unit u4-command] — lsのtype表示に必要なentry種別はU2内部portのbuiltin（名前だけ）では得られない。そこで、U2を変更せずに公開listEntriesを1回呼ぶ方式を採った。fs予約はlistEntries内部の1回だけで、直接APIとの排他は同じになる。cat/cd/rmは既存port.builtinを使う。
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->

## Open questions
- 2026-10-16T20:10:00Z [unit u4-command] — レビューREADY（Minor 6件）。人間の判断で設計は凍結のまま、U4 Code Generation計画へ反映する：(1) lsはterrariumと同じく表示文字列（name/、name -> target）で並べる。(2) 予約前にabort済みsignalならABORTEDにし、同期builtinは開始後に中断しない。(3) guest runはtimeoutMsを渡さず、Session.runの既定600000msに従う。(4) commandIdは任意とし、runId/installation.operationIdで識別する。(5) ls/cat/rm/cd/installは予約名で、同名guestはcommandから呼べない。(6) traceabilityにFR4（BR4.1/BR4.12）を加え、BR4.17のreverse記載を正す。
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
