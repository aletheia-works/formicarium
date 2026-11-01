import { requireCondition } from './evidence.ts';

/**
 * Only an exact stable version crosses the publication boundary: formicarium
 * makes no release candidates, and every version is published under latest.
 */
export function requireStableVersion(version: string) {
  requireCondition(
    typeof version === 'string' &&
      version === version.trim() &&
      /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/.test(version),
    'publication version invalid',
  );
  return version;
}
