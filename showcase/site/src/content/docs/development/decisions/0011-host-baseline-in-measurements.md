---

title: '0011. Record a host speed baseline with each measurement'
description: Measure a fixed host computation around each trial to spot slow periods.
---

- Status: accepted (2026-10-05)
- Decided by: the user asked for comparable measurements; the method was chosen during development

## Context

aube timings split into two groups, 6 to 9 seconds and 17 to 29 seconds, under
the same conditions. The time of one fixed host computation varied by up to 2.4
times and tracked the aube times (correlation 0.6). Exit waits, TLB flushes,
idle thread spinning and the wasm compiler tier were ruled out.

## Decision

`scripts/measure-aube.ts` measures a fixed single-thread host computation before
and after each trial and records it as `hostBenchMs`; the results table shows it
as the host baseline column. Ten trials (`--trials 10`) is the standard; the
script's default is 3.

## Consequences

- Trials that ran while the host was slow can be told apart.
- Each trial takes a few seconds longer.

## Alternatives rejected

- **Only more trials**: the cause of the spread would stay unknown.
- **Pin the power plan to high performance**: it changes the user's system
  settings.
