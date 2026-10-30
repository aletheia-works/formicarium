import { execFileSync } from 'node:child_process';
import { gunzipSync } from 'node:zlib';
import type { Exec } from '../../scripts/gnu.ts';
import { commit, fakeFetch, json, type Route, sha } from './github.ts';
import { CA_BODY } from './records.ts';
import { tgz } from './tar.ts';

/** The signer fingerprints of the committed tools.json, by keyring name. */
export const SIGNERS: Record<string, string> = {
  nano: '168E6F4297BFD7A79AFD4496514BBE2EB8E1961F',
  ncurses: '19882D92DDA4C400C22C0D56CC2AF4472167BE03',
  git: '96E07AF25771955980DAD10020D04E5A713660A7',
  zlib: '5ED46A6721D365587791E2AA783FCD8E58BCAFBA',
  gmp: '343C2FF0FBEE5EC2EDBEF399F3599FF828C67298',
  nettle: '343C2FF0FBEE5EC2EDBEF399F3599FF828C67298',
  gnutls: '5D46CB0F763405A7053556F47A75A648B3F9220C',
  curl: '27EDEAF22F3ABCEB50DB9A125CC908FDB71E12C2',
};

/** A release tarball shaped like GNU's: one root with COPYING and configure. */
export const gnuTarball = (
  name: string,
  version: string,
  license = 'COPYING',
) =>
  tgz([
    { name: `${name}-${version}`, type: '5' },
    { name: `${name}-${version}/${license}`, body: `${name} license\n` },
    {
      name: `${name}-${version}/configure`,
      body: '#!/bin/sh\n',
      mode: 0o755,
    },
  ]);

const listing = (name: string, versions: string[]) =>
  new Response(
    versions
      .flatMap((version) => [
        `<a href="${name}-${version}.tar.gz">${name}-${version}.tar.gz</a>`,
        `<a href="${name}-${version}.tar.gz.sig">sig</a>`,
      ])
      .join('\n'),
  );

/** The same tarball compressed with xz (GnuTLS publishes only .tar.xz). */
export const xzTarball = (name: string, version: string, license = 'COPYING') =>
  new Uint8Array(
    execFileSync('xz', ['-c'], {
      input: gunzipSync(gnuTarball(name, version, license)),
    }),
  );

/**
 * The release servers of git and its libraries: relative links (kernel.org,
 * zlib.net, ftp.gnu.org), absolute-path links without the signature
 * (curl.se), and absolute URLs (GnuTLS here, to cover that form).
 */
export const GIT_SOURCES = [
  {
    name: 'git',
    version: '2.56.0',
    license: 'COPYING',
    listing: 'https://www.kernel.org/pub/software/scm/git/',
    href: (file: string) => file,
    tarball: 'https://www.kernel.org/pub/software/scm/git/git-2.56.0.tar.gz',
    signature:
      'https://www.kernel.org/pub/software/scm/git/git-2.56.0.tar.sign',
  },
  {
    name: 'zlib',
    version: '1.3.2',
    license: 'LICENSE',
    listing: 'https://zlib.net/',
    href: (file: string) => file,
    tarball: 'https://zlib.net/zlib-1.3.2.tar.gz',
    signature: 'https://zlib.net/zlib-1.3.2.tar.gz.asc',
  },
  {
    name: 'gmp',
    version: '6.3.0',
    license: 'COPYINGv2',
    listing: 'https://ftp.gnu.org/gnu/gmp/',
    href: (file: string) => file,
    tarball: 'https://ftp.gnu.org/gnu/gmp/gmp-6.3.0.tar.gz',
    signature: 'https://ftp.gnu.org/gnu/gmp/gmp-6.3.0.tar.gz.sig',
  },
  {
    name: 'nettle',
    version: '4.0',
    license: 'COPYINGv2',
    listing: 'https://ftp.gnu.org/gnu/nettle/',
    href: (file: string) => file,
    tarball: 'https://ftp.gnu.org/gnu/nettle/nettle-4.0.tar.gz',
    signature: 'https://ftp.gnu.org/gnu/nettle/nettle-4.0.tar.gz.sig',
  },
  {
    name: 'gnutls',
    version: '3.8.13',
    license: 'COPYING.LESSERv2',
    listing: 'https://www.gnupg.org/ftp/gcrypt/gnutls/v3.8/',
    href: (file: string) =>
      `https://www.gnupg.org/ftp/gcrypt/gnutls/v3.8/${file}`,
    tarball:
      'https://www.gnupg.org/ftp/gcrypt/gnutls/v3.8/gnutls-3.8.13.tar.xz',
    signature:
      'https://www.gnupg.org/ftp/gcrypt/gnutls/v3.8/gnutls-3.8.13.tar.xz.sig',
  },
  {
    name: 'curl',
    version: '8.23.0',
    license: 'COPYING',
    listing: 'https://curl.se/download/',
    href: (file: string) => `/download/${file}`,
    tarball: 'https://curl.se/download/curl-8.23.0.tar.gz',
    signature: 'https://curl.se/download/curl-8.23.0.tar.gz.asc',
  },
] as const;

/** GitHub tags of git and its libraries; git's is annotated. */
export const gitTagRoutes = (): Record<string, Route> => {
  const routes: Record<string, Route> = {};
  for (const [slug, tag, annotated] of [
    ['git/git', 'v2.56.0', true],
    ['madler/zlib', 'v1.3.2', false],
    ['gnutls/nettle', 'nettle_4.0_release_20260205', true],
    ['gnutls/gnutls', '3.8.13', true],
    ['curl/curl', 'curl-8_23_0', false],
  ] as const) {
    const base = `https://api.github.com/repos/${slug}`;
    const object = commit(`tag-object-${tag}`);
    routes[`${base}/git/ref/tags/${tag}`] = () =>
      json({
        ref: `refs/tags/${tag}`,
        object: annotated
          ? { type: 'tag', sha: object }
          : { type: 'commit', sha: commit(slug) },
      });
    routes[`${base}/git/tags/${object}`] = () =>
      json({ object: { type: 'commit', sha: commit(slug) } });
  }
  // nettle's tag names its release date: it is found among the matching tags.
  routes[
    'https://api.github.com/repos/gnutls/nettle/git/matching-refs/tags/nettle_4.0_release_'
  ] = () =>
    json([
      { ref: 'refs/tags/nettle_4.0_release_20260205' },
      { ref: 'refs/tags/nettle_4.0_release_candidate' },
    ]);
  return routes;
};

/** ftp.gnu.org routes of nano 9.3 and ncurses 6.6 (older versions listed too). */
export function gnuRoutes(): Record<string, Route> {
  const routes: Record<string, Route> = {
    'https://ftp.gnu.org/gnu/nano/': () => listing('nano', ['9.2', '9.3']),
    'https://ftp.gnu.org/gnu/ncurses/': () =>
      listing('ncurses', ['6.5', '6.6']),
  };
  for (const [name, version] of [
    ['nano', '9.3'],
    ['ncurses', '6.6'],
  ] as const) {
    const url = `https://ftp.gnu.org/gnu/${name}/${name}-${version}.tar.gz`;
    routes[url] = () => new Response(gnuTarball(name, version));
    routes[`${url}.sig`] = () => new Response(`signature of ${name}`);
  }
  for (const source of GIT_SOURCES) {
    const suffix = source.tarball.slice(-7);
    const file = `${source.name}-${source.version}${suffix}`;
    const older = `${source.name}-1.0.0${suffix}`;
    const signature = source.signature.split('/').at(-1)!;
    routes[source.listing] = () =>
      new Response(
        [older, file, signature]
          .filter((item) => source.name !== 'curl' || item !== signature)
          .map((item) => `<a href="${source.href(item)}">${item}</a>`)
          .join('\n'),
      );
    routes[source.tarball] = () =>
      new Response(
        suffix === '.tar.xz'
          ? xzTarball(source.name, source.version, source.license)
          : gnuTarball(source.name, source.version, source.license),
      );
    routes[source.signature] = () =>
      new Response(`signature of ${source.name}`);
  }
  Object.assign(routes, caBundleRoutes());
  return routes;
}

/** curl's CA bundle and its digest file, as curl.se serves them. */
export const caBundleRoutes = (
  body = CA_BODY,
  digest = `${sha(body)}  cacert.pem\n`,
): Record<string, Route> => ({
  'https://curl.se/ca/cacert.pem': () => new Response(body),
  'https://curl.se/ca/cacert.pem.sha256': () => new Response(digest),
});

/** GitHub route of the ncurses snapshot tag (a lightweight tag). */
export const ncursesTagRoutes = (): Record<string, Route> => ({
  'https://api.github.com/repos/ThomasDickey/ncurses-snapshots/git/ref/tags/v6_6':
    () =>
      json({
        ref: 'refs/tags/v6_6',
        object: { type: 'commit', sha: commit('ncurses') },
      }),
});

/**
 * gpgv answers a good signature by the keyring's pinned signer; git
 * ls-remote answers nano's peeled tag. `status` overrides gpgv's output.
 */
export function gnuExec(
  options: { status?: string; calls?: string[][] } = {},
): Exec {
  return (file, args) => {
    options.calls?.push([file, ...args]);
    if (file === 'gpgv') {
      const keyring = args[1] ?? '';
      const name = keyring.slice(keyring.lastIndexOf('/') + 1, -'.gpg'.length);
      const signer = SIGNERS[name] ?? '0'.repeat(40);
      return (
        options.status ??
        `[GNUPG:] NEWSIG\n[GNUPG:] GOODSIG ${signer.slice(-16)} Someone\n` +
          `[GNUPG:] VALIDSIG ${signer} 2026-10-21 0 0 4 0 1 10 00 ${signer}\n`
      );
    }
    if (file === 'git')
      return (
        `${commit('nano-tag')}\trefs/tags/v9.3\n` +
        `${commit('nano')}\trefs/tags/v9.3^{}\n`
      );
    throw Error(`unexpected exec ${file}`);
  };
}

/** Resolve options that serve the GNU routes and fake gpgv and git. */
export const gnuOptions = (exec: Exec = gnuExec()) => ({
  fetchImpl: fakeFetch(gnuRoutes()),
  exec,
  retryDelaysMs: [0, 0],
});
