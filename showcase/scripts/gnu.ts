import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fetchBounded } from './acquire.ts';
import { expandTarball, readTar, selectEntry, singleRoot } from './archive.ts';
import { COMMIT_PATTERN, sha256 } from './build-key.ts';
import { type GnuPackage, type GnuSource, gnuTag } from './config.ts';
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
  /**
   * The signature's file name beside the tarball. Records written before it
   * existed are GNU ones, whose signature is `<name>.sig`.
   */
  signatureName?: string;
  /** Primary key fingerprint that made the good signature. */
  signer: string;
}
export type Exec = (file: string, args: readonly string[]) => string;
export interface GnuTransferOptions {
  fetchImpl?: FetchLike;
  exec?: Exec;
  keys?: string;
  /** Waits before each retry of a GNU server request (tests pass zeros). */
  retryDelaysMs?: readonly number[];
}

/**
 * ftp.gnu.org, Savannah and the other release servers drop some connections
 * from CI runners, so a transport failure of a request to them is retried
 * twice. The GitHub API stays unretried, and a bad answer (status, size,
 * signature) never is.
 */
export const GNU_RETRY_DELAYS_MS = Object.freeze([10_000, 30_000]);

async function retrying<T>(
  run: () => Promise<T>,
  transient: (error: unknown) => boolean,
  delays: readonly number[] = GNU_RETRY_DELAYS_MS,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await run();
    } catch (error) {
      if (!transient(error) || attempt >= delays.length) throw error;
      console.warn(
        `${error instanceof Error ? error.message : 'failed'}; retry ${attempt + 1} in ${delays[attempt]} ms`,
      );
      await new Promise((done) => setTimeout(done, delays[attempt]));
    }
  }
}
const transportError = (error: unknown) =>
  error instanceof ShowcaseError &&
  (error.code === 'offline' || error.code === 'deadline');

/** fetchBounded for a release server, with the transport retries above. */
export const fetchGnu = (
  url: string,
  maxBytes: number,
  options: GnuTransferOptions,
) =>
  retrying(
    () => fetchBounded(url, { maxBytes, fetchImpl: options.fetchImpl }),
    transportError,
    options.retryDelaysMs,
  );

/**
 * Runs a command and kills it after timeoutMs, so that a server which stops
 * answering (git ls-remote has no deadline of its own) fails like a fetch.
 */
export const processExec =
  (timeoutMs: number): Exec =>
  (file, args) => {
    try {
      return execFileSync(file, args, {
        encoding: 'utf8',
        maxBuffer: TRANSFER_POLICY.maxMetadataBytes,
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: timeoutMs,
        killSignal: 'SIGKILL',
      });
    } catch (error) {
      if ((error as { code?: unknown }).code === 'ETIMEDOUT')
        fail(
          'deadline',
          `${file} ${args.join(' ')} did not finish within ${timeoutMs} ms`,
          error,
        );
      throw error;
    }
  };
const defaultExec = processExec(TRANSFER_POLICY.fetchDeadlineMs);

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

/** The GNU defaults: ftp.gnu.org, `<tarball>.sig` over the archive, COPYING. */
export const gnuDefaults = (name: string): GnuSource => ({
  listing: `${GNU_MIRROR}/${name}/`,
  tarball: `${GNU_MIRROR}/${name}/${name}-{version}.tar.gz`,
  signature: '{tarball}.sig',
  license: 'COPYING',
});
/** A package's source settings, with the GNU defaults when it names none. */
export const sourceOf = (pkg: Pick<GnuPackage, 'package' | 'source'>) =>
  pkg.source ?? gnuDefaults(pkg.package);

/** The tarball and signature URLs of one version. */
export function sourceUrls(source: GnuSource, version: string) {
  const tarball = gnuTag(source.tarball, version);
  const signature = gnuTag(
    source.signature.replace('{tarball}', tarball),
    version,
  );
  return {
    name: tarball.split('/').at(-1)!,
    tarball,
    signature,
    signatureName: signature.split('/').at(-1)!,
  };
}

/**
 * The highest `<package>-<version><suffix>` of a listing (`.tar.gz` unless
 * the source's tarball is `.tar.xz`). In the GNU listing (the default) the
 * link is relative and the `.sig` must be listed too. With `anyPrefix` (a
 * package with its own source) the link may carry any path or origin and the
 * signature need not be listed: its fetch must still succeed.
 */
export function latestVersion(
  listing: string,
  name: string,
  options: { anyPrefix?: boolean; suffix?: '.tar.gz' | '.tar.xz' } = {},
): string {
  const suffix = (options.suffix ?? '.tar.gz').replaceAll('.', '\\.');
  const tarballs = new Set<string>();
  const signatures = new Set<string>();
  const escaped = name.replaceAll(/[.*+?^${}()|[\]\\-]/g, '\\$&');
  // HTML attribute names ignore case, and zlib.net writes HREF.
  const href = '[Hh][Rr][Ee][Ff]=';
  const link = new RegExp(
    options.anyPrefix
      ? `${href}"(?:[^"\\s]*/)?${escaped}-(\\d[0-9.]*)${suffix}"`
      : `${href}"${escaped}-(\\d[0-9.]*)${suffix}(\\.sig)?"`,
    'g',
  );
  for (const [, version, signature] of listing.matchAll(link))
    if (version && VERSION.test(version))
      (signature ? signatures : tarballs).add(version);
  const versions = options.anyPrefix
    ? [...tarballs]
    : [...tarballs].filter((version) => signatures.has(version));
  if (versions.length === 0)
    fail('release-invalid', `no signed ${name} tarball in the listing`);
  return versions.sort(compareVersions).at(-1)!;
}

/**
 * gpgv with only the pinned keyring. The signature counts only when gpgv
 * succeeds and reports no bad, expired or revoked signature, and every
 * signature in it (GnuTLS releases carry two) is good and made by one of
 * the configured signers' primary keys; the first of them is returned.
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
      if (error instanceof ShowcaseError) throw error;
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
    if (valid.length === 0 || tag('GOODSIG').length !== valid.length)
      fail(
        'signature-invalid',
        `${pkg.package} needs only good signatures, at least one`,
      );
    const primaries = valid.map((line) => line.at(-1) ?? '');
    for (const primary of primaries)
      if (!pkg.signers.includes(primary))
        fail(
          'signature-invalid',
          `${pkg.package} signer ${primary} not pinned`,
        );
    return primaries[0]!;
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

/** git's first stderr line (it carries no token: no credential is used). */
function gitMessage(error: unknown): string {
  const stderr = String((error as { stderr?: unknown }).stderr ?? '');
  const line = stderr
    .split('\n')
    .map((item) => item.trim())
    .find(Boolean);
  return line ? `: ${line.slice(0, 200)}` : '';
}

/**
 * The tag's commit in a Savannah git repository, peeled like
 * resolveTagCommit. A failed git run is retried like a GNU transfer.
 */
export async function lsRemoteCommit(
  repository: string,
  tag: string,
  exec: Exec = defaultExec,
  retryDelaysMs?: readonly number[],
): Promise<string> {
  const output = await retrying(
    async () => {
      try {
        return exec('git', [
          'ls-remote',
          '--tags',
          repository,
          `refs/tags/${tag}`,
          `refs/tags/${tag}^{}`,
        ]);
      } catch (error) {
        if (error instanceof ShowcaseError) throw error;
        return fail(
          'offline',
          `git ls-remote ${repository} failed${gitMessage(error)}`,
          error,
        );
      }
    },
    transportError,
    retryDelaysMs,
  );
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

/**
 * Downloads one release tarball and its signature, then checks the
 * signature over the archive, or over the gunzipped tar (`signedData: tar`).
 */
export async function fetchSignedTarball(
  pkg: GnuPackage,
  version: string,
  options: GnuTransferOptions = {},
): Promise<{
  record: SignedTarball;
  bytes: Uint8Array;
  signature: Uint8Array;
}> {
  const source = sourceOf(pkg);
  const urls = sourceUrls(source, version);
  const fetched = await fetchGnu(
    urls.tarball,
    SOURCE_ARCHIVE_LIMITS.maxDownloadBytes,
    options,
  );
  const signature = await fetchGnu(
    urls.signature,
    TRANSFER_POLICY.maxMetadataBytes,
    options,
  );
  const signed =
    source.signedData === 'tar'
      ? await expandTarball(
          urls.name,
          fetched.bytes,
          SOURCE_ARCHIVE_LIMITS.maxExpandedBytes,
        )
      : fetched.bytes;
  const signer = await verifySignature(pkg, signed, signature.bytes, {
    exec: options.exec,
    keys: options.keys,
  });
  return {
    record: {
      name: urls.name,
      url: urls.tarball,
      sha256: sha256(fetched.bytes),
      size: fetched.bytes.length,
      signatureUrl: urls.signature,
      signatureSha256: sha256(signature.bytes),
      signatureName: urls.signatureName,
      signer,
    },
    bytes: fetched.bytes,
    signature: signature.bytes,
  };
}

/** The signature file name of a record (older GNU records lack it). */
export const signatureNameOf = (tarball: SignedTarball) =>
  tarball.signatureName ?? `${tarball.name}.sig`;

/** The latest signed release of one package. */
export async function resolveGnuPackage(
  pkg: GnuPackage,
  options: GnuTransferOptions = {},
) {
  const listing = await fetchGnu(
    sourceOf(pkg).listing,
    TRANSFER_POLICY.maxMetadataBytes,
    options,
  );
  const version = latestVersion(
    new TextDecoder().decode(listing.bytes),
    pkg.package,
    {
      anyPrefix: pkg.source !== undefined,
      suffix: sourceOf(pkg).tarball.endsWith('.tar.xz') ? '.tar.xz' : '.tar.gz',
    },
  );
  return {
    version,
    tag: pkg.tag === null ? null : gnuTag(pkg.tag, version),
    ...(await fetchSignedTarball(pkg, version, options)),
  };
}

/**
 * The license file at `path` below the tarball's single root (COPYING by
 * default), which the guest is distributed under.
 */
export async function copyingOf(
  tarball: Uint8Array,
  path = 'COPYING',
  /** The tarball's file name: its suffix selects gzip or xz. */
  name = 'source.tar.gz',
): Promise<Uint8Array> {
  const tar = await expandTarball(
    name,
    tarball,
    SOURCE_ARCHIVE_LIMITS.maxExpandedBytes,
  );
  const { entries } = readTar(tar, {
    ...SOURCE_ARCHIVE_LIMITS,
    allowV7Header: true,
    // git archive tarballs (git's own) carry a pax global header.
    allowGlobalHeader: true,
  });
  try {
    return selectEntry(
      entries,
      `${singleRoot(entries)}/${path}`,
      SOURCE_ARCHIVE_LIMITS.maxPathBytes,
    );
  } catch (error) {
    if (error instanceof ShowcaseError && error.code === 'archive-invalid')
      fail('release-invalid', `tarball has no ${path}`, error);
    throw error;
  }
}
