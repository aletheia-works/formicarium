---

title: '0015. Guest network in the browser through a WebSocket relay'
description: A browser run can give its guest TCP connections through a WebSocket relay that the caller names.
---

- Status: accepted (2026-10-30)
- Decided by: the maintainer, so that guests such as `jj git clone` can fetch
  in the browser too
- Replaces in part: [0014](/formicarium/development/decisions/0014-guest-tcp-clients-in-nodejs/)
  (its refusal of `network` in the browser)

## Context

[0014](/formicarium/development/decisions/0014-guest-tcp-clients-in-nodejs/)
gave Node.js guests TCP clients and refused `network` in the browser, since a
page has no TCP sockets. paludarium 0.8.0 adds `network.relay`: the core sends
each connection and each name lookup of the guest to a WebSocket relay, which
resolves and connects for it. The relay is `@aletheia-works/paludarium-wasm/relay`;
it checks its own allow list, signs the addresses it resolved, and limits how
far an upload may run ahead of the TCP peer. Without a relay the core still
refuses `network` in a browser.

## Decision

- `NetworkOptions` takes an optional `relay: { url, protocols? }`. The Session
  checks that `url` is a `ws:` or `wss:` URL of at most 2048 characters without
  a fragment, and that `protocols` holds at most 8 distinct HTTP tokens of at
  most 4096 characters, as `new WebSocket(url, protocols)` takes them
  (`INVALID_INPUT`). It copies both and passes them to the core.
- A browser run with `network` and a `relay` starts its Worker; without a
  `relay` it still fails with `UNSUPPORTED_ENV` before any Worker starts.
- Node.js uses the relay when one is given and otherwise connects itself, as
  the core does.
- The command API passes `relay` with the rest of `network`, to guest runs
  only.
- The relay and its host are the caller's. formicarium does not start one; its
  AWS module (`infra/aws`) will host one on Lambda MicroVMs, whose
  authentication goes in `protocols`.
- The Node.js regression and the browser suite run the probe's `tcp-echo`
  through a local relay: allowed by both, and allowed by the run but not by
  the relay (`ENETUNREACH`).

## Consequences

- In the browser a guest reaches only destinations that both the run and the
  relay allow; the relay decides what its host may be used for.
- A browser run's connections pass through the relay's host, which sees the
  TCP stream. TLS stays inside the guest, so the relay sees ciphertext for
  HTTPS.
- A page needs a relay it can reach; GitHub Pages alone cannot serve one.

## Alternatives rejected

- **A relay URL in the Session or the assets**: tokens such as a Lambda
  MicroVM's expire within minutes, so each run takes its own.
- **Starting a relay from formicarium**: the relay needs a host outside the
  page, and its owner sets its allow list and limits.
