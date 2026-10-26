import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fetchBounded } from './acquire.ts';
import { gunzipBounded, readTar, selectEntry, singleRoot } from './archive.ts';
import { COMMIT_PATTERN, sha256 } from './build-key.ts';
import { type GnuPackage, gnuTag } from './config.ts';
import { fail, ShowcaseError } from './errors.ts';
import type { FetchLike } from './github.ts';
import { SOURCE_ARCHIVE_LIMITS, TRANSFER_POLICY } from './limits.ts';
import { SHOWCASE_ROOT } from './paths.ts';

export const GNU_MIRROR = 'https://ftp.gnu.org/gnu';

/** A tarball whose detached signature was checked against a pinned key. */
export interface SignedTarball {
  name: string;
  url: string;
  sha256: string;
  size: number;
  signatureUrl: string;
  signatureSha256: string;
  /** Primary key fingerprint that made the good signature. */
  signer: string;
}
export type Exec = (file: string, args: readonly string[]) => string;

const defaultExec: Exec = (file, args) =>
  execFileSync(file, args, {
    encoding: 'utf8',
    maxBuffer: TRANSFER_POLICY.maxMetadataBytes,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

const VERSION = /^\d{1,4}(?:\.\d{1,4}){1,2}$/;
const compareVersions = (a: string, b: string) => {
  const x = a.split('.').map(Number);
  const y = b.split('.').map(Number);
  for (let index = 0; index < 3; index++) {
    const difference = (x[index] ?? 0) - (y[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
};

/** The highest `<package>-<version>.tar.gz` that also has its `.sig`. */
export function latestVersion(listing: string, name: string): string {
  const tarballs = new Set<string>();
  const signatures = new Set<string>();
  const escaped = name.replaceAll(/[.*+?^${}()|[\]\\-]/g, '\\$&');
  const link = new RegExp(
    `href="${escaped}-(\\d[0-9.]*)\\.tar\\.gz(\\.sig)?"`,
    'g',
  );
  for (const [, version, signature] of listing.matchAll(link))
    if (version && VERSION.test(version))
      (signature ? signatures : tarballs).add(version);
  const versions = [...tarballs].filter((version) => signatures.has(version));
  if (versions.length === 0)
    fail('release-invalid', `no signed ${name} tarball in the GNU listing`);
  return versions.sort(compareVersions).at(-1)!;
}

/**
 * gpgv with only the pinned keyring. The signature counts only when gpgv
 * succeeds, reports one GOODSIG and no bad, expired or revoked signature,
 * and the VALIDSIG primary key is one of the configured signers.
 */
export async function verifySignature(
  pkg: Pick<GnuPackage, 'package' | 'signers'>,
  data: Uint8Array,
  signature: Uint8Array,
  options: { exec?: Exec; keys?: string } = {},
): Promise<string> {
  const keyring = join(
    options.keys ?? join(SHOWCASE_ROOT, 'keys'),
    `${pkg.package}.gpg`,
  );
  const directory = await mkdtemp(join(tmpdir(), 'showcase-gpgv-'));
  try {
    const dataPath = join(directory, 'data');
    const signaturePath = join(directory, 'data.sig');
    await writeFile(dataPath, data);
    await writeFile(signaturePath, signature);
    let status: string;
    try {
      status = (options.exec ?? defaultExec)('gpgv', [
        '--keyring',
        keyring,
        '--status-fd',
        '1',
        signaturePath,
        dataPath,
      ]);
    } catch (error) {
      return fail(
        'signature-invalid',
        `${pkg.package} signature did not verify`,
        error,
      );
    }
    const lines = status.split('\n').map((line) => line.split(' '));
    const tag = (name: string) =>
      lines.filter((line) => line[0] === '[GNUPG:]' && line[1] === name);
    for (const name of ['BADSIG', 'ERRSIG', 'EXPSIG', 'EXPKEYSIG', 'REVKEYSIG'])
      if (tag(name).length > 0)
        fail('signature-invalid', `${pkg.package} signature reports ${name}`);
    const valid = tag('VALIDSIG');
    if (tag('GOODSIG').length !== 1 || valid.length !== 1)
      fail(
        'signature-invalid',
        `${pkg.package} needs exactly one good signature`,
      );
    const primary = valid[0]!.at(-1) ?? '';
    if (!pkg.signers.includes(primary))
      fail('signature-invalid', `${pkg.package} signer ${primary} not pinned`);
    return primary;
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

/** The tag's commit in a Savannah git repository, peeled like resolveTagCommit. */
export function lsRemoteCommit(
  repository: string,
  tag: string,
  exec: Exec = defaultExec,
): string {
  let output: string;
  try {
    output = exec('git', [
      'ls-remote',
      '--tags',
      repository,
      `refs/tags/${tag}`,
      `refs/tags/${tag}^{}`,
    ]);
  } catch (error) {
    return fail(
      'commit-unreachable',
      `git ls-remote ${repository} failed`,
      error,
    );
  }
  const refs = new Map(
    output
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [sha, ref] = line.split('\t');
        return [ref, sha] as const;
      }),
  );
  const commit =
    refs.get(`refs/tags/${tag}^{}`) ?? refs.get(`refs/tags/${tag}`);
  if (!commit || !COMMIT_PATTERN.test(commit))
    fail('commit-unreachable', `tag ${tag} is not in ${repository}`);
  return commit;
}

/** Downloads one release tarball and its signature, then checks the signature. */
export async function fetchSignedTarball(
  pkg: GnuPackage,
  version: string,
  options: { fetchImpl?: FetchLike; exec?: Exec; keys?: string } = {},
): Promise<{
  record: SignedTarball;
  bytes: Uint8Array;
  signature: Uint8Array;
}> {
  const name = `${pkg.package}-${version}.tar.gz`;
  const url = `${GNU_MIRROR}/${pkg.package}/${name}`;
  const fetched = await fetchBounded(url, {
    maxBytes: SOURCE_ARCHIVE_LIMITS.maxDownloadBytes,
    fetchImpl: options.fetchImpl,
  });
  const signature = await fetchBounded(`${url}.sig`, {
    maxBytes: TRANSFER_POLICY.maxMetadataBytes,
    fetchImpl: options.fetchImpl,
  });
  const signer = await verifySignature(pkg, fetched.bytes, signature.bytes, {
    exec: options.exec,
    keys: options.keys,
  });
  return {
    record: {
      name,
      url,
      sha256: sha256(fetched.bytes),
      size: fetched.bytes.length,
      signatureUrl: `${url}.sig`,
      signatureSha256: sha256(signature.bytes),
      signer,
    },
    bytes: fetched.bytes,
    signature: signature.bytes,
  };
}

/** The latest signed release of one GNU package. */
export async function resolveGnuPackage(
  pkg: GnuPackage,
  options: { fetchImpl?: FetchLike; exec?: Exec; keys?: string } = {},
) {
  const listing = await fetchBounded(`${GNU_MIRROR}/${pkg.package}/`, {
    maxBytes: TRANSFER_POLICY.maxMetadataBytes,
    fetchImpl: options.fetchImpl,
  });
  const version = latestVersion(
    new TextDecoder().decode(listing.bytes),
    pkg.package,
  );
  return {
    version,
    tag: gnuTag(pkg.tag, version),
    ...(await fetchSignedTarball(pkg, version, options)),
  };
}

/** The tarball's top-level COPYING, which the guest is distributed under. */
export async function copyingOf(tarball: Uint8Array): Promise<Uint8Array> {
  const tar = await gunzipBounded(
    tarball,
    SOURCE_ARCHIVE_LIMITS.maxExpandedBytes,
  );
  const { entries } = readTar(tar, SOURCE_ARCHIVE_LIMITS);
  try {
    return selectEntry(
      entries,
      `${singleRoot(entries)}/COPYING`,
      SOURCE_ARCHIVE_LIMITS.maxPathBytes,
    );
  } catch (error) {
    if (error instanceof ShowcaseError && error.code === 'archive-invalid')
      fail('release-invalid', 'tarball has no COPYING', error);
    throw error;
  }
}
