import assert from 'node:assert/strict';
import test from 'node:test';
import { readConfigFile, type ToolConfig } from '../scripts/config.ts';
import { causeOf } from '../scripts/errors.ts';
import { createGitHubApi } from '../scripts/github.ts';
import {
  copyingOf,
  latestVersion,
  lsRemoteCommit,
  processExec,
  verifySignature,
} from '../scripts/gnu.ts';
import { resolveGnuTool } from '../scripts/resolve.ts';
import { commit, fakeFetch, sha } from './fixtures/github.ts';
import {
  gnuExec,
  gnuOptions,
  gnuRoutes,
  gnuTarball,
  ncursesTagRoutes,
  SIGNERS,
} from './fixtures/gnu.ts';
import { tgz } from './fixtures/tar.ts';

const nano = (
  (await readConfigFile('tools.json')) as { tools: ToolConfig[] }
).tools.find((item) => item.tool === 'nano')!;
const pkg = { package: 'nano', signers: [SIGNERS.nano!] };
const data = new Uint8Array([1, 2, 3]);
const rejects = (promise: Promise<unknown>, code: string) =>
  assert.rejects(promise, (error) => causeOf(error) === code);
const api = () => createGitHubApi({ fetchImpl: fakeFetch(ncursesTagRoutes()) });

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

test('a signature counts only as one good signature by a pinned primary key', async () => {
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
    // Two signatures, none, and a key that is not pinned.
    `${good}${good}`,
    '[GNUPG:] NEWSIG\n',
    good.replace(SIGNERS.nano!, SIGNERS.ncurses!),
  ])
    await rejects(
      verifySignature(pkg, data, data, { exec: gnuExec({ status }) }),
      'signature-invalid',
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
  // A failed git run is retried twice and reports git's own message.
  let runs = 0;
  const offline = () => {
    runs++;
    throw Object.assign(new Error('git exited with 128'), {
      stderr: '\nfatal: unable to access the repository: Connection reset\n',
    });
  };
  await assert.rejects(
    lsRemoteCommit(repository, 'v9.3', offline, [0, 0]),
    /offline: git ls-remote .+ failed: fatal: unable to access the repository: Connection reset$/,
  );
  assert.equal(runs, 3);
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
  assert.equal(runs, 3);
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
  // A transport failure names the request and the system code, never a query.
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
    /offline: network request failed \(https:\/\/ftp\.gnu\.org\/gnu\/nano\/, ECONNRESET\)/,
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
