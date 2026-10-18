import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  CommandSession,
  GuestCatalog,
  Session,
} from '@aletheia-works/formicarium';
import { startAcceptServer } from './accept-server.ts';
import {
  type AcceptancePart,
  type AcceptanceRow,
  type EnvironmentId,
  judgeRow,
} from './acceptance.ts';
import { parseUniqueJson } from './build-key.ts';
import { absoluteCatalog } from './catalog.ts';
import { fail, runCli } from './errors.ts';
import {
  SHOWCASE_ROOT,
  type WorkLayout,
  workLayout,
  writeJson,
} from './paths.ts';
import { loadResolutions } from './resolve.ts';
import { createJobTls, removeJobTls, tlsFromEnvironment } from './tls.ts';

export interface CommandApi {
  createSession(): Promise<Session>;
  createCommandSession(
    session: Session,
    options: { catalog: GuestCatalog },
  ): CommandSession;
  decodeUtf8(bytes: Uint8Array): string;
}

/** `install <tool>` then `<tool> --version` through the public command API. */
export async function acceptTool(
  api: CommandApi,
  catalog: GuestCatalog,
  tool: { tool: string; version: string },
  environment: EnvironmentId,
  clock: () => number = () => performance.now(),
): Promise<AcceptanceRow> {
  let installMs: number | null = null;
  let versionMs: number | null = null;
  let session: Session | undefined;
  try {
    session = await api.createSession();
    const shell = api.createCommandSession(session, { catalog });
    const started = clock();
    const installed = await shell.execute(`install ${tool.tool}`);
    installMs = Math.round(clock() - started);
    if (installed.kind !== 'install' || installed.exitCode !== 0)
      return judgeRow({
        tool: tool.tool,
        expectedVersion: tool.version,
        environment,
        exitCode: installed.exitCode,
        stdout: api.decodeUtf8(installed.stdout),
        installMs,
        versionMs,
        error: 'install-failed',
      });
    const before = clock();
    const run = await shell.execute(`${tool.tool} --version`);
    versionMs = Math.round(clock() - before);
    return judgeRow({
      tool: tool.tool,
      expectedVersion: tool.version,
      environment,
      exitCode: run.exitCode,
      stdout: api.decodeUtf8(run.stdout),
      installMs,
      versionMs,
    });
  } catch (error) {
    const code = (error as { code?: unknown })?.code;
    return judgeRow({
      tool: tool.tool,
      expectedVersion: tool.version,
      environment,
      exitCode: null,
      stdout: '',
      installMs,
      versionMs,
      error: typeof code === 'string' ? code : 'unexpected',
    });
  } finally {
    await session?.dispose();
  }
}

export async function acceptAll(
  api: CommandApi,
  catalog: GuestCatalog,
  tools: readonly { tool: string; version: string }[],
  environment: EnvironmentId,
): Promise<AcceptanceRow[]> {
  const rows: AcceptanceRow[] = [];
  // One tool at a time: no heavy work runs in parallel while timing.
  for (const tool of tools)
    rows.push(await acceptTool(api, catalog, tool, environment));
  return rows;
}

export async function loadSite(layout: WorkLayout) {
  const catalog = parseUniqueJson(
    await readFile(layout.catalog, 'utf8'),
  ) as GuestCatalog;
  const resolutions = await loadResolutions(layout);
  return {
    catalog,
    tools: resolutions.tools.map(({ tool, version }) => ({ tool, version })),
  };
}

/** Child process: trusts only the job CA through NODE_EXTRA_CA_CERTS. */
async function child(layout: WorkLayout) {
  const origin = process.env.SHOWCASE_ACCEPT_ORIGIN;
  if (!origin?.startsWith('https://localhost:'))
    fail('config-invalid', 'SHOWCASE_ACCEPT_ORIGIN must be https://localhost');
  const api = await import('@aletheia-works/formicarium');
  const { createSession } = await import('@aletheia-works/formicarium/node');
  const site = await loadSite(layout);
  const rows = await acceptAll(
    {
      createSession: () => createSession(),
      createCommandSession: api.createCommandSession,
      decodeUtf8: api.decodeUtf8,
    },
    absoluteCatalog(site.catalog, `${origin}/`),
    site.tools,
    'node',
  );
  const part: AcceptancePart = {
    schemaVersion: 1,
    environment: {
      environment: 'node',
      observed: {
        node: process.versions.node,
        platform: process.platform,
        arch: process.arch,
      },
    },
    rows,
  };
  await writeJson(join(layout.acceptance, 'node.json'), part);
  for (const row of rows)
    console.log(
      `${row.tool}/node ${row.status} install ${row.installMs} ms, --version ${row.versionMs} ms`,
    );
}

async function parent(layout: WorkLayout) {
  const provided = await tlsFromEnvironment(process.env);
  const tls = provided ?? (await createJobTls(layout.tls));
  try {
    const server = await startAcceptServer({
      siteRoot: layout.site,
      packageRoot: join(
        SHOWCASE_ROOT,
        'node_modules',
        '@aletheia-works',
        'formicarium',
      ),
      cert: tls.cert,
      key: tls.key,
    });
    try {
      const code = await new Promise<number | null>((done) => {
        const process_ = spawn(
          process.execPath,
          [fileURLToPath(import.meta.url), '--child'],
          {
            stdio: 'inherit',
            env: {
              ...process.env,
              NODE_EXTRA_CA_CERTS: tls.caCert,
              SHOWCASE_ACCEPT_ORIGIN: server.origin,
            },
          },
        );
        process_.once('exit', done);
        process_.once('error', () => done(null));
      });
      if (code !== 0)
        fail('acceptance-row-missing', 'Node acceptance process failed');
    } finally {
      await server.close();
    }
  } finally {
    await removeJobTls(tls);
  }
}

if (import.meta.main) {
  const layout = workLayout();
  if (process.argv[2] === '--child')
    await runCli('node acceptance', () => child(layout), {});
  else await runCli('node acceptance', () => parent(layout));
}
