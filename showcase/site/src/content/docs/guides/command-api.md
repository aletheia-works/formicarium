---

title: Command API
description: One command line routed to the Session's builtins, installs and guests.
---

`createCommandSession` interprets one line of text and routes it to an existing
Session and its installer. The root entry exports it with `CommandOptions`,
`CommandResult` and `CommandSession`. A command session copies no working
directory, files or registered guests, and reimplements no fetching, extraction
or validation: all state stays in the Session you pass.

## Example

```js
import { createSession } from '@aletheia-works/formicarium/node';
import {
  createCommandSession,
  ExecutionError,
} from '@aletheia-works/formicarium';

// catalog is a GuestCatalog the caller prepared, with fixed URLs, every digest
// and the build information.
const session = await createSession();
try {
  const shell = createCommandSession(session, { catalog });
  await shell.execute('install aube');
  const result = await shell.execute('aube --version');
  // Original bytes. Decode them in the UI and show them with textContent.
  console.log(result.exitCode, new TextDecoder().decode(result.stdout));
} catch (error) {
  if (error instanceof ExecutionError) console.error(error.code);
  throw error;
} finally {
  await session.dispose();
}
```

In a browser, import `createSession` from `@aletheia-works/formicarium/browser`
and meet the cross-origin isolation, Worker, asset and CSP requirements of the
package README.

`createCommandSession(session, { catalog }): CommandSession` synchronously
checks that the Session comes from the same package instance and that the
catalog follows the [install API](/formicarium/guides/install-api/)
rules. Otherwise it throws `INVALID_INPUT` and leaves the Session unchanged. It
creates one installer internally; the returned object has only `execute` and
never hands out the Session, the installer or the internal port.

`shell.execute(input, { signal?, onProgress?, onOutput?, stdin?, terminal?, network? }): Promise<CommandResult>`
runs one command. `stdin` (a `ReadableStream<Uint8Array>`) and `terminal`
(`{ columns, rows }`, 1 to 65535) go to guest runs only, as in the Session's
`run` ([ADR 0013](/formicarium/development/decisions/0013-interactive-guest-runs/)):
the guest reads the stream as its stdin and sees a terminal of that size. A
run with a terminal also gets `TERM=xterm-256color`, since the terminal that
shows it is xterm-compatible; without `TERM`, a curses guest may assume a
terminal it does not know. Builtins and `install` never read them. A stream
that is not an unlocked `ReadableStream`, or a malformed `terminal`, is
`INVALID_INPUT` before the reservation.

`network` (`{ allow, relay? }`) also goes to guest runs only, as in the Session's `run`
([ADR 0014](/formicarium/development/decisions/0014-guest-tcp-clients-in-nodejs/)):
in Node.js the guest can open TCP connections to the listed destinations, so
`jj git clone https://github.com/...` works with `{ allow: ['github.com:443'] }`
once `jj`, `git` and `git-remote-https` are installed and the guest has CA
certificates. Only the working directory and the home directory carry over,
so keep the certificates in the home directory and name them with
`http.sslCAInfo` in `~/.gitconfig`. A browser session needs `relay`, a WebSocket
relay that connects for the guest
([ADR 0015](/formicarium/development/decisions/0015-guest-network-in-browser-through-a-relay/)),
and refuses `network` without it with `UNSUPPORTED_ENV`. A malformed list or
relay is `INVALID_INPUT` before the reservation. `install` fetches on
the host and does not use it.

## Syntax

- The input is a string of at most 65536 UTF-8 bytes (measured after
  `TextEncoder`); 65537 or more is `INVALID_INPUT`.
- A lone surrogate (`String.prototype.isWellFormed()` is `false`) is
  `INVALID_INPUT`, not replaced with U+FFFD.
- LF, CR and NUL are `INVALID_INPUT`, inside or outside quotes.
- Arguments are separated by ASCII space and tab only. Runs of separators count
  once, and leading and trailing ones are ignored. NBSP, ideographic spaces and
  other non-ASCII characters stay part of the argument, unnormalized.
- Outside quotes, `|` `&` `;` `<` `>` `$` backtick `*` `?` `(` `)` `{` `}` are
  refused as "shell syntax is unsupported". `[` `]` `~` `#` `!` `=` and similar
  stay literal.
- Inside single quotes everything is literal up to the closing quote.
- Inside double quotes only `\"` and `\\` are escapes; any other `\x` stays two
  characters. `$` and backtick are not expanded.
- Outside quotes `\x` becomes `x`, which also makes separators and symbols
  literal.
- `''` and `""` are empty arguments. Adjacent quoted and unquoted parts join
  into one argument.
- An unterminated quote ("unterminated quote") and a trailing backslash outside
  quotes ("trailing backslash") are refused.
- Input of only spaces and tabs (or empty) resolves as `kind: 'empty'` with exit
  code 0 and empty bytes, and takes no reservation.

## Routing and reserved names

Routing is by the exact `argv[0]`.

| `argv[0]` | Accepted forms                | Action                                                                                                 |
| --------- | ----------------------------- | ------------------------------------------------------------------------------------------------------ |
| `ls`      | `ls`, `ls path`               | One `listEntries` on the Session. An argument starting with `-` or two or more arguments are refused   |
| `cat`     | `cat path`                    | Takes the filesystem reservation once; the original bytes go to stdout                                 |
| `cd`      | `cd path`                     | Takes the filesystem reservation once; changes the working directory                                   |
| `rm`      | `rm -rf path`                 | Takes the filesystem reservation once; removes. `rm -r -f`, `rm -fr`, `rm path` and others are refused |
| `cp`      | `cp src dst`, `cp -r src dst` | Takes the filesystem reservation once; copies. Other flags, `--` and three or more paths are refused   |
| `mv`      | `mv src dst`                  | Takes the filesystem reservation once; moves. Flags, `--` and three or more paths are refused          |
| `install` | `install selection`           | One catalog install. URLs are not accepted (selection rules as in the install API)                     |
| any other | `tool [args...]`              | Runs the registered tool; `NOT_FOUND` when it is not registered                                        |

`ls` of a path that is not a directory, such as a file, prints nothing and
exits with 0; `cd` to one fails with `NOT_FILE`.

`ls`, `cat`, `rm`, `cd`, `cp`, `mv` and `install` are reserved. A guest can be registered
under one of these names (for example `install ls@x` registers a tool `ls`), but
a command cannot run it, and `ls` stays the builtin. `pwd` is not a builtin; it
is `NOT_FOUND` unless a guest is registered under that name.

Every run of the Session, from a command or a direct `Session.run`, finds each
registered guest as the file `/usr/bin/<tool>`. `/usr/bin` is on the guest's
default `PATH`, so a guest can start another by name; for example, jj opens nano
as its editor. These files are placed again for each run and are not the
Session's files: `ls` and snapshots do not show them, and what a run writes
there is dropped. So a `cwd` or `home` in `/usr/bin` or above it is
`INVALID_INPUT`. A command that runs a registered guest starts it from
`/usr/bin/<tool>`, so its `argv[0]` is that path, as when another guest runs
it; a guest given to `Session.run` starts from `/guest/program`.

Paths are guest paths; the Session normalizes and resolves them. The command
API reads no host filesystem, URL or environment variable. A path that does not
start with `/` resolves against the Session's current working directory (with
`/work` as the working directory, `cat a.txt` is `/work/a.txt` and `ls .` is
`/work`). `cat`, `cd`, `rm`, `cp` and `mv` resolve after taking the filesystem reservation,
and `ls` calls `listEntries` in the same tick as it resolves, so the directory
used to resolve is the one the operation sees. An empty path, a path containing
NUL and a path with a `..` segment (relative or absolute; `a..b` is a name) are refused with
`INVALID_INPUT` before the reservation and change nothing. A path outside the
persisted roots, or removing a root itself, is the Session's `INVALID_INPUT` as
before.

`cp` and `mv` follow POSIX where they can:
- When `dst` is an existing directory, the entry goes inside it under its own
  name; otherwise it goes to `dst`, whose parent must already be a directory
  (`NOT_FOUND` when it does not exist). Symlinks are not followed: a symlink
  to a directory as `dst` is an existing symlink, which `mv` replaces and `cp`
  refuses.
- `cp` copies one regular file (a directory or symlink is `NOT_FILE`); `cp -r`
  also copies a directory tree, and copies symlinks as symlinks with the same
  target. Copies get new inodes and the source's mode, as without `cp -p`, so
  hard links inside a copied tree become separate files.
  Copying over an existing file keeps that file's mode and inode, so its hard
  links see the new bytes.
- `mv` renames an entry with its subtree and keeps its inodes. A file or
  symlink replaces an existing file or symlink. When the cwd is inside a moved
  directory, the cwd follows it.
- `INVALID_INPUT` and no change: a directory never overwrites or is
  overwritten, an entry cannot go into itself, the source and destination
  cannot be the same file, a persistence root cannot be moved, and a symlink
  whose target would leave the persistence roots at its new place is refused.
- A path that starts with `-` is refused as a flag; write it as `./-x`.

`ls` prints a directory as `name/`, a symlink as `name -> target` and a file as
`name`, sorted by the whole printed string in UTF-16 code unit order (the
JavaScript default sort; `a.b` comes before `a/`). Each line ends with a
newline, and no entries give empty stdout.

A successful install prints one line, `installed <tool>@<versionOrName> (sha256 <digest>)`,
with empty stderr. `installation` holds the same `InstallResult` as the install
API.

## Order of checks

1. `INVALID_INPUT`: the shape of the options, the input's type, length and
   characters, the tokenizer, the forms of builtins and `install`, path syntax
   (empty, NUL, `..`) and the catalog selection, all before the reservation.
2. `ABORTED`: `signal` was already aborted before the reservation.
3. `DISPOSED` and `BUSY`: the state when taking the reservation (after
   `dispose`, or while another operation holds it).

A refused input changes no files, working directory or registered guests.
Failures after the reservation follow the Session's and the installer's own
contracts (`NOT_FOUND` for an unregistered tool, the old registration kept when
an install fails).

## Cancellation and timeouts

- `signal` is checked before the reservation; if it is already aborted, the
  call rejects with `ABORTED` without taking the reservation.
- `ls`, `cat`, `cd`, `rm`, `cp` and `mv` complete synchronously inside the Session. A signal
  raised after they start does not interrupt them, and the completed result is
  returned.
- `install` and guest runs pass the signal to the installer and to the
  Session's run; a cancelled result follows their contracts (`ABORTED`, the old
  registration kept). The command API has no retries, queue or fallback.
- There is no timeout option. Guest runs use the Session's default (600000 ms,
  or none with `stdin`, since an interactive guest waits for its user);
  installs keep their 120 s fetch and 180 s total limits.
- A guest that exits normally resolves as `kind: 'guest'`, even with a nonzero
  exit code. Host, core, timeout and cancellation failures reject with
  `ExecutionError`.
- A guest run is identified by `runId`, an install by `installation.operationId`.

## Result bytes and the UI

`stdout` and `stderr` are new `Uint8Array` values on every call, never shared
with internal buffers or the Session's files. The command API does not truncate
the result, decode it, or evaluate it as HTML or code.

These belong to the embedding UI, not to the command API, and are tested there:
- telling loading, empty and error states apart
- keyboard operation
- telling an unknown progress total (`totalBytes: null`) from zero
- showing times with their offset
- decoding bytes for display, handling control characters, and the display
  limits (1048576 bytes, 10000 lines)

The command API passes `Progress` from the installer and `OutputChunk` from the
guest run on unchanged.

## Tests

The unit tests are `tests/package/command-*.test.ts`. They run in ordinary CI
(`test:node-unit`) and in the release candidate's package coverage. In real
Safari on macOS, CI runs `install <tool>`, the installed tool, `ls`, `cat`, `cd`
and `rm -rf` through a command session (`tests/browser/safari-probe.test.ts`).
The same checks run in Safari on iOS in an iOS 26 Simulator; iOS 27 is not run, because safaridriver finds no iOS Simulator with Xcode 27, which replaced Simulator.app with Device Hub. A WebKit result is not taken as a Safari pass.
