import { requireCondition } from './evidence.ts';

/** Only exact stable and positive RC ordinal versions cross the publication boundary. */
export function publicationChannel(version: string): 'stable' | 'rc' {
  requireCondition(
    typeof version === 'string' &&
      version === version.trim() &&
      /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(-rc\.[1-9][0-9]*)?$/.test(
        version,
      ),
    'publication version invalid',
  );
  return version.includes('-rc.') ? 'rc' : 'stable';
}
