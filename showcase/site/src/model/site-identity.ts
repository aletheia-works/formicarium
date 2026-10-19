import { canonicalJson } from '../../../scripts/build-key.ts';
import {
  COMMIT_HEX,
  exactKeys,
  isRecord,
  reject,
  SHA256_HEX,
} from './model-error.ts';

/**
 * site-identity.json (NFR8.8): only the run, the source commit and the
 * candidate. It is part of the site inventory and holds no inventory digest.
 */
export interface SiteIdentity {
  schemaVersion: 1;
  runNumber: number;
  sourceCommit: string;
  candidateId: string;
}

const CODE = 'identity-invalid';

export function validateSiteIdentity(value: unknown): SiteIdentity {
  if (!isRecord(value)) reject(CODE, 'identity must be an object');
  exactKeys(CODE, value, [
    'schemaVersion',
    'runNumber',
    'sourceCommit',
    'candidateId',
  ]);
  if (value.schemaVersion !== 1) reject(CODE, 'schemaVersion must be 1');
  if (!Number.isSafeInteger(value.runNumber) || (value.runNumber as number) < 1)
    reject(CODE, 'runNumber must be a positive integer');
  if (
    typeof value.sourceCommit !== 'string' ||
    !COMMIT_HEX.test(value.sourceCommit)
  )
    reject(CODE, 'sourceCommit must be a 40-hex commit');
  if (
    typeof value.candidateId !== 'string' ||
    !SHA256_HEX.test(value.candidateId)
  )
    reject(CODE, 'candidateId must be a sha256');
  return {
    schemaVersion: 1,
    runNumber: value.runNumber as number,
    sourceCommit: value.sourceCommit,
    candidateId: value.candidateId,
  };
}

/** The exact bytes written to the site (canonical JSON, no trailing newline). */
export const siteIdentityText = (identity: SiteIdentity) =>
  canonicalJson(validateSiteIdentity(identity));

/** True when the deployed identity names this run, commit and candidate. */
export function sameSiteIdentity(a: SiteIdentity, b: SiteIdentity): boolean {
  return (
    a.runNumber === b.runNumber &&
    a.sourceCommit === b.sourceCommit &&
    a.candidateId === b.candidateId
  );
}
