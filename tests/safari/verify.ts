// Official Safari WebDriver only; this runner never enables remote automation.
import assert from 'node:assert/strict';
import { type ChildProcess, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import {
  lstat,
  mkdir,
  mkdtemp,
  open,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { createServer } from 'node:net';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { lookupSession } from '../../runtime/registry.js';
import {
  normalizeTranscript,
  parseSessionScript,
} from '../../runtime/session.js';
import {
  daemonSection,
  outputOf,
  transcriptOutputs,
} from '../shared/pitchfork-basic.js';

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);
const CAP = 64 * 1024 * 1024;
const hashes = {
  'dist/guests/aube':
    'c7d7d13692d01c5f6adc5511c40adc6b3769080b7c433b44c411a3e52ebcd99e',
  'dist/guests/pitchfork':
    'f30395a418e526e939350cc87e03d43c92d1aa0a0b0b104130761a8b8daa841e',
  'dist/guests/probe':
    'ca67cc4efd284ae93190d14cc9b394220cb7a2f1c7f01f682bb9f195589387be',
  'fixtures/baseline/aube-1645.native.txt':
    '8e8df25b072f4970f98d160a2b7985ff79b60959e66e3f8da40d499036397a2e',
  'fixtures/baseline/pitchfork-basic.native.txt':
    'd8ec13b28acbd3c5bec833ca8cfa3d4d0612e46d5537080ada8c44d69e2b1fc9',
};
type Outcome = {
  error?: string;
  exitCode?: number;
  transcript?: string;
  steps?: { command: string; exitCode: number }[];
};
type Snapshot = {
  stdout: string;
  stderr: string;
  result: Outcome | null;
  isolated: boolean;
  visibility: string;
  userAgent: string;
  pageStatus: string | null;
  outputExit: string | null;
};

async function identity() {
  const files = [
    'blink.lock',
    'dist/blink/blink.mjs',
    'dist/blink/blink.wasm',
    'dist/blink/build-info.json',
    'dist/guests/hello',
    'dist/guests/exit3',
    ...Object.keys(hashes),
  ];
  const digests: Record<string, string> = {};
  for (const file of files)
    digests[file] = createHash('sha256')
      .update(await readFile(path.join(root, file)))
      .digest('hex');
  const lock = await readFile(path.join(root, 'blink.lock'), 'utf8');
  const info = JSON.parse(
    await readFile(path.join(root, 'dist/blink/build-info.json'), 'utf8'),
  ) as {
    blinkCommit: string;
    blinkSourceDirty: boolean;
    configure: string;
    link: string;
  };
  return { digests, info, lock };
}
function checkIdentity(value: Awaited<ReturnType<typeof identity>>) {
  assert.match(value.info.blinkCommit, /^[a-f0-9]{40}$/);
  assert.equal(/^commit=(\w+)$/m.exec(value.lock)?.[1], value.info.blinkCommit);
  assert.equal(value.info.blinkSourceDirty, false);
  assert.match(value.info.configure, /--disable-jit/);
  assert.match(value.info.link, /(?:^|\s)-sMAXIMUM_MEMORY=1GB(?:\s|$)/);
  for (const [file, expected] of Object.entries(hashes))
    assert.equal(value.digests[file], expected, file);
}
async function port() {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  assert(address && typeof address !== 'string');
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  return address.port;
}

async function main() {
  const args = process.argv.slice(2);
  const diagnostic = args[0] === '--diagnose-visibility';
  if (diagnostic) args.shift();
  const official = args.includes('--official-diagnostics');
  if (official) args.splice(args.indexOf('--official-diagnostics'), 1);
  const instance = args.includes('--instance-diagnostics');
  if (instance) args.splice(args.indexOf('--instance-diagnostics'), 1);
  assert(
    !instance || (diagnostic && !official),
    '--instance-diagnostics requires --diagnose-visibility and excludes --official-diagnostics',
  );
  assert(
    !official || diagnostic,
    '--official-diagnostics requires --diagnose-visibility',
  );
  assert(
    args.length === 0 || (args.length === 2 && args[0] === '--output'),
    'usage: node tests/safari/verify.js [--diagnose-visibility] [--output directory]',
  );
  const out = path.resolve(
    args[1] ??
      path.join(
        root,
        diagnostic
          ? '.artifacts/safari-visibility-diagnostic-v1'
          : '.artifacts/safari-core-v1',
      ),
  );
  await mkdir(path.dirname(out), { recursive: true });
  await mkdir(out); // Existing evidence is never reused or overwritten.
  let used = 0;
  let requestIndex = 0;
  let heldStreams = 0;
  let session: string | undefined;
  let base = '';
  const diagnosticDeadline = Date.now() + 120_000;
  let diagnosticActive = diagnostic;
  let moduleCache: string | undefined;
  let driverPid: number | undefined;
  let sessionOutcome: unknown = null;
  let sessionCreationTimeout = false;
  const officialDirectory = path.join(
    homedir(),
    'Library/Logs/com.apple.WebDriver',
  );
  type LogMetadata = {
    name: string;
    size: number;
    mtimeMs: number;
    regular: boolean;
    symlink: boolean;
  };
  let officialBefore: LogMetadata[] | undefined;
  type ProcessIdentity = {
    pid: number;
    ppid: number;
    start: string;
    executable: string;
    chain: number[];
    observedAt: number;
  };
  const lineage = new Map<number, ProcessIdentity>();
  let samplerStopped = false;
  let sampler: Promise<void> | undefined;
  let psIndex = 0;
  let lineageFrozen = false;
  let lineageFailure: unknown;
  let failure: unknown;
  const children: {
    child: ChildProcess;
    name: string;
    chunks: Buffer[];
    stdoutChunks: Buffer[];
  }[] = [];
  const results: unknown[] = [];
  const reserve = (length: number) => {
    if (used + length > CAP) throw new Error('64MiB evidence cap exceeded');
    used += length;
  };
  async function persist(
    name: string,
    value: string | Buffer,
    reserved = false,
  ) {
    const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value);
    if (!reserved) reserve(bytes.length);
    const target = path.join(out, name);
    await writeFile(target, bytes, { flag: 'wx' });
    assert(
      (await readFile(target)).equals(bytes),
      `persisted bytes differ: ${name}`,
    );
  }
  const json = (name: string, value: unknown) =>
    persist(name, `${JSON.stringify(value, null, 2)}\n`);
  async function ps(
    argv: string[],
    deadline: number,
    absentAllowed = false,
  ): Promise<string> {
    assert(Date.now() < deadline, 'process metadata deadline');
    // Global numeric output stays in memory only, never in the child log registry.
    const child = spawn('/bin/ps', argv, { stdio: ['ignore', 'pipe', 'pipe'] });
    children.push({
      child,
      name: `lineage-ps-${++psIndex}`,
      chunks: [],
      stdoutChunks: [],
    });
    const chunks: Buffer[] = [];
    let error: unknown;
    child.once('error', (value) => {
      error = value;
    });
    child.stdout?.on('data', (chunk: Buffer) => {
      try {
        assert(
          used + heldStreams + chunk.length <= CAP - 1024 * 1024,
          'process metadata evidence cap',
        );
        reserve(chunk.length);
        chunks.push(Buffer.from(chunk));
      } catch (value) {
        error = value;
        child.kill('SIGTERM');
      }
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      try {
        reserve(chunk.length);
      } catch (value) {
        error = value;
        child.kill('SIGTERM');
      }
      error ??= new Error('ps stderr: process metadata unavailable');
    });
    const end = Math.min(deadline, Date.now() + 2000);
    while (
      !error &&
      child.exitCode === null &&
      child.signalCode === null &&
      Date.now() < end
    )
      await delay(20);
    if (error || (child.exitCode === null && child.signalCode === null)) {
      child.kill('SIGTERM');
      throw error ?? new Error('ps 2s deadline');
    }
    const text = Buffer.concat(chunks).toString('utf8');
    assert(
      child.signalCode === null &&
        (child.exitCode === 0 ||
          (absentAllowed && child.exitCode === 1 && !text.trim())),
      'ps failed',
    );
    return text;
  }
  async function processDetails(
    pids: number[],
    deadline: number,
    absentAllowed = false,
  ) {
    const text = await ps(
      ['-p', pids.join(','), '-o', 'pid=,ppid=,lstart=,comm='],
      deadline,
      absentAllowed,
    );
    return text
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => {
        const match =
          /^\s*(\d+)\s+(\d+)\s+(\S+\s+\S+\s+\d+\s+\d+:\d+:\d+\s+\d+)\s+(.+?)\s*$/.exec(
            line,
          );
        assert(match, 'invalid targeted ps metadata');
        const pid = Number(match[1]);
        assert(pids.includes(pid), 'ps returned unrelated process');
        return {
          pid,
          ppid: Number(match[2]),
          start: match[3].replace(/\s+/g, ' '),
          executable: match[4],
        };
      });
  }
  async function sampleLineage() {
    for (let sample = 0; !samplerStopped; sample++) {
      assert(
        sample < 1200 && Date.now() < diagnosticDeadline,
        'lineage sampling limit',
      );
      assert(driverPid, 'owned driver PID absent');
      const text = await ps(['-ax', '-o', 'pid=,ppid='], diagnosticDeadline);
      const parents = new Map<number, number>();
      for (const line of text.split('\n').filter((line) => line.trim())) {
        const match = /^\s*(\d+)\s+(\d+)\s*$/.exec(line);
        assert(match, 'invalid numeric process table');
        parents.set(Number(match[1]), Number(match[2]));
      }
      const chains = new Map<number, number[]>([[driverPid, [driverPid]]]);
      for (let changed = true; changed; ) {
        changed = false;
        for (const [pid, ppid] of parents)
          if (!chains.has(pid) && chains.has(ppid)) {
            chains.set(pid, [...chains.get(ppid)!, pid]);
            changed = true;
          }
      }
      for (const item of await processDetails(
        [...chains.keys()],
        diagnosticDeadline,
      )) {
        if (item.pid !== driverPid)
          assert.equal(
            item.ppid,
            parents.get(item.pid),
            'process parent changed during lineage observation',
          );
        if (
          item.pid !== driverPid &&
          !/(?:^|\/)(?:safaridriver|webdriver[^/]*)$/i.test(item.executable)
        )
          continue;
        const previous = lineage.get(item.pid);
        assert(
          !previous ||
            (previous.start === item.start &&
              previous.executable === item.executable),
          'lineage PID reused',
        );
        lineage.set(item.pid, {
          ...item,
          chain: chains.get(item.pid)!,
          observedAt: Date.now(),
        });
      }
      await delay(100);
    }
  }
  async function recheckLineage(
    phase: string,
    deadline: number,
    absentAllowed: boolean,
  ) {
    assert(lineage.has(driverPid!), 'owned root lineage missing');
    const observed = await processDetails(
      [...lineage.keys()],
      deadline,
      absentAllowed,
    );
    for (const item of observed) {
      const prior = lineage.get(item.pid)!;
      assert(
        prior.start === item.start && prior.executable === item.executable,
        'bound process PID reused',
      );
    }
    if (!absentAllowed)
      assert.equal(
        observed.length,
        lineage.size,
        'bound process disappeared before cleanup identity freeze',
      );
    await json(`process-lineage-${phase}.json`, {
      executable: '/bin/ps',
      identities: [...lineage.values()],
      observed,
      disappeared: [...lineage.keys()].filter(
        (pid) => !observed.some((item) => item.pid === pid),
      ),
    });
  }
  async function logInventory(): Promise<LogMetadata[]> {
    try {
      const directory = await lstat(officialDirectory);
      assert(
        directory.isDirectory() && !directory.isSymbolicLink(),
        'official log directory must be a nonsymlink directory',
      );
      const items: LogMetadata[] = [];
      for (const name of (await readdir(officialDirectory)).sort()) {
        const item = await lstat(path.join(officialDirectory, name));
        items.push({
          name,
          size: item.size,
          mtimeMs: item.mtimeMs,
          regular: item.isFile(),
          symlink: item.isSymbolicLink(),
        });
      }
      return items;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
  }
  async function collectOfficialLogs() {
    const deadline = Date.now() + 10_000;
    if (instance) {
      assert(
        lineageFrozen && !lineageFailure,
        'process lineage not verified; official log contents not read',
      );
      await recheckLineage('after-cleanup', deadline, true);
    }
    let after: LogMetadata[] = [];
    let candidates: LogMetadata[] = [];
    let previous = '';
    let stable = false;
    const oldNames = new Set(officialBefore?.map((item) => item.name));
    const escapeRegex = (text: string) =>
      text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Session mode requires both filename identities. Instance mode binds
    // startup logs by the owned PID and pre-start inventory, before a session exists.
    const pid = new RegExp(`(?:^|[^0-9])${driverPid}(?:[^0-9]|$)`);
    const id = new RegExp(
      `(?:^|[^A-Za-z0-9-])${escapeRegex(session ?? '')}(?:[^A-Za-z0-9-]|$)`,
      'i',
    );
    do {
      after = await logInventory();
      candidates =
        driverPid && (instance || session)
          ? after.filter(
              (item) =>
                !oldNames.has(item.name) &&
                (instance
                  ? [...lineage.keys()].some((value) =>
                      new RegExp(`(?:^|[^0-9])${value}(?:[^0-9]|$)`).test(
                        item.name,
                      ),
                    )
                  : pid.test(item.name)) &&
                (instance || id.test(item.name)),
            )
          : [];
      const signature = JSON.stringify(candidates);
      if (candidates.length && signature === previous) {
        stable = true;
        break;
      }
      previous = signature;
      await delay(Math.min(250, Math.max(1, deadline - Date.now())));
    } while (Date.now() < deadline);
    await json('official-log-inventory-after.json', {
      directory: officialDirectory,
      driverPid,
      session,
      after,
      candidates,
      stable,
      binding: instance
        ? 'owned-PID-and-new-inventory'
        : 'owned-PID-and-session-ID',
    });
    assert(
      officialBefore && driverPid && (instance || session),
      'official logs cannot be bound: owned driver/session identity absent',
    );
    assert(
      stable && candidates.length > 0,
      instance
        ? 'official instance logs missing or filenames cannot bind owned PID and new inventory; no unrelated contents were read'
        : 'official logs missing or filenames cannot bind both owned PID and actual session ID; no unrelated contents were read',
    );
    assert(
      candidates.every((item) => item.regular && !item.symlink),
      'bound official log is not a regular nonsymlink file',
    );
    const total = candidates.reduce((sum, item) => sum + item.size, 0);
    assert(
      total <= CAP - used - 1024 * 1024,
      'official logs exceed aggregate 64MiB evidence cap',
    );
    const evidence: unknown[] = [];
    for (const item of candidates) {
      assert(Date.now() < deadline, 'official log collection 10s deadline');
      const bound = instance
        ? [...lineage.values()].filter((value) =>
            new RegExp(`(?:^|[^0-9])${value.pid}(?:[^0-9]|$)`).test(item.name),
          )
        : [];
      if (instance)
        assert.equal(bound.length, 1, 'official log PID identity ambiguous');
      const source = path.join(officialDirectory, item.name);
      const beforeStat = await lstat(source);
      assert(
        beforeStat.isFile() &&
          !beforeStat.isSymbolicLink() &&
          beforeStat.size === item.size &&
          beforeStat.mtimeMs === item.mtimeMs,
        'official log changed before open',
      );
      const file = await open(
        source,
        constants.O_RDONLY | constants.O_NOFOLLOW,
      );
      try {
        const opened = await file.stat();
        assert(
          opened.isFile() &&
            opened.dev === beforeStat.dev &&
            opened.ino === beforeStat.ino &&
            opened.size === item.size &&
            opened.size <= CAP - used - 1024 * 1024,
          'official log changed or oversized before read',
        );
        const bytes = Buffer.alloc(opened.size);
        let offset = 0;
        while (offset < bytes.length) {
          assert(Date.now() < deadline, 'official log read 10s deadline');
          const read = await file.read(
            bytes,
            offset,
            bytes.length - offset,
            offset,
          );
          assert(read.bytesRead > 0, 'official log truncated during read');
          offset += read.bytesRead;
        }
        const final = await file.stat();
        assert(
          final.size === opened.size &&
            final.mtimeMs === opened.mtimeMs &&
            final.ctimeMs === opened.ctimeMs,
          'official log changed during read',
        );
        const target = `official-log-${evidence.length + 1}.txt`;
        await persist(target, bytes);
        const sha256 = createHash('sha256').update(bytes).digest('hex');
        assert.equal(
          createHash('sha256')
            .update(await readFile(path.join(out, target)))
            .digest('hex'),
          sha256,
        );
        evidence.push({
          name: item.name,
          target,
          size: bytes.length,
          sha256,
          driverPid,
          session,
          boundProcess: instance ? bound[0] : null,
          binding: instance
            ? 'owned-PID-and-new-inventory'
            : 'owned-PID-and-session-ID',
        });
      } finally {
        await file.close();
      }
    }
    await json('official-log-evidence.json', evidence);
    if (instance) await recheckLineage('after-copy', deadline, true);
  }
  function start(name: string, executable: string, argv: string[]) {
    const child = spawn(executable, argv, {
      cwd: root,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const record = {
      child,
      name,
      chunks: [] as Buffer[],
      stdoutChunks: [] as Buffer[],
    };
    children.push(record);
    child.once('error', (error) => {
      failure ??= error;
    });
    for (const stream of [child.stdout, child.stderr])
      stream?.on('data', (chunk: Buffer) => {
        try {
          if (used + heldStreams + chunk.length > CAP - 1024 * 1024)
            throw new Error('64MiB child evidence cap exceeded');
          reserve(chunk.length);
          record.chunks.push(Buffer.from(chunk));
          if (stream === child.stdout)
            record.stdoutChunks.push(Buffer.from(chunk));
        } catch (error) {
          failure ??= error;
          child.kill('SIGTERM');
        }
      });
    return child;
  }
  async function webdriver(
    method: string,
    endpoint: string,
    payload?: unknown,
    timeout = 15_000,
  ): Promise<unknown> {
    if (diagnosticActive) {
      if (Date.now() >= diagnosticDeadline)
        throw new Error('visibility diagnosis 120s deadline');
      timeout = Math.min(timeout, diagnosticDeadline - Date.now());
    }
    const index = String(++requestIndex).padStart(5, '0');
    const started = Date.now();
    await json(`webdriver-${index}-start.json`, {
      requestID: index,
      method,
      endpoint,
      payload,
      started,
      timeout,
    });
    let response: Response;
    try {
      response = await fetch(`${base}${endpoint}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: payload === undefined ? undefined : JSON.stringify(payload),
        signal: AbortSignal.timeout(timeout),
      });
    } catch (error) {
      await json(`webdriver-${index}-error.json`, {
        requestID: index,
        method,
        endpoint,
        elapsedMs: Date.now() - started,
        error: String(error),
        name: (error as Error).name,
      });
      if (
        instance &&
        method === 'POST' &&
        endpoint === '/session' &&
        (error as Error).name === 'TimeoutError'
      ) {
        sessionCreationTimeout = true;
        sessionOutcome = {
          status: 'timeout',
          error: String(error),
          requestID: index,
          elapsedMs: Date.now() - started,
        };
      }
      throw error;
    }
    const chunks: Buffer[] = [];
    const reader = response.body?.getReader();
    if (reader)
      for (;;) {
        const item = await reader.read();
        if (item.done) break;
        // Retain room for the accumulated stream copy and final failure metadata.
        // The raw response itself is persisted below before it is interpreted.
        if (
          used +
            heldStreams +
            3 *
              (chunks.reduce((total, chunk) => total + chunk.length, 0) +
                item.value.length) >
          CAP - 1024 * 1024
        ) {
          await reader.cancel();
          await persist(
            `webdriver-${index}-partial.txt`,
            Buffer.concat(chunks),
          );
          throw new Error(
            '64MiB WebDriver evidence cap exceeded; response incomplete',
          );
        }
        chunks.push(Buffer.from(item.value));
      }
    const raw = Buffer.concat(chunks);
    await persist(`webdriver-${index}.json`, raw);
    await json(`webdriver-${index}-request.json`, {
      method,
      endpoint,
      payload,
      status: response.status,
    });
    const decoded = JSON.parse(raw.toString('utf8')) as { value?: unknown };
    const error = decoded.value as
      | { error?: string; message?: string }
      | undefined;
    if (!response.ok || error?.error)
      throw new Error(
        `WebDriver ${response.status}: ${error?.error ?? ''} ${error?.message ?? raw.toString('utf8')}`,
      );
    return decoded.value;
  }
  const before = await identity();
  await json('identity-before.json', before);
  try {
    checkIdentity(before);
    if (official || instance) {
      officialBefore = await logInventory();
      await json('official-log-inventory-before.json', {
        directory: officialDirectory,
        items: officialBefore,
      });
    }
    const serverPort = await port();
    let driverPort = await port();
    while (driverPort === serverPort) driverPort = await port();
    const server = start('server', process.execPath, [
      path.join(root, 'scripts/serve.js'),
      '--host',
      '127.0.0.1',
      '--port',
      String(serverPort),
    ]);
    const driver = start('safaridriver', '/usr/bin/safaridriver', [
      ...(instance ? ['--diagnose'] : []),
      '--port',
      String(driverPort),
    ]);
    driverPid = driver.pid;
    if (instance)
      sampler = sampleLineage().catch((error) => {
        lineageFailure = error;
        failure ??= error;
      });
    base = `http://127.0.0.1:${driverPort}`;
    const pageBase = `http://127.0.0.1:${serverPort}`;
    const startup = Date.now() + 15_000;
    for (;;) {
      if (failure) throw failure;
      if (server.exitCode !== null || driver.exitCode !== null)
        throw new Error('owned server/driver exited during startup');
      try {
        const [http, status] = await Promise.all([
          fetch(`${pageBase}/web/index.html`, {
            signal: AbortSignal.timeout(1000),
          }),
          fetch(`${base}/status`, { signal: AbortSignal.timeout(1000) }),
        ]);
        if (http.ok && status.ok) break;
      } catch {
        /* bounded readiness polling, never a guest retry */
      }
      if (Date.now() >= startup)
        throw new Error('owned server/driver startup deadline');
      await delay(100);
    }
    const created = (await webdriver('POST', '/session', {
      capabilities: {
        alwaysMatch: {
          browserName: 'safari',
          ...(official ? { 'safari:diagnose': true } : {}),
        },
      },
    })) as {
      sessionId: string;
      capabilities: { browserName?: string; browserVersion?: string };
    };
    session = created.sessionId;
    if (instance) {
      samplerStopped = true;
      await sampler;
      if (failure) throw failure;
    }
    sessionOutcome = { status: 'established', sessionID: session };
    await json('session.json', created);
    assert(
      session && created.capabilities.browserName?.toLowerCase() === 'safari',
    );
    assert(
      created.capabilities.browserVersion,
      'actual Safari version missing',
    );
    await webdriver('POST', `/session/${session}/timeouts`, {
      implicit: 0,
      pageLoad: 30_000,
      script: 15_000,
    });
    const handle = await webdriver('GET', `/session/${session}/window`);
    await json('window-handle.json', { session, handle });
    assert.equal(
      typeof handle,
      'string',
      'dedicated Safari window handle missing',
    );
    assert(handle, 'dedicated Safari window handle empty');
    if (diagnostic) {
      type Rect = { x: number; y: number; width: number; height: number };
      type NativeWindow = {
        id: number;
        pid: number;
        owner: string;
        bounds: Rect;
        level: number;
        onscreen: boolean;
      };
      type NativeInfo = {
        permission: boolean;
        metadataAvailable: boolean;
        windows: NativeWindow[];
      };
      async function childOperation(
        name: string,
        executable: string,
        argv: string[],
      ) {
        if (Date.now() >= diagnosticDeadline)
          throw new Error('visibility diagnosis 120s deadline');
        const child = start(name, executable, argv);
        const deadline = Math.min(diagnosticDeadline, Date.now() + 30_000);
        while (
          child.exitCode === null &&
          child.signalCode === null &&
          !failure &&
          Date.now() < deadline
        )
          await delay(100);
        await json(`${name}-operation.json`, {
          executable,
          argv,
          pid: child.pid,
          exitCode: child.exitCode,
          signalCode: child.signalCode,
          error: failure ? String(failure) : null,
          timedOut: child.exitCode === null && child.signalCode === null,
        });
        if (failure) throw failure;
        assert.equal(child.signalCode, null, `${name} signalled`);
        assert.equal(child.exitCode, 0, `${name} failed or timed out`);
        return Buffer.concat(
          children.find((record) => record.child === child)!.stdoutChunks,
        ).toString('utf8');
      }
      await webdriver('POST', `/session/${session}/url`, {
        url: `${pageBase}/web/index.html?session=no-such-session`,
      });
      const stages: { name: string; rect: Rect }[] = [];
      async function capture(name: string) {
        const currentHandle = await webdriver(
          'GET',
          `/session/${session}/window`,
        );
        const rect = (await webdriver(
          'GET',
          `/session/${session}/window/rect`,
        )) as Rect;
        let dom: {
          result: Outcome | null;
          streams: { stdout: string; stderr: string } | null;
        };
        const loadDeadline = Math.min(diagnosticDeadline, Date.now() + 10_000);
        do {
          dom = (await webdriver(
            'POST',
            `/session/${session}/execute/sync`,
            {
              script:
                'return {visibility:document.visibilityState,hasFocus:document.hasFocus(),isolated:crossOriginIsolated,userAgent:navigator.userAgent,result:window.formicariumResult||null,streams:window.formicariumDiagnostics||null};',
              args: [],
            },
            Math.max(1, loadDeadline - Date.now()),
          )) as typeof dom;
          if (dom.result || Date.now() >= loadDeadline) break;
          await delay(100);
        } while (Date.now() < loadDeadline);
        await json(`${name}-observation.json`, {
          collectionOnly: true,
          acceptance: false,
          handle: currentHandle,
          rect,
          dom,
        });
        assert.equal(currentHandle, handle, 'dedicated window changed');
        assert.match(dom.result?.error ?? '', /unknown session/);
        assert.equal(dom.result?.exitCode, undefined);
        assert.deepEqual(dom.streams, { stdout: '', stderr: '' });
        const encoded = await webdriver(
          'GET',
          `/session/${session}/screenshot`,
        );
        assert.equal(typeof encoded, 'string');
        assert.match(encoded as string, /^[A-Za-z0-9+/]+={0,2}$/);
        const png = Buffer.from(encoded as string, 'base64');
        assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
        await persist(`${name}-webdriver.png`, png);
        stages.push({ name, rect });
      }
      await capture('before-selection');
      await webdriver('POST', `/session/${session}/window`, { handle });
      await webdriver('POST', `/session/${session}/window/maximize`, {});
      await capture('after-selection-maximize');
      await childOperation('diagnostic-activation', '/usr/bin/open', [
        '-a',
        'Safari',
      ]);
      await capture('after-activation');
      moduleCache = await mkdtemp(
        path.join(tmpdir(), 'formicarium-safari-swift-'),
      );
      const helper = path.join(
        root,
        'aidlc/spaces/default/intents/261006-npm-terrarium-release/construction/u1-runtime-package/code-generation/verification/safari-visibility-diagnostic-v1/window-info.swift',
      );
      const nativeRaw = await childOperation('window-info', '/usr/bin/swift', [
        '-module-cache-path',
        moduleCache,
        helper,
      ]);
      await persist('native-window-info.json', nativeRaw);
      const native = JSON.parse(nativeRaw) as NativeInfo;
      const rect = stages[2].rect;
      const rectKeys: (keyof Rect)[] = ['x', 'y', 'width', 'height'];
      for (const key of rectKeys)
        assert(Number.isFinite(rect[key]), 'invalid dedicated window rect');
      assert(rect.width > 0 && rect.height > 0, 'empty dedicated window rect');
      const matches = native.windows.filter(
        (window) =>
          window.owner === 'Safari' &&
          window.level === 0 &&
          window.onscreen === true &&
          rectKeys.every((key) => window.bounds[key] === rect[key]),
      );
      const skip =
        native.permission !== true
          ? 'existing screen capture permission unavailable'
          : native.metadataAvailable !== true
            ? 'window metadata unavailable'
            : matches.length !== 1
              ? `rect-matching Safari window count ${matches.length}; dedicated identity ambiguous or absent`
              : null;
      await json('native-capture-decision.json', {
        rect,
        matches,
        permission: native.permission,
        skip,
        collectionOnly: true,
        acceptance: false,
      });
      if (!skip) {
        const target = matches[0];
        assert(
          Number.isSafeInteger(target.id) &&
            target.id > 0 &&
            Number.isSafeInteger(target.pid) &&
            target.pid > 0,
        );
        const temporary = path.join(out, 'native-capture-temporary.png');
        await childOperation('native-capture', '/usr/sbin/screencapture', [
          '-x',
          '-t',
          'png',
          '-l',
          String(target.id),
          temporary,
        ]);
        try {
          const size = (await stat(temporary)).size;
          assert(
            size <= CAP - used - 1024 * 1024,
            'native screenshot exceeds evidence cap',
          );
          const png = await readFile(temporary);
          await rm(temporary);
          assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
          await persist('native-window.png', png);
        } finally {
          await rm(temporary, { force: true });
        }
      }
      if (Date.now() > diagnosticDeadline)
        throw new Error('visibility diagnosis 120s deadline');
      results.push({
        collectionOnly: true,
        acceptance: false,
        stages,
        nativeCaptureSkipped: skip,
      });
    } else {
      await webdriver('POST', `/session/${session}/window`, { handle });
      await webdriver('POST', `/session/${session}/window/maximize`, {});

      async function visiblePreflight(name: string) {
        const observations: unknown[] = [];
        let preflightError: unknown;
        let established = false;
        const started = Date.now();
        const deadline = started + 15_000;
        try {
          await webdriver(
            'POST',
            `/session/${session}/window`,
            { handle },
            Math.max(1, deadline - Date.now()),
          );
          await webdriver(
            'POST',
            `/session/${session}/url`,
            {
              url: `${pageBase}/web/index.html?session=no-such-session`,
            },
            Math.max(1, deadline - Date.now()),
          );
          // Normal application activation; no AppleEvents scripts or settings edits.
          const activation = start(`activation-${name}`, '/usr/bin/open', [
            '-a',
            'Safari',
          ]);
          const activationDeadline = deadline;
          while (
            activation.exitCode === null &&
            activation.signalCode === null &&
            !failure &&
            Date.now() < activationDeadline
          )
            await delay(100);
          await json(`${name}-activation.json`, {
            executable: '/usr/bin/open',
            args: ['-a', 'Safari'],
            pid: activation.pid,
            exitCode: activation.exitCode,
            signalCode: activation.signalCode,
            error: failure ? String(failure) : null,
            timedOut:
              activation.exitCode === null && activation.signalCode === null,
          });
          if (failure) throw failure;
          assert.equal(
            activation.signalCode,
            null,
            'Safari activation terminated by signal',
          );
          assert.equal(
            activation.exitCode,
            0,
            'Safari activation failed or timed out',
          );
          while (Date.now() < deadline) {
            if (failure) throw failure;
            const currentHandle = await webdriver(
              'GET',
              `/session/${session}/window`,
              undefined,
              Math.max(1, deadline - Date.now()),
            );
            assert.equal(
              currentHandle,
              handle,
              'dedicated Safari window changed',
            );
            const observed = (await webdriver(
              'POST',
              `/session/${session}/execute/sync`,
              {
                script:
                  'return {isolated:crossOriginIsolated,visibility:document.visibilityState,userAgent:navigator.userAgent,result:window.formicariumResult||null,streams:window.formicariumDiagnostics||null,pageStatus:document.getElementById("status")?.textContent||null};',
                args: [],
              },
              Math.max(1, deadline - Date.now()),
            )) as {
              isolated: boolean;
              visibility: string;
              result: Outcome | null;
              streams: { stdout: string; stderr: string } | null;
            };
            observations.push({
              elapsedMs: Date.now() - started,
              handle: currentHandle,
              snapshot: observed,
            });
            if (
              observed.isolated &&
              observed.visibility === 'visible' &&
              observed.result
            ) {
              assert.match(observed.result.error ?? '', /unknown session/);
              assert.equal(observed.result.exitCode, undefined);
              assert.deepEqual(
                observed.streams,
                { stdout: '', stderr: '' },
                'preflight must not start a guest',
              );
              established = Date.now() <= deadline;
              break;
            }
            await delay(Math.min(250, Math.max(1, deadline - Date.now())));
          }
          assert(
            established,
            'Safari visible/isolated preflight deadline exceeded',
          );
        } catch (error) {
          preflightError = error;
        }
        await json(`${name}-preflight.json`, {
          purpose: 'visibility preflight; no guest execution',
          handle,
          established,
          observations,
          elapsedMs: Date.now() - started,
          pollingLimitMs: 15_000,
          error: preflightError ? String(preflightError) : null,
        });
        if (preflightError) throw preflightError;
      }
      const cases = [
        {
          name: 'hello',
          query: 'guest=hello&arg=from-browser',
          limit: 600_000,
        },
        { name: 'exit3', query: 'guest=exit3', limit: 600_000 },
        { name: 'probe', query: 'guest=probe', limit: 600_000 },
        { name: 'aube-1645', query: 'session=aube-1645', limit: 840_000 },
        {
          name: 'pitchfork-basic',
          query: 'session=pitchfork-basic',
          limit: 600_000,
        },
      ];
      for (const item of cases) {
        await visiblePreflight(item.name);
        const started = Date.now();
        let stdout = '',
          stderr = '';
        let snapshot: Snapshot | undefined;
        let runError: unknown;
        try {
          await webdriver(
            'POST',
            `/session/${session}/url`,
            { url: `${pageBase}/web/index.html?${item.query}` },
            Math.min(30_000, item.limit),
          );
          while (Date.now() - started < item.limit) {
            if (failure) throw failure;
            const remaining = item.limit - (Date.now() - started);
            snapshot = (await webdriver(
              'POST',
              `/session/${session}/execute/sync`,
              {
                script:
                  'var d=window.formicariumDiagnostics||{stdout:"",stderr:""};return {stdout:d.stdout.slice(arguments[0]),stderr:d.stderr.slice(arguments[1]),result:window.formicariumResult||null,isolated:crossOriginIsolated,visibility:document.visibilityState,userAgent:navigator.userAgent,pageStatus:document.getElementById("status")?.textContent||null,outputExit:document.getElementById("output")?.getAttribute("data-exit-code")||null};',
                args: [stdout.length, stderr.length],
              },
              Math.min(15_000, remaining),
            )) as Snapshot;
            stdout += snapshot.stdout;
            stderr += snapshot.stderr;
            heldStreams =
              Buffer.byteLength(stdout) +
              Buffer.byteLength(stderr) +
              Buffer.byteLength(JSON.stringify(snapshot));
            if (!snapshot.isolated || snapshot.visibility !== 'visible')
              throw new Error(
                'Safari page must remain visible and crossOriginIsolated',
              );
            if (snapshot.result) break;
            await delay(
              Math.min(250, Math.max(1, item.limit - (Date.now() - started))),
            );
          }
          if (!snapshot?.result)
            throw new Error(`${item.name} deadline exceeded`);
        } catch (error) {
          runError = error;
        }
        const record = {
          name: item.name,
          elapsedMs: Date.now() - started,
          limitMs: item.limit,
          snapshot,
          error: runError ? String(runError) : null,
          trace: false,
          workerCount: 1,
          retries: 0,
        };
        await persist(`${item.name}-stdout.txt`, stdout);
        await persist(`${item.name}-stderr.txt`, stderr);
        await json(`${item.name}-result.json`, record);
        heldStreams = 0;
        results.push({
          name: item.name,
          elapsedMs: record.elapsedMs,
          limitMs: item.limit,
          completed: Boolean(snapshot?.result),
          error: record.error,
          evidence: `${item.name}-result.json`,
        });
        if (runError) throw runError;
        const result = snapshot?.result;
        assert(result);
        assert.equal(result.error, undefined);
        assert(
          record.elapsedMs <= item.limit,
          `${item.name} exceeded its acceptance deadline`,
        );
        assert.equal(result.exitCode, item.name === 'exit3' ? 3 : 0);
        assert.equal(snapshot?.outputExit, String(result.exitCode));
        if (item.name === 'hello') assert.match(stdout, /arg: from-browser/);
        if (item.name === 'exit3')
          assert.match(stderr, /exiting with status 3/);
        if (item.name === 'probe') {
          const checks = [
            'tokio-timer',
            'unix-stream-pair',
            'rayon',
            'mutex-condvar',
            'fs-basic',
            'fs-hardlink',
            'fs-symlink',
            'fs-flock',
          ];
          assert.deepEqual(
            stdout.match(/^PASS .+$/gm),
            checks.map((name) => `PASS ${name}`),
          );
          assert(!stdout.includes('FAIL '));
        }
        if (item.name === 'aube-1645' || item.name === 'pitchfork-basic') {
          const definition = lookupSession(item.name);
          const commands = parseSessionScript(
            await readFile(path.join(root, definition.script), 'utf8'),
            { tool: definition.guest },
          );
          assert.deepEqual(
            result.steps?.map((step) => step.command),
            commands.map((command) => command.command),
          );
          assert.equal(result.steps?.length, item.name === 'aube-1645' ? 4 : 8);
          assert(result.steps?.every((step) => step.exitCode === 0));
          assert.equal(
            normalizeTranscript(result.transcript ?? ''),
            normalizeTranscript(
              await readFile(path.join(root, definition.baseline), 'utf8'),
            ),
          );
          if (item.name === 'aube-1645')
            assert(
              (result.transcript ?? '').includes(
                '├── filedep 1.0.0\n└── linked 2.0.0\n',
              ),
            );
          else {
            const outputs = transcriptOutputs(
              result.transcript ?? '',
              commands,
            );
            const cat = outputOf(outputs, 'cat pitchfork.toml');
            assert.equal(cat.exitCode, 0);
            assert(daemonSection(cat.stdout, 'api'));
            assert.equal(daemonSection(cat.stdout, 'worker'), null);
            assert.match(
              daemonSection(cat.stdout, 'db') ?? '',
              /^run\s*=\s*"postgres -D data"$/m,
            );
            assert.equal(
              outputOf(
                outputs,
                'pitchfork settings get general.interval',
              ).stdout.trim(),
              '5s',
            );
          }
        }
      }
    }
  } catch (error) {
    if (!sessionCreationTimeout) {
      sessionOutcome ??= { status: 'failed', error: String(error) };
      failure ??= error;
    }
  } finally {
    samplerStopped = true;
    await sampler;
    if (instance) {
      try {
        await recheckLineage('before-cleanup', diagnosticDeadline, false);
        lineageFrozen = !lineageFailure;
      } catch (error) {
        failure ??= error;
        await json('process-lineage-failure.json', {
          error: String(error),
          identities: [...lineage.values()],
        });
      }
    }
    diagnosticActive = false;
    const cleanupEnd = Date.now() + 60_000;
    if (session)
      try {
        await webdriver('DELETE', `/session/${session}`, undefined, 10_000);
      } catch (error) {
        failure ??= error;
      }
    for (const { child } of children)
      if (
        child.pid !== undefined &&
        child.exitCode === null &&
        child.signalCode === null
      )
        child.kill('SIGTERM');
    for (const { child } of children) {
      // Failed spawn has no process to terminate; its recorded error still fails.
      if (child.pid === undefined) continue;
      while (
        child.exitCode === null &&
        child.signalCode === null &&
        Date.now() < cleanupEnd - 5000
      )
        await delay(100);
      if (child.exitCode === null && child.signalCode === null)
        child.kill('SIGKILL');
      while (
        child.exitCode === null &&
        child.signalCode === null &&
        Date.now() < cleanupEnd
      )
        await delay(100);
      if (child.exitCode === null && child.signalCode === null)
        failure ??= new Error('owned child cleanup deadline exceeded');
    }
    for (const child of children)
      await persist(`${child.name}.log`, Buffer.concat(child.chunks), true);
    if (official || instance) {
      try {
        await collectOfficialLogs();
      } catch (error) {
        failure ??= error;
        await json('official-log-failure.json', {
          error: String(error),
          driverPid,
          session,
          unrelatedContentsRead: false,
        });
      }
    }
    if (moduleCache) await rm(moduleCache, { recursive: true, force: true });
    const after = await identity();
    await json('identity-after.json', after);
    try {
      checkIdentity(after);
      assert.deepEqual(after, before, 'core/guest/baseline identity changed');
    } catch (error) {
      failure ??= error;
    }
    await json('results.json', {
      status: !session
        ? 'session-not-established'
        : failure
          ? 'failed'
          : 'passed',
      collectionOnly: diagnostic,
      sessionEstablished: Boolean(session),
      sessionOutcome,
      collectionStatus: failure ? 'failed' : 'passed',
      acceptance: !diagnostic && !failure && results.length === 5,
      results,
      failure: failure ? String(failure) : null,
      safariRemoteAutomationChanged: false,
      remoteAutomationHelp: !session
        ? 'Safari session creation/startup was not verified. Review the saved driver response and Apple Safari remote automation settings manually; this runner does not enable them.'
        : null,
    });
  }
  if (failure) throw failure;
  console.log(
    diagnostic
      ? `Safari visibility evidence collected; acceptance=false; ${out}`
      : `Safari: five sequential cases passed; evidence ${out}`,
  );
}

main().catch((error) => {
  console.error(String(error));
  process.exitCode = 1;
});
