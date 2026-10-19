---
title: Architecture
description: How the emulator, the public API and the showcase fit together.
---

```text
showcase page (Astro + Starlight, xterm.js)
  -> public API: createSession (/browser), createCommandSession (root)
     -> Session: files, cwd and one run at a time
        -> Web Worker per run: blink compiled to WebAssembly
           -> static x86-64 Linux ELF guest
```

**Emulator.** formicarium runs blink, a user-mode x86-64 Linux emulator, as
WebAssembly. Each run starts a fresh Worker; files written by a command stay in
the Session and are passed to the next one. Guests are validated against their
SHA256 and `build-info.json` before they run.

**Showcase.** `showcase.yml` (U7) resolves, acquires, builds and accepts the
guests and writes a candidate. This site (U8) only consumes that candidate:
the formicarium pack is copied byte for byte to `_formicarium/<version>/`, the
guests and catalog to the site root, and the demo fixtures to
`demo-fixtures/`. Every fetched index and catalog is checked against the SHA256
embedded in the page.

**Isolation and CSP.** GitHub Pages cannot set COOP/COEP headers, so the
terminal pages register `coi-serviceworker.js` (scope `/formicarium/`) with COEP
`require-corp`. Because that scope covers the whole site, no page loads any
cross-origin resource. The terminal pages carry a CSP that allows only the same
origin, `blob:` and WebAssembly compilation; documentation pages load neither
the terminal nor the service worker.

**Display.** Guest output is decoded as UTF-8 text for xterm.js and never
interpreted as HTML. Escape sequences that xterm sends back are not typed into
the command line, and OSC 8 links do not open.
