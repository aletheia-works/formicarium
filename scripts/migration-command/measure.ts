import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { measureInstall } from '../migration-install/measure.js';
import { commandSourceInventory } from './stage.js';

/** U4 candidates are measured by the U3 procedure against the U4 inventory. */
export const COMMAND_MEASURE_OPTIONS = Object.freeze({
  commandSourceInventory,
});
export async function measureCommand(out: string, root = process.cwd()) {
  return await measureInstall(out, root, COMMAND_MEASURE_OPTIONS);
}
if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  const [out, ...extra] = process.argv.slice(2);
  if (!out || extra.length)
    throw Error('usage: U4 measure.js <new-output-directory>');
  console.log(await measureCommand(resolve(out)));
}
