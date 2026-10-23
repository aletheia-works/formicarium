---

title: '0007. No guest network in the browser'
description: Guests get no sockets; runs stay comparable with native baselines.
---

- Status: accepted (2026-10-04)
- Decided by: during implementation

## Context

Emscripten tries to relay a guest's TCP and UDP sockets over WebSocket, and in
Node.js it failed asking for the `ws` module. aube checks its registry for
updates on `--version` and `install`. The CheerpX measurements were also taken
without a network.

This context describes the earlier blink core built with Emscripten. Since the
switch to paludarium, the decision is kept: formicarium gives guests no
network, and aube still runs with the same environment and native baseline. The
`EAFNOSUPPORT` result below was observed with blink.

## Decision

`socket()` returns `EAFNOSUPPORT`. aube runs with `AUBE_NO_UPDATE_CHECK=1`
(`GUESTS.aube.env` in `runtime/registry.ts`), and its native baseline is
recorded in a container with `--network none` so the conditions match.
`socketpair()` still works through the core's emulated descriptors.

## Consequences

- No extra dependency, and runs compare directly with the native baseline.
- Guests that need the network, such as fetching from a registry, do not work.

## Alternatives rejected

- **Emscripten's WebSocket relay**: it needs a relay server and more
  dependencies.
