---

title: '0014. Guest TCP clients in Node.js'
description: A run can let its guest reach allowed TCP destinations in Node.js; without them the guest still has no network.
---

- Status: accepted (2026-10-29); its refusal of `network` in the browser is
  replaced by [0015](/formicarium/development/decisions/0015-guest-network-in-browser-through-a-relay/) (2026-10-30)
- Decided by: the maintainer, so that a guest such as `jj git clone` can fetch
  from a remote repository
- Supersedes: [0007](/formicarium/development/decisions/0007-no-guest-network-in-browser/)

## Context

[0007](/formicarium/development/decisions/0007-no-guest-network-in-browser/)
gave guests no sockets, because the earlier core could only relay them over
WebSocket. Tools that fetch, such as `jj git clone` (jj starts `git`, which
starts `git-remote-https`), therefore could not run. paludarium 0.6.0 adds
TCP clients for Node.js: the run option `network: { allow }` lets a guest
connect over IPv4 or IPv6 to the listed destinations, resolves only the listed
names through a built-in stand-in for DNS, and lets a name reach only global
addresses (and `localhost` loopback), against DNS rebinding. Any other
destination fails with `ENETUNREACH`, and without the option `socket()` still
returns `EAFNOSUPPORT`. In browsers the core refuses the option, since a page
has no TCP sockets.

## Decision

- `RunOptions` takes an optional `network: { allow: string[] }` of at most 256
  destinations: a host name, `*.` and its subdomains, an IPv4 address or an
  IPv6 one in brackets, each with or without a port from 1 to 65535, or a bare
  IPv6 address for every port. The Session checks the form, including the
  empty name labels, port 0 and bracketed IPv4 that the core refuses
  (`INVALID_INPUT`), copies the list and passes it to the core, which checks
  the rest.
- Without `network` a run behaves as before: the guest has no network, aube
  keeps `AUBE_NO_UPDATE_CHECK=1`, and native baselines are still recorded with
  `--network none`.
- A browser run with `network` fails with `UNSUPPORTED_ENV` before its Worker
  starts.
- `runtime/node/run.js --allow-net <entry>` (repeatable) passes the same list,
  for development.
- The probe gains a named item, `tcp-echo <address:port>`, that the Node.js
  regression runs against a local echo server: allowed, not allowed and
  without a network.

## Consequences

- In Node.js a caller can let a guest fetch from the destinations it names,
  over the host's own network. TLS stays inside the guest, which needs its own
  CA certificates (for example `/etc/ssl/certs/ca-certificates.crt`).
- A run that uses the network is not compared with a native baseline, because
  the remote side can change.
- Nothing outside the guest can connect to it, and its UDP reaches no other
  host than its name lookups. Since paludarium 0.9.0 (#194, 2026-10-30) the
  guest may serve TCP and exchange UDP on its own loopback, which never leaves
  the guest.
- The command API passes `network` to guest runs only, as it does `stdin` and
  `terminal`.

## Alternatives rejected

- **Opening every destination**: a guest is untrusted code, and a caller
  should name what it may reach, as with Deno's `--allow-net`.
- **A WebSocket relay for browsers now**: it needs a server outside GitHub
  Pages, with its own cost and abuse limits. It can be added later behind the
  same option, since the core keeps its host network replaceable.
