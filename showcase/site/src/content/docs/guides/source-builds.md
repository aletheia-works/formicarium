---

title: Source builds
description: How the showcase chooses, acquires and builds its guests.
---

The showcase tools are defined in
[`showcase/tools.json`](https://github.com/aletheia-works/formicarium/blob/main/showcase/tools.json).
Each run of `showcase.yml` resolves the latest stable release of every tool
once, from the tag pattern of its repository, and keeps that tag and its full
commit for the rest of the run.
- **Release assets.** aube and Biome publish static x86-64 musl binaries. The
  showcase downloads the release asset, checks the published SHA256 and size,
  and validates the ELF with the public `validateGuest`.
- **Source builds.** pitchfork has no musl asset, so the showcase compiles the
  tagged source with Cargo for `x86_64-unknown-linux-musl`, without network
  tokens in the build step. A build with the same `buildKey` from an earlier
  trusted main run is reused instead of compiling again.
- **Signed GNU tarballs.** nano is released as GNU tarballs, not on GitHub.
  The showcase picks the highest version in the `ftp.gnu.org` listing, checks
  its detached signature with `gpgv` against the maintainer key committed in
  `showcase/keys/`, and does the same for ncurses. The commits of the tags in
  nano's Savannah repository and ncurses' snapshot repository identify the
  sources. Both are built with musl-gcc as static libraries and a static
  program, and the signed tarballs are published beside the guest under
  `sources/` as its corresponding source.

The run then writes the catalog, installs and runs each tool with
`--version` through the public API in Node, Chromium, Firefox, WebKit and real
Safari on macOS, and assembles the candidate only when all twenty checks pass. This site is built
from that candidate and never resolves `latest` again.

Adding a tool needs an entry in `tools.json`, a demo fixture in
`showcase/fixtures/<name>/app`, the site strings for its card, and system calls
that formicarium supports. A tool that fails acceptance is never deployed.
