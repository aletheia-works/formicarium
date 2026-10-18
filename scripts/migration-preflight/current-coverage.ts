import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { FileCoverageData } from 'istanbul-lib-coverage';
import type { CounterRow, DigestRow, Realm } from '../coverage-types.js';
import {
  assertInstallNodeRealms,
  INSTALL_REALMS,
} from '../migration-install/coverage.js';
import {
  counterLayout,
  mergeRealms,
  readPlaywrightNodeRealms,
} from '../package/coverage.js';
import { sha256 } from '../package/stage-package.js';

/** Read-only recomputation: no old aggregate or registered realm can replace raw counters. */
export async function verifyCurrentRawCoverage(
  out: string,
  candidate: { files: { path: string; sha256: string }[] },
) {
  const read = async <T>(path: string): Promise<T> =>
    JSON.parse(await readFile(path, 'utf8')) as T;
  const { metadata, layout, digests } = await read<{
    metadata: FileCoverageData[];
    layout: CounterRow[];
    digests: DigestRow[];
  }>(resolve(out, 'coverage-metadata.json'));
  if (JSON.stringify(counterLayout(metadata)) !== JSON.stringify(layout))
    throw Error('raw coverage counter layout differs');
  const last = layout.at(-1);
  if (!last) throw Error('missing coverage metadata');
  const counterCount = last.offset + last.keys.length;
  for (const row of digests) {
    if (
      candidate.files.filter(
        (file) => file.path === row.path && file.sha256 === row.sourceSha256,
      ).length !== 1 ||
      sha256(await readFile(resolve(out, row.path))) !==
        row.instrumentedSha256 ||
      sha256(
        JSON.stringify(
          metadata.find((file) => file.path === row.path)?.statementMap,
        ),
      ) !== row.statementMapSha256
    )
      throw Error('fresh coverage source/instrumentation differs');
  }
  const inventory = await read<{
    node: { workers: number; host: number };
    browserCases: Record<string, number>;
  }>(resolve(process.cwd(), 'scripts/package/coverage-inventory.json'));
  const realms: Realm[] = [];
  const expected: string[] = [];
  type Row = { name: string; counts: number[] };
  const collect = (rows: Row[], prefix: string, names: string[]) => {
    if (
      rows.length !== names.length ||
      JSON.stringify(rows.map((row) => row.name).sort()) !==
        JSON.stringify([...names].sort())
    )
      throw Error('missing/unexpected raw coverage realms');
    for (const row of rows) {
      if (
        row.counts.length !== counterCount ||
        row.counts.some(
          (count) =>
            !Number.isSafeInteger(count) || count < 0 || count > 2147483647,
        )
      )
        throw Error('invalid raw coverage counter');
      realms.push({
        name: prefix + row.name,
        buffer: Int32Array.from(row.counts).buffer,
      });
    }
    expected.push(...names.map((name) => prefix + name));
  };
  collect(await read<Row[]>(resolve(out, 'coverage-node.json')), '', [
    'node-host',
    ...Array.from(
      { length: inventory.node.workers },
      (_, i) => `node-worker-${i + 1}`,
    ),
  ]);
  const sessionRows = await read<Row[]>(
    resolve(out, 'coverage-session-node.json'),
  );
  assertInstallNodeRealms(sessionRows);
  collect(sessionRows, 'session:', [
    'node-host',
    ...Array.from(
      { length: INSTALL_REALMS.nodeWorkers },
      (_, i) => `node-worker-${i + 1}`,
    ),
  ]);
  const runnerRealms = await readPlaywrightNodeRealms(out, [
    'package',
    'session',
    'install',
  ]);
  realms.push(...runnerRealms);
  expected.push(...runnerRealms.map((realm) => realm.name));
  const files: string[] = [];
  const scan = async (directory: string): Promise<void> => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) throw Error('symlink raw coverage input');
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) await scan(path);
      else if (entry.name === 'coverage-realms.json') files.push(path);
    }
  };
  await scan(resolve(out, 'browser-results'));
  const cases: Record<string, number> = {
    ...inventory.browserCases,
    ...INSTALL_REALMS.browserCases,
  };
  const seen = new Set<string>();
  for (const path of files) {
    const item = await read<{ project: string; title: string; rows: Row[] }>(
      path,
    );
    const key = `${item.project}:${item.title}`;
    if (
      !['chromium', 'firefox', 'webkit'].includes(item.project) ||
      !Object.hasOwn(cases, item.title) ||
      seen.has(key)
    )
      throw Error('unexpected/duplicate raw browser case');
    seen.add(key);
    collect(item.rows, `${key}:`, [
      'browser-host',
      ...Array.from(
        { length: cases[item.title]! },
        (_, i) => `browser-worker-${i + 1}`,
      ),
    ]);
  }
  if (seen.size !== Object.keys(cases).length * 3)
    throw Error('missing raw 3browser cases');
  const result = mergeRealms(metadata, layout, realms, expected);
  const report = await read<{
    lines: unknown;
    passed: boolean;
    realmNames: string[];
    digests: DigestRow[];
    files: { path: string; lines: Record<string, number> }[];
  }>(resolve(out, 'coverage-report.json'));
  const fileLines = metadata.map((file) => ({
    path: file.path,
    lines: result.map.fileCoverageFor(file.path).getLineCoverage(),
  }));
  if (
    JSON.stringify(result.lines) !== JSON.stringify(report.lines) ||
    result.passed !== report.passed ||
    JSON.stringify(fileLines) !== JSON.stringify(report.files) ||
    JSON.stringify(digests) !== JSON.stringify(report.digests) ||
    JSON.stringify(realms.map((row) => row.name).sort()) !==
      JSON.stringify([...report.realmNames].sort())
  )
    throw Error('raw current coverage differs from aggregate');
  return report;
}
