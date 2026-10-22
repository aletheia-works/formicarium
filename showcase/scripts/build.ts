import { execFileSync, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { access, chmod, copyFile, mkdir, readFile, rm } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join } from 'node:path';
import type { GuestBuildInfo } from '@aletheia-works/formicarium';
import {
  type AcquiredTool,
  builderInventory,
  fetchBounded,
  loadAcquired,
  PROVENANCE_NOTE,
  storeAcquired,
  TARGET,
  type ValidateGuest,
  validateWithPublicApi,
} from './acquire.ts';
import { gunzipBounded, readTar, singleRoot, writeTree } from './archive.ts';
import { builderHash, buildKey, sha256 } from './build-key.ts';
import type { SourceBuildAcquire, ToolConfig, UiBuild } from './config.ts';
import { fail, runCli, ShowcaseError } from './errors.ts';
import {
  createGitHubApi,
  type FetchLike,
  type GitHubApi,
  repositorySlug,
} from './github.ts';
import {
  BUILD_KILL_GRACE_MS,
  SOURCE_ARCHIVE_LIMITS,
  SOURCE_BUILD_DEADLINE_MS,
  TRANSFER_POLICY,
} from './limits.ts';
import {
  readJson,
  SHOWCASE_ROOT,
  type WorkLayout,
  workLayout,
  writeJson,
} from './paths.ts';
import {
  loadResolutions,
  loadVerifiedTools,
  resolutionFor,
  resolveTagCommit,
  type ToolResolution,
} from './resolve.ts';

export interface ToolchainSelection {
  rustChannel: string;
  rustDeclaredBy: string | null;
  nodeVersion: string | null;
  nodeDeclaredBy: string | null;
}
export interface BuildPlan {
  tool: string;
  version: string;
  tag: string;
  repository: string;
  commit: string;
  sourceDir: string;
  binary: string;
  package: string | null;
  ui: UiBuild | null;
  toolchain: ToolchainSelection;
  cargo: string;
  rustc: string;
  rustcVersion: string;
  nodeBin: string | null;
  nodeVersion: string | null;
  runner: { tool: string; elfPath: string; elfSha256: string } | null;
  dependencies: GuestBuildInfo['dependencies'];
  builderHash: string;
  buildKey: string;
}
export type Exec = (file: string, args: readonly string[]) => string;

const optional = async (path: string) => {
  try {
    return await readFile(path, 'utf8');
  } catch {
    return null;
  }
};
const exactVersion = (value: string | null | undefined) => {
  const match = /^v?(\d+\.\d+\.\d+)$/.exec((value ?? '').trim());
  return match ? match[1]! : null;
};

/**
 * Upstream declarations win; without one the latest stable is used. Rust:
 * rust-toolchain.toml / rust-toolchain, else `stable`. Node (UI build only):
 * an exact version in .node-version, mise.toml or .tool-versions, else the
 * running Node, which is the latest stable this repository develops with.
 */
export async function selectToolchain(
  sourceDir: string,
  ui: UiBuild | null,
): Promise<ToolchainSelection> {
  let rustChannel = 'stable';
  let rustDeclaredBy: string | null = null;
  const toml = await optional(join(sourceDir, 'rust-toolchain.toml'));
  const plain = await optional(join(sourceDir, 'rust-toolchain'));
  const tomlChannel = toml && /^\s*channel\s*=\s*"([^"]+)"/m.exec(toml)?.[1];
  if (tomlChannel) {
    rustChannel = tomlChannel;
    rustDeclaredBy = 'rust-toolchain.toml';
  } else if (plain?.trim()) {
    rustChannel =
      /^\s*channel\s*=\s*"([^"]+)"/m.exec(plain)?.[1] ??
      plain.trim().split(/\s+/)[0]!;
    rustDeclaredBy = 'rust-toolchain';
  }
  if (!/^[A-Za-z0-9._-]{1,64}$/.test(rustChannel))
    fail('toolchain-unavailable', 'declared Rust channel has an invalid shape');
  if (!ui)
    return {
      rustChannel,
      rustDeclaredBy,
      nodeVersion: null,
      nodeDeclaredBy: null,
    };
  const candidates: [string, (raw: string) => string | null][] = [
    [join(ui.directory, '.node-version'), (raw) => exactVersion(raw)],
    ['.node-version', (raw) => exactVersion(raw)],
    [
      'mise.toml',
      (raw) => exactVersion(/^\s*node\s*=\s*"([^"]+)"/m.exec(raw)?.[1]),
    ],
    [
      '.tool-versions',
      (raw) => exactVersion(/^\s*nodejs\s+(\S+)/m.exec(raw)?.[1]),
    ],
  ];
  for (const [path, parse] of candidates) {
    const raw = await optional(join(sourceDir, path));
    const version = raw === null ? null : parse(raw);
    if (version)
      return {
        rustChannel,
        rustDeclaredBy,
        nodeVersion: version,
        nodeDeclaredBy: path,
      };
  }
  return {
    rustChannel,
    rustDeclaredBy,
    nodeVersion: null,
    nodeDeclaredBy: null,
  };
}

/** The source build starts only from a commit the declared tag still names. */
export async function verifyTagCommit(
  api: GitHubApi,
  resolution: ToolResolution,
): Promise<void> {
  const commit = await resolveTagCommit(
    api,
    repositorySlug(resolution.repository),
    resolution.tag,
  );
  if (commit !== resolution.commit)
    fail('commit-unreachable', `${resolution.tag} no longer names the commit`);
}

/** codeload tar.gz at the fixed commit; its global header must name it. */
export async function fetchSource(
  resolution: ToolResolution,
  destination: string,
  fetchImpl?: FetchLike,
): Promise<void> {
  const slug = repositorySlug(resolution.repository);
  const fetched = await fetchBounded(
    `https://codeload.github.com/${slug}/tar.gz/${resolution.commit}`,
    { maxBytes: SOURCE_ARCHIVE_LIMITS.maxDownloadBytes, fetchImpl },
  );
  const tar = await gunzipBounded(
    fetched.bytes,
    SOURCE_ARCHIVE_LIMITS.maxExpandedBytes,
  );
  const { entries, globalComment } = readTar(tar, {
    ...SOURCE_ARCHIVE_LIMITS,
    allowGlobalHeader: true,
  });
  if (globalComment !== resolution.commit)
    fail('commit-unreachable', 'source archive does not name the commit');
  await writeTree(entries, destination, singleRoot(entries));
}

/** Toolchain installers keep PATH but never see tokens or secrets. */
export function withoutSecrets(source: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return Object.fromEntries(
    Object.entries(source).filter(
      ([key]) => !/TOKEN|SECRET|PASSWORD|CREDENTIAL/i.test(key),
    ),
  );
}

const defaultExec: Exec = (file, args) =>
  execFileSync(file, args, {
    encoding: 'utf8',
    env: { ...withoutSecrets(process.env), MISE_AUTO_INSTALL: '0' },
    maxBuffer: TRANSFER_POLICY.maxMetadataBytes,
    stdio: ['ignore', 'pipe', 'inherit'],
  }).trim();

/** Installs the selected Rust toolchain and returns absolute cargo/rustc. */
export function installRust(
  channel: string,
  exec: Exec = defaultExec,
  rustup = process.env.SHOWCASE_RUSTUP ?? join(homedir(), '.cargo/bin/rustup'),
): { cargo: string; rustc: string; rustcVersion: string } {
  try {
    exec(rustup, [
      'toolchain',
      'install',
      channel,
      '--profile',
      'minimal',
      '--target',
      TARGET,
      '--no-self-update',
    ]);
    const cargo = exec(rustup, ['which', '--toolchain', channel, 'cargo']);
    const rustc = exec(rustup, ['which', '--toolchain', channel, 'rustc']);
    if (!isAbsolute(cargo) || !isAbsolute(rustc))
      fail('toolchain-unavailable', 'rustup did not report absolute paths');
    return { cargo, rustc, rustcVersion: exec(rustc, ['-vV']) };
  } catch (error) {
    if (error instanceof ShowcaseError) throw error;
    return fail('toolchain-unavailable', `Rust ${channel} unavailable`, error);
  }
}

/** Exact upstream Node through mise install/where (absolute), else this Node. */
export function selectNode(
  version: string | null,
  exec: Exec = defaultExec,
): { nodeBin: string; nodeVersion: string } {
  if (version === null || version === process.versions.node)
    return {
      nodeBin: dirname(process.execPath),
      nodeVersion: process.versions.node,
    };
  try {
    exec('mise', ['install', `node@${version}`]);
    const home = exec('mise', ['where', `node@${version}`]);
    if (!isAbsolute(home))
      fail('toolchain-unavailable', 'mise where not absolute');
    return { nodeBin: join(home, 'bin'), nodeVersion: version };
  } catch (error) {
    if (error instanceof ShowcaseError) throw error;
    return fail('toolchain-unavailable', `Node ${version} unavailable`, error);
  }
}

/** Allow-listed environment: tokens and CI secrets never reach upstream code. */
export function buildEnvironment(
  extra: Readonly<Record<string, string>>,
  source: NodeJS.ProcessEnv = process.env,
): Record<string, string> {
  const env: Record<string, string> = {
    PATH: '/usr/local/bin:/usr/bin:/bin',
    MISE_AUTO_INSTALL: '0',
    AUBE_NO_UPDATE_CHECK: '1',
    CARGO_TERM_COLOR: 'never',
  };
  for (const key of ['HOME', 'LANG', 'TMPDIR', 'RUSTUP_HOME', 'CARGO_HOME'])
    if (source[key]) env[key] = source[key]!;
  for (const [key, value] of Object.entries(extra)) env[key] = value;
  for (const key of Object.keys(env))
    if (/TOKEN|SECRET|PASSWORD|CREDENTIAL/i.test(key))
      fail('config-invalid', `build environment refuses ${key}`);
  return env;
}

export interface GroupRun {
  command: string;
  args: readonly string[];
  cwd: string;
  env: Record<string, string>;
  deadlineMs: number;
  signal?: AbortSignal;
  graceMs?: number;
}

const groupAlive = (pid: number) => {
  try {
    process.kill(-pid, 0);
    return true;
  } catch {
    return false;
  }
};
async function endGroup(pid: number, graceMs: number): Promise<void> {
  const signal = (name: NodeJS.Signals) => {
    try {
      process.kill(-pid, name);
    } catch {
      // ESRCH: the group already ended.
    }
  };
  signal('SIGTERM');
  const started = Date.now();
  while (groupAlive(pid) && Date.now() - started < graceMs)
    await new Promise((done) => setTimeout(done, 50));
  signal('SIGKILL');
  while (groupAlive(pid)) await new Promise((done) => setTimeout(done, 50));
}

/**
 * Runs one command as the leader of a new process group. On deadline or abort
 * the whole group is terminated and the call returns only after the group is
 * gone. Leftover group members of a successful run are terminated too.
 */
export async function runInGroup(run: GroupRun): Promise<void> {
  if (run.signal?.aborted) fail('build-failed', 'build was cancelled');
  const child = spawn(run.command, [...run.args], {
    cwd: run.cwd,
    env: run.env,
    detached: true,
    stdio: ['ignore', 'inherit', 'inherit'],
  });
  const pid = child.pid;
  if (pid === undefined) fail('build-failed', `${run.command} did not start`);
  const state: { reason: 'deadline' | 'cancel' | null } = { reason: null };
  const exited = new Promise<number | null>((done) => {
    child.once('exit', (code) => done(code));
    child.once('error', () => done(null));
  });
  const stop = (why: 'deadline' | 'cancel') => {
    state.reason ??= why;
  };
  const timer = setTimeout(() => stop('deadline'), run.deadlineMs);
  const abort = () => stop('cancel');
  run.signal?.addEventListener('abort', abort, { once: true });
  try {
    while (true) {
      const result = await Promise.race([
        exited.then((code) => ({ code })),
        new Promise<null>((done) => setTimeout(() => done(null), 50)),
      ]);
      if (state.reason) {
        await endGroup(pid, run.graceMs ?? BUILD_KILL_GRACE_MS);
        if (state.reason === 'deadline')
          fail('build-timeout', `${run.command} exceeded ${run.deadlineMs} ms`);
        fail('build-failed', `${run.command} was cancelled`);
      }
      if (result) {
        await endGroup(pid, 0);
        if (result.code !== 0)
          fail('build-failed', `${run.command} exited with ${result.code}`);
        return;
      }
    }
  } finally {
    clearTimeout(timer);
    run.signal?.removeEventListener('abort', abort);
  }
}

/** Staging is removed after the work (and every process of it) has ended. */
export async function withStaging<T>(
  layout: WorkLayout,
  tool: string,
  work: (directory: string) => Promise<T>,
): Promise<T> {
  const directory = join(layout.staging, `${tool}-${randomUUID()}`);
  await mkdir(directory, { recursive: true });
  try {
    return await work(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

export interface PrepareOptions {
  config: ToolConfig;
  resolution: ToolResolution;
  layout: WorkLayout;
  api: GitHubApi;
  acquired: readonly AcquiredTool[];
  fetchImpl?: FetchLike;
  exec?: Exec;
}

/** Everything the buildKey needs is fixed before reuse lookup or compile. */
export async function prepareBuild(
  options: PrepareOptions,
): Promise<BuildPlan> {
  const { config, resolution, layout } = options;
  if (config.acquire.kind !== 'source-build')
    fail(
      'config-invalid',
      `${config.tool} is not configured for a source build`,
    );
  const acquire = config.acquire as SourceBuildAcquire;
  await verifyTagCommit(options.api, resolution);
  const sourceDir = join(layout.sources, `${config.tool}-${resolution.commit}`);
  await fetchSource(resolution, sourceDir, options.fetchImpl);
  const lock = await optional(join(sourceDir, 'Cargo.lock'));
  if (lock === null) fail('build-failed', `${config.tool} has no Cargo.lock`);
  const toolchain = await selectToolchain(sourceDir, acquire.ui ?? null);
  const rust = installRust(toolchain.rustChannel, options.exec);
  const node = acquire.ui
    ? selectNode(toolchain.nodeVersion, options.exec)
    : null;
  const dependencies: GuestBuildInfo['dependencies'][number][] = [
    {
      tool: 'cargo-lock',
      repository: resolution.repository,
      commit: resolution.commit,
      digest: sha256(lock),
    },
  ];
  let runner: BuildPlan['runner'] = null;
  if (acquire.ui) {
    const record = options.acquired.find(
      (item) => item.tool === acquire.ui?.runner,
    );
    if (!record)
      fail('config-invalid', `${acquire.ui.runner} was not acquired`);
    dependencies.push({
      tool: record.tool,
      repository: record.buildInfo.source.repository,
      commit: record.buildInfo.source.commit,
      digest: record.elfSha256,
    });
    runner = {
      tool: record.tool,
      elfPath: join(
        layout.acquired,
        record.tool,
        record.format === 'elf' ? record.downloadFile : 'guest',
      ),
      elfSha256: record.elfSha256,
    };
  }
  const hash = builderHash(await builderInventory(), {
    rustChannel: toolchain.rustChannel,
    rustc: rust.rustcVersion,
    node: node?.nodeVersion ?? null,
  });
  const plan: BuildPlan = {
    tool: config.tool,
    version: resolution.version,
    tag: resolution.tag,
    repository: resolution.repository,
    commit: resolution.commit,
    sourceDir,
    binary: acquire.binary,
    package: acquire.package ?? null,
    ui: acquire.ui ?? null,
    toolchain,
    cargo: rust.cargo,
    rustc: rust.rustc,
    rustcVersion: rust.rustcVersion,
    nodeBin: node?.nodeBin ?? null,
    nodeVersion: node?.nodeVersion ?? null,
    runner,
    dependencies,
    builderHash: hash,
    buildKey: '',
  };
  // buildKey excludes elfSha256, so a placeholder digest gives the same key.
  plan.buildKey = sourceBuildInfo(plan, '0'.repeat(64)).buildKey;
  await writeJson(join(layout.plans, `${config.tool}.json`), plan);
  return plan;
}

/** Guest metadata of a source build; extra fields record the toolchain. */
export function sourceBuildInfo(
  plan: BuildPlan,
  elfSha256: string,
): GuestBuildInfo {
  const info: GuestBuildInfo = {
    schemaVersion: 1,
    tool: plan.tool,
    versionOrName: plan.version,
    source: { repository: plan.repository, commit: plan.commit },
    target: TARGET,
    rustc: plan.rustcVersion,
    sourcePatches: [],
    dependencies: plan.dependencies,
    builderHash: plan.builderHash,
    buildKey: '',
    elfSha256,
    provenance: {
      kind: 'source-build',
      releaseTag: plan.tag,
      rustChannel: plan.toolchain.rustChannel,
      rustDeclaredBy: plan.toolchain.rustDeclaredBy,
      node: plan.nodeVersion,
      nodeDeclaredBy: plan.toolchain.nodeDeclaredBy,
      note: PROVENANCE_NOTE,
    },
  };
  info.buildKey = buildKey(info);
  return info;
}

export interface CompileOptions {
  layout: WorkLayout;
  validate: ValidateGuest;
  deadlineMs?: number;
  signal?: AbortSignal;
}

/** Compiles one plan without any token, then validates through the public API. */
export async function compilePlan(
  plan: BuildPlan,
  options: CompileOptions,
): Promise<AcquiredTool> {
  const started = performance.now();
  const deadline = options.deadlineMs ?? SOURCE_BUILD_DEADLINE_MS;
  const remaining = () => Math.max(1, deadline - (performance.now() - started));
  return withStaging(options.layout, plan.tool, async (staging) => {
    const bin = join(staging, 'bin');
    const out = join(staging, 'out');
    await mkdir(bin, { recursive: true });
    await mkdir(out, { recursive: true });
    const path = [
      bin,
      dirname(plan.cargo),
      ...(plan.nodeBin ? [plan.nodeBin] : []),
    ];
    if (plan.runner) {
      const runner = join(bin, plan.runner.tool);
      await copyFile(plan.runner.elfPath, runner);
      await chmod(runner, 0o755);
      if (sha256(await readFile(runner)) !== plan.runner.elfSha256)
        fail('checksum-mismatch', 'UI runner differs from the verified copy');
    }
    const env = buildEnvironment({
      PATH: [...path, '/usr/local/bin', '/usr/bin', '/bin'].join(':'),
      RUSTC: plan.rustc,
      CARGO_TARGET_DIR: join(staging, 'target'),
      CARGO_TARGET_X86_64_UNKNOWN_LINUX_MUSL_LINKER: 'musl-gcc',
      CC_x86_64_unknown_linux_musl: 'musl-gcc',
    });
    if (plan.ui && plan.runner) {
      const cwd = join(plan.sourceDir, plan.ui.directory);
      const runner = join(bin, plan.runner.tool);
      for (const args of [plan.ui.install, plan.ui.build])
        await runInGroup({
          command: runner,
          args,
          cwd,
          env,
          deadlineMs: remaining(),
          signal: options.signal,
        });
      await access(join(cwd, plan.ui.output)).catch((error) =>
        fail('build-failed', `UI output ${plan.ui?.output} missing`, error),
      );
    }
    await runInGroup({
      command: '/bin/bash',
      args: [
        join(SHOWCASE_ROOT, 'builders', 'cargo.sh'),
        plan.cargo,
        out,
        plan.binary,
        plan.package ?? '',
      ],
      cwd: plan.sourceDir,
      env,
      deadlineMs: remaining(),
      signal: options.signal,
    });
    const elf = new Uint8Array(await readFile(join(out, plan.binary)));
    if (elf.length > TRANSFER_POLICY.maxElfBytes)
      fail('size-limit', `${plan.tool} ELF exceeds the ELF limit`);
    const info = sourceBuildInfo(plan, sha256(elf));
    if (info.buildKey !== plan.buildKey)
      fail('build-failed', 'buildKey changed while compiling');
    const buildInfoSha256 = validateWithPublicApi(options.validate, elf, info);
    const record = sourceRecord(plan, elf, info, buildInfoSha256, null);
    record.timing.fetchMs = Math.round(performance.now() - started);
    await storeAcquired(options.layout, record, elf, elf);
    return record;
  });
}

export function sourceRecord(
  plan: BuildPlan,
  elf: Uint8Array,
  info: GuestBuildInfo,
  buildInfoSha256: string,
  reusedFromRun: AcquiredTool['provenance']['reusedFromRun'],
): AcquiredTool {
  return {
    tool: plan.tool,
    version: plan.version,
    format: 'elf',
    downloadFile: plan.binary,
    downloadSha256: info.elfSha256,
    downloadBytes: elf.length,
    elfSha256: info.elfSha256,
    elfBytes: elf.length,
    buildInfo: info,
    buildInfoSha256,
    provenance: {
      kind: 'source-build',
      assetUrl: null,
      finalUrl: null,
      downloadSha256: info.elfSha256,
      attestation: null,
      note: PROVENANCE_NOTE,
      reusedFromRun,
    },
    timing: { fetchMs: 0 },
  };
}

export async function loadPlans(
  layout: WorkLayout,
  tools: readonly ToolConfig[],
) {
  const plans: BuildPlan[] = [];
  for (const config of tools)
    if (config.acquire.kind === 'source-build')
      plans.push(
        (await readJson(
          join(layout.plans, `${config.tool}.json`),
        )) as BuildPlan,
      );
  return plans;
}

async function main(verb: string | undefined) {
  const layout = workLayout();
  const tools = await loadVerifiedTools();
  if (verb === 'prepare') {
    const resolutions = await loadResolutions(layout);
    const api = createGitHubApi({ token: process.env.GITHUB_TOKEN });
    const acquired = await loadAcquired(layout);
    for (const config of tools.tools)
      if (config.acquire.kind === 'source-build')
        console.log(
          `${config.tool} buildKey ${(await prepareBuild({ config, resolution: resolutionFor(resolutions, config.tool), layout, api, acquired })).buildKey}`,
        );
    return;
  }
  if (verb !== 'compile')
    fail('config-invalid', 'usage: build.ts prepare|compile');
  if (process.env.GITHUB_TOKEN)
    fail('config-invalid', 'compile must run without GITHUB_TOKEN');
  const { validateGuest } = await import('@aletheia-works/formicarium');
  const controller = new AbortController();
  for (const name of ['SIGTERM', 'SIGINT'] as const)
    process.once(name, () => controller.abort());
  const acquired = new Set(
    (await loadAcquired(layout)).map((item) => item.tool),
  );
  for (const plan of await loadPlans(layout, tools.tools)) {
    if (acquired.has(plan.tool)) {
      console.log(`${plan.tool} reused; no compile`);
      continue;
    }
    const record = await compilePlan(plan, {
      layout,
      validate: validateGuest,
      signal: controller.signal,
    });
    console.log(`${record.tool} ${record.version} ${record.elfSha256}`);
  }
}

if (import.meta.main)
  await runCli(`source build ${process.argv[2] ?? ''}`.trim(), () =>
    main(process.argv[2]),
  );
