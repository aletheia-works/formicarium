import {
  cp,
  lstat,
  mkdir,
  readdir,
  readFile,
  writeFile,
} from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  hash,
  type InputManifest,
  safePath,
  validateManifest,
} from './verification.js';

interface BundlePlan {
  manifest: Omit<InputManifest, 'files' | 'sourceFiles'>;
  sourcePaths: string[];
  inputs: { source: string; path: string }[];
}
// Main supplies an explicit inventory; only the approved payload prefixes are copied.
export async function createBundle(
  plan: BundlePlan,
  out: string,
  sourceRoot = process.cwd(),
) {
  await mkdir(out);
  const sourceFiles = [];
  for (const path of plan.sourcePaths) {
    const bytes = await readFile(resolve(sourceRoot, safePath(path)));
    sourceFiles.push({ path, bytes: bytes.length, sha256: hash(bytes) });
  }
  const files = [];
  for (const row of plan.inputs) {
    safePath(row.path);
    if (
      !/^(dist\/guests\/|fixtures\/|\.artifacts\/(ci-candidate|u1-fixture)\/)/.test(
        row.path,
      ) ||
      /\.env|id_rsa|id_ed25519|credentials/i.test(row.path)
    )
      throw Error(`input is outside reviewed payload boundary: ${row.path}`);
    if (
      !(await lstat(row.source)).isFile() ||
      (await lstat(row.source)).isSymbolicLink()
    )
      throw Error(`regular input required: ${row.path}`);
    const bytes = await readFile(row.source);
    const target = resolve(out, 'payload', row.path);
    await mkdir(dirname(target), { recursive: true });
    await cp(row.source, target, { force: false, errorOnExist: true });
    files.push({ path: row.path, bytes: bytes.length, sha256: hash(bytes) });
  }
  const manifest = { ...plan.manifest, files, sourceFiles };
  validateManifest(manifest, {
    repository: plan.manifest.repository,
    commit: plan.manifest.sourceCommit,
    event: 'push',
    ref: 'refs/heads/codex/verify/preflight',
  });
  await writeFile(
    resolve(out, 'manifest.json'),
    JSON.stringify(manifest, null, 2),
  );
  return {
    manifest,
    files: files.length,
    bytes: files.reduce((sum, row) => sum + row.bytes, 0),
    limits:
      'Local preparation only; license/secrets review and transfer approval still required.',
  };
}
export async function validatePayloadInventory(
  root: string,
  expected: string[],
) {
  const actual: string[] = [];
  async function walk(directory: string, prefix = '') {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = prefix + entry.name;
      if (entry.isDirectory())
        await walk(resolve(directory, entry.name), `${path}/`);
      else if (entry.isFile()) actual.push(path);
      else throw Error(`nonregular payload entry: ${path}`);
    }
  }
  await walk(root);
  if (JSON.stringify(actual.sort()) !== JSON.stringify([...expected].sort()))
    throw Error('unknown or missing payload file');
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const [input, out] = process.argv.slice(2);
  if (!input || !out)
    throw Error('usage: bundle.js <reviewed-plan.json> <fresh-output>');
  console.log(
    JSON.stringify(
      await createBundle(
        JSON.parse(await readFile(input, 'utf8')),
        resolve(out),
      ),
      null,
      2,
    ),
  );
}
