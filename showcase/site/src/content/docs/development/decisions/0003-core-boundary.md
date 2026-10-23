---

title: '0003. Handle the core only as one wasm module and its loader'
description: Keep everything specific to the emulator core in runtime/core.ts.
---

- Status: accepted (2026-10-04)
- Decided by: the implementation plan, approved by the user

## Context

The core will be replaced by paludarium. The browser and Node.js runtimes
should not be rebuilt each time the core changes.

## Decision

Treat the core as one WebAssembly module with its loader (today an Emscripten
`MODULARIZE` module whose default export is a factory). Keep everything specific
to the core, such as where its build lives and how its command line is formed,
in the descriptor in `runtime/core.ts`. Guest I/O and the Node.js and browser
runtimes depend only on the filesystem interface the core exposes.

## Consequences

- Replacing the core means adding a descriptor in `runtime/core.ts` and its
  build output.
- A new core must offer the same shape: a module, a filesystem interface and
  exit codes, or an adapter in `runtime/core.ts` must provide it.
- The existing test suite works as the acceptance criteria for a new core.

## Alternatives rejected

- **Write the runtimes against blink's own API**: every core change would
  rebuild the runtimes.
