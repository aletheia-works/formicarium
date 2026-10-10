import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { PublicationRequest } from '../../scripts/release/publication.ts';
import type { PublicationBoundary } from '../../scripts/release/publication-cli.ts';

const hash = (bytes: Uint8Array) =>
  createHash('sha256').update(bytes).digest('hex');
function zip(entries: [string, Buffer][]) {
  const locals: Buffer[] = [],
    central: Buffer[] = [];
  let offset = 0;
  for (const [path, data] of entries) {
    let crc = 0xffffffff;
    for (const byte of data) {
      crc ^= byte;
      for (let i = 0; i < 8; i++)
        crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    crc = (crc ^ 0xffffffff) >>> 0;
    const name = Buffer.from(path),
      local = Buffer.alloc(30),
      row = Buffer.alloc(46);
    local.writeUInt32LE(0x04034b50);
    local.writeUInt16LE(20, 4);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    row.writeUInt32LE(0x02014b50);
    row.writeUInt16LE(20, 4);
    row.writeUInt16LE(20, 6);
    row.writeUInt32LE(crc, 16);
    row.writeUInt32LE(data.length, 20);
    row.writeUInt32LE(data.length, 24);
    row.writeUInt16LE(name.length, 28);
    row.writeUInt32LE(offset, 42);
    locals.push(local, name, data);
    central.push(row, name);
    offset += local.length + name.length + data.length;
  }
  const end = Buffer.alloc(22),
    directory = Buffer.concat(central);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}
/** Independent fake HTTP oracle. It is never a production producer observation. */
export async function publicationBoundaryFixture(
  root: string,
  request: PublicationRequest,
): Promise<PublicationBoundary> {
  const policy = JSON.parse(
    await readFile('.github/publication/trusted-policy.json', 'utf8'),
  );
  policy.evidence.workflowId = 11;
  policy.evidence.producerAppId = 22;
  await mkdir(join(root, '.github/publication'), { recursive: true });
  await writeFile(
    join(root, '.github/publication/trusted-policy.json'),
    JSON.stringify(policy),
  );
  request.candidateRun = { runId: 123, runAttempt: 1, artifactId: 66 };
  const fetcher: typeof fetch = async (input) => {
    const reportBytes = await readFile(join(root, 'report.json')),
      report = JSON.parse(reportBytes.toString());
    const acceptance = Buffer.from(
      JSON.stringify({
        passed: true,
        context: {
          repository: request.identity.repository,
          commit: request.identity.sourceCommit,
          event: 'workflow_dispatch',
        },
        checks: [
          'release',
          'node-regression',
          'browser-regression',
          'native-aube',
          'native-pitchfork',
          'u1-node',
          'u1-browser',
          'u3-node',
          'u3-browser',
        ].map((id) => ({
          id,
          exitCode: 0,
          timedOut: false,
          skipped: 0,
          passed: 1,
          command: ['fixture'],
        })),
        coverage: report,
      }),
    );
    const archive = zip([
      ['ci-results/acceptance.json', acceptance],
      ['ci-coverage-fixed24/report.json', reportBytes],
    ]);
    const url = String(input),
      prefix = `https://api.github.com/repos/${request.identity.repository}`;
    let body: unknown;
    if (url === `${prefix}/actions/runs/123`)
      body = {
        id: 123,
        run_attempt: 1,
        repository: { full_name: request.identity.repository },
        head_sha: request.identity.sourceCommit,
        workflow_id: 11,
        path: policy.evidence.workflowIdentity,
        event: 'workflow_dispatch',
        status: 'completed',
        conclusion: 'success',
        check_suite_id: 55,
      };
    else if (url === `${prefix}/actions/runs/123/attempts/1/jobs?per_page=100`)
      body = {
        total_count: 1,
        jobs: [
          {
            name: 'candidate-required',
            conclusion: 'success',
            run_attempt: 1,
            check_run_url: `${prefix}/check-runs/100`,
          },
        ],
      };
    else if (url === `${prefix}/check-runs/100`)
      body = {
        name: 'candidate-required',
        head_sha: request.identity.sourceCommit,
        app: { id: 22 },
        check_suite: { id: 55 },
        status: 'completed',
        conclusion: 'success',
      };
    else if (url === `${prefix}/actions/artifacts/66`)
      body = {
        id: 66,
        expired: false,
        name: `modernization-${request.identity.sourceCommit}-123-1`,
        workflow_run: { id: 123, head_sha: request.identity.sourceCommit },
        digest: `sha256:${hash(archive)}`,
      };
    else if (url === `${prefix}/actions/artifacts/66/zip`)
      return new Response(archive);
    else throw Error(`unexpected fixture API endpoint: ${url}`);
    return new Response(JSON.stringify(body));
  };
  return { policyRoot: root, fetcher };
}
