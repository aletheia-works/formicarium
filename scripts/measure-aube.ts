#!/usr/bin/env node
import type { ChildProcess } from 'node:child_process';
// usage: node scripts/measure-aube.js [--env node,chromium,firefox,webkit] [--trials 3]
//                                      [--out .artifacts/measure/aube-timings.json]
//
// aube の 4 コマンド（--version、初回 install、frozen install、list）を、Node.js の Worker
// と各ブラウザの paludarium 上で実行して時間を測り、JSON に記録する。
// あわせて同じディレクトリの README.md に、CheerpX 1.3.9 の値と並べた表を書く。
//
// install・frozen install・list は fixtures/sessions/aube-1645.txt の手順で測る
// （fixtures/aube-local-deps を /work に置き、/work/app で実行する）。
// 計測中はほかの重い処理を止めておくこと（並行負荷で値が大きく変わる）。
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import type { Browser } from '@playwright/test';
import { errorText } from '../runtime/contracts.js';
import { runInWorker } from '../runtime/node/host.js';
import { parseSessionScript, toSessionSteps } from '../runtime/session.js';
import { GUEST_ENV } from '../web/sessions.js';
import type { TimingRun } from './lib/timings.js';
import {
  COMMANDS,
  measureHostBench,
  renderResultsMarkdown,
  validateTimings,
} from './lib/timings.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BROWSERS = ['chromium', 'firefox', 'webkit'];
const RUN_TIMEOUT_MS = 20 * 60 * 1000;

function parseArgs(argv: string[]) {
  const options = {
    envs: ['node', ...BROWSERS],
    trials: 3,
    out: '.artifacts/measure/aube-timings.json',
    port: 8790,
  };
  for (let i = 0; i < argv.length; i += 2) {
    const [flag, value] = [argv[i], argv[i + 1]];
    if (value === undefined) throw new Error(`${flag} needs a value`);
    if (flag === '--env') {
      options.envs = value.split(',');
      const unknown = options.envs.filter(
        (e) => e !== 'node' && !BROWSERS.includes(e),
      );
      if (unknown.length)
        throw new Error(`unknown --env: ${unknown.join(',')}`);
    } else if (flag === '--trials') {
      options.trials = Number(value);
      if (!Number.isInteger(options.trials) || options.trials < 1)
        throw new Error('--trials must be a positive integer');
    } else if (flag === '--out') {
      options.out = value;
    } else if (flag === '--port') {
      options.port = Number(value);
    } else {
      throw new Error(`unknown option: ${flag}`);
    }
  }
  return options;
}

const session = parseSessionScript(
  readFileSync(path.join(root, 'fixtures/sessions/aube-1645.txt'), 'utf8'),
);
/** 手順の中で、計測するコマンドの位置 */
const SESSION_KEYS: Record<string, string> = {
  'aube install': 'install',
  'aube install --frozen-lockfile': 'frozenInstall',
  'aube list': 'list',
};

function collect(
  versionStep: { elapsedMs: number; exitCode: number },
  sessionSteps: readonly { elapsedMs: number; exitCode: number }[],
) {
  const milliseconds: Record<string, number> = {
    version: versionStep.elapsedMs,
  };
  const exitCodes: Record<string, number> = { version: versionStep.exitCode };
  session.forEach((command, i) => {
    const key = SESSION_KEYS[command.command];
    if (key) {
      milliseconds[key] = sessionSteps[i]!.elapsedMs;
      exitCodes[key] = sessionSteps[i]!.exitCode;
    }
  });
  return { milliseconds, exitCodes };
}

async function measureNode(trial: number, trials: number): Promise<TimingRun> {
  const guest = path.join(root, 'dist/guests/aube');
  const version = await runInWorker({
    guest,
    args: ['--version'],
    env: GUEST_ENV.aube,
    timeoutMs: RUN_TIMEOUT_MS,
  });
  const versionText = new TextDecoder()
    .decode(version.results[0]?.stdout)
    .trim();
  const cwd = '/work/app';
  const { results } = await runInWorker({
    guest,
    copyIn: [
      { host: path.join(root, 'fixtures/aube-local-deps'), guest: '/work' },
    ],
    cwd,
    steps: toSessionSteps(session, cwd),
    persist: ['/work', '/root'],
    env: GUEST_ENV.aube,
    timeoutMs: RUN_TIMEOUT_MS,
  });
  return {
    environment: {
      kind: 'node',
      name: 'Node.js Worker',
      version: process.versions.node,
      os: `${os.type()} ${os.release()} ${os.arch()}`,
      visibility: 'n/a',
    },
    trial,
    trials,
    toolVersion: versionText,
    ...collect(version.results[0]!, results),
  };
}

function startServer(port: number): Promise<ChildProcess> {
  const child = spawn(
    process.execPath,
    ['scripts/serve.js', '--port', String(port)],
    {
      cwd: root,
      stdio: ['ignore', 'pipe', 'inherit'],
    },
  );
  return new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('exit', (code) =>
      reject(new Error(`serve.js exited with ${code}`)),
    );
    child.stdout.on('data', (data) => {
      if (String(data).includes('serving')) resolve(child);
    });
  });
}

async function runPage(browser: Browser, url: string) {
  const page = await browser.newPage();
  try {
    await page.goto(url);
    await page.waitForFunction(
      () => window.formicariumResult !== undefined,
      null,
      { timeout: RUN_TIMEOUT_MS },
    );
    const result = await page.evaluate(() => window.formicariumResult);
    if (!result) throw new Error('page did not report a result');
    if (result.error) throw new Error(`${url}: ${result.error}`);
    return result;
  } finally {
    await page.close();
  }
}

async function measureBrowser(
  playwright: Pick<
    typeof import('@playwright/test'),
    'chromium' | 'firefox' | 'webkit'
  >,
  name: 'chromium' | 'firefox' | 'webkit',
  base: string,
  trial: number,
  trials: number,
): Promise<TimingRun> {
  const browser = await playwright[name].launch();
  try {
    const version = await runPage(
      browser,
      `${base}/web/index.html?guest=aube&arg=--version`,
    );
    const sessionResult = await runPage(
      browser,
      `${base}/web/index.html?session=aube-1645`,
    );
    return {
      environment: {
        kind: 'browser',
        name,
        version: browser.version(),
        os: `${os.type()} ${os.release()} ${os.arch()}`,
        // Playwright のページは前面扱い（headless）。ページ側が報告した値を記録する。
        visibility: `${sessionResult.visibility} (headless)`,
      },
      trial,
      trials,
      userAgent: sessionResult.userAgent,
      ...collect(version.steps![0]!, sessionResult.steps!),
    };
  } finally {
    await browser.close();
  }
}

const loadPlaywright = () => import('@playwright/test');
async function main() {
  const options = parseArgs(process.argv.slice(2));
  const runs = [];
  const failures = [];
  const browsers = options.envs.filter((e) => BROWSERS.includes(e));
  let server: ChildProcess | undefined;
  let playwright: Awaited<ReturnType<typeof loadPlaywright>> | undefined;
  if (browsers.length) {
    playwright = await loadPlaywright();
    server = await startServer(options.port);
  }
  try {
    for (const env of options.envs) {
      for (let trial = 1; trial <= options.trials; ++trial) {
        process.stderr.write(
          `measure: ${env} trial ${trial}/${options.trials}\n`,
        );
        try {
          // ホストの速さは時間とともに変わるので、試行の前後に測って一緒に記録する（U-2）
          const before = measureHostBench();
          const run =
            env === 'node'
              ? await measureNode(trial, options.trials)
              : await measureBrowser(
                  playwright!,
                  env as 'chromium' | 'firefox' | 'webkit',
                  `http://127.0.0.1:${options.port}`,
                  trial,
                  options.trials,
                );
          run.hostBenchMs = { before, after: measureHostBench() };
          runs.push(run);
          process.stderr.write(
            `  ${JSON.stringify(run.milliseconds)} exit=${JSON.stringify(run.exitCodes)} hostBenchMs=${JSON.stringify(run.hostBenchMs)}\n`,
          );
        } catch (error) {
          // 1 回の失敗で全体を止めず、記録して続ける
          failures.push({ environment: env, trial, error: errorText(error) });
          process.stderr.write(`  failed: ${errorText(error)}\n`);
        }
      }
    }
  } finally {
    server?.kill();
  }

  const info = JSON.parse(
    readFileSync(path.join(root, 'dist/paludarium/build-info.json'), 'utf8'),
  );
  let aubeCommit = 'unknown';
  try {
    aubeCommit = readFileSync(
      path.join(root, 'dist/guests/aube.commit'),
      'utf8',
    ).trim();
  } catch {
    process.stderr.write('measure: dist/guests/aube.commit not found\n');
  }
  const doc = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    tool: {
      name: 'aube',
      version: runs.find((r) => r.toolVersion)?.toolVersion ?? 'unknown',
      commit: aubeCommit,
    },
    core: { name: info.core, version: info.version },
    host: {
      os: `${os.type()} ${os.release()} ${os.arch()}`,
      cpu: `${os.cpus()[0]?.model} x${os.cpus().length}`,
      node: process.versions.node,
    },
    commands: COMMANDS,
    runs,
    failures,
  };
  const problems = runs.length ? validateTimings(doc) : ['no successful runs'];
  const outPath = path.resolve(root, options.out);
  mkdirSync(path.dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(doc, null, 2)}\n`);
  process.stderr.write(`measure: wrote ${path.relative(root, outPath)}\n`);
  if (runs.length) {
    writeFileSync(
      path.join(path.dirname(outPath), 'README.md'),
      renderResultsMarkdown(doc),
    );
    process.stderr.write(
      `measure: wrote ${path.relative(root, path.join(path.dirname(outPath), 'README.md'))}\n`,
    );
  }
  if (problems.length || failures.length) {
    process.stderr.write(
      `measure: incomplete: ${[...problems, ...failures.map((f) => `${f.environment}#${f.trial}: ${f.error}`)].join('; ')}\n`,
    );
    process.exitCode = 1;
  }
}

main().catch((error) => {
  process.stderr.write(`measure: ${error.stack ?? error.message}\n`);
  process.exitCode = 1;
});
