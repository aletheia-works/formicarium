import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { digest } from '../ci/quality-evidence.ts';
import {
  BoundaryError,
  BYTE_LIMIT,
  decodeJson,
  limitBytes,
} from './archive.ts';
import { adaptMaintenanceEvidence } from './evidence.ts';
import type { GitHubApi } from './github.ts';
import {
  canonicalPath,
  type DependencyRequest,
  type FormatRequest,
  snapshot,
  type TrustedPolicy,
} from './input.ts';
import { type Decision, evaluateMaintenance } from './policy.ts';
import { type Acquisition, contentAt } from './receipt.ts';

export interface SourceFile {
  path: string;
  status: string;
  mode: string;
  originalBytes: Uint8Array;
}
export interface Command {
  executable: string;
  args: string[];
  cwd: string;
  env: Record<string, string>;
  stdin?: Uint8Array;
}
export type CommandExecutor = (command: Command) => Promise<Uint8Array>;
export const executeCommand: CommandExecutor = async (command) =>
  new Promise((resolve, reject) => {
    const child = spawn(command.executable, command.args, {
      cwd: command.cwd,
      env: command.env,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: false,
    });
    const chunks: Buffer[] = [];
    let size = 0,
      stderrSize = 0;
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new BoundaryError('REPRODUCTION_TIMEOUT'));
    }, 1800000);
    child.stdout.on('data', (raw: Buffer) => {
      size += raw.length;
      if (size > BYTE_LIMIT) {
        child.kill('SIGKILL');
        reject(new BoundaryError('BYTE_LIMIT'));
      } else chunks.push(raw);
    });
    child.stderr.on('data', (raw: Buffer) => {
      stderrSize += raw.length;
      if (stderrSize > BYTE_LIMIT) {
        child.kill('SIGKILL');
        reject(new BoundaryError('BYTE_LIMIT'));
      }
    });
    child.on('error', () => {
      clearTimeout(timer);
      reject(new BoundaryError('REPRODUCTION_FAILED'));
    });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      if (code !== 0 || signal)
        reject(new BoundaryError('REPRODUCTION_FAILED'));
      else resolve(new Uint8Array(Buffer.concat(chunks, size)));
    });
    child.stdin.on('error', () => {});
    child.stdin.end(command.stdin);
  });
function rejectUnless(value: unknown, code: string): asserts value {
  if (!value) throw new BoundaryError(code);
}
const utf8 = (bytes: Uint8Array) => {
  limitBytes(bytes);
  try {
    const value = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    rejectUnless(!value.includes('\0'), 'BINARY_FILE');
    return value;
  } catch (error) {
    if (error instanceof BoundaryError) throw error;
    throw new BoundaryError('BINARY_FILE');
  }
};
function isolatedEnvironment(workspace: string): Record<string, string> {
  return {
    PATH: process.env.PATH ?? '',
    HOME: workspace,
    TMPDIR: workspace,
    CI: 'true',
    BUN_INSTALL_CACHE_DIR: join(workspace, 'cache'),
  };
}
function command(
  executable: string,
  args: string[],
  cwd: string,
  stdin?: Uint8Array,
): Command {
  rejectUnless(executable.startsWith('/'), 'UNTRUSTED_EXECUTABLE');
  return {
    executable,
    args,
    cwd,
    env: isolatedEnvironment(cwd),
    ...(stdin ? { stdin } : {}),
  };
}
export async function fetchSourceFiles(
  api: GitHubApi,
  acquired: Acquisition,
): Promise<SourceFile[]> {
  const treeResult = (await api.json(
    `/repos/${acquired.repository}/git/trees/${acquired.headSha}?recursive=1`,
  )) as { truncated?: unknown; tree?: unknown };
  rejectUnless(
    treeResult.truncated === false &&
      Array.isArray(treeResult.tree) &&
      treeResult.tree.length <= 10000,
    'UNKNOWN_CLASSIFICATION',
  );
  const tree = treeResult.tree as {
    path: string;
    type: string;
    mode: string;
    sha: string;
  }[];
  let size = 0;
  const result: SourceFile[] = [];
  for (const changed of acquired.files) {
    canonicalPath(changed.path);
    const matches = tree.filter((file) => file.path === changed.path);
    rejectUnless(
      matches.length === 1 &&
        matches[0]?.type === 'blob' &&
        ['100644', '100755'].includes(matches[0]?.mode ?? '') &&
        matches[0]?.sha === changed.sha &&
        changed.status === 'modified',
      'UNKNOWN_CLASSIFICATION',
    );
    const originalBytes = await contentAt(
      api,
      acquired.repository,
      changed.path,
      acquired.headSha,
    );
    size += originalBytes.length;
    rejectUnless(size <= BYTE_LIMIT && result.length < 500, 'BYTE_LIMIT');
    const blobSha = createHash('sha1')
      .update(`blob ${originalBytes.length}\0`)
      .update(originalBytes)
      .digest('hex');
    rejectUnless(blobSha === changed.sha, 'SOURCE_BYTES_MISMATCH');
    result.push({
      path: changed.path,
      status: changed.status,
      mode: matches[0]?.mode ?? '',
      originalBytes,
    });
  }
  return result;
}
export interface FormatReproduction {
  request: FormatRequest;
  changes: {
    path: string;
    originalDigest: string;
    replacementBytes: Uint8Array;
  }[];
  decision: Decision;
}
export async function reproduceFormat(
  acquisition: Acquisition,
  files: readonly SourceFile[],
  policy: TrustedPolicy,
  trustedConfig: Uint8Array,
  biomeExecutable: string,
  execute: CommandExecutor = executeCommand,
): Promise<FormatReproduction> {
  rejectUnless(
    digest(limitBytes(trustedConfig)) === policy.formatterConfigDigest,
    'FORMATTER_MISMATCH',
  );
  rejectUnless(
    files.length <= 500 &&
      new Set(files.map((file) => file.path)).size === files.length,
    'FILE_LIMIT',
  );
  let size = 0;
  for (const file of files) {
    canonicalPath(file.path);
    rejectUnless(
      file.status === 'modified' &&
        ['100644', '100755'].includes(file.mode) &&
        (file.path === 'index.ts' ||
          ['runtime/', 'scripts/', 'tests/'].some((prefix) =>
            file.path.startsWith(prefix),
          )) &&
        file.path.endsWith('.ts') &&
        !file.path.startsWith('scripts/release/') &&
        !file.path.startsWith('scripts/maintenance/'),
      'UNKNOWN_CLASSIFICATION',
    );
    size += limitBytes(file.originalBytes).length;
    utf8(file.originalBytes);
  }
  rejectUnless(size <= BYTE_LIMIT, 'BYTE_LIMIT');
  const workspace = await mkdtemp(join(tmpdir(), 'formicarium-format-'));
  try {
    await writeFile(join(workspace, 'biome.json'), trustedConfig);
    const version = utf8(
      await execute(command(biomeExecutable, ['--version'], workspace)),
    );
    rejectUnless(
      /^(?:Version:\s*)?2\.5\.15\s*$/.test(version),
      'FORMATTER_MISMATCH',
    );
    const changes: FormatReproduction['changes'] = [];
    for (const file of files) {
      const replacementBytes = limitBytes(
        await execute(
          command(
            biomeExecutable,
            [
              'format',
              '--config-path',
              workspace,
              '--stdin-file-path',
              file.path,
            ],
            workspace,
            file.originalBytes,
          ),
        ),
      );
      utf8(replacementBytes);
      if (
        !Buffer.from(replacementBytes).equals(Buffer.from(file.originalBytes))
      )
        changes.push({
          path: file.path,
          originalDigest: digest(file.originalBytes),
          replacementBytes,
        });
    }
    changes.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
    rejectUnless(
      changes.reduce(
        (total, item) => total + item.replacementBytes.length,
        0,
      ) <= BYTE_LIMIT,
      'BYTE_LIMIT',
    );
    const diffDigest = changes.length
      ? digest(
          JSON.stringify(
            changes.map((item) => ({
              path: item.path,
              originalDigest: item.originalDigest,
              replacement: Buffer.from(item.replacementBytes).toString(
                'base64',
              ),
            })),
          ),
        )
      : digest('');
    const request: FormatRequest = {
      schemaVersion: 1,
      operation: 'format-push',
      context: {
        repository: acquisition.repository,
        prNumber: acquisition.prNumber,
        headSha: acquisition.headSha,
        currentHeadSha: acquisition.headSha,
        sameRepository: true,
        prOpen: true,
        trustedWorkflow: false,
        evidence: acquisition.evidence,
      },
      changedPaths: changes.map((item) => item.path),
      proposedDiffDigest: diffDigest,
      reproducedDiffDigest: diffDigest,
      trustedFormatterRevision: policy.formatterRevision,
      trustedConfigDigest: policy.formatterConfigDigest,
      reproducible: true,
      formattingOnly: true,
      emptyDiff: changes.length === 0,
    };
    const adapted = adaptMaintenanceEvidence(
      request,
      policy,
      acquisition.observation,
    );
    rejectUnless(adapted.ok, 'INVALID_EVIDENCE');
    const decision = evaluateMaintenance(
      adapted.value.request,
      adapted.value.policy,
    );
    return {
      request: {
        ...request,
        context: { ...request.context, trustedWorkflow: true },
      },
      changes,
      decision,
    };
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
}
function object(value: unknown): Record<string, unknown> {
  rejectUnless(
    value !== null && typeof value === 'object' && !Array.isArray(value),
    'INVALID_MANIFEST',
  );
  return value as Record<string, unknown>;
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object')
    return `{${Object.keys(value)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`,
      )
      .join(',')}}`;
  return JSON.stringify(value) ?? 'null';
}
function stableVersion(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/.test(value) &&
    value.split('.').map(Number).every(Number.isSafeInteger)
  );
}
export interface DependencyReproduction {
  request: DependencyRequest;
  decision: Decision;
}
export async function reproduceDependency(
  acquisition: Acquisition,
  policy: TrustedPolicy,
  trustedManifest: Uint8Array,
  trustedLock: Uint8Array,
  candidateManifest: Uint8Array,
  candidateLock: Uint8Array,
  bunExecutable: string,
  execute: CommandExecutor = executeCommand,
  trustedRegistry?: string,
): Promise<DependencyReproduction> {
  const base = object(snapshot(decodeJson(trustedManifest))),
    candidate = object(snapshot(decodeJson(candidateManifest)));
  const before = object(base.devDependencies),
    after = object(candidate.devDependencies);
  rejectUnless(
    canonical(Object.keys(before).sort()) ===
      canonical(Object.keys(after).sort()),
    'DIRECT_UPDATE_COUNT',
  );
  const changed = Object.keys(before).filter(
    (name) => before[name] !== after[name],
  );
  rejectUnless(
    changed.length === 1 &&
      acquisition.files.length === 2 &&
      acquisition.files.every(
        (file) =>
          ['package.json', 'bun.lock'].includes(file.path) &&
          file.status === 'modified',
      ),
    'DIRECT_UPDATE_COUNT',
  );
  const name = changed[0];
  rejectUnless(
    name && policy.allowedDevDependencies.includes(name),
    'DEPENDENCY_NOT_ALLOWED',
  );
  const from = before[name],
    to = after[name];
  rejectUnless(
    stableVersion(from) && stableVersion(to),
    'UNSAFE_DEPENDENCY_VERSION',
  );
  const oldParts = from.split('.').map(Number),
    newParts = to.split('.').map(Number);
  const kind = newParts[1] !== oldParts[1] ? 'minor' : 'patch';
  rejectUnless(
    oldParts[0] === newParts[0] &&
      ((newParts[1] ?? 0) > (oldParts[1] ?? 0) ||
        (newParts[1] === oldParts[1] &&
          (newParts[2] ?? 0) > (oldParts[2] ?? 0))),
    'UNSAFE_DEPENDENCY_VERSION',
  );
  const expected = { ...base, devDependencies: { ...before, [name]: to } };
  rejectUnless(
    canonical(expected) === canonical(candidate),
    'MIXED_OR_PROTECTED_CHANGES',
  );
  // Preserve every original byte except the sole existing dependency version.
  const baseText = utf8(trustedManifest);
  const pattern = new RegExp(
    `("${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"\\s*:\\s*)"${from.replaceAll('.', '\\.')}"`,
    'g',
  );
  const matches = [...baseText.matchAll(pattern)];
  rejectUnless(matches.length === 1, 'MIXED_OR_PROTECTED_CHANGES');
  const expectedBytes = new TextEncoder().encode(
    baseText.replace(pattern, `$1"${to}"`),
  );
  rejectUnless(
    Buffer.from(expectedBytes).equals(Buffer.from(candidateManifest)),
    'MIXED_OR_PROTECTED_CHANGES',
  );
  const workspace = await mkdtemp(join(tmpdir(), 'formicarium-dependency-'));
  try {
    const version = utf8(
      await execute(command(bunExecutable, ['--version'], workspace)),
    );
    rejectUnless(version.trim() === '1.4.2', 'TOOLCHAIN_MISMATCH');
    await writeFile(join(workspace, 'package.json'), expectedBytes);
    await writeFile(join(workspace, 'bun.lock'), limitBytes(trustedLock));
    if (trustedRegistry) {
      const registry = new URL(trustedRegistry);
      rejectUnless(
        ['https:', 'http:'].includes(registry.protocol) &&
          !registry.username &&
          !registry.password &&
          !/[\r\n]/.test(trustedRegistry),
        'UNTRUSTED_REGISTRY',
      );
      await writeFile(join(workspace, '.npmrc'), `registry=${registry.href}\n`);
    }
    await execute(
      command(
        bunExecutable,
        ['install', '--lockfile-only', '--ignore-scripts'],
        workspace,
      ),
    );
    const reproduced = limitBytes(await readFile(join(workspace, 'bun.lock')));
    rejectUnless(
      Buffer.from(reproduced).equals(Buffer.from(limitBytes(candidateLock))),
      'LOCK_MISMATCH',
    );
    await execute(
      command(
        bunExecutable,
        ['install', '--frozen-lockfile', '--ignore-scripts'],
        workspace,
      ),
    );
    rejectUnless(
      Buffer.from(await readFile(join(workspace, 'bun.lock'))).equals(
        Buffer.from(reproduced),
      ),
      'LOCK_MISMATCH',
    );
    const parseLock = async (bytes: Uint8Array) =>
      object(
        decodeJson(
          await execute(
            command(
              bunExecutable,
              [
                '-e',
                'process.stdout.write(JSON.stringify(Bun.JSONC.parse(await new Response(Bun.stdin.stream()).text())))',
              ],
              workspace,
              bytes,
            ),
          ),
        ),
      );
    const oldLock = await parseLock(trustedLock),
      newLock = await parseLock(reproduced);
    const resolved = (lock: Record<string, unknown>) => {
      const entry = object(lock.packages)[name];
      rejectUnless(
        Array.isArray(entry) && typeof entry[0] === 'string',
        'UNSAFE_DEPENDENCY_VERSION',
      );
      return entry[0].slice(name.length + 1);
    };
    rejectUnless(
      resolved(oldLock) === from && resolved(newLock) === to,
      'UNSAFE_DEPENDENCY_VERSION',
    );
    rejectUnless(
      acquisition.receiptLockDigest === digest(reproduced),
      'TOOLCHAIN_MISMATCH',
    );
    const request: DependencyRequest = {
      schemaVersion: 1,
      operation: 'dependency-merge',
      context: {
        repository: acquisition.repository,
        prNumber: acquisition.prNumber,
        headSha: acquisition.headSha,
        currentHeadSha: acquisition.headSha,
        sameRepository: true,
        prOpen: true,
        trustedWorkflow: false,
        evidence: acquisition.evidence,
      },
      authenticatedUpdateBot: acquisition.authenticatedUpdateBot,
      directUpdates: [{ name, from, to, kind }],
      devDependenciesOnly: true,
      mixedOrProtectedChanges: false,
      expectedLockDigest: digest(candidateLock),
      reproducedLockDigest: digest(reproduced),
      protectedMain: acquisition.protectedMain === true,
      mergeable: acquisition.mergeable === true,
    };
    const adapted = adaptMaintenanceEvidence(
      request,
      policy,
      acquisition.observation,
    );
    rejectUnless(adapted.ok, 'INVALID_EVIDENCE');
    return {
      request: {
        ...request,
        context: { ...request.context, trustedWorkflow: true },
      },
      decision: evaluateMaintenance(
        adapted.value.request,
        adapted.value.policy,
      ),
    };
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
}
