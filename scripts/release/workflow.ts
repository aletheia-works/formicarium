import { requireCondition } from './evidence.ts';
import type { PublicationIdentity } from './publication.ts';
import { validatePublicationIdentity } from './publication.ts';

export interface PublicationContext {
  event: string;
  repository: string;
  ref: string;
  sha: string;
}
export function assertPublicationContext(
  i: PublicationIdentity,
  c: PublicationContext,
) {
  validatePublicationIdentity(i);
  requireCondition(
    c.event === 'push' &&
      c.repository === i.repository &&
      c.ref === `refs/tags/${i.tag}` &&
      c.sha === i.sourceCommit,
    'untrusted publication context',
  );
}
/** JSON is a YAML subset; validate the actual job graph and execution boundaries. */
export function validatePublishWorkflow(text: string) {
  const w = JSON.parse(text);
  requireCondition(
    JSON.stringify(w.on) === JSON.stringify({ push: { tags: ['v*'] } }),
    'publication triggers differ',
  );
  requireCondition(
    JSON.stringify(w.permissions) === JSON.stringify({ contents: 'read' }),
    'global publication permissions differ',
  );
  requireCondition(
    w.concurrency?.group === 'publication-${{ github.ref }}' &&
      w.concurrency['cancel-in-progress'] === false,
    'publication concurrency differs',
  );
  requireCondition(
    JSON.stringify(Object.keys(w.jobs).sort()) ===
      JSON.stringify(['publish', 'release', 'verify']),
    'publication jobs differ',
  );
  for (const [name, job] of Object.entries(w.jobs) as [string, any][]) {
    requireCondition(
      job['runs-on'] === 'ubuntu-24.04' && job['timeout-minutes'] === 30,
      'publication runner/time limit differs',
    );
    const expected =
      name === 'publish'
        ? {
            contents: 'read',
            actions: 'read',
            checks: 'read',
            'id-token': 'write',
          }
        : name === 'release'
          ? { contents: 'write', actions: 'read', checks: 'read' }
          : { contents: 'read', actions: 'read', checks: 'read' };
    requireCondition(
      JSON.stringify(job.permissions) === JSON.stringify(expected),
      'job permissions differ',
    );
    requireCondition(
      job.if ===
        "github.event_name == 'push' && github.repository == 'aletheia-works/formicarium' && startsWith(github.ref, 'refs/tags/v')",
      'job origin gate differs',
    );
    if (name !== 'verify')
      requireCondition(
        job.environment === 'release' &&
          job.needs === (name === 'publish' ? 'verify' : 'publish'),
        'publication environment/dependency differs',
      );
    requireCondition(
      !JSON.stringify(job).match(
        /NODE_AUTH_TOKEN|NPM_TOKEN|_authToken|secrets\./,
      ),
      'token fallback refused',
    );
    for (const step of job.steps)
      if (step.uses)
        requireCondition(
          /^[^\s]+@[a-f0-9]{40}$/.test(step.uses),
          'action not pinned',
        );
    const checkout = job.steps.find((s: any) =>
      s.uses?.startsWith('actions/checkout@'),
    );
    requireCondition(
      checkout?.with?.ref === '${{ github.sha }}' &&
        checkout.with['persist-credentials'] === false,
      'trusted exact tag checkout missing',
    );
    const runs = job.steps
      .filter((s: any) => s.run)
      .map((s: any) => s.run) as string[];
    if (name === 'verify') {
      requireCondition(
        runs.includes('bun install --frozen-lockfile --ignore-scripts') &&
          runs.includes('bun run build'),
        'Bun verification tasks missing',
      );
      requireCondition(
        runs.includes(
          'node .github/publication/runner.mjs gate .artifacts/publication',
        ) &&
          runs.includes(
            'node .github/publication/runner.mjs prepare-assets .artifacts/publication .artifacts/publication-assets',
          ),
        'publication gate missing',
      );
      const upload = job.steps.find((s: any) =>
        s.uses?.startsWith('actions/upload-artifact@'),
      );
      requireCondition(
        upload?.with?.name === 'publication-assets' &&
          upload.with.path === '.artifacts/publication-assets/*' &&
          upload.with['if-no-files-found'] === 'error',
        'transfer artifact differs',
      );
      requireCondition(
        !runs.some((r) =>
          /npm publish|bootstrap.mjs (publish|release)/.test(r),
        ),
        'writer in verification refused',
      );
    } else {
      requireCondition(
        runs.length === 1 &&
          runs[0] === `node .github/publication/bootstrap.mjs ${name}`,
        'unvalidated publication command/gate',
      );
      requireCondition(
        job.env?.AIDLC_RELEASE_OPERATION === name,
        'publication operation differs',
      );
      requireCondition(
        !job.steps.some(
          (s: any) =>
            s.uses && !/^(actions\/checkout|actions\/setup-node)@/.test(s.uses),
        ),
        'writer action refused',
      );
    }
  }
  return w;
}
