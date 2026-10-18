import { constants } from 'node:fs';
import { copyFile, lstat, mkdir, readdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { sha256 } from '../package/stage-package.js';
import {
  readBoundedFile,
  safeAssetPath,
} from '../release/publication-assets.js';

export const CI_INPUT_PATHS = Object.freeze([
  '.artifacts/migration-session/blink-source.bundle',
  'dist/blink/blink.mjs',
  'dist/blink/blink.wasm',
  'dist/blink/build-info.json',
  'dist/guests/aube',
  'dist/guests/exit3',
  'dist/guests/hello',
  'dist/guests/pitchfork',
  'dist/guests/pitchfork.build-info',
  'dist/guests/pitchfork.commit',
  'dist/guests/probe',
  '.artifacts/u1-fixture/guest',
  '.artifacts/u2-release-inputs/aube-v2.7.0/aube',
  'fixtures/baseline/aube-1645.native.txt',
  'fixtures/sessions/aube-1645.txt',
  'fixtures/aube-local-deps/app/package.json',
  'fixtures/aube-local-deps/app/filedep/package.json',
  'fixtures/aube-local-deps/outside/linked/package.json',
  'docs/results/terrarium-migration-preflight-evidence/mirror-input.json',
]);
export const CI_INPUT_LIMITS = Object.freeze({
  metadata: 1024 * 1024,
  file: 128 * 1024 * 1024,
  total: 256 * 1024 * 1024,
  entries: 4096,
});
export interface InputRow {
  path: string;
  bytes: number;
  sha256: string;
}
export interface SourceRow {
  path: string;
  sha256: string;
}
export interface CIInputManifest {
  schema: 'migration-session-ci-inputs' | 'migration-install-ci-inputs';
  version: 1;
  producer: 'main-session-observed-inputs';
  files: InputRow[];
  sourceFiles: SourceRow[];
}
export interface CIInputPolicy {
  schema: CIInputManifest['schema'];
  paths: readonly string[];
  sourcePrefix: string;
}
export const SESSION_INPUT_POLICY: CIInputPolicy = Object.freeze({
  schema: 'migration-session-ci-inputs',
  paths: CI_INPUT_PATHS,
  sourcePrefix: 'ci/migration-session/',
});
function ensure(value: unknown, message: string): asserts value {
  if (!value) throw Error(message);
}
function record(value: unknown): Record<string, unknown> {
  ensure(
    value !== null && typeof value === 'object' && !Array.isArray(value),
    'CI input object required',
  );
  return value as Record<string, unknown>;
}
function fields(value: Record<string, unknown>, expected: string[]) {
  ensure(
    JSON.stringify(Object.keys(value).sort()) ===
      JSON.stringify(expected.sort()),
    'CI input unknown/missing field',
  );
}
export function validateCIInputManifest(
  value: unknown,
  policy: CIInputPolicy = SESSION_INPUT_POLICY,
): CIInputManifest {
  const row = record(value);
  fields(row, ['schema', 'version', 'producer', 'files', 'sourceFiles']);
  ensure(
    row.schema === policy.schema &&
      row.version === 1 &&
      row.producer === 'main-session-observed-inputs',
    'CI input producer/schema refused',
  );
  ensure(
    Array.isArray(row.files) && row.files.length === policy.paths.length,
    'CI input missing inventory',
  );
  const files: InputRow[] = [],
    seen = new Set<string>();
  let total = 0;
  for (const raw of row.files) {
    const entry = record(raw);
    fields(entry, ['path', 'bytes', 'sha256']);
    ensure(
      typeof entry.path === 'string' && policy.paths.includes(entry.path),
      'CI input unknown destination',
    );
    ensure(!seen.has(entry.path), 'CI input duplicate destination');
    seen.add(entry.path);
    ensure(
      typeof entry.bytes === 'number' &&
        Number.isSafeInteger(entry.bytes) &&
        entry.bytes >= 0 &&
        entry.bytes <= CI_INPUT_LIMITS.file,
      'CI input byte limit',
    );
    ensure(
      typeof entry.sha256 === 'string' && /^[a-f0-9]{64}$/.test(entry.sha256),
      'CI input digest required',
    );
    total += entry.bytes;
    ensure(total <= CI_INPUT_LIMITS.total, 'CI input total limit');
    files.push({ path: entry.path, bytes: entry.bytes, sha256: entry.sha256 });
  }
  ensure(
    Array.isArray(row.sourceFiles) &&
      row.sourceFiles.length > 0 &&
      row.sourceFiles.length <= CI_INPUT_LIMITS.entries,
    'CI source inventory missing/limit',
  );
  const sourceFiles: SourceRow[] = [];
  const sources = new Set<string>();
  for (const raw of row.sourceFiles) {
    const entry = record(raw);
    fields(entry, ['path', 'sha256']);
    ensure(typeof entry.path === 'string', 'CI source path required');
    safeAssetPath(entry.path);
    ensure(
      !entry.path.startsWith(policy.sourcePrefix) && !sources.has(entry.path),
      'CI source duplicate/self reference',
    );
    sources.add(entry.path);
    ensure(
      typeof entry.sha256 === 'string' && /^[a-f0-9]{64}$/.test(entry.sha256),
      'CI source digest required',
    );
    sourceFiles.push({ path: entry.path, sha256: entry.sha256 });
  }
  ensure(
    sourceFiles.every(
      (entry, index) =>
        index === 0 || sourceFiles[index - 1]!.path < entry.path,
    ),
    'CI source inventory must be sorted',
  );
  return {
    schema: policy.schema,
    version: 1,
    producer: 'main-session-observed-inputs',
    files,
    sourceFiles,
  };
}
/** Walk every ancestor; O_NOFOLLOW in the bounded reader also rejects leaf replacement. */
async function regular(root: string, path: string, absent = false) {
  const parts = safeAssetPath(path).split('/');
  for (let i = 1; i <= parts.length; i++) {
    try {
      const stat = await lstat(resolve(root, ...parts.slice(0, i)));
      ensure(
        !stat.isSymbolicLink() &&
          (i === parts.length ? stat.isFile() : stat.isDirectory()),
        'CI input symlink/special file',
      );
    } catch (error) {
      if (absent && (error as NodeJS.ErrnoException).code === 'ENOENT')
        return false;
      throw error;
    }
  }
  return true;
}
export async function inspectCIInputs(
  root: string,
  manifestPath: string,
  policy: CIInputPolicy = SESSION_INPUT_POLICY,
) {
  const bundleRoot = dirname(resolve(manifestPath));
  await regular(bundleRoot, 'inputs.bundle.json');
  ensure(
    resolve(manifestPath) === resolve(bundleRoot, 'inputs.bundle.json'),
    'CI manifest filename refused',
  );
  const bytes = await readBoundedFile(manifestPath, CI_INPUT_LIMITS.metadata);
  const parsed: unknown = JSON.parse(bytes.toString('utf8'));
  ensure(
    JSON.stringify(parsed, null, 2) + '\n' === bytes.toString('utf8'),
    'CI manifest canonical JSON required (duplicate keys refused)',
  );
  const manifest = validateCIInputManifest(parsed, policy);
  const expected = [
    ...new Set(manifest.files.map((row) => `${row.sha256}.bin`)),
  ].sort();
  const entries = await readdir(resolve(bundleRoot, 'payload'), {
    withFileTypes: true,
  });
  ensure(
    entries.every((entry) => entry.isFile()) &&
      JSON.stringify(entries.map((entry) => entry.name).sort()) ===
        JSON.stringify(expected),
    'CI blob inventory missing/unknown/symlink',
  );
  for (const row of manifest.files) {
    const blob = `payload/${row.sha256}.bin`;
    await regular(bundleRoot, blob);
    const content = await readBoundedFile(
      resolve(bundleRoot, blob),
      CI_INPUT_LIMITS.file,
    );
    ensure(
      content.length === row.bytes && sha256(content) === row.sha256,
      'CI blob size/digest mismatch',
    );
    if (await regular(root, row.path, true)) {
      ensure(
        sha256(
          await readBoundedFile(resolve(root, row.path), CI_INPUT_LIMITS.file),
        ) === row.sha256,
        'CI existing destination differs',
      );
    }
  }
  return { manifest, manifestSha256: sha256(bytes), bundleRoot };
}
/** Complete validation precedes writes. Existing bytes are never overwritten. */
export async function installCIInputs(
  root: string,
  manifestPath: string,
  policy: CIInputPolicy = SESSION_INPUT_POLICY,
) {
  const inspected = await inspectCIInputs(root, manifestPath, policy);
  const created: string[] = [];
  try {
    for (const row of inspected.manifest.files) {
      if (await regular(root, row.path, true)) continue;
      const target = resolve(root, row.path);
      await mkdir(dirname(target), { recursive: true });
      await regular(root, row.path, true);
      await copyFile(
        resolve(inspected.bundleRoot, `payload/${row.sha256}.bin`),
        target,
        constants.COPYFILE_EXCL,
      );
      created.push(target);
      ensure(
        sha256(await readBoundedFile(target, CI_INPUT_LIMITS.file)) ===
          row.sha256,
        'CI copied digest mismatch',
      );
    }
    return { ...inspected, created };
  } catch (error) {
    for (const path of created.reverse()) await rm(path);
    throw error;
  }
}
