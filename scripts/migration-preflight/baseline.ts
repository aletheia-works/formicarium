import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import {
  copyFile,
  mkdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseUniqueJSON } from './unique-json.js';

/** C11 metadata cap; cached build-info gets the same bound as fresh input. */
const BUILD_INFO_LIMIT = 1024 * 1024;

export const BASELINE_COMMIT = '2405c7620169bd0719166af09a8d89cc76fb37fb';
export const BASELINE_REPOSITORY = 'https://github.com/biomejs/biome';
export const MAKE_PACKAGE = Object.freeze({
  url: 'https://dl-cdn.alpinelinux.org/alpine/v3.24/main/x86_64/make-4.4.1-r4.apk',
  bytes: 116285,
  digest: 'a916626a876f64c6b6fb32a6bf0fa93351d09fae0aa7684135642390da647e60',
  repository: 'https://gitlab.alpinelinux.org/alpine/aports',
  commit: '9368161bd37f74fb11747ba79197f8480aaca7dc',
  versionLine: 'GNU Make 4.4.1',
});
/** Fixed public APK, no redirect or credentials; signed APK is checked again by apk. */
export async function fetchMakePackage(
  signal: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<Uint8Array> {
  const response = await fetcher(MAKE_PACKAGE.url, {
    signal: AbortSignal.any([signal, AbortSignal.timeout(120_000)]),
    redirect: 'error',
    credentials: 'omit',
    cache: 'no-store',
  });
  if (!response.ok || !response.body) {
    await response.body?.cancel();
    throw Error('make APK HTTP/body failure');
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      signal.throwIfAborted();
      const next = await reader.read();
      if (next.done) break;
      size += next.value.length;
      if (size > MAKE_PACKAGE.bytes) throw Error('make APK size exceeded');
      chunks.push(next.value);
    }
    if (size !== MAKE_PACKAGE.bytes) throw Error('make APK size mismatch');
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    if (hash(bytes) !== MAKE_PACKAGE.digest)
      throw Error('make APK digest mismatch');
    return bytes;
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
}
export interface BaselineInputs {
  schemaVersion: 1;
  tool: 'biome';
  versionOrName: string;
  repository: string;
  commit: string;
  target: 'x86_64-unknown-linux-musl';
  builderHash: string;
  builderInventory: Readonly<Record<string, string>>;
  image: string;
  rustc: string;
  cargo: string;
  cargoLockSha256: string;
  dependencies: readonly {
    tool: string;
    repository: string;
    commit: string;
    digest: string;
  }[];
  sourcePatches: readonly { name: string; sha256: string }[];
  cargoArgs: readonly string[];
  environment: Readonly<Record<string, string>>;
  sourceFileDigests: Readonly<Record<string, string>>;
}
export const BASELINE_DEADLINE_MS = 14_400_000;
function hash(bytes: Uint8Array | string): string {
  return createHash('sha256').update(bytes).digest('hex');
}
function requiredDigest(value: unknown): void {
  if (typeof value !== 'string' || !/^[0-9a-f]{64}$/.test(value))
    throw Error('SHA256 required');
}
function canonical(value: unknown): string {
  if (value === null || typeof value === 'boolean')
    return JSON.stringify(value);
  if (typeof value === 'string') {
    if (
      /[\uD800-\uDFFF]/u.test(
        value.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, ''),
      )
    )
      throw Error('lone surrogate');
    return JSON.stringify(value);
  }
  if (typeof value === 'number' && Number.isSafeInteger(value))
    return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (
    value &&
    typeof value === 'object' &&
    Object.getPrototypeOf(value) === Object.prototype
  )
    return `{${Object.keys(value)
      .sort()
      .map(
        (key) =>
          `${canonical(key)}:${canonical((value as Record<string, unknown>)[key])}`,
      )
      .join(',')}}`;
  throw Error('canonical safe JSON required');
}
export function baselineBuilderHash(
  inputs: Omit<BaselineInputs, 'builderHash'>,
): string {
  return hash(
    canonical({
      files: inputs.builderInventory,
      image: inputs.image,
      rustc: inputs.rustc,
      cargo: inputs.cargo,
      cargoLockSha256: inputs.cargoLockSha256,
      cargoArgs: inputs.cargoArgs,
      environment: inputs.environment,
      sourceFileDigests: inputs.sourceFileDigests,
      versionOrName: inputs.versionOrName,
      nodeVersion: process.version,
    }),
  );
}
export function baselineKey(inputs: BaselineInputs): string {
  if (
    inputs.schemaVersion !== 1 ||
    inputs.tool !== 'biome' ||
    inputs.repository !== BASELINE_REPOSITORY ||
    inputs.commit !== BASELINE_COMMIT ||
    inputs.target !== 'x86_64-unknown-linux-musl'
  )
    throw Error('fixed baseline source/target required');
  requiredDigest(inputs.builderHash);
  requiredDigest(inputs.cargoLockSha256);
  if (
    !/^[^\s@]+@sha256:[0-9a-f]{64}$/.test(inputs.image) ||
    !inputs.rustc ||
    !inputs.cargo ||
    !inputs.versionOrName
  )
    throw Error('immutable image and actual toolchain identities required');
  if (
    !Object.keys(inputs.builderInventory).length ||
    baselineBuilderHash(inputs) !== inputs.builderHash
  )
    throw Error('builder inventory/full input digest mismatch');
  for (const digest of Object.values(inputs.builderInventory))
    requiredDigest(digest);
  for (const file of [
    'Cargo.lock',
    'Cargo.toml',
    'rust-toolchain.toml',
    '.cargo/config.toml',
  ])
    requiredDigest(inputs.sourceFileDigests[file]);
  if (inputs.sourceFileDigests['Cargo.lock'] !== inputs.cargoLockSha256)
    throw Error('Cargo.lock input mismatch');
  if (inputs.sourcePatches.length !== 0)
    throw Error('baseline source patches forbidden');
  const dependencies = [...inputs.dependencies].sort((a, b) => {
    const first = `${a.tool}/${a.repository}/${a.commit}`;
    const second = `${b.tool}/${b.repository}/${b.commit}`;
    return first < second ? -1 : first > second ? 1 : 0;
  });
  const identities = new Set<string>();
  for (const dependency of dependencies) {
    requiredDigest(dependency.digest);
    if (
      !dependency.tool ||
      !/^[0-9a-f]{40}$/.test(dependency.commit) ||
      !/^https:\/\//.test(dependency.repository)
    )
      throw Error('dependency identity incomplete');
    const identity = `${dependency.tool}/${dependency.repository}/${dependency.commit}`;
    if (identities.has(identity)) throw Error('duplicate dependency identity');
    identities.add(identity);
  }
  if (
    inputs.cargoArgs.join(' ') !==
    'build --locked --release --target x86_64-unknown-linux-musl --package biome_cli'
  )
    throw Error('fixed cargo invocation required');
  for (const [key, value] of Object.entries(inputs.environment))
    if (
      !/^[A-Z][A-Z0-9_]*$/.test(key) ||
      typeof value !== 'string' ||
      /TOKEN|PASSWORD|SECRET|CREDENTIAL/.test(key)
    )
      throw Error('public fixed build environment required');
  return hash(
    canonical({
      tool: inputs.tool,
      repository: inputs.repository,
      commit: inputs.commit,
      builderHash: inputs.builderHash,
      target: inputs.target,
      rustc: inputs.rustc,
      sourcePatches: inputs.sourcePatches,
      dependencies,
    }),
  );
}
export function validateBaselineElf(bytes: Uint8Array): void {
  if (
    bytes.length < 120 ||
    bytes.length > 128 * 1024 * 1024 ||
    ![127, 69, 76, 70, 2, 1, 1].every((value, index) => bytes[index] === value)
  )
    throw Error('static x86-64 ELF64 required');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (
    ![2, 3].includes(view.getUint16(16, true)) ||
    view.getUint16(18, true) !== 62 ||
    view.getUint32(20, true) !== 1 ||
    view.getUint16(52, true) !== 64
  )
    throw Error('ELF architecture/header invalid');
  const offset = view.getBigUint64(32, true);
  const count = view.getUint16(56, true);
  if (
    !count ||
    count > 256 ||
    view.getUint16(54, true) !== 56 ||
    offset < 64n ||
    offset + BigInt(count * 56) > BigInt(bytes.length)
  )
    throw Error('ELF program headers invalid');
  let load = false;
  for (let index = 0; index < count; index++) {
    const start = Number(offset) + index * 56;
    const type = view.getUint32(start, true);
    load ||= type === 1;
    if (type === 3) throw Error('dynamic ELF refused');
    const size = view.getBigUint64(start + 32, true);
    if (
      view.getBigUint64(start + 8, true) + size > BigInt(bytes.length) ||
      (type === 1 && size > view.getBigUint64(start + 40, true))
    )
      throw Error('ELF segment invalid');
  }
  if (!load) throw Error('loadable segment missing');
}
interface BuildInfo {
  schemaVersion: 1;
  tool: 'biome';
  versionOrName: string;
  source: { repository: string; commit: string };
  target: BaselineInputs['target'];
  rustc: string;
  sourcePatches: BaselineInputs['sourcePatches'];
  dependencies: BaselineInputs['dependencies'];
  builderHash: string;
  buildKey: string;
  elfSha256: string;
  inputs: BaselineInputs;
  versionExitCode: number;
}
export interface BaselineReceipt {
  buildKey: string;
  elfSha256: string;
  buildInfoSha256: string;
  compileSkipped: boolean;
  versionExitCode: number;
}
export async function readAccepted(
  directory: string,
  inputs: BaselineInputs,
): Promise<BaselineReceipt> {
  const elf = new Uint8Array(await readFile(resolve(directory, 'biome')));
  validateBaselineElf(elf);
  const infoPath = resolve(directory, 'build-info.json');
  // Refuse from the size first so an oversized cache file is never read whole.
  if ((await stat(infoPath)).size > BUILD_INFO_LIMIT)
    throw Error('accepted baseline metadata exceeds 1 MiB');
  const raw = await readFile(infoPath);
  if (raw.byteLength > BUILD_INFO_LIMIT)
    throw Error('accepted baseline metadata exceeds 1 MiB');
  const info = parseUniqueJSON(raw.toString('utf8')) as BuildInfo;
  const key = baselineKey(inputs);
  if (
    info.schemaVersion !== 1 ||
    info.tool !== inputs.tool ||
    info.versionOrName !== inputs.versionOrName ||
    info.source.repository !== inputs.repository ||
    info.source.commit !== inputs.commit ||
    info.target !== inputs.target ||
    info.rustc !== inputs.rustc ||
    info.builderHash !== inputs.builderHash ||
    info.buildKey !== key ||
    info.elfSha256 !== hash(elf) ||
    info.versionExitCode !== 0 ||
    canonical(info.inputs) !== canonical(inputs) ||
    canonical(info.sourcePatches) !== canonical(inputs.sourcePatches) ||
    canonical(info.dependencies) !== canonical(inputs.dependencies)
  )
    throw Error('accepted baseline identity/digest mismatch');
  return {
    buildKey: key,
    elfSha256: hash(elf),
    buildInfoSha256: hash(raw),
    compileSkipped: true,
    versionExitCode: 0,
  };
}
export interface CommandResult {
  code: number;
  stdout: string;
}
export type Executor = (
  command: string,
  args: readonly string[],
  options: { cwd: string; signal: AbortSignal },
) => Promise<CommandResult>;
export const executeProcessGroup: Executor = (command, args, options) =>
  new Promise((resolve, reject) => {
    if (process.platform === 'win32') {
      reject(Error('baseline requires Linux process groups'));
      return;
    }
    if (options.signal.aborted) {
      reject(Error('baseline cancelled'));
      return;
    }
    const child = spawn(command, [...args], {
      cwd: options.cwd,
      detached: true,
      stdio: ['ignore', 'pipe', 'inherit'],
      env: process.env,
    });
    let stdout = '';
    let killTimer: ReturnType<typeof setTimeout> | undefined;
    const kill = (signal: NodeJS.Signals) => {
      if (child.pid) {
        try {
          process.kill(-child.pid, signal);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ESRCH') reject(error);
        }
      }
    };
    const abort = () => {
      kill('SIGTERM');
      killTimer = setTimeout(() => kill('SIGKILL'), 1000);
    };
    options.signal.addEventListener('abort', abort, { once: true });
    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
      if (stdout.length > 1024 * 1024) {
        kill('SIGKILL');
        reject(Error('command output limit'));
      }
    });
    child.on('error', reject);
    child.on('close', (code, signal) => {
      clearTimeout(killTimer);
      options.signal.removeEventListener('abort', abort);
      if (options.signal.aborted || signal)
        reject(Error('baseline command cancelled'));
      else resolve({ code: code ?? 1, stdout });
    });
  });
export async function runBaseline(options: {
  inputs: BaselineInputs;
  cache: string;
  signal?: AbortSignal;
  timeoutMs?: number;
  execute?: Executor;
  source?: string;
  build?: (
    staging: string,
    signal: AbortSignal,
  ) => Promise<{ elf: string; versionExitCode: number }>;
  checkVersion?: (elf: string, signal: AbortSignal) => Promise<number>;
}): Promise<BaselineReceipt> {
  const inputs = structuredClone(options.inputs);
  const key = baselineKey(inputs);
  const cache = resolve(options.cache);
  const timeout = options.timeoutMs ?? BASELINE_DEADLINE_MS;
  if (
    !Number.isFinite(timeout) ||
    timeout < 1 ||
    timeout > BASELINE_DEADLINE_MS
  )
    throw Error('baseline deadline cannot exceed four hours');
  await mkdir(cache, { recursive: true });
  const lock = resolve(cache, `${key}.lock`);
  const staging = resolve(cache, `${key}.${randomUUID()}.staging`);
  const accepted = resolve(cache, key);
  const controller = new AbortController();
  const abort = () => controller.abort();
  options.signal?.addEventListener('abort', abort, { once: true });
  if (options.signal?.aborted) controller.abort();
  const timer = setTimeout(abort, timeout);
  let ownsLock = false;
  try {
    controller.signal.throwIfAborted();
    await writeFile(lock, 'single-writer', { flag: 'wx' });
    ownsLock = true;
    // Corrupt or partial accepted data is a hard failure; never silently recompile it.
    let exists = false;
    try {
      await stat(accepted);
      exists = true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    if (exists) {
      const receipt = await readAccepted(accepted, inputs);
      const code = await (
        options.checkVersion ??
        (async (elf, signal) =>
          (
            await (options.execute ?? executeProcessGroup)(elf, ['--version'], {
              cwd: accepted,
              signal,
            })
          ).code)
      )(resolve(accepted, 'biome'), controller.signal);
      if (code !== 0) throw Error('reused baseline --version failed');
      controller.signal.throwIfAborted();
      return { ...receipt, versionExitCode: code };
    }
    await mkdir(staging);
    const result = await (
      options.build ??
      ((directory, signal) =>
        buildInContainer(
          directory,
          signal,
          inputs,
          options.execute ?? executeProcessGroup,
          options.source,
        ))
    )(staging, controller.signal);
    controller.signal.throwIfAborted();
    if (result.versionExitCode !== 0) throw Error('baseline --version failed');
    const elf = new Uint8Array(await readFile(result.elf));
    validateBaselineElf(elf);
    const info: BuildInfo = {
      schemaVersion: 1,
      tool: inputs.tool,
      versionOrName: inputs.versionOrName,
      source: { repository: inputs.repository, commit: inputs.commit },
      target: inputs.target,
      rustc: inputs.rustc,
      sourcePatches: inputs.sourcePatches,
      dependencies: inputs.dependencies,
      builderHash: inputs.builderHash,
      buildKey: key,
      elfSha256: hash(elf),
      inputs,
      versionExitCode: result.versionExitCode,
    };
    await copyFile(result.elf, resolve(staging, 'biome'));
    await writeFile(resolve(staging, 'build-info.json'), canonical(info), {
      flag: 'wx',
    });
    await readAccepted(staging, inputs);
    controller.signal.throwIfAborted();
    await rename(staging, accepted);
    const receipt = await readAccepted(accepted, inputs);
    return { ...receipt, compileSkipped: false };
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', abort);
    await rm(staging, { recursive: true, force: true });
    if (ownsLock) await rm(lock, { force: true });
  }
}
async function buildInContainer(
  staging: string,
  signal: AbortSignal,
  inputs: BaselineInputs,
  execute: Executor,
  sourceDirectory?: string,
): Promise<{ elf: string; versionExitCode: number }> {
  if (!sourceDirectory)
    throw Error('fixed source-directory from checkout Action required');
  const source = resolve(sourceDirectory);
  const container = `migration-preflight-${randomUUID()}`;
  const command = async (
    executable: string,
    args: readonly string[],
    expected?: string,
  ) => {
    const result = await execute(executable, args, { cwd: staging, signal });
    if (
      result.code !== 0 ||
      (expected !== undefined && result.stdout.trim() !== expected)
    )
      throw Error('fixed baseline command/identity failed');
    return result.stdout.trim();
  };
  // These Git commands only inspect the checkout produced by the pinned Action.
  // No clone, checkout, commit, or other local VCS mutation is performed here.
  await command('git', ['-C', source, 'rev-parse', 'HEAD'], inputs.commit);
  await command(
    'git',
    ['-C', source, 'status', '--porcelain', '--untracked-files=all'],
    '',
  );
  for (const [file, digest] of Object.entries(inputs.sourceFileDigests)) {
    if (
      ![
        'Cargo.lock',
        'Cargo.toml',
        'rust-toolchain.toml',
        '.cargo/config.toml',
      ].includes(file) ||
      hash(await readFile(resolve(source, file))) !== digest
    )
      throw Error('fixed source input digest mismatch');
  }
  await command('docker', ['pull', inputs.image]);
  const makeDependencies = inputs.dependencies.filter(
    (item) => item.tool === 'make',
  );
  if (
    makeDependencies.length !== 1 ||
    makeDependencies[0]!.repository !== MAKE_PACKAGE.repository ||
    makeDependencies[0]!.commit !== MAKE_PACKAGE.commit ||
    makeDependencies[0]!.digest !== MAKE_PACKAGE.digest
  )
    throw Error('fixed make APK dependency required');
  const apk = resolve(staging, 'make.apk');
  await writeFile(apk, await fetchMakePackage(signal), { flag: 'wx' });
  const docker = [
    'run',
    '--rm',
    '--name',
    container,
    '--mount',
    `type=bind,src=${source},dst=/work`,
    '--mount',
    `type=bind,src=${apk},dst=/dependency/make.apk,readonly`,
    '--workdir',
    '/work',
    ...Object.entries(inputs.environment).flatMap(([key, value]) => [
      '--env',
      `${key}=${value}`,
    ]),
    inputs.image,
  ];
  try {
    await command('docker', [
      ...docker,
      'sh',
      '-ec',
      'test "$(rustc --version)" = "$1"; test "$(cargo --version)" = "$2"; apk --no-network add /dependency/make.apk; make_output=$(make --version); test "${make_output%%\n*}" = "$3"; shift 3; exec cargo "$@"',
      'preflight-build',
      inputs.rustc,
      inputs.cargo,
      MAKE_PACKAGE.versionLine,
      ...inputs.cargoArgs,
    ]);
  } finally {
    // Killing a Docker client process group does not stop its daemon-owned
    // container. Always remove only this job's unique container as well.
    await execute('docker', ['rm', '--force', container], {
      cwd: staging,
      signal: AbortSignal.timeout(10_000),
    });
  }
  const elf = resolve(source, 'target', inputs.target, 'release/biome');
  validateBaselineElf(new Uint8Array(await readFile(elf)));
  const version = await execute(elf, ['--version'], { cwd: staging, signal });
  return { elf, versionExitCode: version.code };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const cliAbort = new AbortController();
  process.once('SIGTERM', () => cliAbort.abort());
  process.once('SIGINT', () => cliAbort.abort());
  if (process.argv[2] === '--prepare-inputs') {
    const [template, output, ...extra] = process.argv.slice(3);
    if (!template || !output || extra.length)
      throw Error(
        'usage: --prepare-inputs <input-template> <new-actual-inputs>',
      );
    const inputs = JSON.parse(
      await readFile(template, 'utf8'),
    ) as BaselineInputs;
    if (!/^[^\s@]+@sha256:[0-9a-f]{64}$/.test(inputs.image))
      throw Error('immutable builder image required');
    const directory = resolve('.');
    const pull = await executeProcessGroup('docker', ['pull', inputs.image], {
      cwd: directory,
      signal: cliAbort.signal,
    });
    if (pull.code !== 0) throw Error('pinned image preparation failed');
    const rust = await executeProcessGroup(
      'docker',
      [
        'run',
        '--rm',
        '--env',
        'RUSTUP_TOOLCHAIN=1.98.1',
        inputs.image,
        'rustc',
        '--version',
      ],
      { cwd: directory, signal: cliAbort.signal },
    );
    const cargo = await executeProcessGroup(
      'docker',
      [
        'run',
        '--rm',
        '--env',
        'RUSTUP_TOOLCHAIN=1.98.1',
        inputs.image,
        'cargo',
        '--version',
      ],
      { cwd: directory, signal: cliAbort.signal },
    );
    if (
      rust.code !== 0 ||
      cargo.code !== 0 ||
      !rust.stdout.trim().startsWith('rustc 1.98.1 ') ||
      !cargo.stdout.trim().startsWith('cargo 1.98.1 ')
    )
      throw Error('actual pinned toolchain version mismatch');
    inputs.rustc = rust.stdout.trim();
    inputs.cargo = cargo.stdout.trim();
    inputs.builderHash = baselineBuilderHash(inputs);
    baselineKey(inputs);
    await writeFile(output, canonical(inputs), { flag: 'wx' });
  } else {
    const [inputFile, cache, source, receiptFile, ...extra] =
      process.argv.slice(2);
    if (!inputFile || !cache || !source || extra.length)
      throw Error(
        'usage: baseline.ts <verified-inputs.json> <cache-directory> <action-checkout-source>',
      );
    const inputs = JSON.parse(
      await readFile(inputFile, 'utf8'),
    ) as BaselineInputs;
    const receipt = await runBaseline({
      inputs,
      cache,
      source,
      signal: cliAbort.signal,
    });
    if (receiptFile)
      await writeFile(
        receiptFile,
        JSON.stringify(
          {
            ...receipt,
            schemaVersion: 1,
            recordedAt: new Date().toISOString(),
            source: { repository: inputs.repository, commit: inputs.commit },
            sourceCommit: process.env.GITHUB_SHA ?? null,
            ciRunUrl:
              process.env.GITHUB_RUN_ID && process.env.GITHUB_REPOSITORY
                ? `${process.env.GITHUB_SERVER_URL ?? 'https://github.com'}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
                : null,
          },
          null,
          2,
        ) + '\n',
        { flag: 'wx' },
      );
    console.log(JSON.stringify(receipt));
  }
}
