import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import {
  readConfigFile,
  type ToolConfig,
  validateToolsConfig,
} from '../scripts/config.ts';
import { causeOf } from '../scripts/errors.ts';
import { createGitHubApi } from '../scripts/github.ts';
import {
  copyingOf,
  latestVersion,
  lsRemoteCommit,
  processExec,
  signatureNameOf,
  verifySignature,
} from '../scripts/gnu.ts';
import { resolveGnuTool } from '../scripts/resolve.ts';
import { commit, fakeFetch, sha } from './fixtures/github.ts';
import {
  GIT_SOURCES,
  gitTagRoutes,
  gnuExec,
  gnuOptions,
  gnuRoutes,
  gnuTarball,
  ncursesTagRoutes,
  SIGNERS,
  xzTarball,
} from './fixtures/gnu.ts';
import { pax, tgz } from './fixtures/tar.ts';
import { MAIN_ALLOWED } from './fixtures/work.ts';

const nano = (
  (await readConfigFile('tools.json')) as { tools: ToolConfig[] }
).tools.find((item) => item.tool === 'nano')!;
const pkg = { package: 'nano', signers: [SIGNERS.nano!] };
const data = new Uint8Array([1, 2, 3]);
const rejects = (promise: Promise<unknown>, code: string) =>
  assert.rejects(promise, (error) => causeOf(error) === code);
const api = () => createGitHubApi({ fetchImpl: fakeFetch(ncursesTagRoutes()) });
const git = validateToolsConfig(
  await readConfigFile('tools.json'),
  JSON.parse(MAIN_ALLOWED),
).tools.find((item) => item.tool === 'git')!;
const gitApi = () => createGitHubApi({ fetchImpl: fakeFetch(gitTagRoutes()) });

test('the latest version is the highest signed tarball, compared by number', () => {
  const page = [
    'nano-9.10.tar.gz',
    'nano-9.10.tar.gz.sig',
    'nano-9.9.tar.gz',
    'nano-9.9.tar.gz.sig',
    'nano-10.0.tar.gz',
    'nano-9.3.1.tar.xz',
    'nano-9.3.1.tar.xz.sig',
    'nano-tiny-11.0.tar.gz',
    'nano-tiny-11.0.tar.gz.sig',
  ]
    .map((name) => `<a href="${name}">${name}</a>`)
    .join('\n');
  // 10.0 has no signature and the .tar.xz and nano-tiny entries never match.
  assert.equal(latestVersion(page, 'nano'), '9.10');
  assert.throws(
    () => latestVersion('<a href="nano-9.3.tar.gz">x</a>', 'nano'),
    (error) => causeOf(error) === 'release-invalid',
  );
});

test('a package with its own source takes links with any prefix and no listed signature', () => {
  const page = [
    'curl-8.9.1.tar.gz',
    '/download/curl-8.23.0.tar.gz',
    'https://example.org/releases/curl-8.22.0/curl-8.22.0.tar.gz',
    '/download/curl-9.0.0.tar.xz',
    'curl-tiny-10.0.0.tar.gz',
    '/download/curl-10.0.0-rc1.tar.gz',
  ]
    .map((href) => `<a href="${href}">x</a>`)
    .join('\n');
  // Absolute-path and absolute links count; .tar.xz, curl-tiny and a
  // pre-release never match, and no signature needs to be listed.
  assert.equal(latestVersion(page, 'curl', { anyPrefix: true }), '8.23.0');
  // The GNU listing keeps its rule: relative links with a listed .sig only.
  assert.throws(
    () => latestVersion(page, 'curl'),
    (error) => causeOf(error) === 'release-invalid',
  );
  assert.throws(
    () =>
      latestVersion('<a href="/curl-8.tar.gz">x</a>', 'curl', {
        anyPrefix: true,
      }),
    (error) => causeOf(error) === 'release-invalid',
  );
});

test('latestVersion reads the href attribute in any case, as zlib.net writes HREF', () => {
  // zlib.net links the tarball with HREF and its signature with href.
  const page = [
    '<A HREF="zlib-1.3.2.tar.gz">zlib source code, version 1.3.2, tar.gz format</A>',
    '<a href="zlib-1.3.2.tar.gz.asc">GPG signature</a>',
  ].join('\n');
  assert.equal(latestVersion(page, 'zlib', { anyPrefix: true }), '1.3.2');
});

test('a signature counts only when every signature in it is good and by a pinned primary key', async () => {
  const calls: string[][] = [];
  assert.equal(
    await verifySignature(pkg, data, data, {
      exec: gnuExec({ calls }),
      keys: '/keys',
    }),
    SIGNERS.nano,
  );
  assert.equal(calls[0]![0], 'gpgv');
  assert.deepEqual(calls[0]!.slice(1, 5), [
    '--keyring',
    '/keys/nano.gpg',
    '--status-fd',
    '1',
  ]);
  const good = `[GNUPG:] GOODSIG X Someone\n[GNUPG:] VALIDSIG A 0 0 0 4 0 1 10 00 ${SIGNERS.nano}\n`;
  for (const status of [
    // Expired key, bad signature, revoked key.
    `[GNUPG:] EXPKEYSIG X Someone\n[GNUPG:] VALIDSIG A 0 0 ${SIGNERS.nano}\n`,
    `[GNUPG:] BADSIG X Someone\n${good}`,
    `${good}[GNUPG:] REVKEYSIG X Someone\n`,
    // A good signature without its VALIDSIG, none, a key that is not
    // pinned, and two signatures of which one key is not pinned.
    `${good}[GNUPG:] GOODSIG Y Other\n`,
    '[GNUPG:] NEWSIG\n',
    good.replace(SIGNERS.nano!, SIGNERS.ncurses!),
    `${good}${good.replace(SIGNERS.nano!, SIGNERS.ncurses!)}`,
  ])
    await rejects(
      verifySignature(pkg, data, data, { exec: gnuExec({ status }) }),
      'signature-invalid',
    );
  // GnuTLS signs each release with two pinned keys: both must be good.
  const both = {
    package: 'gnutls',
    signers: [SIGNERS.nano!, SIGNERS.ncurses!],
  };
  assert.equal(
    await verifySignature(both, data, data, {
      exec: gnuExec({
        status: `${good}${good.replace(SIGNERS.nano!, SIGNERS.ncurses!)}`,
      }),
    }),
    SIGNERS.nano,
  );
  await rejects(
    verifySignature(pkg, data, data, {
      exec: () => {
        throw Error('gpgv exited with 1');
      },
    }),
    'signature-invalid',
  );
  // A gpgv that stalls keeps its deadline instead of reading as a bad
  // signature.
  await rejects(
    verifySignature(pkg, data, data, {
      exec: () => processExec(300)('sh', ['-c', 'sleep 30']),
    }),
    'deadline',
  );
});

test('git ls-remote gives the peeled commit of a Savannah tag', async () => {
  const repository = 'https://git.savannah.gnu.org/git/nano.git';
  assert.equal(
    await lsRemoteCommit(repository, 'v9.3', gnuExec()),
    commit('nano'),
  );
  assert.equal(
    await lsRemoteCommit(
      repository,
      'v9.3',
      () => `${commit('light')}\trefs/tags/v9.3\n`,
    ),
    commit('light'),
  );
  for (const exec of [() => '', () => 'not-a-commit\trefs/tags/v9.3\n'])
    await rejects(
      lsRemoteCommit(repository, 'v9.3', exec),
      'commit-unreachable',
    );
  // A failed git run is retried twice on each host and reports git's own
  // message.
  let runs = 0;
  const offline = () => {
    runs++;
    throw Object.assign(new Error('git exited with 128'), {
      stderr: '\nfatal: unable to access the repository: Connection reset\n',
    });
  };
  await assert.rejects(
    lsRemoteCommit(repository, 'v9.3', offline, [0, 0]),
    /offline: git ls-remote https:\/\/https\.git\.savannah\.gnu\.org\/git\/nano\.git failed: fatal: unable to access the repository: Connection reset$/,
  );
  assert.equal(runs, 6);
  let flaky = 0;
  assert.equal(
    await lsRemoteCommit(
      repository,
      'v9.3',
      (file, args) => {
        if (flaky++ === 0) throw Error('reset');
        return gnuExec()(file, args);
      },
      [0, 0],
    ),
    commit('nano'),
  );
});

test('an unreachable Savannah host falls back to its https.git frontend', async () => {
  // git.savannah.gnu.org has failed CI's TLS handshakes for whole runs; it
  // now redirects to https.git.savannah.gnu.org, which serves the same refs.
  const repository = 'https://git.savannah.gnu.org/git/nano.git';
  const asked: string[] = [];
  const exec = (file: string, args: readonly string[]) => {
    asked.push(args[2]!);
    if (args[2] === repository)
      throw Object.assign(new Error('git exited with 128'), {
        stderr: "fatal: unable to access 'x': gnutls_handshake() failed\n",
      });
    return gnuExec()(file, args);
  };
  assert.equal(
    await lsRemoteCommit(repository, 'v9.3', exec, [0, 0]),
    commit('nano'),
  );
  assert.deepEqual(asked, [
    repository,
    repository,
    repository,
    'https://https.git.savannah.gnu.org/git/nano.git',
  ]);
  // A tag that is missing is an answer, not a transport failure.
  const empty: string[] = [];
  await rejects(
    lsRemoteCommit(
      repository,
      'v9.3',
      (_file, args) => {
        empty.push(args[2]!);
        return '';
      },
      [0, 0],
    ),
    'commit-unreachable',
  );
  assert.deepEqual(empty, [repository]);
});

test('a git ls-remote that stalls is stopped at its deadline and retried', async () => {
  // The child keeps a grandchild holding its output open, as git does with
  // git-remote-https while a TLS handshake hangs.
  let runs = 0;
  const stalled = () => {
    runs++;
    return processExec(300)('sh', ['-c', 'sleep 30 & sleep 30']);
  };
  const started = Date.now();
  await assert.rejects(
    lsRemoteCommit(
      'https://git.savannah.gnu.org/git/nano.git',
      'v9.3',
      stalled,
      [0, 0],
    ),
    /deadline: sh -c .+ did not finish within 300 ms$/,
  );
  assert.equal(runs, 6);
  assert.ok(Date.now() - started < 10_000);
});

test('a transport failure of a GNU request is retried; a bad answer is not', async () => {
  const routes = gnuRoutes();
  const listing = 'https://ftp.gnu.org/gnu/nano/';
  let attempts = 0;
  const once = routes[listing]!;
  routes[listing] = () => {
    attempts++;
    if (attempts === 1) throw new TypeError('fetch failed');
    return typeof once === 'function' ? once() : once;
  };
  const found = await resolveGnuTool(api(), nano, {
    ...gnuOptions(),
    fetchImpl: fakeFetch(routes),
  });
  assert.equal(found.resolution.version, '9.3');
  assert.equal(attempts, 2);
  const missing = fakeFetch({
    ...gnuRoutes(),
    [listing]: () => new Response('gone', { status: 404 }),
  });
  await rejects(
    resolveGnuTool(api(), nano, { ...gnuOptions(), fetchImpl: missing }),
    'http-status',
  );
  assert.equal(missing.calls.filter((call) => call.url === listing).length, 1);
});

test('an unreachable GNU server falls back to its mirrors; a bad answer does not', async () => {
  // gnupg.org and ftp.gnu.org have refused CI's connections for whole runs.
  const down = () => {
    throw new TypeError('fetch failed');
  };
  const routes = gnuRoutes();
  for (const url of Object.keys(routes))
    if (url.startsWith('https://ftp.gnu.org/gnu/nano/')) {
      routes[url.replace('ftp.gnu.org', 'mirrors.dotsrc.org')] = routes[url]!;
      routes[url] = down;
    }
  routes['https://mirrors.kernel.org/gnu/nano/'] = down;
  routes['https://mirrors.kernel.org/gnu/nano/nano-9.3.tar.gz'] = down;
  routes['https://mirrors.kernel.org/gnu/nano/nano-9.3.tar.gz.sig'] = down;
  const fetchImpl = fakeFetch(routes);
  const found = await resolveGnuTool(api(), nano, {
    ...gnuOptions(),
    fetchImpl,
  });
  assert.equal(found.resolution.version, '9.3');
  // The record names the server the bytes came from.
  assert.equal(
    found.resolution.gnu!.tarball.url,
    'https://mirrors.dotsrc.org/gnu/nano/nano-9.3.tar.gz',
  );
  assert.equal(
    found.resolution.gnu!.tarball.signatureUrl,
    'https://mirrors.dotsrc.org/gnu/nano/nano-9.3.tar.gz.sig',
  );
  // Each server keeps its own retries before the next one is asked, and the
  // tarball and signature start at the mirror that answered the listing.
  assert.equal(
    fetchImpl.calls.filter(
      (call) => call.url === 'https://ftp.gnu.org/gnu/nano/',
    ).length,
    3,
  );
  assert.deepEqual(
    fetchImpl.calls
      .map((call) => call.url)
      .filter((url) => url.includes('/nano/nano-')),
    [
      'https://mirrors.dotsrc.org/gnu/nano/nano-9.3.tar.gz',
      'https://mirrors.dotsrc.org/gnu/nano/nano-9.3.tar.gz.sig',
    ],
  );
  const missing = fakeFetch({
    ...gnuRoutes(),
    'https://ftp.gnu.org/gnu/nano/': () =>
      new Response('gone', { status: 404 }),
  });
  await rejects(
    resolveGnuTool(api(), nano, { ...gnuOptions(), fetchImpl: missing }),
    'http-status',
  );
  assert.ok(missing.calls.every((call) => !call.url.includes('mirrors.')));
});

test('a listing without the tarball is asked again, then named in the failure', async () => {
  // zlib.net has twice given CI a listing without its tarball while the
  // same request from elsewhere, and a second job of the same run, had it.
  const listing = 'https://ftp.gnu.org/gnu/nano/';
  const stub = '<html><head><title>Please wait</title></head></html>';
  const routes = gnuRoutes();
  const good = routes[listing]!;
  let attempts = 0;
  routes[listing] = () => {
    attempts++;
    if (attempts === 1) return new Response(stub);
    return typeof good === 'function' ? good() : good;
  };
  const found = await resolveGnuTool(api(), nano, {
    ...gnuOptions(),
    fetchImpl: fakeFetch(routes),
  });
  assert.equal(found.resolution.version, '9.3');
  assert.equal(attempts, 2);
  const never = fakeFetch({
    ...gnuRoutes(),
    [listing]: () => new Response(stub),
  });
  await assert.rejects(
    resolveGnuTool(api(), nano, { ...gnuOptions(), fetchImpl: never }),
    (error: Error) =>
      causeOf(error) === 'release-invalid' &&
      error.message.includes(`${stub.length} bytes`) &&
      error.message.includes(sha(stub)) &&
      error.message.includes('"Please wait"'),
  );
  assert.equal(never.calls.filter((call) => call.url === listing).length, 3);
});

test('the license is the COPYING at the tarball root', async () => {
  assert.equal(
    new TextDecoder().decode(await copyingOf(gnuTarball('nano', '9.3'))),
    'nano license\n',
  );
  await rejects(
    copyingOf(tgz([{ name: 'nano-9.3', type: '5' }])),
    'release-invalid',
  );
  // nano's own release tarballs use the pre-POSIX v7 header.
  assert.equal(
    new TextDecoder().decode(
      await copyingOf(
        tgz([
          { name: 'nano-9.3/', type: '5', format: 'v7' },
          {
            name: 'nano-9.3/COPYING',
            type: '\0' as never,
            body: 'GPL\n',
            format: 'v7',
          },
        ]),
      ),
    ),
    'GPL\n',
  );
});

test('the license can be another file, and a pax global header is accepted', async () => {
  const tarball = tgz([
    {
      name: 'pax_global_header',
      type: 'g',
      body: pax({ comment: commit('o') }),
    },
    { name: 'gnutls-3.8.13', type: '5' },
    { name: 'gnutls-3.8.13/COPYING.LESSERv2', body: 'LGPL\n' },
  ]);
  assert.equal(
    new TextDecoder().decode(await copyingOf(tarball, 'COPYING.LESSERv2')),
    'LGPL\n',
  );
  await assert.rejects(copyingOf(tarball), /tarball has no COPYING/);
  // A .tar.xz name reads the same tar through xz.
  assert.equal(
    new TextDecoder().decode(
      await copyingOf(
        xzTarball('gnutls', '3.8.13', 'COPYING.LESSERv2'),
        'COPYING.LESSERv2',
        'gnutls-3.8.13.tar.xz',
      ),
    ),
    'gnutls license\n',
  );
});

test('git resolves from its own servers with its libraries, signature names and licenses', async () => {
  const signed: Record<string, Uint8Array> = {};
  const exec = gnuExec();
  const found = await resolveGnuTool(gitApi(), git, {
    ...gnuOptions((file, args) => {
      // gpgv <keyring options> <signature> <data>: keep what was verified.
      if (file === 'gpgv') {
        const keyring = args[1]!;
        signed[keyring.slice(keyring.lastIndexOf('/') + 1, -4)] = readFileSync(
          args.at(-1)!,
        );
      }
      return exec(file, args);
    }),
  });
  const { resolution } = found;
  assert.equal(resolution.version, '2.56.0');
  assert.equal(resolution.tag, 'v2.56.0');
  assert.equal(resolution.commit, commit('git/git'));
  assert.deepEqual(
    resolution.gnu?.libraries.map((item) => [
      item.package,
      item.version,
      item.tag,
      item.commit,
      item.license.path,
      item.license.file,
      item.license.spdx,
      item.tarball.signer,
    ]),
    [
      [
        'zlib',
        '1.3.2',
        'v1.3.2',
        commit('madler/zlib'),
        'LICENSE',
        'zlib-LICENSE',
        'Zlib',
        SIGNERS.zlib,
      ],
      // GMP has no tagged repository: its signed tarball is its identity.
      [
        'gmp',
        '6.3.0',
        null,
        null,
        'COPYINGv2',
        'gmp-COPYINGv2',
        'LGPL-3.0-or-later OR GPL-2.0-or-later',
        SIGNERS.gmp,
      ],
      [
        'nettle',
        '4.0',
        'nettle_4.0_release_20260205',
        commit('gnutls/nettle'),
        'COPYINGv2',
        'nettle-COPYINGv2',
        'LGPL-3.0-or-later OR GPL-2.0-or-later',
        SIGNERS.nettle,
      ],
      [
        'gnutls',
        '3.8.13',
        '3.8.13',
        commit('gnutls/gnutls'),
        'COPYING.LESSERv2',
        'gnutls-COPYING.LESSERv2',
        'LGPL-2.1-or-later',
        SIGNERS.gnutls,
      ],
      [
        'curl',
        '8.23.0',
        'curl-8_23_0',
        commit('curl/curl'),
        'COPYING',
        'curl-COPYING',
        'curl',
        SIGNERS.curl,
      ],
    ],
  );
  assert.equal(resolution.license.file, 'git-COPYING');
  assert.equal(resolution.gnu?.tarball.signatureName, 'git-2.56.0.tar.sign');
  assert.equal(resolution.gnu?.tarball.signatureUrl, GIT_SOURCES[0].signature);
  assert.deepEqual(
    found.tarballs.map(([file]) => file),
    [
      'git-2.56.0.tar.gz',
      'git-2.56.0.tar.sign',
      'zlib-1.3.2.tar.gz',
      'zlib-1.3.2.tar.gz.asc',
      'gmp-6.3.0.tar.gz',
      'gmp-6.3.0.tar.gz.sig',
      'nettle-4.0.tar.gz',
      'nettle-4.0.tar.gz.sig',
      'gnutls-3.8.13.tar.xz',
      'gnutls-3.8.13.tar.xz.sig',
      'curl-8.23.0.tar.gz',
      'curl-8.23.0.tar.gz.asc',
    ],
  );
  // git's signature covers the gunzipped tar; the others cover the archive
  // as published, GnuTLS's .tar.xz included.
  assert.deepEqual(signed.git, gunzipSync(gnuTarball('git', '2.56.0')));
  assert.deepEqual(signed.curl, Buffer.from(gnuTarball('curl', '8.23.0')));
  assert.deepEqual(
    signed.gnutls,
    Buffer.from(xzTarball('gnutls', '3.8.13', 'COPYING.LESSERv2')),
  );
  // An unlisted signature still has to be fetched.
  const routes = { ...gnuRoutes() };
  delete routes[GIT_SOURCES.find((item) => item.name === 'curl')!.signature];
  await rejects(
    resolveGnuTool(gitApi(), git, {
      ...gnuOptions(),
      fetchImpl: fakeFetch(routes),
    }),
    'offline',
  );
  // A record written before signatureName names the GNU .sig.
  const { signatureName: _name, ...older } = resolution.gnu!.tarball;
  assert.equal(signatureNameOf(older), 'git-2.56.0.tar.gz.sig');
});

test('a gnu-source tool resolves its tarball and libraries with their commits', async () => {
  const found = await resolveGnuTool(api(), nano, gnuOptions());
  const { resolution } = found;
  assert.equal(resolution.version, '9.3');
  assert.equal(resolution.tag, 'v9.3');
  assert.equal(resolution.commit, commit('nano'));
  assert.equal(resolution.asset, null);
  assert.deepEqual(resolution.license, {
    path: 'COPYING',
    file: 'nano-COPYING',
    sha256: sha('nano license\n'),
    spdx: 'GPL-3.0-or-later',
  });
  assert.equal(resolution.gnu?.tarball.signer, SIGNERS.nano);
  assert.equal(resolution.gnu?.tarball.sha256, sha(gnuTarball('nano', '9.3')));
  const [ncurses] = resolution.gnu?.libraries ?? [];
  assert.equal(ncurses?.version, '6.6');
  assert.equal(ncurses?.tag, 'v6_6');
  assert.equal(ncurses?.commit, commit('ncurses'));
  assert.equal(ncurses?.license.spdx, 'X11');
  assert.equal(ncurses?.tarball.signer, SIGNERS.ncurses);
  assert.deepEqual(
    found.files.map(([file]) => file),
    ['nano-COPYING', 'ncurses-COPYING'],
  );
  assert.deepEqual(
    found.tarballs.map(([file]) => file),
    [
      'nano-9.3.tar.gz',
      'nano-9.3.tar.gz.sig',
      'ncurses-6.6.tar.gz',
      'ncurses-6.6.tar.gz.sig',
    ],
  );
});

test('a tag outside tagPattern, or a failed signature, stops the resolution', async () => {
  await rejects(
    resolveGnuTool(
      api(),
      { ...nano, tagPattern: '^release-(\\d+\\.\\d+)$' },
      gnuOptions(),
    ),
    'tag-mismatch',
  );
  await rejects(
    resolveGnuTool(api(), nano, gnuOptions(gnuExec({ status: '' }))),
    'signature-invalid',
  );
  // A transport failure names the request and the system code, never a query;
  // when every mirror failed too, the last mirror's request is named.
  const reset = Object.assign(new TypeError('fetch failed'), {
    cause: Object.assign(new Error('socket'), { code: 'ECONNRESET' }),
  });
  await assert.rejects(
    resolveGnuTool(api(), nano, {
      ...gnuOptions(),
      fetchImpl: (async () => {
        throw reset;
      }) as never,
    }),
    /offline: network request failed \(https:\/\/mirrors\.dotsrc\.org\/gnu\/nano\/, ECONNRESET\)/,
  );
  const routes = gnuRoutes();
  delete routes['https://ftp.gnu.org/gnu/nano/nano-9.3.tar.gz.sig'];
  await rejects(
    resolveGnuTool(api(), nano, {
      ...gnuOptions(),
      fetchImpl: fakeFetch(routes),
    }),
    'offline',
  );
  await rejects(
    resolveGnuTool(api(), {
      ...nano,
      acquire: { kind: 'source-build' },
    } as never),
    'config-invalid',
  );
});
