import type { GuestCatalog } from '@aletheia-works/formicarium';
import {
  type AcceptanceRow,
  type EnvironmentId,
  judgeRow,
} from '../scripts/acceptance.ts';

export interface PageObservation {
  coi: boolean;
  installed: boolean;
  exitCode: number | null;
  stdout: string;
  installMs: number | null;
  versionMs: number | null;
  error: string | null;
}

/**
 * `install <tool>` then `<tool> --version` on the acceptance page. Playwright
 * and WebDriver both send this function's source to the page, so it must not
 * refer to anything outside its own body.
 */
export async function acceptInPage({
  catalog,
  name,
}: {
  catalog: GuestCatalog;
  name: string;
}): Promise<PageObservation> {
  const api = await import('@aletheia-works/formicarium');
  const { createSession } = await import('@aletheia-works/formicarium/browser');
  const session = await createSession();
  let installMs: number | null = null;
  let versionMs: number | null = null;
  try {
    const shell = api.createCommandSession(session, { catalog });
    const started = performance.now();
    const installed = await shell.execute(`install ${name}`);
    installMs = Math.round(performance.now() - started);
    const before = performance.now();
    const run = await shell.execute(`${name} --version`);
    versionMs = Math.round(performance.now() - before);
    return {
      coi: crossOriginIsolated,
      installed: installed.kind === 'install' && installed.exitCode === 0,
      exitCode: run.exitCode,
      stdout: api.decodeUtf8(run.stdout),
      installMs,
      versionMs,
      error: null,
    };
  } catch (error) {
    return {
      coi: crossOriginIsolated,
      installed: false,
      exitCode: null,
      stdout: '',
      installMs,
      versionMs,
      error: String((error as { code?: unknown }).code ?? 'unexpected'),
    };
  } finally {
    await session.dispose();
  }
}

/** Judges one page observation; a page without isolation never passes. */
export function rowFromPage(
  tool: { tool: string; version: string },
  environment: EnvironmentId,
  observed: PageObservation,
): AcceptanceRow {
  return judgeRow({
    tool: tool.tool,
    expectedVersion: tool.version,
    environment,
    exitCode: observed.exitCode,
    stdout: observed.stdout,
    installMs: observed.installMs,
    versionMs: observed.versionMs,
    error: !observed.coi
      ? 'not-cross-origin-isolated'
      : !observed.installed && !observed.error
        ? 'install-failed'
        : observed.error,
  });
}
