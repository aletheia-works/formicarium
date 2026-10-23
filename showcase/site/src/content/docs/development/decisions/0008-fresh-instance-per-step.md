---

title: '0008. A fresh core instance for each step'
description: Each command runs in a new core; files carry over through snapshots.
---

- Status: accepted (2026-10-04)
- Decided by: during implementation

## Context

Reproducing aube #1645 takes four steps (`aube install`, `rm -rf node_modules`,
`aube install --frozen-lockfile`, `aube list`), and the files must carry over
from one step to the next.

## Decision

Run each command in a new core instance. The working directory and the home
directory are copied out on the JavaScript side after a step and placed into
the next instance (since the switch to paludarium, `fromCoreSnapshot` and
`toCoreEntries`; with blink, `snapshotFs` and `populateFs`); `runSession` in
`runtime/guest-io.ts` drives the steps, and `rm -rf` runs on the JavaScript
side. The package's Session follows the same model with a fresh Worker for each
run.

## Consequences

- Simple to implement, and the state of each step is cleanly separated.
- Each command pays a fixed start-up cost (0.3 to 0.5 seconds with the blink
  core), which a JIT does not reduce.
- WebKit reserves the wasm memory maximum for each instance and keeps it until
  the page is done, which is why guest memory is capped at 1 GB.

## Alternatives rejected

- **One instance running a shell across commands**: it needs a guest shell and
  process creation (`fork` and `exec`), and process `fork` was disabled in the
  fork of blink that was the core at the time.
