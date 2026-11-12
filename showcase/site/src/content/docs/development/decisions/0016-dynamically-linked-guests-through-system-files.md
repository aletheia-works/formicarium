---

title: '0016. Dynamically linked guests through session system files'
description: A Session takes system files outside its roots, such as a dynamic linker, so that Session.run can start a dynamically linked guest; installed guests stay static.
---

- Status: accepted (2026-11-12)
- Decided by: the maintainer, so that ordinary dynamically linked Linux
  programs can run without being rebuilt as static executables

## Context

Since the first npm release (2026-10-08, with the blink core), the runtime has
refused every ELF that names a dynamic linker in a PT_INTERP program header
(`dynamic ELF interpreter is unsupported`). No record gave a reason; the
earlier core could not start such a program, and the documentation described
formicarium as running static executables only.

paludarium 0.12.0 starts a program in its PT_INTERP interpreter, as Linux
does (paludarium #320), and names AMD in CPUID so that glibc runs (#322). With
paludarium 0.14.0, a dynamically linked musl program and a glibc 2.41 one,
both using `dlopen` and libm, and Debian's `ls` and `sort` ran in Node.js once
their dynamic linker and libraries were in the guest's filesystem.

Two things still stopped them in formicarium: the PT_INTERP refusal, and that
a Session's `entries` must lie in `cwd` or `home` (the persistence roots),
while a dynamic linker is looked up at a fixed path such as
`/lib/ld-musl-x86_64.so.1` or `/lib64/ld-linux-x86-64.so.2`. Installed guests
already have a place outside the roots: every run places them in `/usr/bin`
again and never snapshots them.

## Decision

- `SessionOptions` takes `systemEntries`, entries of the same form as
  `entries` (directories, files and symlinks) that every run places outside
  the roots. The Session checks and copies them once; they stay as given for
  its life, through `reset()`, are never snapshotted, and `readFile`,
  `listEntries` and `remove` do not see them. A guest's changes to them last
  only for its run. A CommandSession uses its Session's system files for every
  guest run, installed guests included.
- A system entry may not lie in `cwd`, `home`, `/guest`, `/dev`, `/proc`,
  `/tmp` or `/usr/bin`, and only a directory may hold one of those, so that
  `/usr/lib` can be given while `/usr/bin` stays the installed guests'. A
  symlink's target may not lead into `cwd` or `home` or a directory above them
  (such as `/`), so that the layer and the session's own files stay apart; it
  may lead into `/usr/bin`, as `/bin -> usr/bin` does. At most 4096 entries and 256 MiB of file data.
  Missing parent directories are added. A violation is `INVALID_INPUT`.
- `Session.run` takes a guest with a PT_INTERP header. The header must be one
  absolute path of at most 4096 bytes ending in NUL, and before the run starts
  the Session follows that path, symlinks included, through the files the run
  places (system entries, the session's entries and installed guests). If the
  dynamic linker is not a file there, the run fails with `INVALID_INPUT`
  (`ELF interpreter <path> is not in the session`) and no Worker starts.
- Installed guests stay static: `validateGuest` keeps refusing a PT_INTERP
  header, since a catalog's build information names a static musl target.
- The probe build adds `hello-dynamic`, a libc-only C program with the output
  of `hello`, and the musl dynamic linker it needs. The Node.js regression
  (`tests/node/dynamic-guests.test.ts`), the browser probe in Chromium,
  Firefox and WebKit and the real Safari probe run it with the dynamic linker
  in `systemEntries`.

## Consequences

- A caller can run a dynamically linked program by giving its dynamic linker
  and shared libraries, for example from the distribution the program was
  built for. formicarium ships none of them, so its package size and licenses
  do not change.
- The same layer can hold other files a guest expects at a fixed path outside
  its home, such as CA certificates in `/etc/ssl/certs` for the TLS of
  [0014](/formicarium/development/decisions/0014-guest-tcp-clients-in-nodejs/).
- Every run sends the system files to its Worker, as it does the session's
  files, so a large set of libraries adds to each run's start.
- A program that starts others (`execve`) finds their dynamic linkers through
  the core; the Session checks only the guest it starts.

## Alternatives rejected

- **Shipping a dynamic linker or a C library with formicarium**: glibc is
  under the LGPL, which adds obligations, and either would grow the package
  for every caller, most of whom run static guests.
- **Installed guests with their libraries**: the catalog and install formats
  would change from one ELF to several files, each with its own digest. It
  can follow later on top of the same layer.
- **Allowing `entries` outside the roots**: the session's files would then mix
  with files the caller does not mean to keep, and snapshots, `reset()` and
  the file API would have to tell them apart.
- **Passing PT_INTERP to the core without the early check**: the core then
  fails with `invalid-program`, reported as `EXECUTION`, which does not say
  which file is missing.
