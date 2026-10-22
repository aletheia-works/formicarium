import { readdir, readFile } from 'node:fs/promises';
import { basename, join, relative, resolve } from 'node:path';
import v8toIstanbul from 'v8-to-istanbul';
import {
  fail,
  parseOptions,
  runCli,
  SITE_ROOT,
  siteLayout,
  writeJsonFile,
  writeText,
} from '../../scripts/common.ts';

/**
 * Line coverage of the fixed denominator: node:test's
 * lcov plus Chromium's V8 coverage of the built bundles, mapped back to the
 * TypeScript lines through the hidden source maps. A denominator file that
 * neither source measured fails as missing; it is never dropped.
 */
export interface Denominator {
  threshold: number;
  files: string[];
}
type LineHits = Map<number, number>;
export type Coverage = Map<string, LineHits>;

const add = (coverage: Coverage, file: string, line: number, hits: number) => {
  const lines = coverage.get(file) ?? new Map<number, number>();
  lines.set(line, (lines.get(line) ?? 0) + hits);
  coverage.set(file, lines);
};

/** lcov DA records by absolute source path. */
export function parseLcov(text: string, into: Coverage = new Map()): Coverage {
  let file: string | null = null;
  for (const line of text.split('\n')) {
    if (line.startsWith('SF:')) file = resolve(line.slice(3).trim());
    else if (line.startsWith('DA:') && file) {
      const [number, hits] = line.slice(3).split(',').map(Number);
      if (Number.isSafeInteger(number) && Number.isFinite(hits))
        add(into, file, number!, hits!);
    } else if (line === 'end_of_record') file = null;
  }
  return into;
}

interface V8Entry {
  url: string;
  source?: string;
  functions: Parameters<ReturnType<typeof v8toIstanbul>['applyCoverage']>[0];
}

/** Chromium V8 entries of `_astro/*.js`, mapped through their `.map` files. */
export async function addV8(
  entries: readonly V8Entry[],
  options: { dist: string; sourcemaps: string },
  into: Coverage = new Map(),
): Promise<Coverage> {
  for (const entry of entries) {
    const name = basename(new URL(entry.url).pathname);
    let map: string;
    try {
      map = await readFile(
        join(options.sourcemaps, '_astro', `${name}.map`),
        'utf8',
      );
    } catch {
      continue;
    }
    // Sources in the map are relative to dist/_astro, where the bundle lived.
    const converter = v8toIstanbul(join(options.dist, '_astro', name), 0, {
      source: entry.source ?? '',
      sourceMap: { sourcemap: JSON.parse(map) },
    });
    await converter.load();
    converter.applyCoverage(entry.functions);
    for (const [file, data] of Object.entries(converter.toIstanbul())) {
      for (const [id, location] of Object.entries(data.statementMap))
        add(into, resolve(file), location.start.line, data.s[id] ?? 0);
    }
  }
  return into;
}

export interface FileReport {
  path: string;
  lines: number;
  covered: number;
  pct: number;
}
export interface CoverageReport {
  schemaVersion: 1;
  threshold: number;
  linesPct: number;
  lines: number;
  covered: number;
  files: FileReport[];
  missing: string[];
  passed: boolean;
}

const pct = (covered: number, lines: number) =>
  lines === 0 ? 0 : Math.floor((covered / lines) * 10000) / 100;

/** Report over the denominator only; missing files count as 0 % and fail. */
export function report(
  coverage: Coverage,
  denominator: Denominator,
  root = SITE_ROOT,
): CoverageReport {
  const files: FileReport[] = [];
  const missing: string[] = [];
  for (const path of denominator.files) {
    const lines = coverage.get(resolve(root, path));
    if (!lines || lines.size === 0) {
      missing.push(path);
      files.push({ path, lines: 0, covered: 0, pct: 0 });
      continue;
    }
    const covered = [...lines.values()].filter((hits) => hits > 0).length;
    files.push({
      path,
      lines: lines.size,
      covered,
      pct: pct(covered, lines.size),
    });
  }
  const lines = files.reduce((sum, file) => sum + file.lines, 0);
  const covered = files.reduce((sum, file) => sum + file.covered, 0);
  const linesPct = pct(covered, lines);
  return {
    schemaVersion: 1,
    threshold: denominator.threshold,
    linesPct,
    lines,
    covered,
    files,
    missing,
    passed: missing.length === 0 && linesPct >= denominator.threshold,
  };
}

export function markdown(result: CoverageReport): string {
  return [
    `## showcase site coverage: ${result.linesPct}% (${result.covered}/${result.lines} lines, threshold ${result.threshold}%)`,
    '',
    '| file | lines | covered | % |',
    '|---|---|---|---|',
    ...result.files.map(
      (file) =>
        `| ${file.path} | ${file.lines} | ${file.covered} | ${file.pct} |`,
    ),
    '',
    result.missing.length
      ? `missing (0 %): ${result.missing.join(', ')}`
      : 'missing: none',
    '',
  ].join('\n');
}

async function readV8(directory: string): Promise<V8Entry[]> {
  let names: string[];
  try {
    names = (await readdir(directory))
      .filter((name) => name.endsWith('.json'))
      .sort();
  } catch {
    return [];
  }
  const entries: V8Entry[] = [];
  for (const name of names)
    entries.push(
      ...(JSON.parse(
        await readFile(join(directory, name), 'utf8'),
      ) as V8Entry[]),
    );
  return entries;
}

if (import.meta.main)
  await runCli('coverage', async () => {
    const layout = siteLayout();
    const options = parseOptions(process.argv.slice(2), [
      'lcov',
      'v8',
      'sourcemaps',
      'denominator',
      'out',
      'dist',
    ]);
    const denominator = JSON.parse(
      await readFile(
        options.denominator ?? join(SITE_ROOT, 'coverage-denominator.json'),
        'utf8',
      ),
    ) as Denominator;
    const coverage = parseLcov(
      await readFile(
        options.lcov ?? join(layout.coverage, 'lcov.info'),
        'utf8',
      ),
    );
    await addV8(
      await readV8(options.v8 ?? join(layout.coverage, 'v8')),
      {
        dist: options.dist ?? layout.dist,
        sourcemaps: options.sourcemaps ?? layout.sourcemaps,
      },
      coverage,
    );
    const result = report(coverage, denominator);
    const out = options.out ?? join(layout.coverage, 'report');
    await writeJsonFile(join(out, 'summary.json'), result);
    await writeText(join(out, 'summary.md'), markdown(result));
    console.log(markdown(result));
    console.log(`report: ${relative(process.cwd(), out)}`);
    if (!result.passed)
      fail(
        'build-failed',
        result.missing.length
          ? `denominator files missing: ${result.missing.join(', ')}`
          : `line coverage ${result.linesPct}% < ${result.threshold}%`,
      );
  });
