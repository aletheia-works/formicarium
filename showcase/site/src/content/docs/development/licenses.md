---

title: Core license
description: The license of the blink core and what the package ships with it.
---

The current core is a fork of jart/blink. This page records why its license
fits formicarium and what has to ship with it.

| Item                  | Value                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------------ |
| Upstream              | [jart/blink](https://github.com/jart/blink) only; no other fork of blink is used           |
| Fork                  | [aletheia-works/blink](https://github.com/aletheia-works/blink), branch `formicarium-wasm` |
| Pinned commit         | `commit` in `blink.lock` (`upstream_commit` is the upstream base)                          |
| blink's license       | ISC License (`LICENSE`, Copyright 2022 Justine Alexandra Roberts Tunney)                   |
| formicarium's license | Apache License 2.0                                                                         |

## Compatibility

- The ISC License allows use, copying, modification and distribution on the
  sole condition that the copyright notice and permission notice appear in all
  copies. Using it from an Apache-2.0 project and distributing the built core
  (`blink.mjs` and `blink.wasm`) do not conflict with it. This is a reading of
  the license text, not legal advice.
- The fork's changes (`blink/emufd.c`, `blink/emufd.h`, `blink/emscriptenfs.c`,
  `blink/emscriptenfs.js` and edits to existing files) carry the same ISC
  notice in the fork.
- Third-party code in the core: the Emscripten runtime (MIT and
  University of Illinois/NCSA) and its bundled musl libc (MIT). Both can be
  distributed with their notices. blink's `third_party/libz` is used only by
  blinkenlights, not linked into the core.

## What ships

The npm package includes `THIRD_PARTY_NOTICES.md` with the blink ISC License,
zlib, the Emscripten licenses and musl's license, read from the pinned build
image. Package staging records the core's commit and clean-source state and the
SHA-256 digests of the loader and the wasm.

Whether to contribute the fork's changes back to jart/blink is still open; they
can stay under ISC either way.

When the core moves to [paludarium](https://github.com/aletheia-works/paludarium),
this page changes with it.
