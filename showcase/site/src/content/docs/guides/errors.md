---

title: Error codes
description: The ExecutionError codes and when each one is raised.
---

Every failure of a Session, an installer or a command session is an
`ExecutionError`: invalid input throws one with `INVALID_INPUT`, and a host or
core failure rejects with one. A guest that
exits, even with a nonzero exit code, is not an error: its run resolves with
the `exitCode`. Every code is in the exported `ERROR_CODES`, and `error.code`
is always one of them.

An `ExecutionError` carries:

- `code`, one of the codes below.
- `stdout` and `stderr`, the bytes the guest wrote before the failure (empty
  when it never ran). They are new arrays and never shared.
- `runId`, for a failed guest run.
- `cause`, when the run failed inside the Worker: the first four errors of the
  original cause chain, by name, with the message only of an engine
  `RangeError`, a WebAssembly error or the core's `PaludariumError`
  ([runtime architecture](/formicarium/development/architecture/)). Caller data
  such as paths or env values stays in the Worker.

A failed or cancelled run leaves the Session's files and working directory as
they were, and a failed install keeps the old registration.

## Codes

| Code              | Raised when                                                                                                                                                                                                                                                                          |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `INVALID_INPUT`   | An argument breaks its rules: a malformed option, path, guest, catalog or command line, checked before anything starts. An install also refuses a download whose size, archive, ELF or digest is wrong.                                                                              |
| `ASSET_LOAD`      | The package Worker or a core file is missing, or does not match the SHA-256 in `assets/paludarium/build-info.json`; for an install, an HTTP, CORS, redirect, body or network failure.                                                                                                |
| `UNSUPPORTED_ENV` | The platform lacks something: Node.js older than 24; in a browser, no Worker, `SharedArrayBuffer` or cross-origin isolation, a Worker URL on another origin, or `network` without `network.relay`; for an install, a host without `crypto.subtle`, `fetch` or `DecompressionStream`. |
| `CORE_INIT`       | The emulator core failed to start.                                                                                                                                                                                                                                                   |
| `EXECUTION`       | The run failed inside the Worker or between it and the Session, for example a WebAssembly trap or a message the Session could not accept.                                                                                                                                            |
| `SNAPSHOT`        | The Worker did not return a complete, valid snapshot of the files after the run, so nothing from that run is kept.                                                                                                                                                                   |
| `TIMEOUT`         | A run outlasted `timeoutMs` (600000 ms by default; no limit by default with `stdin`), or an install outlasted its 120 s fetch or 180 s total limit.                                                                                                                                  |
| `ABORTED`         | The caller's `AbortSignal` was aborted, before or during the operation, or `reset` cancelled it.                                                                                                                                                                                     |
| `BUSY`            | Another run, install or command already holds the Session.                                                                                                                                                                                                                           |
| `DISPOSED`        | The Session was disposed.                                                                                                                                                                                                                                                            |
| `NOT_FOUND`       | The guest or tool is not registered, or a path does not exist.                                                                                                                                                                                                                       |
| `NOT_FILE`        | A path that must be a regular file is not one (`readFile`, `cat`, `cp` without `-r`), or a working directory is not a directory.                                                                                                                                                     |

The [install API](/formicarium/guides/install-api/) and the
[command API](/formicarium/guides/command-api/) give the order in which they
check these and their own conditions.
