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

## Later measurement (2026-11-02)

The context above was measured with the former blink core. Safari 27.2 on
macOS no longer behaves that way, in plain pages or with paludarium. Each case
below ran in a fresh WebDriver session, and the page process's physical
footprint was read with `vmmap`:

- A shared memory takes only the pages it uses. Four memories of about 1 MB on
  the page added 4 to 6 MB with a maximum of 64 MB, 1 GB or 4 GB alike.
- A memory made in a Worker is freed when the Worker ends. Eight Workers that
  each made and filled 100 MB added about 1 MB.
- formicarium's runs do not pile up. Eight runs of `hello` in one Session left
  the page about 24 MB larger (peak 151 MB), and four runs of `aube --version`
  about 10 MB larger (peak 532 MB). Both stayed the same 15 seconds later and
  after `dispose`.

On macOS, then, the Context, the first Consequence and the first rejected
alternative describe the former core only, and the cap no longer saves memory
there. The 1 GB cap stays. paludarium sets it, iOS was not measured, and WebKit
[bug 255103](https://bugs.webkit.org/show_bug.cgi?id=255103) reports iOS
refusing a large shared maximum with "Out Of Memory".
