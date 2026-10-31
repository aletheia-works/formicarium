---

title: Source builds
description: How the showcase chooses, acquires and builds its guests.
---

The showcase tools are defined in
[`showcase/tools.json`](https://github.com/aletheia-works/formicarium/blob/main/showcase/tools.json).
Each run of `showcase.yml` resolves the latest stable release of every tool
once (GitHub's latest release, whose tag must match the tool's pattern, or the
newest signed tarball in the listing for a source build) and keeps that tag and
its full commit for the rest of the run.
- **Release assets.** aube, Biome and jj publish static x86-64 musl binaries. The
  showcase downloads the release asset, checks the published SHA256 and size,
  and validates the ELF with the public `validateGuest`.
- **Source builds.** pitchfork has no musl asset, so the showcase compiles the
  tagged source with Cargo for `x86_64-unknown-linux-musl`, without network
  tokens in the build step.
- **Signed GNU tarballs.** nano is released as GNU tarballs, not on GitHub.
  The showcase picks the highest version in the `ftp.gnu.org` listing, checks
  its detached signature with `gpgv` against the maintainer key committed in
  `showcase/keys/`, and does the same for ncurses. The commits of the tags in
  nano's Savannah repository and ncurses' snapshot repository identify the
  sources. Both are built with musl-gcc as static libraries and a static
  program, and the signed tarballs are published beside the guest under
  `sources/` as its corresponding source.
- **Signed tarballs from other servers.** git is built the same way from its
  tarball on kernel.org, with zlib, GMP, nettle, GnuTLS and curl from their own
  release servers; GnuTLS and nettle keep every linked part compatible with
  git's GPL-2.0-only license. A `source` entry names the listing, the tarball
  (`.tar.gz`, or `.tar.xz` as GnuTLS publishes it) and the signature of such a
  package (git signs the uncompressed tar, the others the archive) and its
  license file. GMP, which nettle uses and which has no tagged public
  repository, is the one exception: it is identified by its signed
  ftp.gnu.org tarball alone, and no commit is recorded for it. As for nano, the signed tarballs of the guest and of every
  library are published under `sources/`. The same build
  also gives `git-remote-https`, a guest of its own that every page installs
  quietly with git, so jj can run git too.

A release server that stays unreachable after the retries is replaced by the
mirrors its `source` names (ftp.gnu.org falls back to mirrors.kernel.org and
mirrors.dotsrc.org, GnuTLS to two mirrors of gnupg.org), and the package's
remaining files are fetched from the mirror that answered. The signature is
checked against the same pinned keys wherever the tarball came from, and a
wrong answer, size or signature never moves on to a mirror. A mirror whose
listing lags gives its own newest signed version. Savannah's tag lookup
likewise asks https.git.savannah.gnu.org, where git.savannah.gnu.org
redirects, when the latter stays unreachable.

Every source build (pitchfork, nano, and git with `git-remote-https`) is
reused instead of compiled again when an earlier trusted main run built the
same `buildKey`.

The run then writes the catalog, installs and runs each tool with
`--version` through the public API in Node, Chromium, Firefox, WebKit and real
Safari on macOS, and assembles the candidate only when all thirty checks pass. This site is built
from that candidate and never resolves `latest` again.

Adding a tool needs an entry in `tools.json`, a demo fixture in
`showcase/fixtures/<name>/app`, the site strings for its card, and system calls
that formicarium supports. A tool that fails acceptance is never deployed.
