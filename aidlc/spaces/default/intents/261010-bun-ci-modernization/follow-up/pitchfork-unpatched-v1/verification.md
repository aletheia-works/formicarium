# Obsolete pitchfork patch removal — separate PR

PR: https://github.com/aletheia-works/formicarium/pull/10
Base: 84e8995f300d9123dd8fcc2b250b62dd5bc7d8f0
Head: 71ac52050521ab85e3d307afef703ed924f6d381 (signature Verified)

User explicitly requested removing the obsolete patch and related processing in a separate PR. Upstream latest release v2.30.1 and lifecycle.rs:1407 independently read via GitHub API: `libc::ioctl(0, libc::TIOCSCTTY as _, 0)`.

Removed patch file, application/reverse-check/copy/hashing and mandatory distribution patch digest check. Build source cache must have no tracked source modifications. Updated metadata test and unpatched distribution staging acceptance; retained source identity/static-musl/ELF/digest validation. Historical patched build evidence retained.

検証済み: frozen install/typecheck/build/check/test-light; 177+96 passed, 2 existing skips. bash -n and shellcheck -x -P SCRIPTDIR passed. PR template body and head SHA read back through connector after permitted CLI creation (connector write 403).

未検証: full clean musl rebuild and native/browser guest execution on this PR. Main candidate run 38099515705 targets unchanged base SHA, not this PR. PR is open; no main merge authorized or performed.

GitHub CI verification: ordinary CI 38099806822 passed quality, commit-format and ci-required at head 71ac52050521ab85e3d307afef703ed924f6d381. Shared commitlint 38099807283, dependency review 38099806695, labeler 38099806727, assignment and lint autofix 38099806867 all succeeded; Dependabot auto-merge intentionally skipped for this human PR. Full musl rebuild/native/browser execution remains unverified, separate from this successful ordinary CI.
