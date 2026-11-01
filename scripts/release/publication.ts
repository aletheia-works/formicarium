import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { hex, requireCondition, unique } from './evidence.ts';
import { PACKAGE_FILES, sha256 } from './inventory.ts';
import { ASSET_LIMITS, readBoundedFile } from './publication-assets.ts';
import { requireStableVersion } from './version.ts';

export interface PublicationIdentity {
  repository: string;
  workflow: 'publish.yml';
  environment: string;
  sourceCommit: string;
  version: string;
  tag: string;
  distTag: 'latest';
}
export interface PublicationCandidate {
  schemaVersion: 1;
  identity: PublicationIdentity;
  package: '@aletheia-works/formicarium';
  files: { path: string; sha256: string }[];
  originalTarballSha256: string;
  tarball: { path: string; sha256: string } | null;
}
export function validatePublicationIdentity(i: PublicationIdentity) {
  requireCondition(
    i &&
      /^[A-Za-z0-9][A-Za-z0-9_.-]*\/[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(
        i.repository,
      ),
    'publication repository required',
  );
  requireCondition(
    i.workflow === 'publish.yml' &&
      /^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(i.environment),
    'publication workflow/environment invalid',
  );
  requireCondition(
    /^[a-f0-9]{40,64}$/.test(i.sourceCommit),
    'publication source commit invalid',
  );
  requireCondition(
    i.tag === `v${requireStableVersion(i.version)}` && i.distTag === 'latest',
    'publication version/tag/dist-tag differs',
  );
  return i;
}
function members(tarball: string) {
  const rows = execFileSync('tar', ['-tzvf', tarball], { encoding: 'utf8' })
    .trim()
    .split('\n');
  requireCondition(
    rows.every((row) => row[0] === '-'),
    'archive links/directories refused',
  );
  const paths = execFileSync('tar', ['-tzf', tarball], { encoding: 'utf8' })
    .trim()
    .split('\n');
  requireCondition(
    paths.every(
      (path) =>
        path.startsWith('package/') &&
        !path.includes('..') &&
        !path.includes('\\'),
    ),
    'unsafe archive path',
  );
  const inventory = paths.map((path) => path.slice(8));
  unique(inventory, 'archive path');
  requireCondition(
    JSON.stringify([...inventory].sort()) ===
      JSON.stringify([...PACKAGE_FILES].sort()),
    'archive inventory differs',
  );
  return inventory;
}
const extract = (path: string, member: string) =>
  execFileSync('tar', ['-xOzf', path, `package/${member}`], {
    maxBuffer: 64 * 1024 * 1024,
  });
function manifestIdentity(
  manifest: Record<string, any>,
  i: PublicationIdentity,
) {
  requireCondition(
    manifest.name === '@aletheia-works/formicarium' &&
      manifest.version === i.version &&
      manifest.private === false,
    'public manifest identity/private differs',
  );
  requireCondition(
    manifest.repository?.type === 'git' &&
      manifest.repository.url === `git+https://github.com/${i.repository}.git`,
    'public repository differs',
  );
  requireCondition(
    manifest.publishConfig?.registry === 'https://registry.npmjs.org/' &&
      manifest.publishConfig.access === 'public',
    'public registry/access differs',
  );
  requireCondition(
    manifest.type === 'module' &&
      Object.keys(manifest.exports ?? {}).length === 6 &&
      !manifest.scripts &&
      !manifest.devDependencies,
    'public surface differs',
  );
}
/** Local-only preparation. The old archive and evidence are never rewritten. */
export async function preparePublication({
  originalManifestPath,
  originalTarballPath,
  out,
  identity,
}: {
  originalManifestPath: string;
  originalTarballPath: string;
  out: string;
  identity: PublicationIdentity;
}) {
  validatePublicationIdentity(identity);
  const original = JSON.parse(
    (
      await readBoundedFile(originalManifestPath, ASSET_LIMITS.metadataBytes)
    ).toString(),
  );
  const archive = resolve(originalTarballPath);
  const originalSha = sha256(await readFile(archive));
  requireCondition(
    original.tarball?.sha256 === originalSha &&
      original.core?.package === '@aletheia-works/paludarium-wasm',
    'original candidate binding differs',
  );
  const inventory = members(archive);
  requireCondition(
    Array.isArray(original.files) && original.files.length === inventory.length,
    'original manifest inventory differs',
  );
  unique(
    original.files.map((row: { path: string }) => row.path),
    'original manifest path',
  );
  const contents = new Map<string, Buffer>();
  for (const path of inventory) {
    const bytes = extract(archive, path);
    requireCondition(
      original.files.find(
        (row: { path: string; sha256: string }) => row.path === path,
      )?.sha256 === sha256(bytes),
      'original archive digest differs',
    );
    contents.set(path, bytes);
  }
  const old = JSON.parse(contents.get('package.json')!.toString());
  requireCondition(
    old.name === '@aletheia-works/formicarium' &&
      old.private === true &&
      typeof old.version === 'string' &&
      !old.scripts &&
      !old.devDependencies,
    'original manifest not reviewed private candidate',
  );
  requireStableVersion(old.version);
  const manifest = {
    ...old,
    version: identity.version,
    private: false,
    repository: {
      type: 'git',
      url: `git+https://github.com/${identity.repository}.git`,
    },
    publishConfig: {
      registry: 'https://registry.npmjs.org/',
      access: 'public',
    },
  };
  manifestIdentity(manifest, identity);
  contents.set(
    'package.json',
    Buffer.from(JSON.stringify(manifest, null, 2) + '\n'),
  );
  // Exclusive mkdir also rejects existing destinations and symlinks.
  const destination = resolve(out);
  await mkdir(destination, { recursive: false });
  for (const [path, bytes] of contents) {
    await mkdir(dirname(resolve(destination, path)), { recursive: true });
    await writeFile(resolve(destination, path), bytes, { flag: 'wx' });
  }
  const candidate: PublicationCandidate = {
    schemaVersion: 1,
    identity,
    package: '@aletheia-works/formicarium',
    originalTarballSha256: originalSha,
    files: [...contents].map(([path, bytes]) => ({
      path,
      sha256: sha256(bytes),
    })),
    tarball: null,
  };
  await writeFile(
    `${destination}.publication.json`,
    JSON.stringify(candidate, null, 2) + '\n',
    { flag: 'wx' },
  );
  return candidate;
}
/** Digest-check npm's packed bytes, without updating any saved manifest. */
export async function validatePublication(
  candidate: PublicationCandidate,
  identity: PublicationIdentity,
  tarballPath: string,
) {
  validatePublicationIdentity(identity);
  requireCondition(
    candidate.schemaVersion === 1 &&
      candidate.package === '@aletheia-works/formicarium' &&
      hex(candidate.originalTarballSha256) &&
      JSON.stringify(candidate.identity) === JSON.stringify(identity),
    'publication candidate identity differs',
  );
  const inventory = members(tarballPath);
  requireCondition(
    candidate.files.length === inventory.length,
    'publication files differ',
  );
  unique(
    candidate.files.map((row) => row.path),
    'publication manifest path',
  );
  for (const path of inventory)
    requireCondition(
      candidate.files.find((row) => row.path === path)?.sha256 ===
        sha256(extract(tarballPath, path)),
      'publication archive digest differs',
    );
  manifestIdentity(
    JSON.parse(extract(tarballPath, 'package.json').toString()),
    identity,
  );
  const digest = sha256(await readFile(tarballPath));
  if (candidate.tarball)
    requireCondition(
      candidate.tarball.sha256 === digest,
      'publication tarball digest differs',
    );
  return {
    ...candidate,
    tarball: { path: resolve(tarballPath), sha256: digest },
  };
}
