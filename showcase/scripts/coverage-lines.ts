import { readFile } from 'node:fs/promises';
import { fail, runCli } from './errors.ts';

/** The line coverage showcase/scripts must keep, over all its files together. */
export const MIN_LINE_PERCENT = 80;
const SCOPE = 'showcase/scripts/';

/**
 * Line coverage of showcase/scripts from an lcov report. Bun's own
 * coverageThreshold applies to each file, which is not this rule.
 */
export function scriptsLineCoverage(lcov: string): {
  files: number;
  lines: number;
  covered: number;
  percent: number;
} {
  const seen = new Set<string>();
  let file: string | null = null;
  let lines = 0;
  let covered = 0;
  for (const line of lcov.split('\n')) {
    if (line.startsWith('SF:')) {
      const path = line.slice(3).trim();
      file = path.includes(SCOPE) ? path : null;
      if (file) seen.add(file);
    } else if (line.startsWith('DA:') && file) {
      lines += 1;
      if (Number(line.slice(3).split(',')[1]) > 0) covered += 1;
    } else if (line === 'end_of_record') file = null;
  }
  if (lines === 0) fail('config-invalid', `lcov has no lines under ${SCOPE}`);
  return {
    files: seen.size,
    lines,
    covered,
    percent: (covered / lines) * 100,
  };
}

if (import.meta.main)
  await runCli('coverage-lines', async () => {
    const path = process.argv[2];
    if (!path) fail('config-invalid', 'usage: coverage-lines.ts <lcov.info>');
    const result = scriptsLineCoverage(await readFile(path, 'utf8'));
    const summary = `${result.percent.toFixed(2)}% (${result.covered}/${result.lines} lines, ${result.files} files, minimum ${MIN_LINE_PERCENT}%)`;
    console.log(`${SCOPE} line coverage ${summary}`);
    if (result.percent < MIN_LINE_PERCENT)
      fail('config-invalid', `line coverage is below the minimum: ${summary}`);
  });
