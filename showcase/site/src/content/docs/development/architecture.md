---

title: Runtime architecture
description: How the formicarium package runs a Linux guest, layer by layer.
---

formicarium runs unmodified static x86-64 Linux binaries (ELF, typically built
against musl) in WebAssembly, in browsers and in Node.js, without booting a
kernel. This page describes the package (`@aletheia-works/formicarium`); the
[architecture guide](/formicarium/guides/architecture/) describes this site.

## Entry points

| Import                                | Provides                                                                                                                                                        |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@aletheia-works/formicarium`         | Guest validation and registration, the [installer](/formicarium/development/install-api/), the [command session](/formicarium/development/command-api/), errors |
| `@aletheia-works/formicarium/node`    | `createSession` for Node.js 24 or later                                                                                                                         |
| `@aletheia-works/formicarium/browser` | `createSession` for browsers; the page must be cross-origin isolated (COOP/COEP)                                                                                |

## How a run works

A **Session** owns the guest's filesystem (a list of files, directories and
symlinks), its working directory and its registered guests. It takes one
operation at a time; a concurrent run, install or filesystem call is refused
with `BUSY`.

Each run starts a **fresh Worker** (`worker_threads` in Node.js, a module Worker
in browsers):
1. The Worker loads the core assets and checks their SHA-256 digests against
   the build information before evaluating them.
2. It places the Session's files and the guest binary in a new in-memory
   filesystem, runs the guest with the given arguments and environment, and
   streams stdout and stderr back.
3. On exit it takes a snapshot of the persisted roots (the working directory and
   the home directory) and returns it with the exit code.

The Session commits the snapshot only after a successful run. A timeout, an
abort or a failed snapshot terminates the Worker and keeps the previous state,
so each step starts from a known filesystem ([ADR 0008](/formicarium/development/decisions/0008-fresh-instance-per-step/)).
Files that share an `inodeId` stay hard links, and symlinks and modes are kept.

## Layers

| Layer         | Files (`runtime/`)                                             | Role                                                                                                            |
| ------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Public API    | `public.ts`, `node/api.ts`, `web/api.ts`                       | The three entry points and their input checks                                                                   |
| Session       | `state.ts`, `lifecycle.ts`, `session-port.ts`, `validation.ts` | Filesystem state, the single reservation, timeouts and cleanup                                                  |
| Guests        | `guest-validation.ts`, `install*.ts`, `command*.ts`            | Validation, catalog installs and the command line                                                               |
| Worker        | `protocol.ts`, `worker-execution.ts`, `*/package-worker.ts`    | Messages between the Session and the Worker, one run per Worker                                                 |
| Guest I/O     | `guest-io.ts`                                                  | Placing files, collecting output, taking the snapshot                                                           |
| Core boundary | `core.ts`                                                      | The only file that knows the emulator core ([ADR 0003](/formicarium/development/decisions/0003-core-boundary/)) |

`types/` holds the published declarations. `scripts/`, `tests/` and `web/`
are development tools and are not part of the package.

## The core

The current core is a fork of [jart/blink](https://github.com/jart/blink)
([aletheia-works/blink](https://github.com/aletheia-works/blink), branch
`formicarium-wasm`, pinned in `blink.lock`), compiled to WebAssembly with
Emscripten as an interpreter only ([ADR 0002](/formicarium/development/decisions/0002-interpreter-only-jit-deferred/)).
Guest threads run on Emscripten pthreads, so browsers need `SharedArrayBuffer`
and therefore cross-origin isolation. The decisions specific to this core are
in the repository's
[`docs/decisions/`](https://github.com/aletheia-works/formicarium/tree/main/docs/decisions).

The core will be replaced by [paludarium](https://github.com/aletheia-works/paludarium),
a Rust reimplementation of blink published as `@aletheia-works/paludarium-wasm`.
Only `runtime/core.ts` and the Worker that loads the core change with it.

## Limits

- Guests have no network ([ADR 0007](/formicarium/development/decisions/0007-no-guest-network-in-browser/)).
- Guest memory is capped at 1 GB.
- Browsers need cross-origin isolation (COOP/COEP or a service worker that adds them).
- Real Safari on macOS is not verified; Playwright's WebKit stands in for it.
