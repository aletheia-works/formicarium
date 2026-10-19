import { join } from 'node:path';
import {
  type SiteIdentity,
  siteIdentityText,
  validateSiteIdentity,
} from '../src/model/site-identity.ts';
import { fail, writeText } from './common.ts';

export const IDENTITY_FILE = 'site-identity.json';

/** Run number, source commit and candidate of this build (NFR8.8, S19). */
export function identityFromEnvironment(
  env: NodeJS.ProcessEnv,
  candidateId: string,
): SiteIdentity {
  const runNumber = Number(env.GITHUB_RUN_NUMBER ?? '');
  if (!Number.isSafeInteger(runNumber) || runNumber < 1)
    fail('config-invalid', 'GITHUB_RUN_NUMBER must be a positive integer');
  return validateSiteIdentity({
    schemaVersion: 1,
    runNumber,
    sourceCommit: env.SHOWCASE_SOURCE_COMMIT ?? env.GITHUB_SHA ?? '',
    candidateId,
  });
}

/** Writes site-identity.json at the site root; it is part of the inventory. */
export async function writeSiteIdentity(
  siteDir: string,
  identity: SiteIdentity,
): Promise<string> {
  const text = siteIdentityText(identity);
  await writeText(join(siteDir, IDENTITY_FILE), text);
  return text;
}
