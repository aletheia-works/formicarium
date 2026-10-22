import type {
  GuestCatalog,
  Installer,
  Progress,
  Session,
} from '@aletheia-works/formicarium';
import { createInstaller } from '@aletheia-works/formicarium';

declare const session: Session;
declare const installer: Installer;
const catalog: GuestCatalog = {
  // @ts-expect-error schemaVersion is an exact literal.
  schemaVersion: 2,
  catalogId: 'caller',
  defaults: {},
  entries: [],
};
// @ts-expect-error catalog is mandatory.
createInstaller(session);
// @ts-expect-error selection is a string.
installer.install(1);
// @ts-expect-error real AbortSignal is required.
installer.install('tool', { signal: 'abort' });
const progress: Progress = {
  operationId: 'one',
  sequence: 0,
  phase: 'fetch',
  processedBytes: 0,
  // @ts-expect-error totalBytes does not permit a string.
  totalBytes: 'unknown',
};
void catalog;
void progress;
