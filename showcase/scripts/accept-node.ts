import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  CommandSession,
  FsEntry,
  GuestCatalog,
  NetworkOptions,
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
  createSession(options?: { entries?: readonly FsEntry[] }): Promise<Session>;
  createCommandSession(
    session: Session,
    options: { catalog: GuestCatalog },
  ): CommandSession;
  decodeUtf8(bytes: Uint8Array): string;
}

/**
 * A TLS run of a tool against the acceptance server: `--version` never
 * reaches the TLS and bignum code, so a guest built with instructions the
 * emulator cannot run (GMP's BMI2/ADX for the runner CPU) passed until a
 * clone on the site died of SIGILL. The server answers 404 after the
 * handshake and the certificate check, which is all the run needs.
 */
export interface TlsCheck {
  /** Guests the run needs besides the tool, installed at their defaults. */
  companions: readonly string[];
  /** The run against `url`, trusting `caPath`, with localhost at `port`. */
  line: (url: string, caPath: string, port: string) => string;
}
export const TLS_CHECKS: Readonly<Record<string, TlsCheck>> = Object.freeze({
  git: {
    companions: ['git-remote-https'],
    // The job certificate names only localhost, and the server listens on
    // 127.0.0.1, so curl is told where localhost is.
    line: (url: string, caPath: string, port: string) =>
      `git -c http.sslCAInfo=${caPath} -c http.curloptResolve=localhost:${port}:127.0.0.1 ls-remote ${url}`,
  },
});
/** The job CA in the guest, for the TLS checks. */
export const GUEST_CA_PATH = '/root/job-ca.pem';
/** The server's answer to a missing repository, after a good handshake. */
const REPOSITORY_NOT_FOUND = /^fatal: repository '[^']+' not found$/m;

export interface TlsTarget {
  /** https://localhost:<port> of the acceptance server. */
  origin: string;
  caPem: Uint8Array;
}

/** `install <tool>` then `<tool> --version` through the public command API. */
export async function acceptTool(
  api: CommandApi,
  catalog: GuestCatalog,
  tool: { tool: string; version: string },
  environment: EnvironmentId,
  clock: () => number = () => performance.now(),
  tls: TlsTarget | null = null,
): Promise<AcceptanceRow> {
  let installMs: number | null = null;
  let versionMs: number | null = null;
  let session: Session | undefined;
  const check = tls ? TLS_CHECKS[tool.tool] : undefined;
  try {
    session = await api.createSession(
      check && tls
        ? {
            entries: [
              {
                path: GUEST_CA_PATH,
                type: 'file',
                mode: 0o644,
                inodeId: 'job-ca',
                data: tls.caPem,
              },
            ],
          }
        : undefined,
    );
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
    if (check && tls && run.exitCode === 0) {
      const failure = await tlsFailure(api, shell, check, tls);
      if (failure)
        return judgeRow({
          tool: tool.tool,
          expectedVersion: tool.version,
          environment,
          exitCode: run.exitCode,
          stdout: failure,
          installMs,
          versionMs,
          error: 'tls-failed',
        });
    }
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

/** The TLS check's output when it failed; null when it reached the server. */
async function tlsFailure(
  api: CommandApi,
  shell: CommandSession,
  check: TlsCheck,
  tls: TlsTarget,
): Promise<string | null> {
  for (const companion of check.companions) {
    const installed = await shell.execute(`install ${companion}`);
    if (installed.exitCode !== 0)
      return `install ${companion}: exit ${installed.exitCode}`;
  }
  const { port } = new URL(tls.origin);
  const network: NetworkOptions = { allow: [`127.0.0.1:${port}`] };
  const run = await shell.execute(
    check.line(`${tls.origin}/missing.git`, GUEST_CA_PATH, port),
    { network },
  );
  const stderr = api.decodeUtf8(run.stderr);
  return run.exitCode === 128 && REPOSITORY_NOT_FOUND.test(stderr)
    ? null
    : `exit ${run.exitCode}: ${stderr}`;
}

export async function acceptAll(
  api: CommandApi,
  catalog: GuestCatalog,
  tools: readonly { tool: string; version: string }[],
  environment: EnvironmentId,
  tls: TlsTarget | null = null,
): Promise<AcceptanceRow[]> {
  const rows: AcceptanceRow[] = [];
  // One tool at a time: no heavy work runs in parallel while timing.
  for (const tool of tools)
    rows.push(
      await acceptTool(api, catalog, tool, environment, undefined, tls),
    );
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
  const caPath = process.env.NODE_EXTRA_CA_CERTS;
  if (!caPath)
    fail('config-invalid', 'NODE_EXTRA_CA_CERTS must name the job CA');
  const rows = await acceptAll(
    {
      createSession: (options) => createSession(options),
      createCommandSession: api.createCommandSession,
      decodeUtf8: api.decodeUtf8,
    },
    absoluteCatalog(site.catalog, `${origin}/`),
    site.tools,
    'node',
    { origin, caPem: new Uint8Array(await readFile(caPath)) },
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
