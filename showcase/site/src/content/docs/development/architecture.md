---

title: Runtime architecture
description: How the formicarium package runs a Linux guest, layer by layer.
---

formicarium runs unmodified static x86-64 Linux binaries (ELF, typically built
against musl) in WebAssembly, in browsers and in Node.js, without booting a
kernel. This page describes the package (`@aletheia-works/formicarium`); the
[architecture guide](/formicarium/guides/architecture/) describes this site.

## Entry points

| Import                                | Provides                                                                                                                                              |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@aletheia-works/formicarium`         | Guest validation and registration, the [installer](/formicarium/guides/install-api/), the [command session](/formicarium/guides/command-api/), errors |
| `@aletheia-works/formicarium/node`    | `createSession` for Node.js 24 or later                                                                                                               |
| `@aletheia-works/formicarium/browser` | `createSession` for browsers; the page must be cross-origin isolated (COOP/COEP)                                                                      |

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
   streams stdout and stderr back. For an interactive run, the Session also
   sends stdin to the Worker and the guest sees a terminal
   ([ADR 0013](/formicarium/development/decisions/0013-interactive-guest-runs/)).
3. On exit it takes a snapshot of the persisted roots (the working directory and
   the home directory) and returns it with the exit code.

The Session commits the snapshot only after a successful run. A timeout, an
abort or a failed snapshot terminates the Worker and keeps the previous state,
so each step starts from a known filesystem ([ADR 0008](/formicarium/development/decisions/0008-fresh-instance-per-step/)).
Files that share an `inodeId` stay hard links, and symlinks and modes are kept.

When a run fails inside the Worker, the Worker sends the error code and what it
may tell about the original errors: the name of each error in the cause chain,
and the message only of an engine `RangeError` (one without Node's `ERR_` code,
which can quote the received value), a WebAssembly error or the core's
`PaludariumError` (with its `kind`), up to 300 characters. Other messages can
hold caller data such as paths or env values, so they stay in the Worker. The
Session puts these errors in the `ExecutionError`'s `cause`.

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
are development tools and are not part of the package. The `web/` page, which
the browser regressions open, runs guests through the package's own browser API
(`createSession`).

## The core

The core is [paludarium](https://github.com/aletheia-works/paludarium), a
from-scratch Rust counterpart of jart/blink published as
`@aletheia-works/paludarium-wasm` and pinned to an exact version in
`package.json`. `bun run build` copies its files (the `index.mjs` launcher, its
helper modules, `paludarium.wasm` and `LICENSE`) into `dist/paludarium/` and
writes `build-info.json` with the version and the SHA-256 of every file; the
package ships the same files under `assets/paludarium/`.

`runtime/core.ts` verifies every digest, then starts the core with
`createPaludarium({ wasmUrl })`. The launcher it returns creates a filesystem
from entries, runs a program with arguments, environment and working directory,
and streams stdin, stdout and stderr until the guest exits. Node.js loads the
verified bytes from a private run-specific directory; browsers load the core
from the asset URLs after the check, and the core starts its own module Workers
next to its loader. The core uses shared WebAssembly memory, so browsers need
`SharedArrayBuffer` and therefore cross-origin isolation. JIT work in
formicarium stays deferred ([ADR 0002](/formicarium/development/decisions/0002-interpreter-only-jit-deferred/)).

The previous core, a fork of blink built with Emscripten, is gone; its
build files and the decisions specific to it remain only in the git history.

## Limits

- Guests have no network ([ADR 0007](/formicarium/development/decisions/0007-no-guest-network-in-browser/)).
- Guest memory is capped at 1 GB.
- Browsers need cross-origin isolation (COOP/COEP or a service worker that adds them).
- CI runs the browser probe, the install and command checks, the showcase
  acceptance and this site's acceptance in real Safari on macOS. The other
  browser suites use Playwright's WebKit in its place. The browser probe and the
  install and command checks also run in Safari on iOS in an iOS 26 Simulator (iOS 27
  is not run: safaridriver cannot drive it); a
  real iPhone is not verified.
