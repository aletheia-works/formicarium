import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parseUniqueJson, sha256 } from '../../scripts/build-key.ts';
import {
  CA_BUNDLE_SITE_PATH,
  type CandidateManifest,
  computeCandidateId,
  fixtureInventorySha256,
} from '../../scripts/candidate.ts';
import type { PackRecord } from '../../scripts/pack.ts';
import { fileInventory } from '../../scripts/paths.ts';
import {
  fail,
  parseOptions,
  runCli,
  SHOWCASE_DIR,
  siteLayout,
  summary,
  writeJsonFile,
} from './common.ts';

export type Mode = 'verify' | 'distribute';
const ENVIRONMENTS = [
  'node',
  'chromium',
  'firefox',
  'webkit',
  'safari',
] as const;

/** One line of the candidate-identity log: item, path, expected, actual. */
export interface CheckLine {
  item: string;
  path: string;
  expected: string;
  actual: string;
  /** false = mismatch; null = logged only (verify mode, items 2 and 6). */
  ok: boolean | null;
}
export interface VerifyInput {
  mode: Mode;
  candidateDir: string;
  pack: PackRecord;
  /** showcase.yml job outputs; distribute only. */
  jobOutputs?: { candidateId?: string; distributable?: string };
  fixturesDir?: string;
}
export interface VerifyResult {
  manifest: CandidateManifest;
  lines: CheckLine[];
}

interface LogRow {
  name?: unknown;
  tool?: unknown;
  environment?: unknown;
  status?: unknown;
  expectedVersion?: unknown;
}

const line = (
  item: string,
  path: string,
  expected: unknown,
  actual: unknown,
  ok?: boolean | null,
): CheckLine => ({
  item,
  path,
  expected: String(expected),
  actual: String(actual),
  ok: ok === undefined ? String(expected) === String(actual) : ok,
});

async function readCandidateJson(
  directory: string,
  path: string,
): Promise<{ bytes: Buffer; value: unknown }> {
  let bytes: Buffer;
  try {
    bytes = await readFile(join(directory, path));
  } catch (error) {
    return fail('candidate-mismatch', `candidate file missing: ${path}`, error);
  }
  return { bytes, value: parseUniqueJson(bytes.toString('utf8')) };
}

/** (3) site/ against manifest.assets: path, SHA256 and bytes, nothing extra. */
async function assetLines(
  directory: string,
  manifest: CandidateManifest,
): Promise<CheckLine[]> {
  const actual = (await fileInventory(resolve(directory, 'site'))).map(
    (file) => ({
      ...file,
      path: `site/${file.path}`,
    }),
  );
  const expected = new Map(manifest.assets.map((asset) => [asset.path, asset]));
  const lines: CheckLine[] = [];
  for (const file of actual) {
    const want = expected.get(file.path);
    lines.push(
      line(
        '3-asset',
        file.path,
        want ? `${want.sha256}/${want.bytes}` : 'absent',
        `${file.sha256}/${file.bytes}`,
      ),
    );
    expected.delete(file.path);
  }
  for (const missing of expected.values())
    lines.push(
      line(
        '3-asset',
        missing.path,
        `${missing.sha256}/${missing.bytes}`,
        'missing',
      ),
    );
  return lines;
}

/** (4) every tool x node, 3 browsers and Safari, all passed, accepted versions. */
function logLines(log: unknown, manifest: CandidateManifest): CheckLine[] {
  const rows = (log as { rows?: LogRow[] } | null)?.rows;
  if (!Array.isArray(rows))
    return [line('4-log', 'acceptance-log.json', 'rows', 'missing')];
  const lines: CheckLine[] = [];
  for (const tool of manifest.resolvedTools)
    for (const environment of ENVIRONMENTS) {
      const found = rows.filter(
        (row) => row.tool === tool.tool && row.environment === environment,
      );
      const row = found[0];
      lines.push(
        line(
          '4-log',
          `acceptance-log.json#${tool.tool}/${environment}`,
          `passed ${tool.version}`,
          found.length === 1 && row
            ? `${String(row.status)} ${String(row.expectedVersion)}`
            : `${found.length} rows`,
        ),
      );
    }
  return lines;
}

/** The candidate check: the seven items; verify logs (2) and (6) without judging them. */
export async function verifyCandidate(
  input: VerifyInput,
): Promise<VerifyResult> {
  const { candidateDir } = input;
  const distribute = input.mode === 'distribute';
  const { value } = await readCandidateJson(candidateDir, 'manifest.json');
  const manifest = value as CandidateManifest;
  const lines: CheckLine[] = [];
  lines.push(
    line(
      '1-candidate-id',
      'manifest.json',
      manifest.candidateId,
      computeCandidateId(manifest),
    ),
  );
  lines.push(
    line(
      '2-job-candidate-id',
      'job output candidate-id',
      manifest.candidateId,
      input.jobOutputs?.candidateId ?? 'none',
      distribute ? undefined : null,
    ),
    line(
      '2-job-distributable',
      'job output distributable',
      String(manifest.distributable),
      input.jobOutputs?.distributable ?? 'none',
      distribute ? undefined : null,
    ),
  );
  lines.push(...(await assetLines(candidateDir, manifest)));
  const catalog = await readCandidateJson(candidateDir, 'site/catalog.json');
  lines.push(
    line(
      '3-catalog',
      'site/catalog.json',
      manifest.catalogSha256,
      sha256(catalog.bytes),
    ),
  );
  // The pages fetch the CA bundle by this path and digest (assets list it too).
  const caPath = `site/${CA_BUNDLE_SITE_PATH}`;
  lines.push(
    line(
      '3-ca-bundle-path',
      'manifest.json#caBundle.path',
      CA_BUNDLE_SITE_PATH,
      manifest.caBundle?.path ?? 'absent',
    ),
  );
  let caActual = 'missing';
  try {
    caActual = sha256(await readFile(join(candidateDir, caPath)));
  } catch {
    // Reported as missing.
  }
  lines.push(
    line(
      '3-ca-bundle',
      caPath,
      manifest.caBundle?.sha256 ?? 'absent',
      caActual,
    ),
  );
  const log = await readCandidateJson(candidateDir, 'acceptance-log.json');
  lines.push(
    line(
      '4-log-sha256',
      'acceptance-log.json',
      manifest.acceptanceLogSha256,
      sha256(log.bytes),
    ),
  );
  lines.push(...logLines(log.value, manifest));
  const defaults =
    (catalog.value as { defaults?: Record<string, unknown> } | null)
      ?.defaults ?? {};
  for (const tool of manifest.resolvedTools)
    lines.push(
      line(
        '5-default',
        `site/catalog.json#defaults.${tool.tool}`,
        tool.version,
        defaults[tool.tool] ?? 'missing',
      ),
    );
  lines.push(
    line(
      '6-pack',
      'pack.json',
      manifest.formicariumPackSha256,
      input.pack.packSha256,
      distribute ? undefined : null,
    ),
  );
  lines.push(
    line(
      '7-fixtures',
      'showcase/fixtures',
      manifest.fixtureInventorySha256,
      await fixtureInventorySha256(
        input.fixturesDir ?? join(SHOWCASE_DIR, 'fixtures'),
      ),
    ),
  );
  lines.push(
    line(
      'mode-distributable',
      'manifest.json#distributable',
      String(distribute),
      String(manifest.distributable),
    ),
  );
  return { manifest, lines };
}

export const mismatches = (result: VerifyResult) =>
  result.lines.filter((item) => item.ok === false);

if (import.meta.main)
  await runCli('verify-candidate', async () => {
    const options = parseOptions(process.argv.slice(2), ['mode']);
    const mode = options.mode;
    if (mode !== 'verify' && mode !== 'distribute')
      fail('config-invalid', '--mode verify|distribute');
    const layout = siteLayout();
    const pack = parseUniqueJson(
      await readFile(join(layout.pack, 'pack.json'), 'utf8'),
    ) as PackRecord;
    const result = await verifyCandidate({
      mode,
      candidateDir: layout.candidate,
      pack,
      jobOutputs: {
        candidateId: process.env.SHOWCASE_CANDIDATE_ID,
        distributable: process.env.SHOWCASE_DISTRIBUTABLE,
      },
    });
    for (const item of result.lines)
      console.log(
        `${item.ok === false ? 'MISMATCH' : item.ok === null ? 'LOGGED' : 'ok'} ${item.item} ${item.path} expected=${item.expected} actual=${item.actual}`,
      );
    await writeJsonFile(join(layout.logs, 'verify-candidate.json'), {
      schemaVersion: 1,
      mode,
      candidateId: result.manifest.candidateId,
      lines: result.lines,
    });
    const bad = mismatches(result);
    await summary([
      `- candidateId: \`${result.manifest.candidateId}\` (${mode})`,
      `- 候補の照合：${bad.length === 0 ? 'すべて一致' : `${bad.length} 件の不一致`}`,
    ]);
    if (bad.length)
      fail(
        'candidate-mismatch',
        bad.map((item) => `${item.item} ${item.path}`).join(', '),
      );
  });
