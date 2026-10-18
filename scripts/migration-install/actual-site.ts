// The restored actual distribution site that the U3 and U4 completion
// commands require before any test process runs.
import { lstat, readdir, realpath } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { CI_INPUT_LIMITS } from '../migration-session/ci-inputs.js';
import { sha256 } from '../package/stage-package.js';
import {
  readBoundedFile,
  safeAssetPath,
} from '../release/publication-assets.js';

export const INSTALL_SITE_DESTINATION =
  '.artifacts/migration-install/actual-site';
export const INSTALL_ACTUAL_SITE_FILES = Object.freeze([
  {
    path: 'dist/aube/5a75abb5b2ff53ed9b89f85a9695e29fa8dae3a4fda6f25046f39ac04a413d92/build-info.json',
    bytes: 1112,
    sha256: '994ad5923dcd8383c887228987b3cf656a541bc658747d4ce76e6f219b90f5fd',
  },
  {
    path: 'dist/aube/5a75abb5b2ff53ed9b89f85a9695e29fa8dae3a4fda6f25046f39ac04a413d92/fixture-e6149f95eadefc92a559dd4f39b4836064a087b2f95c954bf13b6b786c8798f3.json',
    bytes: 366,
    sha256: '17e2c1f140570536c0fd73f9d91cc12b9b4aaa76361c2396b611005966989454',
  },
  {
    path: 'dist/aube/5a75abb5b2ff53ed9b89f85a9695e29fa8dae3a4fda6f25046f39ac04a413d92/guest',
    bytes: 36497472,
    sha256: 'd973c97da25ed13e49943b0836c88fd5d9e51ac422faa5b38a3df997ad1ceef9',
  },
  {
    path: 'dist/aube/83a42e281acf38e98fbbddf590e77746dcb9dfdb12cce4b27d1eb1926e1e5b5d/build-info.json',
    bytes: 1112,
    sha256: '18248d1d2cfdd3933b5608ea795bc78473e2d400791c8d5204d63be9755102d5',
  },
  {
    path: 'dist/aube/83a42e281acf38e98fbbddf590e77746dcb9dfdb12cce4b27d1eb1926e1e5b5d/fixture-e6149f95eadefc92a559dd4f39b4836064a087b2f95c954bf13b6b786c8798f3.json',
    bytes: 366,
    sha256: '17e2c1f140570536c0fd73f9d91cc12b9b4aaa76361c2396b611005966989454',
  },
  {
    path: 'dist/aube/83a42e281acf38e98fbbddf590e77746dcb9dfdb12cce4b27d1eb1926e1e5b5d/guest',
    bytes: 36948544,
    sha256: 'c7d7d13692d01c5f6adc5511c40adc6b3769080b7c433b44c411a3e52ebcd99e',
  },
  {
    path: 'dist/builds.json',
    bytes: 3558,
    sha256: '0377f69859e2fb98160cdafeebf44c8199b60f63dfd8ae3e244161d515d170d2',
  },
  {
    path: 'dist/pitchfork/1e8d2cbbd4fbfa46deb8c024e62368762d88b1e34a9fa75f0e8079207164dbbd/build-info.json',
    bytes: 1141,
    sha256: '6a1eedbda36acfadf448a1e0ce2a1d6236d5bbca70d8950b6177777310daccdd',
  },
  {
    path: 'dist/pitchfork/1e8d2cbbd4fbfa46deb8c024e62368762d88b1e34a9fa75f0e8079207164dbbd/fixture-70fa4ab004890168522fa83941f86a1e0a28818246b6a065e4b0ef685e8035b3.json',
    bytes: 151,
    sha256: '081abc73542d06df09d28cdad88bfda1628634ab5482a3f8238134a25951583a',
  },
  {
    path: 'dist/pitchfork/1e8d2cbbd4fbfa46deb8c024e62368762d88b1e34a9fa75f0e8079207164dbbd/guest',
    bytes: 39596008,
    sha256: '67bcb90c31e8525f95f49c9ef5ff9b6526f36e79471f4804bc533b192a772a23',
  },
  {
    path: 'tools.json',
    bytes: 207,
    sha256: '64a712e6ed381694d69cb434bba07b5f5e49daf13a7238709e039b3f2e96cae4',
  },
]);

function ensureSite(value: unknown, message: string): asserts value {
  if (!value) throw Error(`U3 actual site ${message}`);
}
export function validateInstallSiteBudget(
  total: number,
  entries: number,
): void {
  ensureSite(
    Number.isSafeInteger(total) && total >= 0 && total <= CI_INPUT_LIMITS.total,
    'expanded total limit',
  );
  ensureSite(
    Number.isSafeInteger(entries) &&
      entries >= 0 &&
      entries <= CI_INPUT_LIMITS.entries,
    'entry limit',
  );
}
async function siteAncestors(
  root: string,
  path: string,
  absent = false,
): Promise<boolean> {
  const parts = safeAssetPath(path).split('/');
  for (let index = 1; index <= parts.length; index++) {
    try {
      const stat = await lstat(resolve(root, ...parts.slice(0, index)));
      ensureSite(
        !stat.isSymbolicLink() &&
          (index === parts.length ? stat.isFile() : stat.isDirectory()),
        'symlink/special file',
      );
    } catch (error) {
      if (absent && (error as NodeJS.ErrnoException).code === 'ENOENT')
        return false;
      throw error;
    }
  }
  return true;
}
export async function inspectInstallActualSite(site: string): Promise<string> {
  site = resolve(site);
  ensureSite((await realpath(site)) === site, 'symlink root/ancestor');
  const paths: string[] = [];
  const walk = async (directory: string) => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      ensureSite(!entry.isSymbolicLink(), 'symlink entry');
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) {
        const directoryPath = relative(site, path) + '/';
        ensureSite(
          INSTALL_ACTUAL_SITE_FILES.some((row) =>
            row.path.startsWith(directoryPath),
          ),
          'extra directory',
        );
        await walk(path);
      } else {
        ensureSite(entry.isFile(), 'special entry');
        const filePath = relative(site, path);
        ensureSite(
          INSTALL_ACTUAL_SITE_FILES.some((row) => row.path === filePath),
          'unknown file',
        );
        paths.push(filePath);
      }
    }
  };
  await walk(site);
  ensureSite(
    JSON.stringify(paths.sort()) ===
      JSON.stringify(INSTALL_ACTUAL_SITE_FILES.map((row) => row.path).sort()),
    'missing/extra inventory',
  );
  let total = 0;
  for (const row of INSTALL_ACTUAL_SITE_FILES) {
    await siteAncestors(site, row.path);
    const content = await readBoundedFile(
      resolve(site, row.path),
      row.path.endsWith('.json')
        ? CI_INPUT_LIMITS.metadata
        : CI_INPUT_LIMITS.file,
    );
    ensureSite(
      content.length === row.bytes && sha256(content) === row.sha256,
      'file size/digest mismatch',
    );
    total += content.length;
    validateInstallSiteBudget(total, INSTALL_ACTUAL_SITE_FILES.length);
  }
  return site;
}
export async function requireInstallActualSite(root: string): Promise<string> {
  const expected = resolve(root, INSTALL_SITE_DESTINATION);
  ensureSite(
    process.env.U2_ACTUAL_SITE &&
      resolve(process.env.U2_ACTUAL_SITE) === expected,
    'required restored path missing/differs',
  );
  return inspectInstallActualSite(expected);
}
