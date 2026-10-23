---

title: '0010. Cap the wasm memory at 1 GB'
description: The core's shared WebAssembly memory may grow to 1 GB and no further.
---

- Status: accepted (2026-10-05)
- Decided by: the user

## Context

WebKit commits the full maximum of a WebAssembly memory for each core instance
and keeps it until the page is done. With the former blink core and its
original 4 GB maximum, the four steps of aube #1645 made WebKit commit about
14 GB; Chromium did not grow. Lowering the maximum to 1 GB did not change the
speed (8 runs each, p ≥ 0.57) but cut the allocation to about 1.1 GB per step.
aube and probe run within 1 GB.

## Decision

The core's shared memory may grow to 1 GB (16384 pages of 64 KiB). Since the
switch to paludarium, the core sets this maximum itself (`maximum: 16384` in
its `index.mjs`, with the same limit on the memory the wasm imports);
`tests/node/build.test.ts` reads both from the copy in `dist/paludarium/` and
fails if either changes.

## Consequences

- WebKit is less likely to run out of memory on machines with little memory.
- A guest that needs more than 1 GB of memory does not run.
- A paludarium release that changes the maximum fails the build test until
  this decision is revisited.

## Alternatives rejected

- **Keep 4 GB**: WebKit's commitments pile up.
- **Release the instance between steps**: when memory is released depends on
  JavaScriptCore's garbage collection, which formicarium cannot control.
