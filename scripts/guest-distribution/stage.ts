import type { GuestBuild } from '../../integration/guest-distribution/index.js';
export interface BuildInput {
  tool: string;
  ref: string;
  guestPath: string;
  buildInfoPath: string;
  fixturePaths?: Record<string, string>;
}
export type LegacyBuild = Omit<Partial<GuestBuild>, 'source'> & {
  source?: Partial<GuestBuild['source']> & Record<string, unknown>;
  [key: string]: unknown;
};
export interface DistributionInput {
  existingRoot?: string;
  tools: Record<
    string,
    { cwd?: string; fixture?: string; default?: string; [key: string]: unknown }
  >;
  manifest: {
    builds?: Record<string, Record<string, LegacyBuild>>;
    [key: string]: unknown;
  };
  builds: BuildInput[];
}

import { createHash } from 'node:crypto';
import {
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { convertFixture } from '../../integration/guest-distribution/fixtures.js';
import { validateBuild } from '../../integration/guest-distribution/manifest.js';
import {
  validateGuestElf,
  validateProvenance,
} from '../../integration/guest-distribution/resolver.js';

const hash = (bytes: Uint8Array) =>
  createHash('sha256').update(bytes).digest('hex');
const json = (value: unknown) =>
  Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
const localBase = 'https://distribution.invalid/';

/** Prior files remain standalone assets; no symlink can reach outside the root. */
async function existingFiles(root: string) {
  const directory = resolve(root);
  const files = new Map<string, Uint8Array>();
  async function walk(path: string, prefix = ''): Promise<void> {
    const stat = await lstat(path);
    if (stat.isSymbolicLink() || !stat.isDirectory())
      throw new Error(
        'producer: existing root must be a real directory without symlinks',
      );
    for (const entry of await readdir(path, { withFileTypes: true })) {
      const name = prefix ? `${prefix}/${entry.name}` : entry.name;
      const target = join(path, entry.name);
      if (entry.isDirectory()) await walk(target, name);
      else if (entry.isFile())
        files.set(name, new Uint8Array(await readFile(target)));
      else
        throw new Error('producer: retained symlink or special asset refused');
    }
  }
  await walk(directory);
  return files;
}

function retainedAsset(
  files: Map<string, Uint8Array>,
  asset: { url: string; sha256: string },
) {
  if (
    typeof asset?.url !== 'string' ||
    !asset.url ||
    /^[a-z][a-z0-9+.-]*:/i.test(asset.url) ||
    /[\\?#\0]/.test(asset.url) ||
    asset.url.startsWith('/')
  )
    throw new Error('producer: retained asset path must be relative');
  const parts = asset.url.split('/').map((part) => decodeURIComponent(part));
  if (
    parts.some(
      (part) => !part || part === '.' || part === '..' || /[\\/\0]/.test(part),
    )
  )
    throw new Error('producer: retained asset path outside root');
  const bytes = files.get(parts.join('/'));
  if (!bytes)
    throw new Error('producer: retained asset missing from existing root');
  if (hash(bytes) !== asset.sha256)
    throw new Error('producer: retained asset SHA-256 mismatch');
  return bytes;
}

function validateRetained(
  manifest: DistributionInput['manifest'],
  selected: Set<string>,
  files: Map<string, Uint8Array>,
  input: DistributionInput,
) {
  for (const [tool, builds] of Object.entries(manifest.builds ?? {})) {
    for (const [ref, entry] of Object.entries(builds)) {
      if (selected.has(`${tool}\0${ref}`)) continue;
      if (!input.existingRoot)
        throw new Error('producer: retained ref requires existing root');
      if (entry.schemaVersion !== 1) continue;
      const build = validateBuild(entry, { tool, ref, base: localBase });
      validateGuestElf(retainedAsset(files, build.guest));
      validateProvenance(
        parseInfo(retainedAsset(files, build.buildInfo)),
        build,
      );
      for (const asset of Object.values(build.fixtures)) {
        convertFixture(parseInfo(retainedAsset(files, asset)), {
          cwd: input.tools[tool]?.cwd ?? '/work',
        });
      }
    }
  }
}

async function readAsset(path: string, target: string) {
  if (typeof path !== 'string' || !path)
    throw new Error(`${target}: missing input path`);
  try {
    return new Uint8Array(await readFile(path));
  } catch {
    throw new Error(`${target}: input asset unavailable`, {
      cause: new Error('file read failed'),
    });
  }
}

function parseInfo(bytes: Uint8Array) {
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    throw new Error('build-info: input must be provenance JSON');
  }
}

async function prepareBuild(
  input: BuildInput,
  existing: LegacyBuild | undefined,
  tools: Record<string, { cwd?: string }>,
) {
  if (
    !input ||
    !['aube', 'pitchfork'].includes(input.tool) ||
    typeof input.ref !== 'string' ||
    !input.ref
  ) {
    throw new Error('producer: invalid tool/ref');
  }
  if (!Object.hasOwn(tools, input.tool))
    throw new Error('producer: unknown tool');
  const infoBytes = await readAsset(input.buildInfoPath, 'build-info');
  const info = parseInfo(infoBytes);
  const source = {
    ...existing?.source,
    ...info.source,
  } as GuestBuild['source'];
  const dir = `dist/${input.tool}/${hash(Buffer.from(input.ref))}`;
  const files = new Map<string, Uint8Array>();
  const add = (name: string, bytes: Uint8Array) => {
    const url = `${dir}/${name}`;
    files.set(url, bytes);
    return { url, sha256: hash(bytes) };
  };
  const guest = validateGuestElf(await readAsset(input.guestPath, 'guest'));
  const build: GuestBuild = {
    ...existing,
    schemaVersion: 1,
    tool: input.tool as GuestBuild['tool'],
    ref: input.ref,
    source,
    built_at: info.built_at,
    guest: { ...add('guest', guest), format: 'static-musl-x86_64' },
    fixtures: {},
    buildInfo: add('build-info.json', infoBytes),
  };
  validateProvenance(info, build);
  for (const [name, path] of Object.entries(input.fixturePaths ?? {})) {
    const bytes = await readAsset(path, 'fixture');
    convertFixture(parseInfo(bytes), {
      cwd: tools[input.tool]?.cwd ?? '/work',
    });
    Object.defineProperty(build.fixtures, name, {
      value: add(`fixture-${hash(Buffer.from(name))}.json`, bytes),
      enumerable: true,
      configurable: true,
      writable: true,
    });
  }
  validateBuild(build, { tool: input.tool, ref: input.ref, base: localBase });
  return { build, files };
}

function inputCatalog(input: DistributionInput) {
  if (
    !input?.tools ||
    typeof input.tools !== 'object' ||
    Array.isArray(input.tools) ||
    !input.manifest ||
    typeof input.manifest !== 'object' ||
    Array.isArray(input.manifest) ||
    !Array.isArray(input.builds) ||
    input.builds.length === 0
  )
    throw new Error('producer: invalid input catalogue');
  const manifest = structuredClone(input.manifest);
  manifest.builds ??= {};
  if (typeof manifest.builds !== 'object' || Array.isArray(manifest.builds))
    throw new Error('producer: invalid builds');
  return manifest;
}

/** Stage validated inputs once; no builds, downloads, publishing or npm writes. */
export async function stageDistribution(
  input: DistributionInput,
  output: string,
) {
  const manifest = inputCatalog(input);
  const files =
    input.existingRoot === undefined
      ? new Map<string, Uint8Array>()
      : await existingFiles(input.existingRoot);
  const selected = new Set<string>();
  for (const item of input.builds) {
    const key = `${item?.tool}\0${item?.ref}`;
    if (selected.has(key)) throw new Error('producer: duplicate tool/ref');
    selected.add(key);
    const prior = manifest.builds![item.tool]?.[item.ref];
    const prepared = await prepareBuild(item, prior, input.tools);
    manifest.builds![item.tool] ??= {};
    Object.defineProperty(manifest.builds![item.tool]!, item.ref, {
      value: prepared.build,
      enumerable: true,
      configurable: true,
      writable: true,
    });
    for (const [path, bytes] of prepared.files) files.set(path, bytes);
  }
  validateRetained(manifest, selected, files, input);
  files.set('tools.json', json(input.tools));
  files.set('dist/builds.json', json(manifest));
  if (typeof output !== 'string' || !output)
    throw new Error('producer: missing output directory');
  const destination = resolve(output);
  await mkdir(dirname(destination), { recursive: true });
  const temporary = await mkdtemp(join(dirname(destination), '.guest-stage-'));
  try {
    for (const [path, bytes] of files) {
      const target = join(temporary, path);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, bytes);
    }
    // rename refuses a nonempty existing destination; existing candidates remain intact.
    await rename(temporary, destination);
  } catch (cause) {
    await rm(temporary, { recursive: true, force: true });
    throw new Error('producer: candidate staging failed', { cause });
  }
  return {
    output: destination,
    manifest,
    files: [...files].map(([path, bytes]) => ({ path, sha256: hash(bytes) })),
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const [inputPath, output, ...extra] = process.argv.slice(2);
  if (!inputPath || !output || extra.length)
    throw new Error('usage: stage.js <input.json> <output-directory>');
  const input = JSON.parse(await readFile(inputPath, 'utf8'));
  const result = await stageDistribution(input, output);
  console.log(JSON.stringify({ output: result.output, files: result.files }));
}
