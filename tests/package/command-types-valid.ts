import type {
  CommandOptions,
  CommandResult,
  CommandSession,
  GuestCatalog,
  InstallResult,
  OutputChunk,
  Progress,
  Session,
} from '@aletheia-works/formicarium';
import { createCommandSession } from '@aletheia-works/formicarium';

declare const session: Session;
declare const catalog: GuestCatalog;
const shell: CommandSession = createCommandSession(session, { catalog });
const options: CommandOptions = {
  signal: new AbortController().signal,
  onProgress(progress: Progress) {
    const total: number | null = progress.totalBytes;
    void total;
  },
  onOutput(chunk: OutputChunk) {
    const bytes: Uint8Array = chunk.bytes;
    void bytes;
  },
};
const pending: Promise<CommandResult> = shell.execute('ls /work', options);
void shell.execute('');
void pending.then((result) => {
  const kind: 'empty' | 'builtin' | 'install' | 'guest' = result.kind;
  const stdout: Uint8Array = result.stdout;
  const stderr: Uint8Array = result.stderr;
  const runId: string | undefined = result.runId;
  const installation: InstallResult | undefined = result.installation;
  void [kind, stdout, stderr, runId, installation, result.exitCode];
});
