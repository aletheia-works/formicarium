import { cp, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

// Only disposable coverage dependencies are replaced; reviewed input bytes
// remain pinned and the updated execution inventory is sealed before tests.
export async function provisionLatestPlaywright(
  sourceRoot: string,
  workspace: string,
) {
  for (const name of ['@playwright/test', 'playwright', 'playwright-core']) {
    const target = resolve(workspace, 'node_modules', name);
    await rm(target, { recursive: true, force: true });
    await cp(resolve(sourceRoot, 'node_modules', name), target, {
      recursive: true,
      dereference: true,
    });
  }
}
