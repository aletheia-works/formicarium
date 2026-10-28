---

title: Install API
description: Fetch, verify and register guests from a fixed catalog.
---

`createInstaller` fetches a guest from a catalog that the caller provides,
verifies it and registers it in an existing Session. The root entry exports it
with its types. Create the Session with the Node.js or browser entry of the same
package instance. There is no automatic discovery of public catalogs, no
resolution of "latest" and no persistent cache. Running a registered guest by
name is the [command API](/formicarium/development/command-api/).

## Example

```js
import { createSession } from '@aletheia-works/formicarium/node';
import { createInstaller, ExecutionError } from '@aletheia-works/formicarium';

// catalog is a GuestCatalog the caller prepared, with fixed URLs, every digest
// and the build information.
const session = await createSession();
const controller = new AbortController();
try {
  const installer = createInstaller(session, catalog);
  const result = await installer.install('aube@2.7.0', {
    signal: controller.signal,
    onProgress(progress) {
      // Show it in a UI with textContent or similar.
      console.log(progress.phase, progress.processedBytes, progress.totalBytes);
    },
  });
  console.log(
    result.tool,
    result.versionOrName,
    result.digest,
    result.buildKey,
  );
} catch (error) {
  if (error instanceof ExecutionError) console.error(error.code);
  throw error;
} finally {
  await session.dispose();
}
```

Pass your own verified catalog; do not fill URLs or digests with example values.
In a browser, import `createSession` from `@aletheia-works/formicarium/browser`
and meet the cross-origin isolation, Worker, asset and CSP requirements of the
package README.

`createInstaller(session, catalog): Installer` synchronously checks that the
Session is genuine, validates the whole catalog and copies it. It does no
network access, and later changes to the original catalog do not reach the
installer. Invalid input throws `ExecutionError` synchronously.

`installer.install(selection, { signal?, onProgress? }): Promise<InstallResult>`
fetches, verifies and registers once. `tool` selects the version in `defaults`;
`tool@versionOrName` selects only the exactly matching entry. A missing default,
an unknown version, more than one `@` or a URL as selection is refused. There is
no implicit version search, retry or fallback.

## What an install gives you

A successful install registers the guest in the Session under its tool name,
until `reset()` or `dispose()`. `install <tool>` in a
[command session](/formicarium/development/command-api/) is this same install.
After it:
- the command session runs the tool by name;
- every guest run finds it as `/usr/bin/<tool>` (on the default PATH), so one
  tool can start another;
- nothing was written to any output, so a page can install tools before the
  user types anything (see the
  [embedding guide](/formicarium/guides/embedding/#tools-ready-from-the-start)).

To register guest bytes that do not come from a catalog, check them with
`validateGuest` and pass the result to `registerValidatedGuest(session, tool,
guest)`; the registration behaves the same.

## Catalog

The published types are `GuestCatalog`, `CatalogEntry` and `GuestBuildInfo`.

| `GuestCatalog` field | Content                                                                                       |
| -------------------- | --------------------------------------------------------------------------------------------- |
| `schemaVersion`      | The number `1`                                                                                |
| `catalogId`          | A non-empty identifier, at most 128 UTF-8 bytes                                               |
| `defaults`           | Tool name to a fixed `versionOrName`; each must name an entry                                 |
| `entries`            | `CatalogEntry` values, no duplicate tool/version. An empty list is valid but installs nothing |

| `CatalogEntry` field               | Content                                                        |
| ---------------------------------- | -------------------------------------------------------------- |
| `tool` / `versionOrName`           | Fixed identifiers that match the metadata                      |
| `url`                              | An HTTPS URL without credentials or fragment                   |
| `format`                           | `elf` or `tar.gz`                                              |
| `archiveEntry`                     | The relative POSIX path to select in a `tar.gz`; not for `elf` |
| `downloadSha256` / `downloadBytes` | SHA-256 and size of the downloaded bytes                       |
| `elfBytes`                         | Size of the fetched or extracted ELF                           |
| `buildInfo`                        | The whole `GuestBuildInfo`                                     |
| `buildInfoSha256`                  | SHA-256 of the canonical JSON UTF-8 bytes of `buildInfo`       |

SHA-256 values are 64 lowercase hex digits. For a raw ELF, `downloadBytes`
equals `elfBytes` and `downloadSha256` equals `buildInfo.elfSha256`; a `tar.gz`
states the compressed bytes and the selected ELF separately.

`GuestBuildInfo` has `schemaVersion`, `tool`, `versionOrName`, `source` (HTTPS
repository and full 40-digit commit), `target` = `x86_64-unknown-linux-musl`,
`rustc` (a string or `null`), `sourcePatches`, `dependencies`, `builderHash`,
`buildKey` and `elfSha256`. Dependencies and patches need fixed identities too.
`buildKey` and the canonical metadata digest follow the same rules as
`validateGuest`. Unknown JSON fields are copied and kept in the canonical
identity, so do not drop them when computing digests.

The API cannot recover duplicate keys that were lost when the JSON became an
object; reject them when you parse raw JSON. Lone surrogates, cycles and
non-integer numbers are refused as canonical input.

## Network and limits

Node.js needs version 24 or later and absolute HTTPS URLs. In a browser, a
relative URL resolves against the document origin and must still be HTTPS;
Node.js has no implicit origin. Match CORS and the CSP `connect-src` to where
the guests are served.

Credentials are omitted. Node.js checks each redirect target, up to 5 hops;
browsers use `redirect: 'error'`, so serve guests from URLs that do not
redirect. HTTP errors, CORS failures, opaque responses and interrupted bodies
are never treated as success.

| Boundary                           | Limit            |
| ---------------------------------- | ---------------- |
| Catalog / canonical build metadata | 4 MiB / 1 MiB    |
| Download / ELF                     | 128 MiB each     |
| Archive expansion / entries        | 256 MiB / 4096   |
| Archive path                       | 4096 UTF-8 bytes |
| Fetch / whole install              | 120 s / 180 s    |

The installer checks the digest, declared size and metadata of the download and
of the ELF. A `tar.gz` is decompressed with `DecompressionStream`; every entry's
bounds, path, duplicates, links and end are checked before the selected ELF is
used. Nothing is extracted to the host filesystem. Only a copy carrying a
genuine `validateGuest` handle is registered, and no reference to the fetched
bytes is returned.

## Reservation, cancellation and result

Install, run, registration and filesystem calls share the Session's single
reservation; a conflicting call is refused with `BUSY` instead of waiting. Only
a successful install replaces the guest of the same tool, atomically. A failed
fetch or check, or a cancellation, leaves the old guest, files and working
directory as they were. `reset()` and `dispose()` still clear every
registration.

The installer checks the `AbortSignal`, `reset`, `dispose` and its deadlines
and cleans up. It cannot interrupt the synchronous `validateGuest` check, so it
checks cancellation and time right after it. The first terminal reason is kept;
a late response never resumes registration or notifications, and an abort after
commit does not turn a success into a failure.

`InstallResult` has `operationId`, `tool`, `versionOrName`, the ELF `digest` and
`buildKey`. It contains no guest handle and no output.

`Progress` has `operationId`, an increasing `sequence`, `phase` (`fetch`,
`extract` for `tar.gz` only, `digest`, `validate`, `register`),
`processedBytes` and `totalBytes`. An unknown total is `null`, distinct from
`0`. An exception in the callback does not change the install's result, and no
notification follows the end. Calling back into the same Session from the
callback can be refused with `BUSY`.

| Error code                         | Main conditions                                                                      |
| ---------------------------------- | ------------------------------------------------------------------------------------ |
| `INVALID_INPUT`                    | Invalid catalog, selection, size, archive, ELF, digest or metadata; a forged Session |
| `ASSET_LOAD`                       | HTTP, CORS, redirect, body or network failure                                        |
| `UNSUPPORTED_ENV`                  | A missing platform feature                                                           |
| `BUSY`                             | Another operation holds the Session                                                  |
| `ABORTED` / `DISPOSED` / `TIMEOUT` | Cancelled by the caller or `reset`, disposed, deadline                               |

## Tests

The unit tests are `tests/package/install-*.test.ts`. They run in ordinary CI
(`test:node-unit`) and in the release candidate's package coverage. In real
Safari on macOS, CI installs catalog guests over HTTPS
(`tests/browser/safari-probe.test.ts`): a raw ELF, a `tar.gz` entry whose
progress goes through fetch, extract, digest, validate and register in order,
and an install cancelled at its first progress event, which registers nothing.
The same checks run in Safari on iOS in an iOS 26 Simulator; iOS 27 is not run, because safaridriver finds no iOS Simulator with Xcode 27, which replaced Simulator.app with Device Hub. A WebKit result is not taken as a Safari pass.
