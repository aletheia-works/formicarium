import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import { requireCondition } from './evidence.js';
import { sha256 } from './inventory.js';
import type { CandidateIdentity, CheckEvidence } from './types.js';
export interface CommandInput {
  checkId: string;
  executable: string;
  args: string[];
  cwd: string;
  timeoutMs: number;
  environment: string;
  candidate: CandidateIdentity;
  out: string;
  signal?: AbortSignal;
}
/** Main-only command observer. Call sequentially; allow only non-secret argv/fixtures. */
export async function collectCommand(
  input: CommandInput,
): Promise<CheckEvidence> {
  requireCondition(
    isAbsolute(input.executable) &&
      isAbsolute(input.cwd) &&
      input.checkId &&
      input.environment &&
      Number.isInteger(input.timeoutMs) &&
      input.timeoutMs > 0,
    'invalid command input',
  );
  const id = randomUUID(),
    dir = join(input.out, id);
  await mkdir(dir, { recursive: true });
  const started = new Date().toISOString();
  let stdout = Buffer.alloc(0),
    stderr = Buffer.alloc(0),
    termination: CheckEvidence['termination'] = 'exit',
    exitCode: number | null = null;
  if (input.signal?.aborted) termination = 'aborted';
  else
    await new Promise<void>((accept) => {
      const child = spawn(input.executable, input.args, {
        cwd: input.cwd,
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: false,
        detached: process.platform !== 'win32',
      });
      child.stdout.on('data', (b: Buffer) => {
        stdout = Buffer.concat([stdout, b]);
      });
      child.stderr.on('data', (b: Buffer) => {
        stderr = Buffer.concat([stderr, b]);
      });
      let settled = false;
      let drainTimer: NodeJS.Timeout | undefined;
      const stop = (kind: 'timeout' | 'aborted') => {
        if (settled || termination !== 'exit') return;
        termination = kind;
        // Pipes can outlive the direct child. Kill its process tree and bound
        // the drain even if a descendant escaped the process group.
        if (child.pid) {
          if (process.platform === 'win32') {
            const killer = spawn(
              'taskkill',
              ['/pid', String(child.pid), '/T', '/F'],
              {
                stdio: 'ignore',
                shell: false,
              },
            );
            killer.once('error', () => child.kill('SIGKILL'));
          } else {
            try {
              process.kill(-child.pid, 'SIGKILL');
            } catch {
              child.kill('SIGKILL');
            }
          }
        }
        drainTimer = setTimeout(() => {
          child.stdout.destroy();
          child.stderr.destroy();
          finish();
        }, 250);
      };
      const timer = setTimeout(() => stop('timeout'), input.timeoutMs),
        abort = () => stop('aborted');
      input.signal?.addEventListener('abort', abort, { once: true });
      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        clearTimeout(drainTimer);
        input.signal?.removeEventListener('abort', abort);
        accept();
      };
      child.once('error', () => {
        if (termination === 'exit') termination = 'init-failure';
        finish();
      });
      child.once('close', (code) => {
        if (settled) return;
        exitCode = code;
        if (termination === 'exit' && code !== 0)
          termination = 'execution-failure';
        finish();
      });
      // Covers an abort between the initial check and listener registration.
      if (input.signal?.aborted) abort();
    });
  const stdoutArtifact = `${id}/stdout.txt`,
    stderrArtifact = `${id}/stderr.txt`;
  await writeFile(join(input.out, stdoutArtifact), stdout, { flag: 'wx' });
  await writeFile(join(input.out, stderrArtifact), stderr, { flag: 'wx' });
  const row: CheckEvidence = {
    checkId: input.checkId,
    candidateId: input.candidate.candidateId,
    tarballSha256: input.candidate.tarballSha256,
    command: JSON.stringify([input.executable, ...input.args]),
    environment: input.environment,
    status: exitCode === 0 && termination === 'exit' ? 'passed' : 'failed',
    exitCode,
    termination,
    stdoutArtifact,
    stderrArtifact,
    artifactDigests: {
      [stdoutArtifact]: sha256(stdout),
      [stderrArtifact]: sha256(stderr),
    },
    guestBuilds: [],
    browser: null,
    unverified: [],
  };
  await writeFile(
    join(dir, 'observation.json'),
    JSON.stringify(
      {
        started,
        finished: new Date().toISOString(),
        cwd: input.cwd,
        result: row,
      },
      null,
      2,
    ),
    { flag: 'wx' },
  );
  return row;
}
export function unexecuted(
  checkId: string,
  candidate: CandidateIdentity,
  reason: string,
): CheckEvidence {
  return {
    checkId,
    candidateId: candidate.candidateId,
    tarballSha256: candidate.tarballSha256,
    command: 'not-run',
    environment: 'unverified',
    status: 'unverified',
    exitCode: null,
    termination: 'not-run',
    stdoutArtifact: null,
    stderrArtifact: null,
    artifactDigests: {},
    guestBuilds: [],
    browser: null,
    unverified: [reason],
  };
}
export async function observeArtifact(filename: string, expected: string) {
  const bytes = await readFile(filename);
  requireCondition(
    sha256(bytes) === expected,
    'observed artifact identity differs',
  );
  return { filename, sha256: expected, size: bytes.length };
}
