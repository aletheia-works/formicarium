---

title: Core license
description: The license of the paludarium core and what the package ships with it.
---

The core is [paludarium](https://github.com/aletheia-works/paludarium). This
page records why its license fits formicarium and what has to ship with it.

| Item                  | Value                                                                        |
| --------------------- | ---------------------------------------------------------------------------- |
| Core                  | `@aletheia-works/paludarium-wasm`, exact version pinned in `package.json`    |
| Provenance            | `assets/paludarium/build-info.json` (version and SHA-256 of every core file) |
| paludarium's license  | Apache License 2.0 (full text in `assets/paludarium/LICENSE`)                |
| formicarium's license | Apache License 2.0                                                           |

## Compatibility

- paludarium and formicarium share the Apache License 2.0, so shipping the
  core's files unchanged in the package needs only its license text and
  notices. This is a reading of the license text, not legal advice.
- paludarium is a from-scratch Rust counterpart of jart/blink: blink's
  behaviour and design are a reference, and no blink code is copied. blink's
  ISC License therefore does not apply to the package.

## What ships

The npm package copies the core's files unchanged from
`@aletheia-works/paludarium-wasm` into `assets/paludarium/`, including its
`LICENSE`, and includes `THIRD_PARTY_NOTICES.md`, which names paludarium as its
only third-party component. `build-info.json` records the pinned version and
the SHA-256 digest of every core file. No guest ELF, vendor source or
development dependency is included.

The previous core, a fork of blink built with Emscripten, needed the blink ISC
License, zlib, the Emscripten licenses and musl's license; none of them ship
with the package any more.
