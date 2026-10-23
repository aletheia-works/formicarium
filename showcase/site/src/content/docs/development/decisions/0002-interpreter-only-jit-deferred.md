---

title: '0002. Interpreter only; defer the JIT'
description: Build the core as an interpreter and develop a JIT later, in paludarium.
---

- Status: accepted (scope 2026-10-03, deferral 2026-10-05)
- Decided by: the user

## Context

A JIT was always planned; its timing was to be decided from measurements. They
showed that more than 90% of an `aube install` is interpretation and that it
takes about 75 times as long as native. Against CheerpX 1.3.9, `install` was
about as fast as CheerpX's slowest run and `frozen install` was 1.5 to 4 times
slower. Correctness issues were still open, and the core was planned to be
replaced by paludarium.

## Decision

Build the core as an interpreter only (`--disable-jit`). Defer the JIT, and do
not develop it in the C fork of blink. For now the threshold is "good enough to
reproduce a report": the four aube #1645 steps finish in 12 to 20 seconds.

## Consequences

- Correctness can come first.
- It does not reach everyday speed (1 to 2 seconds per command); that needs both
  a JIT and a resident core.
- The JIT investment goes to paludarium.

## Alternatives rejected

- **A JIT in the C fork now**: likely thrown away when the core is replaced, and
  it adds correctness risk.
- **Parity with CheerpX as the threshold**: `frozen install` cannot reach it
  without a JIT or another speed-up first.
