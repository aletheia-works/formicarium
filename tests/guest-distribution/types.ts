import type {
  GuestBuild,
  GuestSelection,
  SelectedGuest,
} from '../../integration/guest-distribution/index.js';
import { resolveGuest as resolve } from '../../integration/guest-distribution/resolver.js';

const selection: GuestSelection = {
  tool: 'aube',
  ref: 'pr-1645',
  fixture: '',
  base: 'https://example.test/site/',
};
const pending: Promise<SelectedGuest> = resolve(selection);
pending.then((selected) => {
  const build: GuestBuild = selected.build;
  const guest: Uint8Array = selected.guest;
  const cwd: string = selected.cwd;
  for (const entry of selected.entries)
    if (entry.type === 'file') entry.data satisfies Uint8Array;
  return { build, guest, cwd };
});
// @ts-expect-error Deliberately malformed input exercises the runtime guard.
resolve({ tool: 'other', base: 'https://example.test/' });
// @ts-expect-error Deliberately malformed input exercises the runtime guard.
resolve({ tool: 'pitchfork' });
