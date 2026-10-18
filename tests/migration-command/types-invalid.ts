import type {
  CommandResult,
  CommandSession,
  GuestCatalog,
  Session,
} from '@aletheia-works/formicarium';
import { createCommandSession } from '@aletheia-works/formicarium';

declare const session: Session;
declare const catalog: GuestCatalog;
declare const shell: CommandSession;
// @ts-expect-error the options object with a catalog is mandatory.
createCommandSession(session);
// @ts-expect-error the catalog is passed inside an options object.
createCommandSession(session, catalog);
// @ts-expect-error input is a single string, not argv.
shell.execute(['ls']);
// @ts-expect-error a real AbortSignal is required.
shell.execute('ls', { signal: 'abort' });
// @ts-expect-error there is no command timeout option.
shell.execute('ls', { timeoutMs: 1 });
// @ts-expect-error onOutput receives a chunk callback, not a string.
shell.execute('ls', { onOutput: 'stdout' });
const result: CommandResult = {
  // @ts-expect-error kind is a closed union.
  kind: 'pwd',
  exitCode: 0,
  stdout: new Uint8Array(),
  stderr: new Uint8Array(),
};
const text: CommandResult = {
  kind: 'builtin',
  exitCode: 0,
  // @ts-expect-error stdout is original bytes, never a decoded string.
  stdout: 'text',
  stderr: new Uint8Array(),
};
void result;
void text;
