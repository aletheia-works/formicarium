import { copyFile, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import {
  canonicalJson,
  parseUniqueJson,
  sha256,
} from '../../scripts/build-key.ts';
import type { CandidateManifest } from '../../scripts/candidate.ts';
import type { PackRecord } from '../../scripts/pack.ts';
import {
  type AcceptanceEvidence,
  type CheckRecord,
  type CheckRow,
  type CheckStatus,
  type EnvironmentId,
  evidenceIdOf,
  INVENTORY_OUTPUT,
  identityDigest,
  REQUIRED_ROWS,
  type SiteEvidenceIdentity,
  validateEvidence,
} from '../src/model/evidence.ts';
import { validateSiteInventory } from '../src/model/inventory.ts';
import {
  fail,
  parseOptions,
  runCli,
  type SiteLayout,
  siteLayout,
  summary,
  writeJsonFile,
  writeText,
} from './common.ts';

export type Stage = 'pre' | 'deployed';
export const BROWSERS = ['chromium', 'firefox', 'webkit', 'safari'] as const;
/** Playwright tests behind each browser row (20 per browser). */
export const ACCEPT_ROWS: Readonly<
  Record<string, { tag: string; count: number }[]>
> = Object.freeze({
  'empty-terminal-install': [{ tag: '[empty-terminal-install]', count: 8 }],
  'ui-states-keyboard': [
    { tag: '[ui-states-keyboard]', count: 2 },
    { tag: '[adversarial-output]', count: 1 },
  ],
  'browser-coi': [
    { tag: '[tool-page]', count: 8 },
    { tag: '[documents-after-terminal]', count: 1 },
  ],
});

/** Paths below the work directory read by each check (all recorded with SHA256). */
export const LOGS = Object.freeze({
  candidate: 'inputs/candidate/manifest.json',
  acceptanceLog: 'inputs/candidate/acceptance-log.json',
  pack: 'inputs/resolve/pack/pack.json',
  inventory: 'build/site-inventory.json',
  verifyCandidate: 'logs/verify-candidate.json',
  boundary: 'logs/boundary.txt',
  fixtures: 'logs/build-fixture-index.json',
  workflowTest: 'logs/workflow-test.tap',
  inventoryBuild: 'logs/inventory-build.json',
  inventoryAccept: (browser: string) => `logs/inventory-accept-${browser}.json`,
  inventoryDeploy: 'logs/inventory-deploy.json',
  deployGuard: 'logs/deploy-guard.json',
  accept: (browser: string) => `accept/${browser}/results.json`,
  coverage: 'coverage/report/summary.json',
});

interface Source {
  path: string;
  sha256: string;
  text: string;
}
type Reader = (path: string) => Promise<Source | null>;

export function workReader(work: string): Reader {
  return async (path) => {
    try {
      const bytes = await readFile(join(work, path));
      return { path, sha256: sha256(bytes), text: bytes.toString('utf8') };
    } catch {
      return null;
    }
  };
}

const json = (source: Source | null): unknown => {
  if (!source) return null;
  try {
    return parseUniqueJson(source.text);
  } catch {
    return null;
  }
};
/**
 * Facts as canonical JSON values: a number that is not a safe integer (a
 * coverage percentage) is kept as its decimal text; undefined becomes null.
 */
export function canonicalFacts(value: unknown): unknown {
  if (typeof value === 'number')
    return Number.isSafeInteger(value) ? value : String(value);
  if (value === undefined) return null;
  if (Array.isArray(value)) return value.map(canonicalFacts);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, canonicalFacts(item)]),
    );
  return value;
}

const statusOf = (ok: boolean, sources: (Source | null)[]): CheckStatus =>
  sources.some((source) => source === null)
    ? 'unverified'
    : ok
      ? 'passed'
      : 'failed';
const sourceList = (sources: (Source | null)[], paths: string[]) =>
  sources.map((source, index) => ({
    path: paths[index]!,
    sha256: source?.sha256 ?? 'missing',
  }));

interface Draft {
  name: string;
  environment: EnvironmentId;
  status: CheckStatus;
  sources: { path: string; sha256: string }[];
  facts: Record<string, unknown>;
}

async function check(
  read: Reader,
  name: string,
  environment: EnvironmentId,
  paths: string[],
  judge: (sources: (Source | null)[]) => {
    ok: boolean;
    facts: Record<string, unknown>;
  },
): Promise<Draft> {
  const sources = await Promise.all(paths.map(read));
  const { ok, facts } = sources.some((source) => source === null)
    ? {
        ok: false,
        facts: { missing: paths.filter((_, index) => !sources[index]) },
      }
    : judge(sources);
  return {
    name,
    environment,
    status: statusOf(ok, sources),
    sources: sourceList(sources, paths),
    facts,
  };
}

interface PlaywrightSpec {
  title?: string;
  ok?: boolean;
  tests?: { projectName?: string; status?: string }[];
}
interface PlaywrightSuite {
  specs?: PlaywrightSpec[];
  suites?: PlaywrightSuite[];
}
/** Specs of a Playwright JSON report, each with its overall result. */
export function playwrightSpecs(
  report: unknown,
): { title: string; passed: boolean }[] {
  const found: { title: string; passed: boolean }[] = [];
  const walk = (suite: PlaywrightSuite) => {
    for (const spec of suite.specs ?? [])
      found.push({
        title: String(spec.title ?? ''),
        passed:
          spec.ok === true &&
          (spec.tests ?? []).length > 0 &&
          (spec.tests ?? []).every((test) => test.status === 'expected'),
      });
    for (const child of suite.suites ?? []) walk(child);
  };
  for (const suite of (report as { suites?: PlaywrightSuite[] } | null)
    ?.suites ?? [])
    walk(suite);
  return found;
}

const sameInventory = (expected: string) => (sources: (Source | null)[]) => {
  const values = sources.map(
    (source) => (json(source) as { actual?: unknown } | null)?.actual,
  );
  return {
    ok: values.every((value) => value === expected),
    facts: { expected, recorded: values },
  };
};

/** Every required row as a draft, from the logs of this run. */
export async function draftChecks(
  read: Reader,
  identity: SiteEvidenceIdentity,
  stage: Stage,
): Promise<Draft[]> {
  const drafts: Draft[] = [];
  for (const required of REQUIRED_ROWS.filter((row) =>
    row.name.startsWith('tool-'),
  )) {
    const tool = required.name.slice('tool-'.length, -'-version'.length);
    drafts.push(
      await check(
        read,
        required.name,
        required.environment,
        [LOGS.acceptanceLog, LOGS.candidate],
        ([log, manifest]) => {
          const rows = (
            (json(log!) as { rows?: Record<string, unknown>[] } | null)?.rows ??
            []
          ).filter(
            (row) =>
              row.tool === tool && row.environment === required.environment,
          );
          const version = (
            json(manifest!) as CandidateManifest | null
          )?.resolvedTools.find((item) => item.tool === tool)?.version;
          return {
            ok:
              rows.length === 1 &&
              rows[0]!.status === 'passed' &&
              rows[0]!.expectedVersion === version,
            facts: { row: rows[0] ?? null, acceptedVersion: version ?? null },
          };
        },
      ),
    );
  }
  for (const [name, groups] of Object.entries(ACCEPT_ROWS))
    for (const browser of BROWSERS)
      drafts.push(
        await check(read, name, browser, [LOGS.accept(browser)], ([report]) => {
          const specs = playwrightSpecs(json(report!));
          const counts = groups.map((group) => {
            const tagged = specs.filter((spec) =>
              spec.title.includes(group.tag),
            );
            return {
              tag: group.tag,
              expected: group.count,
              found: tagged.length,
              passed: tagged.filter((spec) => spec.passed).length,
            };
          });
          return {
            ok: counts.every(
              (item) =>
                item.found === item.expected && item.passed === item.expected,
            ),
            facts: { tests: counts },
          };
        }),
      );
  drafts.push(
    await check(
      read,
      'public-import-boundary',
      'host',
      [LOGS.boundary],
      ([log]) => ({
        ok: /^boundary: no violation$/m.test(log!.text),
        facts: { output: log!.text.trim().split('\n').slice(-3) },
      }),
    ),
    await check(
      read,
      'fixture-isolation',
      'host',
      [LOGS.fixtures, LOGS.verifyCandidate],
      ([indexes, verify]) => {
        const written =
          (json(indexes!) as { indexes?: { source?: string }[] } | null)
            ?.indexes ?? [];
        const item7 = (
          (
            json(verify!) as {
              lines?: { item: string; ok: boolean | null }[];
            } | null
          )?.lines ?? []
        ).find((line) => line.item === '7-fixtures');
        const sources = written.map((item) => String(item.source));
        return {
          ok:
            written.length > 0 &&
            sources.every((source) =>
              /^showcase\/fixtures\/[a-z0-9-]+$/.test(source),
            ) &&
            item7?.ok === true,
          facts: { sources, fixtureInventory: item7?.ok ?? null },
        };
      },
    ),
    await check(
      read,
      'candidate-identity',
      'host',
      [LOGS.verifyCandidate],
      ([verify]) => {
        const value = json(verify!) as {
          candidateId?: string;
          lines?: { ok: boolean | null }[];
        } | null;
        const lines = value?.lines ?? [];
        return {
          ok:
            lines.length > 0 &&
            lines.every((line) => line.ok !== false) &&
            value?.candidateId === identity.candidateId,
          facts: {
            mode: (value as { mode?: string } | null)?.mode ?? null,
            lines: lines.length,
            logged: lines.filter((line) => line.ok === null).length,
          },
        };
      },
    ),
    await check(
      read,
      'previous-site-preserved',
      'host',
      stage === 'deployed'
        ? [LOGS.workflowTest, LOGS.deployGuard]
        : [LOGS.workflowTest],
      ([tap, guard]) => {
        const pass = Number(/^# pass (\d+)$/m.exec(tap!.text)?.[1] ?? 0);
        const failed = Number(/^# fail (\d+)$/m.exec(tap!.text)?.[1] ?? 1);
        const allowed = guard
          ? (json(guard) as { allowed?: unknown } | null)?.allowed === true
          : true;
        return {
          ok: pass > 0 && failed === 0 && allowed,
          facts: {
            workflowTests: { pass, fail: failed },
            deployGuard: guard ? json(guard) : null,
          },
        };
      },
    ),
    await check(
      read,
      'site-inventory',
      'host',
      [
        LOGS.inventoryBuild,
        ...BROWSERS.map(LOGS.inventoryAccept),
        ...(stage === 'deployed' ? [LOGS.inventoryDeploy] : []),
      ],
      sameInventory(identity.siteInventorySha256),
    ),
    await check(read, 'coverage-80', 'host', [LOGS.coverage], ([report]) => {
      const value = json(report!) as {
        linesPct?: number;
        threshold?: number;
        missing?: unknown[];
      } | null;
      return {
        ok:
          typeof value?.linesPct === 'number' &&
          value.linesPct >= 80 &&
          value.threshold === 80 &&
          Array.isArray(value.missing) &&
          value.missing.length === 0,
        facts: {
          linesPct: value?.linesPct ?? null,
          missing: value?.missing ?? null,
        },
      };
    }),
  );
  return drafts;
}

/** SiteEvidenceIdentity of this run: candidate, staged pack, built site. */
export async function evidenceIdentity(
  read: Reader,
  sourceCommit: string,
): Promise<SiteEvidenceIdentity> {
  const manifest = json(await read(LOGS.candidate)) as CandidateManifest | null;
  const pack = json(await read(LOGS.pack)) as PackRecord | null;
  const inventory = json(await read(LOGS.inventory));
  if (!manifest || !pack || !inventory)
    fail(
      'evidence-invalid',
      'candidate manifest, pack record or site inventory missing',
    );
  return {
    sourceCommit,
    formicariumSourceCommit: pack.formicariumSourceCommit,
    formicariumPackSha256: pack.packSha256,
    candidateId: manifest.candidateId,
    catalogSha256: manifest.catalogSha256,
    fixtureInventorySha256: manifest.fixtureInventorySha256,
    siteInventorySha256: validateSiteInventory(inventory).sha256,
  };
}

/** Writes each check record, then the complete site evidence; refuses incomplete rows. */
export async function assembleEvidence(options: {
  layout: SiteLayout;
  stage: Stage;
  sourceCommit: string;
  recordedAt?: string;
}): Promise<{ evidence: AcceptanceEvidence; directory: string }> {
  const { layout, stage } = options;
  const read = workReader(layout.work);
  const identity = await evidenceIdentity(read, options.sourceCommit);
  const digest = identityDigest(identity);
  const directory = join(layout.evidence, stage);
  const checks: CheckRow[] = [];
  for (const draft of await draftChecks(read, identity, stage)) {
    const record: CheckRecord = {
      schemaVersion: 1,
      identityDigest: digest,
      ...draft,
      facts: canonicalFacts(draft.facts) as Record<string, unknown>,
    };
    const text = canonicalJson(record);
    await writeText(
      join(directory, 'checks', `${draft.name}--${draft.environment}.json`),
      text,
    );
    checks.push({
      name: draft.name,
      environment: draft.environment,
      status: draft.status,
      logSha256: sha256(text),
    });
  }
  const body: Omit<AcceptanceEvidence, 'evidenceId'> = {
    schemaVersion: 1,
    unit: 'showcase-site',
    sourceCommit: options.sourceCommit,
    recordedAt: options.recordedAt ?? new Date().toISOString(),
    identity,
    checks,
    outputs: [{ path: INVENTORY_OUTPUT, digest: identity.siteInventorySha256 }],
    ...(stage === 'deployed'
      ? { deployedIdentity: identity.siteInventorySha256 }
      : {}),
  };
  const evidence: AcceptanceEvidence = {
    ...body,
    evidenceId: evidenceIdOf(body),
  };
  await writeJsonFile(join(directory, 'checks.json'), checks);
  validateEvidence(evidence, { deployed: stage === 'deployed' });
  await copyFile(
    join(layout.work, LOGS.inventory),
    join(directory, INVENTORY_OUTPUT),
  );
  await writeJsonFile(join(directory, 'evidence.json'), evidence);
  return { evidence, directory };
}

if (import.meta.main)
  await runCli('evidence', async () => {
    const { stage } = parseOptions(process.argv.slice(2), ['stage']);
    if (stage !== 'pre' && stage !== 'deployed')
      fail('config-invalid', '--stage pre|deployed');
    const layout = siteLayout();
    try {
      const { evidence, directory } = await assembleEvidence({
        layout,
        stage,
        sourceCommit:
          process.env.SHOWCASE_SOURCE_COMMIT ?? process.env.GITHUB_SHA ?? '',
      });
      await summary([
        `- evidence (${stage}): \`${evidence.evidenceId}\`, ${evidence.checks.length} rows, ${relative(layout.work, directory)}`,
      ]);
    } catch (error) {
      const rows = await readFile(
        join(layout.evidence, stage, 'checks.json'),
        'utf8',
      ).catch(() => '[]');
      await summary([
        '- evidence: refused',
        ...(JSON.parse(rows) as CheckRow[])
          .filter((row) => row.status !== 'passed')
          .map((row) => `  - ${row.name}/${row.environment}: ${row.status}`),
      ]);
      throw error;
    }
  });
