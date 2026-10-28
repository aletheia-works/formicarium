import { mkdtemp, readFile, rm } from 'node:fs/promises';
import type { IncomingMessage } from 'node:http';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import type {
  CoreEntry,
  CoreExit,
  CoreLauncher,
} from '../../runtime/contracts.js';
import { coreAssets } from '../../runtime/core.js';
import type { FsEntry } from '../../types/index.js';

/** Minimal ELF header for boundary tests; it is deliberately not executable. */
export function elfHeader({ interpreter = false } = {}) {
  const bytes = new Uint8Array(120);
  bytes.set([0x7f, 69, 76, 70, 2, 1, 1]);
  const view = new DataView(bytes.buffer);
  view.setUint16(16, 2, true);
  view.setUint16(18, 62, true);
  view.setUint32(20, 1, true);
  view.setUint16(52, 64, true);
  view.setUint16(54, 56, true);
  view.setBigUint64(32, 64n, true);
  view.setUint16(56, 1, true);
  view.setUint32(64, interpreter ? 3 : 1, true);
  view.setBigUint64(96, 120n, true);
  view.setBigUint64(104, 120n, true);
  return bytes;
}

export function fileEntry(
  path = '/work/input',
  data = Uint8Array.of(1, 2),
  mode = 0o644,
): Extract<FsEntry, { type: 'file' }> {
  return { path, type: 'file' as const, inodeId: `seed:${path}`, data, mode };
}

export async function isolatedDirectory(test: TestContext) {
  const directory = await mkdtemp(join(tmpdir(), 'formicarium-package-'));
  test.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

/** What one guest run did inside the fake core. */
export interface FakeBehaviour {
  stdout?: Uint8Array[];
  stderr?: Uint8Array[];
  exit?: CoreExit;
  /** Throws from exited, as a core failure would. */
  fail?: unknown;
}
export interface FakeRun {
  program: string;
  args: string[];
  env: Record<string, string>;
  cwd: string;
  /** The filesystem by path; changes show in its snapshot. */
  files: Map<string, CoreEntry>;
  network?: { allow: string[] };
}

const streamOf = (chunks: Uint8Array[] = []) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });

/** In-memory stand-in for the paludarium launcher. */
export function fakeLauncher(
  behave: (run: FakeRun) => FakeBehaviour = () => ({}),
) {
  const runs: FakeRun[] = [];
  const state = { filesystems: 0, disposedFilesystems: 0, disposed: 0 };
  const launcher: CoreLauncher & { runs: FakeRun[]; state: typeof state } = {
    runs,
    state,
    async createFileSystem({ entries = [] }) {
      state.filesystems++;
      const files = new Map(entries.map((entry) => [entry.path, entry]));
      return Object.assign(
        {
          async snapshot() {
            return [...files.values()];
          },
          async dispose() {
            state.disposedFilesystems++;
          },
        },
        { files },
      );
    },
    run({ program, args, env, cwd, filesystem, network }) {
      const run = {
        program,
        args,
        env,
        cwd,
        files: (filesystem as unknown as { files: Map<string, CoreEntry> })
          .files,
        ...(network ? { network } : {}),
      };
      runs.push(run);
      const behaviour = behave(run);
      return {
        stdin: new WritableStream<Uint8Array>(),
        stdout: streamOf(behaviour.stdout),
        stderr: streamOf(behaviour.stderr),
        exited:
          'fail' in behaviour
            ? Promise.reject(behaviour.fail)
            : Promise.resolve(behaviour.exit ?? { kind: 'exited', code: 0 }),
        kill() {},
      };
    },
    async dispose() {
      state.disposed++;
    },
  };
  return launcher;
}

/** The core that bun run build copies to dist/paludarium, as package assets. */
export async function developmentAssets(_test?: TestContext) {
  return coreAssets(
    new URL('../../dist/paludarium/', import.meta.url),
    new URL('../../runtime/node/package-worker.js', import.meta.url),
  );
}

/** Explicit localhost server; each test owns its port and isolation headers. */
export async function serveDirectory(
  root: string,
  {
    isolated = true,
    extraFiles = {},
    csp,
  }: {
    isolated?: boolean;
    extraFiles?: Record<
      string,
      | string
      | Uint8Array
      | ((
          request: IncomingMessage,
        ) => string | Uint8Array | Promise<string | Uint8Array>)
    >;
    csp?: string;
  } = {},
) {
  const server = createServer(async (request, response) => {
    if (isolated) {
      response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
      response.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    }
    response.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    if (csp) response.setHeader('Content-Security-Policy', csp);
    try {
      const path = decodeURIComponent(
        new URL(request.url ?? '/', 'http://localhost').pathname,
      );
      if (path.split('/').includes('..') || path.includes('\0'))
        throw new Error('invalid path');
      const extra = extraFiles[path];
      const content =
        (typeof extra === 'function' ? await extra(request) : extra) ??
        (path === '/'
          ? '<!doctype html><title>package consumer</title>'
          : await readFile(join(root, path)));
      response.setHeader(
        'Content-Type',
        path.endsWith('.mjs') || path.endsWith('.js')
          ? 'text/javascript'
          : path.endsWith('.wasm')
            ? 'application/wasm'
            : path === '/'
              ? 'text/html'
              : 'application/octet-stream',
      );
      response.end(content);
    } catch {
      response.statusCode = 404;
      response.end('missing');
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((error?: Error) => (error ? reject(error) : resolve())),
      ),
  };
}
