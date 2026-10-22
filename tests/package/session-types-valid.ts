import {
  fixtureToFsEntries,
  type GuestExpectation,
  type GuestHandle,
  type RunResult,
  registerValidatedGuest,
  runValidatedGuest,
  type Session,
  validateGuest,
} from '@aletheia-works/formicarium';

declare const session: Session;
declare const expected: GuestExpectation;
const handle: GuestHandle = validateGuest(new Uint8Array(), expected);
const entries = fixtureToFsEntries([
  {
    path: '/work/a',
    type: 'file',
    mode: 420,
    inodeId: 'a',
    data: new Uint8Array(),
  },
]);
const result: Promise<RunResult> = runValidatedGuest(session, handle, {
  args: ['--version'],
  signal: new AbortController().signal,
});
const registered: Promise<void> = registerValidatedGuest(
  session,
  'tool',
  handle,
  { signal: new AbortController().signal },
);
void entries;
void result;
void registered;
