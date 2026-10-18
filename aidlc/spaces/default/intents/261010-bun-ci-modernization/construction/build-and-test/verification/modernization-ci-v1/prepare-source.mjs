import { copyFile, lstat, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';

const root = '/Users/mutoakio/Documents/formicarium';
const destination = '/private/tmp/formicarium-modernization-ci-v1';
const record = resolve(root, 'aidlc/spaces/default/intents/261010-bun-ci-modernization');
const paths = new Set();
for (const unit of ['u1-bun-quality', 'u2-maintenance-policy', 'u3-maintenance-workflows', 'u4-publication-alignment']) {
  const manifest = JSON.parse(await readFile(resolve(record, `construction/${unit}/code-generation/source-manifest.json`), 'utf8'));
  for (const row of manifest.writes) paths.add(row.path);
}
const inventory = [];
for (const path of [...paths].sort()) {
  const source = resolve(root, path);
  const target = resolve(destination, path);
  if (path === 'package-lock.json') {
    await rm(target, { force: true });
    inventory.push({ path, deleted: true });
    continue;
  }
  const metadata = await lstat(source);
  if (!metadata.isFile() || metadata.isSymbolicLink()) throw Error(`regular source required: ${path}`);
  const bytes = await readFile(source);
  await mkdir(dirname(target), { recursive: true });
  await copyFile(source, target);
  if (!bytes.equals(await readFile(target))) throw Error(`copy differs: ${path}`);
  inventory.push({ path, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
}
await writeFile(new URL('./source-copy.json', import.meta.url), JSON.stringify({ baseline: '12a92eabf70f6772f11e33f698e3db5088992270', destination, inventory }, null, 2));
console.log(JSON.stringify({ files: inventory.length, copiedBytes: inventory.reduce((sum, row) => sum + (row.bytes ?? 0), 0), destination }));
