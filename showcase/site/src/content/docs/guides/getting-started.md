---

title: Getting started
description: Use the formicarium showcase terminals and understand their limits.
---

Choose a tool on the [Tools](/formicarium/tools/) page. Each tool page opens a
terminal, places a small sample project in `/work/app` and installs the tool
before the prompt appears. The status line above the terminal tells you what
is happening (isolation, loading, installing, ready, running or an error).

The [empty terminal](/formicarium/terminal/) starts with only nano and git
installed. Type `install aube`, `install pitchfork`, `install biome`,
`install nano`, `install jj` or `install git`, then run the tool, for example
`biome --version`.

## Commands

- `ls [path]`, `cat path`, `cd path`, `rm -rf path`, `cp [-r] src dst` and
  `mv src dst` are built in.
- `clear` empties the terminal and its scrollback in the page; no command runs.
- `install <tool>` installs a tool of the showcase catalog. Only the accepted
  versions listed on the Tools page can be installed.
- Any other first word runs the installed tool of that name.
- A tool the catalog marks for every page (nano) is installed quietly when any
  terminal page starts, so it is there from the start and other tools can open
  it too: `jj describe` without `-m` opens nano to edit the description.
- git and jj can clone from github.com:
  `git clone https://github.com/<owner>/<repo>` or
  `jj git clone https://github.com/<owner>/<repo>`. See [Network](#network).

There is no shell: pipes, redirections, `$` expansion and globbing are refused
with `INVALID_INPUT`. One line is limited to 65536 bytes. Use ↑ and ↓ for the
history of this page, Ctrl-L to clear the screen while keeping the typed line,
and Ctrl-C to cancel a running command or install (except an interactive
tool, below). Tab and
Shift+Tab move the focus out of the terminal.

A tool marked interactive in the catalog takes the keyboard while it runs:
every key, Enter and Ctrl-C included, goes to the tool, which sees a terminal
of the size the page's terminal has when the tool starts (it does not follow
later resizes). A Stop button below the terminal ends the run
(`ABORTED`).

## Network

Only git and jj get a network, and only to `github.com:443`. A browser page
has no TCP sockets, so their connections go through Aletheia Works' relay on
AWS (a WebSocket relay on AWS Lambda MicroVMs). Before the first git or jj
command, the page asks the relay's token function for a token that lasts 15
minutes and reuses it until a minute before it expires. The token function
answers only requests whose `Origin` is this site, and the relay itself
connects to github.com:443 and nowhere else. TLS runs inside the guest, so the
relay sees only encrypted bytes. The guest checks github.com's certificate
against Mozilla's CA certificates as curl extracts them, which the page writes
to `/root/.config/ssl/cacert.pem` when the session starts. If the relay cannot
be reached, the command runs without the network and says so first, so local
work (`jj log`, `git status`) goes on while clone and fetch fail; type it
again to retry. `git push` and `jj git push` do not work, since the page has
no credentials.

## Limits

- Nothing is saved. Reloading or leaving the page discards the session.
- Other tools have no network access, and package lifecycle scripts do not
  run.
- Very long output is trimmed on screen (1 MiB or 10000 lines); a note below
  the terminal says how much was omitted.

## Browser requirements

The terminal needs a secure context, `SharedArrayBuffer` and cross-origin
isolation. GitHub Pages cannot send the COOP/COEP headers, so a service worker
(`coi-serviceworker.js`) adds them and reloads the terminal page once. If your
browser blocks service workers, allow them for this site and reload. The
documentation pages and the Tools page never load the terminal or a guest.
