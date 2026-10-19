---
title: Getting started
description: Use the formicarium showcase terminals and understand their limits.
---

Choose a tool on the [Tools](/formicarium/tools/) page. Each tool page opens a
terminal, places a small sample project in `/work/app` and installs the tool
before the prompt appears. The status line above the terminal tells you what
is happening (isolation, loading, installing, ready, running or an error).

The [empty terminal](/formicarium/terminal/) starts with nothing installed.
Type `install aube`, `install pitchfork` or `install biome`, then run the tool,
for example `biome --version`.

## Commands

- `ls [path]`, `cat path`, `cd path` and `rm -rf path` are built in.
- `install <tool>` installs a tool of the showcase catalog. Only the accepted
  versions listed on the Tools page can be installed.
- Any other first word runs the installed tool of that name.

There is no shell: pipes, redirections, `$` expansion and globbing are refused
with `INVALID_INPUT`. One line is limited to 65536 bytes. Use ↑ and ↓ for the
history of this page and Ctrl-C to cancel a running command or install. Tab and
Shift+Tab move the focus out of the terminal.

## Limits

- Nothing is saved. Reloading or leaving the page discards the session.
- Guests have no network access, and package lifecycle scripts do not run.
- Very long output is trimmed on screen (1 MiB or 10000 lines); a note below
  the terminal says how much was omitted.

## Browser requirements

The terminal needs a secure context, `SharedArrayBuffer` and cross-origin
isolation. GitHub Pages cannot send the COOP/COEP headers, so a service worker
(`coi-serviceworker.js`) adds them and reloads the terminal page once. If your
browser blocks service workers, allow them for this site and reload. The
documentation pages and the Tools page never load the terminal or a guest.
