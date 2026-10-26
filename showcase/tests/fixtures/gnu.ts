import type { Exec } from '../../scripts/gnu.ts';
import { commit, fakeFetch, json, type Route } from './github.ts';
import { tgz } from './tar.ts';

/** The signer fingerprints of the committed tools.json, by keyring name. */
export const SIGNERS: Record<string, string> = {
  nano: '168E6F4297BFD7A79AFD4496514BBE2EB8E1961F',
  ncurses: '19882D92DDA4C400C22C0D56CC2AF4472167BE03',
};

/** A release tarball shaped like GNU's: one root with COPYING and configure. */
export const gnuTarball = (name: string, version: string) =>
  tgz([
    { name: `${name}-${version}`, type: '5' },
    { name: `${name}-${version}/COPYING`, body: `${name} license\n` },
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
  return routes;
}

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
