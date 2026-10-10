import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const TOOLCHAIN = Object.freeze({ bun: '1.4.2', node: '24.21.0' });
export const TASKS = Object.freeze({
  'install-frozen': ['install', '--frozen-lockfile', '--ignore-scripts'],
  lint: ['run', 'check'],
  typecheck: ['run', 'typecheck'],
  build: ['run', 'build'],
  'test-light': ['run', 'test:light'],
  'test-consumer': ['run', 'test:consumer'],
  'verify-candidate': ['run', 'verify:candidate'],
} as const);
export type Task = keyof typeof TASKS;
export interface ExecutionResult {
  status: number | null;
  stdout?: string;
  signal?: string | null;
  error?: Error;
}
export type Executor = (
  executable: string,
  args: readonly string[],
) => ExecutionResult;

export function taskArguments(task: string, cacheless = false) {
  if (!Object.hasOwn(TASKS, task))
    throw Error(`unknown developer task: ${task}`);
  const args: string[] = [...TASKS[task as Task]];
  if (cacheless) {
    if (task !== 'install-frozen')
      throw Error('cacheless applies to install only');
    args.push('--no-cache');
  }
  return args;
}

export function runTask(options: {
  task: string;
  nodeVersion: string;
  execute: Executor;
  cacheless?: boolean;
}) {
  const args = taskArguments(options.task, options.cacheless);
  if (options.nodeVersion !== TOOLCHAIN.node)
    throw Error(`Node ${TOOLCHAIN.node} required for developer tasks`);
  const version = options.execute('bun', ['--version']);
  if (version.status !== 0 || version.stdout?.trim() !== TOOLCHAIN.bun)
    throw Error(`Bun ${TOOLCHAIN.bun} required for developer tasks`);
  const result = options.execute('bun', args);
  if (result.error) throw result.error;
  if (result.signal) return 1;
  // Cancellation and signals cannot become successful task results.
  return result.status ?? 1;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const [task, mode, ...extra] = process.argv.slice(2);
  if (!task || extra.length || (mode && mode !== '--cacheless'))
    throw Error('usage: tasks.ts <task> [--cacheless]');
  process.exitCode = runTask({
    task,
    cacheless: mode === '--cacheless',
    nodeVersion: process.versions.node,
    execute: (executable, args) => {
      const version = args[0] === '--version';
      const result = spawnSync(executable, [...args], {
        shell: false,
        stdio: version ? 'pipe' : 'inherit',
        encoding: 'utf8',
      });
      return { ...result, stdout: result.stdout ?? undefined };
    },
  });
}
