---

title: '0013. Interactive guest runs'
description: A run can stream stdin to its guest and give it a terminal, without a default timeout.
---

- Status: accepted (2026-10-26)
- Decided by: the maintainer, for running nano from the showcase terminal

## Context

Editing a file between commands needs a full-screen editor such as nano. Until
now a run closed the guest's stdin at once and gave it no terminal, so only
batch programs could run. paludarium already accepts a guest stdin stream and a
terminal size (`tty: { columns, rows }`): with it, the guest sees a terminal
(`isatty`, `TCGETS`, `TIOCGWINSZ`) and gets every key byte as it is sent,
because the core has no line discipline. Switching to raw mode (`TCSETS`) fails
with `ENOTTY`, which nano tolerates. paludarium 0.4.0 also reported stdin as
always readable by `poll` and `select`, which kept nano from redrawing while
keys arrived; 0.5.0 reports it readable only with pending input or at its end.
One limit remains in the core: the terminal size cannot change after the guest
starts.

## Decision

- `RunOptions` and `CommandOptions` take two optional fields:
  `stdin: ReadableStream<Uint8Array>` and `terminal: { columns, rows }` (1 to
  65535). Without them a run behaves as before. The command API passes them to
  guest runs only.
- The Session reads `stdin` while the run is live and sends it to the run's
  Worker in `input` messages of at most 64 KiB, then `input-end`; a stream that
  errors ends the input the same way, and a chunk that is not a `Uint8Array`
  ends the run with `INVALID_INPUT`. The run cancels the stream when it
  settles. The Worker queues input that arrives before the core starts. The
  Worker protocol moves to version 2.
- A run with `stdin` has no default timeout, because an interactive guest waits
  for its user; `timeoutMs` and `signal` still apply. Other runs keep the
  600000 ms default.
- Each run still uses a fresh core and commits files only on success
  ([0008](/formicarium/development/decisions/0008-fresh-instance-per-step/)),
  so a file saved in an editor persists like any other command's output.

## Consequences

- The showcase terminal can forward keys to a guest and stop it with its own
  control, since Ctrl-C belongs to the editor.
- The terminal size is fixed for a run.
- nano needs paludarium 0.5.0 or later, which reports stdin readiness
  accurately; the runtime itself is tested with the `ttyecho` guest.

## Alternatives rejected

- **A callback that returns a writer**: a `ReadableStream` is standard in
  Node.js 24 and browsers, composes with `pipeTo`, and has a defined end and
  cancellation.
- **Keeping the 600000 ms default for interactive runs**: an editing session
  can last longer, and the caller already has `signal` to stop it.
