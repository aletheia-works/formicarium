## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-10-16T20:04:42Z
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u4-command/functional-design/functional-spec.md > Workflow W6 step 2 / rules.md > BR4.11 | W6 says sorting by name matches terrarium's `.sort()`, but terrarium sorts the already decorated strings (`name/`, `name -> target`). The two orders differ, for example a directory `a` and a file `a.b`: decorated order gives `a.b`, `a/`; name order gives `a/`, `a.b`. The "same as terrarium" claim is false for such names, and the Transcript golden tests rely on this order. | Decide which order is normative. Either sort the decorated line strings in UTF-16 order as terrarium does, or drop the "same as terrarium" wording and add the `a` / `a.b` case to the test points. | New |
| R-02 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u4-command/functional-design/functional-spec.md > W1 step 5 and State Machine (Reserving --> Rejected: ABORTED) / rules.md > BR4.10 | `CommandOptions.signal` is passed only to install and guest run. The design does not say what happens to builtin or `ls` when the signal is already aborted or aborts mid-operation. `SessionPort.acquire` takes no signal, so the ABORTED edge from Reserving has no defined source on the cat/cd/rm/ls paths. | State that a pre-aborted signal rejects with ABORTED before any reservation is taken, or that builtin ignores the signal because it is synchronous. Reflect the choice in the state machine and the test points. | New |
| R-03 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u4-command/functional-design/functional-spec.md > W5 (`runInstalled(... { signal, onOutput, ... })`) / rules.md > BR4.14 | The `...` in W5's `runInstalled` options is not defined. `CommandOptions` has no `timeoutMs` or `env`, yet the guest-run timeout (the 600s probe baseline vs the U2 default) decides TIMEOUT behaviour. A developer cannot tell whether U4 passes a timeout or leaves it to the U2 default. | List the exact option fields passed to `runInstalled` (signal, onOutput only), and say the timeout is U2's default. | New |
| R-04 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u4-command/functional-design/entities.md > CommandRequest.commandId | `commandId` is "required, unique" and defined as the U2 reservation `operationId`. For `ls` (public `listEntries`, with the reservation taken internally) and `install` (taken inside the C04 Installer), U4 never holds the reservation, so it has no `operationId`. CommandResult does not expose the id either. | Make `commandId` optional and say it is available only for cat/cd/rm and guest runs, or remove it from the entity. | New |
| R-05 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u4-command/functional-design/rules.md > BR4.8 | Names `ls`, `cat`, `rm`, `cd` and `install` are reserved by dispatch. A registered guest with one of these names becomes unreachable through command, and nothing in C04 or U4 forbids registering one. | State that these names shadow registered tools and are not guest-runnable, or require the catalog/install to reject such tool names. Add a test point. | New |
| R-06 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u4-command/functional-design/traceability.json | The rules cite FR4 as a source (BR4.1, BR4.12), but `upstream_ids` and `coverage` do not include FR4. The reverse section marks BR4.17 as N/A even though it appears under NFR7 coverage. | Add FR4 to the upstream IDs and coverage, or drop FR4 from the rule sources. Make the BR4.17 reverse row consistent with the coverage entry. | New |

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| (none declared) | n/a | Feasibility was checked against the code. `runtime/lifecycle.ts` public `listEntries` goes through `fsOperation` and takes exactly one fs reservation. `FsEntry` carries type and target. `SessionPort.builtin` supports cat/cd/rm/`ls`, and `runInstalled` reuses the reservation, matching W3/W5. `state.listEntries` returns only the direct children of a directory (empty for a file), consistent with W6. |

### Summary

The design is implementable. Its claims about reservations, ports and entry shapes match the existing code and C02/C04/C05, and the tokenizer state machine and the rejection boundaries are complete. The open points are all Minor: the false terrarium sort-order parity claim, undefined behaviour for abort on builtin, the undefined `runInstalled` options, `commandId` for ls/install, reserved tool names, and an FR4 gap in the traceability file.
