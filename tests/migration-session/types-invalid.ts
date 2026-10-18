import {
  fixtureToFsEntries,
  type GuestHandle,
  registerValidatedGuest,
  runValidatedGuest,
  type Session,
  validateGuest,
} from '@aletheia-works/formicarium';

declare const session: Session;
declare const handle: GuestHandle;
// @ts-expect-error guest bytes cannot be text
validateGuest('guest', {});
// @ts-expect-error expectation includes metadata and both digest pins
validateGuest(new Uint8Array(), { elfSha256: 'pin' });
fixtureToFsEntries([
  // @ts-expect-error a file requires inode identity
  { path: '/work/a', type: 'file', mode: 420, data: new Uint8Array() },
]);
// @ts-expect-error public handle digest is readonly
handle.digest = 'changed';
// @ts-expect-error validated run does not accept replacement raw bytes
runValidatedGuest(session, handle, { guest: new Uint8Array() });
// @ts-expect-error registration signal must be AbortSignal
registerValidatedGuest(session, 'tool', handle, { signal: 'abort' });
