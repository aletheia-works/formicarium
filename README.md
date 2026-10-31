# formicarium

Run unmodified x86-64 Linux command-line programs in the browser and in Node.js,
without booting a kernel. formicarium wraps
[paludarium](https://github.com/aletheia-works/paludarium), a user-mode x86-64
Linux emulator compiled to WebAssembly (a Rust counterpart of
[jart/blink](https://github.com/jart/blink)), and gives it a small JavaScript
API: give it a static Linux executable and some files, run it, and get back the
exit code, the output and the files it wrote. The goal is to let a CLI bug
reproduction run as-is in a web page.
- **Try it:** the [showcase site](https://aletheia-works.github.io/formicarium/)
  has terminals that install and run aube, pitchfork, Biome, nano, jj and git in your
  browser.
- **Package:** [`@aletheia-works/formicarium`](https://www.npmjs.com/package/@aletheia-works/formicarium)
  on npm.
- **Documentation:** the [site](https://aletheia-works.github.io/formicarium/)
  has guides (including the install and command APIs) and a Development
  section (runtime architecture, design decisions), in English and Japanese.

## Status

formicarium is young (0.x) and its API may still change. What is checked on
every change:
- A Rust probe (threads, timers, `UnixStream::pair`, rayon, Mutex/Condvar,
  hard links, symlinks, `flock`) passes on Node.js, Chromium, Firefox and WebKit.
- Multi-step sessions of aube and pitchfork produce the same output as on native
  x86-64 Linux.
- Line coverage of the distributed JavaScript stays at 80% or more.

It runs an interpreter (no JIT yet), so heavy programs are much slower than
native. CI runs the browser probe, the install and command checks, the
showcase acceptance and the showcase site's acceptance in real Safari on macOS; the other browser suites use
Playwright's WebKit in its place. The browser probe and the install and command
checks also run in Safari on iOS in an iOS 26 Simulator (not yet iOS 27, which
safaridriver cannot drive); a real iPhone is not tested.

## Install

```sh
npm install @aletheia-works/formicarium
```

Node.js 24 or later is required.

## Quick start (Node.js)

```js
import { createSession } from '@aletheia-works/formicarium/node';
import { decodeUtf8 } from '@aletheia-works/formicarium';

// guestBytes: a static ELF64 little-endian x86-64 Linux executable (Uint8Array).
const session = await createSession({ cwd: '/work', home: '/home/guest' });
try {
  const result = await session.run({ guest: guestBytes, args: ['--version'] });
  console.log(result.exitCode, decodeUtf8(result.stdout));
} finally {
  await session.dispose();
}
```

Guests are not included. Build them as static musl executables, or install
them from a catalog with the install API (below).

## In the browser

Import `createSession` from `@aletheia-works/formicarium/browser`. The page must
be able to use `SharedArrayBuffer`:
- Serve the page with `Cross-Origin-Opener-Policy: same-origin` and
  `Cross-Origin-Embedder-Policy: require-corp` (or use a service worker such as
  coi-serviceworker on static hosting).
- Serve the package Worker (`runtime/web/package-worker.bundle.js`) and the core
  under `assets/paludarium/` from your page's origin.
- Allow same-origin scripts and Workers and WebAssembly compilation in the
  Content Security Policy, for example
  `script-src 'self' 'wasm-unsafe-eval'; worker-src 'self'; connect-src 'self'`.
  `blob:` is not needed.

The [embedding guide](https://aletheia-works.github.io/formicarium/guides/embedding/)
has a complete example.

## What the API does

- **Sessions.** A `Session` holds a virtual filesystem between runs. Only the
  working directory and the home directory persist; files sharing an `inodeId`
  stay hard links, symlinks stay links, and modes are kept. Between runs use
  `listEntries`, `readFile`, `remove`, `setCwd` and `reset`; `dispose` closes
  the session for good.
- **Runs.** Each run starts a fresh Worker and a fresh core. A session runs one
  thing at a time (`BUSY` otherwise). A nonzero guest exit resolves normally
  with the exit code and the raw stdout/stderr bytes; `onOutput` streams them
  in order. Host, core, timeout (600000 ms by default, `timeoutMs` to change)
  and cancellation (`AbortSignal`) failures reject with an `ExecutionError`
  carrying a stable `code` (all codes are listed in `ERROR_CODES` and on the
  [error codes](https://aletheia-works.github.io/formicarium/guides/errors/)
  page) and the partial output. When the run failed inside
  the Worker, its `cause` chain names the original errors; it keeps the
  messages that the JavaScript engine, WebAssembly or the core wrote, and only
  the names of other errors, so caller data such as env values stays out. A
  failed or cancelled run
  leaves the filesystem as it was. For an interactive guest, `stdin` streams
  its standard input and `terminal: { columns, rows }` makes its standard
  streams a terminal; a run with `stdin` has no default timeout.
- **Network.** A guest has no network unless a run passes
  `network: { allow: ['github.com:443'] }`. It can then open TCP connections
  to the listed destinations only, and resolve only the listed names; anything
  else fails with `ENETUNREACH` (a loopback address with no guest listener
  with `ECONNREFUSED`); a guest may serve on its own loopback. TLS runs inside the guest, so give it CA
  certificates. A browser has no TCP sockets, so a browser run also needs
  `network.relay: { url, protocols? }`, a WebSocket relay such as
  `@aletheia-works/paludarium-wasm/relay` serves; without one it fails with
  `UNSUPPORTED_ENV`. Node.js uses the relay when given.
- **Core assets.** Before the core starts, the pinned paludarium version and the
  SHA-256 of every core file are checked against
  `assets/paludarium/build-info.json` (`ASSET_LOAD` if missing or changed,
  `CORE_INIT` if the core fails to start). Node.js loads the checked bytes from
  a private directory. Browsers load the core from its URLs after the check, so
  serve the assets from an origin you trust.
- **Guests and catalogs.** `validateGuest` checks a guest's bytes and build
  information, `createInstaller` installs tools from a fixed catalog of
  checksummed ELF or tar.gz downloads, `registerValidatedGuest` registers a
  checked guest you already hold (`runValidatedGuest` runs it once instead),
  `fixtureToFsEntries` checks the files a session starts with, and
  `createCommandSession` runs one command line (`ls`, `cat`, `cd`, `rm -rf`,
  `cp`, `mv`, `install <tool>`, or an installed tool) without a shell. A
  registered tool runs by name in a command session, and every guest run finds
  it as `/usr/bin/<tool>`. Installing with
  `createInstaller` writes no output, so a page can have tools ready before the
  user types anything. See the
  [install API](https://aletheia-works.github.io/formicarium/guides/install-api/)
  and [command API](https://aletheia-works.github.io/formicarium/guides/command-api/).

## Limits

- Guests must be static x86-64 Linux ELF executables. `validateGuest` and
  installs also refuse a guest over 128 MiB.
- Guests reach the network only as TCP clients of the allowed destinations,
  through a relay in the browser. A guest may also serve TCP and exchange UDP
  on its own loopback; other UDP reaches only name lookups.
- The core's memory is capped at 1 GB.
- Each run starts from a fresh filesystem; only the working directory and the
  home directory carry over.

## How it works

The runtime splits into the public API, a per-run Worker, guest input/output
and one module, `runtime/core.ts`, that knows the emulator core. The core
itself is the `@aletheia-works/paludarium-wasm` npm package, pinned to an exact
version and shipped in `assets/paludarium/`. See the
[runtime architecture](https://aletheia-works.github.io/formicarium/development/architecture/)
and the [architecture decisions](https://aletheia-works.github.io/formicarium/development/decisions/).

## Contributing

See [CONTRIBUTING.md](https://github.com/aletheia-works/formicarium/blob/main/CONTRIBUTING.md)
for setup, builds, tests and pull requests, and follow the
[Code of Conduct](https://github.com/aletheia-works/formicarium/blob/main/CODE_OF_CONDUCT.md).
Report vulnerabilities privately as described in the
[security policy](https://github.com/aletheia-works/formicarium/blob/main/SECURITY.md).

## License

Apache License 2.0. The bundled paludarium core is also Apache-2.0; see
`THIRD_PARTY_NOTICES.md` and the
[core license](https://aletheia-works.github.io/formicarium/development/licenses/).
