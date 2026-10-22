import type {
  CatalogEntry,
  GuestCatalog,
  Installer,
  InstallResult,
  Progress,
  Session,
} from '@aletheia-works/formicarium';
import { createInstaller } from '@aletheia-works/formicarium';

declare const session: Session;
declare const entry: CatalogEntry;
const catalog: GuestCatalog = {
  schemaVersion: 1,
  catalogId: 'caller',
  defaults: { [entry.tool]: entry.versionOrName },
  entries: [entry],
  extension: true,
};
const installer: Installer = createInstaller(session, catalog);
const result: Promise<InstallResult> = installer.install('tool@fixed', {
  signal: new AbortController().signal,
  onProgress(progress: Progress) {
    const total: number | null = progress.totalBytes;
    void total;
  },
});
void result;
