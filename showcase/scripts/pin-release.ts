import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fetchBounded } from './acquire.ts';
import { parseUniqueJson } from './build-key.ts';
import {
  type FormicariumRelease,
  validateFormicariumRelease,
} from './config.ts';
import { fail, runCli } from './errors.ts';
import type { FetchLike } from './github.ts';
import { TRANSFER_POLICY } from './limits.ts';
import {
  PACKAGE_NAME,
  packDistribute,
  REGISTRY,
  remoteTagCommit,
  type TagCommit,
} from './pack.ts';
import { SHOWCASE_ROOT, workLayout, writeJson } from './paths.ts';

/** Only stable releases are distributed; release candidates stay on npm's next. */
const STABLE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

/**
 * The pin for a published stable version: npm's dist.integrity and the
 * commit of its tag, then the same checks distribute makes (download,
 * integrity, tag commit), so a pin that is written is one that distributes.
 */
export async function pinRelease(
  version: string,
  options: { tagCommit: TagCommit; fetchImpl?: FetchLike },
): Promise<FormicariumRelease> {
  if (!STABLE.test(version))
    fail('config-invalid', `only a stable version is pinned, not ${version}`);
  let integrity: unknown;
  try {
    const { bytes } = await fetchBounded(
      `${REGISTRY}/${PACKAGE_NAME.replace('/', '%2f')}/${version}`,
      {
        maxBytes: TRANSFER_POLICY.maxMetadataBytes,
        fetchImpl: options.fetchImpl,
      },
    );
    integrity = (
      parseUniqueJson(
        new TextDecoder('utf-8', { fatal: true }).decode(bytes),
      ) as {
        dist?: { integrity?: unknown };
      }
    ).dist?.integrity;
  } catch (error) {
    return fail('release-unavailable', `npm has no ${version}`, error);
  }
  const sourceCommit = options.tagCommit(`v${version}`);
  if (sourceCommit === null)
    fail('release-unavailable', `release tag v${version} is missing`);
  const release = validateFormicariumRelease({
    schemaVersion: 1,
    version,
    integrity,
    sourceCommit,
  })!;
  const scratch = await mkdtemp(join(tmpdir(), 'formicarium-pin-'));
  try {
    await packDistribute({
      release,
      tagCommit: options.tagCommit,
      layout: workLayout(scratch),
      fetchImpl: options.fetchImpl,
    });
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
  return release;
}

if (import.meta.main)
  await runCli('pin-release', async () => {
    const version = process.argv[2] ?? '';
    const release = await pinRelease(version, { tagCommit: remoteTagCommit });
    await writeJson(join(SHOWCASE_ROOT, 'formicarium-release.json'), {
      schemaVersion: 1,
      ...release,
    });
    console.log(`pinned ${PACKAGE_NAME}@${release.version}`);
  });
